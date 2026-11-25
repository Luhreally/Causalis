// The words a land is short of ore in (Phase 54 M222): where a furnace is too cool for the ore within
// reach, the words name the furnace, its heat and the heat the ore wants. On alien 16, whose air is thin, a
// land whose iron within reach is a deposit of iron ore has a bloomery, 1140 °C, short of the 1177 °C the ore
// wants (its slag must run), which a blast driven by a mill's wheel makes up; its copper glance, wanting the
// 1085 °C its copper runs at, a kiln reaches, and nothing is said against it. On Earth the same recipe, at a
// land with no copper, says exactly what it always has.
import { test } from "node:test";
import { keptLife } from "../../src/rules/kinds.ts";
import assert from "node:assert/strict";
import { type Ref, seedFromText } from "../../src/kernel/index.ts";
import {
  EARTHLIKE,
  OPEN,
  RECIPES,
  principle,
  reductionHeat,
  worldOre,
} from "../../src/rules/index.ts";
import { cellRef, worldChemistry } from "../../src/gen/index.ts";
import {
  livableFor,
  loreOf,
  makePopulationWorld,
  marketsOf,
  oreWithin,
  oreWorkable,
  populationContext,
  whyNot,
} from "../../src/sim/index.ts";

const copperSmelting = RECIPES.find((r) => r.id === "copper-smelting")!,
  ironSmelting = RECIPES.find((r) => r.id === "iron-smelting")!;
const worldOf = (seed: string, prior = OPEN) =>
  makePopulationWorld(seedFromText(prior === OPEN ? keptLife(seed) : seed), {
    prior,
    start: "spread",
  });
const lands = (ctx: ReturnType<typeof populationContext>) =>
  [...ctx.provinces.all()].map((p) => p.cell).sort((a, b) => a - b);

/** The lands its people can live in that hold a deposit of a kind, the deposit its nearest ore (lowest first). */
const depositLands = (ctx: ReturnType<typeof populationContext>, kind: string) =>
  ctx.generated.deposits
    .filter((d) => d.kind === kind && livableFor(ctx, d.cell))
    .map((d) => d.cell)
    .sort((a, b) => a - b)
    .filter((c) => {
      const o = oreWithin(ctx, c, kind);
      return o?.lie === "deposit" && o.cell === c;
    });

test("on alien 16, a bloomery too cool for the iron ore within reach says so", () => {
  const world = worldOf("alien 16"),
    ctx = populationContext(world),
    chem = worldChemistry(ctx.generated),
    ore = worldOre(chem, "iron", "deposit")!;
  const cell = depositLands(ctx, "iron")[0];
  assert.ok(cell !== undefined, "a land whose iron within reach is its own deposit");
  // Its smiths know iron (set as the sim sets it, in the land's lore), and so have a bloomery.
  loreOf(world).learn(cell!, "iron", { year: 0, event: "evt:test" as Ref }, principle("iron"));
  marketsOf(world).of(cell!).metalworking = cellRef(0, cell!);
  assert.ok(reductionHeat(ore) > 1140, `the ore wants ${reductionHeat(ore)} °C`);
  assert.equal(
    whyNot(ctx, cell!, marketsOf(world).of(cell!), ironSmelting),
    `their bloomery reaches 1140 °C, short of the ${reductionHeat(ore)} °C iron ore wants: a blast driven by a mill's wheel would reach it`,
  );
});

test("on alien 16, copper glance is within a kiln's heat, and nothing is said against it", () => {
  const world = worldOf("alien 16"),
    ctx = populationContext(world),
    chem = worldChemistry(ctx.generated);
  assert.equal(worldOre(chem, "copper", "deposit")?.mineral, "chalcocite");
  const cell = depositLands(ctx, "copper")[0];
  assert.ok(cell !== undefined, "a land whose copper within reach is copper glance");
  const m = marketsOf(world).of(cell!);
  assert.equal(whyNot(ctx, cell!, m, copperSmelting), "they do not know how to smelt copper");
  m.metalworking = cellRef(0, cell!);
  assert.equal(whyNot(ctx, cell!, m, copperSmelting), null);
});

test("on Earth, the same recipe at a land with no copper says what it always said", () => {
  const world = worldOf("first light", EARTHLIKE),
    ctx = populationContext(world);
  assert.equal(worldChemistry(ctx.generated).solar, true);
  const cell = lands(ctx).find((c) => oreWithin(ctx, c, "copper") === null);
  assert.ok(cell !== undefined, "a land with no copper within reach");
  const m = marketsOf(world).of(cell!);
  m.metalworking = cellRef(0, cell!);
  assert.equal(whyNot(ctx, cell!, m, copperSmelting), "no copper within a few days' walk");
});
