// Phase F2 (T1, docs/architecture/first-principles-plan.md and the F2/F3 spec): the means of heat, read from
// a world's numbers. Every world here is built by hand from its numbers, with no kind passed: what it holds
// (its air, its rock and soils, its sunlight) is all the readings look at. Earth's readings stay as they were:
// its air holds nothing but Earth's, so every new reading is shut and quiet, and its burning road stays open.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SOLAR } from "../../src/rules/chemistry.ts";
import {
  flightPower,
  glassOf,
  joinedHeat,
  meansOf,
  mirrorHeat,
  reachIn,
  vesselOf,
  type MeansWorld,
} from "../../src/rules/means.ts";
import { rowReadings, type FunctionReading } from "../../src/rules/properties.ts";

/** A world from its numbers: Earth's sunlight and air, no oxygen, no body fire, no rock, unless given. */
function worldOf(over: Partial<MeansWorld>): MeansWorld {
  return {
    kelvin: 288.15,
    airBar: 1,
    pull: 1,
    freeOxygen: false,
    medium: "land",
    bodyFire: false,
    rock: false,
    groundHolds: [],
    airHolds: [],
    seaKgM3: 1000,
    seaIsWater: false,
    ppm: () => 0,
    sunWm2: 1361,
    rockHolds: [],
    grips: true,
    bodyKg: 60,
    beast: { name: "horse", kg: 500 },
    metalShare: 1,
    nickel: false,
    firstRoad: false,
    ...over,
  };
}

/** Its rows, by id, read by its means and the Sun's chemistry (no kind anywhere). */
function readingsOf(m: MeansWorld): Map<string, FunctionReading> {
  return new Map(rowReadings({ chem: SOLAR, means: m }).map((f) => [f.id, f] as const));
}

test("Earth's numbers: reachIn is true, the four burning rows are met, every other row is unmet and quiet", () => {
  const earth = worldOf({
    freeOxygen: true,
    bodyFire: true,
    rock: true,
    rockHolds: ["quartz", "feldspar", "mica", "calcite", "kaolinite", "clay", "hematite"],
    firstRoad: true,
  });
  assert.equal(
    reachIn(meansOf(earth), () => false),
    true,
  );
  const read = readingsOf(earth);
  const met = [...read.values()]
    .filter((f) => f.met)
    .map((f) => f.id)
    .sort();
  assert.deepEqual(met, [
    "bloom-an-iron",
    "fire-a-vessel",
    "harden-copper",
    "melt-a-glass",
    "ride-a-beast",
  ]);
  for (const f of read.values()) assert.equal(f.quiet, true, f.id);
});

test("rocky land with no body for fire, and rocky water: each reaches what its own means reach (F4)", () => {
  const rockyLand = worldOf({ freeOxygen: true, bodyFire: false, rock: true });
  const rockyWater = worldOf({ medium: "water", freeOxygen: false, bodyFire: false, rock: true });
  assert.equal(
    reachIn(meansOf(rockyLand), () => true),
    mirrorHeat(rockyLand, 20000),
  );
  assert.equal(
    reachIn(meansOf(rockyWater), () => false),
    0,
  );
  assert.equal(
    reachIn(meansOf(rockyWater), () => true),
    464,
  );
});

test("mirrors at Earth's sun: C 2000 gives about 1787 C, C 20000 about 3390 C", () => {
  const sun = worldOf({ sunWm2: 1361, rockHolds: [] });
  const small = mirrorHeat(sun, 2000);
  const great = mirrorHeat(sun, 20000);
  assert.ok(small >= 1760 && small <= 1810, `small mirror ${small}`);
  assert.ok(great >= 3300 && great <= 3500, `great mirror ${great}`);
});

