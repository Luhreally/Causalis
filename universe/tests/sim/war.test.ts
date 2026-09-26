import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref, type World } from "../../src/kernel/index.ts";
import {
  WAR_EVENTS,
  makePopulationWorld,
  politiesOf,
  populationContext,
  warsOf,
} from "../../src/sim/index.ts";
import { why, type Explanation } from "../../src/causal/index.ts";

const world = makePopulationWorld(seedFromText("kestrel"), { start: "spread" });
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
  let battles = 0;
  for (const w of wars)
    for (const b of w.battles) {
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
