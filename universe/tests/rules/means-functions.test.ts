// Phase F1 (docs/architecture/first-principles-plan.md): what a world's numbers say its matter can do, read
// as functions. A world's means make a charge that turns to gas fast and hold an edge without metal; a gun
// carries as far as its own air and pull let it. Read through the rules index, as the game reads them.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FIREARMS,
  SOLAR,
  gunHere,
  meansOf,
  meansWorldOf,
  readFunctions,
  type FunctionReading,
  type MatterWorld,
  type MeansWorld,
} from "../../src/rules/index.ts";

/** Earth's numbers, read from its kind and the Sun's own crust. */
const EARTH: MeansWorld = meansWorldOf({
  chem: SOLAR,
  kind: "rocky",
  celsius: 15,
  gravity: 1,
  medium: "land",
  bodyFire: true,
});

/** A world as the functions read it: its means from its numbers, the rest as Earth's. */
function worldOf(
  kind: MatterWorld["kind"],
  numbers: { celsius: number; gravity: number; medium: MeansWorld["medium"]; bodyFire: boolean },
): MatterWorld {
  return {
    chem: SOLAR,
    kind,
    celsius: numbers.celsius,
    gravity: numbers.gravity,
    rockBodies: 8,
    giants: 4,
    starLeftGyr: 5,
    peopled: true,
    means: meansWorldOf({ chem: SOLAR, kind, ...numbers }),
  };
}

const fn = (list: readonly FunctionReading[], id: string) => {
  const f = list.find((x) => x.id === id);
  assert.ok(f, id);
  return f;
};

test("a world's numbers are read from its kind's own tables, and Earth's are the Sun's", () => {
  const methane = meansWorldOf({
    chem: SOLAR,
    kind: "methane",
    celsius: -182,
    gravity: 1.134,
    medium: "land",
    bodyFire: false,
  });
  assert.equal(methane.kelvin, -182 + 273.15);
  assert.equal(methane.freeOxygen, false);
  assert.equal(methane.rock, false);
  assert.equal(methane.seaKgM3, 550);
  assert.ok(methane.airHolds.includes("methane"));
  assert.ok(methane.groundHolds.includes("water-ice"));
  assert.equal(EARTH.kelvin, 288.15);
  assert.equal(EARTH.airBar, 1);
  assert.equal(EARTH.freeOxygen, true);
  assert.deepEqual(EARTH.airHolds, []);
  assert.ok(EARTH.groundHolds.includes("flint"));
  assert.ok(EARTH.ppm("Cu") >= 5, "copper in the Sun's crust");
});

test("at Earth's numbers black powder makes the gas fast, and no edge is held without metal, which its furnaces make needless", () => {
  const list = readFunctions(
    worldOf("rocky", { celsius: 15, gravity: 1, medium: "land", bodyFire: true }),
  );
  assert.deepEqual(
    list.slice(0, 2).map((f) => f.id),
    ["make-gas-fast", "edge-without-metal"],
  );
  const gas = fn(list, "make-gas-fast");
  assert.equal(gas.met, true, gas.why);
  assert.equal(gas.later, false);
  assert.equal(gas.by, "black powder, 3 MJ/kg");
  assert.equal(gas.subst, null);
  const edge = fn(list, "edge-without-metal");
  assert.equal(edge.met, false, edge.why);
  assert.equal(edge.subst, null);
  assert.match(edge.why, /no need/);
});

test("a land people with no fire in its body cannot make the gas fast on rocky ground", () => {
  const list = readFunctions(
    worldOf("rocky", { celsius: 15, gravity: 1, medium: "land", bodyFire: false }),
  );
  const gas = fn(list, "make-gas-fast");
  assert.equal(gas.met, false);
  assert.equal(gas.subst, null);
  assert.match(gas.why, /no fire/);
});

test("on methane: solid acetylene by hand, ice for the edge, hand-fibre then drawn polymer for the barrels", () => {
  const numbers = { celsius: -182, gravity: 1.134, medium: "land", bodyFire: false } as const;
  const m = meansOf(meansWorldOf({ chem: SOLAR, kind: "methane", ...numbers }));
  assert.equal(m.handCharge?.id, "solid-acetylene");
  assert.equal(m.edge?.id, "ice");
  assert.equal(m.handBarrel.id, "hand-fibre");
  assert.equal(m.worksBarrel.id, "drawn-polymer");
  const list = readFunctions(worldOf("methane", numbers));
  assert.equal(fn(list, "make-gas-fast").subst, "acetylene");
  assert.equal(fn(list, "edge-without-metal").subst, "water-ice");
});

test("on ammonia: hydrazine by hand, and azide made with current at works", () => {
  const m = meansOf(
    meansWorldOf({
      chem: SOLAR,
      kind: "ammonia",
      celsius: -100,
      gravity: 1,
      medium: "land",
      bodyFire: false,
    }),
  );
  assert.equal(m.handCharge?.id, "hydrazine");
  assert.equal(m.worksCharge?.id, "hydrazinium-azide");
});

test("on carbon: cyanide by hand, moissanite for the edge, copper wire for the barrel, oxy-acetylene at works", () => {
  const m = meansOf(
    meansWorldOf({
      chem: SOLAR,
      kind: "carbon",
      celsius: 15,
      gravity: 1,
      medium: "land",
      bodyFire: true,
    }),
  );
  assert.equal(m.handCharge?.id, "hydrogen-cyanide");
  assert.equal(m.edge?.id, "moissanite");
  assert.equal(m.handBarrel.id, "copper-wire");
  assert.equal(m.worksCharge?.id, "oxy-acetylene");
});

test("a made-up world at 150 K with ammonia and no methane in its air picks hydrazine, by its numbers alone", () => {
  const made: MeansWorld = {
    kelvin: 150,
    airBar: 1,
    pull: 1,
    freeOxygen: false,
    medium: "land",
    bodyFire: true,
    rock: false,
    groundHolds: [],
    airHolds: ["ammonia"],
    seaKgM3: 1000,
    seaIsWater: false,
    ppm: () => 0,
  };
  const m = meansOf(made);
  assert.equal(m.handCharge?.id, "hydrazine");
  assert.equal(m.worksCharge?.id, "hydrazinium-azide");
  assert.equal(m.edge, null, "no hard stuff in its ground");
});

test("a gun at Earth's air and pull carries its table's range, to the bit, for all five arms", () => {
  for (const f of FIREARMS) {
    const g = gunHere(f, EARTH);
    assert.ok(g, f.id);
    assert.equal(g.range, f.range, f.id);
  }
});

test("thick air shortens a gun's range, and low pull lengthens it", () => {
  const musket = FIREARMS[0]!;
  const thick = gunHere(musket, { ...EARTH, airBar: 2 })!.range;
  const light = gunHere(musket, { ...EARTH, pull: 0.5 })!.range;
  assert.ok(thick < musket.range, `thick air: ${thick}`);
  assert.ok(light > musket.range, `low pull: ${light}`);
});
