// How fast speech changes (the society sweep, asked 2026-11-16: "language change over time (tongue exists: read it)"). A land's sounds
// shifted a step in thirty years on the mean, whatever its people were. Now a tongue changes as each generation learns it anew from
// the last, imperfectly: the sooner its young are grown, the more generations a century, the faster it moves (an upright ape, grown at
// fifteen, a step in thirty years, as before); and a people that reads holds to a written standard, which slows its change by as much
// as SPEECH_CHANGE.written of it (est: written languages drift at about half the pace of unwritten ones over a millennium). Pure.
import { dmath } from "../kernel/index.ts";

export const SPEECH_CHANGE = {
  /** A step in this many years where the young are grown at `grown` and no one reads. */
  years: 30,
  grown: 15,
  /** How far a written standard slows its change where all read. */
  written: 0.5,
} as const;

/** A land's chance a year that its sounds shift a step. */
export function soundChange(adulthood: number, readers: number): number {
  const generations = SPEECH_CHANGE.grown / Math.max(1, adulthood);
  return (
    (generations / SPEECH_CHANGE.years) * (1 - SPEECH_CHANGE.written * dmath.clamp(readers, 0, 1))
  );
}
