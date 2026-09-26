// The north-star scenario (docs/architecture §13, §35): generate a universe, meet
// a random, unimportant citizen of a grown people, tell their life to D4, and walk
// "why?" from one of their memories until it reaches a fact the planet's generator
// made. The walk must cross at least four domains, and every hop that mattered
// (importance 3 and up) must be on the record — recorded or generated, never
// guessed or forgotten. (The walk itself is src/causal/north-star.ts; the Phase 3
// gate walks the Earth seed's industrial age the same way.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { makePopulationWorld } from "../../src/sim/index.ts";
import { northStar } from "../../src/causal/index.ts";

test("north star: a grown citizen's memory leads across four domains to the planet, all on the record", () => {
  const world = makePopulationWorld(seedFromText("first light"));
  world.runTo(300 * YEAR);
  const star = northStar(world, 300);
  assert.ok(star.citizens.length >= 12, `${star.citizens.length} grown citizens with memories`);
  assert.deepEqual(star.problems, []);
  // Between them, the citizens' memories reach every part of the slice.
  for (const d of ["observer", "people", "weather", "knowledge", "planet"])
    assert.ok(star.crossed.has(d), `some walk crosses ${d}: ${[...star.crossed].join(", ")}`);
});
