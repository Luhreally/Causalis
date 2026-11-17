// Kinds of want (the sweep, Nature lane): a people fed enough may still go without. What it eats is made of what its land gives
// (rules/goods.ts FOODS: the flesh and milk of its flocks and its catch, what it gathers and hunts, and its grain), and each gives
// its own share of what a body builds itself from: protein, as much of its food's energy and as well matched to the body's own as
// it is (grain's is short of what flesh's has: its lysine), and the vitamins and metals a body cannot make (fresh, varied wild food
// gives the most, flesh its iron and zinc, grain least, its iron bound by its phytate). A people living on its grain alone is fed
// and short: its children die the more and grow the less (the first farmers stood some few centimetres shorter than the gatherers
// before them, and buried more of their young). Pure tables; sim/population/diet.ts reads a land's year of eating.
import { dmath } from "../kernel/index.ts";
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
 * A sea people's sown beds are of weed and shell, not grass: the shell's flesh and the weed's iodine and metals beside it (est:
 * half and half by energy).
 */
export const BEDS_GIVE = { protein: 0.25, matched: 0.85, micro: 1.15 } as const;

/**
 * A plant-eater's gut is made for its plants: what lives in it ferments their fibre and builds what their seed lacks of a body's
 * own (lysine), and frees the metals bound in it, as a grazer's does (est).
 */
export const PLANT_GUT = { matched: 0.75, micro: 0.8 } as const;

/**
 * What a body of a diet makes of each food (a flesh-eater's gut makes little of grain; a plant-eater's eats no flesh, and makes
 * the most of its grain), its fields' grain sown in a rotation with beans or not, or a sea people's beds (weed and shell).
 */
export function foodGivesFor(diet: Diet | undefined, good: number, legumes = false, beds = false) {
  if (beds && good === G.grain) return BEDS_GIVE;
  const f = good === G.grain && legumes ? { ...FOOD_GIVES[good]!, ...LEGUMES } : FOOD_GIVES[good]!;
  if (diet === "flesh" && good === G.grain)
    return { protein: f.protein, matched: 0.2, micro: 0.15 };
  if (diet === "plants" && good === G.meat) return FOOD_GIVES[G.wild]!;
  if (diet === "plants" && good === G.grain)
    return {
      protein: f.protein,
      matched: Math.max(f.matched, PLANT_GUT.matched),
      micro: Math.max(f.micro, PLANT_GUT.micro),
    };
  return f;
}

// —— The light lived ——————————————————————————————————————————————————————————————————————————————

/**
 * A body makes some of what it cannot eat enough of in its skin, from its star's hardest light, where its noon sun stands high
 * enough; what it makes in the high-sun months carries it through the low ones. A people's body was made for the light of the
 * land it arose on (its cradle: a body risen under a dim star makes do with less), so a land is read against its cradle: far
 * toward the poles from it, or under a sky of smoke, it must eat what it cannot make (flesh, fish, liver), or its young grow
 * crooked and weak (rickets: the far north's grain-eaters and the smoky cities of the first engines). (est throughout.)
 */
export const SUN_MADE = {
  /** The noon sun must stand this high (degrees) for the skin to make it (est: a shadow shorter than the body). */
  high: 45,
  /** The share of a year of such sun that carries a body through the rest (est: some five months). */
  need: 0.4,
  /** What a share of flesh and catch in its food gives of it, and of wild food (est: a third of its food as fish covers it). */
  flesh: 3,
  wild: 0.3,
  /** How much its lack harms against the rest of what a body wants (est: half). */
  weight: 0.5,
  /** The most of its hard light a sky of smoke keeps off (est). */
  smoke: 0.8,
} as const;

/** The share of a year its noon sun stands high enough at a latitude (degrees) on a world of a tilt (degrees). */
export function highSunShare(lat: number, tilt: number): number {
  // (Noon height 90 − |φ − δ|, its sun's height δ = ε sin θ through the year: high enough while δ lies within (90 − high) of φ.)
  const band = 90 - SUN_MADE.high,
    lo = lat - band,
    hi = lat + band,
    e = Math.abs(tilt);
  if (e < 1e-6) return Math.abs(lat) <= band ? 1 : 0;
  const below = (x: number) =>
    x <= -e ? 0 : x >= e ? 1 : 0.5 + dmath.asin(Math.max(-1, Math.min(1, x / e))) / Math.PI;
  return Math.max(0, below(hi) - below(lo));
}

