// The planet's last gaps (2026-11-24): rings and worlds without a star, a locked world's two sides, air lost to the star's
// wind, the shield against its hard light, sea ice and the seas' salt, and the haze of what is burned.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RING, ringOf, rocheLimit, roguesAStar } from "../../src/rules/index.ts";

test("a ring is a moon inside its planet's Roche limit", () => {
  // Saturn (95 Earths, 9.14 radii): ice is torn within some 2.2 radii (its rings end at 2.3), rock only within 1.6.
  const ice = rocheLimit(95, 9.14, RING.ice),
    rock = rocheLimit(95, 9.14, RING.rock);
  assert.ok(ice > 2 && ice < 2.4 && rock < 1.8);
  // Earth would tear a rock moon within some three radii.
  assert.ok(Math.abs(rocheLimit(1, 1, RING.rock) - 2.96) < 0.1);
  const saturn = { mass: 95, radius: 9.14, icy: true };
  assert.equal(ringOf(saturn, [0.99, 0]), null);
  assert.equal(ringOf(saturn, [0, 0.9]), null);
  const ring = ringOf(saturn, [0, 0.1])!;
  assert.ok(ring.ice && ring.at < ring.roche && ring.inner < ring.outer);
  // A small rocky world seldom draws a moon in; a heavier, metal-rich star throws out more worlds.
  assert.equal(ringOf({ mass: 0.1, radius: 0.5, icy: false }, [0.02, 0]), null);
  assert.ok(roguesAStar(1, 0.3) > roguesAStar(1) && roguesAStar(1) > roguesAStar(0.3));
});
