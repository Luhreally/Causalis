// Where a drawn figure meets the ground (asked 2026-11-26: "why are aliens in the ground!!! ... they shouldnt be phasing thru
// the ground"): each part of a figure is drawn from one of four meshes (rules/figure.ts PartShape), each about its own middle, as
// render/batch.ts makes them; posed, a part reaches below its middle by what its turn and its sizes carry down. A figure's lowest
// point is the least of its parts', and it is set on the surface it stands on: whatever its body (an upright ape, a low body
// along the ground on its legs, a coil, a mantle), standing, striding, sat or lying. A pure reading of the view's own: no world
// is touched.
import type { PartShape } from "./figure.ts";
import { FIGURE_CAPSULE } from "./figure.ts";

/** A part's shape as a small number (the posers keep one a part). */
export const SHAPE_CODE: Readonly<Record<PartShape, number>> = {
  box: 0,
  cylinder: 1,
  cone: 2,
  capsule: 3,
};

/** The capsule mesh's straight length's half and its ends' radius (its own units: a part's sizes multiply them). */
const CAP_HALF = FIGURE_CAPSULE.height / 2 - FIGURE_CAPSULE.radius,
  CAP_R = FIGURE_CAPSULE.radius;

/**
 * How far a posed part reaches below its middle: `m5` and `m9`, what its matrix carries of its own up and its own forward into
 * the world's up (a part is turned on its yaw, about the world's up, and pitched about its own across, so its across carries
 * none). A box and a cylinder (its round across and forward, a half each way) alike; a cone its base's rim or its point; a
 * capsule its straight length and the round of its end.
 */
export function partBelow(code: number, m5: number, m9: number): number {
  const a5 = m5 < 0 ? -m5 : m5,
    a9 = m9 < 0 ? -m9 : m9;
  if (code === 3) return CAP_HALF * a5 + CAP_R * Math.sqrt(m5 * m5 + m9 * m9);
  if (code === 2) return Math.max(0.5 * m5 + 0.5 * a9, -0.5 * m5);
  return 0.5 * (a5 + a9);
}

/**
 * The lowest point of a figure posed into sixteen-number matrices (column-major, as InstancedBatch lays them: [12..14] its
 * middle), `parts` of them from `o`, each part's shape code from `codes`: the world's height its lowest point stands at.
 * A part drawn at no size (a member lost, one not yet come) is passed over. Infinity: nothing of it drawn.
 */
export function lowestOf(
  m: ArrayLike<number>,
  o: number,
  parts: number,
  codes: ArrayLike<number>,
): number {
  let lo = Infinity;
  for (let pi = 0; pi < parts; pi++) {
    const at = o + pi * 16,
      m5 = m[at + 5]!,
      m9 = m[at + 9]!;
    if (m[at]! === 0 && m5 === 0 && m9 === 0) continue;
    const y = m[at + 13]! - partBelow(codes[pi]!, m5, m9);
    if (y < lo) lo = y;
  }
  return lo;
}

/**
 * The same of a part laid as a place ([x, y, z, sx, sy, sz, yaw, pitch], as InstancedBatch.set takes it): how far below its
 * middle it reaches, of its shape code.
 */
export function placeBelow(code: number, sy: number, sz: number, pitch: number): number {
  return partBelow(code, Math.cos(pitch) * sy, -Math.sin(pitch) * sz);
}

/** A drawn figure as the count of figures on the ground and in one another reads it (units, as the town draws: render/village.ts M). */
export type FootedFigure = {
  /** Its parts' boxes about the world's axes: middle and half-extent, six numbers a part. */
  readonly boxes: Float32Array;
  /** Its parts as drawn, turned as they are: middle and three half-axes, twelve numbers a part (partFrame). */
  readonly frames: Float32Array;
  /** Its lowest point as drawn and the surface it stands on. */
  readonly lowest: number;
  readonly surface: number;
  /** How high it is in the air at a hop as it plays or dances (units; its lowest point stands so far over the surface). */
  readonly hop?: number;
  /**
   * The ground it is drawn set on now, where that is eased onto the surface (units; absent: the surface): a step up a kerb or
   * down off a yard as it is taken.
   */
  readonly settling?: number;
  /** Where it stands, and whether lying. */
  readonly x: number;
  readonly z: number;
  readonly lying: boolean;
};

