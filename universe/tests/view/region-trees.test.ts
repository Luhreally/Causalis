import { test } from "node:test";
import assert from "node:assert/strict";
import type { FrameMessage } from "../../src/bridge/index.ts";
import { regionTrees } from "../../src/view/index.ts";

/** A region frame of `size` tiles a side, all of one biome, a lake down the middle column. */
function frame(size: number, biome: number): FrameMessage {
  const n = size * size,
    water = new Uint8Array(n);
  for (let j = 0; j < size; j++) water[j * size + (size >> 1)] = 3;
  return {
    kind: "frame",
    view: "region",
    seq: 1,
    t: 0,
    meta: { ref: "cell:0:7", size },
    arrays: { biome: new Uint8Array(n).fill(biome), water, elevation: new Float32Array(n) },
  };
}

test("a region's woods: as its land grows them, never on the water, spread to the cap, the same each time", () => {
  const forest = regionTrees(frame(64, 14)),
    steppe = regionTrees(frame(64, 8)),
    sea = regionTrees(frame(64, 1));
  assert.ok(
    forest.length > 5 * steppe.length,
    `${forest.length} in the rainforest, ${steppe.length} on the steppe`,
  );
  assert.equal(sea.length, 0);
  assert.ok(
    forest.every((t) => t.tile % 64 !== 32),
    "none on the lake",
  );
  assert.deepEqual(regionTrees(frame(64, 14)), forest);
  // A cap thins the woods alike everywhere: the far rows keep their trees too.
  const capped = regionTrees(frame(64, 14), 300);
  assert.ok(capped.length <= 300 && capped.length > 200, `${capped.length} under the cap`);
  assert.ok(
    capped.some((t) => t.tile > 60 * 64),
    "trees in the last rows",
  );
});
