// Phase 66: how a world keeps what it has come to. The towns' fabric by column reads back to the letter,
// a fabric saved town by town still loads, and a remaking and its mirrors come back whole.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText, YEAR } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { LateStore, townsOf } from "../../src/sim/index.ts";

test("the towns' fabric by column reads back to the letter, and one saved town by town still loads", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(120 * YEAR);
  const towns = townsOf(world),
    saved = towns.save() as { digest: [number, number]; towns: { heads: unknown[][] } };
  assert.ok(saved.towns, "by column");
  assert.ok(saved.towns.heads.length > 0);
  const again = JSON.parse(JSON.stringify(saved));
  const hashBefore = world.domainHashes();
  const all = towns.all().map((f) => JSON.stringify(f));
  assert.ok(all.length > 0, "towns to read");
  towns.load(again);
  assert.deepEqual(
    towns.all().map((f) => JSON.stringify(f)),
    all,
  );
  assert.deepEqual(world.domainHashes(), hashBefore, "its digest is the same");
});

test("the late store is dormant until it holds something, and comes back whole", () => {
  const late = new LateStore();
  assert.ok(late.dormant());
  late.mirrors = {
    km2: 100,
    year: 1500,
    realm: "polity:0:1" as never,
    begun: "ev:0:1" as never,
    gathered: null,
    tended: 1500,
  };
  assert.ok(!late.dormant());
  const again = new LateStore();
  again.load(JSON.parse(JSON.stringify(late.save())));
  assert.deepEqual(again.mirrors, late.mirrors);
  assert.ok(!again.dormant());
});
