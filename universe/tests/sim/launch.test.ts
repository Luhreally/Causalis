import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { generateHomeWorld } from "../../src/gen/index.ts";
import {
  EARTHLIKE,
  LEAST_FRACTION,
  launcherFor,
  payloadFraction,
  toOrbit,
} from "../../src/rules/index.ts";

const knowing =
  (...ids: string[]) =>
  (id: string) =>
    ids.includes(id);

test("the speed to orbit is the world's own: about 9.4 km/s from the home world, less from its moon", () => {
  const g = generateHomeWorld(seedFromText("first light"), EARTHLIKE),
    home = g.system.bodies[0]!,
    moon = g.system.bodies.find((b) => b.kind === "moon" && b.orbit.around === home.ref)!;
  const up = toOrbit(home);
  assert.ok(up.orbit > 7.6 && up.orbit < 8.3, `${up.orbit}`);
  assert.ok(up.total > 9 && up.total < 10, `${up.total}`);
  assert.ok(toOrbit(moon).total < 2.5);
});

test("the rocket equation: a faster exhaust or more stages lift more; nothing past what the frame allows", () => {
  assert.ok(payloadFraction(9.4, 4.3, 0.1, 2) > payloadFraction(9.4, 3.1, 0.1, 2));
  assert.ok(payloadFraction(9.4, 3.1, 0.1, 3) > payloadFraction(9.4, 3.1, 0.1, 1));
  // A single stage of oil and air cannot reach orbit at all.
  assert.equal(payloadFraction(9.4, 3.1, 0.13, 1), 0);
});

test("a heavy world reaches orbit later: its speed is past what the first engines can give", () => {
  const home = toOrbit({ gravity: 1, radius: 1, pressure: 1 }).total,
    heavy = toOrbit({ gravity: 1.6, radius: 1.3, pressure: 1 }).total,
    first = knowing("rocketry", "engines", "steel"),
    better = knowing("rocketry", "engines", "steel", "electronics");
  // The first engines lift from the home world, not from the heavy one.
  assert.ok(launcherFor(first, home));
  assert.equal(launcherFor(first, heavy), null);
  // Water parted by current lifts from both, at a cost the heavier pull raises.
  const light = launcherFor(better, home)!,
    hard = launcherFor(better, heavy)!;
  assert.equal(hard.propulsion.id, "parted-water");
  assert.ok(hard.cost > 2 * light.cost);
  assert.ok(hard.fraction >= LEAST_FRACTION);
  // Without rocketry nothing flies.
  assert.equal(launcherFor(knowing("engines", "steel"), home), null);
});

test("a people of the water reaches orbit by its own road: current-refined frames, parted water", () => {
  const l = launcherFor(knowing("rocketry", "electronics", "refined-metals"), 9.4)!;
  assert.equal(l.propulsion.id, "parted-water");
  assert.equal(l.frame.id, "refined-frame");
});
