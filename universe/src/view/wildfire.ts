// A wildfire on a land (N1): its front going over the ground as the land shows it, tile by tile, through what can burn; slowed
// by a river, stopped by a lake or the sea and by bare ground; and the scar it leaves until what burned has grown back. The way
// it goes is worked out once for each fire, from the patches of ground history says it reached: after that a frame only reads
// a slice of a list, and nothing is rebuilt. Pure: the same fire at the same moment burns the same.
import { DAY, MinHeap, hashString } from "../kernel/index.ts";
import type { LandBurn } from "../bridge/index.ts";
import { groundAt, type LandGround } from "./land.ts";

/** How many of the viewer's own seconds a fire takes to cross the land, at the least, however fast the clock runs. */
export const FIRE_WATCHED_S = 12;
/** How much of a fire's time a tile burns for (its share of the whole), and for how many of those it smoulders after. */
const BURN_SHARE = 0.1;
const SMOULDER_BANDS = 5;
/** How much slower a fire crosses a river's tile, and how much on thin ground; below this fertility nothing is left to burn. */
const RIVER_SLOW = 5;
const THIN_SLOW = 2.5;
const BARE = 6;
/** Of the tile's breadth, how far a flame stands off its middle. */
const JITTER = 0.42;

/** A number in [0, 1) of its own for a key and an index. */
export function fireUnit(a: number, b: number): number {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** How far a patch's edge reaches on a bearing, of its width: keyed, and eased between twelve points about it. */
function edgeOf(key: number, bearing: number): number {
  const f = (((bearing / (2 * Math.PI)) % 1) + 1) % 1,
    at = f * 12,
    i = Math.floor(at),
    u = at - i,
    ease = u * u * (3 - 2 * u),
    p = fireUnit(key, i % 12),
    q = fireUnit(key, (i + 1) % 12);
  return 0.7 + 0.3 * (p + (q - p) * ease);
}

/** What a fire burned on a land, tile by tile in the order it came to them; each one's moment, and where its flame stands. */
export type BurnTiles = {
  readonly key: number;
  readonly tiles: Int32Array;
  readonly at: Float64Array;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly z: Float32Array;
};

/** All of a fire's time, the least a day. */
const wholeOf = (burn: LandBurn): number => Math.max(DAY, burn.until - burn.from);
/** How long a tile burns. */
export const burnBand = (burn: LandBurn): number => wholeOf(burn) * BURN_SHARE;

/**
 * The way a fire went over this land (worked out once): out from each patch's middle, at the moment history says it came there
 * or sooner if the fire got there first, through whatever is dry and has anything on it.
 */
export function burnTiles(burn: LandBurn, g: LandGround): BurnTiles {
  const n = g.size,
    half = ((n - 1) * g.tileKm) / 2,
    key = hashString(burn.event),
    inside = new Uint8Array(n * n),
    dry = (t: number) => g.water[t] !== 1 && g.water[t] !== 3 && g.fertility[t]! >= BARE;
  // What can burn, inside each patch's uneven edge.
  burn.spots.forEach((s, k) => {
    const i0 = Math.max(0, Math.floor((s.x - s.r + half) / g.tileKm)),
      i1 = Math.min(n - 1, Math.ceil((s.x + s.r + half) / g.tileKm)),
      j0 = Math.max(0, Math.floor((s.z - s.r + half) / g.tileKm)),
      j1 = Math.min(n - 1, Math.ceil((s.z + s.r + half) / g.tileKm));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const t = j * n + i;
        if (inside[t] || !dry(t)) continue;
        const dx = i * g.tileKm - half - s.x,
          dz = j * g.tileKm - half - s.z,
          d = Math.hypot(dx, dz);
        if (d <= s.r * edgeOf(key + k, Math.atan2(dz, dx))) inside[t] = 1;
      }
  });
  // How fast it goes, so that its patches come to one another as history has it.
  const first = burn.spots[0]?.at ?? burn.from;
  let ways = 0,
    takes = 0;
  for (let k = 1; k < burn.spots.length; k++) {
    const a = burn.spots[k - 1]!,
      b = burn.spots[k]!;
    ways += Math.hypot(b.x - a.x, b.z - a.z);
    takes += Math.max(0, b.at - a.at);
  }
  const perKm = ways > 0 && takes > 0 ? takes / ways : 0,
    cost = new Float64Array(n * n).fill(Infinity),
    heap = new MinHeap(),
    done = new Uint8Array(n * n);
  // Where it starts on each patch: the dry tile nearest its middle.
  burn.spots.forEach((s) => {
    let best = -1,
      bestD = Infinity;
    const i0 = Math.max(0, Math.floor((s.x - s.r + half) / g.tileKm)),
      i1 = Math.min(n - 1, Math.ceil((s.x + s.r + half) / g.tileKm)),
      j0 = Math.max(0, Math.floor((s.z - s.r + half) / g.tileKm)),
      j1 = Math.min(n - 1, Math.ceil((s.z + s.r + half) / g.tileKm));
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const t = j * n + i;
        if (!inside[t]) continue;
        const d = Math.hypot(i * g.tileKm - half - s.x, j * g.tileKm - half - s.z);
        if (d < bestD) {
          bestD = d;
          best = t;
        }
      }
    if (best < 0) return;
    const c = perKm > 0 ? Math.max(0, s.at - first) / perKm : 0;
    if (c < cost[best]!) {
      cost[best] = c;
      heap.push(c, best);
    }
  });
  const tiles: number[] = [],
    costs: number[] = [];
  while (heap.size) {
    const t = heap.pop();
    if (done[t]) continue;
    done[t] = 1;
    tiles.push(t);
    costs.push(cost[t]!);
    const i = t % n,
      j = Math.floor(t / n);
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = i + di,
          b = j + dj;
        if (a < 0 || b < 0 || a >= n || b >= n) continue;
        const m = b * n + a;
        if (!inside[m] || done[m]) continue;
        const u = fireUnit(key, m),
          fert = g.fertility[m]!,
          slow =
            (0.7 + 1.1 * u * u) *
            (g.water[m] === 2 ? RIVER_SLOW : 1) *
            (fert < 60 ? 1 + ((THIN_SLOW - 1) * (60 - fert)) / 60 : 1),
          c = cost[t]! + (di && dj ? Math.SQRT2 : 1) * g.tileKm * slow;
        if (c < cost[m]!) {
          cost[m] = c;
          heap.push(c, m);
        }
      }
  }
  // Its moments: the first patch's to when the last tile has burned out.
  const band = burnBand(burn),
    last = costs.length ? costs[costs.length - 1]! : 0,
    end = burn.until - band > first ? burn.until - band : first + wholeOf(burn) / 2,
    scale = last > 0 ? (end - first) / last : 0,
    count = tiles.length,
    out: BurnTiles = {
      key,
      tiles: Int32Array.from(tiles),
      at: new Float64Array(count),
      x: new Float32Array(count),
      y: new Float32Array(count),
      z: new Float32Array(count),
    };
  for (let k = 0; k < count; k++) {
    const t = tiles[k]!,
      x = (t % n) * g.tileKm - half + (fireUnit(key + 1, t) - 0.5) * 2 * JITTER * g.tileKm,
      z =
        Math.floor(t / n) * g.tileKm - half + (fireUnit(key + 2, t) - 0.5) * 2 * JITTER * g.tileKm;
    (out.at as Float64Array)[k] = first + costs[k]! * scale;
    (out.x as Float32Array)[k] = x;
    (out.z as Float32Array)[k] = z;
    (out.y as Float32Array)[k] = groundAt(g, x, z);
  }
  return out;
}

