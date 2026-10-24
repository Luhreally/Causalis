import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  verifyByReplay,
  type SimTime,
  type World,
} from "../../src/kernel/index.ts";
import { cellRef } from "../../src/gen/index.ts";
import { BANDS, PRINCIPLES } from "../../src/rules/index.ts";
import {
  BOND,
  BONDS,
  HEALTH_EVENTS,
  SICK,
  healthOf,
  healthYear,
  loreOf,
  makePopulationWorld,
  orderOf,
  politiesOf,
  populationContext,
  riseSickness,
  spreadChance,
  tollOf,
  type Polity,
  type Sickness,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";

// Phase 20 M140: sickness. Juniper's realms sixty years on, a sickness made in the most peopled
// land of its greatest realm, and worked on by the year of sickness alone (the rest held still).
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
/** The most peopled land of a realm. */
const biggest = (w: World, p: Polity) => {
  const ctx = populationContext(w);
  return [...p.members].sort(
    (a, b) => (ctx.provinces.get(b)?.total() ?? 0) - (ctx.provinces.get(a)?.total() ?? 0) || a - b,
  )[0]!;
};
/** A sickness made by hand in a land, at the fixture's year (its nature drawn as any's). */
const made = (w: World, cell: number): Sickness =>
  riseSickness(
    populationContext(w),
    cell,
    "herds",
    [{ name: "a test's hand", value: 1, contribution: 1, source: null }],
    (60 * YEAR + 1) as SimTime,
  );
/** Run the year of sickness alone from `from` to `to` (years). */
const sicknessFor = (w: World, from: number, to: number) => {
  const ctx = populationContext(w);
  for (let y = from; y <= to; y++) healthYear(ctx, (y * YEAR + 1) as SimTime);
};
const comings = (w: World, s?: Sickness) =>
  w.events
    .all()
    .filter((e) => e.type === HEALTH_EVENTS.outbreak.type && (!s || e.subjects.includes(s.ref)));

test("a sickness rises in a land: its nature its own, named for the land, its first coming there, and why", () => {
  const w = fresh(),
    cell = biggest(w, greatest(w)),
    before = populationContext(w).provinces.get(cell)!.total(),
    had = healthOf(w)!.sicknesses.length,
    s = made(w, cell),
    store = healthOf(w)!;
  assert.equal(store.sicknesses.length, had + 1);
  assert.match(s.ref, /^sick:/);
  assert.match(
    s.name,
    /^the .+ (sweats|cough|pox|fever|flux|purging|bloody flux|cramps|plague|spotted fever|ague|black fever|wasting|sores|rot)$/,
  );
  assert.ok(s.reach >= 0.25 && s.reach <= 0.75);
  assert.ok(
    s.lasting === 60
      ? s.deadliness >= 0.03 && s.deadliness <= 0.35
      : s.lasting >= 3 && s.lasting <= 15 && s.deadliness >= 0.005 && s.deadliness <= 0.05,
    `${s.lasting} years, ${s.deadliness}`,
  );
  const rose = w.events.get(s.event)!;
  assert.equal(rose.type, HEALTH_EVENTS.rose.type);
  assert.match(why(w, s.event).claim, /^A new sickness, the .+, rose among the herds of /);
  // Its first coming, where it rose: the dead written in the land's ledger, the rest spared.
  const first = comings(w, s);
  assert.equal(first.length, 1);
  assert.ok(
    first[0]!.causes.some((c) => c.ref === s.event),
    "it follows its rising",
  );
  const dead = (first[0]!.data as { dead: number }).dead,
    after = populationContext(w).provinces.get(cell)!.total();
  assert.equal(before - after, store.land(cell)!.last!.dead);
  assert.ok(
    Math.abs(before - after - dead) <= Math.max(3, dead * 0.02),
    `${before - after} ~ ${dead}`,
  );
  assert.ok(store.immune(cell, s.ref) > 0, "the survivors spared");
  assert.match(why(w, first[0]!.id).claim, /came to .*: [\d,]+ of its [\d,]+ died/);
});

test("a sickness goes on by what carries it, each coming a decision citing its carrier; the spared are passed by", () => {
  const w = fresh(),
    p = greatest(w),
    cell = biggest(w, p),
    s = made(w, cell),
    store = healthOf(w)!,
    ctx = populationContext(w),
    g = ctx.generated,
    next = new Set<number>();
  for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++)
    if ((ctx.provinces.get(g.grid.neighbours[k]!)?.total() ?? 0) > 0)
      next.add(g.grid.neighbours[k]!);
  assert.ok(next.size >= 2, "a land with neighbours");
  // A sickness that reaches most of those near the sick, so that it surely goes on.
  (s as { reach: number }).reach = 0.95;
  // Half its neighbours spared it wholly, year after year (the spared forget, so they are spared
  // anew): it never comes to them. (Where it rose it burns on, year after year, so it is carried
  // out again and again.)
  const spared = [...next].sort((a, b) => a - b).filter((_, i) => i % 2 === 0);
  for (let y = 61; y <= 72; y++) {
    for (const c of spared)
      store.lands.set(c, {
        cell: c,
        immune: [[s.ref, 1]],
        last: null,
        struck: 0,
        dead: 0,
        ward: null,
      });
    const home = store.land(cell)!;
    home.last = { ...home.last!, year: y - 1 };
    sicknessFor(w, y, y);
  }
  const went = comings(w, s).slice(1);
  assert.ok(went.length >= 1, "it went on");
  for (const e of went) {
    const place = Number(e.place!.split(":")[2]);
    assert.ok(!spared.includes(place), "never to the spared");
    const d = w.decisions.get(
      e.causes.find((c) => w.decisions.get(c.ref)?.rule === "health.spread")!.ref,
    )!;
    assert.ok(d.factors.length <= 6 && d.factors.length >= 3);
    const carrier = d.factors.find((f) => /^carried /.test(f.name))!;
    assert.match(
      carrier.name,
      /^carried (from the land next door|down a trade road|over the sea|by an army)$/,
    );
    assert.ok(carrier.source, "what carried it, cited");
    assert.ok(e.causes.length <= 6);
  }
  assert.match(
    why(w, went[0]!.id).claim,
    /came to .* (from the land next door|down a trade road|over the sea|with an army), from /,
  );
});

