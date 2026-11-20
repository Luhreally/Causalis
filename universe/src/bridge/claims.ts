// The ground taken (asked 2026-11-20: "did you fix like the farms overlapping and like just genreal overlapping mesh colliding
// ... it needs avoid logic issues like this from first principles"). Two things never stand on the same ground, and nothing
// stands on water but what its people live in it. So whatever is laid on a stretch of ground (a town's lots and sprawl, its
// roads, its walls, its fields and pasture, a band's camp) takes the ground it covers in one reading of that stretch, in the
// order a people would take it: the water is the land's own first (its map's tiles, the one water every view draws), then
// the towns' built ground, then the roads, then the fields and the rest by need. What comes after asks first; where its
// ground is taken it moves to the nearest free ground of its kind, or is not laid. Pure: built once with the plan it is
// read for, kept where the plan is kept, and never kept in history.
import { wetGround } from "./sites.ts";

/** What holds a piece of ground. */
export const GROUND = {
  free: 0,
  water: 1,
  built: 2,
  road: 3,
  wall: 4,
  field: 5,
  pasture: 6,
  works: 7,
  camp: 8,
} as const;
export type GroundKind = (typeof GROUND)[keyof typeof GROUND];

/** Cells a side of one piece of the reading (each piece made when something is first laid on it). */
const CHUNK = 64;
/** The bearings what reaches out from a middle is read at (GroundClaims.star). */
const STAR_WAYS = 144;
const OFF = 1 << 15;

/**
 * One stretch of ground and what holds each cell of it (`step` across, in the units of whatever lays on it): the land's
 * water read from its own tiles (`wet`), the rest as it is laid. Each cell is held by its first comer and by a number of
 * whose it is (a town's), so that what is of one holder may lie on its own ground where the rest may not.
 */
export class GroundClaims {
  readonly step: number;
  /** Whether a point is the land's water (the one water its map draws), claimed before anything is laid. */
  readonly wet: (x: number, z: number) => boolean;
  private readonly pieces = new Map<number, { kinds: Uint8Array; owners: Int32Array }>();
  /** The piece last read or laid on, and its key (what is laid lies together). */
  private lastKey = NaN;
  private last: { kinds: Uint8Array; owners: Int32Array } | undefined;
  /** What `held` last read: the kind, and whose. */
  private heldKind = 0;
  private heldOwner = -1;

  constructor(step: number, wet: (x: number, z: number) => boolean = () => false) {
    this.step = step;
    this.wet = wet;
  }

