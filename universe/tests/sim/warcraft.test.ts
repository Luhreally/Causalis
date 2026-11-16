// On a young peopled world (forty years, no further): the arming and the fleets run their year over its realms. A siege laid
// at a seat with no walls falls the next year it is won before them. One lost there lifts it. The deaths a siege takes are
// written into the lands' ledgers (sim/war/arming.ts, navy.ts, siege.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type Ref, type SimTime } from "../../src/kernel/index.ts";
import {
  armingOf,
  armingYear,
  navyOf,
  navyYear,
  politiesOf,
  populationContext,
  siegeAtSeat,
  siegeOf,
  siegesOf,
  type War,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("kestrel", 40, { start: "spread" }),
  ctx = populationContext(world);

test("the arming and the fleets run their year over a world's realms", () => {
  const year = Math.floor(world.now / YEAR) + 1,
    t = (year * YEAR) as SimTime;
  assert.ok(armingOf(world) && navyOf(world) && siegesOf(world));
  armingYear(ctx, t);
  navyYear(ctx, t);
  for (const r of armingOf(world)!.realms()) {
    const f = armingOf(world)!.of(r)!;
    assert.ok(f.footing >= 0 && f.footing <= 0.5, `${r} ${f.footing}`);
  }
});

test("a siege is laid by a victory at a seat, and an unwalled seat falls the next year it is won before", () => {
  const realms = politiesOf(world).living();
  assert.ok(realms.length >= 2, `${realms.length} realms`);
  const [a, b] = realms as [(typeof realms)[0], (typeof realms)[0]],
    cause = world.events.all().at(-1)!.id,
    year = Math.floor(world.now / YEAR) + 1,
    t = (year * YEAR) as SimTime,
    w: War = {
      ref: "war:test:1" as Ref,
      attacker: a.ref,
      defender: b.ref,
      declared: year - 2,
      event: cause,
      prize: b.seat,
      battles: [],
      fallen: [0, 0],
      ended: null,
      peace: null,
    };
  const laid = siegeAtSeat(ctx, w, a, b, true, 0, 5000, t);
  assert.equal(laid.falls, false);
  const s = siegeOf(world, w.ref);
  assert.ok(s, "no siege laid");
  assert.equal(s.seat, b.seat);
  assert.match(why(world, s.event).claim, /laid siege/);
  const before = ctx.provinces.get(b.seat)!.total(),
    next = siegeAtSeat(ctx, w, a, b, true, 0, 5000, ((year + 1) * YEAR) as SimTime);
  // (No principle of walls on so young a world: one year of siege work and it is down, or it starved first.)
  assert.equal(next.falls, true);
  assert.ok(next.how === "stormed" || next.how === "starved");
  assert.equal(siegeOf(world, w.ref), null);
  assert.equal(ctx.provinces.get(b.seat)!.total(), before - next.dead[1]);
  // (A siege lifted by a defeat before the walls.)
  siegeAtSeat(ctx, w, a, b, true, 0, 5000, ((year + 2) * YEAR) as SimTime);
  assert.ok(siegeOf(world, w.ref));
  siegeAtSeat(ctx, w, a, b, false, 0, 5000, ((year + 3) * YEAR) as SimTime);
  assert.equal(siegeOf(world, w.ref), null);
});
