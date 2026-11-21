// What grows on a land, as the eye sees it (bridge/biome.ts reads what grows there; this says how it looks): each tile's
// ground in the colours of what covers it (woods' shade, grass green or straw by its rain, rock, sand, marsh, felled ground),
// in its world's own colours (lifePalette: another chemistry's plants are never Earth's green, a world where nothing took
// hold has none); its woods far off as crowns a tile holds (render/region.ts), and near the eye each tree, bush, tuft and
// stone where it stands, from a lattice fixed on the land (the same trees in the same places however the eye comes to them),
// as many as the setting's budget lets about the eye, never on water, a road, a lot, a field or a camp. Pure.
import {
  FLORA,
  TREE_FORMS,
  floraMix,
  floraUnpack,
  tileUnit,
  type FloraTiles,
  type FrameMessage,
  type TreeForm,
} from "../bridge/index.ts";
import { frameKind, frameLook, lifePalette } from "./globe.ts";
import type { Rgb } from "./sandbox.ts";

/** A land's growth as the eye reads it: its map's facts and the reading, in its world's colours. */
export type FloraLand = {
  readonly key: string;
  readonly size: number;
  readonly tileKm: number;
  /** Heights (region units, the terrain's), and water (0 land, 1 sea, 2 river, 3 lake). */
  readonly heights: Float32Array;
  readonly water: Uint8Array;
  readonly read: FloraTiles;
  readonly palette: readonly Rgb[];
  /** A people of the water's: what grows is on the seabed. */
  readonly undersea: boolean;
};

let last: FloraLand | null = null;

/** A map's heights as the terrain is drawn (view/region.ts regionHeights: km times REGION_RELIEF). */
function heightsOf(frame: FrameMessage): Float32Array {
  const e = frame.arrays.elevation!,
    out = new Float32Array(e.length);
  for (let t = 0; t < e.length; t++) out[t] = (Math.max(e[t]!, -60) / 1000) * 9;
  return out;
}

/** A land's growth from its map (null: a map that carries no reading, a land on another body's). */
export function floraLandOf(frame: FrameMessage): FloraLand | null {
  const packed = frame.arrays.flora as Uint8Array | undefined,
    meta = frame.meta as {
      ref?: string;
      surfaceKey?: string;
      woods?: string;
      size?: number;
      tileKm?: number;
      undersea?: boolean;
      floraUndersea?: boolean;
    },
    size = meta.size ?? Math.round(Math.sqrt(frame.arrays.elevation?.length ?? 0));
  if (!packed || !size) return null;
  const key = `${meta.surfaceKey ?? meta.ref}|${size}|${meta.woods ?? ""}|${frameKind(frame)}|${frameLook(frame) ?? ""}`;
  if (last?.key === key) return last;
  last = {
    key,
    size,
    tileKm: meta.tileKm ?? 1,
    heights: heightsOf(frame),
    water: (frame.arrays.water as Uint8Array) ?? new Uint8Array(size * size),
    read: floraUnpack(packed, size),
    palette: lifePalette(frameKind(frame), frameLook(frame)),
    undersea: !!(meta.floraUndersea ?? meta.undersea),
  };
  return last;
}

export const mixRgb = (a: Rgb, b: Rgb, k: number): Rgb => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];
export const scale = (a: Rgb, k: number): Rgb => [a[0] * k, a[1] * k, a[2] * k];

/** The palette's rows (gen's BIOME order) each ground is read in. */
export const ROW = {
  tundra: 5,
  boreal: 6,
  coldSoil: 7,
  straw: 8,
  green: 9,
  wetWood: 10,
  sand: 11,
  savanna: 12,
  dryWood: 13,
  rainWood: 14,
  rock: 15,
  ice: 4,
  sea: 1,
} as const;

/** The shade under each cover's woods (its crowns seen from above): its own row of the palette. */
export function woodsShade(p: readonly Rgb[], cover: number): Rgb {
  switch (cover) {
    case FLORA.taiga:
    case FLORA.tundra:
    case FLORA.alpine:
      return p[ROW.boreal]!;
    case FLORA.temperateRain:
      return p[ROW.wetWood]!;
    case FLORA.dryForest:
    case FLORA.savanna:
    case FLORA.hotDesert:
      return p[ROW.dryWood]!;
    case FLORA.rainforest:
      return p[ROW.rainWood]!;
    case FLORA.mixed:
      return mixRgb(p[ROW.green]!, p[ROW.boreal]!, 0.45);
    default:
      return scale(p[ROW.green]!, 0.82);
  }
}

