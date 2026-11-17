// What crosses a border unseen, ware by ware (rules/contraband.ts), and intoxicants weighed kind by kind (rules/intox.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTRA_CAUSES,
  CONTRA_WHY,
  G,
  WARE_ARMS,
  WARE_COUNT,
  WARE_INTOX,
  armsBarred,
  carryCost,
  intoxUse,
  intoxWant,
  kindCost,
  prohibits,
  smuggled,
  wareDensity,
  wareName,
  wouldCross,
} from "../../src/rules/index.ts";

const hold = { force: 0.5, capacity: 0.6, corruption: 0.2 };

test("what is worth much for its bulk slips past first: tin and tools before pottery, pottery before grain", () => {
  const share = (ware: number) => smuggled(0.15, hold, 1, carryCost(wareDensity(ware)));
  assert.ok(share(G.tin) > share(G.tools));
  assert.ok(share(G.tools) > share(G.pottery));
  assert.ok(share(G.pottery) > share(G.grain));
  // What calms, wakes or eases weighs next to nothing for its worth, and arms little.
  assert.ok(share(WARE_INTOX) > share(G.tools));
  assert.ok(share(WARE_ARMS) > share(G.pottery));
  // A realm's trade as a whole is carried at the cost it always was: the old rule, unchanged.
  assert.equal(smuggled(0.15, hold, 1), smuggled(0.15, hold, 1, 1));
  // No wedge, nothing smuggled, however light.
  assert.equal(smuggled(0, hold, 4, carryCost(1000)), 0);
});

test("every ware has a name and a worth for its bulk; every cause its words", () => {
  for (let w = 0; w < WARE_COUNT; w++) {
    assert.ok(wareName(w).length > 0);
    assert.ok(wareDensity(w) > 0);
  }
  assert.equal(wareName(G.tin), "tin");
  assert.equal(wareName(WARE_INTOX + 3), "what eases pain");
  assert.equal(wareName(WARE_ARMS), "arms");
  for (const c of CONTRA_CAUSES) assert.ok(CONTRA_WHY[c].length > 0);
});

test("a realm held hard bars arms to its people, the less as they are heard; trade at war is what the gap would carry", () => {
  assert.equal(armsBarred(0.4, 0.2, 0.2), 0);
  assert.ok(armsBarred(0.9, 0.05, 0.1) > armsBarred(0.9, 0.4, 0.1));
  assert.equal(wouldCross(100, 0, 5), 0);
  assert.ok(wouldCross(100, 2, 5) > wouldCross(100, 1, 5));
  assert.equal(wouldCross(100, 50, 5), 25);
});

test("a law on one kind keeps that kind alone from those who want it", () => {
  const have = { calming: 0.8, waking: 0.5, visions: 0.5, easing: 0.4 },
    ways = { piety: 0.6, toil: 0.5, pain: 0.3, hardship: 0.4 },
    free = intoxUse(have, ways, 0),
    visionsBarred = intoxUse(have, ways, { calming: 0, waking: 0, visions: 1, easing: 0 });
  assert.equal(visionsBarred.calming, free.calming);
  assert.ok(visionsBarred.visions < free.visions * 0.5);
  // One law for all four, as before.
  assert.deepEqual(
    intoxUse(have, ways, 0.5),
    intoxUse(have, ways, { calming: 0.5, waking: 0.5, visions: 0.5, easing: 0.5 }),
  );
  // What is wanted does not wait on what is within reach: what trade answers.
  assert.ok(intoxWant(ways).waking > 0);
  // What eases pain binds more and kills more than what wakes; what wakes keeps them at work.
  assert.ok(kindCost("easing", 0.1).deaths > kindCost("waking", 0.1).deaths);
  assert.ok(kindCost("waking", 0.1).lost < 0);
});

test("a ban's constituency: the harm's kin, masters, temple and healers for it as far as heard; what keeping it costs against", () => {
  const sides = {
      temple: 0.07,
      rites: 0,
      court: 0.1,
      lost: 0.02,
      force: 0.5,
      voice: 0.5,
      word: 0.5,
      traders: 0.05,
      excise: 0.02,
      users: 0.23,
    },
    without = prohibits(sides).level,
    harmed = prohibits({ ...sides, dependent: 0.05, deaths: 4e-4, crafters: 0.1 }),
    silenced = prohibits({
      ...sides,
      dependent: 0.05,
      deaths: 4e-4,
      crafters: 0.1,
      voice: 0,
      word: 0,
    }),
    dear = prohibits({
      ...sides,
      dependent: 0.05,
      deaths: 4e-4,
      crafters: 0.1,
      enforce: 0.3,
      rents: 0.4,
      corruption: 0.5,
    });
  assert.equal(without, 0);
  assert.ok(harmed.level > 0.3, `a ruinous trade, heard: ${harmed.level}`);
  assert.ok(silenced.level < harmed.level, "the harmed unheard weigh less");
  assert.ok(dear.level < harmed.level, "a ban dear to keep lapses");
  assert.ok(harmed.parts.some(([name]) => /kin/.test(name)));
});
