// F4: rocky worlds read as any other (docs/architecture/first-principles-plan.md). A people turns aside only
// where its numbers shut the first way; Earth, at the Sun's own chemistry, never does; every row's words are
// true of its world whether it is met or not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SOLAR, type Chemistry } from "../../src/rules/chemistry.ts";
import { meansName, meansOf, mountWords, reachIn, turnsAside } from "../../src/rules/means.ts";
import { PRINCIPLES, principle } from "../../src/rules/principles.ts";
import {
  edgeWithoutMetal,
  meansWorldOf,
  rowReadings,
  type FunctionReading,
} from "../../src/rules/properties.ts";

/** A rocky world of its own chemistry, at a share of the Sun's metals and with what hardens its copper. */
const chemOf = (feH: number, hardener: Chemistry["hardener"] = "arsenic"): Chemistry => ({
  ...SOLAR,
  solar: false,
  feH,
  metals: feH < -0.2 ? "poor" : "solar",
  hardener,
});
const rocky = (
  chem: Chemistry,
  over: {
    grips?: boolean;
    bodyKg?: number;
    beast?: { name: string; kg: number } | null;
    gravity?: number;
  } = {},
) =>
  meansWorldOf({
    chem,
    kind: "rocky",
    celsius: 15,
    gravity: 1,
    medium: "land",
    bodyFire: true,
    insolation: 1,
    ...over,
  });
const row = (chem: Chemistry, w: ReturnType<typeof rocky>, id: string): FunctionReading =>
  rowReadings({ chem, means: w }).find((f) => f.id === id)!;

const EARTH = rocky(SOLAR);

test("Earth stays on its first road: every stand-in shut, with words true of it", () => {
  const m = meansOf(EARTH);
  assert.equal(m.firstRoad, true);
  assert.equal(m.edgeRoad, false);
  assert.equal(m.hardens, true);
  assert.equal(
    reachIn(m, () => false),
    true,
  );
  const met = rowReadings({ chem: SOLAR, means: EARTH })
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
  assert.match(row(SOLAR, EARTH, "engine-by-mirror").why, /coal drives its engines/);
  assert.match(row(SOLAR, EARTH, "engine-from-ground").why, /coal drives its engines/);
  // (Earth's small horses carry its riders as they always have: its own road, by the Sun's chemistry.)
  const small = rocky(SOLAR, { beast: { name: "horse", kg: 51 } });
  assert.equal(meansOf(small).rides, true);
  assert.equal(meansName("riding", meansOf(EARTH)), null);
  assert.equal(meansName("set-edges", meansOf(EARTH)), null);
});

