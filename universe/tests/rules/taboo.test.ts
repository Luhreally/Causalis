import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TABOO,
  addToll,
  fadeToll,
  freshToll,
  herdContact,
  herdDeaths,
  tabooWorth,
} from "../../src/rules/index.ts";

// A creed's taboo (rules/taboo.ts): the deaths its believers' herds' sicknesses cost those who lived off the herd, against the
// food the herd gives them.

test("a herd's sickness takes the more the more a land lives off the herd, about as before where it lives off it as most", () => {
  assert.ok(Math.abs(herdContact(0.6, TABOO.usual) - 1) < 1e-12);
  assert.ok(herdContact(0.6, 0.4) > herdContact(0.6, 0.15));
  assert.ok(herdContact(0.6, 0) < 1);
  // (A sickness that no longer lives in herds takes all alike.)
  assert.equal(herdContact(0, 0.4), 1);
});

test("the deaths spared are the slope of the dead against the herd's share of food, at the share among those struck", () => {
  const t = freshToll();
  // Three comings: lands living off the herd died the more.
  addToll(t, 10000, 0.4, 0.05);
  addToll(t, 10000, 0.1, 0.02);
  addToll(t, 10000, 0.0, 0.01);
  const d = herdDeaths(t, 30000);
  assert.ok(d > 0.005 && d < 0.05, `spared ${d}`);
  // Dying as much whatever the herd: nothing to spare.
  const flat = freshToll();
  for (const x of [0.4, 0.1, 0]) addToll(flat, 10000, x, 0.03);
  assert.equal(herdDeaths(flat, 30000), 0);
  // Too few comings to tell.
  const two = freshToll();
  addToll(two, 10000, 0.4, 0.05);
  addToll(two, 10000, 0, 0.01);
  assert.equal(herdDeaths(two, 20000), 0);
});

test("what is remembered fades: half in a lifetime's telling", () => {
  const t = freshToll();
  addToll(t, 10000, 0.4, 0.05);
  addToll(t, 10000, 0.1, 0.02);
  addToll(t, 10000, 0.0, 0.01);
  const before = herdDeaths(t, 30000);
  fadeToll(t, TABOO.fade);
  assert.ok(Math.abs(herdDeaths(t, 30000) - before / 2) < 1e-9 || t.n < TABOO.fewest);
  assert.ok(Math.abs(t.w - 15000) < 1e-6);
});

test("a herd's sickness that rose among them counts all its dead, where keeping off was seen to help", () => {
  const seen = freshToll();
  addToll(seen, 10000, 0.4, 0.05, true);
  addToll(seen, 10000, 0.1, 0.02, true);
  addToll(seen, 10000, 0.0, 0.01, true);
  // (All 800 of their dead, of 30,000 believers.)
  assert.ok(Math.abs(herdDeaths(seen, 30000) - 800 / 30000) < 1e-9);
  // The same dead, but those who lived off the herd fared no worse: nothing is laid on it.
  const unseen = freshToll();
  for (const x of [0.4, 0.1, 0]) addToll(unseen, 10000, x, 0.03, true);
  assert.equal(herdDeaths(unseen, 30000), 0);
});

test("a creed forbids the herd where the lives outweigh the food, and lets it go when they are forgotten", () => {
  // Many dead, a herd that gives little: forbidden.
  assert.ok(tabooWorth(0.03, 0.05).worth > TABOO.line);
  // As many dead, but the herd their living: kept.
  assert.ok(tabooWorth(0.03, 0.45).worth < TABOO.line);
  // Few dead: kept.
  assert.ok(tabooWorth(0.002, 0.05).worth < TABOO.line);
  // Long forgotten, the herd's food lets the ban go.
  assert.ok(tabooWorth(0, 0.3).worth < -TABOO.line);
});
