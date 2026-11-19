// Round B: money and the state, as pure rules. A good is worth what it costs and does; money's price level is Fisher's; taxes fall
// where they can be measured and not refused; tariffs and sanctions answer interests and fears; smuggling the wedge; pooled risk
// where records allow; rent and the Lorenz curve; bondage by Domar.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  G,
  GOODS,
  RECIPES,
  BIND_MOST,
  bindPull,
  canPool,
  canUnderwrite,
  insuredGain,
  lerner,
  lorenz,
  measurable,
  moneyForm,
  moneyGood,
  naturalPrices,
  organised,
  MONEY,
  notesRenewed,
  priceLevel,
  priceTarget,
  rentOf,
  sanctionWanted,
  shipLoss,
  smuggled,
  tariffWanted,
  taxRates,
  taxResisted,
  velocityOf,
} from "../../src/rules/index.ts";

const recipe = (id: string) => RECIPES.findIndex((r) => r.id === id);
const prices = GOODS.map((g) => g.value);

test("a good's worth rests on its staple, its labour, what it costs to make, what it does, or what it fetched", () => {
  const work = GOODS.map(() => NaN);
  work[G.grain] = 1 / 40;
  work[G.meat] = 1 / 25;
  const { worth, basis } = naturalPrices({
    price: prices,
    recipes: [recipe("stone-tools"), recipe("pottery"), recipe("weaving")],
    outside: 30,
    wage: 30,
    living: 20,
    cold: 0.5,
    work,
  });
  assert.equal(worth[G.grain], 1);
  assert.equal(basis[G.grain], "staple");
  // Meat takes more work a unit than grain does.
  assert.equal(basis[G.meat], "labour");
  assert.ok(Math.abs(worth[G.meat]! - 1.6) < 1e-9);
  // Stone tools: a crafter's year at what he would earn otherwise, over five a year.
  assert.equal(basis[G.tools], "made");
  assert.ok(Math.abs(worth[G.tools]! - 6) < 1e-9);
  // Machines it cannot make: worth what they do, never above it.
  assert.equal(basis[G.machines], "used");
  assert.ok(worth[G.machines]! <= 300 + 1e-9);
  // Wool it cannot make but weaves: worth what weaving leaves of it, or what it fetched.
  assert.ok(basis[G.wool] === "inputs" || basis[G.wool] === "free");
  for (const w of worth) assert.ok(Number.isFinite(w) && w > 0);
});

test("no worth rests on a wage that rests on it: a land whose wages ran up keeps its foods and free goods in food's own terms", () => {
  const work = GOODS.map(() => NaN);
  work[G.wild] = 1 / 30;
  const dear = GOODS.map(() => 1e30),
    { worth } = naturalPrices({
      price: dear,
      recipes: [],
      outside: 1e30,
      wage: 1e30,
      living: 20,
      cold: 1,
      work,
    });
  assert.equal(worth[G.wild], 1);
  // Grain not grown here feeds a month as the staple does.
  assert.equal(worth[G.grain], 1);
  // What rests on nothing counted is held within a worker's year of food.
  assert.ok(worth[G.wool]! <= 20);
  // Clothes and pots: what they do, food a body would burn in the cold, food kept from spoiling.
  assert.ok(worth[G.clothing]! > 10 && worth[G.clothing]! < 20 && worth[G.pottery]! < 10);
});

test("a price leans toward its worth, bent by scarcity and lifted by its makers' hold", () => {
  assert.equal(priceTarget(2, 1, 0), 2);
  assert.ok(priceTarget(2, 4, 0) > 2 * 3);
  assert.ok(priceTarget(2, 1e9, 0) === priceTarget(2, 4, 0));
  assert.ok(priceTarget(2, 1, 0.5) === 4);
  // Few shops and buyers who cannot go without ask most; a guild asks as one; goods from abroad hold it down.
  assert.ok(lerner(1, 0.5, 0, 0) > lerner(50, 0.5, 0, 0));
  assert.ok(lerner(50, 1, 1, 0) > lerner(50, 1, 0, 0));
  assert.ok(lerner(2, 1, 0, 0.9) < lerner(2, 1, 0, 0));
});

