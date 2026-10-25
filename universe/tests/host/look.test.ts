import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { treeOfLife } from "../../src/gen/index.ts";
import { ALIEN, EARTH } from "../../src/host/planet.ts";
import { folkFacts, peopleFigure } from "../../src/host/folk.ts";
import { homePlanet, livable, populationContext } from "../../src/sim/index.ts";
import type { CampNear, GenesisPlan, LandPlan, WarsMap } from "../../src/bridge/index.ts";

// Phase 34 M176: what a people's look is made of, gathered from their world as it was made.

const alien = ALIEN.build(seedFromText("violet hollow"));
alien.runTo(YEAR / 8);
const ask = <T>(type: string, args: unknown = {}) => ALIEN.queries[type]!(alien, args) as T;

test("a world not Earth: its people's figure carries what their look is made of — their world, their forebears", () => {
  const g = populationContext(alien).generated,
    folk = folkFacts(g)!;
  assert.ok(folk, "facts gathered");
  assert.equal(folk.gravity, g.planet.gravity);
  assert.equal(folk.star, g.star.temperature);
  const cell = g.life.people!.cell;
  assert.equal(folk.warmth, g.climate.temperature[cell]);
  assert.equal(folk.biome, g.climate.biome[cell]);
  // (Their forebears, as the tree of life has them.)
  const tree = treeOfLife(g),
    them = tree.nodes.find((n) => n.kind === "people")!,
    fore = tree.nodes[them.parent]!.genome!;
  assert.deepEqual(folk.forebears, {
    neck: fore.neck,
    tail: fore.tail,
    grows: [...fore.grows],
    eyes: fore.eyes,
    feelers: fore.feelers,
    pattern: fore.pattern,
    covering: fore.skin,
    legs: fore.legs,
  });
  assert.equal(folkFacts(g), folk, "gathered once a world");
  // The one copy every plan carries: a camp's, as the world's own.
  const ctx = populationContext(alien),
    land = [...ctx.provinces.all()].sort((a, b) => b.total() - a.total() || a.cell - b.cell)[0]!
      .cell,
    camp = ask<LandPlan>("towns.land", { cell: land }).camps[0]!,
    near = ask<CampNear>("camp.near", { cell: land, id: camp.id });
  assert.deepEqual(near.figure, peopleFigure(g));
  assert.deepEqual(near.figure!.folk, folk);
  // (And the wars' map, its soldiers' heads drawn in their hide.)
  assert.deepEqual(ask<WarsMap>("wars.map").body, peopleFigure(g));
  // (And the god's parade of the first people, in the genesis: the same people, the same look.)
  assert.deepEqual(ask<GenesisPlan>("genesis").people!.figure, peopleFigure(g));
});

test("a land people's cradle is a land they can live in, not the sea by its coast", () => {
  // (Violet hollow's people rose on a coast of tundra whose province is mostly frozen sea.)
  const g = homePlanet(alien).generated,
    fine = g.fine.life.people!.cell,
    cell = g.life.people!.cell;
  assert.notEqual(cell, g.provinceOf[fine], "moved from the sea's province");
  assert.ok(g.tectonics.elevation[cell]! > 0, "a land province");
  assert.ok(livable(g, cell, "land"), "one they can live in");
  assert.equal(
    ask<GenesisPlan>("genesis").peopling!.cradle,
    cell,
    "and their bands set out from it",
  );
});

test("Earth's people are its upright apes, as ever: nothing gathered for a look of their own", () => {
  const earth = EARTH.build(seedFromText("first light"));
  const g = populationContext(earth).generated;
  assert.equal(folkFacts(g), null);
  assert.equal(peopleFigure(g)!.folk, null);
});
