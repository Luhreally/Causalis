import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import {
  civLife,
  generateHomeWorld,
  handDraw,
  lifeInputs,
  treeOfLife,
  worldChemistry,
  worldLife,
} from "../../src/gen/index.ts";
import { EARTH_LIFE, OPEN, PRIORS, lifeChemistryOf } from "../../src/rules/index.ts";

// Phase 57: a world's life read from its kind, chemistry, star and warmth, its hand a draw of its ground.

const earth = generateHomeWorld(seedFromText("first light"), PRIORS.earthlike!),
  sulfur = generateHomeWorld(seedFromText("alien 84"), OPEN),
  methane = generateHomeWorld(seedFromText("alien 73"), OPEN),
  silane = generateHomeWorld(seedFromText("alien 1429"), OPEN);

test("an Earth-like world's life is Earth's own, and its dawn Earth's words", () => {
  assert.equal(worldLife(earth), EARTH_LIFE);
  const rungs = treeOfLife(earth).rungs;
  assert.equal(
    rungs.find((r) => r.id === "cells")!.words,
    "replicators inside a skin of fat: the first cells, dividing to fill the water",
  );
  assert.equal(rungs.find((r) => r.id === "air")!.name, "The air fills with oxygen");
});

test("a world's life is read from its making, never drawn from its stream: the same each time, its hand its ground's", () => {
  const digest = sulfur.digest,
    life = worldLife(sulfur);
  assert.equal(worldLife(sulfur), life, "kept by its ground");
  assert.deepEqual(life, lifeChemistryOf(lifeInputs(sulfur)));
  assert.equal(lifeInputs(sulfur).hand, handDraw(sulfur.ground));
  assert.equal(sulfur.digest, digest, "reading it changes nothing of the world");
  const again = generateHomeWorld(seedFromText("alien 84"), OPEN);
  assert.equal(again.digest, digest);
  assert.deepEqual(worldLife(again), life);
});

test("a sulfur world under a red star: glass bones, vanadium blood, skins acid cannot part, black with bacteriochlorophyll", () => {
  const life = worldLife(sulfur);
  assert.equal(worldChemistry(sulfur).kind, "sulfur");
  assert.ok(sulfur.star.temperature < 3900);
  assert.deepEqual(
    [life.family, life.bone, life.blood, life.membrane, life.pigment],
    ["water", "opal", "vanadium", "tetraether", "bacteriochlorophyll"],
  );
  assert.match(treeOfLife(sulfur).rungs.find((r) => r.id === "replicators")!.words, /acid water/);
});

test("a methane world rich in carbon: ice bones, iron-and-sulfur blood breathing hydrogen, azotosome skins, living on what the haze makes", () => {
  const life = worldLife(methane);
  assert.equal(worldChemistry(methane).kind, "methane");
  assert.equal(life.backbone, undefined, "its chains are carbon's");
  assert.deepEqual(
    [life.family, life.bone, life.breath, life.blood, life.membrane, life.pigment, life.store],
    ["methane", "ice", "hydrogen", "iron-sulfur", "azotosome", "polyimine", "acetylene"],
  );
  const rungs = treeOfLife(methane).rungs;
  assert.match(rungs.find((r) => r.id === "cells")!.words, /skin of acrylonitrile/);
  assert.equal(rungs.find((r) => r.id === "air")!.name, "The haze feeds life");
  assert.equal(rungs.find((r) => r.id === "light")!.name, "Life eats what the light makes");
});

test("a methane world whose rock is rich in silicon and poor in carbon: the same life built of silicon's chains, its store and stalks silanes, no sugar", () => {
  // (alien 1429 since the sweep's Nature lane: rules/biochem.ts backboneOf. All else of a methane world's life stays.)
  const life = worldLife(silane),
    inputs = lifeInputs(silane);
  assert.equal(worldChemistry(silane).kind, "methane");
  assert.equal(inputs.silica, "high");
  assert.notEqual(inputs.carbon, "carbon-rich");
  assert.equal(life.backbone, "silane");
  assert.deepEqual(
    [life.family, life.bone, life.breath, life.blood, life.membrane, life.pigment],
    ["methane", "ice", "hydrogen", "iron-sulfur", "azotosome", "polyimine"],
  );
  assert.deepEqual(
    [life.store, life.fibre, life.hair, life.flesh, life.sugar],
    ["tetrasilane", "polysilane", "polysilane", "polysilane", null],
  );
  assert.equal(treeOfLife(silane).rungs.find((r) => r.id === "air")!.name, "The haze feeds life");
});

test("a people of another star: of water, their hand their own, their pigment their star's", () => {
  const a = civLife({ ref: "civ:0:1" }, 5778),
    b = civLife({ ref: "civ:0:1" }, 3400);
  assert.equal(a.family, "water");
  assert.equal(a.hand, b.hand, "their hand is theirs, whatever their star");
  assert.equal(a.pigment, "chlorophyll");
  assert.equal(b.pigment, "bacteriochlorophyll");
  const hands = new Set(
    Array.from({ length: 40 }, (_, i) => civLife({ ref: `civ:0:${i}` }, 5778).hand),
  );
  assert.equal(hands.size, 2, "some turn each way");
});
