// A war ends when what it has cost a side comes to what it is worth to them, and a tribute is what the war was costing the one
// who pays (rules/terms.ts warReckoning, tributeOf).
import { test } from "node:test";
import assert from "node:assert/strict";
import { TERMS, tributeOf, warReckoning } from "../../src/rules/index.ts";

test("the attacker gives up when its cost comes to what winning is worth by its chance; the defender yields by the other", () => {
  const even = { won: 0, fought: 0, ratio: 1 };
  assert.equal(warReckoning({ ...even, costs: [0, 0], stakes: [0.2, 0.2] }).chance, 0.5);
  // (Cheap so far, and worth something to both: fought on.)
  const on = warReckoning({ ...even, costs: [0.01, 0.01], stakes: [0.2, 0.2] });
  assert.ok(!on.quits && !on.yields);
  // (It has paid more than winning is worth to it, by an even chance: it gives up.)
  assert.ok(warReckoning({ ...even, costs: [0.15, 0.01], stakes: [0.2, 0.2] }).quits);
  // (A defender beaten in every battle by one far stronger yields sooner than it would fight to the end.)
  const beaten = warReckoning({
    won: 6,
    fought: 6,
    ratio: 4,
    costs: [0.01, 0.04],
    stakes: [0.05, 0.2],
  });
  assert.ok(beaten.chance > 0.8, `${beaten.chance}`);
  assert.ok(beaten.yields && !beaten.quits);
});

test("a tribute is a year of what a year of the war cost the one who pays, for as long as it would have taken to cost its stake", () => {
  const t = tributeOf(0.06, 0.3);
  assert.equal(t.share, Math.max(TERMS.tributeShare, Math.min(TERMS.shareMost, 0.06)));
  assert.equal(
    t.years,
    Math.round(Math.max(TERMS.tributeYears, Math.min(TERMS.yearsMost, 0.3 / 0.06))),
  );
  // (Within the least and the most a tribute is.)
  assert.equal(tributeOf(0, 0.3).share, TERMS.tributeShare);
  assert.ok(tributeOf(1, 0.3).share <= TERMS.shareMost);
  assert.ok(tributeOf(0.001, 1).years <= TERMS.yearsMost);
});

test("a siege near taking its land is reckoned near won: the besieger holds on, the besieged yields the sooner", () => {
  const e = {
    won: 1,
    fought: 2,
    ratio: 1,
    costs: [0.05, 0.05] as const,
    stakes: [0.2, 0.2] as const,
  };
  const open = warReckoning(e),
    near = warReckoning({ ...e, taking: 0.8 });
  assert.ok(near.chance > open.chance);
  assert.equal(warReckoning({ ...e, taking: 0 }).chance, open.chance);
  assert.ok(warReckoning({ ...e, taking: 1 }).chance <= 1);
});
