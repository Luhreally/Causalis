// The sea (Phase 3 M31): which coasts a people's ships can reach. Sails carry them two
// provinces of sea out (a few hundred kilometres: from island to island, along a
// gulf); planked ships four; the stars' courses eight, across a narrow ocean. The
// reach over the sea is the planet's own shape, kept, never saved; what a people
// know sets how much of it they use.
import { dmath } from "../../kernel/index.ts";
import type { HomeWorld } from "../../gen/index.ts";
import type { LoreStore } from "../lore/lore.ts";

/** Sea provinces a people's ships can cross, by how many of the ship-crafts they know. */
export const SEA_STEPS: readonly number[] = [0, 2, 4, 8];
export const MOST_SEA_STEPS = SEA_STEPS[SEA_STEPS.length - 1]!;

/** How far over the sea the ships of either of two lands carry. */
export function seaSteps(lore: LoreStore, a: number, b: number): number {
  const ships = Math.max(lore.effect(a, "ships"), lore.effect(b, "ships"));
  return SEA_STEPS[Math.min(SEA_STEPS.length - 1, Math.floor(ships))]!;
}

const REACH = new Map<string, readonly (readonly [number, number])[]>();

/**
 * The lands across the sea from `cell` (never its neighbours by land), each with the
 * fewest sea provinces between them, nearest first, out to the farthest any ship goes.
 */
export function seaReach(g: HomeWorld, cell: number): readonly (readonly [number, number])[] {
  const key = `${g.digest}:${cell}`;
  let out = REACH.get(key);
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
  out = [...found.entries()].sort((x, y) => x[1] - y[1] || x[0] - y[0]);
  if (REACH.size > 20_000) REACH.clear();
  REACH.set(key, out);
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
