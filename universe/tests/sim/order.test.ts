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
  type SimTime,
  type World,
} from "../../src/kernel/index.ts";
import { PRINCIPLES } from "../../src/rules/index.ts";
import {
  BOND,
  BONDS,
  CAPTIVE_LINE,
  MANDATE_PUSH,
  ORDER_EVENTS,
  POPULATION_EVENTS,
  WAY,
  boundShare,
  capacityOf,
  cultureOf,
  legitimacyFactors,
  loreOf,
  makePopulationWorld,
  orderOf,
  orderYear,
  politiesOf,
  populationContext,
  warsOf,
  type Polity,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";

// Juniper's realms, sixty years on: the order of each, and the bound in its lands, worked
// on directly by the year of the order alone (the rest of the world held still).
const seed = seedFromText("juniper"),
  build = (s = seed) => makePopulationWorld(s, { start: "spread" }),
  world = build();
world.runTo(60 * YEAR);
const RULESET = rulesetId(world, "test"),
  AS_IT_WAS = saveWorld(world, RULESET),
  fresh = () => loadWorld(AS_IT_WAS, build, RULESET).world;

const greatest = (w: World): Polity => {
  const ctx = populationContext(w),
    people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0);
  return [...politiesOf(w).living()]
    .filter((p) => p.members.length >= 3)
    .sort((a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1))[0]!;
};
/** Run the order's year alone from `from` to `to` (years), the world otherwise held still. */
const orderFor = (w: World, from: number, to: number) => {
  const ctx = populationContext(w);
  for (let y = from; y <= to; y++) orderYear(ctx, (y * YEAR + 1) as SimTime);
};
const typed = (w: World, type: string) => w.events.all().filter((e) => e.type === type);
/** The events of a type told since `before` (the ids there were then). */
const since = (w: World, type: string, before: ReadonlySet<string>) =>
  typed(w, type).filter((e) => !before.has(e.id));
const ids = (w: World) => new Set(w.events.all().map((e) => e.id as string));

test("every realm has an order: standing, reach, what is skimmed, rank; each within its bounds", () => {
  const store = orderOf(world)!,
    ctx = populationContext(world);
  assert.ok(store.realms.size > 0);
  for (const p of politiesOf(world).living()) {
    const o = store.of(p.ref)!;
    assert.ok(o, `${p.ref} has an order`);
    for (const v of [o.legitimacy, o.corruption, o.caste, o.corvee])
      assert.ok(v >= 0 && v <= 1, JSON.stringify(o));
    const cap = capacityOf(ctx, p);
    assert.ok(cap.value >= 0.05 && cap.value <= 0.95);
    const factors = legitimacyFactors(ctx, p);
    assert.ok(factors.length >= 6 && factors.every((f) => Number.isFinite(f.contribution)));
    for (let k = 0; k < BONDS.length; k++) {
      const s = boundShare(ctx, p, k);
      assert.ok(s >= 0 && s <= 1);
    }
  }
});

test("a land taken by a people who keep to rank and are closed to strangers: its people carried off, and why", () => {
  const w = fresh(),
    ctx = populationContext(w),
    realms = politiesOf(w),
    a = greatest(w),
    culture = cultureOf(w),
    seatWays = culture.get(a.seat)!;
  // The victors hard, the taken strange to them.
  seatWays.traits[WAY.hierarchy] = 0.95;
  seatWays.traits[WAY.openness] = 0.05;
  seatWays.traits[WAY.valour] = 0.9;
  const land = a.members.find((c) => c !== a.seat && (ctx.provinces.get(c)?.total() ?? 0) > 400)!;
  assert.ok(land !== undefined, "a peopled land of the realm");
  const before = ctx.provinces.get(land)!.total(),
    seatBefore = ctx.provinces.get(a.seat)!.total(),
    battle = w.events.emit({
      type: "war.battle",
      subjects: [a.ref],
      place: ctx.provinces.get(land)!.ref,
      causes: [{ ref: a.event, role: "trigger", weight: 1 }],
      data: {},
    });
  warsOf(w).add({
    ref: "war:0:9999" as Ref,
    attacker: a.ref,
    defender: a.ref,
    declared: 61,
    event: battle,
    prize: land,
    battles: [{ year: 61, land, won: true, fallen: [0, 0], event: battle }],
    fallen: [0, 0],
    ended: null,
    peace: null,
  });
  assert.equal(realms.of(land)?.ref, a.ref);
  const was = ids(w);
  orderFor(w, 61, 61);
  const taken = since(w, ORDER_EVENTS.captives.type, was).filter(
    (e) => e.place === ctx.provinces.get(land)!.ref,
  );
  assert.equal(taken.length, 1, "captives carried off");
  const n = (taken[0]!.data as { count: number }).count;
  assert.ok(n >= 10);
  assert.equal(ctx.provinces.get(land)!.total(), before - n, "gone from their land");
  assert.equal(ctx.provinces.get(a.seat)!.total(), seatBefore + n, "come to the seat");
  assert.ok(orderOf(w)!.land(a.seat)!.shares[BOND.chattel]! > 0, "held as chattel there");
  assert.match(why(w, taken[0]!.id).claim, /carried off .* into bondage/);
  const decision = taken[0]!.causes.find((c) => w.decisions.get(c.ref)?.rule === "order.captives");
  assert.ok(decision, "the choice to take them");
  assert.ok(w.decisions.get(decision.ref)!.score >= CAPTIVE_LINE);
  assert.ok(
    taken[0]!.causes.some((c) => c.ref === battle) &&
      w.decisions.get(decision.ref)!.factors.some((f) => f.source?.ref === battle),
    "back to the battle",
  );
});

