import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { generateHomeWorld, type HomeWorld } from "../../src/gen/index.ts";
import { HUMANLIKE, OPEN, growthOf, riskUnder } from "../../src/rules/index.ts";
import { ALIEN } from "../../src/host/planet.ts";
import { capacity, homePlanet, livable, populationContext } from "../../src/sim/index.ts";
import { spread, survey } from "../../tools/diversity.ts";

/** The first open world (of sixty) that fits. */
function first(fits: (g: HomeWorld) => boolean): string {
  for (let i = 0; i < 60; i++)
    if (fits(generateHomeWorld(seedFromText(`alien ${i}`), OPEN))) return `alien ${i}`;
  throw new Error("no such world in sixty");
}

test("a world where no people rose is still a world to watch: its time turns, its globe is drawn", () => {
  const seed = first((g) => !g.life.people),
    world = ALIEN.build(seedFromText(seed));
  world.runTo(20 * YEAR);
  assert.equal(world.now, 20 * YEAR);
  assert.equal(populationContext(world).provinces.all().length, 0);
  assert.ok(ALIEN.frames.globe!(world, { view: "globe", focus: null }).arrays);
  // The report calls it what it is.
  assert.equal(survey(seed, 5).outcome, "lifeless");
});

test("hardship and healing scale the hazard of death: near-certain losses stay near-certain", () => {
  assert.ok(Math.abs(riskUnder(0.3, 1) - 0.3) < 1e-12);
  // A small chance is about m times as likely.
  assert.ok(Math.abs(riskUnder(0.01, 2) - 0.0199) < 1e-4);
  // A little medicine does not turn a spawning people's lost young into survivors.
  assert.ok(riskUnder(0.992, 0.7) > 0.96);
  // And no hardship pushes a chance past certainty.
  assert.ok(riskUnder(0.9, 3.5) < 1 && riskUnder(0.999, 5) <= 1);
});

test("a short-lived people does not outbreed the chronicle: it grows by the century as the apes do", () => {
  // A small sea people of a short life (their young near all lost, their herb-lore early).
  const seed = "alien 29",
    world = ALIEN.build(seedFromText(seed)),
    body = homePlanet(world).generated.life.people!.body;
  assert.ok(body.span < 35 && body.medium === "water", `${seed}: ${body.clade}, ${body.span}`);
  const ctx = populationContext(world),
    count = () => ctx.provinces.all().reduce((s, p) => s + p.total(), 0),
    before = count();
  world.runTo(100 * YEAR);
  // The apes at plenty grow about twice over in a century; so, now, does anyone.
  const apes = Math.exp(100 * growthOf(HUMANLIKE)),
    grew = count() / before;
  assert.ok(
    grew < 1.25 * apes,
    `grew ${grew.toFixed(2)} in a century, apes at plenty ${apes.toFixed(2)}`,
  );
});

test("where no grass bears seed worth sowing, a people comes to gardens of roots and fruit", () => {
  const seed = first((g) => {
      const people = g.life.people;
      if (!people || g.life.seedGrass.some((s) => s >= 0)) return false;
      for (let c = 0; c < g.grid.count; c++)
        if (livable(g, c, people.body.medium) && capacity(g, c, people.body.medium).farm > 0)
          return true;
      return false;
    }),
    world = ALIEN.build(seedFromText(seed)),
    ctx = populationContext(world);
  let found: Ref | null = null;
  for (let y = 1; y <= 100 && !found; y++) {
    world.runTo(y * YEAR);
    for (const e of world.events.all())
      if (e.type === "knowledge.cultivation" && e.t > (y - 1) * YEAR) found = e.id;
  }
  assert.ok(found, `${seed}: no one sowed in a century`);
  // Found by tending the land's own plants.
  const decision = world.decisions.get(world.events.get(found)!.causes[0]!.ref)!;
  assert.ok(
    decision.factors.some((f) => f.name === "roots and fruit to tend"),
    decision.factors.map((f) => f.name).join(", "),
  );
  assert.ok(ctx.provinces.all().some((p) => p.knowsCultivation));
});

test("the diversity report tells worlds apart", () => {
  const surveys = [
      survey("alien 29", 30),
      survey(
        first((g) => !g.life.people),
        5,
      ),
    ],
    s = spread(surveys);
  assert.equal(s.worlds, 2);
  assert.deepEqual(s.outcomes, { foragers: 1, lifeless: 1 });
  assert.equal(s.clades.swimmer, 1);
  assert.equal(s.media.water, 1);
  assert.ok(surveys[0]!.peak > 0 && surveys[0]!.lands > 0);
});
