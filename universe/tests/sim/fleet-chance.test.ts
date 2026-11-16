// A people's fleets (sim/space/peoples.ts fleetChance): its will shapes who sends one and when, not how many go in all.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FLEET_WILL_MEAN, WAR_REGARD, fleetChance } from "../../src/sim/index.ts";

test("a fleet goes as readily as of old at the old line with the mean will, less the less ill the regard, none while it is well", () => {
  const bold = 0.5;
  assert.ok(Math.abs(fleetChance(bold, WAR_REGARD, FLEET_WILL_MEAN) - 0.03 * (0.5 + bold)) < 1e-12);
  assert.equal(fleetChance(bold, 0.1, 1), 0, "none toward one it regards well");
  assert.equal(fleetChance(bold, -0.9, 0), 0, "none without an aim worth one");
  assert.ok(fleetChance(bold, -0.1, FLEET_WILL_MEAN) < fleetChance(bold, -0.2, FLEET_WILL_MEAN));
  assert.ok(
    fleetChance(bold, -0.5, FLEET_WILL_MEAN) === fleetChance(bold, WAR_REGARD, FLEET_WILL_MEAN),
  );
  assert.ok(
    fleetChance(bold, WAR_REGARD, 2 * FLEET_WILL_MEAN) >
      fleetChance(bold, WAR_REGARD, FLEET_WILL_MEAN),
  );
  assert.ok(fleetChance(1, -1, 1) <= 1);
});
