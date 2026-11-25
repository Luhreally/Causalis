// Common measures in trade (the last breadth gaps, 2026-11-24). What a land can measure (rules/letters.ts measuresOf: a
// calendar's days, reckoning, the stars' courses, clocks and what came after) already told how its readers inquire, and its
// calendar how its fields meet a swinging year (rules/tillage.ts). It told nothing of trade, where measuring is what a sale is:
// so much, of such a weight, by such a day. Two who cannot count, weigh and date alike sell by eye and by quarrel, and less
// passes between them.
// - What two lands agree on is what the lesser of them can measure (the whole of it at 1: a calendar and reckoning and the
//   stars' courses together are 0.7).
// - Lands of one realm use one standard; across a border each side checks the other's against its own, and half of it holds
//   (COMMON_MEASURE.apart).
// - What passes between them is the more by COMMON_MEASURE.gain at the most (est: a tenth, what dispute over weight and day
//   takes of a trade made by eye).
// Pure functions.
import { dmath } from "../kernel/index.ts";

export const COMMON_MEASURE = {
  gain: 0.1,
  apart: 0.5,
} as const;

/** How far two lands can count, weigh and date alike (0 … 1): by what each can measure, and whether a border lies between. */
export function measuresAgreed(a: number, b: number, apart: boolean): number {
  return dmath.clamp(Math.min(a, b), 0, 1) * (apart ? COMMON_MEASURE.apart : 1);
}

/** How much more passes between two lands for what they agree on (1: nothing measured). */
export function tradeMeasured(agreed: number): number {
  return 1 + COMMON_MEASURE.gain * dmath.clamp(agreed, 0, 1);
}
