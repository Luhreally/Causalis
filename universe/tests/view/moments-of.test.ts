// Where each one drawn of a town is, asked of them all at once (Phase 60 T1: every frame): each
// one's day's legs kept for the day drawn, and their place kept out of the walls afresh only where
// it is not where it was last kept out from — so each stands where momentOf has them, bit for bit:
// through a day and from day to day, frame by frame, in a downpour, asked forward, backward and by
// leaps, rough and fine, for towns in turn, one raising its walls.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { VillagePlan } from "../../src/bridge/index.ts";
import { ACTIVITY, momentOf, momentsOf, type Moment } from "../../src/view/village.ts";
import { D0, DAY, HOUR, townOf, woundedPlan } from "./wounded-town.ts";

/** Every field the same, bit for bit (what they carry, by value). */
function same(a: Moment, b: Moment, what: string): void {
  assert.deepEqual(Object.keys(b), Object.keys(a), what);
  for (const k of Object.keys(a) as (keyof Moment)[]) {
    const x = a[k],
      y = b[k];
    if (typeof x === "object" && x !== null) assert.deepEqual(y, x, `${what}: ${k}`);
    else assert.ok(Object.is(x, y), `${what}: ${k} ${String(y)} against ${String(x)}`);
  }
}

/** All of a town at t both ways: the same. */
function asked(
  plan: VillagePlan,
  t: number,
  downpour: { from: number; to: number; all?: boolean } | null = null,
  fine = true,
): number {
  const all = momentsOf(plan, t, downpour, fine);
  assert.equal(all.length, plan.people.length);
  let walking = 0;
  all.forEach((m, i) => {
    same(momentOf(plan, i, t, downpour, fine), m, `${plan.ref} ${i} at ${t}`);
    if (!m.hidden && m.activity === ACTIVITY.walking) walking++;
  });
  return walking;
}

const town = townOf(),
  wounded = woundedPlan(),
  // (A town raising its walls: kept out of them as they rise.)
  building: VillagePlan = {
    ...townOf(),
    ref: "town:0:46",
    life: {
      fed: 1,
      growing: true,
      war: false,
      unrest: 0,
      faith: null,
      talk: ["weather"],
      site: { x: 40, z: -30, yaw: 0, progress: 0.5 },
      mourning: [],
      newborn: [],
    },
  };

test("through a day, all at once, each where momentOf has them", () => {
  for (const plan of [town, wounded, building]) {
    let walking = 0;
    for (let s = 0; s < DAY; s += 97) walking += asked(plan, (D0 + 20) * DAY + s);
    assert.ok(walking > 100, `${plan.ref}: ${walking} walking`);
  }
});

test("frame by frame at a run, in a downpour and out of it, the same", () => {
  const t0 = (D0 + 21) * DAY + 7.5 * HOUR,
    rain = { from: t0 + 40, to: t0 + 100 };
  for (let f = 0; f < 240; f++) {
    const t = t0 + f * 0.75;
    for (const plan of [town, wounded, building]) asked(plan, t, f % 3 ? rain : null);
  }
  // All of them indoors out of it.
  asked(town, t0 + 60, { ...rain, all: true });
});

test("asked backward, by leaps, rough and fine, and twice at once, the same", () => {
  const times = [
    (D0 + 20) * DAY + 12 * HOUR,
    (D0 + 19) * DAY + 12 * HOUR,
    (D0 + 20) * DAY + 8 * HOUR,
    (D0 + 25) * DAY + 17 * HOUR,
    (D0 + 20) * DAY + 8 * HOUR,
    (D0 + 20) * DAY + 8 * HOUR,
    D0 * DAY + 16.5 * HOUR,
    (D0 + 1) * DAY - 1,
    (D0 + 1) * DAY,
  ];
  for (const t of times)
    for (const fine of [true, false, true])
      for (const plan of [wounded, town, building]) asked(plan, t, null, fine);
});
