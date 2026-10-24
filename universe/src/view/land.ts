// A land's towns, roads and fields as the land draws them (Phase 25 M150, asked for 2026-10-24:
// "i cant see the cities form and evolve and get that type of detail i got from the og
// causalisis, i mean like the land view"): each town drawn from its fabric as its own streets are
// — its blocks, homes at their levels, buildings, walls and ruins, rising and falling as the years
// go — at LAND_SCALE times its size on the map, so a village is a knot of roofs and a great city
// spreads over the tiles about it, and as tall as the land's relief stands its hills; its fields
// about it, more for more people, on the good dry ground, green in spring and gold at harvest;
// its roads over the land from town to town and out of it, round the water and the steep,
// trodden, then paved, then railed. Pure: what is drawn, in the region's units (kilometres).
import { MinHeap } from "../kernel/index.ts";
import type { LandRoad, LandTown } from "../bridge/index.ts";
import { REGION_RELIEF, type RegionTree } from "./region.ts";
import { sprawlOf, type TownScene } from "./town.ts";
import { townReach } from "../bridge/index.ts";

/** How many times its size a town is drawn on the land's map. */
export const LAND_SCALE = 5;
/** Region units to a town's metre: across, and up (the land's own relief). */
export const LAND_ACROSS = LAND_SCALE / 1000;
export const LAND_UP = REGION_RELIEF / 1000;
/** What lies flat on the ground (under this height, metres) is drawn as a slab set into it. */
export const LAND_FLAT = 1.5;

/** The land's ground as its roads and fields read it. */
export type LandGround = {
  readonly size: number;
  readonly tileKm: number;
  /** Each tile's height (region units: the terrain's). */
  readonly heights: Float32Array;
  /** Each tile's water: 0 land, 1 sea, 2 river, 3 lake. */
  readonly water: Uint8Array;
  /** Each tile's soil (0–255). */
  readonly fertility: Uint8Array;
};

/** Where a tile's middle is (region units: the region is centred on its middle tile). */
export function tileMiddle(g: LandGround, tile: number): { x: number; z: number } {
  const half = ((g.size - 1) * g.tileKm) / 2;
  return {
    x: (tile % g.size) * g.tileKm - half,
    z: Math.floor(tile / g.size) * g.tileKm - half,
  };
}

/** The tile a point of the region falls on (its nearest). */
export function tileOf(g: LandGround, x: number, z: number): number {
  const half = ((g.size - 1) * g.tileKm) / 2,
    i = Math.max(0, Math.min(g.size - 1, Math.round((x + half) / g.tileKm))),
    j = Math.max(0, Math.min(g.size - 1, Math.round((z + half) / g.tileKm)));
  return j * g.size + i;
}

/**
 * The ground's height at a point, on the terrain's own facets: each square of four tiles' middles
 * split corner to corner from its upper right to its lower left, as the mesh is (never below the sea).
 */
export function groundAt(g: LandGround, x: number, z: number): number {
  const half = ((g.size - 1) * g.tileKm) / 2,
    fi = Math.max(0, Math.min(g.size - 1 - 1e-9, (x + half) / g.tileKm)),
    fj = Math.max(0, Math.min(g.size - 1 - 1e-9, (z + half) / g.tileKm)),
    i = Math.floor(fi),
    j = Math.floor(fj),
    u = fi - i,
    v = fj - j,
    h = g.heights,
    a = h[j * g.size + i]!,
    b = h[j * g.size + i + 1]!,
    c = h[(j + 1) * g.size + i]!,
    d = h[(j + 1) * g.size + i + 1]!,
    y = u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  return Math.max(0, y);
}

/** Whether a point of the region is over the sea or a lake (rivers are bridged and built over). */
export function wetAt(g: LandGround, x: number, z: number): boolean {
  const w = g.water[tileOf(g, x, z)]!;
  return w === 1 || w === 3;
}

/** How far a town's drawing reaches from its square, in region units (its sprawl, if it has one). */
export function landReach(scene: TownScene): number {
  const ring = sprawlOf(scene.plan, scene.lots),
    r = ring ? ring.r1 : townReach(scene.lots, scene.plan.lots);
  return r * LAND_ACROSS;
}

/** A field about a town: its middle, its size and turn, and when in the year it is sown (0–1). */
export type LandField = {
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly yaw: number;
  readonly sown: number;
};

