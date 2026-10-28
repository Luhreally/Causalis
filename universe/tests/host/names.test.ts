import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { calledIn, lexiconOf, speakersAt, takenWordsOf } from "../../src/host/names.ts";
import { languagesOf } from "../../src/sim/index.ts";
import type { PageModel } from "../../src/bridge/index.ts";

const world = EARTH.build(seedFromText("first light"));
world.runTo(260 * YEAR);
const query = (ref: string, names?: { as: "theirs"; at: number | null }) =>
  EARTH.queries.page!(world, { ref, names }) as PageModel;

test("each people's materials have their own names, and reading them leaves history untouched", () => {
  const before = world.domainHashes(),
    store = languagesOf(world),
    speakers = store.speakers();
  const living = store
    .all()
    .filter((l) => l.died === null && speakers.get(l.index)?.length)
    .slice(0, 8);
  assert.ok(living.length >= 2);
  const words = living.map((l) => calledIn(world, l, "malachite")!);
  assert.ok(words.every((c) => c && c.word.length >= 3 && c.gloss.length > 0));
  assert.ok(new Set(words.map((c) => c.word)).size >= 2);
  for (const l of living) {
    const lex = lexiconOf(world, l);
    assert.ok(lex.by.size > 100);
    assert.equal(lex, lexiconOf(world, l));
  }
  assert.deepEqual(world.domainHashes(), before);
});

test("the field guide shows a local name beside its chemistry, with the original page still available", () => {
  const before = world.domainHashes(),
    plain = query("subst:malachite");
  const language = speakersAt(world, null)!;
  const named = query("subst:malachite", { as: "theirs", at: null });
  const own = calledIn(world, language, "malachite")!;
  assert.equal(plain.title, "Malachite");
  assert.equal(named.title.toLowerCase(), own.word.toLowerCase());
  assert.match(JSON.stringify(named), /malachite/i);
  assert.match(JSON.stringify(named), /Its elements/);
  assert.deepEqual(query("subst:malachite"), plain);
  assert.deepEqual(world.domainHashes(), before);
});

test("loanwords cite surviving trade or teaching records, and their giver's word", () => {
  const before = world.domainHashes(),
    taken = takenWordsOf(world);
  assert.ok(taken.length > 0, "trade and learned crafts supplied words");
  for (const word of taken.slice(0, 100)) {
    assert.ok(world.events.get(word.event as never), word.event);
    assert.ok(word.word.length > 0 && word.theirs.length > 0);
    assert.notEqual(word.language, word.from);
  }
  assert.deepEqual(takenWordsOf(world), taken);
  assert.deepEqual(world.domainHashes(), before);
});
