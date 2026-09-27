import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import {
  BLOCKS,
  BLOCK_M,
  CITY_EVENTS,
  LORE_EVENTS,
  USE,
  blockAt,
  citiesOf,
  homePlanet,
  layout,
  makePopulationWorld,
  populationContext,
} from "../../src/sim/index.ts";
import { OCC } from "../../src/rules/index.ts";
import { EARTH } from "../../src/host/planet.ts";

/** How far a city's blocks of the given uses lie from its road, in blocks, on average. */
function fromRoad(uses: readonly number[], axis: number, which: readonly number[]): number {
  const ux = Math.cos(axis),
    uz = Math.sin(axis),
    bs = uses.map((u, k) => ({ u, k })).filter((b) => which.includes(b.u));
  return (
    bs.reduce((s, { k }) => {
      const { x, z } = blockAt(k % BLOCKS, Math.floor(k / BLOCKS));
      return s + Math.abs(-uz * x + ux * z) / BLOCK_M;
    }, 0) / Math.max(1, bs.length)
  );
}
const TRADE = [USE.market, USE.workshops];
const marketsFromRoad = (uses: readonly number[], axis: number) => fromRoad(uses, axis, TRADE);

test("a paved road draws a city's markets and workshops along it", () => {
  for (const axis of [0, 0.7, 1.9, -2.4]) {
    const dirt = layout(3000, 150, 150, axis, false, false),
      paved = layout(3000, 150, 150, axis, true, false),
      before = fromRoad(dirt, axis, TRADE),
      after = fromRoad(paved, axis, TRADE);
    // A road along the grid already has its rows beside it; across the grid, paving pulls trade to it.
    assert.ok(after <= before, `axis ${axis}: ${after.toFixed(2)} paved, ${before.toFixed(2)} not`);
    if (axis !== 0) assert.ok(after < before * 0.7, `axis ${axis}: paving pulls trade to the road`);
    assert.equal(paved.filter((u) => u === USE.temple).length, 1, "one temple, at the heart");
  }
});

test("towns grow into cities, and paving reshapes them, answering to the road's learning", () => {
  // Amber's peoples tame beasts to draw carts, and so come to pave their roads.
  const world = makePopulationWorld(seedFromText("amber"), { start: "spread" });
  world.runTo(420 * YEAR);
  const cities = citiesOf(world).all(),
    paved = cities.filter((c) => c.paved),
    unpaved = cities.filter((c) => !c.paved);
  assert.ok(cities.length >= 5, `${cities.length} cities`);
  assert.ok(paved.length >= 1, "some city's road was paved");
  for (const c of paved) {
    const e = world.events.get(c.paved!)!;
    assert.equal(e.type, CITY_EVENTS.reshaped.type);
    const learned = world.events.get(e.causes[0]!.ref as Ref)!;
    assert.ok(learned.type === LORE_EVENTS.found.type || learned.type === LORE_EVENTS.learned.type);
    assert.equal((learned.data as { principle: string }).principle, "roads");
  }
  // Each paved city's trade stands nearer its road than the same town's would unpaved
  // (weighed against itself, not against other towns on other headings).
  const ctx = populationContext(world),
    river = homePlanet(world).generated.water.river;
  for (const c of paved) {
    const town = ctx.settlements.all().find((t) => t.ref === c.town)!,
      p = ctx.provinces.get(c.cell)!,
      share = Math.min(1, town.population / Math.max(1, p.total())),
      dirt = layout(
        town.population,
        Math.round(p.occupation(OCC.crafter) * share * 3),
        Math.round(p.occupation(OCC.trader) * share * 3),
        c.axis,
        false,
        !!river[c.cell],
      );
    assert.ok(
      marketsFromRoad(c.uses, c.axis) <= marketsFromRoad(dirt, c.axis) + 0.05,
      `${town.name}: ${marketsFromRoad(c.uses, c.axis).toFixed(2)} paved, ${marketsFromRoad(dirt, c.axis).toFixed(2)} were it not`,
    );
  }
  assert.ok(unpaved.length + paved.length === cities.length);
});

test("the microscope over a city shows its quarters, its homes in its housing blocks or on open ground, never on a temple, market or workshop", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(320 * YEAR);
  const city = citiesOf(world).all()[0]!,
    plan = EARTH.queries["village.plan"]!(world, { ref: city.town }) as {
      districts: { uses: number[]; blocks: number; blockM: number } | null;
      homes: { x: number; z: number }[];
    };
  assert.ok(plan.districts, "a city's plan has its quarters");
  for (const h of plan.homes) {
    const i = Math.round(h.x / BLOCK_M + (BLOCKS - 1) / 2),
      j = Math.round(h.z / BLOCK_M + (BLOCKS - 1) / 2),
      use = plan.districts.uses[j * BLOCKS + i];
    assert.ok(
      use === USE.houses || use === USE.crowded || use === USE.open,
      `a home at ${h.x.toFixed(0)},${h.z.toFixed(0)} is in ${use}`,
    );
  }
});
