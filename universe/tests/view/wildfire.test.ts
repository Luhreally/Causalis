// A wildfire's front on a land (N1): it moves, stops at water and on bare ground, leaves a scar, and the scar goes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY, YEAR } from "../../src/kernel/index.ts";
import type { ActMark, LandBurn, LandSky } from "../../src/bridge/index.ts";
import {
  FIRE_POINT,
  FIRE_WATCHED_S,
  actsNear,
  bareTiles,
  burnBand,
  burnClock,
  burnTiles,
  burnedBy,
  flamesOf,
  scarAge,
  scarOver,
  smokeOf,
  type LandGround,
} from "../../src/view/index.ts";

const SIZE = 64;
const TILE = 2.4;
const half = ((SIZE - 1) * TILE) / 2;

/** A land of even ground, a lake across its east, a bare patch to its north. */
function ground(): LandGround {
  const n = SIZE * SIZE,
    water = new Uint8Array(n),
    fertility = new Uint8Array(n).fill(128);
  for (let j = 0; j < SIZE; j++)
    for (let i = 0; i < SIZE; i++) {
      if (i >= 44) water[j * SIZE + i] = 3;
      if (j <= 12) fertility[j * SIZE + i] = 0;
    }
  return { size: SIZE, tileKm: TILE, heights: new Float32Array(n).fill(0.5), water, fertility };
}

const FROM = 1000 * YEAR;
const UNTIL = FROM + 40 * DAY;
const GONE = UNTIL + 60 * YEAR;
const burn: LandBurn = {
  event: "evt:7",
  from: FROM,
  until: UNTIL,
  gone: GONE,
  spots: [
    { x: 0, z: 0, r: 40, at: FROM },
    { x: 40, z: 30, r: 40, at: FROM + 20 * DAY },
  ],
  flame: [1, 0.5, 0.1],
  smoke: [0.3, 0.28, 0.27],
};

/** How far from where it lit a flame stands, on average, at a moment on its clock. */
function meanReach(t: number): { n: number; mean: number } {
  const g = ground(),
    b = burnTiles(burn, g),
    out = new Float32Array(420 * FIRE_POINT),
    n = flamesOf(b, burnBand(burn), burnClock(burn, t, DAY), 420, out);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x = out[i * FIRE_POINT]!,
      z = out[i * FIRE_POINT + 2]!;
    sum += Math.hypot(x, z);
  }
  return { n, mean: n ? sum / n : 0 };
}

test("a fire's front moves between two moments, and every point of it is a number", () => {
  const early = meanReach(FROM + 6 * DAY),
    late = meanReach(FROM + 18 * DAY);
  assert.ok(early.n > 0, "flames at the first moment");
  assert.ok(late.n > 0, "flames at the second moment");
  assert.ok(late.mean > early.mean * 1.3, `${early.mean} then ${late.mean}`);
  const b = burnTiles(burn, ground()),
    out = new Float32Array(420 * FIRE_POINT),
    smoke = new Float32Array(160 * FIRE_POINT),
    n = flamesOf(b, burnBand(burn), burnClock(burn, FROM + 10 * DAY, DAY), 420, out),
    m = smokeOf(b, burnBand(burn), burnClock(burn, FROM + 10 * DAY, DAY), 160, smoke);
  assert.ok(n <= 420 && m > 0 && m <= 160, `${n} flames, ${m} puffs`);
  for (let i = 0; i < n * FIRE_POINT; i++) assert.ok(Number.isFinite(out[i]), `flame number ${i}`);
  for (let i = 0; i < m * FIRE_POINT; i++) assert.ok(Number.isFinite(smoke[i]), `puff number ${i}`);
});

test("it stops at the lake and on bare ground: no tile of water or bare ground burns", () => {
  const g = ground(),
    b = burnTiles(burn, g);
  assert.ok(b.tiles.length > 200, `${b.tiles.length} tiles`);
  for (const t of b.tiles) {
    assert.ok(g.water[t] !== 3, `tile ${t} is the lake`);
    assert.ok(g.fertility[t]! >= 6, `tile ${t} has nothing on it`);
  }
  for (let i = 1; i < b.at.length; i++) assert.ok(b.at[i]! >= b.at[i - 1]!, "in order of moments");
  for (let i = 0; i < b.tiles.length; i++)
    assert.ok(Math.abs(b.x[i]!) <= half + TILE && Number.isFinite(b.y[i]), `tile ${i}'s place`);
});

