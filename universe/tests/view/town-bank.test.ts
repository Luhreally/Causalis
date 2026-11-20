import { test } from "node:test";
import assert from "node:assert/strict";
import { WATER } from "../../src/gen/index.ts";
import { landWater } from "../../src/host/sites.ts";
import {
  QUARTER,
  bankLake,
  bankOf,
  grownBlocks,
  quarterBearings,
  wetGround,
  type TownSite,
} from "../../src/bridge/index.ts";
import { LAND_ACROSS, facetWet, tileMiddle, townMiddle } from "../../src/view/index.ts";

// Asked 2026-11-20: a town whose own tile its land's map draws as water (a river's, most often) stood its square in the water,
// every block pushed off it, the first a median of more than 150 m out. It stands on its tile's bank: the nearest ground the
// map draws dry, its square's own ground dry about it, its water quarter toward the water; and its mark, name, roads, walls
// and fields are laid about that one point. A people of the water's has no bank.

const SIZE = 32,
  TILE_KM = 2.4;

/** A land of SIZE tiles a side, all dry but what `wet` says. */
function landOf(wet: (i: number, j: number) => number) {
  const water = new Uint8Array(SIZE * SIZE);
  for (let j = 0; j < SIZE; j++) for (let i = 0; i < SIZE; i++) water[j * SIZE + i] = wet(i, j);
  return {
    size: SIZE,
    tileKm: TILE_KM,
    water,
    heights: new Float32Array(SIZE * SIZE).fill(0.2),
    fertility: new Uint8Array(SIZE * SIZE).fill(120),
  };
}

const BASE: TownSite = {
  up: 0.4,
  rise: 6,
  lee: 2.2,
  roads: [
    { bearing: Math.PI / 2, busy: 3, rails: false, to: 1 },
    { bearing: -Math.PI / 2, busy: 1, rails: false, to: 2 },
  ],
  measured: -1,
  walled: null,
  dry: false,
};

const I = 16,
  J = 16,
  T = J * SIZE + I;
/** A river running north to south down column I, the town's own tile on it. */
const RIVER = landOf((i) => (i === I ? WATER.river : WATER.land));

test("a town on a river's tile stands on its bank, its square's ground dry, the river at its back", () => {
  const read = landWater(RIVER, I, J, false);
  assert.ok(read.wet && read.bank, "its tile is water: a bank is sought and found");
  const site: TownSite = { ...BASE, ...read },
    off = Math.hypot(read.bank.x, read.bank.z);
  // (A tile is 480 m on the town's ground: its own share reaches half of it each way.)
  assert.ok(off > 200 && off < 320, `the bank ${off.toFixed(0)} m from the tile's middle`);
  assert.ok(Math.abs(read.bank.x) > Math.abs(read.bank.z), "across the river, not along it");
  for (let k = 0; k <= 8; k++) {
    const a = (k * Math.PI) / 4,
      r = k === 8 ? 0 : 20;
    assert.ok(!wetGround(site, r * Math.cos(a), r * Math.sin(a)), `its square dry at ${k}`);
  }
  // (Where it stood, the water: read from its tile's middle, as before.)
  assert.ok(wetGround({ ...site, bank: { x: 0, z: 0 } }, 0, 0));
  // Its water quarter faces back toward the river.
  const { bearing } = quarterBearings(site, null, 0),
    toward = Math.atan2(-read.bank.z, -read.bank.x),
    off2 = Math.abs(
      Math.atan2(
        Math.sin(bearing[QUARTER.water]! - toward),
        Math.cos(bearing[QUARTER.water]! - toward),
      ),
    );
  assert.ok(off2 <= Math.PI / 8 + 1e-6, `water quarter ${off2.toFixed(2)} off the river`);
});

test("its first blocks stand close about its square, none on the water the land's map draws", () => {
  const read = landWater(RIVER, I, J, false),
    site: TownSite = { ...BASE, ...read },
    blocks = grownBlocks(77, site, 48, bankLake(read.bank!), Math.PI / 2),
    first = Math.hypot(blocks.x[0]!, blocks.z[0]!);
  assert.ok(first < 150, `the first block ${first.toFixed(0)} m from the square`);
  // On the land's map: the square and every block's middle over dry ground, the map's own facets read.
  const g = RIVER,
    m = townMiddle(g, { tile: T, plan: { site } }),
    t = tileMiddle(g, T);
  assert.ok(Math.abs(m.x - (t.x + read.bank!.x * LAND_ACROSS)) < 1e-9);
  assert.ok(!facetWet(g, m.x, m.z), "the square on dry ground as the map draws it");
  assert.ok(facetWet(g, t.x, t.z), "where it stood, the map's water");
  for (let b = 0; b < 48; b++) {
    const x = m.x + blocks.x[b]! * LAND_ACROSS,
      z = m.z + blocks.z[b]! * LAND_ACROSS;
    assert.ok(!facetWet(g, x, z), `block ${b} on the map's water`);
    assert.equal(wetGround(site, blocks.x[b]!, blocks.z[b]!), facetWet(g, x, z));
  }
});

test("a town on dry ground stays at its tile's middle; a people of the water's seeks no bank", () => {
  const beside = landWater(RIVER, I + 1, J, false);
  assert.ok(beside.wet && !beside.bank, "beside the river, on its own dry tile: no bank");
  assert.deepEqual(
    townMiddle(RIVER, { tile: T + 1, plan: { site: { ...BASE, ...beside } } }),
    tileMiddle(RIVER, T + 1),
  );
  assert.deepEqual(
    landWater(RIVER, I, J, true),
    {},
    "a people of the water's reads no water to keep off",
  );
  assert.deepEqual(
    townMiddle(RIVER, { tile: T, plan: null }),
    tileMiddle(RIVER, T),
    "a town with no plan drawn at its tile",
  );
});

test("a town the map has out on the water comes ashore on the nearest coast; with none in reach it stands where it was", () => {
  // (A lake seven tiles across: its shore two tiles and more off.)
  const lake = landOf((i, j) => (Math.hypot(i - I, j - J) <= 3 ? WATER.lake : WATER.land)),
    read = landWater(lake, I, J, false);
  assert.ok(read.wet && read.bank, "the shore of a lake seven tiles across is found");
  const off = Math.hypot(read.bank.x, read.bank.z) / 480;
  assert.ok(off > 2 && off < 4, `ashore ${off.toFixed(2)} tiles off`);
  assert.ok(!wetGround({ ...BASE, ...read }, 0, 0));
  // (Sea as far as its water is read: no shore.)
  const sea = landOf((i, j) => (Math.hypot(i - I, j - J) <= 9 ? WATER.sea : WATER.land)),
    out = landWater(sea, I, J, false);
  assert.ok(out.wet && !out.bank, "open sea: no bank found");
  assert.equal(bankOf(undefined), null);
  // (A lake three tiles across: its shore close.)
  const small = landOf((i, j) => (Math.hypot(i - I, j - J) <= 1 ? WATER.lake : WATER.land)),
    near = landWater(small, I, J, false);
  assert.ok(
    near.bank && Math.hypot(near.bank.x, near.bank.z) < 720,
    "a small lake's shore is found",
  );
  assert.ok(!wetGround({ ...BASE, ...near }, 0, 0));
});
