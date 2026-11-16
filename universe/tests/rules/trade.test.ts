// Trade's last sweep (p87, rules/trade.ts): slumps where money can be held, an exchange bid on hopes, machines taking the tasks that
// pay, a plan's costs by what it can know and who its people are, smoke priced by who breathes it, a town's heart by its rent.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTOMATE,
  CYCLE,
  EXCHANGE,
  HOLDS,
  LEVEL,
  PLAN,
  SMOKE_PRICE,
  abateCost,
  abatedFor,
  adoptWanted,
  automatable,
  automationGain,
  heartCan,
  heartLevel,
  heartRent,
  hopesNext,
  machineCost,
  multiplier,
  planCost,
  planKnows,
  shareWorth,
  sharedOut,
  slackNext,
  slackWanted,
  smokePrice,
  spendShare,
  townRent,
  type CycleRead,
} from "../../src/rules/index.ts";

const year = (over: Partial<CycleRead> = {}): CycleRead => ({
  food: 1000,
  usual: 1000,
  tillers: 0.7,
  leverage: 0,
  failed: false,
  crashed: 0,
  form: "paper",
  spend: 0.8,
  imported: 0.1,
  ...over,
});

test("a short harvest idles the crafts only where money can be held, the deeper for debt, never past the most", () => {
  assert.equal(slackWanted(year()).slack, 0, "a usual year leaves no one idle");
  const short = year({ food: 800 });
  assert.equal(
    slackWanted({ ...short, form: "barter" }).slack,
    0,
    "under barter a bad harvest is hunger, not idle hands",
  );
  const coin = slackWanted({ ...short, form: "metal" }).slack,
    paper = slackWanted(short).slack,
    owing = slackWanted({ ...short, leverage: 0.8 }).slack;
  assert.ok(coin > 0 && paper > coin, `${coin} ${paper}`);
  assert.ok(owing > paper, "what is owed deepens the fall");
  assert.ok(
    slackWanted(year({ food: 0, leverage: 5, failed: true, crashed: 4 })).slack <= CYCLE.most,
  );
  // A house failing calls in debts only where they are owed.
  assert.equal(slackWanted(year({ failed: true })).slack, 0);
  assert.ok(slackWanted(year({ failed: true, leverage: 0.4 })).slack > 0);
  // Idle hands fade, the faster where the treasury spends.
  assert.ok(slackNext(0.2, 0, true) < slackNext(0.2, 0, false));
  assert.equal(slackNext(0.05, 0.2, false), 0.2);
});

test("the multiplier is larger where more is spent at home, and bounded", () => {
  assert.ok(multiplier(0.9, 0) > multiplier(0.6, 0));
  assert.ok(multiplier(0.9, 0.5) < multiplier(0.9, 0));
  assert.ok(multiplier(0.99, 0) <= CYCLE.kMost);
  assert.ok(spendShare(0.6) > spendShare(0.3), "the poor spend more of what they earn");
});

test("an exchange is bid on hopes, held within bounds, and crashes when a falling year meets hopes far past the long run", () => {
  for (const g of [-0.5, 0, 0.03, 0.2, 5]) {
    const w = shareWorth(0.08, g);
    assert.ok(w >= EXCHANGE.least && w <= EXCHANGE.most, `${g}: ${w}`);
  }
  assert.ok(shareWorth(0.08, 0.04) > shareWorth(0.08, 0), "hoped growth is bid up");
  assert.ok(shareWorth(0.12, 0.02) < shareWorth(0.06, 0.02), "a dearer ask is bid down");
  const hoping = hopesNext(0.02, 0.02, 0.1, 1);
  assert.ok(!hoping.crash && hoping.hopes > 0.02, "hopes follow good years");
  const bubble = shareWorth(0.08, 0.05) / shareWorth(0.08, 0.01);
  assert.ok(bubble >= EXCHANGE.bubble);
  const fall = hopesNext(0.05, 0.01, -0.05, bubble);
  assert.ok(fall.crash && fall.hopes <= 0.01);
  assert.ok(
    !hopesNext(0.01, 0.01, -0.05, 1).crash,
    "a falling year without high hopes is no crash",
  );
});

