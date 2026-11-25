// Civil defence (the last breadth gaps, 2026-11-24): a realm whose towns are struck from the air gives their people cover and
// sends those it can out of reach, as far as the lives that would spare are worth the work. Nothing says which age shelters:
// it is weighed from the threat the realm has itself met.
// - What it has met: of the people of its towns that were struck, the share the strikes killed (as they would have with no
//   cover), remembered while the danger is fresh (DEFENCE.fade).
// - What cover is worth: for each person under the strikes, the working years a death takes (the working share of his kind's
//   span still ahead of him) times the share cover spares, over the years the danger is still present; against the work of
//   giving one person cover (DEFENCE.work, working years).
// - How much is built: nothing while the lives are worth less than the work; past that, the more the more they outweigh it
//   (1 - 1 / worth), and only as far as the seat's will is done in its lands (its capacity): a seat that cannot reach its
//   towns cannot have them dig.
// - What it does: of those a strike would have killed, DEFENCE.spares of those under cover live. Its treasury pays the work.
//   Under the greatest fire, on a town or carried between worlds, and under a burned sky, cover spares half as many
//   (DEFENCE.sparesGreat): those sent out of reach live, those under cover in the ground it flattens do not. Nothing spares
//   anyone on a world unmade.
// Pure functions. (What is said: who, at what cost, with what effect; never how a strike is made.)
import { dmath } from "../kernel/index.ts";

export const DEFENCE = {
  /** The work of giving one townsman cover and a way out, in working years (est: a tenth, the trench and cellar works of Earth's air wars). */
  work: 0.1,
  /** Of those under cover or sent away whom a strike would have killed, the share who live (est: two in three). */
  spares: 0.67,
  /** The same under the greatest fire or a burned sky (est: half of it, those sent away). */
  sparesGreat: 0.33,
  /** Years for what its strikes cost to be half as present to it. */
  fade: 8,
  /** Of a kind's span, the working years ahead of one of its people taken at the mean (est: three tenths). */
  ahead: 0.3,
  /** The least rise of its cover told as a new work (a share of its struck towns' people). */
  told: 0.1,
} as const;

/** Fade a remembered sum by `years`. */
export const defenceFade = (x: number, years: number): number =>
  years > 0 ? x * dmath.pow(0.5, years / DEFENCE.fade) : x;

/**
 * What cover is worth to a realm (over 1: worth its work), and its parts: `deadShare` of its struck towns' people killed by
 * the strikes it has met, for a people whose span is `span` years; `lives` and `work` are in working years a head.
 */
export function defenceWorth(
  deadShare: number,
  span: number,
): { worth: number; lives: number; work: number } {
  const present = DEFENCE.fade / Math.LN2,
    lives =
      dmath.clamp(deadShare, 0, 1) * DEFENCE.spares * DEFENCE.ahead * Math.max(1, span) * present;
  return { worth: lives / DEFENCE.work, lives, work: DEFENCE.work };
}

/** The share of its struck towns' people a realm gives cover (0 … 1), by what cover is worth and how far its seat's will is done. */
export function coverBuilt(worth: number, capacity: number): number {
  return worth > 1 ? dmath.clamp(capacity, 0, 1) * (1 - 1 / worth) : 0;
}

/** Of `dead` a strike would kill, those who die where `cover` of its people (0 … 1) are under cover; `great`: the greatest fire's, or a burned sky's. */
export function deadUnderCover(dead: number, cover: number, great = false): number {
  return Math.round(
    dead * (1 - dmath.clamp(cover, 0, 1) * (great ? DEFENCE.sparesGreat : DEFENCE.spares)),
  );
}
