// What the sandbox looks like, as data (docs/architecture §28): a pure function
// from a frame to a VisualSpec. Sixteen cells on a ring, each tinted by its price,
// a crowd per class drawn one figure per so many people (capped by the device
// tier), and a flood's water that fades over sixty days. The renderer only draws
// what this returns; the same frame always gives the same picture.
import type { FrameMessage } from "../bridge/index.ts";

export type Rgb = readonly [number, number, number];

export type CellSpec = {
  readonly index: number;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly color: Rgb;
  /** 1 just flooded, fading to 0 after sixty days. */
  readonly flood: number;
};

export type CrowdSpec = {
  readonly cls: number;
  readonly color: Rgb;
  /** x, z pairs. */
  readonly positions: Float32Array;
};

export type SandboxSpec = {
  readonly cells: readonly CellSpec[];
  readonly crowds: readonly CrowdSpec[];
};

export const RING_RADIUS = 10;
export const CELL_RADIUS = 1.7;
export const PEOPLE_PER_FIGURE = 10;
export const CLASS_COLORS: readonly Rgb[] = [
  [0.88, 0.63, 0.28],
  [0.2, 0.62, 0.6],
  [0.62, 0.38, 0.66],
];
export const CLASS_NAMES = ["growers", "makers", "keepers"];

const GOLDEN = 2.399963229728653;

export function cellCenter(index: number, count: number): [number, number] {
  const a = (2 * Math.PI * index) / count;
  return [RING_RADIUS * Math.cos(a), RING_RADIUS * Math.sin(a)];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Cheap land is green, dear land is red. */
export function priceColor(price: number): Rgb {
  const t = Math.max(0, Math.min(1, (price - 0.6) / 1.8));
  return t < 0.5
    ? mix([0.36, 0.62, 0.34], [0.86, 0.74, 0.34], t * 2)
    : mix([0.86, 0.74, 0.34], [0.78, 0.33, 0.27], (t - 0.5) * 2);
}

export function sandboxSpec(frame: FrameMessage, crowdCap: number): SandboxSpec {
  const meta = frame.meta as { cells: number; classes: number },
    people = frame.arrays.people!,
    prices = frame.arrays.prices!,
    floodAge = frame.arrays.floodAge!;
  const cells: CellSpec[] = [];
  for (let c = 0; c < meta.cells; c++) {
    const [x, z] = cellCenter(c, meta.cells),
      age = floodAge[c]!;
    cells.push({
      index: c,
      x,
      z,
      radius: CELL_RADIUS,
      color: priceColor(prices[c]!),
      flood: age >= 0 && age < 60 ? 1 - age / 60 : 0,
    });
  }
  const counts: number[][] = [];
  for (let k = 0; k < meta.classes; k++)
    counts.push(
      cells.map((cell) =>
        Math.min(crowdCap, Math.ceil(people[cell.index * meta.classes + k]! / PEOPLE_PER_FIGURE)),
      ),
    );
  // A cell's crowd fills its tile: figures are spread by the cell's whole crowd, the
  // classes interleaved on one sunflower spiral.
  const perCell = cells.map((cell) => counts.reduce((sum, row) => sum + row[cell.index]!, 0));
  const crowds: CrowdSpec[] = [];
  for (let k = 0; k < meta.classes; k++) {
    const row = counts[k]!;
    const positions = new Float32Array(row.reduce((a, b) => a + b, 0) * 2);
    let o = 0;
    for (const cell of cells)
      for (let i = 0; i < row[cell.index]!; i++) {
        const slot = i * meta.classes + k,
          r = CELL_RADIUS * 0.8 * Math.sqrt((slot + 0.5) / Math.max(perCell[cell.index]!, 8)),
          a = slot * GOLDEN + cell.index;
        positions[o++] = cell.x + r * Math.cos(a);
        positions[o++] = cell.z + r * Math.sin(a);
      }
    crowds.push({ cls: k, color: CLASS_COLORS[k % CLASS_COLORS.length]!, positions });
  }
  return { cells, crowds };
}

/** The cell under a ground point, or null. */
export function cellAt(x: number, z: number, count: number): number | null {
  let best: number | null = null,
    bestD = CELL_RADIUS * 1.25;
  for (let c = 0; c < count; c++) {
    const [cx, cz] = cellCenter(c, count),
      d = Math.hypot(x - cx, z - cz);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
