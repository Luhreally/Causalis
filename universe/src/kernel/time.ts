// Time (docs/architecture §7). SimTime is an integer count of game seconds since
// the simulated era began; 2^53 seconds is about 285 million years. Prehistory is
// generated, not ticked, and is counted in whole years of DeepTime.
//
// Cadences use standard units (a standard day of 86,400 s, a standard year of 365
// standard days). Each world keeps its own day and year for its seasons and its
// calendar; those are derived from its orbit and rotation, not from these.

declare const simTimeBrand: unique symbol;
export type SimTime = number & { readonly [simTimeBrand]: true };

export const SECOND = 1;
export const MINUTE = 60;
export const HOUR = 3_600;
export const DAY = 86_400;
export const WEEK = 7 * DAY;
export const YEAR = 365 * DAY;
/** A standard month: a twelfth of a standard year (2,628,000 s). */
export const MONTH = YEAR / 12;

export const TIME_ZERO = 0 as SimTime;

export function simTime(seconds: number): SimTime {
  if (!Number.isSafeInteger(seconds) || seconds < 0)
    throw new Error(`SimTime must be a non-negative safe integer, got ${seconds}`);
  return seconds as SimTime;
}

export function addTime(t: SimTime, seconds: number): SimTime {
  return simTime(t + seconds);
}

/** The index of the period containing t (the k-th day, the k-th year…). */
export function periodIndex(t: SimTime, period: number): number {
  return Math.floor(t / period);
}

/** Whole standard years since the era began. */
export function yearOf(t: SimTime): number {
  return Math.floor(t / YEAR);
}

/** Integer years before the simulated era (prehistory). */
export type DeepTime = number;
