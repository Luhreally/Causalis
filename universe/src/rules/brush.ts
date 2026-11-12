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
/**
 * A stroke's bounds; the height a raise or a lower moves land by a step of strength (m); and how far
 * above or below the sea a raise on the sea or a lower through the shore leaves the ground a step of
 * strength (m): raised out of the sea it is new land at once, as a god's hand would make it (asked
 * 2026-11-11: "when i raise land on water i dont see like the mini island i made").
 */
export const BRUSH_LIMIT = {
  // (A stroke's spots: on the globe, every spot under the circle drawn, as it is drawn.)
  centres: 256,
  cells: 512,
  radius: 3,
  rise: 250,
  shore: 40,
} as const;
/** The height a raise or a lower leaves the ground at, from `before` (m). */
export function brushedHeight(before: number, raise: boolean, strength: number): number {
  const step = BRUSH_LIMIT.rise * strength,
    shore = BRUSH_LIMIT.shore * strength;
  if (raise) return before <= 0 ? shore : before + step;
  return before > 0 && before - step <= 0 ? -shore : before - step;
}

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
