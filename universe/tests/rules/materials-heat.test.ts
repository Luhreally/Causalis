// Materials science, the second round: a smelt's heat read off Ellingham's lines (its oxide's free energy against charcoal's,
// and what must run); a furnace held to its lining's melt; copper's hardener chosen by its worth on the crust; a stone's edge
// from its hardness and how it breaks; frames lighter in the light alloy and glass fibre; and a Creator's binding read
// wherever an atom is.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ATOMS,
  BARE_LINING,
  FIELDSTONE,
  FRAME_SHARE,
  FRAMES,
  HARDENER_ELEMENTS,
  SOLAR,
  STEEL_STAGE_DRY,
  STONES,
  bandGapOf,
  boundAtoms,
  costPerTonne,
  findReaction,
  flyerFrame,
  frameStuffs,
  hardenerOf,
  hardenerWorth,
  heatOf,
  launcherFor,
  liningOf,
  liningOn,
  metalFigures,
  PROPULSION,
  reductionC,
  smeltHeat,
  smeltOf,
  stageDry,
  stoneEdge,
  type Frame,
  type MetalsClass,
  type SilicaClass,
} from "../../src/rules/index.ts";

const rx = (id: string) => findReaction(id)!;

test("Ellingham: charcoal takes copper's oxygen early, iron's by 800 °C, tin's by 720, and never aluminium's in a furnace", () => {
  assert.equal(reductionC("Cu", "carbon"), 151);
  assert.equal(reductionC("Sn", "carbon"), 719);
  assert.equal(reductionC("Fe", "carbon"), 785);
  assert.equal(reductionC("Zn", "carbon"), 1043);
  assert.ok(reductionC("Al", "carbon")! > 2000, "alumina wants an arc or a current");
  assert.ok(reductionC("Mg", "carbon")! > 2000);
  // Hydrogen takes copper's and nickel's oxygen at any heat, iron's only hot, aluminium's never in reach.
  assert.equal(reductionC("Cu", "hydrogen"), 0);
  assert.equal(reductionC("Ni", "hydrogen"), 0);
  assert.ok(reductionC("Fe", "hydrogen")! > 1000);
  assert.equal(reductionC("Xx", "carbon"), null);
});

test("a smelt's heat: the reduction, the metal gathered and the slag that must run; the rest are no smelts", () => {
  assert.equal(smeltHeat(rx("smelt-malachite")), 1085); // copper runs at its melt
  assert.equal(smeltHeat(rx("smelt-cassiterite")), 719); // tin runs far below; charcoal's heat governs
  assert.equal(smeltHeat(rx("bloomery")), 1177); // a bloom from a running slag
  assert.equal(smeltHeat(rx("smelt-zinc")), 1043);
  assert.equal(smeltHeat(rx("smelt-garnierite")), 1177);
  assert.deepEqual(smeltOf(rx("roast-chalcopyrite")), {
    metal: "Cu",
    ore: "chalcopyrite",
    self: true,
    slag: true,
  });
  for (const id of [
    "alloy-bronze",
    "burn-lime",
    "fire-clay",
    "melt-glass",
    "carburise",
    "melt-native-copper",
  ])
    assert.equal(smeltHeat(rx(id)), null, id);
  // Every smelt lands near the heat the tables once gave it, and none wants more than a blast furnace.
  for (const [id, was] of [
    ["smelt-malachite", 1100],
    ["roast-chalcopyrite", 1200],
    ["bloomery", 1200],
    ["smelt-magnetite", 1250],
    ["smelt-chalcocite", 1150],
    ["smelt-garnierite", 1250],
    ["smelt-siderite", 1150],
  ] as const) {
    const h = smeltHeat(rx(id))!;
    assert.ok(Math.abs(h - was) <= 100 && h <= 1500, `${id}: ${h} against ${was}`);
  }
  // A stronger binding moves the heat with it, in kelvin.
  assert.equal(smeltHeat(rx("bloomery"), ["carbon"], 2), Math.round((1177 + 273.15) * 2 - 273.15));
  // Hydrogen moves no ore's heat here: gathering the metal governs each.
  assert.equal(smeltHeat(rx("bloomery"), ["carbon", "hydrogen"]), 1177);
});

test("a furnace's lining: Earth's fireclay holds a blast's heat, bare stone does not, an arc is not held", () => {
  const earth = liningOn(SOLAR);
  assert.equal(earth.name, "fireclay");
  assert.equal(earth.holdsC, 1734);
  assert.equal(liningOf(() => false).name, BARE_LINING.name);
  assert.ok(liningOf(() => false).holdsC < 1177, "bare stone slumps before a slag runs");
  assert.equal(liningOf((s) => s === "graphite" || s === "quartz").name, "graphite");
  assert.ok(liningOf((s) => s === "kaolinite", 1.5).holdsC > earth.holdsC);
  // Earth's own furnaces are unmoved by it.
  assert.equal(
    heatOf(SOLAR, (p) => p === "steel"),
    1500,
  );
  assert.equal(
    heatOf(SOLAR, (p) => p === "electricity"),
    3000,
  );
});

