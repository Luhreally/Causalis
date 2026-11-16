// What a realm's groups want of how it is held is learned from how they fared (sim/order/wants.ts), never a table.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WantsStore,
  interestsOf,
  learnWants,
  politiesOf,
  populationContext,
  wantsOf,
  type Interest,
} from "../../src/sim/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("kestrel", 400, { start: "spread" }),
  ctx = populationContext(world);

test("every living realm's groups have wants, learned in whole hundredths", () => {
  const store = wantsOf(world)!,
    realms = politiesOf(world).living();
  assert.ok(realms.length >= 3);
  let weighed = 0;
  for (const p of realms) {
    const kept = store.of(p.ref);
    if (!kept) continue;
    for (const w of kept.values()) {
      assert.equal(w.want.length, 4);
      for (const x of w.want) assert.ok(Number.isInteger(x) && x >= 0 && x <= 100, `${x}`);
      if (w.year > 0) weighed++;
    }
  }
  assert.ok(weighed > 0, "no group has yet learned from how it fared");
  // (And none of a realm that has ended.)
  const alive = new Set(realms.map((p) => p.ref));
  for (const r of store.realmsKept()) assert.ok(alive.has(r) || politiesOf(world).get(r)?.ended);
});

test("a group that fared well comes to want the realm held as it was; one that fared ill, otherwise", () => {
  const p = politiesOf(world).living()[0]!,
    base = interestsOf(ctx, p, world.now),
    grow = (by: number): Interest[] => base.map((i) => ({ ...i, sway: i.sway * by })),
    held = [0.8, 0.2, 0.3, 0.5];
  for (const [by, toward] of [
    [2, true],
    [0.5, false],
  ] as const) {
    const store = new WantsStore();
    learnWants(ctx, store, p, base, [0.5, 0.5, 0.5, 0.5], 100);
    learnWants(ctx, store, p, grow(by), held, 110);
    // (Weighed against the numbers it was held by at the last weighing: the middle. Then held otherwise, it learns again.)
    learnWants(ctx, store, p, grow(by * by), held, 120);
    const w = store.of(p.ref)!.get(base[0]!.group)!;
    assert.equal(w.year, 120);
    if (toward) {
      assert.ok(w.fared > 0, `${w.fared}`);
      assert.ok(w.want[0]! > 50 && w.want[1]! < 50, `${w.want}: toward ${held}`);
    } else {
      assert.ok(w.fared < 0, `${w.fared}`);
      assert.ok(w.want[0]! < 50 && w.want[1]! > 50, `${w.want}: away from ${held}`);
    }
  }
});
