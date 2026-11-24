import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LAW_GROUPS,
  clerkGains,
  lawGains,
  type LawFacts,
  type LawGroup,
} from "../../src/rules/index.ts";

// What each group gains by each position of each law, reckoned from its realm's numbers (rules/lawgain.ts): a realm of tillers
// with a few crafters and traders, a court, a temple and an army.
const heads = (h: Partial<Record<LawGroup, number>>): Record<LawGroup, number> =>
  Object.fromEntries(LAW_GROUPS.map((g) => [g, h[g] ?? 0])) as Record<LawGroup, number>;
const realm = (over: Partial<LawFacts> = {}): LawFacts => ({
  heads: heads({
    farmers: 8000,
    herders: 1000,
    crafters: 600,
    traders: 200,
    "the court": 100,
    "the temple": 60,
    "the army": 400,
  }),
  pay: { farmers: 20, herders: 18, crafters: 26, traders: 32 },
  living: 14,
  hold: 1,
  open: 0,
  sway: {
    farmers: 0.2,
    herders: 0.03,
    crafters: 0.03,
    traders: 0.02,
    "the court": 0.4,
    "the temple": 0.12,
    "the army": 0.2,
  },
  foreign: 0,
  unbelief: 0,
  trade: 0,
  otherFaiths: 0,
  faith: true,
  piety: 0.6,
  sacred: false,
  force: 0.5,
  voice: 0.3,
  trust: 0.5,
  kinship: 0.5,
  corruption: 0.1,
  written: 0.5,
  capacity: 0.6,
  short: 0,
  tribute: 0.06,
  land: 1,
  justice: 1,
  ...over,
});
const LAND = 0,
  STRANGERS = 1,
  FAITH = 2,
  JUSTICE = 3;
const best = (w: readonly number[]) => w.indexOf(Math.max(...w));

test("the land: its tillers gain by their own, its holders by the lord's, those with coin by the leases", () => {
  const g = lawGains(realm())[LAND]!;
  assert.equal(best(g.farmers), 2, `farmers ${g.farmers}`);
  assert.equal(best(g.herders), 2);
  assert.equal(best(g["the court"]), 0, `the court ${g["the court"]}`);
  assert.equal(best(g["the army"]), 0);
  assert.equal(best(g.traders), 1, `traders ${g.traders}`);
  // (Where a tiller's work brings him no more than his keep, there is nothing to take, and only what he puts in is at stake.)
  // (Where open land lies near and its arms are few, a bond holds few of them; where courts hold a deal, a lease holds them:
  // the holders gain the more by leases. Where no court holds a deal, by bonds still.)
  const open = lawGains(realm({ hold: 0.15, justice: 2, written: 1 }))[LAND]!;
  assert.equal(
    best(open["the court"]),
    1,
    `the court, its tillers free to flee ${open["the court"]}`,
  );
  const unwritten = lawGains(
    realm({ hold: 0.15, justice: 0, written: 0, trust: 0.2, kinship: 0.2 }),
  )[LAND]!;
  assert.equal(best(unwritten["the court"]), 0, `no deal held ${unwritten["the court"]}`);
  const bare = lawGains(realm({ living: 25 }))[LAND]!;
  assert.ok(Math.abs(bare["the court"][0]! - bare["the court"][2]!) < 1e-9, "nothing to take");
});

test("strangers: nothing at stake where none are strangers; where many are, the seat gains by subjects, the many by citizens", () => {
  const none = lawGains(realm())[STRANGERS]!;
  for (const g of LAW_GROUPS) assert.deepEqual(none[g], [0, 0, 0], g);
  const many = lawGains(realm({ foreign: 0.4, unbelief: 0.2, trade: 0.3, otherFaiths: 0.3 }))[
    STRANGERS
  ]!;
  assert.equal(best(many["the court"]), 0, `the court ${many["the court"]}`);
  assert.equal(best(many.farmers), 2);
  assert.equal(best(many.traders), 2, `traders ${many.traders}`);
  // (Those who trade gain the more by citizens as more of their trade crosses the border.)
  const more = lawGains(realm({ foreign: 0.4, unbelief: 0.2, trade: 0.8, otherFaiths: 0.3 }))[
    STRANGERS
  ]!;
  assert.ok(more.traders[2]! > many.traders[2]!);
});

test("faith: the temple gains by one faith, the more the fewer its devout; none where the seat keeps no faith", () => {
  const g = lawGains(realm({ unbelief: 0.3 }))[FAITH]!;
  assert.equal(best(g["the temple"]), 0);
  assert.equal(best(g.farmers), 2, `farmers ${g.farmers}`);
  const devout = lawGains(realm({ unbelief: 0.3, piety: 0.95 }))[FAITH]!;
  assert.ok(
    devout["the temple"][2]! > g["the temple"][2]!,
    "free conscience costs a devout temple less",
  );
  // (Under a sacred law the court shares the temple's gain.)
  const sacred = lawGains(realm({ unbelief: 0.3, sacred: true }))[FAITH]!;
  assert.equal(best(sacred["the court"]), 0);
  const godless = lawGains(realm({ faith: false }))[FAITH]!;
  for (const x of LAW_GROUPS) assert.deepEqual(godless[x], [0, 0, 0], x);
});

test("justice: traders gain by one law for all as courts hold their deals; the court by its own courts", () => {
  const g = lawGains(realm({ written: 0.8 }))[JUSTICE]!;
  assert.equal(best(g.traders), 2, `traders ${g.traders}`);
  assert.equal(best(g["the court"]), 1, `the court ${g["the court"]}`);
  assert.ok(g.farmers[2]! > g.farmers[0]!, "what a tiller holds the safer");
});

test("a group with no heads in the realm gains nothing by any law", () => {
  const g = lawGains(realm({ heads: heads({ farmers: 9000, "the court": 50 }) }));
  for (const law of g) {
    assert.deepEqual(law.traders, [0, 0, 0]);
    assert.deepEqual(law["the army"], [0, 0, 0]);
  }
});

test("the clerks gain by what there is to assess and judge: leases, rolls of strangers, courts; and by one law only where little is skimmed", () => {
  const paid = 30 * 20 * 1.5,
    g = clerkGains(realm({ foreign: 0.3, unbelief: 0.1 }), paid);
  assert.equal(best(g[LAND]!), 1, `land ${g[LAND]}`);
  assert.equal(best(g[STRANGERS]!), 0, `strangers ${g[STRANGERS]}`);
  // (A realm of one people keeps no roll of strangers: nothing to them; the tithe is the temple's unless its law is sacred.)
  assert.deepEqual(clerkGains(realm(), paid)[STRANGERS], [0, 0, 0]);
  assert.deepEqual(g[FAITH], [0, 0, 0]);
  assert.equal(best(clerkGains(realm({ sacred: true }), paid)[FAITH]!), 0);
  // (Courts that reach further keep more offices; where much is skimmed, what sticks to the pens is more than the fees.)
  assert.equal(best(clerkGains(realm({ corruption: 0 }), paid)[JUSTICE]!), 2);
  assert.equal(best(clerkGains(realm({ corruption: 0.6, tribute: 0.4 }), paid)[JUSTICE]!), 0);
  // (None paid, no group.)
  assert.deepEqual(clerkGains(realm(), 0)[LAND], [0, 0, 0]);
  for (const law of g) for (const x of law) assert.ok(x > -1 && x < 1);
});
