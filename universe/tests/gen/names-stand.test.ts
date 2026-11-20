// Names no name should be (gen/names.ts): a town of first light was named "Penis", and one who hunted a beast "The". A name
// that is an obscene word, or an article, whole or as one of its words, is drawn again, the same way every time.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NAMES_REDRAWN,
  cradleTongue,
  nameStands,
  personName,
  placeName,
  tongueName,
  tonguePersonName,
} from "../../src/gen/names.ts";

test("a name that is such a word does not stand, whole or as a word of it; one that holds it does", () => {
  for (const bad of ["Penis", "The", "Fuck Meis", "Brel The", "An", "bum nulwick"])
    assert.equal(nameStands(bad), false, bad);
  for (const good of [
    "Thebes",
    "Anath",
    "Dickon",
    "Scunthorpe",
    "Kraishaermere",
    "She",
    "Was Broulam",
  ])
    assert.equal(nameStands(good), true, good);
});

test("every name drawn stands, the same each time, and nearly all are as they were", () => {
  const before = NAMES_REDRAWN.n;
  let drawn = 0;
  for (let culture = 1; culture <= 40; culture++) {
    const t = cradleTongue(culture * 7919);
    for (let key = 0; key < 3000; key++) {
      const names = [
        placeName(culture * 7919, key),
        tongueName(t, key),
        personName(culture * 7919, key, key & 1),
        tonguePersonName(t, key, key & 1),
      ];
      for (const n of names) {
        drawn++;
        assert.ok(nameStands(n), n);
        assert.ok(n.length >= 1 && n[0] === n[0]!.toUpperCase(), n);
      }
      if (key % 500 === 0) assert.equal(tongueName(t, key), names[1]);
    }
  }
  const again = NAMES_REDRAWN.n - before;
  assert.ok(again > 0, "none of 480,000 names was drawn again: the guard was never met");
  assert.ok(again < drawn / 500, `${again} of ${drawn} names drawn again`);
});
