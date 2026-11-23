// A people's measure and their shelter's (view/stature.ts, asked 2026-11-23: "some of these houses are too small for the thing inside
// it"): ours come to ours, every body stands under its own door and storey as the town draws it, and the bigger the body the higher
// and wider its home, with no clamp but its lot.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  figureOf,
  figureExtent,
  lifeFigure,
  measuresOf,
  type FigureBody,
} from "../../src/view/index.ts";

const ape = (size: number): FigureBody => ({
  clade: "ape",
  medium: "land",
  symmetry: "bilateral",
  manipulators: "hands",
  limbs: 2,
  skin: "skin",
  size,
});
const BODIES: FigureBody[] = [
  ape(60),
  ape(4),
  ape(2350),
  { ...ape(900), clade: "trunk", manipulators: "trunk", limbs: 1 },
  { ...ape(80), clade: "crawler", manipulators: "claws", skin: "scales" },
  {
    ...ape(30),
    clade: "swimmer",
    medium: "water",
    symmetry: "radial",
    manipulators: "tentacles",
    limbs: 8,
  },
  { ...ape(40), clade: "strider", skin: "feathers" },
  { ...ape(20), clade: "shore", medium: "shore", manipulators: "claws", skin: "shell" },
];

test("ours stand 1.75 m: a door 2 m high, a storey 3 m, a household's floor within a hut's 22 m²", () => {
  const m = measuresOf(ape(60));
  assert.ok(Math.abs(m.stature - 1.75) < 0.01, `${m.stature}`);
  assert.ok(Math.abs(m.door - 2) < 0.02, `${m.door}`);
  assert.ok(Math.abs(m.storey - 3) < 0.02, `${m.storey}`);
  assert.ok(m.home <= 22, `${m.home}`);
  assert.deepEqual(measuresOf(null), m);
});

test("every body drawn in a town stands its true height, under its own door and storey, its child too", () => {
  for (const b of BODIES) {
    const m = measuresOf(b),
      f = lifeFigure(figureOf(b), b),
      drawn = (figureExtent(f).top * f.scale) / 0.1;
    assert.ok(
      Math.abs(drawn - m.stature) < 1e-6,
      `${b.clade} ${b.size}: drawn ${drawn}, stands ${m.stature}`,
    );
    assert.ok(
      drawn < m.door && drawn < m.storey,
      `${b.clade} ${b.size}: ${drawn} under ${m.door} / ${m.storey}`,
    );
  }
});

test("a body grows as the cube root of its weight, with no bound: its doors and floors with it", () => {
  const small = measuresOf(ape(4)),
    ours = measuresOf(ape(60)),
    big = measuresOf(ape(2350));
  assert.ok(Math.abs(big.stature / ours.stature - Math.cbrt(2350 / 60)) < 1e-9);
  assert.ok(Math.abs(small.stature / ours.stature - Math.cbrt(4 / 60)) < 1e-9);
  assert.ok(big.storey > 3 * 3 && small.storey < 1.3, `${small.storey} … ${big.storey}`);
  assert.ok(big.home > ours.home * 9, "a big body's household needs the floor it lies on");
});
