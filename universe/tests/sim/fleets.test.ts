// Fleets as things (sim/war/fleets.ts): a flagship and a commander a realm with warships, and the fleets' meetings at sea.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type Ref, type SimTime } from "../../src/kernel/index.ts";
import {
  FLEET,
  FLEET_EVENTS,
  FleetStore,
  fleetCommander,
  fleetsOf,
  fleetsYear,
  navyOf,
  notablesOf,
  politiesOf,
  populationContext,
  warsOf,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("kestrel", 400, { start: "spread" }),
  ctx = populationContext(world);

test("a realm with warships sails under a named flagship; a year's heavy loss at sea is a meeting of fleets, and may cost a flagship", () => {
  const navy = navyOf(world)!,
    store = fleetsOf(world)!,
    [a, b] = politiesOf(world).living(),
    year = Math.floor(world.now / YEAR) + 1,
    ships = (realm: Ref, tons: number) => ({
      realm,
      tons,
      built: 0,
      sunk: 0,
      wanted: tons,
      quality: 1,
      merchant: 0,
      coast: 0.5,
      blockaded: 0,
      cost: 0,
    });
  assert.ok(a && b);
  navy.set(ships(a.ref, 900));
  navy.set(ships(b.ref, 300));
  const event = world.events.emit({
      type: "war.declared",
      subjects: [a.ref, b.ref],
      place: null,
      causes: [],
      data: {},
    }),
    war = "war:0:99990" as Ref;
  warsOf(world).add({
    ref: war,
    attacker: a.ref,
    defender: b.ref,
    declared: year,
    event,
    prize: b.seat,
    battles: [],
    fallen: [0, 0],
    ended: null,
    peace: null,
  });
  // (The year at sea: the defender lost 500 t of the 800 it began with, the attacker 100 of 1,000.)
  navy.setSea({ war, command: [0.9, 0.1], sunk: [100, 500], won: null, blockade: null });
  fleetsYear(ctx, ((year + 1) * YEAR) as SimTime);
  const fa = store.of(a.ref)!,
    fb = store.of(b.ref)!;
  assert.ok(fa.flagship && fb.flagship, "no flagship named");
  const fights = store.fightsOf(war);
  assert.equal(fights.length, 1);
  const f = fights[0]!;
  assert.deepEqual(f.tons, [1000, 800]);
  assert.deepEqual(f.sunk, [100, 500]);
  assert.equal(f.won, 0);
  assert.equal(f.lost, 500 / 800 >= FLEET.flagship ? 1 : -1);
  assert.equal(fb.lost, 1, "the beaten kept its flagship");
  assert.notEqual(fb.flagship, f.flags[1], "no new flagship named");
  assert.equal(world.events.get(f.event)!.type, FLEET_EVENTS.met.type);
  assert.match(why(world, f.event).claim, /^The fleet of .* beat the fleet of .*, year \d+$/);
  // Each fleet met under an admiral of its own: a post apart from its host's commander, named that day, with the meeting on
  // their name; the meeting keeps who, and what each side's wrights knew.
  const kept = notablesOf(world)!,
    admirals = [kept.holder("fleet", a.ref), kept.holder("fleet", b.ref)];
  assert.ok(admirals[0] && admirals[1], "no admiral named");
  assert.deepEqual(f.led, [admirals[0].name, admirals[1].name]);
  assert.notEqual(admirals[0].id, kept.holder("command", a.ref)?.id);
  assert.ok(admirals[0].deeds.some((d) => d.w === "war.fleet won" && d.e === f.event));
  assert.ok(admirals[1].deeds.some((d) => d.w === "war.fleet lost"));
  assert.deepEqual(fleetCommander(world, a.ref), {
    id: admirals[0].id,
    name: admirals[0].name,
    admiral: true,
  });
  const told = world.events.get(f.event)!.data as { rig: number[][]; ledId: number[] };
  assert.deepEqual(told.ledId, [admirals[0].id, admirals[1].id]);
  assert.equal(told.rig.length, 2);
  assert.ok(told.rig.every((r) => r.length === 3 && r[0]! >= 0));
  // (The same losses read again are not a second meeting; saved and loaded, the same.)
  fleetsYear(ctx, ((year + 2) * YEAR) as SimTime);
  assert.equal(store.fightsOf(war).length, 1);
  const copy = new FleetStore();
  copy.load(JSON.parse(JSON.stringify(store.save())));
  assert.deepEqual(copy.save(), store.save());
  // A realm that keeps no ships any more keeps no fleet, and its admiral holds no post (they are kept as themselves).
  navy.set(ships(b.ref, 0));
  fleetsYear(ctx, ((year + 3) * YEAR) as SimTime);
  assert.equal(store.of(b.ref), undefined);
  assert.equal(kept.holder("fleet", b.ref), undefined);
  assert.ok(kept.get(admirals[1].id));
});
