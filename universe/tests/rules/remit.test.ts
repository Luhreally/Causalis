import { test } from "node:test";
import assert from "node:assert/strict";
import { REMIT, remitTie, remitted } from "../../src/rules/index.ts";

// Guests' pay sent home (rules/remit.ts): by the wage gap, the years since they came, and the gates between.

test("nothing is sent where a year's work is worth no more there than at home, or no more than a guest's keep", () => {
  assert.equal(remitted(1000, 20, 20, 12, 1, 1), 0);
  assert.equal(remitted(1000, 18, 20, 12, 1, 1), 0);
  assert.equal(remitted(1000, 12, 8, 12, 1, 1), 0);
});

test("a share of what a guest earns above his keep goes home; shut gates and long years abroad cut it", () => {
  const open = remitted(1000, 30, 15, 12, 1, 1);
  assert.ok(Math.abs(open - 1000 * 18 * REMIT.sent) < 1e-9);
  assert.ok(remitted(1000, 30, 15, 12, 1, 0.3) < open);
  assert.equal(remitted(1000, 30, 15, 12, 1, 0), 0);
  assert.ok(remitted(1000, 30, 15, 12, 0.4, 1) < open);
});

test("those who came send less each year, and their children nothing after a generation", () => {
  assert.equal(remitTie(0, 25), 1);
  assert.ok(remitTie(10, 25) < 1 && remitTie(10, 25) > 0);
  assert.equal(remitTie(25, 25), 0);
  assert.equal(remitTie(60, 25), 0);
});
