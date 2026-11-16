// Round A: the ground as stocks. Harvests take nutrients, rest, beans and dung give them back, and a world's crust and air set
// how fast; rain washes off bare slopes; watered fields gather salt; sour rain and metals foul, and are undone in time.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acidHarm,
  limiting,
  metalHarm,
  nutrientYear,
  saltHarm,
  supplyOf,
  thirstMm,
  washedOff,
} from "../../src/rules/index.ts";

const EARTH_PPM = (e: string) => ({ P: 1050, K: 20900 })[e as "P" | "K"] ?? 0;

test("a world's crust and air set which nutrient its fields lack first", () => {
  const earth = supplyOf(EARTH_PPM, []);
  assert.deepEqual(earth, { N: 1, P: 1, K: 1 });
  // A crust poor in phosphorus: it comes back slowest, and is what runs short.
  const poor = supplyOf((e) => (e === "P" ? 100 : EARTH_PPM(e)), ["nitrogen"]);
  assert.ok(poor.P < 0.4 && poor.N === 1);
  // An air of ammonia gives nitrogen freely besides what life fixes from its nitrogen.
  assert.equal(supplyOf(EARTH_PPM, ["ammonia", "methane"]).N, 2);
  assert.equal(supplyOf(EARTH_PPM, []).N, 1);
  assert.equal(limiting({ N: 0.8, P: 0.5, K: 0.9 }), "P");
});

test("a harvest wears the ground; rest, beans and dung give back; a century unrested wears it to a third", () => {
  const year = (s: number, i: Partial<Parameters<typeof nutrientYear>[2]> = {}) =>
    nutrientYear(s, "N", { farmed: 1, supply: 1, rotation: false, manure: 0, fertiliser: 0, ...i });
  let bare = 1,
    kept = 1;
  for (let y = 0; y < 60; y++) {
    bare = year(bare);
    kept = year(kept, { rotation: true, manure: 1 });
  }
  assert.ok(bare < 0.35, `${bare}`);
  assert.ok(kept > 0.85, `${kept}`);
  // Left to itself it heals.
  let rested = 0.4;
  for (let y = 0; y < 50; y++)
    rested = nutrientYear(rested, "N", {
      farmed: 0,
      supply: 1,
      rotation: false,
      manure: 0,
      fertiliser: 0,
    });
  assert.ok(rested > 0.7);
  // Fertiliser gives nitrogen, not phosphorus.
  assert.ok(year(0.5, { fertiliser: 0.05 }) > year(0.5));
  assert.equal(
    nutrientYear(0.5, "P", { farmed: 1, supply: 1, rotation: false, manure: 0, fertiliser: 0.05 }),
    nutrientYear(0.5, "P", { farmed: 1, supply: 1, rotation: false, manure: 0, fertiliser: 0 }),
  );
});

test("rain washes the topsoil off bare slopes, hardly off woods, half as much off terraces", () => {
  const at = (o: Partial<Parameters<typeof washedOff>[0]>) =>
    washedOff({ rainMm: 1000, slope: 0.02, farmed: 1, forest: 0, terraced: false, ...o });
  assert.ok(at({}) > 0.004 && at({}) < 0.006);
  assert.ok(at({ farmed: 0, forest: 1 }) < at({}) / 100);
  assert.ok(Math.abs(at({ terraced: true }) - at({}) / 2) < 1e-12);
  assert.ok(at({ slope: 0.06 }) > at({}) * 2.5);
  assert.ok(at({ rainMm: 250 }) < at({}) / 5);
});

test("what fouls the ground takes from its yield, and salt halves it at its measure", () => {
  assert.equal(acidHarm(0), 0);
  assert.ok(Math.abs(acidHarm(100) - 0.2) < 1e-12);
  assert.ok(Math.abs(metalHarm(300) - 0.2) < 1e-12);
  assert.ok(Math.abs(saltHarm(4000) - 0.5) < 1e-12);
  assert.ok(acidHarm(1e6) <= 0.4 && metalHarm(1e6) <= 0.4 && saltHarm(1e9) <= 0.8);
  assert.equal(thirstMm(-5), 0);
  assert.equal(thirstMm(25), 1500);
});
