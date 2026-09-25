// Rivers and lakes (docs/architecture §24). A priority flood from the coast fills
// every hollow to its spill point and gives each land cell the neighbour its
// water leaves by; rain gathered downstream in reverse flood order is each cell's
// discharge. The largest flows are rivers; filled hollows with water in them are
// lakes.
import { MinHeap, type SphereGrid } from "../kernel/index.ts";

export type Hydrology = {
  /** The cell each land cell drains to (-1 for sea cells). */
  readonly flowTo: Int32Array;
  /** Water passing through each cell, in units of (mm/yr × cell area). */
  readonly discharge: Float32Array;
  /** 1 where a river runs. */
  readonly river: Uint8Array;
  /** 1 where a lake lies. */
  readonly lake: Uint8Array;
  /** The flood level each cell was filled to (≥ its elevation). */
  readonly filled: Float32Array;
};

export function makeHydrology(
  grid: SphereGrid,
  elevation: Float32Array,
  precipitation: Float32Array,
): Hydrology {
  const n = grid.count,
    flowTo = new Int32Array(n).fill(-1),
    filled = Float32Array.from(elevation),
    done = new Uint8Array(n),
    order: number[] = [],
    heap = new MinHeap();
  for (let c = 0; c < n; c++) {
    if (elevation[c]! > 0) continue;
    done[c] = 1;
    // Coastal land drains into its lowest sea neighbour.
    for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++) {
      const m = grid.neighbours[k]!;
      if (elevation[m]! > 0 && !done[m]) {
        const current = flowTo[m]!;
        if (
          current < 0 ||
          elevation[c]! < elevation[current]! ||
          (elevation[c] === elevation[current] && c < current)
        )
          flowTo[m] = c;
      }
    }
  }
  for (let c = 0; c < n; c++) if (elevation[c]! > 0 && flowTo[c]! >= 0) heap.push(elevation[c]!, c);
  while (heap.size) {
    const c = heap.pop();
    if (done[c]) continue;
    done[c] = 1;
    order.push(c);
    for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++) {
      const m = grid.neighbours[k]!;
      if (done[m] || elevation[m]! <= 0) continue;
      const level = Math.max(elevation[m]!, filled[c]!);
      if (flowTo[m]! < 0 || level < filled[m]! || flowTo[m] === c) {
        flowTo[m] = c;
        filled[m] = level;
        heap.push(level, m);
      }
    }
  }
  const discharge = new Float32Array(n);
  for (let i = order.length - 1; i >= 0; i--) {
    const c = order[i]!;
    discharge[c] = discharge[c]! + precipitation[c]! * grid.areas[c]! * 1e3;
    const down = flowTo[c]!;
    if (down >= 0 && elevation[down]! > 0) discharge[down] = discharge[down]! + discharge[c]!;
  }
  // Rivers: the strongest flows, about one land cell in twelve.
  const land = order.map((c) => discharge[c]!).sort((a, b) => b - a),
    threshold = land[Math.floor(land.length / 12)] ?? Infinity;
  const river = new Uint8Array(n),
    lake = new Uint8Array(n);
  for (const c of order) {
    if (discharge[c]! >= threshold) river[c] = 1;
    if (filled[c]! - elevation[c]! > 20 && discharge[c]! > threshold / 4) lake[c] = 1;
  }
  return { flowTo, discharge, river, lake, filled };
}
