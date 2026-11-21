// What grows on a land (bridge/biome.ts, view/flora.ts): read from each tile's warmth, rain, height, water and woods, drawn in
// its world's colours. A tundra tile bears no broad crowns; a desert is sparse; woods are thick; rock shows on the steep; a
// bank is greener and a dry land's has its gallery woods; nothing stands on water or on ground the land's towns hold; another
// chemistry's plants are not Earth's green; the near things are the same however the eye comes to them.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FLORA,
  floraMix,
  floraPack,
  floraRead,
  TREE_FORMS,
  type FloraFacts,
} from "../../src/bridge/index.ts";
import type { FrameMessage } from "../../src/bridge/index.ts";
import {
  floraColors,
  floraClumps,
  floraLandOf,
  formAt,
  nearBudget,
  nearFlora,
  regionColors,
  regionTrees,
} from "../../src/view/index.ts";

/** A land of `size` tiles a side, every tile the same (warmth, rain, biome), a river down its middle column. */
function facts(
  size: number,
  warm: number,
  rain: number,
  biome: number,
  over: Partial<FloraFacts> = {},
): FloraFacts {
  const n = size * size,
    water = new Uint8Array(n);
  for (let j = 0; j < size; j++) water[j * size + (size >> 1)] = 2;
  return {
    size,
    tileKm: 2.4,
    elevation: new Float32Array(n).fill(200),
    warm: new Float32Array(n).fill(warm),
    rain: new Float32Array(n).fill(rain),
    water,
    biome: new Uint8Array(n).fill(biome),
    fertility: new Float32Array(n).fill(0.5),
    ...over,
  };
}

const mean = (a: Uint8Array, keep: (t: number) => boolean = () => true) => {
  let s = 0,
    n = 0;
  for (let t = 0; t < a.length; t++)
    if (keep(t)) {
      s += a[t]!;
      n++;
    }
  return s / Math.max(1, n) / 255;
};

test("each climate its own ground: woods thick, the steppe open, the desert sparse, the tundra scrub with no broad crowns", () => {
  const size = 24,
    far = (t: number) => Math.abs((t % size) - (size >> 1)) > 2,
    temperate = floraRead(facts(size, 12, 1100, 9)),
    steppe = floraRead(facts(size, 12, 400, 8)),
    desert = floraRead(facts(size, 26, 120, 11)),
    tundra = floraRead(facts(size, -3, 300, 5)),
    taiga = floraRead(facts(size, 3, 700, 6));
  assert.equal(temperate.cover[0], FLORA.broadleaf);
  assert.equal(taiga.cover[0], FLORA.taiga);
  assert.equal(tundra.cover[0], FLORA.tundra);
  assert.equal(desert.cover[0], FLORA.hotDesert);
  assert.ok(mean(temperate.canopy, far) > 0.6, `woods ${mean(temperate.canopy, far)}`);
  assert.ok(mean(steppe.canopy, far) < 0.06, `steppe ${mean(steppe.canopy, far)}`);
  assert.ok(mean(desert.canopy, far) < 0.04, `desert ${mean(desert.canopy, far)}`);
  assert.ok(mean(tundra.canopy, far) < 0.12, `tundra ${mean(tundra.canopy, far)}`);
  // (A desert's grass is straw; a temperate land's green.)
  assert.ok(mean(desert.lush, far) < 0.2 && mean(temperate.lush, far) > 0.7);
  // A tundra tile has no broad crowns; neither does any form drawn on it.
  const mix = floraMix(FLORA.tundra);
  assert.equal(mix[TREE_FORMS.indexOf("broadleaf")], 0);
  for (let u = 0; u < 1; u += 0.01) assert.notEqual(formAt(tundra, 0, u), "broadleaf");
  // The taiga is needles above all.
  assert.ok(floraMix(FLORA.taiga)[0]! > 0.8);
});

