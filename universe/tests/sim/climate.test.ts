import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref, type World } from "../../src/kernel/index.ts";
import { cellRef, surfaceOre } from "../../src/gen/index.ts";
import {
  AIR_EVENTS,
  CARBON_PER_FUEL,
  FIRST_CARBON,
  LORE_EVENTS,
  POPULATION_EVENTS,
  SENSITIVITY,
  airOf,
  heatYield,
  loreOf,
  makePopulationWorld,
  marketsOf,
  populationContext,
  rainShift,
  smokeIn,
  warmingOf,
} from "../../src/sim/index.ts";
import { G, principle } from "../../src/rules/index.ts";
import { why } from "../../src/causal/index.ts";

const CHAIN = [
  "writing",
  "mathematics",
  "currency",
  "bronze",
  "iron",
  "steel",
  "clockwork",
  "coal-mining",
  "steam-engine",
  "banking",
  "factories",
];

/** Teach a land principles outright (a fixture: the tree takes centuries to reach them). */
function teach(world: World, cell: number, ids: string[]): void {
  const lore = loreOf(world);
  for (const id of ids) {
    if (lore.get(cell, id)) continue;
    const event = world.events.emit({
      type: LORE_EVENTS.found.type,
      place: cellRef(0, cell),
      data: { principle: id },
    });
    lore.learn(cell, id, { year: Math.floor(world.now / YEAR), event }, principle(id));
  }
}

// First light a century and a half on: its forty most peopled lands over coal learn the
// way to the factory; then, for forty years, the air is given the smoke of a world of
// engines besides (a steady twelve parts in a million a year).
const world = makePopulationWorld(seedFromText("first light"), { start: "spread" });
world.runTo(150 * YEAR);
const ctx = populationContext(world),
  g = ctx.generated,
  industrial = ctx.provinces
    .all()
    .filter((p) => p.total() && surfaceOre(g, p.cell, "coal"))
    .sort((a, b) => b.total() - a.total() || a.cell - b.cell)
    .slice(0, 40);
for (const p of industrial) teach(world, p.cell, CHAIN);
world.runTo(160 * YEAR);
const burnedLastYear = airOf(world).air.burned,
  burnedAt160 = burnedLastYear,
  fuelAt160 = marketsOf(world)
    .all()
    .reduce((s, m) => {
      // The air reckons at its year's turn, before the markets close theirs: the year before.
      const used = m.years.at(-2)?.ledger[1];
      return s + (used ? used[G.coal]! + used[G.oil]! : 0);
    }, 0);
for (let y = 161; y <= 200; y++) {
  airOf(world).air.carbon += 12;
  world.runTo(y * YEAR);
}
const told = (type: string) => world.events.all().filter((e) => e.type === type);

test("burning and clearing put carbon in the air, and the world warms toward what it holds", () => {
  // Forty lands' engines for a decade: what they burned last year is in the air, a
  // little carbon (the land and sea take back more of the clearing's than that).
  assert.ok(burnedLastYear > 0 && burnedLastYear === burnedAt160, "burning adds carbon");
  assert.ok(
    Math.abs(burnedAt160 - fuelAt160 * CARBON_PER_FUEL) < 1e-12,
    `${burnedAt160} against ${fuelAt160 * CARBON_PER_FUEL}`,
  );
  const air = airOf(world).air;
  assert.ok(air.carbon > FIRST_CARBON + 150, `${air.carbon} ppm`);
  // Warming lags what the carbon would hold in the end, but heads there.
  const toward = SENSITIVITY * Math.log2(air.carbon / FIRST_CARBON);
  assert.ok(air.warming > 0.5 && air.warming < toward, `${air.warming} of ${toward}`);
  assert.equal(warmingOf(world), air.warming);
});

test("each half degree is told, citing the lands that burned most", () => {
  const warmer = told(AIR_EVENTS.warmer.type);
  assert.ok(warmer.length >= 1);
  const first = warmer[0]!;
  const burners = first.causes.filter((c) =>
    ["industry.works", "industry.mine"].includes(world.events.get(c.ref as Ref)?.type ?? ""),
  );
  assert.ok(burners.length >= 1, "the lands that burned most");
  assert.match(why(world, first.id).claim, /grown 0\.5 °C warmer than before the engines/);
});

test("as the world warms, rain moves and hot fields yield less; droughts cite the drying", () => {
  const lands = ctx.provinces.all().filter((p) => p.total());
  const drier = lands.filter((p) => rainShift(ctx, p.cell) < 1),
    wetter = lands.filter((p) => rainShift(ctx, p.cell) > 1);
  assert.ok(
    drier.length > 0 && wetter.length > 0,
    `${drier.length} drier, ${wetter.length} wetter`,
  );
  for (const p of drier)
    assert.ok(Math.abs(g.grid.lat[p.cell]!) < 0.62 || g.climate.precipitation[p.cell]! < 500);
  const hot = lands.find((p) => g.climate.temperature[p.cell]! > 22);
  if (hot) assert.ok(heatYield(ctx, hot.cell) < 1);
  const turned = [...told(AIR_EVENTS.drier.type), ...told(AIR_EVENTS.wetter.type)];
  // Rain moves a tenth once the world is some 1.7 °C warmer: this world is.
  assert.ok(airOf(world).air.warming >= 1.7, `${airOf(world).air.warming} °C`);
  assert.ok(turned.length >= 1, "some land's rain turned");
  for (const e of turned) {
    assert.ok(
      e.causes.some((c) => world.events.get(c.ref as Ref)?.type === AIR_EVENTS.warmer.type),
    );
    assert.match(why(world, e.id).claim, /grew (drier|wetter) as the world warmed/);
  }
  const dried = told(AIR_EVENTS.drier.type).map((e) => e.id);
  for (const d of told(POPULATION_EVENTS.drought.type).filter((e) => e.t > 190 * YEAR))
    for (const c of d.causes)
      if (c.role === "pressure") assert.ok(dried.includes(c.ref as Ref), "a drying it cites");
});

test("where much is burned among few, smoke fouls the air, and history says whose engines", () => {
  const smoky = told(AIR_EVENTS.smoke.type);
  assert.ok(smoky.length >= 5, `${smoky.length} lands fouled`);
  for (const e of smoky.slice(0, 5)) {
    const cell = Number(e.place!.split(":")[2]);
    const m = marketsOf(world).get(cell)!;
    assert.ok(e.causes.some((c) => c.ref === m.works || c.ref === m.mine));
    assert.match(why(world, e.id).claim, /grew foul with smoke/);
  }
  assert.ok(smokeIn(ctx, industrial[0]!.cell) > 0.1);
  // A land that burns nothing has clean air.
  const clean = ctx.provinces.all().find((p) => p.total() && !marketsOf(world).get(p.cell)?.mine);
  assert.equal(smokeIn(ctx, clean!.cell), 0);
});
