import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEMOGRAPHY,
  HEREDITY,
  HUMANLIKE,
  harmAmong,
  heightsLost,
  landPressure,
  raceFrom,
  raceRest,
  raceStep,
  resistAfter,
  responseOf,
  statureAsked,
  takenTo,
  weightBy,
  youngHazard,
} from "../../src/rules/index.ts";

test("the breeder's equation: the response is the heritable share of the selection", () => {
  assert.equal(responseOf(0.4, 0.5), 0.2);
  assert.equal(responseOf(0, 1), 0);
});

test("a people takes to a land as fast as the land kills those who have not, and not at all to one that asks nothing", () => {
  const hazard = youngHazard(HUMANLIKE);
  // (Four in ten of the apes' young die before they bear: a hazard near a half.)
  assert.ok(hazard > 0.4 && hazard < 0.65, `${hazard}`);
  const high = landPressure(hazard, DEMOGRAPHY.heights * heightsLost(4000), 1),
    low = landPressure(hazard, DEMOGRAPHY.heights * heightsLost(1000), 1),
    h2 = HEREDITY.heritability.air;
  assert.equal(takenTo(40, h2, 0), 0);
  assert.equal(takenTo(0, h2, high), 0);
  assert.equal(takenTo(Infinity, h2, low), 1);
  assert.ok(takenTo(40, h2, high) > takenTo(40, h2, low));
  assert.ok(takenTo(80, h2, high) > takenTo(40, h2, high));
  // At 4,000 m, wholly in some eighty generations (Tibet's and the Andes' peoples: some thousands of years).
  const whole = Math.ceil(1 / takenTo(1, h2, high));
  assert.ok(whole > 40 && whole < 160, `${whole}`);
  // What is passed on the more is taken to the sooner.
  assert.ok(takenTo(10, 0.8, high) > takenTo(10, 0.4, high));
});

test("stature goes with the cold, as far as a people have taken to it", () => {
  assert.equal(statureAsked(16, 0), 0);
  assert.equal(statureAsked(16, 1), 2);
  assert.ok(statureAsked(-8, 1) < 0);
  assert.ok(weightBy(1) > 1.09 && weightBy(1) < 1.12);
});

test("a host answers its sickness: those it kills leave none, slowly at first, then running", () => {
  const p0 = HEREDITY.standing;
  assert.equal(resistAfter(p0, 0), p0);
  const one = resistAfter(p0, 0.3);
  assert.ok(one > p0 && one < 2 * p0, `${one}`);
  let p: number = p0,
    years = 0;
  while (p < 0.5 && years < 400) {
    p = resistAfter(p, 0.3);
    years++;
  }
  assert.ok(years > 10 && years < 60, `${years}`);
  // The step is the larger in the middle than at either end.
  assert.ok(resistAfter(0.5, 0.3) - 0.5 > one - p0);
  assert.ok(resistAfter(0.99, 0.3) - 0.99 < resistAfter(0.5, 0.3) - 0.5);
  // What is passed on in part moves the less.
  assert.ok(resistAfter(0.2, 0.3, 0.3) < resistAfter(0.2, 0.3));
  // Its harm among hosts who resist it is the less.
  assert.equal(harmAmong(0), 1);
  assert.ok(harmAmong(1) < harmAmong(0.5) && harmAmong(1) > 0);
});

test("a hunter and its prey drive each other, and the prey keeps ahead", () => {
  let r = { x: 0, y: 0 };
  for (let i = 0; i < 200; i++) r = raceStep(r.x, r.y, 5, 2);
  assert.ok(r.x > 0.5 && r.y > 0.2, JSON.stringify(r));
  assert.ok(r.x > r.y, JSON.stringify(r));
  assert.ok(r.x <= HEREDITY.most && r.y <= HEREDITY.most);
  // Where they never meet, neither moves.
  assert.deepEqual(raceStep(0, 0, 5, 2, 0), { x: 0, y: 0 });
  // Each one's trait moves by the other's: a keener hunter makes a warier prey than a dull one.
  const dull = raceStep(1, -2, 20, 0),
    keen = raceStep(1, 1, 20, 0);
  assert.ok(keen.x > dull.x, `${keen.x} ${dull.x}`);
  // As made, the two stand where neither gains by moving: nothing moves until one is moved.
  const rest = raceRest(1);
  assert.ok(rest.x > rest.y && rest.y > 0, JSON.stringify(rest));
  const still = raceFrom(0, 0, 10, 10);
  assert.ok(Math.abs(still.x) < 1e-3 && Math.abs(still.y) < 1e-3, JSON.stringify(still));
  // A prey something else has made warier moves its hunter (so wary, it is seldom worth the chase); and a hunter grown
  // keener makes its prey warier.
  const pressed = raceFrom(2, 0, 10, 10);
  assert.ok(pressed.y < -0.01, JSON.stringify(pressed));
  const chased = raceFrom(0, 1, 10, 0);
  assert.ok(chased.x > 0.01 && chased.y === 1, JSON.stringify(chased));
  assert.deepEqual(raceRest(0), { x: 0, y: 0 });
});