test("who dies of it: the bound half again as often as the free, the hungry the more, fewer where healers know their craft", () => {
  const w = fresh(),
    p = greatest(w),
    cell = biggest(w, p),
    s = made(w, cell),
    ctx = populationContext(w),
    store = healthOf(w)!;
  // (Its first coming over, the land as if never touched, none held and all fed, to weigh a
  // coming afresh.)
  store.lands.delete(cell);
  const order = orderOf(w)!;
  order.lands.delete(cell);
  ctx.provinces.get(cell)!.leanest = 1000;
  const free = tollOf(ctx, s, cell).share;
  order.lands.set(cell, { cell, shares: [0.4, 0, 0, 0, 0], cause: null });
  const bound = tollOf(ctx, s, cell).share;
  assert.ok(Math.abs(bound / free - (1 + (SICK.bound - 1) * 0.4)) < 1e-9, `${bound} / ${free}`);
  order.lands.delete(cell);
  ctx.provinces.get(cell)!.leanest = 300;
  assert.ok(tollOf(ctx, s, cell).share > free * 1.3, "the hungry die the more");
  ctx.provinces.get(cell)!.leanest = 1000;
  const lore = loreOf(w);
  for (const id of ["herbalism", "writing", "medicine"])
    if (!lore.get(cell, id))
      lore.learn(
        cell,
        id,
        { year: 60, event: s.event },
        PRINCIPLES.find((x) => x.id === id)!,
      );
  const healed = Math.min(0.6, 2 * lore.effect(cell, "health"));
  assert.ok(healed > 0);
  assert.ok(
    Math.abs(tollOf(ctx, s, cell).share - free * (1 - healed)) < 1e-9,
    "healers spare some",
  );
});

