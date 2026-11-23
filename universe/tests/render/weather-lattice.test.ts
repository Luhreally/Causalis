// The weather's drops and the god's motes at places of the ground's own (the owner's rule, 2026-11-21: nothing drawn moves
// with the camera): a pan goes over them, a zoom shares them out between two scales, never moving one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { clearOfEye, latticeAt, moteOf, tiersOf } from "../../src/render/weather.ts";

test("a drop stands at the same place of the world as the point looked at moves, until it wraps at the shower's edge", () => {
  const out = new Float32Array(3),
    S = 16,
    reach = S * 0.95;
  for (let id = 0; id < 200; id++) {
    latticeAt(0, 0, S, id, 3, 1, out);
    const x0 = out[0]!,
      z0 = out[1]!;
    assert.ok(Math.abs(x0) <= reach && Math.abs(z0) <= reach);
    // The eye's point moved a little: the drop's world place the same (its offset less by the move), while it stays
    // inside the shower.
    for (const [ax, az] of [
      [0.7, -0.3],
      [-2.5, 1.25],
    ] as const) {
      latticeAt(ax, az, S, id, 3, 1, out);
      const wrapped = Math.abs(x0 - ax) > reach || Math.abs(z0 - az) > reach;
      if (wrapped) {
        // (Across the edge: the same place a whole shower over, faded to nothing there.)
        assert.ok(
          Math.abs(Math.abs(out[0]! + ax - x0) % (2 * reach)) < 1e-3 ||
            Math.abs(Math.abs(out[1]! + az - z0) % (2 * reach)) < 1e-3,
        );
        continue;
      }
      assert.ok(Math.abs(out[0]! + ax - x0) < 1e-4, `drop ${id} x moved`);
      assert.ok(Math.abs(out[1]! + az - z0) < 1e-4, `drop ${id} z moved`);
    }
  }
});

test("a drop fades to nothing toward the shower's edge, where it wraps, and near the eye", () => {
  const out = new Float32Array(3);
  let edged = 0;
  for (let id = 0; id < 500; id++) {
    latticeAt(0, 0, 8, id, 0, 1, out);
    const r = Math.hypot(out[0]!, out[1]!) / (8 * 0.95);
    if (r >= 1) assert.equal(out[2], 0);
    if (r < 0.8) assert.equal(out[2], 1);
    if (r > 0.8 && r < 1) edged++;
  }
  assert.ok(edged > 0);
  const eye = { x: 0, y: 0, z: 0 };
  assert.equal(clearOfEye(1, 0, 0, eye, 8), 0);
  assert.equal(clearOfEye(8, 0, 0, eye, 8), 1);
  const mid = clearOfEye(4, 0, 0, eye, 8);
  assert.ok(mid > 0 && mid < 1);
});

test("a zoom shares the drops out between the two powers of two about the eye's distance, a few at a time", () => {
  let was = tiersOf(10, 1000);
  for (let d = 10; d < 80; d *= 1.01) {
    const now = tiersOf(d, 1000);
    if (now.t0 === was.t0)
      assert.ok(Math.abs(now.n0 - was.n0) <= 20, `${was.n0} -> ${now.n0} at ${d}`);
    // (Past a power of two: the scale above, all the drops' at the last, is the lower one now with all of them.)
    else assert.ok(was.n0 <= 20 && now.n0 >= 980, `${was.n0} -> ${now.n0} at ${d}`);
    was = now;
  }
  assert.deepEqual(tiersOf(16, 100), { t0: 4, n0: 100, low: 1 });
});

test("a drop keeps its scale and its place as more or fewer fall, and as the eye draws in, only a few change scale", () => {
  // (Shared out by its draw, not by its index against the count: a shower coming on adds drops, moving none.)
  const { t0, low } = tiersOf(5.3, 0),
    first = Array.from({ length: 400 }, (_, i) => moteOf(i, t0, low));
  for (let i = 0; i < 400; i++) assert.deepEqual(moteOf(i, t0, low), first[i]);
  const lower = first.filter((m) => m.tier === t0).length;
  assert.ok(
    Math.abs(lower / 400 - low) < 0.08,
    `${lower} of 400 at the lower scale, its share ${low}`,
  );
  // (Drawn in a little: a few go to the lower scale, none the other way.)
  const nearer = tiersOf(5.1, 0),
    moved = first.filter((m, i) => moteOf(i, nearer.t0, nearer.low).tier !== m.tier);
  assert.ok(moved.length > 0 && moved.length < 40, `${moved.length} changed scale`);
  assert.ok(moved.every((m) => m.tier === t0 + 1));
});
