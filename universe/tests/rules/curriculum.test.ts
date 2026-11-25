import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTENTS, curriculumOf, schoolingReach, type Payers } from "../../src/rules/index.ts";

// What education teaches (rules/curriculum.ts): what those who pay for a realm's schools live by.

const payers = (over: Partial<Payers> = {}): Payers => ({
  tithes: 0,
  treasury: 0,
  patron: 0,
  customers: 0,
  dues: 0,
  scripture: 0,
  capacity: 0.5,
  force: 0.5,
  traders: 100,
  crafters: 500,
  ...over,
});

test("a temple's schools teach its creed, and letters as far as the creed is written", () => {
  const spoken = curriculumOf(payers({ tithes: 100 }));
  assert.equal(spoken.lead, "creed");
  assert.equal(spoken.shares.creed, 1);
  const written = curriculumOf(payers({ tithes: 100, scripture: 1 }));
  assert.ok(written.shares.letters > 0 && written.shares.creed < 1);
});

test("a seat teaches the pen as far as it rules by office and arms as far as by force; payers for their own young, their living", () => {
  assert.equal(curriculumOf(payers({ treasury: 50, capacity: 0.9, force: 0.2 })).lead, "letters");
  assert.equal(curriculumOf(payers({ treasury: 50, capacity: 0.2, force: 0.9 })).lead, "arms");
  assert.equal(curriculumOf(payers({ customers: 50, traders: 10, crafters: 5000 })).lead, "craft");
  assert.equal(
    curriculumOf(payers({ customers: 50, traders: 900, crafters: 100 })).lead,
    "letters",
  );
  assert.equal(curriculumOf(payers({ dues: 5 })).lead, "craft");
});

test("the shares sum to one, by what each payer gives; no payer, nothing taught", () => {
  const mixed = curriculumOf(payers({ tithes: 60, treasury: 30, customers: 10 }));
  assert.ok(Math.abs(CONTENTS.reduce((s, k) => s + mixed.shares[k], 0) - 1) < 1e-12);
  assert.equal(mixed.lead, "creed");
  assert.equal(curriculumOf(payers()).lead, null);
});

test("schooling reaches as many young as its teachers can hold", () => {
  assert.equal(schoolingReach(0, 10_000), 0);
  assert.ok(schoolingReach(10, 10_000) > 0 && schoolingReach(10, 10_000) < 1);
  assert.equal(schoolingReach(10_000, 10_000), 1);
});
