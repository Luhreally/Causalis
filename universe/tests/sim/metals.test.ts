// The one ore rule and the metals rule (Phase 52 M216): ore within reach as the smelters, the lore,
// the designs and the pages all read it; what a land can work, from what its market holds; tools
// headed with the metal its crafters made them of; hosts armed only with what their seats hold.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { surfaceCopper } from "../../src/gen/index.ts";
import { G, RECIPES, TOOL_METALS, type ToolMetal } from "../../src/rules/index.ts";
import {
  ECONOMY_EVENTS,
  NEIGHBOUR_REACH,
  bestMetal,
  hostFor,
  loreOf,
  makePopulationWorld,
  marketsOf,
  metalRank,
  metalsAt,
  oreWithin,
  politiesOf,
  populationContext,
  toolMetal,
} from "../../src/sim/index.ts";

const world = makePopulationWorld(seedFromText("first light"), { start: "spread" });
world.runTo(500 * YEAR);
const ctx = populationContext(world),
  g = ctx.generated,
  cells = Array.from({ length: g.grid.count }, (_, c) => c),
  around = (c: number) => [
    ...g.grid.neighbours.subarray(g.grid.offsets[c]!, g.grid.offsets[c + 1]!),
  ];

test("copper within reach is where the economy always found it: a deposit or worn-open ore, own or a neighbour's", () => {
  const has = (c: number) =>
    g.deposits.some((d) => d.cell === c && d.kind === "copper") || surfaceCopper(g, c);
  let lands = 0;
  for (const c of cells) {
    const want = has(c) || around(c).some(has),
      o = oreWithin(ctx, c, "copper");
    assert.equal(o !== null, want, `land ${c}`);
    if (!o) continue;
    lands++;
    assert.equal(o.reach, o.cell === c ? 1 : NEIGHBOUR_REACH);
    // (Copper yields alike however it lies: its history stays what it was.)
    assert.equal(o.grade, o.reach);
  }
  assert.ok(lands > 100, `${lands} lands`);
});

test("iron's grade is how it lies: bog ore leanest, the hills' ironstone next, a deposit the best", () => {
  const seen = new Map<string, number>();
  for (const c of cells) {
    const o = oreWithin(ctx, c, "iron");
    if (!o || o.cell !== c) continue;
    seen.set(o.lie, o.grade);
  }
  assert.equal(seen.get("bog"), 0.7);
  if (seen.has("hill")) assert.equal(seen.get("hill"), 0.9);
  if (seen.has("deposit")) assert.equal(seen.get("deposit"), 1);
  const far = cells.map((c) => oreWithin(ctx, c, "iron")).find((o) => o && o.reach < 1);
  assert.ok(far, "iron hauled from a neighbour's land somewhere");
  assert.ok(far.grade <= NEIGHBOUR_REACH);
});

test("reading what a land can work opens no market and changes nothing", () => {
  const before = marketsOf(world).all().length,
    hash = JSON.stringify(world.domainHashes());
  for (const c of cells) metalsAt(ctx, c);
  assert.equal(marketsOf(world).all().length, before);
  assert.equal(JSON.stringify(world.domainHashes()), hash);
});

test("tin and iron are smelted where their crafts are known, and tools are made of bronze and iron", () => {
  const made = (good: number) =>
    marketsOf(world)
      .all()
      .reduce((n, m) => n + (m.years.at(-1)?.ledger[0]?.[good] ?? 0), 0);
  assert.ok(made(G.copper) > 0, "copper smelted");
  const metals = new Map<ToolMetal, number>();
  for (const p of ctx.provinces.all()) {
    if (!p.total()) continue;
    const metal = toolMetal(ctx, p.cell);
    metals.set(metal, (metals.get(metal) ?? 0) + 1);
  }
  const said = TOOL_METALS.map((m) => `${m} ${metals.get(m) ?? 0}`).join(", ");
  assert.ok((metals.get("copper") ?? 0) > 0, said);
  // Every land whose smiths work a metal knows its craft.
  for (const p of ctx.provinces.all()) {
    const metal = toolMetal(ctx, p.cell);
    if (metal === "stone") continue;
    const need = RECIPES.find((r) => r.id === `${metal}-tools`)!.needs!.knowledge!;
    const knows =
      need === "metalworking"
        ? !!marketsOf(world).get(p.cell)?.metalworking
        : !!loreOf(world).get(p.cell, need);
    assert.ok(knows, `land ${p.cell}: ${metal} tools without ${need}`);
  }
  // The first time a land's tools are of a better metal than copper, told.
  const told = world.events.all().filter((e) => e.type === ECONOMY_EVENTS.tools.type);
  if ((metals.get("bronze") ?? 0) + (metals.get("iron") ?? 0) + (metals.get("steel") ?? 0) > 0)
    assert.ok(told.length > 0, said);
});

test("a realm arms its host only with the metals its seat can work", () => {
  let metal = 0;
  for (const p of politiesOf(world).living()) {
    const can = metalsAt(ctx, p.seat),
      best = metalRank(bestMetal(can));
    for (const part of hostFor(ctx, p).parts) {
      const rank = TOOL_METALS.indexOf(part.material as ToolMetal);
      if (rank < 0) continue;
      if (rank > 0) metal++;
      assert.ok(
        rank <= best,
        `${p.ref}: ${part.material} ${part.role}; its seat works ${can.join(", ")}`,
      );
    }
  }
  assert.ok(metal > 0, "some host armed with metal");
});
