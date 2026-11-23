// Variety within a good (breadth round, 2026-11-23). The market keeps its goods as a few classes (rules/goods.ts GOODS: what a
// thing does for whoever holds it, the class a price is reckoned for); what is inside a class is the ways of making it that a land
// works or is brought: tools of stone, copper, bronze, iron or steel; cloth woven of wool, sewn of hides or spun of a polymer; the
// fuels of a world, each the class it burns as. A way of making is a recipe (RECIPES) or a fuel the world holds, so what a world can
// make, and so which varieties its people see, is what its matter and its known crafts allow, never a list per world.
//   What variety does (Dixit and Stiglitz): a basket of v kinds of a thing, each a little different, serves its users as more of a
//   single kind would; the class's price index falls by v^(1/(1-σ)), σ the substitution between kinds. A land's households buy of a
//   class as its price index says (sim/trade/demand.ts), and its use is worth that much more to them (rules/money.ts useWorth).
// Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import { G, GOODS, RECIPES } from "./goods.ts";

/**
 * How readily one kind of a class stands in for another (the elasticity of substitution between varieties; est: Broda and
 * Weinstein 2006, the median across goods 3-4). The higher, the less a new kind adds.
 */
export const SUBSTITUTION = 4;

/** The ways of making each class, as a mask over RECIPES' places (RECIPES holds under 31). */
export const CLASS_WAYS: readonly number[] = GOODS.map((_, g) =>
  RECIPES.reduce((mask, r, i) => (r.output[0] === g ? mask | (1 << i) : mask), 0),
);

/** How many kinds of a class a mask of ways holds. */
export function kindsIn(mask: number, g: number): number {
  let x = mask & CLASS_WAYS[g]!,
    n = 0;
  while (x) {
    x &= x - 1;
    n++;
  }
  return n;
}

/** What v kinds of a class are worth to its users against one kind (v^(1/(σ-1)); 1 for one kind or none). */
export function varietyGain(kinds: number): number {
  return kinds <= 1 ? 1 : dmath.pow(kinds, 1 / (SUBSTITUTION - 1));
}

/** The class's price index against one kind's price: what its households reckon it costs (v^(1/(1-σ))). */
export function varietyIndex(kinds: number): number {
  return 1 / varietyGain(kinds);
}

/** The kinds a mask holds of a class, by name, in RECIPES' order (a page's one tap down). */
export function kindNames(mask: number, g: number): string[] {
  const out: string[] = [];
  RECIPES.forEach((r, i) => {
    if (r.output[0] === g && mask & (1 << i)) out.push(r.name);
  });
  return out;
}

/**
 * The fuels a world can hold, each in the class it trades as: the solid class (coal's) or the fluid one (oil's). Gas comes with
 * oil from its field; a world's own fuel lies about where its air holds it (sim/economy/energy.ts ownFuel): a haze of
 * hydrocarbons where the air is hydrogen, sulphur by the vents where it is sour.
 */
export const FUEL_KINDS = ["coal", "oil", "gas", "haze", "sulphur"] as const;
export type FuelKind = (typeof FUEL_KINDS)[number];
export const FUEL_CLASS: Readonly<Record<FuelKind, number>> = {
  coal: G.coal,
  oil: G.oil,
  gas: G.oil,
  haze: G.oil,
  sulphur: G.coal,
};
export const FUEL_WORDS: Readonly<Record<FuelKind, string>> = {
  coal: "coal dug from its seam",
  oil: "oil drawn from its field",
  gas: "gas drawn with the oil",
  haze: "the haze its air rains down, gathered",
  sulphur: "sulphur gathered by the vents",
};

/**
 * What a land's stock of a fuel class is, by kind: what it drew of each this year, as shares; where it drew none of the class,
 * all of the class's first kind its world holds (`primary`). What it was brought is reckoned as what it draws itself, or as its
 * world's first: a unit's kind is not carried with it.
 */
export function fuelMix(
  drew: Readonly<Partial<Record<FuelKind, number>>>,
  cls: number,
  primary: FuelKind,
): Partial<Record<FuelKind, number>> {
  let all = 0;
  for (const k of FUEL_KINDS) if (FUEL_CLASS[k] === cls) all += Math.max(0, drew[k] ?? 0);
  if (!(all > 0)) return { [primary]: 1 };
  const out: Partial<Record<FuelKind, number>> = {};
  for (const k of FUEL_KINDS)
    if (FUEL_CLASS[k] === cls && (drew[k] ?? 0) > 0) out[k] = drew[k]! / all;
  return out;
}
