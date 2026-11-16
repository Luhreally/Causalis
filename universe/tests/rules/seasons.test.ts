// Round D: seasons and days lived. Earth's own sky yields as the biomes have it; a world on its side, without tilt,
// of long nights or of a long year yields otherwise; its people's day by its light.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EARTH_SKY, dayOf, seasonOf } from "../../src/rules/index.ts";

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
