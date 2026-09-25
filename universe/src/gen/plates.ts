// Tectonics and relief (docs/architecture §24). The crust breaks into plates
// grown from keyed seeds; continents are shaped by noise and each plate's bias;
// every plate turns about its own pole. Where plates meet, their relative motion
// decides the boundary — converging, spreading or sliding — and the boundary
// decides the relief: collision ranges, coastal ranges over trenches, island arcs,
// mid-ocean ridges, rift valleys. Hotspots raise volcanic islands. Sea level is
// set so the oceans cover the prior's share of the surface.
import {
  MinHeap,
  defineStream,
  dmath,
  fbm3,
  hashString,
  type Rng,
  type SphereGrid,
} from "../kernel/index.ts";
import type { Planet } from "./bodies.ts";
import { plateRef } from "./kinds.ts";

const PLATES = defineStream("gen.plates");
const RELIEF = defineStream("gen.relief");

export const BOUNDARY = { none: 0, convergent: 1, divergent: 2, transform: 3 } as const;
export type BoundaryKind = (typeof BOUNDARY)[keyof typeof BOUNDARY];

export type Plate = {
  readonly index: number;
  readonly ref: string;
  readonly seedCell: number;
  /** Mostly continental crust (by area). */
  readonly continental: boolean;
  /** Rotation pole (unit vector) and speed, degrees per million years. */
  readonly pole: readonly [number, number, number];
  readonly speed: number;
  readonly area: number;
};

export type Tectonics = {
  readonly plates: readonly Plate[];
  /** Plate of each cell. */
  readonly plate: Uint8Array;
  /** 1 where the crust is continental. */
  readonly crust: Uint8Array;
  /** Boundary kind of the nearest boundary within reach (BOUNDARY.none beyond it). */
  readonly boundary: Uint8Array;
  /** The plate on the other side of that boundary (-1 none). */
  readonly across: Int16Array;
  /** Steps to that boundary (255 beyond reach). */
  readonly toBoundary: Uint8Array;
  /** Elevation above sea level, metres. */
  readonly elevation: Float32Array;
  /** Cells raised by a hotspot. */
  readonly hotspots: readonly number[];
};

const REACH = 8;

function randomUnit(rng: Rng, subject: number, n: number): [number, number, number] {
  const z = 2 * rng.real(PLATES, subject, 0, 11, n) - 1,
    a = dmath.TAU * rng.real(PLATES, subject, 0, 12, n),
    r = Math.sqrt(1 - z * z);
  return [r * dmath.cos(a), z, r * dmath.sin(a)];
}

function velocity(
  pole: readonly number[],
  speed: number,
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  // ω × p, with ω along the pole.
  return [
    speed * (pole[1]! * z - pole[2]! * y),
    speed * (pole[2]! * x - pole[0]! * z),
    speed * (pole[0]! * y - pole[1]! * x),
  ];
}

