// Round D: kinds branch where a stock is cut off and pressed, by its generations; on small lands the large grow smaller
// and the small larger; parasites persist only past their hosts' threshold density, cleaners keep them down.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BARRIERS,
  ISOLATES,
  SELECTION,
  apartness,
  divergence,
  generationYears,
  islandSize,
  migrated,
  parasiteLoad,
  parasiteToll,
  selected,
  traitFit,
  traitsAsked,
  waryEscape,
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

test("the breeder's equation: a stock's mean goes toward what its land asks by h²/(1 + ω²) of the gap a generation", () => {
  const k = SELECTION.heritability[0]! / (1 + SELECTION.width);
  assert.ok(Math.abs(selected(0, 2, 1, 0) - 2 * k) < 1e-12);
  assert.ok(Math.abs(selected(0, 2, 10, 0) - 2 * (1 - (1 - k) ** 10)) < 1e-9);
  assert.equal(selected(1.5, 1.5, 100, 2), 1.5, "nothing asked of it, nothing moves");
  // Behaviour is passed on least: wariness answers slower than size.
  assert.ok(selected(0, 2, 10, 2) < selected(0, 2, 10, 0));
  // (A 300 kg grazer, hunted to nothing, five centuries: about a spread and a half warier.)
  const gens = 500 / generationYears(300),
    wary = selected(0, traitsAsked(0, 1)[2], gens, 2);
  assert.ok(wary > 1 && wary < 2.5, `${wary}`);
});

test("what a land asks: the cold a thicker coat and a larger body, a hunt a warier and a smaller one", () => {
  const [size, coat, wary] = traitsAsked(8, 0);
  assert.ok(coat > size && size > 0 && wary === 0);
  const hunted = traitsAsked(0, 1);
  assert.ok(hunted[0] < 0 && hunted[1] === 0 && hunted[2] > 0);
  assert.ok(traitsAsked(100, 1).every((x) => Math.abs(x) <= SELECTION.most));
});

test("how a stock fares: as made where it fits as it did; the worse the gap has grown, the fewer; the wary escape the hunt", () => {
  assert.equal(traitFit(1, 1), 1);
  assert.ok(traitFit(2, 0) < traitFit(1, 0) && traitFit(1, 0) < 1);
  assert.ok(traitFit(0, 2) > 1, "a stock come to fit better than as made fares better");
  assert.equal(waryEscape(0), 0);
  assert.ok(waryEscape(3) === SELECTION.escape && waryEscape(1.5) < SELECTION.escape);
});

test("what crosses a barrier pulls a parted stock back; drift and selection together make a kind of its own", () => {
  assert.ok(Math.abs(migrated(2, 0, 0.1, 1) - 1.8) < 1e-12);
  assert.ok(migrated(2, 0, BARRIERS.heights, 100) > migrated(2, 0, BARRIERS.river, 100));
  // (Selected 2 spreads apart against what crosses a range of heights, a stock settles where the two balance.)
  let z = 0;
  for (let g = 0; g < 2000; g++) z = migrated(selected(z, 2, 1, 1), 0, BARRIERS.heights, 1);
  const k = SELECTION.heritability[1]! / (1 + SELECTION.width);
  assert.ok(Math.abs(z - (2 * k) / (k + BARRIERS.heights)) < 0.05, `${z}`);
  // A parted stock drifts slower than an island's (what crosses mixes some back), and selection held apart speeds it.
  assert.ok(Math.abs(apartness(200, 0, 0, 0) - ISOLATES.drift * divergence(200, 0, 0)) < 1e-15);
  assert.ok(apartness(200, 2, 0, 0) > 10 * apartness(200, 0, 0, 0));
  // (A 200 kg grazer held two spreads apart: a kind of its own in some centuries; one spread, a couple of thousand years.)
  const years = (gap: number) => 1 / apartness(200, gap, 0, 0);
  assert.ok(years(2) > 300 && years(2) < 1500, `${years(2)}`);
  assert.ok(years(1) > 1500, `${years(1)}`);
});
