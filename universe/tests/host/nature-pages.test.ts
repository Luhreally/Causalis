// The sweep's Nature lane on the pages: a land's crop, its people's diet, its volcano and floods, and the world's fires below,
// read straight from their stores on a small world (pageOf swallows errors, so the blocks are built here by name).
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { cropsOf, makePopulationWorld, populationContext } from "../../src/sim/index.ts";
import {
  cropBlock,
  dietBlock,
  landFiresBlocks,
  worldFiresBlocks,
} from "../../src/host/inspect/nature.ts";
import { woodsBlock } from "../../src/host/inspect/woods.ts";

test("the Nature lane's sections read every land of a small world, and its crop where it sows", () => {
  const w = makePopulationWorld(seedFromText("nature sweep"), { frequency: 16, start: "spread" });
  w.runTo(30 * YEAR);
  const ctx = populationContext(w);
  let crops = 0,
    diets = 0;
  for (const p of ctx.provinces.all()) {
    const c = cropBlock(w, p.cell),
      d = dietBlock(w, p.cell);
    if (c) {
      crops++;
      assert.equal(c.type, "facts");
    }
    if (d) diets++;
    woodsBlock(w, p.cell);
    for (const b of landFiresBlocks(w, p.cell)) assert.ok(b.type === "facts" || b.type === "list");
  }
  assert.equal(crops, cropsOf(w)!.size);
  assert.ok(diets > 0);
  const world = worldFiresBlocks(w);
  assert.equal(world.length, 1);
});
