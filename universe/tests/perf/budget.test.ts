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
import { frameTransfer } from "../../src/bridge/index.ts";

const BUDGET = {
  /** The whole 300 years, built and run. Measured: ~1.2 s. */
  runMs: 6000,
  /** The slowest single year (a province's first village refines its region). Measured: ~47 ms. */
  yearMs: 300,
  /** The save, compressed. Phase 1's bar is 3 MB. Measured: ~0.15 MB. */
  saveBytes: 3_000_000,
  /** What the globe frame carries across the worker boundary. */
  globeBytes: 2_000_000,
  /** A region frame. */
  regionBytes: 1_500_000,
  /** The microscope's plan of a village under the hand. */
  planBytes: 400_000,
} as const;

test("the reference slice runs 300 years, saves and shows within Phase 1's budgets", () => {
  const t0 = performance.now(),
    world = EARTH.build(seedFromText("first light"));
  let worst = 0,
    last = performance.now();
  for (let y = 1; y <= 300; y++) {
    world.runTo(y * YEAR);
    const now = performance.now();
    worst = Math.max(worst, now - last);
    last = now;
  }
  const ran = performance.now() - t0;
  assert.ok(ran < BUDGET.runMs, `300 years took ${ran.toFixed(0)} ms`);
  assert.ok(worst < BUDGET.yearMs, `the slowest year took ${worst.toFixed(0)} ms`);

  const saved = gzipSync(JSON.stringify(saveWorld(world, rulesetId(world, "budget")))).length;
  assert.ok(saved < BUDGET.saveBytes, `the save is ${saved} bytes`);

  const bytes = (frame: unknown) => {
    const f = frame as { arrays: Record<string, { byteLength: number }> };
    return Object.values(f.arrays).reduce((s, a) => s + a.byteLength, 0);
  };
  const globe = EARTH.frames.globe!(world, { view: "globe", focus: null });
  assert.ok(bytes(globe) < BUDGET.globeBytes, `a globe frame is ${bytes(globe)} bytes`);
  assert.ok(frameTransfer(globe as never).length > 0, "its arrays travel without copying");
  const region = EARTH.frames.region!(world, { view: "region", focus: "cell:0:30210" });
  assert.ok(bytes(region) < BUDGET.regionBytes, `a region frame is ${bytes(region)} bytes`);

  const village = (EARTH.queries.settlements!(world, { cell: 30210 }) as { ref: string }[])[0]!.ref;
  world.submit("hand.lay", { village });
  world.runTo(301 * YEAR);
  const plan = JSON.stringify(EARTH.queries["village.plan"]!(world, { ref: village }));
  assert.ok(plan.length < BUDGET.planBytes, `the plan under the hand is ${plan.length} bytes`);
});
