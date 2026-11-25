// Honour and shame (the last breadth gaps, 2026-11-24): a realm's standing among its peers is what they have seen of its
// word. Nothing is added to a tally of virtue: honour is what a peer who must rely on it would reckon from its record.
// - The record: the times it kept its word when keeping it cost (it came when called) and the times it broke it (it stood
//   aside when it could have come; it made war on one it had a pact with), each fading as a generation that saw it dies
//   (HONOUR.fade).
// - What the record is worth: the chance it keeps its word next time, as one who has seen `kept` and `broken` and began
//   knowing nothing would reckon it (Laplace's rule: (kept + 1) / (kept + broken + 2)); honour is that against even odds,
//   -1 … 1, and exactly 0 for a realm of which nothing is known.
// - Where it weighs: wherever a realm decides whether to bind itself to another or to come for it, beside what it thinks of
//   it: its regard is the more or the less by HONOUR.weighs of the other's honour. So one who stood aside finds its own calls
//   unanswered and its pacts unwanted, and one who came is come for.
// - Shame: a realm whose word falls under HONOUR.line (one time in three it is thought to keep it) is spoken of as faithless.
// Pure functions.
import { dmath } from "../kernel/index.ts";

export const HONOUR = {
  /** Years for a deed to be half forgotten among its peers (a generation that saw it). */
  fade: 30,
  /** How much of a whole regard a spotless or a ruined word adds or takes where one must rely on it. */
  weighs: 0.3,
  /** The chance of keeping its word under which a realm is spoken of as faithless, and over which the name is lost again. */
  line: 1 / 3,
  cleared: 0.5,
} as const;

/** A realm's record: times its word was kept and broken, faded to the year `at`. */
export type WordRecord = { kept: number; broken: number; at: number };

/** A record as it stands in `year`. */
export function wordIn(r: Readonly<WordRecord>, year: number): { kept: number; broken: number } {
  const k = year > r.at ? dmath.pow(0.5, (year - r.at) / HONOUR.fade) : 1;
  return { kept: r.kept * k, broken: r.broken * k };
}

/** The chance a realm keeps its word next time, as its peers would reckon it from what they have seen. */
export function wordKept(kept: number, broken: number): number {
  return (Math.max(0, kept) + 1) / (Math.max(0, kept) + Math.max(0, broken) + 2);
}

/** A realm's honour among its peers (-1 … 1; 0: nothing known of it). */
export function honourOf(kept: number, broken: number): number {
  return 2 * wordKept(kept, broken) - 1;
}

/** What its honour adds to (or takes from) another's regard for it where that other must rely on its word. */
export function honourTerm(kept: number, broken: number): number {
  return HONOUR.weighs * honourOf(kept, broken);
}
