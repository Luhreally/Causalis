// A town's wall line: the one reading of where its walls run, for everything that stands on it, keeps clear of it or comes
// up against it (the layout's clear ground, the walls' lengths, gates and towers, the ring street once they are down, the
// height held on it, the walkers' solids, a siege's storm, its works and its breach).
//
// A wall is paid for by its length and holds what is inside it: so it runs the short way round the lots it was raised
// about (their hull), set a little out from them, its corners eased; and where that way would stand in water it draws in
// to the bank on the town's side, since the water guards that length for nothing. It is read at WALL_BEARINGS bearings
// about the square, as the town's outline is: how far out the line lies toward each.

/** The bearings a wall line is read at (each two and a half degrees: at 300 m out, 13 m apart). */
export const WALL_BEARINGS = 144;
/**
 * How many times the lots its walls rang a town has grown to when it pulls them down, a ring street where they stood (history's
 * siege reads the same: rules/siege.ts WALLS_OUTGROWN, a land besieged only while it stands behind walls).
 */
export const WALLS_RING_MOST = 3;
/** How far out from the lots it was raised about a wall runs (metres), and the least it keeps where it draws in to a bank. */
export const WALL_OUT = 8,
  WALL_CLEAR = 4;

const STEP = (2 * Math.PI) / WALL_BEARINGS;

/** A footprint on a town's ground: its middle, its turn, its length and depth (metres). */
type Rect = {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly w: number;
  readonly d: number;
};

/** The hull of points (x, z pairs), counter-clockwise. */
function hull(points: number[]): number[] {
  const n = points.length / 2,
    order = Array.from({ length: n }, (_, i) => i).sort(
      (a, b) => points[2 * a]! - points[2 * b]! || points[2 * a + 1]! - points[2 * b + 1]!,
    ),
    out: number[] = [],
    cross = (o: number, a: number, b: number) =>
      (points[2 * a]! - points[2 * o]!) * (points[2 * b + 1]! - points[2 * o + 1]!) -
      (points[2 * a + 1]! - points[2 * o + 1]!) * (points[2 * b]! - points[2 * o]!);
  for (const i of order) {
    while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, i) <= 0) out.pop();
    out.push(i);
  }
  const lower = out.length + 1;
  for (let k = n - 2; k >= 0; k--) {
    const i = order[k]!;
    while (out.length >= lower && cross(out[out.length - 2]!, out[out.length - 1]!, i) <= 0)
      out.pop();
    out.push(i);
  }
  out.pop();
  return out.flatMap((i) => [points[2 * i]!, points[2 * i + 1]!]);
}

/**
 * The line of a town's walls: how far from its middle they run toward each of WALL_BEARINGS bearings. `x`, `z`, `yaw`: its
 * first `blocks` blocks, each `w` long and `d` deep (the lots they were raised about); `more`: other ground kept within
 * them (its market place); `least`: no nearer its middle than this; `wet`: whether a point of its ground is water.
 */
