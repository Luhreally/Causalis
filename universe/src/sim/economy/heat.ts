// Wave-0 stub (Phase 54 M222 E2 replaces it): every land works the ore within its reach, as before.
import type { PopulationContext } from "../population/systems.ts";
import { oreWithin, type OreAt } from "./ore.ts";

/** Ore a land can work: oreWithin's answer, or copper hardened with its own arsenic. */
export type Workable = OreAt & { readonly arsenical?: true };

export function furnaceHeat(_ctx: PopulationContext, _cell: number, _bringing?: string): number {
  return 0;
}

export function oreWorkable(
  ctx: PopulationContext,
  cell: number,
  kind: string,
  _bringing?: string,
): Workable | null {
  return oreWithin(ctx, cell, kind);
}

export function anyHardener(_ctx: PopulationContext): boolean {
  return true;
}
