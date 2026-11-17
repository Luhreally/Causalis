// The Frontier on a real world, young (no world past year 30): its stores taught and dormant, its sky laying nothing on
// anyone, its stones drawn by the year they fall, and a great stone set to fall this year falling: its dead written,
// its event told, its dust on every field.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type SimTime } from "../../src/kernel/index.ts";
import {
  frontierFields,
  frontierSky,
  galacticOf,
  impactsOf,
  impactsYear,
  mindsOf,
  orbitalOf,
  populationContext,
  stoneOf,
  weatherOf,
  writtenOf,
} from "../../src/sim/index.ts";
import { frontierBlocks, homeHazardBlocks } from "../../src/host/inspect/frontier.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("first light", 30, { start: "spread" });
const ctx = populationContext(world);

test("the Frontier's stores are taught to a world, and its sky lays nothing on a young world's people", () => {
  for (const s of [weatherOf, impactsOf, galacticOf, orbitalOf, writtenOf, mindsOf])
    assert.ok(s(world), s.name);
  assert.equal(orbitalOf(world)!.dormant(), true);
  assert.equal(mindsOf(world)!.dormant(), true);
  const lands = ctx.provinces.all().filter((p) => p.total() > 0);
  assert.ok(lands.length > 0);
  for (const p of lands.slice(0, 20)) assert.ok(frontierSky(ctx, p.cell) >= 1);
});

test("a stone is drawn by the year it falls, the same whenever it is drawn", () => {
  for (let y = 0; y < 2000; y += 37) assert.deepEqual(stoneOf(world, y), stoneOf(world, y));
});

test("a great stone set to fall this year falls: its dead written, its event told, the sky darkened", () => {
  const store = impactsOf(world)!,
    year = Math.floor(world.now / YEAR),
    home = ctx.provinces
      .all()
      .filter((p) => p.cell < ctx.generated.grid.count && p.total() > 0)
      .sort((a, b) => b.total() - a.total() || a.cell - b.cell)[0]!,
    before = ctx.provinces.all().reduce((n, p) => n + p.total(), 0);
  store.state.drawnTo = year + 1000;
  store.stones.push({
    year: year + 1,
    cls: "great",
    metres: 1500,
    comet: false,
    cell: home.cell,
    found: null,
    foundBy: null,
    foundYear: null,
    turned: null,
    struck: null,
    mt: 0,
    dead: 0,
    lands: 0,
  });
  impactsYear(ctx, ((year + 2) * YEAR) as SimTime);
  const stone = store.stones.at(-1)!;
  assert.ok(stone.struck, "it fell");
  assert.ok(stone.dead > 0, `${stone.dead}`);
  const after = ctx.provinces.all().reduce((n, p) => n + p.total(), 0);
  assert.ok(after < before);
  assert.ok(store.state.dust > 0.05);
  assert.ok(frontierFields(world, home.cell) < 1);
  assert.ok(world.events.get(stone.struck!));
});

test("the pages of the Frontier build on a real world", () => {
  assert.ok(homeHazardBlocks(world).length >= 4);
  assert.ok(frontierBlocks(world).length >= 2);
});