test("methane at 91 K: mirrors below 0, joined acetylene 1670, the ground 90 with nothing known, the arc 3000 with polymer wire", () => {
  const world = worldOf({
    kelvin: 91,
    airBar: 1.5,
    pull: 1.13,
    groundHolds: ["water-ice"],
    airHolds: ["methane", "hydrogen"],
    sunWm2: 12.3,
    rockHolds: ["tholin", "water-ice"],
  });
  const methane = meansOf(world);
  assert.ok(mirrorHeat(world, 2000) < 0, `mirror ${mirrorHeat(world, 2000)}`);
  assert.equal(joinedHeat(world), 1670);
  assert.equal(
    reachIn(methane, () => false),
    90,
  );
  assert.equal(
    reachIn(methane, (id) => id === "joined-hearth"),
    1670,
  );
  assert.equal(
    reachIn(methane, (id) => id === "polymer-wire"),
    3000,
  );
  assert.equal(vesselOf(world)?.id, "tholin");
  assert.equal(glassOf(world)?.id, "fallen");
});

test("ammonia at 173 K: mirrors about 829 C, no joined acetylene, clay to fire and quartz to melt", () => {
  const ammonia = worldOf({
    kelvin: 173,
    airHolds: ["ammonia"],
    sunWm2: 111.6,
    rockHolds: ["quartz", "kaolinite"],
  });
  assert.ok(Math.abs(mirrorHeat(ammonia, 2000) - 829) <= 1, `mirror ${mirrorHeat(ammonia, 2000)}`);
  assert.equal(joinedHeat(ammonia), 0);
  assert.equal(vesselOf(ammonia)?.id, "clay");
  assert.equal(glassOf(ammonia)?.id, "quartz");
});

test("carbon at 276 K: mirrors about 1597 C, and a pitch-bound vessel", () => {
  const carbon = worldOf({
    kelvin: 276,
    rock: true,
    airHolds: ["carbon-monoxide", "methane"],
    sunWm2: 925.3,
    rockHolds: ["bitumen", "quartz", "cohenite"],
  });
  assert.ok(Math.abs(mirrorHeat(carbon, 2000) - 1597) <= 1, `mirror ${mirrorHeat(carbon, 2000)}`);
  assert.equal(vesselOf(carbon)?.id, "pitch");
});

test("a made-up world at 150 K, ammonia in its air, kaolinite underfoot, no oxygen: heat from the ground and a fired vessel are met", () => {
  const made = worldOf({
    kelvin: 150,
    airHolds: ["ammonia"],
    rockHolds: ["kaolinite"],
    rock: true,
    freeOxygen: false,
    bodyFire: true,
  });
  const read = readingsOf(made);
  assert.equal(read.get("heat-from-ground")?.met, true);
  assert.equal(read.get("fire-a-vessel")?.met, true);
  assert.equal(
    read.get("melt-a-glass")?.met,
    false,
    "no quartz, and no glass from fallen stones on rock",
  );
  assert.equal(read.get("bloom-an-iron")?.met, false, "no oxygen to bloom it");
  assert.equal(
    read.get("heat-from-ground")?.quiet,
    undefined,
    "a world held by its air is not quiet",
  );
});

test("flight: wren's numbers fly on wings, vale's do not, and a light pull builds high", () => {
  const wren = worldOf({
    kelvin: 91,
    airBar: 1.5,
    pull: 1.13,
    airHolds: ["methane", "hydrogen"],
    rockHolds: ["tholin", "water-ice"],
    sunWm2: 12.3,
  });
  assert.ok(flightPower(wren) < 0.6, `wren ${flightPower(wren)}`);
  assert.equal(readingsOf(wren).get("fly-on-wings")?.met, true);

  // Vale 471's flight power is 0.9 (spec section 3); its air is set here to give that power.
  const vale = worldOf({ kelvin: 288.15, airBar: 3.8, pull: 1.458, airHolds: ["ammonia"] });
  assert.ok(Math.abs(flightPower(vale) - 0.9) < 0.01, `vale ${flightPower(vale)}`);
  assert.equal(readingsOf(vale).get("fly-on-wings")?.met, false);

  const light = worldOf({ pull: 0.65, airHolds: ["ammonia"] });
  assert.equal(readingsOf(light).get("build-high")?.met, true);
});