test("the hungry of a land where rank is steep and kin do not feed kin sell themselves into debt, and work it off", () => {
  const w = fresh(),
    ctx = populationContext(w),
    p = greatest(w),
    c = p.members.find((m) => (ctx.provinces.get(m)?.total() ?? 0) > 600)!,
    prov = ctx.provinces.get(c)!,
    ways = cultureOf(w).get(c)!;
  ways.traits[WAY.hierarchy] = 0.9;
  ways.traits[WAY.kinship] = 0.1;
  ways.traits[WAY.openness] = 0.1;
  prov.leanest = 350;
  prov.lastFamine = w.events.emit({
    type: POPULATION_EVENTS.famine.type,
    place: prov.ref,
    causes: [],
    data: {},
  });
  const was = ids(w);
  orderFor(w, 61, 61);
  const debt = orderOf(w)!.land(c)!.shares[BOND.debt]!;
  assert.ok(debt > 0.01, `bound for debt: ${debt}`);
  const told = since(w, ORDER_EVENTS.bondage.type, was).filter((e) => e.place === prov.ref);
  assert.equal(told.length, 1);
  assert.match(why(w, told[0]!.id).claim, /sold themselves into debt bondage/);
  // Fed again, they work it off.
  prov.leanest = 1000;
  prov.lastFamine = null;
  orderFor(w, 62, 80);
  assert.ok(orderOf(w)!.land(c)!.shares[BOND.debt]! < debt * 0.5, "worked off in good years");
});

test("a land of the bound rises: freed and a realm of its own, or crushed and remembered", () => {
  const w = fresh(),
    ctx = populationContext(w),
    p = greatest(w),
    store = orderOf(w)!,
    lands = p.members.filter((c) => c !== p.seat && (ctx.provinces.get(c)?.total() ?? 0) > 300);
  assert.ok(lands.length >= 1);
  for (const c of lands) {
    const l = store.lands.get(c) ?? { cell: c, shares: BONDS.map(() => 0), cause: null };
    l.shares[BOND.chattel] = 0.9;
    store.lands.set(c, l);
    politiesOf(w).setDiscontent(c, { level: 1, cause: null });
  }
  const o = store.of(p.ref)!;
  o.caste = 0;
  o.legitimacy = 0.1;
  const was = ids(w);
  orderFor(w, 61, 200);
  const rose = since(w, ORDER_EVENTS.revolt.type, was);
  assert.ok(rose.length >= 1, "a rising");
  const outcomes = [
    ...since(w, ORDER_EVENTS.freed.type, was),
    ...since(w, ORDER_EVENTS.crushed.type, was),
  ];
  assert.ok(outcomes.length >= 1, "won or lost");
  for (const e of outcomes) {
    assert.ok(
      e.causes.some((c) => rose.some((r) => r.id === c.ref)),
      "it follows its rising",
    );
    assert.match(why(w, e.id).claim, /broke their chains|overthrew|was crushed/);
  }
  for (const r of rose) {
    const d = r.causes.find((c) => w.decisions.get(c.ref)?.rule === "order.revolt");
    assert.ok(d, "the rising a decision with its reasons");
  }
  // A rising crushed is remembered, and its land cowed for a while.
  const crushed = since(w, ORDER_EVENTS.crushed.type, was)[0];
  if (crushed) assert.ok(o.memory.some((m) => m.event === crushed.id) || o.memory.length > 0);
});

test("a realm with written law and a strong movement weighs freeing its bound against its court", () => {
  const w = fresh(),
    ctx = populationContext(w),
    p = greatest(w),
    store = orderOf(w)!,
    o = store.of(p.ref)!,
    writing = PRINCIPLES.find((x) => x.id === "writing")!;
  if (!(loreOf(w).effect(p.seat, "writing") > 0))
    loreOf(w).learn(p.seat, "writing", { year: 60, event: p.event }, writing);
  const ways = cultureOf(w).get(p.seat)!;
  ways.traits[WAY.openness] = 0.95;
  ways.traits[WAY.hierarchy] = 0.1;
  ways.traits[WAY.tradition] = 0.1;
  for (const c of p.members) {
    const l = store.lands.get(c) ?? { cell: c, shares: BONDS.map(() => 0), cause: null };
    l.shares[BOND.chattel] = 0.05;
    store.lands.set(c, l);
  }
  const movement = w.events.emit({
    type: ORDER_EVENTS.movement.type,
    subjects: [p.ref],
    place: ctx.provinces.get(p.seat)!.ref,
    causes: [{ ref: p.event, role: "enabler", weight: 1 }],
    data: { cause: "abolition" },
  });
  o.movements = [{ cause: "abolition", strength: 0.95, since: 55, event: movement }];
  orderFor(w, 61, 70);
  const weighed = w.decisions
    .all()
    .filter((d) => d.rule === "order.abolish" && d.subject === p.ref);
  assert.ok(weighed.length >= 1, "it weighed it");
  assert.ok(
    weighed[0]!.factors.some((f) => f.contribution < 0),
    "against: its court, its wealth",
  );
  assert.ok(o.abolished !== null, "and freed them");
  const freed = typed(w, ORDER_EVENTS.abolished.type).find((e) => e.subjects.includes(p.ref))!;
  assert.match(why(w, freed.id).claim, /outlawed bondage/);
  assert.equal(boundShare(ctx, p, BOND.chattel), 0, "none held but the condemned");
});

