// A world's bulk chemistry (Phase 54 M221): the Sun's own case comes out the Sun's classes; the classes
// begin where they say; the Creator's makings land where the plan put them (a red or orange star's
// air thin, a white star's rich, a far orbit's rock rich in silica, a near orbit round an old star's
// poor in it); and what hardens copper follows the crust.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dmath } from "../../src/kernel/index.ts";
import {
  SOLAR,
  SUN,
  chemistryKey,
  chemistryOf,
  classesOf,
  hardenerOf,
  isSolarClassed,
  type MetalsClass,
  type SilicaClass,
} from "../../src/rules/chemistry.ts";

/** A star's warmth from its mass (src/gen/bodies.ts makeStar). */
function temperatureOf(mass: number): number {
  const luminosity = mass < 0.43 ? 0.23 * dmath.pow(mass, 2.3) : dmath.pow(mass, 4),
    radius = dmath.pow(mass, 0.8);
  return 5778 * dmath.pow(luminosity / (radius * radius), 0.25);
}
const US = [-1, -0.5, 0, 0.5, 0.999] as const;
const steps = (lo: number, hi: number, n: number) =>
  Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));

test("the Sun's own case comes out in the Sun's classes", () => {
  const c = chemistryOf({ ...SUN, u: [0, 0, 0] });
  assert.equal(c.carbon, "oxide");
  assert.equal(c.metals, "solar");
  assert.equal(c.silica, "solar");
  assert.equal(c.air, "solar");
  assert.equal(c.redox, "oxidised");
  assert.equal(c.hardener, "tin");
  assert.ok(Math.abs(c.feH) < 0.01, `[Fe/H] ${c.feH}`);
  assert.equal(c.mgSi, 1.05);
  assert.equal(c.o2, 0.2095);
  assert.equal(c.solar, false, "drawn, not the Sun's own tables");
  assert.ok(isSolarClassed(c));
  assert.equal(chemistryKey(SOLAR), "solar");
  assert.equal(chemistryKey(c), "oxide/solar/solar/solar");
  assert.ok(SOLAR.solar && Object.isFrozen(SOLAR));
});

test("each class begins where it says", () => {
  const bulk = { feH: 0, cO: 0.55, mgSi: 1.05, o2: 0.2095 };
  assert.equal(classesOf({ ...bulk, o2: 0.176 }).air, "solar");
  assert.equal(classesOf({ ...bulk, o2: 0.1759 }).air, "thin");
  assert.equal(classesOf({ ...bulk, o2: 0.2551 }).air, "rich");
  assert.equal(classesOf({ ...bulk, cO: 0.8 }).carbon, "carbon-rich");
  assert.equal(classesOf({ ...bulk, cO: 0.7999 }).carbon, "oxide");
  assert.equal(classesOf({ ...bulk, feH: -0.21 }).metals, "poor");
  assert.equal(classesOf({ ...bulk, feH: 0.21 }).metals, "rich");
  assert.equal(classesOf({ ...bulk, mgSi: 0.84 }).silica, "high");
  assert.equal(classesOf({ ...bulk, mgSi: 1.31 }).silica, "low");
  // Nothing rusts where the air is thin, or the rock is carbon-rich.
  assert.equal(classesOf({ ...bulk, o2: 0.15 }).redox, "reduced");
  assert.equal(classesOf({ ...bulk, cO: 0.9 }).redox, "reduced");
});

test("the makings land where the plan put them", () => {
  for (const u of US)
    for (const age of [0.5, 4.6, 12.6]) {
      const at = (mass: number, zone = 0.11, ageGyr = age) =>
        chemistryOf({ temperature: temperatureOf(mass), ageGyr, zone, u: [u, u, u] });
      for (const m of steps(0.35, 0.5, 7)) assert.equal(at(m).air, "thin", `red star ${m}`);
      for (const m of steps(0.6, 0.82, 7)) assert.equal(at(m).air, "thin", `orange star ${m}`);
      for (const m of steps(1.25, 1.6, 7)) assert.equal(at(m).air, "rich", `white star ${m}`);
      for (const z of steps(0.8, 1, 5)) assert.equal(at(1, z).silica, "high", `far orbit ${z}`);
      for (const z of steps(0, 0.18, 7))
        assert.equal(at(1, z, 12.6).silica, "low", `near orbit round an old star ${z}`);
    }
});

test("what hardens copper follows the crust: nickel where poor in silica, arsenic where poor in metals", () => {
  const silicas: SilicaClass[] = ["high", "solar", "low"],
    metals: MetalsClass[] = ["poor", "solar", "rich"];
  for (const s of silicas)
    for (const m of metals)
      assert.equal(
        hardenerOf(s, m),
        s === "low" ? "nickel" : m === "poor" ? "arsenic" : "tin",
        `${s} silica, ${m} metals`,
      );
});
