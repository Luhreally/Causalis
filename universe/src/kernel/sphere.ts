// The geodesic sphere grid (docs/architecture §4, §24): an icosahedron with each
// face subdivided `frequency` times, projected onto the unit sphere. Its 10f² + 2
// vertices are the cells of a planet's surface — even in size, no poles to pinch,
// one index for climate, ecology and provinces. A grid depends only on its
// frequency, so it is built once per frequency and shared.
//
// Built from exact operations only (and dmath for latitude and longitude), so
// every engine produces the same bits.
import { asin, atan2 } from "./dmath.ts";

const PHI = (1 + Math.sqrt(5)) / 2;

const ICOSA_VERTICES: readonly (readonly [number, number, number])[] = [
  [-1, PHI, 0],
  [1, PHI, 0],
  [-1, -PHI, 0],
  [1, -PHI, 0],
  [0, -1, PHI],
  [0, 1, PHI],
  [0, -1, -PHI],
  [0, 1, -PHI],
  [PHI, 0, -1],
  [PHI, 0, 1],
  [-PHI, 0, -1],
  [-PHI, 0, 1],
];

const ICOSA_FACES: readonly (readonly [number, number, number])[] = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1],
];

export type SphereGrid = {
  readonly frequency: number;
  readonly count: number;
  /** Unit positions, x y z per cell (y is up: latitude is asin(y)). */
  readonly positions: Float64Array;
  /** Neighbours in CSR form: cell i's are neighbours[offsets[i] .. offsets[i+1]), ascending. */
  readonly offsets: Int32Array;
  readonly neighbours: Int32Array;
  /** Triangles, three cell indices each, wound outward. */
  readonly triangles: Uint32Array;
  /** Each cell's share of the sphere's area (they sum to 4π). */
  readonly areas: Float64Array;
  /** Latitude and longitude in radians. */
  readonly lat: Float64Array;
  readonly lon: Float64Array;
};

const GRIDS = new Map<number, SphereGrid>();

function normalize(x: number, y: number, z: number): [number, number, number] {
  const l = Math.sqrt(x * x + y * y + z * z);
  return [x / l, y / l, z / l];
}

