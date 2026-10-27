// Lists packed by column (kernel/pack.ts): whatever goes in, what comes out is what JSON would
// have given back, value for value and key for key, and long lists of records pack small.
import { test } from "node:test";
import assert from "node:assert/strict";
import { packList, unpackList, type Packed } from "../../src/kernel/index.ts";

/** Numbers in [0, 1) from a seed (mulberry32): the same lists on every run. */
function numbers(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** A list through packing as a save takes it (written as JSON and read back), and unpacked. */
function through(values: readonly unknown[]): unknown[] {
  return unpackList(JSON.parse(JSON.stringify(packList(values))) as Packed);
}

/** What JSON gives back of a list. */
function asJson(values: readonly unknown[]): unknown[] {
  return JSON.parse(JSON.stringify(values)) as unknown[];
}

function same(values: readonly unknown[], what: string): void {
  const back = through(values),
    json = asJson(values);
  assert.deepStrictEqual(back, json, what);
  // (Key for key: the same text, so the same order of keys.)
  assert.equal(JSON.stringify(back), JSON.stringify(json), what);
}

class Thing {
  readonly a = 1;
  toJSON(): unknown {
    return { thing: this.a };
  }
}

test("every kind of value comes back as JSON would give it", () => {
  same([], "nothing");
  same(
    [0, 1, -1, 31, 32, -33, 1023, 2 ** 50, -(2 ** 50), 2 ** 50 + 2, 2 ** 53 - 1],
    "whole numbers",
  );
  same([-0, 0.5, -1.25, 1e300, 5e-324, NaN, Infinity, -Infinity, 0.1 + 0.2], "other numbers");
  same([true, false, null, undefined], "the rest");
  same(
    [
      "",
      "ev:0:1",
      "ev:0:01",
      "ev:00:1",
      "cell:4294967295:4294967295",
      "cell:262143:7",
      "abcdef:1:2",
    ],
    "references and text that only looks like them",
  );
  same(["héllo", "\ud800", "😀", 'quote " and \\ and \n'], "any text");
  same(
    [{}, { a: 1 }, { a: 1, b: undefined }, { b: 2, a: 1 }, { 1: "x", a: "y", 0: "z" }],
    "objects",
  );
  same(
    [JSON.parse('{"__proto__": 1, "x": 2}'), Object.assign(Object.create(null), { a: 1 })],
    "odd keys",
  );
  same(
    [new Thing(), new Map([[1, 2]]), { f: () => 1 }, { s: Symbol("s") }],
    "what JSON writes its own way",
  );
  same([[1, , 3], [undefined, null], [], [[]], [[1, 2], [3]]], "arrays, holes and all");
  same([Array.from({ length: 40 }, (_, i) => i * i), [1, 2]], "long arrays and short");
  same([1, "a", { a: 1 }, [1], null, 2.5, "a", 2, { b: [] }], "a column of every kind");
});

test("records of a few shapes come back whole, and pack far smaller than JSON", () => {
  const r = numbers(55),
    types = ["war.battle", "people.famine", "lore.learned", "weather.drought"],
    records: unknown[] = [];
  let serial = 1000,
    t = 0;
  for (let i = 0; i < 5000; i++) {
    serial += 1 + Math.floor(r() * 3);
    t += Math.floor(r() * 3) * 86_400;
    const type = types[Math.floor(r() * types.length)]!;
    records.push({
      id: `ev:0:${serial}`,
      t,
      type,
      importance: Math.floor(r() * 7),
      subjects: [`pol:0:${Math.floor(r() * 40)}`, `cell:0:${Math.floor(r() * 500)}`],
      place: r() < 0.1 ? null : `cell:0:${Math.floor(r() * 500)}`,
      causes: [{ ref: `ev:0:${serial - 1 - Math.floor(r() * 20)}`, role: "trigger", weight: 1 }],
      data:
        type === "war.battle"
          ? { a: "the realm of Ost", b: "Wend", won: r() < 0.5, fallen: Math.floor(r() * 9000) }
          : type === "lore.learned"
            ? { principle: "sailing" }
            : { fed: Math.round(r() * 1000), people: Math.floor(r() * 5000) },
    });
  }
  same(records, "records");
  const plain = JSON.stringify(records).length,
    packed = JSON.stringify(packList(records)).length;
  assert.ok(packed < plain / 3, `${packed} packed against ${plain} as JSON`);
});

test("random values of every kind come back as JSON gives them", () => {
  const r = numbers(56),
    pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const value = (depth: number): unknown => {
    const roll = r();
    if (depth > 3 || roll < 0.35)
      return pick<unknown>([
        Math.floor(r() * 100) - 50,
        Math.floor(r() * 2 ** 40),
        r(),
        pick(["a", "b", "ev:0:7", "cell:0:12", "", "dec:0:3"]),
        null,
        true,
        undefined,
      ]);
    if (roll < 0.6) return Array.from({ length: Math.floor(r() * 20) }, () => value(depth + 1));
    const o: Record<string, unknown> = {};
    for (const k of ["a", "b", "c", "d"].slice(0, Math.floor(r() * 5))) o[k] = value(depth + 1);
    return o;
  };
  for (let round = 0; round < 200; round++)
    same(
      Array.from({ length: Math.floor(r() * 30) }, () => value(0)),
      `round ${round}`,
    );
});

test("a damaged packing is refused, not read wrong", () => {
  const p = JSON.parse(JSON.stringify(packList([1, 2, 3, "a", "b"]))) as Record<string, unknown>;
  assert.throws(() => unpackList({ ...p, n: 6 } as Packed), /kinds are not its values'/);
  assert.throws(() => unpackList({ ...p, i: "!" } as Packed), /among its numbers/);
  assert.throws(() => unpackList({ n: 2, i: "C" } as Packed), /do not add up/);
  assert.throws(() => unpackList({ n: 1, i: "g" } as Packed), /ends inside a number/);
});
