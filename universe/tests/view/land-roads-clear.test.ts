// What a land built over keeps off its roads (D1): the pure read of what lies on a line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { onLines } from "../../src/view/index.ts";

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
