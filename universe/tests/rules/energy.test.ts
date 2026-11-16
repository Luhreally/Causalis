// Round A: energy as one budget. The heat in a fuel is its reaction's, against what its air holds to burn it with; a heat
// engine turns no more of it to work than Carnot allows at what its stuffs bear; a land's account draws the nearest first.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CARRIERS,
  FUEL_MAKEUP,
  FUEL_UNIT_KWY,
  GOOD_MATTER,
  MJ_A_KWY,
  SOURCES,
  bestHeat,
  bodyKw,
  carnot,
  craftShare,
  energyAccount,
  engineDriven,
  engineShare,
  fuelUnitKg,
  growthTkm2,
  heatMjKg,
  heldHeat,
  mixMjKg,
  oxidantsOf,
  riverKw,
  type EnergyInputs,
  type Source,
} from "../../src/rules/index.ts";

const near = (x: number, want: number, within: number, what: string) =>
  assert.ok(Math.abs(x - want) <= within, `${what}: ${x.toFixed(3)} against ${want}`);

test("a fuel's heat is its reaction's, from the heats of formation, against what its air holds", () => {
  // (Handbook heats of burning, lower heating value.)
  near(heatMjKg("carbon", "oxygen"), 32.8, 0.1, "carbon");
  near(heatMjKg("methane", "oxygen"), 50.0, 0.2, "methane");
  near(heatMjKg("crude", "oxygen"), 44.1, 0.3, "a long chain of crude");
  near(heatMjKg("cellulose", "oxygen"), 16.1, 0.3, "wood's fibre");
  near(heatMjKg("sulphur", "oxygen"), 9.26, 0.05, "sulphur");
  near(heatMjKg("hydrogen", "oxygen"), 120, 1, "hydrogen");
  // A methane world's acetylene joined with its air's hydrogen gives 377 kJ a mole (F1).
  near(heatMjKg("acetylene", "hydrogen"), 14.5, 0.1, "acetylene with hydrogen");
  // What is burned already gives nothing.
  assert.equal(heatMjKg("co2", "oxygen"), 0);
  assert.equal(heatMjKg("water", "oxygen"), 0);
  // Coal and oil as the market counts them: their make-up, a fifth of wood water.
  near(mixMjKg(FUEL_MAKEUP.coal!, "oxygen"), 26.3, 0.5, "coal");
  near(mixMjKg(FUEL_MAKEUP.oil!, "oxygen"), 42.8, 0.5, "oil");
  near(mixMjKg(FUEL_MAKEUP.wood!, "oxygen"), 12.4, 0.5, "air-dried wood");
});

test("what a world can burn with is what its air holds", () => {
  const earth = oxidantsOf({ freeOxygen: true, airHolds: ["nitrogen", "oxygen"] }),
    titan = oxidantsOf({ freeOxygen: false, airHolds: ["nitrogen", "methane", "hydrogen"] }),
    dead = oxidantsOf({ freeOxygen: false, airHolds: ["co2", "nitrogen"] });
  assert.deepEqual(earth, ["oxygen"]);
  assert.deepEqual(titan, ["hydrogen"]);
  assert.deepEqual(dead, []);
  assert.equal(bestHeat(FUEL_MAKEUP.wood!, dead).mj, 0, "nothing burns in a dead air");
  assert.ok(
    bestHeat(FUEL_MAKEUP.haze!, titan).mj > 5,
    "a methane world's haze joins with its hydrogen",
  );
});

test("a unit of buried fuel holds four kilowatt-years, whatever it weighs", () => {
  for (const f of ["coal", "oil"] as const) {
    const kg = fuelUnitKg(f);
    near((kg * mixMjKg(FUEL_MAKEUP[f]!, "oxygen")) / MJ_A_KWY, FUEL_UNIT_KWY, 1e-9, f);
    // The pages' matter is the same make-up.
    const parts = GOOD_MATTER[f]!.ways[0]!.parts.map(([s, x]) => [s, x] as const);
    near(GOOD_MATTER[f]!.unitKg, kg, 10, `a unit of ${f} as the pages weigh it`);
    assert.deepEqual(parts, FUEL_MAKEUP[f], `${f}'s make-up as the pages show it`);
  }
});

test("an engine turns no more than Carnot allows at what its stuffs bear, its craft's share of that", () => {
  near(carnot(100, 273.15 + 15), 0.228, 0.001, "a hundred degrees over Earth's air");
  // A colder world sheds its heat the more easily.
  assert.ok(carnot(300, 94) > carnot(300, 288));
  // Wrought iron's boilers some 280 °C, steel's 440; finer fits leak less.
  near(heldHeat(370), 276, 2, "wrought iron");
  near(heldHeat(800), 442, 2, "steel");
  assert.ok(craftShare(0.1) < 0.06 && craftShare(0.002) > 0.6);
  // Watt's engine on coal: some two in a hundred; a turbine of the age of guidance, some two in five.
  near(
    engineShare(1500, 288, 0.1, 370),
    0.024,
    0.006,
    "steam on wrought iron at a tenth of a millimetre",
  );
  near(engineShare(1500, 288, 0.002, 3500), 0.43, 0.03, "a fine turbine");
  // A fire hotter than the stuff holds gives no more.
  assert.equal(engineShare(3000, 288, 0.01, 800), engineShare(500, 288, 0.01, 800));
});

