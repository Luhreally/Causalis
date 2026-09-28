import { test } from "node:test";
import assert from "node:assert/strict";
import { sphereGrid } from "../../src/kernel/index.ts";
import { hallCells, hallDomes } from "../../src/view/index.ts";

const FREQUENCY = 12,
  grid = sphereGrid(FREQUENCY),
  y = (c: number) => grid.positions[c * 3 + 1]!;

test("a body's halls stand on its ground, each site apart from the others, the same each time", () => {
  const ground = new Uint8Array(grid.count),
    cells = hallCells(FREQUENCY, ground);
  assert.equal(cells.length, 3, "a place for each of its three sites");
  assert.equal(new Set(cells).size, 3, "each site in a place of its own");
  assert.deepEqual(hallCells(FREQUENCY, ground), cells, "the same places each time");
  // A little north of the equator, spread about it.
  for (const c of cells) assert.ok(y(c) > 0 && y(c) < 0.5, `cell ${c} a little north (${y(c)})`);
  // Where the north is sea, they stand on the ground nearest, in the south.
  const northSea = Uint8Array.from({ length: grid.count }, (_, c) => (y(c) > 0 ? 1 : 0)),
    south = hallCells(FREQUENCY, northSea);
  for (const c of south) assert.ok(y(c) <= 0, "on the ground, not the sea");
  // Ice bears halls as ground does.
  const ice = new Uint8Array(grid.count).fill(2);
  assert.deepEqual(hallCells(FREQUENCY, ice), cells);
  // A world all sea still has a place for them (the nearest).
  assert.deepEqual(hallCells(FREQUENCY, new Uint8Array(grid.count).fill(1)), cells);
});

test("a site's halls are as many domes as its people call for, the great hall in the middle", () => {
  assert.equal(hallDomes(10).length, 1, "a few people: one hall");
  assert.equal(hallDomes(100).length, 2);
  assert.equal(hallDomes(3200).length, 7);
  assert.equal(hallDomes(1e7).length, 7, "never more than seven");
  const d = hallDomes(800);
  assert.deepEqual(d[0], { u: 0, v: 0, r: 0.011 }, "the great hall in the middle");
  for (const x of d.slice(1)) {
    assert.ok(Math.abs(Math.hypot(x.u, x.v) - 0.022) < 1e-12, "the rest in a ring about it");
    assert.ok(x.r < d[0]!.r);
  }
});
