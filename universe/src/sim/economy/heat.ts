// The heat a land's fire reaches, and the ore it can work (Phase 54 M222): an ore gives up its
// metal only to a fire hot enough to reduce it — an open fire, a kiln-furnace with metalworking, a
// bloomery with iron, a blast furnace with steel, an arc with electricity — and a world's air sets
// what each reaches: thin air burns cooler, rich air hotter. So a land works the first ore within
// reach its furnace can reduce, and where none of the world's hardener can be worked, its smiths
// harden copper with the arsenic its own grey copper ores give. On an Earth-like world the old rule
// holds unchanged (oreWithin's own answer). Reads the lore's store by its type only: the lore reads
// this file.
import { worldChemistry } from "../../gen/index.ts";
import {
  ARSENICAL_GRADE,
  arsenicalFallback,
  furnaceOf,
  heatOf,
  reductionHeat,
  worldOre,
  type Furnace,
  type Ore,
} from "../../rules/index.ts";
import type { LoreStore } from "../lore/lore.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "./market.ts";
import { NEIGHBOUR_REACH, oreWithin, oresIn, type OreAt } from "./ore.ts";

/** Ore a land can work: oreWithin's answer, or copper hardened with its own arsenic. */
export type Workable = OreAt & { readonly arsenical?: true };

/** The kinds a furnace must reduce (coal, oil and salt need none). */
const SMELTED = new Set(["copper", "tin", "iron"]);

/** What a land knows, read from the stores themselves (metalworking from its market). */
function knower(ctx: PopulationContext, cell: number): (id: string) => boolean {
  return (id) =>
    id === "metalworking"
      ? !!ctx.world.store<MarketStore>("economy.markets").get(cell)?.metalworking
      : !!ctx.world.store<LoreStore>("lore.known").get(cell, id);
}

/** The heat a land's hottest furnace reaches in its world's air (0 for a people without fire). */
export function furnaceHeat(ctx: PopulationContext, cell: number, bringing?: string): number {
  if (!ctx.affords.fire) return 0;
  return heatOf(worldChemistry(ctx.generated), knower(ctx, cell), bringing);
}

// What ore of each kind each land can work at each heat: a pure function of the world, kept.
const WORKABLE = new Map<string, Workable | null>();

/**
 * The ore of a kind a land can work: its own first, then a neighbour's (in cell order), the first
 * its furnace is hot enough to reduce — the sea floor's vents asking no furnace at all; where no ore
 * of the world's hardener can be worked, copper's own, roasted for its arsenic.
 */
export function oreWorkable(
  ctx: PopulationContext,
  cell: number,
  kind: string,
  bringing?: string,
): Workable | null {
  const chem = worldChemistry(ctx.generated);
  if (chem.solar || !ctx.affords.fire || !SMELTED.has(kind)) return oreWithin(ctx, cell, kind);
  const heat = furnaceHeat(ctx, cell, bringing),
    key = `${ctx.generated.digest}:${ctx.medium}:${cell}:${kind}:${heat}`,
    kept = WORKABLE.get(key);
  if (kept !== undefined) return kept;
  if (WORKABLE.size > 200_000) WORKABLE.clear();
  let found: Workable | null = findWorkable(ctx, cell, kind, heat);
  if (!found && kind === "tin" && (arsenicalFallback(chem) || !anyHardener(ctx))) {
    const cu = oreWorkable(ctx, cell, "copper", bringing);
    if (cu) found = { ...cu, kind: "tin", grade: cu.grade * ARSENICAL_GRADE, arsenical: true };
  }
  WORKABLE.set(key, found);
  return found;
}

function findWorkable(
  ctx: PopulationContext,
  cell: number,
  kind: string,
  heat: number,
): OreAt | null {
  const g = ctx.generated,
    chem = worldChemistry(g),
    at = (c: number, reach: number): OreAt | null => {
      for (const o of oresIn(ctx, c, kind)) {
        const ore = worldOre(chem, kind, o.lie);
        if (!ore) continue;
        if (o.lie === "vent" || heat >= reductionHeat(ore))
          return { kind, cell: c, ...o, reach, grade: reach * ore.grade };
      }
      return null;
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

/**
 * Why a land's furnace works none of an ore within its reach: the ore, where it lies, the heat it
 * wants and the heat the furnace reaches (null where it works one, or there is none to work).
 */
export function heatShortfall(
  ctx: PopulationContext,
  cell: number,
  kind: string,
  bringing?: string,
): {
  readonly ore: Ore;
  readonly at: OreAt;
  readonly wanted: number;
  readonly reached: number;
  readonly furnace: Furnace;
} | null {
  const chem = worldChemistry(ctx.generated);
  if (chem.solar || !ctx.affords.fire || !SMELTED.has(kind)) return null;
  if (oreWorkable(ctx, cell, kind, bringing)) return null;
  const at = oreWithin(ctx, cell, kind),
    ore = at && worldOre(chem, kind, at.lie);
  if (!at || !ore) return null;
  return {
    ore,
    at,
    wanted: reductionHeat(ore),
    reached: furnaceHeat(ctx, cell, bringing),
    furnace: furnaceOf(chem, knower(ctx, cell), bringing),
  };
}

// Whether any land of a world holds ore of its hardener, by world: a pure function, kept.
const HARDENER = new Map<string, boolean>();

/** Whether any land of the world holds its hardener's ore, in a deposit or showing at the surface. */
export function anyHardener(ctx: PopulationContext): boolean {
  const key = `${ctx.generated.digest}:${ctx.medium}`,
    kept = HARDENER.get(key);
  if (kept !== undefined) return kept;
  let found = false;
  for (let c = 0; c < ctx.generated.grid.count && !found; c++)
    found = oresIn(ctx, c, "tin").length > 0;
  HARDENER.set(key, found);
  if (HARDENER.size > 16) HARDENER.delete(HARDENER.keys().next().value!);
  return found;
}