/** A part's box about the world's axes from its matrix (a box's corners; a rounder part lies within it). */
export function partBox(m: ArrayLike<number>, at: number, out: Float32Array, o: number): void {
  out[o] = m[at + 12]!;
  out[o + 1] = m[at + 13]!;
  out[o + 2] = m[at + 14]!;
  out[o + 3] = 0.5 * (Math.abs(m[at]!) + Math.abs(m[at + 4]!) + Math.abs(m[at + 8]!));
  out[o + 4] = 0.5 * (Math.abs(m[at + 1]!) + Math.abs(m[at + 5]!) + Math.abs(m[at + 9]!));
  out[o + 5] = 0.5 * (Math.abs(m[at + 2]!) + Math.abs(m[at + 6]!) + Math.abs(m[at + 10]!));
}

/** A part's box as drawn from its matrix: its middle and its three half-axes, turned and sized as it is (twelve numbers). */
export function partFrame(m: ArrayLike<number>, at: number, out: Float32Array, o: number): void {
  out[o] = m[at + 12]!;
  out[o + 1] = m[at + 13]!;
  out[o + 2] = m[at + 14]!;
  for (let k = 0; k < 3; k++) {
    out[o + 3 + 3 * k] = 0.5 * m[at + 4 * k]!;
    out[o + 4 + 3 * k] = 0.5 * m[at + 4 * k + 1]!;
    out[o + 5 + 3 * k] = 0.5 * m[at + 4 * k + 2]!;
  }
}

/**
 * Whether two parts' boxes (partFrame's) are in one another, each taken at `inner` of itself: no plane between them, of the
 * fifteen two boxes can be parted by (each one's faces, and each edge of one across each of the other's).
 */
export function framesMeet(
  a: Float32Array,
  ao: number,
  b: Float32Array,
  bo: number,
  inner: number,
): boolean {
  const tx = b[bo]! - a[ao]!,
    ty = b[bo + 1]! - a[ao + 1]!,
    tz = b[bo + 2]! - a[ao + 2]!;
  // (How far a box reaches along an axis, and whether the gap between the middles along it is wider than both.)
  const apart = (x: number, y: number, z: number): boolean => {
    const len = Math.hypot(x, y, z);
    if (len < 1e-9) return false;
    let ra = 0,
      rb = 0;
    for (let k = 0; k < 3; k++) {
      ra += Math.abs(a[ao + 3 + 3 * k]! * x + a[ao + 4 + 3 * k]! * y + a[ao + 5 + 3 * k]! * z);
      rb += Math.abs(b[bo + 3 + 3 * k]! * x + b[bo + 4 + 3 * k]! * y + b[bo + 5 + 3 * k]! * z);
    }
    return Math.abs(tx * x + ty * y + tz * z) >= inner * (ra + rb);
  };
  for (let k = 0; k < 3; k++) {
    if (apart(a[ao + 3 + 3 * k]!, a[ao + 4 + 3 * k]!, a[ao + 5 + 3 * k]!)) return false;
    if (apart(b[bo + 3 + 3 * k]!, b[bo + 4 + 3 * k]!, b[bo + 5 + 3 * k]!)) return false;
  }
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      const ux = a[ao + 3 + 3 * i]!,
        uy = a[ao + 4 + 3 * i]!,
        uz = a[ao + 5 + 3 * i]!,
        vx = b[bo + 3 + 3 * j]!,
        vy = b[bo + 4 + 3 * j]!,
        vz = b[bo + 5 + 3 * j]!;
      if (apart(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)) return false;
    }
  return true;
}