test("water bears nothing; a bank is wetter, greener, and in a dry land wooded; flat wet ground is marsh", () => {
  const size = 24,
    river = (t: number) => t % size === size >> 1,
    bank = (t: number) => Math.abs((t % size) - (size >> 1)) === 1,
    far = (t: number) => Math.abs((t % size) - (size >> 1)) > 2,
    steppe = floraRead(facts(size, 14, 350, 8));
  for (let t = 0; t < size * size; t++)
    if (river(t)) assert.equal(steppe.canopy[t], 0, "no trees in the river");
  assert.ok(mean(steppe.wet, bank) > 0.4 && mean(steppe.wet, far) === 0);
  assert.ok(
    mean(steppe.canopy, bank) > 3 * mean(steppe.canopy, far),
    "gallery woods along the river",
  );
  // A hot desert's bank grows palms.
  const oasis = floraMix(FLORA.hotDesert, true, 26);
  assert.ok(oasis[TREE_FORMS.indexOf("palm")]! > 0.5);
  // Flat, low, rainy ground by the river: marsh in places.
  const wet = floraRead(
    facts(size, 10, 1200, 9, { elevation: new Float32Array(size * size).fill(30) }),
  );
  let marsh = 0;
  for (let t = 0; t < size * size; t++) if (bank(t) && wet.cover[t] === FLORA.marsh) marsh++;
  assert.ok(marsh > 0, "some of the flat wet bank is marsh");
});

test("rock on the steep and above the trees; woods gone are felled ground; fewer trees where the woods have shrunk", () => {
  const size = 24,
    n = size * size,
    steep = new Float32Array(n);
  for (let t = 0; t < n; t++) steep[t] = (t % size) * 2000 + 200;
  const hills = floraRead(facts(size, 8, 900, 9, { elevation: steep }));
  assert.ok(mean(hills.rock) > 0.5, `rock ${mean(hills.rock)}`);
  assert.ok(mean(hills.canopy) < 0.25, `trees on cliffs ${mean(hills.canopy)}`);
  const alpine = floraRead(facts(size, -5, 600, 15));
  assert.ok(mean(alpine.rock) > 0.5 && mean(alpine.canopy) < 0.05);
  // Woods that stood (its biome as made) and stand no more: stumps and scrub.
  const felled = floraRead(facts(size, 12, 1000, 8, { wild: new Uint8Array(n).fill(9) }));
  assert.equal(felled.cover[0], FLORA.cleared);
  assert.ok(floraMix(FLORA.cleared)[TREE_FORMS.indexOf("dead")]! > 0.2);
  const full = floraRead(facts(size, 12, 1000, 9)),
    thinned = floraRead(facts(size, 12, 1000, 9), { stands: 0.3 });
  assert.ok(mean(thinned.canopy) < 0.8 * mean(full.canopy));
  // A world where nothing took hold: no woods, no green.
  const bare = floraRead(facts(size, 12, 1000, 9), { lifeless: true });
  assert.equal(mean(bare.canopy), 0);
  assert.equal(mean(bare.lush), 0);
});

/** A region frame carrying its reading, as host/planet.ts sends it. */
function frame(
  size: number,
  warm: number,
  rain: number,
  biome: number,
  meta: Record<string, unknown> = {},
): FrameMessage {
  const f = facts(size, warm, rain, biome),
    read = floraRead(f);
  return {
    kind: "frame",
    view: "region",
    seq: 1,
    t: 0,
    meta: {
      ref: "regn:0:1",
      surfaceKey: `k${warm}${rain}${biome}${JSON.stringify(meta)}`,
      size,
      tileKm: 2.4,
      ...meta,
    },
    arrays: {
      elevation: Float32Array.from(f.elevation as Float32Array),
      biome: Uint8Array.from(f.biome as Uint8Array),
      water: Uint8Array.from(f.water as Uint8Array),
      fertility: new Uint8Array(size * size).fill(128),
      flora: floraPack(read),
    },
  };
}

