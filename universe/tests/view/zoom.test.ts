import { test } from "node:test";
import assert from "node:assert/strict";
import { BEYOND, zoomStep, type ZoomState } from "../../src/view/index.ts";

test("within a scale the zoom moves; pushed on past an edge, it gathers and goes through", () => {
  let s: ZoomState = { distance: 5, beyond: 0, way: "out" };
  // Within: it moves, nothing gathers.
  let n = zoomStep(s, 1.5, 1, 12);
  assert.equal(n.distance, 7.5);
  assert.equal(n.through, null);
  assert.equal(n.beyond, 0);
  // Out to the farthest, then on past it: it holds there as the push gathers...
  s = { distance: 12, beyond: 0, way: "out" };
  let steps = 0;
  for (; steps < 20; steps++) {
    n = zoomStep(s, 1.1, 1, 12);
    if (n.through) break;
    assert.equal(n.distance, 12);
    s = n;
  }
  // ...and goes through, out, after a third again.
  assert.equal(n.through, "out");
  assert.equal(steps, Math.ceil(BEYOND / Math.log(1.1)) - 1);
  // A push that turns back starts again; one at the nearest goes in.
  s = { distance: 12, beyond: BEYOND * 0.9, way: "out" };
  n = zoomStep(s, 0.9, 1, 12);
  assert.equal(n.beyond, 0);
  assert.equal(n.through, null);
  s = { distance: 1, beyond: 0, way: "out" };
  for (let k = 0; k < 20 && !n.through; k++) {
    n = zoomStep(s, 0.9, 1, 12);
    s = n;
  }
  assert.equal(n.through, "in");
});
