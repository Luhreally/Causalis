// The planet's breadth (2026-11-23): what a land grows from its forces, where a world's air rests and how its seas sour, its slow
// swings and its star's companion, its storms, monsoons and slides, what a way of farming does, and life carried between worlds.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AVULSION,
  CARBON_CYCLE,
  avulsionChance,
  companionOf,
  coverOf,
  cycloneChance,
  cycloneSpin,
  cyclesOf,
  fieldNeeds,
  heatGrowth,
  landUseOf,
  lifeCarried,
  lightGrowth,
  monsoonOf,
  restingCarbon,
  seasSoured,
  shellsLeft,
  slideChance,
  summerWarmth,
  tillageOf,
} from "../../src/rules/index.ts";

test("a land's yields follow its warmth, rain, seasons and light", () => {
  const steppe = landUseOf(coverOf(14, 380, 10), 14),
    rainforest = landUseOf(coverOf(25, 1700, 1), 25),
    desert = landUseOf(coverOf(20, 120, 8), 20),
    tundra = landUseOf(coverOf(-5, 220, 14), -5);
  // Grassland grazes best; the closed forest gathers more than it grazes; the desert and the tundra give little.
  assert.ok(steppe.pasture > rainforest.pasture * 3);
  assert.ok(rainforest.forage > steppe.forage);
  assert.ok(desert.forage < 0.05 && tundra.arable < 0.02);
  // Under a dimmer sky the same land grows less, but not nothing; Earth's light is exactly Earth's.
  assert.equal(lightGrowth(1), 1);
  const dim = coverOf(14, 900, 10, 0.05).growth,
    sun = coverOf(14, 900, 10, 1).growth;
  assert.ok(dim < sun * 0.8 && dim > sun * 0.3);
});

test("a world's air rests where its rock's weathering takes down its fire's breath", () => {
  const earth = { land: 0.29, warmth: 16.5, rain: 930, outgas: 1, weathers: true };
  assert.equal(Math.round(restingCarbon(earth)), CARBON_CYCLE.rest);
  // A world of little land, or a cold one, weathers slowly and rests with more carbon; one of another liquid, as made.
  assert.ok(restingCarbon({ ...earth, land: 0.1 }) > 2 * CARBON_CYCLE.rest);
  assert.ok(restingCarbon({ ...earth, warmth: 8 }) > CARBON_CYCLE.rest);
  assert.equal(restingCarbon({ ...earth, land: 0.05, weathers: false }), CARBON_CYCLE.rest);
  // A doubling sours the seas about 0.3 of a pH, and their shells give less.
  assert.ok(Math.abs(seasSoured(560, 280) - 0.3) < 1e-9);
  assert.equal(shellsLeft(0), 1);
  assert.ok(shellsLeft(0.3) < 0.95);
});

test("a world's swings follow its moon, its day and what tugs it", () => {
  const earth = cyclesOf({
      starMass: 1,
      orbitAu: 1,
      dayHours: 24,
      ecc: 0.017,
      moons: [{ mass: 0.0123, a: 384.4 }],
      tuggers: [{ mass: 9.5e-4, a: 5.2 }],
      phases: [0, 0, 0],
    }),
    moonless = cyclesOf({
      starMass: 1,
      orbitAu: 1,
      dayHours: 24,
      ecc: 0.017,
      moons: [],
      tuggers: [{ mass: 9.5e-4, a: 5.2 }],
      phases: [0, 0, 0],
    });
  assert.ok(Math.abs(earth.precessYears - 25800) < 1000);
  assert.ok(earth.steadied && !moonless.steadied);
  assert.ok(moonless.tiltAmp > 5 * earth.tiltAmp && moonless.precessYears > 2 * earth.precessYears);
  // As the chronicle opens nothing has swung; the hemispheres' summers go opposite ways with the precession.
  assert.equal(summerWarmth(earth, 0, true), 0);
  const n = summerWarmth(earth, 5000, true),
    s = summerWarmth(earth, 5000, false);
  assert.ok(n !== s);
});

test("a companion star is born as often as its star's kind, and never so near as to tear its world away", () => {
  const sun = { mass: 1, luminosity: 1 };
  assert.equal(companionOf(sun, 1, [0.99, 0.5, 0.5, 0.5, 0.5]), null);
  const far = companionOf(sun, 1, [0.1, 0.5, 0, 0.5, 0.2]);
  assert.ok(far && far.a > 40 && far.share < 1e-3);
  // (Drawn at a tenth of an astronomical unit: no world at the home world's orbit could keep it.)
  assert.equal(companionOf(sun, 1, [0.1, 0.0001, 0.5, 0.5, 0.2]), null);
});

test("great storms want a warm sea and a spinning world; slopes fail when steep and soaked", () => {
  assert.equal(cycloneSpin(2, 24), 0);
  assert.ok(cycloneSpin(20, 24) > cycloneSpin(20, 96));
  assert.equal(cycloneChance(24, 1), 0);
  assert.ok(cycloneChance(29, 1) > 0);
  assert.ok(monsoonOf(7, 10, 2) > 0.5 && monsoonOf(7, 50, 2) === 0);
  assert.equal(slideChance(0.001, 1.5, 0), 0);
  assert.ok(slideChance(0.012, 1.4, 0) > slideChance(0.012, 1, 0));
  assert.ok(slideChance(0.012, 1, 1) < slideChance(0.012, 1, 0));
});

test("a way of farming gives as much as what it lifts held a land back", () => {
  const knows = (id: string) => id === "irrigation" || id === "plough",
    dry = tillageOf(knows, fieldNeeds(0.3, 6, 0.001, 0, 1)),
    wet = tillageOf(knows, fieldNeeds(1.4, 6, 0.001, 0.8, 1));
  assert.ok(dry.yields > wet.yields + 0.2);
  // The plough lets a farmer work more ground, and breaks the sod only where there is grass.
  assert.equal(dry.work, 1.25);
  assert.equal(wet.yields, 1);
  const grass = tillageOf(knows, fieldNeeds(1.4, 6, 0.001, 0, 1, 0.8));
  assert.ok(grass.yields > 1.4 && grass.work === 1.25, `${grass.yields}`);
});

test("life crosses between worlds only where the two lives can eat each other", () => {
  assert.equal(lifeCarried(false, true), 0);
  assert.ok(lifeCarried(true, true) > lifeCarried(true, false));
});

test("a river leaves its bed only in a great flood on a flat plain, the likelier the more silt it lays", () => {
  assert.equal(avulsionChance(AVULSION.size - 0.1, 0, 0.05), 0);
  assert.equal(avulsionChance(4, AVULSION.flat, 0.05), 0);
  const silted = avulsionChance(4, 0.002, AVULSION.silt),
    bare = avulsionChance(4, 0.002, 0),
    greater = avulsionChance(6, 0.002, AVULSION.silt);
  assert.ok(silted > bare && bare > 0, `${silted} ${bare}`);
  assert.ok(greater > silted && greater <= 0.25);
});

test("heat past a land's best takes its growth back; Earth's lands are untouched", () => {
  assert.equal(heatGrowth(27), 1);
  assert.ok(heatGrowth(50) < 0.7 && heatGrowth(50) > 0.5);
  const hot = coverOf(48, 1200, 2),
    warm = coverOf(26, 1200, 2);
  assert.ok(hot.growth < warm.growth, `${hot.growth} ${warm.growth}`);
});
