// Round B's stores: rows of whole numbers, dormant while empty, hashed by a running digest that a save gives back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Hasher } from "../../src/kernel/index.ts";
import { RowStore, refNumber } from "../../src/sim/index.ts";

const hash = (s: RowStore) => {
  const h = new Hasher();
  s.hashInto(h);
  return h.hex();
};

test("a row store is dormant until set, rounds what it keeps, and a save gives back its rows and its digest", () => {
  const a = new RowStore("money.test", 3);
  assert.ok(a.dormant());
  a.set(12, [1.4, 2.6, Number.NaN]);
  a.set("pol:0:3", [7]);
  assert.ok(!a.dormant());
  assert.deepEqual(a.get(12), [1, 3, 0]);
  assert.deepEqual(a.get("pol:0:3"), [7, 0, 0]);
  const b = new RowStore("money.test", 3);
  b.load(JSON.parse(JSON.stringify(a.save())));
  assert.equal(hash(b), hash(a));
  assert.deepEqual(b.get(12), [1, 3, 0]);
  // The same rows set in another order are another history.
  const c = new RowStore("money.test", 3);
  c.set("pol:0:3", [7]);
  c.set(12, [1.4, 2.6, 0]);
  assert.notEqual(hash(c), hash(a));
  a.drop(12);
  assert.equal(a.get(12), undefined);
  assert.equal(refNumber("pol:0:17"), 17);
});
