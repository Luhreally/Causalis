// The law of lanes and the map of them (Phase 68): pure, the same every time, and an old save's store shape still loads.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LANE_LAW_SHARE,
  laneLaw,
  laneTable,
  lanesAmong,
  laneThrows,
  routeIn,
  routeMachines,
  routeYears,
  thrownYears,
  waysOf,
  type LaneStar,
} from "../src/rules/index.ts";
import { StarSiteStore } from "../src/sim/space/stars.ts";

test("the law: about two in three seeds, a dial overrides it, Earth starts with it on", () => {
  let open = 0;
  for (let i = 0; i < 2000; i++) if (laneLaw(`seed ${i}`, false).open) open++;
  assert.ok(Math.abs(open / 2000 - LANE_LAW_SHARE) < 0.04, `${open} of 2000`);
  assert.equal(laneLaw("x", true).open, true);
  assert.equal(laneLaw("x", true).by, "earth");
  assert.equal(laneLaw("x ~lanes shut", true).open, false);
  assert.equal(laneLaw("x ~lanes open", false).open, true);
  assert.equal(laneLaw("x ~lanes open", false).by, "dial");
  // (Another making leaves it as the seed has it.)
  assert.equal(laneLaw("x ~star red", false).open, laneLaw("x", false).open);
});

const line: LaneStar[] = [
  { ref: "a", x: 0, y: 0, z: 0, mass: 1 },
  { ref: "b", x: 5, y: 0, z: 0, mass: 1 },
  { ref: "c", x: 10, y: 0, z: 0, mass: 1 },
  { ref: "far", x: 400, y: 0, z: 0, mass: 1 },
];

test("a lane runs where no third star has a stronger tide with both; too thin a tide runs none", () => {
  const lanes = lanesAmong(line);
  assert.deepEqual(
    lanes.map((l) => [l.a, l.b]),
    [
      [0, 1],
      [1, 2],
    ],
  );
  assert.deepEqual(lanes, lanesAmong(line));
});

test("a way by lanes is quicker than the drive alone; a better drive still counts; the far star has none", () => {
  const lanes = lanesAmong(line),
    ways = waysOf(line.length, lanes),
    t = laneTable(line, lanes, ways, 0),
    r = routeIn(line, lanes, ways, t, 2)!;
  assert.equal(r.hops, 2);
  assert.equal(r.ly, 10);
  assert.ok(routeYears(r, 0.3) < 10 / 0.3);
  assert.ok(routeYears(r, 0.046) < 10 / 0.046);
  assert.ok(routeYears(r, 0.3) - 6 < routeYears(r, 0.046));
  assert.ok(routeMachines(r) > 0);
  assert.equal(routeIn(line, lanes, ways, t, 3), null);
});

test("a thin lane throws more ships, and being thrown costs years on the drive", () => {
  assert.ok(laneThrows(0.004) > laneThrows(0.04));
  assert.ok(laneThrows(0.004) <= 0.25);
  assert.ok(thrownYears(6, 0.02, 0.5, 0.046) > 50);
  assert.equal(thrownYears(6, 0.02, 1, 0.046), 0);
});

test("a save from before the lanes loads, and a world none has jumped in hashes and saves as it did", () => {
  const store = new StarSiteStore();
  store.load([]);
  assert.equal(store.first, null);
  assert.deepEqual(store.save(), []);
  const jumped = {
    sites: [],
    first: { event: "ev:0:1", name: "x" },
    visits: [{ event: "ev:0:2", arrived: null }],
  };
  store.load(jumped);
  assert.deepEqual(store.save(), jumped);
  assert.deepEqual(store.pinned(), ["ev:0:1", "ev:0:2"]);
});
