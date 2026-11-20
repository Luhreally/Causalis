import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BLOCK_D,
  BLOCK_LOTS,
  BLOCK_REACH,
  BLOCK_W,
  SQUARE,
  TOWER_TURN,
  WALL_BEARINGS,
  WALL_CLEAR,
  blocksHeld,
  heightHeld,
  lotStates,
  townLots,
  wallAt,
  wallLine,
  wallLineOf,
  wallLong,
  wallMean,
  wallOff,
  wallRing,
  wallRound,
  wallWalk,
  type TownPlan,
  type TownSite,
  type VillagePlan,
} from "../../src/bridge/index.ts";
import {
  TownParts,
  townGround,
  townScene,
  townWalls,
  villageGround,
} from "../../src/view/index.ts";
import { heightOf } from "../../src/view/townform.ts";
import { YEAR } from "../../src/kernel/index.ts";

// Asked 2026-11-20 ("are you fixing town to town being just circles"): a town's walls run the short way round the lots they
// were raised about, not a compass circle, and everything that stands on their line, keeps clear of it or comes up against
// it reads the one line (bridge/wall.ts).

const SITE: TownSite = {
  up: 0.6,
  rise: 14,
  lee: 2.4,
  roads: [
    { bearing: 0.3, busy: 4, rails: false, to: 1 },
    { bearing: 2.9, busy: 1, rails: false, to: 2 },
  ],
  measured: -1,
  walled: 160,
  dry: false,
};

/** A town of `lots` homes on a site, walled about its first 160. */
function town(lots: number, over: Partial<TownPlan> = {}): TownPlan {
  return {
    family: "lanes",
    site: SITE,
    seed: 77,
    axis: 0.3,
    lots,
    whole: lots,
    runs: [[0, 0, lots, 10, 12, 1, -1]],
    civics: [],
    walls: { start: 20, end: 24, reach: 160 },
    months: [1, 2, 4, 8, 12, 24, 36],
    designs: [{ since: -1, walls: "timber", roof: "thatch", form: "", pitch: 40 }],
    paved: false,
    water: null,
    year: 40,
    ...over,
  };
}
const lotsOf = (t: TownPlan) => townLots(t.family, t.seed, t.axis, t.lots, t.water, t.site ?? null);
const ringOf = (t: TownPlan) => {
  const lots = lotsOf(t);
  return { lots, ring: wallRing(t, lots, blocksHeld(t, lotStates(t)))! };
};
/** The corners of a block. */
function corners(x: number, z: number, yaw: number): [number, number][] {
  const c = Math.cos(yaw),
    s = Math.sin(yaw),
    out: [number, number][] = [];
  for (const u of [-1, 1])
    for (const v of [-1, 1])
      out.push([
        x + (u * c * BLOCK_W) / 2 + (v * s * BLOCK_D) / 2,
        z - (u * s * BLOCK_W) / 2 + (v * c * BLOCK_D) / 2,
      ]);
  return out;
}

test("a wall runs the short way round what it holds: no circle about a long town, shorter than one, never in on a block", () => {
  // Six blocks in a row along a road.
  const x = [-100, -60, -20, 20, 60, 100],
    z = [0, 0, 0, 0, 0, 0],
    yaw = [0, 0, 0, 0, 0, 0],
    line = wallLineOf(x, z, yaw, 6, BLOCK_W, BLOCK_D, [], SQUARE + 10, null);
  assert.equal(line.length, WALL_BEARINGS);
  assert.ok(wallRound(line) < 0.4, `${wallRound(line)} of it within a tenth of its mean`);
  // (Along the row it reaches past its ends; across it, a little past the square.)
  assert.ok(wallAt(line, 0) > 118 + WALL_CLEAR && wallAt(line, 0) < 135);
  assert.ok(wallAt(line, Math.PI / 2) < 50);
  // Every corner of every block within it, with room.
  for (let b = 0; b < 6; b++)
    for (const [cx, cz] of corners(x[b]!, z[b]!, yaw[b]!))
      assert.ok(wallOff(line, cx, cz) < -2, `a corner of block ${b} at the wall`);
  // Shorter than the circle about its furthest lot, as every wall was.
  const circle = 2 * Math.PI * (Math.hypot(118, 14) + 8);
  assert.ok(wallLong(line) < 0.75 * circle, `${wallLong(line)} m against ${circle}`);
  // The same blocks give the same line; a town about its square alone is as round as its square.
  assert.deepEqual(
    [...wallLineOf(x, z, yaw, 6, BLOCK_W, BLOCK_D, [], SQUARE + 10, null)],
    [...line],
  );
  assert.equal(wallRound(wallLineOf([], [], [], 0, BLOCK_W, BLOCK_D, [], SQUARE + 10, null)), 1);
});