  private piece(i: number, j: number, make: boolean) {
    const key = (Math.floor(i / CHUNK) + OFF) * 2 * OFF + (Math.floor(j / CHUNK) + OFF);
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.last = this.pieces.get(key);
    }
    if (make && !this.last) {
      this.last = { kinds: new Uint8Array(CHUNK * CHUNK), owners: new Int32Array(CHUNK * CHUNK) };
      this.pieces.set(key, this.last);
    }
    return this.last;
  }

  private at(i: number, j: number): number {
    return (i - Math.floor(i / CHUNK) * CHUNK) * CHUNK + (j - Math.floor(j / CHUNK) * CHUNK);
  }

  /** Read what holds the cell (i, j) of the laid (the water aside) into heldKind and heldOwner. */
  private held(i: number, j: number): void {
    const p = this.piece(i, j, false);
    if (!p) {
      this.heldKind = GROUND.free;
      this.heldOwner = -1;
      return;
    }
    const k = this.at(i, j);
    this.heldKind = p.kinds[k]!;
    this.heldOwner = p.owners[k]!;
  }

  /** What holds the ground at a point: the land's water first, then what was laid there first. */
  kindAt(x: number, z: number): number {
    if (this.wet(x, z)) return GROUND.water;
    this.held(Math.floor(x / this.step), Math.floor(z / this.step));
    return this.heldKind;
  }

  /** Whose the ground at a point is (-1: no one's, or the water's). */
  ownerAt(x: number, z: number): number {
    if (this.wet(x, z)) return -1;
    this.held(Math.floor(x / this.step), Math.floor(z / this.step));
    return this.heldOwner;
  }

  /** Take one cell, if no one holds it yet. */
  private take(i: number, j: number, kind: GroundKind, owner: number): void {
    const p = this.piece(i, j, true)!,
      k = this.at(i, j);
    if (p.kinds[k] !== GROUND.free) return;
    p.kinds[k] = kind;
    p.owners[k] = owner;
  }

  /**
   * The cells whose middles lie within a rectangle (middle x, z; w along its own way (cos yaw, -sin yaw), d across it
   * (sin yaw, cos yaw), as a lot, a block and a field are turned), grown by `grow` all round; each to `visit` (false stops).
   */
  private cells(
    x: number,
    z: number,
    w: number,
    d: number,
    yaw: number,
    grow: number,
    visit: (i: number, j: number) => boolean,
  ): boolean {
    const c = Math.cos(yaw),
      s = Math.sin(yaw),
      hw = w / 2 + grow,
      hd = d / 2 + grow,
      ex = hw * Math.abs(c) + hd * Math.abs(s),
      ez = hw * Math.abs(s) + hd * Math.abs(c),
      st = this.step,
      i0 = Math.floor((x - ex) / st),
      i1 = Math.floor((x + ex) / st),
      j0 = Math.floor((z - ez) / st),
      j1 = Math.floor((z + ez) / st);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const dx = (i + 0.5) * st - x,
          dz = (j + 0.5) * st - z;
        if (Math.abs(dx * c - dz * s) > hw || Math.abs(dx * s + dz * c) > hd) continue;
        if (!visit(i, j)) return false;
      }
    return true;
  }

  /** Lay a rectangle (as `cells` turns it) on the ground: its cells and a cell's breadth about them, where free. */
  rect(
    x: number,
    z: number,
    w: number,
    d: number,
    yaw: number,
    kind: GroundKind,
    owner: number,
  ): void {
    this.cells(x, z, w, d, yaw, this.step, (i, j) => (this.take(i, j, kind, owner), true));
  }

  /** Lay a line (a road, a wall) of half breadth `half` on the ground, length by length. */
  line(
    points: readonly { readonly x: number; readonly z: number }[],
    half: number,
    kind: GroundKind,
    owner: number,
  ): void {
    for (let k = 0; k + 1 < points.length; k++) {
      const a = points[k]!,
        b = points[k + 1]!,
        len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 1e-9) continue;
      this.rect(
        (a.x + b.x) / 2,
        (a.z + b.z) / 2,
        len,
        2 * half,
        -Math.atan2(b.z - a.z, b.x - a.x),
        kind,
        owner,
      );
    }
  }

  /** Lay a disc on the ground. */
  disc(x: number, z: number, r: number, kind: GroundKind, owner: number): void {
    const st = this.step,
      rr = r + st;
    for (let i = Math.floor((x - rr) / st); i <= Math.floor((x + rr) / st); i++)
      for (let j = Math.floor((z - rr) / st); j <= Math.floor((z + rr) / st); j++)
        if (Math.hypot((i + 0.5) * st - x, (j + 0.5) * st - z) <= rr) this.take(i, j, kind, owner);
  }

  /**
   * Lay what reaches out from a middle toward each bearing as far as `far` gives (a town's outline, its sprawl's): read at
   * STAR_WAYS bearings, each as far as the furthest of it and the two beside it and a cell's breadth past, and laid as
   * that many-sided ground, row by row.
   */
  star(x: number, z: number, far: (a: number) => number, kind: GroundKind, owner: number): void {
    const n = STAR_WAYS,
      r = new Float64Array(n),
      pts = new Float64Array(2 * n);
    for (let k = 0; k < n; k++) r[k] = Math.max(0, far((k / n) * 2 * Math.PI));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 2 * Math.PI,
        out = Math.max(r[(k + n - 1) % n]!, r[k]!, r[(k + 1) % n]!) + this.step;
      pts[2 * k] = x + out * Math.cos(a);
      pts[2 * k + 1] = z + out * Math.sin(a);
    }
    this.polygon(pts, kind, owner);
  }

  /** Lay a closed outline of corners (x, z pairs) on the ground: every cell whose middle lies within it, row by row. */
  polygon(pts: Float64Array, kind: GroundKind, owner: number): void {
    const n = pts.length / 2,
      st = this.step;
    let z0 = Infinity,
      z1 = -Infinity;
    for (let k = 0; k < n; k++) {
      z0 = Math.min(z0, pts[2 * k + 1]!);
      z1 = Math.max(z1, pts[2 * k + 1]!);
    }
    const xs: number[] = [];
    for (let j = Math.floor(z0 / st); j <= Math.floor(z1 / st); j++) {
      const zc = (j + 0.5) * st;
      xs.length = 0;
      for (let k = 0; k < n; k++) {
        const ax = pts[2 * k]!,
          az = pts[2 * k + 1]!,
          bx = pts[(2 * k + 2) % (2 * n)]!,
          bz = pts[(2 * k + 3) % (2 * n)]!;
        if (az <= zc === bz <= zc) continue;
        xs.push(ax + ((zc - az) / (bz - az)) * (bx - ax));
      }
      xs.sort((p, q) => p - q);
      for (let m = 0; m + 1 < xs.length; m += 2) {
        const i0 = Math.ceil(xs[m]! / st - 0.5),
          i1 = Math.floor(xs[m + 1]! / st - 0.5);
        this.span(j, i0, i1, kind, owner);
      }
    }
  }

  /** Take the cells (i0 … i1, j) of one row, where free: a piece at a time. */
  private span(j: number, i0: number, i1: number, kind: GroundKind, owner: number): void {
    for (let i = i0; i <= i1;) {
      const p = this.piece(i, j, true)!,
        end = Math.min(i1, Math.floor(i / CHUNK) * CHUNK + CHUNK - 1),
        jj = j - Math.floor(j / CHUNK) * CHUNK;
      for (let k = (i - Math.floor(i / CHUNK) * CHUNK) * CHUNK + jj; i <= end; i++, k += CHUNK)
        if (p.kinds[k] === GROUND.free) {
          p.kinds[k] = kind;
          p.owners[k] = owner;
        }
    }
  }

  /**
   * Whether a rectangle (turned as `cells` has it) lies wholly on ground free to `owner`: none of it on the land's water
   * (its middle, its corners and the middles of its sides, and every cell it touches), and no cell it touches held,
   * but by `owner` as one of the kinds in `mine` (a bit for each kind: what of its own it may lie beside).
   */
  free(x: number, z: number, w: number, d: number, yaw: number, owner = -1, mine = 0): boolean {
    const c = Math.cos(yaw),
      s = Math.sin(yaw);
    for (const u of [-0.5, 0, 0.5])
      for (const v of [-0.5, 0, 0.5])
        if (this.wet(x + u * w * c + v * d * s, z - u * w * s + v * d * c)) return false;
    // (Every cell it touches: its cells' middles within half a cell's breadth corner to corner of it.)
    return this.cells(x, z, w, d, yaw, this.step * Math.SQRT1_2, (i, j) => {
      this.held(i, j);
      if (
        this.heldKind !== GROUND.free &&
        !(this.heldOwner === owner && ((mine >> this.heldKind) & 1) === 1)
      )
        return false;
      return !this.wet((i + 0.5) * this.step, (j + 0.5) * this.step);
    });
  }

  /** Whether a disc lies wholly on free ground (as `free`). */
  freeDisc(x: number, z: number, r: number, owner = -1, mine = 0): boolean {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      if (this.wet(x + r * Math.cos(a), z + r * Math.sin(a))) return false;
    }
    const side = r * Math.SQRT2;
    return (
      this.free(x, z, side, side, 0, owner, mine) &&
      this.free(x, z, side, side, Math.PI / 4, owner, mine)
    );
  }
}

