// Phase 55 M225: a battle's roll, asked cold (no town's roster yet folded), within 30 ms — measured
// on the largest recent battle, the one whose men came from the most towns, as the median of five
// cold calls once the code is warm. Its cost is the rosters of the towns whose line holders fill its
// figures (host/roster.ts); the five largest are logged, their median and p90. (npm test runs
// tests/perf alone, after the rest.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { battleRoll } from "../../src/host/roll.ts";
import { clearRosters } from "../../src/host/roster.ts";
import { fellRows } from "../../src/rules/index.ts";
import { warsOf, type Battle } from "../../src/sim/index.ts";

/**
 * The most a cold roll of the largest recent battle may take (median of five), in ms: 30 on the
 * reference machine (the acceptance), twice that on CI's slower shared runners, as gate 5 allows.
 */
const ROLL_MS = process.env.CI ? 60 : 30;

const world = EARTH.build(seedFromText("first light"));
world.runTo(125 * YEAR);
const Y = Math.floor(world.now / YEAR);

/** The towns a battle's men came from, both sides. */
const townRows = (b: Battle) =>
  (b.fell ?? []).reduce((n, lands) => n + fellRows(lands).filter((r) => r.town !== null).length, 0);
const at = (xs: readonly number[], q: number) =>
  [...xs].sort((a, b) => a - b)[Math.floor(q * (xs.length - 1))]!;

test("a battle's roll is named within 30 ms, cold", () => {
  const recent = [...warsOf(world).all()]
    .flatMap((w) => w.battles)
    .filter((b) => b.fell && b.year >= Y - 5)
    .sort(
      (p, q) => townRows(q) - townRows(p) || (p.event < q.event ? -1 : p.event > q.event ? 1 : 0),
    );
  assert.ok(recent.length >= 6, `${recent.length} recent battles`);
  // Warm up on another battle, then the five largest, the largest last: each five times cold.
  clearRosters();
  battleRoll(world, recent[5]!.event, 360);
  const all: number[] = [],
    medians: string[] = [];
  let largest = Infinity;
  for (const b of recent.slice(0, 5).reverse()) {
    const times: number[] = [];
    for (let k = 0; k < 5; k++) {
      clearRosters();
      const t = performance.now();
      battleRoll(world, b.event, 360);
      times.push(performance.now() - t);
    }
    all.push(...times);
    largest = at(times, 0.5);
    medians.push(`${b.event} (${townRows(b)} towns) ${largest.toFixed(1)} ms`);
  }
  console.log(
    `battle.roll cold, median of five: ${medians.join("; ")}. The five largest: median ${at(all, 0.5).toFixed(1)} ms, p90 ${at(all, 0.9).toFixed(1)} ms.`,
  );
  assert.ok(largest <= ROLL_MS, `the largest recent battle's roll took ${largest.toFixed(1)} ms`);
});
