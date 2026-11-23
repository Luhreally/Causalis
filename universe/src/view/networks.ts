// A town's water, drains and power drawn as the networks they are (2026-11-22, the audit's "infrastructure as networks"; its page
// is host/inspect/networks.ts): what its plan says its land has (bridge/town.ts TownPlan.nets: water led under its streets and
// drains beside it where its land knows sanitation; wires where its land's power goes by wire, on poles or, in the modern age,
// under the street), laid along the streets about its blocks — the street each block keeps on its own sides, where nothing else
// stands: a cover over the main in the carriageway of one side, a grate at the kerb of two, a hydrant at a corner, a pole on the
// verge of a third side (or a box where the wire is buried), and the wire from each pole to the nearest strung before it, a
// line through the town grown from its power house, never a web. Each thing is fixed to its block, its size and colour the
// world's; the renderer fades each by how far it stands from the eye, by a rank of its own (render/townnets.ts), so a run comes
// and goes by degrees and nothing moves with the eye. Pure: built once with the scene.
import {
  BLOCK_D,
  BLOCK_LOTS,
  BLOCK_W,
  LOT_W,
  NET_BLOCKS,
  holdPlaces,
  laidAt,
  onHeld,
  streetWide,
} from "../bridge/index.ts";
import { HELD_PAD, type TownParts, type TownScene } from "./town.ts";
import { RING_TREE, heightOf, ringStreet, templeGround } from "./townform.ts";
import { HELD_DRAWN, blockGround, lineOver } from "./streetline.ts";

type Rgb = readonly [number, number, number];

/** Its poles' height (metres) and how far the wire may run from one to the next. */
export const POLE_HIGH = 8;
const WIRE_MOST = 70;

export const NET_TONES = {
  cover: [0.2, 0.2, 0.22] as Rgb,
  grate: [0.12, 0.12, 0.13] as Rgb,
  hydrant: [0.72, 0.16, 0.12] as Rgb,
  pole: [0.36, 0.28, 0.2] as Rgb,
  arm: [0.3, 0.24, 0.18] as Rgb,
  wire: [0.08, 0.08, 0.09] as Rgb,
  box: [0.36, 0.42, 0.36] as Rgb,
} as const;

/** One thing laid: its middle and size (metres), its turn, its colour, and its rank (0 … 1) for the fade. */
export type NetPart = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly yaw: number;
  readonly color: Rgb;
  readonly rank: number;
};
/** What a town's networks lay: boxes and rounds (two batches), and how many of each kind, for its page and the checks. */
export type TownNets = {
  readonly boxes: NetPart[];
  readonly rounds: NetPart[];
  readonly counts: {
    blocks: number;
    covers: number;
    grates: number;
    hydrants: number;
    poles: number;
    wires: number;
    boxes: number;
  };
};

