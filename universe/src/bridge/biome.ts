// What grows on a land, tile by tile (asked 2026-11-20: "i feel like the lands dont look realistic enough in terms of nature
// and vegatation etc yk, but ik this game is to optimized and lightweitght"). Read from what the world keeps of each tile and
// nothing painted by hand: its warmth and rain (the climate's, in its liquid's degrees as the biome was classed by), its
// height and how steep it lies, its soil, how near running or standing water is, the biome it was made with and the one its
// woods have come to (E1: a land's woods are one share, its map's tiles turned open from the edge in, or grown over), how much
// of what stood stands, a run of dry years (woods browned), whether anything took hold at all, and a people of the water's
// seabed. What the reading says is how much of each tile is under trees (and which kinds stand there), under grass (and how
// green), bare rock, and wet ground; the eye draws it in the world's own colours (view/flora.ts), so another chemistry's
// plants are never Earth's green. Pure: the same tiles, the same reading; built once for each land's map and its woods.

/** What covers a tile: the ground's own kind, as its warmth, rain, height and water make it. */
export const FLORA = {
  none: 0,
  ice: 1,
  rock: 2,
  alpine: 3,
  tundra: 4,
  taiga: 5,
  mixed: 6,
  broadleaf: 7,
  temperateRain: 8,
  steppe: 9,
  meadow: 10,
  savanna: 11,
  dryForest: 12,
  rainforest: 13,
  hotDesert: 14,
  coldDesert: 15,
  marsh: 16,
  cleared: 17,
  reef: 18,
} as const;
export type FloraCover = (typeof FLORA)[keyof typeof FLORA];
export const FLORA_NAMES: readonly string[] = [
  "water",
  "ice",
  "bare rock",
  "alpine meadow",
  "tundra",
  "taiga",
  "mixed woods",
  "broadleaf woods",
  "temperate rainforest",
  "steppe",
  "meadow",
  "savanna",
  "dry forest",
  "rainforest",
  "hot desert",
  "cold desert",
  "marsh",
  "felled ground",
  "weed beds",
];

/** The kinds of what stands: needles, broad crowns, palms, flat-topped thorn trees, tall emergents, scrub, and the dead (stumps, snags). */
export const TREE_FORMS = [
  "conifer",
  "broadleaf",
  "palm",
  "flat",
  "tall",
  "scrub",
  "dead",
  "kelp",
] as const;
export type TreeForm = (typeof TREE_FORMS)[number];

/**
 * Of what stands on each cover, the share of each form (TREE_FORMS' order; each row sums to one). The cold has needles and
 * scrub, the warm wet broad crowns and emergents, the dry tropics thorn trees, the desert scrub (palms only by water: a bank's
 * own row), what was felled its stumps among the scrub coming back.
 */
const MIX: Readonly<Record<number, readonly number[]>> = {
  [FLORA.alpine]: [0.2, 0, 0, 0, 0, 0.8, 0, 0],
  [FLORA.tundra]: [0.08, 0, 0, 0, 0, 0.92, 0, 0],
  [FLORA.taiga]: [0.86, 0.14, 0, 0, 0, 0, 0, 0],
  [FLORA.mixed]: [0.5, 0.45, 0, 0, 0, 0.05, 0, 0],
  [FLORA.broadleaf]: [0.12, 0.83, 0, 0, 0, 0.05, 0, 0],
  [FLORA.temperateRain]: [0.6, 0.1, 0, 0, 0.3, 0, 0, 0],
  [FLORA.steppe]: [0.05, 0.5, 0, 0, 0, 0.45, 0, 0],
  [FLORA.meadow]: [0.1, 0.7, 0, 0, 0, 0.2, 0, 0],
  [FLORA.savanna]: [0, 0.1, 0.05, 0.6, 0, 0.25, 0, 0],
  [FLORA.dryForest]: [0, 0.45, 0.15, 0.3, 0, 0.1, 0, 0],
  [FLORA.rainforest]: [0, 0.15, 0.22, 0, 0.63, 0, 0, 0],
  [FLORA.hotDesert]: [0, 0, 0.05, 0.1, 0, 0.85, 0, 0],
  [FLORA.coldDesert]: [0, 0, 0, 0, 0, 1, 0, 0],
  [FLORA.marsh]: [0.05, 0.5, 0, 0, 0, 0.45, 0, 0],
  [FLORA.cleared]: [0, 0.1, 0, 0, 0, 0.5, 0.4, 0],
  [FLORA.reef]: [0, 0, 0, 0, 0, 0, 0, 1],
};
const NONE: readonly number[] = [0, 0, 0, 0, 0, 0, 0, 0];
/** By water in a dry land: palms where it is hot, broad crowns (willow, poplar) where it is not. */
const OASIS_HOT: readonly number[] = [0, 0.1, 0.65, 0.05, 0, 0.2, 0, 0];
const OASIS: readonly number[] = [0, 0.7, 0, 0, 0, 0.3, 0, 0];

