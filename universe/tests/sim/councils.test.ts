// Councils of realms arise from treaties made again and again (sim/diplomacy/councils.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type SimTime } from "../../src/kernel/index.ts";
import {
  COUNCILS,
  CouncilStore,
  councilsOf,
  councilsYear,
  politiesOf,
  populationContext,
  sitTogether,
} from "../../src/sim/index.ts";
import { why } from "../../src/causal/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("kestrel", 400, { start: "spread" }),
  ctx = populationContext(world);

test("a treaty's weight fades by half in a generation", () => {
  const s = new CouncilStore(),
    [a, b] = ["realm:0:1", "realm:0:2"] as const;
  s.bond(a as never, b as never, 100);
  s.bond(a as never, b as never, 100);
  assert.equal(s.bondOf(a as never, b as never, 100), 2);
  assert.ok(Math.abs(s.bondOf(b as never, a as never, 100 + COUNCILS.fade) - 1) < 1e-9);
});

test("three realms each bound to the other two by treaty after treaty sit together; one bound to them joins", () => {
  const store = councilsOf(world)!,
    year = Math.floor(world.now / YEAR) + 1,
    free = politiesOf(world)
      .living()
      .filter((p) => !store.councilOf(p.ref));
  assert.ok(free.length >= 4, `${free.length} realms in no council`);
  const [a, b, c, d] = free.map((p) => p.ref);
  for (const [x, y] of [
    [a, b],
    [a, c],
    [b, c],
  ] as const)
    for (let k = 0; k < 2; k++) store.bond(x!, y!, year);
  councilsYear(ctx, (year * YEAR) as SimTime);
  const council = store.councilOf(a!);
  assert.ok(council, "no council");
  assert.deepEqual([...council.members].sort(), [a, b, c].sort());
  assert.ok(sitTogether(world, b!, c!));
  assert.match(why(world, council.event).claim, /first sat/);
  // (One bound to two of its three, as much as a treaty each, comes to sit with them.)
  store.bond(d!, a!, year + 1);
  store.bond(d!, b!, year + 1);
  councilsYear(ctx, ((year + 1) * YEAR) as SimTime);
  assert.ok(store.councilOf(d!)?.id === council.id, "it did not join");
});