test("the hardener is the one worth most on the crust, and keeps every class's old choice", () => {
  const silicas: readonly SilicaClass[] = ["low", "solar", "high"],
    metalses: readonly MetalsClass[] = ["poor", "solar", "rich"];
  const old = (s: SilicaClass, m: MetalsClass) =>
    s === "low" ? "nickel" : m === "poor" ? "arsenic" : "tin";
  for (const s of silicas)
    for (const m of metalses) assert.equal(hardenerOf(s, m), old(s, m), `${s}/${m}`);
  const earth = hardenerWorth("solar", "solar");
  assert.ok(earth.tin > earth.arsenic && earth.arsenic > earth.nickel);
  assert.equal(earth.nickel, 0, "Earth's crust's nickel stays in its silicates");
  assert.deepEqual(
    HARDENER_ELEMENTS.map(([h]) => h),
    ["tin", "arsenic", "nickel"],
  );
});

test("a stone's edge from its hardness and how it breaks: glass keenest and brittle, jade toughest, grain tough and dull", () => {
  assert.deepEqual(stoneEdge("obsidian", "obsidian"), { keen: 1, tough: 0.2 });
  assert.deepEqual(stoneEdge("flint", "flint"), { keen: 0.89, tough: 0.57 });
  assert.deepEqual(stoneEdge("chert", "chert"), { keen: 0.8, tough: 0.6 });
  assert.deepEqual(stoneEdge("basalt", null), { keen: 0.45, tough: 0.9 });
  assert.equal(stoneEdge("nephrite", "nephrite").tough, 1);
  assert.ok(
    stoneEdge("corundum", "corundum").keen > stoneEdge("quartz", "quartz").keen,
    "harder, keener",
  );
  // The tables read it.
  assert.deepEqual(
    { keen: STONES.limestone!.keen, tough: STONES.limestone!.tough },
    stoneEdge("flint", "flint"),
  );
  assert.deepEqual({ keen: FIELDSTONE.keen, tough: FIELDSTONE.tough }, { keen: 0.36, tough: 0.9 });
  // Earth's stones keep their order of keenness: obsidian, flint, chert, quartzite, quartz, basalt.
  const order = ["andesite", "limestone", "shale", "sandstone", "granite", "basalt"].map(
    (r) => STONES[r]!.keen,
  );
  for (let i = 1; i < order.length; i++) assert.ok(order[i - 1]! > order[i]!, `${order}`);
});

test("frames: steel's stage is steel's, the light alloy's and glass fibre's lighter; a flyer's frame lighter in them", () => {
  const t = frameStuffs();
  assert.ok(t["light-alloy"]!.density < 3000 && t.steel!.density > 7000);
  assert.equal(stageDry("steel"), STEEL_STAGE_DRY);
  assert.ok(stageDry("light-alloy") < 0.09 && stageDry("light-alloy") > 0.06);
  assert.ok(stageDry("glass-fibre") <= stageDry("light-alloy"));
  assert.equal(flyerFrame(FRAME_SHARE, null), FRAME_SHARE);
  assert.equal(flyerFrame(FRAME_SHARE, "steel"), FRAME_SHARE);
  assert.ok(flyerFrame(FRAME_SHARE, "light-alloy") < FRAME_SHARE);
  assert.ok(flyerFrame(FRAME_SHARE, "glass-fibre") >= 0.2);
  // A made frame makes a launch cheaper where it is lighter than steel's.
  const made: Frame = {
      id: "alloy-frame",
      words: "",
      needs: ["rocketry"],
      dry: stageDry("light-alloy"),
      cost: 1.2,
    },
    knows = (p: string) => p === "rocketry" || p === "engines" || p === "steel",
    plain = launcherFor(knows, 9.4)!,
    lighter = launcherFor(knows, 9.4, [made])!;
  assert.ok(lighter.cost < plain.cost, `${lighter.cost} against ${plain.cost}`);
  assert.equal(lighter.frame.id, "alloy-frame");
  assert.ok(
    costPerTonne(9.4, PROPULSION[1]!, made).cost <
      costPerTonne(9.4, PROPULSION[1]!, FRAMES[0]!).cost,
  );
});

test("a Creator's binding: ours untouched; stronger, stiffer copper that melts hotter, and wider gaps", () => {
  assert.equal(boundAtoms(1), ATOMS);
  const ours = metalFigures({ Cu: 1 }, "annealed", 288)!,
    bound = metalFigures({ Cu: 1 }, "annealed", 288, { binding: 1.5 })!;
  assert.ok(bound.stiffness > ours.stiffness * 1.4);
  assert.ok(bound.strength > ours.strength);
  assert.ok(bound.meltC > ours.meltC + 400);
  assert.equal(boundAtoms(1.5).Cu!.ecoh, ATOMS.Cu!.ecoh * 1.5);
  assert.equal(bandGapOf({ Si: 1 }, 2), Math.round(200 * bandGapOf({ Si: 1 })!) / 100);
});
