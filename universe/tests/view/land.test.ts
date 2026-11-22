import { test } from "node:test";
import assert from "node:assert/strict";
import type { LandRoad, LandTown, TownPlan } from "../../src/bridge/index.ts";
import {
  GROUND,
  GroundClaims,
  TOWN_STEP,
  fieldCount,
  fieldEdge,
  fieldsMeant,
  layOn,
  rectsOverlap,
} from "../../src/bridge/index.ts";
import { hashString } from "../../src/kernel/index.ts";
import {
  FAIR_YEAR,
  LAND_ACROSS,
  fieldLook,
  groundAt,
  landClaims,
  landFields,
  linePieces,
  roadLine,
  roadLook,
  roadTiles,
  tileMiddle,
  tileOf,
  townScene,
  townThingAt,
  treesClear,
  type LandGround,
} from "../../src/view/index.ts";

// Phase 25 M150–M151: a land's towns, fields and roads as the land draws them, and what of a
// town a tap finds. Pure: a made-up land of sixteen tiles a side.

/** A land of `size` tiles a side, 1 km each, rising eastward; a lake down column 8 but its top row. */
function land(size = 16): LandGround {
  const n = size * size,
    heights = new Float32Array(n),
    water = new Uint8Array(n),
    fertility = new Uint8Array(n).fill(160);
  for (let t = 0; t < n; t++) {
    heights[t] = 0.1 + 0.02 * (t % size);
    if (t % size === 8 && Math.floor(t / size) > 0) water[t] = 3;
  }
  return { size, tileKm: 1, heights, water, fertility };
}

test("the land's ground under a point is on the terrain's own facets", () => {
  const g = land();
  for (const t of [0, 17, 100, 255]) {
    const m = tileMiddle(g, t);
    assert.ok(Math.abs(groundAt(g, m.x, m.z) - g.heights[t]!) < 1e-6, `tile ${t}`);
    assert.equal(tileOf(g, m.x, m.z), t);
  }
  // Halfway between two tiles, the height halfway between theirs.
  const a = tileMiddle(g, 33),
    b = tileMiddle(g, 34);
  assert.ok(
    Math.abs(groundAt(g, (a.x + b.x) / 2, a.z) - (g.heights[33]! + g.heights[34]!) / 2) < 1e-6,
  );
});

test("a road goes round the lake, over the dry ground, and is drawn as pieces laid on it", () => {
  const g = land(),
    tiles = roadTiles(g, 2 * 16 + 3, 12 * 16 + 13);
  assert.ok(tiles.length > 10, `${tiles.length} tiles`);
  assert.equal(tiles[0], 2 * 16 + 3);
  assert.equal(tiles.at(-1), 12 * 16 + 13);
  assert.ok(
    tiles.every((t) => g.water[t] !== 3),
    "never through the lake",
  );
  assert.ok(
    tiles.some((t) => Math.floor(t / 16) === 0),
    "round its top, the only way over",
  );
  for (let k = 1; k < tiles.length; k++) {
    const a = tiles[k - 1]!,
      b = tiles[k]!;
    assert.ok(
      Math.abs((a % 16) - (b % 16)) <= 1 && Math.abs(Math.floor(a / 16) - Math.floor(b / 16)) <= 1,
      "each step to a neighbour",
    );
  }
  const line = roadLine(g, tiles),
    pieces = linePieces(g, line, 0.01);
  assert.ok(pieces.length >= line.length - 1);
  for (const [x, y, z, len] of pieces) {
    assert.ok(len! > 0 && len! < 0.5, "short pieces, following the ground");
    assert.ok(Math.abs(y! - (groundAt(g, x!, z!) + 0.01)) < 0.02, "laid on the ground");
  }
  assert.deepEqual(roadTiles(g, 2 * 16 + 3, 12 * 16 + 13), tiles, "the same way each time");
});

test("a road is trodden from its year, paved and railed from theirs", () => {
  const road: LandRoad = {
    from: 0,
    to: 1,
    a: "town:0:1",
    b: "town:0:2",
    toward: null,
    since: 50,
    paved: 300,
    rails: 700,
    traffic: 2,
  };
  assert.equal(roadLook(road, 49), "none");
  assert.equal(roadLook(road, 50), "track");
  assert.equal(roadLook(road, 300), "paved");
  assert.equal(roadLook(road, 701), "rails");
  assert.equal(roadLook({ ...road, paved: null, rails: null }, 900), "track");
});

