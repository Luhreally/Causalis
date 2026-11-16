// The ground a battle is fought on, and how a host is fed to it (sim/war/ground.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { WAR_GROUND, warGroundOf, populationContext, supplyOf } from "../../src/sim/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("kestrel", 400, { start: "spread" }),
  ctx = populationContext(world),
  g = ctx.generated;

test("broken, watered and wooded ground favours those who hold it, open dry bare ground not at all", () => {
  let most = 1,
    least = Infinity;
  for (let c = 0; c < g.grid.count; c++) {
    if (g.tectonics.elevation[c]! <= 0) continue;
    const f = warGroundOf(ctx, c).factor;
    assert.ok(
      f >= 1 && f <= 1 + WAR_GROUND.broken + WAR_GROUND.woods + 4 * WAR_GROUND.river,
      `${f}`,
    );
    most = Math.max(most, f);
    least = Math.min(least, f);
  }
  assert.ok(most > 1.3, `the most broken ground gives ${most}`);
  assert.ok(least < most, "every land the same");
});

test("a host is fed the less the farther its bread is carried, never below what a starved host fights at", () => {
  // (A peopled land: one whose ground feeds someone, so a host there can take something of it.)
  const land = [...Array(g.grid.count).keys()].find(
      (c) => (ctx.provinces.get(c)?.total() ?? 0) > 0,
    )!,
    near = supplyOf(ctx, land, 0, 1e9),
    far = supplyOf(ctx, land, 2, 1e9),
    farthest = supplyOf(ctx, land, 1000, 1e9);
  assert.equal(near, 1);
  assert.ok(far < near && far > farthest, `${near} ${far} ${farthest}`);
  assert.ok(Math.abs(farthest - WAR_GROUND.starved) < 1e-3, `${farthest}`);
  // (A small host lives off the land it stands on, however far from home.)
  assert.ok(supplyOf(ctx, land, 1000, 10) > farthest);
});
