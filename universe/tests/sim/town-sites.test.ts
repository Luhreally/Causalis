import { test } from "node:test";
import assert from "node:assert/strict";
import { World, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { CIVIC_SITE, HOLDS } from "../../src/rules/index.ts";
import {
  CIVIC_LOTS,
  TownBuilder,
  TownStore,
  floodGround,
  housingOf,
  levelsOf,
  quarterOf as simQuarter,
  townSeed,
  Civics,
  Runs,
  type Fabric,
  type PopulationContext,
} from "../../src/sim/index.ts";
import {
  BLOCK_D,
  BLOCK_W,
  HEART_BLOCKS,
  QUARTER,
  QUARTERS,
  grownBlocks,
  quarterOf,
  shopsBelow,
  townLots,
  type TownSite,
} from "../../src/bridge/index.ts";

// Asked 2026-11-16: a town's streets grown from its ground and its roads in, and its buildings sited by what they need of
// the ground. The sim and the eye reckon a block's quarter alike; the streets grown never cross, never stand in the water
// or across a road, never move as the town grows; what is built after walls keeps off their line; ground measured out is
// cut straight; a mill is begun toward the water, a smithy in the lee; a town wary of floods raises no home toward them.

const SITE: TownSite = {
  up: 0.6,
  rise: 14,
  lee: 2.4,
  roads: [
    { bearing: 0.3, busy: 4, rails: false, to: 1 },
    { bearing: 2.9, busy: 1, rails: false, to: 2 },
  ],
  measured: -1,
  walled: null,
  dry: false,
};
const LAKE = { x: 700, z: 120, r: 220 };

test("the sim and the eye take each block in the same quarter, each quarter once a round", () => {
  for (const town of ["town:a:1", "town:b:22", "town:c:333"]) {
    const seed = townSeed(town);
    for (let round = 0; round < 200; round++) {
      const seen = new Set<number>();
      for (let k = 0; k < QUARTERS; k++) {
        const b = round * QUARTERS + k;
        assert.equal(simQuarter(seed, b), quarterOf(seed, b), `${town} block ${b}`);
        seen.add(quarterOf(seed, b));
      }
      assert.equal(seen.size, QUARTERS, `${town} round ${round} has every quarter`);
    }
  }
});

/** Whether two blocks overlap (each its own rectangle). */
function overlap(ax: number, az: number, at: number, bx: number, bz: number, bt: number): boolean {
  const axes = [at, at + Math.PI / 2, bt, bt + Math.PI / 2].map((t) => [Math.cos(t), -Math.sin(t)]),
    half = (t: number, nx: number, nz: number) =>
      (BLOCK_W / 2) * Math.abs(Math.cos(t) * nx - Math.sin(t) * nz) +
      (BLOCK_D / 2) * Math.abs(Math.sin(t) * nx + Math.cos(t) * nz);
  return axes.every(
    ([nx, nz]) =>
      Math.abs((bx - ax) * nx! + (bz - az) * nz!) < half(at, nx!, nz!) + half(bt, nx!, nz!) - 0.5,
  );
}

for (const [name, site] of [
  ["grown", SITE],
  ["measured", { ...SITE, measured: 0 }],
  ["walled, measured past its walls", { ...SITE, measured: 30, walled: 240 }],
  ["on a steep hillside", { ...SITE, rise: 90 }],
] as const)
  test(`a town's streets grown (${name}): no block on another, in the water, or across a road; none moves as it grows`, () => {
    const n = 600,
      b = grownBlocks(77, site, n, LAKE, 0.3),
      few = grownBlocks(77, site, 120, LAKE, 0.3);
    for (let i = 0; i < 120; i++) {
      assert.equal(few.x[i], b.x[i]);
      assert.equal(few.z[i], b.z[i]);
      assert.equal(few.yaw[i], b.yaw[i]);
    }
    for (let i = 0; i < n; i++) {
      assert.ok(Math.hypot(b.x[i]! - LAKE.x, b.z[i]! - LAKE.z) > LAKE.r, `block ${i} in the lake`);
      for (const r of site.roads) {
        // (Its middle never on the road's line, ahead of the square.)
        const along = b.x[i]! * Math.cos(r.bearing) + b.z[i]! * Math.sin(r.bearing),
          across = -b.x[i]! * Math.sin(r.bearing) + b.z[i]! * Math.cos(r.bearing);
        assert.ok(along < 0 || Math.abs(across) > 6, `block ${i} across a road`);
      }
      for (let j = i + 1; j < n; j++)
        if (Math.hypot(b.x[i]! - b.x[j]!, b.z[i]! - b.z[j]!) < 50)
          assert.ok(
            !overlap(b.x[i]!, b.z[i]!, b.yaw[i]!, b.x[j]!, b.z[j]!, b.yaw[j]!),
            `blocks ${i} and ${j} overlap`,
          );
    }
    const measured = b.straight.reduce((a, x) => a + x, 0);
    if (site.measured < 0) assert.equal(measured, 0);
    else if (site.rise < 40)
      assert.ok(measured > (n - site.measured) * 0.9, `${measured} measured`);
    if (site.walled !== null) {
      // (Past the walls' blocks, none on their line.)
      const wallBlock = Math.ceil(site.walled / 8);
      let r = 0;
      for (let i = 0; i < wallBlock; i++) r = Math.max(r, Math.hypot(b.x[i]!, b.z[i]!));
      for (let i = wallBlock; i < n; i++)
        assert.ok(
          Math.abs(Math.hypot(b.x[i]!, b.z[i]!) - (r + 37)) > 20,
          `block ${i} on the walls' line`,
        );
    }
  });

test("each quarter of a town grows toward its own way: the water quarter toward the water, the lee downwind", () => {
  const b = grownBlocks(5, SITE, 400, LAKE, 0.3),
    toward = (q: number) => {
      let x = 0,
        z = 0;
      for (let i = HEART_BLOCKS; i < 400; i++)
        if (quarterOf(5, i) === q) {
          x += b.x[i]!;
          z += b.z[i]!;
        }
      return Math.atan2(z, x);
    },
    off = (a: number, w: number) => Math.abs(Math.atan2(Math.sin(a - w), Math.cos(a - w)));
  // (Each within a quarter's turn and a little: two that would lie the same way lie side by side.)
  assert.ok(off(toward(QUARTER.road), SITE.roads[0]!.bearing) < 0.3);
  assert.ok(off(toward(QUARTER.water), Math.atan2(LAKE.z, LAKE.x)) < 1);
  assert.ok(off(toward(QUARTER.lee), SITE.lee) < 1);
  assert.ok(off(toward(QUARTER.high), SITE.up) < 1);
});

test("a plan read with its site is laid by it, and the same plan read again lays its lots the same", () => {
  const a = townLots("grid", 9, 0.3, 160, LAKE, SITE),
    b = townLots("rings", 9, 0.3, 160, LAKE, SITE),
    old = townLots("grid", 9, 0.3, 160, LAKE);
  assert.deepEqual([...a.x], [...b.x], "no family where a site is read");
  assert.notDeepEqual([...a.x], [...old.x]);
  assert.equal(a.key, b.key);
});

test("shops stand under the tall homes near the square only", () => {
  assert.ok(shopsBelow(5, 4000, 3));
  assert.ok(shopsBelow(5, 4000, 4));
  assert.ok(!shopsBelow(5, 4000, 1));
  assert.ok(!shopsBelow(3900, 4000, 3));
});

/** A bare world holding only the towns' fabric, and one town's empty fabric in it. */
function bare(): { ctx: PopulationContext; f: Fabric; store: TownStore } {
  const world = new World(seedFromText("sites")),
    store = world.register(new TownStore()),
    ctx = { world } as unknown as PopulationContext;
  const f = store.add({
    town: "town:test" as Ref,
    family: "grid",
    phase: 0,
    next: 0,
    homes: HOLDS.map(() => 0),
    open: [],
    aim: -1,
    raise: 0,
    passed: -1,
    changes: new Runs(),
    civics: new Civics(),
    walls: null,
    lean: 0,
    forsaken: null,
    engines: -1,
    order: 0xfff,
    place: -1,
  });
  return { ctx, f, store };
}

test("a mill is begun on a block toward the water, a smithy in the lee, a granary high by the square, the station toward the way in", () => {
  const { ctx, f } = bare(),
    seed = townSeed(f.town);
  for (let y = 1; y <= 30; y++) new TownBuilder(ctx, y).grow(f, y * 120, 1, 1, -1);
  const b = new TownBuilder(ctx, 31),
    want = { water: QUARTER.water, lee: QUARTER.lee, high: QUARTER.high, road: QUARTER.road };
  for (const kind of ["mill", "smithy", "granary", "station", "docks", "factory"] as const) {
    const lots = CIVIC_LOTS[kind],
      at = b.siteBy(f, lots, CIVIC_SITE[kind], false),
      w = CIVIC_SITE[kind] as keyof typeof want;
    assert.equal(quarterOf(seed, Math.floor(at / 8)), want[w], `${kind} at ${at}`);
    assert.equal(Math.floor(at / 8), Math.floor((at + lots - 1) / 8), `${kind} within a block`);
    b.clearFor(f, at, lots);
    f.civics.add(0, at, lots, 31, 33);
  }
  // (The granary near the square: among the first rounds of the town.)
  const granary = b.siteBy(f, CIVIC_LOTS.granary, "high", false);
  assert.ok(granary < 8 * 8 * 3, `granary at ${granary}`);
});

test("a town wary of floods raises no new home toward its water past its heart, and reads back the same", () => {
  const { ctx, f, store } = bare(),
    seed = townSeed(f.town);
  for (let y = 1; y <= 40; y++) {
    const b = new TownBuilder(ctx, y);
    b.settle(f);
    b.grow(f, y * 150, 1, 1, -1, true);
  }
  const levels = levelsOf(f, 0, f.next);
  let flood = 0;
  for (let p = 0; p < f.next; p++)
    if (floodGround(seed, Math.floor(p / 8))) {
      flood++;
      assert.equal(levels[p], -1, `a home on flood ground at lot ${p}`);
    }
  assert.ok(flood > 40, `${flood} lots of flood ground passed over`);
  assert.ok(housingOf(f) >= 40 * 150, "every one housed");
  // (Its open lots read back from its runs as they were left.)
  const again = new TownStore();
  again.load(JSON.parse(JSON.stringify(store.save())));
  const g = again.get(f.town)!;
  assert.deepEqual(g.open, f.open);
});

test("from wherever its edge has come to, a building that wants a quarter finds a block of it", () => {
  const want = { water: QUARTER.water, lee: QUARTER.lee, high: QUARTER.high, road: QUARTER.road };
  for (let next = 0; next < 400; next += 3) {
    const { ctx, f } = bare(),
      seed = townSeed(f.town),
      b = new TownBuilder(ctx, 10);
    f.next = next;
    for (const w of ["water", "lee", "road"] as const)
      for (const lots of [1, 2, 4, 8]) {
        const at = b.siteBy(f, lots, w, false);
        assert.equal(quarterOf(seed, Math.floor(at / 8)), want[w], `${w} from ${next}: ${at}`);
        assert.ok(at >= next, `${w} from ${next}: at its edge`);
      }
  }
});
