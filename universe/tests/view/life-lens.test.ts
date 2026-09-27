import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import type { FrameMessage } from "../../src/bridge/index.ts";
import { globeColors } from "../../src/view/index.ts";

test("the Life lens greens the lands where many kinds of beast live, and greys the barren", () => {
  const world = EARTH.build(seedFromText("first light")),
    payload = EARTH.frames.globe!(world, { view: "globe", focus: null }),
    frame = { kind: "frame", view: "globe", t: 0, ...payload } as unknown as FrameMessage,
    colors = globeColors(frame, "life"),
    a = frame.arrays,
    div = a.diversity!,
    elev = a.elevation!;
  let rich = -1,
    barren = -1;
  for (let c = 0; c < elev.length && (rich < 0 || barren < 0); c++) {
    if (elev[c]! <= 0) continue;
    if (rich < 0 && div[c]! >= 2) rich = c;
    if (barren < 0 && div[c]! === 0) barren = c;
  }
  assert.ok(rich >= 0 && barren >= 0);
  // The rich land is greener than it is red; the barren one is not.
  assert.ok(colors[rich * 4 + 1]! > colors[rich * 4]!);
  assert.ok(colors[barren * 4 + 1]! <= colors[barren * 4]! + 5);
});
