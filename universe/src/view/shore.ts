// Where a town's water meets its land, as its land's view draws it (render/stage.ts groundMaterial): the share of water read off
// the land's tiles, blended between the four about each point, wavered by the land's own grain, its shore where that passes a
// half. The town's view drew its water share by share of its land's map's facets (bridge/claims.ts wetShares), straight-sided,
// where its land's view, a step out, drew the same water with a shore that curves: the two now draw one shore. What the town
// has laid on its ground (its lots, yards and streets, its sprawl, its walls, its fields, pasture and countryside, its road)
// was laid off the facets' water (bridge/sites.ts wetGround), and stays where it was laid: where the curving shore would come
// over any of it, the shore keeps off it. Its own round of open water, where its boats go about, is water as ever.
import {
  BLOCK_D,
  BLOCK_W,
  LAND_SCALE,
  holdPlaces,
  wallAt,
  waterR,
  wallWet,
  wetGround,
  type VillagePlan,
} from "../bridge/index.ts";
import type { Country } from "./country.ts";
import type { TownParts, TownScene } from "./town.ts";
import { GRAIN_SIZE, grainData } from "./grain.ts";

/** A town's land's water about it (bridge/sites.ts TownSite's `wet` and `bank`). */
type Wet = {
  readonly wet?: { readonly m: number; readonly half: number; readonly cells: string };
  readonly bank?: { readonly x: number; readonly z: number };
};

/** A land's unit to a town's metre (view/land.ts LAND_ACROSS). */
const ACROSS = LAND_SCALE / 1000;

/** The grain's blue field at a point of it (texels; the screen's own filtering: linear, tiling), 0 ... 1. */
function grainAt(u: number, v: number): number {
  const d = grainData(),
    n = GRAIN_SIZE,
    x0 = Math.floor(u),
    y0 = Math.floor(v),
    fx = u - x0,
    fy = v - y0,
    i0 = ((x0 % n) + n) % n,
    j0 = ((y0 % n) + n) % n,
    i1 = (i0 + 1) % n,
    j1 = (j0 + 1) % n,
    t = (i: number, j: number) => d[4 * (j * n + i) + 2]!;
  return (
    ((t(i0, j0) * (1 - fx) + t(i1, j0) * fx) * (1 - fy) +
      (t(i0, j1) * (1 - fx) + t(i1, j1) * fx) * fy) /
    255
  );
}

/**
 * How far into its water a point of the land reads (0.5 its shore; land units, its x and z), off its tiles' water at the four
 * corners of the square it lies in (`corners`, each 0 or 1, by the weights `u`, `v` across it) and its grain, as the ground's
 * shader reads it (render/stage.ts GROUND_PS: `water.a + 0.17 * a.b + 0.08 * b.b`).
 */
export function shoreRead(
  c00: number,
  c10: number,
  c01: number,
  c11: number,
  u: number,
  v: number,
  px: number,
  pz: number,
): number {
  const n = GRAIN_SIZE,
    a = grainAt(px * 0.031 * n - 0.5, pz * 0.031 * n - 0.5) - 0.5,
    qx = (0.8 * px + 0.6 * pz) * 0.13 + 0.37,
    qz = (-0.6 * px + 0.8 * pz) * 0.13 + 0.61,
    b = grainAt(qx * n - 0.5, qz * n - 0.5) - 0.5;
  return (c00 * (1 - u) + c10 * u) * (1 - v) + (c01 * (1 - u) + c11 * u) * v + 0.17 * a + 0.08 * b;
}

/** A town's shore (shoreOf). */
export type Shore = {
  /** How far into the water a point of the town's ground reads (metres from its square): 0.5 its shore. */
  readonly s: (x: number, z: number) => number;
  /** Whether the land's view draws a point of the town's ground as water. */
  readonly wet: (x: number, z: number) => boolean;
  /** The tiles' share of water alone at a point (its grain aside): the look tools hold it to the land's own textures. */
  readonly tiles: (x: number, z: number) => number;
  /** The squares of its land's tiles about it: their side (metres), how many each way from its own, its square off its tile's middle. */
  readonly m: number;
  readonly half: number;
  readonly bx: number;
  readonly bz: number;
  readonly cells: string;
  /** Where its square stands on its land (land units), or as if at its land's middle where that is not known. */
  readonly lx: number;
  readonly lz: number;
};

