// The sea's stock (sim/ecology/seas.ts): a reach of open sea shared by the lands on it, drawn down and grown back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type SimTime } from "../../src/kernel/index.ts";
import {
  SEA,
  SeaStore,
  homePlanet,
  loreOf,
  populationContext,
  seaOf,
  seaYield,
  seasOf,
  seasYear,
} from "../../src/sim/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("kestrel", 400, { start: "spread" }),
  ctx = populationContext(world),
  g = homePlanet(world).generated;

test("the sea is cut into reaches as the world was made: every sea cell in one, none larger than a reach, each shore on one", () => {
  const store = seasOf(world)!,
    water = ctx.medium === "water",
    { of, size } = store.reachesOf(g, water),
    counts = new Map<number, number>();
  assert.equal(store.reachesOf(g, water).of, of, "read again, not kept");
  let shores = 0;
  for (let c = 0; c < g.grid.count; c++) {
    if (g.tectonics.elevation[c]! <= 0) {
      assert.ok(of[c]! >= 0, `sea cell ${c} in no reach`);
      counts.set(of[c]!, (counts.get(of[c]!) ?? 0) + 1);
    } else if (of[c]! >= 0) shores++;
  }
  for (const [id, n] of counts) {
    assert.ok(n <= SEA.cells, `reach ${id} of ${n} cells`);
    assert.equal(size[id], n);
  }
  assert.ok(water || shores > 0, "no land on any reach");
});

test("a reach pressed past what it gives falls, feeds those who go out on it the less, and grows back when left", () => {
  const store = seasOf(world)!,
    lore = loreOf(world),
    p = ctx.provinces
      .all()
      .find(
        (x) =>
          x.total() > 0 &&
          seaOf(ctx, x.cell).reach >= 0 &&
          (ctx.medium === "water" || lore.get(x.cell, "fishing")),
      );
  // (A world where no one yet goes out on the sea has nothing to press: the store stays empty.)
  if (!p) {
    seasYear(ctx, ((Math.floor(world.now / YEAR) + 1) * YEAR) as SimTime);
    assert.ok([...store.all()].every((s) => s.stock <= 1));
    return;
  }
  const reach = seaOf(ctx, p.cell).reach;
  assert.equal(seaYield(ctx, p.cell) <= 1, true);
  store.set({ reach, stock: 0.2, pressed: 2, lands: 1, most: p.cell, few: null });
  const poor = seaYield(ctx, p.cell);
  assert.ok(poor < 1 && poor >= 1 - SEA.lives, `yield ${poor}`);
  // (Saved and loaded, the same.)
  const copy = new SeaStore();
  copy.load(JSON.parse(JSON.stringify(store.save())));
  assert.deepEqual(copy.save(), store.save());
  // (Left alone it grows back: no land pressing it hard enough to hold it at a fifth.)
  store.set({ reach, stock: SEA.least, pressed: 0, lands: 0, most: p.cell, few: null });
  let last: number = SEA.least;
  for (let y = 1; y <= 3; y++) {
    seasYear(ctx, ((Math.floor(world.now / YEAR) + y) * YEAR) as SimTime);
    const now = store.get(reach)?.stock ?? 1;
    assert.ok(now >= SEA.least && now <= 1);
    last = now;
  }
  assert.ok(last > SEA.least, "it never grew back");
});