/** A bit for each kind a holder may lie beside of its own (GroundClaims.free's `mine`). */
export function kindsOf(...kinds: GroundKind[]): number {
  let m = 0;
  for (const k of kinds) m |= 1 << k;
  return m;
}

/** A rectangle laid on the ground: middle, length along its own way (cos yaw, -sin yaw) and breadth across, turn. */
export type Rect = {
  readonly x: number;
  readonly z: number;
  readonly w: number;
  readonly d: number;
  readonly yaw: number;
};

/** Whether two rectangles overlap by more than `slack` (their sides apart along any of their four axes). */
export function rectsOverlap(a: Rect, b: Rect, slack = 0): boolean {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    ra = Math.hypot(a.w, a.d) / 2,
    rb = Math.hypot(b.w, b.d) / 2;
  if (dx * dx + dz * dz >= (ra + rb) ** 2) return false;
  const ac = Math.cos(a.yaw),
    as = Math.sin(a.yaw),
    bc = Math.cos(b.yaw),
    bs = Math.sin(b.yaw),
    apart = (nx: number, nz: number) =>
      Math.abs(dx * nx + dz * nz) + slack >=
      (a.w / 2) * Math.abs(ac * nx - as * nz) +
        (a.d / 2) * Math.abs(as * nx + ac * nz) +
        (b.w / 2) * Math.abs(bc * nx - bs * nz) +
        (b.d / 2) * Math.abs(bs * nx + bc * nz);
  return !(apart(ac, -as) || apart(as, ac) || apart(bc, -bs) || apart(bs, bc));
}

