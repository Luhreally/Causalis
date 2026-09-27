import { test } from "node:test";
import assert from "node:assert/strict";
import { LAKE_R, type VillagePlan } from "../../src/bridge/index.ts";
import { dryAt, villageGround, keepOut } from "../../src/view/index.ts";

const plan: VillagePlan = {
  ref: "town:0:9",
  name: "Mere",
  population: 60,
  market: false,
  hand: false,
  districts: null,
  biome: 8,
  seed: 3,
  homes: [
    { x: 30, z: 0, yaw: 0, household: null },
    { x: -30, z: 10, yaw: 1, household: null },
  ],
  fields: [],
  pasture: { x: -200, z: 0, r: 90 },
  wild: 320,
  water: { x: 0, z: -700 },
  house: { walls: "wattle", roof: "thatch", form: "long", pitch: 45, design: null },
  body: null,
  road: { x: 0, z: 1100 },
  people: [],
};

test("the ground's water and homes are solid: a walker is kept out, to the nearest edge", () => {
  const ground = villageGround(plan);
  assert.equal(ground.lake!.r, LAKE_R);
  assert.equal(ground.homes.length, 2);
  // In the water: pushed to its shore (with the walker's reach to spare).
  const p = { x: 0, z: -600 };
  keepOut(ground, p, 3);
  assert.ok(Math.abs(Math.hypot(p.x, p.z + 700) - (LAKE_R + 3)) < 1e-9);
  assert.ok(p.z > -600, "toward the nearer shore");
  // In a home: out of its walls.
  const q = { x: 31, z: 1 };
  keepOut(ground, q, 2);
  assert.ok(Math.hypot(q.x - 30, q.z) >= ground.homes[0]!.r + 2 - 1e-9);
  // Clear ground is left alone.
  const c = { x: 200, z: 200 };
  keepOut(ground, c, 3);
  assert.deepEqual(c, { x: 200, z: 200 });
  assert.ok(dryAt(ground, 200, 200, 150) && !dryAt(ground, 0, -400, 150));
});

test("walking past a home is a smooth step around it, never a jump", () => {
  const ground = villageGround(plan),
    h = ground.homes[0]!;
  let last: { x: number; z: number } | null = null;
  // (A line that passes the home off its middle.)
  for (let t = -40; t <= 40; t += 0.1) {
    const p = { x: h.x + t, z: h.z + h.r * 0.4 };
    keepOut(ground, p, 1);
    if (last) assert.ok(Math.hypot(p.x - last.x, p.z - last.z) < 1, `at ${t.toFixed(1)}`);
    last = p;
  }
});
