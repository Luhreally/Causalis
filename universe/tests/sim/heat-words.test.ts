// The words a land is short of ore in (Phase 54 M222): where a furnace is too cool for the ore within
// reach, the words name the furnace, its heat and the heat the ore wants. On alien 16 a land whose only
// copper within reach is copper glance has a kiln-furnace, 1140 °C, short of the glance's 1150. On
// Earth the same recipe, at a land with no copper, says exactly what it always has.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { EARTHLIKE, OPEN, RECIPES, worldOre } from "../../src/rules/index.ts";
import { cellRef, worldChemistry } from "../../src/gen/index.ts";
import {
  makePopulationWorld,
  marketsOf,
  oreWithin,
  oreWorkable,
  populationContext,
  whyNot,
} from "../../src/sim/index.ts";

const copperSmelting = RECIPES.find((r) => r.id === "copper-smelting")!;
const worldOf = (seed: string, prior = OPEN) =>
  makePopulationWorld(seedFromText(seed), { prior, start: "spread" });
const lands = (ctx: ReturnType<typeof populationContext>) =>
  [...ctx.provinces.all()].map((p) => p.cell).sort((a, b) => a - b);

test("on alien 16, a kiln too cool for the copper glance within reach says so", () => {
  const world = worldOf("alien 16"),
    ctx = populationContext(world),
    chem = worldChemistry(ctx.generated);
  // A land whose only copper within reach is a deposit of copper glance (as heat.test.ts finds one).
  const cell = lands(ctx).find((c) => {
    const o = oreWithin(ctx, c, "copper");
    return (
      o?.lie === "deposit" &&
      o.cell === c &&
      worldOre(chem, "copper", "deposit")?.mineral === "chalcocite" &&
      oreWorkable(ctx, c, "copper", "metalworking") === null
    );
  });
  assert.ok(cell !== undefined, "a land whose only copper is copper glance");
  // Its smiths know metalworking (set here as the sim sets it, by the land's market).
  const m = marketsOf(world).of(cell!);
  m.metalworking = cellRef(0, cell!);
  assert.equal(
    whyNot(ctx, cell!, m, copperSmelting),
    "their kiln-furnace reaches 1140 °C, short of the 1150 °C copper glance wants",
  );
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
