// Order-independent sampling (docs/architecture §6). Each primitive gives the same
// answer however its inputs happen to be ordered, because every candidate carries
// its own keyed draw and ties are broken by a total order.
import { TWO32 } from "./bits.ts";
import { finish, mix } from "./hash.ts";
import { cos, exp, log, pow2, sqrt, TAU } from "./dmath.ts";

/** A candidate for keyed selection: its draw (u32 or real) and a total-order tie-breaker. */
export type Keyed<T> = { readonly key: number; readonly tie: string | number; readonly item: T };

function compareKeyed<T>(x: Keyed<T>, y: Keyed<T>): number {
  if (x.key !== y.key) return x.key < y.key ? -1 : 1;
  return x.tie < y.tie ? -1 : x.tie > y.tie ? 1 : 0;
}

/** The k candidates with the smallest keys, smallest first. The input order never matters. */
export function selectLowest<T>(candidates: readonly Keyed<T>[], k: number): T[] {
  if (k <= 0) return [];
  return [...candidates]
    .sort(compareKeyed)
    .slice(0, k)
    .map((c) => c.item);
}

/**
 * The key that makes weighted sampling without replacement order-independent
 * (Efraimidis–Spirakis in exponential form): draw u in (0, 1], key −ln(u)/w;
 * the smallest keys win. u is a uniform in [0, 1).
 */
export function weightedKey(u: number, weight: number): number {
  if (!(weight > 0)) return Infinity;
  return -log(1 - u) / weight;
}

/** Index chosen with probability ∝ weights[i], from one uniform u in [0, 1). Order is the array's. */
export function weightedIndex(weights: readonly number[], u: number): number {
  let total = 0;
  for (const w of weights) if (w > 0) total += w;
  if (!(total > 0)) return -1;
  let target = u * total,
    last = -1;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i]!;
    if (!(w > 0)) continue;
    last = i;
    if (target < w) return i;
    target -= w;
  }
  return last;
}

/**
 * Split an integer total into integer parts proportional to weights, summing
 * exactly to the total (largest remainder). Ties in the remainders go to the
 * lower tieKey, which callers draw from a stream so no index is favoured.
 */
export function apportion(
  total: number,
  weights: readonly number[],
  tieKeys?: readonly number[],
): number[] {
  if (!Number.isInteger(total) || total < 0)
    throw new Error(`apportion needs a non-negative integer, got ${total}`);
  const n = weights.length,
    parts = new Array<number>(n).fill(0);
  let sum = 0;
  for (const w of weights) if (w > 0) sum += w;
  if (n === 0 || total === 0) return parts;
  if (!(sum > 0)) throw new Error("apportion needs at least one positive weight");
  const order: { i: number; rem: number; tie: number }[] = [];
  let given = 0;
  for (let i = 0; i < n; i++) {
    const w = weights[i]! > 0 ? weights[i]! : 0,
      exact = (total * w) / sum,
      whole = Math.floor(exact);
    parts[i] = whole;
    given += whole;
    if (w > 0) order.push({ i, rem: exact - whole, tie: tieKeys?.[i] ?? i });
  }
  order.sort((x, y) =>
    x.rem !== y.rem
      ? x.rem > y.rem
        ? -1
        : 1
      : x.tie !== y.tie
        ? x.tie < y.tie
          ? -1
          : 1
        : x.i - y.i,
  );
  for (let r = 0; given < total; r = (r + 1) % order.length, given++) parts[order[r]!.i]!++;
  return parts;
}

/**
 * A keyed bijection of [0, n): position i holds permutation.at(i). Four Feistel
 * rounds over the smallest even bit width that covers n, cycle-walking back into
 * range. O(1) per lookup, no storage — how a crowd of n is ordered without
 * listing it.
 */
export class Permutation {
  readonly size: number;
  private readonly half: number;
  private readonly span: number;
  private readonly mask: number;
  private readonly keys: readonly number[];
  constructor(size: number, key: number) {
    if (!Number.isInteger(size) || size < 1 || size > TWO32)
      throw new Error(`permutation size ${size}`);
    this.size = size;
    let bits = 2;
    while (pow2(bits) < size) bits += 2;
    this.half = bits / 2;
    this.span = pow2(this.half);
    this.mask = this.span - 1;
    const keys: number[] = [];
    for (let r = 0; r < 4; r++) keys.push(finish(mix(mix(0x3c6ef372, key), r), 2));
    this.keys = keys;
  }
  private round(value: number, r: number): number {
    return finish(mix(this.keys[r]!, value), 1) & this.mask;
  }
  private once(x: number): number {
    let left = Math.floor(x / this.span),
      right = x % this.span;
    for (let r = 0; r < 4; r++) {
      const next = (left ^ this.round(right, r)) & this.mask;
      left = right;
      right = next;
    }
    return left * this.span + right;
  }
  at(i: number): number {
    if (!Number.isInteger(i) || i < 0 || i >= this.size)
      throw new Error(`index ${i} outside [0, ${this.size})`);
    let x = this.once(i);
    while (x >= this.size) x = this.once(x);
    return x;
  }
}

/** A standard normal variate from two uniforms in [0, 1) (Box–Muller). */
export function gaussian(u1: number, u2: number): number {
  return sqrt(-2 * log(1 - u1)) * cos(TAU * u2);
}

/**
 * A Poisson count with mean lambda. `uniform(n)` returns the n-th uniform of the
 * caller's key. Small means multiply uniforms; large means use a rounded normal.
 */
export function poisson(lambda: number, uniform: (n: number) => number): number {
  if (!(lambda > 0)) return 0;
  if (lambda < 30) {
    const limit = exp(-lambda);
    let k = 0,
      p = 1;
    for (;;) {
      p *= uniform(k);
      if (p <= limit) return k;
      k++;
    }
  }
  const z = gaussian(uniform(0), uniform(1)),
    x = Math.round(lambda + z * sqrt(lambda));
  return x < 0 ? 0 : x;
}

/** A 32-bit uniform to [0, 1). */
export function toUnit(u32: number): number {
  return (u32 >>> 0) / TWO32;
}
