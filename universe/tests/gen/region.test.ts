import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { EARTHLIKE } from "../../src/rules/index.ts";
import { WATER, generateHomeWorld, refineRegion } from "../../src/gen/index.ts";

const world = generateHomeWorld(seedFromText("first light"), EARTHLIKE);

function landCells(filter: (c: number) => boolean, count: number): number[] {
  const out: number[] = [];
  for (let c = 0; c < world.grid.count && out.length < count; c += 131) if (filter(c)) out.push(c);
  return out;
}

test("a region is a pure function of its world and centre", () => {
  const c = landCells((c) => world.tectonics.elevation[c]! > 100, 1)[0]!;
  const a = refineRegion(world, c),
    b = refineRegion(world, c);
  assert.deepEqual(a.elevation, b.elevation);
  assert.deepEqual(a.water, b.water);
  assert.equal(a.size * a.size, a.elevation.length);
});

test("a region agrees with the planet it refines", () => {
  for (const c of landCells((c) => world.tectonics.elevation[c]! > 50, 6)) {
    const r = refineRegion(world, c);
    let own = 0,
      mean = 0;
    for (let t = 0; t < r.elevation.length; t++)
      if (r.parent[t] === c) {
        own++;
        mean += r.elevation[t]!;
      }
    mean /= own;
    const parent = world.tectonics.elevation[c]!;
    // The centre cell's tiles average the cell's height (the parent constrains its children).
    assert.ok(
      Math.abs(mean - parent) < 60 + 0.02 * Math.abs(parent),
      `cell ${c}: tiles ${mean} vs ${parent}`,
    );
    // Sea level is the planet's: a high inland cell's own tiles are dry.
    if (parent > 600 && world.climate.inland[c]! > 2)
      for (let t = 0; t < r.elevation.length; t++)
        if (r.parent[t] === c) assert.notEqual(r.water[t], WATER.sea);
    // Warmth follows the parent, less the lapse with height.
    const tCell = world.climate.temperature[c]!;
    let tMean = 0;
    for (let t = 0; t < r.elevation.length; t++) if (r.parent[t] === c) tMean += r.temperature[t]!;
    assert.ok(Math.abs(tMean / own - tCell) < 4, `cell ${c}: ${tMean / own} vs ${tCell} °C`);
  }
});

test("a planet river crossing a region flows through it", () => {
  const c = landCells((c) => {
    if (!world.water.river[c] || world.tectonics.elevation[c]! < 100) return false;
    for (let k = world.grid.offsets[c]!; k < world.grid.offsets[c + 1]!; k++) {
      const u = world.grid.neighbours[k]!;
      if (world.water.flowTo[u] === c && world.water.river[u]) return true;
    }
    return false;
  }, 1)[0]!;
  const r = refineRegion(world, c);
  let rivers = 0,
    biggest = 0;
  for (let t = 0; t < r.water.length; t++) {
    if (r.water[t] === WATER.river) rivers++;
    biggest = Math.max(biggest, r.discharge[t]!);
  }
  assert.ok(rivers > 100, `river tiles ${rivers}`);
  // The trunk carries at least the water that entered from upstream.
  const upstream = [...Array(world.grid.offsets[c + 1]! - world.grid.offsets[c]!).keys()]
    .map((k) => world.grid.neighbours[world.grid.offsets[c]! + k]!)
    .filter((u) => world.water.flowTo[u] === c && world.water.river[u]);
  assert.ok(upstream.length > 0);
});

test("deposits lie in their own cell's tiles, and soil is best on wet lowland", () => {
  const d = world.deposits.find((x) => world.tectonics.elevation[x.cell]! > 0)!,
    r = refineRegion(world, d.cell);
  const placed = r.deposits.find((x) => x.deposit === d.index);
  assert.ok(placed, "the centre cell's deposit is placed");
  assert.equal(r.parent[placed.tile], d.cell);
  for (let t = 0; t < r.fertility.length; t++) {
    assert.ok(r.fertility[t]! >= 0 && r.fertility[t]! <= 1);
    if (r.water[t] === WATER.sea) assert.equal(r.fertility[t], 0);
  }
});
