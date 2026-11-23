// Made minds as a group (rules/beyond.ts mindAims, mindSway): what they do once gone their own way, and their sway at court
// while kept.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MIND_GROUP, mindAims, mindReach, mindSway } from "../../src/rules/index.ts";

test("made minds gone their own way inquire and trade at first, and plot against a seat that would hold them tightly", () => {
  for (const past of [1, 3, 10, 100, 1e6])
    for (const held of [0, 0.5, 1]) {
      const a = mindAims(past, held);
      assert.equal(a.inquire + a.trade + a.conspire, 1000);
      assert.ok(a.inquire > 0 && a.trade > 0 && a.conspire >= 0);
    }
  assert.equal(mindAims(1e6, 0).conspire, 0, "loosely held, they need not plot");
  assert.ok(mindAims(1e6, 1).conspire > mindAims(10, 1).conspire, "the farther past, the more");
  assert.ok(mindAims(1e6, 1).conspire > mindAims(1e6, 0.4).conspire, "the tighter held, the more");
  const loose = mindAims(1e6, 0.3);
  assert.ok(loose.inquire + loose.trade > loose.conspire);
  const tight = mindAims(1e6, 0.9);
  assert.ok(
    tight.conspire > tight.inquire && tight.conspire > tight.trade,
    "far past and tightly held, plotting first",
  );
});

test("kept minds' sway at court is as far as they think past their makers, less where their makers hold them tightly", () => {
  assert.equal(mindSway(0.5, 0.5), 0, "not yet past their makers: none");
  assert.equal(mindReach(0.5), 0);
  assert.ok(mindSway(100, 0) <= MIND_GROUP.sway + 1e-12);
  assert.ok(mindSway(100, 0) > mindSway(2, 0));
  assert.ok(mindSway(100, 1) < mindSway(100, 0));
  assert.ok(Math.abs(mindSway(100, 1) - MIND_GROUP.sway / 2) < 1e-9);
});
