// The sweep's Nature lane, its rules: crops tamed and carried, volcanoes, floods, kinds of want.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CROPS,
  FLOOD,
  G,
  VOLCANO,
  adaptStep,
  ashLoss,
  cooledYield,
  cropFit,
  cropGives,
  cropYield,
  dietOf,
  eruptDead,
  eruptRate,
  floodChance,
  floodHarm,
  floodSize,
  gardenStrain,
  highSunShare,
  poissonCount,
  sulphurMt,
  sunMade,
  tameStep,
  veilCooling,
  veilLeft,
  veiOf,
  ventsOf,
  wantDeaths,
} from "../../src/rules/index.ts";

test("a wild stand sown gives less than its tamed crop, and sowing tames it in centuries, a heavy seed sooner", () => {
  assert.equal(cropYield(0), CROPS.wild);
  assert.equal(cropYield(1), 1);
  let light = 0,
    heavy = 0,
    garden = 0;
  for (let y = 0; y < 600; y += 5) {
    light = tameStep(light, 5, 0.2, 0.5, false);
    heavy = tameStep(heavy, 5, 0.9, 0.5, false);
    garden = tameStep(garden, 5, 0.5, 0.5, true);
  }
  assert.ok(heavy > light && light > garden, `${heavy} ${light} ${garden}`);
  assert.ok(heavy < 1, "not tamed within six centuries at half its land sown");
  let years = 0;
  for (let t = 0; t < 1; years += 5) t = tameStep(t, 5, 0.5, 0.5, false);
  assert.ok(years >= 800 && years <= 1200, `${years}`);
});

test("a crop fits the days it was bred under: carried east and west it gives as at home, north and south far less", () => {
  const home = { warm: 15, lat: 35, tolerance: 8, rainMin: 300, rainMax: 1200 };
  assert.equal(cropFit(home, { warm: 15, rain: 600, lat: 35 }), 1);
  const east = cropFit(home, { warm: 16, rain: 700, lat: 37 }),
    north = cropFit(home, { warm: 15, rain: 600, lat: 58 }),
    hot = cropFit(home, { warm: 40, rain: 600, lat: 35 });
  assert.equal(east, 1);
  assert.ok(north < 0.5, `${north}`);
  assert.ok(hot < 0.5 && hot >= CROPS.least, `${hot}`);
  // (Sown there long enough, it moves toward its new land's days.)
  let s = home;
  for (let y = 0; y < 1000; y += 5) s = adaptStep(s, { warm: 15, rain: 600, lat: 58 }, 5);
  assert.ok(cropFit(s, { warm: 15, rain: 600, lat: 58 }) > north);
});

test("a land sowing its own plant, tamed, gives as its fields always did; a heavier crop from afar more, to a bound", () => {
  assert.equal(cropGives(1, 1, 0.6, 0.6), 1);
  assert.ok(cropGives(1, 1, 0.95, 0.3) > 1.2);
  assert.ok(cropGives(1, 1, 1, 0) <= CROPS.most);
  assert.ok(cropGives(0, 1, 0.6, 0.6) < 1);
  const g = gardenStrain({ warm: 24, rain: 1800, lat: 5 });
  assert.equal(cropFit(g, { warm: 24, rain: 1800, lat: 5 }), 1);
});

test("eruptions keep their power law: each step rarer, a vent kind's greatest, and an arc's rate by its plates", () => {
  assert.equal(veiOf(0.9, "arc"), 3);
  assert.ok(veiOf(1e-4, "arc") >= 7 - 1);
  assert.equal(veiOf(1e-9, "island"), VOLCANO.most.island);
  assert.ok(veiOf(1e-9, "hotspot") <= 8);
  assert.ok(eruptRate("arc", 5, 2) > eruptRate("arc", 5, 1));
  assert.ok(ventsOf("arc", 120000) > 1 && ventsOf("hotspot", 120000) === 1);
  assert.equal(poissonCount(0, 0.5), 0);
  assert.equal(poissonCount(0.4, 0.5), 0);
  assert.ok(poissonCount(3, 0.99) >= 5);
  assert.ok(eruptDead(7) > eruptDead(4) && eruptDead(8) <= VOLCANO.deadMost);
  assert.equal(eruptDead(5, true), 0);
  assert.ok(ashLoss(6, true) > 0 && ashLoss(6, true) < ashLoss(6));
});

