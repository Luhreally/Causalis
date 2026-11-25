import { test } from "node:test";
import assert from "node:assert/strict";
import { ORPHANS, carersOf, orphanedOf } from "../../src/rules/index.ts";

// Orphans (rules/orphans.ts): the young a year's dying leaves needing a hearth, by how their people rear.

test("a pair rears with two, a seasonal pairing with little more than one; a hive and a spawner leave no orphans", () => {
  assert.equal(carersOf("life"), 2);
  assert.ok(carersOf("season") > 1 && carersOf("season") < 2);
  assert.equal(carersOf("brood"), 0);
  assert.deepEqual(orphanedOf(0.5, "brood"), { needing: 0, alone: 0 });
  assert.deepEqual(orphanedOf(0.5, "none"), { needing: 0, alone: 0 });
});

test("the more of the grown die, the more young need a hearth; with one carer more are left alone than with two", () => {
  const few = orphanedOf(0.02, "life"),
    many = orphanedOf(0.3, "life");
  assert.ok(many.needing > few.needing && few.needing > 0);
  assert.ok(Math.abs(many.alone - 0.09) < 1e-12);
  assert.ok(orphanedOf(0.3, "harem").alone > many.alone);
  // (Those whose hearth lost one of two: half of them cannot be kept.)
  assert.ok(Math.abs(many.needing - (0.09 + ORPHANS.half * (1 - 0.49 - 0.09))) < 1e-12);
  assert.equal(orphanedOf(0, "life").needing, 0);
  assert.equal(orphanedOf(1, "life").needing, 1);
});
