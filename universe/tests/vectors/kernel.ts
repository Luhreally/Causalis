// The kernel's golden vectors: fixed inputs through every deterministic function,
// recorded as bit patterns. The same list is computed in Node (tests), and in
// Chromium, WebKit and Firefox (tools/engines.ts); all must match
// tests/golden/kernel.json bit for bit. Inputs come from a fixed integer
// generator, not from the kernel, so a change to the kernel cannot hide itself.
import {
  Hasher,
  Permutation,
  Rng,
  apportion,
  defineStream,
  dmath,
  f64Hex,
  hashString,
  seedFromText,
  type Stream,
} from "../../src/kernel/index.ts";

function* lcg(seed: number, count: number): Generator<number> {
  let s = seed >>> 0;
  for (let i = 0; i < count; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    yield s / 4294967296;
  }
}

const SPECIAL = [
  0,
  -0,
  1,
  -1,
  0.5,
  -0.5,
  2,
  1e-300,
  -1e-300,
  5e-324,
  1e300,
  Infinity,
  -Infinity,
  NaN,
];

function inputs(scale: number, seed: number, count = 12): number[] {
  return [...lcg(seed, count)].map((u) => (u - 0.5) * 2 * scale);
}

const SCALES = [1e-9, 1e-4, 0.3, 1, 3.5, 40, 700, 1e5];

function grid(positive: boolean): number[] {
  const out = [...SPECIAL];
  SCALES.forEach((scale, i) => {
    for (const x of inputs(scale, 1000 + i)) out.push(positive ? Math.abs(x) : x);
  });
  return out;
}

let streams: { a: Stream; b: Stream } | null = null;

/** Every vector as [label, hex]; the order is part of the golden file. */
export function kernelVectors(): [string, string][] {
  const out: [string, string][] = [];
  const unary: [string, (x: number) => number, boolean][] = [
    ["exp", dmath.exp, false],
    ["expm1", dmath.expm1, false],
    ["log", dmath.log, true],
    ["log1p", dmath.log1p, true],
    ["log2", dmath.log2, true],
    ["log10", dmath.log10, true],
    ["sin", dmath.sin, false],
    ["cos", dmath.cos, false],
    ["tan", dmath.tan, false],
    ["atan", dmath.atan, false],
    ["asin", (x) => dmath.asin(dmath.clamp(x, -1, 1)), false],
    ["acos", (x) => dmath.acos(dmath.clamp(x, -1, 1)), false],
    ["sinh", dmath.sinh, false],
    ["cosh", dmath.cosh, false],
    ["tanh", dmath.tanh, false],
    ["cbrt", dmath.cbrt, false],
  ];
  for (const [name, fn, positive] of unary)
    for (const x of grid(positive)) out.push([`${name}(${f64Hex(x)})`, f64Hex(fn(x))]);
  const pairs = [...lcg(77, 40)].map((u, i) => [
    (u - 0.5) * 20,
    ([...lcg(900 + i, 1)][0]! - 0.3) * 8,
  ]);
  for (const [a, b] of pairs) {
    out.push([`atan2(${f64Hex(a!)},${f64Hex(b!)})`, f64Hex(dmath.atan2(a!, b!))]);
    out.push([`hypot(${f64Hex(a!)},${f64Hex(b!)})`, f64Hex(dmath.hypot(a!, b!))]);
    out.push([`pow(${f64Hex(Math.abs(a!))},${f64Hex(b!)})`, f64Hex(dmath.pow(Math.abs(a!), b!))]);
    out.push([`powi(${f64Hex(a!)},${Math.round(b!)})`, f64Hex(dmath.pow(a!, Math.round(b!)))]);
  }
  for (const [a, b] of [
    [0, -0],
    [-0, -0],
    [1, Infinity],
    [-Infinity, Infinity],
    [-0, -1],
    [NaN, 1],
  ])
    out.push([`atan2(${a},${b})`, f64Hex(dmath.atan2(a!, b!))]);

  streams ??= { a: defineStream("golden.alpha"), b: defineStream("golden.beta", 2) };
  const rng = new Rng(seedFromText("golden universe"));
  for (let subject = 0; subject < 16; subject++)
    for (const t of [0, 86400, 2 ** 40 + 3]) {
      out.push([`u32(a,${subject},${t})`, rng.u32(streams.a, subject, t, 7, subject).toString(16)]);
      out.push([`real(b,${subject},${t})`, f64Hex(rng.real(streams.b, subject, t, 1, 0))]);
    }
  for (const text of ["", "a", "Tolvey", "per:0:17", "ünïcødé ✓"])
    out.push([`hash(${text})`, hashString(text).toString(16)]);
  const h = new Hasher()
    .string("universe")
    .int(2 ** 40 + 5)
    .float(0.1)
    .float(-0)
    .bool(true);
  out.push(["hasher", h.hex()]);
  const perm = new Permutation(1000, 12345);
  out.push(["perm", [0, 1, 2, 500, 999].map((i) => perm.at(i)).join(",")]);
  out.push([
    "apportion",
    apportion(1000, [410, 160, 80, 240, 35, 75], [5, 4, 3, 2, 1, 0]).join(","),
  ]);
  out.push(["apportion.uneven", apportion(7, [1, 1, 1], [2, 0, 1]).join(",")]);
  return out;
}

/** One digest of every vector: what the engines compare first. */
export function kernelDigest(vectors = kernelVectors()): string {
  const h = new Hasher();
  for (const [label, value] of vectors) h.string(label).string(value);
  return h.hex();
}