export function wallLineOf(
  x: ArrayLike<number>,
  z: ArrayLike<number>,
  yaw: ArrayLike<number>,
  blocks: number,
  w: number,
  d: number,
  more: readonly Rect[],
  least: number,
  wet: ((x: number, z: number) => boolean) | null,
): Float32Array {
  const held: number[] = [],
    // (How far out the ground within them reaches toward each bearing: where the line draws in, never nearer than this.)
    within = new Float32Array(WALL_BEARINGS).fill(least),
    corner = (px: number, pz: number) => {
      held.push(px, pz);
      const k =
        ((Math.round(Math.atan2(pz, px) / STEP) % WALL_BEARINGS) + WALL_BEARINGS) % WALL_BEARINGS;
      within[k] = Math.max(within[k]!, Math.hypot(px, pz));
    },
    rect = (r: Rect) => {
      const c = Math.cos(r.yaw),
        s = Math.sin(r.yaw);
      for (const u of [-1, 1])
        for (const v of [-1, 1])
          corner(
            r.x + (u * c * r.w) / 2 + (v * s * r.d) / 2,
            r.z - (u * s * r.w) / 2 + (v * c * r.d) / 2,
          );
    };
  for (let b = 0; b < blocks; b++) rect({ x: x[b]!, z: z[b]!, yaw: yaw[b]!, w, d });
  for (const r of more) rect(r);
  // (Its square is within them whatever else is: the hull holds its middle.)
  for (let k = 0; k < 8; k++)
    held.push(least * Math.cos((k * Math.PI) / 4), least * Math.sin((k * Math.PI) / 4));
  // The short way round what it holds, and that set WALL_OUT out from it all round: its corners come out eased, each a
  // turn of that reach (a wall is not turned sharp: a corner is the hardest length of it to hold).
  const inner = hull(held),
    out: number[] = [];
  for (let i = 0; i < inner.length; i += 2)
    for (let k = 0; k < 8; k++)
      out.push(
        inner[i]! + WALL_OUT * Math.cos((k * Math.PI) / 4),
        inner[i + 1]! + WALL_OUT * Math.sin((k * Math.PI) / 4),
      );
  const h = hull(out),
    n = h.length / 2,
    line = new Float32Array(WALL_BEARINGS);
  for (let k = 0; k < WALL_BEARINGS; k++) {
    // Where the way out toward this bearing leaves it.
    const ux = Math.cos(k * STEP),
      uz = Math.sin(k * STEP);
    let r = least;
    for (let i = 0; i < n; i++) {
      const ax = h[2 * i]!,
        az = h[2 * i + 1]!,
        ex = h[2 * ((i + 1) % n)]! - ax,
        ez = h[2 * ((i + 1) % n) + 1]! - az,
        det = ex * uz - ez * ux;
      if (Math.abs(det) < 1e-9) continue;
      const t = (ex * az - ez * ax) / det,
        s = (ux * az - uz * ax) / det;
      if (t > 0 && s >= -1e-6 && s <= 1 + 1e-6) r = Math.max(r, t);
    }
    // Where the short way round would stand in water, the line draws in to the bank on the town's side (no nearer than what
    // it holds toward there); where there is no bank short of that, it crosses, and no length of it stands there.
    if (wet && wet(ux * r, uz * r)) {
      let low = least;
      for (let o = -2; o <= 2; o++)
        low = Math.max(low, within[(k + o + WALL_BEARINGS) % WALL_BEARINGS]!);
      low += WALL_CLEAR;
      let bank = r;
      while (bank - 4 >= low && wet(ux * bank, uz * bank)) bank -= 4;
      if (!wet(ux * bank, uz * bank)) r = bank;
    }
    line[k] = r;
  }
  return line;
}

/** How far from a town's middle its wall line runs toward bearing `a` (metres). */
export function wallAt(line: Float32Array, a: number): number {
  const f = (((a / STEP) % WALL_BEARINGS) + WALL_BEARINGS) % WALL_BEARINGS,
    k = Math.floor(f),
    t = f - k;
  return line[k % WALL_BEARINGS]! * (1 - t) + line[(k + 1) % WALL_BEARINGS]! * t;
}

/** A wall line's middling reach (metres): for what asks how great the ring is, not where it runs. */
export function wallMean(line: Float32Array): number {
  let sum = 0;
  for (let k = 0; k < WALL_BEARINGS; k++) sum += line[k]!;
  return sum / WALL_BEARINGS;
}

/** How long a wall line is, all the way round (metres). */
export function wallLong(line: Float32Array): number {
  let sum = 0;
  for (let k = 0; k < WALL_BEARINGS; k++) {
    const a = line[k]!,
      b = line[(k + 1) % WALL_BEARINGS]!;
    sum += Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(STEP));
  }
  return sum;
}

/**
 * How far a point stands off a wall line (metres: past it positive, within it negative): to the nearest of its lengths
 * about the point's own bearing.
 */
