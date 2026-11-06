// What holds a far world to a realm (Phase 72, first slice; galaxy-plan.md, Star nations). Nothing here says what an empire is or
// when one forms: a realm holds what it can answer in time. A word and a fleet take years to cross; a rising no fleet can answer
// before those who rose have grown children has already won. What it cannot make itself and gets from those who hold it ties a
// world down; what it needs from no one, it owes no one for. Pure.
import { dmath } from "../kernel/index.ts";
import type { FillReading } from "./filling.ts";

/** Tens, by the engines' own bit-identical log. */
const log10 = (x: number): number => dmath.log2(x) / dmath.log2(10);

/** The generations of its own people a realm has to answer a rising in (est.): by then those who rose have raised those who never knew it. */
export const HOLD_GENERATIONS = 2;
/** The years a people's own lives give a realm to answer in. */
export const holdYears = (adulthood: number): number => Math.max(10, adulthood * HOLD_GENERATIONS);

/** Those a world must have before all the trades of a chain to machines can stand on it (est.). */
export const WORKS_PEOPLE = 5_000_000;
/** How much of a world's pull away is there whatever is done: word is always late (est.). */
const LATE_WORD = 0.35;
/** How much being held against its will weighs, at first; how many years of holding wear it down by about two thirds (est., over a people's generations). */
const FORCE = 0.5;
const FORCE_FADES = 4;
/** What seeing its holder's fleet lost weighs, for one span of answering (est.). */
const LOST_FLEET = 0.6;
/** What being ten times the people of those who hold it weighs (est.). */
const OUTGROWN = 0.25;
/** What needing them for what it cannot make takes off (est.). */
const NEEDS_THEM = 0.5;
/** What no fleet to send adds; how far past its answering a pull can run (est.). */
const NO_FLEET = 1;
const FAR_MOST = 3;

/** How long a word and a fleet take to reach a world, given how far by light and the fleet's own crossing. */
export function answerYears(
  ly: number,
  fleet: number,
): { readonly word: number; readonly fleet: number; readonly answer: number } {
  const word = Math.min(ly, fleet);
  return { word, fleet, answer: word + fleet };
}

export type StrainInputs = {
  /** The years a word and a fleet take there (Infinity: none can come). */
  readonly answer: number;
  /** The years its holder's people give it to answer in. */
  readonly hold: number;
  /** Whether its holder has a fleet to send now. */
  readonly fleet: boolean;
  /** Years since it was taken by force (null: it was not). */
  readonly forcedAgo: number | null;
  /** Years since its holder lost a fleet (null: it has not). */
  readonly lostAgo: number | null;
  /** Its people, and those of whoever holds it. */
  readonly people: number;
  readonly seatPeople: number;
  /** Whether it cannot make what it needs, and gets it from them. */
  readonly owes: boolean;
};

export type Strain = {
  readonly far: number;
  readonly force: number;
  readonly lost: number;
  readonly size: number;
  readonly tie: number;
  readonly total: number;
};

/** What is pulling a world away from those who hold it, each part in numbers; over 1, it may go. */
export function strainOf(i: StrainInputs): Strain {
  const far = Math.min(
      FAR_MOST,
      i.answer === Infinity ? FAR_MOST : Math.max(0, i.answer / Math.max(1, i.hold) - 1),
    ),
    noFleet = i.fleet ? 0 : NO_FLEET,
    force =
      i.forcedAgo === null
        ? 0
        : FORCE * dmath.exp(-i.forcedAgo / Math.max(1, FORCE_FADES * i.hold)),
    lost = i.lostAgo === null ? 0 : LOST_FLEET * Math.max(0, 1 - i.lostAgo / Math.max(1, i.hold)),
    size = OUTGROWN * Math.max(0, log10(Math.max(1, i.people) / Math.max(1, i.seatPeople))),
    tie = i.owes ? NEEDS_THEM : 0,
    farPart = Math.min(FAR_MOST, far + noFleet);
  return {
    far: farPart,
    force,
    lost,
    size,
    tie,
    total: LATE_WORD + farPart + force + lost + size - tie,
  };
}

/** The chance, each time a world is read (every few years), that it goes its own way. */
export const breakChance = (total: number): number => Math.min(0.5, 0.25 * Math.max(0, total - 1));

/** Whether a world's people need what they must make to live there at all: roofs, air, heat. */
export const needsMaking = (r: FillReading): boolean => !r.open;

/** Whether a world can make all it needs, on its own: ground with metal in it, and hands enough for the chain. */
export const makesItsOwn = (people: number, poor: boolean): boolean =>
  !poor && people >= WORKS_PEOPLE;

/** Whether a world cannot stand alone. */
export const owesOf = (r: FillReading, people: number, poor: boolean): boolean =>
  needsMaking(r) && !makesItsOwn(people, poor);

/** The years it takes roofs no one can mend to fail, by about two thirds; those who are left, past all failing, in old halls (est.). */
export const DARK_YEARS = 80;
export const DARK_FLOOR = 0.12;

/** Those a world cut off from what it cannot make can still keep alive, so many years on. */
export const darkLimit = (before: number, years: number): number =>
  before * (DARK_FLOOR + (1 - DARK_FLOOR) * dmath.exp(-Math.max(0, years) / DARK_YEARS));

/** How a world's own defence stands, when a fleet comes: its numbers count as a log, as a host's do. */
export const worldDefence = (people: number): number => 1 + log10(1 + Math.max(0, people) / 500);

/** The most worlds a realm has held at which it is a thing to be told: many, and the first to reach this (est.). */
export const MANY_WORLDS = 5;
export const GREAT_WORLDS = 10;
