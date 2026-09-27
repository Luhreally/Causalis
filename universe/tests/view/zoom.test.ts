import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BEYOND,
  flightAt,
  towardOnFlat,
  towardOnGlobe,
  zoomStep,
  type ZoomState,
} from "../../src/view/index.ts";

test("within a scale the zoom moves; pushed on past an edge, it gathers and goes through", () => {
  let s: ZoomState = { distance: 5, beyond: 0, way: "out" };
  // Within: it moves, nothing gathers.
  let n = zoomStep(s, 1.5, 1, 12);
  assert.equal(n.distance, 7.5);
  assert.equal(n.through, null);
  assert.equal(n.beyond, 0);
  // Out to the farthest, then on past it: it holds there as the push gathers...
  s = { distance: 12, beyond: 0, way: "out" };
  let steps = 0;
  for (; steps < 20; steps++) {
    n = zoomStep(s, 1.1, 1, 12);
    if (n.through) break;
    assert.equal(n.distance, 12);
    s = n;
  }
  // ...and goes through, out, after a third again.
  assert.equal(n.through, "out");
  assert.equal(steps, Math.ceil(BEYOND / Math.log(1.1)) - 1);
  // A push that turns back starts again; one at the nearest goes in.
  s = { distance: 12, beyond: BEYOND * 0.9, way: "out" };
  n = zoomStep(s, 0.9, 1, 12);
  assert.equal(n.beyond, 0);
  assert.equal(n.through, null);
  s = { distance: 1, beyond: 0, way: "out" };
  for (let k = 0; k < 20 && !n.through; k++) {
    n = zoomStep(s, 0.9, 1, 12);
    s = n;
  }
  assert.equal(n.through, "in");
});

test("a zoom goes toward what is under the pointer: a flat scene slides to it, a globe turns to it", () => {
  // Closing in by half on a point off to the east: the target goes half the way there, and
  // drawing back again returns it; within bounds it goes no farther than they reach.
  const target = { x: 0, y: 0, z: 0 },
    at = { x: 10, y: 0, z: -4 },
    near = towardOnFlat(target, at, 0.5, null);
  assert.deepEqual(near, { x: 5, z: -2 });
  const back = towardOnFlat({ ...near, y: 0 }, at, 2, null);
  assert.ok(Math.hypot(back.x, back.z) < 1e-9, "drawing back undoes it");
  const kept = towardOnFlat(target, { x: 100, y: 0, z: 0 }, 0.1, { x: 0, z: 0, reach: 30 });
  assert.ok(Math.abs(kept.x - 30) < 1e-9, "held within the scene's reach");
  // A globe turns the point toward the middle (the short way round), and not when drawing back.
  const east = towardOnGlobe(0, 0, { x: 1, y: 0, z: 0 }, 0.5);
  assert.ok(Math.abs(east.yaw - 45) < 1e-9 && Math.abs(east.pitch) < 1e-9);
  const round = towardOnGlobe(
    170,
    0,
    { x: -Math.sin(Math.PI / 18), y: 0, z: -Math.cos(Math.PI / 18) },
    0.5,
  );
  assert.ok(Math.abs(round.yaw - 180) < 1e-6, `the short way (${round.yaw})`);
  const north = towardOnGlobe(0, 0, { x: 0, y: 1, z: 0 }, 0.5);
  assert.ok(Math.abs(north.pitch + 45) < 1e-9, "north tilts it up");
  assert.deepEqual(towardOnGlobe(20, -10, { x: 1, y: 0, z: 0 }, 1.5), { yaw: 20, pitch: -10 });
});

test("a flight goes to where it is sent, the short way round, drawn back on a long way", () => {
  const from = { target: { x: 0, y: 0, z: 0 }, yaw: 170, pitch: -30, distance: 10 },
    to = { target: { x: 0, y: 0, z: 0 }, yaw: -170, pitch: -30, distance: 10 };
  const start = flightAt(from, to, 0),
    end = flightAt(from, to, 1),
    mid = flightAt(from, to, 0.5);
  assert.deepEqual(start, from);
  assert.ok(
    Math.abs(end.yaw - 190) < 1e-9 || Math.abs(end.yaw + 170) < 1e-9,
    `ends at its turn (${end.yaw})`,
  );
  assert.ok(Math.abs(end.distance - 10) < 1e-9);
  assert.ok(Math.abs(mid.yaw - 180) < 1e-9, `turns the short way (${mid.yaw})`);
  // A short turn stays close; a long way across the ground draws back in its middle.
  assert.ok(Math.abs(mid.distance - 10) < 1e-6, "a short turn is not flown high");
  const far = flightAt(
    { target: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: -40, distance: 20 },
    { target: { x: 200, y: 0, z: 0 }, yaw: 0, pitch: -40, distance: 10 },
    0.5,
  );
  assert.ok(far.distance > 20, `drawn back on the way (${far.distance.toFixed(1)})`);
  assert.ok(far.target.x > 50 && far.target.x < 150, "halfway there");
});