/**
 * A figure's body across the ground as it stands at rest (its own units, before its size; `x` across it, `z` the way it
 * faces): the middle of what its parts cover, and how far they reach from that middle — the round a drawn figure is kept from
 * others by. (A long body stands on its legs, not its middle: its round is about its middle, not where it stands.)
 */
export function restBody(parts: readonly { x: number; z: number; sx: number; sz: number }[]): {
  x: number;
  z: number;
  r: number;
} {
  let x0 = Infinity,
    x1 = -Infinity,
    z0 = Infinity,
    z1 = -Infinity;
  for (const p of parts) {
    x0 = Math.min(x0, p.x - p.sx / 2);
    x1 = Math.max(x1, p.x + p.sx / 2);
    z0 = Math.min(z0, p.z - p.sz / 2);
    z1 = Math.max(z1, p.z + p.sz / 2);
  }
  if (!(x1 >= x0)) return { x: 0, z: 0, r: 0 };
  const x = (x0 + x1) / 2,
    z = (z0 + z1) / 2;
  let r = 0;
  for (const p of parts) r = Math.max(r, Math.hypot(p.x - x, p.z - z) + Math.hypot(p.sx, p.sz) / 2);
  return { x, z, r };
}

/** What the count found: figures off the ground or in it, figures in one another, in what stands solid, in a tree's trunk. */
export type FeetTally = {
  figures: number;
  /** Lowest point more than the tolerance below the surface, or above it (not at a hop: a hop is within a body's own bob). */
  sunk: number;
  floating: number;
  /** Off the surface only as a step up or down is taken (set on the ground it is eased onto: `settling`). */
  stepping: number;
  /** The deepest sunk and the highest floating (metres). */
  deepest: number;
  highest: number;
  /** Pairs of figures with parts in one another (each part's box taken at `inner` of itself, so touching is not in). */
  pairs: number;
  /** Figures with a part into a solid (a building, a block, a wall, a court's bench, a stone) or into a tree's trunk. */
  inSolid: number;
  inTree: number;
  /** The first pairs found in one another: the figures' places in those given, and how far apart they stand (metres). */
  met: { i: number; j: number; apart: number }[];
  /** The first found in a solid or a trunk (their places in those given). */
  stuck: { i: number; tree: boolean }[];
};

/**
 * Count over the figures drawn (units; `metre` units a metre): those whose lowest point is off the surface they stand on by
 * more than `tolerance` metres, the pairs whose parts are in one another, and those with a part in a solid (`intoSolid`:
 * whether a part `half` metres across each way about a point reaches more than 5 cm into what stands solid) or a trunk
 * ({x, z, r} metres).
 */