const KNOWN = new WeakMap<object, Shore>();

/**
 * A town's shore (null where its land has no water near it): `site` its land's water about it (VillagePlan.landWater), `land`
 * where its square stands on its land (land units: render/land.ts townAt; VillagePlan.landAt), the grain read there. Without
 * it the shore curves as much, but where it would meet its land's view's is not known.
 */
export function shoreOf(
  site: Wet | null | undefined,
  land?: { x: number; z: number } | null,
): Shore | null {
  const w = site?.wet;
  if (!w) return null;
  const known = land ? undefined : KNOWN.get(site);
  if (known) return known;
  const m = w.m,
    half = w.half,
    n = 2 * half,
    bx = site.bank?.x ?? 0,
    bz = site.bank?.z ?? 0,
    lx = land?.x ?? 0,
    lz = land?.z ?? 0,
    cells = w.cells;
  const s = (x: number, z: number): number => {
    const fx = (x + bx) / m + half,
      fz = (z + bz) / m + half,
      i = Math.floor(fx),
      j = Math.floor(fz);
    const bits = i < 0 || j < 0 || i >= n || j >= n ? 0 : cells.charCodeAt(j * n + i) - 48;
    return shoreRead(
      bits & 1,
      (bits >> 1) & 1,
      (bits >> 2) & 1,
      (bits >> 3) & 1,
      fx - i,
      fz - j,
      lx + x * ACROSS,
      lz + z * ACROSS,
    );
  };
  const tiles = (x: number, z: number): number => {
    const fx = (x + bx) / m + half,
      fz = (z + bz) / m + half,
      i = Math.floor(fx),
      j = Math.floor(fz),
      bits = i < 0 || j < 0 || i >= n || j >= n ? 0 : cells.charCodeAt(j * n + i) - 48,
      u = fx - i,
      v = fz - j;
    return (
      ((bits & 1) * (1 - u) + ((bits >> 1) & 1) * u) * (1 - v) +
      (((bits >> 2) & 1) * (1 - u) + ((bits >> 3) & 1) * u) * v
    );
  };
  const shore: Shore = { s, wet: (x, z) => s(x, z) > 0.5, tiles, m, half, bx, bz, cells, lx, lz };
  if (!land) KNOWN.set(site, shore);
  return shore;
}

/** A village's shore (shoreOf), where its land's view has it (VillagePlan.landAt), kept with its plan. */
const PLANS = new WeakMap<object, Shore | null>();
export function villageShore(plan: Pick<VillagePlan, "landWater" | "landAt">): Shore | null {
  let s = PLANS.get(plan);
  if (s === undefined) PLANS.set(plan, (s = shoreOf(plan.landWater, plan.landAt)));
  return s;
}

/**
 * Whether a point of a village's ground (metres from its square) is water for what its own view lays there (its trees, its
 * barns and farmhouses, its beasts): water by its land's map's facets (what its plan was laid off), by the shore its land's
 * view draws (and a little short of it: SHORE_CLEAR), or its own round of open water. Nothing laid by its view stands on any.
 */
/** Whether what a village's view lays keeps off its land view's shore as well as its map's facets (the look tools turn it off, to time it). */
export const shoreLaying = { on: true };

export function wetForLaying(
  plan: Pick<VillagePlan, "landWater" | "landAt" | "water">,
  x: number,
  z: number,
): boolean {
  if (wetGround(plan.landWater, x, z)) return true;
  if (!shoreLaying.on) return false;
  const w = plan.water;
  if (w && Math.hypot(x - w.x, z - w.z) < waterR(w) + 2) return true;
  const s = villageShore(plan);
  return !!s && s.s(x, z) > 0.5 - SHORE_CLEAR;
}

