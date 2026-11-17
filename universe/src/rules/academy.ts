// Higher learning: those a land keeps at study past their letters, and what they do (the culture sweep, 2026-11-16; audit
// "Education, literacy", where a school and an academy were buildings and inquiry was its readers alone). Study past letters is
// a year's keep given to one who makes nothing with their hands: a land keeps scholars only where it writes, as far as someone
// pays their keep, and only of those who read and whom its fields can spare. Its patrons are whoever has the grain to spare and
// a reason to: the temple, of what its faithful give it (to raise its clergy and keep its teaching), the seat, of what its
// tithe brings in (for clerks and judges), and the great houses seated there, of what they take in (for their own sons and for
// show). A generation brings a land most of the way to what its patrons keep: scholars take years to make and their teachers die.
// Those it has made are its learned: physicians who make what its people know of healing reach them, clerks and judges who make
// its seat's reach the surer, and inquirers who find the deep things the more readily (rules/letters.ts inquiry). Pure.
import { dmath } from "../kernel/index.ts";

export const ACADEMY = {
  /** Of what each patron has to spare a year, the share it gives to keeping scholars (est: a tenth, a twentieth, a tenth). */
  temple: 0.1,
  seat: 0.05,
  houses: 0.1,
  /** Of those who read and are spared from the food, the share who can be kept at study at most (est: one in twenty). */
  most: 0.05,
  /** A land's learned share at which what they do is at its fullest (est: one in a hundred of its people). */
  full: 0.01,
  /** What the learned do at their fullest: inquiry so many times again, healing so much more, a seat's reach so much the surer. */
  inquiry: 0.5,
  healing: 0.5,
  reach: 0.1,
} as const;

/** What a land's patrons give a year to keeping scholars (grain): the temple's, the seat's, the houses' spare, each by its share. */
export function academyFunds(temple: number, seat: number, houses: number): number {
  return (
    ACADEMY.temple * Math.max(0, temple) +
    ACADEMY.seat * Math.max(0, seat) +
    ACADEMY.houses * Math.max(0, houses)
  );
}

/**
 * The share of a land's people it would keep at study (0 … 1): as many as its funds keep at a head's food a year, no more than
 * `most` of those who read and whom the fields spare, and none where it does not write.
 */
export function scholarsTarget(
  script: boolean,
  funds: number,
  foodAYear: number,
  people: number,
  readers: number,
  spare: number,
): number {
  if (!script || people <= 0 || foodAYear <= 0) return 0;
  const kept = Math.max(0, funds) / foodAYear / people,
    can = ACADEMY.most * dmath.clamp(readers, 0, 1) * dmath.clamp(spare, 0, 1);
  return Math.min(kept, can);
}

/** A land's learned `years` on, a generation of theirs bringing it half the way. */
export function learnedAfter(was: number, target: number, years: number, span: number): number {
  const generation = (25 * Math.max(5, span)) / 70;
  return target + (was - target) * dmath.pow(0.5, Math.max(0, years) / generation);
}

/** How fully a land's learned do what they do (0 … 1). */
export const learnedFull = (learned: number): number => dmath.clamp(learned / ACADEMY.full, 0, 1);

/** How much more readily a land inquires for its learned (1: as its readers alone). */
export const learnedInquiry = (learned: number): number =>
  1 + ACADEMY.inquiry * learnedFull(learned);

/** How much further what a land knows of healing reaches its people for its physicians (1: as before). */
export const learnedHealing = (learned: number): number =>
  1 + ACADEMY.healing * learnedFull(learned);

/** A seat's reach, made surer by its learned clerks and judges. */
export const learnedReach = (learned: number): number => ACADEMY.reach * learnedFull(learned);

/** A land's higher learning in words. */
export function academyWords(learned: number): string {
  const f = learnedFull(learned);
  return f <= 0
    ? "none kept at study past their letters"
    : f < 0.25
      ? "a few kept at study by a patron"
      : f < 0.6
        ? "a house of learning"
        : f < 1
          ? "houses of learning, physicians and clerks of their own"
          : "a seat of learning the world's readers know";
}
