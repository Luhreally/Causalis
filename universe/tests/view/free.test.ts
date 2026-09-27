import { test } from "node:test";
import assert from "node:assert/strict";
import { freeLook, freeStep, orbitOf, type FreeRules } from "../../src/view/index.ts";

const flat = () => 0,
  rules: FreeRules = { speed: 2, height: 10, clearance: 1 };

test("a free camera goes the way it faces, on the level, and aside; up goes straight up", () => {
  // Facing along -z (yaw 0), looking down: ahead is -z, not into the ground.
  const s = { x: 0, y: 5, z: 0, yaw: 0, pitch: -40 },
    ahead = freeStep(s, { ahead: 1, aside: 0, up: 0, fast: false }, 1, rules, flat);
  assert.ok(ahead.z < 0 && Math.abs(ahead.x) < 1e-9, "ahead along the way it faces");
  assert.equal(ahead.y, 5, "level: looking down does not dive");
  const right = freeStep(s, { ahead: 0, aside: 1, up: 0, fast: false }, 1, rules, flat);
  assert.ok(right.x > 0 && Math.abs(right.z) < 1e-9, "aside to its right");
  const up = freeStep(s, { ahead: 0, aside: 0, up: 1, fast: false }, 1, rules, flat);
  assert.ok(up.y > 5 && up.x === 0 && up.z === 0);
  // Faster the higher it is, and in a hurry.
  const high = freeStep(
      { ...s, y: 40 },
      { ahead: 1, aside: 0, up: 0, fast: false },
      1,
      rules,
      flat,
    ),
    quick = freeStep(s, { ahead: 1, aside: 0, up: 0, fast: true }, 1, rules, flat);
  assert.ok(Math.abs(high.z) > Math.abs(ahead.z) * 4, "high up it covers more ground");
  assert.ok(Math.abs(quick.z) > Math.abs(ahead.z) * 2, "in a hurry");
});

test("it keeps above the ground flying, and at the eye's height walking", () => {
  const hill = (x: number) => (x > 5 ? 20 : 0),
    s = { x: 0, y: 3, z: 0, yaw: -90, pitch: 0 },
    // Facing +x (yaw -90): on over the hill, lifted clear of it.
    over = freeStep(s, { ahead: 1, aside: 0, up: 0, fast: true }, 2, rules, hill);
  assert.ok(over.x > 5, `it went on (${over.x.toFixed(1)})`);
  assert.equal(over.y, 21, "held clear of the hill");
  const sink = freeStep(s, { ahead: 0, aside: 0, up: -1, fast: true }, 10, rules, flat);
  assert.equal(sink.y, 1, "no lower than its clearance");
  const walker: FreeRules = { speed: 1.4, height: 5, clearance: 0.1, walk: { eye: 1.7 } },
    walked = freeStep({ ...s, y: 50 }, { ahead: 1, aside: 0, up: 1, fast: false }, 1, walker, hill);
  assert.equal(walked.y, 1.7, "a walker's eye stands on the ground, and does not rise");
});

test("handed back, the orbit stands where the free camera stood, looking where it looked", () => {
  const s = { x: 3, y: 10, z: -2, yaw: 30, pitch: -45 },
    o = orbitOf(s, 0, 100),
    look = freeLook(s.yaw, s.pitch);
  assert.ok(Math.abs(o.target.y) < 1e-9, "its look falls on the ground");
  // The orbit's camera: the target plus its distance along (sin yaw, -sin pitch, cos yaw) scaled.
  const y = (o.yaw * Math.PI) / 180,
    p = (o.pitch * Math.PI) / 180,
    cam = {
      x: o.target.x + o.distance * Math.cos(p) * Math.sin(y),
      y: o.target.y - o.distance * Math.sin(p),
      z: o.target.z + o.distance * Math.cos(p) * Math.cos(y),
    };
  assert.ok(Math.hypot(cam.x - s.x, cam.y - s.y, cam.z - s.z) < 1e-9, "it stands where it stood");
  assert.ok(look.y < 0);
  // Looking above the horizon: the orbit turns about a point that far ahead.
  const skyward = orbitOf({ ...s, pitch: 10 }, 0, 50);
  assert.ok(Math.abs(skyward.distance - 50) < 1e-9);
});

test("about a globe, up is away from its middle: it rises over one spot", () => {
  const round: FreeRules = { speed: 1, height: 1, clearance: 0, space: true, round: true },
    s = { x: 0.6, y: 0, z: 0.8, yaw: 0, pitch: -30 },
    risen = freeStep(s, { ahead: 0, aside: 0, up: 1, fast: false }, 1, round, () => null),
    r = Math.hypot(risen.x, risen.y, risen.z);
  assert.ok(r > 1, "risen");
  assert.ok(
    Math.abs(risen.x / r - 0.6) < 1e-9 && Math.abs(risen.z / r - 0.8) < 1e-9,
    "over the same spot",
  );
});
