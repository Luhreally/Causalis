// The land's ground as its shader reads it (render/region.ts groundTexels): a texel a tile, the land's colours carried a texel
// over the water and the water's over the land, so that blended between the four texels about a point land meets only land
// and water only water, and the shore falls where the water's share passes a half.
import { test } from "node:test";
import assert from "node:assert/strict";
import { groundTexels } from "../../src/render/region.ts";

test("ground texels: land carried over the water and water over the land; how wet, and the woods' cover", () => {
  const size = 3,
    colors = new Uint8Array(size * size * 4),
    wet = new Uint8Array(size * size);
  for (let t = 0; t < size * size; t++) colors.set([40 + t, 160, 30, 100], 4 * t);
  // A lake tile in the middle.
  wet[4] = 3;
  colors.set([20, 90, 200, 255], 16);
  const land = new Uint8Array(size * size * 4),
    water = new Uint8Array(size * size * 4);
  groundTexels(colors, wet, size, land, water);
  // How wet: the lake 255, the land 0.
  assert.equal(water[4 * 4 + 3], 255);
  assert.equal(water[0 * 4 + 3], 0);
  // The lake's texel of the land: its neighbours' land, their woods' cover with it.
  const mean = Math.round([0, 1, 2, 3, 5, 6, 7, 8].reduce((s, t) => s + 40 + t, 0) / 8);
  assert.deepEqual([...land.slice(16, 20)], [mean, 160, 30, 100]);
  // A land tile's texel of the water: the lake's colour; the land's own colours and cover kept in its land texel.
  assert.deepEqual([...water.slice(0, 3)], [20, 90, 200]);
  assert.deepEqual([...land.slice(0, 4)], [40, 160, 30, 100]);
});

test("ground texels: the woods' crowns seen from above, carried over the water as the land is", () => {
  const size = 3,
    colors = new Uint8Array(size * size * 4).fill(120),
    canopy = new Uint8Array(size * size * 4),
    wet = new Uint8Array(size * size);
  for (let t = 0; t < size * size; t++) canopy.set([10 + 2 * t, 70, 20, 255], 4 * t);
  wet[4] = 1;
  const land = new Uint8Array(size * size * 4),
    water = new Uint8Array(size * size * 4),
    crowns = new Uint8Array(size * size * 4);
  groundTexels(colors, wet, size, land, water, canopy, crowns);
  assert.deepEqual([...crowns.slice(0, 3)], [10, 70, 20]);
  const mean = Math.round([0, 1, 2, 3, 5, 6, 7, 8].reduce((s, t) => s + 10 + 2 * t, 0) / 8);
  assert.deepEqual([...crowns.slice(16, 19)], [mean, 70, 20]);
  // (None given: the ground's own, darkened.)
  groundTexels(colors, wet, size, land, water, null, crowns);
  assert.equal(crowns[0], Math.round(120 * 0.7));
});
