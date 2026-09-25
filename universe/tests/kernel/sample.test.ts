import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Permutation,
  Rng,
  apportion,
  defineStream,
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