test("the ground in its world's colours: woods darker than the steppe's grass, straw in the desert, another chemistry's not green", () => {
  const size = 16,
    at = (c: Uint8Array, t = 0) => [c[t * 4]!, c[t * 4 + 1]!, c[t * 4 + 2]!],
    woods = at(regionColors(frame(size, 12, 1100, 9), "land")),
    steppe = at(regionColors(frame(size, 14, 380, 8), "land")),
    desert = at(regionColors(frame(size, 26, 120, 11), "land"));
  const light = (c: number[]) => c[0]! + c[1]! + c[2]!;
  assert.ok(light(woods) < light(steppe), `woods ${woods} under the steppe ${steppe}`);
  assert.ok(woods[1]! > woods[0]! && woods[1]! > woods[2]!, "Earth's woods are green");
  assert.ok(desert[0]! > desert[2]! && desert[0]! > 150, `desert sand ${desert}`);
  // Golden life (carotene): the woods are not green.
  const gold = at(regionColors(frame(size, 12, 1100, 9, { lifeLook: "carotene" }), "land"));
  assert.ok(gold[0]! >= gold[1]!, `golden woods ${gold}`);
  // Tile from tile the ground varies a little (no flat single colour).
  const all = regionColors(frame(size, 12, 1100, 9), "land"),
    seen = new Set<number>();
  for (let t = 0; t < size * size; t++) if (t % size !== size >> 1) seen.add(all[t * 4 + 1]!);
  assert.ok(seen.size > 8, `${seen.size} greens`);
  // (A map with no reading is painted as before.)
  const plain = frame(size, 12, 1100, 9);
  assert.equal(
    floraColors(
      { ...plain, arrays: { ...plain.arrays, flora: undefined as never } },
      new Uint8Array(size * size * 4),
    ),
    null,
  );
});

test("far woods: crowns by the reading, none on the water; near things on a fixed lattice, groves past them, none where the ground is held", () => {
  const size = 32,
    f = frame(size, 12, 1100, 9),
    land = floraLandOf(f)!,
    clumps = floraClumps(land, 4000);
  assert.ok(clumps.length > 1000);
  assert.ok(
    clumps.every((c) => c.tile % size !== size >> 1),
    "no crown on the river",
  );
  assert.deepEqual(regionTrees(f, 4000).length, clumps.length);
  const tundra = floraClumps(floraLandOf(frame(size, -3, 300, 5))!, 4000);
  assert.ok(tundra.every((c) => c.kind !== "broadleaf"));
  // Near the eye: a fixed budget, nothing on the river, nothing on a held disc, the same things wherever the eye comes from.
  const budget = nearBudget(2400),
    held = { x: 7, z: 3, r: 1.5 },
    free = (x: number, z: number, r: number) => Math.hypot(x - held.x, z - held.z) > held.r + r,
    a = nearFlora(land, 5, 2, 4, budget, free),
    b = nearFlora(land, 5.6, 1.7, 4, budget, free),
    half = ((size - 1) * 2.4) / 2,
    riverX = (size >> 1) * 2.4 - half;
  assert.ok(a.trees > 200 && a.trees <= budget.trees, `${a.trees} trees`);
  assert.ok(a.tufts.length <= budget.tufts && a.stones.length <= budget.stones);
  const all = [...a.trunks, ...a.balls, ...a.cones, ...a.tufts, ...a.stones, ...a.patches];
  assert.ok(
    all.every((t) => Math.hypot(t.x - held.x, t.z - held.z) > held.r),
    "none on held ground",
  );
  assert.ok(
    all.every((t) => Math.abs(t.x - riverX) > 1.2 - 0.01),
    "none on the river's tiles",
  );
  // Past the trees, groves (crowns, no trunks) out to a little more than twice their reach, within the budget.
  const past = [...a.balls, ...a.cones].filter((t) => Math.hypot(t.x - 5, t.z - 2) > 4);
  assert.ok(past.length > 100 && past.length <= budget.groves, `${past.length} groves`);
  assert.ok(past.every((t) => Math.hypot(t.x - 5, t.z - 2) <= 4 * 2.2 + 1e-9));
  assert.ok(a.trunks.every((t) => Math.hypot(t.x - 5, t.z - 2) <= 4));
  const key = (t: { x: number; z: number }) => `${t.x.toFixed(5)},${t.z.toFixed(5)}`,
    seenA = new Set(a.balls.map(key)),
    both = b.balls.filter((t) => Math.hypot(t.x - 5.3, t.z - 1.85) < 1.5);
  const missing = both.filter((t) => !seenA.has(key(t)));
  assert.ok(
    both.length > 20 && !missing.length,
    `the same trees in the same places: ${both.length}, ${missing.length} not, e.g. ${JSON.stringify(missing[0])}; a ${a.trees}`,
  );
});