/** The open ground of a cover (its grass at `lush`, 0 straw … 1 green), what lies between its trees. */
export function openGround(p: readonly Rgb[], cover: number, lush: number): Rgb {
  const grass = mixRgb(p[ROW.straw]!, mixRgb(p[ROW.green]!, p[ROW.straw]!, 0.18), lush);
  switch (cover) {
    case FLORA.ice:
      return p[ROW.ice]!;
    case FLORA.rock:
      return mixRgb(p[ROW.rock]!, p[ROW.coldSoil]!, 0.25);
    case FLORA.alpine:
      return mixRgb(p[ROW.tundra]!, grass, 0.35);
    case FLORA.tundra:
      return mixRgb(p[ROW.tundra]!, grass, 0.25 * lush);
    case FLORA.savanna:
      return mixRgb(p[ROW.savanna]!, grass, 0.35 * lush);
    case FLORA.dryForest:
      return mixRgb(p[ROW.savanna]!, grass, 0.6 * lush);
    case FLORA.rainforest:
      return mixRgb(grass, p[ROW.rainWood]!, 0.35);
    case FLORA.hotDesert:
      return mixRgb(p[ROW.sand]!, p[ROW.savanna]!, 0.25 * lush);
    case FLORA.coldDesert:
      return mixRgb(p[ROW.coldSoil]!, p[ROW.straw]!, 0.3 * lush);
    case FLORA.marsh:
      return mixRgb(mixRgb(grass, p[ROW.sea]!, 0.22), p[ROW.boreal]!, 0.25);
    case FLORA.cleared:
      return mixRgb(grass, p[ROW.coldSoil]!, 0.3);
    default:
      return grass;
  }
}

/**
 * Each tile's ground (RGBA, 0–255): its woods' shade over as much of it as they cover, rock where it is bare, the rest its
 * open ground; a bank's grass greener; a little lighter or darker tile from tile (as fields of grass are), richer soil a
 * little darker. Water as the map has it (the colours given). Null: a map with no reading.
 */
export function floraColors(frame: FrameMessage, waters: Uint8Array): Uint8Array | null {
  const land = floraLandOf(frame);
  if (!land) return null;
  const { read: r, palette: p } = land,
    n = land.size * land.size,
    out = waters.slice(0, n * 4),
    fert = frame.arrays.fertility as Uint8Array | undefined;
  for (let t = 0; t < n; t++) {
    if (land.water[t] !== 0) continue;
    const col = tileGround(p, r, t, t, fert ? fert[t]! / 255 : 0);
    out[t * 4] = Math.max(0, Math.min(255, Math.round(col[0] * 255)));
    out[t * 4 + 1] = Math.max(0, Math.min(255, Math.round(col[1] * 255)));
    out[t * 4 + 2] = Math.max(0, Math.min(255, Math.round(col[2] * 255)));
    out[t * 4 + 3] = 255;
  }
  return out;
}

/**
 * One tile's ground: its woods' shade over as much of it as they cover, rock where it is bare, the rest its open ground; a
 * bank's grass greener; a little lighter or darker tile from tile (`id`: its own number), richer soil (`soil`, 0 … 1) darker.
 */
