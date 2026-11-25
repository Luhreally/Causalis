import { test } from "node:test";
import assert from "node:assert/strict";
import { HONOUR, honourOf, honourTerm, wordIn, wordKept } from "../../src/rules/index.ts";

// Honour (rules/honour.ts): what a realm's peers reckon its word worth from what they have seen of it.

test("nothing known of a realm, its honour is nothing; a word kept raises it, a word broken lowers it", () => {
  assert.equal(honourOf(0, 0), 0);
  assert.equal(honourTerm(0, 0), 0);
  assert.ok(honourOf(1, 0) > 0);
  assert.ok(honourOf(0, 1) < 0);
  assert.ok(honourOf(0, 3) < honourOf(0, 1));
  assert.ok(Math.abs(wordKept(3, 1) - 4 / 6) < 1e-12);
  assert.ok(honourTerm(0, 100) > -HONOUR.weighs && honourTerm(100, 0) < HONOUR.weighs);
});

test("one breach does not shame a realm; a second in a generation does; and it is forgotten", () => {
  assert.ok(wordKept(0, 1) >= HONOUR.line);
  assert.ok(wordKept(0, 2) < HONOUR.line);
  const later = wordIn({ kept: 0, broken: 2, at: 100 }, 100 + HONOUR.fade);
  assert.ok(Math.abs(later.broken - 1) < 1e-9);
  assert.ok(wordKept(later.kept, later.broken) >= HONOUR.line);
});