export function makeTectonics(grid: SphereGrid, rng: Rng, planet: Planet): Tectonics {
  const n = grid.count,
    P = grid.positions,
    count = Math.max(2, Math.min(40, planet.plateCount));
  const noiseSeed = hashString(`relief ${rng.seed.lo} ${rng.seed.hi}`);

  // Seeds: cells in keyed order, kept only when far enough from the seeds already chosen.
  const seedKey = new Float64Array(n);
  for (let c = 0; c < n; c++) seedKey[c] = rng.u32(PLATES, c, 0, 1);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) =>
    seedKey[a] !== seedKey[b] ? seedKey[a]! - seedKey[b]! : a - b,
  );
  const spacing = dmath.cos(0.55 * Math.sqrt((4 * Math.PI) / count)),
    seeds: number[] = [];
  for (const c of order) {
    if (seeds.length >= count) break;
    const far = seeds.every(
      (s) =>
        P[s * 3]! * P[c * 3]! + P[s * 3 + 1]! * P[c * 3 + 1]! + P[s * 3 + 2]! * P[c * 3 + 2]! <
        spacing,
    );
    if (far) seeds.push(c);
  }

  // Growth: plates spread from their seeds at their own pace over a noisy landscape.
  const plate = new Uint8Array(n).fill(255),
    rate = seeds.map((_, p) => 0.55 + 0.9 * rng.real(PLATES, p, 0, 2)),
    heap = new MinHeap();
  seeds.forEach((s, p) => heap.push(0, s * 64 + p));
  const cost = new Float64Array(n).fill(Infinity);
  seeds.forEach((s) => (cost[s] = 0));
  while (heap.size) {
    const key = heap.peekKey(),
      id = heap.pop(),
      c = Math.floor(id / 64),
      p = id % 64;
    if (plate[c] !== 255) continue;
    plate[c] = p;
    for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++) {
      const m = grid.neighbours[k]!;
      if (plate[m] !== 255) continue;
      // Rough ground bends the plates' edges: without it they meet along straight lines.
      const f = fbm3(noiseSeed ^ 0x51, P[m * 3]!, P[m * 3 + 1]!, P[m * 3 + 2]!, 4, 4),
        roughness = 0.2 + 2.4 * f * f;
      const next = key + roughness / rate[p]!;
      if (next < cost[m]!) {
        cost[m] = next;
        heap.push(next, m * 64 + p);
      }
    }
  }

  // Continents: noise plus each plate's leaning, the top share of the surface by area.
  const bias = seeds.map((_, p) =>
    rng.real(PLATES, p, 0, 3) < 0.45
      ? 0.35 + 0.3 * rng.real(PLATES, p, 0, 4)
      : -0.2 * rng.real(PLATES, p, 0, 5),
  );
  const score = new Float64Array(n);
  for (let c = 0; c < n; c++)
    score[c] =
      fbm3(noiseSeed ^ 0xc0, P[c * 3]!, P[c * 3 + 1]!, P[c * 3 + 2]!, 5, 1.6) + bias[plate[c]!]!;
  const byScore = Array.from({ length: n }, (_, i) => i).sort((a, b) =>
    score[b]! !== score[a]! ? score[b]! - score[a]! : a - b,
  );
  const crust = new Uint8Array(n);
  let area = 0;
  for (const c of byScore) {
    if (area >= planet.continental * 4 * Math.PI) break;
    crust[c] = 1;
    area += grid.areas[c]!;
  }

  // Motion.
  const plates: Plate[] = seeds.map((seedCell, p) => {
    let a = 0,
      cont = 0;
    for (let c = 0; c < n; c++)
      if (plate[c] === p) {
        a += grid.areas[c]!;
        if (crust[c]) cont += grid.areas[c]!;
      }
    return {
      index: p,
      ref: plateRef(0, p),
      seedCell,
      continental: cont > a / 2,
      pole: randomUnit(rng, p, 0),
      speed: 0.3 + 1.7 * rng.real(PLATES, p, 0, 6),
      area: a,
    };
  });

  // Boundaries: the relative motion across each cell's cross-plate edges.
  const boundary = new Uint8Array(n),
    across = new Int16Array(n).fill(-1),
    toBoundary = new Uint8Array(n).fill(255);
  const queue: number[] = [];
  for (let c = 0; c < n; c++) {
    const pc = plates[plate[c]!]!,
      x = P[c * 3]!,
      y = P[c * 3 + 1]!,
      z = P[c * 3 + 2]!;
    let converge = 0,
      edges = 0,
      other = -1;
    for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++) {
      const m = grid.neighbours[k]!;
      if (plate[m] === plate[c]) continue;
      const pm = plates[plate[m]!]!,
        va = velocity(pc.pole, pc.speed, x, y, z),
        vb = velocity(pm.pole, pm.speed, x, y, z);
      let dx = P[m * 3]! - x,
        dy = P[m * 3 + 1]! - y,
        dz = P[m * 3 + 2]! - z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      dx /= len;
      dy /= len;
      dz /= len;
      converge += -((vb[0] - va[0]) * dx + (vb[1] - va[1]) * dy + (vb[2] - va[2]) * dz);
      edges++;
      if (other < 0 || pm.index < other) other = pm.index;
    }
    if (!edges) continue;
    const c0 = converge / edges;
    boundary[c] =
      c0 > 0.25 ? BOUNDARY.convergent : c0 < -0.25 ? BOUNDARY.divergent : BOUNDARY.transform;
    across[c] = other;
    toBoundary[c] = 0;
    queue.push(c);
  }
  // Carry each boundary's kind inward, within its own plate, up to REACH steps.
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head]!;
    if (toBoundary[c]! >= REACH) continue;
    for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++) {
      const m = grid.neighbours[k]!;
      if (plate[m] !== plate[c] || toBoundary[m] !== 255) continue;
      toBoundary[m] = toBoundary[c]! + 1;
      boundary[m] = boundary[c]!;
      across[m] = across[c]!;
      queue.push(m);
    }
  }

  // Relief.
  const raw = new Float64Array(n);
  for (let c = 0; c < n; c++) {
    const x = P[c * 3]!,
      y = P[c * 3 + 1]!,
      z = P[c * 3 + 2]!,
      d = toBoundary[c]!,
      near = d === 255 ? 0 : Math.max(0, 1 - d / REACH),
      texture = fbm3(noiseSeed ^ 0x7e, x, y, z, 5, 6) - 0.5;
    let h = crust[c]
      ? 350 + 900 * (fbm3(noiseSeed ^ 0x3a, x, y, z, 4, 2.5) - 0.5)
      : -4200 + 900 * (fbm3(noiseSeed ^ 0x3b, x, y, z, 3, 2) - 0.5);
    const kind = boundary[c]!,
      other = across[c]!;
    if (kind === BOUNDARY.convergent && other >= 0) {
      const otherContinental = plates[other]!.continental,
        here = crust[c] === 1;
      if (here && otherContinental) h += 5200 * near * near;
      else if (here) h += 3600 * near * near * near;
      else if (otherContinental) h -= d <= 1 ? 3800 : 0;
      else if (plate[c]! < other) h += d <= 2 ? 3400 * near : 0;
      else h -= d <= 1 ? 3400 : 0;
    } else if (kind === BOUNDARY.divergent) {
      if (crust[c]) h -= 900 * near * near;
      else h += 1900 * near * near;
    } else if (kind === BOUNDARY.transform) h += 350 * near * (texture * 2);
    raw[c] = h + 700 * texture;
  }
  // Hotspots.
  const hotspots: number[] = [];
  const hotCount = 3 + rng.index(6, RELIEF, 0, 0, 1);
  for (let i = 0; i < hotCount; i++) hotspots.push(rng.index(n, RELIEF, i, 0, 2));
  for (const h of hotspots) {
    const hx = P[h * 3]!,
      hy = P[h * 3 + 1]!,
      hz = P[h * 3 + 2]!,
      lift = 2500 + 2500 * rng.real(RELIEF, h, 0, 3);
    for (let c = 0; c < n; c++) {
      const dot = P[c * 3]! * hx + P[c * 3 + 1]! * hy + P[c * 3 + 2]! * hz;
      if (dot > 0.9985) raw[c] = raw[c]! + lift * ((dot - 0.9985) / 0.0015);
    }
  }
  // Sea level: the ocean covers the prior's share of the surface.
  const byHeight = Array.from({ length: n }, (_, i) => i).sort((a, b) =>
    raw[a]! !== raw[b]! ? raw[a]! - raw[b]! : a - b,
  );
  let wet = 0,
    sea = raw[byHeight[0]!]!;
  for (const c of byHeight) {
    wet += grid.areas[c]!;
    if (wet >= planet.oceanFraction * 4 * Math.PI) {
      sea = raw[c]!;
      break;
    }
  }
  const elevation = new Float32Array(n);
  for (let c = 0; c < n; c++) elevation[c] = raw[c]! - sea;
  return { plates, plate, crust, boundary, across, toBoundary, elevation, hotspots };
}
