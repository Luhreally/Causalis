import { test } from "node:test";
import assert from "node:assert/strict";
import { livedSpeed } from "../../src/view/index.ts";

test("a day runs at a pace the eye can follow: walks slowest, nights go by", () => {
  const walking = livedSpeed(true, false, false),
    settled = livedSpeed(false, false, false),
    quick = livedSpeed(false, false, true),
    asleep = livedSpeed(false, true, false);
  assert.ok(walking < settled, "a walk is seen");
  assert.ok(settled < quick, "quick is quicker");
  assert.ok(quick < asleep, "the night goes by");
  // (Quick or not, a walk is seen.)
  assert.equal(livedSpeed(true, false, true), walking);
  // A day at the plain pace is about two minutes.
  assert.ok(86_400 / settled > 90 && 86_400 / settled < 180, `${86_400 / settled} s a day`);
});
