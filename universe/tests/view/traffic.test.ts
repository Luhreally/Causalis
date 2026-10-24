import { test } from "node:test";
import assert from "node:assert/strict";
import type { LandPlan, LandTown, TownPlan } from "../../src/bridge/index.ts";
import {
  CARRIERS,
  alongWay,
  landTidings,
  laneLine,
  tileOf,
  wayOf,
  type LandGround,
} from "../../src/view/index.ts";

// Phase 26 M153–M154: what goes along a land's ways — its sea lanes over the water, a carrier's
// place along a way out and back — and what its towns did lately, for their labels. Pure.

const YEAR = 365 * 86_400;

/** A land of `size` tiles a side, 1 km each: land to the west, sea from column 10 east, an island in it. */
function coast(size = 24): LandGround {
  const n = size * size,
    heights = new Float32Array(n),
    water = new Uint8Array(n),
    fertility = new Uint8Array(n).fill(160);
  for (let t = 0; t < n; t++) {
    const i = t % size,
      j = Math.floor(t / size);
    heights[t] = i >= 10 ? -0.2 : 0.1;
    if (i >= 10 && !(i >= 15 && i <= 17 && j >= 10 && j <= 13)) water[t] = 1;
  }
  return { size, tileKm: 1, heights, water, fertility };
}

test("a sea lane goes over the sea alone, from beside its port out toward the far land", () => {
  const g = coast(),
    port = 12 * 24 + 9,
    line = laneLine(g, port, 1, 0);
  assert.ok(line.length > 5, `${line.length} points`);
  for (const p of line) assert.equal(g.water[tileOf(g, p.x, p.z)], 1, "on the sea");
  const end = line.at(-1)!;
  assert.equal(tileOf(g, end.x, end.z) % 24, 23, "out to the map's edge the way it goes");
  // Southward it goes as far south as the sea runs; and from inland, nowhere.
  const south = laneLine(g, port, 0, 1).at(-1)!;
  assert.equal(Math.floor(tileOf(g, south.x, south.z) / 24), 23);
  assert.deepEqual(laneLine(g, 12 * 24 + 2, 1, 0), []);
});

test("a carrier goes along its way out and back, keeping to its right", () => {
  const w = wayOf([
    { x: 0, z: 0 },
    { x: 0, z: 3 },
    { x: 4, z: 3 },
  ]);
  assert.equal(w.length, 7);
  const out = alongWay(w, 1),
    turn = alongWay(w, 5),
    back = alongWay(w, 13);
  assert.deepEqual([out.x, out.z], [0, 1]);
  assert.ok(Math.abs(out.yaw - 0) < 1e-9, "heading south");
  assert.deepEqual([turn.x, turn.z], [2, 3]);
  assert.ok(Math.abs(turn.yaw - Math.PI / 2) < 1e-9, "then east");
  // Back past the corner: heading north again, a unit from home.
  assert.deepEqual([back.x, back.z], [0, 1]);
  assert.ok(Math.abs(Math.abs(back.yaw) - Math.PI) < 1e-9, "heading north, home");
  // Its right going south is the west; coming back north, the east.
  assert.ok(alongWay(w, 1, 0.2).x < 0);
  assert.ok(alongWay(w, 13, 0.2).x > 0);
});

test("what goes along a land's ways is of its era", () => {
  assert.equal(CARRIERS.forage.road, "none");
  assert.equal(CARRIERS.farm.road, "cart");
  assert.equal(CARRIERS.modern.road, "truck");
  assert.equal(CARRIERS.farm.sea, "sail");
  assert.equal(CARRIERS.industry.sea, "steam");
});

/** A town of a land at a moment: its lots ever taken, its buildings, its runs. */
function town(ref: string, whole: number, more: Partial<TownPlan> = {}, city = false): LandTown {
  const plan = {
    family: "grid",
    seed: 1,
    axis: 0,
    lots: whole,
    whole,
    runs: [],
    civics: [],
    walls: null,
    months: [3, 6, 9, 12, 18, 24],
    designs: [],
    paved: false,
    water: null,
    year: 0,
    ...more,
  } as unknown as TownPlan;
  return {
    ref,
    name: ref,
    tile: 0,
    population: whole * 4,
    founded: 1,
    city,
    fields: true,
    plan,
    key: whole,
  };
}

const planAt = (year: number, towns: LandTown[]): LandPlan => ({
  t: year * YEAR + 100,
  era: "farm",
  towns,
  roads: [],
  lanes: [],
  camps: [],
});

test("what each town did between two plans is told on its label in a few words", () => {
  const before = planAt(10, [town("a", 40), town("b", 12), town("c", 30)]),
    after = planAt(11, [
      town("a", 52, {
        civics: [{ kind: "market", at: 44, lots: 4, start: 11, end: 13, fell: null }],
        runs: [[1, 0, 6, 11, 11, 2, -1]],
      }),
      town("b", 12),
      town("c", 30, { walls: { start: 11, end: 14, reach: 30 } }, true),
      { ...town("d", 3), founded: 11 },
    ]);
  const told = landTidings(before, after);
  assert.equal(told.get("a"), "a market hall begun, +8 homes", "the two greatest");
  assert.equal(told.has("b"), false, "nothing done, nothing told");
  assert.equal(told.get("c"), "now a city, walls begun");
  assert.equal(told.get("d"), "founded");
  const lesser = landTidings(
    before,
    planAt(11, [town("a", 40, { runs: [[1, 0, 6, 10, 11, 2, -1]] })]),
  );
  assert.equal(lesser.get("a"), "3 rebuilt higher", "a run's lots shared over its years");
  // Nothing before, or the clock gone back: nothing told.
  assert.equal(landTidings(null, after).size, 0);
  assert.equal(landTidings(after, before).size, 0);
});
