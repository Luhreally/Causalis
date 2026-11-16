// One person (rules/self.ts, round G): what they are like, want, do over a life, own and owe, how their kind pairs, and what could
// lead them wrong. Pure functions: these hold what each rule says, on an upright ape and on bodies unlike one.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HUMANLIKE,
  MIDDLE_WAYS,
  OCC,
  SELF_TRAITS,
  careerOf,
  crimeLean,
  holdingsOf,
  bearersServe,
  bearingHeld,
  pairingOf,
  selfNature,
  shareAt,
  topTenth,
  traitsOf,
  wantsOf,
  wealthTail,
  type BodyPlan,
  type WantFacts,
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
  social: 0.6,
};
const hive: BodyPlan = { ...ape, social: 0.95, size: 20, bearing: "eggs", young: 6 };
const spawner: BodyPlan = { ...ape, medium: "water", bearing: "spawn", young: 200, social: 0.3 };

const keyed = (seed: number) => (i: number) => ((seed * 7919 + i * 104729) % 1000) / 1000;
const up = { ways: MIDDLE_WAYS, hunger: 0, danger: 0, standing: 0.5, lettered: true };

test("traits stay in their range, and a hive's are more alike than an ape's", () => {
  const spread = (b: BodyPlan) => {
    const vs = Array.from({ length: 200 }, (_, s) => traitsOf(selfNature(b), up, keyed(s)).warmth);
    return Math.max(...vs) - Math.min(...vs);
  };
  for (let s = 0; s < 50; s++) {
    const t = traitsOf(selfNature(ape), up, keyed(s));
    for (const k of SELF_TRAITS) assert.ok(t[k] >= 0 && t[k] <= 1);
  }
  assert.ok(spread(hive) < spread(ape) / 2);
});

test("a hungry youth makes the driven, a people of valour the bold", () => {
  const mid = traitsOf(selfNature(ape), up, () => 0.5),
    hungry = traitsOf(selfNature(ape), { ...up, hunger: 1 }, () => 0.5),
    valiant = traitsOf(
      selfNature(ape),
      { ...up, ways: { ...MIDDLE_WAYS, valour: 0.9 } },
      () => 0.5,
    );
  assert.ok(hungry.drive > mid.drive);
  assert.ok(valiant.boldness > mid.boldness);
});

test("a lean year presses on the poor harder than on the rich", () => {
  const t = traitsOf(selfNature(ape), up, () => 0.5),
    f = (standing: number): WantFacts => ({
      nature: selfNature(ape),
      ways: MIDDLE_WAYS,
      child: false,
      old: 0.4,
      fed: 0.7,
      left: 0,
      standing,
      rank: 0,
      danger: 0,
      lawless: 0,
      partnered: true,
      children: 2,
      parents: true,
      mourning: false,
      faith: true,
      barred: false,
      lettered: true,
      learned: 0.5,
    }),
    food = (q: number) => wantsOf(t, f(q)).find((w) => w.kind === "food")!.pressing;
  assert.ok(food(0.1) > food(0.9));
  const all = wantsOf(t, f(0.5));
  for (let i = 1; i < all.length; i++) assert.ok(all[i - 1]!.pressing >= all[i]!.pressing);
});

test("a life's work ends at the work they do now, each step after the last", () => {
  const t = traitsOf(selfNature(ape), up, () => 0.5);
  for (let s = 0; s < 40; s++) {
    const steps = careerOf(
      {
        born: 100,
        year: 160,
        adulthood: 15,
        span: 80,
        occupation: OCC.crafter,
        since: null,
        seated: false,
        kinds: [OCC.forager, OCC.farmer, OCC.herder, OCC.crafter, OCC.trader, OCC.leader],
        counts: [5, 60, 10, 15, 8, 2],
        ways: { ...MIDDLE_WAYS, openness: 0.9, tradition: 0.1 },
        traits: t,
        standing: 0.5,
        hardTimes: 0.3,
      },
      keyed(s),
    );
    assert.ok(steps.length >= 1);
    assert.equal(steps.at(-1)!.occupation, OCC.crafter);
    assert.equal(steps.at(-1)!.to, null);
    assert.equal(steps[0]!.from, 115);
    for (let i = 1; i < steps.length; i++) {
      assert.ok(steps[i]!.from > steps[i - 1]!.from);
      assert.notEqual(steps[i]!.occupation, steps[i - 1]!.occupation);
    }
  }
});

test("a household's share of its land's wealth averages to the land's own, and lies with fewer the less it is spread", () => {
  for (const spread of [0, 0.5, 1]) {
    const a = wealthTail(spread, 0.3);
    let sum = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) sum += shareAt((i + 0.5) / n, a);
    assert.ok(Math.abs(sum / n - 1) < 0.08, `mean ${sum / n} at spread ${spread}`);
  }
  assert.ok(topTenth(wealthTail(0, 0.5)) > topTenth(wealthTail(1, 0)));
  const h = holdingsOf({
    worthHead: 100,
    owedHead: 10,
    goods: [60, 40],
    spread: 0.5,
    common: 0.5,
    caste: 0.3,
    standing: 0.5,
    mouths: 4,
    ownsHome: false,
    homeWorth: 3000,
    left: -2,
    rent: 0.5,
    purse: null,
  });
  assert.equal(h.home, 0);
  assert.ok(h.arrears > 0);
  assert.equal(h.common, 50);
});

test("one of a town whose every number is the middle leans to each wrong as its middle does", () => {
  const scene = { hungry: 0.3, short: true, opportunity: 0.5, reach: 0.5, grievance: 0.2 },
    t = Object.fromEntries(SELF_TRAITS.map((k) => [k, 0.5])) as Record<
      (typeof SELF_TRAITS)[number],
      number
    >,
    mid = crimeLean({ traits: t, standing: 0.5, hunger: 0, faith: 0 }, scene);
  for (const v of Object.values(mid)) assert.ok(Math.abs(v - 1) < 1e-9);
  const poor = crimeLean(
    { traits: { ...t, conscience: 0.2 }, standing: 0.1, hunger: 0.4, faith: 0 },
    scene,
  );
  assert.ok(poor.steal > 1.5);
  const hot = crimeLean(
    { traits: { ...t, temper: 0.9, warmth: 0.2 }, standing: 0.5, hunger: 0, faith: 0 },
    scene,
  );
  assert.ok(hot.harm > 1.3);
});

test("how a kind pairs, and whose mothers its levies take", () => {
  assert.equal(pairingOf(ape, 15), "life");
  assert.equal(pairingOf(hive, 6), "brood");
  assert.equal(pairingOf(spawner, 10), "none");
  assert.equal(pairingOf({ ...ape, bearing: "eggs", young: 4, social: 0.5 }, 10), "season");
  // (Whose mothers a levy takes is round C's one rule: rules/children.ts bearersServe of how long their young hold them.)
  assert.equal(bearersServe(bearingHeld(ape, HUMANLIKE)), 0);
  assert.equal(bearersServe(bearingHeld(spawner, HUMANLIKE)), 1);
});