export function tileGround(p: readonly Rgb[], r: FloraTiles, t: number, id: number, soil = 0): Rgb {
  const cover = r.cover[t]!,
    c = r.canopy[t]! / 255,
    k = r.rock[t]! / 255,
    wet = r.wet[t]! / 255,
    lush = r.lush[t]! / 255,
    rock = mixRgb(p[ROW.rock]!, p[ROW.coldSoil]!, 0.2);
  let g = openGround(p, cover, Math.min(1, lush + 0.3 * wet));
  // (A bank's grass greener and darker: the water's.)
  if (wet > 0 && cover !== FLORA.marsh) g = mixRgb(g, scale(p[ROW.green]!, 0.9), 0.3 * wet);
  const shade = woodsShade(p, cover),
    under = Math.min(0.92, c * 1.05),
    bare = Math.min(1 - under, k),
    col = mixRgb(mixRgb(g, rock, bare / Math.max(1e-6, 1 - under)), shade, under),
    // (Tile from tile: a little lighter or darker, a little warmer or cooler; richer soil darker.)
    j = (0.93 + 0.14 * tileUnit(id, 11)) * (1 - 0.06 * soil),
    warmth = (tileUnit(id, 12) - 0.5) * 0.04;
  return [col[0] * j * (1 + warmth), col[1] * j, col[2] * j * (1 - warmth)];
}

/** The colour a form's crown stands in, in its world's colours (a land's woods browned in a dry run: `parched`). */
export function formColor(p: readonly Rgb[], form: TreeForm): Rgb {
  switch (form) {
    case "conifer":
      return p[ROW.boreal]!;
    case "broadleaf":
      return p[ROW.green]!;
    case "palm":
      return mixRgb(p[ROW.dryWood]!, p[ROW.rainWood]!, 0.5);
    case "flat":
      return mixRgb(p[ROW.dryWood]!, p[ROW.savanna]!, 0.25);
    case "tall":
      return p[ROW.rainWood]!;
    case "scrub":
      return mixRgb(p[ROW.dryWood]!, p[ROW.straw]!, 0.4);
    case "dead":
      return [0.4, 0.32, 0.24];
    case "kelp":
      return mixRgb(p[ROW.dryWood]!, p[ROW.sea]!, 0.35);
  }
}

/** A wood's trunk. */
export const TRUNK: Rgb = [0.36, 0.27, 0.19];

/** How a form stands (region units, at the land's scale beside its towns): crown breadth and height, trunk height, and its crown's shape. */
export const FORM_SIZE: Readonly<
  Record<TreeForm, { w: number; h: number; trunk: number; crown: "cone" | "ball" | "none" }>
> = {
  conifer: { w: 0.06, h: 0.15, trunk: 0.03, crown: "cone" },
  broadleaf: { w: 0.08, h: 0.075, trunk: 0.05, crown: "ball" },
  palm: { w: 0.07, h: 0.03, trunk: 0.11, crown: "ball" },
  flat: { w: 0.11, h: 0.035, trunk: 0.055, crown: "ball" },
  tall: { w: 0.095, h: 0.1, trunk: 0.1, crown: "ball" },
  scrub: { w: 0.045, h: 0.03, trunk: 0, crown: "ball" },
  dead: { w: 0.012, h: 0, trunk: 0.06, crown: "none" },
  kelp: { w: 0.025, h: 0.12, trunk: 0, crown: "cone" },
};

/** A form drawn by a tile's mix at a share `u` (0 … 1). */
export function formAt(read: FloraTiles, t: number, u: number, warm = 10): TreeForm {
  const mix = floraMix(read.cover[t]!, read.wet[t]! > 100 && read.cover[t] !== FLORA.marsh, warm);
  let acc = 0;
  for (let k = 0; k < mix.length; k++) {
    acc += mix[k]!;
    if (u < acc) return TREE_FORMS[k]!;
  }
  return "scrub";
}

/** A wood's far crowns: kinds the far woods are planted as (render/region.ts), for each form. */
export function farKind(
  form: TreeForm,
): "conifer" | "broadleaf" | "flat" | "tall" | "parched" | "scrub" | "palm" | "dead" {
  return form === "kelp" ? "tall" : form;
}

/** A tile's warmth as the reading's mix reads it: the open ground's own (a hot desert's palms, a cold one's willows). */
export function warmOf(read: FloraTiles, t: number): number {
  const c = read.cover[t]!;
  return c === FLORA.hotDesert ||
    c === FLORA.savanna ||
    c === FLORA.dryForest ||
    c === FLORA.rainforest
    ? 24
    : 10;
}

/** Trees in a wooded tile's clump, at most, far off. */
const CLUMP = 3;

