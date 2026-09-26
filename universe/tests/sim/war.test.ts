import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref, type World } from "../../src/kernel/index.ts";
import {
  LIVING_MEMORY,
  POLITY_EVENTS,
  WAR_EVENTS,
  WEARY_YEARS,
  diplomacyOf,
  makePopulationWorld,
  politiesOf,
  populationContext,
  warsOf,
} from "../../src/sim/index.ts";
import { why, type Explanation } from "../../src/causal/index.ts";

// Juniper's many realms fight often, holy wars among them.
const world = makePopulationWorld(seedFromText("juniper"), { start: "spread" });
world.runTo(400 * YEAR);
const ctx = populationContext(world),
  wars = warsOf(world).all();

/** Every ref the why-tree of `ref` reaches within `depth` steps (bounded). */
function reach(w: World, ref: string, depth = 9): Set<string> {
  const seen = new Set<string>([ref]);
  let level: Explanation[] = [why(w, ref as Ref)];
  for (let d = 0; d < depth && level.length; d++) {
    const next: Explanation[] = [];
    for (const node of level)
      for (const edge of node.causes) {
        if (seen.has(edge.cause.ref) || seen.size > 3000) continue;
        seen.add(edge.cause.ref);
        next.push(edge.next());
      }
    level = next;
  }
  return seen;
}

test("realms go to war, by decisions that cite their rivalry and the land they want", () => {
  assert.ok(wars.length >= 3, `${wars.length} wars`);
  for (const w of wars.slice(0, 10)) {
    const d = world.decisions.get(world.events.get(w.event)!.causes[0]!.ref as Ref)!;
    assert.equal(d.rule, "war.declare");
    assert.ok(
      d.factors.some((f) => f.source?.ref.startsWith("rel:")),
      "the rivalry",
    );
    assert.ok(
      d.factors.some((f) => f.source?.ref === `cell:0:${w.prize}`),
      "the land they want",
    );
  }
});

test("a war's why reaches the economy and the ground it was fought over", () => {
  const economic = (w: World, r: string) => {
    const e = w.events.get(r as Ref);
    if (e) return /^(people\.famine|trade\.|settlement\.market|lore\.|knowledge\.)/.test(e.type);
    return r.startsWith("mkt:");
  };
  const found = wars.find((w) => {
    const refs = [...reach(world, w.event)];
    return (
      refs.some((r) => r.startsWith("cell:") || r.startsWith("plate:")) &&
      refs.some((r) => economic(world, r))
    );
  });
  assert.ok(found, "some war reaches both an economic fact and the land");
});

test("the fallen are written into the ledgers of deaths", () => {
  // (Within living memory: older deaths are let go from the ledgers.)
  let battles = 0;
  for (const w of wars)
    for (const b of w.battles) {
      if (b.year < 400 - LIVING_MEMORY) continue;
      battles++;
      assert.ok(
        ctx.history.deathsIn(b.land, b.year) >= b.fallen[1],
        "the defenders' dead are counted where they fell",
      );
    }
  assert.ok(battles >= 3);
  for (const p of ctx.provinces.all())
    for (let r = 0; r < 20; r++) for (let o = 0; o < 7; o++) assert.ok(p.counts.get(r, o) >= 0);
});

test("a land belongs to one realm at most, and wars end in peace or with a realm gone", () => {
  const realms = politiesOf(world),
    owner = new Map<number, string>();
  for (const p of realms.living())
    for (const c of p.members) {
      assert.ok(!owner.has(c), `land ${c} is in two realms`);
      owner.set(c, p.ref);
    }
  for (const w of wars)
    if (w.ended !== null)
      assert.ok(
        w.peace ||
          realms.get(w.attacker)!.ended !== null ||
          realms.get(w.defender)!.ended !== null ||
          w.battles.length === 0,
        "an ended war ended in peace, or a side was gone",
      );
  const taken = world.events.all().filter((e) => e.type === WAR_EVENTS.taken.type);
  assert.ok(taken.length >= 1, "some land changed hands");
});

test("a realm whose seat is taken falls, and history says in which battle", () => {
  const fallen = world.events
    .all()
    .filter(
      (e) =>
        e.type === POLITY_EVENTS.ended.type &&
        world.events.get(e.causes[0]!.ref as Ref)?.type === WAR_EVENTS.battle.type,
    );
  assert.ok(fallen.length >= 1, "some realm fell to conquest");
  for (const e of fallen) {
    const realm = politiesOf(world).get(e.subjects[0]!)!;
    assert.notEqual(realm.ended, null);
    assert.equal(realm.members.length, 0, "its lands went free");
  }
});

test("at a death, a realm's far lands break away under a rival claimant, joined to its new seat", () => {
  const raised = world.events
    .all()
    .filter(
      (e) =>
        e.type === POLITY_EVENTS.formed.type &&
        world.events.get(e.causes[0]!.ref as Ref)?.type === POLITY_EVENTS.split.type,
    );
  assert.ok(raised.length >= 1, "some realm was raised by a split");
  for (const e of raised) {
    const split = world.events.get(e.causes[0]!.ref as Ref)!;
    assert.equal(
      world.events.get(split.causes[0]!.ref as Ref)?.type,
      POLITY_EVENTS.succession.type,
    );
  }
});

test("a realm fresh from war is slow to go to war again, and says so", () => {
  let cited = 0;
  for (const w of wars) {
    const d = world.decisions.get(world.events.get(w.event)!.causes[0]!.ref as Ref)!,
      weary = d.factors.find((f) => f.name === "the years since their last war");
    if (!weary) continue;
    cited++;
    assert.ok(weary.value < WEARY_YEARS, `${weary.value} years since`);
    assert.equal(world.events.get(weary.source!.ref as Ref)?.type, WAR_EVENTS.peace.type);
  }
  assert.ok(cited >= 1, "some war was declared by a realm not long at peace");
});

test("a devout realm under the sacred law holds a rival faith at its border an affront", () => {
  const zeal = diplomacyOf(world)
    .all()
    .flatMap((r) => r.terms.filter((t) => t.name.startsWith("the zeal of")).map((t) => ({ r, t })));
  assert.ok(zeal.length >= 1, "some realm's zeal sours a regard");
  for (const { t } of zeal) {
    assert.ok(t.value < 0 && t.value >= -0.25);
    // Its source is how the zealots' seat came to its faith: founded there, or taken up.
    assert.match(world.events.get(t.source!)?.type ?? "", /^belief\.(founded|converted|schism)$/);
  }
});
