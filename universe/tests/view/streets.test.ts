import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME_MONTHS, LEVEL, OCC } from "../../src/rules/index.ts";
import {
  BLOCK_D,
  BLOCK_LOTS,
  BLOCK_REACH,
  BLOCK_W,
  LAKE_R,
  SHORE,
  blocksHeld,
  lotStates,
  townLots,
  wallRing,
  type TownPlan,
  type VillagePlan,
} from "../../src/bridge/index.ts";
import {
  AVENUES,
  AVENUE_HALF,
  TownParts,
  avenueWay,
  clearOf,
  momentOf,
  route,
  sprawlOf,
  townGround,
  townScene,
  villageGround,
} from "../../src/view/index.ts";

// Phase 23: a town built lot by lot is laid about its water, its old walls pulled down where it
// has grown over them, and its people walk its streets — round its blocks, out at its gates,
// out along a great city's avenues — never through a home.

const YEAR_S = 365 * 86_400;

/** A town of `lots` homes raised in year 10, walled at `walled` lots in year 20, beside a lake. */
function town(over: Partial<TownPlan> = {}): TownPlan {
  const lots = over.lots ?? 480;
  return {
    family: "grid",
    seed: 11,
    axis: 0.3,
    lots,
    whole: lots,
    runs: [[0, 0, lots, 10, 10, LEVEL.house, -1]],
    civics: [],
    walls: { start: 20, end: 24, reach: 200 },
    months: HOME_MONTHS,
    designs: [{ since: -1, walls: "timber", roof: "thatch", form: "square", pitch: 40 }],
    paved: false,
    water: { x: 420, z: 80, r: LAKE_R },
    year: 30,
    ...over,
  };
}

/** The village about a town: its watched families in its first homes, farmers and crafters. */
function village(t: TownPlan): VillagePlan {
  const lots = townLots(t.family, t.seed, t.axis, t.lots, t.water),
    homes = Array.from({ length: 12 }, (_, k) => ({
      x: lots.x[k * 3]!,
      z: lots.z[k * 3]!,
      yaw: lots.yaw[k * 3]!,
      household: `hhold:0:${k}`,
    })),
    people = Array.from({ length: 36 }, (_, i) => ({
      ref: `prsn:0:${i}`,
      name: `P${i} Test`,
      home: i % 12,
      age: i % 9 === 8 ? 8 : 20 + ((i * 7) % 30),
      occupation: i % 9 === 8 ? OCC.dependent : i % 2 ? OCC.crafter : OCC.farmer,
      child: i % 9 === 8,
    }));
  return {
    ref: "town:0:5",
    name: "Streetford",
    population: 2400,
    market: true,
    hand: false,
    districts: null,
    biome: 8,
    seed: 5,
    homes,
    fields: [
      { x: -420, z: 30, w: 40, d: 25, yaw: 0 },
      { x: -380, z: -160, w: 40, d: 25, yaw: 0.4 },
      { x: 60, z: -460, w: 40, d: 25, yaw: 1 },
    ],
    pasture: { x: 30, z: 470, r: 90 },
    wild: 700,
    water: t.water ? { x: t.water.x, z: t.water.z } : null,
    house: { walls: "timber", roof: "thatch", form: "square", pitch: 40, design: null },
    body: null,
    road: { x: 1100 * Math.cos(t.axis), z: 1100 * Math.sin(t.axis) },
    people,
    town: t,
  };
}

/** Every step of a walk (a half metre apart): how near it comes to a block or a wall. */
function nearest(plan: VillagePlan, way: readonly { x: number; z: number }[]): number {
  const solids = villageGround(plan).town!.solids;
  let least = Infinity;
  for (let k = 0; k + 1 < way.length; k++) {
    const a = way[k]!,
      b = way[k + 1]!,
      steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5));
    for (let s = 0; s <= steps; s++) {
      const p = { x: a.x + ((b.x - a.x) * s) / steps, z: a.z + ((b.z - a.z) * s) / steps };
      for (const o of solids) least = Math.min(least, clearOf(o, p));
    }
  }
  return least;
}

