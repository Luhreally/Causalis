// A seat under siege lives on its stores, its walls stand against the besiegers' craft and fire, and both the camp and the
// town sicken (rules/siege.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { SIEGE, breachYear, campSickness, siegeStep, storeMonths } from "../../src/rules/index.ts";

const year = {
  months: 18,
  breach: 0,
  walls: 0,
  engines: 0,
  fire: 0,
  relief: 0,
  camp: 10_000,
  warmth: 0,
  careCamp: 0,
  careTown: 0,
};

test("a seat no one has learned to wall is stormed in the first year of its siege, as before", () => {
  const s = siegeStep(year);
  assert.equal(s.outcome, "stormed");
  assert.equal(s.breach, 1);
});

test("walls hold a seat as long as its stores last; it is starved when they are gone", () => {
  const walled = { ...year, walls: 3 };
  assert.ok(breachYear(0, 0, 3) < 0.5);
  const one = siegeStep(walled);
  assert.equal(one.outcome, "holds");
  assert.ok(Math.abs(one.months - (18 - 12 * (1 - SIEGE.within))) < 1e-9, `${one.months}`);
  const two = siegeStep({ ...walled, months: one.months, breach: one.breach });
  assert.equal(two.outcome, "starved");
  assert.equal(two.months, 0);
  // (The town starves for the part of the year it had nothing.)
  assert.ok(two.townDead > one.townDead);
});

test("what its ships bring in keeps a coastal seat fed for longer", () => {
  const walled = { ...year, walls: 3 },
    fed = siegeStep({ ...walled, relief: 0.8 }),
    shut = siegeStep(walled);
  assert.ok(fed.months > shut.months + 6, `${fed.months} ${shut.months}`);
});

test("siege craft and fire open walls faster", () => {
  assert.ok(breachYear(2, 0, 3) > breachYear(0, 0, 3));
  assert.ok(breachYear(0, 4, 3) > breachYear(0, 0, 3));
  assert.ok(breachYear(0, 0, 1) < breachYear(0, 0, 0));
});

test("a camp sickens more where it is warm and crowded, less with care", () => {
  const mid = campSickness(SIEGE.crowdMid, 0, 0);
  assert.ok(Math.abs(mid - SIEGE.camp) < 1e-9, `${mid}`);
  assert.ok(campSickness(SIEGE.crowdMid, 15, 0) > 1.9 * mid);
  assert.ok(campSickness(SIEGE.crowdMid * 100, 0, 0) > mid);
  assert.ok(campSickness(SIEGE.crowdMid, 0, 0.5) < mid);
  // (Care never spares all of it.)
  assert.ok(campSickness(SIEGE.crowdMid, 0, 1) > 0);
});

test("a seat's stores are its food over what its people eat a month", () => {
  assert.equal(storeMonths(600, 100), 6);
  assert.equal(storeMonths(600, 0), 0);
  assert.equal(storeMonths(-5, 100), 0);
});
