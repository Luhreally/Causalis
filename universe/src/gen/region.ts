// Region refinement (docs/architecture §24): a planet cell and its surroundings
// as a map of tiles, made to agree with the planet. Heights, warmth and rain are
// blended from the parent cells and roughened in proportion to the parent relief;
// sea level is the planet's (zero), never a share of the map; a river that crosses
// the region on the planet enters at the edge facing its upstream cell carrying
// that cell's water; deposits lie in their own cell's tiles; each tile gets a
// soil fertility. A pure function of the world, the centre cell and the tile size.
import { MinHeap, defineKind, fbm3, hashString, makeRef, type Ref } from "../kernel/index.ts";
import { classify } from "./climate.ts";
import type { HomeWorld } from "./homeworld.ts";

export const REGION = defineKind("regn", "region", "structural");

export function regionRef(planet: number, center: number): Ref {
  return makeRef(REGION, planet, center);
}

export const WATER = { land: 0, sea: 1, river: 2, lake: 3 } as const;

export type Region = {
  readonly ref: Ref;
  readonly center: number;
  /** Tiles per side, and each tile's side in kilometres. */
  readonly size: number;
  readonly tileKm: number;
  readonly elevation: Float32Array;
  readonly temperature: Float32Array;
  readonly precipitation: Float32Array;
  readonly biome: Uint8Array;
  /** WATER.land / sea / river / lake. */
  readonly water: Uint8Array;
  readonly discharge: Float32Array;
  /** 0 barren … 1 the best soil there is. */
  readonly fertility: Float32Array;
  /** The planet cell nearest each tile. */
  readonly parent: Int32Array;
  readonly deposits: readonly { readonly deposit: number; readonly tile: number }[];
};

const EARTH_RADIUS_KM = 6371;

const BASE_FERTILITY: readonly number[] = [
  0, 0, 0, 0, 0, 0.15, 0.35, 0.1, 0.85, 0.8, 0.6, 0.1, 0.55, 0.6, 0.45, 0.08,
];

// Working space reused from one refinement to the next (every part is reset before
// use, so a region never depends on the one before it): refining is frequent in a
// peopled world, and fresh megabytes each time keep the collector busy.
type Scratch = {
  n: number;
  blendCell: Int32Array;
  blendWeight: Float64Array;
  base: Float64Array;
  detail: Float64Array;
  seaTemperature: Float64Array;
  rainfall: Float64Array;
  flowTo: Int32Array;
  done: Uint8Array;
};
let scratch: Scratch | null = null;
function scratchFor(n: number, width: number): Scratch {
  if (!scratch || scratch.n !== n)
    scratch = {
      n,
      blendCell: new Int32Array(n * width),
      blendWeight: new Float64Array(n * width),
      base: new Float64Array(n),
      detail: new Float64Array(n),
      seaTemperature: new Float64Array(n),
      rainfall: new Float64Array(n),
      flowTo: new Int32Array(n),
      done: new Uint8Array(n),
    };
  scratch.blendCell.fill(-1);
  scratch.blendWeight.fill(0);
  scratch.base.fill(0);
  scratch.detail.fill(0);
  scratch.seaTemperature.fill(0);
  scratch.rainfall.fill(0);
  scratch.flowTo.fill(-1);
  scratch.done.fill(0);
  return scratch;
}

