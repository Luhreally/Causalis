// What a people must have put by to see its reaping in, and how its births answer to what it holds of that.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EARTH_SKY,
  HARVEST,
  LEAN_MONTHS,
  THRIFT,
  dayOf,
  seasonOf,
  storeNeeded,
  thrift,
} from "../../src/rules/index.ts";

test("what must be held at the turn of a year is the months to the reaping's end, by the share of food that is reaped", () => {
  // A people who live by their fields alone: the months until the reaping is done, and the fortnight under which a
  // granary is lean.
  assert.equal(storeNeeded(1), 12 * HARVEST[1] + LEAN_MONTHS);
  assert.ok(storeNeeded(1) > 9 && storeNeeded(1) < 11, `${storeNeeded(1)} months`);
  // Those who gather, hunt and herd eat what the year brings month by month: only the fortnight.
  assert.equal(storeNeeded(0), LEAN_MONTHS);
  // Between: by the share reaped, evenly; never read past all or under none of it.
  assert.equal(storeNeeded(0.5), (storeNeeded(0) + storeNeeded(1)) / 2);
  assert.equal(storeNeeded(2), storeNeeded(1));
  assert.equal(storeNeeded(-1), storeNeeded(0));
});

test("a people's births answer smoothly to its store: all of them with what it needs put by, none with nothing", () => {
  const need = storeNeeded(1);
  assert.equal(thrift(need, 1), 1);
  assert.equal(thrift(2 * need, 1), 1, "no more children for a granary overfull");
  assert.equal(thrift(0, 1), 0);
  // No cliff: each month more put by is more kept, and a month short of the whole costs little.
  let last = 0;
  for (let m = 0.5; m <= need; m += 0.5) {
    const now = thrift(m, 1);
    assert.ok(now > last, `${m} months`);
    assert.ok(now - last < 0.25, `a step of ${now - last} at ${m} months`);
    last = now;
  }
  assert.ok(thrift(need - 1, 1) > 0.75);
  // By the share held, raised as hunger is.
  assert.equal(thrift(need / 2, 1), 0.5 ** THRIFT);
  // The same store is plenty for those who reap little of what they eat.
  assert.equal(thrift(1, 0), 1);
  assert.ok(thrift(3, 0.25) > thrift(3, 1));
});

// Round D: seasons and days lived. Earth's own sky yields as the biomes have it; a world on its side, without tilt,
// of long nights or of a long year yields otherwise; its people's day by its light.
const earth = (mean: number, swing: number) =>
  seasonOf(mean, swing, EARTH_SKY.tilt, EARTH_SKY.dayHours, EARTH_SKY.yearDays);

test("under Earth's own sky every land yields as its biome says", () => {
  for (const [m, s] of [
    [25, 2],
    [12, 9],
    [3, 14],
  ] as const)
    assert.ok(Math.abs(earth(m, s).factor - 1) < 1e-9);
});

test("a world turned on its side shortens a cool land's summer; a long night frosts it; a long year starves it", () => {
  const swingEarth = 10,
    onSide = seasonOf(8, swingEarth * ((0.35 + 60 / 40) / (0.35 + 23.44 / 40)), 60, 24, 365.25);
  assert.ok(onSide.factor < 1, `${onSide.factor}`);
  assert.ok(seasonOf(8, swingEarth, EARTH_SKY.tilt, 80, 365.25).factor < 1);
  const long = seasonOf(8, swingEarth, EARTH_SKY.tilt, 24, 1500);
  assert.ok(long.lean > 3 * earth(8, swingEarth).lean && long.factor < 1);
});

test("a day at the pole in summer never ends; a long day is slept in twice", () => {
  assert.ok(dayOf(1.5, 23.44, 24).midnightSun);
  assert.ok(dayOf(-1.5, 23.44, 24).polarNight);
  assert.equal(dayOf(0.5, 23.44, 48).sleeps, 2);
  assert.ok(Math.abs(dayOf(0, 23.44, 24).summerLight - 12) < 1e-6);
});