test("a great eruption's sulphur veils the world for a year or two, and a cold land's harvest loses most", () => {
  assert.equal(sulphurMt(3, 350), 0);
  const pinatubo = sulphurMt(6, 350),
    tambora = sulphurMt(7, 350);
  assert.ok(Math.abs(pinatubo - 17) < 0.01);
  assert.ok(tambora > 3 * pinatubo);
  assert.ok(Math.abs(veilCooling(pinatubo) - 0.45) < 1e-9);
  assert.ok(veilCooling(tambora) > 0.8 && veilCooling(tambora) < 1.2);
  assert.ok(veilLeft(1) > 0.4 && veilLeft(4) < 0.1);
  assert.equal(cooledYield(10, 12, 0), 1);
  const cold = cooledYield(3, 10, 1),
    warm = cooledYield(24, 4, 1);
  assert.ok(cold < warm && warm > 0.95, `${cold} ${warm}`);
  // (A world with less sulphur in its crust throws less.)
  assert.ok(sulphurMt(6, 50) < pinatubo);
});

test("a floodplain floods as often as its usual year makes it, more in a wet year and off cleared ground", () => {
  assert.ok(Math.abs(floodChance(1, 1) - 1 / FLOOD.returnYears) < 1e-9);
  assert.ok(floodChance(1.3, 1) > 4 * floodChance(1, 1));
  assert.ok(floodChance(0.7, 1) < floodChance(1, 1) / 4);
  assert.ok(floodChance(1, 0) > floodChance(1, 1));
  assert.equal(floodSize(1), 1);
  assert.ok(floodSize(0.05) > 2);
  const h = floodHarm(1);
  assert.ok(h.fields === FLOOD.fields && h.silt > 0 && h.dead < 0.001);
  assert.ok(floodHarm(10).fields <= FLOOD.fieldsMost);
});

test("a people fed on grain alone goes short and buries more of its young; a mixed diet and beans in the fields do not", () => {
  const grain = dietOf({ [G.grain]: 90, [G.wild]: 10, [G.meat]: 0 }),
    mixed = dietOf({ [G.grain]: 40, [G.wild]: 30, [G.meat]: 30 }),
    beans = dietOf({ [G.grain]: 90, [G.wild]: 10, [G.meat]: 0 }, "both", true),
    flesh = dietOf({ [G.grain]: 90, [G.wild]: 10, [G.meat]: 0 }, "flesh");
  assert.ok(grain.short > 0.3, `${grain.short}`);
  assert.ok(mixed.short < 0.05, `${mixed.short}`);
  assert.ok(beans.short < grain.short / 2, `${beans.short}`);
  assert.ok(flesh.short > grain.short);
  assert.equal(dietOf({}).short, 0);
  assert.deepEqual(wantDeaths(0), { young: 1, grown: 1 });
  assert.ok(wantDeaths(0.5).young > wantDeaths(0.5).grown);
});

test("the light lived: the noon sun stands high less of the year toward the poles, and a people far from its cradle or under smoke makes less", () => {
  assert.equal(highSunShare(0, 23.44), 1);
  assert.ok(highSunShare(55, 23.44) < highSunShare(40, 23.44));
  assert.equal(highSunShare(75, 23.44), 0);
  assert.equal(highSunShare(30, 0), 1);
  assert.equal(highSunShare(50, 0), 0);
  assert.equal(sunMade(5, 5, 23.44, 0), 1);
  assert.ok(sunMade(62, 5, 23.44, 0) < 1);
  assert.ok(sunMade(40, 5, 23.44, 1) < sunMade(40, 5, 23.44, 0));
  // (A people risen in the far north wants only the sun it had there.)
  assert.equal(sunMade(62, 62, 23.44, 0), 1);
  const north = dietOf({ [G.grain]: 90, [G.wild]: 10, [G.meat]: 0 }, "both", true, 0),
    fish = dietOf({ [G.grain]: 50, [G.wild]: 10, [G.meat]: 40 }, "both", true, 0);
  assert.ok(north.short > dietOf({ [G.grain]: 90, [G.wild]: 10 }, "both", true, 1).short);
  assert.equal(fish.sun, 1);
});
