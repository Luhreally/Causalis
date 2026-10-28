import { test } from "node:test";
import assert from "node:assert/strict";
import { softenBodies } from "../../src/app/held-motion.ts";
import type { HeldBody } from "../../src/bridge/index.ts";
const body: HeldBody = {
  id: 1,
  x: 0,
  z: 0,
  yaw: 3.1,
  vx: 1,
  vz: 0,
  doing: "walk",
  hurt: 0,
  struck: -1,
  lost: -1,
};
test("small corrections ease across frames, taking the short turn across pi", () => {
  const next = { ...body, x: 1, yaw: -3.1 };
  const [shown] = softenBodies([body], [next], 1 / 60);
  assert.ok(shown!.x > 0 && shown!.x < 1);
  assert.ok(shown!.yaw > 3.1);
  assert.equal(next.x, 1);
  assert.equal(body.x, 0);
  let last: readonly HeldBody[] = [body];
  for (let i = 0; i < 60; i++) last = softenBodies(last, [next], 1 / 60);
  assert.ok(Math.abs(last[0]!.x - 1) < 0.001);
});
test("new bodies, teleports and disabling blows snap to their actual position", () => {
  const dead = { ...body, x: 1, doing: "dead" };
  assert.equal(softenBodies([body], [dead], 1 / 60)[0], dead);
  const jumped = { ...body, x: 10 };
  assert.equal(softenBodies([body], [jumped], 1 / 60)[0], jumped);
  assert.equal(softenBodies([], [body], 1 / 60)[0], body);
});
