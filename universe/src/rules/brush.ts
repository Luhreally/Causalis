import type { SphereGrid } from "../kernel/index.ts";

export const BRUSH_KINDS = [
  "raise",
  "lower",
  "water",
  "drain",
  "life",
  "ore",
  "lightning",
  "claim",
] as const;
export type BrushKind = (typeof BRUSH_KINDS)[number];
export type BrushArgs = {
  kind: BrushKind;
  cells: number[];
  radius: number;
  strength: number;
  ore?: "copper" | "gold" | "tin" | "iron" | "coal" | "oil" | "salt";
  realm?: string;
  confirmed?: boolean;
};
export const BRUSH_LIMIT = { centres: 64, cells: 512, radius: 3, rise: 250 } as const;

/** A bounded, sorted union. Pointer sampling order cannot change a stroke's effect. */
export function brushCells(grid: SphereGrid, centres: readonly number[], radius: number): number[] {
  const found = new Set(centres),
    queue = [...found].sort((a, b) => a - b).map((cell) => ({ cell, step: 0 }));
  for (let i = 0; i < queue.length; i++) {
    const { cell, step } = queue[i]!;
    if (step >= radius) continue;
    for (let k = grid.offsets[cell]!; k < grid.offsets[cell + 1]!; k++) {
      const near = grid.neighbours[k]!;
      if (found.has(near)) continue;
      found.add(near);
      if (found.size > BRUSH_LIMIT.cells)
        throw new Error("Stroke too large; use a shorter stroke or smaller brush.");
      queue.push({ cell: near, step: step + 1 });
    }
  }
  return [...found].sort((a, b) => a - b);
}
