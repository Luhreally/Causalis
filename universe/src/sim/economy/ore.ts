// The one ore rule (Phase 52 M216): what ore of a kind a land can dig — its own ground's first, else
// a neighbour's a few days' walk off — read alike by its smelters (the economy), by what it may come
// to know (the lore), by how its host is armed (the designs) and by the chain the pages trace. A
// deposit the world laid down, else what shows at the surface: copper where old mountains are worn
// open (and, to a people of the water, the sea floor's hot springs), stream tin washed out of worn
// granite, bog ore and the hills' ironstone, coal, oil and salt in their seams. A pure function of the
// generated world, kept.
import type { Ref } from "../../kernel/index.ts";
import { cellRef, ironShowing, surfaceCopper, surfaceOre } from "../../gen/index.ts";
import { ORES, type OreLie } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";

/** How an ore lies in a land: as the stuffs name it, or in a seam (coal, oil, salt). */
export type OreLieAt = OreLie | "seam";

/** Ore of a kind within a land's reach: where, how it lies, what to cite, and what it yields. */
export type OreAt = {
  readonly kind: string;
  readonly cell: number;
  readonly lie: OreLieAt;
  /** What the explainer cites: the deposit, or the land whose surface holds the ore. */
  readonly ref: Ref;
  readonly richness: number;
  /** Ore hauled in from a neighbouring land yields less than ore at home. */
  readonly reach: number;
  /** What a smelter's year yields from it against the best: its reach, by how the ore lies. */
  readonly grade: number;
};

/** What ore hauled from a neighbour's land yields, against ore at home. */
export const NEIGHBOUR_REACH = 0.6;

/** What a smelter's year yields from an ore as it lies, against the best (1 where not said). */
export function oreGrade(kind: string, lie: OreLieAt): number {
  return lie === "seam" ? 1 : (ORES[kind]?.[lie]?.grade ?? 1);
}

/** The ore of a kind in a land's own ground: its deposit, else what shows at its surface. */
export function oreIn(
  ctx: PopulationContext,
  cell: number,
  kind: string,
): { lie: OreLieAt; ref: Ref; richness: number } | null {
  const g = ctx.generated,
    d = g.deposits.find((x) => x.cell === cell && x.kind === kind);
  if (d) return { lie: "deposit", ref: d.ref as Ref, richness: d.richness };
  const shows = (lie: OreLieAt) => ({ lie, ref: cellRef(0, cell), richness: 0 });
  switch (kind) {
    case "copper":
      if (surfaceCopper(g, cell)) return shows("surface");
      // (The vents' chimneys, to a people of the water, are their copper.)
      return ctx.medium === "water" && surfaceOre(g, cell, "vent") ? shows("vent") : null;
    case "tin":
      return surfaceOre(g, cell, "tin") ? shows("surface") : null;
    case "iron": {
      const lie = ironShowing(g, cell);
      return lie ? shows(lie) : null;
    }
    default:
      return surfaceOre(g, cell, kind) ? shows("seam") : null;
  }
}

// What ore of each kind each land can reach: a pure function of the generated world, kept.
const WITHIN = new Map<string, OreAt | null>();

/**
 * The ore of a kind a land can work: its own first, then a neighbour's within a few days' walk
 * (the nearest by cell order), yielding less for the haul.
 */
export function oreWithin(ctx: PopulationContext, cell: number, kind: string): OreAt | null {
  const key = `${ctx.generated.digest}:${ctx.medium}:${cell}:${kind}`,
    known = WITHIN.get(key);
  if (known !== undefined) return known;
  if (WITHIN.size > 200_000) WITHIN.clear();
  const found = findWithin(ctx, cell, kind);
  WITHIN.set(key, found);
  return found;
}

function findWithin(ctx: PopulationContext, cell: number, kind: string): OreAt | null {
  const g = ctx.generated,
    at = (c: number, reach: number): OreAt | null => {
      const o = oreIn(ctx, c, kind);
      return o ? { kind, cell: c, ...o, reach, grade: reach * oreGrade(kind, o.lie) } : null;
    };
  const own = at(cell, 1);
  if (own) return own;
  const around = [
    ...g.grid.neighbours.subarray(g.grid.offsets[cell]!, g.grid.offsets[cell + 1]!),
  ].sort((a, b) => a - b);
  for (const c of around) {
    const o = at(c, NEIGHBOUR_REACH);
    if (o) return o;
  }
  return null;
}
