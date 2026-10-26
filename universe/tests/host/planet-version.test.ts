// The rules each universe's saves are kept by (Phase 54 M222): a world of its own chemistry's
// history changed — its own showings, the heat its furnaces reach, arms of its own stuff — so its
// saves are of a new ruleset; Earth's history did not, and its saves stand.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALIEN, EARTH } from "../../src/host/planet.ts";

test("Earth's saves stand; a world of its own chemistry's are of its new rules", () => {
  assert.equal(EARTH.version, "earth-6");
  assert.equal(ALIEN.version, "alien-7");
});
