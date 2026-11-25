// Gaps round (2026-11-24): what fills the fuel slot. A fuel is whatever gives heat in a world's air; a unit is the same heat of
// any of them, so its weight and the work to win it follow from its heat a kilogram; wood from a market is burned by any hearth.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BLENDED,
  BLEND_WHOLE,
  FUEL_UNIT_KWY,
  G,
  GOODS,
  RECIPES,
  blendBulk,
  blendOut,
  coldOf,
  hearthAt,
  energyAccount,
  fillingName,
  fuelHere,
  fuelWorth,
  fuelsHere,
  naturalPrices,
  seamYield,
  slotBulk,
  type EnergyInputs,
  type Source,
} from "../../src/rules/index.ts";

test("what burns is by the air: wood, coal and oil in oxygen, the haze in hydrogen, nothing in an air that holds neither", () => {
  const earth = fuelsHere(["oxygen"]).map((f) => f.kind);
  assert.deepEqual(new Set(earth), new Set(["coal", "oil", "gas", "haze", "sulphur", "wood"]));
  assert.equal(fuelsHere([]).length, 0, "no fuel where nothing burns");
  const haze = fuelHere("haze", ["hydrogen"])!,
    wood = fuelHere("wood", ["hydrogen"])!;
  assert.ok(haze.mj > 3 * wood.mj, "in hydrogen the haze is the fuel, wood a poor one");
  assert.equal(fuelsHere(["hydrogen"])[0]!.kind, "haze");
});

test("a unit is the same heat: the poorer the fuel a kilogram, the heavier its unit and the more work to win it", () => {
  const coal = fuelHere("coal", ["oxygen"])!,
    wood = fuelHere("wood", ["oxygen"])!,
    sulphur = fuelHere("sulphur", ["oxygen"])!;
  // (A collier's year is the coal recipe's.)
  const dug = RECIPES.find((r) => r.id === "coal-digging")!.output[1];
  assert.ok(Math.abs(coal.won - dug) < 1e-9);
  assert.ok(wood.unitKg > 2 * coal.unitKg && wood.unitKg < 3 * coal.unitKg, `${wood.unitKg}`);
  assert.ok(wood.won < coal.won / 4, "a woodcutter's year is far fewer units than a collier's");
  assert.ok(sulphur.won > 10 && sulphur.won < 20, `as it was reckoned flat (15): ${sulphur.won}`);
  // What a unit is worth where it is won: the work it takes.
  assert.ok(fuelWorth(12, wood) > 4 * fuelWorth(12, coal));
  // And to carry: a stock that is all wood is carried at twice coal's bulk and more; all coal, at the class's own.
  assert.equal(slotBulk(G.coal, { coal: 1 }, ["oxygen"]), GOODS[G.coal]!.bulk);
  const blend = BLENDED.map((k) => (k === "wood" ? BLEND_WHOLE : 0));
  assert.ok(
    Math.abs(blendBulk(G.coal, blend, ["oxygen"]) - slotBulk(G.coal, { wood: 1 }, ["oxygen"])) <
      1e-9,
  );
  assert.ok(blendBulk(G.coal, blend, ["oxygen"]) > 2 * GOODS[G.coal]!.bulk);
  assert.equal(
    blendBulk(G.oil, blend, ["oxygen"]),
    GOODS[G.oil]!.bulk,
    "wood is not in the fluid class",
  );
});

test("a class is called by what fills it", () => {
  assert.equal(fillingName({ wood: 1 }, G.coal), "firewood");
  assert.equal(fillingName({ coal: 0.7, wood: 0.3 }, G.coal), "coal and firewood");
  assert.equal(fillingName({ coal: 0.9, wood: 0.1 }, G.coal), "coal");
  assert.equal(fillingName({ haze: 1 }, G.oil), "gathered haze");
  assert.equal(fillingName({}, G.coal), "coal");
});

