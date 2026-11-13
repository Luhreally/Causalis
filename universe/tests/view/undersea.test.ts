// A people of the water's lands are its sea, not its ground. Asked for 2026-11-05: "the overlays dont
// look right in the underwater cities/countries". A lens paints their sea cells and leaves the ground
// about them no one's, their borders run there, their land's roads and towns keep to the seabed; and
// a world of a people of the land is painted as it ever was.
import { test } from "node:test";
import { keptLife } from "../../src/rules/kinds.ts";
import assert from "node:assert/strict";
import { seedFromText, sphereGrid } from "../../src/kernel/index.ts";
import { ALIEN } from "../../src/host/planet.ts";
import type { FrameMessage } from "../../src/bridge/index.ts";
import {
  builtOverTiles,
  floorAt,
  frameUndersea,
  globeColors,
  groundAt,
  roadTiles,
  seaSky,
  wetAt,
  type LandGround,
} from "../../src/view/index.ts";

/** A world's globe frame, as the host sends it. */
function frameOf(seed: string): FrameMessage {
  const world = ALIEN.build(seedFromText(keptLife(seed))),
    payload = ALIEN.frames.globe!(world, { view: "globe", focus: null });
  return { kind: "frame", view: "globe", t: 0, ...payload } as unknown as FrameMessage;
}

/** Each province a colour of its own, a clear one of no sea's. */
function realmsOf(province: Int32Array): Map<number, [number, number, number]> {
  const out = new Map<number, [number, number, number]>();
  for (const p of province) out.set(p, [1, 0.2, 0.8]);
  return out;
}

const pink = (c: Uint8Array, i: number) =>
  c[i * 4]! > 150 && c[i * 4 + 1]! < 90 && c[i * 4 + 2]! > 110;

test("a frame says whose lands lie under its sea", () => {
  assert.equal(frameUndersea(frameOf("kestrel 557")), true);
  assert.equal(frameUndersea(frameOf("vale 471")), false);
});

test("a lens paints a people of the water's sea, and not the ground about it", () => {
  const frame = frameOf("kestrel 557"),
    a = frame.arrays,
    elevation = a.elevation!,
    province = a.province as Int32Array,
    realms = globeColors(frame, "realms", undefined, realmsOf(province));
  let seas = 0,
    painted = 0,
    grounds = 0,
    ashore = 0;
  for (let c = 0; c < elevation.length; c++) {
    if (elevation[c]! <= 0) {
      seas++;
      if (pink(realms, c)) painted++;
    } else {
      grounds++;
      if (pink(realms, c)) ashore++;
    }
  }
  assert.ok(seas > 0 && grounds > 0, `${seas} sea, ${grounds} ground`);
  assert.equal(painted, seas, "a sea cell of a realm's left unpainted");
  assert.equal(ashore, 0, "the ground about their seas painted as theirs");
  // (And a lens of values, as of colours.)
  const density = new Map([...new Set(province)].map((p) => [p, 8] as const)),
    people = globeColors(frame, "people", density),
    sea = elevation.findIndex((e) => e <= 0),
    ground = elevation.findIndex((e) => e > 0);
  assert.ok(people[sea * 4]! > 100, "their sea unpainted by the people's lens");
  assert.ok(people[ground * 4]! < 100, "the ground painted by the people's lens");
});

test("a people of the land's world is painted as ever: its ground, and no sea", () => {
  const frame = frameOf("vale 471"),
    a = frame.arrays,
    elevation = a.elevation!,
    province = a.province as Int32Array,
    realms = globeColors(frame, "realms", undefined, realmsOf(province));
  for (let c = 0; c < elevation.length; c++)
    assert.equal(pink(realms, c), elevation[c]! > 0, `cell ${c} at ${elevation[c]} m`);
});

test("borders run between a people of the water's lands, under the sea", () => {
  const frame = frameOf("kestrel 557"),
    a = frame.arrays,
    province = a.province as Int32Array,
    grid = sphereGrid((frame.meta as { frequency: number }).frequency),
    colors = new Map<number, [number, number, number]>();
  // Two realms of a like colour, a hair apart: a border is all that darkens one.
  for (const p of province) colors.set(p, p % 2 ? [1, 0.2, 0.8] : [1, 0.2, 0.7]);
  const plain = globeColors(frame, "realms", undefined, colors),
    bordered = globeColors(frame, "realms", undefined, colors, grid),
    elevation = a.elevation!;
  let under = 0,
    above = 0;
  for (let c = 0; c < elevation.length; c++)
    if (bordered[c * 4]! < plain[c * 4]!) {
      if (elevation[c]! <= 0) under++;
      else above++;
    }
  assert.ok(under > 0, "no border under the sea");
  assert.equal(above, 0, "a border on the ground no one holds");
});

/** A land half sea, half ground, with the two ends of a road in its sea. */
function shoreLand(): LandGround {
  const size = 40,
    heights = new Float32Array(size * size),
    water = new Uint8Array(size * size);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const t = j * size + i,
        wet = i < 24;
      heights[t] = wet ? -0.54 : 0.5;
      water[t] = wet ? 1 : 0;
    }
  return { size, tileKm: 1, heights, water, fertility: new Uint8Array(size * size).fill(128) };
}

test("their towns' floor is the seabed; a land people's stays at the sea's face", () => {
  const g = shoreLand();
  assert.ok(wetAt(g, -10, 0));
  assert.equal(groundAt(g, -10, 0), 0);
  assert.ok(Math.abs(floorAt(g, -10, 0) + 0.54) < 1e-6);
  assert.ok(Math.abs(floorAt(g, 15, 0) - 0.5) < 1e-6);
  assert.ok(Math.abs(groundAt(g, 15, 0) - 0.5) < 1e-6);
});

test("their roads keep to the sea, between the towns themselves", () => {
  const g = shoreLand(),
    from = 5 * g.size + 3,
    to = 34 * g.size + 3,
    under = roadTiles(g, from, to, true);
  assert.equal(under[0], from);
  assert.equal(under.at(-1), to);
  assert.ok(
    under.every((t) => g.water[t] === 1),
    "a road ashore",
  );
  // (A people of the land's goes round the sea, as ever.)
  const over = roadTiles(g, from, to);
  assert.ok(over.every((t) => g.water[t] === 0));
});

test("a land built over of theirs is built over under the sea", () => {
  const g = shoreLand(),
    colors = new Uint8Array(g.size * g.size * 4).fill(200),
    frame = {
      arrays: { elevation: Float32Array.from(g.heights), water: g.water },
    } as unknown as FrameMessage,
    wet = 5 * g.size + 3,
    dry = 5 * g.size + 30,
    grey = (c: Uint8Array, t: number) => c[t * 4]! < 110;
  const theirs = builtOverTiles(colors, frame, true),
    ours = builtOverTiles(colors, frame);
  assert.ok(grey(theirs, wet) && !grey(theirs, dry));
  assert.ok(grey(ours, dry) && !grey(ours, wet));
});

test("a town under the sea is seen in its sea's own colour", () => {
  const rocky = seaSky("rocky"),
    oil = seaSky("carbon");
  assert.equal(rocky.airless, false);
  assert.notDeepEqual(rocky.stops, oil.stops);
  // (Bluer than it is red, and its far towers lost in it sooner than in air.)
  assert.ok(rocky.haze![2] > rocky.haze![0]);
  assert.ok(rocky.clearness < 1);
});
