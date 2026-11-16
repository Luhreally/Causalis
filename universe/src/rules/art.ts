// What a people makes for its own sake (the culture sweep, 2026-11-16; audit "Art", where nothing a people made beyond its needs was
// kept or read by history, and songs and stones were the page's alone). A land makes works as far as it has hands to spare from
// its food and those who keep them: its makers, as far as the fields spare them, a share of their year; those who rule it, who
// keep makers to show what they are; the clergy of its faith, who keep them for their god. What a work is is what its makers
// sense the world by (a seeing people carves and paints, a hearing one sings, a people of scent makes scents, one that sounds
// its way builds halls that answer, one that feels the current weaves it) and what they work most (clay, cloth, hide, metal,
// machines; else what the land gives). Works are kept and wear away: a fiftieth a year is lost, broken or forgotten. A land's
// works, against its people, are its renown; a land long renowned keeps to its canon (its custom held the firmer), and where its
// faith keeps the makers, the holier; works raised at a realm's seat show its rule to its people. Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import type { Sense } from "./bodies.ts";

export const ART = {
  /** Of a maker's year, the share given to works where all its land's workers are spared from the food (est: a fiftieth). */
  hands: 0.02,
  /**
   * Work-years of works a year that each of those who rule keeps makers for, and each of a faith's clergy (est: a court spends
   * a tenth of what keeps it on makers, a temple a twentieth).
   */
  court: 0.1,
  clergy: 0.05,
  /** The share of works worn, broken or forgotten a year (half lost in some 35 years). */
  wear: 0.02,
  /**
   * Work-years of works to a thousand of its people at which a land's renown is half of what it can be: a land that gives a
   * hundredth of its year to works keeps some 500, made steadily, against what wears.
   */
  half: 400,
  /** A land's ways drawn by its renown at its fullest: custom kept (a canon), and, where its faith keeps its makers, piety. */
  canon: 0.05,
  holy: 0.03,
  /** A realm's standing from the renown of its seat at its fullest, as far as those who rule keep the makers. */
  glory: 0.05,
} as const;

/** What each sense makes of a people's works. */
export const SENSE_ARTS: Readonly<Record<Sense, string>> = {
  sight: "carving and painting",
  hearing: "song and music",
  smell: "scent-making",
  echo: "halls that answer",
  electric: "woven currents",
};

/** What a land's makers work in, by what they make most of (a good's id), in words. */
export const ART_STUFF: Readonly<Record<string, string>> = {
  pottery: "fired clay",
  clothing: "woven cloth",
  wool: "woven cloth",
  hides: "worked hide",
  copper: "cast metal",
  tin: "cast metal",
  iron: "wrought metal",
  tools: "worked metal",
  machines: "made machines",
};

/** Work-years of works a land makes a year: its makers' spare share, those who rule, its faith's clergy there. */
export function worksMade(makers: number, spare: number, rulers: number, clergy: number): number {
  return (
    ART.hands * Math.max(0, makers) * dmath.clamp(spare, 0, 1) +
    ART.court * Math.max(0, rulers) +
    ART.clergy * Math.max(0, clergy)
  );
}

/** A land's works `years` on: what wore away of what it had, and what it made. */
export function worksAfter(had: number, made: number, years: number): number {
  const keep = dmath.pow(1 - ART.wear, Math.max(0, years)),
    // (Made through the years, each year's wearing from when it was made: the sum of a falling series.)
    laid = years > 0 ? (made * (1 - keep)) / ART.wear : 0;
  return Math.max(0, had * keep + laid);
}

/** A land's renown (0 … 1): its works against its people. */
export function renownOf(works: number, people: number): number {
  if (people <= 0 || works <= 0) return 0;
  const per = works / (people / 1000);
  return per / (per + ART.half);
}

/** What a land's renown draws of its ways (rules/ways.ts order: tradition, piety by index from the caller). */
export function artLeans(renown: number, holy: number): { tradition: number; piety: number } {
  const r = dmath.clamp(renown, 0, 1);
  return { tradition: ART.canon * r, piety: ART.holy * r * dmath.clamp(holy, 0, 1) };
}

/** What a seat's renown gives its realm's standing, as far as its rulers keep the makers (`court`, 0 … 1 of its works). */
export function artStanding(renown: number, court: number): number {
  return ART.glory * dmath.clamp(renown, 0, 1) * dmath.clamp(court, 0, 1);
}

/** A land's renown in words. */
export function renownWords(renown: number): string {
  return renown < 0.05
    ? "little kept beyond what is needed"
    : renown < 0.25
      ? "a few works, known nearby"
      : renown < 0.5
        ? "works known across their realm"
        : renown < 0.75
          ? "works known far beyond it"
          : "works the world comes to see";
}
