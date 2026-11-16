// A realm's money and its fears on a real world (sim/finance): juniper's realms sixty years on, two that meet made to know banking
// with grain to spare, worked on by the year of finance alone. Every realm keeps how its wealth is owned; a debt held abroad is paid
// in grain that goes home, none made or lost; a realm that cannot pay refuses it, which every lender reads and its holders remember;
// what a people holds in a realm that closes itself is taken; a fear kept is read by diplomacy and by how a realm is held.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type SimTime,
  type World,
} from "../../src/kernel/index.ts";
import { FINANCE, FOODS, G, PRINCIPLES } from "../../src/rules/index.ts";
import {
  FINANCE_EVENTS,
  creditOf,
  debtOf,
  diplomacyOf,
  diplomacyYear,
  fearOf,
  fearPress,
  fearShuts,
  financeOf,
  financeYear,
  loreOf,
  makePopulationWorld,
  marketsOf,
  mouths,
  politiesOf,
  populationContext,
  stakesBetween,
  wayOf,
  yieldNow,
  type Polity,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";

const seed = seedFromText("juniper"),
  build = (s = seed) => makePopulationWorld(s, { start: "spread" }),
  world = build();
world.runTo(60 * YEAR);
const RULESET = rulesetId(world, "test"),
  AS_IT_WAS = saveWorld(world, RULESET),
  fresh = () => loadWorld(AS_IT_WAS, build, RULESET).world,
  at = (k: number) => ((60 + k) * YEAR) as SimTime;

/** Two realms that meet, the pair with the most people between them, each seat made to know banking with grain to spare. */
function pair(w: World): [Polity, Polity] {
  const ctx = populationContext(w),
    realms = politiesOf(w),
    people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
    rel = diplomacyOf(w)
      .all()
      .map((r) => [realms.get(r.a)!, realms.get(r.b)!] as [Polity, Polity])
      .filter(([a, b]) => a && b && a.ended === null && b.ended === null)
      .sort((x, y) => people(y[0]) + people(y[1]) - people(x[0]) - people(x[1]))[0]!;
  assert.ok(rel, "two realms meet");
  for (const p of rel) {
    const prov = ctx.provinces.get(p.seat)!,
      m = marketsOf(w).of(p.seat),
      event = p.event;
    for (const id of ["currency", "banking"])
      if (!loreOf(w).get(p.seat, id))
        loreOf(w).learn(
          p.seat,
          id,
          { year: 60, event },
          PRINCIPLES.find((x) => x.id === id)!,
        );
    const want = Math.ceil(12 * mouths(prov, ctx.life)) + 100_000 - m.stock[G.grain]!;
    if (want > 0) m.move("made", G.grain, want);
  }
  return rel;
}
/** All the food in the world's stores. */
const food = (w: World) =>
  marketsOf(w)
    .all()
    .reduce((n, m) => n + m.food(FOODS), 0);
/** Every land of a realm emptied of food. */
const starve = (w: World, p: Polity) => {
  for (const c of p.members) {
    const m = marketsOf(w).get(c);
    if (m) for (const g of FOODS) m.take("used", g, m.stock[g]!);
  }
};
const events = (w: World, type: string) => {
  const out = [];
  for (let i = 0; i < w.events.count; i++)
    if (w.events.at(i).type === type) out.push(w.events.at(i));
  return out;
};

test("every living realm keeps how its wealth is owned, and realms that meet reckon their fears", () => {
  const store = financeOf(world)!,
    living = politiesOf(world).living();
  assert.ok(living.length > 3);
  for (const p of living) {
    const m = store.of(p.ref);
    assert.ok(m, `${p.ref} keeps its money`);
    assert.equal(m.own.length, 2);
    for (const v of m.own) assert.ok(Number.isInteger(v) && v >= 0 && v <= 100);
    for (const f of m.fears) {
      assert.ok(f.level >= 0 && f.level <= 100 && f.who >= 0 && f.who < 5);
      assert.ok(politiesOf(world).get(f.of), "a fear is of a realm");
    }
    assert.ok(m.fears.length <= FINANCE.fears);
  }
  // No realm of the first sixty years knows banking: none has sold debt.
  assert.ok(store.all().every((m) => debtOf(m) === 0));
});

test("a debt held abroad is paid in grain that goes home: none made, none lost", () => {
  const w = fresh(),
    [a, b] = pair(w),
    store = financeOf(w)!,
    ma = store.of(a.ref)!,
    before = food(w);
  ma.held = [[b.ref, 10_000]];
  ma.coupon = 800;
  financeYear(populationContext(w), at(1));
  const paid = ma.paid;
  assert.ok(paid >= 800, `interest and a part of the debt paid: ${paid}`);
  assert.equal(store.of(b.ref)!.income, paid, "what it paid came home to its holders");
  assert.equal(food(w), before, "grain moved, none made");
  assert.equal(ma.held[0]![1], 10_000 + 800 - paid, "what is left is owed");
  assert.equal(ma.missed, 0);
  // What it would pay now is read off it, each part named.
  const y = yieldNow(populationContext(w), a)!;
  assert.ok(y.rate >= FINANCE.base - FINANCE.seen && y.rate < 1);
  assert.ok(Math.abs(y.parts.reduce((s, p) => s + p.value, 0) - y.rate) < 0.001);
  // (Its debt held by them is a stake between them, as much as their share of all it owes. Since round B a treasury short
  // of what it spends sells debt for it in the same year, some to its own people, so theirs is no longer the whole of it.)
  assert.ok(
    stakesBetween(w, a.ref, b.ref) >= ma.held[0]![1] / debtOf(ma) - 1e-9,
    "its debt held by them is a stake between them",
  );
});

test("a realm that cannot pay refuses its debt: its holders lose and remember, every lender reads it", () => {
  const w = fresh(),
    [a, b] = pair(w),
    store = financeOf(w)!,
    ma = store.of(a.ref)!;
  ma.held = [[b.ref, 50_000]];
  ma.home = 20_000;
  ma.coupon = 900;
  for (let k = 1; k <= FINANCE.missed; k++) {
    starve(w, a);
    financeYear(populationContext(w), at(k));
  }
  const refused = events(w, FINANCE_EVENTS.refused.type),
    lost = events(w, FINANCE_EVENTS.lost.type);
  assert.equal(refused.length, 1, "refused once");
  assert.deepEqual(refused[0]!.subjects.slice(0, 2), [a.ref, b.ref]);
  assert.equal(lost.length, 1);
  assert.deepEqual(lost[0]!.subjects, [b.ref, a.ref]);
  assert.equal(debtOf(ma), 0);
  assert.ok(
    creditOf(w)!.faithless(a.ref, 60 + FINANCE.missed),
    "held faithless, as credit reads it",
  );
  assert.deepEqual(store.of(b.ref)!.burnt?.[0]?.[0], a.ref, "its holders will not buy of it again");
  assert.match(why(w, refused[0]!.id).claim, /refused the .* grain's worth of debt it had sold/);
  assert.match(why(w, lost[0]!.id).claim, /lost the .* debt they held, refused/);
  assert.doesNotMatch(why(w, refused[0]!.id).claim, /undefined|NaN/);
  // It pays more to borrow for having refused.
  const y = yieldNow(populationContext(w), a)!;
  assert.ok(y.parts.some((p) => p.name.includes("refused") && p.value > 0.04));
});

test("what a people holds in a realm that closes itself is taken, and remembered", () => {
  const w = fresh(),
    [a, b] = pair(w),
    store = financeOf(w)!,
    ma = store.of(a.ref)!;
  ma.shares = [[b.ref, 2000]];
  // (All of its wealth the realm's own: no stranger's holding stands there.)
  ma.own = [50, 98];
  financeYear(populationContext(w), at(1));
  const taken = events(w, FINANCE_EVENTS.taken.type);
  assert.equal(taken.length, 1);
  assert.deepEqual(taken[0]!.subjects, [a.ref, b.ref]);
  assert.equal(ma.shares.length, 0);
  assert.deepEqual(store.of(b.ref)!.burnt?.[0]?.[0], a.ref);
  assert.match(
    why(w, taken[0]!.id).claim,
    /took what the people of .* held there \(20 in a hundred of its listed works\)/,
  );
});

test("a fear kept is read by diplomacy and by how a realm is held", () => {
  const w = fresh(),
    [a, b] = pair(w),
    store = financeOf(w)!,
    ctx = populationContext(w);
  store.of(a.ref)!.fears = [
    {
      of: b.ref,
      level: 60,
      now: 60,
      unlike: 45,
      works: 70,
      exposed: 60,
      loss: 80,
      who: 0,
      drawn: 24,
    },
  ];
  assert.equal(fearOf(w, a.ref, b.ref), 0.6);
  // (And by trade: so much the less passes between their lands, whichever of the two is asked.)
  assert.equal(fearShuts(store, b.ref, a.ref), 0.6);
  assert.equal(fearShuts(store, a.ref, a.ref), 0);
  const press = fearPress(w, a.ref)!;
  assert.equal(press.of, b.ref);
  assert.ok(
    press.moves[0] > 0 || press.moves[2] < 0,
    `arms closer or word watched: ${press.moves}`,
  );
  const before = diplomacyOf(w).get(a.ref, b.ref)!.opinion;
  diplomacyYear(ctx, at(1));
  const rel = diplomacyOf(w).get(a.ref, b.ref)!,
    term = rel.terms.find((t) => t.name.startsWith("the fear "));
  assert.ok(term && term.value < -0.2, "the one who fears draws back");
  assert.ok(rel.opinion < before + 0.01);
  assert.equal(wayOf(w, a.ref).length, 5);
});

test("a world's money is saved and loaded as it was", () => {
  const w = fresh(),
    [a, b] = pair(w),
    store = financeOf(w)!;
  store.of(a.ref)!.held = [[b.ref, 1234]];
  store.of(a.ref)!.burnt = [[b.ref, 55]];
  const again = loadWorld(saveWorld(w, RULESET), build, RULESET).world;
  assert.deepEqual(financeOf(again)!.save(), store.save());
});
