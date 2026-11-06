// What a crossing costs a tonne, and what clears it (Phase 71): one function, no list of goods; a lane opens what a drive shuts.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  G,
  HOLD_TONNES,
  BULK_TONNES,
  STAR_DRIVES,
  burnPerTonne,
  cheapestCrossing,
  crossingBy,
  crossingByLanes,
  crossingWithin,
  cruise,
  holdOf,
  marginOf,
  survives,
  type LaneRoute,
} from "../../src/rules/index.ts";

const way: LaneRoute = {
    hops: 2,
    ly: 10,
    jump: 2.5,
    mouths: 0.08,
    tonnes: 200,
    stars: [0, 1, 2],
    tides: [0.01, 0.01],
    lengths: [5, 5],
  },
  fusion = STAR_DRIVES[0]!;

test("a rocket's fuel goes by its speed and not how far it goes", () => {
  assert.equal(crossingBy(fusion, 5).fuel, crossingBy(fusion, 50).fuel);
  assert.ok(crossingBy(fusion, 50).hull > crossingBy(fusion, 5).hull);
  assert.ok(
    burnPerTonne(STAR_DRIVES[2]!, cruise(STAR_DRIVES[2]!)) > burnPerTonne(fusion, cruise(fusion)),
  );
});

test("a lane makes ten light-years a tenth as dear, and a star's own worlds nearly free", () => {
  const drive = crossingBy(fusion, 10),
    lane = crossingByLanes(fusion, way);
  assert.ok(lane.machines < drive.machines / 4);
  assert.ok(lane.years < drive.years / 4);
  assert.ok(crossingWithin().machines < lane.machines / 4);
});

test("what clears is what is worth much for its weight; a lane opens the bulk goods", () => {
  const drive = crossingBy(fusion, 10),
    lane = crossingByLanes(fusion, way);
  assert.ok(marginOf(G.machines, 8, 72, drive, 8, 0) > 0);
  assert.ok(marginOf(G.pottery, 1, 9, drive, 8, 0) <= 0);
  assert.ok(marginOf(G.pottery, 1, 9, lane, 8, 0) > 0);
  assert.ok(marginOf(G.grain, 0.5, 1.5, lane, 8, 0) <= 0);
  assert.ok(marginOf(G.grain, 0.5, 1.5, crossingWithin(), 8, 0) > 0);
});

test("fear of raids takes from what clears; what spoils does not survive a long way", () => {
  const lane = crossingByLanes(fusion, way);
  assert.ok(marginOf(G.machines, 8, 40, lane, 8, 0.8) < marginOf(G.machines, 8, 40, lane, 8, 0));
  assert.ok(survives(G.meat, 50) < 0.01);
  assert.equal(survives(G.machines, 500), 1);
});

test("a hold takes the best for its weight first, within what it holds and what they can pay", () => {
  const lane = crossingByLanes(fusion, way),
    load = holdOf(
      [
        { good: G.pottery, here: 1, there: 9, spare: 1e12 },
        { good: G.machines, here: 8, there: 72, spare: 1e12 },
        { good: G.grain, here: 1, there: 1, spare: 1e12 },
      ],
      lane,
      8,
      1e12,
      0,
    );
  assert.equal(load[0]!.good, G.machines);
  assert.ok(load.every((l) => l.good !== G.grain));
  assert.ok(load[0]!.count * 0.6 * BULK_TONNES <= HOLD_TONNES);
  assert.deepEqual(
    holdOf([{ good: G.machines, here: 8, there: 72, spare: 1e12 }], lane, 8, 0, 0),
    [],
  );
});

test("no drive known, or a crossing longer than they would send their own on: no way", () => {
  assert.equal(
    cheapestCrossing(10, () => false, null, 300),
    null,
  );
  assert.equal(
    cheapestCrossing(1000, (id) => id === "fusion-drive", null, 120),
    null,
  );
  assert.equal(cheapestCrossing(0, () => false, null, 120)?.drive, "system");
});