export function wallOff(line: Float32Array, x: number, z: number): number {
  const a = Math.atan2(z, x),
    r = Math.hypot(x, z),
    k0 = Math.floor(a / STEP);
  let best = Infinity;
  for (let i = k0 - 2; i <= k0 + 2; i++) {
    const ra = line[((i % WALL_BEARINGS) + WALL_BEARINGS) % WALL_BEARINGS]!,
      rb = line[(((i + 1) % WALL_BEARINGS) + WALL_BEARINGS) % WALL_BEARINGS]!,
      ax = ra * Math.cos(i * STEP),
      az = ra * Math.sin(i * STEP),
      ex = rb * Math.cos((i + 1) * STEP) - ax,
      ez = rb * Math.sin((i + 1) * STEP) - az,
      t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)));
    best = Math.min(best, Math.hypot(x - ax - t * ex, z - az - t * ez));
  }
  return r >= wallAt(line, a) ? best : -best;
}

/** A stretch of a wall line: its place in the walk, its middle, its turn (its length runs along (cos yaw, −sin yaw)), how long, its bearing, how far the line turns at it (radians). */
export type WallStretch = {
  readonly k: number;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly len: number;
  readonly a: number;
  readonly turn: number;
};

/**
 * A wall line walked in `n` stretches of one length, the first begun `from` of the way round a stretch before bearing
 * `start` (0.5: its middle lies on that bearing).
 */
export function wallWalk(line: Float32Array, n: number, start = 0, from = 0): WallStretch[] {
  // (The line's own corners, and how far round each lies.)
  const px = new Float64Array(WALL_BEARINGS + 1),
    pz = new Float64Array(WALL_BEARINGS + 1),
    at = new Float64Array(WALL_BEARINGS + 1);
  for (let k = 0; k <= WALL_BEARINGS; k++) {
    px[k] = line[k % WALL_BEARINGS]! * Math.cos(k * STEP);
    pz[k] = line[k % WALL_BEARINGS]! * Math.sin(k * STEP);
    if (k) at[k] = at[k - 1]! + Math.hypot(px[k]! - px[k - 1]!, pz[k]! - pz[k - 1]!);
  }
  const long = at[WALL_BEARINGS]!,
    each = long / n,
    point = (d: number): [number, number] => {
      const m = ((d % long) + long) % long;
      let lo = 0,
        hi = WALL_BEARINGS;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (at[mid]! <= m) lo = mid;
        else hi = mid;
      }
      const t = (m - at[lo]!) / Math.max(1e-9, at[lo + 1]! - at[lo]!);
      return [px[lo]! + (px[lo + 1]! - px[lo]!) * t, pz[lo]! + (pz[lo + 1]! - pz[lo]!) * t];
    },
    // (How far round bearing `start` lies.)
    f = (((start / STEP) % WALL_BEARINGS) + WALL_BEARINGS) % WALL_BEARINGS,
    k0 = Math.floor(f),
    first = at[k0]! + (at[k0 + 1]! - at[k0]!) * (f - k0) - from * each,
    ends: [number, number][] = [];
  for (let k = 0; k <= n; k++) ends.push(point(first + k * each));
  const heading = (k: number) => {
    const a = ends[((k % n) + n) % n]!,
      b = ends[(((k % n) + n) % n) + 1]!;
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  };
  const out: WallStretch[] = [];
  for (let k = 0; k < n; k++) {
    const a = ends[k]!,
      b = ends[k + 1]!,
      x = (a[0] + b[0]) / 2,
      z = (a[1] + b[1]) / 2,
      turn = heading(k + 1) - heading(k - 1);
    out.push({
      k,
      x,
      z,
      yaw: Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
      len: Math.hypot(b[0] - a[0], b[1] - a[1]),
      a: Math.atan2(z, x),
      turn: Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) / 2,
    });
  }
  return out;
}

/**
 * The share of 72 bearings about a town at which its line lies within a tenth of its middling reach there: 1 is a compass
 * circle (the measure a town's outline is read by).
 */
export function wallRound(line: Float32Array): number {
  let mean = 0,
    near = 0;
  for (let k = 0; k < 72; k++) mean += wallAt(line, (k / 72) * 2 * Math.PI) / 72;
  for (let k = 0; k < 72; k++)
    if (Math.abs(wallAt(line, (k / 72) * 2 * Math.PI) - mean) <= 0.1 * mean) near++;
  return near / 72;
}
