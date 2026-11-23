// What a land's households want of its wares, by what they earn and what the wares cost (p87; the rule is rules/trade.ts
// demandFactor, withinMeans). Read in the economy's year as a land's wares wear out (sim/economy makeAndUse): what rules/goods.ts
// WANTS sets is what its bodies and work need (it is what clothing and tools cover against); what is bought of it is that need bent
// by what they earn, in years of their food (so in food's units, never a price a wage is paid in), and by the ware's price against its
// worth, then held within what the land made past its food and what its households can borrow. The year's income-driven buying, at each ware's
// worth, is kept for the cycle (sim/trade cycleYear): a fall in it is a fall in what is spent on others' work.
import { dmath } from "../../kernel/index.ts";
import {
  DEMAND,
  ELASTICITY,
  FOODS,
  G,
  GOODS,
  GOOD_USE,
  OCC,
  OCCUPATIONS,
  demandFactor,
  kindsIn,
  takings,
  varietyIndex,
  withinMeans,
} from "../../rules/index.ts";
import type { Province } from "../population/model.ts";
import { marketsOf, mouths, type PopulationContext } from "../population/systems.ts";
import type { Market } from "../economy/market.ts";
import { loreOf } from "../lore/lore.ts";
import { GOODS_STORE, moneyStore } from "../money/kept.ts";
import { DEMAND_STORE, DM, tradeStore } from "./kept.ts";

/**
 * What passes a land's shops and stalls in a year, by its last books (grain's worth; rules/underworld.ts takings): what a
 * protector's cut and a licence's rent are of. Only reads.
 */
export function takingsOf(p: Province, m: Market): number {
  const n = p.total();
  if (!(n > 0)) return 0;
  let food = 0,
    other = 0,
    sentOn = 0;
  for (let g = 0; g < GOODS.length; g++) {
    const worth = m.price[g]!;
    if (FOODS.includes(g)) food += m.book("used", g) * worth;
    else other += m.book("used", g) * worth;
    sentOn += m.book("out", g) * worth;
  }
  return takings({
    food,
    other,
    sentOn,
    growers:
      (p.occupation(OCC.farmer) + p.occupation(OCC.forager) + p.occupation(OCC.herder)) /
      Math.max(1, n - p.occupation(OCC.dependent)),
  });
}

/** The wares whose buying answers to income and price (machines follow the engines that want them, sim/economy/energy.ts). */
export const BOUGHT_WARES = [G.tools, G.clothing, G.pottery] as const;

/** What a land's households buy of each ware this year, against its need, and the reading kept. */
export type Bought = {
  /** By good: the factor on its need (1 where it does not answer). */
  readonly factor: readonly number[];
};

/**
 * What a land's households buy of its wares against what they need (`needs`: good and need, this year), kept in trade.demand. Pure in
 * the world's numbers: last year's wages and this year's prices.
 */
export function boughtOf(
  ctx: PopulationContext,
  p: Province,
  m: Market,
  needs: readonly (readonly [number, number])[],
): Bought {
  const { world } = ctx,
    factor = new Array<number>(GOODS.length).fill(1),
    store = tradeStore(world, DEMAND_STORE);
  if (!store) return { factor };
  const worths = moneyStore(world, GOODS_STORE)?.get(p.cell),
    worthOf = (g: number) =>
      worths && worths[g]! > 0 ? worths[g]! / 1000 : Math.max(1e-6, GOODS[g]!.value),
    staple = m.price[G.grain]! > 0 ? m.price[G.grain]! : m.price[G.wild]!,
    foodPrice = Math.max(1e-6, staple),
    food = 12 * mouths(p, ctx.life);
  // (What its households earn is what the land made last year, at its prices, the rent its holders take with the wages: its
  // first year, its wages alone.)
  let earned = 0;
  const last = m.years.at(-1)?.ledger[0];
  if (last) for (let g = 0; g < GOODS.length; g++) earned += (last[g] ?? 0) * m.price[g]!;
  else for (let o = 0; o < OCCUPATIONS.length; o++) earned += m.wage[o]! * p.occupation(o);
  // (In food's units: what they earn bought at food's price, against their food.)
  const real = earned / foodPrice,
    income = food > 0 ? real / food : DEMAND.ref,
    asked = new Array<number>(GOODS.length).fill(0),
    byIncome = new Array<number>(GOODS.length).fill(0);
  let spend = 0;
  // (The kinds of each ware it has to hand, its own and those brought it: its price index falls as they are more, rules/variety.ts.
  // Exactly the ware's own price where it has one kind or none.)
  const had = marketsOf(world).kindsHad(m);
  for (const [g, need] of needs) {
    if (!(BOUGHT_WARES as readonly number[]).includes(g) || need <= 0) continue;
    const use = GOOD_USE[GOODS[g]!.id]!,
      f = demandFactor(
        use,
        income,
        (m.price[g]! / worthOf(g)) * varietyIndex(kindsIn(had, g)),
        ELASTICITY[use],
      );
    factor[g] = f;
    asked[g] = need * f;
    byIncome[g] = need * demandFactor(use, income, 1, 0);
    spend += (asked[g]! * m.price[g]!) / foodPrice;
  }
  // (Within what they earn past their food, and a quarter year's earnings more where lending is known.)
  const credit = loreOf(world).get(p.cell, "banking") ? DEMAND.credit * real : 0,
    scale = withinMeans(spend, real, food, credit);
  let realBought = 0,
    base = 0;
  for (const [g, need] of needs) {
    if (!(BOUGHT_WARES as readonly number[]).includes(g) || need <= 0) continue;
    factor[g] = factor[g]! * scale;
    realBought += byIncome[g]! * Math.min(1, scale) * worthOf(g);
    base += need * worthOf(g);
  }
  store.set(p.cell, [
    dmath.clamp(income, 0, 1000) * 1000,
    factor[G.tools]! * 1000,
    factor[G.clothing]! * 1000,
    factor[G.pottery]! * 1000,
    scale * 1000,
    realBought,
    base,
  ]);
  return { factor };
}

/** Food is never wanted below its bodies' need; above it, a little more as a land earns more (reprice's want). */
export function foodWanted(ctx: PopulationContext, p: Province): number {
  const row = tradeStore(ctx.world, DEMAND_STORE)?.get(p.cell),
    income = row ? row[DM.income]! / 1000 : DEMAND.ref;
  return (mouths(p, ctx.life) * 12 * demandFactor("feeds", income, 1, 0)) / FOODS.length;
}
