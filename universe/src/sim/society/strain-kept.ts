// What a land's strain keeps (./strain.ts; the rule is rules/self.ts landStrainOf), and what the older systems read of it. One row a
// land, last reckoned only, its usual deaths a faded number; reached by the kernel and Round B's kept rows alone, so the economy can
// read it without a circle. Every reader gives back exactly what the world did before where no row is kept.
import type { World } from "../../kernel/index.ts";
import { STRAIN } from "../../rules/index.ts";
import type { RowStore } from "../money/kept.ts";

/**
 * 10. How a land bears its years (thousandths unless said): its strain; what weighs on its people (the dead past the usual, a foe
 * holding it, want, a place that shuts them out); what holds them up; its deaths a year and its usual (in a million of its people).
 */
export const STRAIN_STORE = "society.strain";
export const STRAIN_ROW = {
  strain: 0,
  loss: 1,
  war: 2,
  want: 3,
  place: 4,
  held: 5,
  deaths: 6,
  usual: 7,
} as const;
export const STRAIN_WIDTH = 8;

/** A land's strain (0 … 1; 0 where none is reckoned). */
export function strainIn(world: World, cell: number): number {
  return (world.peek<RowStore>(STRAIN_STORE)?.at(cell, STRAIN_ROW.strain) ?? 0) / 1000;
}

/** Of what a land's crafts would make, the share its strain leaves made (1 where none is reckoned). */
export function strainKept(world: World, cell: number): number {
  return 1 - STRAIN.work * strainIn(world, cell);
}

/** A land's strain row whole (null where none is reckoned). */
export function strainRow(world: World, cell: number): readonly number[] | null {
  return world.peek<RowStore>(STRAIN_STORE)?.get(cell) ?? null;
}
