// Where snow lies on a land's heights (view/region.ts snowLine), as its season lays it on its tiles (seasonTiles): what grows
// over that line is drawn under the same snow (render/flora.ts). A warm summer has none; a cold land's high ground has it
// from a height up, the line lower in winter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { REGION_RELIEF, snowLine } from "../../src/view/index.ts";
import type { FrameMessage, LandSky } from "../../src/bridge/index.ts";
import { DAY, YEAR } from "../../src/kernel/index.ts";
const sky = (o: Partial<LandSky> = {}): LandSky => ({
  cell: 17,
  warmth: 12,
  swing: 10,
  wet: 800,
  year: 1,
  sent: 0,
  acts: [],
  ...o,
});
// A land rising from its shore to 4 km.
const frame = {
  arrays: { elevation: Float32Array.from({ length: 100 }, (_, i) => i * 40) },
  meta: {},
} as unknown as FrameMessage;

test("snow's line: none in a warm summer; on a cold land's heights, lower in its winter", () => {
  assert.equal(snowLine(frame, sky({ warmth: 30, swing: 2 }), YEAR / 2), null);
  const cold = sky({ warmth: -4, swing: 14 }),
    winter = snowLine(frame, cold, 20 * DAY),
    summer = snowLine(frame, cold, YEAR / 2 + 10 * DAY);
  assert.ok(winter && summer, "snow on the heights in either");
  assert.ok(winter[0] < summer[0], `winter's line ${winter[0]} under summer's ${summer[0]}`);
  assert.ok(winter[1] > winter[0]);
  assert.ok(summer[1] <= (4000 / 1000) * REGION_RELIEF + 1);
});