export function feetTally(
  figures: readonly FootedFigure[],
  metre: number,
  tolerance: number,
  intoSolid: ((x: number, z: number, half: number) => boolean) | null,
  trunks: readonly { readonly x: number; readonly z: number; readonly r: number }[],
  inner = 0.8,
): FeetTally {
  const t: FeetTally = {
    figures: figures.length,
    sunk: 0,
    floating: 0,
    stepping: 0,
    deepest: 0,
    highest: 0,
    pairs: 0,
    inSolid: 0,
    inTree: 0,
    met: [],
    stuck: [],
  };
  let reach = 0;
  for (const f of figures) {
    const off = (f.lowest - f.surface - (f.hop ?? 0)) / metre;
    if (
      Math.abs(off) > tolerance &&
      f.settling !== undefined &&
      Math.abs(f.lowest - f.settling - (f.hop ?? 0)) / metre <= tolerance
    )
      t.stepping++;
    else if (off < -tolerance) {
      t.sunk++;
      t.deepest = Math.max(t.deepest, -off);
    } else if (off > tolerance) {
      t.floating++;
      t.highest = Math.max(t.highest, off);
    }
    for (let o = 0; o < f.boxes.length; o += 6)
      reach = Math.max(
        reach,
        Math.hypot(f.boxes[o]! - f.x, f.boxes[o + 2]! - f.z) +
          Math.max(f.boxes[o + 3]!, f.boxes[o + 5]!),
      );
  }
  // Pairs: found by cells two reaches across, each pair's parts against each other's.
  const cell = Math.max(1e-6, 2 * reach),
    cells = new Map<string, number[]>();
  figures.forEach((f, i) => {
    const key = `${Math.floor(f.x / cell)},${Math.floor(f.z / cell)}`;
    (cells.get(key) ?? cells.set(key, []).get(key)!).push(i);
  });
  // (Each pair of parts by their boxes about the world's axes first, then as drawn, turned.)
  const meet = (f: FootedFigure, g: FootedFigure): boolean => {
    const a = f.boxes,
      b = g.boxes;
    for (let p = 0, pp = 0; p < a.length; p += 6, pp += 12) {
      if (!a[p + 3] && !a[p + 4]) continue;
      for (let q = 0, qq = 0; q < b.length; q += 6, qq += 12) {
        if (!b[q + 3] && !b[q + 4]) continue;
        if (
          Math.abs(a[p]! - b[q]!) < a[p + 3]! + b[q + 3]! &&
          Math.abs(a[p + 1]! - b[q + 1]!) < a[p + 4]! + b[q + 4]! &&
          Math.abs(a[p + 2]! - b[q + 2]!) < a[p + 5]! + b[q + 5]! &&
          framesMeet(f.frames, pp, g.frames, qq, inner)
        )
          return true;
      }
    }
    return false;
  };
  // (Trunks by cells of ten metres, each looked for about a part's own.)
  const TREE_CELL = 10,
    groves = new Map<string, { readonly x: number; readonly z: number; readonly r: number }[]>();
  for (const k of trunks) {
    const key = `${Math.floor(k.x / TREE_CELL)},${Math.floor(k.z / TREE_CELL)}`;
    (groves.get(key) ?? groves.set(key, []).get(key)!).push(k);
  }
  const inTrunk = (x: number, z: number, half: number): boolean => {
    const i = Math.floor(x / TREE_CELL),
      j = Math.floor(z / TREE_CELL);
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++)
        for (const k of groves.get(`${i + a},${j + b}`) ?? [])
          if (k.r + half - Math.hypot(x - k.x, z - k.z) > 0.05) return true;
    return false;
  };
  figures.forEach((f, i) => {
    const cx = Math.floor(f.x / cell),
      cz = Math.floor(f.z / cell);
    for (let ox = -1; ox <= 1; ox++)
      for (let oz = -1; oz <= 1; oz++)
        for (const j of cells.get(`${cx + ox},${cz + oz}`) ?? []) {
          if (j <= i) continue;
          const g = figures[j]!;
          const apart = Math.hypot(f.x - g.x, f.z - g.z);
          if (apart < cell && meet(f, g)) {
            t.pairs++;
            if (t.met.length < 8) t.met.push({ i, j, apart: apart / metre });
          }
        }
    // In a solid, or a trunk: a part whose middle lies within it by more than half its narrower breadth less 5 cm.
    let solid = false,
      tree = false;
    for (let o = 0; o < f.boxes.length && !(solid && tree); o += 6) {
      if (!f.boxes[o + 3] && !f.boxes[o + 4]) continue;
      const x = f.boxes[o]! / metre,
        z = f.boxes[o + 2]! / metre,
        half = (inner * Math.min(f.boxes[o + 3]!, f.boxes[o + 5]!)) / metre;
      if (!solid && intoSolid?.(x, z, half)) solid = true;
      if (!tree && groves.size && inTrunk(x, z, half)) tree = true;
    }
    if (solid) t.inSolid++;
    if (tree) t.inTree++;
    if ((solid || tree) && t.stuck.length < 8) t.stuck.push({ i, tree });
  });
  return t;
}

/**
 * Set a figure laid as places (`stride` numbers a part from `o`, [x, y, z, sx, sy, sz, yaw, pitch] first, `parts` of them; its
 * parts' shape codes `codes`) on `surface`: its lowest point there, each part raised or lowered alike. The shift made.
 */
