// Kinds of want (the sweep, Nature lane): a people fed enough may still go without. What it eats is made of what its land gives
// (rules/goods.ts FOODS: the flesh and milk of its flocks and its catch, what it gathers and hunts, and its grain), and each gives
// its own share of what a body builds itself from: protein, as much of its food's energy and as well matched to the body's own as
// it is (grain's is short of what flesh's has: its lysine), and the vitamins and metals a body cannot make (fresh, varied wild food
// gives the most, flesh its iron and zinc, grain least, its iron bound by its phytate). A people living on its grain alone is fed
// and short: its children die the more and grow the less (the first farmers stood some few centimetres shorter than the gatherers
// before them, and buried more of their young). Pure tables; sim/population/diet.ts reads a land's year of eating.
import { G } from "./goods.ts";
import type { Diet } from "./bodies.ts";

/** What each food gives (per unit of its energy): protein as a share of its energy, how well matched (0 … 1), and its vitamins and metals (est). */
export const FOOD_GIVES: Readonly<
  Record<number, { readonly protein: number; readonly matched: number; readonly micro: number }>
> = {
  [G.grain]: { protein: 0.12, matched: 0.45, micro: 0.45 },
  [G.meat]: { protein: 0.35, matched: 0.95, micro: 1.0 },
  [G.wild]: { protein: 0.15, matched: 0.7, micro: 1.3 },
};

/** What a body wants: matched protein as a share of its food's energy, and vitamins and metals (est: WHO's some 8 to 10% of energy as protein, a growing child's the more). */
export const BODY_WANTS = { protein: 0.07, micro: 0.8 } as const;

/** How much likelier the young are to die (under ten), and the grown, at a diet wholly short (est). */
export const WANT_DEATHS = { young: 1.2, grown: 0.2 } as const;
/** How much less a people grows at a diet wholly short (a share of its height, est). */
export const STUNTING = 0.08;

/**
 * Fields sown with beans and clover in turn (a rotation) grow their seed beside the grain, its protein the grain's own lacks,
 * and the gardens beside the fields their greens (est).
 */
export const LEGUMES = { matched: 0.7, micro: 0.65 } as const;

/**
 * What a body of a diet makes of each food (a flesh-eater's gut makes little of grain; a plant-eater's eats no flesh), its
 * fields' grain sown in a rotation with beans or not.
 */
export function foodGivesFor(diet: Diet | undefined, good: number, legumes = false) {
  const f = good === G.grain && legumes ? { ...FOOD_GIVES[good]!, ...LEGUMES } : FOOD_GIVES[good]!;
  if (diet === "flesh" && good === G.grain)
    return { protein: f.protein, matched: 0.2, micro: 0.15 };
  if (diet === "plants" && good === G.meat) return FOOD_GIVES[G.wild]!;
  return f;
}

export type DietReading = {
  /** What it ate of each (shares of all it ate). */
  readonly shares: Readonly<Record<number, number>>;
  /** Matched protein, and vitamins and metals, against what its body wants (1: enough). */
  readonly protein: number;
  readonly micro: number;
  /** How short it goes, 0 … 1: of either, the two together. */
  readonly short: number;
};

/** A year's eating read: so much of each food eaten (any units), a body of a diet, its grain sown with beans or not. */
export function dietOf(
  eaten: Readonly<Record<number, number>>,
  diet?: Diet,
  legumes = false,
): DietReading {
  let all = 0;
  for (const g of Object.keys(FOOD_GIVES)) all += Math.max(0, eaten[Number(g)] ?? 0);
  const shares: Record<number, number> = {};
  if (all <= 0) return { shares, protein: 1, micro: 1, short: 0 };
  let protein = 0,
    micro = 0;
  for (const k of Object.keys(FOOD_GIVES)) {
    const g = Number(k),
      s = Math.max(0, eaten[g] ?? 0) / all,
      f = foodGivesFor(diet, g, legumes);
    shares[g] = s;
    protein += s * f.protein * f.matched;
    micro += s * f.micro;
  }
  const p = Math.min(1.5, protein / BODY_WANTS.protein),
    m = Math.min(1.5, micro / BODY_WANTS.micro),
    short = 1 - Math.min(1, p) * Math.min(1, m);
  return { shares, protein: p, micro: m, short };
}

/** How much likelier death is for a land's young (under ten) and its grown, at a shortfall. */
export function wantDeaths(short: number): { young: number; grown: number } {
  const s = Math.max(0, Math.min(1, short));
  return { young: 1 + WANT_DEATHS.young * s, grown: 1 + WANT_DEATHS.grown * s };
}
