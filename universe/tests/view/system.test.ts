import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import type { SystemPlan } from "../../src/bridge/index.ts";
import {
  HOME_DISTANCE,
  bodyFacts,
  orbitRings,
  systemExtent,
  systemSpec,
} from "../../src/view/index.ts";

const plan = EARTH.queries["planet.system"]!(
  EARTH.build(seedFromText("first light")),
  {},
) as SystemPlan;

test("the observatory reads the star's system: every body, its orbit and its reasons", () => {
  assert.equal(
    plan.bodies.length,
    plan.bodies.filter((b) => b.around < 0).length +
      plan.bodies.filter((b) => b.around >= 0).length,
  );
  assert.equal(plan.bodies[0]!.kind, "home");
  assert.ok(plan.bodies.every((b) => b.because.length > 0));
  // Every moon circles a planet that is in the plan.
  for (const b of plan.bodies)
    if (b.kind === "moon") assert.ok(plan.bodies[b.around] && plan.bodies[b.around]!.around === -1);
  assert.match(bodyFacts(plan.bodies[0]!, plan.star)[0]!, /AU from the star/);
});

test("the system is drawn to fit: the home world at its distance, moons by their planets, rings closed", () => {
  for (const t of [0, 1e7, 5e9]) {
    const spots = systemSpec(plan, t),
      home = spots[0]!;
    // The home world's orbit is nearly round: it is drawn about its distance out.
    assert.ok(Math.abs(Math.hypot(home.x, home.z) - HOME_DISTANCE) < 0.3);
    for (const [i, b] of plan.bodies.entries()) {
      if (b.around < 0) continue;
      const s = spots[i]!,
        p = spots[b.around]!;
      assert.ok(Math.hypot(s.x - p.x, s.z - p.z) < 2, `${b.designation} beside its planet`);
    }
    for (const s of spots) assert.ok(Math.hypot(s.x, s.z) <= systemExtent(plan) + 2);
  }
  const rings = orbitRings(plan);
  assert.equal(rings.length, plan.bodies.filter((b) => b.around < 0).length);
});
