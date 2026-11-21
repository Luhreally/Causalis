// What grows near the eye is drawn by its distance from the eye (render/flora.ts coreFor): the core within which every tree is
// drawn is set by the setting's budget and the eye's height alone, never by where on the screen, so moving the eye along at one
// height changes nothing; the eye high, the core reaches its most and the land is drawn uniformly simpler.
import { test } from "node:test";
import assert from "node:assert/strict";
import { coreFor } from "../../src/render/flora.ts";

test("the near trees' core: from the budget and the eye's height; at its most, the land simpler alike everywhere", () => {
  const most = 3.2,
    low = coreFor(3600, 0.8, 9, most),
    mid = coreFor(3600, 2, 9, most),
    high = coreFor(3600, 9, 9, most);
  assert.ok(low > 1 && low < mid && mid <= most, `${low} ${mid}`);
  assert.equal(high, most, "the eye high: the core at its most");
  assert.equal(coreFor(3600, 2, 9, most), mid, "the same eye height, the same core");
  // A greater budget, a greater core; never past its most.
  assert.ok(coreFor(6000, 0.8, 9, 4.1) > low);
  assert.ok(coreFor(1e9, 0.8, 9, most) <= most);
});
