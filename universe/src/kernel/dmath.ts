// Deterministic math. JavaScript rounds + − × ÷ and Math.sqrt exactly (IEEE-754,
// round to nearest, no fused operations), but leaves sin, exp, log, pow and the
// rest "implementation-approximated": V8, JavaScriptCore and SpiderMonkey may
// differ in the last bit. Simulation code uses these instead. Each is built only
// from exact operations in a fixed order, so it returns the same bits everywhere.
//
// Accuracy: within a few units in the last place of the true value for exp, log,
// sin, cos, atan and friends (tests/kernel/dmath.test.ts measures it against the
// platform's Math); sin/cos/tan reduce their argument accurately for |x| < 1e6;
// pow of a non-integer exponent is exp(y·log x), within |y·log x| ulps.
import { fromWords, highWord, withHighWord } from "./bits.ts";

export const PI = Math.PI;
export const TAU = 2 * Math.PI;
export const HALF_PI = Math.PI / 2;
export const E = Math.E;
export const LN2 = Math.LN2;
export const LN10 = Math.LN10;
export const SQRT2 = Math.SQRT2;

export const sqrt = Math.sqrt;
export const abs = Math.abs;
export const floor = Math.floor;
export const ceil = Math.ceil;
export const round = Math.round;
export const trunc = Math.trunc;
export const sign = Math.sign;
export const min = Math.min;
export const max = Math.max;
export const fround = Math.fround;

// ln 2 split so that k·LN2_HI is exact for |k| < 2^11 (fdlibm).
const LN2_HI = fromWords(0x3fe62e42, 0xfee00000);
const LN2_LO = fromWords(0x3dea39ef, 0x35793c76);
const INV_LN2 = fromWords(0x3ff71547, 0x652b82fe);
const INV_LN10 = 1 / Math.LN10;
// π/2 in three 33-bit pieces for argument reduction (fdlibm __ieee754_rem_pio2).
const PIO2_1 = fromWords(0x3ff921fb, 0x54400000);
const PIO2_2 = fromWords(0x3dd0b461, 0x1a600000);
const PIO2_3 = fromWords(0x3ba3198a, 0x2e000000);
const INV_PIO2 = fromWords(0x3fe45f30, 0x6dc9c883);
const PIO2_HI = fromWords(0x3ff921fb, 0x54442d18);
const PIO2_LO = fromWords(0x3c91a626, 0x33145c07);

const EXP_MAX = 709.782712893384;
const EXP_MIN = -745.1332191019412;

// Reciprocal factorials and the odd reciprocals for the series below, computed once.
// n! is exact in a float64 up to 18!, so each 1/n! rounds once.
const INV_FACT: number[] = [1];
for (let n = 1, fact = 1; n <= 20; n++) {
  fact *= n;
  INV_FACT.push(1 / fact);
}
const f = (n: number) => INV_FACT[n]!;

/** 2^k exactly, for integer k (0 below 2^-1074, Infinity above 2^1023). */
export function pow2(k: number): number {
  if (k > 1023) return Infinity;
  if (k >= -1022) return fromWords((k + 1023) << 20, 0);
  if (k < -1074) return 0;
  return pow2(k + 60) * pow2(-60);
}

/** x·2^k with a single rounding (ldexp). */
export function scale(x: number, k: number): number {
  if (k > 1023) return x * pow2(1023) * pow2(k - 1023);
  if (k < -1022) return x * pow2(k + 1000) * pow2(-1000);
  return x * pow2(k);
}

// Decomposition shared by the logarithms: x = m·2^e with m in [√2/2, √2).
let decE = 0;
function decompose(x: number): number {
  let hx = highWord(x),
    e = (hx >>> 20) - 1023;
  if (e === -1023) {
    x *= pow2(54);
    hx = highWord(x);
    e = (hx >>> 20) - 1023 - 54;
  }
  let m = withHighWord(x, (hx & 0x000fffff) | 0x3ff00000);
  if (m > Math.SQRT2) {
    m *= 0.5;
    e += 1;
  }
  decE = e;
  return m;
}

