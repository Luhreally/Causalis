// Houses (rules/houses.ts; the store, sim/order/houses.ts): who a ruler must pay, favours against what all share, offices as
// favours, inheritance by the life table, those who rise from outside, how a hold ends. Pure functions, and the store's round trip.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HOUSES,
  HUMANLIKE,
  coalitionOf,
  courtedShares,
  crownKeep,
  diesWithin,
  farmedOut,
  followingWanted,
  generationOf,
  griftWanted,
  heirsChance,
  heirsExpected,
  heirsFor,
  kinInOffice,
  licensed,
  parted,
  privateShare,
  purgeChance,
  rivalWeight,
  rentChafes,
} from "../../src/rules/index.ts";
import { Hasher } from "../../src/kernel/index.ts";
import { HouseStore, type RealmHouses } from "../../src/sim/index.ts";

/** A realm's groups as a few hold its sway, and as many do. */
const few = [
    { group: "the court", sway: 0.6, heads: 300 },
    { group: "the army", sway: 0.3, heads: 400 },
    { group: "farmers", sway: 0.1, heads: 8000 },
  ],
  many = [
    { group: "the court", sway: 0.04, heads: 300 },
    { group: "farmers", sway: 0.7, heads: 8000 },
    { group: "crafters", sway: 0.16, heads: 1600 },
    { group: "traders", sway: 0.1, heads: 900 },
  ];

test("a ruler buys the backing it needs cheapest first: the groups whose sway comes with the fewest heads", () => {
  const c = coalitionOf(few, HOUSES.needs, false);
  assert.equal(c.members[0]![0], "the court");
  assert.ok(c.winning < 300, `${c.winning}`);
  assert.ok(Math.abs(c.members[0]![1] - 0.5 / 0.6) < 1e-9);
  assert.equal(c.selectorate, 8700);
  // (Where the many carry the choice the coalition is thousands: loyalty falls, favours give way to what all share.)
  const d = coalitionOf(many, HOUSES.needs, true);
  assert.ok(d.winning > 4000, `${d.winning}`);
  assert.equal(d.selectorate, d.all);
  assert.ok(c.loyalty > d.loyalty, `${c.loyalty} ${d.loyalty}`);
  assert.ok(privateShare(c.winning, c.all) > 0.8);
  assert.ok(privateShare(d.winning, d.all) < 0.3);
  assert.ok(crownKeep(c.loyalty) > crownKeep(d.loyalty));
  // (A plurality is enough where the people chose: a smaller coalition than half.)
  assert.ok(coalitionOf(many, 0.35, true).winning < d.winning);
  // (Groups not heard at all are outside the selectorate.)
  const e = coalitionOf([...few, { group: "herders", sway: 0.001, heads: 5000 }], 0.5, false);
  assert.equal(e.selectorate, 8700);
});

