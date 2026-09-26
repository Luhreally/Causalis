// Phase 1's budgets (docs/architecture §35, §37), as failing tests on the reference
// slice: a peopled world grown to 300 years (farming, villages, trade, metal, a
// market town) must run, save and show within these. The limits are several times
// what the reference machine measures, so they catch a regression, not noise; the
// phone floor is about four times slower again, and the worker keeps the page
// smooth while the world steps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { YEAR, rulesetId, saveWorld, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { makePopulationWorld } from "../../src/sim/index.ts";
import { observer } from "../../src/causal/index.ts";
import type { World } from "../../src/kernel/index.ts";
import { frameTransfer } from "../../src/bridge/index.ts";

type Budget = {
  /** The whole 300 years, built and run. */
  readonly runMs: number;
  /** The slowest single year (a province's first village refines its region). */
  readonly yearMs: number;
  /** The save, compressed. Phase 1's bar is 3 MB. */
  readonly saveBytes: number;
  /** What the globe frame carries across the worker boundary. */
  readonly globeBytes: number;
  /** A region frame. */
  readonly regionBytes: number;
  /** The microscope's plan of a village under the hand. */
  readonly planBytes: number;
};

function withinBudget(world: World, budget: Budget, label: string): void {
  const t0 = performance.now();
  let worst = 0,
    last = performance.now();
  for (let y = 1; y <= 300; y++) {
    world.runTo(y * YEAR);
    const now = performance.now();
    worst = Math.max(worst, now - last);
    last = now;
  }
  const ran = performance.now() - t0;
  assert.ok(ran < budget.runMs, `${label}: 300 years took ${ran.toFixed(0)} ms`);
  assert.ok(worst < budget.yearMs, `${label}: the slowest year took ${worst.toFixed(0)} ms`);

  const saved = gzipSync(JSON.stringify(saveWorld(world, rulesetId(world, "budget")))).length;
  assert.ok(saved < budget.saveBytes, `${label}: the save is ${saved} bytes`);

  const bytes = (frame: unknown) => {
    const f = frame as { arrays: Record<string, { byteLength: number }> };
    return Object.values(f.arrays).reduce((s, a) => s + a.byteLength, 0);
  };
  const globe = EARTH.frames.globe!(world, { view: "globe", focus: null });
  assert.ok(bytes(globe) < budget.globeBytes, `${label}: a globe frame is ${bytes(globe)} bytes`);
  assert.ok(frameTransfer(globe as never).length > 0, "its arrays travel without copying");
  const region = EARTH.frames.region!(world, { view: "region", focus: "cell:0:30210" });
  assert.ok(
    bytes(region) < budget.regionBytes,
    `${label}: a region frame is ${bytes(region)} bytes`,
  );

  const village = (EARTH.queries.settlements!(world, { cell: 30210 }) as { ref: string }[])[0]!.ref;
  world.submit("hand.lay", { village });
  world.runTo(301 * YEAR);
  const plan = JSON.stringify(EARTH.queries["village.plan"]!(world, { ref: village }));
  assert.ok(
    plan.length < budget.planBytes,
    `${label}: the plan under the hand is ${plan.length} bytes`,
  );
}

test("the Phase 1 slice (the cradle, 300 years) runs, saves and shows within its budgets", () => {
  // Measured: 0.75 s, slowest year 47 ms, save 0.15 MB.
  const world = makePopulationWorld(seedFromText("first light"));
  observer(world);
  withinBudget(
    world,
    {
      runMs: 6000,
      yearMs: 300,
      saveBytes: 3_000_000,
      globeBytes: 2_000_000,
      regionBytes: 1_500_000,
      planBytes: 400_000,
    },
    "cradle",
  );
});

test("the app's world (bands across the land, 300 years) runs, saves and shows within its budgets", () => {
  // Measured: 4.2 s, slowest year 116 ms, save 0.75 MB; 500 years saves 1.7 MB.
  withinBudget(
    EARTH.build(seedFromText("first light")),
    {
      runMs: 15_000,
      yearMs: 500,
      saveBytes: 3_000_000,
      globeBytes: 2_000_000,
      regionBytes: 1_500_000,
      planBytes: 400_000,
    },
    "spread",
  );
});
