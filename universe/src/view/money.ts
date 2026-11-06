// A town's money as its lens shows it (Lives L6): each home the colour of what it can spend, on the town's own spread, deep violet the least and gold
// the most, a pale top on what is let where some are and some are not; what the legend says of it.
import type { HomeMoney } from "../bridge/index.ts";

type Rgb = readonly [number, number, number];

/** The steps of the ramp: dark to bright, so it reads without a word and in any eye. */
export const MONEY_RAMP: readonly Rgb[] = [
  [0.16, 0.07, 0.36],
  [0.38, 0.09, 0.47],
  [0.62, 0.14, 0.42],
  [0.84, 0.26, 0.26],
  [0.96, 0.47, 0.12],
  [1, 0.72, 0.12],
  [1, 0.94, 0.48],
];
/** A ruin's plate; the pale top of a home that is let. */
export const MONEY_RUIN: Rgb = [0.3, 0.3, 0.32],
  MONEY_LET: Rgb = [0.96, 0.97, 1];
/** The least spread a town's ramp is laid over: where its homes are nearly alike, they stay nearly one colour. */
export const MONEY_LEAST_SPREAD = 6;

/** Which step of the ramp so much coin falls on, on a town's own spread. */
export function moneyStep(coin: number, lo: number, hi: number): number {
  const k = hi > lo ? Math.log(coin / lo) / Math.log(hi / lo) : 0.5;
  return Math.max(0, Math.min(MONEY_RAMP.length - 1, Math.floor(k * MONEY_RAMP.length)));
}

/** Who holds them, as the legend says it (null: nothing to say). */
export function tenureWords(tenure: HomeMoney["tenure"]): string | null {
  switch (tenure) {
    case "lord":
      return "All pay rent: land here is the lord's.";
    case "leased":
      return "All pay rent: land here is leased.";
    case "owned":
      return "All own their homes: land here is the tiller's.";
    case "mixed":
      return "Pale tops pay rent, let by the floor; the rest own their homes.";
    case "halls":
      return "They keep no houses: no one owns, no one rents.";
    case "untold":
      return "Who holds what is not told here.";
    default:
      return null;
  }
}
