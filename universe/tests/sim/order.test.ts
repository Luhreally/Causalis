import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  parseRef,
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
  LAWS,
  LAW_EVENTS,
  LAW_EVERY,
  LAW_OF,
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
  REFORM_LINE,
  lawGrievance,
  warsOf,
  type Polity,
  type RealmOrder,
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
    // (Its four laws, each a position of three, and how far its powerful want them: M139.)
    assert.equal(o.laws.length, LAWS.length);
    assert.ok(
      o.laws.every((x) => x === 0 || x === 1 || x === 2),
      JSON.stringify(o.laws),
    );
    assert.equal(o.lawEvents.length, LAWS.length);
    assert.ok(o.approval >= -1 && o.approval <= 1);
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

/** The realm's year of ten in which it weighs its laws, the last before `by`. */
const weighedIn = (p: Polity, by: number) => {
  for (let y = by; ; y--) if ((y + (parseRef(p.ref).b % LAW_EVERY)) % LAW_EVERY === 0) return y;
};

test("a movement for the land and a rule doubted loosen the lord's hold, in the realm's year of ten, and why", () => {
  const w = fresh(),
    ctx = populationContext(w),
    p = greatest(w),
    o = orderOf(w)!.of(p.ref)!,
    ways = cultureOf(w).get(p.seat)!;
  ways.traits[WAY.hierarchy] = 0.1;
  ways.traits[WAY.tradition] = 0.1;
  o.laws[LAW_OF.land] = 0;
  o.legitimacy = 0.1;
  const movement = w.events.emit({
    type: ORDER_EVENTS.movement.type,
    subjects: [p.ref],
    place: ctx.provinces.get(p.seat)!.ref,
    causes: [{ ref: p.event, role: "enabler", weight: 1 }],
    data: { cause: "land" },
  });
  o.movements = [{ cause: "land", strength: 0.95, since: 55, event: movement }];
  const was = ids(w);
  let moved: number | null = null;
  for (let y = 61; y <= 70; y++) {
    orderFor(w, y, y);
    if (moved === null && o.laws[LAW_OF.land] !== 0) moved = y;
  }
  assert.equal(moved, weighedIn(p, 70), "weighed in its own year of ten");
  const changed = since(w, LAW_EVENTS.changed.type, was).filter(
    (e) => e.subjects.includes(p.ref) && (e.data as { law: string }).law === "land",
  );
  assert.equal(changed.length, 1, "a step in its year of ten");
  const e = changed[0]!;
  assert.deepEqual([(e.data as { from: number }).from, (e.data as { to: number }).to], [0, 1]);
  assert.equal(o.laws[LAW_OF.land], 1);
  assert.equal(o.lawEvents[LAW_OF.land], e.id);
  const decision = w.decisions.get(
    e.causes.find((c) => w.decisions.get(c.ref)?.rule === "order.law")!.ref,
  )!;
  assert.ok(decision.score >= REFORM_LINE && decision.factors.length <= 6);
  assert.ok(
    decision.factors.some(
      (f) =>
        f.name === "the movement for the land" && f.source?.ref === movement && f.contribution > 0,
    ),
    "the movement behind it",
  );
  assert.ok(decision.factors.some((f) => f.name === "a rule doubted gives ground"));
  assert.match(why(w, e.id).claim, /changed its law of its land: from the lord's to leased/);
});

test("serfs are bound the more under the lord's land, the less leased, and loosed where the land is the tiller's own", () => {
  const serfs = (position: number) => {
    const w = fresh(),
      p = greatest(w),
      store = orderOf(w)!,
      ways = cultureOf(w).get(p.seat)!;
    ways.traits[WAY.hierarchy] = 0.95;
    ways.traits[WAY.trade] = 0.1;
    ways.traits[WAY.openness] = 0.1;
    store.of(p.ref)!.laws[LAW_OF.land] = position;
    for (const c of p.members)
      store.lands.set(c, { cell: c, shares: [0, 0, 0.3, 0, 0], cause: null });
    orderFor(w, 61, 61);
    return p.members.reduce((s, c) => s + store.land(c)!.shares[BOND.serf]!, 0) / p.members.length;
  };
  const [lords, leased, tillers] = [serfs(0), serfs(1), serfs(2)];
  assert.ok(lords > leased && leased > tillers, `${lords} > ${leased} > ${tillers}`);
});

test("what a realm's laws ask of a land strange to its seat: strangers held as subjects, unbelievers under one faith", () => {
  const o = { laws: [1, 0, 0, 1], lawEvents: [null, "e:1", "e:2", null] } as unknown as RealmOrder,
    near = (a: number, b: number) => Math.abs(a - b) < 1e-12;
  let g = lawGrievance(o, 0.5, true);
  assert.ok(near(g.add, 0.015 + 0.04) && g.cause === "e:2", "subjects, and unbelievers the more");
  g = lawGrievance(o, 1, false);
  assert.ok(near(g.add, 0.03) && g.cause === "e:1", "subjects of another tongue");
  o.laws = [1, 1, 1, 1];
  assert.ok(near(lawGrievance(o, 1, true).add, 0.03 + 0.01), "the faithful only, tolerated");
  assert.equal(lawGrievance(o, 1, false).add, 0, "of the faith, nothing asked");
  o.laws = [1, 2, 2, 1];
  assert.equal(lawGrievance(o, 1, true).add, 0, "citizens of free conscience");
});

test("a realm whose law makes strangers citizens weighs carrying off the taken against its law", () => {
  // The same hard victors, the taken of their own tongue: subjects carried off, citizens not.
  const taken = (strangers: number) => {
    const w = fresh(),
      ctx = populationContext(w),
      a = greatest(w),
      seatWays = cultureOf(w).get(a.seat)!;
    seatWays.traits[WAY.hierarchy] = 0.95;
    seatWays.traits[WAY.openness] = 0.05;
    seatWays.traits[WAY.valour] = 0.9;
    orderOf(w)!.of(a.ref)!.laws[LAW_OF.strangers] = strangers;
    const land = a.members.find((c) => c !== a.seat && (ctx.provinces.get(c)?.total() ?? 0) > 400)!;
    cultureOf(w).get(land)!.tongue = seatWays.tongue;
    const battle = w.events.emit({
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
    const was = ids(w);
    orderFor(w, 61, 61);
    return {
      count: since(w, ORDER_EVENTS.captives.type, was).filter(
        (e) => e.place === ctx.provinces.get(land)!.ref,
      ).length,
      weighed: w.decisions
        .all()
        .findLast((d) => d.rule === "order.captives" && d.subject === a.ref)!,
    };
  };
  const subjects = taken(0),
    citizens = taken(2);
  assert.equal(subjects.count, 1, "subjects carried off");
  assert.equal(citizens.count, 0, "citizens not");
  assert.ok(Math.abs(subjects.weighed.score - citizens.weighed.score - 0.4) < 1e-9);
  assert.ok(citizens.weighed.score < CAPTIVE_LINE);
  const law = citizens.weighed.factors.find((f) =>
    /though its law makes them citizens/.test(f.name),
  )!;
  assert.ok(law && law.contribution < 0 && law.source?.role === "constraint");
});

test("the god decrees a realm's law: set at once, told, kept by a save", () => {
  const w = fresh(),
    p = greatest(w),
    o = orderOf(w)!.of(p.ref)!,
    now = o.laws[LAW_OF.justice]!,
    to = now === 2 ? 1 : now + 1;
  assert.throws(
    () => w.submit("act.decree", { realm: p.ref, law: "tithes", to: 1 }),
    /a law is wanted/,
  );
  assert.throws(() => w.submit("act.decree", { realm: p.ref, law: "justice", to: 3 }), /0, 1 or 2/);
  assert.throws(
    () => w.submit("act.decree", { realm: p.ref, law: "justice", to: now }),
    /it is its law already/,
  );
  const was = ids(w);
  w.submit("act.decree", { realm: p.ref, law: "justice", to });
  w.runTo(w.now + 3);
  const decreed = since(w, "act.decree", was)[0]!;
  assert.equal(o.laws[LAW_OF.justice], to);
  assert.equal(o.lawEvents[LAW_OF.justice], decreed.id);
  assert.match(why(w, decreed.id).claim, /^By the god's decree .* took a new law of justice: /);
  const again = loadWorld(saveWorld(w, RULESET), build, RULESET).world;
  assert.deepEqual(orderOf(again)!.of(p.ref)!.laws, o.laws);
  assert.equal(orderOf(again)!.of(p.ref)!.lawEvents[LAW_OF.justice], decreed.id);
});