test("money: barter, coin of the densest metal held, notes, the lenders' claims", () => {
  const can = {
    currency: true,
    writing: false,
    banking: false,
    clerks: false,
    houses: 0,
    metal: G.copper,
  };
  assert.equal(moneyForm({ ...can, currency: false }), "barter");
  assert.equal(moneyForm(can), "metal");
  assert.equal(moneyForm({ ...can, metal: -1 }), "barter");
  assert.equal(moneyForm({ ...can, writing: true, banking: true, clerks: true }), "paper");
  assert.equal(
    moneyForm({ ...can, writing: true, banking: true, clerks: true, houses: 1 }),
    "credit",
  );
  const held = GOODS.map(() => 0);
  held[G.copper] = 10;
  held[G.iron] = 10;
  held[G.grain] = 1000;
  assert.equal(moneyGood(prices, held), G.copper);
  held[G.tin] = 1;
  assert.equal(moneyGood(prices, held), G.tin);
  assert.equal(
    moneyGood(
      prices,
      GOODS.map(() => 0),
    ),
    -1,
  );
});

test("the price level: a coin's metal under coin, money turned over against what is made under notes", () => {
  const coin = priceLevel("metal", { fine: 1, metalWorth: 8, stock: 0, velocity: 2, made: 1 }),
    debased = priceLevel("metal", { fine: 0.5, metalWorth: 8, stock: 0, velocity: 2, made: 1 });
  assert.equal(debased, 2 * coin);
  const paper = priceLevel("paper", {
    fine: 1,
    metalWorth: 1,
    stock: 1000,
    velocity: 2,
    made: 1000,
  });
  assert.equal(paper, 2);
  assert.equal(priceLevel("barter", { fine: 1, metalWorth: 1, stock: 9, velocity: 9, made: 1 }), 1);
  assert.ok(velocityOf(0.1, 1) > velocityOf(0.01, 0));
});

test("taxes fall where they can be measured and those who bear them cannot refuse", () => {
  const early = measurable({
      writing: false,
      reckoning: false,
      clerks: false,
      currency: false,
      banking: false,
      capacity: 0.3,
    }),
    late = measurable({
      writing: true,
      reckoning: true,
      clerks: true,
      currency: true,
      banking: true,
      capacity: 0.9,
    });
  assert.equal(early.income, 0);
  assert.ok(late.income > 0.5 && late.land > early.land && late.heads > early.heads);
  // Held by few: the few refuse a harvest's tax and an income's; the many cannot refuse a head's.
  const few = taxResisted({ farmers: 0.1, traders: 0.1, few: 0.7, many: 0.1 }, 0.1, 0.6);
  assert.ok(few.land > few.heads && few.income > few.heads);
  const base = { land: 1000, trade: 1000, heads: 1000, income: 1000 },
    laid = taxRates(100, base, late, few, 0);
  assert.ok(laid.rate.heads > laid.rate.income);
  assert.ok(laid.take.trade + laid.take.heads + laid.take.income <= 100 + 1e-6);
  assert.equal(laid.rate.land, 0);
  // What none will bear is left short.
  const none = taxRates(1e9, base, late, few, 0);
  assert.ok(none.short > 0);
});

test("tariffs: undersold crafters for, traders and buyers against; sanctions where fear outweighs the trade", () => {
  const sides = {
    crafters: 0.4,
    undersold: 0.5,
    traders: 0.05,
    crossing: 0.1,
    buyers: 0.3,
    short: 0,
    weight: 0,
  };
  const protect = tariffWanted(sides),
    free = tariffWanted({ ...sides, crafters: 0.05, traders: 0.5, crossing: 0.6 });
  assert.ok(protect.rate > 0.1 && free.rate === 0);
  assert.equal(sanctionWanted(0.2, 0, 0, 0), 0);
  assert.ok(sanctionWanted(0.9, 0.05, 0.1, 0) > sanctionWanted(0.9, 0.5, 0.5, 0.2));
});

