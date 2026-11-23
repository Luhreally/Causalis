// Those who fight their holder, fighting (sim/war/raids.ts): a raid on the posted is an event with real dead on both sides.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type SimTime } from "../../src/kernel/index.ts";
import { RAID, RAID_EVENTS, politiesOf, populationContext, raidIn } from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";
import { streetFightOf } from "../../src/host/inspect/streetfight.ts";
import { peopledWorld } from "../worlds.ts";

const EVEN = { ratio: 1, fire: 0 } as const;

const world = peopledWorld("kestrel", 400, { start: "spread" }),
  ctx = populationContext(world);

test("a risen land's raid on the posted: both sides' dead are taken from their lands, it is told, and can be watched", () => {
  const realms = politiesOf(world),
    holder = realms
      .living()
      .filter((p) => p.members.length >= 2)
      .sort((a, b) => b.members.length - a.members.length)[0]!,
    other = realms.living().find((p) => p !== holder)!,
    land = holder.members
      .filter((c) => c !== holder.seat)
      .sort(
        (a, b) => (ctx.provinces.get(b)?.total() ?? 0) - (ctx.provinces.get(a)?.total() ?? 0),
      )[0]!,
    t = ((Math.floor(world.now / YEAR) + 1) * YEAR) as SimTime,
    before = [ctx.provinces.get(land)!.total(), ctx.provinces.get(holder.seat)!.total()];
  assert.ok(before[0]! > 2000, "a peopled land to rise");
  const raid = raidIn(ctx, holder, other.ref, "another realm", land, 0.9, 0.5, 200, EVEN, null, t);
  assert.ok(raid, "no raid");
  const e = world.events.get(raid.event)!,
    d = e.data as { out: number; posted: number; dead: [number, number]; won: boolean };
  assert.equal(e.type, RAID_EVENTS.raid.type);
  assert.ok(d.out >= RAID.least && d.posted === 200);
  assert.ok(d.dead[0] + d.dead[1] > 0, "no one died of it");
  assert.equal(ctx.provinces.get(land)!.total(), before[0]! - d.dead[1]);
  assert.equal(ctx.provinces.get(holder.seat)!.total(), before[1]! - d.dead[0]);
  assert.equal(raid.by > 0, d.won);
  assert.match(why(world, raid.event).claim, /fell on the soldiers of .*, year \d+$/);
  const fight = streetFightOf(world, raid.event);
  if (ctx.settlements.inProvince(land).some((s) => s.population > 0)) {
    assert.ok(fight, "not to be watched");
    assert.equal(fight.kind, "army");
    assert.equal(fight.sides[0].men, 200);
    assert.equal(fight.sides[1].fallen, d.dead[1]);
  }
  // (Too few to go out, or no one posted: none.)
  assert.equal(raidIn(ctx, holder, other.ref, "x", land, 0.9, 0.5, 0, EVEN, null, t), null);
});

test("the arms of their age: fire in the hands of those who fight costs the posted more, and them less", () => {
  const realms = politiesOf(world),
    holder = realms
      .living()
      .filter((p) => p.members.length >= 2)
      .sort((a, b) => b.members.length - a.members.length)[0]!,
    other = realms.living().find((p) => p !== holder)!,
    land = holder.members
      .filter((c) => c !== holder.seat)
      .sort(
        (a, b) => (ctx.provinces.get(b)?.total() ?? 0) - (ctx.provinces.get(a)?.total() ?? 0),
      )[0]!,
    t = ((Math.floor(world.now / YEAR) + 2) * YEAR) as SimTime,
    // (The same raid on the same land, read without being made: a copy of the world would move both; the dead are read off
    // the event, which is made once each, a year apart.)
    spears = raidIn(ctx, holder, other.ref, "x", land, 0.9, 0.2, 400, EVEN, null, t)!,
    guns = raidIn(
      ctx,
      holder,
      other.ref,
      "x",
      land,
      0.9,
      0.2,
      400,
      { ratio: 1, fire: 0.8 },
      null,
      (t + YEAR) as SimTime,
    )!,
    a = world.events.get(spears.event)!.data as { dead: [number, number]; out: number },
    b = world.events.get(guns.event)!.data as {
      dead: [number, number];
      out: number;
      fire?: number;
    };
  assert.ok(b.fire === 80, "the fire is told");
  // (Per one who went out, the posted lose more to fire and the raiders fewer.)
  assert.ok(
    b.dead[0] / b.out > a.dead[0] / a.out,
    `posted ${a.dead[0]}/${a.out} -> ${b.dead[0]}/${b.out}`,
  );
  assert.ok(
    b.dead[1] / b.out < a.dead[1] / a.out,
    `raiders ${a.dead[1]}/${a.out} -> ${b.dead[1]}/${b.out}`,
  );
});