test("the small and the old die the most; the bound among the dead the more", () => {
  const w = fresh(),
    p = greatest(w),
    cell = biggest(w, p),
    ctx = populationContext(w),
    prov = ctx.provinces.get(cell)!,
    order = orderOf(w)!;
  order.lands.set(cell, { cell, shares: [0.3, 0, 0, 0, 0], cause: null });
  const band = (b: number) => prov.counts.rowSum(b) + prov.counts.rowSum(b + BANDS),
    people = [0, 3, 9].map(band),
    deadBefore = [0, 3, 9].map((b) => ctx.history.deathsIn(cell, 60, b)),
    boundBefore = order.bound(cell) * prov.total(),
    total = prov.total();
  made(w, cell);
  const died = [0, 3, 9].map((b, i) => ctx.history.deathsIn(cell, 60, b) - deadBefore[i]!),
    rate = died.map((d, i) => d / Math.max(1, people[i]!));
  assert.ok(
    rate[0]! > rate[1]! && rate[2]! > rate[1]!,
    `infants ${rate[0]}, youths ${rate[1]}, old ${rate[2]}`,
  );
  const dead = total - prov.total(),
    boundAfter = order.bound(cell) * prov.total();
  assert.ok(dead > 0);
  // (Of the dead, the bound's share is half again theirs among the living.)
  assert.ok(boundBefore - boundAfter > 0.3 * dead, `${boundBefore - boundAfter} of ${dead}`);
  assert.equal(BONDS[BOND.chattel], "chattel");
});

test("drains and clean water keep out a sickness of foul water; a cold land keeps out one of vermin", () => {
  const w = fresh(),
    p = greatest(w),
    cell = biggest(w, p),
    s = made(w, cell),
    ctx = populationContext(w),
    g = ctx.generated;
  let to = -1;
  for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++)
    if ((ctx.provinces.get(g.grid.neighbours[k]!)?.total() ?? 0) > 0) to = g.grid.neighbours[k]!;
  const water = { ...s, route: "water" as const },
    carrier = { from: cell, to, via: "near" as const, by: s.event },
    dirty = spreadChance(ctx, water, carrier).chance,
    lore = loreOf(w);
  for (const id of ["bronze", "masonry", "herbalism", "writing", "medicine", "sanitation"])
    if (!lore.get(to, id))
      lore.learn(
        to,
        id,
        { year: 60, event: s.event },
        PRINCIPLES.find((x) => x.id === id)!,
      );
  const clean = spreadChance(ctx, water, carrier);
  assert.ok(Math.abs(clean.chance - dirty * 0.4) < 1e-9, `${clean.chance} vs ${dirty}`);
  const drains = clean.factors.find((f) => f.name === "drains and clean water")!;
  assert.ok(drains && drains.contribution < 0 && drains.source?.role === "constraint");
  // (A breath's sickness cares nothing for drains.)
  const breath = { ...s, route: "breath" as const };
  assert.ok(spreadChance(ctx, breath, carrier).chance > clean.chance);
});

test("unseen two centuries, a sickness is gone for good", () => {
  const w = fresh(),
    cell = biggest(w, greatest(w)),
    s = made(w, cell);
  // (Not burning anywhere: long unseen.)
  healthOf(w)!.land(cell)!.last = null;
  s.last = 61 - SICK.gone;
  sicknessFor(w, 61, 61);
  assert.equal(s.ended, 61);
  assert.ok(!healthOf(w)!.living().includes(s));
});

