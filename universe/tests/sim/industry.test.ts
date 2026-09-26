import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref, type World } from "../../src/kernel/index.ts";
import { SEAM, cellRef, seamRef, surfaceOre } from "../../src/gen/index.ts";
import {
  ECONOMY_EVENTS,
  LORE_EVENTS,
  SEA_STEPS,
  designsOf,
  homePlanet,
  loreOf,
  makePopulationWorld,
  marketsOf,
  populationContext,
  powerOf,
} from "../../src/sim/index.ts";
import { G, PRINCIPLES, designWords, principle } from "../../src/rules/index.ts";
import { why } from "../../src/causal/index.ts";

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

// First light a century and a half on: its most peopled market land over a coal seam is
// taught the way to the factory, and given two decades.
const world = makePopulationWorld(seedFromText("first light"), { start: "spread" });
world.runTo(150 * YEAR);
const ctx = populationContext(world),
  g = ctx.generated;
const coalLand = ctx.provinces
  .all()
  .filter(
    (p) =>
      surfaceOre(g, p.cell, "coal") && ctx.settlements.inProvince(p.cell).some((s) => s.market),
  )
  .sort((a, b) => b.total() - a.total() || a.cell - b.cell)[0]!;
// And a land far from any coal, taught the same.
const bare = ctx.provinces
  .all()
  .filter((p) => {
    if (!p.total() || surfaceOre(g, p.cell, "coal")) return false;
    for (let k = g.grid.offsets[p.cell]!; k < g.grid.offsets[p.cell + 1]!; k++)
      if (surfaceOre(g, g.grid.neighbours[k]!, "coal")) return false;
    return true;
  })
  .sort((a, b) => b.total() - a.total() || a.cell - b.cell)[0]!;
teach(world, coalLand.cell, CHAIN);
teach(world, bare.cell, CHAIN);
world.runTo(170 * YEAR);

test("coal and oil lie only where deep time buried swamp forests and plankton", () => {
  const home = homePlanet(world).generated;
  let seams = 0;
  for (let c = 0; c < home.grid.count; c++) {
    if (surfaceOre(home, c, "coal")) {
      seams++;
      assert.ok(home.deep.coal[c]! >= SEAM.coal);
      // What laid it down: a named field, or the age that buried it.
      const ref = seamRef(home, c, "coal")!;
      assert.ok(ref.startsWith("depo:") || ref.startsWith("age:"), ref);
    } else assert.ok(home.deep.coal[c]! < SEAM.coal || home.tectonics.elevation[c]! <= 0);
    if (surfaceOre(home, c, "oil")) assert.ok(home.deep.oil[c]! >= SEAM.oil);
  }
  assert.ok(seams > 20, `${seams} lands over coal`);
  // Each fuel's first principle is found only near its seam.
  for (const id of ["coal-mining", "oil-drilling"])
    assert.ok(PRINCIPLES.find((p) => p.id === id)!.drivers.ore);
});

test("a land that knows engines digs its coal, burns it and makes machines — and history traces them to the buried forests", () => {
  const m = marketsOf(world).get(coalLand.cell)!;
  assert.ok(m.mine && m.works, "a mine and works");
  const mine = world.events.get(m.mine)!;
  assert.equal(mine.type, ECONOMY_EVENTS.mine.type);
  assert.ok(
    mine.causes.some((c) => world.events.get(c.ref as Ref)?.type === LORE_EVENTS.found.type),
    "the knowledge",
  );
  const laid = mine.causes.find((c) => c.ref.startsWith("age:") || c.ref.startsWith("depo:"));
  assert.ok(laid, "what laid the coal down");
  assert.match(why(world, m.mine).claim, /Coal was first dug in/);
  // The works burned the coal of that mine.
  assert.ok(world.events.get(m.works)!.causes.some((c) => c.ref === m.mine));
  assert.match(why(world, m.works).claim, /first made machines/);
  // Its engines run on its coal: power well beyond its people's own strength.
  const last = m.years.at(-1)!.ledger;
  assert.ok(last[0]![G.coal]! > 0 && last[0]![G.machines]! > 0, "coal dug and machines made");
  assert.ok(m.powerCover > 900 && m.machineCover > 900);
  assert.ok(powerOf(ctx, coalLand.cell) > 1, `${powerOf(ctx, coalLand.cell)} kW a person`);
  // The coal is dug as it is used, not heaped up without end.
  assert.ok(m.stock[G.coal]! < 5 * (last[1]![G.coal]! + last[3]![G.coal]! + 1));
  // Its works are designed from what it knows and what it has.
  const works = designsOf(world).worksOf(coalLand.ref)!;
  assert.match(designWords(works.parts), /steam engines fired with coal/);
});

test("without coal to dig or buy, a land that knows engines has none to drive them", () => {
  const m = marketsOf(world).get(bare.cell)!;
  assert.equal(m.mine, null);
  assert.equal(m.years.at(-1)!.ledger[0]![G.coal], 0);
  if (!m.years.at(-1)!.ledger[2]![G.coal]) assert.ok(powerOf(ctx, bare.cell) < 0.3);
  const works = designsOf(world).worksOf(bare.ref);
  if (works) assert.doesNotMatch(designWords(works.parts), /steam/);
});

test("machines raise what farmers bring in", () => {
  const twin = () => {
    const w = makePopulationWorld(seedFromText("first light"), { start: "spread" });
    w.runTo(40 * YEAR);
    return w;
  };
  const plain = twin(),
    machined = twin(),
    cell = populationContext(plain)
      .provinces.all()
      .filter((p) => p.knowsCultivation)
      .sort((a, b) => b.total() - a.total() || a.cell - b.cell)[0]!.cell;
  marketsOf(machined).get(cell)!.machineCover = 1000;
  plain.runTo(40 * YEAR + YEAR / 12);
  machined.runTo(40 * YEAR + YEAR / 12);
  const grain = (w: World) => marketsOf(w).get(cell)!.line("made", G.grain);
  assert.ok(grain(machined) > grain(plain) * 1.2, `${grain(machined)} against ${grain(plain)}`);
  // Steamships cross the wide oceans.
  assert.equal(SEA_STEPS[4], 16);
  assert.equal(principle("steamships").effects.ships, 1);
});
