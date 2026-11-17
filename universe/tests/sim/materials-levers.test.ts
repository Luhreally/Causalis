// What a land's made stuffs do elsewhere (sim/lore/materials.ts): reinforced concrete stands in a quake as the land
// rebuilds in it; a lodestone's needle carries its ships half again as far; the light alloy and glass fibre frame its
// flyers and its launches lighter; made polymers spin its oil into cloth. Built at year 0, never run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { FRAME_SHARE, MATERIAL_WAYS, RECIPES, WAY_INDEX } from "../../src/rules/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { landMakingBlocks } from "../../src/host/inspect/making.ts";
import { yearNow } from "../../src/host/inspect/words.ts";
import {
  COMPASS_REACH,
  CONCRETE_SHARE,
  REBUILD_YEARS,
  compassReach,
  concreteBuilt,
  flyerFrameOf,
  frameStuffOf,
  madeFrames,
  materialsOf,
  populationContext,
  whyNot,
  type Making,
  type MarketStore,
} from "../../src/sim/index.ts";

const world = EARTH.build(seedFromText("first light")),
  ctx = populationContext(world),
  [a, b] = ctx.provinces
    .all()
    .filter((p) => p.total() > 0)
    .map((p) => p.cell),
  store = materialsOf(world)!;

const row = (cell: number, ways: readonly [string, number][]): Making => ({
  cell,
  made: ways.reduce((m, [w]) => m | (1 << WAY_INDEX.get(w)!), 0),
  purity: 0,
  year: 1,
  event: null,
  years: MATERIAL_WAYS.map((w) => ways.find(([id]) => id === w.id)?.[1] ?? 0),
});

test("a land with nothing made: nothing moves", () => {
  assert.ok(a !== undefined && b !== undefined, "two peopled lands");
  assert.equal(concreteBuilt(world, b!, 1950), 0);
  assert.equal(compassReach(world, b!), 1);
  assert.equal(frameStuffOf(world, b!), null);
  assert.equal(flyerFrameOf(world, b!), FRAME_SHARE);
  assert.deepEqual(madeFrames(world, b!), []);
});

test("a land's made stuffs: concrete rebuilt over the years, a needle, lighter frames", () => {
  store.set(
    row(a!, [
      ["reinforced-concrete", 1900],
      ["lodestone", 1100],
      ["light-alloy", 1910],
      ["glass-fibre", 1950],
    ]),
  );
  assert.equal(store.madeIn(a!, "reinforced-concrete"), 1900);
  assert.equal(store.madeIn(a!, "concrete"), null);
  assert.ok(Math.abs(concreteBuilt(world, a!, 1900) - CONCRETE_SHARE / REBUILD_YEARS) < 1e-9);
  assert.equal(concreteBuilt(world, a!, 2000), CONCRETE_SHARE);
  assert.equal(compassReach(world, a!), COMPASS_REACH);
  assert.equal(frameStuffOf(world, a!), "glass-fibre");
  assert.ok(flyerFrameOf(world, a!) < FRAME_SHARE);
  assert.deepEqual(
    madeFrames(world, a!).map((f) => f.id),
    ["alloy-frame", "fibre-frame"],
  );
  for (const f of madeFrames(world, a!)) assert.ok(f.dry < 0.13, f.id);
});

test("cloth of made polymers is spun only where a land makes them", () => {
  const r = RECIPES.find((x) => x.id === "polymer-cloth")!,
    markets = world.store<MarketStore>("economy.markets");
  assert.ok(r, "the recipe");
  assert.equal(whyNot(ctx, b!, markets.get(b!)!, r), "they do not make made polymers");
  store.set(row(b!, [["made-polymer", 1950]]));
  assert.notEqual(whyNot(ctx, b!, markets.get(b!)!, r), "they do not make made polymers");
});

test("the land's page says what its stuffs do: its furnaces' walls, its concrete, its ships, its frames", () => {
  const now = yearNow(world);
  store.set(
    row(a!, [
      ["reinforced-concrete", now],
      ["lodestone", now],
      ["light-alloy", now],
    ]),
  );
  const block = landMakingBlocks(world, a!).find(
    (x) => x.type === "facts" && x.title === "What its stuffs do",
  );
  assert.ok(block && block.type === "facts", "the block");
  const labels = block.rows.map((r) => r.label);
  assert.deepEqual(labels, [
    "Its furnaces' walls",
    "Built in reinforced concrete",
    "Its ships",
    "Its flyers and rockets",
  ]);
  assert.match(String(block.rows[0]!.value), /fireclay, holding 1,734 °C/);
});