test("where the short way round would stand in water the wall draws in to the bank, and never nearer than its lots", () => {
  // Blocks to the west and east of the square and north of it; a bay of water between its two southern arms.
  const x = [-80, 80, -80, 80, 0],
    z = [60, 60, -40, -40, -60],
    yaw = [0, 0, 0, 0, 0],
    wet = (px: number, pz: number) => pz > 50 && Math.abs(px) < 50,
    dry = wallLineOf(x, z, yaw, 5, BLOCK_W, BLOCK_D, [], SQUARE + 10, null),
    line = wallLineOf(x, z, yaw, 5, BLOCK_W, BLOCK_D, [], SQUARE + 10, wet),
    south = Math.PI / 2;
  // Toward the bay it comes in to the bank; away from it, it runs as it would have.
  assert.ok(
    wallAt(line, south) < wallAt(dry, south) - 2,
    `${wallAt(line, south)} against ${wallAt(dry, south)}`,
  );
  assert.ok(!wet(0, wallAt(line, south) - 3), "the wall's foot is dry");
  assert.ok(Math.abs(wallAt(line, -south) - wallAt(dry, -south)) < 1e-6);
  for (let b = 0; b < 5; b++)
    for (const [cx, cz] of corners(x[b]!, z[b]!, 0))
      assert.ok(wallOff(line, cx, cz) < -2, `a corner of block ${b} at the wall`);
});

test("a line walked: lengths of one size end to end, all the way round, the first where it is asked", () => {
  const line = wallLineOf(
      [-100, -60, -20, 20, 60, 100],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      6,
      BLOCK_W,
      BLOCK_D,
      [],
      SQUARE + 10,
      null,
    ),
    n = Math.round(wallLong(line) / 22),
    walk = wallWalk(line, n, 2.2, 0.5);
  assert.equal(walk.length, n);
  // (The first length's middle lies on the bearing asked.)
  assert.ok(Math.abs(walk[0]!.a - 2.2) < 0.03, `the first at ${walk[0]!.a}`);
  let turned = 0;
  for (const l of walk) {
    // (A length is straight: across a corner eased over eight metres its middle lies a few within the line.)
    assert.ok(Math.abs(wallOff(line, l.x, l.z)) < 5, `length ${l.k} off the line`);
    assert.ok(l.len > 14 && l.len < 23, `length ${l.k} ${l.len} m long`);
    // (Each ends where the next begins.)
    const next = walk[(l.k + 1) % n]!,
      ex = l.x + (Math.cos(l.yaw) * l.len) / 2,
      ez = l.z - (Math.sin(l.yaw) * l.len) / 2,
      sx = next.x - (Math.cos(next.yaw) * next.len) / 2,
      sz = next.z + (Math.sin(next.yaw) * next.len) / 2;
    assert.ok(Math.hypot(ex - sx, ez - sz) < 1e-6, `length ${l.k} ends apart from the next`);
    turned += l.turn;
  }
  // (Once round: a whole turn, a little more where the line bends in.)
  assert.ok(turned > 2 * Math.PI - 0.2 && turned < 2 * Math.PI + 1.5, `turned ${turned}`);
});

