import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFENCE,
  coverBuilt,
  deadUnderCover,
  defenceFade,
  defenceWorth,
} from "../../src/rules/index.ts";

// Civil defence (rules/civildefence.ts): cover for a struck realm's townspeople, weighed from what the strikes cost it.

test("cover is worth its work only where the strikes it met killed enough, and the more for a longer-lived people", () => {
  assert.equal(defenceWorth(0, 70).worth, 0);
  assert.ok(defenceWorth(0.00005, 70).worth < 1, "a raid that killed one in twenty thousand");
  assert.ok(defenceWorth(0.005, 70).worth > 1, "raids that killed one in two hundred");
  assert.ok(defenceWorth(0.001, 200).worth > defenceWorth(0.001, 40).worth);
});

test("none is built while it is not worth it; past that, more the more it is, as far as the seat's will is done", () => {
  assert.equal(coverBuilt(0.9, 1), 0);
  assert.ok(coverBuilt(4, 0.8) > coverBuilt(2, 0.8));
  assert.ok(coverBuilt(4, 0.8) > coverBuilt(4, 0.3));
  assert.ok(coverBuilt(1e6, 1) <= 1);
});

test("cover spares its share of those a strike would kill, and what was met fades", () => {
  assert.equal(deadUnderCover(1000, 0), 1000);
  assert.equal(deadUnderCover(1000, 1), Math.round(1000 * (1 - DEFENCE.spares)));
  assert.ok(Math.abs(defenceFade(100, DEFENCE.fade) - 50) < 1e-9);
  assert.equal(defenceFade(100, 0), 100);
});
