import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STONE_DARK_LEAST, STONE_LEAST, memorialTones, stoneSeen } from "../../src/view/index.ts";

// 2026-11-20: the street-fight film in a town of a land whose stone is near black drew its tombs and columns as solid black
// shapes, nearest the eye, as large as houses. A stone is never darker than the darkest rock (basalt, obsidian), so it is seen
// in its light and shade; a lighter stone is drawn as it is given.

const light = (c: readonly number[]) => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;

test("a near-black land's stone is drawn as dark rock, its hue kept, its darker parts still darker", () => {
  // (As the saffron world's town carries its tombs.)
  const t = memorialTones({ colour: [0.06, 0.06, 0.09], dark: [0.025, 0.025, 0.038] });
  assert.ok(Math.abs(light(t.main) - STONE_LEAST) < 1e-9);
  assert.ok(light(t.dark) >= STONE_DARK_LEAST - 1e-9);
  assert.ok(light(t.dark) < light(t.main));
  // (Bluish as it was: blue the most of its three.)
  assert.ok(t.main[2] > t.main[0] && Math.abs(t.main[0] - t.main[1]) < 1e-9);
  // A charred stump: black, but seen.
  const stump = memorialTones({ colour: [0.1, 0.09, 0.08], dark: [0.03, 0.03, 0.03] });
  assert.ok(
    light(stump.main) >= STONE_LEAST - 1e-9 && light(stump.dark) >= STONE_DARK_LEAST - 1e-9,
  );
  // Nothing at all: grey of the least.
  assert.deepEqual(stoneSeen([0, 0, 0], STONE_LEAST), [STONE_LEAST, STONE_LEAST, STONE_LEAST]);
});

test("a stone light enough is drawn as it is given, its lit names too", () => {
  const pale = { colour: [0.7, 0.66, 0.58] as const, dark: [0.35, 0.3, 0.25] as const },
    t = memorialTones(pale);
  assert.deepEqual(t.main, [...pale.colour]);
  assert.deepEqual(t.dark, [...pale.dark]);
  // (Black glass with its names lit: the glass lifted, its light names lighter still, never past white.)
  const glass = memorialTones({ colour: [0.2, 0.21, 0.28], dark: [0.42, 0.72, 0.95] });
  assert.ok(light(glass.main) >= STONE_LEAST - 1e-9);
  assert.ok(light(glass.dark) > light(glass.main) && glass.dark.every((v) => v <= 1));
});

test("the town's stones are drawn in the tones memorialTones gives, not as the land's colour came", () => {
  const src = readFileSync(new URL("../../src/render/memorial.ts", import.meta.url), "utf8");
  assert.match(src, /tones = memorialTones\(p\.m\)/);
  assert.match(src, /q\.tone === "dark" \? tones\.dark : tones\.main/);
});
