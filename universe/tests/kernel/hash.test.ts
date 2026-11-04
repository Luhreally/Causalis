// A value's fingerprint: its keys in sorted order, whatever order they came in; and what value()
// remembers of the shapes it has seen changes nothing it absorbs (Phase 63).
import { test } from "node:test";
import assert from "node:assert/strict";
import { Hasher } from "../../src/kernel/index.ts";

/** What value() absorbs, written out by hand with nothing remembered. */
function byHand(h: Hasher, v: unknown): Hasher {
  if (v === null || v === undefined) return h.word(0);
  if (typeof v === "boolean") return h.word(1).bool(v);
  if (typeof v === "number") return h.word(2).float(v);
  if (typeof v === "string") return h.word(3).string(v);
  if (Array.isArray(v)) {
    h.word(4).int(v.length);
    for (const item of v) byHand(h, item);
    return h;
  }
  const keys = Object.keys(v as object).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  h.word(5).int(keys.length);
  for (const k of keys) byHand(h.string(k), (v as Record<string, unknown>)[k]);
  return h;
}

const same = (v: unknown) =>
  assert.equal(new Hasher().value(v).hex(), byHand(new Hasher(), v).hex(), JSON.stringify(v));

test("value() absorbs what the words say, for every kind and every spelling of key", () => {
  for (const v of [
    null,
    true,
    0.1,
    -0,
    "text",
    [],
    {},
    [1, "a", [2, { x: 1 }], null],
    { a: 1 },
    { b: 1, a: 2 },
    { a: 2, b: 1 },
    { "": 1, é: 2, "𝄞": 3, ab: 4, abc: 5 },
    { z: { y: { x: [{ w: 1, v: 2 }] } } },
  ])
    same(v);
});

test("a shape seen before, in either order, and the same first key with others after it", () => {
  for (let round = 0; round < 3; round++) {
    same({ a: 1, b: 2 });
    same({ b: 2, a: 1 });
    same({ a: 1 });
    same({ a: 1, c: 2 });
    same({ a: 1, b: 2, c: 3 });
    same({ a: 1, c: 3, b: 2 });
  }
  assert.equal(
    new Hasher().value({ a: 1, b: 2 }).hex(),
    new Hasher().value({ b: 2, a: 1 }).hex(),
    "the order keys came in is no part of a value",
  );
});

test("objects used as maps, past all it remembers, absorb the same", () => {
  // Thousands of first keys, and many shapes under one.
  for (let k = 0; k < 6000; k++) same({ [`k${k}`]: k, also: 1 });
  for (let k = 0; k < 200; k++) same({ first: 1, [`k${k}`]: k });
  same({ first: 1, k3: 3 });
});
