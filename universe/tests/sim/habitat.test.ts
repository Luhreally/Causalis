import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { BIOME, generateHomeWorld, refineRegion, WATER } from "../../src/gen/index.ts";
import { OPEN } from "../../src/rules/index.ts";
import { ALIEN } from "../../src/host/planet.ts";
import {
  POPULATION_EVENTS,
  capacity,
  coastal,
  homePlanet,
  livable,
  populationContext,
} from "../../src/sim/index.ts";

/** The first open world whose people live in a medium. */
function worldOf(medium: string): string {
  for (let i = 0; i < 60; i++) {
    const p = generateHomeWorld(seedFromText(`alien ${i}`), OPEN).life.people;
    if (p?.body.medium === medium) return `alien ${i}`;
  }
  throw new Error(`no ${medium} people in sixty worlds`);
}

test("the shelf feeds a people of the water and not one of the land; the shore, where they meet", () => {
  const g = generateHomeWorld(seedFromText("first light"), OPEN);
  let shelf = -1,
    field = -1;
  for (let c = 0; c < g.grid.count && (shelf < 0 || field < 0); c++) {
    if (shelf < 0 && g.climate.biome[c] === BIOME.shelf && g.climate.temperature[c]! > 15)
      shelf = c;
    if (field < 0 && g.climate.biome[c] === BIOME.savanna && !coastal(g, c)) field = c;
  }
  assert.ok(capacity(g, shelf, "water").forage > 0 && capacity(g, shelf, "land").forage === 0);
  assert.ok(capacity(g, field, "land").forage > 0 && capacity(g, field, "water").forage === 0);
  assert.equal(capacity(g, field, "shore").forage, 0, "inland is no shore");
  assert.ok(livable(g, shelf, "water") && !livable(g, shelf, "land"));
  // The deep ocean feeds no one.
  const deep = [...Array(g.grid.count).keys()].find((c) => g.climate.biome[c] === BIOME.deepOcean)!;
  assert.ok(!livable(g, deep, "water") && !livable(g, deep, "land"));
});

test("each people spreads over its own medium, and raises its villages there", () => {
  for (const medium of ["water", "shore"]) {
    const world = ALIEN.build(seedFromText(worldOf(medium))),
      ctx = populationContext(world),
      g = homePlanet(world).generated;
    assert.equal(ctx.medium, medium);
    for (const p of ctx.provinces.all())
      assert.ok(livable(g, p.cell, ctx.medium), `${medium} in ${p.cell}`);
  }
  // A shore people's villages stand on land within sight of the sea.
  const world = ALIEN.build(seedFromText(worldOf("shore"))),
    ctx = populationContext(world),
    g = homePlanet(world).generated;
  world.runTo(60 * YEAR);
  const villages = ctx.settlements.all();
  assert.ok(villages.length > 10, `${villages.length} villages`);
  for (const v of villages.slice(0, 20)) {
    const r = refineRegion(g.fine, g.centre[v.cell]!, 128, 2.4),
      size = r.size,
      i = v.tile % size,
      j = Math.floor(v.tile / size);
    // On the land (a river's bank will do), never in the sea.
    assert.notEqual(r.water[v.tile], WATER.sea);
    let sea = false;
    for (let dj = -16; dj <= 16; dj++)
      for (let di = -16; di <= 16; di++) {
        const a = i + di,
          b = j + dj;
        if (a >= 0 && b >= 0 && a < size && b < size && r.water[b * size + a] === WATER.sea)
          sea = true;
      }
    assert.ok(sea, `village ${v.name} by the sea`);
  }
});

test("a people of the water comes to tend beds of weed and shell, and builds its villages in the shallows", () => {
  // A world of wide shelves (the first water world, alien 29, is an archipelago of twelve
  // cold-edged places whose people live long content with what the reefs give).
  const world = ALIEN.build(seedFromText("alien 55")),
    ctx = populationContext(world),
    g = homePlanet(world).generated;
  assert.equal(ctx.medium, "water");
  world.runTo(80 * YEAR);
  const sown = world.events.all().find((e) => e.type === POPULATION_EVENTS.cultivation.type);
  assert.ok(sown, "sowing on the shelf");
  const d = world.decisions.get(sown.causes[0]!.ref as Ref)!;
  assert.ok(d.factors.some((f) => f.name === "beds of weed and shell to tend"));
  const villages = ctx.settlements.all();
  assert.ok(villages.length > 0, "villages in the shallows");
  for (const v of villages.slice(0, 10)) {
    const r = refineRegion(g.fine, g.centre[v.cell]!, 128, 2.4);
    assert.equal(r.water[v.tile], WATER.sea);
  }
});
