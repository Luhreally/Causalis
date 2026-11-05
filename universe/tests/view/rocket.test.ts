// War past the line, W3: rockets on a town and on the globe, as they are seen. No machine; a streak down to where each falls, its
// hits together; a way on the globe from where it left to where it fell.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SPREAD,
  type LotStates,
  type TownLots,
  type TownPlan,
  type TownStrike,
  type WarsMap,
} from "../../src/bridge/index.ts";
import {
  MOST_STREAKS,
  globeArcsNow,
  landRaidsNow,
  raidEye,
  raidNow,
  raidOver,
  raidRun,
  raidSlowings,
  timeRaids,
  type TownScene,
} from "../../src/view/index.ts";

const fall = (): TownStrike =>
  ({
    kind: "raid",
    at: 1000 * 365 * 86_400,
    lot: -1,
    homes: 20,
    event: "ev:0:7",
    raid: { by: "the league of Gel", flyers: 6, span: 0, speed: 1700, rocket: true },
  }) as TownStrike;

function scene(k: TownStrike, hit: (p: number) => boolean, lots = 400): TownScene {
  const x = new Float32Array(lots),
    z = new Float32Array(lots),
    struck = new Int16Array(lots).fill(-1),
    began = new Float64Array(lots),
    list: number[] = [];
  for (let p = 0; p < lots; p++) {
    const r = 12 * Math.sqrt(p),
      a = p * 2.399963;
    x[p] = r * Math.cos(a);
    z[p] = r * Math.sin(a);
    if (hit(p)) {
      struck[p] = 0;
      began[p] = k.at + SPREAD.rocketFrom;
      list.push(p);
    }
  }
  const plan = { lots, struck: [k] } as unknown as TownPlan,
    states = { struck, began } as unknown as LotStates,
    made = { x, z } as unknown as TownLots;
  timeRaids(plan, made, states);
  list.sort((a, b) => began[a]! - began[b]!);
  return { plan, states, lots: made, struck: list } as unknown as TownScene;
}

test("no machine: a streak to each of its places, its flash when it lands, gone in the end", () => {
  const k = fall(),
    s = scene(k, (p) => (p >= 10 && p < 16) || (p >= 100 && p < 106) || (p >= 200 && p < 206)),
    { from, to } = raidRun(k);
  assert.equal(to - from, SPREAD.rocketAll);
  const before = raidNow(s, from - 5);
  assert.equal(before.streaks.length, 0);
  const coming = raidNow(s, from - 0.5);
  assert.equal(coming.flyers.length, 0);
  assert.equal(coming.streaks.length, 1);
  assert.ok(coming.streaks[0]!.falling);
  assert.ok(coming.streaks[0]!.y > 500, `${coming.streaks[0]!.y}`);
  const landed = raidNow(s, from + 1);
  assert.equal(landed.flyers.length, 0);
  assert.equal(landed.falling.length, 0);
  assert.ok(landed.bursts.length >= 1 && landed.bursts[0]!.size! > 1);
  assert.ok(!landed.streaks[0]!.falling);
  // All three have come down; each one's lots catch within seconds of it, not along a stream.
  const all = raidNow(s, to + 1);
  assert.equal(all.streaks.length, 3);
  assert.equal(raidNow(s, to + 300).streaks.length, 0);
  const a = s.states.began.slice(10, 16),
    spread = Math.max(...a) - Math.min(...a);
  assert.ok(spread <= 3, `${spread}`);
});

test("the eye goes off to one side of the first fall, the clock at the world's own pace", () => {
  const k = fall(),
    s = scene(k, (p) => p >= 10 && p < 16);
  assert.ok(raidOver(s.plan, raidRun(k).from - 5));
  assert.equal(raidEye(k).pitch, -8);
  assert.equal(raidSlowings(s.plan)[0]!.speed, 1);
});

test("never more streaks than can be drawn, however scattered its hits", () => {
  const k = fall(),
    s = scene(k, (p) => p % 7 === 0);
  assert.ok(raidNow(s, raidRun(k).to).streaks.length <= MOST_STREAKS);
});

const map = (): WarsMap =>
  ({
    wars: [
      {
        ref: "war:0:1",
        raids: [
          {
            town: "town:0:1",
            name: "Gel",
            year: 1000,
            side: 0,
            flyers: 6,
            dead: 3,
            homes: 5,
            event: "ev:0:7",
            rocket: { from: 0, to: 1 },
          },
          {
            town: "town:0:2",
            name: "Ost",
            year: 1000,
            side: 0,
            flyers: 6,
            dead: 3,
            homes: 5,
            event: "ev:0:8",
          },
        ],
      },
    ],
  }) as unknown as WarsMap;

test("on the globe: one way from where it left to where it fell, rising off the ground, the raid not among them", () => {
  const positions = [1, 0, 0, 0, 1, 0],
    arcs = globeArcsNow(map(), 1001.5, positions);
  assert.equal(arcs.length, 1);
  const dots = arcs[0]!.dots,
    r = (d: { x: number; y: number; z: number }) => Math.hypot(d.x, d.y, d.z);
  assert.ok(dots[0]!.x > 0.9 && dots.at(-1)!.y > 0.9);
  assert.ok(r(dots[Math.floor(dots.length / 2)]!) > r(dots[0]!) + 0.1);
  assert.equal(globeArcsNow(map(), 1010, positions).length, 0);
});

test("on the land: its way comes in from where it left, and no machine", () => {
  const list = landRaidsNow(
    map(),
    1001.2,
    () => ({ x: 10, z: 20, r: 4 }),
    () => ({ x: -200, z: 20 }),
  );
  const r = list.find((x) => x.arc)!;
  assert.equal(r.flyers.length, 0);
  assert.equal(r.arc!.x, -200);
  assert.ok(r.arc!.high > 14);
  assert.ok(r.words.includes("Gel"));
  assert.ok(list.some((x) => !x.arc && x.flyers.length >= 0));
});
