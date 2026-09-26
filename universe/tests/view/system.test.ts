import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import type { SkyState, SystemPlan } from "../../src/bridge/index.ts";
import {
  HOME_DISTANCE,
  bodyFacts,
  orbitRings,
  skyMarks,
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

test("the marks of flight and settlement: a ring on each settled body, satellites and stations about home", () => {
  const spots = systemSpec(plan, 0),
    moon = plan.bodies.findIndex((b) => b.kind === "moon" && b.around === 0),
    sky: SkyState = {
      programs: [
        { realm: "pol:0:1", name: "A", satellite: 1000, crew: 1050, station: 1100, colonies: 1 },
        { realm: "pol:0:2", name: "B", satellite: 1010, crew: null, station: null, colonies: 0 },
      ],
      colonies: [
        {
          cell: 4011,
          body: moon,
          site: 0,
          people: 500,
          fed: 1000,
          realm: "A",
          founder: "A",
          founded: 1200,
          event: null,
        },
      ],
    },
    m = skyMarks(sky, spots, 5e8);
  assert.equal(m.rings.length, 1);
  assert.ok(Math.hypot(m.rings[0]!.x - spots[moon]!.x, m.rings[0]!.z - spots[moon]!.z) < 1e-9);
  assert.equal(m.satellites.length, 2);
  assert.equal(m.stations.length, 1);
  for (const s of [...m.satellites, ...m.stations])
    assert.ok(Math.hypot(s.x - spots[0]!.x, s.z - spots[0]!.z) < 1, "about the home world");
});