/** A town of the made-up land: its people, whether its land sows. */
function town(population: number, fields = true, tile = 5 * 16 + 4): LandTown {
  return {
    ref: `town:0:${population}`,
    name: "Testford",
    tile,
    population,
    founded: 10,
    city: false,
    fields,
    plan: null,
    key: 0,
  };
}

test("a town's fields: more for more people, on dry ground, none on another town's, none where its land does not sow", () => {
  const g = land(),
    at = tileMiddle(g, 5 * 16 + 4),
    small = landFields(g, town(150), at.x, at.z, 0.2),
    large = landFields(g, town(5000), at.x, at.z, 0.6);
  assert.ok(
    small.length >= 4 && large.length > 2 * small.length,
    `${small.length}, ${large.length}`,
  );
  for (const f of large) {
    assert.notEqual(g.water[tileOf(g, f.x, f.z)], 3, "none in the lake");
    assert.ok(Math.hypot(f.x - at.x, f.z - at.z) > 0.6, "outside the town");
  }
  assert.equal(landFields(g, town(5000, false), at.x, at.z, 0.6).length, 0);
  // The very fields its own view lays (host/village.ts), drawn LAND_SCALE times over: where nothing is in their way, each
  // where its view has it, as large and as turned, numbered as its view numbers them.
  const t = town(150),
    count = Math.ceil(150 / 5),
    edge = fieldEdge({
      lots: null,
      drawn: 0,
      whole: 0,
      city: false,
      cityRim: 600,
      count,
      spires: false,
    }),
    meant = layOn(
      new GroundClaims(TOWN_STEP, () => false),
      fieldsMeant(hashString(`village ${t.ref}`), 0, fieldCount(count), edge.edgeAt),
      GROUND.field,
      0,
      { x: 0, z: 0 },
      24,
      12,
    );
  assert.ok(meant.length >= 18, `${meant.length} laid by its own view`);
  let same = 0;
  for (const f of small) {
    const m = meant[f.k]!;
    if (
      Math.abs(at.x + m.x * LAND_ACROSS - f.x) < 1e-9 &&
      Math.abs(at.z + m.z * LAND_ACROSS - f.z) < 1e-9 &&
      Math.abs(m.w * LAND_ACROSS - f.w) < 1e-9 &&
      m.yaw === f.yaw
    )
      same++;
  }
  assert.ok(
    same >= small.length - 2,
    `${same} of ${small.length} where the town's own view lays them`,
  );
  // Laid once, its ground is taken: the next town's fields lie on none of it.
  const laid = landClaims(g),
    first = landFields(g, town(3000), at.x, at.z, 0.4, [], laid, undefined, 0),
    second = landFields(g, town(3000), at.x + 0.2, at.z, 0.4, [], laid, undefined, 1);
  assert.ok(first.length > 0);
  for (const f of second)
    assert.ok(
      first.every((e) => !rectsOverlap(e, f)),
      "no field on a field",
    );
});

test("a field of grain seen from afar through its year: bare earth, green, ripe gold, stubble, bare", () => {
  const plan = {
      ref: "town:0:7",
      era: "farm" as const,
      biome: 9,
      house: { walls: "timber" },
      seed: 7,
      fields: Array.from({ length: 30 }, () => ({ x: 0, z: 0, w: 40, d: 26, yaw: 0 })),
    } as unknown as Parameters<typeof fieldLook>[0],
    Y = 365 * 86_400,
    // (A field of grain: the town's own draw, view/country.ts cropsOf.)
    k = [...Array(30).keys()].find((i) => {
      const c = fieldLook(plan, i, 0.55 * Y, FAIR_YEAR, { w: 40, d: 26 });
      return c[1] > c[0] + 0.05;
    })!,
    at = (share: number) => fieldLook(plan, k, share * Y, FAIR_YEAR, { w: 40, d: 26 }),
    winter = at(0.05),
    summer = at(0.45),
    ripe = at(0.66),
    turned = at(0.9);
  assert.ok(k !== undefined, "a field of grain");
  assert.ok(winter[0] > winter[1] && winter[1] > winter[2], `bare earth in winter ${winter}`);
  assert.ok(summer[1] > summer[0] + 0.05, `green in summer ${summer}`);
  assert.ok(ripe[0] > 0.6 && ripe[1] > 0.5 && ripe[2] < 0.4, `ripe gold ${ripe}`);
  assert.deepEqual(turned, winter, "turned in after the harvest");
});

