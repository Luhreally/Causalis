// A creed's taboo (the breadth round, 2026-11-23): a faith comes to forbid its believers a herd, its flesh and its touch, where a
// sickness that came of that herd killed among them and those of them who lived the less off the herd fared the better, by more
// than the herd gives them. Nothing is written about which beast is unclean: what a faith forbids is what its own dead taught.
// - Whether keeping off it helped: over the herds' sicknesses that came to its believers' lands, whether the share killed rose
//   with the herd's share of a land's food (the slope, weighed by the people struck). A herd's sickness takes the more of a land
//   the more it lives off the herd, as far as the sickness still lives in herds (rules/spillover.ts; sim/health/strains.ts range):
//   herdContact, about 1 where a land lives off it as most do; but who was spared before, who was hungry, who had drains all
//   weigh too, so a faith may see it or not.
// - What keeping off it would have spared them, as a share of all its believers: the dead of a herd's sickness that rose among
//   them (kept off their herds, it would not have crossed), and of the rest the dead the slope puts on living off the herd.
//   Remembered as a lifetime remembers (TABOO.fade).
// - What it costs them: the herd's share of their food.
// - Weighed: the lives, as hard as rules/lessons.ts weighs a cost (a fortieth of a people dead presses as hard as can be), against
//   the food, half of it at the most. (How devout they are weighs both alike: a ban kept by half spares half and costs half.)
//   Past TABOO.line the creed forbids the herd; once it does, its believers keep off it as far as they are devout: they forgo
//   the herd's yield and are spared its sicknesses' crossing, its coming back, and the more it takes of those who live off it.
//   Long after the dying is forgotten, where the herd's yield weighs past the line the other way, the creed lets it go.
// Pure functions.
import { dmath } from "../kernel/index.ts";

export const TABOO = {
  /** Years for what a herd's sickness cost a faith to be half forgotten (a lifetime's telling: rules/lessons.ts LESSON.fade). */
  fade: 40,
  /**
   * How much more a herd's sickness takes among a people the more they live off its herd (its share of their food), as far as
   * it still lives in herds; against a land that lives off it as much as most (`usual`), so that the world's toll stays as it was.
   */
  contact: 3,
  usual: 0.1,
  /** The share of believers dead that presses as hard as can be (rules/lessons.ts LESSON.presses). */
  presses: 0.025,
  /** The share of their food lost that weighs as hard as can be (the hands go to other work: half their food). */
  food: 0.5,
  /** How far the lives must outweigh the food before the creed forbids the herd (and the food the lives to let it go). */
  line: 0.3,
  /** The fewest outbreaks among its believers it reads a slope from. */
  fewest: 3,
} as const;

/**
 * How much more a herd's sickness takes in a land (≈1 where it lives off the herd as most do): the more the more of its food the
 * herd is (`herdFood`, 0 … 1), as far as the sickness still lives in herds (`range`, 0 … 1).
 */
export function herdContact(range: number, herdFood: number): number {
  const r = TABOO.contact * dmath.clamp(range, 0, 1);
  return (1 + r * dmath.clamp(herdFood, 0, 1)) / (1 + r * TABOO.usual);
}

/**
 * A faith's memory of what herd sicknesses did among its believers: people-weighted sums of the herd's share of their food x and
 * dead share y, the outbreaks, and the dead of those that rose in its own lands, faded together.
 */
export type HerdToll = {
  w: number;
  x: number;
  y: number;
  xy: number;
  xx: number;
  n: number;
  own: number;
};

export const freshToll = (): HerdToll => ({ w: 0, x: 0, y: 0, xy: 0, xx: 0, n: 0, own: 0 });

/**
 * Add an outbreak: `people` struck in a land the herd gives `herds` of its food (0 … 1), of whom `dead` (a share) died; `own`
 * where the sickness rose in one of the faith's own lands.
 */
export function addToll(
  t: HerdToll,
  people: number,
  herds: number,
  dead: number,
  own = false,
): void {
  t.w += people;
  t.x += people * herds;
  t.y += people * dead;
  t.xy += people * herds * dead;
  t.xx += people * herds * herds;
  t.n += 1;
  if (own) t.own += people * dead;
}

/** Fade what is remembered by `years`. */
export function fadeToll(t: HerdToll, years: number): void {
  if (years <= 0) return;
  const k = dmath.pow(0.5, years / TABOO.fade);
  t.w *= k;
  t.x *= k;
  t.y *= k;
  t.xy *= k;
  t.xx *= k;
  t.n *= k;
  t.own *= k;
}

/** Whether those of its believers who lived the less off the herd died the less of its sicknesses: the slope (0 where not seen). */
export function herdSlope(t: HerdToll): number {
  if (t.n < TABOO.fewest || t.w <= 0) return 0;
  const spread = t.w * t.xx - t.x * t.x;
  if (!(spread > 1e-9 * t.w * t.w)) return 0;
  return Math.max(0, (t.w * t.xy - t.x * t.y) / spread);
}

/**
 * The deaths keeping off the herd would have spared, as a share of all `believers` (0 … 1): where those who lived the less off it
 * fared the better, the dead of the herd's sicknesses that rose among them, and of the rest those the slope puts on the herd.
 * Nothing where keeping off it was not seen to help (`taught`: the creed already forbids it).
 */
export function herdDeaths(t: HerdToll, believers: number, taught = false): number {
  const slope = herdSlope(t);
  // (Once the creed forbids the herd, those who keep off it are spared by the ban itself, and the slope among them no longer
  // shows: the dead it was taught by are remembered, fading, all the same.)
  if (!(slope > 0 || taught) || believers <= 0) return 0;
  const rest = Math.max(0, Math.min(t.y - t.own, slope * t.x));
  return dmath.clamp((t.own + rest) / believers, 0, 1);
}

/** What keeping off the herd is worth to a faith (above TABOO.line: forbid it; below -TABOO.line: let it go), and its parts. */
export function tabooWorth(
  deaths: number,
  foodShare: number,
): { worth: number; lives: number; food: number } {
  const lives = dmath.clamp(deaths / TABOO.presses, 0, 1),
    food = dmath.clamp(foodShare / TABOO.food, 0, 1);
  return { worth: lives - food, lives, food };
}
