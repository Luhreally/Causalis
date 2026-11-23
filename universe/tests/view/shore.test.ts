// A town's shore as its land's view draws it (view/shore.ts): its tiles' water blended between the four about each point and
// wavered by the grain, its water drawn where that passes a half, kept off what stands on its ground, its open round water
// always. One square of four tiles about the town's own, each of whose corners is water or not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { laidGround, shoreOf, shoreWater, wetForLaying } from "../../src/view/index.ts";

/** A land's water about a town: 2 x 2 squares of `m` metres, the bits of each (1 NW, 2 NE, 4 SW, 8 SE). */
const site = (bits: number[], m = 400) => ({
  wet: { m, half: 1, cells: bits.map((b) => String.fromCharCode(48 + b)).join("") },
});

const area = (tris: Float32Array) => {
  let a = 0;
  for (let k = 0; k < tris.length; k += 6)
    a +=
      Math.abs(
        (tris[k + 2]! - tris[k]!) * (tris[k + 5]! - tris[k + 1]!) -
          (tris[k + 4]! - tris[k]!) * (tris[k + 3]! - tris[k + 1]!),
      ) / 2;
  return a;
};

test("all water: every square drawn whole, as one", () => {
  const shore = shoreOf(site([15, 15, 15, 15]))!;
  const w = shoreWater(shore, { near: 5000, laid: laidGround() });
  assert.equal(w.squares, 4);
  assert.ok(Math.abs(area(w.tris) - 4 * 400 * 400) < 1);
  assert.equal(w.tris.length / 6, 8);
  assert.ok(w.on(10, -10) && w.on(-390, 390));
});

test("no water: nothing", () => {
  assert.equal(shoreOf({}), null);
  const w = shoreWater(shoreOf(site([0, 0, 0, 0]))!, { near: 5000, laid: laidGround() });
  assert.equal(w.tris.length, 0);
  assert.equal(w.squares, 0);
});

test("half a square of water: the shore curves about the line between, and reads as the grain has it", () => {
  // (The north halves water: tiles at the squares' north corners.)
  const shore = shoreOf(site([3, 3, 0, 0]), { x: 3.7, z: -1.2 })!;
  const w = shoreWater(shore, { near: 5000, laid: laidGround() });
  // (Within the grain's sway of the half-way line: a quarter of a square either way at most.)
  const want = 2 * 400 * 200;
  assert.ok(Math.abs(area(w.tris) - want) < 0.25 * want, `${area(w.tris)}`);
  // (Where it draws water, the shore reads past a half; where not, short of it; never a straight side all the way.)
  let agree = 0,
    n = 0;
  for (let x = -395; x < 400; x += 37)
    for (let z = -395; z < 0; z += 23) {
      const s = shore.s(x, z);
      if (Math.abs(s - 0.5) < 0.02) continue;
      n++;
      if (w.on(x, z) === s > 0.5) agree++;
    }
  assert.ok(agree / n > 0.98, `${agree} of ${n}`);
});

test("what stands on the ground keeps the water off it; the open water stays water", () => {
  const shore = shoreOf(site([15, 15, 15, 15]))!,
    laid = laidGround();
  laid.rects.push(-100, -100, 30, 20, 0.4);
  laid.rounds.push(150, 150, 25);
  laid.strips.push(-300, 200, -100, 300, 3);
  const w = shoreWater(shore, { near: 5000, laid, open: { x: 150, z: 150, r: 10 } });
  for (const [x, z] of [
    [-100, -100],
    [-112, -95],
    [150, 170],
    [-200, 250],
  ] as const)
    assert.equal(w.on(x, z), false, `${x}, ${z}`);
  assert.ok(w.on(-60, -100) && w.on(0, 0) && w.on(300, -300));
});

test("what a village's view lays keeps off both waters", () => {
  const water = site([3, 3, 0, 0]),
    plan = { landWater: water, water: null };
  assert.equal(wetForLaying(plan, -200, -390), true);
  assert.equal(wetForLaying(plan, -200, 390), false);
});