test("the order of bonds and freedoms is kept whole by a save, and goes on alike after it", () => {
  const w = fresh();
  orderFor(w, 61, 70);
  const doc = saveWorld(w, RULESET),
    again = loadWorld(doc, build, RULESET).world;
  assert.deepEqual(orderOf(again)!.save(), orderOf(w)!.save());
  orderFor(w, 71, 80);
  orderFor(again, 71, 80);
  assert.deepEqual(orderOf(again)!.save(), orderOf(w)!.save());
});

test("the god stirs the bound of a realm's most-held land to rise, and breaks the chains of all its bound", () => {
  const w = fresh(),
    ctx = populationContext(w),
    p = greatest(w),
    store = orderOf(w)!,
    lands = p.members.filter((c) => c !== p.seat && (ctx.provinces.get(c)?.total() ?? 0) > 300);
  assert.ok(lands.length >= 1);
  for (const c of lands) store.lands.set(c, { cell: c, shares: [0.3, 0, 0, 0, 0], cause: null });
  // Stirred: the most-held land rises now, and the god's hand is the first of its reasons.
  let was = ids(w);
  w.submit("act.stir", { realm: p.ref });
  w.runTo(w.now + 3);
  const stirred = since(w, "act.stir", was)[0]!,
    rose = since(w, ORDER_EVENTS.revolt.type, was);
  assert.equal(rose.length, 1, "a rising");
  const decision = w.decisions.get(
    rose[0]!.causes.find((c) => w.decisions.get(c.ref)?.rule === "order.revolt")!.ref,
  )!;
  assert.ok(
    decision.factors.some((f) => f.source?.ref === stirred.id && f.source.role === "agent"),
  );
  assert.match(why(w, stirred.id).claim, /stirred the bound of .* to rise against/);
  assert.equal(
    since(w, ORDER_EVENTS.freed.type, was).length + since(w, ORDER_EVENTS.crushed.type, was).length,
    1,
    "won or crushed",
  );
  // Unchained: every bound of its lands free at once, and remembered as a freedom.
  for (const c of p.members)
    store.lands.set(c, { cell: c, shares: [0.1, 0.05, 0, 0, 0.01], cause: null });
  was = ids(w);
  w.submit("act.unchain", { realm: p.ref });
  w.runTo(w.now + 3);
  const freed = since(w, "act.unchain", was)[0]!;
  assert.ok(
    p.members.every((c) => store.bound(c) === 0 && store.land(c)!.cause === freed.id),
    "every chain broken",
  );
  assert.ok((freed.data as { count: number }).count > 0);
  assert.match(why(w, freed.id).claim, /broke the chains of .* held in/);
  assert.ok(store.of(p.ref)!.memory.some((m) => m.what === "freedom" && m.event === freed.id));
  // None held, none to free or stir.
  assert.throws(() => w.submit("act.unchain", { realm: p.ref }), /none are held/);
  assert.throws(() => w.submit("act.stir", { realm: p.ref }), /no land of it holds/);
});

test("a sign from the heavens moves a realm's standing and weighs on it while it fades; the world replays", () => {
  const w = fresh(),
    p = greatest(w),
    o = orderOf(w)!.of(p.ref)!,
    before = o.legitimacy;
  assert.throws(() => w.submit("act.mandate", { realm: p.ref, sign: 2 }), /sign must be 1 or -1/);
  w.submit("act.mandate", { realm: p.ref, sign: -1 });
  w.runTo(w.now + 3);
  assert.ok(
    Math.abs(o.legitimacy - Math.max(0.02, before - MANDATE_PUSH)) < 1e-9,
    "fallen at once",
  );
  const sign = legitimacyFactors(populationContext(w), p).find((f) =>
    /against its rule/.test(f.name),
  )!;
  assert.ok(sign && sign.contribution < 0 && sign.source?.role === "agent", "weighed on");
  assert.match(why(w, sign.source!.ref).claim, /A sign from the heavens against the rule of/);
  w.runTo(63 * YEAR);
  assert.deepEqual(verifyByReplay(saveWorld(w, RULESET), build), { ok: true, problem: null });
});
