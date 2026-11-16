// Round D: kinds branch where a stock is cut off and pressed, by its generations; on small lands the large grow smaller
// and the small larger; parasites persist only past their hosts' threshold density, cleaners keep them down.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  divergence,
  generationYears,
  islandSize,
  parasiteLoad,
  parasiteToll,
} from "../../src/rules/index.ts";

test("a small beast's generations are short, so it goes apart sooner; pressure drives it faster", () => {
  assert.ok(generationYears(1) < generationYears(500));
  assert.ok(divergence(1, 0, 0) > divergence(500, 0, 0));
  assert.ok(divergence(10, 1, 2) > divergence(10, 0, 0));
  // (A rabbit-sized beast cut off and unpressed: some thousands of years.)
  const years = 1 / divergence(2, 0, 0);
  assert.ok(years > 1500 && years < 10000, `${years}`);
});

test("Foster's rule: the large grow smaller on a small land, the small larger", () => {
  assert.equal(islandSize(800, 5000, false).how, "smaller");
  assert.ok(islandSize(800, 5000, false).size < islandSize(800, 300000, false).size);
  assert.equal(islandSize(1, 5000, false).how, "larger");
});

test("parasites persist only past a threshold density, and cleaners raise it", () => {
  assert.equal(parasiteLoad(10, 15, 0), 0);
  assert.ok(parasiteLoad(60, 15, 0) > 0.7);
  assert.ok(parasiteLoad(60, 15, 0.5) < parasiteLoad(60, 15, 0));
  assert.ok(parasiteToll(0.8, 1000) > 0 && parasiteToll(0, 1000) === 0);
});
