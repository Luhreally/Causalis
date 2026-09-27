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

test("the Trade lens lights the lands that move goods, the more the brighter, and greys the rest", () => {
  const world = EARTH.build(seedFromText("first light")),
    payload = EARTH.frames.globe!(world, { view: "globe", focus: null }),
    frame = { kind: "frame", view: "globe", t: 0, ...payload } as unknown as FrameMessage,
    a = frame.arrays,
    province = a.province!,
    elev = a.elevation!;
  // Two land cells of different provinces: one a great market, the other with no trade.
  let busy = -1,
    idle = -1;
  for (let c = 0; c < elev.length && idle < 0; c++) {
    if (elev[c]! <= 0) continue;
    if (busy < 0) busy = c;
    else if (province[c] !== province[busy]) idle = c;
  }
  const colors = globeColors(frame, "trade", new Map([[province[busy]!, 200_000]]));
  const at = (c: number): [number, number, number] => [
      colors[c * 4]!,
      colors[c * 4 + 1]!,
      colors[c * 4 + 2]!,
    ],
    [r, , b] = at(busy),
    [ir, ig, ib] = at(idle);
  assert.ok(r > 200 && r > b + 100, `a great market burns warm (${at(busy).join(",")})`);
  assert.ok(Math.abs(ir - ig) < 20 && Math.abs(ig - ib) < 20, "the idle land is grey");
});
