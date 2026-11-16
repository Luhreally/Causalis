// Round D: the planet in motion as physics has it. Ice by its snow and summers, as thick as Nye's sheet; seas from
// melt; the overturning weakened by fresh water; a field from core and spin; a star brightening and ending.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ICE,
  belowFreezing,
  iceBalance,
  lightAt,
  magnetosphereOf,
  overturnOf,
  seaFromIce,
  sheetHeight,
  starLifeOf,
  swellOf,
  warmAbove,
} from "../../src/rules/index.ts";

test("a sinusoidal year's warmth above freezing and its share below", () => {
  assert.equal(warmAbove(10, 5), 10);
  assert.equal(warmAbove(-10, 5), 0);
  assert.ok(Math.abs(warmAbove(0, 10) - 10 / Math.PI) < 1e-9);
  assert.ok(Math.abs(belowFreezing(0, 10) - 0.5) < 1e-9);
  assert.equal(belowFreezing(-20, 5), 1);
});

test("a cold, snowy land grows ice; a land of warm summers loses it", () => {
  assert.ok(iceBalance(-25, 10, 300) > 0);
  assert.ok(iceBalance(-5, 15, 300) < 0);
});

test("Nye's sheet: kilometres thick a thousand km in, thicker under a weaker pull", () => {
  const earth = sheetHeight(1000, 1);
  assert.ok(earth > 2500 && earth < 4000, `${earth}`);
  assert.ok(sheetHeight(1000, 0.5) > earth);
});

test("Antarctica's ice raises Earth's seas some sixty metres; a degree swells them under a metre", () => {
  const rise = seaFromIce(26.5e6, 361e6);
  assert.ok(rise > 55 && rise < 75, `${rise}`);
  const swell = swellOf(1, "water");
  assert.ok(swell > 0.4 && swell < 1, `${swell}`);
  assert.ok(swellOf(1, "methane") > 10 * swell);
});

test("fresh water halves the overturning at a quarter sverdrup", () => {
  assert.equal(overturnOf(0, 0), 1);
  assert.ok(Math.abs(overturnOf(0.25, 0) - 0.5) < 1e-9);
  assert.ok(overturnOf(0, -3) > 1);
});

test("Earth's field holds the wind some ten radii out; a small old world and a slow one make little", () => {
  const earth = magnetosphereOf({
    mass: 1,
    radius: 1,
    dayHours: 24,
    ageGyr: 4.6,
    plates: 12,
    feH: 0,
    orbitAu: 1,
    starMass: 1,
    air: 1,
  });
  assert.ok(earth.dynamo && earth.dipole);
  assert.ok(earth.standoff > 8 && earth.standoff < 12, `${earth.standoff}`);
  assert.ok(Math.abs(earth.dose - 1) < 0.05, `${earth.dose}`);
  const mars = magnetosphereOf({
    ...earth,
    mass: 0.11,
    radius: 0.53,
    dayHours: 24.6,
    ageGyr: 4.6,
    plates: 0,
    feH: 0,
    orbitAu: 1.5,
    starMass: 1,
    air: 1,
  });
  assert.ok(!mars.dynamo && mars.dose > earth.dose);
  const slow = magnetosphereOf({
    mass: 1,
    radius: 1,
    dayHours: 80,
    ageGyr: 4.6,
    plates: 12,
    feH: 0,
    orbitAu: 1,
    starMass: 1,
    air: 1,
  });
  assert.ok(!slow.dipole && slow.shelter < earth.shelter);
});

test("the Sun brightens some ten in a hundred a billion years, swells, and ends a white dwarf", () => {
  assert.ok(lightAt(0.46) / lightAt(0) > 1.25 && lightAt(0.46) / lightAt(0) < 1.45);
  const sun = starLifeOf(1, 4.6, 10, 0);
  assert.equal(sun.stage, "main");
  assert.ok(sun.perKyr > 5e-8 && sun.perKyr < 1.5e-7, `${sun.perKyr}`);
  assert.equal(sun.end, "white dwarf");
  assert.ok(sun.endsIn! > 5e9);
  const late = starLifeOf(1, 9.95, 10, 0);
  assert.equal(late.stage, "giant");
  assert.equal(starLifeOf(10, 0.03, 0.0316, 2e6).stage, "ended");
  assert.equal(starLifeOf(10, 0.01, 0.0316, 0).end, "supernova");
  assert.ok(ICE.thin > 0);
});
