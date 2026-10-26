// A prior's chemistry (Phase 54): an Earth-like world keeps the Sun's own tables; an open one draws
// its chemistry from its star and orbit, and a seed's makings keep that so.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EARTHLIKE, OPEN, madePrior } from "../../src/rules/index.ts";

test("an Earth-like world keeps the Sun's chemistry, an open one draws its own", () => {
  assert.equal(EARTHLIKE.chemistry, "solar");
  assert.equal(OPEN.chemistry, "drawn");
});

test("a seed's makings keep the prior's chemistry, and do not remake an Earth-like world", () => {
  assert.equal(madePrior(OPEN, "x ~star red").chemistry, "drawn");
  assert.equal(madePrior(EARTHLIKE, "x ~star red"), EARTHLIKE);
});