test("a river slows it: its far bank is reached later than the same ground with no river", () => {
  const dry = ground(),
    wet = ground();
  // (A river down the land's middle column, east of where it lit.)
  for (let j = 0; j < SIZE; j++) for (let i = 36; i < 38; i++) wet.water[j * SIZE + i] = 2;
  const one: LandBurn = { ...burn, spots: [burn.spots[0]!] },
    farBank = 40 * SIZE + 39,
    moment = (g: LandGround) => {
      const b = burnTiles(one, g),
        i = [...b.tiles].indexOf(farBank);
      return i < 0 ? Infinity : (b.at[i]! - b.at[0]!) / (b.at[b.at.length - 1]! - b.at[0]!);
    };
  assert.ok(moment(wet) > moment(dry), `${moment(dry)} then ${moment(wet)}`);
});

test("after it is over no flame stands, and a scar does; when it has grown back nothing does", () => {
  const g = ground(),
    b = burnTiles(burn, g),
    after = UNTIL + 2 * YEAR,
    local = burnClock(burn, after, DAY),
    out = new Float32Array(420 * FIRE_POINT);
  assert.equal(flamesOf(b, burnBand(burn), local, 420, out), 0);
  assert.equal(burnedBy(b, local), b.tiles.length);
  const colors = new Uint8Array(SIZE * SIZE * 4).fill(200);
  assert.equal(scarOver(colors, b, burn, after, local), b.tiles.length);
  const q = b.tiles[0]! * 4;
  assert.ok(colors[q]! < 100, `char on the ground: ${colors[q]}`);
  // (Browned and going, three-quarters of the way through its years.)
  const going = new Uint8Array(SIZE * SIZE * 4).fill(200),
    later = FROM + 40 * DAY + 50 * YEAR;
  scarOver(going, b, burn, later, burnClock(burn, later, DAY));
  assert.ok(going[q]! > colors[q]!, `${colors[q]} then ${going[q]}`);
  // (Grown back: not a mark on the ground, and every tree stands.)
  const clean = new Uint8Array(SIZE * SIZE * 4).fill(200);
  assert.equal(scarOver(clean, b, burn, GONE, burnClock(burn, GONE, DAY)), 0);
  assert.ok(clean.every((c) => c === 200));
  const mask = new Uint8Array(SIZE * SIZE);
  bareTiles(mask, b, scarAge(burn, GONE), b.tiles.length);
  assert.ok(mask.every((m) => m === 0));
  bareTiles(mask, b, scarAge(burn, after), b.tiles.length);
  assert.equal(
    mask.reduce((n, m) => n + m, 0),
    b.tiles.length,
  );
});

test("at any pace it is watched for its seconds: a fast clock draws it out", () => {
  const year = YEAR,
    whole = UNTIL - FROM,
    // (Halfway through what the viewer is given to watch, at a year a second.)
    halfway = FROM + (year * FIRE_WATCHED_S) / 2,
    local = burnClock(burn, halfway, year);
  assert.ok(Math.abs(local - (FROM + whole / 2)) < 1, `${local - FROM} of ${whole}`);
  // (At a pace that gives it time, it goes by the world's clock.)
  assert.equal(burnClock(burn, FROM + 5 * DAY, DAY / 10), FROM + 5 * DAY);
});

const sky = (acts: ActMark[]): LandSky => ({
  cell: 1,
  warmth: 10,
  swing: 8,
  wet: 600,
  year: 1,
  sent: 0,
  acts,
});
const mark = (kind: ActMark["kind"], natural: boolean): ActMark => ({
  kind,
  at: [0, 1, 0],
  to: null,
  color: null,
  left: 1,
  event: "evt:1",
  cell: 1,
  town: null,
  from: 100,
  ...(natural ? { natural: true as const } : {}),
});

test("a falling star is a streak, and what the world did is no god's hand", () => {
  const seen = actsNear(sky([mark("streak", true)]), 100 + DAY / 2, 1);
  assert.ok(seen.streak && seen.streak.k > 0.4 && seen.streak.k < 0.6, `${seen.streak?.k}`);
  assert.equal(seen.told.length, 0);
  assert.equal(actsNear(sky([mark("streak", true)]), 100 + 2 * DAY, 1).streak, null);
  const shaken = actsNear(sky([mark("quake", true)]), 100, 1);
  assert.ok(shaken.shake > 0.9, "the ground still shakes");
  assert.equal(shaken.told.length, 0);
  assert.equal(actsNear(sky([mark("quake", false)]), 100, 1).told.length, 1);
});