test("about a town: its ground coloured by its land's reading, trees by its woods, nothing on what it holds", async () => {
  const { floraWindow } = await import("../../src/bridge/index.ts");
  const { townBudget, townFlora, townGroundAt, townGroundOf, townEdge, townHeld } =
    await import("../../src/view/index.ts");
  const size = 16,
    read = floraRead(facts(size, 11, 1000, 9)),
    plan = {
      ref: "town:0:1",
      name: "Testford",
      population: 60,
      market: true,
      hand: false,
      districts: null,
      biome: 9,
      seed: 3,
      homes: [{ x: 20, z: 0, yaw: 0, household: "hhold:0:1" }],
      fields: [
        { x: 260, z: 0, w: 60, d: 40, yaw: 0.3 },
        { x: 250, z: 90, w: 60, d: 40, yaw: 0.2 },
      ],
      pasture: { x: -300, z: 0, r: 90 },
      wild: 400,
      water: null,
      house: { walls: "wattle", roof: "thatch", form: "long", pitch: 45, design: null },
      body: null,
      road: { x: 0, z: 1100 },
      people: [],
      landFlora: floraWindow(read, 4, 8, 6, 480),
    } as unknown as Parameters<typeof townGroundOf>[0];
  const g = townGroundOf(plan)!;
  assert.ok(g, "a reading");
  const f = townFlora(g, plan, 1200, townBudget(0.7)),
    edge = townEdge(plan);
  assert.ok(f.trees > 300, `${f.trees} trees in a broadleaf land`);
  const all = [...f.trunks, ...f.balls, ...f.cones, ...f.tufts, ...f.stones],
    held = townHeld(plan);
  assert.ok(held.length > 0, "its barns are held");
  assert.ok(
    all.every((t) => held.every((h) => Math.hypot(t.x - h.x, t.z - h.z) >= h.r)),
    "none on its barns, its fold, its graveyard",
  );
  for (const t of all) {
    assert.ok(Math.hypot(t.x, t.z) >= edge, "none in the town");
    assert.ok(
      Math.hypot(t.x - plan.pasture.x, t.z - plan.pasture.z) >= plan.pasture.r,
      "none on the pasture",
    );
    assert.ok(Math.abs(t.x) > 9 || t.z < 0 || t.z > 1110, "none on the road");
    for (const fl of plan.fields) {
      const c = Math.cos(fl.yaw),
        s = Math.sin(fl.yaw),
        u = (t.x - fl.x) * c - (t.z - fl.z) * s,
        v = (t.x - fl.x) * s + (t.z - fl.z) * c;
      assert.ok(!(Math.abs(u) < fl.w / 2 && Math.abs(v) < fl.d / 2), "none on a field");
    }
  }
  // A long town (its homes in a line 2 km along): its open ground across from them is as wild as any, but nothing stands
  // within 30 m of a home, nor in its middle.
  const line = {
      ...plan,
      homes: Array.from({ length: 81 }, (_, k) => ({
        x: -1000 + k * 25,
        z: 0,
        yaw: 0,
        household: `hhold:0:${k}`,
      })),
    } as typeof plan,
    lineEdge = townEdge(line),
    long = townFlora(townGroundOf(line)!, line, 1200, townBudget(0.7));
  assert.ok(lineEdge > 990);
  const inside = long.balls.filter((t) => Math.hypot(t.x, t.z) < lineEdge - 50);
  assert.ok(inside.length > 50, `${inside.length} trees within its farthest homes, off them`);
  for (const t of [...long.trunks, ...long.tufts, ...long.stones])
    assert.ok(
      Math.abs(t.z) > 30 || Math.abs(t.x) > 1030,
      `none on its homes' ground: ${t.x.toFixed(0)},${t.z.toFixed(0)}`,
    );
  // Its ground varies from point to point; a desert land's is sandier than this green one's.
  const a = townGroundAt(g, plan, 600, 600, edge),
    b = townGroundAt(g, plan, -900, 300, edge);
  assert.notDeepEqual(a, b);
  assert.ok(a[1] > a[0], "green ground in a broadleaf land");
  const desert = townGroundOf({
      ...plan,
      landFlora: floraWindow(floraRead(facts(size, 26, 120, 11)), 4, 8, 6, 480),
    })!,
    sand = townGroundAt(desert, plan, 600, 600, edge);
  assert.ok(sand[0] > sand[1] * 0.95 && sand[0] > a[0], `sand ${sand}`);
  assert.ok(townFlora(desert, plan, 1200, townBudget(0.7)).trees < f.trees / 8, "a desert's few");
});

