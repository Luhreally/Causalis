import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Permutation,
  Rng,
  apportion,
  defineStream,
  drawWithoutReplacement,
  multinomial,
  poisson,
  seedFromText,
  selectLowest,
  weightedIndex,
  weightedKey,
  type Keyed,
} from "../../src/kernel/index.ts";

const S = defineStream("test.sample");
const rng = new Rng(seedFromText("sample"));

test("a permutation is a bijection for every size", () => {
  for (const n of [1, 2, 3, 5, 16, 17, 100, 1000, 4097]) {
    const p = new Permutation(n, 99),
      seen = new Set<number>();
    for (let i = 0; i < n; i++) {
      const v = p.at(i);
      assert.ok(v >= 0 && v < n);
      seen.add(v);
    }
    assert.equal(seen.size, n, `size ${n}`);
  }
  assert.notEqual(new Permutation(1000, 1).at(0), new Permutation(1000, 2).at(0));
});

test("apportion sums exactly and follows the weights", () => {
  const parts = apportion(1000, [410, 160, 80, 240, 35, 75]);
  assert.deepEqual(parts, [410, 160, 80, 240, 35, 75]);
  for (let total = 0; total < 200; total++) {
    const w = [3, 1, 0, 2.5, 0.25],
      p = apportion(total, w);
    assert.equal(
      p.reduce((a, b) => a + b, 0),
      total,
    );
    assert.equal(p[2], 0, "a zero weight gets nothing");
    for (let i = 0; i < w.length; i++) assert.ok(Math.abs(p[i]! - (total * w[i]!) / 6.75) < 1);
  }
  // Ties go to the lower tie key, not the lower index.
  assert.deepEqual(apportion(1, [1, 1], [5, 2]), [0, 1]);
});

test("selectLowest ignores input order", () => {
  const items: Keyed<string>[] = [];
  for (let i = 0; i < 50; i++) items.push({ key: rng.u32(S, i), tie: i, item: `x${i}` });
  const a = selectLowest(items, 7),
    b = selectLowest([...items].reverse(), 7);
  assert.deepEqual(a, b);
  assert.equal(a.length, 7);
});

test("weighted keys pick in proportion to weight", () => {
  const weights = [1, 2, 7],
    wins = [0, 0, 0];
  for (let trial = 0; trial < 20000; trial++) {
    let best = -1,
      bestKey = Infinity;
    for (let i = 0; i < 3; i++) {
      const k = weightedKey(rng.real(S, i, trial), weights[i]!);
      if (k < bestKey) {
        bestKey = k;
        best = i;
      }
    }
    wins[best]!++;
  }
  assert.ok(Math.abs(wins[2]! / 20000 - 0.7) < 0.02, `wins ${wins}`);
  assert.ok(Math.abs(wins[0]! / 20000 - 0.1) < 0.02, `wins ${wins}`);
  assert.equal(weightedIndex([0, 0], 0.5), -1);
  assert.equal(weightedIndex([0, 3, 0], 0.99), 1);
});

test("poisson has the right mean for small and large lambda", () => {
  for (const lambda of [0.5, 4, 80]) {
    let sum = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) sum += poisson(lambda, (k) => rng.real(S, i, lambda * 1000, 0, k));
    assert.ok(
      Math.abs(sum / n - lambda) < 0.08 * Math.max(1, Math.sqrt(lambda)),
      `lambda ${lambda}: mean ${sum / n}`,
    );
  }
  assert.equal(
    poisson(0, () => 0.5),
    0,
  );
});

/** Mean and variance of each category over many keyed trials. */
function moments(draw: (trial: number) => number[], trials: number, k: number) {
  const sum = new Array<number>(k).fill(0),
    sq = new Array<number>(k).fill(0);
  for (let i = 0; i < trials; i++) {
    const x = draw(i);
    for (let c = 0; c < k; c++) {
      sum[c]! += x[c]!;
      sq[c]! += x[c]! * x[c]!;
    }
  }
  return sum.map((s, c) => ({ mean: s / trials, variance: sq[c]! / trials - (s / trials) ** 2 }));
}

test("a multinomial sums exactly and has the binomial's mean and spread, for any count", () => {
  // Few chances (one by one), many with a middling share (normal), many with a rare one (Poisson).
  const weights = [0.5, 0.3, 0.195, 0.005];
  for (const n of [7, 32, 33, 400, 5000, 1_000_000]) {
    const draw = (i: number) => multinomial(n, weights, (j) => rng.real(S, i, n, 7, j));
    for (let i = 0; i < 50; i++)
      assert.equal(
        draw(i).reduce((a, b) => a + b, 0),
        n,
      );
    const m = moments(draw, 3000, weights.length);
    weights.forEach((w, c) => {
      const mean = n * w,
        variance = n * w * (1 - w);
      assert.ok(
        Math.abs(m[c]!.mean - mean) < 0.1 * Math.sqrt(variance) + 0.02,
        `n ${n}, share ${w}: mean ${m[c]!.mean} not ${mean}`,
      );
      assert.ok(
        Math.abs(m[c]!.variance / variance - 1) < 0.1 + 2 / Math.sqrt(3000 * variance),
        `n ${n}, share ${w}: variance ${m[c]!.variance} not ${variance}`,
      );
    });
  }
  // Categories that cannot come up never do.
  assert.deepEqual(
    multinomial(500, [0, 1, 0, 3, 0], (j) => rng.real(S, 1, 2, 3, j)).map((x, c) => (x ? c : -1)),
    [-1, 1, -1, 3, -1],
  );
});

test("drawing without replacement takes exactly n, never more than a pool holds", () => {
  const pools = [5000, 20, 3, 0, 1200, 40_000];
  for (const n of [10, 33, 900, 30_000, 46_223, 46_300]) {
    const draw = (i: number) => drawWithoutReplacement(n, pools, (j) => rng.real(S, i, n, 8, j));
    for (let i = 0; i < 200; i++) {
      const x = draw(i);
      assert.equal(
        x.reduce((a, b) => a + b, 0),
        Math.min(n, 46_223),
      );
      x.forEach((v, k) => assert.ok(v >= 0 && v <= pools[k]!, `pool ${k}: ${v}`));
    }
    const total = 46_223,
      m = moments(draw, 2000, pools.length);
    pools.forEach((size, k) => {
      const mean = (Math.min(n, total) * size) / total;
      assert.ok(
        Math.abs(m[k]!.mean - mean) < 0.05 * mean + 0.2,
        `n ${n}, pool ${size}: mean ${m[k]!.mean} not ${mean}`,
      );
    });
  }
});
