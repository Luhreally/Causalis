// What a people knows of its world (signals, docs/architecture/first-principles-plan.md, "Signals"): seeing far is a function, read from what each of
// its lands knows. Their own lands and those about them first; more by ships; all of it once one of its lands has orbit; and
// it is a reading only, so history is the same whether it is read or not.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { ALIEN } from "../../src/host/planet.ts";
import { homeCells, knownAtOrbit, knownWorld, unknownCells } from "../../src/host/known.ts";
import { keptLife, principle } from "../../src/rules/index.ts";
import { homePlanet, loreOf, populationContext } from "../../src/sim/index.ts";

test("a people knows its lands and those about them; ships show more; orbit shows all of it", () => {
  const world = ALIEN.build(seedFromText(keptLife("alien 20")));
  world.runTo(30 * YEAR);
  const first = knownWorld(world),
    n = homeCells(homePlanet(world).generated);
  assert.equal(first.known.length, n);
  assert.ok(first.share > 0 && first.share < 1, `${first.share}`);
  assert.equal(first.by, "feet");
  assert.equal(unknownCells(world).length, Math.round(n * (1 - first.share)));
  // (Read twice in the same year, the same reading.)
  assert.equal(knownWorld(world), first);
  // A land that comes to sails sees the coasts its ships come to, and a way in.
  const lore = loreOf(world),
    ctx = populationContext(world),
    g = homePlanet(world).generated,
    coast = ctx.provinces.all().find((p) => {
      for (let k = g.grid.offsets[p.cell]!; k < g.grid.offsets[p.cell + 1]!; k++)
        if (g.tectonics.elevation[g.grid.neighbours[k]!]! <= 0) return p.total() > 0;
      return false;
    })!;
  assert.ok(coast, "a peopled land on a coast");
  const year = Math.floor(world.now / YEAR),
    // (Any happening will do as the one it was learned by: nothing here follows its causes.)
    event = ctx.provinces.all().flatMap((p) => lore.of(p.cell))[0]![1].event;
  for (const id of ["sailing", "shipbuilding", "astronomy"])
    lore.learn(coast.cell, id, { year, event }, principle(id));
  const sailed = knownWorld(world, year);
  assert.ok(sailed.share > first.share, `${sailed.share} over ${first.share}`);
  assert.equal(sailed.by, "ships");
  // Orbit: all of it, and from the year it came.
  lore.learn(coast.cell, "orbital-flight", { year: year + 1, event }, principle("orbital-flight"));
  assert.ok(knownWorld(world, year).share < 1);
  const whole = knownWorld(world, year + 1);
  assert.equal(whole.share, 1);
  assert.equal(whole.by, "orbit");
  const atOrbit = knownAtOrbit(world)!;
  assert.equal(atOrbit.year, year + 1);
  assert.equal(atOrbit.at, 1);
  assert.ok(atOrbit.before.share < 1);
});

test("reading what a people knows changes nothing in history", () => {
  const a = ALIEN.build(seedFromText(keptLife("alien 20"))),
    b = ALIEN.build(seedFromText(keptLife("alien 20")));
  a.runTo(12 * YEAR);
  b.runTo(12 * YEAR);
  knownWorld(a);
  knownAtOrbit(a);
  a.runTo(16 * YEAR);
  b.runTo(16 * YEAR);
  assert.deepEqual(a.domainHashes(), b.domainHashes());
});
