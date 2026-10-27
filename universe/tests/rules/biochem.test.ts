import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BLOOD_WORDS,
  BONE_WORDS,
  EARTH_LIFE,
  KIND_SUBSTANCES,
  LIFE_ELEMENTS,
  LIFE_SUBSTANCES,
  MEMBRANE_WORDS,
  NOVEL_SUBSTANCES,
  PIGMENT_WORDS,
  SUBSTANCES,
  WORLD_KINDS,
  boneOf,
  dawnWords,
  earthMade,
  eats,
  eatsWords,
  findElement,
  findSubstance,
  lifeChemistryOf,
  molarMass,
  pigmentOf,
  type LifeChemistry,
  type LifeInputs,
} from "../../src/rules/index.ts";

// Phase 57: what a world's life is made of, from its kind, its chemistry, its star and its warmth.

const rocky: LifeInputs = {
  kind: "rocky",
  carbon: "oxide",
  metals: "solar",
  silica: "solar",
  star: 5778,
  mean: 15,
  hand: 0.2,
};

test("Earth's life is Earth's: phosphate bones, iron blood, left-handed proteins and right-handed sugars, green", () => {
  assert.equal(EARTH_LIFE.earth, true);
  assert.equal(EARTH_LIFE.family, "water");
  assert.equal(EARTH_LIFE.hand, "left");
  assert.equal(EARTH_LIFE.bone, "apatite");
  assert.equal(EARTH_LIFE.shell, "calcite");
  assert.equal(EARTH_LIFE.blood, "iron");
  assert.equal(EARTH_LIFE.breath, "oxygen");
  assert.equal(EARTH_LIFE.membrane, "bilayer");
  assert.equal(EARTH_LIFE.pigment, "chlorophyll");
  assert.deepEqual(
    [EARTH_LIFE.sugar, EARTH_LIFE.store, EARTH_LIFE.fibre, EARTH_LIFE.hair, EARTH_LIFE.flesh],
    ["sugar", "starch", "cellulose", "keratin", "protein"],
  );
  assert.ok(Object.isFrozen(EARTH_LIFE));
  assert.ok(earthMade(EARTH_LIFE));
  // (A world under a Sun-like star with Earth's chemistry and Earth's hand comes out as Earth's, but is not Earth.)
  const like = lifeChemistryOf(rocky);
  assert.ok(earthMade(like) && !like.earth);
  assert.deepEqual({ ...like, earth: true }, { ...EARTH_LIFE });
});

test("bones are hardened with what a world's seas hold and let stand", () => {
  const b = (over: Partial<LifeInputs>) => boneOf({ ...rocky, ...over });
  assert.equal(b({}), "apatite");
  assert.equal(b({ kind: "methane" }), "ice");
  assert.equal(b({ kind: "carbon" }), "greigite");
  assert.equal(b({ carbon: "carbon-rich" }), "greigite", "a carbon-rich rocky world's");
  assert.equal(b({ kind: "sulfur" }), "opal");
  assert.equal(b({ kind: "ammonia" }), "calcite");
  assert.equal(b({ metals: "poor", silica: "high" }), "opal");
  assert.equal(b({ metals: "poor" }), "calcite");
  assert.equal(b({ silica: "low" }), "calcite");
  assert.equal(b({ metals: "rich", silica: "high" }), "apatite");
  // Shells: lime beside phosphate bones, else the bones' own.
  assert.equal(lifeChemistryOf({ ...rocky, kind: "sulfur" }).shell, "opal");
  assert.equal(lifeChemistryOf(rocky).shell, "calcite");
});

test("pigments by the star's light: gold under a white star, green under a yellow, blue under an orange, black under a red; methane life its own amber", () => {
  assert.equal(pigmentOf("rocky", 7300), "carotene");
  assert.equal(pigmentOf("rocky", 6300), "carotene");
  assert.equal(pigmentOf("rocky", 5778), "chlorophyll");
  assert.equal(pigmentOf("rocky", 5300), "chlorophyll");
  assert.equal(pigmentOf("rocky", 4530), "phycocyanin");
  assert.equal(pigmentOf("rocky", 3899), "bacteriochlorophyll");
  assert.equal(pigmentOf("methane", 5778), "polyimine");
});

test("blood carries the breath on what holds it there: iron, copper in the cold, vanadium in acid, iron and sulfur for hydrogen", () => {
  const l = (over: Partial<LifeInputs>) => lifeChemistryOf({ ...rocky, ...over });
  assert.equal(l({}).blood, "iron");
  assert.equal(l({ mean: -4 }).blood, "copper");
  assert.equal(l({ kind: "sulfur" }).blood, "vanadium");
  for (const kind of ["carbon", "ammonia", "methane"] as const) {
    assert.equal(l({ kind }).breath, "hydrogen", kind);
    assert.equal(l({ kind }).blood, "iron-sulfur", kind);
  }
  assert.equal(l({ kind: "sulfur" }).breath, "oxygen");
});

test("each kind's life its own liquid, skins and stores; the hand mirrors what turns and leaves the rest", () => {
  const l = (over: Partial<LifeInputs>) => lifeChemistryOf({ ...rocky, ...over });
  assert.deepEqual(
    WORLD_KINDS.map((kind) => [kind, l({ kind }).family, l({ kind }).membrane]),
    [
      ["rocky", "water", "bilayer"],
      ["carbon", "oil", "inverted"],
      ["sulfur", "water", "tetraether"],
      ["ammonia", "ammonia", "supple"],
      ["methane", "methane", "azotosome"],
    ],
  );
  const mirror = l({ hand: 0.7 });
  assert.equal(mirror.hand, "right");
  assert.deepEqual(
    [mirror.sugar, mirror.store, mirror.fibre, mirror.hair, mirror.flesh],
    ["mirror-sugar", "mirror-starch", "mirror-cellulose", "mirror-keratin", "mirror-protein"],
  );
  assert.equal(l({ kind: "ammonia", hand: 0.7 }).store, "mirror-glucosamine-starch");
  assert.equal(l({ kind: "carbon", hand: 0.7 }).store, "squalene", "oil turns neither way");
  assert.equal(l({ kind: "methane" }).sugar, null);
});