/** A whole number's share in [0, 1) (the look's own scatter, not history's). */
function unit(seed: number, i: number, k: number): number {
  let h = (seed ^ Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The most fields drawn about a town; a field's length and breadth, and the hedge between (region units). */
export const MOST_FIELDS = 120;
const FIELD_W = 0.5,
  FIELD_D = 0.34,
  HEDGE = 0.05;

/** Fields already laid on a land, by the square kilometre they fall in. */
export type FieldsLaid = Map<string, { x: number; z: number }[]>;
/** How near the middles of two towns' fields may come (region units: they would overlap). */
const FIELD_APART = 0.42;

/**
 * A town's fields (none where its land does not sow): more for more people, a patchwork laid
 * along its streets' way about its edge, the nearest first — each on dry ground of some soil and
 * not up a hillside, none on another town's ground or fields (`laid`: the fields of the towns laid
 * before it, which this town's are added to).
 */
export function landFields(
  g: LandGround,
  town: LandTown,
  x: number,
  z: number,
  reach: number,
  others: readonly { x: number; z: number; r: number }[] = [],
  laid: FieldsLaid = new Map(),
): LandField[] {
  if (!town.fields || town.population <= 0) return [];
  const n = Math.max(4, Math.min(MOST_FIELDS, Math.round(Math.sqrt(town.population) * 0.9))),
    axis = town.plan?.axis ?? 0,
    seed = town.plan?.seed ?? town.tile,
    ca = Math.cos(axis),
    sa = Math.sin(axis),
    inner = reach + 0.2,
    outer = Math.sqrt((n * FIELD_W * FIELD_D) / Math.PI + inner * inner) * 1.35 + 0.5,
    ri = Math.ceil(outer / FIELD_W),
    rj = Math.ceil(outer / FIELD_D),
    cells: { i: number; j: number; r: number }[] = [];
  for (let i = -ri; i <= ri; i++)
    for (let j = -rj; j <= rj; j++) {
      const r = Math.hypot(i * FIELD_W, j * FIELD_D);
      if (r < inner || r > outer) continue;
      cells.push({ i, j, r: r + unit(seed, i * 977 + j, 5) * 0.35 });
    }
  cells.sort((a, b) => a.r - b.r || a.i - b.i || a.j - b.j);
  const out: LandField[] = [],
    near = (fx: number, fz: number) => {
      const i = Math.floor(fx),
        j = Math.floor(fz);
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++)
          for (const f of laid.get(`${i + di},${j + dj}`) ?? [])
            if (Math.hypot(f.x - fx, f.z - fz) < FIELD_APART) return true;
      return false;
    };
  for (const c of cells) {
    if (out.length >= n) break;
    const u = c.i * FIELD_W,
      v = c.j * FIELD_D,
      fx = x + u * ca + v * sa,
      fz = z - u * sa + v * ca,
      t = tileOf(g, fx, fz);
    if (g.water[t] !== 0 || g.fertility[t]! < 40 || near(fx, fz)) continue;
    if (others.some((o) => Math.hypot(fx - o.x, fz - o.z) < o.r + 0.3)) continue;
    // (Not up a hillside: the ground about it within a field's length of level.)
    const y = groundAt(g, fx, fz),
      steep = [0, 1, 2, 3].some((q) => {
        const b = (q * Math.PI) / 2;
        return Math.abs(groundAt(g, fx + 0.3 * Math.cos(b), fz + 0.3 * Math.sin(b)) - y) > 0.12;
      });
    if (steep) continue;
    out.push({
      x: fx,
      z: fz,
      w: FIELD_W - HEDGE - 0.05 * unit(seed, c.i, c.j),
      d: FIELD_D - HEDGE - 0.04 * unit(seed, c.j, c.i),
      yaw: axis,
      sown: unit(seed, c.i * 31 + c.j, 4) * 0.12,
    });
  }
  for (const f of out) {
    const key = `${Math.floor(f.x)},${Math.floor(f.z)}`,
      list = laid.get(key);
    if (list) list.push({ x: f.x, z: f.z });
    else laid.set(key, [{ x: f.x, z: f.z }]);
  }
  return out;
}

/** What a field shows at a share of the year (0 midwinter): ploughed, green, ripe, stubble. */
export const CROPS = ["ploughed", "green", "ripe", "stubble"] as const;
export function cropAt(f: LandField, year: number): number {
  const s = (((year - f.sown) % 1) + 1) % 1;
  return s < 0.22 ? 0 : s < 0.5 ? 1 : s < 0.68 ? 2 : s < 0.82 ? 3 : 0;
}

/** The trees of a land not standing on its towns and fields (cleared for them). */
export function treesClear(
  g: LandGround,
  trees: readonly RegionTree[],
  clearings: readonly { x: number; z: number; r: number }[],
): RegionTree[] {
  if (!clearings.length) return [...trees];
  return trees.filter((t) => {
    const m = tileMiddle(g, t.tile),
      x = m.x + t.dx * g.tileKm,
      z = m.z + t.dz * g.tileKm,
      half = 0.35 * t.size * g.tileKm;
    return clearings.every((c) => Math.hypot(x - c.x, z - c.z) > c.r + half);
  });
}

/** The nearest dry tile to a tile (itself, if dry): a road's end on the land. */
function dryNear(g: LandGround, tile: number): number {
  if (g.water[tile] === 0 || g.water[tile] === 2) return tile;
  const i0 = tile % g.size,
    j0 = Math.floor(tile / g.size);
  for (let r = 1; r < 12; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = i0 + di,
          j = j0 + dj;
        if (i < 0 || j < 0 || i >= g.size || j >= g.size) continue;
        const t = j * g.size + i;
        if (g.water[t] === 0) return t;
      }
  return tile;
}

/** A road's way over the land between two tiles: round the sea and the lakes, easy on the climbs, bridging rivers where it must. */
export function roadTiles(g: LandGround, from: number, to: number): number[] {
  const a = dryNear(g, from),
    b = dryNear(g, to),
    n = g.size * g.size,
    cost = new Float64Array(n).fill(Infinity),
    came = new Int32Array(n).fill(-1),
    done = new Uint8Array(n),
    open = new MinHeap(),
    bi = b % g.size,
    bj = Math.floor(b / g.size),
    guess = (t: number) => {
      const di = Math.abs((t % g.size) - bi),
        dj = Math.abs(Math.floor(t / g.size) - bj);
      return (Math.max(di, dj) + 0.4142 * Math.min(di, dj)) * g.tileKm;
    };
  cost[a] = 0;
  open.push(guess(a), a);
  while (open.size) {
    const t = open.pop();
    if (t === b) break;
    if (done[t]) continue;
    done[t] = 1;
    const i = t % g.size,
      j = Math.floor(t / g.size);
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di,
          nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= g.size || nj >= g.size) continue;
        const s = nj * g.size + ni,
          w = g.water[s]!;
        if (done[s] || ((w === 1 || w === 3) && s !== b)) continue;
        const run = (di && dj ? Math.SQRT2 : 1) * g.tileKm,
          climb = Math.abs(g.heights[s]! - g.heights[t]!) / run,
          step = run * (1 + 5 * climb) + (w === 2 ? 2 * g.tileKm : 0),
          c = cost[t]! + step;
        if (c < cost[s]!) {
          cost[s] = c;
          came[s] = t;
          open.push(c + guess(s), s);
        }
      }
  }
  if (a !== b && came[b] === -1) return [];
  const path: number[] = [];
  for (let t = b; t !== -1; t = came[t]!) path.push(t);
  return path.reverse();
}

