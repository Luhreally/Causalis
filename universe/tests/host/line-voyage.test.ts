import { test } from "node:test";
import assert from "node:assert/strict";
import { EARTH } from "../../src/host/planet.ts";
import { voyageOf } from "../../src/host/line-story.ts";
import { YEAR, type Ref } from "../../src/kernel/index.ts";
import { cellRef } from "../../src/gen/index.ts";
import { politiesOf, populationContext, starSitesOf } from "../../src/sim/index.ts";
import { universeWorld } from "./worlds.ts";

test("a ship ridden is read off the voyage's own site and its land's ledger, a year at a time, and the reading moves nothing", () => {
  const world = universeWorld(EARTH, "first light", 80),
    ctx = populationContext(world),
    year = Math.floor(world.now / YEAR);
  // (A realm's most peopled land, forged as a ship of that realm's under way: its people stand in for those aboard.)
  const realm = [...politiesOf(world).living()][0]!,
    land = realm.members
      .map((c) => ctx.provinces.get(c)!)
      .filter(Boolean)
      .sort((a, b) => b.total() - a.total() || a.cell - b.cell)[0]!,
    sites = starSitesOf(world)!;
  assert.ok(sites, "the store of ships is there from the first");
  const ref = cellRef(0, land.cell);
  assert.equal(voyageOf(world, { cell: land.cell, land: ref }), null, "no ship there: none read");
  sites.set(land.cell, {
    realm: realm.ref,
    from: realm.seat,
    star: "star:1:1" as Ref,
    planet: 0,
    distance: 8.1,
    drive: "fusion",
    departed: year - 4,
    arrives: year + 6,
    voyage: "evt:0" as Ref,
    arrived: null,
    aboard: 0.5,
    there: 0.2,
  });
  const before = JSON.stringify(world.domainHashes()),
    v = voyageOf(world, { cell: land.cell, land: ref, once: true })!;
  assert.equal(JSON.stringify(world.domainHashes()), before, "reading a ship moves no hash");
  assert.equal(v.land, ref);
  assert.equal(v.departed, year - 4);
  assert.equal(v.arrives, year + 6);
  assert.equal(v.arrived, false);
  assert.equal(v.people, Math.round(land.total()));
  assert.ok(v.young > 0 && v.young < v.people, "of its people, some young");
  assert.equal(v.keep, 0.5, "aboard, half their work keeps them alive");
  assert.equal(v.fed, Math.round(land.fed) / 1000);
  assert.equal(v.born, ctx.history.birthsIn(land.cell, year - 1));
  assert.equal(v.died, ctx.history.deathsIn(land.cell, year - 1));
  assert.equal(v.drive, "a fusion drive");
  assert.ok(v.aboardYears !== null && v.aboardYears <= 10, "its own clock no faster than home's");
  assert.equal(v.side.ref, realm.ref, "drawn as its realm's ships");
  // What history tells of it: events at its land since the year asked, each dated, in order.
  for (let i = 1; i < v.told.length; i++) assert.ok(v.told[i]!.year >= v.told[i - 1]!.year);
  for (const t of v.told) assert.ok(t.year >= year - 4 - 1 && t.words.length > 0);
  // (Who sailed in her and where it comes down: asked once a ride, not each year.)
  const plain = voyageOf(world, { cell: land.cell, land: ref })!;
  assert.equal(plain.crew, null);
  assert.equal(plain.lands, null);
  // Come: read as come.
  sites.get(land.cell)!.arrived = "evt:1" as Ref;
  const come = voyageOf(world, { cell: land.cell, land: ref })!;
  assert.equal(come.arrived, true);
  assert.equal(come.keep, 0.2, "on the world, what its halls keep out");
});