/**
 * The far woods (render/region.ts plants them as crowns a tile holds, as RegionTree): in each tile as many crowns as its
 * canopy holds (up to CLUMP), its forms by its mix, thinned alike everywhere to the cap; where the woods are browned by a dry
 * run, most broad crowns brown. The same land, the same crowns.
 */
export function floraClumps(
  land: FloraLand,
  cap: number,
  parched = false,
): {
  tile: number;
  dx: number;
  dz: number;
  kind: ReturnType<typeof farKind> | "parched";
  size: number;
  tone: number;
}[] {
  const r = land.read,
    n = land.size * land.size;
  let expected = 0;
  for (let t = 0; t < n; t++)
    if (r.cover[t] === FLORA.reef || land.water[t] === 0) expected += (r.canopy[t]! / 255) * CLUMP;
  const thin = Math.min(1, (0.92 * cap) / Math.max(1, expected)),
    out: {
      tile: number;
      dx: number;
      dz: number;
      kind: ReturnType<typeof farKind> | "parched";
      size: number;
      tone: number;
    }[] = [];
  for (let t = 0; t < n && out.length + CLUMP <= cap; t++) {
    if (r.cover[t] !== FLORA.reef && land.water[t] !== 0) continue;
    const c = (r.canopy[t]! / 255) * CLUMP * thin;
    for (let k = 0; k < CLUMP; k++) {
      if (tileUnit(t, 20 + k) >= c - k) continue;
      const form = formAt(r, t, tileUnit(t, 30 + k), warmOf(r, t));
      out.push({
        tile: t,
        dx: (tileUnit(t, 40 + k) - 0.5) * 0.9,
        dz: (tileUnit(t, 50 + k) - 0.5) * 0.9,
        kind:
          parched && form !== "conifer" && form !== "dead" && tileUnit(t, 60 + k) < 0.6
            ? "parched"
            : farKind(form),
        size: (form === "scrub" ? 0.2 : 0.3) + 0.2 * tileUnit(t, 70 + k),
        tone: tileUnit(t, 80 + k),
      });
    }
  }
  return out;
}

/** One thing drawn near the eye: where, how big, which way it faces, its colour. */
export type NearThing = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  yaw: number;
  r: number;
  g: number;
  b: number;
};

/** What stands near the eye, by how it is drawn: trunks, cones (needles, weed), balls (broad crowns, scrub), tufts of grass, stones, and patches of the ground's own colour. */
export type NearFlora = {
  trunks: NearThing[];
  cones: NearThing[];
  balls: NearThing[];
  tufts: NearThing[];
  stones: NearThing[];
  /** A patch lies on its facet (its up the facet's). */
  patches: (NearThing & { nx: number; ny: number; nz: number })[];
  /** Trees laid (each counted once, trunk and crown). */
  trees: number;
};

/** A point's ground on a land's facets (region units) and the facet's up there. */
function facetAt(
  land: FloraLand,
  x: number,
  z: number,
  seabed: boolean,
): { y: number; nx: number; ny: number; nz: number } {
  const s = land.size,
    tk = land.tileKm,
    half = ((s - 1) * tk) / 2,
    fi = Math.max(0, Math.min(s - 1 - 1e-9, (x + half) / tk)),
    fj = Math.max(0, Math.min(s - 1 - 1e-9, (z + half) / tk)),
    i = Math.floor(fi),
    j = Math.floor(fj),
    u = fi - i,
    v = fj - j,
    h = land.heights,
    a = h[j * s + i]!,
    b = h[j * s + i + 1]!,
    c = h[(j + 1) * s + i]!,
    d = h[(j + 1) * s + i + 1]!;
  let y: number, gx: number, gz: number;
  if (u + v <= 1) {
    y = a + (b - a) * u + (c - a) * v;
    gx = (b - a) / tk;
    gz = (c - a) / tk;
  } else {
    y = d + (c - d) * (1 - u) + (b - d) * (1 - v);
    gx = (d - c) / tk;
    gz = (d - b) / tk;
  }
  if (!seabed && y < 0) return { y: 0, nx: 0, ny: 1, nz: 0 };
  const len = Math.hypot(gx, 1, gz);
  return { y, nx: -gx / len, ny: 1 / len, nz: -gz / len };
}

