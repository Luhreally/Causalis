// What a land built over keeps off its roads (D1): the pure read of what lies on a line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { GroundClaims } from "../../src/bridge/index.ts";
import {
  facetWater,
  onLines,
  roadClear,
  roadTiles,
  tileMiddle,
  type LandGround,
} from "../../src/view/index.ts";

test("a block on a road lies on it, one clear of it does not, however long the road's straight", () => {
  const on = onLines([
    [
      { x: 0, z: 0 },
      { x: 10, z: 0 },
      { x: 30, z: 0 },
    ],
    [
      { x: 100, z: 100 },
      { x: 100, z: 160 },
    ],
  ]);
  assert.equal(on(5, 0.5, 1), true);
  assert.equal(on(5, 3, 1), false);
  assert.equal(on(25, 0.9, 1), true);
  assert.equal(on(25, -1.1, 1), false);
  assert.equal(on(-3, 0, 1), false);
  // (The middle of a long straight, cells from either end.)
  assert.equal(on(100.5, 130, 1), true);
  assert.equal(on(103, 130, 1), false);
  // (A wide block reaches further than one cell.)
  assert.equal(on(100, 80, 25), true);
});

test("no roads: nothing lies on one", () => {
  assert.equal(onLines([])(0, 0, 5), false);
});

// (A small land: 9 tiles a side, a kilometre each, flat; a river down its middle column, a lake at its east edge.)
function riverLand(): LandGround {
  const size = 9,
    water = new Uint8Array(size * size);
  for (let j = 0; j < size; j++) water[j * size + 4] = 2;
  water[4 * size + 8] = 3;
  return {
    size,
    tileKm: 1,
    heights: new Float32Array(size * size).fill(1),
    water,
    fertility: new Uint8Array(size * size),
  };
}

test("a road between two ends of a river in a valley keeps to its banks, and crosses it one tile wide", () => {
  const g = riverLand();
  // (Its banks two hundred metres over the river: along the river the way is level, climbing out of it steep.)
  for (let t = 0; t < g.heights.length; t++) if (g.water[t] !== 2) g.heights[t] = 3;
  const along = roadTiles(g, 0 * 9 + 4, 8 * 9 + 4);
  assert.ok(along.length >= 9);
  assert.equal(
    along.filter((t) => g.water[t] === 2).length,
    2,
    "in the river only where it starts and ends",
  );
  const across = roadTiles(g, 4 * 9 + 1, 4 * 9 + 7);
  let run = 0,
    most = 0;
  for (const t of across) {
    run = g.water[t] === 2 ? run + 1 : 0;
    most = Math.max(most, run);
  }
  assert.equal(most, 1, "a crossing is one tile of the river");
});

test("no piece of a road is drawn with any of it on a lake, though its middle stands on the shore", () => {
  const g = riverLand(),
    clear = roadClear(new GroundClaims(0.05), g),
    shore = tileMiddle(g, 4 * 9 + 7),
    lake = tileMiddle(g, 4 * 9 + 8),
    // (A piece from the shore's middle half way to the lake's: its middle dry, its far end on the water.)
    x = shore.x + (lake.x - shore.x) * 0.45,
    len = 0.6;
  assert.equal(facetWater(g, x, shore.z), 0, "its middle is dry");
  assert.equal(clear([x, 0, shore.z, len, Math.PI / 2, 0]), false);
  assert.equal(clear([shore.x - 1, 0, shore.z, 0.3, Math.PI / 2, 0]), true);
});
