import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMMON_MEASURE,
  measuresAgreed,
  measuresOf,
  tradeMeasured,
} from "../../src/rules/index.ts";

// Common measures in trade (rules/measures.ts): what two lands can count, weigh and date alike.

test("two lands agree on what the lesser can measure; a border between them halves it", () => {
  const calendar = measuresOf((id) => id === "calendar"),
    reckoning = measuresOf((id) => id === "calendar" || id === "mathematics" || id === "astronomy");
  assert.ok(calendar > 0 && reckoning > calendar);
  assert.equal(measuresAgreed(calendar, reckoning, false), calendar);
  assert.equal(measuresAgreed(reckoning, reckoning, true), reckoning * COMMON_MEASURE.apart);
  assert.equal(measuresAgreed(0, reckoning, false), 0);
  assert.equal(measuresAgreed(5, 5, false), 1);
});

test("nothing measured, trade is as it was; all measured, a tenth more", () => {
  assert.equal(tradeMeasured(0), 1);
  assert.ok(Math.abs(tradeMeasured(1) - (1 + COMMON_MEASURE.gain)) < 1e-12);
  assert.ok(tradeMeasured(0.5) > 1 && tradeMeasured(0.5) < tradeMeasured(1));
});
