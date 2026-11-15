// What a realm learns of how to hold itself (rules/learn.ts): nothing written, only evidence: how a realm stood against how it
// fared, measured, its own and others' by how near and like they are; a belief of each number that the evidence supports.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FALLEN,
  LEARNING,
  alikeInSize,
  believeAfter,
  blameFrom,
  cameOf,
  cameWords,
  chanceOf,
  evidenceOf,
  faredBy,
  fortuneAfter,
  leanOf,
  leaningOf,
  likeness,
  movedWords,
  noBelief,
  pullOf,
  seenWeight,
  stoodWords,
  sureOf,
  tookWords,
  valuesOf,
  yearOf,
  type Faring,
  type WaysRead,
} from "../../src/rules/index.ts";

const ways = (o: Partial<WaysRead> = {}): WaysRead => ({
  hierarchy: 0.5,
  openness: 0.5,
  tradition: 0.5,
  valour: 0.5,
  piety: 0.2,
  trade: 0.5,
  thrift: 0.5,
  ...o,
});
/** Where realms usually stand, in these tests: the middle of each number. */
const MID = [0.5, 0.5, 0.5, 0.5];
const stands = (o: Partial<Faring> = {}): Faring => ({
  people: 100_000,
  lands: 10,
  standing: 0.6,
  wealth: 50,
  fed: 1,
  ...o,
});

test("a realm's fortune is measured: lands lost, people lost and standing lost each go ill; a year with nothing changed fades it", () => {
  const none = [0, 0, 0, 0, 0],
    lost = fortuneAfter(none, yearOf(stands(), stands({ lands: 6 }))),
    plague = fortuneAfter(none, yearOf(stands(), stands({ people: 90_000 }))),
    doubted = fortuneAfter(none, yearOf(stands(), stands({ standing: 0.3 }))),
    hungry = fortuneAfter(none, yearOf(stands(), stands({ fed: 0.8 }))),
    grew = fortuneAfter(none, yearOf(stands(), stands({ lands: 14, wealth: 80 })));
  assert.ok(lost[1]! < -0.5 && lost[0] === 0, `lands ${lost}`);
  assert.ok(plague[0]! < -0.5, `people ${plague}`);
  assert.ok(doubted[2]! < -0.5, `standing ${doubted}`);
  assert.ok(hungry[4]! < -0.5, `fed ${hungry}`);
  assert.ok(grew[1]! > 0.3 && grew[3]! > 0.3, `grew ${grew}`);
  const after = fortuneAfter(lost, yearOf(stands({ lands: 6 }), stands({ lands: 6 })));
  assert.ok(
    Math.abs(after[1]! - LEARNING.kept * lost[1]!) < 1e-9,
    "a quiet year keeps a share of it",
  );
  for (const f of [lost, plague, doubted, hungry, grew])
    for (const x of f) assert.ok(x >= -1 && x <= 1);
});

test("what counts as faring well is read off a people's ways: the warlike weigh lands, the trading wealth", () => {
  const landsLost = [0, -0.8, 0, 0.6, 0],
    warlike = valuesOf(ways({ valour: 0.95, trade: 0.05 })),
    trading = valuesOf(ways({ valour: 0.05, trade: 0.95 }));
  assert.ok(Math.abs(warlike.reduce((s, x) => s + x, 0) - 1) < 1e-9);
  assert.ok(faredBy(landsLost, warlike) < 0, "to the warlike, lands lost for wealth is a loss");
  assert.ok(faredBy(landsLost, trading) > 0, "to traders, a gain");
  assert.equal(faredBy(FALLEN, warlike), -1);
});

test("a belief is what the evidence supports: overthrown with choices in one hand, a realm comes to share them; and the other way", () => {
  const year = 100,
    // (Stood with voice near nothing and word watched, where most stand in the middle, and fared ill.)
    oneHand = evidenceOf([0.5, 0.05, 0.2, 0.5], MID, -0.8, 1),
    b = believeAfter(noBelief(year), oneHand, true, year);
  assert.ok(leanOf(b, 1, year) > 0.3, `voice ${leanOf(b, 1, year)}`);
  assert.ok(leanOf(b, 2, year) > 0.2, `word ${leanOf(b, 2, year)}`);
  assert.equal(leanOf(b, 0, year), 0, "where it stood as most do it learned nothing");
  // (Where every realm keeps its choices in one hand, one of them overthrown says nothing of that.)
  const alike = evidenceOf([0.5, 0.05, 0.2, 0.5], [0.5, 0.05, 0.2, 0.5], -0.8, 1);
  assert.deepEqual(alike.map(Math.abs), [0, 0, 0, 0]);
  assert.ok(pullOf(b, 1, year) > 0 && pullOf(b, 1, year) <= LEARNING.learn);
  // (A realm of many voices overthrown teaches the opposite, by the same rule.)
  const many = believeAfter(
    noBelief(year),
    evidenceOf([0.5, 0.9, 0.9, 0.5], MID, -0.8, 1),
    true,
    year,
  );
  assert.ok(leanOf(many, 1, year) < -0.3 && leanOf(many, 2, year) < -0.3);
  // (And one that prospers so, to keep to it.)
  const well = believeAfter(
    noBelief(year),
    evidenceOf([0.5, 0.9, 0.9, 0.5], MID, 0.8, 1),
    true,
    year,
  );
  assert.ok(leanOf(well, 1, year) > 0.3);
});

