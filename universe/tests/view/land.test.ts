import { test } from "node:test";
import assert from "node:assert/strict";
import type { LandRoad, LandTown, TownPlan } from "../../src/bridge/index.ts";
import {
  cropAt,
  groundAt,
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
  const other = { x: at.x + 1.5, z: at.z, r: 0.8 },
    beside = landFields(g, town(5000), at.x, at.z, 0.6, [other]);
  assert.ok(beside.every((f) => Math.hypot(f.x - other.x, f.z - other.z) > other.r));
  // Laid once, a cell is not laid again by the next town.
  const laid = new Map(),
    first = landFields(g, town(3000), at.x, at.z, 0.4, [], laid),
    second = landFields(g, town(3000), at.x + 0.2, at.z, 0.4, [], laid);
  assert.ok(first.length > 0);
  for (const f of second)
    assert.ok(
      first.every((e) => Math.hypot(e.x - f.x, e.z - f.z) > 0.3),
      "no field on a field",
    );
  // Through the year: ploughed, green, ripe, stubble.
  const f = small[0]!;
  assert.deepEqual(
    [0.05, 0.35, 0.6, 0.75, 0.95].map((y) => cropAt({ ...f, sown: 0 }, y)),
    [0, 1, 2, 3, 0],
  );
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
