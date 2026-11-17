// Materials science: a stuff's figures read from its atoms and how it was worked, landing near the handbook's for Earth's
// stuffs; a metal's edge from them; rust, magnets, band gaps and the purity a switch wants; and the ways a land may come to.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ATOMS,
  HANDBOOK_PROPERTIES,
  KIND_METALS,
  MATERIAL_WAYS,
  METALS,
  METAL_RECIPES,
  NOVEL_METALS,
  PROPERTIES,
  WAY_INDEX,
  atomsPerM3,
  austeniteC,
  bandGapOf,
  calcineC,
  findSubstance,
  liquidusC,
  metalEdge,
  metalFigures,
  oxideRatio,
  purityCeiling,
  purityNeeded,
  recipeEdge,
  rustRate,
  substanceFigures,
  treatedRecipe,
  wayOpen,
  type WayFacts,
} from "../../src/rules/index.ts";

const near = (got: number, want: number, share: number, what: string) =>
  assert.ok(Math.abs(got - want) <= share * Math.abs(want), `${what}: ${got} against ${want}`);

test("a metal's weight a cubic metre comes from its atoms' mass and packing, within a twentieth of the handbook's", () => {
  for (const id of [
    "copper",
    "tin",
    "bronze",
    "iron",
    "steel",
    "gold",
    "brass",
    "nickel",
    "cupronickel",
  ]) {
    const f = substanceFigures(id)!;
    near(f.density, findSubstance(id)!.density, 0.05, id);
  }
  // (No metal in it: no metal figures.)
  assert.equal(metalFigures({ Si: 1, O: 2 }), null);
});

test("strength and current land near the handbook's for Earth's metals, in their right order", () => {
  for (const id of ["copper", "bronze", "iron", "steel", "gold", "cupronickel", "brass"])
    near(PROPERTIES[id]!.strength!, HANDBOOK_PROPERTIES[id]!.strength!, 0.25, `${id} strength`);
  for (const id of [
    "copper",
    "bronze",
    "iron",
    "steel",
    "gold",
    "brass",
    "cupronickel",
    "aluminium",
    "nickel",
    "tin",
  ])
    near(
      PROPERTIES[id]!.conductivity!,
      HANDBOOK_PROPERTIES[id]!.conductivity!,
      0.5,
      `${id} current`,
    );
  const p = (id: string) => PROPERTIES[id]!;
  assert.ok(p("steel").strength! > p("iron").strength!);
  assert.ok(p("iron").strength! > p("bronze").strength!);
  assert.ok(p("bronze").strength! > p("copper").strength!);
  assert.ok(p("copper").strength! > p("tin").strength!);
  assert.ok(p("copper").conductivity! > p("aluminium").conductivity!);
  assert.ok(p("aluminium").conductivity! > p("iron").conductivity!);
  assert.ok(p("iron").conductivity! > p("steel").conductivity!);
});

test("a world's warmth moves a metal: tin is softer near its melt, iron turns brittle in the cold and copper does not", () => {
  const tinCold = metalFigures({ Sn: 1 }, "annealed", 150)!,
    tinWarm = metalFigures({ Sn: 1 }, "annealed", 400)!;
  assert.ok(tinCold.strength > 2 * tinWarm.strength);
  const ironHere = metalFigures({ Fe: 1 }, "annealed", 288)!,
    ironCold = metalFigures({ Fe: 1 }, "annealed", 90)!;
  assert.equal(ironHere.brittle, false);
  assert.equal(ironCold.brittle, true);
  assert.ok(ironCold.toughness < ironHere.toughness / 5);
  assert.equal(metalFigures({ Cu: 1 }, "annealed", 90)!.brittle, false);
  // (A twentieth of nickel keeps iron tough far colder: meteoric iron's.)
  assert.ok(metalFigures({ Fe: 0.94, Ni: 0.06 }, "annealed")!.brittleC! < ironHere.brittleC! - 40);
});

