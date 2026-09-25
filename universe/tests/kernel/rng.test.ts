import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng, defineStream, purpose, seedFromText, streams } from "../../src/kernel/index.ts";

const A = defineStream("test.rng.a");
const B = defineStream("test.rng.b");

test("a draw is a pure function of its key", () => {
  const one = new Rng(seedFromText("alpha")),
    two = new Rng(seedFromText("alpha"));
  for (let s = 0; s < 100; s++) assert.equal(one.u32(A, s, 5, 1, 2), two.u32(A, s, 5, 1, 2));
  // Asking in a different order changes nothing.
  const forward = [0, 1, 2, 3].map((s) => one.real(B, s)),
    backward = [3, 2, 1, 0].map((s) => one.real(B, s)).reverse();
  assert.deepEqual(forward, backward);
});

test("every part of the key changes the draw", () => {
  const rng = new Rng(seedFromText("alpha")),
    base = rng.u32(A, 10, 100, 3, 0);
  assert.notEqual(new Rng(seedFromText("beta")).u32(A, 10, 100, 3, 0), base);
  assert.notEqual(rng.u32(B, 10, 100, 3, 0), base);
  assert.notEqual(rng.u32(A, 11, 100, 3, 0), base);
  assert.notEqual(rng.u32(A, 10, 101, 3, 0), base);
  assert.notEqual(rng.u32(A, 10, 100 + 2 ** 40, 3, 0), base, "the high word of time counts");
  assert.notEqual(rng.u32(A, 10, 100, 4, 0), base);
  assert.notEqual(rng.u32(A, 10, 100, 3, 1), base);
});

test("draws are uniform enough: bucket counts and mean", () => {
  const rng = new Rng(seedFromText("uniform")),
    buckets = new Array<number>(16).fill(0),
    n = 64000;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const u = rng.real(A, i);
    sum += u;
    buckets[Math.floor(u * 16)]!++;
  }
  assert.ok(Math.abs(sum / n - 0.5) < 0.005, `mean ${sum / n}`);
  const expected = n / 16;
  let chi = 0;
  for (const b of buckets) chi += (b - expected) ** 2 / expected;
  assert.ok(chi < 40, `chi-square ${chi} over 15 degrees of freedom`);
});

test("neighbouring subjects and streams are not correlated", () => {
  const rng = new Rng(seedFromText("corr")),
    n = 20000;
  let sxy = 0,
    sx = 0,
    sy = 0,
    sxx = 0,
    syy = 0;
  for (let i = 0; i < n; i++) {
    const x = rng.real(A, i),
      y = rng.real(A, i + 1);
    sx += x;
    sy += y;
    sxy += x * y;
    sxx += x * x;
    syy += y * y;
  }
  const r = (n * sxy - sx * sy) / Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  assert.ok(Math.abs(r) < 0.03, `correlation ${r}`);
});

test("index, chance and range stay in their bounds", () => {
  const rng = new Rng(seedFromText("bounds"));
  for (let i = 0; i < 5000; i++) {
    const k = rng.index(7, A, i);
    assert.ok(Number.isInteger(k) && k >= 0 && k < 7);
    const x = rng.range(-2, 3, B, i);
    assert.ok(x >= -2 && x < 3);
  }
  assert.equal(rng.chance(0, A, 1), false);
  assert.equal(rng.chance(1, A, 1), true);
});

test("streams are registered once, by dotted tag", () => {
  assert.throws(() => defineStream("test.rng.a"), /defined twice/);
  assert.throws(() => defineStream("NoDots"), /dotted lowercase/);
  const tags = streams().map((s) => s.tag);
  assert.deepEqual(tags, [...tags].sort());
  assert.equal(purpose("birth"), purpose("birth"));
  assert.notEqual(purpose("birth"), purpose("death"));
});
