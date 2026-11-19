// Things of the mind (asked 2026-11-19: "build the rest of the missing systems too in first principles fashion and very
// effecient"; the audit's schools of thought, works, pilgrimage). One mechanism, the one a faith already is: something of the mind
// is founded by someone, spreads along the ways people meet (speech alike, a road, a body that teaches), splits where it is held
// far from where it began, and pulls on what those who hold it are. A faith holds what the power behind the world is, and pulls
// on a people's ways (rules/faith.ts). A school of thought holds how a people should be ruled, and pulls on how its realm is
// held and on its laws:
//   what it teaches: no table of doctrines. Its founder speaks for the group of their realm whose wants are furthest from how
//     the realm is held (what each group wants is itself learned from how it fared: sim/order/wants.ts): the school's leaning on
//     each of the four numbers (rules/holds.ts) is that gap, and on each law the position that group wants. A realm in which the
//     tillers are bound and unheard grows a teaching of the tiller's right; one whose court has lost its grip, a teaching of order;
//   its name: the leaning it presses hardest, and a word of its founders' tongue;
//   its founder: one of name in knowledge or in faith (rules/notables.ts), in a land where word can be kept or passed on;
//   its spread: as a faith's, by likeness of speech, a road, and more where a body teaches or where higher learning stands, less
//     where word is watched;
//   its pull: on a realm by the share of its lands that hold it and by how long (a generation: half of it), bounded.
// A work (a song, a carved stone, a book, as the people's means allow) is made by one of name for a patron who can spare for it,
// of something worth remembering: it keeps that memory from fading and credits whoever paid. A pilgrimage is the faithful's (or
// the taught's) going to where the thing they hold began, by how many hold it, how devout, how far. Pure numbers and functions.
import { dmath } from "../kernel/index.ts";
import { HOLD_KINDS } from "./holds.ts";

/** What a school leans on: the four numbers a realm is held by, then its four laws (sim/order/laws.ts LAWS). */
export const IDEA_LAWS = ["land", "strangers", "faith", "justice"] as const;
export const IDEA_PARTS = HOLD_KINDS.length + IDEA_LAWS.length;

export const IDEA = {
  /** A founder's standing in knowledge or faith, in lines (rules/notables.ts NOTE.line), at the least. */
  founder: 1,
  /** The chance a year one who could found a school does, at a full saturation of standing and wants wholly unmet. */
  found: 0.006,
  /** The least gap between what a group wants and how its realm is held for a teaching to come of it (summed over the four). */
  unmet: 0.12,
  /** A land that took up a school within these years gives no other its ear (its founder's own pupils still teach). */
  fresh: 30,
  /** The most a school leans on one number (hundredths), and on a law. */
  lean: 25,
  lawLean: 15,
  /** A school's spread to a neighbour a year, at speech alike; by a road; where a body teaches; from higher learning. */
  spread: 0.02,
  road: 1.5,
  taught: 1.6,
  higher: 1,
  /** Those who hold a school already are slower to leave it. */
  holds: 0.3,
  /** Its pull on a realm's number at the most (of its leaning), and on a law's support. */
  pull: 0.6,
  lawPull: 0.5,
  /** A school held in this many lands of speech unlike its seat's, this long since it last split, splits (with one of name: sooner). */
  splitLands: 3,
  splitYears: 90,
  ledLands: 2,
  ledYears: 50,
  /** One who leads a school out stands this many lines high in knowledge. */
  leader: 2,
  /** Speech this unlike the seat's is far. */
  far: 0.72,
  /** A world keeps at most this many schools no land holds any more (the oldest forgotten first). */
  keepGone: 60,
} as const;

/** The name of each leaning's two ends, as a school is called for the one it presses hardest (toward 0, toward 1). */
export const IDEA_CALLINGS: readonly (readonly [string, string])[] = [
  ["the Arms of All", "the Kept Arms"],
  ["the One Voice", "the Many Voices"],
  ["the Guarded Word", "the Free Word"],
  ["the Closed Gate", "the Kept Oath"],
  ["the Lord's Due", "the Tiller's Right"],
  ["the Own Kin", "the Wide Welcome"],
  ["the One Faith", "the Free Conscience"],
  ["the Old Custom", "the One Law"],
];

/** What each leaning asks, in a page's words (toward 0, toward 1). */
export const IDEA_ASKS: readonly (readonly [string, string])[] = [
  ["arms in every household's hands", "arms kept by the seat alone"],
  ["choices made by one", "choices carried by many"],
  ["word watched", "word moving freely"],
  ["a realm bound to no other", "oaths and loans kept with others"],
  ["the land its lord's", "the land the tiller's own"],
  ["strangers held as subjects", "strangers made citizens"],
  ["one faith allowed", "conscience left free"],
  ["custom and vengeance", "one law for all"],
];

/**
 * A school's leanings (hundredths; the four numbers then the four laws) from what its founder's group wants of each number
 * (0 … 1), how the realm is held (0 … 1), the position (0 … 2) the group most wants of each law and the realm's law now.
 */
export function ideaCreed(
  wants: readonly number[],
  held: readonly number[],
  lawWanted: readonly number[],
  lawNow: readonly number[],
): number[] {
  const out: number[] = [];
  for (let k = 0; k < HOLD_KINDS.length; k++)
    out.push(
      Math.round(dmath.clamp(((wants[k] ?? 0.5) - (held[k] ?? 0.5)) * 100, -IDEA.lean, IDEA.lean)),
    );
  for (let k = 0; k < IDEA_LAWS.length; k++) {
    const want = lawWanted[k] ?? 1,
      now = lawNow[k] ?? 1;
    // (Toward the old order, the middle, the new; half as hard where the law already stands where the group wants it.)
    out.push(Math.round((want - 1) * IDEA.lawLean * (want === now ? 0.5 : 1)));
  }
  return out;
}

