// The liquid on a world's face, from its warmth, its air's weight and what it holds (rules/solvent.ts); and a
// world's kind as a case of it (rules/kinds.ts worldSolvent).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KIND_SOLVENT,
  WORLD_KINDS,
  boilAt,
  bodyLiquid,
  earthDegrees,
  homeHolds,
  kindFacts,
  kindSeas,
  kindBiomeName,
  liquidBand,
  stableLiquid,
  trueCelsius,
  vapourBar,
  worldKind,
  worldSolvent,
} from "../../src/rules/index.ts";

test("a liquid boils hotter under a heavier air, never past its critical point, and wants its triple point's air", () => {
  assert.ok(Math.abs(boilAt("water", 1) - 373.15) < 1e-9);
  // (Measured: water boils near 120 °C under 2 bar and near 71 °C on a mountain of a third of a bar.)
  assert.ok(Math.abs(boilAt("water", 2) - 393.4) < 2);
  assert.ok(Math.abs(boilAt("water", 0.33) - 344.5) < 2);
  assert.ok(Math.abs(boilAt("methane", 1.5) - 117) < 2);
  assert.equal(boilAt("carbon-dioxide", 1e6), 304.1);
  assert.equal(liquidBand("carbon-dioxide", 1), null, "dry ice goes straight to gas under one bar");
  assert.ok(liquidBand("carbon-dioxide", 20));
  assert.equal(liquidBand("water", 0.003), null);
});

test("the liquid a world holds most of, of those liquid there, fills its seas; else none, with why", () => {
  const earth = stableLiquid({ kelvin: 288, bar: 1, holds: { water: 0.7, salt: 0.02 } });
  assert.equal(earth.liquid, "water");
  // Mars: too thin an air. Venus's ground: far too hot for what it holds but salt, which is not yet molten.
  const mars = stableLiquid({ kelvin: 215, bar: 0.006, holds: { water: 0.5 } });
  assert.equal(mars.liquid, null);
  assert.match(mars.why, /too thin|frozen/);
  assert.equal(
    stableLiquid({ kelvin: 737, bar: 92, holds: { "sulfuric-acid": 0.9, salt: 0.02 } }).liquid,
    null,
  );
  // A world hot enough: its salts lie molten. A heavy cold air: liquid carbon dioxide.
  assert.equal(stableLiquid({ kelvin: 1200, bar: 1, holds: { salt: 0.02 } }).liquid, "salt");
  assert.equal(
    stableLiquid({ kelvin: 250, bar: 30, holds: { "carbon-dioxide": 0.6, water: 0.5 } }).liquid,
    "carbon-dioxide",
  );
  // Titan: methane and ethane both lie liquid at 94 K under 1.5 bar; warmer, only ethane.
  const titan = stableLiquid({ kelvin: 94, bar: 1.5, holds: { methane: 1.2, ethane: 0.8 } });
  assert.equal(titan.liquid, "methane");
  assert.deepEqual(titan.could, ["methane", "ethane"]);
  assert.equal(
    stableLiquid({ kelvin: 140, bar: 1.5, holds: { methane: 1.2, ethane: 0.8 } }).liquid,
    "ethane",
  );
});

test("the five kinds are cases of it, by every dial, and a seed's kind is the same with Earth's planet or its own", () => {
  const dial = (acts: string) => worldSolvent({ text: `alien 3 ${acts}`, mass: 1, ageGyr: 4.5 });
  for (const [acts, kind] of [
    ["~carbon oxygen ~volatiles water", "rocky"],
    ["~carbon carbon ~volatiles water", "carbon"],
    ["~carbon oxygen ~volatiles sulfur", "sulfur"],
    ["~carbon oxygen ~volatiles ammonia", "ammonia"],
    ["~carbon carbon ~volatiles methane", "methane"],
  ] as const) {
    const s = dial(acts);
    assert.equal(s.kind, kind, acts);
    assert.ok(s.stable, `${acts}: read from its numbers`);
    if (kind !== "methane") assert.equal(s.liquid, KIND_SOLVENT[kind]);
  }
  assert.deepEqual(Object.values(KIND_SOLVENT).length, WORLD_KINDS.length);
  // A frozen twin keeps the kind of what it gathered.
  for (let i = 0; i < 300; i++) {
    const text = `alien ${i}`,
      a = worldKind({ text, mass: 0.8, ageGyr: 5 });
    for (const celsius of [-40, 15, 60])
      assert.equal(
        worldKind({ text, mass: 0.8, ageGyr: 5, planet: { gravity: 1.3, celsius, seas: 0.2 } }),
        a,
      );
  }
});

