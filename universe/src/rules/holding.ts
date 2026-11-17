// What a realm's law holds to (the society sweep, asked 2026-11-16: "law as written rules, property rights and contracts"). Before it,
// a realm's law was four positions its groups argued over, and nothing said whether what a man held was safe from his ruler, or a deal
// could be held to. A rule says what a thing does; a realm's numbers say how much.
//   Written (lawWritten): a law is written where its people know law-codes and write (est: Hammurabi's, a thousand years after the
//     first writing), and goes as far as the realm's clerks and roads carry it and its people can read it; with writing and no code,
//     the court's decrees are kept, a little.
//   Seizure (seizureRisk): a ruler takes what his people hold as far as he rules by force and they have no voice, his officers can be
//     bought, nothing written stops him, and his treasury goes short (Olson's bandit; North and Weingast's credible commitment).
//   Security (holdingSecure): what is held is safe as far as the ruler does not take it and its courts reach it.
//   Deals kept (contractsKept): a deal is held to by courts as far as they reach, the law is written and their judges cannot be bought;
//     where there are none, among kin and those who know each other (Greif's traders), as far as a people trusts and holds to its own.
//   Tenure (TENURE): of what a tiller puts into his land, what he keeps: the least on his lord's land, the most on his own.
//   Improvements (improveTarget, improvedStep): what holders put into their land (hedges, terraces, cleared stones, orchards) as far
//     as it is safe and theirs, built up over decades and worn as the years go; a field yields the more for it.
//   Trade (dealsMoved): goods pass between two lands as their deals can be held to.
// Pure functions.
import { dmath } from "../kernel/index.ts";

const clamp01 = (x: number): number => dmath.clamp(x, 0, 1);

/** How far each of a realm's justice laws (sim/order/laws.ts: custom and vengeance, the ruler's courts, one law for all) judges a dispute. */
export const COURTS: readonly [number, number, number] = [0.3, 0.6, 0.9];
/** Of what a tiller puts into his land, the share he keeps, by its land law (the lord's, leased, the tiller's own). */
export const TENURE: readonly [number, number, number] = [0.35, 0.65, 1];

export const IMPROVE = {
  /** The most a land's fields yield more for what its holders put into them (est: a tenth to a fifth: titled land, Besley). */
  most: 0.15,
  /** The share of the way to what is worth putting in that a year builds; the share of it a year wears. */
  pace: 0.04,
  wear: 0.015,
  /** A year of war in a land wears this much more of it. */
  war: 0.05,
} as const;

/** Trade between two lands falls by at most this share where no deal between them can be held to. */
export const DEALS = 0.25;

/** How far a realm's law is written (0 … 1). */
export function lawWritten(
  codes: boolean,
  writing: boolean,
  capacity: number,
  readers: number,
): number {
  if (codes) return clamp01((0.4 + 0.6 * clamp01(capacity)) * (0.6 + 0.4 * clamp01(readers)));
  return writing ? 0.25 * clamp01(capacity) : 0;
}

/** What weighs on whether a ruler takes what his people hold. */
export type SeizureSides = {
  readonly force: number;
  readonly voice: number;
  readonly corruption: number;
  readonly written: number;
  /** What its treasury goes short, as a share of what it takes in. */
  readonly short: number;
};

/** How likely a realm's ruler is to take what its people hold (0 … 1), and its parts. */
export function seizureRisk(s: SeizureSides): { risk: number; parts: [string, number][] } {
  const ruled = clamp01(s.force) * (1 - clamp01(s.voice)),
    parts: [string, number][] = [
      ["ruled by force, its people unheard", 0.6 * ruled],
      ["its officers bought", 0.2 * clamp01(s.corruption)],
      ["its law written, which binds the ruler too", -0.3 * ruled * clamp01(s.written)],
      ["its treasury short", 0.3 * clamp01(s.short)],
    ];
  return { risk: clamp01(parts.reduce((a, [, v]) => a + v, 0)), parts };
}

/** How safe what is held is (0 … 1): not taken by the ruler, and judged where it is disputed. */
export function holdingSecure(risk: number, courts: number, capacity: number): number {
  return (1 - clamp01(risk)) * (0.4 + 0.6 * clamp01(courts) * clamp01(capacity));
}

/** How far a deal is held to (0 … 1): by courts, or among kin and those who know each other. */
export function contractsKept(
  courts: number,
  written: number,
  corruption: number,
  capacity: number,
  trust: number,
  kinship: number,
): { kept: number; byCourts: number; byKin: number } {
  const byCourts =
      clamp01(courts) *
      (0.3 + 0.7 * clamp01(written)) *
      (1 - clamp01(corruption)) *
      (0.5 + 0.5 * clamp01(capacity)),
    byKin = 0.25 * clamp01(trust) + 0.15 * clamp01(kinship);
  return { kept: Math.max(byCourts, byKin), byCourts, byKin };
}

/** What is worth putting into a land's fields (a share of their yield), as far as it is safe and its tiller keeps it. */
export function improveTarget(secure: number, tenure: number): number {
  return IMPROVE.most * clamp01(secure) * clamp01(tenure);
}

/**
 * What a land's improvements come to `years` on (`warYears` of them fought over): built toward what is worth it at IMPROVE.pace of
 * the gap a year, worn at IMPROVE.wear a year and IMPROVE.war more a year of war. Reckoned as the stock's own course over those
 * years, so five years at once come to what five years one by one would (at their mean wear): it settles where what is built
 * meets what wears, a little under what is worth it.
 */
export function improvedStep(was: number, target: number, years: number, warYears: number): number {
  const span = Math.max(0, years);
  if (span === 0) return dmath.clamp(was, 0, IMPROVE.most);
  const build = -dmath.log(1 - IMPROVE.pace),
    wear =
      -dmath.log(1 - IMPROVE.wear) -
      (dmath.log(1 - IMPROVE.war) * dmath.clamp(warYears, 0, span)) / span,
    k = build + wear,
    settled = (build * Math.max(0, target)) / k,
    next = settled + (was - settled) * dmath.exp(-k * span);
  return dmath.clamp(next, 0, IMPROVE.most);
}

/** The share of their trade two lands keep, by how far each one's deals are held to (1: all of it). */
export function dealsMoved(a: number, b: number): number {
  return 1 - DEALS * (1 - dmath.sqrt(clamp01(a) * clamp01(b)));
}
