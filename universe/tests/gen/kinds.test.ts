// Phase 56: a world's kind in its generation. A rocky world is generated as it always was, with no
// new key, so Earth's and Phase 54's worlds hash as they did, and a seed that now falls as a kind
// regenerates its old world when its kind is pinned rocky. A carbon or sulfur world keeps its twin's
// orbit and warmth; an ice world's planet is its twin read through its liquid: the same ground and
// climate, its orbit moved out to where its warmth truly falls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { climateMean, generateHomeWorld, worldKindOf } from "../../src/gen/index.ts";
import {
  EARTHLIKE,
  KINDS,
  OPEN,
  keptRocky,
  liquidDegrees,
  trueCelsius,
} from "../../src/rules/index.ts";

const alien = (text: string) => generateHomeWorld(seedFromText(text), OPEN);

test("Earth and Phase 54's worlds are rocky, with no new key on their planets", () => {
  const worlds = [
    generateHomeWorld(seedFromText("first light"), EARTHLIKE),
    alien("alien 16"),
    alien("alien 182"),
  ];
  for (const g of worlds) {
    assert.equal(worldKindOf(g), "rocky");
    assert.ok(!("kind" in g.planet) && !("climate" in g.planet), "no new key");
    assert.equal(climateMean(g.planet), g.planet.meanTemperature);
  }
  // A seed of Earth's prior is never another kind, whatever its acts say.
  const dialled = generateHomeWorld(seedFromText("first light ~volatiles methane"), EARTHLIKE);
  assert.equal(worldKindOf(dialled), "rocky");
});

test("a seed that now falls as a kind, pinned rocky, regenerates the world it made before", () => {
  // (Each digest is the one its plain seed made before Phase 56.)
  const before: Record<string, string> = {
    "alien 20": "2a1de9eebd5c964b",
    "alien 21": "d7671233c76cd692",
    "alien 61": "16db9a1604697892",
    "alien 62": "466eb32e7db93883",
  };
  for (const [seed, digest] of Object.entries(before)) {
    assert.notEqual(worldKindOf(alien(seed)), "rocky", `${seed} is a kind now`);
    const kept = alien(keptRocky(seed));
    assert.equal(worldKindOf(kept), "rocky");
    assert.equal(kept.digest, digest, seed);
  }
});

test("a carbon or sulfur world keeps its twin's orbit, warmth and ground", () => {
  for (const [seed, kind] of [
    ["alien 20", "carbon"],
    ["alien 21", "sulfur"],
  ] as const) {
    const g = alien(seed),
      twin = alien(keptRocky(seed));
    assert.equal(worldKindOf(g), kind);
    assert.equal(g.planet.orbitAu, twin.planet.orbitAu);
    assert.equal(g.planet.meanTemperature, twin.planet.meanTemperature);
    assert.ok(!("climate" in g.planet), "its degrees are Earth's");
    assert.deepEqual(g.tectonics.elevation, twin.tectonics.elevation);
    // Its home body has its kind's air, and its water where its kind keeps it.
    const home = g.system.bodies[0]!;
    assert.equal(home.air, KINDS[kind].body.air);
    assert.equal(home.water, KINDS[kind].body.water);
    assert.equal(home.pressure, KINDS[kind].body.pressure);
    assert.match(home.because[0]!, new RegExp(KINDS[kind].name));
  }
});

test("an ice world is its twin read through its liquid: the same climate, its orbit moved out", () => {
  for (const [seed, kind] of [
    ["alien 1429", "methane"],
    ["alien 428", "ammonia"],
  ] as const) {
    const g = alien(seed),
      twin = alien(keptRocky(seed)),
      l = KINDS[kind].liquid;
    assert.equal(worldKindOf(g), kind);
    // Its climate is built on its twin's warmth, read in its liquid's degrees.
    assert.equal(g.planet.climate, twin.planet.meanTemperature);
    assert.deepEqual(g.climate.temperature, twin.climate.temperature);
    assert.deepEqual(g.tectonics.elevation, twin.tectonics.elevation);
    // Its true warmth is that warmth on its liquid's scale, where the liquid stays liquid.
    assert.ok(Math.abs(g.planet.meanTemperature - trueCelsius(kind, g.planet.climate!)) < 1e-9);
    assert.ok(
      Math.abs(liquidDegrees(kind, g.planet.meanTemperature) - twin.planet.meanTemperature) < 1e-9,
    );
    const mean = g.planet.meanTemperature + 273.15;
    assert.ok(mean > l.freezeK - 30 && mean < l.boilK, `${seed}: ${mean} K`);
    // Moved out to where its star's light gives that warmth, its year by Kepler's law.
    assert.ok(g.planet.orbitAu > twin.planet.orbitAu * 1.5, `${seed} orbit`);
    assert.ok(g.planet.insolation < twin.planet.insolation);
    assert.ok(
      Math.abs(g.planet.yearDays - 365.25 * Math.sqrt(g.planet.orbitAu ** 3 / g.star.mass)) < 1e-6,
    );
    assert.equal(g.system.bodies[0]!.orbit.a, g.planet.orbitAu);
    assert.equal(g.system.bodies[0]!.air, "thick");
    assert.ok(g.planet.orbitAu > g.system.frostLine, `${seed} lies past its snow line`);
  }
});

test("where life never takes hold in a kind's liquid, the world is barren from the first", () => {
  const g = alien("alien 34");
  assert.equal(worldKindOf(g), "methane");
  assert.equal(g.life.species.length, 0);
  assert.equal(g.life.people, null);
  assert.ok(g.life.diversity.every((d) => d === 0));
  // Its twin's climate would have let life take hold.
  assert.ok(alien(keptRocky("alien 34")).life.species.length > 0);
});