/**
 * The moment on a fire's own clock at moment t, the clock's pace set (world seconds a second): as the world's, where the fire
 * takes longer than it is watched for; drawn out to be watched at a pace that would have it over in a blink.
 */
export function burnClock(burn: LandBurn, t: number, pace: number): number {
  const stretch = Math.max(1, (Math.max(0, pace) * FIRE_WATCHED_S) / wholeOf(burn));
  return burn.from + (t - burn.from) / stretch;
}

/** The first tile at or after a moment, on a list in order of moments. */
function firstFrom(at: Float64Array, moment: number): number {
  let lo = 0,
    hi = at.length;
  while (lo < hi) {
    const m = (lo + hi) >>> 1;
    if (at[m]! < moment) lo = m + 1;
    else hi = m;
  }
  return lo;
}

/** How many of its tiles a fire has come to by a moment on its clock. */
export const burnedBy = (b: BurnTiles, local: number): number => firstFrom(b.at, local);

/** A point's width in `flamesOf` and `smokeOf`'s lists: x, y, z, how fierce (0 … 1), and a number of its own. */
export const FIRE_POINT = 5;

function put(out: Float32Array, n: number, b: BurnTiles, i: number, k: number): void {
  const q = n * FIRE_POINT;
  out[q] = b.x[i]!;
  out[q + 1] = b.y[i]!;
  out[q + 2] = b.z[i]!;
  out[q + 3] = k;
  out[q + 4] = fireUnit(b.key + 3, b.tiles[i]!);
}