test("every substance and element a world's life names is in the tables, with its weight a mole", () => {
  const all: LifeChemistry[] = [];
  for (const kind of WORLD_KINDS)
    for (const hand of [0.2, 0.7])
      for (const star of [3400, 4500, 5778, 7000])
        for (const mean of [-20, 15])
          all.push(lifeChemistryOf({ ...rocky, kind, hand, star, mean }));
  for (const l of all)
    for (const id of [
      l.liquid,
      l.sugar,
      l.store,
      l.fibre,
      l.hair,
      l.flesh,
      l.dye,
      BONE_WORDS[l.bone].subst,
      BONE_WORDS[l.shell].subst,
      BLOOD_WORDS[l.blood].subst,
      MEMBRANE_WORDS[l.membrane].subst,
      PIGMENT_WORDS[l.pigment].subst,
    ])
      if (id !== null) assert.ok(findSubstance(id), `${id} is a substance`);
  for (const s of LIFE_SUBSTANCES) {
    for (const e of Object.keys(s.formula)) assert.ok(findElement(e), `${s.id}: ${e}`);
    assert.ok(Number.isFinite(molarMass(s.formula)) && molarMass(s.formula) > 0, s.id);
  }
  assert.equal(findElement("V")?.name, "vanadium");
  assert.deepEqual(
    LIFE_ELEMENTS.map((e) => e.symbol),
    ["V"],
  );
});

test("life's matter stands beside Earth's and the others' tables: its ids its own, a mirror the same atoms", () => {
  const ids = LIFE_SUBSTANCES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, "unique");
  const others = new Set([...SUBSTANCES, ...NOVEL_SUBSTANCES, ...KIND_SUBSTANCES].map((s) => s.id));
  for (const id of ids) assert.ok(!others.has(id), `${id} is life's own`);
  for (const s of LIFE_SUBSTANCES.filter((x) => x.id.startsWith("mirror-"))) {
    const of = findSubstance(s.id.slice("mirror-".length))!;
    assert.deepEqual(s.formula, of.formula, s.id);
    assert.equal(s.density, of.density, s.id);
  }
  // (Earth's own tables keep their sizes.)
  assert.equal(SUBSTANCES.length, 65);
});

test("what eats what: the same liquid and sugars, and the same hand where what is eaten turns at all", () => {
  const l = (over: Partial<LifeInputs>) => lifeChemistryOf({ ...rocky, ...over }),
    left = l({}),
    right = l({ hand: 0.7 });
  assert.ok(eats(EARTH_LIFE, left));
  assert.ok(!eats(EARTH_LIFE, right));
  assert.ok(!eats(right, EARTH_LIFE));
  assert.ok(eats(left, l({ kind: "sulfur" })), "acid water's life is of water too");
  assert.ok(!eats(left, l({ kind: "ammonia" })), "nor ammonia's");
  assert.ok(
    eats(l({ kind: "carbon" }), l({ kind: "carbon", hand: 0.7 })),
    "oil's stores turn neither way",
  );
  assert.ok(!eats(l({ kind: "methane" }), l({ kind: "carbon" })));
  assert.equal(
    eatsWords(EARTH_LIFE, right),
    "its sugars turn the other way: nothing of it feeds them",
  );
  assert.match(eatsWords(EARTH_LIFE, l({ kind: "ammonia" })), /ammonia water, theirs in water/);
});

test("the dawn as Earth's life tells it is Earth's word for word; another's its own", () => {
  const earth = dawnWords(EARTH_LIFE, true);
  assert.equal(
    earth.replicators,
    "chains of matter that copied themselves, in the warm water of the young world",
  );
  assert.equal(
    earth.cells,
    "replicators inside a skin of fat: the first cells, dividing to fill the water",
  );
  assert.equal(
    earth.light,
    "cells that made their food from the star's light, breathing out a gas the air had never held",
  );
  assert.equal(earth.lightName, "Life eats light");
  assert.equal(earth.lightHow, "it came to eat light");
  assert.equal(earth.lightWhy, "where the sunlit water had food for none");
  assert.equal(earth.nucleus, "burning its food in the air the light-eaters had made");
  assert.equal(earth.weed, "green weed of the shallows");
  assert.equal(
    earth.weedWords,
    "the light-eaters' cells together: weeds swaying in the sunlit shallows",
  );
  assert.equal(earth.weedWhy, "to reach the light");
  assert.equal(earth.weedWay, "growing in the light");
  assert.equal(earth.air, "The air fills with oxygen");
  assert.equal(
    earth.airWords,
    "the light-eaters' breath gathered in the seas and the air, and the world's iron rusted red",
  );
  const methane = dawnWords(lifeChemistryOf({ ...rocky, kind: "methane" }), false);
  assert.match(methane.cells, /skin of acrylonitrile/);
  assert.equal(methane.air, "The haze feeds life");
  // (Under its haze, its life eats not light but what the light makes high in the air.)
  assert.equal(methane.lightName, "Life eats what the light makes");
  assert.match(methane.weedWords, /under the haze$/);
  assert.equal(methane.weedWhy, "to catch what falls from the haze");
  const red = dawnWords(lifeChemistryOf({ ...rocky, star: 3400 }), false);
  assert.match(red.light, /with bacteriochlorophyll, black/);
  assert.match(red.airWords, /too thin to rust/);
});