test("a people of the water's: weed beds on the warm shallow shelf, nothing on the deep; their far crowns stand there and ashore, none on the deep", () => {
  const size = 16,
    n = size * size,
    elevation = new Float32Array(n),
    water = new Uint8Array(n);
  for (let t = 0; t < n; t++) {
    const i = t % size;
    elevation[t] = i < 6 ? -60 : i < 10 ? -3000 : 150;
    water[t] = i < 10 ? 1 : 0;
  }
  const f = facts(size, 18, 900, 9, { elevation, water }),
    read = floraRead(f, { undersea: true });
  assert.equal(read.cover[2], FLORA.reef);
  assert.ok(read.canopy[2]! > 100);
  assert.equal(read.cover[7], FLORA.none, "nothing on the deep sea floor");
  assert.equal(floraMix(FLORA.reef)[TREE_FORMS.indexOf("kelp")], 1);
  const land = floraLandOf({
    kind: "frame",
    view: "region",
    seq: 1,
    t: 0,
    meta: { ref: "regn:0:9", surfaceKey: "undersea", size, tileKm: 2.4, undersea: true },
    arrays: { elevation, water, biome: new Uint8Array(n).fill(9), flora: floraPack(read) },
  })!;
  const crowns = floraClumps(land, 2000);
  assert.ok(
    crowns.some((c) => c.tile % size < 6),
    "weed beds on the shelf",
  );
  assert.ok(
    crowns.every((c) => c.tile % size < 6 || c.tile % size >= 10),
    "none on the deep: on the shelf and ashore",
  );
});

test("past a town's own ground, its land's: open water, and its heights rising out of the flat it is built on", async () => {
  const { floraWindow, FLORA_WATER } = await import("../../src/bridge/index.ts");
  const { townGroundOf, townRiseAt, townWaterAt } = await import("../../src/view/index.ts");
  const size = 32,
    n = size * size,
    elevation = new Float32Array(n),
    water = new Uint8Array(n);
  for (let t = 0; t < n; t++) {
    const i = t % size;
    // (The sea to the west, the town's land at 100 m, hills rising east to 700 m.)
    water[t] = i < 8 ? 1 : 0;
    elevation[t] = i < 8 ? -50 : 100 + Math.max(0, i - 20) * 60;
  }
  const read = floraRead(facts(size, 11, 1000, 9, { elevation, water })),
    w = floraWindow(read, 14, 16, 12, 480, { water, elevation });
  assert.equal(w.tiles[(12 * 25 + 0) * 5], FLORA_WATER, "the sea's tiles are water");
  assert.equal(w.rise![12 * 25 + 12], 0, "the town's own tile at its own height");
  assert.ok(w.rise![12 * 25 + 24]! > 300, "the hills east above it");
  const plan = {
    ref: "town:0:2",
    seed: 1,
    kind: "terran",
    homes: [],
    fields: [],
    pasture: { x: -300, z: 0, r: 60 },
    road: { x: 0, z: 900 },
    landFlora: w,
  } as unknown as Parameters<typeof townGroundOf>[0];
  const g = townGroundOf(plan)!;
  assert.equal(townRiseAt(g, 3000, 0, 1500), townRiseAt(g, 3000, 0, 1500));
  assert.equal(townRiseAt(g, 1000, 0, 1500), 0, "flat within its own ground");
  assert.ok(townRiseAt(g, 5700, 0, 1500) > 300, "the hills risen far off");
  assert.ok(townWaterAt(g, -5000, 0) && !townWaterAt(g, 0, 0));
  assert.equal(townRiseAt(g, -5000, 0, 1500), 0, "the sea at its own level");
});