export function groundPlaces(
  d: { [i: number]: number; readonly length: number },
  o: number,
  parts: number,
  codes: ArrayLike<number>,
  surface: number,
  stride = 8,
): number {
  let lo = Infinity;
  for (let pi = 0; pi < parts; pi++) {
    const at = o + pi * stride;
    if (!d[at + 3] && !d[at + 4]) continue;
    lo = Math.min(lo, d[at + 1]! - placeBelow(codes[pi]!, d[at + 4]!, d[at + 5]!, d[at + 7]!));
  }
  if (!Number.isFinite(lo)) return 0;
  const shift = surface - lo;
  for (let pi = 0; pi < parts; pi++) d[o + pi * stride + 1] = d[o + pi * stride + 1]! + shift;
  return shift;
}

/**
 * How high a figure laid flat on its back by its parts' forward reach (each part's middle `along` times its forward offset up,
 * pitched a quarter turn: a fallen one as the war views lay them) is raised so its lowest point is on the ground, at scale `s`:
 * a low body's hind parts, behind its middle, would else lie under it.
 */
export function lyingLift(
  parts: readonly {
    readonly shape: PartShape;
    readonly z: number;
    readonly sy: number;
    readonly sz: number;
  }[],
  s: number,
  along = 1,
): number {
  let lo = Infinity;
  for (const p of parts) {
    if (!p.sy && !p.sz) continue;
    lo = Math.min(
      lo,
      p.z * s * along - placeBelow(SHAPE_CODE[p.shape], p.sy * s, p.sz * s, Math.PI / 2),
    );
  }
  return Number.isFinite(lo) ? -lo : 0;
}

/**
 * A piece of what is laid on the ground (metres, as view/town.ts TownParts holds them: its middle, its sizes, its turn), a box
 * or a round one (a disc, a cylinder: its sizes across it).
 */
export type LaidPiece = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly yaw: number;
  readonly round: boolean;
};

/** The highest top of what is laid on the ground that one steps up onto (metres): past it, a thing is stood about, not on. */
export const STEP_UP = 0.8;
/** What rises from the ground to be stood about: from no higher than this (metres), and no broader each way from its middle. */
const STAND_FROM = 0.5,
  STAND_MOST = 4;
/** The most cells a piece is found by: past it, it is looked at wherever one stands. */
const WIDE_CELLS = 4096;
/** The cells what is laid is found by (metres across). */
const TOP_CELL = 8;

/**
 * What is laid on a town's ground, its tops (metres): the surface one stands on at a point is the highest top laid there that
 * can be stepped onto (STEP_UP: a street a hand over the land, its yards a curb over that, its square, its worn ways, a
 * temple's low steps), over the land's own ground; what rises higher from the ground (a well's curb, a column, a cross, a
 * stronghold's wall) stands in the way. Found by cells, each piece in every cell it covers.
 */
export class GroundTops {
  /** Each piece: its middle, its turn's cosine and sine, its half sizes across and along, its top, whether round. */
  private readonly flat: number[] = [];
  private readonly tall: number[] = [];
  private readonly flatCells = new Map<number, number[]>();
  /** The great pieces, looked at wherever one stands (each its place in `flat` or `tall`). */
  private readonly wideFlat: number[] = [];
  private readonly wideTall: number[] = [];
  private readonly tallCells = new Map<number, number[]>();
  /** How many pieces were laid (the look tools). */
  readonly laid: { flat: number; tall: number };

