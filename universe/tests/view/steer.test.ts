import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STEER,
  STILL,
  asked,
  ease,
  globeDrag,
  grabbed,
  steerKey,
  steerView,
  still,
  type SteerAction,
} from "../../src/view/index.ts";

const key = (code: string, k = "") => steerKey({ code, key: k });
const view = { target: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: -45, distance: 10 },
  limits = { minPitch: -85, maxPitch: -8 };

test("the keys a builder's camera is steered by: W A S D and the arrows, Q E, R F, + − and Z X", () => {
  assert.equal(key("KeyW"), "ahead");
  assert.equal(key("ArrowUp"), "ahead");
  assert.equal(key("KeyS"), "back");
  assert.equal(key("KeyA"), "left");
  assert.equal(key("ArrowRight"), "right");
  assert.equal(key("KeyQ"), "turnLeft");
  assert.equal(key("KeyE"), "turnRight");
  assert.equal(key("KeyR"), "tiltUp");
  assert.equal(key("PageDown"), "tiltDown");
  // + and − by what the key says, wherever it lies; Z and X, and the numbers pad's, by place.
  assert.equal(key("Equal", "+"), "zoomIn");
  assert.equal(key("Equal", "="), "zoomIn");
  assert.equal(key("Minus", "-"), "zoomOut");
  assert.equal(key("NumpadAdd", "+"), "zoomIn");
  assert.equal(key("NumpadSubtract", "-"), "zoomOut");
  assert.equal(key("KeyZ", "z"), "zoomIn");
  assert.equal(key("KeyX", "x"), "zoomOut");
  assert.equal(key("Space", " "), null, "Space is time's, not the camera's");
  assert.equal(key("KeyP", "p"), null);
});

test("what the keys ask, and the velocity eased toward it: quick to start, quick to stop", () => {
  const held = new Set<SteerAction>(["ahead", "turnLeft", "zoomIn"]),
    want = asked(held);
  assert.deepEqual(want, { ahead: 1, aside: 0, turn: -1, tilt: 0, zoom: 1 });
  assert.deepEqual(asked(new Set<SteerAction>(["left", "right"])), STILL, "opposites cancel");
  let v = STILL;
  for (let i = 0; i < 6; i++) v = ease(v, want, 1 / 60);
  assert.ok(v.ahead > 0.7 && v.ahead < 1, `most of the way in a tenth of a second (${v.ahead})`);
  for (let i = 0; i < 60; i++) v = ease(v, STILL, 1 / 60);
  assert.ok(still(v), "and still again, not creeping on");
});

test("over a flat land the middle goes along the ground by the way the camera faces, as far a second as it stands", () => {
  const go = (yaw: number, v: Partial<typeof STILL>) =>
    steerView({ ...view, yaw }, { ...STILL, ...v }, 1, "flat", false, limits, null);
  // Facing along -z (yaw 0): ahead is -z, right is +x.
  const ahead = go(0, { ahead: 1 });
  assert.ok(Math.abs(ahead.target.z + STEER.pan * 10) < 1e-9 && Math.abs(ahead.target.x) < 1e-9);
  const right = go(0, { aside: 1 });
  assert.ok(Math.abs(right.target.x - STEER.pan * 10) < 1e-9 && Math.abs(right.target.z) < 1e-9);
  // Turned a quarter (yaw 90: the camera stands at +x, facing -x): ahead is -x.
  const turned = go(90, { ahead: 1 });
  assert.ok(Math.abs(turned.target.x + STEER.pan * 10) < 1e-9 && Math.abs(turned.target.z) < 1e-9);
  // Twice as far from it, twice as far a second; Shift three times.
  const far = steerView(
      { ...view, distance: 20 },
      { ...STILL, ahead: 1 },
      1,
      "flat",
      false,
      limits,
      null,
    ),
    quick = steerView(view, { ...STILL, ahead: 1 }, 1, "flat", true, limits, null);
  assert.ok(Math.abs(far.target.z - 2 * ahead.target.z) < 1e-9);
  assert.ok(Math.abs(quick.target.z - STEER.fast * ahead.target.z) < 1e-9);
  // Turning, tilting within its limits, zooming in by a factor below one.
  const q = go(0, { turn: -1, tilt: 1, zoom: 1 });
  assert.ok(q.yaw < 0 && q.pitch > -45 && q.zoom < 1);
  const top = steerView(
    { ...view, pitch: -10 },
    { ...STILL, tilt: 1 },
    5,
    "flat",
    false,
    limits,
    null,
  );
  assert.equal(top.pitch, -8, "no further than the horizon it may look to");
  // Kept within its land.
  const kept = steerView(view, { ...STILL, ahead: 1 }, 100, "flat", false, limits, {
    x: 0,
    z: 0,
    reach: 50,
  });
  assert.ok(Math.abs(Math.hypot(kept.target.x, kept.target.z) - 50) < 1e-9);
});

test("about a globe W goes north and A D go round, as fast as it stands high", () => {
  const g = { ...view, pitch: 0, distance: 3 },
    lim = { minPitch: -80, maxPitch: 80 },
    north = steerView(g, { ...STILL, ahead: 1 }, 0.1, "round", false, lim, null),
    east = steerView(g, { ...STILL, aside: 1 }, 0.1, "round", false, lim, null),
    near = steerView(
      { ...g, distance: 1.5 },
      { ...STILL, aside: 1 },
      0.1,
      "round",
      false,
      lim,
      null,
    );
  assert.ok(north.pitch < 0, "north: the tilt toward the pole");
  assert.ok(east.yaw > 0 && east.pitch === 0);
  assert.ok(near.yaw < east.yaw / 3, "nearer its face, slower over it");
  assert.equal(north.target, g.target, "the middle stays the globe's");
});

test("the ground taken hold of comes under the pointer again; a globe held nearer turns less", () => {
  const t = grabbed({ x: 5, y: 1, z: 5 }, { x: 2, y: 0, z: 3 }, { x: 4, y: 0, z: 0 }, null);
  assert.deepEqual(t, { x: 3, y: 1, z: 8 });
  const held = grabbed(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: -100, y: 0, z: 0 },
    {
      x: 0,
      z: 0,
      reach: 30,
    },
  );
  assert.equal(held.x, 30, "no further than its land");
  assert.ok(globeDrag(1.3) < globeDrag(3) && globeDrag(3) <= 0.3 && globeDrag(1.001) > 0);
});