test("machines take a craft's tasks as fine work, reckoning and power allow, where they cost less than a hand", () => {
  assert.equal(automatable(1, 0.02, 1), 0, "a knapped edge and fingers do nothing alone");
  const engines = automatable(0.02, 20, 1),
    minds = automatable(0.00002, 1e10, 1);
  assert.ok(engines > 0 && engines < 0.25, `${engines}`);
  assert.ok(minds > 0.8 && minds <= AUTOMATE.most, `${minds}`);
  assert.equal(automatable(0.00002, 1e10, 0), 0, "without power no machine turns");
  assert.equal(adoptWanted(0.8, 10, 12), 0, "a machine dearer than the hand is not taken");
  assert.ok(adoptWanted(0.8, 10, 2) > adoptWanted(0.8, 10, 8));
  assert.ok(machineCost(4, 1) > machineCost(2, 1));
  assert.equal(automationGain(0), 1);
  assert.ok(automationGain(5) <= 1 + AUTOMATE.most * (AUTOMATE.gain - 1) + 1e-12);
});

test("a plan costs as far as it cannot know and its people are selves; it shares alike and keeps the whole", () => {
  const blind = planKnows(0.4, false, 0.1, 0),
    minds = planKnows(1, true, 1e10, 1);
  assert.ok(minds > 0.95 && blind < 0.3, `${blind} ${minds}`);
  const selves = planCost(0.8, 20, 14, blind, 0.6),
    hive = planCost(0.8, 20, 14, blind, 0.95),
    reckoned = planCost(0.8, 20, 14, minds, 0.6);
  assert.ok(hive.shirk < selves.shirk, "a people that lives as one loses little effort");
  assert.ok(reckoned.errs < selves.errs / 10, "a mind of crystal knows what is wanted");
  assert.ok(planCost(1, 1000, 14, 0, 0).loss <= PLAN.most);
  assert.equal(planCost(0, 20, 14, 0, 0.6).loss, 0);
  const groups = [
      { people: 90, each: 2 },
      { people: 10, each: 40 },
    ],
    shared = sharedOut(groups, 0.5),
    total = (gs: typeof groups) => gs.reduce((s, g) => s + g.people * g.each, 0);
  assert.ok(Math.abs(total(shared) - total(groups)) < 1e-9);
  assert.ok(shared[0]!.each > 2 && shared[1]!.each < 40);
});

test("smoke is priced as far as those who breathe it are heard and it is measured and known to sicken", () => {
  const sides = { harm: 0.5, breathers: 0.8, holders: 0.2, measured: 0.9, knows: true };
  assert.equal(smokePrice({ ...sides, harm: 0 }).price, 0, "no smoke, no price");
  const heard = smokePrice(sides).price,
    unknown = smokePrice({ ...sides, knows: false }).price,
    held = smokePrice({ ...sides, holders: 1 }).price,
    mute = smokePrice({ ...sides, breathers: 0.1 }).price;
  assert.ok(
    heard > 0 && heard > unknown && heard > held && heard > mute,
    `${heard} ${unknown} ${held} ${mute}`,
  );
  assert.ok(abatedFor(1) <= SMOKE_PRICE.most && abatedFor(0) === 0);
  assert.ok(abateCost(0.8) > 2 * abateCost(0.4), "cutting more costs ever more");
  assert.ok(abateCost(1) <= SMOKE_PRICE.cost);
});

test("a town's heart rises with what the walk saved there is worth, as high as its people can build, not at a count", () => {
  const all = heartCan(() => true),
    stone = heartCan((id) => id === "cultivation" || id === "masonry"),
    none = heartCan(() => false);
  assert.equal(heartLevel(100_000, HOLDS, none), LEVEL.hut);
  assert.equal(
    heartLevel(500, HOLDS, stone),
    LEVEL.house,
    "a village's heart saves no walk worth a storey",
  );
  assert.equal(heartLevel(5000, HOLDS, stone), LEVEL.townhouse);
  assert.equal(
    heartLevel(5_000_000, HOLDS, stone),
    LEVEL.townhouse,
    "none builds past what it can raise",
  );
  assert.equal(heartLevel(2_000_000, HOLDS, all), LEVEL.spire);
  let was = 0;
  for (const n of [300, 1000, 3000, 10_000, 30_000, 100_000, 300_000, 1_000_000]) {
    const l = heartLevel(n, HOLDS, all);
    assert.ok(l >= was, `${n}: ${l} after ${was}`);
    was = l;
  }
  assert.ok(heartRent(40_000, 6) > heartRent(10_000, 6), "a greater town's edge lies farther");
  assert.ok(heartRent(40_000, 600) < heartRent(40_000, 6), "built tall, the edge comes near");
  assert.ok(townRent(40_000, 160, 4.5) > townRent(10_000, 160, 4.5));
});
