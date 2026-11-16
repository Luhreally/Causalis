// What a realm turns to arms: Richardson's race at peace, its stake at war, and arms sent into another's war (rules/arming.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARMING,
  backingOf,
  fatigueOf,
  footingTerms,
  footingYear,
  peaceFooting,
  rivalLevel,
  warFooting,
} from "../../src/rules/index.ts";

const f = (threat: number, ratio: number, fatigue: number) =>
  peaceFooting({ threat, ratio, fatigue });

test("a realm arms as far as the rival it fears is stronger, the less the more arming costs its people", () => {
  assert.equal(f(0, 2, 1), 0);
  assert.ok(f(1, 2, 1) > f(1, 1, 1));
  assert.ok(f(1, 1, 1) > f(0.5, 1, 1));
  assert.ok(f(1, 1, 3) < f(1, 1, 1));
  // (A rival far stronger is read no further than so many times.)
  assert.equal(f(1, 100, 1), f(1, ARMING.ratioMost, 1));
});

test("arming costs more a people with little to spare, and one with a say in its choices", () => {
  assert.ok(fatigueOf(0.2, 0) > fatigueOf(0.8, 0));
  assert.ok(fatigueOf(0.5, 1) > fatigueOf(0.5, 0));
  assert.equal(fatigueOf(0, 0), fatigueOf(ARMING.spareLeast, 0));
});

test("at war a realm turns more to arms the more it stands to lose and the worse the war goes", () => {
  assert.ok(warFooting(1, 0.5, 1) > warFooting(0.1, 0.5, 1));
  assert.ok(warFooting(1, 0.2, 1) > warFooting(1, 0.8, 1));
  assert.ok(warFooting(1, 0, 0.01) <= ARMING.most);
  assert.equal(warFooting(1, 1, 1), 0);
});

/** Two realms answering each other for sixty years, from nothing, each reading the other's armed host against its own unarmed. */
function race(strengthA: number, strengthB: number, fatigue: number): [number, number] {
  let x = 0,
    y = 0;
  for (let i = 0; i < 60; i++) {
    const sx = strengthA * footingTerms(x, 0).power,
      sy = strengthB * footingTerms(y, 0).power;
    [x, y] = [
      footingYear(x, f(1, sy / strengthA, fatigue)),
      footingYear(y, f(1, sx / strengthB, fatigue)),
    ];
  }
  return [x, y];
}

test("two realms that fear each other race past what either would arm alone; the weaker of two arms the more", () => {
  const [x, y] = race(1, 1, 1.5),
    alone = f(1, 1, 1.5);
  assert.ok(x > 0 && Math.abs(x - y) < 1e-9);
  assert.ok(x > 1.1 * alone, `${x} ${alone}`);
  const [a, b] = race(1.5, 1, 1.5);
  assert.ok(b > a, `${a} ${b}`);
  // (A race that settles: no footing past the most.)
  assert.ok(b <= ARMING.most);
});

test("a footing moves a third of the way a year, within its bounds", () => {
  assert.ok(Math.abs(footingYear(0, 0.3) - 0.1) < 1e-9);
  assert.equal(footingYear(0.4, 5), Math.min(ARMING.most, 0.4 + ARMING.pace * (5 - 0.4)));
  assert.equal(footingYear(0.1, -1), 0);
});

test("a realm sends arms only into a war on one it fears enough, a share of its own arming", () => {
  assert.equal(backingOf(0.1, ARMING.backLeast - 0.01), 0);
  assert.ok(backingOf(0.1, 1) > backingOf(0.1, 0.5));
  assert.ok(backingOf(0, 1) > 0);
});

test("fear is the kept fear or how far regard is below rivalry, the greater; footing fields more and arms better", () => {
  assert.equal(rivalLevel(0.5, -0.4, 0), 0);
  assert.equal(rivalLevel(-1, -0.4, 0), 1);
  assert.equal(rivalLevel(0.5, -0.4, 0.3), 0.3);
  const t = footingTerms(0.2, 0.1);
  assert.ok(Math.abs(t.fields - ARMING.fields * 0.2) < 1e-9);
  assert.ok(Math.abs(t.power - (1 + ARMING.power * 0.3)) < 1e-9);
});
