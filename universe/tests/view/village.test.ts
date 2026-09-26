import { test } from "node:test";
import assert from "node:assert/strict";
import type { VillagePlan } from "../../src/bridge/index.ts";
import { ACTIVITY, momentOf, paceOf } from "../../src/view/index.ts";
import { CLADES, OCC, bodyOf } from "../../src/rules/index.ts";

const DAY = 86_400,
  HOUR = 3_600;

const plan: VillagePlan = {
  ref: "town:0:1",
  name: "Testford",
  population: 60,
  market: true,
  hand: false,
  districts: null,
  biome: 8,
  seed: 3,
  homes: [
    { x: 20, z: 0, yaw: 0, household: "hhold:0:1" },
    { x: -20, z: 10, yaw: 1, household: "hhold:0:2" },
  ],
  fields: [
    { x: 260, z: 0, w: 40, d: 25, yaw: 0 },
    { x: 250, z: 60, w: 40, d: 25, yaw: 0.2 },
  ],
  pasture: { x: -550, z: 0, r: 150 },
  wild: 900,
  water: null,
  house: { walls: "wattle", roof: "thatch", form: "long", pitch: 45, design: null },
  body: null,
  road: { x: 0, z: 1100 },
  people: [
    { ref: "prsn:0:1", name: "Ana Test", home: 0, age: 34, occupation: OCC.farmer, child: false },
    { ref: "prsn:0:2", name: "Bo Test", home: 0, age: 8, occupation: OCC.dependent, child: true },
    { ref: "prsn:0:3", name: "Cy Test", home: 1, age: 40, occupation: OCC.crafter, child: false },
    { ref: "prsn:0:4", name: "Di Test", home: 1, age: 70, occupation: OCC.farmer, child: false },
  ],
};

/** A day that is a work day for this plan (one in seven rests). */
const workday = [10, 11, 12, 13, 14, 15, 16].find((d) => (d + (plan.seed % 7)) % 7 !== 0)!,
  restday = [10, 11, 12, 13, 14, 15, 16].find((d) => (d + (plan.seed % 7)) % 7 === 0)!;

test("at night everyone is asleep, out of sight", () => {
  for (let i = 0; i < plan.people.length; i++) {
    const m = momentOf(plan, i, workday * DAY + 3 * HOUR);
    assert.equal(m.activity, ACTIVITY.asleep);
    assert.ok(m.hidden);
  }
});

test("on a work day the farmer is out in the fields in the morning, the crafter near the square", () => {
  const farmer = momentOf(plan, 0, workday * DAY + 10 * HOUR),
    crafter = momentOf(plan, 2, workday * DAY + 10 * HOUR);
  assert.equal(farmer.activity, ACTIVITY.working);
  assert.ok(Math.hypot(farmer.x, farmer.z) > 200, "in the fields");
  assert.equal(crafter.activity, ACTIVITY.working);
  assert.ok(Math.hypot(crafter.x, crafter.z) < 40, "at the workshop by the square");
  const child = momentOf(plan, 1, workday * DAY + 10 * HOUR);
  assert.equal(child.activity, ACTIVITY.playing);
});

test("on the day of rest no one works", () => {
  for (let s = 8 * HOUR; s < 16 * HOUR; s += HOUR)
    for (let i = 0; i < plan.people.length; i++)
      assert.notEqual(momentOf(plan, i, restday * DAY + s).activity, ACTIVITY.working);
});

test("people walk, never leap: a day sampled every ten seconds moves at walking pace", () => {
  for (let i = 0; i < plan.people.length; i++) {
    let last = momentOf(plan, i, workday * DAY);
    for (let s = 10; s < DAY; s += 10) {
      const m = momentOf(plan, i, workday * DAY + s),
        step = Math.hypot(m.x - last.x, m.z - last.z);
      assert.ok(
        step <= 1.25 * 10 + 1,
        `${plan.people[i]!.name} moved ${step.toFixed(1)} m in 10 s at ${s}`,
      );
      last = m;
    }
  }
});

test("hunger rises between meals and tiredness through the day; the same moment always looks the same", () => {
  const before = momentOf(plan, 0, workday * DAY + 11.9 * HOUR),
    morning = momentOf(plan, 0, workday * DAY + 8 * HOUR);
  assert.ok(before.hunger > morning.hunger);
  assert.ok(before.tiredness > morning.tiredness);
  assert.deepEqual(momentOf(plan, 3, 12345678), momentOf(plan, 3, 12345678));
});

const bodyOfClade = (id: string) =>
  bodyOf(
    CLADES.find((c) => c.id === id)!,
    { warmth: 18, rain: 800, gravity: 1, ocean: 0.7 },
    [0.5, 0.5, 0.5],
  );

test("each people goes at its own pace: striders stride, shelled bodies creep, and their day's walks take as long", () => {
  const body = (id: string) =>
    bodyOf(
      CLADES.find((c) => c.id === id)!,
      { warmth: 18, rain: 800, gravity: 1, ocean: 0.7 },
      [0.5, 0.5, 0.5],
    );
  assert.equal(paceOf(null), 1.25);
  assert.equal(paceOf(body("ape")), 1.25);
  assert.ok(paceOf(body("strider")) > paceOf(body("ape")));
  assert.ok(paceOf(body("burrower")) < paceOf(body("ape")));
  // The farmer's walk out to the fields: a slow people arrives later.
  const out = (p: VillagePlan) => {
    for (let s = 5 * HOUR; s < 12 * HOUR; s += 30)
      if (momentOf(p, 0, workday * DAY + s).activity === ACTIVITY.working) return s;
    return Infinity;
  };
  // (Spans held at an ape's, so the same farmer is of working age in each.)
  const slow = { ...plan, body: { ...body("burrower"), span: 70 } },
    fast = { ...plan, body: { ...body("strider"), span: 70 } };
  assert.ok(
    out(slow) > out(plan) && out(plan) > out(fast),
    `${out(slow)} ${out(plan)} ${out(fast)}`,
  );
});

test("the old keep near home as late in life as their people's span allows", () => {
  const short = { ...plan, body: { ...bodyOfClade("ape"), clade: "crawler", span: 30 } },
    // Di, seventy, keeps near home among upright apes; Cy, forty, is old among a people of thirty years.
    at = (p: VillagePlan, i: number) => {
      const m = momentOf(p, i, workday * DAY + 10 * HOUR),
        home = p.homes[p.people[i]!.home]!;
      return Math.hypot(m.x - home.x, m.z - home.z);
    };
  assert.ok(at(plan, 3) < 10, "an old ape at home");
  assert.ok(at(plan, 2) > 10, "a crafter of forty at the square");
  assert.ok(at(short, 2) < 10, "forty is old in a thirty-year span");
});