/** How far short of its shore (of the read: some 5 m) a village's view lays nothing. */
const SHORE_CLEAR = 0.01;

/**
 * Whether a point of a village's ground is water as its view draws it, a little within (what floats keeps to it: its boats
 * and their jetty's berths): its own round of open water, or past its land view's shore. Null where it draws its water
 * off no land view (its round alone).
 */
export function drawnWater(
  plan: Pick<VillagePlan, "landWater" | "landAt" | "water">,
  x: number,
  z: number,
): boolean | null {
  const s = villageShore(plan),
    w = plan.water;
  if (!s) return null;
  return (!!w && Math.hypot(x - w.x, z - w.z) < waterR(w)) || s.s(x, z) > 0.5 + SHORE_CLEAR;
}

/**
 * What stands on a town's ground (metres from its square), which its water keeps off: rectangles (x, z, w, d, yaw: the
 * yaw turning its x side about the up, as render/stage.ts boxes are turned), rounds (x, z, r) and strips (x0, z0, x1, z1,
 * half its breadth).
 */
export type Laid = { rects: number[]; rounds: number[]; strips: number[] };

export function laidGround(): Laid {
  return { rects: [], rounds: [], strips: [] };
}

/**
 * What a town has laid on its ground, into `laid`: each of its blocks, drawn or not (its lots past those drawn stand on them),
 * its ground's parts (`ground`: view/town.ts townGround — yards, streets, its square, its sprawl's ground and roofs, its ways),
 * what of its homes', civics' and walls' parts as drawn comes down to the ground (`standing`), its strongholds' ground and its
 * walls' line where they could stand.
 */
export function layTown(
  laid: Laid,
  scene: TownScene,
  ground: TownParts,
  standing: readonly TownParts[],
): void {
  const b = scene.lots.blocks;
  for (let k = 0; k < b.x.length; k++)
    laid.rects.push(b.x[k]!, b.z[k]!, BLOCK_W, BLOCK_D, b.yaw[k]!);
  const put = (parts: TownParts, low: boolean) => {
    for (const [, g] of parts.groups) {
      if (g.lamp) continue;
      const d = g.data;
      for (let i = 0; i + 6 < d.length; i += 7)
        if (!low || d[i + 1]! - d[i + 4]! / 2 < 1.5)
          laid.rects.push(d[i]!, d[i + 2]!, d[i + 3]!, d[i + 5]!, d[i + 6]!);
    }
  };
  // (All its ground's; of the rest, what comes down to the ground.)
  put(ground, false);
  for (const parts of standing) put(parts, true);
  for (const p of holdPlaces(scene.plan, scene.lots)) laid.rounds.push(p.x, p.z, p.r);
  // (Its walls' line, and the ring street where they stood, where they could stand: never over the water: bridge/town.ts wallWet.)
  if (scene.walls) {
    const n = 96,
      wet = wallWet(scene.plan.water, scene.plan.site ?? null);
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * 2 * Math.PI,
        a1 = ((k + 1) / n) * 2 * Math.PI,
        r0 = wallAt(scene.walls.line, a0),
        r1 = wallAt(scene.walls.line, a1),
        x0 = r0 * Math.cos(a0),
        z0 = r0 * Math.sin(a0),
        x1 = r1 * Math.cos(a1),
        z1 = r1 * Math.sin(a1);
      if (wet && (wet(x0, z0) || wet(x1, z1) || wet((x0 + x1) / 2, (z0 + z1) / 2))) continue;
      laid.strips.push(x0, z0, x1, z1, 4);
    }
  }
}

/**
 * What a village's countryside has laid on its ground, into `laid`: its plan's fields and pasture and its road out, and (its
 * country: view/country.ts countryOf) the bounds, rows, barns, farmhouses, silos, mills, ricks, scarecrows and trees, the
 * pasture's fence and fold. Its jetty and boats are on the water.
 */
