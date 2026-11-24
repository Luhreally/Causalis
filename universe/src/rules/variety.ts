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
  return kinds <= 1
    ? 1
    : kinds < GAINS.length && Number.isInteger(kinds)
      ? GAINS[kinds]!
      : gainOf(kinds);
}

/** The class's price index against one kind's price: what its households reckon it costs (v^(1/(1-σ))). */
export function varietyIndex(kinds: number): number {
  return 1 / varietyGain(kinds);
}

function gainOf(kinds: number): number {
  return dmath.pow(kinds, 1 / (SUBSTITUTION - 1));
}
/** (A class's gain at each whole number of kinds up to more than any class has ways: read once.) */
const GAINS = Float64Array.from({ length: 33 }, (_, k) => (k <= 1 ? 1 : gainOf(k)));

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
 * hydrocarbons where the air is hydrogen, sulphur by the vents where it is sour. Wood cut past what a land's own hearths take is
 * sold in the solid class (gaps round, 2026-11-24: rules/fuels.ts), as charcoal and firewood were long before any seam was dug.
 */
export const FUEL_KINDS = ["coal", "oil", "gas", "haze", "sulphur", "wood"] as const;
export type FuelKind = (typeof FUEL_KINDS)[number];
export const FUEL_CLASS: Readonly<Record<FuelKind, number>> = {
  coal: G.coal,
  oil: G.oil,
  gas: G.oil,
  haze: G.oil,
  sulphur: G.coal,
  wood: G.coal,
};
export const FUEL_WORDS: Readonly<Record<FuelKind, string>> = {
  coal: "coal dug from its seam",
  oil: "oil drawn from its field",
  gas: "gas drawn with the oil",
  haze: "the haze its air rains down, gathered",
  sulphur: "sulphur gathered by the vents",
  wood: "wood cut from its woods, past what its own hearths take",
};

/** The kinds a fuel class's stock may hold that are not its first (rules above): their shares of it, in millionths, kept by a market. */
export const BLENDED: readonly FuelKind[] = ["gas", "haze", "sulphur", "wood"];
/** A share's whole (millionths). */
export const BLEND_WHOLE = 1_000_000;

/**
 * A class's stock with `n` units of a kind just come into it (`from`: the shares those units came at, as when they were carried
 * from another land; else all of `kind`, or of the class's first kind when null): every share as it now stands. `stock` is the
 * class's stock with them in. A burning or a sale takes of every kind alike, and leaves its shares as they were.
 */
export function blendIn(
  blend: number[],
  cls: number,
  stock: number,
  n: number,
  kind: FuelKind | null,
  from?: readonly number[],
): void {
  if (!(n > 0) || !(stock > 0)) return;
  const kept = Math.max(0, stock - n) / stock;
  for (let i = 0; i < BLENDED.length; i++) {
    const k = BLENDED[i]!;
    if (FUEL_CLASS[k] !== cls) continue;
    const came = from ? from[i]! : k === kind ? BLEND_WHOLE : 0;
    blend[i] = Math.round(blend[i]! * kept + (came * n) / stock);
  }
}

/** A class's stock by kind as shares of one, from a market's blend. */
export function blendMix(
  blend: readonly number[],
  cls: number,
  primary: FuelKind,
): Partial<Record<FuelKind, number>> {
  const out: Partial<Record<FuelKind, number>> = {};
  let rest = 1;
  for (let i = 0; i < BLENDED.length; i++) {
    const k = BLENDED[i]!;
    if (FUEL_CLASS[k] !== cls || !blend[i]) continue;
    out[k] = Math.min(rest, blend[i]! / BLEND_WHOLE);
    rest -= out[k]!;
  }
  out[primary] = Math.max(0, rest);
  return out;
}
