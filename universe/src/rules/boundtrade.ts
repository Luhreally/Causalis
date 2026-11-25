// A trade in bound people between realms (the last breadth gaps, 2026-11-24). Bondage was made where a land was taken or a
// debt could not be paid, and the bound stayed where they were bound. Here they are also sold: from where a bound hand's work
// keeps his holder little to where it keeps him much.
// - What a bound hand is worth to a holder is what the binding rule already reckons (rules/labour.ts, Domar: what his work
//   makes over his living, as far as the realm's arms hold him against the open land he could flee to): much where hands are
//   scarce and held, nothing where they are many.
// - His price is what that work keeps over the working years he has left (the working share of his kind's span), less his
//   keep and guard (BOUND_TRADE.keep); told in years of a worker's living.
// - A sale is made where the buyer's worth is more than the seller's (and than his keep) by more than the road costs
//   (BOUND_TRADE.road), between lands whose trade already joins them, of two realms whose laws both allow bondage and do not
//   make strangers citizens; none between realms at war. As many are sold as the gap is wide: of the seller land's bound,
//   BOUND_TRADE.share at a gap as wide as a hand's keep.
// Pure functions. (What is said: who sold whom to whom, at what price, and what it did to both lands. Never how.)
import { dmath } from "../kernel/index.ts";

export const BOUND_TRADE = {
  /** A realm's holders look to buy once in so many years, in its turn. */
  every: 5,
  /** What a bound hand kept and guarded costs of what he makes (est; sim/order CAPTIVE_PAYS). */
  keep: 0.15,
  /** What carrying and guarding him on the way costs, of a year's work (est). */
  road: 0.05,
  /** Of the seller land's bound, the share sold at a gap as wide as a hand's keep; the fewest and the most in one sale. */
  share: 0.1,
  least: 20,
  most: 2000,
  /** Of a kind's span, the working years ahead of one sold at the mean (est: three tenths, as rules/civildefence.ts). */
  ahead: 0.3,
} as const;

/** What a bound hand fetches where his work keeps `worth` of a year's living over his own (years of a worker's living). */
export function boundPrice(worth: number, span: number): number {
  return Math.max(0, worth - BOUND_TRADE.keep) * BOUND_TRADE.ahead * Math.max(1, span);
}

/**
 * A sale weighed: `gap`, what a hand gains his holder there over here past the road (0 and under: no sale), and how many of
 * the seller land's `bound` are sold.
 */
export function boundSale(
  worthHere: number,
  worthThere: number,
  bound: number,
): { gap: number; count: number } {
  const gap = worthThere - Math.max(worthHere, BOUND_TRADE.keep) - BOUND_TRADE.road;
  if (!(gap > 0) || !(bound > 0)) return { gap, count: 0 };
  const count = Math.min(
    BOUND_TRADE.most,
    Math.floor(bound * BOUND_TRADE.share * dmath.clamp(gap / BOUND_TRADE.keep, 0, 1)),
  );
  return { gap, count: count >= BOUND_TRADE.least ? count : 0 };
}