test("bodies, rivers and woods: a body's need by its weight, a river's fall, a forest's growth by warmth and rain", () => {
  near(bodyKw(60), 0.1, 1e-9, "an ape's");
  near(bodyKw(500), 0.49, 0.01, "an ox's at rest");
  // Earth's lands: a temperate forest some 1,200 tonnes a square kilometre, a rain forest twice it, a cold steppe a third.
  near(growthTkm2(12, 800, 1), 1236, 20, "temperate");
  assert.ok(growthTkm2(26, 2500, 1) > 2000 && growthTkm2(-5, 300, 1) < 450);
  assert.ok(growthTkm2(12, 800, 0.1) < 130, "a hazed star's light grows a tenth");
  // A river of 1,000 m³/s falling 100 m: about a gigawatt (ρ g Q h).
  const discharge = ((1000 / 0.35) * 3.15576e7 * 1e6) / (6.371e6 * 6.371e6);
  near(riverKw(discharge, 100, 1, 1) / 1e6, 0.981, 0.01, "GW");
});

test("the principles that carry by engine are found by what they ease and what they need", () => {
  const ids = engineDriven().map((d) => d.id);
  assert.ok(ids.includes("railways") && ids.includes("steamships") && ids.includes("engines"));
  assert.ok(!ids.includes("cart") && !ids.includes("draught"), `${ids}`);
});

const LAND: EnergyInputs = {
  people: 100_000,
  workers: 60_000,
  farmers: 40_000,
  crafters: 10_000,
  traders: 4_000,
  appetite: 1,
  fed: 1,
  herdKg: 5e6,
  beastKg: 500,
  draught: true,
  grain: 1e6,
  cold: 0.3,
  fire: true,
  smelted: 500,
  blast: false,
  industry: 0,
  carried: 0,
  homes: false,
  taps: new Set<Source>(),
  engine: false,
  woodKw: 5e5,
  riverKw: 2e5,
  windKw: 1e5,
  tideKw: 0,
  groundKw: 1e7,
  groundC: 90,
  ventKw: 0,
  ventC: 464,
  lightWm2: 200,
  mirrorC: 1787,
  coalKwy: 0,
  oilKwy: 0,
  gasKwy: 0,
  ownKwy: 0,
  fireC: 1250,
  coldK: 288,
  fitMm: 0.1,
  strengthMpa: 370,
  coalKnown: false,
  oilKnown: false,
};

test("a farming land's account: its bodies, its beasts and its woods' heat", () => {
  const a = energyAccount(LAND);
  near(a.drawn.muscle, 10_000, 1, "a tenth of a kilowatt each");
  assert.ok(a.drawn.beasts > 0 && a.drawn.wood > 0);
  assert.equal(a.workWanted, 0, "no works, no engines' work wanted");
  near(a.heatHad, a.heatWanted, 1e-6, "its woods warm it");
  assert.equal(a.felled, 0, "within what its woods give");
  assert.equal(a.coal + a.oil + a.gas, 0);
  assert.equal(a.drives, "none");
  for (const c of CARRIERS) assert.ok(a.drawn[c] >= 0);
});

test("felled past what its woods give where its people outgrow them; coal first where they dig it", () => {
  const bare = energyAccount({ ...LAND, woodKw: 1000, herdKg: 0, grain: 0 });
  assert.ok(bare.felled > 0 && bare.heatHad === bare.heatWanted);
  const coal = energyAccount({
    ...LAND,
    woodKw: 1000,
    coalKnown: true,
    coalKwy: 1e6,
    herdKg: 0,
    grain: 0,
  });
  assert.equal(coal.felled, 0);
  assert.ok(coal.coal > 0 && coal.fuelWanted > 0);
});

test("a land of engines burns what its heat engines turn into the work its works want, Carnot's share of it", () => {
  const steam: EnergyInputs = {
    ...LAND,
    industry: 1,
    engine: true,
    taps: new Set<Source>(["burned", "mills"]),
    coalKnown: true,
    coalKwy: 1e7,
  };
  const a = energyAccount(steam);
  near(a.workHad, a.workWanted, 1e-6, "its works have the work they want");
  assert.equal(a.drives, "burned");
  const e = engineShare(steam.fireC, steam.coldK, steam.fitMm, steam.strengthMpa);
  near(
    a.by.burned / e,
    a.coal - (a.heatHad - a.drawn.wood - a.drawn.dung),
    1,
    "the coal its engines burned",
  );
  // Finer fits burn less for the same work.
  const fine = energyAccount({ ...steam, fitMm: 0.01, strengthMpa: 800 });
  assert.ok(fine.coal < a.coal);
  // With nothing to burn its works go without.
  const none = energyAccount({ ...steam, coalKwy: 0, woodKw: 0, herdKg: 0, grain: 0 });
  assert.ok(none.workHad < none.workWanted && none.fuelWanted > 0);
});

test("the ground's heat, the star's and a held flame need no fuel; a world with nothing to burn still drives works", () => {
  const ground = energyAccount({
    ...LAND,
    fire: false,
    industry: 1,
    engine: true,
    taps: new Set<Source>(["ground"]),
  });
  near(ground.workHad, ground.workWanted, 1e-6, "the ground's heat drives them");
  assert.equal(ground.drives, "ground");
  assert.equal(ground.coal + ground.oil + ground.own, 0);
  const flame = energyAccount({
    ...LAND,
    industry: 1.5,
    engine: true,
    taps: new Set<Source>(["fusion"]),
  });
  assert.equal(flame.drives, "fusion");
  assert.ok(flame.drawn.atom > 0);
  // Dynamos on dammed rivers.
  const dam = energyAccount({
    ...LAND,
    industry: 0.5,
    homes: true,
    taps: new Set<Source>(["dam"]),
  });
  assert.equal(dam.drives, "dam");
  assert.ok(dam.drawn.flow > 0 && dam.workHad > 0);
  for (const s of SOURCES) assert.ok(flame.by[s] >= 0);
});
