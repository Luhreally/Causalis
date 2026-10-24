import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import type { PeoplesSky, SkyState, SystemPlan } from "../../src/bridge/index.ts";
import {
  HOME_DISTANCE,
  bodyFacts,
  orbitRings,
  peopleSystemMarks,
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

test("the peoples of other stars about a system: their worlds, their craft by their age, their ships in and out", () => {
  const spots = systemSpec(plan, 0),
    peoples: PeoplesSky = {
      home: "star:0:0",
      civs: [
        {
          ref: "civ:0:1",
          name: "the Kaari",
          kind: "trunked giants",
          star: "star:3:7",
          color: [1, 0.4, 0.8],
          world: 2,
          electronics: -900,
          orbit: -800,
          stars: -500,
          holds: [
            { star: "star:3:7", year: -500, taken: false, world: 2 },
            { star: "star:3:9", year: -200, taken: false, world: 1 },
          ],
        },
        {
          ref: "civ:0:2",
          name: "the Ulo",
          kind: "rafted swimmers",
          star: "star:4:1",
          color: [0.3, 1, 0.6],
          world: 0,
          electronics: 40,
          orbit: 90,
          stars: 300,
          holds: [{ star: "star:4:1", year: 0, taken: false, world: 0 }],
        },
      ],
      ships: [
        {
          civ: "civ:0:1",
          kind: "envoys",
          from: "star:3:7",
          to: "star:0:0",
          sailed: 20,
          arrives: 60.5,
          event: "ev:0:5",
        },
        {
          civ: "civ:0:1",
          kind: "settlers",
          from: "star:3:7",
          to: "star:5:2",
          sailed: 59.6,
          arrives: 120,
          event: "ev:0:6",
        },
      ],
      meetings: [
        {
          civ: "civ:0:1",
          other: "pol:0:1",
          with: "realm",
          otherName: "the chiefdom of A",
          star: "star:0:0",
          year: 30,
          theirs: "trade",
          ours: "wonder",
          regard: 0.4,
          talking: true,
          exchanges: 2,
          raids: 0,
          last: 55,
          event: "ev:0:3",
        },
      ],
      raids: [],
      landings: [],
    };
  // Their own system: their world ringed wide, five satellites and two stations (long at the
  // stars), ships plying, and settlers in their first year out with the way they came.
  const own = peopleSystemMarks(peoples, "star:3:7", spots, 60, 3);
  assert.equal(own.rings.length, 1);
  assert.equal(own.rings[0]!.own, true);
  assert.ok(Math.hypot(own.rings[0]!.x - spots[2]!.x, own.rings[0]!.z - spots[2]!.z) < 1e-9);
  assert.equal(own.craft.length, 7);
  const out = own.ships.filter((s) => s.course);
  assert.equal(out.length, 1, "the settlers setting out");
  assert.equal(out[0]!.ref, "ev:0:6");
  assert.ok(own.ships.filter((s) => !s.course).length >= 3, "their ships plying");
  assert.match(own.names[0]!.text, /the Kaari/);
  // A star they hold: one ring, a satellite and a station.
  const held = peopleSystemMarks(peoples, "star:3:9", spots, 60, 3);
  assert.equal(held.rings.length, 1);
  assert.equal(held.rings[0]!.own, false);
  assert.equal(held.craft.length, 2);
  // A people not yet in orbit has nothing about its world.
  const young = peopleSystemMarks(peoples, "star:4:1", spots, 60, 3);
  assert.equal(young.rings.length, 1);
  assert.equal(young.craft.length, 0);
  assert.equal(young.ships.length, 0);
  // The home system: their envoys in their last year in, named; their embassy about home.
  const home = peopleSystemMarks(peoples, "star:0:0", spots, 60, 3);
  assert.equal(home.rings.length, 0);
  const envoys = home.ships.find((s) => s.ref === "ev:0:5")!;
  assert.ok(envoys, "the envoys coming in");
  assert.ok(
    Math.hypot(envoys.x - spots[0]!.x, envoys.z - spots[0]!.z) <
      Math.hypot(envoys.fromX - spots[0]!.x, envoys.fromZ - spots[0]!.z),
    "nearer home than where they came in",
  );
  assert.ok(home.names.some((n) => n.key === "ship:ev:0:5"));
  assert.equal(home.craft.length, 1, "their embassy about the home world");
  assert.ok(
    Math.hypot(home.craft[0]!.x - spots[0]!.x, home.craft[0]!.z - spots[0]!.z) < 1,
    "about the home world",
  );
  // A year earlier the envoys were not yet in the system.
  assert.equal(peopleSystemMarks(peoples, "star:0:0", spots, 58, 3).ships.length, 0);
});