/** A whole number's share in [0, 1), for a block's rank (the plan's own, not history's). */
function rankOf(seed: number, b: number): number {
  let h = (seed ^ Math.imul(b + 1, 0x9e3779b1) ^ 0x51ed27) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A point of a block's ground: `u` along its breadth, `v` across it (metres from its middle), turned with it. */
function at(x: number, z: number, yaw: number, u: number, v: number): [number, number] {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  return [x + u * c + v * s, z - u * s + v * c];
}

/** How near another of the town's networks one may stand (metres): one thing a spot. */
const SPACING = 2.5;
/** How far out from a block's edge what stands of its networks stands (metres): inside the strip no walker or car comes into. */
/** How far a corner piece's near sides stand off its block (metres): clear of its walls and fences by more than KEEP_OFF. */
const EDGE = 0.1;
/** Where along its block's long side a corner piece stands (metres from its middle): where its corner lot meets the next. */
export const PIECE_U = BLOCK_W / 2 - LOT_W;
/** A power box's breadth, height and depth (metres): small enough at its corner to keep within a walker's reach of the block. */
const BOX = [0.44, 0.9, 0.34] as const;
/** What stands thinner than this is ground to stand on (a street, a yard, a verge); thicker stands in the way (metres). */
const SLAB = 0.3;
/** What is laid this thin over the ground is a way people go or a mark on a road: nothing of the networks stands on it. */
const TRODDEN = 0.04;
/** How far about what stands in the way a piece keeps off it (metres). */
const KEEP_OFF = 0.08;
/**
 * How far the networks keep off ground the town keeps for something else, past its edge (metres): read off its plan, so kept
 * even where no reading of the laid ground is given (a check, a page).
 */
const KEPT_OFF = 1.5;
/** How far out the height a town holds is drawn (view/townform.ts: its mound 34 m across). */
const HEIGHT_R = 17;

/**
 * What else holds a town's streets, for its networks to keep off (the one reading of the ground every layer of the town view
 * lays from): the parts the view lays (its ground with its streets, verges, worn ways, trees, signals and form; its civics and
 * walls), and places held by what the village lays apart (its memorials, its court, its works, the doors cars stand at), as discs.
 */
export type NetsClear = {
  readonly parts: readonly TownParts[];
  readonly keep: readonly { readonly x: number; readonly z: number; readonly r: number }[];
};

type Quad = readonly number[];

/** A box's footprint: its four corners (x, z, x, z …), its middle `x, z`, its size `w` × `d`, turned by `yaw` (as at()). */
function quadOf(x: number, z: number, w: number, d: number, yaw: number): Quad {
  const out = new Array<number>(8);
  quadInto(out, 0, x, z, w, d, yaw);
  return out;
}

/** quadOf(), written into `out` from `o`. */
function quadInto(
  out: number[] | Float64Array,
  o: number,
  x: number,
  z: number,
  w: number,
  d: number,
  yaw: number,
): void {
  // (As at() puts each corner, its turn read once.)
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  for (let k = 0; k < 4; k++) {
    const u = ((k === 0 || k === 3 ? -1 : 1) * w) / 2,
      v = ((k < 2 ? -1 : 1) * d) / 2;
    out[o + 2 * k] = x + u * c + v * s;
    out[o + 2 * k + 1] = z - u * s + v * c;
  }
}

/**
 * A footprint's two axes as the separating axes read them, of the one in `q` from `qo` (its corners), written into `e` from
 * `eo`: across its first edge and across its second (its other two lie along these), each as the way across made unit (`nx,
 * nz`) and where the footprint's corners fall along it, least and most; four numbers an axis. An edge of no length gives
 * none: the way across 0, the footprint from -Infinity to Infinity along it, so it parts nothing.
 */
function sidesInto(q: Float64Array, qo: number, e: Float64Array, eo: number): void {
  for (let i = 0; i < 2; i++) {
    const x0 = q[qo + 2 * i]!,
      z0 = q[qo + 2 * i + 1]!,
      x1 = q[qo + 2 * i + 2]!,
      z1 = q[qo + 2 * i + 3]!,
      l = Math.sqrt((z1 - z0) ** 2 + (x0 - x1) ** 2),
      o = eo + 4 * i;
    if (l < 1e-9) {
      e[o] = e[o + 1] = 0;
      e[o + 2] = -Infinity;
      e[o + 3] = Infinity;
      continue;
    }
    const nx = (z1 - z0) / l,
      nz = (x0 - x1) / l;
    let a0 = Infinity,
      a1 = -Infinity;
    for (let k = 0; k < 4; k++) {
      const da = q[qo + 2 * k]! * nx + q[qo + 2 * k + 1]! * nz;
      a0 = Math.min(a0, da);
      a1 = Math.max(a1, da);
    }
    e[o] = nx;
    e[o + 1] = nz;
    e[o + 2] = a0;
    e[o + 3] = a1;
  }
}

/**
 * Whether two footprints cross by more than `pad`, by the separating axes of each: each read as StreetReading reads a part (its
 * corners, then its axes, sidesInto), `a` from `ao` and `b` from `bo`, each footprint's own reach along its own axes read once.
 */
function crossesAt(a: Float64Array, ao: number, b: Float64Array, bo: number, pad: number): boolean {
  for (let side = 0; side < 2; side++) {
    const own = side === 0 ? a : b,
      eo = (side === 0 ? ao : bo) + 8,
      other = side === 0 ? b : a,
      oo = side === 0 ? bo : ao;
    for (let i = eo; i < eo + 8; i += 4) {
      const nx = own[i]!,
        nz = own[i + 1]!;
      let o0 = Infinity,
        o1 = -Infinity;
      for (let k = oo; k < oo + 8; k += 2) {
        const d = other[k]! * nx + other[k + 1]! * nz;
        o0 = Math.min(o0, d);
        o1 = Math.max(o1, d);
      }
      if (Math.min(own[i + 3]!, o1) - Math.max(own[i + 2]!, o0) <= -pad) return false;
    }
  }
  return true;
}

/** A tier's cells (StreetReading). */
type Grid = {
  readonly size: number;
  readonly gx: number;
  readonly gz: number;
  readonly nx: number;
  readonly nz: number;
  readonly start: Int32Array;
  /** Its parts in the order of its cells, four numbers each: middle x, z, reach with KEEP_OFF, which part. */
  pack: Float64Array;
};

/** The cell of a tier a point is in, kept within its grid (one past its edge is filed at its edge: asked there, as near). */
function cellOf(g: Grid, x: number, z: number): number {
  const a = Math.min(g.nx - 1, Math.max(0, Math.floor(x / g.size) - g.gx)),
    b = Math.min(g.nz - 1, Math.max(0, Math.floor(z / g.size) - g.gz));
  return a * g.nz + b;
}

/**
 * The parts a town's view lays about some ground, indexed once a laying (2026-11-23: a great city's networks took 20 ms, each
 * ask scanning every part within 48 m): what each piece of its networks stands on, and keeps off. Each part is filed by its
 * breadth among TIERS, under the cell of that tier's size its middle is in, in one flat run of cells a tier (counted, then
 * filled); the widest (a field, the ground under a quarter) are looked at for every ask. An ask reads, in each tier, only the
 * cells within a tier's reach of its footprint, and works out a part's footprint the first time it is asked near, into one
 * run of numbers (READ a part) that grows as it must: no object a part.
 */
class StreetReading {
  private static readonly CELL = 6;
  /** How many numbers a part's reading takes (`read`): its corners, its axes, its foot, its top and whether it is thin. */
  private static readonly READ = 20;
  /** Every part filed: its middle, its reach (half its breadth and depth), the run of numbers it is in and where. */
  private readonly px: Float64Array;
  private readonly pz: Float64Array;
  private readonly pr: Float64Array;
  private readonly runs: ArrayLike<number>[] = [];
  private readonly run: Int32Array;
  private readonly at: Int32Array;
  /**
   * The parts asked near, worked out: a part's corners, its edges (sidesInto), its foot and top and whether it is thin, READ
   * numbers each; `slot` is where a part's begin, one more (0: not worked out yet). Kept from one laying to the next (POOL).
   */
  private read: Float64Array;
  private readonly slot: Int32Array;
  private used = 0;
  /** What crossed the footprint last asked about (where each is in `read`). */
  private readonly hits: number[] = [];
  /** The footprint asked about, read as a part is. */
  private readonly asked = new Float64Array(StreetReading.READ);
  /**
   * A tier's cells: their size, where its grid begins and how many cells a side, where each cell's parts begin in `pack`
   * (one more than the cells, the last the end), and the parts, laid in the order of their cells (an ask reads them one after
   * another, not about a city's every part).
   */
  private readonly grids: Grid[] = [];
  /** Parts wider than the widest tier (a field, the ground under a whole quarter), packed as a tier's are. */
  private readonly wide: Float64Array;
  private readonly kept = new Map<number, NetsClear["keep"][number][]>();
  /**
   * What each laying reads into, kept from one to the next and grown as a greater town asks (a laying a few times a second as the
   * eye goes about a city, each of its numbers new, was a twentieth of its time making and letting them go).
   */
  private static readonly POOL = {
    read: new Float64Array(0),
    xs: new Float64Array(0),
    zs: new Float64Array(0),
    rs: new Float64Array(0),
    run: new Int32Array(0),
    at: new Int32Array(0),
  };
  /**
   * The tiers' reach (metres): a part goes in the first that reaches as far as it does, filed in cells that size (none finer
   * than 6 m: a city's ground in 3 m cells was a hundred thousand of them to count).
   */
  private static readonly TIERS = [6, 12, 24, 48, 96, 192, 384];
  constructor(clear: NetsClear, box: { x0: number; x1: number; z0: number; z1: number }) {
    const C = StreetReading.CELL;
    for (const k of clear.keep) {
      if (k.x + k.r < box.x0 || k.x - k.r > box.x1 || k.z + k.r < box.z0 || k.z - k.r > box.z1)
        continue;
      for (let a = Math.floor((k.x - k.r) / C); a <= Math.floor((k.x + k.r) / C); a++)
        for (let b = Math.floor((k.z - k.r) / C); b <= Math.floor((k.z + k.r) / C); b++) {
          const key = a * 65536 + b;
          let l = this.kept.get(key);
          if (!l) this.kept.set(key, (l = []));
          l.push(k);
        }
    }
    // (One pass over what is laid, its middles only: those within the ground asked about.)
    let most = 0;
    for (const parts of clear.parts)
      for (const g of parts.groups.values()) if (!g.lamp) most += Math.floor(g.data.length / 7);
    const P = StreetReading.POOL;
    if (P.xs.length < most) {
      const n = Math.max(most, 2 * P.xs.length);
      P.xs = new Float64Array(n);
      P.zs = new Float64Array(n);
      P.rs = new Float64Array(n);
      P.run = new Int32Array(n);
      P.at = new Int32Array(n);
    }
    if (!P.read.length) P.read = new Float64Array(StreetReading.READ * 4096);
    this.read = P.read;
    const { xs, zs, rs, run, at } = P;
    let count = 0;
    for (const parts of clear.parts)
      for (const g of parts.groups.values()) {
        if (g.lamp) continue;
        const d = g.data,
          n = this.runs.length;
        let used = false;
        for (let i = 0; i + 6 < d.length; i += 7) {
          const x = d[i]!,
            z = d[i + 2]!,
            r = 0.5 * (Math.abs(d[i + 3]!) + Math.abs(d[i + 5]!));
          if (x + r < box.x0 || x - r > box.x1 || z + r < box.z0 || z - r > box.z1) continue;
          xs[count] = x;
          zs[count] = z;
          rs[count] = r;
          run[count] = n;
          at[count++] = i;
          used = true;
        }
        if (used) this.runs.push(d);
      }
    const T = StreetReading.TIERS;
    this.px = xs.subarray(0, count);
    this.pz = zs.subarray(0, count);
    this.pr = rs.subarray(0, count);
    this.run = run.subarray(0, count);
    this.at = at.subarray(0, count);
    this.slot = new Int32Array(count);
    // (Counted by cell, then filled: one run of numbers a tier, no list a cell.)
    const tier = new Int8Array(count),
      of = new Int32Array(count);
    let wide = 0;
    for (let p = 0; p < count; p++) {
      let t = 0;
      while (t < T.length && this.pr[p]! > T[t]!) t++;
      tier[p] = t;
      if (t === T.length) wide++;
    }
    this.wide = new Float64Array(4 * wide);
    wide = 0;
    for (let t = 0; t < T.length; t++) {
      const size = T[t]!,
        gx = Math.floor(box.x0 / size) - 1,
        gz = Math.floor(box.z0 / size) - 1,
        nx = Math.max(1, Math.floor(box.x1 / size) + 2 - gx),
        nz = Math.max(1, Math.floor(box.z1 / size) + 2 - gz);
      this.grids.push({
        size,
        gx,
        gz,
        nx,
        nz,
        start: new Int32Array(nx * nz + 1),
        pack: new Float64Array(0),
      });
    }
    for (let p = 0; p < count; p++) {
      const t = tier[p]!;
      if (t === T.length) continue;
      const grid = this.grids[t]!,
        c = cellOf(grid, this.px[p]!, this.pz[p]!);
      of[p] = c;
      grid.start[c + 1]!++;
    }
    const fill: Int32Array[] = [];
    for (const grid of this.grids) {
      const start = grid.start,
        cells = start.length - 1;
      for (let c = 0; c < cells; c++) start[c + 1]! += start[c]!;
      grid.pack = new Float64Array(4 * start[cells]!);
      fill.push(start.slice(0, cells));
    }
    for (let p = 0; p < count; p++) {
      const t = tier[p]!,
        pack = t < T.length ? this.grids[t]!.pack : this.wide,
        k = 4 * (t < T.length ? fill[t]![of[p]!]!++ : wide++);
      pack[k] = this.px[p]!;
      pack[k + 1] = this.pz[p]!;
      pack[k + 2] = this.pr[p]! + KEEP_OFF;
      pack[k + 3] = p;
    }
  }
  /** Where a part's reading begins in `read`, worked out the first time it is asked for. */
  private held(p: number): number {
    const s = this.slot[p]!;
    if (s) return s - 1;
    const R = StreetReading.READ,
      o = this.used;
    if (o + R > this.read.length) {
      const more = new Float64Array(this.read.length * 2);
      more.set(this.read.subarray(0, o));
      this.read = StreetReading.POOL.read = more;
    }
    const g = this.read,
      d = this.runs[this.run[p]!]!,
      i = this.at[p]!,
      sy = d[i + 4]!;
    quadInto(g, o, d[i]!, d[i + 2]!, d[i + 3]!, d[i + 5]!, d[i + 6]!);
    sidesInto(g, o, g, o + 8);
    g[o + 16] = d[i + 1]! - sy / 2;
    g[o + 17] = d[i + 1]! + sy / 2;
    g[o + 18] = sy <= TRODDEN ? 1 : 0;
    this.used = o + R;
    this.slot[p] = o + 1;
    return o;
  }
  /**
   * What is laid crossing a footprint `q` (read into `asked`), into `hits`: of those whose bounds come within it, and whose
   * reach from their middles comes within it along its own two edges (so a long wire's ask does not read every part its bounds
   * take in; never one fewer than would cross it, a part's corners falling within its reach of its middle along any line),
   * those that cross it.
   */
  private near(q: Quad): number {
    let x0 = Infinity,
      x1 = -Infinity,
      z0 = Infinity,
      z1 = -Infinity;
    for (let k = 0; k < 4; k++) {
      x0 = Math.min(x0, q[2 * k]!);
      x1 = Math.max(x1, q[2 * k]!);
      z0 = Math.min(z0, q[2 * k + 1]!);
      z1 = Math.max(z1, q[2 * k + 1]!);
    }
    const hits = this.hits,
      e = this.asked;
    hits.length = 0;
    // (A part `k` of a tier's pack, or the wide.)
    const look = (pack: Float64Array, k: number) => {
      const x = pack[k]!,
        z = pack[k + 1]!,
        r = pack[k + 2]!;
      if (x + r < x0 || x - r > x1 || z + r < z0 || z - r > z1) return;
      for (let i = 8; i < 16; i += 4) {
        const along = x * e[i]! + z * e[i + 1]!;
        if (along + r < e[i + 2]! || along - r > e[i + 3]!) return;
      }
      const o = this.held(pack[k + 3]!);
      if (crossesAt(this.read, o, e, 0, 0.005)) hits.push(o);
    };
    // (A part of a tier reaches at most its size and KEEP_OFF from its middle: the cells about the footprint by that much.)
    for (const g of this.grids) {
      const reach = g.size + KEEP_OFF,
        lo = cellOf(g, x0 - reach, z0 - reach),
        hi = cellOf(g, x1 + reach, z1 + reach),
        b0 = lo % g.nz,
        b1 = hi % g.nz;
      for (let a = Math.floor(lo / g.nz), a1 = Math.floor(hi / g.nz); a <= a1; a++)
        for (
          let k = 4 * g.start[a * g.nz + b0]!, end = 4 * g.start[a * g.nz + b1 + 1]!;
          k < end;
          k += 4
        )
          look(g.pack, k);
    }
    for (let k = 0; k < this.wide.length; k += 4) look(this.wide, k);
    return hits.length;
  }
  /**
   * Where a piece of this footprint may stand, `high` metres tall (a wire: from `lift` up), and the top of the ground under it
   * (null: something stands there, it is on a way people go and it stands up, or it is in a place held).
   */
  standAt(q: Quad, high: number, lift = -1): number | null {
    let cx = 0,
      cz = 0;
    for (let k = 0; k < 4; k++) {
      cx += q[2 * k]! / 4;
      cz += q[2 * k + 1]! / 4;
    }
    const reach = Math.hypot(q[0]! - cx, q[1]! - cz),
      C = StreetReading.CELL;
    for (let a = Math.floor((cx - reach) / C); a <= Math.floor((cx + reach) / C); a++)
      for (let b = Math.floor((cz - reach) / C); b <= Math.floor((cz + reach) / C); b++)
        for (const k of this.kept.get(a * 65536 + b) ?? [])
          if (Math.hypot(k.x - cx, k.z - cz) < k.r + reach) return null;
    const e = this.asked;
    for (let k = 0; k < 8; k++) e[k] = q[k]!;
    sidesInto(e, 0, e, 8);
    const n = this.near(q),
      g = this.read,
      hits = this.hits;
    let top = 0.3;
    for (let k = 0; k < n; k++) {
      const h0 = g[hits[k]! + 16]!,
        h1 = g[hits[k]! + 17]!;
      if (h1 - h0 <= SLAB && h1 <= 0.7 && h1 > top) top = h1;
    }
    const y0 = lift >= 0 ? lift : top,
      y1 = y0 + high;
    for (let k = 0; k < n; k++) {
      const o = hits[k]!,
        h0 = g[o + 16]!,
        h1 = g[o + 17]!,
        ground = h1 - h0 <= SLAB && h1 <= top + 0.001;
      // (A way trodden or a road's mark: what stands keeps off it, what lies flush may lie on it.)
      if (g[o + 18] === 1 && high > 0.1 && lift < 0) return null;
      if (ground) continue;
      if (Math.min(h1, y1) - Math.max(h0, y0) > 0.005 && crossesAt(g, o, e, 0, KEEP_OFF))
        return null;
    }
    return top;
  }
}

/**
 * A town's networks, laid about its blocks nearest `focus` (metres from its square), at most NET_BLOCKS of them. None where its
 * plan has none, or its people live in the water (their water is about them; nothing is led or drained).
 */
export function townNets(
  scene: TownScene,
  focus: { x: number; z: number } = { x: 0, z: 0 },
  clear: NetsClear = { parts: [], keep: [] },
): TownNets {
  const { plan, lots } = scene,
    out: TownNets = {
      boxes: [],
      rounds: [],
      counts: { blocks: 0, covers: 0, grates: 0, hydrants: 0, poles: 0, wires: 0, boxes: 0 },
    },
    nets = plan.nets;
  if (!nets || plan.ways === "swim" || plan.sealed || (!nets.mains && !nets.drains && !nets.power))
    return out;
  const all = Math.ceil(plan.lots / BLOCK_LOTS),
    ash = plan.ash ?? 0,
    held = holdPlaces(plan, lots),
    order: number[] = [];
  for (let b = 0; b < all; b++) {
    if (b * BLOCK_LOTS < ash) continue;
    if (!(lots.blocks.x[b]! === lots.blocks.x[b]!)) continue;
    // (A block of open ground keeps no street: those about walk across it, view/streets.ts.)
    if (!scene.held[b]) continue;
    if (held.length && onHeld(held, lots.blocks.x[b]!, lots.blocks.z[b]!, HELD_PAD)) continue;
    order.push(b);
  }
  const d2 = (b: number) => (lots.blocks.x[b]! - focus.x) ** 2 + (lots.blocks.z[b]! - focus.z) ** 2;
  order.sort((a, b) => d2(a) - d2(b) || a - b);
  if (order.length > NET_BLOCKS) order.length = NET_BLOCKS;
  // (Its wire grows from its power house: the block it stands on first.)
  if (nets.power === "lines") {
    const house = plan.civics.find(
      (c) => (c.kind === "power" || c.kind === "fusion") && c.fell === null,
    );
    if (house) {
      const hb = Math.floor(house.at / BLOCK_LOTS),
        k = order.indexOf(hb);
      if (k > 0) order.unshift(...order.splice(k, 1));
    }
  }
  // (What else holds the ground about the blocks laid on, read once: every piece stands only where nothing else does.)
  let bx0 = Infinity,
    bx1 = -Infinity,
    bz0 = Infinity,
    bz1 = -Infinity;
  for (const b of order) {
    bx0 = Math.min(bx0, lots.blocks.x[b]!);
    bx1 = Math.max(bx1, lots.blocks.x[b]!);
    bz0 = Math.min(bz0, lots.blocks.z[b]!);
    bz1 = Math.max(bz1, lots.blocks.z[b]!);
  }
  const pad = BLOCK_W,
    ground = new StreetReading(clear, {
      x0: bx0 - pad,
      x1: bx1 + pad,
      z0: bz0 - pad,
      z1: bz1 + pad,
    });
  // (One thing a cell of ground: a block turned against its neighbour may bring two of theirs together. None on ground the
  // town keeps for something else, read off its plan: a stronghold's or seat's as drawn, its market place, its temple's steps,
  // the height it holds, the ring street's trees; only those within reach of the blocks laid about the eye.)
  const taken = new Map<number, [number, number][]>(),
    market = lots.blocks.place,
    temple = templeGround(scene),
    kept = [
      ...(market ? [{ ...market, w: market.w + 3, d: market.d + 3 }] : []),
      ...(temple ? [temple] : []),
    ],
    height = heightOf(scene),
    laid =
      Math.sqrt(order.reduce((m, b) => Math.max(m, d2(b)), 0)) + BLOCK_W + WIRE_MOST + KEPT_OFF,
    near = (p: { x: number; z: number }, r: number): boolean =>
      Math.hypot(p.x - focus.x, p.z - focus.z) - r < laid,
    rounds = [
      ...(height ? [{ x: height.x, z: height.z, r: HEIGHT_R }] : []),
      ...ringStreet(scene).flatMap((l) =>
        l.tree ? [{ x: l.tree[0], z: l.tree[1], r: RING_TREE / 2 }] : [],
      ),
    ].filter((p) => near(p, p.r)),
    heldNear = held.filter((p) => near(p, p.r * HELD_DRAWN)),
    keptOff = (x: number, z: number): boolean => {
      for (const p of rounds) if (Math.hypot(p.x - x, p.z - z) < p.r + KEPT_OFF) return false;
      for (const p of heldNear)
        if (Math.hypot(p.x - x, p.z - z) < p.r * HELD_DRAWN + KEPT_OFF) return false;
      for (const k of kept) {
        const c = Math.cos(k.yaw),
          s = Math.sin(k.yaw),
          dx = x - k.x,
          dz = z - k.z;
        if (
          Math.abs(dx * c - dz * s) < k.w / 2 + KEPT_OFF &&
          Math.abs(dx * s + dz * c) < k.d / 2 + KEPT_OFF
        )
          return false;
      }
      return true;
    },
    free = (x: number, z: number): boolean => {
      if (!keptOff(x, z)) return false;
      // (Within SPACING of one laid already, by its cell and the cells about it: two on either side of a cell's edge, a
      // hair apart, stood in one another.)
      const a = Math.floor(x / SPACING),
        b = Math.floor(z / SPACING);
      for (let i = a - 1; i <= a + 1; i++)
        for (let j = b - 1; j <= b + 1; j++)
          for (const [px, pz] of taken.get(i * 65536 + j) ?? [])
            if (Math.hypot(px - x, pz - z) < SPACING) return false;
      const k = a * 65536 + b,
        list = taken.get(k);
      if (list) list.push([x, z]);
      else taken.set(k, [[x, z]]);
      return true;
    };
  // (The signals' poles are where they are: at each of its first blocks' far corners. view/town.ts townSignals.)
  const tops: [number, number, number, number][] = [],
    turns: [number, number, number, number][] = [],
    pole = (px: number, pz: number, yaw: number, rank: number, top: number): void => {
      out.boxes.push({
        x: px,
        y: top + POLE_HIGH / 2,
        z: pz,
        sx: 0.26,
        sy: POLE_HIGH,
        sz: 0.26,
        yaw,
        color: NET_TONES.pole,
        rank,
      });
      // (Its arm across the street side, out over the strip its pole stands in.)
      out.boxes.push({
        x: px,
        y: top + POLE_HIGH - 0.4,
        z: pz,
        sx: 0.12,
        sy: 0.12,
        sz: 0.6,
        yaw,
        color: NET_TONES.arm,
        rank,
      });
      tops.push([px, pz, rank, top]);
      out.counts.poles++;
    };
  for (const b of order) {
    const x = lots.blocks.x[b]!,
      z = lots.blocks.z[b]!,
      yaw = lots.blocks.yaw[b]!,
      wide = streetWide(plan.site, b),
      verge = laidAt(plan.site, b)?.verge ?? 0,
      half = wide / 2,
      // (Its carriageway's middle, its kerb, its verge: out from the block's edge.)
      road = verge + 0.62 * (half - verge),
      kerb = verge + 0.14 * (half - verge),
      side = verge > 0 ? verge * 0.5 : 0.3 * half,
      // (Its rank under the most the fade draws whole within its core, so every one near the eye stands whole.)
      rank = 0.8 * rankOf(plan.seed, b),
      top = 0.44;
    out.counts.blocks++;
    // (Each piece: where it may stand of a few places about its block, the first where nothing else is.)
    const place = (
      spots: readonly (readonly [number, number])[],
      w: number,
      d: number,
      high: number,
    ): { x: number; z: number; top: number } | null => {
      for (const [u, v] of spots) {
        const [px, pz] = at(x, z, yaw, u, v),
          top = ground.standAt(quadOf(px, pz, w, d, yaw), high);
        if (top !== null && free(px, pz)) return { x: px, z: pz, top };
      }
      return null;
    };
    // (Toward its corners on its long sides, where its corner lots meet the next (pieceSpots), a piece's near side just out of its
    // edge: as far from any door as a lot is wide, so no one going in or out passes it; kept off by a block's breadth and their
    // own reach from where people stand (view/village.ts PERSON_REACH); wide of where a car turns the corner, and where none is
    // left (view/rides.ts).)
    const corners = (first: number, d: number): (readonly [number, number])[] =>
      [0, 1, 2, 3].map((k) => {
        const c = (first + k) % 4,
          V = BLOCK_D / 2 + EDGE + d / 2;
        return [c === 0 || c === 3 ? -PIECE_U : PIECE_U, c < 2 ? -V : V] as const;
      });
    if (nets.mains) {
      const cover = place(
        [
          [BLOCK_W / 2 + road, BLOCK_D / 4],
          [BLOCK_W / 2 + road, -BLOCK_D / 4],
        ],
        0.9,
        0.9,
        0.01,
      );
      if (cover) {
        // (Flush with the street it lies in: walked and driven over as the street is.)
        out.rounds.push({
          x: cover.x,
          y: cover.top + 0.005,
          z: cover.z,
          sx: 0.9,
          sy: 0.02,
          sz: 0.9,
          yaw,
          color: NET_TONES.cover,
          rank,
        });
        out.counts.covers++;
      }
      // (A hydrant at a corner, where water is led under pressure to its streets.)
      const h = place(corners(0, 0.32), 0.32, 0.32, 0.8);
      if (h) {
        out.rounds.push({
          x: h.x,
          y: h.top + 0.4,
          z: h.z,
          sx: 0.32,
          sy: 0.8,
          sz: 0.32,
          yaw,
          color: NET_TONES.hydrant,
          rank,
        });
        out.counts.hydrants++;
      }
    }
    if (nets.drains)
      for (const s of [-1, 1] as const) {
        const g = place(
          [
            [s * (BLOCK_W / 2 + kerb), -s * (BLOCK_D / 4)],
            [s * (BLOCK_W / 2 + kerb), s * (BLOCK_D / 4)],
          ],
          0.5,
          0.9,
          0.01,
        );
        if (!g) continue;
        out.boxes.push({
          x: g.x,
          y: g.top + 0.005,
          z: g.z,
          sx: 0.5,
          sy: 0.02,
          sz: 0.9,
          yaw,
          color: NET_TONES.grate,
          rank,
        });
        out.counts.grates++;
      }
    if (nets.power) {
      const buried = nets.power === "buried",
        p = buried
          ? place(corners(1, BOX[2]), BOX[0], BOX[2], BOX[1])
          : place(corners(1, 0.26), 0.26, 0.26, POLE_HIGH);
      if (!p) continue;
      if (buried) {
        out.boxes.push({
          x: p.x,
          y: p.top + BOX[1] / 2,
          z: p.z,
          sx: BOX[0],
          sy: BOX[1],
          sz: BOX[2],
          yaw,
          color: NET_TONES.box,
          rank,
        });
        out.counts.boxes++;
      } else {
        pole(p.x, p.z, yaw, rank, p.top);
        // (Two of its block's corners, for a wire to turn at where no pole can be reached straight: not the near one, nor
        // the far one, the signals'.)
        for (const [u, v] of [
          [1, -1],
          [-1, 1],
        ] as const) {
          const [cx, cz] = at(x, z, yaw, u * (BLOCK_W / 2 + side), v * (BLOCK_D / 2 + side));
          turns.push([cx, cz, yaw, rank]);
        }
      }
    }
  }
  // (The wire from each pole to the nearest strung before it that it can reach: down the streets, over no block's ground, no
  // stronghold's, no temple's steps (view/streetline.ts), and where its way is clear at its height, through nothing standing:
  // a line through the town that branches, never a web. A pole none before it can reach takes its wire from the nearest it
  // can after it; one still alone turns at a block's corner, a pole set there.)
  const over =
      tops.length > 1
        ? lineOver(
            [
              ...kept,
              // (Only the blocks a wire from a pole laid here could pass over.)
              ...blockGround(lots, all, ash, held, HELD_PAD, { ...focus, r: laid + BLOCK_W }),
            ],
            heldNear,
            rounds,
          )
        : null,
    clearAt = (a: readonly number[], b: readonly number[]): boolean => {
      const dd = (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2;
      if (dd < 1 || dd > WIRE_MOST * WIRE_MOST || over!(a[0]!, a[1]!, b[0]!, b[1]!)) return false;
      return (
        ground.standAt(
          quadOf(
            (a[0]! + b[0]!) / 2,
            (a[1]! + b[1]!) / 2,
            0.05,
            Math.sqrt(dd),
            Math.atan2(b[0]! - a[0]!, b[1]! - a[1]!),
          ),
          0.2,
          Math.min(a[3]!, b[3]!) + POLE_HIGH - 0.6,
        ) !== null
      );
    },
    strung: boolean[] = [],
    // (The nearest pole of those below `to` a wire from pole i can reach; -1: none.)
    reach = (i: number, to: number): number => {
      const [x1, z1] = tops[i]!,
        near: [number, number][] = [];
      for (let m = 0; m < to; m++) {
        if (m === i) continue;
        const dd = (tops[m]![0] - x1) ** 2 + (tops[m]![1] - z1) ** 2;
        if (dd >= 1 && dd <= WIRE_MOST ** 2) near.push([dd, m]);
      }
      near.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      return near.find(([, m]) => clearAt(tops[m]!, tops[i]!))?.[1] ?? -1;
    },
    wire = (i: number, j: number): void => {
      const [x1, z1, rank, top1] = tops[i]!,
        [x0, z0, rank0, top0] = tops[j]!;
      strung[i] = strung[j] = true;
      // (A wire fades with the nearer of its two poles: never strung on from a pole gone.)
      out.boxes.push({
        x: (x0 + x1) / 2,
        y: Math.min(top0, top1) + POLE_HIGH - 0.5,
        z: (z0 + z1) / 2,
        sx: 0.05,
        sy: 0.05,
        sz: Math.hypot(x1 - x0, z1 - z0),
        yaw: Math.atan2(x1 - x0, z1 - z0),
        color: NET_TONES.wire,
        rank: Math.max(rank, rank0),
      });
      out.counts.wires++;
    };
  for (let i = 1; i < tops.length; i++) {
    const j = reach(i, i);
    if (j >= 0) wire(i, j);
  }
  const poles = tops.length;
  for (let i = 0; i < poles; i++) {
    if (strung[i]) continue;
    const j = reach(i, poles);
    if (j >= 0) wire(i, j);
  }
  for (let i = 0; i < poles; i++) {
    if (strung[i]) continue;
    const [x1, z1] = tops[i]!,
      corners = turns
        .map((c) => [(c[0] - x1) ** 2 + (c[1] - z1) ** 2, c] as const)
        .filter(([dd]) => dd >= 1 && dd <= WIRE_MOST ** 2)
        .sort((a, b) => a[0] - b[0]);
    for (const [, [cx, cz, yaw, rank]] of corners) {
      const top = ground.standAt(quadOf(cx, cz, 0.26, 0.26, yaw), POLE_HIGH);
      if (top === null || !clearAt(tops[i]!, [cx, cz, rank, top])) continue;
      tops.push([cx, cz, rank, top]);
      const j = reach(tops.length - 1, poles);
      tops.pop();
      if (j < 0 || j === i || !free(cx, cz)) continue;
      pole(cx, cz, yaw, rank, top);
      wire(i, tops.length - 1);
      wire(tops.length - 1, j);
      break;
    }
  }
  return out;
}
