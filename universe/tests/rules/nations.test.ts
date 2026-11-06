// What holds a far world to a realm (galaxy-plan.md, Phase 72): a realm holds what it can answer in time; what a world cannot
// make ties it down; a world cut off falls by its numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DARK_FLOOR,
  WORKS_PEOPLE,
  answerYears,
  breakChance,
  darkLimit,
  holdYears,
  makesItsOwn,
  strainOf,
} from "../../src/rules/nations.ts";

const held = {
  answer: 10,
  hold: 22,
  fleet: true,
  forcedAgo: null,
  lostAgo: null,
  people: 1000,
  seatPeople: 1_000_000,
  owes: true,
};

test("word and fleet: the word goes by light or by the fleet, whichever is sooner, and the fleet follows", () => {
  assert.deepEqual(answerYears(10, 40), { word: 10, fleet: 40, answer: 50 });
  assert.deepEqual(answerYears(10, 4), { word: 4, fleet: 4, answer: 8 });
});

test("a realm's time to answer is two of its people's generations, and never less than ten years", () => {
  assert.equal(holdYears(20), 40);
  assert.equal(holdYears(2), 10);
});

test("a world within answering, needing what they bring, stays; past answering it may go", () => {
  const near = strainOf(held);
  assert.ok(near.total < 1, `within answering: ${near.total}`);
  assert.equal(breakChance(near.total), 0);
  const far = strainOf({ ...held, answer: 90, owes: false });
  assert.ok(far.total > 1, `past answering: ${far.total}`);
  assert.ok(breakChance(far.total) > 0);
});

test("needing what they bring takes away from what pulls a world off", () => {
  const free = strainOf({ ...held, answer: 60, owes: false }),
    owing = strainOf({ ...held, answer: 60, owes: true });
  assert.ok(Math.abs(free.total - owing.total - 0.5) < 1e-9);
});

test("no fleet, a fleet lost and force all pull, and the last two fade with the years", () => {
  const base = strainOf(held).total;
  assert.ok(strainOf({ ...held, fleet: false }).total > base);
  const lost = strainOf({ ...held, lostAgo: 0 }).total,
    lostLong = strainOf({ ...held, lostAgo: 100 }).total;
  assert.ok(lost > lostLong);
  assert.equal(lostLong, base);
  const forced = strainOf({ ...held, forcedAgo: 0 }).total,
    forcedLong = strainOf({ ...held, forcedAgo: 400 }).total;
  assert.ok(forced > forcedLong);
  assert.ok(forcedLong - base < 0.01);
});

test("no way to come at all is no more than the most a distance can pull", () => {
  const never = strainOf({ ...held, answer: Infinity });
  assert.ok(Number.isFinite(never.total));
  assert.equal(never.far, 3);
});

test("a world that has grown past those who hold it strains at them", () => {
  const small = strainOf({ ...held, people: 1000, seatPeople: 1000 }),
    great = strainOf({ ...held, people: 100_000_000, seatPeople: 1000 });
  assert.equal(small.size, 0);
  assert.ok(great.total > small.total);
});

test("the chance a world goes is bounded", () => {
  assert.equal(breakChance(1), 0);
  assert.equal(breakChance(0.2), 0);
  assert.equal(breakChance(99), 0.5);
});

test("a world makes its own only with metal in its ground and hands enough for the chain", () => {
  assert.equal(makesItsOwn(WORKS_PEOPLE, false), true);
  assert.equal(makesItsOwn(WORKS_PEOPLE - 1, false), false);
  assert.equal(makesItsOwn(WORKS_PEOPLE * 100, true), false);
});

test("a world cut off falls by its numbers, and those left in old halls do not all die", () => {
  assert.equal(darkLimit(1000, 0), 1000);
  const a = darkLimit(1000, 40),
    b = darkLimit(1000, 200);
  assert.ok(a < 1000 && b < a);
  const floor = darkLimit(1000, 10_000);
  assert.ok(Math.abs(floor - 1000 * DARK_FLOOR) < 1);
});