test("the god's ward spares a land every sickness; a sickness loosed comes at once; a new one made by the hand", () => {
  const w = fresh(),
    p = greatest(w),
    cell = biggest(w, p),
    s = made(w, cell),
    store = healthOf(w)!,
    other = p.members.find(
      (c) => c !== cell && (populationContext(w).provinces.get(c)?.total() ?? 0) > 200,
    )!;
  assert.throws(() => w.submit("act.ward", { cell: -5 }), /a land is wanted|no one lives there/);
  assert.throws(
    () => w.submit("act.loose", { cell: other, sickness: "sick:0:999" }),
    /no such sickness/,
  );
  w.submit("act.ward", { cell: other });
  w.runTo(w.now + 3);
  assert.equal(store.immune(other, s.ref), 1, "warded");
  assert.ok(store.land(other)!.ward, "the ward remembered");
  // Loosed on a land not warded: it comes now, the god's hand the first of its reasons.
  const target = p.members.find(
    (c) => c !== cell && c !== other && (populationContext(w).provinces.get(c)?.total() ?? 0) > 200,
  )!;
  w.submit("act.loose", { cell: target, sickness: s.ref });
  w.runTo(w.now + 3);
  const loosed = comings(w, s).find((e) => e.place === cellRef(0, target))!;
  assert.ok(loosed, "it came");
  const d = w.decisions.get(
    loosed.causes.find((c) => w.decisions.get(c.ref)?.rule === "health.spread")!.ref,
  )!;
  assert.equal(d.factors.find((f) => f.name === "loosed by the god")!.source?.role, "agent");
  // A new sickness made by the hand: its rising cites the act.
  const had = store.sicknesses.length;
  w.submit("act.loose", { cell: target, sickness: null });
  w.runTo(w.now + 3);
  const fresh2 = store.sicknesses.at(-1)!;
  assert.equal(store.sicknesses.length, had + 1);
  assert.equal(fresh2.source, "the god");
  assert.ok(w.events.get(fresh2.event)!.causes.some((c) => c.role === "agent"));
  assert.match(why(w, fresh2.event).claim, /rose by the god's hand of /);
});

test("sickness is kept whole by a save, goes on alike after it, and the world replays", () => {
  const w = fresh(),
    cell = biggest(w, greatest(w));
  w.submit("act.loose", { cell, sickness: null });
  w.runTo(w.now + 3);
  sicknessFor(w, 61, 66);
  const doc = saveWorld(w, RULESET),
    again = loadWorld(doc, build, RULESET).world;
  assert.deepEqual(healthOf(again)!.save(), healthOf(w)!.save());
  sicknessFor(w, 67, 70);
  sicknessFor(again, 67, 70);
  assert.deepEqual(healthOf(again)!.save(), healthOf(w)!.save());
  const r = fresh(),
    c = biggest(r, greatest(r));
  r.submit("act.loose", { cell: c, sickness: null });
  r.runTo(63 * YEAR);
  assert.ok(healthOf(r)!.sicknesses.length >= 1);
  assert.deepEqual(verifyByReplay(saveWorld(r, RULESET), build), { ok: true, problem: null });
});

test("over the centuries sicknesses rise of themselves where life crowds, and travel", () => {
  const w = build(seedFromText("first light"));
  w.runTo(320 * YEAR);
  const store = healthOf(w)!;
  assert.ok(store.sicknesses.length >= 1, "a sickness rose");
  const s = store.sicknesses.find((x) => x.source !== "the god")!;
  const rising = w.events.get(s.event)!,
    d = w.decisions.get(
      rising.causes.find((c) => w.decisions.get(c.ref)?.rule === "health.rise")!.ref,
    )!;
  assert.ok(
    d.factors.some(
      (f) =>
        /herds kept close|a great town crowded|hot, wet land/.test(f.name) && f.contribution > 0,
    ),
    "where life crowds",
  );
  assert.ok(
    store.sicknesses.some((x) => x.struck >= 3),
    "and it travelled",
  );
});
