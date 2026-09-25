import { test } from "node:test";
import assert from "node:assert/strict";
import { dmath } from "../../src/kernel/index.ts";
import { spread, ulps } from "./ulp.ts";

// Measured 2026-09-25 against V8's Math: ≤ 4 ulps everywhere, pow ≤ 26.
const ACCURACY: [string, (x: number) => number, (x: number) => number, boolean, number[]][] = [
  ["exp", dmath.exp, Math.exp, false, [1e-8, 0.3, 1, 10, 700]],
  ["expm1", dmath.expm1, Math.expm1, false, [1e-8, 0.3, 1, 10]],
  ["log", dmath.log, Math.log, true, [1e-300, 1e-8, 0.5, 2, 1e5, 1e300]],
  ["log1p", dmath.log1p, Math.log1p, true, [1e-8, 0.3, 1, 1e5]],
  ["log2", dmath.log2, Math.log2, true, [1e-8, 0.5, 2, 1e5]],
  ["log10", dmath.log10, Math.log10, true, [1e-8, 0.5, 2, 1e5]],
  ["sin", dmath.sin, Math.sin, false, [1e-8, 0.7, 3, 100, 1e5]],
  ["cos", dmath.cos, Math.cos, false, [1e-8, 0.7, 3, 100, 1e5]],
  ["tan", dmath.tan, Math.tan, false, [1e-8, 0.7, 3, 100]],
  ["atan", dmath.atan, Math.atan, false, [1e-8, 0.5, 1, 3, 1e5]],
  ["asin", dmath.asin, Math.asin, false, [1e-8, 0.5, 1]],
  ["acos", dmath.acos, Math.acos, false, [1e-8, 0.5, 1]],
  ["sinh", dmath.sinh, Math.sinh, false, [1e-8, 0.5, 3, 30, 700]],
  ["cosh", dmath.cosh, Math.cosh, false, [1e-8, 0.5, 3, 30, 700]],
  ["tanh", dmath.tanh, Math.tanh, false, [1e-8, 0.5, 3, 30]],
  ["cbrt", dmath.cbrt, Math.cbrt, false, [1e-8, 0.5, 3, 1e5, 1e300]],
];

for (const [name, mine, native, positive, scales] of ACCURACY) {
  test(`dmath.${name} is within 6 ulps of the platform`, () => {
    for (const scale of scales)
      for (const x of spread(2000, scale, 17, positive)) {
        const u = ulps(mine(x), native(x));
        assert.ok(u <= 6, `${name}(${x}) = ${mine(x)}, platform ${native(x)}: ${u} ulps`);
      }
  });
}

test("dmath.pow and atan2 are accurate", () => {
  for (const x of spread(1500, 50, 5, true))
    for (const y of spread(8, 6, 9)) {
      const u = ulps(dmath.pow(x, y), Math.pow(x, y));
      assert.ok(u <= 64, `pow(${x}, ${y}): ${u} ulps`);
    }
  for (const x of spread(1000, 50, 5))
    for (const y of spread(8, 6, 9)) assert.ok(ulps(dmath.atan2(y, x), Math.atan2(y, x)) <= 6);
});

test("dmath follows ECMAScript's special values", () => {
  const cases: [string, number, number][] = [
    ["exp(-Inf)", dmath.exp(-Infinity), 0],
    ["exp(Inf)", dmath.exp(Infinity), Infinity],
    ["exp(1000)", dmath.exp(1000), Infinity],
    ["log(0)", dmath.log(0), -Infinity],
    ["log(-1)", dmath.log(-1), NaN],
    ["log(1)", dmath.log(1), 0],
    ["log2(1024)", dmath.log2(1024), 10],
    ["log2(2^-1074)", dmath.log2(5e-324), -1074],
    ["sin(-0)", dmath.sin(-0), -0],
    ["sin(Inf)", dmath.sin(Infinity), NaN],
    ["atan(-0)", dmath.atan(-0), -0],
    ["atan(Inf)", dmath.atan(Infinity), Math.PI / 2],
    ["atan2(0, -0)", dmath.atan2(0, -0), Math.PI],
    ["atan2(-0, -0)", dmath.atan2(-0, -0), -Math.PI],
    ["atan2(-0, 0)", dmath.atan2(-0, 0), -0],
    ["atan2(1, 0)", dmath.atan2(1, 0), Math.PI / 2],
    ["atan2(Inf, -Inf)", dmath.atan2(Infinity, -Infinity), (3 * Math.PI) / 4],
    ["asin(1)", dmath.asin(1), Math.PI / 2],
    ["acos(-1)", dmath.acos(-1), Math.PI],
    ["pow(2, 10)", dmath.pow(2, 10), 1024],
    ["pow(-2, 3)", dmath.pow(-2, 3), -8],
    ["pow(-2, 0.5)", dmath.pow(-2, 0.5), NaN],
    ["pow(-0, -3)", dmath.pow(-0, -3), -Infinity],
    ["pow(1, Inf)", dmath.pow(1, Infinity), NaN],
    ["pow(NaN, 0)", dmath.pow(NaN, 0), 1],
    ["cbrt(-27)", dmath.cbrt(-27), -3],
    ["hypot(3, 4)", dmath.hypot(3, 4), 5],
    ["hypot(Inf, NaN)", dmath.hypot(Infinity, NaN), Infinity],
    ["tanh(-Inf)", dmath.tanh(-Infinity), -1],
  ];
  for (const [label, actual, expected] of cases)
    assert.ok(Object.is(actual, expected), `${label} = ${actual}, expected ${expected}`);
});

test("pow2 and scale are exact across the whole exponent range", () => {
  for (let k = -1074; k <= 1023; k++) assert.equal(dmath.pow2(k), 2 ** k, `2^${k}`);
  assert.equal(dmath.scale(1.5, -1074), 5e-324 * 2);
  assert.equal(dmath.scale(1, 1024), Infinity);
});
