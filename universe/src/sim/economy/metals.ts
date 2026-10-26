// What metals a land can work (Phase 52 M216): tools of a metal are workable where the land knows
// the craft and its market holds every metal good they are worked from — smelted from ore within
// reach, brought in down a road, or kept in store. One rule, read alike by the economy's record of
// what its tools were made of, by the designs (what a realm can arm its host with, at its seat) and
// by the pages. Read paths never open a market (`.get()`, not `.of()`).
import { cellRef } from "../../gen/index.ts";
import type { Ref } from "../../kernel/index.ts";
import { SMELTING, TOOL_METALS, WORKED, type ToolMetal } from "../../rules/index.ts";
import { knows } from "../lore/lore.ts";
import type { PopulationContext } from "../population/systems.ts";
import { marketGoodRef, type Market, type MarketStore } from "./market.ts";
import { oreWithin, type OreAt } from "./ore.ts";

/** Where a land's metal of a kind comes from: its own smelters' ore, a road, or its store. */
export type MetalSource =
  | { readonly how: "ore"; readonly ore: OreAt }
  | { readonly how: "road"; readonly from: number; readonly road: Ref | null }
  | { readonly how: "store" };

function marketAt(ctx: PopulationContext, cell: number): Market | undefined {
  return ctx.world.store<MarketStore>("economy.markets").get(cell);
}

/** The ore a land's smelters can win a metal good from: the craft known and ore within reach. */
export function smeltable(ctx: PopulationContext, cell: number, good: number): OreAt | null {
  const row = SMELTING.find((s) => s.good === good);
  if (!row || !knows(ctx, cell, row.knowledge)) return null;
  return oreWithin(ctx, cell, row.ore);
}

/**
 * Where a land has a metal good from this year, if it has it: smelted from its own ore within
 * reach, else down the road that brought the most of it in (the year's books), else its store.
 */
export function metalSource(
  ctx: PopulationContext,
  cell: number,
  good: number,
): MetalSource | null {
  const ore = smeltable(ctx, cell, good);
  if (ore) return { how: "ore", ore };
  const m = marketAt(ctx, cell);
  if (!m) return null;
  if (m.book("in", good) > 0) {
    const markets = ctx.world.store<MarketStore>("economy.markets");
    let best: { from: number; count: number } | null = null;
    for (const f of markets.flows)
      if (f.to === cell && f.good === good && (!best || f.count > best.count))
        best = { from: f.from, count: f.count };
    if (best) return { how: "road", from: best.from, road: markets.route(best.from, cell) ?? null };
  }
  return m.stock[good]! > 0 ? { how: "store" } : null;
}

/** What to cite for a metal's source: the deposit or land of its ore, the road, or the market. */
export function sourceRef(cell: number, good: number, source: MetalSource): Ref {
  if (source.how === "ore") return source.ore.ref;
  if (source.how === "road") return source.road ?? cellRef(0, source.from);
  return marketGoodRef(cell, good);
}

/**
 * The metals a land can head its tools (and arm its hosts) with this year, worst to best: stone
 * always; each metal whose craft it knows and whose every metal good it holds.
 */
export function metalsAt(ctx: PopulationContext, cell: number): ToolMetal[] {
  const out: ToolMetal[] = ["stone"],
    held = new Map<number, boolean>(),
    has = (good: number) => {
      let h = held.get(good);
      if (h === undefined) held.set(good, (h = metalSource(ctx, cell, good) !== null));
      return h;
    };
  for (const metal of TOOL_METALS) {
    if (metal === "stone") continue;
    const w = WORKED[metal];
    if (knows(ctx, cell, w.knowledge) && w.from.every(has)) out.push(metal);
  }
  return out;
}

/** The best of a list of metals (the last, as `metalsAt` gives them). */
export function bestMetal(metals: readonly ToolMetal[]): ToolMetal {
  let best: ToolMetal = "stone";
  for (const m of metals) if (TOOL_METALS.indexOf(m) > TOOL_METALS.indexOf(best)) best = m;
  return best;
}

/** A metal's rank among what tools are headed with: stone 0, copper 1 … steel 4. */
export function metalRank(metal: ToolMetal): number {
  return TOOL_METALS.indexOf(metal);
}
