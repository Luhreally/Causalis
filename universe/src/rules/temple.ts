// A faith's houses: who keeps it, what they are given and what they do with it (the culture sweep, 2026-11-16; audit "Religious
// institutions", where "the temple" was a share of a realm's sway read off how devout its people were, and a building). A faith
// held for a while raises those who keep it: the devout give of their harvest, as far as they are devout and as long as their
// land has held it, never from the food a land needs to come through the year. What is given keeps its clergy (as many as it
// feeds) and its houses at once, and the rest is laid up in its granaries, losing to rot what grain stored loses. From them:
//   relief: a land of its faith gone hungry is given from the granaries, as far as they hold, wherever it lies;
//   teaching: as many clergy as there are to the faithful, so far they teach the young they reach, the more the more their faith
//     holds its teaching written, and where they teach every child they can, a land counts it as a school (rules/letters.ts);
//   sway: a devout people's piety weighs in its realm as far as its faith has clergy to speak for it: half of it with none, all
//     of it with a keeper to every village (sim/polity/interests.ts swayOf).
// Pure tables and functions.
import { dmath } from "../kernel/index.ts";

export const TEMPLE = {
  /** Of a land's grain made, the share its most devout give (est: a tithe, a tenth). */
  give: 0.1,
  /** Piety at or below which nothing is given. */
  least: 0.3,
  /** Of what is given, the share that keeps the clergy and its houses at once (their rites, their walls); the rest is laid up. */
  kept: 0.6,
  /** Of what is given, the share that feeds its clergy (est: some one in fifty of a devout people, as Earth's middle ages kept). */
  clergy: 0.25,
  /** Of a granary, the share lost a year (est: grain kept in a store loses a tenth a year to damp, rot and vermin). */
  spoil: 0.1,
  /** Months of a hungry land's food its faith gives at most from its granaries in a year. */
  reliefMonths: 3,
  /** Clergy to each of the faithful at which they teach every young one they reach (est: a priest to a parish of 250). */
  teachAt: 0.004,
  /** Of teaching's reach, the part whatever a faith holds of its teaching, and the part its teaching written adds. */
  spoken: 0.3,
  /** A land of its faith whose clergy teach at least this share counts their school as one (rules/letters.ts schooled). */
  school: 0.5,
  /**
   * The share of a devout people's weight a faith carries in a realm (sim/polity/interests.ts swayOf) with no clergy of its own:
   * piety without houses is many voices, none speaking for it; with a keeper to every village, all of it.
   */
  swayLeast: 0.5,
} as const;

/** The share of its grain made a land of a faith gives it, by its piety and how far it has held the faith (0 … 1). */
export function templeGiving(piety: number, held: number): number {
  return (
    TEMPLE.give *
    dmath.clamp((piety - TEMPLE.least) / (1 - TEMPLE.least), 0, 1) *
    dmath.clamp(held, 0, 1)
  );
}

/** How many clergy a year's givings keep, at a head's food for a year. */
export function clergyKept(given: number, foodAYear: number): number {
  return foodAYear > 0 ? (Math.max(0, given) * TEMPLE.clergy) / foodAYear : 0;
}

/** How far a faith's clergy teach the young of its lands (0 … 1): by clergy to the faithful, and how far its teaching is written. */
export function templeTeaching(clergy: number, faithful: number, scripture: number): number {
  if (faithful <= 0) return 0;
  return (
    dmath.clamp(clergy / faithful / TEMPLE.teachAt, 0, 1) *
    (TEMPLE.spoken + (1 - TEMPLE.spoken) * dmath.clamp(scripture, 0, 1))
  );
}

/** How far a faith's piety weighs in a realm, by its clergy to its faithful (0 … 1 of a clergy that teaches every young one). */
export function templeSway(clergy: number): number {
  return TEMPLE.swayLeast + (1 - TEMPLE.swayLeast) * dmath.clamp(clergy, 0, 1);
}

/** A granary `years` on: what it held less what rots, plus what was laid up and less what was given out, never below nothing. */
export function granaryAfter(held: number, laid: number, given: number, years: number): number {
  const keep = dmath.pow(1 - TEMPLE.spoil, Math.max(0, years));
  return Math.max(0, held * keep + Math.max(0, laid) - Math.max(0, given));
}

/** A faith's houses, in words, by its clergy to the faithful. */
export function templeWords(clergy: number, faithful: number): string {
  const per = faithful > 0 ? clergy / faithful : 0;
  return per <= 0
    ? "no house of its own yet"
    : per < TEMPLE.teachAt / 8
      ? "a few keepers among many faithful"
      : per < TEMPLE.teachAt / 2
        ? "keepers in most of its towns"
        : per < TEMPLE.teachAt
          ? "a house in every town, keepers in most villages"
          : "a keeper to every village and a school with each";
}
