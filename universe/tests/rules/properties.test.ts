// Phase 65: matter's real properties, and a step that asks for a function a world's matter meets or does
// not: carried a current, switched a current, and what ages past ours would ask.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LATER_CRUST,
  LATER_SUBSTANCES,
  PROPERTIES,
  SOLAR,
  crustPpm,
  elementShares,
  findElement,
  findSubstance,
  meansWorldOf,
  molarMass,
  propertiesOf,
  readFunctions,
  rockUnderfoot,
  type FunctionReading,
  type MatterWorld,
} from "../../src/rules/index.ts";

const EARTH: MatterWorld = {
  chem: SOLAR,
  kind: "rocky",
  celsius: 15,
  gravity: 1,
  rockBodies: 8,
  giants: 4,
  starLeftGyr: 5,
  peopled: true,
  means: meansWorldOf({
    chem: SOLAR,
    kind: "rocky",
    celsius: 15,
    gravity: 1,
    medium: "land",
    bodyFire: true,
  }),
};

const fn = (list: readonly FunctionReading[], id: string) => {
  const f = list.find((x) => x.id === id);
  assert.ok(f, id);
  return f;
};

test("every figure belongs to a substance with a page, and every later stuff's elements are known", () => {
  for (const id of Object.keys(PROPERTIES)) assert.ok(findSubstance(id), id);
  for (const s of LATER_SUBSTANCES) {
    assert.equal(findSubstance(s.id), s);
    assert.ok(molarMass(s.formula) > 0, s.id);
    for (const el of Object.keys(s.formula)) assert.ok(findElement(el), `${s.id}: ${el}`);
    assert.ok(Math.abs(elementShares(s).reduce((n, e) => n + e[1], 0) - 1) < 1e-6, s.id);
  }
  for (const el of Object.keys(LATER_CRUST)) assert.ok(findElement(el), el);
});

test("the figures are the handbook's, in their right order", () => {
  const p = (id: string) => propertiesOf(id)!;
  assert.ok(p("copper").conductivity! > p("aluminium").conductivity!);
  assert.ok(p("aluminium").conductivity! > p("iron").conductivity!);
  assert.ok(p("steel").strength! > p("bronze").strength!);
  assert.ok(p("bronze").strength! > p("copper").strength!);
  assert.ok(p("silicon").bandGap! > p("germanium").bandGap!);
  assert.ok(p("diamond").bandGap! > p("moissanite").bandGap!);
  assert.ok(p("magnesium-diboride").superconductsK! > p("niobium-tin").superconductsK!);
});

test("Earth's matter meets every function, each by the stuff that does it there", () => {
  const list = readFunctions(EARTH);
  // (All but one it has no need of: its furnaces give it bronze and iron.)
  for (const f of list) if (f.id !== "edge-without-metal") assert.ok(f.met, `${f.id}: ${f.why}`);
  assert.equal(fn(list, "edge-without-metal").met, false);
  assert.equal(fn(list, "carry-current").subst, "copper");
  assert.equal(fn(list, "switch-current").subst, "silicon");
  assert.equal(fn(list, "wall-a-flame").subst, "tungsten");
  assert.equal(fn(list, "hold-a-flame").subst, "niobium-tin");
  // Four are asked of a people now; the rest are told only as what later ages would ask.
  assert.deepEqual(
    list.filter((f) => !f.later).map((f) => f.id),
    ["make-gas-fast", "edge-without-metal", "carry-current", "switch-current"],
  );
});

test("a world poor in what a function wants does not meet it, and says what it lacks", () => {
  const poor: MatterWorld = { ...EARTH, chem: { ...SOLAR, metals: "poor", solar: false } };
  assert.ok(crustPpm(poor.chem, "Nb") < crustPpm(SOLAR, "Nb"), "scarcer in a metal-poor crust");
  const list = readFunctions(poor);
  const held = fn(list, "hold-a-flame");
  assert.equal(held.met, false, held.why);
  assert.match(held.why, /parts a million/);
  // What wants the star's light, or its neighbours, reads from the system instead.
  const alone = readFunctions({ ...EARTH, rockBodies: 0, giants: 0, starLeftGyr: 0.4 });
  assert.equal(fn(alone, "gather-a-star").met, false);
  assert.equal(fn(alone, "remake-a-world").met, false);
  assert.match(fn(alone, "gather-a-star").why, /0\.4 billion years/);
});

test("a world of ice: its rock out of reach, the stuff of its own haze doing the wire's work", () => {
  assert.equal(rockUnderfoot("methane"), false);
  assert.equal(rockUnderfoot("rocky"), true);
  const titan: MatterWorld = {
    ...EARTH,
    kind: "methane",
    celsius: -179,
    rockBodies: 0,
    gravity: 0.14,
  };
  const list = readFunctions(titan);
  const wire = fn(list, "carry-current");
  assert.equal(wire.subst, "polyacetylene", wire.why);
  const swap = fn(list, "switch-current");
  assert.ok(swap.met, swap.why);
  assert.match(swap.why, /cold/);
  // Its pull is weak: its ice stands tall.
  const roof = fn(list, "roof-a-world");
  assert.equal(roof.subst, "water-ice");
  // With moons to dig, its rock's stuffs are to be had again.
  const moons = readFunctions({ ...titan, rockBodies: 3 });
  assert.equal(fn(moons, "carry-current").subst, "copper");
  assert.match(fn(moons, "carry-current").why, /moons/);
});
