// What a town's form turns on, kept (asked 2026-11-19): the lots it had when engines came, its realm's reach when it was
// founded, walled and reached by engines, and its market place. Each is set down the year it happens and never changes
// after; a save from before they were kept loads, reads as before, and has nothing set down of it later.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, loadWorld, rulesetId, saveWorld, seedFromText } from "../../src/kernel/index.ts";
import { principle } from "../../src/rules/index.ts";
import {
  KEPT_NOT,
  ORDER_AT,
  TownStore,
  loreOf,
  makePopulationWorld,
  orderAt,
  placeClass,
  populationContext,
  townsOf,
  type Fabric,
} from "../../src/sim/index.ts";

const seed = seedFromText("juniper"),
  build = () => makePopulationWorld(seed, { start: "spread" }),
  world = build();
world.runTo(100 * YEAR);
const RULESET = rulesetId(world, "test");

/** What is kept of each town's form, by town. */
const kept = (w: typeof world) =>
  new Map(
    townsOf(w)
      .all()
      .map((f) => [f.town, [f.engines, f.order, f.place] as const]),
  );

test("a town's reach is set down when it is founded, its market place at its first market, and engines not before they come", () => {
  const ctx = populationContext(world);
  let towns = 0,
    places = 0;
  for (const f of townsOf(world).all()) {
    towns++;
    const founded = orderAt(f, ORDER_AT.founded);
    assert.ok(
      founded !== null && founded >= 0 && founded <= 1,
      `${f.town}: its reach when founded`,
    );
    assert.equal(
      orderAt(f, ORDER_AT.walled) !== null,
      !!f.walls,
      `${f.town}: a reach with its walls`,
    );
    assert.equal(orderAt(f, ORDER_AT.engines), null);
    assert.equal(f.engines, -1, "engines are not come to juniper in a hundred years");
    const market = f.civics.some((c) => c.kind === "market");
    assert.equal(f.place >= 0, market, `${f.town}: a place where it has held a market`);
    if (f.place >= 0) {
      places++;
      const lots = f.place >> 2,
        cls = f.place & 3;
      assert.ok(cls >= 1 && cls <= 3 && lots <= f.next);
    }
  }
  assert.ok(towns > 20 && places > 0, `${towns} towns, ${places} with a market place`);
  assert.equal(placeClass(300), 1);
  assert.equal(placeClass(5000), 2);
  assert.equal(placeClass(50_000), 3);
  assert.ok(ctx.settlements.all().length >= towns);
});

test("what is set down never changes; engines are set down the year they come, with the lots the town had", () => {
  const w = loadWorld(saveWorld(world, RULESET), build, RULESET).world,
    before = kept(w),
    ctx = populationContext(w),
    lore = loreOf(w),
    // (Engines come to the land of the greatest town.)
    s = ctx.settlements.all().reduce((a, b) => (b.population > a.population ? b : a)),
    f = townsOf(w).get(s.ref)!,
    had = f.next;
  lore.learn(s.cell, "engines", { year: 100, event: s.event }, principle("engines"));
  w.runTo(101 * YEAR);
  assert.equal(f.engines, had, "the lots it had when they came");
  assert.notEqual(orderAt(f, ORDER_AT.engines), null);
  const then = f.engines;
  w.runTo(112 * YEAR);
  assert.equal(f.engines, then, "never again");
  assert.ok(f.next >= then);
  for (const g of townsOf(w).all()) {
    const was = before.get(g.town);
    if (!was) continue;
    // (A number set down stays; one not yet set down may be.)
    if (was[0] >= 0) assert.equal(g.engines, was[0]);
    if (was[2] >= 0) assert.equal(g.place, was[2]);
    for (const at of [0, 1, 2]) {
      const d: number = (was[1] >> (4 * at)) & 15;
      if (d !== 15) assert.equal((g.order >> (4 * at)) & 15, d, `${g.town}: reach ${at}`);
    }
  }
});

test("a save loaded goes on to keep the same numbers as the world that ran straight on", () => {
  const a = loadWorld(saveWorld(world, RULESET), build, RULESET).world,
    b = loadWorld(saveWorld(world, RULESET), build, RULESET).world;
  a.runTo(110 * YEAR);
  const c = loadWorld(saveWorld(a, RULESET), build, RULESET).world;
  c.runTo(120 * YEAR);
  b.runTo(120 * YEAR);
  assert.deepEqual([...kept(c)], [...kept(b)]);
  assert.deepEqual(c.domainHashes(), b.domainHashes());
});

test("a save from before they were kept loads: its towns read as never kept, and nothing is set down of them after", () => {
  const saved = JSON.parse(JSON.stringify(townsOf(world).save())) as {
    digest: [number, number];
    towns: { heads: unknown[][] };
  };
  assert.equal(saved.towns.heads.length, 12);
  saved.towns.heads.length = 9;
  const store = new TownStore();
  store.load(saved);
  const all: Fabric[] = store.all();
  assert.ok(all.length > 20);
  for (const f of all)
    assert.deepEqual([f.engines, f.order, f.place], [KEPT_NOT, KEPT_NOT, KEPT_NOT]);
  // (The rest of each town is as it was.)
  const whole = new Map(
    townsOf(world)
      .all()
      .map((f) => [f.town, f]),
  );
  for (const f of all) {
    const was = whole.get(f.town)!;
    assert.equal(f.next, was.next);
    assert.deepEqual(f.homes, was.homes);
    assert.equal(f.civics.length, was.civics.length);
  }
  // And a world whose towns were loaded so runs on with nothing set down of its old towns.
  const old = loadWorld(saveWorld(world, RULESET), build, RULESET).world,
    olds = new Set(
      townsOf(old)
        .all()
        .map((f) => f.town),
    );
  townsOf(old).load(saved);
  old.runTo(106 * YEAR);
  let grew = 0;
  for (const f of townsOf(old).all())
    if (olds.has(f.town)) {
      assert.deepEqual([f.engines, f.order, f.place], [KEPT_NOT, KEPT_NOT, KEPT_NOT], f.town);
      if (f.next > whole.get(f.town)!.next) grew++;
    }
  assert.ok(grew > 0, "its towns went on growing");
});