/** The grid of a frequency (1 = the icosahedron, 64 = 40,962 cells). */
export function sphereGrid(frequency: number): SphereGrid {
  if (!Number.isInteger(frequency) || frequency < 1 || frequency > 512)
    throw new Error(`grid frequency ${frequency}`);
  const cached = GRIDS.get(frequency);
  if (cached) return cached;
  const f = frequency,
    corners = ICOSA_VERTICES.map(([x, y, z]) => normalize(x, y, z));
  const index = new Map<string, number>(),
    pos: number[] = [],
    tris: number[] = [];
  const vertex = (key: string, make: () => [number, number, number]): number => {
    let id = index.get(key);
    if (id === undefined) {
      id = pos.length / 3;
      index.set(key, id);
      pos.push(...make());
    }
    return id;
  };
  const edgeKey = (u: number, v: number, t: number) =>
    u < v ? `e${u}_${v}_${t}` : `e${v}_${u}_${f - t}`;
  for (let fi = 0; fi < ICOSA_FACES.length; fi++) {
    let [a, b, c] = ICOSA_FACES[fi]!;
    // Wind every face outward: (B − A) × (C − A) must point away from the centre.
    const A0 = corners[a]!,
      B0 = corners[b]!,
      C0 = corners[c]!;
    const nx = (B0[1] - A0[1]) * (C0[2] - A0[2]) - (B0[2] - A0[2]) * (C0[1] - A0[1]),
      ny = (B0[2] - A0[2]) * (C0[0] - A0[0]) - (B0[0] - A0[0]) * (C0[2] - A0[2]),
      nz = (B0[0] - A0[0]) * (C0[1] - A0[1]) - (B0[1] - A0[1]) * (C0[0] - A0[0]);
    if (nx * A0[0] + ny * A0[1] + nz * A0[2] < 0) [b, c] = [c, b];
    const A = corners[a]!,
      B = corners[b]!,
      C = corners[c]!;
    const id = (i: number, j: number): number => {
      const key =
        i === 0 && j === 0
          ? `c${a}`
          : i === f
            ? `c${b}`
            : j === f
              ? `c${c}`
              : j === 0
                ? edgeKey(a, b, i)
                : i === 0
                  ? edgeKey(a, c, j)
                  : i + j === f
                    ? edgeKey(b, c, j)
                    : `f${fi}_${i}_${j}`;
      return vertex(key, () => {
        const wa = (f - i - j) / f,
          wb = i / f,
          wc = j / f;
        return normalize(
          wa * A[0] + wb * B[0] + wc * C[0],
          wa * A[1] + wb * B[1] + wc * C[1],
          wa * A[2] + wb * B[2] + wc * C[2],
        );
      });
    };
    for (let i = 0; i < f; i++)
      for (let j = 0; j < f - i; j++) {
        tris.push(id(i, j), id(i + 1, j), id(i, j + 1));
        if (i + j < f - 1) tris.push(id(i + 1, j), id(i + 1, j + 1), id(i, j + 1));
      }
  }
  const count = pos.length / 3,
    positions = new Float64Array(pos),
    triangles = new Uint32Array(tris);
  const sets: number[][] = Array.from({ length: count }, () => []);
  const areas = new Float64Array(count);
  let total = 0;
  for (let t = 0; t < triangles.length; t += 3) {
    const v = [triangles[t]!, triangles[t + 1]!, triangles[t + 2]!];
    for (let k = 0; k < 3; k++) {
      const p = v[k]!,
        q = v[(k + 1) % 3]!;
      if (!sets[p]!.includes(q)) sets[p]!.push(q);
      if (!sets[q]!.includes(p)) sets[q]!.push(p);
    }
    const [p0, p1, p2] = v.map((i) => [
      positions[i * 3]!,
      positions[i * 3 + 1]!,
      positions[i * 3 + 2]!,
    ]) as [number[], number[], number[]];
    const ux = p1[0]! - p0[0]!,
      uy = p1[1]! - p0[1]!,
      uz = p1[2]! - p0[2]!,
      wx = p2[0]! - p0[0]!,
      wy = p2[1]! - p0[1]!,
      wz = p2[2]! - p0[2]!;
    const cx = uy * wz - uz * wy,
      cy = uz * wx - ux * wz,
      cz = ux * wy - uy * wx,
      area = Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
    total += area;
    for (const i of v) areas[i] = areas[i]! + area / 3;
  }
  const scaleArea = (4 * Math.PI) / total;
  for (let i = 0; i < count; i++) areas[i] = areas[i]! * scaleArea;
  const offsets = new Int32Array(count + 1);
  for (let i = 0; i < count; i++) offsets[i + 1] = offsets[i]! + sets[i]!.length;
  const neighbours = new Int32Array(offsets[count]!);
  for (let i = 0; i < count; i++) {
    const sorted = sets[i]!.sort((x, y) => x - y);
    neighbours.set(sorted, offsets[i]!);
  }
  const lat = new Float64Array(count),
    lon = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3]!,
      y = positions[i * 3 + 1]!,
      z = positions[i * 3 + 2]!;
    lat[i] = asin(Math.max(-1, Math.min(1, y)));
    lon[i] = atan2(x, z);
  }
  const grid: SphereGrid = {
    frequency,
    count,
    positions,
    offsets,
    neighbours,
    triangles,
    areas,
    lat,
    lon,
  };
  GRIDS.set(frequency, grid);
  return grid;
}

/** The cell whose centre is nearest a direction (need not be unit length). */
export function nearestCell(grid: SphereGrid, x: number, y: number, z: number): number {
  let best = 0,
    bestDot = -Infinity;
  const p = grid.positions;
  for (let i = 0; i < grid.count; i++) {
    const d = p[i * 3]! * x + p[i * 3 + 1]! * y + p[i * 3 + 2]! * z;
    if (d > bestDot) {
      bestDot = d;
      best = i;
    }
  }
  return best;
}

/** Visit a cell's neighbours. */
export function forNeighbours(grid: SphereGrid, cell: number, visit: (n: number) => void): void {
  for (let k = grid.offsets[cell]!; k < grid.offsets[cell + 1]!; k++) visit(grid.neighbours[k]!);
}
