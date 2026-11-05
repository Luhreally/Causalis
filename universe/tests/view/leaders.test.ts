import { test } from "node:test";
import assert from "node:assert/strict";
import {
  homeOfFigure,
  worthWords,
  type WealthBook,
  type WealthRow,
} from "../../src/bridge/index.ts";
import { figureEye, wealthNote, wealthShades, wealthSpread } from "../../src/view/leaders.ts";

test("a worth is said in three figures and its unit", () => {
  assert.equal(worthWords(0), "0");
  assert.equal(worthWords(7.6), "8");
  assert.equal(worthWords(950), "950");
  assert.equal(worthWords(1234), "1.23 thousand");
  assert.equal(worthWords(128234), "128 thousand");
  assert.equal(worthWords(999600), "1 million");
  assert.equal(worthWords(5181000000), "5.18 billion");
  assert.equal(worthWords(529130540000000), "529 trillion");
  assert.equal(worthWords(1234567890123456), "1.23 quadrillion");
});

test("a figure lives in one of the homes nearest the square, the same every time", () => {
  assert.equal(homeOfFigure("rule:pol:0:23", 160), 5);
  assert.equal(homeOfFigure("rule:pol:0:28", 160), 4);
  assert.equal(homeOfFigure("rule:pol:0:6", 160), 1);
  assert.equal(homeOfFigure("seat:town:0:279:lender:0", 160), 7);
  assert.equal(homeOfFigure("rule:pol:0:23", 3), 2);
  assert.equal(homeOfFigure("rule:pol:0:23", 0), 0);
});

const row = (short: string, head: number, worth: number, madeHead: number, few = false) =>
  ({
    ref: `pol:0:${short}`,
    short,
    name: short,
    color: [1, 1, 1],
    people: few ? 500 : 5000,
    lands: 1,
    stores: worth,
    owed: 0,
    worth,
    made: 0,
    head,
    madeHead,
    few,
    rankHead: 0,
    rankAll: 0,
    rankMade: 0,
    topGood: null,
  }) as WealthRow;

const book: WealthBook = {
  year: 1000,
  realms: [
    row("A", 100000, 10, 50),
    row("B", 10000, 100, 40),
    row("C", 1000, 1000, 30),
    row("D", 100, 10000, 20),
    row("E", 10, 100000, 10),
    row("F", 9e9, 1e15, 1, true),
  ],
  lands: [
    ...[0, 1, 2, 3, 4, 5].map((i) => ({
      cell: 10 + i,
      realm: i,
      people: 100,
      worth: 10 ** (i + 1),
    })),
    { cell: 99, realm: -1, people: 100, worth: 1000 },
  ],
};

test("the spread of wealth runs from its 5th place to its 95th, in log10", () => {
  assert.deepEqual(wealthSpread([10, 100, 1000, 10000, 100000]), { lo: 1, hi: 4 });
  assert.deepEqual(wealthSpread([]), { lo: 0, hi: 0 });
  assert.deepEqual(wealthSpread([0, -3]), { lo: 0, hi: 0 });
});

test("a land's shade runs from the poorest realm to the richest, on the log spread", () => {
  const head = wealthShades(book, "head");
  assert.equal(head.get(14), 0);
  assert.ok(Math.abs(head.get(13)! - 1 / 3) < 1e-9);
  assert.ok(Math.abs(head.get(12)! - 2 / 3) < 1e-9);
  assert.equal(head.get(11), 1);
  assert.equal(head.get(10), 1);
  assert.equal(head.get(15), 1);
  assert.equal(head.get(99), -1);
  const all = wealthShades(book, "all");
  assert.equal(all.get(10), 0);
  assert.equal(all.get(13), 1);
  assert.equal(all.get(14), 1);
  assert.equal(all.get(99), -1);
  assert.ok(wealthShades(book, "land").get(99)! >= 0);
});

test("when every realm is alike, every land shades to the middle", () => {
  const flat: WealthBook = {
    year: 1000,
    realms: [row("A", 5, 5, 5), row("B", 5, 5, 5)],
    lands: [
      { cell: 1, realm: 0, people: 10, worth: 50 },
      { cell: 2, realm: 1, people: 10, worth: 50 },
    ],
  };
  for (const measure of ["head", "all", "made", "land"] as const)
    for (const shade of wealthShades(flat, measure).values()) assert.equal(shade, 0.5);
});

test("the note names the least and the greatest realm of a measure, in words", () => {
  assert.equal(wealthNote(book, "head"), "A head: 10 in E to 100 thousand in A.");
  assert.equal(wealthNote(book, "all"), "In all: 10 in A to 100 thousand in E.");
  assert.equal(wealthNote(book, "made"), "Made last year, a head: 10 in E to 50 in A.");
  assert.equal(wealthNote(book, "land"), "Each land's own stores, a head.");
  assert.equal(
    wealthNote({ year: 1000, realms: [], lands: [] }, "head"),
    "No realm stands yet to weigh.",
  );
});

test("a figure's eye stands back from its home, steeply, above its top", () => {
  assert.deepEqual(figureEye({ homes: [{ x: 1, z: 2, yaw: 0, household: null }] }, 0), {
    x: 1,
    z: 2,
    distance: 16,
    pitch: -52,
    top: 17.4,
  });
});

test("a plan with no home to be had is looked at from its middle", () => {
  assert.deepEqual(figureEye({ homes: [] }, 0), {
    x: 0,
    z: 0,
    distance: 16,
    pitch: -52,
    top: 17.4,
  });
});