/**
 * The ground buildings stand on, read exactly: each footprint (a turned rectangle, metres) kept in a hash of `cell`-sized
 * squares, and a new one asked against those near it. What would run into one laid before is not laid, or laid smaller.
 */
export class Footprints {
  private readonly cells = new Map<number, number[]>();
  private readonly rects: Rect[] = [];
  private readonly cell: number;
  constructor(cell = 40) {
    this.cell = cell;
  }
  private keys(r: Rect, out: number[]): number[] {
    const reach = Math.hypot(r.w, r.d) / 2,
      c = this.cell;
    out.length = 0;
    for (let i = Math.floor((r.x - reach) / c); i <= Math.floor((r.x + reach) / c); i++)
      for (let j = Math.floor((r.z - reach) / c); j <= Math.floor((r.z + reach) / c); j++)
        out.push((i + 32768) * 65536 + (j + 32768));
    return out;
  }
  private readonly scratch: number[] = [];
  /** Whether a footprint would run into one laid (by more than `slack` metres). */
  clashes(r: Rect, slack = 0): boolean {
    for (const k of this.keys(r, this.scratch))
      for (const i of this.cells.get(k) ?? [])
        if (rectsOverlap(r, this.rects[i]!, slack)) return true;
    return false;
  }
  /** Lay a footprint. */
  add(r: Rect): void {
    const i = this.rects.length;
    this.rects.push(r);
    for (const k of this.keys(r, this.scratch)) {
      const at = this.cells.get(k);
      if (at) at.push(i);
      else this.cells.set(k, [i]);
    }
  }
  get size(): number {
    return this.rects.length;
  }
}

/** The points of a rectangle a reading of the ground is asked at: its middle, corners and the middles of its sides. */
export function rectPoints(r: Rect): { x: number; z: number }[] {
  const c = Math.cos(r.yaw),
    s = Math.sin(r.yaw),
    out: { x: number; z: number }[] = [];
  for (const u of [-0.5, 0, 0.5])
    for (const v of [-0.5, 0, 0.5])
      out.push({ x: r.x + u * r.w * c + v * r.d * s, z: r.z - u * r.w * s + v * r.d * c });
  return out;
}

/** Whether a segment (half breadth `half`) crosses a rectangle. */
export function segmentCrosses(
  a: { readonly x: number; readonly z: number },
  b: { readonly x: number; readonly z: number },
  half: number,
  r: Rect,
): boolean {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  if (len < 1e-9) return false;
  return rectsOverlap(
    {
      x: (a.x + b.x) / 2,
      z: (a.z + b.z) / 2,
      w: len,
      d: 2 * half,
      yaw: -Math.atan2(b.z - a.z, b.x - a.x),
    },
    r,
  );
}

/** A town's land's water as its view reads it (TownSite's `wet` and `bank`). */
type Wet = {
  readonly wet?: { readonly m: number; readonly half: number; readonly cells: string };
  readonly bank?: { readonly x: number; readonly z: number };
};

/**
 * Each square's facet shares, as its land's map cuts them (render/region.ts; view/land.ts facetOwner): corners in the
 * square's own (u east, v south) measure, and the bit of the tile whose share each is.
 */
const SHARES: readonly (readonly [number, readonly number[]])[] = [
  [1, [0, 0, 0.5, 0, 1 / 3, 1 / 3, 0, 0.5]],
  [2, [0.5, 0, 1, 0, 0.5, 0.5, 1 / 3, 1 / 3]],
  [4, [0, 0.5, 1 / 3, 1 / 3, 0.5, 0.5, 0, 1]],
  [8, [1, 0.5, 1, 1, 0.5, 1, 2 / 3, 2 / 3]],
  [2, [1, 0, 1, 0.5, 2 / 3, 2 / 3, 0.5, 0.5]],
  [4, [0.5, 0.5, 2 / 3, 2 / 3, 0.5, 1, 0, 1]],
];