/** What a land's sun makes of what its people want of it (0 … 1), against their cradle's, under its smoke (0 … 1). */
export function sunMade(lat: number, cradleLat: number, tilt: number, smoke: number): number {
  // (A body risen where the high sun is short wants only what it had there.)
  const wants = Math.min(SUN_MADE.need, highSunShare(cradleLat, tilt));
  if (wants <= 1e-6) return 1;
  return (
    Math.min(1, highSunShare(lat, tilt) / wants) *
    (1 - SUN_MADE.smoke * Math.max(0, Math.min(1, smoke)))
  );
}

export type DietReading = {
  /** What it ate of each (shares of all it ate). */
  readonly shares: Readonly<Record<number, number>>;
  /** Matched protein, and vitamins and metals, against what its body wants (1: enough). */
  readonly protein: number;
  readonly micro: number;
  /** What its sun and its food give of what a body makes in its skin (1: enough). */
  readonly sun: number;
  /** How short it goes, 0 … 1: of either, the two together. */
  readonly short: number;
};

/** A year's eating read: so much of each food eaten (any units), a body of a diet, its grain sown with beans or not. */
export function dietOf(
  eaten: Readonly<Record<number, number>>,
  diet?: Diet,
  legumes = false,
  /** What its sun makes (sunMade; 1: all a body wants of it). */
  sun = 1,
  /** Whether its grain is a sea people's beds of weed and shell. */
  beds = false,
): DietReading {
  let all = 0;
  for (const g of Object.keys(FOOD_GIVES)) all += Math.max(0, eaten[Number(g)] ?? 0);
  const shares: Record<number, number> = {};
  if (all <= 0) return { shares, protein: 1, micro: 1, sun: 1, short: 0 };
  let protein = 0,
    micro = 0;
  for (const k of Object.keys(FOOD_GIVES)) {
    const g = Number(k),
      s = Math.max(0, eaten[g] ?? 0) / all,
      f = foodGivesFor(diet, g, legumes, beds);
    shares[g] = s;
    protein += s * f.protein * f.matched;
    micro += s * f.micro;
  }
  const p = Math.min(1.5, protein / BODY_WANTS.protein),
    m = Math.min(1.5, micro / BODY_WANTS.micro),
    d = Math.min(
      1,
      Math.max(0, sun) +
        SUN_MADE.flesh * (shares[G.meat] ?? 0) +
        SUN_MADE.wild * (shares[G.wild] ?? 0),
    ),
    short = 1 - Math.min(1, p) * Math.min(1, m) * (1 - SUN_MADE.weight * (1 - d));
  return { shares, protein: p, micro: m, sun: d, short };
}

/** How much likelier death is for a land's young (under ten) and its grown, at a shortfall. */
export function wantDeaths(short: number): { young: number; grown: number } {
  const s = Math.max(0, Math.min(1, short));
  return { young: 1 + WANT_DEATHS.young * s, grown: 1 + WANT_DEATHS.grown * s };
}

/**
 * The eating a people's life table was reckoned at (rules/species.ts: every table is an upright ape's of the farming ages, its
 * young dying as farmers' young died): mostly its grain, with some wild food and some flesh and milk (est: a farming household
 * before the engines; shares of its food's energy).
 */
export const TABLE_DIET: Readonly<Record<number, number>> = {
  [G.grain]: 0.7,
  [G.wild]: 0.15,
  [G.meat]: 0.15,
};

/** How short a body of a diet goes on the eating its life table was reckoned at (dietOf over TABLE_DIET; a sea people's beds). */
export function tableShort(diet?: Diet, beds = false): number {
  return dietOf(TABLE_DIET, diet, false, 1, beds).short;
}

/**
 * How much likelier death is for a land's young and grown at a shortfall, against the deaths its life table already holds: those
 * of a people fed as the table's were (tableShort). The table's own deaths are not counted twice; a land fed better than the
 * table's people is reckoned at the table (its deaths were never measured below it).
 */
export function wantDeathsOver(short: number, table: number): { young: number; grown: number } {
  const a = wantDeaths(short),
    b = wantDeaths(table);
  return { young: Math.max(1, a.young / b.young), grown: Math.max(1, a.grown / b.grown) };
}
