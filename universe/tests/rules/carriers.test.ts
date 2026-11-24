// Plants an animal carries the pollen of (rules/crops.ts CARRIED): a harvest by its carriers' numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CARRIED, carriedYield, fruitSet } from "../../src/rules/index.ts";

test("every flower sets where the carriers stand as they did, none where they are gone, most at half", () => {
  assert.equal(fruitSet(1), 1);
  assert.equal(fruitSet(0), 0);
  assert.equal(fruitSet(1.3), 1);
  assert.ok(Math.abs(fruitSet(CARRIED.half) - (1 + CARRIED.half) / 2) < 1e-12);
  assert.ok(fruitSet(0.5) > 0.8, "the first carriers lost cost little");
  for (let c = 0.05; c <= 1; c += 0.05) assert.ok(fruitSet(c) > fruitSet(c - 0.05));
});

test("a harvest loses its carried share and no more; one that waits on no carrier loses nothing", () => {
  assert.equal(carriedYield(CARRIED.garden, 1), 1);
  assert.equal(carriedYield(0, 0), 1);
  assert.ok(Math.abs(carriedYield(CARRIED.garden, 0) - (1 - CARRIED.garden)) < 1e-12);
  assert.ok(Math.abs(carriedYield(CARRIED.wild, 0) - (1 - CARRIED.wild)) < 1e-12);
  assert.ok(carriedYield(CARRIED.garden, 0.3) < carriedYield(CARRIED.wild, 0.3));
  // Told once the cut is felt: a garden's at about half its carriers, the wild's food when they are nearly gone.
  assert.ok(carriedYield(CARRIED.garden, 0.6) >= CARRIED.told);
  assert.ok(carriedYield(CARRIED.garden, 0.4) < CARRIED.told);
  assert.ok(carriedYield(CARRIED.wild, 0.15) < CARRIED.told);
});
