// How a realm is held (rules/holds.ts): four numbers, and every name read off them and the people's body; and one rule for what a
// realm learns: an outcome, a blame read off its ways, a change that follows.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OUTCOMES,
  blameOf,
  changeOf,
  firstHolds,
  formOf,
  heldWords,
  holdWords,
  talkOf,
  type BodyPlan,
  type WaysRead,
} from "../../src/rules/index.ts";

const ape: BodyPlan = {
  clade: "apes",
  name: "upright apes",
  medium: "land",
  symmetry: "bilateral",
  size: 60,
  manipulators: "hands",
  limbs: 2,
  senses: ["sight", "hearing"],
  skin: "skin",
  warm: true,
  diet: "both",
  bearing: "live",
  young: 1,
  span: 80,
  social: 0.7,
};
const hive: BodyPlan = {
  ...ape,
  name: "hive-crawlers",
  size: 3,
  manipulators: "mandibles",
  limbs: 6,
  senses: ["smell", "sight"],
  skin: "shell",
  bearing: "eggs",
  young: 40,
  span: 30,
  social: 0.95,
};
const ancient: BodyPlan = {
  ...ape,
  name: "long-lived",
  span: 400,
  young: 6,
  bearing: "eggs",
  medium: "water",
};
const ways = (o: Partial<WaysRead> = {}): WaysRead => ({
  hierarchy: 0.5,
  openness: 0.5,
  tradition: 0.5,
  valour: 0.5,
  piety: 0.5,
  trade: 0.5,
  thrift: 0.5,
  ...o,
});

test("a realm's first numbers come of its rule, its ways and its body: a chief's few, an assembly's many; a hive decides together", () => {
  const chief = firstHolds({ leadership: 0, law: 0, succession: 0 }, ways(), ape),
    assembly = firstHolds({ leadership: 2, law: 0, succession: 1 }, ways(), ape),
    hiveChief = firstHolds({ leadership: 0, law: 0, succession: 0 }, ways(), hive);
  assert.ok(
    chief[1]! < 0.2 && assembly[1]! >= 0.7,
    `voice ${chief[1]} under a chief, ${assembly[1]} in an assembly`,
  );
  assert.ok(
    hiveChief[1]! > chief[1]!,
    "a hive shares its choices more than apes under the same rule",
  );
  assert.ok(hiveChief[0]! > chief[0]!, "a hive's soldiers hold its force");
  for (const v of [...chief, ...assembly, ...hiveChief]) assert.ok(v >= 0 && v <= 1);
});

test("names are read off the numbers and the body, never kept: an ape's citizens, a hive's consensus, the eldest of a long-lived people", () => {
  const ape1 = { body: ape, arm: "muskets", far: null },
    hive1 = { body: hive, arm: null, far: null },
    old1 = { body: ancient, arm: null, far: null };
  assert.equal(holdWords("voice", 0.9, ape1), "every citizen chooses");
  assert.equal(holdWords("voice", 0.05, ape1), "the ruler's word alone");
  assert.equal(holdWords("force", 0.8, ape1), "only the realm's host bears muskets");
  assert.equal(holdWords("force", 0.1, ape1), "every household bears muskets");
  assert.equal(holdWords("voice", 0.9, hive1), "the whole hive decides as one");
  assert.equal(holdWords("voice", 0.05, hive1), "the brood-mother's will alone");
  assert.equal(
    holdWords("force", 0.8, hive1),
    "only the soldier caste bears their stings and mandibles",
  );
  assert.equal(holdWords("word", 0.1, hive1), "every scent read by the watchers");
  assert.equal(holdWords("voice", 0.3, old1), "a council of the eldest");
  assert.equal(talkOf(ancient), "songs");
  // (Their fastest way of word, where it outruns any messenger, named as their world has it.)
  assert.equal(
    holdWords("word", 0.8, { ...old1, far: "a voice through the deep" }),
    "songs pass freely, even a voice through the deep",
  );
  assert.equal(heldWords([0.8, 0.1, 0.2, 0.5]), "Held by one, its people disarmed and watched");
  assert.equal(heldWords([0.2, 0.8, 0.8, 0.5]), "Held by all, its people armed and free-spoken");
  const f = formOf([0.8, 0.1, 0.2, 0.5]);
  assert.ok(f.oneRules && f.disarmed && f.watched && !f.allChoose);
});

test("whom a people blames comes of its ways: the open look to themselves, the proud call another's fall weakness, the devout the gods", () => {
  assert.equal(blameOf(ways({ openness: 0.9, tradition: 0.1 }), true, false), "ours");
  assert.equal(
    blameOf(ways({ openness: 0.1, valour: 0.9, hierarchy: 0.9 }), true, false),
    "theirs",
  );
  assert.equal(
    blameOf(ways({ openness: 0.2, tradition: 0.9, valour: 0.8 }), false, true),
    "weakness",
  );
  assert.equal(blameOf(ways({ piety: 0.95, openness: 0.3 }), true, false), "the gods'");
  // (Weakness is never blamed for what befell oneself.)
  for (const o of [0, 0.5, 1])
    assert.notEqual(
      blameOf(ways({ openness: o, tradition: 1, valour: 1 }), true, true),
      "weakness",
    );
});

test("one rule for every lesson: what it changes follows from the blame — mend where it is ours, harden where it is others', half for pride, nothing for the gods", () => {
  for (const o of OUTCOMES) {
    const ours = changeOf(o, "ours", 1),
      theirs = changeOf(o, "theirs", 1),
      pride = changeOf(o, "weakness", 1),
      gods = changeOf(o, "the gods'", 1);
    assert.deepEqual(ours, { ...o.mend }, o.id);
    assert.deepEqual(theirs, { ...o.harden }, o.id);
    for (const [k, v] of Object.entries(pride))
      assert.equal(v, (o.harden as Record<string, number>)[k]! * 0.5, o.id);
    assert.deepEqual(gods, {}, o.id);
  }
  const crushed = OUTCOMES.find((o) => o.id === "crushed")!;
  assert.ok(
    crushed.mend.voice! > 0 && crushed.harden.force! > 0,
    "a rising crushed: a voice, or a tighter grip",
  );
});
