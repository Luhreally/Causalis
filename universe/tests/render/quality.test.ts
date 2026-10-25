import { test } from "node:test";
import assert from "node:assert/strict";
import { AutoQuality, QUALITIES, QUALITY_NAMES } from "../../src/render/quality.ts";

test("each setting draws at least as much as the one below it", () => {
  for (let i = 1; i < QUALITY_NAMES.length; i++) {
    const lo = QUALITIES[QUALITY_NAMES[i - 1]!],
      hi = QUALITIES[QUALITY_NAMES[i]!];
    for (const k of [
      "pixelRatio",
      "crowdCap",
      "regionTrees",
      "villageTrees",
      "wildlife",
      "detail",
      "families",
    ] as const)
      assert.ok(hi[k] >= lo[k], `${hi.name}.${k} ≥ ${lo.name}.${k}`);
  }
});

test("Auto steps down when frames are slow, up only after a calm spell, and never past its ceiling", () => {
  const auto = new AutoQuality("high", "high", 22, 12, 10, 3),
    feed = (ms: number, n: number) => {
      let changed: string | null = null;
      for (let i = 0; i < n; i++) changed = auto.frame(ms) ?? changed;
      return changed;
    };
  // A lone hitch in a smooth window changes nothing.
  assert.equal(feed(10, 9), null);
  assert.equal(auto.frame(80), null);
  // Slow windows step down, one setting a window, to the lowest and no further.
  assert.equal(feed(40, 10), "balanced");
  assert.equal(feed(40, 10), "low");
  assert.equal(feed(40, 10), null);
  assert.equal(auto.current, "low");
  // Easy windows step up only after three in a row, up to the ceiling.
  assert.equal(feed(8, 20), null);
  assert.equal(feed(8, 10), "balanced");
  assert.equal(feed(8, 30), "high");
  assert.equal(feed(8, 60), null, "the ceiling holds");
  assert.equal(auto.current, "high");
});

test("Auto on a screen at its own pace: back up after a long steady spell, not to a setting too slow lately (M197)", () => {
  // (Windows of 10 frames; 3 calm windows to step up from fast frames, 12 at the screen's pace;
  // 8 windows to rest before a setting too slow is tried again, 16 the second time.)
  const auto = new AutoQuality("ultra", "ultra", 22, 12, 10, 3, 18, 8),
    feed = (ms: number, windows: number) => {
      let changed: string | null = null;
      for (let i = 0; i < windows * 10; i++) changed = auto.frame(ms) ?? changed;
      return changed;
    };
  // A heavy moment steps it down.
  assert.equal(feed(30, 1), "high");
  // Sixty a second (16.7 ms) never counts as fast; a long spell of it tries Ultra again.
  assert.equal(feed(16.7, 11), null);
  assert.equal(feed(16.7, 1), "ultra");
  // Too slow again: down, and not tried again until it has rested twice as long.
  assert.equal(feed(30, 1), "high");
  assert.equal(feed(16.7, 12), null, "resting");
  assert.equal(feed(16.7, 12), "ultra");
  // A screen past its pace (a frame of 20 ms) is not steady: it stays.
  const held = new AutoQuality("high", "ultra", 22, 12, 10, 3, 18, 5);
  for (let i = 0; i < 400; i++) assert.equal(held.frame(20), null);
});
