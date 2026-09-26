import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText, type Ref } from "../../src/kernel/index.ts";
import { generateHomeWorld, speciesRef } from "../../src/gen/index.ts";
import {
  CLADES,
  EARTHLIKE,
  OPEN,
  affordancesOf,
  bodyOf,
  type BodyPlan,
} from "../../src/rules/index.ts";
import { homePlanet, makePopulationWorld } from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";

test("under the Earthlike prior the people are always the upright apes, as Earth's", () => {
  for (const seed of ["first light", "kestrel", "juniper"]) {
    const p = generateHomeWorld(seedFromText(seed), EARTHLIKE).life.people!;
    assert.equal(p.body.clade, "ape");
    assert.deepEqual([p.body.size, p.body.span, p.body.young], [60, 70, 1]);
  }
});

test("on open worlds, the clade that rises is the one the world favours, with a body grown there", () => {
  const seen = new Map<string, BodyPlan>();
  for (let i = 0; i < 24; i++) {
    const w = generateHomeWorld(seedFromText(`alien ${i}`), OPEN),
      p = w.life.people;
    if (!p) continue;
    const clade = CLADES.find((c) => c.id === p.body.clade)!;
    // Its world suits it, and the same seed always grows the same body.
    assert.ok(
      clade.fit({
        warmth: w.climate.temperature[p.cell]!,
        rain: w.climate.precipitation[p.cell]!,
        gravity: w.planet.gravity,
        ocean: w.planet.oceanFraction,
      }) > 0,
      `${clade.id} on a world it does not suit`,
    );
    assert.deepEqual(generateHomeWorld(seedFromText(`alien ${i}`), OPEN).life.people!.body, p.body);
    assert.equal(w.life.species[p.species]!.name, p.body.name);
    seen.set(p.body.clade, p.body);
  }
  assert.ok(seen.size >= 4, `${[...seen.keys()].join(", ")}`);
});

test("a body's affordances follow from it by laws", () => {
  const cond = { warmth: 18, rain: 800, gravity: 1, ocean: 0.7 },
    of = (id: string, g = 1) =>
      bodyOf(
        CLADES.find((c) => c.id === id)!,
        { ...cond, gravity: g },
        [0.5, 0.5, 0.5],
      );
  // No fire in the water; hands handle best; fur keeps out the cold; heavier worlds grow smaller bodies.
  assert.equal(affordancesOf(of("swimmer")).fire, false);
  assert.equal(affordancesOf(of("ape")).fire, true);
  assert.ok(affordancesOf(of("ape")).dexterity > affordancesOf(of("burrower")).dexterity);
  assert.ok(affordancesOf(of("shaggy")).cold > affordancesOf(of("ape")).cold);
  assert.ok(of("ape", 2).size < of("ape", 1).size && of("ape", 0.5).size > of("ape", 1).size);
  assert.ok(affordancesOf(of("trunk")).strength > 5 * affordancesOf(of("ape")).strength);
  // A spawning body bears many young, but few live: its fecundity is its clutch discounted.
  assert.ok(affordancesOf(of("swimmer")).fecundity < of("swimmer").young);
});

test("the people's why tells their body and why their clade rose where it did", () => {
  const world = makePopulationWorld(seedFromText("first light")),
    people = homePlanet(world).generated.life.people!,
    claim = why(world, speciesRef(0, people.species) as Ref).claim;
  assert.match(claim, /hands freed by walking upright\. Upright apes: two-sided bodies of 60 kg/);
});