test("a town's blocks are laid about its water, never in it, a shore kept along it", () => {
  const t = town({ lots: 1600 }),
    lots = townLots(t.family, t.seed, t.axis, t.lots, t.water),
    dry = townLots(t.family, t.seed, t.axis, t.lots, null);
  for (let b = 0; b < lots.blocks.x.length; b++)
    assert.ok(
      Math.hypot(lots.blocks.x[b]! - t.water!.x, lots.blocks.z[b]! - t.water!.z) >=
        t.water!.r + SHORE + BLOCK_REACH - 1e-3,
      `block ${b} in the water`,
    );
  // (Without the water some would have stood in it: the town grew round it.)
  let wet = 0;
  for (let b = 0; b < dry.blocks.x.length; b++)
    if (Math.hypot(dry.blocks.x[b]! - t.water!.x, dry.blocks.z[b]! - t.water!.z) < t.water!.r)
      wet++;
  assert.ok(wet > 0, "the lake lies where the town would have grown");
});

test("its walls stand where it has not grown over them, none in its water; grown over a third of their line, they are pulled down", () => {
  const walled = (count: number) => {
    const t = town({ lots: count }),
      lots = townLots(t.family, t.seed, t.axis, t.lots, t.water),
      held = blocksHeld(t, lotStates(t));
    return { t, lots, held, ring: wallRing(t, lots, held)! };
  };
  const { t, lots, held, ring } = walled(240),
    inBlock = (x: number, z: number) => {
      for (let b = 0; b < held.length; b++) {
        if (!held[b]) continue;
        const dx = x - lots.blocks.x[b]!,
          dz = z - lots.blocks.z[b]!,
          c = Math.cos(lots.blocks.yaw[b]!),
          s = Math.sin(lots.blocks.yaw[b]!);
        if (Math.abs(dx * c - dz * s) < BLOCK_W / 2 && Math.abs(dx * s + dz * c) < BLOCK_D / 2)
          return true;
      }
      return false;
    };
  assert.ok(
    ring.lengths.length > ring.n / 2 && ring.lengths.length < ring.n,
    `${ring.lengths.length} of ${ring.n} lengths stand`,
  );
  for (const l of ring.lengths) {
    assert.ok(!inBlock(l.x, l.z), `length ${l.k} stands in a block`);
    assert.ok(Math.hypot(l.x - t.water!.x, l.z - t.water!.z) > t.water!.r, `length ${l.k} wet`);
  }
  // A gate each way its road runs out.
  const gates = ring.lengths.filter((l) => l.gate).length;
  assert.ok(gates >= 1 && gates <= 2, `${gates} gates`);
  // Grown far past them: pulled down, every length.
  assert.equal(walled(1200).ring.lengths.length, 0);
});

test("a walk across a walled town keeps to its streets: round its blocks, out at its gates", () => {
  const plan = village(town({ lots: 240 })),
    ground = villageGround(plan),
    outside = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({
      x: (ground.homesReach + 60) * Math.cos(k * 0.8 + 0.2),
      z: (ground.homesReach + 60) * Math.sin(k * 0.8 + 0.2),
    })),
    insides = [{ x: 0, z: 0 }, ...plan.homes.map((h) => ({ x: h.x, z: h.z }))];
  assert.ok(ground.town && ground.town.solids.length > 50, "its blocks and walls stand solid");
  let walks = 0;
  for (const h of insides.slice(0, 6))
    for (const o of outside) {
      // (From the street before each home, or the square's middle.)
      const from = { x: h.x, z: h.z };
      if (!ground.town.clearAt(from, 1.2)) ground.town.keepOut(from, 1.2);
      for (const [a, b] of [
        [from, o],
        [o, from],
      ] as const) {
        const way = route(ground, a, b, 1.2);
        assert.deepEqual(way[0], a);
        assert.deepEqual(way.at(-1), b);
        const least = nearest(plan, way);
        assert.ok(least >= 1.2 - 1e-6, `a walk passes ${least.toFixed(2)} m from a wall`);
        walks++;
      }
    }
  assert.equal(walks, 96);
});

