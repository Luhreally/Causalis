// Canals (rules/canals.ts): dug where the trade saved is more than the work of digging; and a ship's clocks
// (rules/crossing.ts clockSlips, crossingClocks).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CANAL,
  canalSaves,
  canalWork,
  clockSlips,
  crossingClocks,
  lorentz,
  weighCanal,
} from "../../src/rules/index.ts";

test("the work of a canal is its length of cut and a lock for each rise", () => {
  assert.equal(canalWork(100, 0), 100 * CANAL.digPerKm);
  assert.equal(canalWork(100, 30) - canalWork(100, 0), 10 * CANAL.lockWork);
  assert.equal(canalWork(0, 0), 0);
  assert.ok(Math.abs(canalSaves(1000) - 1000 * (1 - CANAL.carries)) < 1e-9);
});

test("a realm digs where the trade passing saves more than the digging costs, with water and hands", () => {
  const road = { km: 150, climb: 40, people: 2_000_000, watered: true },
    work = canalWork(150, 40),
    // The carrying a year at which thirty years' saving just pays the diggers' keep.
    even = (work * CANAL.keep) / (CANAL.horizon * (1 - CANAL.carries));
  const thin = weighCanal({ ...road, haul: even * 0.9 }),
    busy = weighCanal({ ...road, haul: even * 1.1 });
  assert.ok(!thin.dig);
  assert.match(thin.why!, /would not save/);
  assert.ok(busy.dig && busy.why === null);
  assert.ok(busy.saved > busy.cost);
  // The same trade over broken ground does not pay; nor on a road with no water to fill it; nor for a small realm.
  assert.ok(!weighCanal({ ...road, climb: 400, haul: even * 1.1 }).dig);
  assert.match(weighCanal({ ...road, watered: false, haul: even * 3 }).why!, /no river or lake/);
  const small = weighCanal({ ...road, people: 20_000, haul: even * 3 });
  assert.ok(!small.dig);
  assert.match(small.why!, /too few hands/);
  assert.ok(small.years > CANAL.years);
  // Its diggers are kept out of its granaries: with too little in store, none is begun.
  const lean = weighCanal({
    ...road,
    haul: even * 3,
    grain: (work * CANAL.keep) / CANAL.spare - 1,
  });
  assert.ok(!lean.dig);
  assert.match(lean.why!, /too little grain/);
  assert.ok(weighCanal({ ...road, haul: even * 3, grain: (work * CANAL.keep) / CANAL.spare }).dig);
  // A longer road asks more trade.
  assert.ok(!weighCanal({ ...road, km: 400, haul: even * 1.1 }).dig);
});

test("a ship's clock lets as many home years go by unlived as it has fallen behind", () => {
  for (const [v, home] of [
    [0.3, 400],
    [0.12, 1000],
    [0.046, 2000],
  ] as const) {
    let slipped = 0;
    for (let n = 1; n <= home; n++) if (clockSlips(n, v)) slipped++;
    assert.equal(slipped, Math.floor(home * (1 - 1 / lorentz(v))), `${v}`);
  }
  assert.ok(!clockSlips(5, 0));
  assert.ok(!clockSlips(1, 0.3));
  // At three-tenths of light's speed, the first comes in the twenty-second year.
  let first = 0;
  for (let n = 1; !first; n++) if (clockSlips(n, 0.3)) first = n;
  assert.equal(first, 22);
});

test("a crossing by each end's clock, and when its word reaches home", () => {
  const c = crossingClocks(12, 40);
  assert.ok(Math.abs(c.v - 0.3) < 1e-12);
  assert.ok(Math.abs(c.aboard - 40 * Math.sqrt(1 - 0.09)) < 1e-9);
  assert.equal(c.home, 40);
  assert.equal(c.word, 12);
  // Within one star's worlds no speed worth the name: the clocks agree.
  const near = crossingClocks(0, 1);
  assert.equal(near.aboard, 1);
  assert.equal(near.word, 0);
});
