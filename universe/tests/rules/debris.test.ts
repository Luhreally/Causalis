// What launches leave aloft (rules/launch.ts debrisOf): dead mass dragged down by the air, strikes that make more,
// and past a critical mass a cascade.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLEAR_SKY, DEBRIS, aloftYears, debrisOf } from "../../src/rules/index.ts";

test("nothing flown, a clear sky; a few launches leave too little to be felt", () => {
  assert.equal(debrisOf([], 100, 1), CLEAR_SKY);
  const d = debrisOf([{ year: 90, tonnes: 1440 }], 100, 1);
  assert.ok(d.left > 0 && d.left < DEBRIS.left * 1440);
  assert.ok(!d.cascade);
  assert.equal(d.costs, 1);
  assert.equal(d.loss, 0);
  // A launch not yet made leaves nothing.
  assert.equal(debrisOf([{ year: 200, tonnes: 1440 }], 100, 1).left, 0);
});

test("the air drags it down: sooner under a heavy air, all but never over an airless world", () => {
  assert.equal(aloftYears(1), DEBRIS.earthYears);
  assert.ok(aloftYears(2) < aloftYears(1));
  assert.equal(aloftYears(0), DEBRIS.mostYears);
  const lifts = [{ year: 0, tonnes: 10000 }],
    at = (y: number, bar: number) => debrisOf(lifts, y, bar).left;
  assert.ok(Math.abs(at(DEBRIS.earthYears, 1) - (DEBRIS.left * 10000) / Math.E) < 1e-6);
  assert.ok(at(300, 1) < 5);
  assert.ok(at(300, 0) > 480);
  // Where the air clears slowly, less starts a cascade.
  assert.ok(debrisOf(lifts, 1, 0.1).critical < debrisOf(lifts, 1, 1).critical);
});

test("strikes make more as it nears the critical mass; past it a cascade: launches dearer and lost", () => {
  const many = (n: number) =>
    debrisOf(
      Array.from({ length: n }, (_, i) => ({ year: 100 + (i % 10), tonnes: 1440 })),
      110,
      1,
    );
  const some = many(6),
    near = many(13),
    past = many(30);
  assert.ok(some.load >= DEBRIS.felt && some.load < 1);
  assert.ok(some.fragments > some.left && some.fragments < 2 * some.left);
  assert.ok(some.costs > 1 && some.loss > 0 && some.loss < 0.1);
  assert.ok(near.load < 1 && near.fragments / near.left > some.fragments / some.left);
  assert.ok(past.cascade);
  assert.ok(past.fragments > 2 * past.left);
  assert.ok(past.loss > near.loss && past.costs > near.costs);
  assert.ok(past.costs <= 1 + 4 * DEBRIS.shield);
  // Left alone it clears: two centuries on the same launches are below what is felt.
  const later = debrisOf(
    Array.from({ length: 30 }, (_, i) => ({ year: 100 + (i % 10), tonnes: 1440 })),
    330,
    1,
  );
  assert.ok(!later.cascade && later.loss === 0);
});