test("its people keep out of every block and wall through a day, each family's door on its street", () => {
  const plan = village(town({ lots: 240 })),
    ground = villageGround(plan),
    day = 31 * 365 + 40;
  let seen = 0;
  for (let s = 0; s < 86_400; s += 120)
    plan.people.forEach((p, i) => {
      const m = momentOf(plan, i, day * 86_400 + s);
      if (m.hidden) return;
      seen++;
      for (const o of ground.town!.solids)
        assert.ok(
          clearOf(o, m) >= 1.2 - 1e-6,
          `person ${i} in a wall at ${(s / 3600).toFixed(1)} h`,
        );
      for (const h of ground.homes)
        assert.ok(
          clearOf(h, m) >= 1.2 - 1e-6,
          `person ${i} in a home at ${(s / 3600).toFixed(1)} h`,
        );
      // At home: on the street before their own door.
      if (m.activity === 4 && s < 6 * 3600) {
        const h = plan.homes[p.home]!;
        assert.ok(Math.hypot(m.x - h.x, m.z - h.z) < 14, `person ${i} eats far from home`);
      }
    });
  assert.ok(seen > 500);
});

test("a great city's sprawl keeps its avenues clear, and its walkers go out along them", () => {
  const t = town({ lots: 480, whole: 9000, walls: null, water: null }),
    plan = village(t),
    ground = villageGround(plan),
    ring = sprawlOf(t, townLots(t.family, t.seed, t.axis, t.lots, null))!;
  assert.ok(ring && ring.r1 > ring.r0 + 200, "it sprawls");
  // No roof of its sprawl stands on an avenue.
  const parts = new TownParts();
  townGround(townScene(t, 31 * YEAR_S), parts);
  assert.ok(parts.count > 500);
  // Out to the fields past it, from the middle: along an avenue through the sprawl.
  const far = { x: (ring.r1 + 80) * Math.cos(2.0), z: (ring.r1 + 80) * Math.sin(2.0) },
    way = route(ground, { x: 0, z: 0 }, far, 1.2);
  for (let k = 0; k + 1 < way.length; k++) {
    const a = way[k]!,
      b = way[k + 1]!;
    for (let s = 0; s <= 20; s++) {
      const p = { x: a.x + ((b.x - a.x) * s) / 20, z: a.z + ((b.z - a.z) * s) / 20 },
        r = Math.hypot(p.x, p.z);
      if (r < ring.r0 + 30 || r > ring.r1 - 10) continue;
      const off = Math.min(
        ...Array.from({ length: AVENUES }, (_, i) => {
          const w = avenueWay(t, i);
          return Math.abs(-p.x * Math.sin(w) + p.z * Math.cos(w));
        }),
      );
      assert.ok(
        off < AVENUE_HALF,
        `in the sprawl ${off.toFixed(1)} m off its avenues at ${r.toFixed(0)} m`,
      );
    }
  }
  assert.ok(nearest(plan, way) >= 1.2 - 1e-6);
  assert.equal(BLOCK_LOTS, 8);
});

test("a walk kept wider of the walls (a bier's) leaves the walkers' own ways as they were", () => {
  // (Each reach its own ways through the town: made first for a wider one, a walker's walks are
  // the same as ever, and as clear of every wall.)
  const fresh = () => {
      const plan = village(town({ lots: 240 }));
      return { plan, ground: villageGround(plan) };
    },
    alone = fresh(),
    after = fresh();
  let walks = 0;
  for (const h of alone.plan.homes.slice(0, 4))
    for (let k = 0; k < 8; k++) {
      const from = { x: h.x, z: h.z },
        to = {
          x: (alone.ground.homesReach + 60) * Math.cos(k * 0.8 + 0.2),
          z: (alone.ground.homesReach + 60) * Math.sin(k * 0.8 + 0.2),
        };
      if (!alone.ground.town!.clearAt(from, 1.2)) alone.ground.town!.keepOut(from, 1.2);
      route(after.ground, from, to, 2.6);
      const way = route(after.ground, from, to, 1.2);
      assert.deepEqual(way, route(alone.ground, from, to, 1.2));
      assert.ok(nearest(after.plan, way) >= 1.2 - 1e-6);
      walks++;
    }
  assert.equal(walks, 32);
});
