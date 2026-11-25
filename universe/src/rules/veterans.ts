// Veterans come home (the last breadth gaps, 2026-11-24): at a war's end those a realm fielded and did not lose go back to
// the lands that sent them. Two things come with them, both by quantities the war itself left:
// - what they learned: a host works by the crafts its seat knows, and a man who served beside those who practise one, as
//   long as a prentice serves (VETERANS.prentice years), has it. Of a land's discharged, that share are skilled; where they
//   are a crew's worth (VETERANS.crew) together, a craft the seat knows and their land could take up but has not goes home
//   with them.
// - what they are owed: a treasury that ended the war short of what it spends has not paid them. Men skilled in arms and
//   unpaid weigh on a land more than their number (VETERANS.weighs): its grievance rises by their share of its workers, as far
//   as they are owed, the longer they served.
// Pure functions.
import { dmath } from "../kernel/index.ts";

export const VETERANS = {
  /** Years beside those who practise a craft that pass it on (est: a short prenticeship). */
  prentice: 3,
  /** As many skilled together as carry a craft home and set it up. */
  crew: 12,
  /** How much more than his number a man skilled in arms and unpaid weighs on his land (est: twice). */
  weighs: 2,
  /** The most a homecoming adds to a land's grievance. */
  most: 0.15,
  /** The least grievance told. */
  told: 0.02,
} as const;

/** Of `discharged` who served `years`, those who come home with a craft. */
export function veteransSkilled(discharged: number, years: number): number {
  return Math.max(0, discharged) * dmath.clamp(years / VETERANS.prentice, 0, 1);
}

/**
 * What a homecoming adds to its lands' grievance (0 … VETERANS.most): `discharged` among `workers`, `owed` the share of their
 * pay its treasury could not meet (0 … 1), after `years` of service.
 */
export function veteransGrievance(
  discharged: number,
  workers: number,
  owed: number,
  years: number,
): number {
  if (!(discharged > 0) || !(workers > 0) || !(owed > 0)) return 0;
  return dmath.clamp(
    VETERANS.weighs *
      (discharged / workers) *
      dmath.clamp(owed, 0, 1) *
      dmath.clamp(years / VETERANS.prentice, 1 / VETERANS.prentice, 1),
    0,
    VETERANS.most,
  );
}