/**
 * The flames at a moment on a fire's clock, put in `out` from point `n` (at most `most` of them): those of the tiles it has
 * come to within a tile's burning. How many points there now are.
 */
export function flamesOf(
  b: BurnTiles,
  band: number,
  local: number,
  most: number,
  out: Float32Array,
  n = 0,
): number {
  const lo = firstFrom(b.at, local - band),
    hi = firstFrom(b.at, local),
    many = hi - lo;
  if (many <= 0 || most <= 0) return n;
  const step = Math.max(1, Math.ceil(many / most));
  for (let i = Math.ceil(lo / step) * step; i < hi; i += step) {
    const age = (local - b.at[i]!) / band,
      k = Math.max(0.12, Math.min(1, age / 0.12) * Math.pow(Math.max(0, 1 - age), 0.6));
    put(out, n++, b, i, k);
  }
  return n;
}

/** The smoke: over the flames, and thinner over what smoulders behind them, put in `out` as `flamesOf` does. */
export function smokeOf(
  b: BurnTiles,
  band: number,
  local: number,
  most: number,
  out: Float32Array,
  n = 0,
): number {
  if (most <= 0) return n;
  const lo = firstFrom(b.at, local - band),
    hi = firstFrom(b.at, local),
    old = firstFrom(b.at, local - band * (1 + SMOULDER_BANDS)),
    over = Math.max(1, Math.ceil((hi - lo) / Math.max(1, most * 0.6))),
    behind = Math.max(1, Math.ceil((lo - old) / Math.max(1, most * 0.4)));
  for (let i = Math.ceil(lo / over) * over; i < hi; i += over) put(out, n++, b, i, 1);
  for (let i = Math.ceil(old / behind) * behind; i < lo; i += behind) {
    const age = (local - b.at[i]!) / band - 1;
    put(out, n++, b, i, Math.max(0.1, 0.5 * (1 - age / SMOULDER_BANDS)));
  }
  return n;
}

/** How old a fire's scar is, of its years (0 at burned out, 1 grown back). */
export function scarAge(burn: LandBurn, t: number): number {
  return burn.gone > burn.until ? Math.max(0, (t - burn.until) / (burn.gone - burn.until)) : 1;
}

const CHAR: readonly [number, number, number] = [30, 25, 22];
const BROWN: readonly [number, number, number] = [104, 84, 56];
const EMBER: readonly [number, number, number] = [214, 84, 20];
/** Its share of the years when the scar begins to go. */
const FADES_FROM = 2 / 3;

/** What of a tile's colour the scar is, by its age (char black, browning, then going as what burned comes back). */
function scarHold(age: number): number {
  return age < FADES_FROM ? 0.92 : Math.max(0, 0.92 * (1 - (age - FADES_FROM) * 3));
}

/**
 * A fire's scar laid on a land's colours (RGBA per tile), in place: the tiles it has come to by `local`, those burning now in
 * ember, the rest char going to dry brown over its years and then to nothing. How many it lay on.
 */
export function scarOver(
  colors: Uint8Array,
  b: BurnTiles,
  burn: LandBurn,
  t: number,
  local: number,
): number {
  const age = scarAge(burn, t),
    hold = scarHold(age);
  if (hold <= 0) return 0;
  const done = firstFrom(b.at, local),
    hot = local <= burn.until ? firstFrom(b.at, local - burnBand(burn)) : done,
    browned = Math.min(1, age / FADES_FROM);
  for (let i = 0; i < done; i++) {
    const tile = b.tiles[i]!,
      q = tile * 4,
      v = fireUnit(b.key + 4, tile) * 16 - 8,
      a = i >= hot ? 0.96 : hold;
    for (let c = 0; c < 3; c++) {
      const to = i >= hot ? EMBER[c]! : CHAR[c]! + (BROWN[c]! - CHAR[c]!) * browned + v,
        own = colors[q + c]!;
      colors[q + c] = Math.max(0, Math.min(255, Math.round(own + (to - own) * a)));
    }
  }
  return done;
}

/**
 * The tiles where nothing yet stands again, marked in `mask`: those a fire has come to among the first `done` of its list, all of
 * them until its scar begins to go, then fewer as what burned comes back.
 */
export function bareTiles(mask: Uint8Array, b: BurnTiles, age: number, done: number): void {
  const back = age > FADES_FROM ? (age - FADES_FROM) * 3 : 0;
  if (back >= 1) return;
  for (let i = 0; i < Math.min(done, b.tiles.length); i++) {
    const tile = b.tiles[i]!;
    if (back <= 0 || fireUnit(b.key + 5, tile) >= back) mask[tile] = 1;
  }
}