/** The tile a point falls on (its nearest). */
function tileAt(land: FloraLand, x: number, z: number): number {
  const s = land.size,
    half = ((s - 1) * land.tileKm) / 2,
    i = Math.max(0, Math.min(s - 1, Math.round((x + half) / land.tileKm))),
    j = Math.max(0, Math.min(s - 1, Math.round((z + half) / land.tileKm)));
  return j * s + i;
}

/** A lattice cell's own number (fixed on the land: the same cell, the same thing in it). */
export function cellUnit(i: number, j: number, k: number): number {
  let h =
    Math.imul(i + 0x7fff, 0x9e3779b1) ^
    Math.imul(j + 0x3fff, 0x85ebca6b) ^
    Math.imul(k + 13, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** A grove's cell past the near trees (region units), and how far out the groves reach (times the trees' reach). */
const GROVE_CELL = 0.24,
  GROVE_OUT = 2.2;

/** Groves and clearings: a smooth number over the land (0 … 1), so a wood stands in stands, not evenly. */
function groveAt(x: number, z: number): number {
  const S = 0.55,
    fx = x / S,
    fz = z / S,
    i = Math.floor(fx),
    j = Math.floor(fz),
    u = fx - i,
    v = fz - j,
    su = u * u * (3 - 2 * u),
    sv = v * v * (3 - 2 * v),
    a = cellUnit(i, j, 900),
    b = cellUnit(i + 1, j, 900),
    c = cellUnit(i, j + 1, 900),
    d = cellUnit(i + 1, j + 1, 900);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}

/** The lattices the near things are laid on (region units a cell) and how many of each a cell may hold. */
const TREE_CELL = 0.085,
  TUFT_CELL = 0.05,
  STONE_CELL = 0.12,
  PATCH_CELL = 0.3;

/** How many near things a setting draws, of each kind: trees, tufts, stones, patches. */
export type NearBudget = {
  trees: number;
  tufts: number;
  stones: number;
  patches: number;
  /** Groves past the trees (a ring out to GROVE_OUT times their reach): crowns standing for a few trees each. */
  groves: number;
};

/** A budget's trees for a setting's far crowns (the quality's `regionTrees`): about as many near as far. */
export function nearBudget(regionTrees: number): NearBudget {
  const trees = Math.round(Math.min(9000, Math.max(1500, regionTrees * 0.6)));
  return {
    trees,
    tufts: Math.round(trees * 0.6),
    stones: Math.round(trees * 0.12),
    patches: Math.round(trees * 0.2),
    groves: Math.round(trees * 0.45),
  };
}

/** How far about the eye the near trees reach (region units), for the canopy about it and a budget. */
export function nearReach(
  land: FloraLand,
  x: number,
  z: number,
  budget: number,
  most: number,
): number {
  // (The mean canopy about the point, read on the tiles within a few of it.)
  const t0 = tileAt(land, x, z),
    s = land.size,
    i0 = t0 % s,
    j0 = (t0 - i0) / s;
  let sum = 0,
    count = 0;
  for (let dj = -3; dj <= 3; dj++)
    for (let di = -3; di <= 3; di++) {
      const i = i0 + di,
        j = j0 + dj;
      if (i < 0 || j < 0 || i >= s || j >= s) continue;
      const t = j * s + i;
      sum += land.read.canopy[t]! / 255;
      count++;
    }
  const mean = Math.max(0.05, sum / Math.max(1, count)),
    perUnit = mean / (TREE_CELL * TREE_CELL);
  return Math.max(1.2, Math.min(most, Math.sqrt(budget / (Math.PI * perUnit))));
}

/** Square rings of lattice cells about a point, nearest first, as far as a reach. */
export function* rings(
  cx: number,
  cz: number,
  cell: number,
  reach: number,
  /** How far out the rings begin (the square ring within which nothing is asked). */
  from = 0,
): Generator<[number, number]> {
  const i0 = Math.floor(cx / cell),
    j0 = Math.floor(cz / cell),
    k = Math.ceil(reach / cell) + 1,
    k0 = Math.max(1, Math.floor(from / cell / Math.SQRT2) - 1);
  if (k0 <= 1) yield [i0, j0];
  for (let r = k0; r <= k; r++)
    for (let d = -r; d < r; d++) {
      yield [i0 + d, j0 - r];
      yield [i0 + r, j0 + d];
      yield [i0 - d, j0 + r];
      yield [i0 - r, j0 - d];
    }
}

/**
 * What stands near a point of a land (region units), as far as `reach` and as many as the budget: each lattice cell's tree
 * (by its tile's canopy, in groves and clearings), bush, tuft (by its grass), stone (by its rock) and patch of its ground's
 * own colour, nearest first. `free(x, z, r)`: whether a thing `r` across may stand there (the land's ground claims: never on
 * water, a road, a lot, a field, a camp); `bare(tile)`: burned bare.
 */
export function nearFlora(
  land: FloraLand,
  cx: number,
  cz: number,
  reach: number,
  budget: NearBudget,
  free: (x: number, z: number, r: number) => boolean,
  bare: (tile: number) => boolean = () => false,
  parched = false,
): NearFlora {
  const steps = nearFloraSteps(land, cx, cz, reach, budget, free, bare, parched);
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
  }
}