test("the woods are cleared from a town's ground", () => {
  const g = land(),
    trees = [0, 1, 2, 3].map((k) => ({
      tile: 5 * 16 + 3 + k,
      dx: 0,
      dz: 0,
      kind: "broadleaf" as const,
      size: 0.4,
    })),
    at = tileMiddle(g, 5 * 16 + 4),
    kept = treesClear(g, trees, [{ x: at.x, z: at.z, r: 1.2 }]);
  assert.deepEqual(
    kept.map((t) => t.tile),
    [5 * 16 + 6],
  );
});

/** A small town's plan: a row of houses, a market on its first block, walls about it. */
const PLAN: TownPlan = {
  family: "grid",
  seed: 7,
  axis: 0,
  lots: 40,
  whole: 40,
  runs: [
    [4, 0, 4, 10, 10, 1, -1],
    [0, 4, 40, 1, 9, 1, -1],
  ],
  civics: [{ kind: "market", at: 0, lots: 4, start: 10, end: 12, fell: null }],
  walls: { start: 14, end: 18, reach: 40 },
  months: [1, 3, 8, 14, 24, 36],
  designs: [{ since: -1, walls: "timber", roof: "thatch", form: "rect", pitch: 0.5 }],
  paved: false,
  water: null,
  year: 18,
};

test("a tap in a town finds one of its buildings, its walls, a lot of it — or nothing, on its square", () => {
  const YEAR = 365 * 86400,
    t = 30 * YEAR,
    scene = townScene(PLAN, t),
    market = scene.lots,
    // The market's middle: the middle of its first four lots.
    mx = (market.x[0]! + market.x[3]!) / 2,
    mz = (market.z[0]! + market.z[3]!) / 2;
  assert.deepEqual(townThingAt(scene, mx, mz, t), { kind: "civic", at: 0, start: 10 });
  assert.deepEqual(
    townThingAt(scene, mx, mz, 5 * YEAR),
    { kind: "lot", lot: 1 },
    "before it was begun, the lot its homes stood on",
  );
  assert.deepEqual(townThingAt(scene, scene.lots.x[20]!, scene.lots.z[20]!, t), {
    kind: "lot",
    lot: 20,
  });
  assert.equal(townThingAt(scene, 0, 0, t), null, "the square");
  const length = scene.walls!.lengths.find((l) => !l.gate)!;
  assert.deepEqual(townThingAt(scene, length.x, length.z, t), { kind: "walls" });
  assert.equal(
    townThingAt(scene, length.x, length.z, 10 * YEAR),
    null,
    "not before they were begun",
  );
});

test("a land's trees are cleared from its towns and fields as they would be read against every clearing, read only against those near", () => {
  const size = 64,
    tileKm = 2.4,
    g = { size, tileKm } as unknown as Parameters<typeof treesClear>[0],
    half = ((size - 1) * tileKm) / 2;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647,
    trees = Array.from({ length: 6000 }, () => ({
      tile: Math.floor(rnd() * size * size),
      dx: rnd() - 0.5,
      dz: rnd() - 0.5,
      size: 0.2 + rnd() * 0.8,
    })) as unknown as Parameters<typeof treesClear>[1],
    every = (clearings: { x: number; z: number; r: number }[]) =>
      trees.filter((t) => {
        const x = (t.tile % size) * tileKm - half + t.dx * tileKm,
          z = Math.floor(t.tile / size) * tileKm - half + t.dz * tileKm,
          h = 0.35 * t.size * tileKm;
        return clearings.every((c) => Math.hypot(x - c.x, z - c.z) > c.r + h);
      });
  for (const great of [false, true]) {
    const clearings = Array.from({ length: 900 }, () => ({
      x: rnd() * 2 * half - half,
      z: rnd() * 2 * half - half,
      r: great && rnd() < 0.01 ? 400 : rnd() * 3,
    }));
    assert.deepEqual(treesClear(g, trees, clearings), every(clearings));
  }
});