const LAND: EnergyInputs = {
  people: 100_000,
  workers: 60_000,
  farmers: 40_000,
  crafters: 10_000,
  traders: 4_000,
  appetite: 1,
  fed: 1,
  herdKg: 0,
  beastKg: 500,
  draught: false,
  grain: 0,
  cold: 0.5,
  fire: true,
  smelted: 0,
  blast: false,
  industry: 0,
  carried: 0,
  homes: false,
  taps: new Set<Source>(),
  engine: false,
  woodKw: 1000,
  riverKw: 0,
  windKw: 0,
  tideKw: 0,
  groundKw: 0,
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

test("a land short of wood burns what its market holds of it before it fells its own, and wants what it still lacks", () => {
  const bare = energyAccount(LAND),
    bought = energyAccount({ ...LAND, cutKwy: 20_000 });
  assert.ok(bare.felled > 0 && bare.fuelWanted > 0, "its hearths want fuel before any seam is dug");
  assert.equal(bare.cut, 0);
  assert.ok(Math.abs(bought.cut - 20_000) < 1e-6, "all the market's wood is burned");
  assert.ok(bought.felled < bare.felled || bare.felled === bought.felled);
  assert.ok(bought.heatHad > bare.heatHad - 1e-9);
  assert.ok(Math.abs(bare.fuelWanted - bought.fuelWanted - 20_000) < 1e-6);
  // Enough of it, and nothing is felled or wanted.
  const full = energyAccount({ ...LAND, cutKwy: 1e9 });
  assert.equal(full.felled, 0);
  assert.equal(full.fuelWanted, 0);
  // A people that keeps no fire burns none.
  assert.equal(energyAccount({ ...LAND, fire: false, cutKwy: 1e9 }).cut, 0);
  assert.ok(FUEL_UNIT_KWY > 0);
});

test("a fuel class no recipe makes is worth the work to win what fills it", () => {
  const n = GOODS.length,
    read = {
      price: GOODS.map((g) => g.value),
      recipes: [],
      outside: 12,
      wage: 12,
      living: 12,
      cold: 0.3,
      work: new Array<number>(n).fill(NaN),
    },
    won = new Array<number>(n).fill(0);
  won[G.coal] = fuelHere("wood", ["oxygen"])!.won;
  const free = naturalPrices(read),
    cut = naturalPrices({ ...read, won });
  assert.notEqual(free.basis[G.coal], "made");
  assert.equal(cut.basis[G.coal], "made");
  assert.ok(Math.abs(cut.worth[G.coal]! - 12 / won[G.coal]!) < 1e-9);
  assert.equal(cut.worth[G.oil], free.worth[G.oil], "the other class is as it was");
});

test("the need for warmth is the body's: a people is cold below the warmth it was shaped in, less what its body carries", () => {
  // An upright ape of a 26 °C cradle: a hearth below 14 °C, as it was reckoned for every people.
  assert.equal(hearthAt(26, true), 14);
  assert.equal(coldOf(10, hearthAt(26, true)), coldOf(10));
  // A cold-blooded people of a 52 °C cradle finds 30 °C cold, where an ape is at ease; a people of a 5 °C cradle is at ease at 0.
  assert.ok(coldOf(30, hearthAt(52, false)) > 0.5);
  assert.equal(coldOf(30), 0);
  assert.equal(coldOf(0, hearthAt(5, true)), 0);
  assert.ok(coldOf(0) > 0.5);
});

test("wood burned from a mixed stock leaves less wood in it: its share falls by what was chosen first", () => {
  const at = BLENDED.indexOf("wood"),
    blend = BLENDED.map((k) => (k === "wood" ? BLEND_WHOLE / 2 : 0));
  // 100 units, half wood; 40 burned, 30 of them wood: 20 wood left in 60.
  blendOut(blend, G.coal, 60, 40, "wood", 30);
  assert.ok(Math.abs(blend[at]! / BLEND_WHOLE - 20 / 60) < 1e-5, `${blend[at]}`);
  // All of it burned: none left.
  blendOut(blend, G.coal, 40, 20, "wood", 20);
  assert.equal(blend[at], 0);
  // Sulphur beside it keeps its weight among what is not wood.
  const mixed = BLENDED.map((k) => (k === "wood" ? 400_000 : k === "sulphur" ? 300_000 : 0));
  blendOut(mixed, G.coal, 80, 20, "wood", 20);
  assert.ok(Math.abs(mixed[at]! / BLEND_WHOLE - 20 / 80) < 1e-5);
  assert.ok(Math.abs(mixed[BLENDED.indexOf("sulphur")]! / BLEND_WHOLE - 30 / 80) < 1e-5);
});

test("a seam's year gives as many units as its heat in the world's air comes to", () => {
  assert.equal(seamYield("coal", ["oxygen"]), 1);
  assert.equal(seamYield("oil", ["oxygen"]), 1);
  const coal = seamYield("coal", ["hydrogen"]);
  assert.ok(coal > 0.1 && coal < 0.25, `coal joined with hydrogen: ${coal}`);
  assert.ok(seamYield("oil", ["hydrogen"]) < coal);
  assert.equal(seamYield("coal", []), 1, "where nothing burns it is counted as it was");
});
