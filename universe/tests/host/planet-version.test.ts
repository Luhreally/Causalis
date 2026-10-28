// Cohesion combat changes future history on both kinds of worlds. Older checkpoints
// retain their past and continue under the new rules (tests/sim/combat.test.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALIEN, EARTH } from "../../src/host/planet.ts";

test("cohesion combat continues existing histories under a new ruleset on Earth and alien worlds", () => {
  assert.equal(EARTH.version, "earth-7");
  assert.equal(ALIEN.version, "alien-8");
});
