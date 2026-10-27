import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { spotRef } from "../../src/gen/index.ts";
import { why } from "../../src/causal/index.ts";
import { homePlanet } from "../../src/sim/index.ts";

// A spot of the fine grid is told from the fine grid: its ground, its warmth and its rain, however
// far past the provinces' count it lies (Phase 56 read them from the provinces' arrays, so a land
// chosen on the globe had no why: its warmth was undefined).

test("a fine spot's ground is told from the fine grid, wherever it lies", () => {
  const world = EARTH.build(seedFromText("first light")),
    pw = homePlanet(world).generated,
    count = pw.fine.grid.count;
  assert.ok(count > 2 * pw.grid.count, `${count} fine spots, ${pw.grid.count} provinces`);
  for (const c of [0, pw.grid.count + 7, 20000, count - 1]) {
    const claim = why(world, spotRef(0, c)).claim;
    assert.match(
      claim,
      /: -?\d+ m (above|below) the sea, -?\d+ °C, \d+ mm of rain a year/,
      `${c}: ${claim}`,
    );
  }
});