/** How many lattice cells are read between one pause and the next of a laying in steps. */
const STEP_CELLS = 384;

/**
 * The same laying (nearFlora) in steps: it pauses every few hundred cells, so a laying can be spread over frames (each
 * frame a few milliseconds of it, render/flora.ts) and what stands is not held up by it. Its end is what nearFlora gives.
 */
export function* nearFloraSteps(
  land: FloraLand,
  cx: number,
  cz: number,
  reach: number,
  budget: NearBudget,
  free: (x: number, z: number, r: number) => boolean,
  bare: (tile: number) => boolean = () => false,
  parched = false,
): Generator<void, NearFlora> {
  let cells = 0;
  const out: NearFlora = {
      trunks: [],
      cones: [],
      balls: [],
      tufts: [],
      stones: [],
      patches: [],
      trees: 0,
    },
    r = land.read,
    p = land.palette,
    seabed = land.undersea,
    r2 = reach * reach,
    grows = (t: number) => land.water[t] === 0 || (seabed && r.cover[t] === FLORA.reef);
  const put = (
    list: NearThing[],
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    yaw: number,
    c: Rgb,
  ) => list.push({ x, y, z, w, h, yaw, r: c[0], g: c[1], b: c[2] });
  // Trees: a cell's one, by its tile's canopy, in groves.
  for (const [i, j] of rings(cx, cz, TREE_CELL, reach)) {
    if (++cells % STEP_CELLS === 0) yield;
    if (out.trees >= budget.trees) break;
    const x = (i + 0.15 + 0.7 * cellUnit(i, j, 1)) * TREE_CELL,
      z = (j + 0.15 + 0.7 * cellUnit(i, j, 2)) * TREE_CELL;
    if ((x - cx) ** 2 + (z - cz) ** 2 > r2) continue;
    const t = tileAt(land, x, z);
    if (!grows(t) || bare(t)) continue;
    const c = r.canopy[t]! / 255,
      want = c * (0.25 + 1.5 * groveAt(x, z));
    if (cellUnit(i, j, 3) >= want) continue;
    const form = formAt(r, t, cellUnit(i, j, 4), warmOf(r, t)),
      size = FORM_SIZE[form],
      k = 0.75 + 0.5 * cellUnit(i, j, 5);
    if (!free(x, z, size.w * k * 0.5)) continue;
    const g = facetAt(land, x, z, r.cover[t] === FLORA.reef),
      tone = 0.86 + 0.28 * cellUnit(i, j, 6),
      hue = (cellUnit(i, j, 7) - 0.5) * 0.12,
      brown = parched && form !== "conifer" && form !== "dead" && cellUnit(i, j, 8) < 0.55,
      base = brown ? mixRgb(formColor(p, form), p[ROW.straw]!, 0.75) : formColor(p, form),
      col: Rgb = [base[0] * tone * (1 + hue), base[1] * tone, base[2] * tone * (1 - hue)],
      yaw = cellUnit(i, j, 9) * Math.PI * 2;
    // (A stump of what was felled: short; else a snag standing dead.)
    const trunk =
      form === "dead" ? size.trunk * (cellUnit(i, j, 10) < 0.7 ? 0.25 : 1) * k : size.trunk * k;
    if (trunk > 0)
      put(
        out.trunks,
        x,
        g.y,
        z,
        Math.max(0.008, size.w * 0.12) * k,
        trunk,
        yaw,
        form === "dead" ? base : TRUNK,
      );
    if (size.crown !== "none") {
      // (A crown sits on its trunk; scrub low on the ground, a little into it.)
      const ch = size.h * k,
        foot = trunk > 0 ? g.y + trunk * 0.85 : g.y - ch * 0.25;
      put(size.crown === "cone" ? out.cones : out.balls, x, foot, z, size.w * k, ch, yaw, col);
    }
    out.trees++;
  }
  // Groves past the trees, out to where the far crowns alone are enough: a crown a cell, standing for a few trees, so
  // a wood does not end where the trees drawn one by one do (the far crowns are one to a tile or so).
  const g0 = reach * 0.97,
    g1 = reach * GROVE_OUT;
  let groves = 0;
  for (const [i, j] of rings(cx, cz, GROVE_CELL, g1, g0)) {
    if (++cells % STEP_CELLS === 0) yield;
    if (groves >= budget.groves) break;
    const x = (i + 0.1 + 0.8 * cellUnit(i, j, 61)) * GROVE_CELL,
      z = (j + 0.1 + 0.8 * cellUnit(i, j, 62)) * GROVE_CELL,
      d2 = (x - cx) ** 2 + (z - cz) ** 2;
    if (d2 > g1 * g1 || d2 < g0 * g0) continue;
    const t = tileAt(land, x, z);
    if (!grows(t) || bare(t)) continue;
    const c = r.canopy[t]! / 255;
    if (cellUnit(i, j, 63) >= c * (0.3 + 1.2 * groveAt(x, z))) continue;
    const form = formAt(r, t, cellUnit(i, j, 64), warmOf(r, t)),
      size = FORM_SIZE[form];
    if (size.crown === "none") continue;
    const k = (1.5 + 0.9 * cellUnit(i, j, 65)) * (form === "scrub" ? 0.8 : 1),
      w = size.w * k,
      h = size.h * k * 0.75;
    if (!free(x, z, w * 0.5)) continue;
    const g = facetAt(land, x, z, r.cover[t] === FLORA.reef),
      tone = 0.8 + 0.25 * cellUnit(i, j, 66),
      brown = parched && form !== "conifer" && form !== "dead" && cellUnit(i, j, 67) < 0.55,
      base = brown ? mixRgb(formColor(p, form), p[ROW.straw]!, 0.75) : formColor(p, form),
      // (A grove's crown stands on the ground: its trunks are under it, too small to be seen from here.)
      foot = g.y + (size.crown === "cone" ? size.trunk * k * 0.3 : size.trunk * k * 0.5);
    put(
      size.crown === "cone" ? out.cones : out.balls,
      x,
      foot,
      z,
      w,
      h + (size.crown === "cone" ? 0 : size.trunk * k * 0.3),
      cellUnit(i, j, 68) * Math.PI * 2,
      scale(base, tone),
    );
    groves++;
  }
  // Tufts of grass and low plants where the ground is open, near only.
  const tuftReach = Math.min(reach, 2.6),
    t2 = tuftReach * tuftReach;
  for (const [i, j] of rings(cx, cz, TUFT_CELL, tuftReach)) {
    if (++cells % STEP_CELLS === 0) yield;
    if (out.tufts.length >= budget.tufts) break;
    const x = (i + cellUnit(i, j, 21)) * TUFT_CELL,
      z = (j + cellUnit(i, j, 22)) * TUFT_CELL;
    if ((x - cx) ** 2 + (z - cz) ** 2 > t2) continue;
    const t = tileAt(land, x, z);
    if (land.water[t] !== 0 || bare(t)) continue;
    const cover = r.cover[t]!;
    if (cover === FLORA.ice || cover === FLORA.rock) continue;
    const open = Math.max(0, 1 - r.canopy[t]! / 255 - r.rock[t]! / 255),
      lush = r.lush[t]! / 255,
      // (Grass grows in tufts where there is rain for it; a desert's few.)
      want = open * (0.12 + 0.5 * lush + (cover === FLORA.marsh ? 0.3 : 0));
    if (cellUnit(i, j, 23) >= want) continue;
    if (!free(x, z, 0.01)) continue;
    const g = facetAt(land, x, z, false),
      grass = openGround(p, cover, Math.min(1, lush + 0.2)),
      tone = 0.8 + 0.35 * cellUnit(i, j, 24),
      k = 0.7 + 0.6 * cellUnit(i, j, 25),
      reed = cover === FLORA.marsh;
    put(
      out.tufts,
      x,
      g.y,
      z,
      0.022 * k,
      (reed ? 0.05 : 0.022) * k,
      cellUnit(i, j, 26) * 6.28,
      scale(grass, tone),
    );
  }
  // Stones where rock shows.
  for (const [i, j] of rings(cx, cz, STONE_CELL, reach)) {
    if (++cells % STEP_CELLS === 0) yield;
    if (out.stones.length >= budget.stones) break;
    const x = (i + cellUnit(i, j, 31)) * STONE_CELL,
      z = (j + cellUnit(i, j, 32)) * STONE_CELL;
    if ((x - cx) ** 2 + (z - cz) ** 2 > r2) continue;
    const t = tileAt(land, x, z);
    if (land.water[t] !== 0) continue;
    const k = r.rock[t]! / 255;
    if (cellUnit(i, j, 33) >= 0.04 + 0.7 * k) continue;
    const s = (0.02 + 0.05 * cellUnit(i, j, 34) * (0.5 + k)) * 1;
    if (!free(x, z, s * 0.6)) continue;
    const g = facetAt(land, x, z, false),
      grey = 0.8 + 0.35 * cellUnit(i, j, 35);
    put(
      out.stones,
      x,
      g.y,
      z,
      s,
      s * (0.5 + 0.4 * cellUnit(i, j, 36)),
      cellUnit(i, j, 37) * 6.28,
      scale(mixRgb(p[ROW.rock]!, p[ROW.coldSoil]!, 0.3), grey),
    );
  }
  // Patches of the ground's own colour, lighter and darker, bare soil and sand, lying on its facets.
  for (const [i, j] of rings(cx, cz, PATCH_CELL, reach)) {
    if (++cells % STEP_CELLS === 0) yield;
    if (out.patches.length >= budget.patches) break;
    const x = (i + cellUnit(i, j, 41)) * PATCH_CELL,
      z = (j + cellUnit(i, j, 42)) * PATCH_CELL;
    if ((x - cx) ** 2 + (z - cz) ** 2 > r2) continue;
    const t = tileAt(land, x, z);
    if (land.water[t] !== 0 || bare(t)) continue;
    if (cellUnit(i, j, 43) >= 0.7) continue;
    const w = 0.08 + 0.16 * cellUnit(i, j, 44);
    if (!free(x, z, w * 0.5)) continue;
    const cover = r.cover[t]!,
      lush = r.lush[t]! / 255,
      ground = openGround(p, cover, lush),
      u = cellUnit(i, j, 45),
      // (Lighter grass, darker grass, or bare soil showing through.)
      col =
        u < 0.4
          ? scale(ground, 1.1)
          : u < 0.8
            ? scale(mixRgb(ground, woodsShade(p, cover), 0.25), 0.92)
            : mixRgb(ground, cover === FLORA.hotDesert ? p[ROW.sand]! : p[ROW.coldSoil]!, 0.5),
      g = facetAt(land, x, z, false);
    out.patches.push({
      x,
      y: g.y,
      z,
      w,
      h: w * (0.5 + 0.5 * cellUnit(i, j, 46)),
      yaw: cellUnit(i, j, 47) * 6.28,
      r: col[0],
      g: col[1],
      b: col[2],
      nx: g.nx,
      ny: g.ny,
      nz: g.nz,
    });
  }
  return out;
}

/** A land's map's growth and whether its woods are browned, as the land's scene plants them (render/region.ts plantTrees). */
export function landFloraOf(frame: FrameMessage): [FloraLand | null, boolean] {
  return [floraLandOf(frame), !!(frame.meta as { woodsParched?: boolean }).woodsParched];
}
