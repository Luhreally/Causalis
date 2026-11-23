// A people abroad (asked 2026-11-19; the audit's diaspora): those of one people living in another's land. No one is counted by
// name: a land keeps, for at most a few peoples not its own, the share of its people who are of each (told by the language their
// land of origin speaks) and the land most of them came from. It comes of migration as it already is (sim/population flows): those
// who move into a land that speaks another language are a people abroad there; into one that speaks their own, they are simply
// its people. It goes as generations pass: the young take the speech around them, half in a generation, sooner the more alike
// the two speeches are. Kept only where it matters: a share under ABROAD.least is not kept at all.
// What reads it: trade (kin on both ends of a road carry more down it), who a land counts its own (a land with many strangers in
// it counts its seat's people the less its own), and the street (quarters set apart). Pure numbers and functions.
import { dmath } from "../kernel/index.ts";

export const ABROAD = {
  /** A land keeps so many peoples abroad in it, each at least this share of its people (thousandths). */
  keep: 3,
  least: 25,
  /** All of them together are never counted more than this share (thousandths). */
  most: 900,
  /**
   * Generations (rules/faith.ts CREED.generation, by the people's span) in which a people abroad halves, at speech wholly unlike
   * in a land where no one reads: those who came and their children. Where the land's people read, their young are taught
   * its speech and it is sooner: half as long where all do.
   */
  halves: 1,
  /** Read again, and aged, once in so many years. */
  every: 5,
  /** What kin across a road add to what passes down it, at the most (a land half of whose people are the other end's). */
  trade: 0.3,
  /** Of how far a land counts its seat's people its own, what strangers in it take, at the most. */
  apart: 0.5,
  /** What strangers in a town add to how far its quarters are set apart, at the most (sim/order/underworld.ts). */
  street: 0.5,
  /** A people abroad this share of a town's people (thousandths) is who the gangs of its set-apart quarters are: their gangs
   * ally with their kin's in the realm's other towns (sim/order/underworld.ts federations). */
  quarter: 120,
} as const;

/** What is left of a share `years` on: halved in ABROAD.halves generations, sooner the more alike their speech and the land's (0 … 1). */
export function abroadAfter(
  share: number,
  years: number,
  generation: number,
  like: number,
  readers = 0,
): number {
  const half = Math.max(
    5,
    ABROAD.halves *
      generation *
      (1 - 0.6 * dmath.clamp(like, 0, 1)) *
      (1 - 0.5 * dmath.clamp(readers, 0, 1)),
  );
  return share * dmath.pow(0.5, Math.max(0, years) / half);
}

/** What kin across a road add to its trade (a factor ≥ 1) from the greater of the two ends' shares of the other's people (0 … 1). */
export function kinTrade(share: number): number {
  return share > 0 ? 1 + ABROAD.trade * Math.min(1, 2 * share) : 1;
}
