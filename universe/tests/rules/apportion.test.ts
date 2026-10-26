// These tests pin the split of a count over places (Phase 55, M224). They cover the capped split,
// a land's tally over its towns and countryside, the packed town lists, and the fallen rows by
// place. The numbers are worked out by hand from the rules, not copied from the code.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apportionCapped,
  fellRows,
  fellTotals,
  packTowns,
  splitTowns,
  unpackTowns,
  type LandFell,
  type Tally,
} from "../../src/rules/apportion.ts";

const INF = Infinity;

/** This keeps the whole numbers in `candidates` from 0 up to `max`, each one once. */
function picks(max: number, candidates: readonly number[]): number[] {
  return [...new Set(candidates.filter((v) => v >= 0 && v <= max))];
}

test("apportionCapped: the largest remainder, with what a full place cannot hold given to the rest", () => {
  assert.deepEqual(apportionCapped(10, [1, 1, 1], [2, INF, INF]), [2, 4, 4]);
});

test("apportionCapped: a place with no weight gets nothing", () => {
  assert.deepEqual(apportionCapped(5, [0, 1], [10, 10]), [0, 5]);
});

test("apportionCapped: no part goes above its cap", () => {
  assert.deepEqual(apportionCapped(10, [1, 1], [3, 4]), [3, 4]);
});

test("apportionCapped: nothing to split gives a zero", () => {
  assert.deepEqual(apportionCapped(0, [1], [1]), [0]);
});

test("apportionCapped: with no positive weight every part is zero, and it does not throw", () => {
  assert.deepEqual(apportionCapped(3, [0, 0], [5, 5]), [0, 0]);
});

test("apportionCapped: a cap that is not whole is taken at its floor", () => {
  assert.deepEqual(apportionCapped(5, [1, 1], [2.5, INF]), [2, 3]);
});

test("apportionCapped throws RangeError unless the total is a non-negative whole number", () => {
  assert.throws(() => apportionCapped(2.5, [1], [5]), RangeError);
  assert.throws(() => apportionCapped(-1, [1], [5]), RangeError);
});

test("splitTowns: a land's tally over its towns and countryside, with the spare hurt to the lower index", () => {
  const split = splitTowns([100, 10, 25], [50, 0, 30], 20);
  assert.deepEqual(split.towns, [
    [50, 5, 13],
    [0, 0, 0],
    [30, 3, 7],
  ]);
  assert.deepEqual(split.country, [20, 2, 5]);
});

test("splitTowns: with no people and no countryside, the countryside takes it all", () => {
  assert.deepEqual(splitTowns([7, 1, 2], [0, 0], 0), {
    towns: [
      [0, 0, 0],
      [0, 0, 0],
    ],
    country: [7, 1, 2],
  });
});

test("splitTowns: what the towns cannot take goes to the countryside", () => {
  assert.deepEqual(splitTowns([10, 0, 0], [3], 0), {
    towns: [[3, 0, 0]],
    country: [7, 0, 0],
  });
});

test("splitTowns throws RangeError when dead exceed sent, or hurt exceed those who came back", () => {
  assert.throws(() => splitTowns([5, 6, 0], [3, 9], 4), RangeError);
  assert.throws(() => splitTowns([5, 1, 5], [3, 9], 4), RangeError);
});

test("packTowns flattens the towns and trims the trailing all-zero towns", () => {
  assert.deepEqual(
    packTowns([
      [50, 5, 13],
      [0, 0, 0],
      [30, 3, 7],
    ]),
    [50, 5, 13, 0, 0, 0, 30, 3, 7],
  );
  assert.deepEqual(
    packTowns([
      [1, 0, 0],
      [0, 0, 0],
    ]),
    [1, 0, 0],
  );
  assert.deepEqual(packTowns([[0, 0, 0]]), []);
  assert.deepEqual(packTowns([]), []);
});

test("unpackTowns reads back what packTowns wrote, without the trailing all-zero towns", () => {
  const towns: Tally[] = [
    [50, 5, 13],
    [0, 0, 0],
    [30, 3, 7],
    [0, 0, 0],
  ];
  assert.deepEqual(unpackTowns(packTowns(towns)), [
    [50, 5, 13],
    [0, 0, 0],
    [30, 3, 7],
  ]);
  assert.deepEqual(unpackTowns(packTowns([[0, 0, 0]])), []);
});

test("fellRows lists each land's towns, then its countryside, then a land whole; fellTotals sums the lands", () => {
  const lands: LandFell[] = [
    [12, 100, 10, 25, [50, 5, 13, 0, 0, 0, 30, 3, 7]],
    [9, 40, 4, 8],
    [3, 5, 0, 0, []],
  ];
  assert.deepEqual(fellRows(lands), [
    { cell: 12, town: 0, whole: false, sent: 50, dead: 5, hurt: 13 },
    { cell: 12, town: 2, whole: false, sent: 30, dead: 3, hurt: 7 },
    { cell: 12, town: null, whole: false, sent: 20, dead: 2, hurt: 5 },
    { cell: 9, town: null, whole: true, sent: 40, dead: 4, hurt: 8 },
    { cell: 3, town: null, whole: false, sent: 5, dead: 0, hurt: 0 },
  ]);
  assert.deepEqual(fellTotals(lands), [145, 14, 33]);
});

test("splitTowns over a grid: the parts add up exactly, and no town holds more than it has", () => {
  const peopleSets: number[][] = [[], [0], [5], [3, 0, 9], [40, 1, 1, 1]];
  for (let sent = 0; sent <= 200; sent += 7)
    for (const dead of picks(sent, [0, 1, Math.floor(sent / 3), Math.floor(sent / 2), sent]))
      for (const hurt of picks(sent - dead, [0, 1, Math.floor((sent - dead) / 2), sent - dead]))
        for (const people of peopleSets)
          for (const countryside of [0, 4, 100]) {
            const { towns, country } = splitTowns([sent, dead, hurt], people, countryside),
              parts: Tally[] = [...towns, country],
              where = `sent ${sent}, dead ${dead}, hurt ${hurt}, people [${people}], countryside ${countryside}`;
            const sums = [0, 0, 0];
            for (const part of parts) for (let j = 0; j < 3; j++) sums[j] = sums[j]! + part[j]!;
            assert.deepEqual(sums, [sent, dead, hurt], where);
            towns.forEach(([s, d, h], k) => {
              assert.ok(s <= people[k]! && d <= s && h <= s - d, `${where}, town ${k}`);
            });
            assert.ok(
              parts.every((p) => p.every((x) => x >= 0)),
              `${where}, a negative part`,
            );
          }
});
