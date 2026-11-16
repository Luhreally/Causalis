// The farming year, and what a people must have put by to reach its reaping. A year's grain comes
// in at the reaping; what a people gathers, hunts and herds comes in the year through. So at the
// turn of a year a land needs in store what its people will eat until the reaping begins, less
// what the year gives them before it: the more of their food is reaped, the more they must hold.
// A people has the children it can see fed to the reaping (rules: a household reckons by its
// granary, not by today's bread): its fertility by the share of that store it holds, squared as
// its hunger is.

import { dmath } from "../kernel/index.ts";

/** The share of a world's year gone (0 … 1) when its fields are ripe and reaped. */
export const HARVEST: readonly [number, number] = [0.6, 0.78];
/** When they are sown. */
export const SOWING: readonly [number, number] = [0.18, 0.34];

/** Less than this in store, in months of eating, a town is lean: a fortnight. */
export const LEAN_MONTHS = 0.5;

/**
 * The months of eating a land must hold at the turn of a year to see its reaping in without its granaries going
 * lean: the months until the reaping is done (what is cut first is eaten first, and the last of it is not in the
 * granary until the end), by the share of its food that is reaped (`reaped`, 0 … 1: what is gathered, hunted and
 * herded comes in month by month), and the fortnight under which it is lean.
 */
export function storeNeeded(reaped: number): number {
  return 12 * HARVEST[1] * Math.max(0, Math.min(1, reaped)) + LEAN_MONTHS;
}

/**
 * What a people keeps of its fertility by what it has put by (1: all it needs to reach the
 * reaping, or more): the share held of the store needed, raised to THRIFT. Smooth from nothing
 * in store to the whole of it.
 */
export function thrift(months: number, reaped: number): number {
  const share = Math.max(0, Math.min(1, months / storeNeeded(reaped)));
  return dmath.pow(share, THRIFT);
}

/** How sharply a people's births answer to its store (2: as they answer to hunger, by fed squared). */
export const THRIFT = 2;