test("smuggling grows with the wedge and shrinks with the odds of being caught", () => {
  const lax = { force: 0.2, capacity: 0.3, corruption: 0.5 },
    hard = { force: 0.9, capacity: 0.9, corruption: 0 };
  assert.equal(smuggled(0, lax, 1), 0);
  assert.ok(smuggled(0.4, lax, 2) > smuggled(0.4, hard, 2));
  assert.ok(smuggled(0.4, lax, 2) > smuggled(0.1, lax, 2));
  assert.ok(smuggled(1, lax, 4) <= 0.8);
});

test("pooled risk: where records allow, worth the more the greater the loss", () => {
  assert.equal(canUnderwrite(false, true, true, 1e6), 0);
  assert.ok(canUnderwrite(true, true, true, 1e5) > canUnderwrite(true, true, true, 100));
  assert.ok(shipLoss(6.5, 0) > shipLoss(6.5, 3));
  assert.ok(insuredGain(0.05) > insuredGain(0.005));
  assert.equal(canPool(true, true, 0.3, 1), 0);
  assert.ok(canPool(true, true, 0.3, 8) > canPool(true, true, 0.05, 8));
});

test("rent and the Lorenz curve", () => {
  assert.equal(rentOf(100, 10, 12), 0);
  assert.equal(rentOf(100, 5, 12), 40);
  const alike = lorenz([{ people: 100, each: 10 }]);
  assert.ok(alike.gini < 1e-9);
  assert.ok(alike.fifths.every((f) => Math.abs(f - 0.2) < 1e-9));
  const few = lorenz([
    { people: 99, each: 1 },
    { people: 1, each: 99 },
  ]);
  assert.ok(few.gini > 0.45 && few.top > 0.5);
  assert.ok(Math.abs(few.fifths.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  // Empty: alike.
  assert.equal(lorenz([]).gini, 0);
});

test("guilds and unions: many together, lettered, let meet, and paid for it", () => {
  const o = { workers: 400, perShop: 5, letters: 1, force: 0.3, voice: 0.5, gain: 0.3 };
  assert.ok(organised(o) > organised({ ...o, workers: 20 }));
  assert.ok(organised(o) > organised({ ...o, force: 0.95, voice: 0 }));
  assert.equal(organised({ ...o, gain: 0 }), 0);
});

test("bondage: scarce hands, arms that hold and a law that allows bind; plenty, weakness or the law free", () => {
  const scarce = { wage: 60, living: 15, open: 0.2, power: 0.6, law: 1 };
  const bound = bindPull(scarce).share;
  assert.ok(bound > 0.2 && bound <= BIND_MOST);
  assert.ok(bindPull({ ...scarce, wage: 16 }).share < bound / 5);
  assert.ok(bindPull({ ...scarce, power: 0.05 }).share < bound / 2);
  assert.ok(bindPull({ ...scarce, open: 2 }).share < bound);
  assert.equal(bindPull({ ...scarce, law: 0 }).share, 0);
});

test("notes whose prices have run past a thousand for a grain's worth are called in, a thousand old for one new; coin never", () => {
  assert.equal(notesRenewed("paper", 999), 1);
  assert.equal(notesRenewed("paper", MONEY.renew), 1);
  assert.equal(notesRenewed("paper", 1001), MONEY.renew);
  assert.equal(notesRenewed("credit", 5e8), MONEY.renew);
  assert.equal(notesRenewed("metal", 5e8), 1);
  assert.equal(notesRenewed("barter", 5e8), 1);
  // (The same money in a new unit: what a stock of it buys is as it was.)
  const level = 4200,
    stock = 9e9,
    old = notesRenewed("paper", level);
  assert.equal(stock / old / (level / old), stock / level);
});
