// On a young peopled world (forty years, no further): the arming and the fleets run their year over its realms. A siege laid
// at a seat with no walls falls the next year it is won before them. One lost there lifts it. The deaths a siege takes are
// written into the lands' ledgers. A land behind walls is besieged, not taken at once. A host a peace stands down is the weaker
// for it (sim/war/arming.ts, navy.ts, siege.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type Ref, type SimTime } from "../../src/kernel/index.ts";
import {
  disarmRealm,
  realmMight,
  strengthOf,
  armingOf,
  armingYear,
  navyOf,
  navyYear,
  politiesOf,
  populationContext,
  siegeAt,
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
  const laid = siegeAt(ctx, w, a, b, b.seat, 0, true, 0, 5000, t);
  assert.equal(laid.falls, false);
  const s = siegeOf(world, w.ref);
  assert.ok(s, "no siege laid");
  assert.equal(s.land, b.seat);
  assert.equal(s.seat, true);
  assert.match(why(world, s.event).claim, /laid siege/);
  const before = ctx.provinces.get(b.seat)!.total(),
    next = siegeAt(ctx, w, a, b, b.seat, 0, true, 0, 5000, ((year + 1) * YEAR) as SimTime);
  // (No principle of walls on so young a world: one year of siege work and it is down, or it starved first.)
  assert.equal(next.falls, true);
  assert.ok(next.how === "stormed" || next.how === "starved");
  assert.equal(siegeOf(world, w.ref), null);
  assert.equal(ctx.provinces.get(b.seat)!.total(), before - next.dead[1]);
  // (A siege lifted by a defeat before the walls.)
  siegeAt(ctx, w, a, b, b.seat, 0, true, 0, 5000, ((year + 2) * YEAR) as SimTime);
  assert.ok(siegeOf(world, w.ref));
  siegeAt(ctx, w, a, b, b.seat, 0, false, 0, 5000, ((year + 3) * YEAR) as SimTime);
  assert.equal(siegeOf(world, w.ref), null);
});

test("a land behind walls is besieged before it is taken, and its walls are not down in a year", () => {
  const realms = politiesOf(world).living(),
    b = realms.find((p) => p.members.some((c) => c !== p.seat && ctx.provinces.get(c)?.total()));
  if (!b) return;
  const a = realms.find((p) => p !== b)!,
    land = b.members.find((c) => c !== b.seat && ctx.provinces.get(c)?.total())!,
    year = Math.floor(world.now / YEAR) + 10,
    w: War = {
      ref: "war:test:2" as Ref,
      attacker: a.ref,
      defender: b.ref,
      declared: year - 2,
      event: world.events.all().at(-1)!.id,
      prize: land,
      battles: [],
      fallen: [0, 0],
      ended: null,
      peace: null,
    };
  const laid = siegeAt(ctx, w, a, b, land, 3, true, 0, 5000, (year * YEAR) as SimTime);
  assert.equal(laid.falls, false);
  assert.equal(siegeOf(world, w.ref)?.seat, false);
  assert.match(why(world, siegeOf(world, w.ref)!.event).claim, /walled land/);
  const next = siegeAt(ctx, w, a, b, land, 3, true, 0, 5000, ((year + 1) * YEAR) as SimTime);
  assert.notEqual(next.how, "stormed");
});

test("a host a peace stands down is the weaker for it until its term ends; a realm's might among the stars is read", () => {
  const p = politiesOf(world)
      .living()
      .reduce((x, y) => (strengthOf(ctx, y) > strengthOf(ctx, x) ? y : x)),
    before = strengthOf(ctx, p),
    year = Math.floor(world.now / YEAR);
  disarmRealm(world, p.ref, 0.5, year + 10, world.events.all().at(-1)!.id);
  const after = strengthOf(ctx, p);
  assert.ok(after < 0.6 * before, `${before} ${after}`);
  assert.equal(armingOf(world)!.of(p.ref)!.disarmUntil, year + 10);
  const might = realmMight(ctx, p);
  assert.ok(Number.isFinite(might) && might >= 0.3, `${might}`);
});
