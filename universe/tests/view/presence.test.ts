import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY,
  BLINK,
  DASH,
  FAR,
  clearOf,
  present,
  type Ground,
  type Moment,
  type Presence,
} from "../../src/view/index.ts";

const FRAME = 1 / 60;

function moment(x: number, z: number, hidden = false): Moment {
  return {
    x,
    z,
    yaw: 0,
    activity: ACTIVITY.working,
    task: null,
    hidden,
    hunger: 0,
    tiredness: 0,
    carry: null,
  };
}

/** Run one person through `frames` of targets; answer what was drawn each frame. */
function run(targets: Moment[], ground: Ground | null = null) {
  const state = new Map<string, Presence>();
  return targets.map((m) => present(state, ["prsn:0:1"], [m], FRAME, ground)[0]!);
}

test("however fast the day runs, no one is drawn to move further in a frame than a dash", () => {
  // A walk at five hundred metres a second (the world run on hours), then a stop.
  const targets = Array.from({ length: 180 }, (_, f) => moment(Math.min(f, 60) * (500 / 60), 0));
  const drawn = run(targets);
  let most = 0;
  for (let f = 1; f < drawn.length; f++) {
    const a = drawn[f - 1]!,
      b = drawn[f]!;
    if (a.size > 0.05 && b.size > 0.05)
      most = Math.max(most, Math.hypot(b.moment.x - a.moment.x, b.moment.z - a.moment.z));
  }
  assert.ok(most <= DASH * FRAME + 1e-6, `the most in a frame was ${most.toFixed(2)} m`);
});

test("a gap too long to walk is a blink: shrunk away where they stood, grown where they are", () => {
  const targets = [
    ...Array.from({ length: 30 }, () => moment(0, 0)),
    ...Array.from({ length: 60 }, () => moment(FAR * 4, 0)),
  ];
  const drawn = run(targets);
  // Whole before the jump; while shrinking they stay where they stood.
  assert.ok(drawn[29]!.size > 0.99);
  const gone = drawn.findIndex((d, f) => f >= 30 && d.size <= 0);
  assert.ok(gone > 30 && gone <= 30 + Math.ceil(BLINK / FRAME) + 1, `gone at frame ${gone}`);
  for (let f = 30; f < gone; f++)
    assert.ok(Math.hypot(drawn[f]!.moment.x, drawn[f]!.moment.z) < 1e-6);
  // Then grown again where they are, never between.
  for (let f = gone; f < drawn.length; f++) {
    const d = drawn[f]!;
    if (d.size > 0) assert.ok(Math.abs(d.moment.x - FAR * 4) < 1e-6);
  }
  assert.ok(drawn.at(-1)!.size > 0.99);
});

test("going in at a door shrinks them where they stand; coming out grows them where they are", () => {
  const targets = [
    ...Array.from({ length: 20 }, () => moment(5, 5)),
    ...Array.from({ length: 30 }, () => moment(5, 5, true)),
    ...Array.from({ length: 30 }, () => moment(40, -10)),
  ];
  const drawn = run(targets);
  const inside = drawn.slice(20, 50);
  assert.ok(inside.every((d) => Math.hypot(d.moment.x - 5, d.moment.z - 5) < 1e-6));
  assert.ok(inside.at(-1)!.size === 0 && inside.at(-1)!.moment.hidden);
  const out = drawn.slice(50);
  assert.ok(out.every((d) => d.size === 0 || Math.hypot(d.moment.x - 40, d.moment.z + 10) < 1e-6));
  assert.ok(out[0]!.size < 0.2 && out.at(-1)!.size > 0.99);
});

test("carried on a straight line through a house, they go round its wall", () => {
  const ground: Ground = {
      lake: null,
      homes: [{ x: 20, z: 0, r: 5, ax: 1, az: 0, half: 4 }],
      homesReach: 40,
    },
    targets = Array.from({ length: 120 }, (_, f) => moment(Math.min(f * 0.8, 40), 0));
  const drawn = run(targets, ground);
  for (const d of drawn)
    if (d.size > 0)
      assert.ok(
        clearOf(ground.homes[0]!, d.moment) >= 1.2 - 1e-6,
        `in the wall at ${d.moment.x.toFixed(1)}`,
      );
});

test("they face the way they go, stride while they move, and quicken their stride with their pace", () => {
  const slow = run(Array.from({ length: 120 }, (_, f) => moment(0, f * 0.02))),
    fast = run(Array.from({ length: 120 }, (_, f) => moment(0, f * 1.2)));
  const a = fast.at(-1)!;
  assert.equal(a.moment.activity, ACTIVITY.walking);
  assert.ok(
    Math.abs(Math.atan2(Math.sin(a.moment.yaw), Math.cos(a.moment.yaw))) < 0.05,
    "facing +z",
  );
  assert.ok(fast.at(-1)!.stride > slow.at(-1)!.stride, "the faster walker's stride runs quicker");
});
