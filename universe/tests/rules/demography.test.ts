import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLADES,
  DIMORPHISM,
  HUMANLIKE,
  PAIRED,
  adaptedOf,
  boyRiskOf,
  coldFelt,
  evenOf,
  girlsAtBirth,
  hearthOf,
  heightsToll,
  lifeHistoryOf,
  longerLived,
  matchChanceOf,
  matedShare,
  pairingOf,
  sexesMustDiffer,
  youngLost,
} from "../../src/rules/index.ts";

test("the apes' own table carries the share of girls Fisher's balance gives it", () => {
  const g = girlsAtBirth(HUMANLIKE, boyRiskOf(DIMORPHISM.life), PAIRED.life);
  assert.ok(Math.abs(g - HUMANLIKE.girls!) < 0.001, `${g}`);
  assert.ok(Math.abs(HUMANLIKE.boyRisk! - boyRiskOf(DIMORPHISM.life)) < 0.001);
  // Born so as to be even when grown: a sire for each bearer.
  assert.ok(Math.abs(evenOf(HUMANLIKE) - 1) < 0.01, `${evenOf(HUMANLIKE)}`);
  // The sires' young die the more.
  assert.ok(youngLost(HUMANLIKE, HUMANLIKE.boyRisk) > youngLost(HUMANLIKE));
});

test("those who pair for none are born half and half; those who pair for life, more of the sex that dies the more", () => {
  for (const c of CLADES) {
    const ad = Math.max(1, Math.round((15 * c.body.span) / 70)),
      p = pairingOf(c.body, ad),
      life = lifeHistoryOf(c.body, boyRiskOf(DIMORPHISM[p]), PAIRED[p]);
    if (PAIRED[p] === 0) assert.equal(life.girls, 0.5, c.id);
    else assert.ok(life.girls! < 0.5, `${c.id} ${life.girls}`);
  }
});

test("a hearth is near four of the apes, one where none pairs, a hive's cell", () => {
  const apes = hearthOf(HUMANLIKE, "life");
  assert.ok(apes > 3.5 && apes < 5, `${apes}`);
  assert.equal(hearthOf(HUMANLIKE, "none"), 1);
  assert.equal(hearthOf(HUMANLIKE, "brood"), 12);
  // A people that pairs for a season keeps the sires apart: fewer to a hearth.
  assert.ok(hearthOf(HUMANLIKE, "season") < apes);
});

test("a land short of sires bears the less as far as its births wait on a mate", () => {
  assert.equal(matedShare("life", 100, 100, 1), 1);
  assert.equal(matedShare("life", 150, 100, 1), 1);
  assert.ok(Math.abs(matedShare("life", 70, 100, 1) - 0.7) < 1e-9);
  assert.ok(matedShare("season", 70, 100, 1) > 0.85);
  assert.equal(matedShare("none", 10, 100, 1), 1);
});

test("a body takes to its land over generations; the heights and the cold press newcomers", () => {
  assert.equal(adaptedOf(0, 25), 0);
  assert.ok(adaptedOf(250, 25) > 0.6 && adaptedOf(250, 25) < 0.65);
  assert.ok(adaptedOf(5000, 25) > 0.99);
  assert.equal(heightsToll(0, 0), 1);
  assert.ok(heightsToll(4000, 0) > 1.5 && heightsToll(4000, 0) < 1.6);
  assert.ok(heightsToll(4000, 1) === 1);
  assert.equal(coldFelt(0), 1);
  assert.equal(coldFelt(1), 0.5);
});

test("knowing the body past what care uses slows the old's wearing, at most by half", () => {
  assert.equal(longerLived(0.2), 1);
  assert.ok(Math.abs(longerLived(0.4) - 0.8) < 1e-9);
  assert.equal(longerLived(2), 0.5);
});

test("a match as often as a house has children to give, by the alliance's worth; the sexes differ where the claim passes by children", () => {
  const some = matchChanceOf(2.9, 30, 0.6, 0.4, 3),
    more = matchChanceOf(2.9, 30, 0.6, 0.9, 3);
  assert.ok(some > 0 && more > some);
  assert.equal(matchChanceOf(2.9, 30, 0, 1, 1), 0);
  assert.ok(matchChanceOf(2.9, 30, 0.6, 0.4, 6) < some);
  assert.equal(sexesMustDiffer(true, true), true);
  assert.equal(sexesMustDiffer(false, true), false);
});