  constructor(pieces: Iterable<LaidPiece>) {
    for (const p of pieces) {
      const top = p.y + p.sy / 2,
        bottom = p.y - p.sy / 2;
      if (!(p.sx > 0 && p.sz > 0)) continue;
      // (Off the ground altogether, a roof, a sign: neither stood on nor in the way. A great thing rising from it, a hall, a
      // dome, a stronghold's keep, stands on its own lots, which its walkers keep off already: only what stands free on its
      // streets and square, a well's curb, a column, a cross, a post, is stood about here.)
      if (bottom > STEP_UP) continue;
      if (top > STEP_UP && (bottom > STAND_FROM || Math.max(p.sx, p.sz) / 2 > STAND_MOST)) continue;
      const list = top <= STEP_UP ? this.flat : this.tall,
        cells = top <= STEP_UP ? this.flatCells : this.tallCells,
        k = list.length / 8,
        c = Math.cos(p.yaw),
        s = Math.sin(p.yaw),
        hx = p.sx / 2,
        hz = p.sz / 2;
      list.push(p.x, p.z, c, s, hx, hz, top, p.round ? 1 : 0);
      // (The cells its square about its middle reaches, turned as it may be.)
      const r = p.round ? Math.max(hx, hz) : Math.abs(c) * hx + Math.abs(s) * hz,
        q = p.round ? r : Math.abs(s) * hx + Math.abs(c) * hz;
      // (A great piece, a town's plain ground out to the haze, is looked at wherever one stands, not found by its cells: it
      // would cover millions of them.)
      if (((2 * r) / TOP_CELL + 1) * ((2 * q) / TOP_CELL + 1) > WIDE_CELLS) {
        (list === this.flat ? this.wideFlat : this.wideTall).push(k);
        continue;
      }
      for (let i = Math.floor((p.x - r) / TOP_CELL); i <= Math.floor((p.x + r) / TOP_CELL); i++)
        for (let j = Math.floor((p.z - q) / TOP_CELL); j <= Math.floor((p.z + q) / TOP_CELL); j++) {
          const key = cellKey(i, j),
            at = cells.get(key);
          if (at) at.push(k);
          else cells.set(key, [k]);
        }
    }
    this.laid = { flat: this.flat.length / 8, tall: this.tall.length / 8 };
  }

  /** The highest top stood on at a point (metres; -Infinity: nothing laid there). */
  topAt(x: number, z: number): number {
    const list = this.flatCells.get(cellKey(Math.floor(x / TOP_CELL), Math.floor(z / TOP_CELL))),
      f = this.flat,
      wide = this.wideFlat;
    let top = -Infinity;
    for (let n = 0; n < wide.length; n++) {
      const o = wide[n]! * 8;
      if (f[o + 6]! > top && within(f, o, x, z, 0)) top = f[o + 6]!;
    }
    if (!list) return top;
    for (let n = 0; n < list.length; n++) {
      const o = list[n]! * 8;
      if (f[o + 6]! > top && within(f, o, x, z, 0)) top = f[o + 6]!;
    }
    return top;
  }

  /** How far a point lies within what rises higher from the ground than one steps onto, with `reach` about it (metres; 0: clear). */
  tallDepth(x: number, z: number, reach: number): number {
    let deepest = 0;
    const t = this.tall;
    for (let i = Math.floor((x - reach) / TOP_CELL); i <= Math.floor((x + reach) / TOP_CELL); i++)
      for (
        let j = Math.floor((z - reach) / TOP_CELL);
        j <= Math.floor((z + reach) / TOP_CELL);
        j++
      ) {
        const list = this.tallCells.get(cellKey(i, j));
        if (list)
          for (let n = 0; n < list.length; n++) {
            const d = depthIn(t, list[n]! * 8, x, z, reach);
            if (d > deepest) deepest = d;
          }
      }
    return deepest;
  }

  /** Push a point (metres, in place) out of what rises from the ground, `reach` off it: to the nearest side. Whether it moved. */
  pushOut(p: { x: number; z: number }, reach: number): boolean {
    let moved = false;
    const t = this.tall;
    for (let pass = 0; pass < 2; pass++) {
      const list = this.tallCells.get(
        cellKey(Math.floor(p.x / TOP_CELL), Math.floor(p.z / TOP_CELL)),
      );
      if (!list) return moved;
      let any = false;
      for (let n = 0; n < list.length; n++) {
        const o = list[n]! * 8;
        if (depthIn(t, o, p.x, p.z, reach) <= 0) continue;
        outOf(t, o, p, reach);
        any = moved = true;
      }
      if (!any) break;
    }
    return moved;
  }
}

