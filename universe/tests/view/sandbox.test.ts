import { test } from "node:test";
import assert from "node:assert/strict";
import type { FrameMessage } from "../../src/bridge/index.ts";
import {
  CELL_RADIUS,
  PEOPLE_PER_FIGURE,
  cellAt,
  cellCenter,
  priceColor,
  sandboxSpec,
} from "../../src/view/index.ts";

function frame(peoplePerClass: number): FrameMessage {
  const cells = 16,
    classes = 3;
  return {
    kind: "frame",
    view: "ring",
    seq: 1,
    t: 0,
    meta: { cells, classes },
    arrays: {
      people: new Float32Array(cells * classes).fill(peoplePerClass),
      prices: new Float32Array(cells).map((_, i) => 0.5 + i * 0.15),
      floodAge: new Float32Array(cells).map((_, i) => (i === 2 ? 10 : i === 3 ? 90 : -1)),
    },
  };
}

test("crowds are one figure per so many people, capped, and stay on their tile", () => {
  const spec = sandboxSpec(frame(95), 40);
  assert.equal(spec.cells.length, 16);
  for (const crowd of spec.crowds) {
    assert.equal(crowd.positions.length / 2, 16 * Math.ceil(95 / PEOPLE_PER_FIGURE));
    for (let i = 0; i < crowd.positions.length; i += 2) {
      const x = crowd.positions[i]!,
        z = crowd.positions[i + 1]!,
        cell = cellAt(x, z, 16)!;
      const [cx, cz] = cellCenter(cell, 16);
      assert.ok(Math.hypot(x - cx, z - cz) <= CELL_RADIUS, "a figure stands on its own tile");
    }
  }
  const capped = sandboxSpec(frame(100_000), 40);
  assert.equal(capped.crowds[0]!.positions.length / 2, 16 * 40);
});

test("the spec is a pure function of the frame", () => {
  const a = sandboxSpec(frame(60), 40),
    b = sandboxSpec(frame(60), 40);
  assert.deepEqual(a, b);
});

test("floods fade over sixty days and prices tint from green to red", () => {
  const spec = sandboxSpec(frame(10), 40);
  assert.ok(spec.cells[2]!.flood > 0.8);
  assert.equal(spec.cells[3]!.flood, 0);
  assert.equal(spec.cells[5]!.flood, 0);
  const cheap = priceColor(0.5),
    dear = priceColor(3);
  assert.ok(cheap[1] > cheap[0], "cheap land is green");
  assert.ok(dear[0] > dear[1], "dear land is red");
  assert.equal(cellAt(0, 0, 16), null, "the middle of the ring is nobody's");
});