test("the tables' metals take their edges from their recipes, near their old figures and in their old order", () => {
  const old: Record<string, readonly [number, number]> = {
    copper: [0.5, 0.6],
    bronze: [0.7, 0.7],
    iron: [0.8, 0.65],
    steel: [1, 0.85],
    "bog iron": [0.68, 0.55],
    cupronickel: [0.64, 0.78],
    "arsenical copper": [0.62, 0.7],
    "star iron": [0.62, 0.6],
  };
  for (const [name, [keen, tough]] of Object.entries(old)) {
    const e = metalEdge(name);
    assert.ok(Math.abs(e.keen - keen) <= 0.15, `${name} keen ${e.keen}`);
    assert.ok(Math.abs(e.tough - tough) <= 0.2, `${name} tough ${e.tough}`);
  }
  assert.deepEqual({ keen: METALS.steel.keen, tough: METALS.steel.tough }, metalEdge("steel"));
  assert.equal(NOVEL_METALS.cupronickel.keen, metalEdge("cupronickel").keen);
  assert.ok(METALS.steel.keen > METALS.iron.keen && METALS.iron.keen > METALS.bronze.keen);
  assert.ok(METALS.bronze.keen > METALS.copper.keen);
  assert.ok(METALS["bog iron"].keen < METALS.iron.keen);
  // Iron below its brittle point: the same iron, its edge broken rather than bent.
  assert.ok(KIND_METALS["brittle star iron"].tough < KIND_METALS["star iron"].tough / 2);
  assert.ok(KIND_METALS["carbide iron"].tough < METALS.iron.tough / 2);
  for (const r of Object.values(METAL_RECIPES)) {
    const e = recipeEdge(r);
    assert.ok(e.keen >= 0 && e.keen <= 1 && e.tough >= 0 && e.tough <= 1);
  }
});

test("a quench hardens a steel edge and a temper gives back its toughness; a quench does nothing to copper", () => {
  const forged = metalFigures({ Fe: 1 }, "forged")!,
    quenched = metalFigures({ Fe: 1 }, "quenched")!,
    tempered = metalFigures({ Fe: 1 }, "tempered")!;
  assert.ok(quenched.hv > 2 * forged.hv);
  assert.ok(tempered.hv < quenched.hv && tempered.hv > forged.hv);
  assert.ok(tempered.toughness > quenched.toughness);
  assert.equal(metalFigures({ Cu: 1 }, "quenched")!.hv, metalFigures({ Cu: 1 }, "annealed")!.hv);
  const plain = recipeEdge({ subst: "iron", worked: "forged" }),
    best = recipeEdge(treatedRecipe("iron", (w) => w === "tempering" || w === "quench-hardening")!);
  assert.ok(best.keen > plain.keen);
  assert.equal(
    treatedRecipe("bronze", () => true),
    null,
  );
});

test("rust: iron's oxide flakes and it rusts; aluminium's and copper's close over them; gold never; nothing rusts in an air without oxygen", () => {
  assert.ok(oxideRatio(ATOMS.Fe!)! > 2);
  for (const e of ["Al", "Cu", "Ni", "Ti"]) {
    const pb = oxideRatio(ATOMS[e]!)!;
    assert.ok(pb >= 1 && pb <= 2, `${e} ${pb}`);
  }
  assert.ok(oxideRatio(ATOMS.Mg!)! < 1);
  assert.ok(rustRate("Fe", 0.2095, true) > 10 * rustRate("Al", 0.2095, true));
  assert.ok(rustRate("Fe", 0.2095, true) > 5 * rustRate("Cu", 0.2095, true));
  assert.equal(rustRate("Au", 0.2095, true), 0);
  assert.equal(rustRate("Fe", 0, true), 0);
  assert.ok(rustRate("Fe", 0.2095, false) < rustRate("Fe", 0.2095, true));
});

test("a magnet's moment from its 3d shell (Slater–Pauling): iron most, nickel least, copper none", () => {
  const fe = substanceFigures("iron")!.moment,
    ni = substanceFigures("nickel")!.moment,
    cu = substanceFigures("copper")!.moment;
  assert.ok(fe > 2 && ni > 0.3 && ni < 1 && cu === 0);
});

test("band gaps of diamond-like crystals from their bonds, within a half of the handbook's; none for an oxide", () => {
  for (const id of [
    "silicon",
    "germanium",
    "gallium-arsenide",
    "moissanite",
    "diamond",
    "sphalerite",
  ])
    near(bandGapOf(findSubstance(id)!.formula)!, HANDBOOK_PROPERTIES[id]!.bandGap!, 0.5, id);
  assert.equal(bandGapOf(findSubstance("zinc-oxide")!.formula), null);
  assert.equal(bandGapOf(findSubstance("quartz")!.formula), null);
  const si = bandGapOf({ Si: 1 })!,
    ge = bandGapOf({ Ge: 1 })!;
  assert.ok(bandGapOf({ C: 1 })! > si && si > ge);
});

