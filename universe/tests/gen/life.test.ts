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
  methane = generateHomeWorld(seedFromText("alien 1429"), OPEN);

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

test("a methane world: ice bones, iron-and-sulfur blood breathing hydrogen, azotosome skins, living on what the haze makes", () => {
  const life = worldLife(methane);
  assert.deepEqual(
    [life.family, life.bone, life.breath, life.blood, life.membrane, life.pigment, life.store],
    ["methane", "ice", "hydrogen", "iron-sulfur", "azotosome", "polyimine", "acetylene"],
  );
  const rungs = treeOfLife(methane).rungs;
  assert.match(rungs.find((r) => r.id === "cells")!.words, /skin of acrylonitrile/);
  assert.equal(rungs.find((r) => r.id === "air")!.name, "The haze feeds life");
  assert.equal(rungs.find((r) => r.id === "light")!.name, "Life eats what the light makes");
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
