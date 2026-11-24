// Thrift and the worth of waiting (breadth round, 2026-11-23): what a people asks to wait for what it is owed, what it puts by,
// and what one realm's money fetches in another's.
//   Time preference (Fisher, Yaari): a saver who may not live to be repaid discounts the future by the chance of dying in a year,
//     its body's own (rules/species.ts life table, over a working life), and the more when its land went hungry this year: one
//     who may starve before the harvest wants grain now. Nothing else is written down for it.
//   Interest (Fisher): a house of lending asks what its savers ask to wait, and what its loans' losses have cost it, as its own
//     books tell them; before it has books, it fears losing a loan as often as a borrower dies.
//   Saving: of a land's grain past its year's food, the share its people put by with a house is the share of them whose own
//     impatience is under what the house pays: impatience spread evenly about the land's (from nothing to twice it).
//   Exchange (Cassel's purchasing-power parity): one realm's money fetches in another's what a grain's worth costs in each; a
//     trader holding a money across a journey bears what it moves against the other in the year, and asks it of the margin.
// Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import type { LifeHistory } from "./species.ts";

/** The years of a saver's working life its hazard is read over, from adulthood. */
export const SAVER_YEARS = 30;

/** A saver's chance of dying in a year: its body's mortality at plenty over a working life from adulthood, band by band. */
export function adultHazard(life: LifeHistory): number {
  const from = life.adulthood,
    to = from + SAVER_YEARS;
  let sum = 0,
    years = 0;
  for (let b = 0; b < life.bands.length; b++) {
    const lo = life.bands[b]!,
      hi = b + 1 < life.bands.length ? life.bands[b + 1]! : lo + life.oldest,
      a = Math.max(lo, from),
      z = Math.min(hi, to);
    if (z <= a) continue;
    sum += (z - a) * life.mortality[b]!;
    years += z - a;
  }
  return years > 0 ? sum / years : life.mortality.at(-1)!;
}

/**
 * A land's time preference (a year's discount, 0 … 1): its savers' hazard, the higher as the leanest month of its year was short
 * of food (`fed`, 0 … 1: one fed half doubles it). Never under a thousandth, never over a half.
 */
export function timePreference(hazard: number, fed: number): number {
  return dmath.clamp(hazard / dmath.clamp(fed, 0.25, 1), 0.001, 0.5);
}

/**
 * What a house's own loans have cost it, as a year's share lost (0 … 0.9): its losses against what it has lent, counted as loans,
 * with one loss in every 1 / `hazard` lent before its books hold any (a lender fears losing a loan as often as a borrower dies).
 */
export function lossShare(lost: number, loans: number, hazard: number): number {
  const prior = 1 / Math.max(1e-3, hazard);
  return dmath.clamp((lost + 1) / (loans + prior), 0, 0.9);
}

/** The rate a house lends at (Fisher): what waiting is worth to its savers, made good for what a loan's loss costs. */
export function loanRate(preference: number, loss: number): number {
  return (1 + preference) / (1 - dmath.clamp(loss, 0, 0.9)) - 1;
}

/** The share of a land's spare grain its people put by with a house paying `rate`: those whose impatience is under it. */
export function savedShare(rate: number, preference: number): number {
  return dmath.clamp(rate / (2 * Math.max(1e-6, preference)), 0, 1);
}
/** How far toward what they would put by a land's savers go in a year (est: savers come and go over a few years). */
export const SAVING_PACE = 0.2;

/**
 * What a unit of realm `a`'s money fetches of realm `b`'s (purchasing-power parity): `b`'s price of a grain's worth against
 * `a`'s. A realm without money reckons in grain (its level 1).
 */
export function exchangeRate(levelA: number, levelB: number): number {
  return Math.max(1e-9, levelB) / Math.max(1e-9, levelA);
}

/**
 * What changing money costs a trader across a border, as a share of the margin's goods (0 … EXCHANGE_MOST): how far the two
 * moneys moved against each other in the year (the log of the rate's change, from each realm's rise in prices), borne over a
 * journey's share of a year. Nothing where either side reckons in goods, or both moved alike.
 */
export function exchangeRisk(riseA: number, riseB: number, bothMoney: boolean): number {
  if (!bothMoney) return 0;
  return exchangeRiskOf(moneyDrift(riseA), moneyDrift(riseB));
}
/** How far a money moved in a year, as exchangeRisk weighs it (log1p of its rise). */
export function moneyDrift(rise: number): number {
  return dmath.log1p(dmath.clamp(rise, -0.9, 9));
}
/** exchangeRisk from the two moneys' drifts (moneyDrift), both reckoned in money. */
export function exchangeRiskOf(driftA: number, driftB: number): number {
  return Math.min(EXCHANGE_MOST, Math.abs(driftA - driftB) * JOURNEY_YEARS);
}
/** A trade's journey, from buying to selling, as a share of a year (est: a season on the road or at sea). */
export const JOURNEY_YEARS = 0.25;
/** The most of a margin a money's moving takes. */
export const EXCHANGE_MOST = 0.5;
