// A world's settled ground, as the eye reads it (galaxy-plan.md, "Worlds filled"): history keeps how much of a world is
// settled, not where, so the view places it: outward from where its halls stand, along its low ground and its coasts
// first, the same every time, and the more that is settled the further it has spread. Pure.
import { sphereGrid } from "../kernel/index.ts";
import type { WorldGlobe } from "../bridge/index.ts";

/** A keyed share in [0, 1), from a cell (the view's own). */
const hash01 = (c: number, k: number) => {
  let h = (Math.imul(c + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * Every cell its people could stand on, in the order they would come to settle it: outward from `starts` by a way that
 * costs more over high ground and is keyed, so it spreads in arms and patches and not in a circle. A land people skips
 * the sea (cover 1); a people of the water keeps to it, where a world has one.
 */
export function settleOrder(w: WorldGlobe, starts: readonly number[], sea: boolean): Int32Array {
  const grid = sphereGrid(w.frequency),
    n = grid.count;
  let lo = Infinity,
    hi = -Infinity;
  for (let c = 0; c < n; c++) {
    lo = Math.min(lo, w.elevation[c]!);
    hi = Math.max(hi, w.elevation[c]!);
  }
  const span = Math.max(1, hi - lo),
    hasSea = w.cover.some((v) => v === 1),
    usable = (c: number) => (sea && hasSea ? w.cover[c] === 1 : w.cover[c] !== 1),
    best = new Float32Array(n).fill(Infinity),
    done = new Uint8Array(n),
    out: number[] = [],
    // (A binary heap of [cost, cell].)
    heapCost: number[] = [],
    heapCell: number[] = [],
    push = (cost: number, cell: number) => {
      let i = heapCost.length;
      heapCost.push(cost);
      heapCell.push(cell);
      while (i > 0) {
        const up = (i - 1) >> 1;
        if (heapCost[up]! <= cost) break;
        heapCost[i] = heapCost[up]!;
        heapCell[i] = heapCell[up]!;
        i = up;
      }
      heapCost[i] = cost;
      heapCell[i] = cell;
    },
    pop = (): number => {
      const top = heapCell[0]!,
        lastCost = heapCost.pop()!,
        lastCell = heapCell.pop()!,
        size = heapCost.length;
      if (size) {
        let i = 0;
        for (;;) {
          let kid = 2 * i + 1;
          if (kid >= size) break;
          if (kid + 1 < size && heapCost[kid + 1]! < heapCost[kid]!) kid++;
          if (heapCost[kid]! >= lastCost) break;
          heapCost[i] = heapCost[kid]!;
          heapCell[i] = heapCell[kid]!;
          i = kid;
        }
        heapCost[i] = lastCost;
        heapCell[i] = lastCell;
      }
      return top;
    };
  for (const s of starts) {
    // (A world's halls stand on its ground; a people of the water's start at the sea nearest, or else where they are.)
    if (!usable(s)) continue;
    best[s] = 0;
    push(0, s);
  }
  if (!heapCost.length)
    for (let c = 0; c < n; c++)
      if (usable(c)) {
        best[c] = 0;
        push(0, c);
        break;
      }
  while (heapCost.length) {
    const c = pop();
    if (done[c]) continue;
    done[c] = 1;
    out.push(c);
    for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++) {
      const m = grid.neighbours[k]!;
      if (done[m] || !usable(m)) continue;
      const high = (w.elevation[m]! - lo) / span,
        step = best[c]! + 1 + 2.4 * high + 2.2 * hash01(m, 3);
      if (step < best[m]!) {
        best[m] = step;
        push(step, m);
      }
    }
  }
  return Int32Array.from(out);
}

/** The cells settled at a share of what its people could stand on: at least one where anyone is there at all. */
export function filledCells(order: Int32Array, share: number): number[] {
  const n = Math.min(order.length, share > 0 ? Math.max(1, Math.round(share * order.length)) : 0),
    out: number[] = [];
  for (let i = 0; i < n; i++) out.push(order[i]!);
  return out;
}

/** A world's colours with its settled ground drawn in: darkened by what is built on it, and warmed by its lights. */
export function filledColors(colors: Uint8Array, cells: readonly number[]): Uint8Array {
  const out = colors.slice(),
    BUILT = [0.15, 0.14, 0.17] as const;
  for (const c of cells) {
    const warm = 0.05 + 0.1 * hash01(c, 9);
    for (let k = 0; k < 3; k++) {
      const was = out[4 * c + k]! / 255,
        now = was * 0.14 + BUILT[k]! * 0.86 + (k === 0 ? warm : k === 1 ? warm * 0.6 : 0);
      out[4 * c + k] = Math.round(Math.min(1, now) * 255);
    }
  }
  return out;
}
