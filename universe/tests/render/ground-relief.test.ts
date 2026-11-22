// How a land's ground lies, read off its heights and waters (render/region.ts groundRelief), and a wet tile's colour by its
// depth (waterAtDepth): a hollow darker than a crest, a steep face's rock showing, the sea deeper the farther out, a lake
// deepest in its middle, a river shallow; shallows lighter and deeps darker, ice as it is.
import { test } from "node:test";
import assert from "node:assert/strict";
import { groundRelief, groundTexels, waterAtDepth } from "../../src/render/region.ts";

test("ground relief: a hollow darker than a crest, a cliff's rock, flat ground as it is", () => {
  const size = 9,
    heights = new Float32Array(size * size),
    water = new Uint8Array(size * size);
  // A crest at (2, 4), a hollow at (6, 4) on otherwise flat ground; a cliff along x = 4 in the top rows.
  heights[4 * size + 2] = 1;
  heights[4 * size + 6] = -1;
  for (let j = 0; j < 2; j++) for (let i = 5; i < size; i++) heights[j * size + i] = 8;
  const r = groundRelief(size, 2.4, heights, water);
  const crest = r.shade[4 * size + 2]!,
    hollow = r.shade[4 * size + 6]!,
    flat = r.shade[7 * size + 1]!;
  assert.ok(crest > 1 && hollow < 1, `crest ${crest}, hollow ${hollow}`);
  assert.equal(flat, 1);
  assert.ok(r.rock[0 * size + 5]! > 0.5, `the cliff's edge shows rock ${r.rock[5]}`);
  // (A bank as steep but low: a hill's, not a mountain's.)
  const low = heights.map((h) => Math.min(h, 1.5)),
    lr = groundRelief(size, 2.4, low, water);
  assert.equal(lr.rock[0 * size + 5], 0);
  assert.equal(r.rock[7 * size + 1], 0);
});

test("ground relief: the sea deeper the farther out, a lake deepest in its middle, a river shallow", () => {
  const size = 16,
    heights = new Float32Array(size * size),
    water = new Uint8Array(size * size);
  // Sea over the right half; a lake 5 across on the left; a river a tile wide down column 1.
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const t = j * size + i;
      if (i >= 9) water[t] = 1;
      else if (i >= 3 && i <= 7 && j >= 5 && j <= 9) water[t] = 3;
      else if (i === 1) water[t] = 2;
    }
  const { depth } = groundRelief(size, 2.4, heights, water);
  const at = (i: number, j: number) => depth[j * size + i]!;
  assert.ok(at(9, 8) < at(12, 8) && at(12, 8) < at(15, 8), "the sea deeper outward");
  assert.ok(at(5, 7) > at(3, 7), "the lake deeper in its middle");
  assert.ok(at(5, 7) > 0);
  assert.ok(at(1, 8) <= 0.45);
  assert.equal(at(0, 0), 0);
});

test("water at depth: shallows lighter, deeps darker, ice as it is", () => {
  const sea: [number, number, number] = [0.1, 0.4, 0.75],
    lum = (c: readonly number[]) => c[0]! + c[1]! + c[2]!;
  assert.ok(lum(waterAtDepth(sea, 0)) > lum(sea));
  assert.ok(lum(waterAtDepth(sea, 1)) < lum(sea));
  const ice: [number, number, number] = [0.85, 0.9, 0.95];
  assert.deepEqual(waterAtDepth(ice, 1), ice);
});

test("ground texels: the lie of the ground on them, and the water's depth in the crowns' alpha", () => {
  const size = 3,
    n = size * size,
    colors = new Uint8Array(n * 4),
    wet = new Uint8Array(n),
    land = new Uint8Array(n * 4),
    water = new Uint8Array(n * 4),
    crowns = new Uint8Array(n * 4);
  for (let t = 0; t < n; t++) colors.set([100, 140, 60, 255], 4 * t);
  wet[8] = 1;
  colors.set([20, 90, 200, 255], 32);
  const relief = {
    shade: new Float32Array(n).fill(1),
    depth: new Float32Array(n),
    rock: new Float32Array(n),
  };
  relief.shade[0] = 0.8;
  relief.depth[8] = 1;
  groundTexels(colors, wet, size, land, water, null, crowns, relief);
  assert.equal(land[0], 80);
  assert.equal(land[4], 100);
  // (The deep water darker; its depth for the sea's sheet; none over the land.)
  assert.ok(water[32]! < 20 + 90 + 200 && water[34]! < 200);
  assert.equal(crowns[35], 255);
  assert.equal(crowns[3], 0);
});

test("ground texels: rock over woods' crowns as over their ground, so the open ground taken out from under them stays ground", () => {
  const size = 3,
    n = size * size,
    colors = new Uint8Array(n * 4),
    canopy = new Uint8Array(n * 4),
    wet = new Uint8Array(n),
    land = new Uint8Array(n * 4),
    water = new Uint8Array(n * 4),
    crowns = new Uint8Array(n * 4);
  // Half under woods (alpha 128): its tile's colour the mean of dark crowns and pale open ground.
  for (let t = 0; t < n; t++) {
    colors.set([110, 160, 70, 128], 4 * t);
    canopy.set([40, 110, 40, 255], 4 * t);
  }
  const relief = {
    shade: new Float32Array(n).fill(1),
    depth: new Float32Array(n),
    rock: new Float32Array(n).fill(0.8),
  };
  groundTexels(colors, wet, size, land, water, canopy, crowns, relief);
  const woods = 1 - land[3]! / 255;
  for (let c = 0; c < 3; c++) {
    const open = (land[c]! - woods * crowns[c]!) / (1 - woods);
    assert.ok(open > 20 && open < 255, `channel ${c}: the open ground ${open}`);
  }
});
