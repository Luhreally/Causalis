import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  verifyByReplay,
  type Ref,
  type World,
} from "../../src/kernel/index.ts";
import {
  BELIEF_EVENTS,
  PEOPLE_ACT_EVENTS,
  POLITY_EVENTS,
  REGARD,
  WAR_EVENTS,
  beliefOf,
  diplomacyOf,
  frontier,
  makePopulationWorld,
  politiesOf,
  populationContext,
  warsOf,
  type Polity,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";

// Juniper's many realms (as the war tests have them), four centuries on.
const seed = seedFromText("juniper"),
  build = (s = seed) => makePopulationWorld(s, { start: "spread" }),
  AT = 400 * YEAR,
  chain = (w: World) => w.checkpoints().map((c) => c.chain);
const world = build();
world.runTo(AT);
// Each test acts on its own copy of the world as it stood then.
const RULESET = rulesetId(world, "test"),
  AS_IT_WAS = saveWorld(world, RULESET),
  fresh = () => loadWorld(AS_IT_WAS, build, RULESET).world;

/** Two standing realms at peace with a land between them to fight for, the most peopled first. */
function neighbours(w: World): [Polity, Polity] {
  const ctx = populationContext(w),
    people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
    living = [...politiesOf(w).living()].sort(
      (a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1),
    );
  for (const a of living)
    for (const b of living)
      if (a !== b && !warsOf(w).between(a.ref, b.ref) && frontier(ctx, a, b).length) return [a, b];
  throw new Error("no two realms touch");
}

test("the god sets one realm upon another: a war declared by the act, fought as any war", () => {
  const w = fresh();
  const [a, b] = neighbours(w),
    act = w.submit("act.war", { a: a.ref, b: b.ref });
  w.runTo(AT + 3 * YEAR);
  const war = warsOf(w)
    .all()
    .find((x) => x.attacker === a.ref && x.defender === b.ref && x.declared === 400)!;
  assert.ok(war, "the war stands");
  const declared = w.events.get(war.event)!;
  assert.equal(declared.type, WAR_EVENTS.declared.type);
  assert.equal(declared.causes[0]!.ref, act.id, "its declaration cites the act");
  assert.equal(declared.causes[0]!.role, "agent");
  assert.match(why(w, war.event).claim, /war/);
  assert.ok(war.battles.length >= 1 || war.ended !== null, "it is fought (or already ended)");
  assert.throws(() => w.submit("act.war", { a: a.ref, b: a.ref }), /against itself/);
  if (war.ended === null)
    assert.throws(() => w.submit("act.war", { a: a.ref, b: b.ref }), /at war already/);
});

test("the god ends a war: its peace cites the act, and the realms remember the war", () => {
  const w = fresh();
  const [a, b] = neighbours(w);
  w.submit("act.war", { a: a.ref, b: b.ref });
  w.runTo(AT + 1);
  const peace = w.submit("act.peace", { a: b.ref, b: a.ref });
  w.runTo(AT + 2);
  const war = warsOf(w)
    .all()
    .find((x) => x.attacker === a.ref && x.defender === b.ref && x.declared === 400)!;
  assert.equal(war.ended, 400, "ended the year it began");
  const e = w.events.get(war.peace!)!;
  assert.equal(e.type, WAR_EVENTS.peace.type);
  assert.equal(e.causes[0]!.ref, peace.id, "the peace cites the act");
  assert.ok(
    diplomacyOf(w)
      .remembered(a.ref, b.ref, 400)
      .some((t) => t.name === "a war between them"),
    "the war is remembered",
  );
  assert.throws(() => w.submit("act.peace", { a: a.ref, b: b.ref }), /not at war/);
});

test("friendship and discord are remembered between two realms, and fade as memories do", () => {
  const w = fresh();
  const [a, b] = neighbours(w),
    kind = w.submit("act.friendship", { a: a.ref, b: b.ref });
  w.runTo(AT + 1);
  const terms = () => diplomacyOf(w).remembered(a.ref, b.ref, 400),
    kindly = terms().find((t) => t.name === "the god's favour on their friendship")!;
  assert.ok(kindly, "the friendship is remembered");
  assert.ok(Math.abs(kindly.value - REGARD) < 1e-9);
  const e = w.events.get(kindly.source!)!;
  assert.equal(e.type, PEOPLE_ACT_EVENTS.friendship.type);
  assert.equal(e.causes[0]!.ref, kind.id);
  assert.match(why(w, e.id).claim, /were made friends/);
  w.submit("act.discord", { a: a.ref, b: b.ref });
  w.runTo(AT + 2);
  assert.ok(
    terms().some((t) => t.name === "a discord the god sowed between them" && t.value < 0),
    "the discord is remembered",
  );
  // (Thirty years on, half as strongly.)
  const later = diplomacyOf(w)
    .remembered(a.ref, b.ref, 430)
    .find((t) => t.name === "the god's favour on their friendship")!;
  assert.ok(Math.abs(later.value - REGARD / 2) < 1e-6, `${later.value}`);
});

test("a land stirred to rise breaks from its realm, and raises its own where it has a town", () => {
  const w = fresh();
  const ctx = populationContext(w),
    realm = [...politiesOf(w).living()]
      .filter((p) => p.members.length >= 3)
      .sort((x, y) => y.members.length - x.members.length || (x.ref < y.ref ? -1 : 1))[0]!,
    land = realm.members.find((c) => c !== realm.seat && ctx.settlements.inProvince(c).length > 0)!;
  assert.ok(land !== undefined, "a land of the realm with a town");
  assert.throws(() => w.submit("act.rise", { cell: realm.seat }), /seat/);
  const act = w.submit("act.rise", { cell: land });
  w.runTo(AT + 1);
  const now = politiesOf(w).of(land);
  assert.ok(now && now.ref !== realm.ref, "the land is its own realm's");
  const formed = w.events.get(now.event)!;
  assert.equal(formed.type, POLITY_EVENTS.formed.type);
  const seceded = w.events.get(formed.causes[0]!.ref as Ref)!;
  assert.equal(seceded.type, POLITY_EVENTS.seceded.type);
  assert.equal(seceded.causes[0]!.ref, act.id, "its rising cites the act");
  assert.ok(
    diplomacyOf(w)
      .remembered(realm.ref, now.ref, 400)
      .some((t) => t.name === "a land that rose against them" && t.value < 0),
    "the realm it left remembers it bitterly",
  );
});

test("a land turned to a faith holds it from the act", () => {
  const w = fresh();
  const ctx = populationContext(w),
    faiths = beliefOf(w),
    faith = faiths.all()[0]!,
    land = ctx.provinces
      .all()
      .find((p) => p.total() > 0 && faiths.of(p.cell).faith !== faith.ref)!.cell;
  const act = w.submit("act.convert", { cell: land, faith: faith.ref });
  w.runTo(AT + 1);
  const held = faiths.of(land);
  assert.equal(held.faith, faith.ref);
  const e = w.events.get(held.event!)!;
  assert.equal(e.type, BELIEF_EVENTS.converted.type);
  assert.equal(e.causes[0]!.ref, act.id);
  assert.throws(
    () => w.submit("act.convert", { cell: land, faith: faith.ref }),
    /hold that faith already/,
  );
});

test("a world touched by the acts on its peoples replays, and its save continues, bit for bit", () => {
  const w = fresh();
  const [a, b] = neighbours(w);
  w.submit("act.discord", { a: a.ref, b: b.ref });
  w.submit("act.war", { a: a.ref, b: b.ref });
  w.runTo(AT + 3 * YEAR);
  const doc = saveWorld(w, RULESET);
  assert.deepEqual(verifyByReplay(doc, build), { ok: true, problem: null });
  const loaded = loadWorld(doc, build, RULESET).world;
  w.runTo(AT + 6 * YEAR);
  loaded.runTo(AT + 6 * YEAR);
  assert.deepEqual(chain(loaded), chain(w));
  // (And the world left alone went otherwise.)
  world.runTo(AT + 6 * YEAR);
  assert.notDeepEqual(chain(world).at(-1), chain(w).at(-1));
});
