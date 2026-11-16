// A realm's money and its fears (rules/finance.ts): what it pays to borrow, how its wealth is owned, how much it fears another's
// way, and which realms stand in two camps: each a sum or a product of numbers, and every name read off them.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FINANCE,
  LOSERS,
  campsOf,
  campsStand,
  exposure,
  fearMoves,
  firstOwn,
  ownBelieved,
  ownEvidence,
  ownPull,
  ownWords,
  seenToWork,
  threatOf,
  wayDistance,
  wayWords,
  wouldLose,
  yieldOf,
  type BodyPlan,
  type CampRealm,
  type Way,
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
  senses: ["smell"],
  bearing: "eggs",
  young: 30,
  social: 0.95,
};
const ways: WaysRead = {
  hierarchy: 0.5,
  openness: 0.5,
  tradition: 0.5,
  valour: 0.5,
  piety: 0.5,
  trade: 0.5,
  thrift: 0.5,
};

// force, voice, word, spread, common.
const one: Way = [0.8, 0.15, 0.3, 0.2, 0.1], // one decides, a few own
  many: Way = [0.4, 0.75, 0.8, 0.6, 0.15], // all decide, widely held
  commune: Way = [0.85, 0.2, 0.2, 0.5, 0.85]; // a few decide, the realm owns

test("a realm with nothing against it pays the base; each thing against it adds, and is named", () => {
  const good = yieldOf({
      refused: [],
      burden: 0,
      atWar: false,
      voice: 1,
      word: 1,
      trust: 1,
      crisis: false,
    }),
    bad = yieldOf({
      refused: [2, 40],
      burden: 2.5,
      atWar: true,
      voice: 0.1,
      word: 0.2,
      trust: 0.2,
      crisis: true,
    });
  assert.equal(good.rate, FINANCE.base - FINANCE.seen);
  assert.ok(bad.rate > FINANCE.shut, `shut out at ${bad.rate}`);
  assert.ok(bad.parts.some((p) => p.name.includes("refused") && p.value > 0.05));
  // The sum of the parts is the rate.
  assert.ok(Math.abs(bad.parts.reduce((s, p) => s + p.value, 0) - bad.rate) < 0.001);
  // A debt refused long ago weighs less than one refused lately.
  const lately = yieldOf({ ...base(), refused: [1] }).rate,
    longAgo = yieldOf({ ...base(), refused: [90] }).rate;
  assert.ok(lately > longAgo && longAgo > yieldOf(base()).rate);
  // Where one decides alone, lenders ask more than where all do.
  assert.ok(yieldOf({ ...base(), voice: 0.1 }).rate > yieldOf({ ...base(), voice: 0.9 }).rate);
});
function base() {
  return {
    refused: [] as number[],
    burden: 0.5,
    atWar: false,
    voice: 0.5,
    word: 0.5,
    trust: 0.5,
    crisis: false,
  };
}

test("how wealth is owned is first read off the land law, the ways and the body, and worded off the numbers", () => {
  const lords = firstOwn(0, { ...ways, hierarchy: 0.8 }, ape),
    tillers = firstOwn(2, { ...ways, hierarchy: 0.3 }, ape),
    hived = firstOwn(1, ways, hive);
  assert.ok(lords[0] < tillers[0], "a tiller's own land spreads wealth");
  assert.ok(hived[1] > firstOwn(1, ways, ape)[1] + 0.2, "those who live as one keep one store");
  assert.equal(ownWords([0.1, 0.1], ape), "held by a few great households");
  assert.equal(ownWords([0.7, 0.1], ape), "widely held, household by household");
  assert.equal(ownWords([0.5, 0.7], ape), "held in common by the realm");
  assert.equal(ownWords([0.5, 0.7], hive), "all held in the hive's one store");
  assert.match(
    ownWords([0.1, 0.4], hive),
    /part the realm's own, the rest held by a few great brood-chambers/,
  );
  assert.equal(wayWords(many), "all decide, wealth is widely held");
  assert.equal(wayWords(commune), "a few decide, wealth is the realm's");
});

test("who would lose by another's way is read off both: rulers by a shared say, owners by a common store, the many by one's rule", () => {
  assert.equal(LOSERS[wouldLose(one, many).who], "those who rule it");
  assert.equal(LOSERS[wouldLose(many, one).who], "its people, who have a say");
  assert.equal(LOSERS[wouldLose(commune, many).who], "those who rule it");
  // Owners few and a say shared: it is their wealth that a common store would take.
  const owners: Way = [0.4, 0.75, 0.8, 0.15, 0.05],
    shared: Way = [0.4, 0.75, 0.8, 0.5, 0.9];
  assert.equal(LOSERS[wouldLose(owners, shared).who], "the few who own it");
  assert.equal(LOSERS[wouldLose(shared, owners).who], "those who keep its common store");
  // No one loses by a way like one's own.
  assert.equal(wouldLose(one, one).loss, 0);
  assert.equal(wayDistance(one, one), 0);
  assert.ok(wayDistance(one, many) > 0.3);
});

