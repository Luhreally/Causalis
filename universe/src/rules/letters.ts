// Reading and writing, and how a land comes to know (asked 2026-11-15: "is every political, physics, econonmy etc thing covered
// down to first principles", where finding was the hands at a trade alone: nothing modelled inquiry, schools were buildings no one
// learned in, and writing a flag). Two readings a land, each a number:
//   who reads: once a land has a script, those whose work wants letters read (the few who rule, half its traders, a tenth of its
//     makers), and of those its fields can spare, as many as are taught: where a school stands, all of them, else a few; the more
//     where word moves freely and where a faith holds its teaching written. A generation brings it most of the way there: the old
//     who read die, and each young one must be taught again.
//   how it finds: a principle that lies shallow in the tree is found by the hands at its trade (sim/lore/lore.ts, as before); the
//     deeper it lies, the more of it is found by inquiry: those who read, the more with the means to measure (a calendar, reckoning,
//     the stars' courses, lenses, clockwork, the current and what reckons with it), the more where word joins them to the readers
//     of the rest of their realm, and as far as their ways look to the new. Each tenfold more readers adds as much again, as each
//     tenfold more hands does.
// Pure tables and functions.
import { dmath } from "../kernel/index.ts";

export const LETTERS = {
  /** Of each kind of worker, the share whose work wants letters once a land has a script. */
  scribes: { leaders: 1, traders: 0.5, crafters: 0.1 } as const,
  /** Of those its fields can spare, the share taught where a school stands, and where none does. */
  schooled: 1,
  unschooled: 0.1,
  /** How far a faith that holds its teaching written (sim/belief) reaches beyond its schools: of those spared, so many more. */
  scripture: 0.3,
  /** A generation of an upright ape, years: how long a land takes to come most of the way to what its teaching reaches. */
  generation: 25,
  /** The most of a land who read. */
  most: 0.98,
} as const;

/** What a land's teaching reaches: the share of its people who come to read, a generation on. */
export function readersTarget(r: {
  /** It has a script. */
  readonly script: boolean;
  /** The share of its people whose work wants letters. */
  readonly scribes: number;
  /** The share of its workers not needed at the food. */
  readonly spare: number;
  /** A school stands in one of its towns. */
  readonly school: boolean;
  /** How freely word moves in its realm (rules/holds.ts word: the middle where it has none). */
  readonly word: number;
  /** How far its faith holds its teaching written (0 … 1). */
  readonly scripture: number;
}): number {
  if (!r.script) return 0;
  const free = 0.6 + 0.8 * dmath.clamp(r.word, 0, 1),
    taught =
      dmath.clamp(r.spare, 0, 1) *
      ((r.school ? LETTERS.schooled : LETTERS.unschooled) * free +
        LETTERS.scripture * dmath.clamp(r.scripture, 0, 1));
  return dmath.clamp(r.scribes + taught, 0, LETTERS.most);
}

/** What a land's readers come to over `years`, from `was` toward `target`: most of the way in a generation of theirs. */
export function readersAfter(was: number, target: number, years: number, span: number): number {
  const generation = (LETTERS.generation * Math.max(5, span)) / 70,
    k = 1 - dmath.pow(0.5, (years * 2) / generation);
  return was + (target - was) * k;
}

/**
 * What measures, and how much: the principles whose knowing lets readers weigh and count what they find (a calendar's days,
 * reckoning, the stars' courses, lenses, clocks, the current and what reckons with it), each world's own road to them alike.
 */
export const MEASURING: ReadonlyMap<string, number> = new Map([
  ["calendar", 0.1],
  ["mathematics", 0.3],
  ["astronomy", 0.3],
  ["glass", 0.15],
  ["diamond-grit", 0.15],
  ["ice-working", 0.1],
  ["current-reading", 0.1],
  ["clockwork", 0.3],
  ["electricity", 0.2],
  ["sea-electricity", 0.2],
  ["graphite-dynamos", 0.2],
  ["ground-dynamos", 0.2],
  ["polymer-wire", 0.2],
  ["electronics", 0.3],
  ["computing", 0.4],
  ["solid-state", 0.2],
  ["networks", 0.2],
]);

/** How much a land can measure, by what it knows (the sum of MEASURING over it). */
export function measuresOf(knows: (id: string) => boolean): number {
  let m = 0;
  for (const [id, v] of MEASURING) if (knows(id)) m += v;
  return m;
}

export const INQUIRY = {
  /**
   * Readers at which inquiry finds twice as readily as one reader: each tenfold more adds as much again (as MANY_HANDS does of
   * hands, but tenfold as many: a reader at a question is one of many who must ask it before one finds).
   */
  readers: 100_000,
  /** How far the means to measure raise what readers find: so much more for each, up to `measured`. */
  measures: 0.25,
  measured: 1,
  /** How far a people's ways bend it: its openness against its custom (each 0 … 1), at most this far either way. */
  ways: 0.3,
  /** At this depth in the tree inquiry begins to find; by `deep` it finds `most` of what is found. */
  from: 2,
  deep: 12,
  most: 0.8,
  /**
   * How much of the readers of the rest of its realm a land's word joins it to, by how far it carries in a day (km): none where
   * it goes at a walk, `joined` of them where it crosses a world in a day (a letter is read by the few it is sent to).
   */
  near: 40,
  far: 40_000,
  joined: 0.25,
} as const;

/** The share of a principle's finding that is inquiry's, by how deep it lies in the tree (rules/principles.ts PRINCIPLE_DEPTH). */
export function inquiryShare(depth: number): number {
  return INQUIRY.most * dmath.clamp((depth - INQUIRY.from) / (INQUIRY.deep - INQUIRY.from), 0, 1);
}

/** How much of the rest of its realm's readers a land's word joins it to (0 … `joined`), by how far word carries in a day. */
export function joinedBy(kmADay: number): number {
  return INQUIRY.joined * dmath.clamp(
    dmath.log(Math.max(1, kmADay) / INQUIRY.near) / dmath.log(INQUIRY.far / INQUIRY.near),
    0,
    1,
  );
}

/**
 * How readily a land's inquiry finds, against one reader alone (1): by its readers (its own and those its word joins it to),
 * what it can measure, and its ways (openness against custom).
 */
export function inquiryOf(readers: number, measures: number, openness: number, tradition: number): number {
  return (
    (1 + dmath.log10(1 + Math.max(0, readers) / INQUIRY.readers)) *
    (1 + INQUIRY.measures * Math.min(INQUIRY.measured, Math.max(0, measures))) *
    (1 + dmath.clamp(INQUIRY.ways * (openness - tradition), -INQUIRY.ways, INQUIRY.ways))
  );
}
