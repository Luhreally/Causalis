import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { generateHomeWorld, lives, speciesRef } from "../../src/gen/index.ts";
import { EARTHLIKE } from "../../src/rules/index.ts";
import { POPULATION_EVENTS, homePlanet, makePopulationWorld } from "../../src/sim/index.ts";
import { spine, why } from "../../src/causal/index.ts";

const worlds = ["first light", "kestrel", "moss"].map((s) => ({
  name: s,
  w: generateHomeWorld(seedFromText(s), EARTHLIKE),
}));

test("lineages arise age by age, and the great events and extremes take many", () => {
  for (const { w } of worlds) {
    const life = w.life;
    assert.ok(life.species.length >= 20);
    for (const s of life.species.filter((x) => x.niche !== "upright ape")) {
      assert.ok(s.arose >= 1, "after land plants arose");
      if (s.died !== null) assert.ok(s.died > s.arose, "dies after it arises");
    }
    const deaths = life.species.filter((s) => s.died !== null);
    assert.ok(deaths.length >= 3, `${deaths.length} lineages died out`);
    // Of those alive when an age began, an age of impact or great volcanism takes a larger share than a quiet one.
    const rate = (kind: string) => {
      let alive = 0,
        died = 0;
      for (const a of w.deep.ages.filter((x) => x.kind === kind))
        for (const s of life.species) {
          if (s.niche === "upright ape" || s.arose >= a.index) continue;
          if (s.died !== null && s.died < a.index) continue;
          alive++;
          if (s.died === a.index) died++;
        }
      return alive ? died / alive : null;
    };
    const quiet = rate("quiet");
    for (const k of ["impact", "great volcanism"]) {
      const hard = rate(k);
      if (hard !== null && quiet !== null)
        assert.ok(hard > quiet, `${k}: ${hard} against ${quiet}`);
    }
  }
});

test("the living range over the land joined to where they arose, as far as their climate suits", () => {
  for (const { w } of worlds) {
    const life = w.life;
    for (const s of life.species.filter((x) => x.died === null && x.niche !== "upright ape")) {
      let cells = 0;
      for (let c = 0; c < w.grid.count; c += 7) {
        if (!lives(life, c, s.index)) continue;
        cells++;
        assert.ok(w.tectonics.elevation[c]! > 0, "on land");
        assert.ok(
          Math.abs(w.climate.temperature[c]! - s.warm) <= s.tolerance,
          `${s.name}'s warmth`,
        );
        const rain = w.climate.precipitation[c]!;
        assert.ok(rain >= s.rainMin && rain <= s.rainMax, `${s.name}'s rain`);
      }
      assert.ok(cells >= 0);
    }
    // What can be tamed or sown is among what lives there.
    for (let c = 0; c < w.grid.count; c += 11) {
      const beast = life.herdBeast[c]!,
        grass = life.seedGrass[c]!;
      if (beast >= 0) assert.ok(life.species[beast]!.tame && lives(life, c, beast));
      if (grass >= 0) assert.ok(life.species[grass]!.tame && lives(life, c, grass));
    }
  }
  const names = worlds[0]!.w.life.species.map((s) => s.name);
  assert.equal(new Set(names).size, names.length, "each lineage its own name");
});

test("the first people begin where the upright apes arose, and say why", () => {
  const world = makePopulationWorld(seedFromText("first light")),
    life = homePlanet(world).generated.life,
    origin = world.events.all().find((e) => e.type === POPULATION_EVENTS.origin.type)!;
  assert.equal(origin.place, `cell:0:${life.people!.cell}`);
  const d = world.decisions.get(origin.causes[0]!.ref as Ref)!;
  assert.ok(d.factors.some((f) => f.source?.ref === speciesRef(0, life.people!.species)));
  const apes = why(world, speciesRef(0, life.people!.species));
  assert.match(apes.claim, /^The upright apes, the people: they arose in the last age/);
  const kinds = spine(world, origin.id).map((e) => e.ref.split(":")[0]);
  assert.ok(kinds.includes("spec"), kinds.join(" ← "));
});

test("sowing is first found where a wild grain grows, or in gardens where none does; herding only where a beast can be tamed", () => {
  for (const name of ["moss", "first light"]) {
    const world = makePopulationWorld(seedFromText(name), { start: "spread" });
    world.runTo(120 * YEAR);
    const life = homePlanet(world).generated.life;
    const cell = (place: string | null) => Number(place!.split(":")[2]);
    for (const e of world.events.all()) {
      if (e.type === POPULATION_EVENTS.cultivation.type) {
        const d = world.decisions.get(e.causes[0]!.ref as Ref)!;
        if (life.seedGrass[cell(e.place)]! >= 0)
          // A wild grain grows there, and the decision says which.
          assert.ok(d.factors.some((f) => f.source?.ref.startsWith("spec:")));
        // Where none does, the land's own roots and fruit were tended.
        else assert.ok(d.factors.some((f) => f.name === "roots and fruit to tend"));
      }
      if (e.type === POPULATION_EVENTS.herding.type) {
        assert.ok(life.herdBeast[cell(e.place)]! >= 0, "a beast that can be tamed lives there");
        assert.match(why(world, e.id).claim, /were tamed and first kept in herds/);
      }
    }
    const herded = world.events.all().some((e) => e.type === POPULATION_EVENTS.herding.type),
      tameAnywhere = life.species.some((s) => s.tame && s.niche === "grazer" && s.died === null);
    if (!tameAnywhere) assert.ok(!herded, `${name}: no beast to tame, so no herds`);
    if (name === "moss") assert.ok(herded, "moss's people tame its beasts");
  }
});
