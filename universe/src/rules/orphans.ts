// Orphans and who takes them in (the last breadth gaps, 2026-11-24). A year in which many of a land's grown die (a battle's
// fallen, a sickness, a strike, a famine) leaves young with no one to rear them. How many is the people's own way of rearing:
// - those who rear each young as a pair for life (carers 2) lose both to make an orphan, and one to break a hearth;
// - those who pair for a season or hold several mates (rules/self.ts pairingOf) rear with one carer and part of another;
// - a hive rears all its brood in common, and those who spawn and leave rear none: neither has orphans, whoever dies.
// Of a land's young, the share left with no carer is the grown's share dead to the power of the carers; the share whose hearth
// lost one but not all is the rest of those touched, and half of them (ORPHANS.half) cannot be kept by the one left. Those are
// the young needing a hearth. Who takes them in is the rule a land's roofless are already taken in by (rules/roof.ts takenIn:
// kin as far as kin keep their own, then its faith's alms, then the realm's care, and the street for the rest); those taken in
// by kin and houses double up their hearths. Pure functions.
import { dmath } from "../kernel/index.ts";
import type { Pairing } from "./self.ts";
import { PAIRED } from "./demography.ts";

export const ORPHANS = {
  /** Of the young whose hearth lost one carer of several, the share the one left cannot keep. */
  half: 0.5,
  /** A year's dead, as a share of a land's people, past which its orphans are reckoned (twice and more an ordinary year's). */
  dying: 0.06,
  /** The least share of a land's people left needing a hearth that is told, and the years before it is told again. */
  told: 0.004,
  again: 10,
} as const;

/** How many rear each young, by how a people pairs (0: no one does, or all do in common: no orphans). */
export function carersOf(pairing: Pairing): number {
  return pairing === "brood" || pairing === "none" ? 0 : 1 + PAIRED[pairing];
}

/**
 * Of a land's young, the share left needing a hearth after a year in which `dead` of its grown (0 … 1) died, among a people who
 * pair as `pairing`; and of those, the share with no carer at all.
 */
export function orphanedOf(dead: number, pairing: Pairing): { needing: number; alone: number } {
  const carers = carersOf(pairing),
    d = dmath.clamp(dead, 0, 1);
  if (!(carers > 0) || !(d > 0)) return { needing: 0, alone: 0 };
  const alone = dmath.pow(d, carers),
    touched = 1 - dmath.pow(1 - d, carers);
  return { needing: alone + ORPHANS.half * Math.max(0, touched - alone), alone };
}
