// Round D: sicknesses evolve. Harm that spreads a sickness best is higher where it needs no host up and about and in
// great crowds; reach follows harm along the trade-off; strains rise where most are spared.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bestDeadliness, reachFor, selectionPace, strainChance } from "../../src/rules/index.ts";

test("a sickness of foul water or vermin is selected deadlier than one of the breath; crowds make any deadlier", () => {
  assert.ok(bestDeadliness("water", 0) > bestDeadliness("breath", 0));
  assert.ok(bestDeadliness("vermin", 0) > bestDeadliness("touch", 0));
  assert.ok(bestDeadliness("breath", 80000) > bestDeadliness("breath", 1000));
});

test("reach falls with harm along the trade-off, and is its own at its first harm", () => {
  const first = { reach: 0.5, deadliness: 0.2 };
  assert.ok(Math.abs(reachFor("water", 0.2, first) - 0.5) < 1e-9);
  assert.ok(reachFor("water", 0.05, first) < 0.5);
});

test("selection moves faster through more hosts; strains rise among the spared of a lifelong sickness", () => {
  assert.equal(selectionPace(0), 0);
  assert.ok(selectionPace(1e5) > selectionPace(100));
  assert.equal(strainChance(0, 1e5, 60), 0);
  assert.ok(strainChance(0.8, 1e5, 60) > strainChance(0.8, 1e5, 5));
});