test("fear is the product of its four parts: none of it where any is nothing", () => {
  const meets = exposure({ near: 1, trade: 0.5, tongue: 0.8, stakes: 0 }, 0.3),
    fares = { fed: 0.5, calm: 0.7, rich: 10, people: 1e6 },
    works = seenToWork(fares, { ...fares, fed: 0.8, calm: 0.9, rich: 20 }),
    t = threatOf(one, many, works, meets);
  assert.ok(
    t.level >= FINANCE.feared,
    `a neighbour held otherwise and faring better is feared: ${t.level}`,
  );
  assert.equal(threatOf(one, one, works, meets).level, 0, "none of one held alike");
  assert.equal(threatOf(one, many, works, 0).level, 0, "none of one never met");
  assert.equal(threatOf(one, many, 0, meets).level, 0, "none of one seen to fail");
  // A realm a twentieth one's size is looked to less than one of a size.
  assert.ok(seenToWork(fares, { ...fares, people: 5e4 }) < seenToWork(fares, fares));
  // Word watched, a people is less exposed: so a ruler who fears tightens it.
  assert.ok(
    exposure({ near: 1, trade: 1, tongue: 1, stakes: 1 }, 0.1) <
      exposure({ near: 1, trade: 1, tongue: 1, stakes: 1 }, 0.9),
  );
});

test("a fear held by those who rule tightens word and arms; where the many would lose they guard themselves more gently", () => {
  const feared = threatOf(one, many, 0.5, 0.6),
    [force, voice, word] = fearMoves(one, feared);
  assert.ok(force > 0 && word < 0 && voice <= 0, "watched the closer, armed the closer");
  const guarded = fearMoves(many, { ...threatOf(many, one, 0.5, 0.6), level: feared.level });
  assert.ok(guarded[2] < 0 && guarded[2] > word, "word watched, but less");
  assert.equal(guarded[1], 0);
});

test("what a realm believes of how wealth is owned is what its evidence supports: how it stood against the usual, by how it fared", () => {
  const usual = [0.4, 0.2];
  // A realm whose wealth lay with a few (far under the usual spread) fared ill: evidence for wider holding; none of the common
  // store, where it stood as most do.
  const ill = ownEvidence([0.1, 0.2], usual, -0.8, 1);
  assert.ok(ill[0]! > 0.3 && ill[1] === 0);
  let b = ownBelieved(undefined, ill, 500);
  assert.ok(ownPull(b, 0, 500) > 0.1, "it comes to want its wealth among more");
  assert.equal(ownPull(b, 1, 500), 0);
  // A neighbour holding much in common that fared well, weighing half: toward a common store. Evidence fades with the years.
  b = ownBelieved(b, ownEvidence([0.4, 0.8], usual, 0.9, 0.5), 510);
  const now = ownPull(b, 1, 510);
  assert.ok(now > 0.05 && ownPull(b, 1, 630) < now / 2);
  // Where all stand alike, a fate says nothing of how they stand.
  assert.deepEqual(ownEvidence(usual, usual, -1, 1), [0, 0]);
});

test("two camps stand where two great realms fear each other and others stand nearer one of them", () => {
  const r = (
    ref: string,
    way: Way,
    people: number,
    fears: [string, number][],
    sworn: string[] = [],
  ): CampRealm => ({
    ref,
    way,
    people,
    fears: fears.map(([of, level]) => ({ of, level })),
    sworn,
  });
  const world = [
      r("a", one, 5e6, [["b", 0.6]]),
      r("b", many, 4e6, [["a", 0.5]]),
      r("c", [0.75, 0.2, 0.3, 0.25, 0.1], 1e6, [["b", 0.3]], ["a"]),
      r("d", [0.4, 0.7, 0.75, 0.55, 0.2], 1e6, [["a", 0.4]]),
      r("e", [0.6, 0.45, 0.55, 0.4, 0.12], 1e6, []),
    ],
    camps = campsOf(world)!;
  assert.deepEqual(camps.poles, ["a", "b"]);
  assert.deepEqual(camps.camps, [
    ["a", "c"],
    ["b", "d"],
  ]);
  assert.deepEqual(camps.apart, ["e"]);
  assert.ok(campsStand(camps));
  // No camps where the great do not fear each other, or the one that does is small.
  assert.equal(campsOf(world.map((x) => ({ ...x, fears: [] }))), null);
  assert.equal(
    campsOf([
      r("a", one, 9e6, []),
      r("b", many, 1e5, [["a", 0.9]]),
      r("c", one, 9e6, []),
      r("d", one, 9e6, []),
      r("e", one, 9e6, []),
    ]),
    null,
  );
  // On a world of many small realms the few most peopled are its great ones, though none has a twentieth of its people.
  const manySmall = [
    r("a", one, 3e5, [["b", 0.6]]),
    r("b", many, 2e5, [["a", 0.5]]),
    ...Array.from({ length: 60 }, (_, i) => r(`z${i}`, one, 1e5, [])),
  ];
  assert.deepEqual(campsOf(manySmall)?.poles, ["a", "b"]);
});