test("offices go to kin as far as favours are how the seat pays; a written test and free word hold it back", () => {
  const base = { favours: 0.9, examined: false, word: 0.2, caste: 0.6, houses: true };
  const kin = kinInOffice(base);
  assert.ok(kin > 0.5, `${kin}`);
  assert.ok(kinInOffice({ ...base, examined: true }) < kin);
  assert.ok(kinInOffice({ ...base, word: 1 }) < kin);
  assert.ok(kinInOffice({ ...base, favours: 0.2 }) < kin);
  assert.equal(kinInOffice({ ...base, houses: false }), 0);
  assert.ok(licensed(0.9, 0.8) > licensed(0.2, 0.8));
  assert.ok(licensed(0.9, 0.8) <= HOUSES.grantMost);
  assert.ok(farmedOut(0.9, 0.1) > farmedOut(0.9, 0.9));
  // (Houses court by what they can bring: the richer, the inside, the titled win more.)
  const s = courtedShares(
    [
      { wealth: 100, inside: true, titled: false },
      { wealth: 100, inside: false, titled: false },
      { wealth: 100, inside: true, titled: true },
    ],
    0.5,
  );
  assert.ok(Math.abs(s.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(s[2]! > s[0]! && s[0]! > s[1]!);
});

test("estates are kept whole where rank is hard and the land full, parted where land is open", () => {
  assert.ok(parted(0.8, 0, 0.5) < parted(0.1, 2, 0.5));
  assert.ok(parted(0.5, 0.5, 0.9) > parted(0.5, 0.5, 0.1));
  for (const x of [parted(1, 0, 0), parted(0, 10, 1)]) assert.ok(x >= 0 && x <= 1);
});

test("a line's heirs, its generation and its head's death come of its people's life table", () => {
  const heirs = heirsExpected(HUMANLIKE);
  // (Five born to a woman over a life among upright apes, more than half of them grown.)
  assert.ok(heirs > 2 && heirs < 4, `${heirs}`);
  const gen = generationOf(HUMANLIKE);
  assert.ok(gen > 22 && gen < 35, `${gen}`);
  assert.ok(diesWithin(HUMANLIKE, 70, 5) > diesWithin(HUMANLIKE, 30, 5));
  assert.ok(diesWithin(HUMANLIKE, 30, 10) > diesWithin(HUMANLIKE, 30, 1));
  let sum = 0;
  for (let n = 0; n < 30; n++) sum += heirsChance(heirs, n);
  assert.ok(Math.abs(sum - 1) < 1e-6);
  assert.equal(heirsFor(heirs, 0), 0);
  assert.ok(heirsFor(heirs, 0.999) >= 6);
  assert.ok(heirsFor(heirs, 0.5) >= 2);
});

test("a demagogue's following grows on grievance carried by word; a grifter's take on the skim", () => {
  const sore = { grievance: 0.6, taxed: 0.05, unequal: 0.5, word: 0.8, legitimacy: 0.3 };
  const f = followingWanted(sore);
  assert.ok(f >= HOUSES.riseFollowing, `${f}`);
  assert.ok(followingWanted({ ...sore, word: 0 }) < f);
  assert.ok(followingWanted({ ...sore, legitimacy: 0.95 }) < f);
  assert.ok(
    followingWanted({ ...sore, grievance: 0, taxed: 0, unequal: 0.3 }) < HOUSES.endFollowing,
  );
  assert.ok(griftWanted(0.4, 0.3, true, 0) >= HOUSES.riseGrift);
  assert.ok(griftWanted(0.4, 0.9, true, 0) < griftWanted(0.4, 0.3, true, 0));
  assert.ok(griftWanted(0.02, 0.3, true, 0) < HOUSES.endGrift);
});

test("a crown that keeps the arms purges a house grown near its power; a voice carried widely stays its hand", () => {
  assert.equal(purgeChance(0.3, 0.6, 1, 0), 0);
  const p = purgeChance(0.8, 0.6, 0.9, 0.1);
  assert.ok(p > 0, `${p}`);
  assert.ok(purgeChance(0.8, 0.6, 0.9, 0.9) < p);
  assert.ok(purgeChance(0.8, 0.6, 0.1, 0.1) < p);
  assert.equal(rivalWeight(0.2, 0.6), 0);
  assert.ok(rivalWeight(0.9, 0.3) > 0.4);
});

test("the houses' store is dormant empty, hashes its digest, and comes back from its save whole", () => {
  const store = new HouseStore();
  assert.ok(store.dormant());
  const v: RealmHouses = {
    last: 40,
    selectorate: 900,
    winning: 250,
    all: 9000,
    loyalty: 720,
    favours: 910,
    members: [["the court", 833]],
    nepotism: 400,
    hereditary: 200,
    rival: 0,
    following: 30,
    grift: 0,
    parted: 300,
    skim: 120,
    rents: 40,
    burden: 12,
    crownEvent: null,
    next: 2,
    houses: [
      {
        id: 1,
        name: "Avel",
        origin: 0,
        since: 30,
        seat: 7,
        wealth: 900,
        land: 100,
        offices: 400,
        grants: 50,
        farm: 0,
        income: 110,
        power: 700,
        titled: 1,
        crown: 1,
        headBorn: 0,
        generation: 1,
        heirs: 0,
        event: "ev:0:1" as never,
      },
    ],
    gone: [],
  };
  store.put("pol:0:3" as never, v);
  assert.ok(!store.dormant());
  const back = new HouseStore();
  back.load(JSON.parse(JSON.stringify(store.save())));
  const h1 = new Hasher(),
    h2 = new Hasher();
  store.hashInto(h1);
  back.hashInto(h2);
  assert.equal(h1.hex(), h2.hex());
  assert.deepEqual(back.of("pol:0:3" as never), v);
  assert.deepEqual(back.pinned(), ["ev:0:1"]);
  back.forget("pol:0:3" as never);
  const h3 = new Hasher();
  back.hashInto(h3);
  assert.notEqual(h3.hex(), h1.hex());
});

test("a burden long borne chafes the less: what is borne past the custom aggrieves, and a little of the rest", () => {
  assert.ok(rentChafes(0.2, 0) > rentChafes(0.2, 0.1));
  assert.ok(rentChafes(0.2, 0.1) > rentChafes(0.2, 0.2));
  assert.ok(rentChafes(0.2, 0.2) > 0);
  assert.equal(rentChafes(0, 0.3), 0);
  assert.ok(Math.abs(rentChafes(0.2, 0) - 0.2) < 1e-12);
});
