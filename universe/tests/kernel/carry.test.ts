import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FAR_ACT,
  seedActs,
  seedCarried,
  seedFromText,
  seedName,
  seedPlain,
  seedWithAct,
  textOf,
  wordOf,
} from "../../src/kernel/index.ts";

// What a seed's text carries as one word of an act (a world of another star entered: rules/far.ts).

test("a text goes into one word and comes back, whatever its length and letters", () => {
  for (const text of [
    "",
    "a",
    "ab",
    "abc",
    "abcd",
    "abcde",
    '{"name":"Tsoni","from":{"seed":"first light ~size small"}}',
    "“Zhyvrireth” · °C ~ é 🌍",
  ]) {
    const word = wordOf(text);
    assert.match(word, /^[A-Za-z0-9_-]*$/, "letters, digits, - and _ only");
    assert.equal(textOf(word), text);
  }
});

test("what is no word reads as none", () => {
  assert.equal(textOf("a b"), null);
  assert.equal(textOf("~~~~"), null);
  // (One letter over a group of four carries less than a byte.)
  assert.equal(textOf("AAAAA"), null);
});

test("a seed carries a text under an act, with its name, its draws and its other acts as they were", () => {
  const carried = '{"v":1,"name":"Tsoni ~ of the shore"}',
    plain = seedWithAct("Tsoni, from first light 3072:0/1", "size small"),
    text = seedWithAct(plain, `${FAR_ACT} ${wordOf(carried)}`);
  assert.equal(seedCarried(text, FAR_ACT), carried);
  assert.equal(seedName(text), "Tsoni, from first light 3072:0/1");
  assert.deepEqual(seedActs(text).length, 2);
  // (Its draws are its name's: what it carries moves none of them.)
  assert.deepEqual(seedFromText(text).lo, seedFromText(plain).lo);
  assert.deepEqual(seedFromText(text).hi, seedFromText(plain).hi);
  assert.equal(seedPlain(text, FAR_ACT), plain);
});

test("a seed that carries nothing says so and is shown as it is", () => {
  for (const text of ["first light", "amber 412 ~star red", "far away ~size small", "x ~far"]) {
    assert.equal(seedCarried(text, FAR_ACT), null, text);
    assert.equal(seedPlain(text, FAR_ACT), text);
  }
  // (An act of the word that is no word of a text: let be, as any act of no known making is.)
  assert.equal(seedCarried("x ~far a~b", FAR_ACT), null);
  assert.equal(seedCarried("x ~far two words", FAR_ACT), null);
});