/** A road's line through its tiles' middles, its corners rounded (twice cut). */
export function roadLine(g: LandGround, tiles: readonly number[]): { x: number; z: number }[] {
  let line = tiles.map((t) => tileMiddle(g, t));
  for (let pass = 0; pass < 2 && line.length > 2; pass++) {
    const next = [line[0]!];
    for (let k = 0; k + 1 < line.length; k++) {
      const p = line[k]!,
        q = line[k + 1]!;
      next.push(
        { x: 0.75 * p.x + 0.25 * q.x, z: 0.75 * p.z + 0.25 * q.z },
        { x: 0.25 * p.x + 0.75 * q.x, z: 0.25 * p.z + 0.75 * q.z },
      );
    }
    next.push(line.at(-1)!);
    line = next;
  }
  return line;
}

/** How a road is drawn: trodden, paved, railed (with the road beside it) at a year. */
export function roadLook(road: LandRoad, year: number): "none" | "track" | "paved" | "rails" {
  if (year < road.since) return "none";
  if (road.rails !== null && year >= road.rails) return "rails";
  if (road.paved !== null && year >= road.paved) return "paved";
  return "track";
}

/**
 * A road's line cut where it enters a town's ground (its ends' towns', of `reach` each): it runs
 * to their edges, not through their blocks.
 */
export function roadOutside(
  line: readonly { x: number; z: number }[],
  towns: readonly { x: number; z: number; r: number }[],
): { x: number; z: number }[] {
  return line.filter((p) => towns.every((t) => Math.hypot(p.x - t.x, p.z - t.z) > t.r));
}

/**
 * Pieces of a line laid on the ground, a piece every `step` at most: [x, y, z, length, yaw, pitch]
 * each, its middle `lift` over the ground (lengths and heights in region units).
 */
export function linePieces(
  g: LandGround,
  line: readonly { x: number; z: number }[],
  lift: number,
  step = 0.3,
): number[][] {
  const out: number[][] = [];
  for (let k = 0; k + 1 < line.length; k++) {
    const p = line[k]!,
      q = line[k + 1]!,
      run = Math.hypot(q.x - p.x, q.z - p.z),
      n = Math.max(1, Math.ceil(run / step));
    for (let s = 0; s < n; s++) {
      const x0 = p.x + ((q.x - p.x) * s) / n,
        z0 = p.z + ((q.z - p.z) * s) / n,
        x1 = p.x + ((q.x - p.x) * (s + 1)) / n,
        z1 = p.z + ((q.z - p.z) * (s + 1)) / n,
        y0 = groundAt(g, x0, z0) + lift,
        y1 = groundAt(g, x1, z1) + lift,
        dx = x1 - x0,
        dz = z1 - z0,
        flat = Math.hypot(dx, dz);
      if (flat < 1e-6) continue;
      out.push([
        (x0 + x1) / 2,
        (y0 + y1) / 2,
        (z0 + z1) / 2,
        Math.hypot(flat, y1 - y0) + 0.01,
        Math.atan2(dx, dz),
        Math.atan2(-(y1 - y0), flat),
      ]);
    }
  }
  return out;
}