// Evaluate c[0] + z·(c[1] + z·(c[2] + …)): Horner's rule, always in this order.
function horner(c: readonly number[], z: number): number {
  let acc = c[c.length - 1]!;
  for (let i = c.length - 2; i >= 0; i--) acc = c[i]! + z * acc;
  return acc;
}

// Series coefficients, computed once: log (2/3, 2/5, …, 2/23), exp (1/0! … 1/13!),
// expm1 (1/1! … 1/14!), sin (−1/3!, 1/5!, … 1/17!), cos (1/4!, −1/6!, … −1/18!),
// atan (1, −1/3, 1/5, … −1/23).
const LOG_SERIES: number[] = [];
for (let k = 1; k <= 11; k++) LOG_SERIES.push(2 / (2 * k + 1));
const EXP_SERIES = INV_FACT.slice(0, 14);
const EXPM1_SERIES = INV_FACT.slice(1, 15);
const SIN_SERIES: number[] = [];
for (let k = 1; k <= 8; k++) SIN_SERIES.push((k % 2 === 1 ? -1 : 1) * INV_FACT[2 * k + 1]!);
const COS_SERIES: number[] = [];
for (let k = 2; k <= 9; k++) COS_SERIES.push((k % 2 === 0 ? 1 : -1) * INV_FACT[2 * k]!);
const ATAN_SERIES: number[] = [];
for (let k = 0; k <= 11; k++) ATAN_SERIES.push((k % 2 === 0 ? 1 : -1) / (2 * k + 1));

// log(1+g) for |g| ≤ 0.42, as g − s·(g − R) with s = g/(2+g).
function log1pKernel(g: number): number {
  const s = g / (2 + g),
    z = s * s,
    R = z * horner(LOG_SERIES, z);
  return g - s * (g - R);
}

/** Natural logarithm. */
export function log(x: number): number {
  if (x !== x || x < 0) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return Infinity;
  const m = decompose(x),
    e = decE;
  return e * LN2_HI + (log1pKernel(m - 1) + e * LN2_LO);
}

/** Base-2 logarithm; exact for powers of two. */
export function log2(x: number): number {
  if (x !== x || x < 0) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return Infinity;
  const m = decompose(x),
    e = decE;
  return e + log1pKernel(m - 1) * INV_LN2;
}

/** Base-10 logarithm. */
export function log10(x: number): number {
  return log(x) * INV_LN10;
}

/** log(1 + x), accurate for small x. */
export function log1p(x: number): number {
  if (x !== x || x < -1) return NaN;
  if (x === -1) return -Infinity;
  if (x === Infinity) return Infinity;
  if (Math.abs(x) < 0.25) return log1pKernel(x);
  const u = 1 + x;
  return log(u) + (x - (u - 1)) / u;
}

function expKernel(r: number): number {
  return horner(EXP_SERIES, r);
}

/** e^x. */
export function exp(x: number): number {
  if (x !== x) return NaN;
  if (x > EXP_MAX) return Infinity;
  if (x < EXP_MIN) return 0;
  const k = Math.round(x * INV_LN2),
    r = x - k * LN2_HI - k * LN2_LO;
  return scale(expKernel(r), k);
}

/** e^x − 1, accurate for small x. */
export function expm1(x: number): number {
  if (x !== x) return NaN;
  if (Math.abs(x) >= 0.35) return exp(x) - 1;
  if (x === 0) return x;
  return x * horner(EXPM1_SERIES, x);
}

// sin and cos on [−π/4, π/4].
function sinKernel(r: number): number {
  const z = r * r;
  return r + r * z * horner(SIN_SERIES, z);
}
function cosKernel(r: number): number {
  const z = r * r;
  return 1 - 0.5 * z + z * z * horner(COS_SERIES, z);
}