test("no hardener: below three tenths of the Sun's metals no vein gathers one, and nickel is not thinned", () => {
  const low = chemOf(-0.57),
    above = chemOf(-0.51),
    nickel = chemOf(-0.61, "nickel");
  assert.equal(meansOf(rocky(low)).hardens, false);
  assert.equal(meansOf(rocky(above)).hardens, true);
  assert.equal(meansOf(rocky(nickel)).hardens, true);
  const shut = row(low, rocky(low), "harden-copper");
  assert.equal(shut.met, false);
  assert.match(shut.why, /27% of the Sun's metals/);
  assert.equal(row(above, rocky(above), "harden-copper").met, true);
  assert.match(edgeWithoutMetal({ means: rocky(low) }).why, /no bronze/);
});

test("a land turns aside only where it lacks the first way", () => {
  const plain = meansOf(rocky(chemOf(0))),
    thin = meansOf(rocky(chemOf(-0.6))),
    claws = meansOf(rocky(chemOf(0), { grips: false })),
    metal = { lacks: "metal" } as const,
    coal = { lacks: "coal" } as const;
  assert.equal(
    turnsAside(metal, plain, () => true),
    false,
    "copper in reach, a hardener, and hands",
  );
  assert.equal(
    turnsAside(metal, plain, () => false),
    true,
    "no copper in reach",
  );
  assert.equal(
    turnsAside(metal, thin, () => true),
    true,
    "no hardener can gather",
  );
  assert.equal(
    turnsAside(metal, claws, () => true),
    true,
    "limbs that cannot grip",
  );
  assert.equal(
    turnsAside(coal, plain, () => true),
    false,
  );
  assert.equal(
    turnsAside(coal, plain, () => false),
    true,
  );
  assert.equal(
    turnsAside({}, plain, () => true),
    true,
    "a row with no stand-in",
  );
  // (Where nothing burns the row is that world's first way: nothing is asked.)
  assert.equal(
    turnsAside(coal, { burns: false, hardens: true, grips: true }, () => true),
    true,
  );
});

test("flakes and mirrors are named as what they are on a rocky alien world, whether or not they have come", () => {
  const chem = chemOf(0),
    w = rocky(chem, { grips: true }),
    m = meansOf(w);
  assert.equal(m.firstRoad, false);
  assert.equal(m.edgeRoad, true);
  const edge = edgeWithoutMetal({ means: w });
  assert.equal(edge.met, true);
  assert.match(edge.why, /no copper within reach/);
  assert.match(meansName("set-edges", m)!, /^long blades of .* flakes set in a spine$/);
  assert.match(meansName("bound-plates", m)!, /^plates of .* bound in fibre$/);
  const sun = row(chem, w, "engine-by-mirror");
  assert.equal(sun.met, true);
  assert.match(sun.why, /no coal within reach/);
  const clawed = rocky(chem, { grips: false });
  assert.match(edgeWithoutMetal({ means: clawed }).why, /strapped along the limb/);
});

test("beasts decide mounts: three times the rider, by its name, else on foot", () => {
  const chem = chemOf(0),
    big = rocky(chem, { bodyKg: 80, beast: { name: "brindled stilt-grazer", kg: 341 } }),
    small = rocky(chem, { bodyKg: 90, beast: { name: "dun grazer", kg: 58 } }),
    none = rocky(chem, { bodyKg: 57, beast: null });
  assert.equal(meansOf(big).rides, true);
  assert.equal(meansName("riding", meansOf(big)), "riding the brindled stilt-grazer");
  assert.equal(meansName("cavalry", meansOf(big)), "riders of the brindled stilt-grazer in ranks");
  assert.equal(meansOf(small).rides, false);
  assert.equal(meansName("riding", meansOf(small)), null);
  const shut = row(chem, small, "ride-a-beast");
  assert.equal(shut.met, false);
  assert.match(shut.why, /dun grazer, is 58 kg; a rider of 90 kg wants 270 kg/);
  assert.match(row(chem, none, "ride-a-beast").why, /No beast of this world can be tamed/);
  assert.match(row(chem, big, "ride-a-beast").why, /341 kg, carries a rider of 80 kg/);
});

test("pull and air read as they do on any world: light pull builds high and flies", () => {
  const chem = chemOf(0),
    light = rocky(chem, { gravity: 0.66 }),
    heavy = rocky(chem, { gravity: 1.3 });
  assert.equal(row(chem, light, "build-high").met, true);
  assert.equal(row(chem, light, "fly-on-wings").met, true);
  assert.equal(row(chem, heavy, "build-high").met, false);
  assert.equal(row(chem, heavy, "fly-on-wings").met, false);
  assert.match(row(chem, heavy, "fly-on-wings").why, /too dear to fly/);
});

test("the tree: iron and building can follow flakes, and stand-ins ask for what they stand in for", () => {
  assert.deepEqual(principle("iron").needs, ["bronze|set-edges"]);
  assert.deepEqual(principle("masonry").needs, ["bronze|carbide-blades|ice-working|set-edges"]);
  assert.deepEqual(principle("riding").asks, ["ride-a-beast"]);
  assert.deepEqual(principle("sun-engines").asks, ["engine-by-mirror"]);
  assert.equal(principle("set-edges").drivers.lacks, "metal");
  assert.equal(principle("sun-engines").drivers.lacks, "coal");
  assert.equal(principle("heat-engines").drivers.lacks, "coal");
  // (No new rows: every land's draws stay at their places.)
  assert.equal(PRINCIPLES.length, 131);
});

test("a host rides the beast its world has, and Earth's on horseback", () => {
  assert.equal(
    mountWords("spears, on horseback", "woolly strider"),
    "spears, riding the woolly strider",
  );
  assert.equal(
    mountWords("rifles, as horsemen in ranks", "woolly strider"),
    "rifles, as riders of the woolly strider in ranks",
  );
  assert.equal(mountWords("spears, on horseback", null), "spears, on horseback");
});