/**
 * A cell's key, a small whole number (fourteen bits a side: kept within what the engine holds unboxed, so a map of them is
 * quick): cells 16,384 apart share one, which only asks of those found whether they are near.
 */
const cellKey = (i: number, j: number) => ((i & 0x3fff) << 14) | (j & 0x3fff);

/** Whether a point lies on a piece (with `spare` more each way). */
function within(f: readonly number[], o: number, x: number, z: number, spare: number): boolean {
  const dx = x - f[o]!,
    dz = z - f[o + 1]!,
    hx = f[o + 4]! + spare,
    hz = f[o + 5]! + spare;
  if (f[o + 7]) {
    const u = dx / hx,
      v = dz / hz;
    return u * u + v * v <= 1;
  }
  const c = f[o + 2]!,
    s = f[o + 3]!,
    lx = dx * c - dz * s,
    lz = dx * s + dz * c;
  return Math.abs(lx) <= hx && Math.abs(lz) <= hz;
}

/** How far a point with `reach` about it lies into a piece (metres; 0 or less: clear of it). */
function depthIn(f: readonly number[], o: number, x: number, z: number, reach: number): number {
  const dx = x - f[o]!,
    dz = z - f[o + 1]!;
  if (f[o + 7]) {
    const r = Math.max(f[o + 4]!, f[o + 5]!);
    return r + reach - Math.sqrt(dx * dx + dz * dz);
  }
  const c = f[o + 2]!,
    s = f[o + 3]!,
    lx = Math.abs(dx * c - dz * s) - f[o + 4]!,
    lz = Math.abs(dx * s + dz * c) - f[o + 5]!;
  // (Outside: its distance to the box less the reach; inside: as deep as its nearer side, and the reach.)
  const out = Math.hypot(Math.max(0, lx), Math.max(0, lz)),
    inside = Math.min(0, Math.max(lx, lz));
  return reach - out - inside;
}

/** Move a point out of a piece to `reach` off its nearest side. */
function outOf(f: readonly number[], o: number, p: { x: number; z: number }, reach: number): void {
  const dx = p.x - f[o]!,
    dz = p.z - f[o + 1]!;
  if (f[o + 7]) {
    const r = Math.max(f[o + 4]!, f[o + 5]!) + reach,
      d = Math.sqrt(dx * dx + dz * dz) || 1e-6;
    p.x = f[o]! + (dx / d) * r;
    p.z = f[o + 1]! + (dz / d) * r;
    return;
  }
  const c = f[o + 2]!,
    s = f[o + 3]!,
    hx = f[o + 4]! + reach,
    hz = f[o + 5]! + reach;
  let lx = dx * c - dz * s,
    lz = dx * s + dz * c;
  // (Out by the side it is nearer, along its own across or along.)
  if (hx - Math.abs(lx) < hz - Math.abs(lz)) lx = (lx < 0 ? -1 : 1) * hx;
  else lz = (lz < 0 ? -1 : 1) * hz;
  // (Back from its own to the world's: the inverse of the turn above.)
  p.x = f[o]! + lx * c + lz * s;
  p.z = f[o + 1]! - lx * s + lz * c;
}

/**
 * Drawn figures kept out of one another (2026-11-26: "no meshes colliding and phasing into each other like real things dont
 * do that"): where two stand nearer than their reaches together, each steps half the way apart, along the line between them
 * (two on one spot, along a way keyed by the pair), a pass or two a frame. What is fed is where each is drawn now (metres) and
 * how far its body reaches about it; those not fed (`live` 0: out of sight, flying, at a door) are passed over. Found by
 * cells as broad as the broadest two, those fed sorted by their cell (a cell's row of three a run of the sorted); nothing is
 * made anew each frame once grown. The view's alone: no world is touched.
 */
