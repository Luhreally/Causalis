import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Minter,
  compareRefs,
  defineKind,
  indexRef,
  isRef,
  kindCodeOf,
  makeRef,
  parseRef,
  refHash,
  structuralRef,
} from "../../src/kernel/index.ts";

const TOWN = defineKind("ttown", "test town", "minted");
const STAR = defineKind("tstar", "test star", "structural");
const PLANET = defineKind("tplan", "test planet", "structural");

test("refs print, parse and order", () => {
  const r = makeRef(TOWN, 0, 17);
  assert.equal(r, "ttown:0:17");
  assert.deepEqual(parseRef(r), { kind: "ttown", a: 0, b: 17 });
  assert.equal(kindCodeOf(r), "ttown");
  assert.ok(isRef(r));
  assert.ok(!isRef("ttown:0"));
  assert.ok(!isRef("ttown:0:4294967296"));
  assert.equal(compareRefs(r, r), 0);
  assert.equal(compareRefs(makeRef(TOWN, 0, 1), makeRef(TOWN, 0, 2)), -1);
  assert.throws(() => makeRef(TOWN, -1, 0));
});

test("kinds are declared once with a short code", () => {
  assert.throws(() => defineKind("ttown", "again", "minted"), /twice/);
  assert.throws(() => defineKind("Bad", "bad", "minted"), /lowercase/);
});

test("a minter counts each kind from one, and only mints minted kinds", () => {
  const m = new Minter();
  assert.equal(m.mint(TOWN), "ttown:0:1");
  assert.equal(m.mint(TOWN), "ttown:0:2");
  assert.equal(m.count(TOWN), 2);
  assert.throws(() => m.mint(STAR), /structural/);
  const copy = new Minter();
  copy.restore(m.state());
  assert.equal(copy.mint(TOWN), "ttown:0:3");
});

test("structural refs depend only on their origin", () => {
  const sector = indexRef(STAR, 12);
  const a = structuralRef(PLANET, sector, 3),
    b = structuralRef(PLANET, sector, 3);
  assert.equal(a, b);
  assert.notEqual(structuralRef(PLANET, sector, 4), a);
  assert.notEqual(structuralRef(PLANET, indexRef(STAR, 13), 3), a);
  assert.throws(() => structuralRef(TOWN, null, 1), /minted/);
  assert.equal(refHash(a), refHash(b));
});
