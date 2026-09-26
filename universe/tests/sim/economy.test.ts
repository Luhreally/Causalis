import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { GOODS, OCC } from "../../src/rules/index.ts";
import {
  ECONOMY_EVENTS,
  GOOD_COUNT,
  LEDGER,
  POPULATION_EVENTS,
  VILLAGE_SIZE,
  makePopulationWorld,
  marketGoodRef,
  marketsOf,
  occupationTargets,
  populationContext,
  provinceCapacity,
} from "../../src/sim/index.ts";
import { spine, why } from "../../src/causal/index.ts";

const world = makePopulationWorld(seedFromText("first light"));
world.runTo(300 * YEAR);
const ctx = populationContext(world),
  markets = marketsOf(world);
const L = Object.fromEntries(LEDGER.map((l, i) => [l, i])) as Record<
  (typeof LEDGER)[number],
  number
>;

test("every market's year balances exactly: what was kept, made, brought, used, sent and spoiled", () => {
  let years = 0;
  for (const m of markets.all()) {
    // Each kept year opens with the stock the one before closed with.
    let before = m.years[0]!.stock;
    for (const y of m.years.slice(1)) {
      for (let g = 0; g < GOOD_COUNT; g++) {
        const l = (line: number) => y.ledger[line]![g]!,
          expected =
            before[g]! +
            l(L.made) -
            l(L.used) +
            l(L.in) -
            l(L.out) -
            l(L.spoiled) +
            l(L.carriedIn) -
            l(L.carriedOut);
        assert.equal(y.stock[g], expected, `${m.cell} year ${y.year} ${GOODS[g]!.id}`);
        assert.ok(y.stock[g]! >= 0);
      }
      before = [...y.stock];
      years++;
    }
  }
  assert.ok(years > 100, `${years} market-years checked`);
});

test("what one market sends another receives, and what migrants carry out they carry in", () => {
  const byYear = new Map<number, number[][]>();
  for (const m of markets.all())
    for (const y of m.years) {
      const sums =
        byYear.get(y.year) ?? [0, 0, 0, 0].map(() => new Array<number>(GOOD_COUNT).fill(0));
      for (let g = 0; g < GOOD_COUNT; g++) {
        sums[0]![g]! += y.ledger[L.out]![g]!;
        sums[1]![g]! += y.ledger[L.in]![g]!;
        sums[2]![g]! += y.ledger[L.carriedOut]![g]!;
        sums[3]![g]! += y.ledger[L.carriedIn]![g]!;
      }
      byYear.set(y.year, sums);
    }
  let traded = 0;
  for (const [year, [out, into, left, came]] of byYear) {
    assert.deepEqual(out, into, `trade in year ${year}`);
    // The first people's food came with them from nowhere before the chronicle.
    if (year > 0) assert.deepEqual(left, came, `migrants' goods in year ${year}`);
    traded += out!.reduce((a, b) => a + b, 0);
  }
  assert.ok(traded > 1000, `${traded} units traded`);
});

test("prices stay near what goods are usually worth", () => {
  for (const m of markets.all())
    GOODS.forEach((g, i) => {
      const r = m.price[i]! / g.value;
      assert.ok(r > 0.3 && r < 3.1, `${m.cell} ${g.id} at ${r}`);
    });
});

test("people turn to the work that is worth most", () => {
  const p = ctx.provinces.get(30210)!,
    cap = provinceCapacity(ctx, p.cell),
    base = occupationTargets(p, cap, 3),
    wages = new Array<number>(7).fill(10);
  const even = occupationTargets(p, cap, 3, wages);
  wages[OCC.crafter] = 25;
  const crafty = occupationTargets(p, cap, 3, wages);
  const sum = (t: number[]) => t.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum(even) - 1) < 1e-9 && Math.abs(sum(crafty) - 1) < 1e-9);
  assert.ok(
    Math.abs(even[OCC.crafter]! - base[OCC.crafter]!) < 1e-9,
    "equal wages leave shares as they were",
  );
  assert.ok(crafty[OCC.crafter]! > 2 * base[OCC.crafter]!, "better-paid crafts draw people");
  assert.equal(crafty[OCC.leader], base[OCC.leader], "leaders are not a market's to set");
});

test("metalworking is found where copper lies, and its why reaches the land, the plate and the star", () => {
  // Across the land the app begins with (the cradle alone may have no copper within reach).
  const land = makePopulationWorld(seedFromText("first light"), { start: "spread" });
  land.runTo(300 * YEAR);
  const found = land.events.all().find((e) => e.type === ECONOMY_EVENTS.metalworking.type);
  assert.ok(found, "someone learned to smelt copper");
  const decision = why(land, found.id).causes[0]!.next();
  assert.match(decision.claim, /worked out how to smelt copper, in year \d+ \(.*copper/);
  const kinds = spine(land, found.id).map((e) => e.ref.split(":")[0]);
  assert.deepEqual(kinds.slice(-3), ["plate", "plnt", "star"], kinds.join(" ← "));
  assert.ok(kinds.includes("cell") || kinds.includes("depo"), "through the ore");
  const tools = marketsOf(land)
    .all()
    .filter((m) => m.metalworking && m.years.some((y) => y.ledger[L.made]![5]! > 0));
  assert.ok(tools.length > 0, "copper was smelted");
});

test("a market town gathers the crafts and trade of its land, and grows past a village", () => {
  const towns = ctx.settlements.all().filter((s) => s.market);
  assert.ok(towns.length >= 1);
  const town = towns[0]!;
  assert.ok(town.population > VILLAGE_SIZE * 2, `${town.name} has ${town.population}`);
  const node = why(world, town.ref);
  assert.match(node.claim, /the market town of its land/);
  assert.ok(
    node.causes.some((c) => world.events.get(c.cause.ref)?.type === POPULATION_EVENTS.market.type),
  );
});

test("trade answers a famine, and says so", () => {
  const relief = world.events.all().find((e) => e.type === ECONOMY_EVENTS.relief.type);
  assert.ok(relief, "food came to a famine");
  const node = why(world, relief.id);
  assert.match(node.claim, /^Food came to the .* while famine was on/);
  const kinds = node.causes.map((c) => world.events.get(c.cause.ref)?.type);
  assert.ok(kinds.includes(POPULATION_EVENTS.famine.type), "the famine");
  assert.ok(kinds.includes(ECONOMY_EVENTS.route.type), "the road the food came down");
});

test("a price explains itself: the year's numbers, then what lies behind them", () => {
  const node = why(world, marketGoodRef(30210, 0) as Ref);
  assert.equal(node.basis, "recorded");
  assert.match(
    node.claim,
    /^Grain in the .* is (very cheap|cheap|at its usual worth|dear|very dear) \(\d\.\d\d of its usual worth\); in year \d+ [\d,]+ was made and [\d,]+ used/,
  );
  assert.ok(
    node.causes.some((c) => c.cause.ref.startsWith("cell:")),
    "the land it grows on",
  );
  const path = spine(world, marketGoodRef(30210, 0) as Ref).map((e) => e.ref.split(":")[0]);
  assert.equal(path.at(-1), "star");
});
