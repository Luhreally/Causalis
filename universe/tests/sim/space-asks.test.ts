import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type Ref, type World } from "../../src/kernel/index.ts";
import { G, principle } from "../../src/rules/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  askedStar,
  loreOf,
  marketsOf,
  politiesOf,
  populationContext,
  spaceOf,
  starSitesOf,
  voyageReach,
  voyageTarget,
  type Polity,
} from "../../src/sim/index.ts";
import type { SpaceAskStore } from "../../src/sim/space/asks.ts";
import { universeWorld } from "../host/worlds.ts";

/** A world whose greatest realm can sail for the stars at year 80 (as tests/sim/voyage.test.ts). */
function ready(): { world: World; realm: Polity } {
  const world = universeWorld(EARTH, "first light", 80);
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
  return { world, realm };
}

test("a realm asked for a star sails its next ship there, the ask spent; unasked it keeps nothing", () => {
  const { world, realm } = ready(),
    ctx = populationContext(world);
  // Unasked, the store is dormant: hashed as if not there.
  assert.equal(askedStar(world, realm.ref), null);
  assert.ok(world.store<SpaceAskStore>("space.asks").dormant());
  const own = voyageTarget(ctx, realm)!.target.star.ref,
    reach = voyageReach(ctx, realm);
  assert.deepEqual(reach.wants, [], "it can sail");
  const other = reach.stars.find((s) => !s.taken && s.star.ref !== own);
  assert.ok(other, `another star in reach (${reach.stars.length})`);
  // Turned back: a realm not living, a star not of its sky.
  assert.throws(() => world.submit("space.ask", { realm: "polity:none", star: other.star.ref }));
  assert.throws(() => world.submit("space.ask", { realm: realm.ref, star: "star:0:0:999" }));
  world.submit("space.ask", { realm: realm.ref, star: other.star.ref });
  world.runTo(world.now + 1);
  assert.equal(askedStar(world, realm.ref), other.star.ref);
  assert.equal(voyageTarget(ctx, realm)!.target.star.ref, other.star.ref, "the ask heeded");
  const sites = starSitesOf(world)!;
  let y = 80;
  while (!sites.all().length && y < 160) world.runTo(++y * YEAR);
  const ship = sites.all()[0]?.[1];
  assert.ok(ship, "a ship within a lifetime");
  assert.equal(ship.star, other.star.ref, "sailed for the star asked");
  assert.equal(askedStar(world, realm.ref), null, "the ask spent");
  assert.ok(world.store<SpaceAskStore>("space.asks").dormant());
  const why = world.decisions.get(world.events.get(ship.voyage)!.causes[0]!.ref as Ref)!;
  assert.ok(why.factors.some((f) => /asked to sail for/.test(f.name)));
});

test("the ask taken back leaves the realm its own choice", () => {
  const { world, realm } = ready(),
    ctx = populationContext(world),
    own = voyageTarget(ctx, realm)!.target.star.ref,
    other = voyageReach(ctx, realm).stars.find((s) => !s.taken && s.star.ref !== own)!;
  world.submit("space.ask", { realm: realm.ref, star: other.star.ref });
  world.runTo(world.now + 1);
  world.submit("space.ask", { realm: realm.ref, star: null });
  world.runTo(world.now + 2);
  assert.equal(askedStar(world, realm.ref), null);
  assert.equal(voyageTarget(ctx, realm)!.target.star.ref, own);
});
