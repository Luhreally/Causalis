import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import type { ClusterPlan, StarPage } from "../../src/bridge/index.ts";
import {
  LY_SCALE,
  clusterSpec,
  clusterWords,
  starColor,
  voyageMarks,
} from "../../src/view/index.ts";

const world = EARTH.build(seedFromText("first light")),
  plan = EARTH.queries["galaxy.cluster"]!(world, {}) as ClusterPlan;

test("the observatory reads the cluster: every star where it lies, its worlds counted", () => {
  assert.equal(plan.radius, 50);
  assert.ok(plan.stars.length > 1500);
  assert.ok(plan.stars.every((s) => s.distance <= 50 && s.ref.startsWith("star:")));
  // A star's page holds the very worlds the cluster counted.
  const withWorlds = plan.stars.find((s) => s.planets > 0)!,
    page = EARTH.queries["galaxy.star"]!(world, { ref: withWorlds.ref }) as StarPage;
  assert.equal(page.worlds.length, withWorlds.planets);
  assert.equal(page.worlds.filter((w) => w.water === "seas").length, withWorlds.seas);
  assert.match(clusterWords(plan)[0]!, /stars within 50 light-years/);
});

test("the stars are drawn where they lie, coloured by their warmth", () => {
  const groups = clusterSpec(plan),
    drawn = groups.reduce((n, g) => n + g.stars.length, 0);
  assert.equal(drawn, plan.stars.length);
  for (const g of groups)
    for (const s of g.stars) {
      const star = plan.stars[s.index]!;
      assert.ok(
        Math.abs(s.x - star.x * LY_SCALE) < 1e-9 && Math.abs(s.y - star.z * LY_SCALE) < 1e-9,
      );
    }
  assert.notDeepEqual(
    starColor({ temperature: 3000, remnant: false }),
    starColor({ temperature: 9000, remnant: false }),
  );
});

test("a ship is drawn along its way, as far as its crossing has come; a star it came down at is ringed", () => {
  const star = plan.stars[3]!,
    ship = {
      cell: 4100,
      star: star.ref,
      distance: star.distance,
      departed: 1400,
      arrives: 1500,
      people: 500,
      realm: "A",
      voyage: "ev:0:1",
    },
    half = voyageMarks(
      plan,
      { programs: [], colonies: [], ships: [{ ...ship, arrived: false }] },
      1450,
    ),
    there = voyageMarks(
      plan,
      { programs: [], colonies: [], ships: [{ ...ship, arrived: true }] },
      1510,
    );
  assert.equal(half.ships.length, 1);
  assert.ok(Math.abs(half.ships[0]!.x - star.x * LY_SCALE * 0.5) < 1e-9);
  assert.equal(there.ships.length, 0);
  assert.equal(there.rings.length, 1);
});