export class Spread {
  /** Each one fed: its cell and its place, as one number, sorted. */
  private order = new Float64Array(0);
  /** Their cells and places, in that order. */
  private cells = new Float64Array(0);
  private who = new Int32Array(0);
  /** Pairs stepped apart in the last spread (the look tools). */
  stepped = 0;

  spread(
    xs: Float64Array,
    zs: Float64Array,
    rs: Float32Array,
    live: Uint8Array,
    n: number,
    passes = 2,
    /** Those held where they stand (against a wall, say): the other of a pair steps the whole way. */
    held: Uint8Array | null = null,
  ): number {
    let most = 0,
      fed = 0;
    for (let i = 0; i < n; i++)
      if (live[i]) {
        fed++;
        if (rs[i]! > most) most = rs[i]!;
      }
    this.stepped = 0;
    if (!(most > 0) || fed < 2) return 0;
    if (this.order.length < fed) {
      const size = Math.max(fed, 2 * this.order.length);
      this.order = new Float64Array(size);
      this.cells = new Float64Array(size);
      this.who = new Int32Array(size);
    }
    const cell = 2 * most,
      PLACES = 1_048_576,
      order = this.order.subarray(0, fed),
      cells = this.cells,
      who = this.who;
    // (A cell's key: its column and row each kept within 65,536 cells of the middle, a row's cells one after another.)
    const keyOf = (cx: number, cz: number) =>
      (Math.min(32_767, Math.max(-32_768, cx)) + 32_768) * 65_536 +
      (Math.min(32_767, Math.max(-32_768, cz)) + 32_768);
    let f = 0;
    for (let i = 0; i < n; i++)
      if (live[i])
        order[f++] = keyOf(Math.floor(xs[i]! / cell), Math.floor(zs[i]! / cell)) * PLACES + i;
    order.sort();
    for (let s = 0; s < fed; s++) {
      const key = Math.floor(order[s]! / PLACES);
      cells[s] = key;
      who[s] = order[s]! - key * PLACES;
    }
    // (The first of the sorted at or past a key.)
    const from = (key: number) => {
      let lo = 0,
        hi = fed;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cells[mid]! < key) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };
    let stepped = 0;
    for (let pass = 0; pass < passes; pass++) {
      let any = false;
      for (let s = 0; s < fed; s++) {
        const i = who[s]!,
          key = cells[s]!,
          cx = Math.floor(key / 65_536) - 32_768,
          cz = (key % 65_536) - 32_768;
        for (let ox = -1; ox <= 1; ox++) {
          const last = keyOf(cx + ox, cz + 1);
          for (let t = from(keyOf(cx + ox, cz - 1)); t < fed && cells[t]! <= last; t++) {
            if (t <= s) continue;
            const j = who[t]!,
              ax = xs[j]! - xs[i]!,
              az = zs[j]! - zs[i]!,
              want = rs[i]! + rs[j]!,
              d2 = ax * ax + az * az;
            if (d2 >= want * want) continue;
            const d = Math.sqrt(d2),
              each = (want * 1.02 - d) / 2;
            let ux: number, uz: number;
            if (d < 1e-6) {
              const a = (Math.min(i, j) * 31 + Math.max(i, j)) * 2.399963;
              ux = Math.cos(a);
              uz = Math.sin(a);
            } else {
              ux = ax / d;
              uz = az / d;
            }
            const hi = held?.[i] ?? 0,
              hj = held?.[j] ?? 0,
              wi = hi && !hj ? 0 : hj && !hi ? 2 : 1;
            xs[i] = xs[i]! - ux * each * wi;
            zs[i] = zs[i]! - uz * each * wi;
            xs[j] = xs[j]! + ux * each * (2 - wi);
            zs[j] = zs[j]! + uz * each * (2 - wi);
            stepped++;
            any = true;
          }
        }
      }
      if (!any) break;
    }
    this.stepped = stepped;
    return stepped;
  }
}
