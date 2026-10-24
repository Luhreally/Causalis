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
import { LOT, lotStates, townLots, type TownPlan } from "../../src/bridge/index.ts";

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
  // Each paved city whose quarters have come to their worth stands its trade nearer its road
  // than the same town's would unpaved (weighed against itself, not against other towns on
  // other headings). A few blocks move a year: a city paved — or grown — these last years is
  // still being reshaped, and is not weighed until its trade stands where the paved plan puts it.
  const ctx = populationContext(world),
    river = homePlanet(world).generated.water.river;
  let settled = 0;
  for (const c of paved) {
    const town = ctx.settlements.all().find((t) => t.ref === c.town)!,
      p = ctx.provinces.get(c.cell)!,
      share = Math.min(1, town.population / Math.max(1, p.total())),
      laid = (pave: boolean) =>
        layout(
          town.population,
          Math.round(p.occupation(OCC.crafter) * share * 3),
          Math.round(p.occupation(OCC.trader) * share * 3),
          c.axis,
          pave,
          !!river[c.cell],
        ),
      dirt = laid(false),
      plan = laid(true),
      trade = (u: number | undefined) => (TRADE as readonly number[]).includes(u ?? -1);
    if (plan.filter((u, k) => u !== c.uses[k]).length > 12) continue;
    if (plan.filter((u, k) => trade(u) !== trade(c.uses[k])).length > 3) continue;
    settled++;
    assert.ok(
      marketsFromRoad(c.uses, c.axis) <= marketsFromRoad(dirt, c.axis) + 0.05,
      `${town.name}: ${marketsFromRoad(c.uses, c.axis).toFixed(2)} paved, ${marketsFromRoad(dirt, c.axis).toFixed(2)} were it not`,
    );
  }
  assert.ok(
    settled >= Math.ceil(paved.length / 2),
    `${settled} of ${paved.length} paved cities come to their worth`,
  );
  assert.ok(unpaved.length + paved.length === cities.length);
});

test("the microscope over a city shows its quarters, its homes in its housing blocks or on open ground, never on a temple, market or workshop", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(320 * YEAR);
  const city = citiesOf(world).all()[0]!,
    plan = EARTH.queries["village.plan"]!(world, { ref: city.town }) as {
      districts: { uses: number[]; blocks: number; blockM: number } | null;
      homes: { x: number; z: number }[];
      town?: TownPlan;
    };
  assert.ok(plan.districts, "a city's plan has its quarters");
  // A city built lot by lot (Phase 23): its people in its own homes, on lots its buildings do not take.
  if (plan.town) {
    const lots = townLots(
        plan.town.family,
        plan.town.seed,
        plan.town.axis,
        plan.town.lots,
        plan.town.water,
      ),
      states = lotStates(plan.town);
    for (const h of plan.homes) {
      const p = [...lots.x.keys()].find(
        (q) => q < plan.town!.lots && lots.x[q] === h.x && lots.z[q] === h.z,
      );
      assert.ok(p !== undefined, `a home at ${h.x.toFixed(0)},${h.z.toFixed(0)} on a lot`);
      assert.equal(states.what[p], LOT.home, `lot ${p} a home`);
      assert.ok(
        plan.town.civics.every((c) => c.fell !== null || p < c.at || p >= c.at + c.lots),
        `lot ${p} under no building`,
      );
    }
    return;
  }
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
