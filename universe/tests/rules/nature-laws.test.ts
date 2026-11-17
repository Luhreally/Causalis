// The sweep's Nature lane, second pass: life of silicon's chains, a universe's own laws, young clusters where heavy stars shine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng, seedFromText, seedWithAct } from "../../src/kernel/index.ts";
import {
  EARTHLIKE,
  KCAL,
  OPEN,
  OUR_LAWS,
  backboneOf,
  bodyPull,
  boundAtom,
  eats,
  findSubstance,
  lawsOf,
  lifeChemistryOf,
  madePrior,
  makingAct,
  needsOf,
  routeTo,
  starLifetime,
  type LifeInputs,
} from "../../src/rules/index.ts";
import {
  NURSERIES,
  foreignPlanets,
  makeGalaxy,
  makePlanet,
  makeStar,
  sectorStars,
} from "../../src/gen/index.ts";

const acid: LifeInputs = {
  kind: "sulfur",
  carbon: "oxide",
  metals: "solar",
  silica: "high",
  star: 5778,
  mean: 120,
  hand: 0.2,
};

test("in hot acid on a world rich in silicon and poor in carbon, life is built of siloxanes; cooler, of carbon", () => {
  assert.equal(backboneOf(acid).backbone, "siloxane");
  assert.equal(backboneOf({ ...acid, mean: 40 }).backbone, "carbon");
  assert.equal(backboneOf({ ...acid, carbon: "carbon-rich" }).backbone, "carbon");
  assert.equal(backboneOf({ ...acid, kind: "rocky", mean: 15 }).backbone, "carbon");
  const si = lifeChemistryOf(acid);
  assert.equal(si.backbone, "siloxane");
  assert.equal(si.sugar, null);
  assert.equal(si.store, "cyclosiloxane");
  assert.equal(si.flesh, "polysiloxane");
  assert.equal(si.fibre, "polysiloxane");
  assert.equal(si.bone, "opal");
  // (Siloxanes hold in oxygen and water: nothing of its air breaks them.)
  assert.deepEqual(needsOf(si).poisons, []);
  // (Carbon's life and silicon's cannot feed each other.)
  assert.equal(eats(si, lifeChemistryOf({ ...acid, mean: 40 })), false);
});

test("silicon's lives are built of their own matter, named and fed on", () => {
  for (const id of [
    "polysilane",
    "tetrasilane",
    "polysilazane",
    "trisilazane",
    "polysiloxane",
    "cyclosiloxane",
  ]) {
    assert.ok(findSubstance(id), id);
    assert.ok((KCAL[id] ?? 0) > 0, id);
  }
  const cold = lifeChemistryOf({ ...acid, kind: "methane", mean: -180 });
  assert.equal(cold.backbone, "silane");
  assert.equal(cold.store, "tetrasilane");
  assert.equal(cold.flesh, "polysilane");
  // (Earth's life is Earth's.)
  const earth = lifeChemistryOf({ ...acid, kind: "rocky", silica: "solar", mean: 15 });
  assert.equal(earth.backbone, undefined);
  assert.equal(earth.store, "starch");
});

test("a universe's laws are ours unless laid, and a world like ours keeps ours", () => {
  assert.deepEqual(lawsOf("plain"), OUR_LAWS);
  assert.equal(madePrior(OPEN, "plain").laws, undefined);
  const quick = seedWithAct("plain", makingAct("burn", "quick"));
  assert.equal(lawsOf(quick).burn, 0.1);
  assert.equal(madePrior(EARTHLIKE, quick), EARTHLIKE);
  assert.equal(madePrior(OPEN, quick).laws?.burn, 0.1);
  assert.equal(starLifetime(1), 10);
  // (The same draws: its star's life and its age both a tenth, its light the same.)
  const ours = makeStar(new Rng(seedFromText("plain")), OPEN),
    theirs = makeStar(new Rng(seedFromText("plain")), madePrior(OPEN, quick));
  assert.equal(theirs.mass, ours.mass);
  assert.ok(Math.abs(theirs.lifetimeGyr / ours.lifetimeGyr - 0.1) < 1e-12);
  assert.ok(Math.abs(theirs.ageGyr / ours.ageGyr - 0.1) < 1e-12);
});

test("gravity's strength sets a world's pull, its year and what it costs to leave", () => {
  const strong = madePrior(OPEN, seedWithAct("plain", makingAct("gravity", "strong"))),
    star = makeStar(new Rng(seedFromText("plain")), OPEN),
    ours = makePlanet(new Rng(seedFromText("plain")), OPEN, star),
    theirs = makePlanet(new Rng(seedFromText("plain")), strong, star);
  assert.equal(theirs.mass, ours.mass);
  assert.ok(Math.abs(theirs.gravity / ours.gravity - 1.6) < 1e-12);
  assert.ok(Math.abs(theirs.yearDays * Math.sqrt(1.6) - ours.yearDays) < 1e-9);
  // (Ours exactly as before.)
  assert.equal(bodyPull(2, 1.2).g, 2 / (1.2 * 1.2));
  assert.equal(bodyPull(2, 1.2).escape, 11.19 * Math.sqrt(2 / 1.2));
  const bodies = [
    { around: -1, a: 1, periodDays: 365, mass: 1, radius: 1, pressure: 1 },
    { around: -1, a: 1.5, periodDays: 680, mass: 0.1, radius: 0.5, pressure: 0.01 },
  ];
  assert.deepEqual(routeTo(bodies, 1, 1, 1), routeTo(bodies, 1, 1));
  assert.ok(routeTo(bodies, 1, 1, 1.6).speed > routeTo(bodies, 1, 1).speed);
  // (Chemistry's binding: the materials' hook, ours untouched.)
  const iron = { ecoh: 4.28, meltK: 1811 };
  assert.equal(boundAtom(iron), iron);
  assert.equal(boundAtom(iron, 1.3).meltK, 1811 * 1.3);
});

test("heavy stars shine only in young clusters, at the arms", () => {
  let nurseries = 0,
    heavy = 0,
    field = 0;
  for (let n = 0; n < 6; n++) {
    const rng = new Rng(seedFromText(`cluster ${n}`)),
      g = makeGalaxy(rng);
    for (let i = -25; i <= 25; i++)
      for (let j = -25; j <= 25; j++) {
        const stars = sectorStars(rng, g, i, j, 0),
          young = stars.filter((s) => s.ageGyr < NURSERIES.oldest * 1.2);
        for (const s of stars)
          if (s.ageGyr >= 0.2) {
            field++;
            // (Every field star of eight Suns is long dead, and told so.)
            if (s.mass >= 8) assert.equal(s.spectral, "neutron star");
            if (starLifetime(s.mass) < 0.2) assert.ok(s.remnant);
          }
        if (!young.length) continue;
        nurseries++;
        for (const s of young) {
          assert.ok(s.k < 64);
          if (s.ageGyr < NURSERIES.forming) assert.deepEqual(foreignPlanets(rng, s), []);
          // (A star that lives under the field's youngest age shines here and nowhere else.)
          if (starLifetime(s.mass) < 0.2 && !s.remnant) heavy++;
        }
      }
  }
  assert.ok(field > 10_000);
  assert.ok(nurseries > 0 && nurseries < 60, `${nurseries} young clusters`);
  assert.ok(heavy > 0, `${heavy} heavy stars alive`);
});