/**
 * The land's water about a town as its own view draws it (metres from its square): each share of a facet of its land's map
 * that is water, as four corners (x, z) — the same shares the land's map paints and `wetGround` reads, so the town's
 * view, its land's map and everything laid on either read one water. Only the squares that come within `far` of its square.
 */
export function wetShares(site: Wet | null | undefined, far = Infinity): Float32Array {
  const w = site?.wet;
  if (!w) return new Float32Array(0);
  const n = 2 * w.half,
    bx = site!.bank?.x ?? 0,
    bz = site!.bank?.z ?? 0,
    out: number[] = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const bits = w.cells.charCodeAt(j * n + i) - 48;
      if (!bits) continue;
      const x0 = (i - w.half) * w.m - bx,
        z0 = (j - w.half) * w.m - bz;
      // (A square wholly past what is drawn is left out.)
      const nx = Math.max(x0, Math.min(0, x0 + w.m)),
        nz = Math.max(z0, Math.min(0, z0 + w.m));
      if (Math.hypot(nx, nz) > far) continue;
      for (const [bit, uv] of SHARES) {
        if (!(bits & bit)) continue;
        for (let k = 0; k < 8; k += 2) out.push(x0 + uv[k]! * w.m, z0 + uv[k + 1]! * w.m);
      }
    }
  return Float32Array.from(out);
}

/** The least breadth of open water a town keeps as its own (metres of reach from its middle), and the most. */
export const OPEN_LEAST = 40,
  OPEN_MOST = 220;

/**
 * A town's own water (TownWater): the greatest round of open water of its land's (up to OPEN_MOST across its reach) that
 * lies nearest its square, wholly on what its land's map draws as water; null where none of OPEN_LEAST lies within `near`
 * metres. Its boats go out on it, its fishers to its shore, its fish swim in it: never a lake of its own laid over the land.
 */
export function openWater(
  site: Wet | null | undefined,
  near = 1200,
): { x: number; z: number; r: number } | null {
  const w = site?.wet;
  if (!w) return null;
  const STEP = 30,
    n = Math.ceil((2 * near) / STEP) + 1,
    wet = new Uint8Array(n * n),
    dist = new Float32Array(n * n),
    pos = (k: number) => -near + k * STEP;
  let any = false;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const v = wetGround(site, pos(i), pos(j)) ? 1 : 0;
      wet[j * n + i] = v;
      any ||= v === 1;
    }
  if (!any) return null;
  // (How far each point of water is from the nearest dry ground: a chamfer pass each way, the edge of what is read as
  // shore.)
  const D = STEP,
    DD = STEP * Math.SQRT2;
  for (let k = 0; k < n * n; k++) {
    const i = k % n,
      j = Math.floor(k / n);
    dist[k] = wet[k] && i > 0 && j > 0 && i < n - 1 && j < n - 1 ? Infinity : 0;
  }
  for (let j = 1; j < n; j++)
    for (let i = 1; i < n - 1; i++) {
      const k = j * n + i;
      if (!wet[k]) continue;
      dist[k] = Math.min(
        dist[k]!,
        dist[k - 1]! + D,
        dist[k - n]! + D,
        dist[k - n - 1]! + DD,
        dist[k - n + 1]! + DD,
      );
    }
  for (let j = n - 2; j >= 0; j--)
    for (let i = n - 2; i > 0; i--) {
      const k = j * n + i;
      if (!wet[k]) continue;
      dist[k] = Math.min(
        dist[k]!,
        dist[k + 1]! + D,
        dist[k + n]! + D,
        dist[k + n + 1]! + DD,
        dist[k + n - 1]! + DD,
      );
    }
  let best: { x: number; z: number; r: number } | null = null,
    cost = Infinity;
  for (let k = 0; k < n * n; k++) {
    if (!wet[k]) continue;
    const r = Math.min(OPEN_MOST, dist[k]! - STEP);
    if (r < OPEN_LEAST) continue;
    const x = pos(k % n),
      z = pos(Math.floor(k / n)),
      d = Math.hypot(x, z);
    if (d > near) continue;
    // (The nearest of its near shore, the broader the better: a step nearer is worth as much as a step broader.)
    const c = d - 2 * r;
    if (c < cost - 1e-9) {
      cost = c;
      best = { x, z, r };
    }
  }
  return best;
}