test("a switch wants its crystal clean to some nine or ten nines, more where a narrow gap is warm", () => {
  const si = purityNeeded(1.12, 288, atomsPerM3("silicon"));
  assert.ok(si > 9 && si < 10.5, `${si}`);
  // (A narrow gap in a hot world frees so many of its own charges that it must be doped heavier, so may be dirtier.)
  assert.ok(
    purityNeeded(0.3, 500, atomsPerM3("germanium")) <
      purityNeeded(0.3, 200, atomsPerM3("germanium")),
  );
  assert.equal(
    purityCeiling(
      () => false,
      () => false,
    ),
    0,
  );
  assert.equal(
    purityCeiling(
      (p) => p === "metalworking",
      () => false,
    ),
    2,
  );
  assert.ok(
    purityCeiling(
      () => true,
      (w) => w === "pure-crystal",
    ) > si,
  );
  assert.ok(
    purityCeiling(
      () => true,
      (w) => w === "made-polymer",
    ) < si,
  );
  // (Every crystal a world may switch with can be made as clean as a switch of it wants, once melted zone by zone.)
  const zone = purityCeiling(
    () => true,
    (w) => w === "pure-crystal",
  );
  for (const id of [
    "silicon",
    "germanium",
    "gallium-arsenide",
    "moissanite",
    "diamond",
    "polyacetylene",
  ])
    for (const kelvin of [90, 288, 400]) {
      const gap = PROPERTIES[id]?.bandGap ?? 1;
      assert.ok(zone > purityNeeded(gap, kelvin, atomsPerM3(id)) + 0.5, `${id} at ${kelvin} K`);
    }
});

test("a way's heat is its own physics: austenite, a steel's melt, calcite's breaking, a clay's vitrifying", () => {
  assert.equal(austeniteC(0), 912);
  assert.equal(austeniteC(1), 727);
  assert.ok(liquidusC(1.5) > 1350 && liquidusC(1.5) < 1450);
  near(calcineC(178.3, 160.6), 840, 0.05, "calcite");
  const ids = MATERIAL_WAYS.map((w) => w.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length <= 31, "a land's row keeps every way as a bit");
  for (const w of MATERIAL_WAYS) {
    for (const a of w.after)
      assert.ok(WAY_INDEX.get(a)! < WAY_INDEX.get(w.id)!, `${w.id} after ${a}`);
    assert.ok(w.depth >= 0 && w.depth <= 1 && w.rate > 0 && w.rate < 0.1, w.id);
  }
});

test("a way opens only to a land with its tools, its heat and what its world holds", () => {
  const earth: WayFacts = {
    heat: 800,
    knows: (p) => p === "iron" || p === "pottery" || p === "metalworking",
    made: () => false,
    ppm: (e) => ({ Al: 80000, Zn: 67, Ni: 47, Nb: 12, Sn: 2, Mg: 15000, B: 17 })[e] ?? 0,
    rock: (s) => ["kaolinite", "feldspar", "quartz", "calcite", "magnetite"].includes(s),
    air: () => false,
    fuel: true,
    crystal: { subst: "silicon", meltC: 1414 },
  };
  const way = (id: string) => MATERIAL_WAYS.find((w) => w.id === id)!;
  // An open fire reaches a forged edge's austenite, but not calcite's breaking.
  assert.equal(wayOpen(way("quench-hardening"), earth).open, true);
  assert.equal(wayOpen(way("lime-mortar"), earth).open, false);
  assert.equal(wayOpen(way("lime-mortar"), { ...earth, heat: 1200 }).open, true);
  // What a way builds on must be made first; a tool not known shuts it.
  assert.equal(wayOpen(way("tempering"), earth).open, false);
  assert.equal(
    wayOpen(way("tempering"), { ...earth, made: (w) => w === "quench-hardening" }).open,
    true,
  );
  assert.match(wayOpen(way("pure-crystal"), earth).shut!, /electronics/);
  // A world without limestone has no lime; one without a switching crystal has no pure crystal.
  assert.equal(
    wayOpen(way("lime-mortar"), { ...earth, heat: 1200, rock: () => false }).open,
    false,
  );
  assert.match(
    wayOpen(way("pure-crystal"), { ...earth, heat: 3000, knows: () => true, crystal: null }).shut!,
    /no crystal/,
  );
});
