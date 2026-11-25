// The sea (Phase 3 M31): which coasts a people's ships can reach. Sails carry them two
// provinces of sea out (a few hundred kilometres: from island to island, along a
// gulf); planked ships four; the stars' courses eight, across a narrow ocean;
// steamships sixteen, across the wide ones (M32). The
// reach over the sea is the planet's own shape, kept, never saved; what a people
// know sets how much of it they use.
import { dmath } from "../../kernel/index.ts";
import { keptKey, type HomeWorld } from "../../gen/index.ts";
import type { LoreStore } from "../lore/lore.ts";

/** Sea provinces a people's ships can cross, by how many of the ship-crafts they know. */
export const SEA_STEPS: readonly number[] = [0, 2, 4, 8, 16];
export const MOST_SEA_STEPS = SEA_STEPS[SEA_STEPS.length - 1]!;

/** How far over the sea a land's ships carry. */
export function seaRange(lore: LoreStore, cell: number): number {
  return SEA_STEPS[Math.min(SEA_STEPS.length - 1, Math.floor(lore.effect(cell, "ships")))]!;
}

/** How far over the sea the ships of either of two lands carry. */
export function seaSteps(lore: LoreStore, a: number, b: number): number {
  return Math.max(seaRange(lore, a), seaRange(lore, b));
}

const REACH = new Map<number, Int32Array>();
/** (The ground REACH was read on: its lands by cell, let go together when the world or its ground is another.) */
let REACH_ON = "";

/**
 * The lands across the sea from `cell` (never its neighbours by land), each with the
 * fewest sea provinces between them, nearest first, out to the farthest any ship goes:
 * two numbers each, the land and the sea provinces to it. (Kept for every coast a ship has
 * sailed from, a list of pairs each was 18 MB of a world's memory at 1,500.)
 */
export function seaReach(g: HomeWorld, cell: number): Int32Array {
  const ground = keptKey(g);
  if (ground !== REACH_ON) {
    REACH.clear();
    REACH_ON = ground;
  }
  let out = REACH.get(cell);
  if (out) return out;
  const land = (c: number) => g.tectonics.elevation[c]! > 0,
    beside = new Set<number>([cell]);
  for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++)
    beside.add(g.grid.neighbours[k]!);
  const depth = new Map<number, number>(),
    queue: number[] = [],
    found = new Map<number, number>();
  for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++) {
    const n = g.grid.neighbours[k]!;
    if (!land(n) && !depth.has(n)) {
      depth.set(n, 1);
      queue.push(n);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const s = queue[i]!,
      d = depth.get(s)!;
    for (let k = g.grid.offsets[s]!; k < g.grid.offsets[s + 1]!; k++) {
      const n = g.grid.neighbours[k]!;
      if (land(n)) {
        if (!beside.has(n) && !found.has(n)) found.set(n, d);
      } else if (!depth.has(n) && d < MOST_SEA_STEPS) {
        depth.set(n, d + 1);
        queue.push(n);
      }
    }
  }
  const sorted = [...found.entries()].sort((x, y) => x[1] - y[1] || x[0] - y[0]);
  out = new Int32Array(2 * sorted.length);
  for (let i = 0; i < sorted.length; i++) {
    out[2 * i] = sorted[i]![0];
    out[2 * i + 1] = sorted[i]![1];
  }
  if (REACH.size > 20_000) REACH.clear();
  REACH.set(cell, out);
  return out;
}

/** The straight-line distance between two cells' centres, in kilometres. */
export function kmBetween(g: HomeWorld, a: number, b: number): number {
  const p = g.grid.positions,
    dx = p[3 * a]! - p[3 * b]!,
    dy = p[3 * a + 1]! - p[3 * b + 1]!,
    dz = p[3 * a + 2]! - p[3 * b + 2]!;
  return dmath.sqrt(dx * dx + dy * dy + dz * dz) * 6371 * g.planet.radius;
}
