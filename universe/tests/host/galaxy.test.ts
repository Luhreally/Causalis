import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import type {
  ClusterPlan,
  ClusterStar,
  GalaxyPlan,
  PageModel,
  StarPage,
  SystemPlan,
  WorldGlobe,
} from "../../src/bridge/index.ts";
import { GALAXY_LY, galaxyPoints, homeOf, lyFromHome, starWords } from "../../src/view/index.ts";

const world = EARTH.build(seedFromText("first light"));
world.runTo(2 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;

test("the galaxy's shape: a disk with its arms, home out from the middle, drawn as its numbers say", () => {
  const plan = ask<GalaxyPlan>("galaxy.plan");
  assert.ok(plan.radius >= 40_000 && plan.radius <= 70_000);
  assert.ok(plan.arms >= 2 && plan.arms <= 4);
  assert.ok(plan.homeRadius > 0.4 * plan.radius && plan.homeRadius < 0.7 * plan.radius);
  const a = galaxyPoints(plan, 4000),
    b = galaxyPoints(plan, 4000);
  assert.deepEqual(a.positions, b.positions, "the same look every time");
  const R = plan.radius / GALAXY_LY;
  let inner = 0;
  for (let i = 0; i < a.count; i++) {
    const r = Math.hypot(a.positions[3 * i]!, a.positions[3 * i + 2]!);
    assert.ok(r <= R * 1.01, "within the disk");
    if (r < R / 4) inner++;
  }
  assert.ok(inner > a.count / 3, "crowded toward the middle");
  const home = homeOf(plan),
    at = lyFromHome(plan, home.x, home.z);
  assert.ok(Math.abs(at.x) < 1e-6 && Math.abs(at.y) < 1e-6, "home is where home is");
});

test("a tap anywhere finds the real stars there, and each can be opened again by its name, near or far", () => {
  const before = JSON.stringify(world.domainHashes());
  const plan = ask<GalaxyPlan>("galaxy.plan"),
    // Out toward the galaxy's middle, thousands of light-years from home.
    far = ask<ClusterStar[]>("galaxy.near", {
      x: -plan.homeRadius * 0.5 * Math.cos(plan.homeAngle),
      y: -plan.homeRadius * 0.5 * Math.sin(plan.homeAngle),
    });
  assert.ok(far.length >= 1 && far.length <= 12, `${far.length} stars found far out`);
  assert.ok(
    far.every((s, i) => i === 0 || far[i - 1]!.luminosity >= s.luminosity),
    "brightest first",
  );
  assert.ok(far[0]!.distance > 5000);
  for (const s of far.slice(0, 3)) {
    const page = ask<StarPage>("galaxy.star", { ref: s.ref });
    assert.equal(page.ref, s.ref);
    assert.equal(page.planets, page.worlds.length);
    assert.equal(page.mass, s.mass, "the same star found again");
  }
  // The cluster's own stars open as before.
  const cluster = ask<ClusterPlan>("galaxy.cluster"),
    near = cluster.stars.find((s) => s.planets > 0)!;
  assert.equal(ask<StarPage>("galaxy.star", { ref: near.ref }).worlds.length, near.planets);
  assert.match(starWords(near), /dwarf|star/);
  // Any of their worlds is made whole: the same world each time, kept.
  const withWorlds = far.find((s) => s.planets > 0) ?? near,
    one = ask<WorldGlobe>("world.globe", { star: withWorlds.ref, index: 0 }),
    two = ask<WorldGlobe>("world.globe", { star: withWorlds.ref, index: 0 });
  assert.equal(one, two);
  assert.equal(one.elevation.length, one.cover.length);
  assert.equal(JSON.stringify(world.domainHashes()), before, "looking changes nothing");
});

test("another star's own system: its worlds on their orbits, each the world its page names", () => {
  const before = JSON.stringify(world.domainHashes());
  const cluster = ask<ClusterPlan>("galaxy.cluster"),
    near = cluster.stars.find((s) => s.distance > 0 && s.planets > 1)!,
    page = ask<StarPage>("galaxy.star", { ref: near.ref }),
    plan = ask<SystemPlan>("galaxy.system", { ref: near.ref });
  assert.equal(plan.star.ref, near.ref);
  assert.equal(plan.star.mass, page.mass, "its own star");
  assert.equal(plan.bodies.length, page.worlds.length, "every world its page tells of");
  assert.ok(Math.abs(plan.frostLine - 2.7 * Math.sqrt(page.luminosity)) < 1e-9);
  plan.bodies.forEach((b, i) => {
    assert.equal(b.ref, `${near.ref}/${i}`, "each the world its page names");
    assert.equal(b.around, -1, "about the star");
    assert.equal(b.a, page.worlds[i]!.a, "on its own orbit");
    assert.equal(b.kind, page.worlds[i]!.kind);
    assert.ok(i === 0 || b.a > plan.bodies[i - 1]!.a, "outward in turn");
    assert.equal(ask<PageModel>("page", { ref: b.ref }).kind, "world", "its page, a world's");
  });
  // Spread about the star, not in a line.
  assert.equal(new Set(plan.bodies.map((b) => b.phase.toFixed(3))).size, plan.bodies.length);
  assert.deepEqual(ask<SystemPlan>("galaxy.system", { ref: near.ref }), plan, "the same each time");
  assert.equal(JSON.stringify(world.domainHashes()), before, "looking changes nothing");
});

test("what lives on other worlds: each world's life told, its bodies and its small lives shown, by either name of its star", async () => {
  const { civilizationsNear } = await import("../../src/sim/index.ts"),
    { lifeOfWorld } = await import("../../src/host/elsewhere.ts"),
    { starByRef } = await import("../../src/host/galaxy.ts");
  const before = JSON.stringify(world.domainHashes()),
    cluster = ask<ClusterPlan>("galaxy.cluster");
  // A world with bodies, and a lifeless one.
  let living: string | null = null,
    dead: string | null = null;
  for (const s of cluster.stars) {
    const star = starByRef(world, s.ref);
    for (let i = 0; i < s.planets && (!living || !dead); i++) {
      const level = lifeOfWorld(world, star, i).level;
      if (level === "bodies" && !living) living = `${s.ref}/${i}`;
      if (level === "none" && !dead) dead = `${s.ref}/${i}`;
    }
    if (living && dead) break;
  }
  assert.ok(living && dead, "a world with bodies, and a lifeless one");
  const page = ask<PageModel>("page", { ref: living }),
    life = page.tabs.find((t) => t.id === "life");
  assert.ok(life, "a living world's page tells its life");
  const lineup = life.blocks.find((b) => b.type === "lineup"),
    drop = life.blocks.find((b) => b.type === "drop");
  assert.ok(lineup && lineup.type === "lineup" && lineup.items.every((x) => x.body && !x.ref));
  assert.ok(drop && drop.type === "drop" && drop.kinds.every((k) => !k.ref));
  const lifeless = ask<PageModel>("page", { ref: dead });
  assert.ok(!lifeless.tabs.some((t) => t.id === "life"), "a lifeless world has no life to tell");
  assert.equal(String(lifeless.stats.find((s) => s.label === "Life")!.value), "lifeless");
  // A people's world, found by the far name of its star, still has its people.
  const civ = civilizationsNear(world)[0];
  if (civ) {
    const [, sector, k] = civ.star.split(":").map(Number),
      far = ask<{ ref: string }[]>("galaxy.near", { x: 0, y: 0 }).find((s) => {
        const st = starByRef(world, s.ref);
        return st.sector === sector && st.k === k;
      });
    if (far) {
      const globe = ask<WorldGlobe>("world.globe", { star: far.ref, index: civ.planet });
      assert.ok(globe.people, "a people's world, by either name");
      assert.equal(globe.life, "people");
    }
  }
  // The home star's other worlds: each tells its life.
  const plan = ask<SystemPlan>("planet.system");
  for (const b of plan.bodies.slice(1, 6)) {
    const p = ask<PageModel>("page", { ref: b.ref });
    assert.ok(
      p.stats.some((s) => s.label === "Life"),
      `${b.ref} tells its life`,
    );
  }
  assert.equal(JSON.stringify(world.domainHashes()), before, "looking changes nothing");
});