test("evidence against evidence cancels, more of it makes surer, and all of it fades with the years", () => {
  const e = evidenceOf([0.9, 0.5, 0.5, 0.5], MID, -0.6, 1);
  let b = believeAfter(noBelief(0), e, true, 0);
  const one = leanOf(b, 0, 0),
    sure1 = sureOf(b, 0, 0).sure;
  b = believeAfter(b, e, true, 0);
  assert.ok(leanOf(b, 0, 0) < one && sureOf(b, 0, 0).sure > sure1, "twice seen, surer");
  assert.ok(Math.abs(leanOf(b, 0, 0)) < 1, "never certain");
  const against = believeAfter(b, evidenceOf([0.9, 0.5, 0.5, 0.5], MID, 0.6, 1), true, 0);
  assert.ok(
    Math.abs(leanOf(against, 0, 0)) < Math.abs(leanOf(b, 0, 0)),
    "evidence the other way weighs against it",
  );
  assert.ok(
    Math.abs(leanOf(b, 0, 2 * LEARNING.half)) < Math.abs(leanOf(b, 0, 0)),
    "old evidence weighs less",
  );
  // (Its own and what it saw are kept apart.)
  const seen = believeAfter(b, evidenceOf([0.9, 0.5, 0.5, 0.5], MID, -0.6, 0.3), false, 0),
    share = sureOf(seen, 0, 0).own;
  assert.ok(share > 0.5 && share < 1, `own ${share}`);
});

test("another's fate weighs by how near, how like, how freely word leaves them and how open one is; the devout put much to the gods", () => {
  const full = seenWeight(1, 1, 1, 1);
  assert.equal(full, 1);
  assert.equal(seenWeight(0, 1, 1, 1), 0, "beyond its word, nothing");
  assert.ok(seenWeight(0.5, 1, 1, 1) < full);
  assert.ok(seenWeight(1, 0.3, 1, 1) < seenWeight(1, 0.9, 1, 1));
  assert.ok(seenWeight(1, 1, 0.1, 1) < seenWeight(1, 1, 0.9, 1), "a watched realm hides its fate");
  assert.ok(seenWeight(1, 1, 1, 0.1) < seenWeight(1, 1, 1, 0.9));
  assert.equal(likeness(ways(), ways()), 1);
  assert.ok(likeness(ways({ hierarchy: 1, valour: 1 }), ways({ hierarchy: 0, valour: 0 })) < 0.6);
  // (And in size: a great realm sees little of itself in a single town's fate.)
  assert.equal(alikeInSize(1000, 1000), 1);
  assert.ok(alikeInSize(1_000_000, 10_000) < 0.11 && alikeInSize(10_000, 1_000_000) < 0.11);
  assert.equal(alikeInSize(0, 500), 1, "unmeasured: as like as any");
  assert.equal(chanceOf(ways({ piety: 0.2 })), 0);
  assert.ok(chanceOf(ways({ piety: 0.95 })) > 0.8);
});

test("how a realm took it is read off what it did with it, and its words are composed of how it stood and what was measured", () => {
  // (Stood with arms among its people and fared ill: it drew arms in. Read as blaming others.)
  const drew = evidenceOf([0.1, 0.5, 0.5, 0.5], MID, -0.8, 1);
  assert.equal(blameFrom(drew, 0, true, 1), "theirs");
  // (Stood with choices in one hand and fared ill: it opened them. Read as looking to itself.)
  const opened = evidenceOf([0.5, 0.05, 0.5, 0.5], MID, -0.8, 1);
  assert.equal(blameFrom(opened, 0, true, 1), "ours");
  // (The devout put a small thing to the gods; a great one moves even them.)
  assert.equal(
    blameFrom(evidenceOf([0.5, 0.45, 0.5, 0.5], MID, -0.8, 0.3), 0.7, true, 1),
    "the gods'",
  );
  assert.equal(blameFrom(opened, 0.7, true, 1), "ours");
  assert.equal(blameFrom(opened, 0, false, 0.05), "weakness");
  assert.equal(
    stoodWords(leaningOf([0.9, 0.05, 0.5, 0.5], MID)),
    "more than most with its choices in few hands and arms kept to its host",
  );
  assert.equal(stoodWords(leaningOf([0.5, 0.5, 0.55, 0.45], MID)), "much as most do");
  // (Against what is usual: among realms that keep arms close, one that keeps them a little less close stood with arms in hands.)
  assert.equal(
    stoodWords(leaningOf([0.6, 0.5, 0.5, 0.5], [0.85, 0.5, 0.5, 0.5])),
    "more than most with arms in its people's hands",
  );
  const v = valuesOf(ways({ valour: 0.9 })),
    came = cameOf([0, -0.9, -0.5, 0, 0], v);
  assert.ok(came[0]! < 0);
  assert.equal(cameWords(came), "fared ill (lands lost, its rule doubted)");
  assert.equal(cameWords(cameOf(FALLEN, v)), "fared ill (everything lost)");
  assert.equal(movedWords(opened), "came to hold more with its choices carried by many");
  assert.equal(movedWords([0.001, 0, 0, 0]), "");
  assert.equal(tookWords("ours", false, false), "held it its own fault");
  assert.equal(tookWords("theirs", false, true), "held it its strength");
  assert.equal(tookWords("ours", true, true), "took it as an example to itself");
  assert.equal(tookWords("theirs", true, false), "blamed those who brought them down");
});
