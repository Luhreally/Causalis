// Live a Line's realm's year (C1): what a year came to, told as changes from the tally before it, and whether it went well.
import { test } from "node:test";
import assert from "node:assert/strict";
import { yearWent, yearWords, type CouncilTally } from "../../src/app/line-realm.ts";

const was: CouncilTally = {
  people: 12000,
  lands: 4,
  rank: 3,
  of: 6,
  host: 900,
  standing: 0.5,
  unrest: 0.2,
};

test("a realm's year told by what moved: people, lands, place, host, standing; nothing moved, nothing said", () => {
  assert.deepEqual(yearWords(was, was), []);
  assert.equal(yearWent(was, was), "held");
  const grew = { ...was, people: 12400, lands: 5, rank: 2, standing: 0.53 };
  assert.deepEqual(yearWords(was, grew), [
    "+400 people (12,400)",
    "+1 land (5)",
    "up to 2 of the 6 realms it meets",
    "its ruler's standing +3 in a hundred",
  ]);
  assert.equal(yearWent(was, grew), "grew");
  // (A land lost is a year that went ill, however many were born.)
  const lost = { ...was, people: 12600, lands: 3, host: 700 };
  assert.equal(yearWent(was, lost), "fell");
  assert.deepEqual(yearWords(was, lost).slice(1), ["−1 land (3)", "its host −200 (700)"]);
  assert.equal(yearWent(was, { ...was, people: 11900 }), "fell");
});