export function layCountry(laid: Laid, plan: VillagePlan, c: Country | null): void {
  for (const f of plan.fields) laid.rects.push(f.x, f.z, f.w, f.d, f.yaw);
  laid.rounds.push(plan.pasture.x, plan.pasture.z, plan.pasture.r);
  const through = !!plan.districts;
  if (plan.road.x || plan.road.z)
    laid.strips.push(
      through ? -plan.road.x : 0,
      through ? -plan.road.z : 0,
      plan.road.x,
      plan.road.z,
      8,
    );
  if (!c) return;
  const pieces = (
    list: readonly { x: number; z: number; sx: number; sz: number; yaw: number }[],
  ) => {
    for (const p of list) laid.rects.push(p.x, p.z, p.sx, p.sz, p.yaw);
  };
  pieces(c.bounds);
  pieces(c.posts);
  pieces(c.rows);
  pieces(c.pen.rails);
  pieces(c.pen.posts);
  if (c.pen.fold) pieces(c.pen.fold.hurdles);
  for (const b of [...c.barns, ...c.farmhouses]) laid.rects.push(b.x, b.z, b.w, b.d, b.yaw);
  for (const o of c.silos) laid.rounds.push(o.x, o.z, o.r);
  for (const o of [...c.hay, ...c.scarecrows, ...c.mills]) laid.rounds.push(o.x, o.z, 3);
  for (const o of c.trees) laid.rounds.push(o.x, o.z, Math.max(1, o.size));
}

/** The leaf of the shore's squares (metres at most): the curve is drawn by steps no longer. */
const LEAF = 8;
/** How far past its shore the read runs under its line of foam, and short of it under its wet sand (render/stage.ts GROUND_PS FOAM, SAND). */
export const FOAM = 0.025,
  SAND = 0.07;
/** How far (metres) its water keeps from what stands on its ground, past that ground's own edge. */
const KEEP = 1.5;
/**
 * The most the grain can change the read over a metre of the town's ground (its two fields, 0.17 and 0.08 of it, tiling
 * 0.031 and 0.13 times a land's unit, a land's unit 1 / ACROSS metres; its blue field steps 0.19 at most from a texel to the next).
 */
const GRAIN_STEEP = 0.003;

/** A town's water as drawn (shoreWater). */
export type ShoreWater = {
  /** Its triangles (x, z, three a triangle, metres from the square), facing up. */
  readonly tris: Float32Array;
  /**
   * Its shore's bands as its land's view draws them (render/stage.ts GROUND_PS): the line of foam on the water's side, where
   * the read is past a half by up to FOAM, and the wet sand on the land's, short of it by up to SAND (none on what stands on
   * the ground). Triangles as `tris`.
   */
  readonly foam: Float32Array;
  readonly sand: Float32Array;
  /** Whether a point (metres) lies on it. */
  readonly on: (x: number, z: number) => boolean;
  /** Squares of its land's tiles it was worked out on; leaves met (the look tools). */
  readonly squares: number;
  readonly leaves: number;
};

/**
 * A town's water as its land's view draws its shore, out to `near` metres from its square: of each square of its land's tiles
 * with water at a corner, what reads as water (shore.s past a half), less what stands on its ground (`laid`, kept KEEP clear),
 * with its own round of open water (`open`: its boats', always water). Worked out in a square's quarters, each again where the
 * shore may pass through it, to LEAF; in each leaf the shore drawn straight between where it crosses the leaf's sides.
 */
