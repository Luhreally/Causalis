import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { offworldSite } from "../../src/gen/index.ts";
import { G, principle } from "../../src/rules/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  VOYAGE_EVENTS,
  homePlanet,
  loreOf,
  marketsOf,
  politiesOf,
  populationContext,
  spaceOf,
  spaceSteps,
  starSitesOf,
} from "../../src/sim/index.ts";
import { landWords, why } from "../../src/causal/index.ts";

test("a ship sails for another star as a land of its realm, its people living aboard, and comes down on a world there", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(80 * YEAR);
  const realm = [...politiesOf(world).living()].sort(
      (a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1),
    )[0]!,
    lore = loreOf(world);
  for (const id of [
    "mathematics",
    "astronomy",
    "medicine",
    "life-support",
    "stations",
    "habitats",
    "fusion-drive",
    "long-sleep",
  ])
    lore.learn(realm.seat, id, { year: 80, event: realm.event }, principle(id));
  marketsOf(world).of(realm.seat).move("made", G.machines, 60_000_000);
  spaceOf(world).program(realm.ref).station = realm.event;
  const sites = starSitesOf(world)!;
  let y = 80;
  while (!sites.all().length && y < 160) world.runTo(++y * YEAR);
  const [cell, ship] = sites.all()[0]!;
  assert.ok(ship, "a ship within a lifetime");
  const g = homePlanet(world).generated,
    ctx = populationContext(world);
  assert.equal(offworldSite(g, cell)!.body, -1, "a kept site: the ship");
  assert.ok(ctx.provinces.get(cell)!.total() > 400, "its people aboard");
  assert.equal(politiesOf(world).of(cell)?.ref, realm.ref);
  assert.match(landWords(world, ctx.provinces.get(cell)!.ref), /the ship bound for/);
  // The star in words, never its ref.
  assert.doesNotMatch(landWords(world, ctx.provinces.get(cell)!.ref), /\w+:\d+:\d+/);
  assert.match(
    landWords(world, ctx.provinces.get(cell)!.ref),
    /(red dwarf|orange star|yellow star|white star|blue star|white dwarf)/,
  );
  // Its why: the star (explained as another star), and the drive.
  const e = world.events.get(ship.voyage)!;
  assert.equal(e.type, VOYAGE_EVENTS.sailed.type);
  const decision = world.decisions.get(e.causes[0]!.ref as Ref)!;
  assert.ok(decision.factors.some((f) => f.source?.ref === ship.star));
  assert.match(why(world, ship.star).claim, /light-years from home/);
  assert.ok(decision.factors.some((f) => /light's speed/.test(f.name)));
  // Ruled across the light-years: many steps away.
  assert.ok((spaceSteps(ctx, realm.seat, cell) ?? 0) >= 6);
  // The crossing, then the halls.
  world.runTo((ship.arrives + 1) * YEAR);
  assert.ok(ship.arrived, "arrived");
  assert.equal(world.events.get(ship.arrived!)!.type, VOYAGE_EVENTS.arrived.type);
  assert.ok(
    ctx.provinces.get(cell)!.total() > 300,
    `${ctx.provinces.get(cell)!.total()} came down`,
  );
  assert.match(landWords(world, ctx.provinces.get(cell)!.ref), /halls on a world of/);
});
