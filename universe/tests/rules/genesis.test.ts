// Where a world's buried fuels and its ores come from, read from its own life and crust (rules/genesis.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EARTH_LIFE,
  SOLAR,
  crustOf,
  fossilOrigin,
  hardenerOf,
  oreEase,
  oreGenesis,
  oreWords,
  otherOres,
  type Chemistry,
} from "../../src/rules/index.ts";

const rich: Chemistry = {
    ...SOLAR,
    solar: false,
    metals: "rich",
    hardener: hardenerOf("solar", "rich"),
  },
  poor: Chemistry = {
    ...SOLAR,
    solar: false,
    metals: "poor",
    hardener: hardenerOf("solar", "poor"),
  };

test("a buried fuel is what its life was built of: carbon's to coal and oil, silicon's to a shale that burns to sand", () => {
  const carbon = fossilOrigin(EARTH_LIFE, true);
  assert.match(carbon.of, /carbon's chains \(wood fibre\)/);
  assert.match(carbon.solid, /little but carbon/);
  assert.equal(carbon.solidMJ, 30);
  assert.equal(carbon.liquidMJ, 42);
  const silane = fossilOrigin(
    {
      ...EARTH_LIFE,
      earth: false,
      backbone: "silane",
      fibre: "polysilane",
      store: "tetrasilane",
      liquid: "methane",
    },
    false,
  );
  assert.match(silane.of, /silicon's chains/);
  assert.match(silane.solid, /shale of silicon/);
  assert.match(silane.leaves, /sand/);
  assert.match(silane.words, /not a fuel/);
  const siloxane = fossilOrigin({ ...EARTH_LIFE, earth: false, backbone: "siloxane" }, true);
  assert.ok(siloxane.solidMJ < carbon.solidMJ, "half burned already");
  assert.match(siloxane.words, /leaving sand/);
});

test("an ore is its crust's own element gathered to a workable grade: a richer crust needs less gathering", () => {
  const earth = oreGenesis(SOLAR);
  for (const r of earth) assert.equal(r.gather, r.earth);
  // (Earth's order: aluminium and iron need a few times over, copper some two hundred, gold hundreds more.)
  const at = (list: typeof earth, s: string) => list.find((r) => r.symbol === s)!;
  assert.ok(at(earth, "Fe").gather < 10 && at(earth, "Al").gather < 10);
  assert.ok(at(earth, "Cu").gather > 100 && at(earth, "Cu").gather < 400);
  assert.ok(at(earth, "Au").gather > at(earth, "Cu").gather);
  for (let i = 1; i < earth.length; i++) assert.ok(earth[i]!.gather >= earth[i - 1]!.gather);
  const cu = (c: Chemistry) => crustOf(c).find((r) => r.symbol === "Cu")!.ppm;
  assert.ok(cu(rich) > cu(SOLAR) && cu(poor) < cu(SOLAR));
  assert.ok(at(oreGenesis(rich), "Cu").gather < at(earth, "Cu").gather);
  assert.ok(oreEase(rich, "copper")! > 1 && oreEase(poor, "copper")! < 1);
  assert.equal(oreEase(SOLAR, "copper"), 1);
  assert.equal(oreEase(SOLAR, "coal"), null);
  assert.match(oreWords(rich, "copper")!, /times less than Earth's ground must/);
  assert.match(oreWords(poor, "iron")!, /times more than Earth's ground must/);
  assert.equal(oreWords(rich, "salt"), null);
  // What else it could be worked for is never one of the metals its deposits are of.
  for (const r of otherOres(rich)) assert.ok(!["Cu", "Fe", "Au"].includes(r.symbol));
  assert.ok(otherOres(SOLAR).some((r) => r.symbol === "Al"));
});
