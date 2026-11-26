// Why a smithy forged nothing, on a world of its own chemistry (Phase 54 M222). On alien 16 a land
// whose only copper within reach is copper glance has, before it knows metalworking, an open fire
// far too cool for it: its smithy's page says so, in the fire's heat and the glance's, not that no
// ore lies within reach. A land that knows no bronze is told it does not know the world's own
// bronze, arsenical copper.
import { test } from "node:test";
import { keptLife } from "../../src/rules/kinds.ts";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { OPEN, RECIPES, metalOf, reductionHeat, worldOre } from "../../src/rules/index.ts";
import { cellRef, worldChemistry } from "../../src/gen/index.ts";
import {
  forgedMetal,
  livableFor,
  makePopulationWorld,
  marketsOf,
  oreWithin,
  oreWorkable,
  populationContext,
  whyNot,
} from "../../src/sim/index.ts";
import { workshopBlocks } from "../../src/host/chain.ts";

const world = makePopulationWorld(seedFromText(keptLife("alien 16")), {
    prior: OPEN,
    start: "spread",
  }),
  ctx = populationContext(world),
  chem = worldChemistry(ctx.generated),
  lands = [...ctx.provinces.all()].map((p) => p.cell).sort((a, b) => a - b);

const text = (blocks: readonly { readonly type: string }[]) =>
  blocks
    .filter((b): b is { type: "text"; lines: readonly (readonly unknown[])[] } => b.type === "text")
    .flatMap((b) =>
      b.lines.map((l) =>
        l.map((s) => (typeof s === "string" ? s : (s as { text: string }).text)).join(""),
      ),
    );

test("on alien 16, a smithy by copper glance its kiln cannot melt says why nothing was forged", () => {
  // (Among every land its people can live in, peopled yet or not: since its ores are read from what its crust holds, none of
  // the lands its bands open on has copper glance of its own.)
  const cell = ctx.generated.deposits
    .filter((d) => d.kind === "copper" && livableFor(ctx, d.cell))
    .map((d) => d.cell)
    .sort((a, b) => a - b)
    .find((c) => {
      const o = oreWithin(ctx, c, "copper");
      return (
        o?.lie === "deposit" &&
        o.cell === c &&
        worldOre(chem, "copper", "deposit")?.mineral === "chalcocite" &&
        oreWorkable(ctx, c, "copper") === null &&
        oreWorkable(ctx, c, "iron") === null
      );
    });
  assert.ok(
    cell !== undefined,
    "a land whose only copper is copper glance, and no iron it can work",
  );
  assert.equal(forgedMetal(ctx, cell!, 0), "stone");
  const town = { ref: `town:test:${cell}`, name: "Testford", cell: cell!, population: 40 };
  const said = text(workshopBlocks(world, town, "smithy", "smithy-test", 0)).find((w) =>
    w.startsWith("Nothing was forged here this year"),
  );
  // (What the glance wants is read from its smelt, rules/chem-ores.ts reductionHeat: since the smelting heats came from the
  // oxides' free energies, the heat at which its copper runs, not a number written by the ore.)
  const wants = reductionHeat(worldOre(chem, "copper", "deposit")!);
  assert.ok(wants > 690, `copper glance wants ${wants} °C, past an open fire's 690`);
  assert.match(
    said ?? "",
    new RegExp(
      `^Nothing was forged here this year: the copper glance within reach of .+ wants ${wants} °C, and its open fire reaches only 690 °C\\. Its tools are still knapped from its own .+\\.$`,
    ),
  );
});

test("on alien 16, a land that knows no bronze does not know arsenical copper", () => {
  assert.equal(metalOf(chem, "bronze").name, "arsenical copper");
  const tools = RECIPES.find((r) => r.id === "bronze-tools")!,
    cell = lands[0]!,
    m = marketsOf(world).of(cell);
  m.metalworking = cellRef(0, cell);
  assert.equal(whyNot(ctx, cell, m, tools), "they do not know arsenical copper");
});