/** The share of each form that stands on a tile of a cover (`bank`: by running or standing water; `warm`: its warmth). */
export function floraMix(cover: number, bank = false, warm = 10): readonly number[] {
  if (bank && (cover === FLORA.hotDesert || cover === FLORA.savanna || cover === FLORA.steppe))
    return warm >= 16 ? OASIS_HOT : OASIS;
  return MIX[cover] ?? NONE;
}

/** The facts of a land's tiles the reading reads (each array a tile, row by row). */
export type FloraFacts = {
  readonly size: number;
  readonly tileKm: number;
  /** Metres above (below) the sea. */
  readonly elevation: ArrayLike<number>;
  /** The year's mean warmth, in its world's liquid's degrees (as its biome was classed). */
  readonly warm: ArrayLike<number>;
  /** Rain in a year, mm. */
  readonly rain: ArrayLike<number>;
  /** 0 land, 1 sea, 2 river, 3 lake. */
  readonly water: ArrayLike<number>;
  /** Its biome now (gen's BIOME codes), its woods as they stand (E1). */
  readonly biome: ArrayLike<number>;
  /** Its biome as the world was made (null: as now). */
  readonly wild?: ArrayLike<number> | null;
  /** Its soil, 0 … 1. */
  readonly fertility: ArrayLike<number>;
};

export type FloraOptions = {
  /** How much of what stood of its woods stands (E1), 0 … 1. */
  readonly stands?: number;
  /** Its woods browned by a run of dry years. */
  readonly parched?: boolean;
  /** Nothing took hold on its world: bare ground. */
  readonly lifeless?: boolean;
  /** A people of the water's: its sea's shelf grows weed beds. */
  readonly undersea?: boolean;
};

/** A land's reading, a byte a tile each (0 … 255 for shares). */
export type FloraTiles = {
  readonly size: number;
  /** FLORA, the ground's own kind. */
  readonly cover: Uint8Array;
  /** How much of it stands under trees (or weed, on the seabed). */
  readonly canopy: Uint8Array;
  /** How much is bare rock. */
  readonly rock: Uint8Array;
  /** How wet its ground is: a bank's, a marsh's. */
  readonly wet: Uint8Array;
  /** How green its grass is: 255 lush, 0 straw. */
  readonly lush: Uint8Array;
};

// gen's BIOME codes, as numbers: bridge reads no gen.
const B = {
  seaIce: 3,
  ice: 4,
  tundra: 5,
  boreal: 6,
  coldDesert: 7,
  steppe: 8,
  temperate: 9,
  temperateRain: 10,
  hotDesert: 11,
  savanna: 12,
  dryForest: 13,
  rainforest: 14,
  alpine: 15,
} as const;
const FORESTS = new Set<number>([
  B.boreal,
  B.temperate,
  B.temperateRain,
  B.dryForest,
  B.rainforest,
]);

/** 0 below `a`, 1 above `b`, smooth between (a > b reverses it). */
function ramp(x: number, a: number, b: number): number {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
}