export function shoreWater(
  shore: Shore,
  o: { near: number; laid: Laid; open?: { x: number; z: number; r: number } | null },
): ShoreWater {
  const { m, half, bx, bz, cells } = shore,
    n = 2 * half,
    depth = Math.max(0, Math.ceil(Math.log2(m / LEAF))),
    side = 1 << depth,
    leaf = m / side,
    pts = side + 1,
    // (Every point of a leaf lies within three quarters of its side of a corner: a leaf's water keeps so far from what is laid.)
    keep = KEEP + 0.75 * leaf,
    out: number[] = [],
    foam: number[] = [],
    sand: number[] = [],
    open = o.open ?? null,
    bySquare = new Map<number, { from: number; to: number }>();
  // (What stands on the ground, by the squares it comes into.)
  const laidIn = new Map<number, number[]>(),
    squareOf = (x: number, z: number) => [
      Math.floor((x + bx) / m + half),
      Math.floor((z + bz) / m + half),
    ],
    file = (kind: number, k: number, x0: number, z0: number, x1: number, z1: number) => {
      const [i0, j0] = squareOf(x0 - keep, z0 - keep),
        [i1, j1] = squareOf(x1 + keep, z1 + keep);
      for (let j = Math.max(0, j0!); j <= Math.min(n - 1, j1!); j++)
        for (let i = Math.max(0, i0!); i <= Math.min(n - 1, i1!); i++) {
          const bits = cells.charCodeAt(j * n + i) - 48;
          if (!bits) continue;
          // (Where none of its ground could be water, whatever the grain, it is not asked after: the tiles' share is most at
          // a corner of what it covers of the square.)
          const sx0 = (i - half) * m - bx,
            sz0 = (j - half) * m - bz,
            u0 = Math.max(0, (x0 - keep - sx0) / m),
            u1 = Math.min(1, (x1 + keep - sx0) / m),
            v0 = Math.max(0, (z0 - keep - sz0) / m),
            v1 = Math.min(1, (z1 + keep - sz0) / m),
            at = (u: number, v: number) =>
              ((bits & 1) * (1 - u) + ((bits >> 1) & 1) * u) * (1 - v) +
              (((bits >> 2) & 1) * (1 - u) + ((bits >> 3) & 1) * u) * v,
            most = Math.max(at(u0, v0), at(u1, v0), at(u0, v1), at(u1, v1)),
            nearOpen =
              !!open &&
              Math.hypot(
                Math.max(x0 - keep, Math.min(open.x, x1 + keep)) - open.x,
                Math.max(z0 - keep, Math.min(open.z, z1 + keep)) - open.z,
              ) <=
                open.r + 2;
          if (most + 0.125 < 0.5 && !nearOpen) continue;
          const key = j * n + i;
          let l = laidIn.get(key);
          if (!l) laidIn.set(key, (l = []));
          l.push(kind, k);
        }
    };
  const { rects, rounds, strips } = o.laid;
  for (let k = 0; k < rects.length; k += 5) {
    const r = Math.hypot(rects[k + 2]!, rects[k + 3]!) / 2;
    file(0, k, rects[k]! - r, rects[k + 1]! - r, rects[k]! + r, rects[k + 1]! + r);
  }
  for (let k = 0; k < rounds.length; k += 3) {
    const r = rounds[k + 2]!;
    file(1, k, rounds[k]! - r, rounds[k + 1]! - r, rounds[k]! + r, rounds[k + 1]! + r);
  }
  for (let k = 0; k < strips.length; k += 5) {
    const h = strips[k + 4]!;
    file(
      2,
      k,
      Math.min(strips[k]!, strips[k + 2]!) - h,
      Math.min(strips[k + 1]!, strips[k + 3]!) - h,
      Math.max(strips[k]!, strips[k + 2]!) + h,
      Math.max(strips[k + 1]!, strips[k + 3]!) + h,
    );
  }
  let squares = 0,
    leaves = 0;
  const held = new Uint8Array(pts * pts),
    sum = new Int32Array((pts + 1) * (pts + 1)),
    readS = new Float32Array(pts * pts),
    readG = new Float32Array(pts * pts),
    known = new Uint8Array(pts * pts);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const bits = cells.charCodeAt(j * n + i) - 48;
      if (!bits) continue;
      const x0 = (i - half) * m - bx,
        z0 = (j - half) * m - bz;
      // (A square wholly past the town's own ground is left to its land's, drawn about it: render/farland.ts.)
      const nx = Math.max(x0, Math.min(0, x0 + m)),
        nz = Math.max(z0, Math.min(0, z0 + m));
      if (Math.hypot(nx, nz) > o.near) continue;
      squares++;
      const c00 = bits & 1,
        c10 = (bits >> 1) & 1,
        c01 = (bits >> 2) & 1,
        c11 = (bits >> 3) & 1;
      // (Its points held by what stands there, and a sum of them over each corner of the square, to ask of a part at once.)
      held.fill(0);
      const mine = laidIn.get(j * n + i);
      if (mine)
        for (let q = 0; q < mine.length; q += 2) {
          const kind = mine[q]!,
            k = mine[q + 1]!;
          let lo0: number, lo1: number, hi0: number, hi1: number;
          let inside: (x: number, z: number) => boolean;
          if (kind === 0) {
            const cx = rects[k]!,
              cz = rects[k + 1]!,
              hw = rects[k + 2]! / 2 + keep,
              hd = rects[k + 3]! / 2 + keep,
              c = Math.cos(rects[k + 4]!),
              sn = Math.sin(rects[k + 4]!),
              r = Math.hypot(hw, hd);
            lo0 = cx - r;
            hi0 = cx + r;
            lo1 = cz - r;
            hi1 = cz + r;
            inside = (x, z) => {
              const dx = x - cx,
                dz = z - cz;
              return Math.abs(dx * c - dz * sn) <= hw && Math.abs(dx * sn + dz * c) <= hd;
            };
          } else if (kind === 1) {
            const cx = rounds[k]!,
              cz = rounds[k + 1]!,
              r = rounds[k + 2]! + keep;
            lo0 = cx - r;
            hi0 = cx + r;
            lo1 = cz - r;
            hi1 = cz + r;
            inside = (x, z) => (x - cx) ** 2 + (z - cz) ** 2 <= r * r;
          } else {
            const ax = strips[k]!,
              az = strips[k + 1]!,
              ex = strips[k + 2]! - ax,
              ez = strips[k + 3]! - az,
              h = strips[k + 4]! + keep,
              l2 = ex * ex + ez * ez || 1;
            lo0 = Math.min(ax, ax + ex) - h;
            hi0 = Math.max(ax, ax + ex) + h;
            lo1 = Math.min(az, az + ez) - h;
            hi1 = Math.max(az, az + ez) + h;
            inside = (x, z) => {
              const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2));
              return (x - ax - t * ex) ** 2 + (z - az - t * ez) ** 2 <= h * h;
            };
          }
          const p0 = Math.max(0, Math.floor((lo0 - x0) / leaf)),
            p1 = Math.min(side, Math.ceil((hi0 - x0) / leaf)),
            q0 = Math.max(0, Math.floor((lo1 - z0) / leaf)),
            q1 = Math.min(side, Math.ceil((hi1 - z0) / leaf));
          for (let b = q0; b <= q1; b++)
            for (let a = p0; a <= p1; a++)
              if (!held[b * pts + a] && inside(x0 + a * leaf, z0 + b * leaf)) held[b * pts + a] = 1;
        }
      for (let b = 0; b < pts; b++)
        for (let a = 0; a < pts; a++)
          sum[(b + 1) * (pts + 1) + a + 1] =
            held[b * pts + a]! +
            sum[b * (pts + 1) + a + 1]! +
            sum[(b + 1) * (pts + 1) + a]! -
            sum[b * (pts + 1) + a]!;
      const heldIn = (a0: number, b0: number, a1: number, b1: number) =>
        sum[(b1 + 1) * (pts + 1) + a1 + 1]! -
        sum[b0 * (pts + 1) + a1 + 1]! -
        sum[(b1 + 1) * (pts + 1) + a0]! +
        sum[b0 * (pts + 1) + a0]!;
      known.fill(0);
      // (At a point of the square: the tiles' water there, and the grain's share.)
      const read = (a: number, b: number) => {
        const p = b * pts + a;
        if (!known[p]) {
          const u = a / side,
            v = b / side,
            x = x0 + a * leaf,
            z = z0 + b * leaf;
          readS[p] = (c00 * (1 - u) + c10 * u) * (1 - v) + (c01 * (1 - u) + c11 * u) * v;
          readG[p] = shoreRead(0, 0, 0, 0, 0, 0, shore.lx + x * ACROSS, shore.lz + z * ACROSS);
          known[p] = 1;
        }
        return p;
      };
      const openAt = (x: number, z: number) =>
        open ? (open.r + 2 - Math.hypot(x - open.x, z - open.z)) / m : -Infinity;
      const value = (a: number, b: number) => {
        const p = read(a, b);
        if (held[p]) return -1;
        const x = x0 + a * leaf,
          z = z0 + b * leaf;
        return Math.max(readS[p]! + readG[p]! - 0.5, openAt(x, z));
      };
      const from = out.length;
      const quad = (into: number[], a: number, b: number, size: number) => {
        const ox0 = x0 + a * leaf,
          oz0 = z0 + b * leaf,
          h = size * leaf;
        into.push(
          ox0,
          oz0,
          ox0,
          oz0 + h,
          ox0 + h,
          oz0 + h,
          ox0,
          oz0,
          ox0 + h,
          oz0 + h,
          ox0 + h,
          oz0,
        );
      };
      // (How low and high the read may run over a part: the tiles' share is least and most at its corners, the grain within
      // its own span and its steepness, the open water's round by how near and far the part lies from its middle; and
      // whether anything stands on it.)
      const span = (a: number, b: number, size: number) => {
        const h = size * leaf;
        let sLo = Infinity,
          sHi = -Infinity,
          gLo = Infinity,
          gHi = -Infinity;
        for (const p of [
          read(a, b),
          read(a + size, b),
          read(a, b + size),
          read(a + size, b + size),
        ]) {
          sLo = Math.min(sLo, readS[p]!);
          sHi = Math.max(sHi, readS[p]!);
          gLo = Math.min(gLo, readG[p]!);
          gHi = Math.max(gHi, readG[p]!);
        }
        let lo = sLo + Math.max(-0.125, gLo - GRAIN_STEEP * h) - 0.5,
          hi = sHi + Math.min(0.125, gHi + GRAIN_STEEP * h) - 0.5;
        if (open) {
          const ox0 = x0 + a * leaf,
            oz0 = z0 + b * leaf,
            dNear = Math.hypot(
              Math.max(ox0, Math.min(open.x, ox0 + h)) - open.x,
              Math.max(oz0, Math.min(open.z, oz0 + h)) - open.z,
            ),
            dFar = Math.hypot(
              Math.max(Math.abs(ox0 - open.x), Math.abs(ox0 + h - open.x)),
              Math.max(Math.abs(oz0 - open.z), Math.abs(oz0 + h - open.z)),
            );
          lo = Math.max(lo, (open.r + 2 - dFar) / m);
          hi = Math.max(hi, (open.r + 2 - dNear) / m);
        }
        const held = heldIn(a, b, a + size, b + size);
        return {
          lo: held ? Math.min(lo, -1) : lo,
          hi,
          held,
          all: held === (size + 1) * (size + 1),
        };
      };
      // (A part of the square, for each band of the read (its water, its foam, its sand: BANDS) still asked after (`ask`): none
      // of the band in it (0), all of it (1, left for the part it is in to draw with its others, as one where all four are), or
      // some, drawn (2). Each part read once for all the bands.)
      const bands = [
        [out, 0, Infinity],
        [foam, 0, FOAM],
        [sand, -SAND, 0],
      ] as const;
      const part = (a: number, b: number, size: number, ask: readonly boolean[]): number[] => {
        const r = span(a, b, size),
          got: number[] = bands.map(([, b0, b1], k) =>
            !ask[k] || r.all || r.hi <= b0 || r.lo >= b1
              ? 0
              : !r.held && r.lo > b0 && r.hi < b1
                ? 1
                : -1,
          );
        if (!got.includes(-1)) return got;
        if (size > 1) {
          const q = size >> 1,
            kids: [number, number][] = [
              [a, b],
              [a + q, b],
              [a, b + q],
              [a + q, b + q],
            ],
            open = got.map((g) => g === -1),
            under = kids.map(([p, t]) => part(p, t, q, open));
          bands.forEach(([into], k) => {
            if (!open[k]) return;
            if (under.every((u) => u[k] === 1)) {
              got[k] = 1;
              return;
            }
            under.forEach((u, c) => u[k] === 1 && quad(into, kids[c]![0], kids[c]![1], q));
            got[k] = under.some((u) => u[k]) ? 2 : 0;
          });
          return got;
        }
        leaves++;
        // (A leaf: its corners in turn about it, cut where its sides read a band's bounds; what reads between kept.)
        const corners: number[] = [];
        for (const [p, q] of [
          [a, b],
          [a, b + 1],
          [a + 1, b + 1],
          [a + 1, b],
        ] as const)
          corners.push(x0 + p * leaf, z0 + q * leaf, value(p, q));
        bands.forEach(([into, b0, b1], k) => {
          if (got[k] !== -1) return;
          if (corners.every((v, c) => c % 3 !== 2 || (v > b0 && v < b1))) {
            got[k] = 1;
            return;
          }
          let poly = corners;
          for (const [edge, above] of [
            [b0, true],
            [b1, false],
          ] as const) {
            if (!Number.isFinite(edge)) continue;
            const kept: number[] = [],
              n3 = poly.length / 3,
              inside = (v: number) => (above ? v > edge : v < edge);
            for (let c = 0; c < n3; c++) {
              const d = (c + 1) % n3,
                v0 = poly[3 * c + 2]!,
                v1 = poly[3 * d + 2]!;
              if (inside(v0)) kept.push(poly[3 * c]!, poly[3 * c + 1]!, v0);
              if (inside(v0) !== inside(v1)) {
                const t = (edge - v0) / (v1 - v0);
                kept.push(
                  poly[3 * c]! + (poly[3 * d]! - poly[3 * c]!) * t,
                  poly[3 * c + 1]! + (poly[3 * d + 1]! - poly[3 * c + 1]!) * t,
                  edge,
                );
              }
            }
            poly = kept;
          }
          if (poly.length < 9) {
            got[k] = 0;
            return;
          }
          for (let t = 1; 3 * t + 5 < poly.length; t++)
            into.push(
              poly[0]!,
              poly[1]!,
              poly[3 * t]!,
              poly[3 * t + 1]!,
              poly[3 * t + 3]!,
              poly[3 * t + 4]!,
            );
          got[k] = 2;
        });
        return got;
      };
      const whole = part(0, 0, side, [true, true, true]);
      bands.forEach(([into], k) => whole[k] === 1 && quad(into, 0, 0, side));
      if (out.length > from) bySquare.set(j * n + i, { from, to: out.length });
    }
  const tris = Float32Array.from(out);
  const on = (x: number, z: number): boolean => {
    const i = Math.floor((x + bx) / m + half),
      j = Math.floor((z + bz) / m + half);
    if (i < 0 || j < 0 || i >= n || j >= n) return false;
    const r = bySquare.get(j * n + i);
    if (!r) return false;
    for (let k = r.from; k < r.to; k += 6) {
      const ax = tris[k]!,
        az = tris[k + 1]!,
        bx2 = tris[k + 2]!,
        bz2 = tris[k + 3]!,
        cx = tris[k + 4]!,
        cz = tris[k + 5]!;
      const d1 = (x - bx2) * (az - bz2) - (ax - bx2) * (z - bz2),
        d2 = (x - cx) * (bz2 - cz) - (bx2 - cx) * (z - cz),
        d3 = (x - ax) * (cz - az) - (cx - ax) * (z - az);
      if (Math.abs((bx2 - ax) * (cz - az) - (cx - ax) * (bz2 - az)) < 1e-9) continue;
      const neg = d1 < 0 || d2 < 0 || d3 < 0,
        pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) return true;
    }
    return false;
  };
  return {
    tris,
    foam: Float32Array.from(foam),
    sand: Float32Array.from(sand),
    on,
    squares,
    leaves,
  };
}