test("a methane world's seas are ethane where it stands too warm for methane to lie", () => {
  const at = (celsius: number) =>
    worldSolvent({
      text: "alien 3 ~volatiles methane",
      mass: 1,
      ageGyr: 4.5,
      planet: { gravity: 1, celsius, seas: 0.6 },
    });
  // (Its twin's warmth is read in methane's band: 0 is 90 K, and each of its degrees 0.35 K.)
  const cold = at(2),
    warm = at(20);
  assert.equal(cold.liquid, "methane");
  assert.equal(warm.liquid, "ethane");
  for (const s of [cold, warm]) assert.equal(s.kind, "methane");
  assert.deepEqual(warm.read.could, ["ethane", "methane"]);
  // Methane's own vapour: 1 bar where it boils, about a ninth of that at its freezing (measured: 0.117).
  assert.ok(Math.abs(vapourBar("methane", 111.7) - 1) < 1e-9);
  assert.ok(Math.abs(vapourBar("methane", 90.7) - 0.117) < 0.02);
  // Half and half where a twentieth of its air's weight is half of methane's vapour's.
  const h = (kelvin: number) =>
    homeHolds({ gathered: "methane", carbonDisk: false, seas: 0.6, giving: 1, kelvin, bar: 1.5 });
  assert.ok(h(90.7).methane! > h(90.7).ethane!);
  assert.ok(h(100).methane! < h(100).ethane!);
  assert.ok(Math.abs(h(95).methane! + h(95).ethane! - 2) < 1e-12);
  // Its facts, its degrees and its seas' words are its liquid's.
  const like = { kind: "methane", liquid: "ethane" } as const,
    f = kindFacts(like);
  assert.equal(f.name, "an ethane world");
  assert.equal(f.liquid.subst, "ethane");
  assert.ok(f.liquid.boilK > 185 && f.liquid.boilK < 200);
  assert.ok(!earthDegrees(like));
  assert.ok(trueCelsius(like, 15) > trueCelsius("methane", 15) + 5);
  assert.equal(kindSeas(like)!.sea, "ethane sea");
  assert.equal(kindBiomeName(like, "ocean"), "ethane sea");
  assert.equal(kindBiomeName({ kind: "methane" }, "ocean"), "methane sea");
  assert.equal(kindFacts({ kind: "methane", liquid: "methane" }), kindFacts("methane"));
});

test("a system's other bodies: none on a giant or an airless rock, a cold sea past the frost line", () => {
  const body = (o: Partial<Parameters<typeof bodyLiquid>[0]>) =>
    bodyLiquid({
      kind: "rocky",
      temperature: 15,
      pressure: 1,
      water: "none",
      pastFrost: false,
      ...o,
    });
  assert.equal(body({ kind: "giant" }).liquid, null);
  assert.equal(body({ pressure: 0 }).liquid, null);
  assert.equal(body({ water: "seas" }).liquid, "water");
  assert.equal(
    body({ temperature: -179, pressure: 1.5, water: "ice", pastFrost: true }).liquid,
    "methane",
  );
  assert.equal(body({ temperature: 900, pressure: 1 }).liquid, "salt");
  assert.equal(body({ temperature: -20, pressure: 40 }).liquid, "carbon-dioxide");
});

test("a sulfur world's seas are sulfuric acid where its volcanoes give more of it than it has water", () => {
  const at = (ageGyr: number, seas: number) =>
    worldSolvent({
      text: "alien 3 ~volatiles sulfur",
      mass: 0.5,
      ageGyr,
      planet: { gravity: 1, celsius: 15, seas },
    });
  assert.equal(at(1, 0.6).liquid, "acid-water");
  assert.equal(at(1, 0.2).liquid, "sulfuric-acid");
  assert.equal(at(8, 0.2).liquid, "acid-water", "an old world's ground gives little");
  for (const s of [at(1, 0.6), at(1, 0.2), at(8, 0.2)]) assert.equal(s.kind, "sulfur");
  const f = kindFacts({ kind: "sulfur", liquid: "sulfuric-acid" });
  assert.equal(f.name, "a sulfuric-acid world");
  assert.equal(f.liquid.subst, "vitriol");
  assert.equal(f.liquid.freezeK, 283.5);
  assert.equal(f.liquid.boilK, 610);
  assert.ok(!earthDegrees({ kind: "sulfur", liquid: "sulfuric-acid" }));
  assert.ok(earthDegrees({ kind: "sulfur" }));
});
