// The one ore rule (Phase 52 M216): what ore of a kind a land can dig — its own ground's first, else
// a neighbour's a few days' walk off — read alike by its smelters (the economy), by what it may come
// to know (the lore), by how its host is armed (the designs) and by the chain the pages trace. A
// deposit the world laid down, else what shows at the surface: copper where old mountains are worn
// open (and, to a people of the water, the sea floor's hot springs), stream tin washed out of worn
// granite, bog ore and the hills' ironstone, coal, oil and salt in their seams. A pure function of the
// generated world, kept.
import type { Ref } from "../../kernel/index.ts";
import {
  cellRef,
  ironShowing,
  surfaceCopper,
  surfaceOre,
  worldChemistry,
} from "../../gen/index.ts";
import { SOLAR, worldOre, type Chemistry, type OreLie } from "../../rules/index.ts";
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

/**
 * What a smelter's year yields from an ore as it lies, against the best (1 where not said) — the
 * ore of its own world's chemistry (Phase 54: lumps of native iron yield half a bloom's iron).
 */
export function oreGrade(kind: string, lie: OreLieAt, chem: Chemistry = SOLAR): number {
  return lie === "seam" ? 1 : (worldOre(chem, kind, lie)?.grade ?? 1);
}

/** The ore of a kind in a land's own ground: its deposit, else what shows at its surface. */
export function oreIn(
  ctx: PopulationContext,
  cell: number,
  kind: string,
): { lie: OreLieAt; ref: Ref; richness: number } | null {
  const d = ctx.generated.deposits.find((x) => x.cell === cell && x.kind === kind);
  if (d) return { lie: "deposit", ref: d.ref as Ref, richness: d.richness };
  return showingIn(ctx, cell, kind);
}

/**
 * Every ore of a kind in a land's own ground (Phase 54: a furnace too cool for one may work the
 * other): its deposit, then what shows at its surface, each that is there.
 */
export function oresIn(
  ctx: PopulationContext,
  cell: number,
  kind: string,
): { lie: OreLieAt; ref: Ref; richness: number }[] {
  const d = ctx.generated.deposits.find((x) => x.cell === cell && x.kind === kind),
    shown = showingIn(ctx, cell, kind);
  return [
    ...(d ? [{ lie: "deposit" as const, ref: d.ref as Ref, richness: d.richness }] : []),
    ...(shown ? [shown] : []),
  ];
}

/** What of a kind shows at a land's surface: copper where old mountains are worn open, and so on. */
function showingIn(
  ctx: PopulationContext,
  cell: number,
  kind: string,
): { lie: OreLieAt; ref: Ref; richness: number } | null {
  const g = ctx.generated,
    shows = (lie: OreLieAt) => ({ lie, ref: cellRef(0, cell), richness: 0 });
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
    chem = worldChemistry(g),
    at = (c: number, reach: number): OreAt | null => {
      const o = oreIn(ctx, c, kind);
      return o ? { kind, cell: c, ...o, reach, grade: reach * oreGrade(kind, o.lie, chem) } : null;
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
