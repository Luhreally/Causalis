// Lands held by force, and those who fight their holder there (sim/war/occupation.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type SimTime } from "../../src/kernel/index.ts";
import {
  OCCUPYING,
  homePlanet,
  occupationOf,
  occupationYear,
  occupy,
  politiesOf,
  populationContext,
  reliefOf,
} from "../../src/sim/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("kestrel", 400, { start: "spread" }),
  ctx = populationContext(world);

test("each land's relief is read off its fine ground, and kept", () => {
  const g = homePlanet(world).generated,
    r = reliefOf(g);
  assert.equal(reliefOf(g), r);
  let some = 0;
  for (const x of r) {
    assert.ok(Number.isFinite(x) && x >= 0);
    if (x > 50) some++;
  }
  assert.ok(some > 0, "no land with any relief");
});

test("a land held by force resists as far as it resents its holder, is grievance its rule reads, and ends with the holding", () => {
  const realms = politiesOf(world),
    [a, b] = realms.living().filter((p) => p.members.length >= 2),
    store = occupationOf(world)!;
  assert.ok(a && b);
  const c = a.members.find((x) => x !== a.seat)!,
    year = Math.floor(world.now / YEAR) + 1;
  occupy(world, c, a.ref, b.ref, year);
  realms.setDiscontent(c, { level: 1, cause: null });
  for (let y = year; y < year + 5; y++) occupationYear(ctx, (y * YEAR) as SimTime);
  const o = store.of(c);
  if (o) {
    assert.ok(o.resistance >= 0 && o.resistance <= 1);
    assert.ok(
      realms.discontent(c).level >= o.resistance - 1e-9,
      "its resistance not read as grievance",
    );
    assert.ok(o.resistance < OCCUPYING.free);
  } else assert.ok(realms.of(c) !== a, "let go while still held, and not thrown off");
  // (No longer its holder's: not held by force.)
  if (realms.of(c) === a) {
    realms.leave(a, c);
    occupationYear(ctx, ((year + 6) * YEAR) as SimTime);
    assert.equal(store.of(c), undefined);
  }
});
