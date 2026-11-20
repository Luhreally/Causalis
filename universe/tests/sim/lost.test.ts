// Knowledge that can be lost (K1): what a land forgets takes exactly what it brought; what's kept loads as it was; an old save has nothing lost.
import assert from "node:assert/strict";
import test from "node:test";
import { PRINCIPLES, PRINCIPLE_DEPTH, RESTS_ON, principle } from "../../src/rules/index.ts";
import { seedFromText, YEAR, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  keptBefore,
  loreOf,
  lostOf,
  lostYear,
  needOfHands,
  populationContext,
} from "../../src/sim/index.ts";

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

test("those who come to a land that lost a craft bring it, shallowest first, and not at once", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(150 * YEAR);
  const ctx = populationContext(world),
    lore = loreOf(world),
    g = ctx.generated,
    neighbours = (cell: number) => {
      const out: number[] = [];
      for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++)
        out.push(g.grid.neighbours[k]!);
      return out;
    },
    land = [...ctx.provinces.all()].find(
      (p) =>
        p.total() > 0 &&
        lore.sizeOf(p.cell) >= 4 &&
        neighbours(p.cell).some((n) => (ctx.provinces.get(n)?.total() ?? 0) > 0 && lore.sizeOf(n)),
    )!,
    cell = land.cell,
    then = land.total(),
    near = neighbours(cell).find(
      (n) => (ctx.provinces.get(n)?.total() ?? 0) > 0 && lore.sizeOf(n),
    )!,
    shared = lore.of(cell).filter(([id]) => lore.get(near, id)).length;
  assert.ok(shared > 0, "the neighbour knows some of what it knows");
  for (let r = 0; r < land.counts.rows; r++)
    for (let c = 0; c < land.counts.cols; c++) land.counts.set(r, c, 0);
  lostYear(ctx, world.now);
  assert.equal(lore.sizeOf(cell), 0);
  // They come, as many as it had.
  land.counts.set(0, 0, then);
  const year = Math.floor(world.now / YEAR);
  world.runTo((year + 1) * YEAR);
  assert.equal(lore.sizeOf(cell) > shared, false, "not back within the year");
  for (let i = 2; i <= 5; i++) {
    if (land.total() < then) land.counts.set(0, 0, land.counts.get(0, 0) + then - land.total());
    world.runTo((year + i) * YEAR);
  }
  assert.ok(lore.sizeOf(cell) >= shared, `${lore.sizeOf(cell)} of ${shared} back`);
  const back = lostOf(world).closed.filter((l) => l.cell === cell);
  assert.ok(back.length > 0, "the loss is closed");
  assert.ok(back.some((l) => l.back!.how === "brought" && l.back!.from !== null));
});

test("a world where no one falls keeps nothing here", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(10 * YEAR);
  assert.equal(lostOf(world).allOpen().length, 0);
  assert.equal(lostOf(world).archives.length, 0);
});

test("a land's own hands are those it has kept ten years: a swelling that passes is no fall", () => {
  const flat = Array.from({ length: 30 }, () => 1000);
  // Held steadily, then struck: what it had is what it had.
  assert.equal(keptBefore(flat), 1000);
  // A slow dying counts from where it stood ten years ago.
  const dying = Array.from({ length: 30 }, (_, i) => (i < 20 ? 1000 : 1000 - 40 * (i - 19)));
  assert.equal(keptBefore(dying), 1000);
  // Those who came five years ago and are going again were never its hands: it has what it had before them.
  const swollen = [...flat.slice(0, 24), 2400, 2200, 1900, 1600, 1300, 1100];
  assert.equal(keptBefore(swollen), 1000);
  assert.ok(1000 >= keptBefore(swollen) * 0.65, "back to what it was: not fallen");
  // Those who stayed past ten years are.
  const settled = [...flat.slice(0, 10), ...Array.from({ length: 20 }, () => 2000)];
  assert.equal(keptBefore(settled), 2000);
  // A land newly peopled has kept only what its short ledger shows; none at all, nothing.
  assert.equal(keptBefore([300, 500, 800]), 300);
  assert.equal(keptBefore([]), 0);
  // Never more than its most.
  for (const l of [flat, dying, swollen, settled]) assert.ok(keptBefore(l) <= Math.max(...l));
});