// Argument reduction: x = n·π/2 + r with |r| ≤ ~π/4.
let redN = 0;
function reduce(x: number): number {
  if (Math.abs(x) <= Math.PI / 4) {
    redN = 0;
    return x;
  }
  const n = Math.round(x * INV_PIO2);
  redN = n;
  return x - n * PIO2_1 - n * PIO2_2 - n * PIO2_3;
}

function quadrant(n: number): number {
  return ((n % 4) + 4) % 4;
}

/** Sine. */
export function sin(x: number): number {
  if (x !== x || x === Infinity || x === -Infinity) return NaN;
  if (x === 0) return x;
  const r = reduce(x);
  switch (quadrant(redN)) {
    case 0:
      return sinKernel(r);
    case 1:
      return cosKernel(r);
    case 2:
      return -sinKernel(r);
    default:
      return -cosKernel(r);
  }
}

/** Cosine. */
export function cos(x: number): number {
  if (x !== x || x === Infinity || x === -Infinity) return NaN;
  const r = reduce(x);
  switch (quadrant(redN)) {
    case 0:
      return cosKernel(r);
    case 1:
      return -sinKernel(r);
    case 2:
      return -cosKernel(r);
    default:
      return sinKernel(r);
  }
}

/** Tangent. */
export function tan(x: number): number {
  if (x !== x || x === Infinity || x === -Infinity) return NaN;
  if (x === 0) return x;
  const r = reduce(x),
    s = sinKernel(r),
    c = cosKernel(r);
  return redN % 2 === 0 ? s / c : -c / s;
}

// atan on [0, 1] by two argument halvings and the odd series.
function atanKernel(t: number): number {
  let u = t / (1 + Math.sqrt(1 + t * t));
  u = u / (1 + Math.sqrt(1 + u * u));
  return 4 * u * horner(ATAN_SERIES, u * u);
}

function negative(x: number): boolean {
  return x < 0 || (x === 0 && 1 / x < 0);
}

/** Arctangent. */
export function atan(x: number): number {
  if (x !== x) return NaN;
  const neg = negative(x),
    t = Math.abs(x);
  const r = t > 1 ? PIO2_HI - (atanKernel(1 / t) - PIO2_LO) : atanKernel(t);
  return neg ? -r : r;
}

/** Arctangent of y/x in the correct quadrant, with ECMAScript's signed zeros and infinities. */
export function atan2(y: number, x: number): number {
  if (x !== x || y !== y) return NaN;
  const ny = negative(y);
  if (y === 0) return negative(x) ? (ny ? -Math.PI : Math.PI) : y;
  if (x === 0) return ny ? -HALF_PI : HALF_PI;
  if (y === Infinity || y === -Infinity) {
    const r = x === Infinity ? Math.PI / 4 : x === -Infinity ? (3 * Math.PI) / 4 : HALF_PI;
    return ny ? -r : r;
  }
  if (x === Infinity) return ny ? -0 : 0;
  if (x === -Infinity) return ny ? -Math.PI : Math.PI;
  const a = atan(Math.abs(y / x)),
    r = x > 0 ? a : Math.PI - a;
  return ny ? -r : r;
}

/** Arcsine. */
export function asin(x: number): number {
  if (x !== x || x > 1 || x < -1) return NaN;
  return atan2(x, Math.sqrt((1 - x) * (1 + x)));
}

/** Arccosine. */
export function acos(x: number): number {
  if (x !== x || x > 1 || x < -1) return NaN;
  return atan2(Math.sqrt((1 - x) * (1 + x)), x);
}

/** Hyperbolic sine. */
export function sinh(x: number): number {
  if (x !== x) return NaN;
  const a = Math.abs(x),
    s = negative(x) ? -1 : 1;
  if (a === Infinity) return x;
  if (a < 22) {
    const t = expm1(a);
    return s * 0.5 * (t + t / (t + 1));
  }
  if (a < EXP_MAX) return s * 0.5 * exp(a);
  const w = exp(0.5 * a);
  return s * (0.5 * w) * w;
}