export function refineRegion(w: HomeWorld, center: number, size = 128, tileKm = 0.8): Region {
  const g = w.grid,
    n = size * size,
    R = EARTH_RADIUS_KM * w.planet.radius,
    P = g.positions;
  const ox = P[center * 3]!,
    oy = P[center * 3 + 1]!,
    oz = P[center * 3 + 2]!;
  // Tangent frame: east = y-axis × p, north = p × east.
  let ex = oz,
    ez = -ox;
  const el = Math.sqrt(ex * ex + ez * ez) || 1;
  ex /= el;
  ez /= el;
  const nx = oy * ez,
    ny = oz * ex - ox * ez,
    nz = -oy * ex;
  const spacing = 1.15 * Math.sqrt((4 * Math.PI) / g.count),
    noiseSeed = hashString(`region ${w.ground}`);

  const elevation = new Float32Array(n),
    temperature = new Float32Array(n),
    precipitation = new Float32Array(n),
    parent = new Int32Array(n);
  // Each tile's blend: up to seven parent cells and their weights.
  const MAXW = 7,
    { blendCell, blendWeight, base, detail, seaTemperature, rainfall, flowTo, done } = scratchFor(
      n,
      MAXW,
    );
  let near = center;
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const t = j * size + i,
        x = (i - (size - 1) / 2) * tileKm,
        y = ((size - 1) / 2 - j) * tileKm;
      let px = ox + (x / R) * ex + (y / R) * nx,
        py = oy + (y / R) * ny,
        pz = oz + (x / R) * ez + (y / R) * nz;
      const pl = Math.sqrt(px * px + py * py + pz * pz);
      px /= pl;
      py /= pl;
      pz /= pl;
      // Walk to the nearest cell from the last one found.
      for (;;) {
        let best = near,
          bestDot = P[near * 3]! * px + P[near * 3 + 1]! * py + P[near * 3 + 2]! * pz;
        for (let k = g.offsets[near]!; k < g.offsets[near + 1]!; k++) {
          const m = g.neighbours[k]!,
            d = P[m * 3]! * px + P[m * 3 + 1]! * py + P[m * 3 + 2]! * pz;
          if (d > bestDot) {
            bestDot = d;
            best = m;
          }
        }
        if (best === near) break;
        near = best;
      }
      parent[t] = near;
      // Blend the nearest cell with its neighbours: each neighbour's weight falls to
      // nothing at the nearest cell's centre (by that pair's own spacing), so every
      // cell's tiles keep the cell's own height, and the blend only smooths the
      // borders between cells.
      let wsum = 0,
        e = 0,
        tSea = 0,
        rain = 0,
        lo = Infinity,
        hi = -Infinity;
      const nearX = P[near * 3]!,
        nearY = P[near * 3 + 1]!,
        nearZ = P[near * 3 + 2]!;
      let slot = 0;
      const add = (c: number, wgt: number) => {
        const ce = w.tectonics.elevation[c]!,
          dry = Math.max(0, ce);
        lo = Math.min(lo, dry);
        hi = Math.max(hi, dry);
        if (wgt <= 0) return;
        blendCell[t * MAXW + slot] = c;
        blendWeight[t * MAXW + slot] = wgt;
        slot++;
        wsum += wgt;
        e += wgt * ce;
        tSea += wgt * (w.climate.temperature[c]! + (6.5 * dry) / 1000);
        rain += wgt * w.climate.precipitation[c]!;
      };
      const dist = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) =>
        Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by) + (az - bz) * (az - bz));
      const dNear = dist(nearX, nearY, nearZ, px, py, pz);
      add(near, 1);
      for (let k = g.offsets[near]!; k < g.offsets[near + 1]!; k++) {
        const m = g.neighbours[k]!,
          mx = P[m * 3]!,
          my = P[m * 3 + 1]!,
          mz = P[m * 3 + 2]!,
          pair = dist(mx, my, mz, nearX, nearY, nearZ),
          // 0 at the nearest cell's centre, equal to its weight on the border between them.
          f = Math.max(0, 1 - (2 * (dist(mx, my, mz, px, py, pz) - dNear)) / pair);
        add(m, f * f);
      }
      e /= wsum;
      tSea /= wsum;
      rain /= wsum;
      // Local relief in proportion to the parents' own relief above the sea.
      const amp = Math.min(1400, 40 + 0.3 * (hi - lo));
      base[t] = e;
      detail[t] = (fbm3(noiseSeed, px * (R / 9), py * (R / 9), pz * (R / 9), 5, 1) - 0.5) * 2 * amp;
      seaTemperature[t] = tSea;
      rainfall[t] =
        rain *
        (0.85 + 0.3 * fbm3(noiseSeed ^ 0x9e, px * (R / 20), py * (R / 20), pz * (R / 20), 3, 1));
    }

  // The parent constrains its children: each cell's tiles must average the cell's
  // own height. Each pass measures every cell's shortfall and spreads it back over
  // the tiles with the same blend weights (so no step appears at a cell's border).
  for (let pass = 0; pass < 4; pass++) {
    const sum = new Map<number, number>(),
      count = new Map<number, number>();
    for (let t = 0; t < n; t++) {
      const c = parent[t]!;
      sum.set(c, (sum.get(c) ?? 0) + base[t]!);
      count.set(c, (count.get(c) ?? 0) + 1);
    }
    const offset = new Map<number, number>();
    for (const [c, total] of sum) offset.set(c, w.tectonics.elevation[c]! - total / count.get(c)!);
    for (let t = 0; t < n; t++) {
      let num = 0,
        den = 0;
      for (let k = 0; k < MAXW; k++) {
        const c = blendCell[t * MAXW + k]!;
        if (c < 0) break;
        const wgt = blendWeight[t * MAXW + k]!;
        num += wgt * (offset.get(c) ?? 0);
        den += wgt;
      }
      base[t] = base[t]! + num / den;
    }
  }
  for (let t = 0; t < n; t++) {
    const h = base[t]! + detail[t]!;
    elevation[t] = h;
    temperature[t] = seaTemperature[t]! - (6.5 * Math.max(0, h)) / 1000;
    precipitation[t] = Math.max(0, rainfall[t]!);
  }

  // Water: the sea, then a priority flood from the sea and the map's edges.
  const water = new Uint8Array(n),
    discharge = new Float32Array(n),
    filled = Float32Array.from(elevation),
    order: number[] = [],
    heap = new MinHeap();
  for (let t = 0; t < n; t++) {
    if (elevation[t]! <= 0) {
      water[t] = WATER.sea;
      done[t] = 1;
    }
  }
  const neighbours = (t: number, visit: (m: number) => void) => {
    const i = t % size,
      j = Math.floor(t / size);
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = i + di,
          b = j + dj;
        if (a >= 0 && b >= 0 && a < size && b < size) visit(b * size + a);
      }
  };
  for (let t = 0; t < n; t++) {
    if (done[t]) continue;
    const i = t % size,
      j = Math.floor(t / size);
    let outlet = i === 0 || j === 0 || i === size - 1 || j === size - 1;
    neighbours(t, (m) => {
      if (water[m] === WATER.sea) outlet = true;
    });
    if (outlet) heap.push(elevation[t]!, t);
  }
  while (heap.size) {
    const t = heap.pop();
    if (done[t]) continue;
    done[t] = 1;
    order.push(t);
    neighbours(t, (m) => {
      if (done[m] || water[m] === WATER.sea) return;
      const level = Math.max(elevation[m]!, filled[t]!);
      if (flowTo[m]! < 0 || level < filled[m]!) {
        flowTo[m] = t;
        filled[m] = level;
        heap.push(level, m);
      }
    });
  }
  const tileArea = tileKm * tileKm;
  for (let t = 0; t < n; t++) discharge[t] = precipitation[t]! * tileArea;
  // Rivers from beyond: planet cells outside the map that drain into it.
  const inside = new Set<number>(parent),
    edgeTiles: number[] = [];
  for (let t = 0; t < n; t++) {
    const i = t % size,
      j = Math.floor(t / size);
    if ((i === 0 || j === 0 || i === size - 1 || j === size - 1) && water[t] !== WATER.sea)
      edgeTiles.push(t);
  }
  for (const cell of inside)
    for (let k = g.offsets[cell]!; k < g.offsets[cell + 1]!; k++) {
      const u = g.neighbours[k]!;
      if (inside.has(u) || w.water.flowTo[u] !== cell || !w.water.river[u]) continue;
      // Enter at the edge tile facing u.
      let best = -1,
        bestDot = -Infinity;
      const ux = P[u * 3]! - ox,
        uy = P[u * 3 + 1]! - oy,
        uz = P[u * 3 + 2]! - oz,
        ue = ux * ex + uz * ez,
        un = ux * nx + uy * ny + uz * nz;
      for (const t of edgeTiles) {
        const i = t % size,
          j = Math.floor(t / size),
          d = (i - (size - 1) / 2) * ue + ((size - 1) / 2 - j) * un;
        if (d > bestDot) {
          bestDot = d;
          best = t;
        }
      }
      // The planet counts water as mm × steradians × 1000; the map as mm × km².
      if (best >= 0) discharge[best] = discharge[best]! + (w.water.discharge[u]! * R * R) / 1e3;
    }
  for (let k = order.length - 1; k >= 0; k--) {
    const t = order[k]!,
      down = flowTo[t]!;
    if (down >= 0) discharge[down] = discharge[down]! + discharge[t]!;
  }
  // A river where the flow gathers a few hundred square kilometres' rain — and, on a map
  // of large tiles, the rain of many tiles, not just its own.
  const riverFlow = Math.max(350, 30 * tileKm * tileKm) * 1000 * 0.6;
  // A hollow holds a lake only where a real flow fills it and it is deep enough to
  // outlast the erosion that drains small dips.
  for (const t of order) {
    if (filled[t]! - elevation[t]! > 12 && discharge[t]! > riverFlow * 0.3) water[t] = WATER.lake;
    else if (discharge[t]! > riverFlow) water[t] = WATER.river;
  }

  const biome = new Uint8Array(n),
    fertility = new Float32Array(n);
  for (let t = 0; t < n; t++) {
    biome[t] = classify(elevation[t]!, temperature[t]!, precipitation[t]!);
    if (water[t] !== WATER.land) continue;
    let slope = 0;
    neighbours(t, (m) => (slope = Math.max(slope, Math.abs(elevation[m]! - elevation[t]!))));
    let riverside = false;
    neighbours(t, (m) => {
      if (water[m] === WATER.river || water[m] === WATER.lake) riverside = true;
    });
    const base = BASE_FERTILITY[biome[t]!] ?? 0,
      flat = Math.max(0, 1 - slope / (tileKm * 250)),
      flood = riverside && temperature[t]! > 4 ? 0.35 : 0;
    fertility[t] = Math.min(1, (base + flood) * (0.35 + 0.65 * flat));
  }
  // Deposits in their own cell's tiles, at the tile nearest the cell's centre.
  const deposits: { deposit: number; tile: number }[] = [];
  for (const d of w.deposits) {
    if (!inside.has(d.cell)) continue;
    let best = -1,
      bestDot = -Infinity;
    for (let t = 0; t < n; t++) {
      if (parent[t] !== d.cell) continue;
      const i = t % size,
        j = Math.floor(t / size),
        x = (i - (size - 1) / 2) * tileKm,
        y = ((size - 1) / 2 - j) * tileKm;
      const px = ox + (x / R) * ex + (y / R) * nx,
        py = oy + (y / R) * ny,
        pz = oz + (x / R) * ez + (y / R) * nz;
      const dot =
        (px * P[d.cell * 3]! + py * P[d.cell * 3 + 1]! + pz * P[d.cell * 3 + 2]!) /
        Math.sqrt(px * px + py * py + pz * pz);
      if (dot > bestDot) {
        bestDot = dot;
        best = t;
      }
    }
    if (best >= 0) deposits.push({ deposit: d.index, tile: best });
  }
  return {
    ref: regionRef(0, center),
    center,
    size,
    tileKm,
    elevation,
    temperature,
    precipitation,
    biome,
    water,
    discharge,
    fertility,
    parent,
    deposits,
  };
}