test("one line for all that reads a town's walls: its streets' clear ground, its lengths, gates and towers, its height, its walkers", () => {
  const t = town(400),
    { lots, ring } = ringOf(t),
    line = ring.line,
    walledBlocks = Math.ceil(160 / BLOCK_LOTS);
  // The line its streets were grown about is the line its walls stand on, and the one its page reads.
  assert.equal(lots.blocks.wall?.blocks, walledBlocks);
  assert.equal(line, lots.blocks.wall!.line);
  assert.deepEqual([...wallLine(160, lotsOf(town(160)), null, SITE)], [...line]);
  assert.equal(ring.r, wallMean(line));
  // No circle.
  assert.ok(wallRound(line) < 0.9, `${wallRound(line)} of it within a tenth of its mean`);
  // The blocks walled lie within it; those built after keep clear of it, either side.
  for (let b = 0; b < Math.ceil(400 / BLOCK_LOTS); b++) {
    const off = wallOff(line, lots.blocks.x[b]!, lots.blocks.z[b]!);
    if (b < walledBlocks) assert.ok(off < 0, `block ${b} outside its walls`);
    else assert.ok(Math.abs(off) >= BLOCK_REACH + 4 - 0.5, `block ${b} ${off} m from the line`);
  }
  // Its walls stand all the way round, each length on the line.
  assert.equal(ring.lengths.length, ring.n);
  for (const l of ring.lengths)
    assert.ok(Math.abs(wallOff(line, l.x, l.z)) < 5, `length ${l.k} off the line`);
  // A gate where each road in crosses it: the road's own line runs through the gate's length.
  const gates = ring.lengths.filter((l) => l.gate);
  assert.equal(gates.length, SITE.roads.length);
  for (const road of SITE.roads) {
    const near = Math.min(
      ...gates.map((l) =>
        Math.cos(road.bearing) * l.x + Math.sin(road.bearing) * l.z > 0
          ? Math.abs(-Math.sin(road.bearing) * l.x + Math.cos(road.bearing) * l.z)
          : Infinity,
      ),
    );
    assert.ok(near < 11, `the road at ${road.bearing} passes ${near} m from its gate`);
  }
  // (Its first road's runs through its gate's middle.)
  const first = gates.find((l) => l.k === 0)!;
  assert.ok(
    Math.abs(Math.atan2(first.z, first.x) - SITE.roads[0]!.bearing) < 0.03,
    "its first road's gate stands across the road",
  );
  // Towers at its turns: between one and the next the wall turns no more than a twelfth of the way round and a length's.
  const walk = wallWalk(line, ring.n, SITE.roads[0]!.bearing, 0.5),
    towers = ring.lengths.filter((l) => l.tower).map((l) => l.k);
  assert.ok(towers.length >= 10 && towers.length <= 16, `${towers.length} towers`);
  let since = 0,
    most = 0;
  for (const l of walk) {
    since += l.turn;
    if (towers.includes(l.k)) since = 0;
    most = Math.max(most, since);
  }
  assert.ok(most < TOWER_TURN + 0.25, `the wall turns ${most} between two towers`);
  // (More of them where it turns hardest than along its straightest run.)
  const turnAt = (k: number) => walk[k]!.turn,
    mean = walk.reduce((s, l) => s + l.turn, 0) / walk.length;
  assert.ok(
    towers.reduce((s, k) => s + turnAt(k), 0) / towers.length > mean,
    "its towers stand where it turns",
  );
  // The height it holds stands on the line, toward its high ground.
  const high = heightHeld(SITE, line, null, true, false)!;
  assert.ok(Math.abs(wallOff(line, high.x, high.z)) < 0.5);
  assert.ok(Math.abs(Math.atan2(high.z, high.x) - SITE.up) < 1e-6);
  // Its drawn walls are those lengths; its walkers' ground and a siege's storm read the same line.
  const seat = { realm: "r", name: "n", ruler: "x", color: [0.2, 0.3, 0.8], grade: 1 } as const,
    scene = townScene({ ...t, rank: { gini: 0.2, drives: false, seat } } as TownPlan, 40 * YEAR),
    parts = new TownParts();
  assert.equal(scene.walls!.line, line);
  assert.deepEqual(heightOf(scene) && { x: heightOf(scene)!.x, z: heightOf(scene)!.z }, {
    x: high.x,
    z: high.z,
  });
  townWalls(scene, 40 * YEAR, parts);
  let drawn = 0;
  for (const [key, g] of parts.groups)
    if (key.startsWith("box|"))
      for (let i = 0; i < g.data.length; i += 7, drawn++)
        assert.ok(
          Math.abs(wallOff(line, g.data[i]!, g.data[i + 2]!)) < 5,
          "a wall drawn off the line",
        );
  assert.equal(drawn, ring.lengths.length);
  const village: VillagePlan = {
    ref: "town:0:5",
    name: "Wallford",
    population: 2400,
    market: true,
    hand: false,
    districts: null,
    biome: 8,
    seed: 5,
    homes: [0, 1, 2].map((k) => ({
      x: lots.x[k]!,
      z: lots.z[k]!,
      yaw: lots.yaw[k]!,
      household: `hhold:0:${k}`,
    })),
    fields: [],
    pasture: { x: 30, z: 470, r: 90 },
    wild: 700,
    water: null,
    house: { walls: "timber", roof: "thatch", form: "square", pitch: 40, design: null },
    body: null,
    road: { x: 1100, z: 0 },
    people: [],
    town: t,
  };
  assert.equal(villageGround(village).town!.walls!.line, line);
});

test("pulled down, a ring street runs where the walls stood: on their line, not a circle's", () => {
  const t = town(640, { whole: 640 }),
    { ring } = ringOf(t);
  assert.equal(ring.lengths.length, 0, "grown to four times what they rang: down");
  const plan: TownPlan = {
      ...t,
      form: {
        ...({} as NonNullable<TownPlan["form"]>),
        engines: -1,
        over: false,
        green: 0,
        forum: 0,
        column: 0,
        drive: false,
      } as NonNullable<TownPlan["form"]>,
      paved: true,
    },
    scene = townScene(plan, 40 * YEAR),
    parts = new TownParts();
  townGround(scene, parts);
  // (Its lengths are the boxes nine metres broad and a hand high.)
  let on = 0;
  for (const [key, g] of parts.groups)
    if (key.startsWith("box|"))
      for (let i = 0; i < g.data.length; i += 7)
        if (g.data[i + 5] === 9 && Math.abs(g.data[i + 4]! - 0.06) < 1e-6) {
          assert.ok(
            Math.abs(wallOff(ring.line, g.data[i]!, g.data[i + 2]!)) < 5,
            "a length of its ring street off the line",
          );
          on++;
        }
  assert.ok(on >= 10, `${on} lengths of ring street`);
});