/** The leaning a school presses hardest: its index (0 … 7) and which end (0 | 1); the first of equals. */
export function ideaLeads(creed: readonly number[]): { part: number; end: 0 | 1 } {
  let part = 0;
  for (let k = 1; k < IDEA_PARTS; k++)
    if (Math.abs(creed[k] ?? 0) > Math.abs(creed[part] ?? 0)) part = k;
  return { part, end: (creed[part] ?? 0) >= 0 ? 1 : 0 };
}

/** How much of the summed gap a teaching comes of (0 … 1): nothing under IDEA.unmet, all of it at four times that. */
export function ideaUnmet(gap: number): number {
  return dmath.clamp((gap - IDEA.unmet) / (3 * IDEA.unmet), 0, 1);
}

/** A school's chance of reaching a neighbour this year. */
export function ideaSpreads(
  like: number,
  road: boolean,
  taught: boolean,
  higher: number,
  word: number,
  holdsOne: boolean,
): number {
  return (
    IDEA.spread *
    like *
    like *
    (road ? IDEA.road : 1) *
    (taught ? IDEA.taught : 1) *
    (1 + IDEA.higher * dmath.clamp(higher, 0, 1)) *
    (0.4 + 0.6 * dmath.clamp(word, 0, 1)) *
    (holdsOne ? IDEA.holds : 1)
  );
}

// —— Works ————————————————————————————————————————————————————————————————————————————————————————————————————————

/**
 * What a work is made as, by what its people can do: told (sung, shown, scented: carried by those who know it), raised (a made
 * thing that stands in its place), written, or sent (carried on a signal to many at once).
 */
export const WORK_FORMS = ["told", "raised", "written", "sent"] as const;
export type WorkForm = (typeof WORK_FORMS)[number];

export const WORK = {
  /** A maker's standing, in lines, at the least; the least importance of what a work remembers. */
  maker: 1,
  worth: 5,
  /** How far back a maker looks for what to remember (years). */
  back: 25,
  /** The chance a year one who could make a work does, at the most. */
  made: 0.03,
  /** A land keeps this many works (the least renowned lost first), a world this many. */
  keepLand: 3,
  keepWorld: 900,
  /** What a land's works add to its renown at the most (a share), at this much renown among them (lines). */
  renown: 0.1,
  renownAt: 6,
  /** What a patron gains at the most: a seat in its standing, a house in its power (a share), a body in how it is run (thousandths). */
  credit: 0.02,
  housePower: 0.1,
  bodyQuality: 30,
  /** A patron's credit for a work is whole for a generation's length, then fades over as long again (years). */
  fresh: 30,
  /** Of what a realm's memory loses in a year, the share it keeps where a work carries it. */
  remembers: 0.6,
  /** A work's renown falls this share a year, never under a third of what it was. */
  fades: 0.004,
} as const;

/** A work's form from what its people can do there (0 … 1 each) and whether its maker is one who makes things. */
export function workForm(
  writing: number,
  building: number,
  signal: number,
  maker: boolean,
): WorkForm {
  if (signal > 0.3) return "sent";
  if (maker && building > 0) return "raised";
  return writing > 0 ? "written" : "told";
}

/** A work's renown (thousandths of a line) from its maker's standing and the weight of what it remembers. */
export function workRenown(standing: number, importance: number): number {
  return Math.round(standing * (0.5 + 0.1 * dmath.clamp(importance, 0, 10)));
}

/** A work's renown now, `age` years on. */
export function workRenownNow(renown: number, age: number): number {
  return Math.round(renown * Math.max(1 / 3, dmath.pow(1 - WORK.fades, Math.max(0, age))));
}

/** How much of a patron's credit for a work is left, `age` years on (1 … 0). */
export function creditLeft(age: number): number {
  return dmath.clamp(2 - age / WORK.fresh, 0, 1);
}

// —— Pilgrimage ——————————————————————————————————————————————————————————————————————————————————————————————————

export const PILGRIM = {
  /** Of a land's people who hold a thing, the share who go to its seat in a year, at full devotion and at the seat's door. */
  share: 0.004,
  /** The way's length (km) over which half as many go; over the sea, as if this many times nearer than by land's length. */
  half: 1500,
  /** The least a year for a pilgrimage to be one; one that stands is kept while a quarter as many still come. */
  least: 500,
  /** What one pilgrim leaves at the seat, in a year's keep of one of its people (a share: some weeks' keep and their gifts). */
  leaves: 0.3,
  /** The most a seat's town gains of its own people's keep from pilgrims. */
  most: 0.15,
  /** Read again once in this many years. */
  every: 5,
  /** The ways drawn to one seat, at the most. */
  ways: 6,
} as const;

/** Of those who hold a thing in a land, how many go to its seat in a year: by devotion (0 … 1) and the way's length (km). */
export function pilgrimsFrom(holders: number, devotion: number, km: number): number {
  return Math.floor(
    holders * PILGRIM.share * dmath.clamp(devotion, 0, 1) * dmath.pow(0.5, km / PILGRIM.half),
  );
}

/** What pilgrims add to a seat's town, as a share of its own keep (0 … PILGRIM.most). */
export function pilgrimsFeed(pilgrims: number, people: number): number {
  return people > 0 ? Math.min(PILGRIM.most, (PILGRIM.leaves * pilgrims) / people) : 0;
}