/** Hyperbolic cosine. */
export function cosh(x: number): number {
  if (x !== x) return NaN;
  const a = Math.abs(x);
  if (a === Infinity) return Infinity;
  if (a < 0.5 * LN2) {
    const t = expm1(a),
      w = 1 + t;
    return 1 + (t * t) / (w + w);
  }
  if (a < 22) {
    const t = exp(a);
    return 0.5 * t + 0.5 / t;
  }
  if (a < EXP_MAX) return 0.5 * exp(a);
  const w = exp(0.5 * a);
  return 0.5 * w * w;
}

/** Hyperbolic tangent. */
export function tanh(x: number): number {
  if (x !== x) return NaN;
  const a = Math.abs(x),
    s = negative(x) ? -1 : 1;
  if (a > 22) return s;
  if (a < 2.7755575615628914e-17) return x;
  if (a >= 1) {
    const t = expm1(2 * a);
    return s * (1 - 2 / (t + 2));
  }
  const t = expm1(-2 * a);
  return s * (-t / (t + 2));
}

/** Cube root. */
export function cbrt(x: number): number {
  if (x !== x || x === 0 || x === Infinity || x === -Infinity) return x;
  const a = Math.abs(x);
  let y = exp(log(a) / 3);
  y = y - (y * y * y - a) / (3 * y * y);
  y = y - (y * y * y - a) / (3 * y * y);
  return x < 0 ? -y : y;
}

/** √(a² + b²) without overflow or underflow. */
export function hypot(a: number, b: number): number {
  if (a === Infinity || a === -Infinity || b === Infinity || b === -Infinity) return Infinity;
  if (a !== a || b !== b) return NaN;
  const x = Math.abs(a),
    y = Math.abs(b),
    m = x > y ? x : y,
    n = x > y ? y : x;
  if (m === 0) return 0;
  const r = n / m;
  return m * Math.sqrt(1 + r * r);
}

function powInt(x: number, n: number): number {
  let result = 1,
    base = x,
    k = n;
  while (k > 0) {
    if (k & 1) result *= base;
    base *= base;
    k = Math.floor(k / 2);
  }
  return result;
}

function isOddInteger(y: number): boolean {
  return Number.isInteger(y) && Math.abs(y % 2) === 1;
}

/** x^y with ECMAScript's special cases. Integer exponents up to 2^31 multiply exactly-ordered squares. */
export function pow(x: number, y: number): number {
  if (y !== y) return NaN;
  if (y === 0) return 1;
  if (x !== x) return NaN;
  const ax = Math.abs(x);
  if (y === Infinity) return ax === 1 ? NaN : ax > 1 ? Infinity : 0;
  if (y === -Infinity) return ax === 1 ? NaN : ax > 1 ? 0 : Infinity;
  if (x === Infinity) return y > 0 ? Infinity : 0;
  if (x === -Infinity) {
    if (y > 0) return isOddInteger(y) ? -Infinity : Infinity;
    return isOddInteger(y) ? -0 : 0;
  }
  if (x === 0) {
    const negZero = 1 / x < 0 && isOddInteger(y);
    if (y > 0) return negZero ? -0 : 0;
    return negZero ? -Infinity : Infinity;
  }
  const integer = Number.isInteger(y);
  if (x < 0 && !integer) return NaN;
  let r: number;
  if (integer && Math.abs(y) <= 2147483647) {
    const p = powInt(ax, Math.abs(y));
    r = y > 0 ? p : 1 / p;
  } else r = exp(y * log(ax));
  return x < 0 && isOddInteger(y) ? -r : r;
}

/** x clamped to [lo, hi]. */
export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Linear interpolation from a to b. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Hermite smoothstep of t in [0, 1]. */
export function smoothstep(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

/** Modulo with the sign of the divisor (always in [0, m) for m > 0). */
export function mod(a: number, m: number): number {
  const r = a % m;
  return r < 0 ? r + m : r;
}
