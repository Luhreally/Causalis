// Knowledge that can be lost (K1): what a land forgets takes exactly what it brought; what's kept loads as it was; an old save has nothing lost.
import assert from "node:assert/strict";
import test from "node:test";
import { PRINCIPLES, PRINCIPLE_DEPTH, RESTS_ON, principle } from "../../src/rules/index.ts";
import { seedFromText, YEAR, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { loreOf, lostOf, lostYear, needOfHands, populationContext } from "../../src/sim/index.ts";

test("deeper crafts ask more hands, and every need is on the tree", () => {
  assert.equal(PRINCIPLE_DEPTH.get("cultivation"), 0);
  for (const p of PRINCIPLES) {
    assert.ok(PRINCIPLE_DEPTH.has(p.id), p.id);
    assert.ok(needOfHands(p) > 0);
  }
  assert.ok(needOfHands(principle("electricity")) > needOfHands(principle("writing")));
  assert.ok(RESTS_ON.get("writing")!.length > 0);
});

test("a land forgets: its totals are what it still knows, and a land emptied forgets everything", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(60 * YEAR);
  const ctx = populationContext(world),
    lore = loreOf(world),
    event = world.events.emit({ type: "lore.found" }) as Ref,
    land = [...ctx.provinces.all()].find((p) => p.total() > 0)!,
    cell = land.cell;
  lore.learn(cell, "plough", { year: 60, event }, principle("plough"));
  const had = lore.effect(cell, "farmYield"),
    n = lore.landsKnowing("plough");
  lore.forget(cell, "plough");
  assert.ok(Math.abs(had - lore.effect(cell, "farmYield") - 0.25) < 1e-12);
  assert.equal(lore.landsKnowing("plough"), n - 1);
  lore.learn(cell, "plough", { year: 60, event }, principle("plough"));
  for (let r = 0; r < land.counts.rows; r++)
    for (let c = 0; c < land.counts.cols; c++) land.counts.set(r, c, 0);
  lostYear(ctx, world.now);
  assert.equal(lore.sizeOf(cell), 0, "no one left to know it");
  assert.ok(lostOf(world).ofLand(cell)?.has("plough"));
  // What it keeps loads as it was.
  const saved = JSON.parse(JSON.stringify(lostOf(world).save()));
  const store = lostOf(world);
  store.load(saved);
  assert.deepEqual(JSON.parse(JSON.stringify(store.save())), saved);
});

test("a world where no one falls keeps nothing here", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(10 * YEAR);
  assert.equal(lostOf(world).allOpen().length, 0);
  assert.equal(lostOf(world).archives.length, 0);
});
