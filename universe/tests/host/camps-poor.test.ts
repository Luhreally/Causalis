import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { WATER } from "../../src/gen/index.ts";
import { ALIEN } from "../../src/host/planet.ts";
import { landSites, populationContext, provinceOfTile, regionOf } from "../../src/sim/index.ts";
import type { CampNear, LandPlan } from "../../src/bridge/index.ts";

// Phase 29 M160: a land whose ground is too poor for any village still has its bands camped about
// it — foragers need no field. A world never seen whose first land is so (its soil everywhere
// below what a village wants).

const world = ALIEN.build(seedFromText("violet hollow"));
world.runTo(YEAR / 8);
const ctx = populationContext(world),
  cell = [...ctx.provinces.all()].sort((a, b) => b.total() - a.total() || a.cell - b.cell)[0]!.cell,
  ask = <T>(type: string, args: unknown = {}) => ALIEN.queries[type]!(world, args) as T;

test("a land too poor for villages: its bands camped about its dry ground, and seen near", () => {
  assert.equal(landSites(ctx, cell).length, 0, "no ground for a village");
  const camps = ask<LandPlan>("towns.land", { cell }).camps,
    r = regionOf(ctx, cell);
  assert.ok(camps.length >= 3, `${camps.length} camps`);
  for (const c of camps) {
    assert.equal(r.water[c.tile], WATER.land, `camp ${c.id} on dry ground`);
    assert.equal(provinceOfTile(ctx, r, c.tile), cell, `camp ${c.id} in its land`);
  }
  const near = ask<CampNear>("camp.near", { cell, id: camps[0]!.id });
  assert.ok(near.figure && near.size >= 6, "a band of its own people to watch");
});