/** A tile's own number, the same each time: for what varies from tile to tile with no cause the reading keeps. */
export function tileUnit(t: number, k: number): number {
  let h = Math.imul(t + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * Each tile of a land read for what grows there. How steep it lies is the most its height differs from any neighbour's over
 * the tile's breadth; rock shows where a slope is too steep to hold soil, and above the line where trees can grow. Woods
 * stand as thick as their rain lets them, thinning toward the cold edge where they give out; the open grounds keep a few
 * trees (more along water: gallery woods, an oasis's palms); flat ground by water in a wet land is marsh; what was woods and
 * is open now (felled, burned, dried out) is stumps among scrub.
 */
export function floraRead(f: FloraFacts, o: FloraOptions = {}): FloraTiles {
  const n = f.size * f.size,
    size = f.size,
    cover = new Uint8Array(n),
    canopy = new Uint8Array(n),
    rock = new Uint8Array(n),
    wet = new Uint8Array(n),
    lush = new Uint8Array(n),
    stands = Math.max(0, Math.min(1, o.stands ?? 1)),
    thin = 0.55 + 0.45 * stands,
    byte = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  for (let t = 0; t < n; t++) {
    const w = f.water[t]!,
      e = f.elevation[t]!,
      T = f.warm[t]!,
      P = f.rain[t]!,
      b = f.biome[t]!;
    if (w !== 0) {
      // (A people of the water's seabed: weed beds on the shallow, warm enough shelf.)
      if (o.undersea && w === 1 && e > -200 && T > -1 && !o.lifeless) {
        cover[t] = FLORA.reef;
        canopy[t] = byte(0.25 + 0.5 * ramp(e, -200, -20) * ramp(T, -1, 12));
        lush[t] = 255;
      }
      continue;
    }
    const i = t % size,
      j = (t - i) / size;
    let slope = 0,
      bank = 0,
      coast = false;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = i + di,
          c = j + dj;
        if (a < 0 || c < 0 || a >= size || c >= size) continue;
        const m = c * size + a,
          wm = f.water[m]!;
        slope = Math.max(slope, Math.abs(Math.max(0, f.elevation[m]!) - Math.max(0, e)));
        if (wm === 2 || wm === 3) bank = 1;
        else if (wm === 1) coast = true;
      }
    // (Metres of rise a kilometre.)
    slope /= f.tileKm;
    const steep = ramp(slope, 140, 520),
      // (Where trees give out for cold: the boreal woods' own edge, as the climate classes it.)
      treeLine = ramp(T, -1, 3),
      green =
        ramp(P, 180, 900) *
        ramp(T, -6, 2) *
        (1 - 0.55 * ramp(T, 21, 29) * (1 - ramp(P, 900, 1600))),
      wild = f.wild?.[t] ?? b;
    let c: number = FLORA.none,
      trees = 0,
      bare = steep * 0.85,
      damp = bank ? 0.55 : 0;
    if (o.lifeless) {
      c = b === B.ice || b === B.seaIce ? FLORA.ice : T < 6 ? FLORA.coldDesert : FLORA.hotDesert;
      bare = Math.max(bare, 0.3 + 0.4 * tileUnit(t, 1));
      damp = 0;
    } else
      switch (b) {
        case B.ice:
        case B.seaIce:
          c = FLORA.ice;
          bare = Math.max(bare, 0.2);
          break;
        case B.alpine:
          // Meadow where it is least cold, rock and scree above.
          c = FLORA.alpine;
          bare = Math.max(bare, 0.3 + 0.55 * ramp(T, 1, -8));
          trees = 0.05 * ramp(T, -4, 2);
          break;
        case B.tundra:
          c = FLORA.tundra;
          trees = 0.02 + 0.08 * ramp(T, -6, 0) * ramp(P, 200, 500);
          bare = Math.max(bare, 0.15 * ramp(P, 300, 150));
          break;
        case B.boreal:
          c = FLORA.taiga;
          trees = (0.5 + 0.35 * ramp(P, 400, 900)) * treeLine;
          break;
        case B.temperate:
          c = T < 10 ? FLORA.mixed : FLORA.broadleaf;
          trees = 0.58 + 0.3 * ramp(P, 550, 1300);
          break;
        case B.temperateRain:
          c = FLORA.temperateRain;
          trees = 0.9;
          break;
        case B.steppe:
          // (Grass long enough and green enough to be a meadow where it rains well and is not hot.)
          c = P > 460 && T < 17 ? FLORA.meadow : FLORA.steppe;
          trees = c === FLORA.meadow ? 0.07 : 0.025;
          break;
        case B.savanna:
          c = FLORA.savanna;
          trees = 0.07 + 0.13 * ramp(P, 400, 1000);
          break;
        case B.dryForest:
          c = FLORA.dryForest;
          trees = 0.45 + 0.25 * ramp(P, 1000, 1420);
          break;
        case B.rainforest:
          c = FLORA.rainforest;
          trees = 0.92;
          break;
        case B.hotDesert:
          c = FLORA.hotDesert;
          trees = 0.006 + 0.04 * ramp(P, 40, 300);
          bare = Math.max(bare, 0.2 + 0.25 * ramp(slope, 40, 200));
          damp = bank ? 0.35 : 0;
          break;
        case B.coldDesert:
          c = FLORA.coldDesert;
          trees = 0.01 + 0.04 * ramp(P, 60, 260);
          bare = Math.max(bare, 0.25 + 0.3 * ramp(slope, 40, 200));
          damp = bank ? 0.35 : 0;
          break;
        default:
          c = FLORA.steppe;
          trees = 0.03;
      }
    if (!o.lifeless && c !== FLORA.ice) {
      if (FORESTS.has(b)) {
        // (Fewer trees drawn where the woods have shrunk, not the same thicker: E1. A wood come to open ground lately is young.)
        trees *= thin * (FORESTS.has(wild) ? 1 : 0.7);
      } else if (FORESTS.has(wild)) {
        // Woods that stood here and are gone: stumps and the scrub coming back.
        c = FLORA.cleared;
        trees = 0.12 + 0.08 * tileUnit(t, 2);
      }
      // By water in a dry land: gallery woods, an oasis.
      if (
        bank &&
        (c === FLORA.steppe ||
          c === FLORA.savanna ||
          c === FLORA.hotDesert ||
          c === FLORA.coldDesert)
      )
        trees += c === FLORA.steppe ? 0.22 : c === FLORA.savanna ? 0.25 : 0.18;
      // Flat, low ground by water where it rains well enough: marsh.
      const flat = 1 - ramp(slope, 6, 30),
        marsh =
          (bank ? 1 : coast ? 0.35 : 0) *
          flat *
          ramp(P, 450, 900) *
          ramp(T, -2, 3) *
          (1 - ramp(e, 120, 400));
      if (
        marsh > 0.55 &&
        tileUnit(t, 3) < marsh - 0.4 &&
        c !== FLORA.hotDesert &&
        c !== FLORA.coldDesert
      ) {
        c = FLORA.marsh;
        trees = Math.min(trees, 0.12 + 0.1 * tileUnit(t, 4));
        damp = Math.max(damp, 0.85);
      }
      // Rock where it is too steep for soil holds no wood.
      trees *= 1 - 0.85 * steep;
      if (bare > 0.7 && c !== FLORA.alpine && c !== FLORA.marsh) c = FLORA.rock;
    }
    // (From tile to tile a woods' thickness varies a little, as a real one's does: clearings and thickets.)
    trees *= 0.85 + 0.3 * tileUnit(t, 5);
    cover[t] = c;
    canopy[t] = byte(Math.min(0.96, trees));
    rock[t] = byte(Math.min(1 - Math.min(0.96, trees) * 0.5, bare));
    wet[t] = byte(damp * (o.lifeless ? 0 : 1));
    lush[t] = byte(o.lifeless ? 0 : Math.min(1, green + 0.35 * damp));
    if (o.parched && !o.lifeless) lush[t] = Math.round(lush[t]! * 0.45);
  }
  return { size, cover, canopy, rock, wet, lush };
}

/** The reading packed as one array, five bytes a tile (cover, canopy, rock, wet, lush): as a land's map carries it. */
export function floraPack(r: FloraTiles): Uint8Array {
  const n = r.cover.length,
    out = new Uint8Array(n * 5);
  for (let t = 0; t < n; t++) {
    out[t * 5] = r.cover[t]!;
    out[t * 5 + 1] = r.canopy[t]!;
    out[t * 5 + 2] = r.rock[t]!;
    out[t * 5 + 3] = r.wet[t]!;
    out[t * 5 + 4] = r.lush[t]!;
  }
  return out;
}

/** A packed reading taken apart again (no copy: views on the packed bytes are not kept, each its own array). */
export function floraUnpack(packed: Uint8Array, size: number): FloraTiles {
  const n = size * size,
    cover = new Uint8Array(n),
    canopy = new Uint8Array(n),
    rock = new Uint8Array(n),
    wet = new Uint8Array(n),
    lush = new Uint8Array(n);
  for (let t = 0; t < n && t * 5 + 4 < packed.length; t++) {
    cover[t] = packed[t * 5]!;
    canopy[t] = packed[t * 5 + 1]!;
    rock[t] = packed[t * 5 + 2]!;
    wet[t] = packed[t * 5 + 3]!;
    lush[t] = packed[t * 5 + 4]!;
  }
  return { size, cover, canopy, rock, wet, lush };
}

/**
 * A window of a land's reading about one tile (its town's ground: TownSite's `wet` is read over the same squares): the tiles
 * from `half` before it to `half` after it each way, five bytes each as floraPack packs them, those past the map's edge its
 * nearest. `m`: metres a tile on the town's own ground.
 */
export type FloraWindow = {
  readonly m: number;
  readonly half: number;
  /** (2 half + 1)² tiles, row by row, five bytes each. */
  readonly tiles: readonly number[];
};

export function floraWindow(
  r: FloraTiles,
  i: number,
  j: number,
  half: number,
  m: number,
): FloraWindow {
  const tiles: number[] = [],
    s = r.size;
  for (let dj = -half; dj <= half; dj++)
    for (let di = -half; di <= half; di++) {
      const a = Math.max(0, Math.min(s - 1, i + di)),
        b = Math.max(0, Math.min(s - 1, j + dj)),
        t = b * s + a;
      tiles.push(r.cover[t]!, r.canopy[t]!, r.rock[t]!, r.wet[t]!, r.lush[t]!);
    }
  return { m, half, tiles };
}
