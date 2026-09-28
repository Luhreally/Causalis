import { test } from "node:test";
import assert from "node:assert/strict";
import { GOOD_CHOICES, goodsSpread } from "../../src/view/index.ts";

test("the goods lens lays each good on the world's own spread of it: the richest twentieth bright", () => {
  const values = new Map(Array.from({ length: 101 }, (_, i) => [i, i * 0.01] as [number, number]));
  const spread = goodsSpread(values);
  assert.equal(spread.get(0), 0, "none is none");
  assert.equal(spread.get(100), 1, "the richest at the top");
  assert.ok(Math.abs(spread.get(48)! - 0.5) < 0.02, "half the richest, half way");
  // Tools a head a hundredth of grain a head: both still spread over the whole ramp.
  const tools = goodsSpread(new Map([...values].map(([c, v]) => [c, v / 100])));
  assert.equal(tools.get(100), 1);
  assert.equal(GOOD_CHOICES.length, 12);
  assert.deepEqual(GOOD_CHOICES[0], ["grain", "🌾", "grain"]);
});