/** The shore a town's water is come to by from its square: the last dry ground on the way out to it (metres). */
export function shoreOf(
  site: Wet | null | undefined,
  water: { readonly x: number; readonly z: number; readonly r: number },
): { x: number; z: number } {
  const d = Math.hypot(water.x, water.z) || 1,
    ux = water.x / d,
    uz = water.z / d,
    w = site?.wet;
  let at = Math.max(0, d - water.r);
  if (w) while (at > 0 && wetGround(site, ux * (at - 2), uz * (at - 2))) at -= 2;
  return { x: ux * at, z: uz * at };
}

/** The cell a town's view reads its ground by (metres): a hedge's breadth, and less than any field or block is across. */
export const TOWN_STEP = 6;

/**
 * A town's ground as its own view lays its countryside on it (metres from its square): its land's water first, then its
 * built ground (its blocks drawn, and out to its outline toward each bearing, as many times over as all its lots are to
 * those drawn: its sprawl), then its road out (both ways through a city). Where it has no fabric drawn, its homes' round.
 */
export function townClaims(o: {
  readonly ground: Wet | null | undefined;
  readonly blocks?: {
    readonly x: Float32Array;
    readonly z: Float32Array;
    readonly yaw: Float32Array;
  } | null;
  readonly count?: number;
  readonly outline?: Float32Array | null;
  readonly outlineAt?: (outline: Float32Array, a: number) => number;
  readonly scale?: number;
  readonly edge: number;
  readonly road: { readonly x: number; readonly z: number };
  readonly through: boolean;
}): GroundClaims {
  const claims = new GroundClaims(
      TOWN_STEP,
      o.ground?.wet ? (x, z) => wetGround(o.ground, x, z) : () => false,
    ),
    scale = o.scale ?? 1;
  if (o.outline && o.outlineAt) {
    const line = o.outline,
      at = o.outlineAt;
    claims.star(0, 0, (a) => at(line, a) * scale, GROUND.built, 0);
  } else claims.disc(0, 0, Math.max(0, o.edge - 30), GROUND.built, 0);
  if (o.blocks)
    for (let b = 0; b < (o.count ?? o.blocks.x.length); b++)
      claims.rect(o.blocks.x[b]!, o.blocks.z[b]!, 36, 28, o.blocks.yaw[b]!, GROUND.built, 0);
  const ends = o.through ? [{ x: -o.road.x, z: -o.road.z }, o.road] : [{ x: 0, z: 0 }, o.road];
  claims.line(ends, 4, GROUND.road, 0);
  return claims;
}

/**
 * Lay what is wanted of one kind on a town's or a land's ground (`wanted`, the nearest first): each where it was meant to
 * lie if that ground is free, else on the nearest free ground about that spot, ring by ring `out` apart (the way out from
 * `from` first in each ring, then round about), up to `rings` rings; else not laid. Each laid takes its ground, so none
 * lies on another.
 */
export function layOn(
  claims: GroundClaims,
  wanted: readonly Rect[],
  kind: GroundKind,
  owner: number,
  from: { readonly x: number; readonly z: number },
  out: number,
  rings: number,
): Rect[] {
  const laid: Rect[] = [];
  for (const f of wanted) {
    const way = Math.atan2(f.z - from.z, f.x - from.x);
    let at: Rect | null = claims.free(f.x, f.z, f.w, f.d, f.yaw, owner, 0) ? f : null;
    for (let ring = 1; !at && ring <= rings; ring++) {
      const turns = 6 + 2 * ring;
      for (let k = 0; k < turns && !at; k++) {
        // (Outward first, then either side of it in turn, round to inward.)
        const a = way + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * ((2 * Math.PI) / turns),
          r = { ...f, x: f.x + Math.cos(a) * out * ring, z: f.z + Math.sin(a) * out * ring };
        if (claims.free(r.x, r.z, r.w, r.d, r.yaw, owner, 0)) at = r;
      }
    }
    if (!at) continue;
    claims.rect(at.x, at.z, at.w, at.d, at.yaw, kind, owner);
    laid.push(at);
  }
  return laid;
}
