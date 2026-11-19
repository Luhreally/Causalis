// Notable people (the sim is sim/notable/notables.ts; what is kept sim/notable/kept.ts). One rule for every person history keeps
// by name who is not already a ruler, a court figure or a group's head: someone is kept when what they are or did crosses the line
// their own people would notice, and what kind of notable they are is read off what they did. Nothing here names a profession.
//
// What a person can be notable FOR is a small basis (DOMAINS), each a thing people do that others can see: fighting, finding out,
// making, speaking for the unseen, gathering wealth, moving people, healing, judging, going where none had, and doing harm. A
// person's standing in each is a number; their title is told in words from the greatest thing they did (host/inspect/notable.ts).
//
// Where they come from, two ways and no other:
//   - by being among many who do a thing where it is done well: a land's doers of a domain (its crafters, its learned, its clergy,
//     its traders, those who tend its sick, those who judge, those who kill) each year stand a small chance that one of them is
//     far past the rest, by how developed the domain is there, by what its people have to spare to keep such a one, by the
//     occasions of the time, and less the more names its people already hold (arisesChance). Who crosses the line is drawn from a
//     heavy tail (talentOf): most barely cross it, a few are remembered for an age;
//   - by an occasion: something happened that someone did (a battle fought, a thing found, a faith founded or split, a seat
//     seized, a people's choice won, a law written, a sickness met, a sea crossed, a house of lending founded). The one who did it
//     is the land's standing notable of that domain where there is one (by their standing, doneBy), or someone new the deed makes.
//
// They act, each a small bounded term read by an older system, exactly 1 (or 0) where no one is kept: a commander's standing in
// their host's strength (commandTerm); the learned in how readily their land inquires (inquiryTerm); makers in their land's renown
// (renownTerm); one who speaks for a faith in how it spreads from their land and holds there (faithTerm, faithHolds); one who
// moves people in the choice their realm makes (speaksFor); healers in the deaths their land's care spares (healTerm); the rich
// in what their land has to spare for its other notables (patronTerm).
import { dmath } from "../kernel/index.ts";

/** What a person can be notable for. */
export const DOMAINS = [
  "war",
  "knowledge",
  "making",
  "faith",
  "wealth",
  "rule",
  "healing",
  "law",
  "exploration",
  "infamy",
] as const;
export type Domain = (typeof DOMAINS)[number];
export const DOMAIN = Object.fromEntries(DOMAINS.map((d, i) => [d, i])) as Record<Domain, number>;

export const NOTE = {
  /** The standing at which a people notice one of their own (standings are in thousandths of it). */
  line: 1000,
  /** No one's standing passes this. */
  most: 8000,
  /** A land's doers are weighed once in so many years, each land in its own year. */
  every: 8,
  /** The heavy tail: of those who cross the line, the share past k times it is k to the minus this. */
  tail: 2.4,
  /**
   * Doer-years for one to arise, by domain, where the domain is fully developed, kept and unoccupied by other names. (None for
   * war, rule and exploration: no one is a great commander without a battle, and those are made by occasions alone.)
   */
  doerYears: [0, 9000, 220000, 12000, 160000, 0, 2500, 9000, 0, 60000],
  /** A living notable's standing falls this share a year once their last deed is a generation's tenth behind them. */
  fade: 0.03,
  /** A dead one's, a year: history lets go slowly. */
  goneFade: 0.006,
  /** The living kept: a land's at the most (namesHeld), a world's; and of the dead a land's and a world's. */
  keepLand: 5,
  keepWorld: 420,
  goneLand: 3,
  goneWorld: 420,
  /** The dead are kept whatever their standing for so many years, then only while past the line. */
  mourned: 10,
  /** A notable's deeds kept: the greatest and the latest. */
  deeds: 5,
  /** How many risings and deaths a year the world tells (the greatest first). */
  told: 2,
  /** Only one who stands so many lines high is told at all. */
  tellAt: 1.5,
  /** Above so many lines a rising or a death is the chronicle's. */
  great: 2.2,
  /** Where the one who did a thing is a standing notable of the land: the chance at standing one line. */
  doneBy: 0.6,
  /** A people whose bodies live as one (rules/folk: social past this) keep no one apart: a line of them is kept, seldom. */
  hive: 0.9,
  hiveShare: 0.2,
} as const;

/** What standing does, each at its most (a notable of endless standing). */
export const ACTS = {
  /** A host's strength under a commander: this much more at the most, and as much less under one who has only lost. */
  command: 0.08,
  /** A host whose commander fell or was taken this year, or the year before, fights as this much less. */
  shaken: 0.06,
  /** How much more readily a land with the learned inquires. */
  inquiry: 0.2,
  /** Where one taught, how much likelier another of the same domain arises (a lineage), for a generation. */
  lineage: 1.5,
  /** A land's renown, for its makers of name. */
  renown: 0.15,
  /** A faith's spread from the land of one who speaks for it; how much less a land leaves a faith such a one holds it to. */
  faith: 0.6,
  faithHolds: 0.3,
  /**
   * A faith with one of name speaking for it far from its seat (their standing past `reformer` lines) breaks sooner: where two
   * lands of other speech hold it, not three, and after so many years since it last split, not a hundred.
   */
  reformer: 2,
  reformLands: 2,
  reformYears: 70,
  /** What one who moves people adds to their group's candidate (as nearness of wants is weighed, 0 … 1). */
  speaks: 0.04,
  /** Of a land's deaths, the share its healers of name spare. */
  heal: 0.02,
  /** What a land's rich add to what it has to spare for its notables. */
  patron: 0.5,
} as const;

/** What a battle does to those who led: the chance one falls, or is taken, by whether they won. */
export const FIELD = {
  fallsLost: 0.08,
  fallsWon: 0.02,
  taken: 0.07,
  /** What a battle lost takes of a commander's standing (a share), and the least a battle won gives. */
  lost: 0.22,
  won: 100,
} as const;

/** Standing as a share that saturates: 0 at none, a half at one line, toward 1. */
export function satOf(standing: number): number {
  return standing > 0 ? standing / (standing + NOTE.line) : 0;
}

/**
 * The chance one of a land's doers of a domain crosses the line within `years`: its doers, how developed the domain is there
 * (0 … 1), what its people have to spare to keep such a one (0 … 1), the occasions of the time (1: none), and how many names of
 * that domain its people already hold.
 */
export function arisesChance(
  domain: number,
  doers: number,
  development: number,
  patronage: number,
  occasion: number,
  held: number,
  years: number,
): number {
  const per = NOTE.doerYears[domain] ?? 0;
  if (!(per > 0) || !(doers > 0)) return 0;
  const d = dmath.clamp(development, 0, 1),
    p = dmath.clamp(patronage, 0, 1),
    // (The doers who could be seen at all grow as the root of their number: a great city's ten thousand crafters do not make a
    // hundred times the names of a town's hundred, since a people holds only so many names.)
    seen = dmath.sqrt(doers) * dmath.sqrt(Math.min(doers, per)),
    rate = ((seen / per) * (0.1 + 0.9 * d) * (0.3 + 0.7 * p) * occasion) / (1 + held);
  return 1 - dmath.exp(-rate * years);
}

/** The standing of one who crosses the line, for a draw `u` (0 … 1): a heavy tail from the line up. */
export function talentOf(u: number): number {
  const x = dmath.clamp(u, 0, 0.9995);
  return Math.min(NOTE.most, Math.round(NOTE.line * dmath.pow(1 - x, -1 / NOTE.tail)));
}

/** What a deed adds to the standing of the one who did it, by how the world weighs the event (its importance, 1 … 7). */
export function deedGain(importance: number, share = 1): number {
  return Math.round(Math.max(0, importance - 2) * 260 * share);
}

/**
 * A further deed adds the less the higher one stands already (a name is made once): what of a gain is kept at a standing.
 */
export function gainKept(standing: number): number {
  return (2 * NOTE.line) / (2 * NOTE.line + Math.max(0, standing));
}

/** How many names a land's people hold at once: more with the count of them, as its digits (a thousand hold two, a million five). */
export function namesHeld(people: number): number {
  return people < 100 ? 0 : dmath.clamp(Math.round(dmath.log10(people)) - 1, 1, NOTE.keepLand);
}

/** The chance a standing notable of the land is the one who did a thing of their domain there. */
export function doneBy(standing: number): number {
  return Math.min(0.95, NOTE.doneBy * 2 * satOf(standing));
}

/** A host's strength under its commander (1: one of a line's standing, untried). */
export function commandTerm(standing: number): number {
  const s = (standing - NOTE.line) / (2 * NOTE.line);
  return 1 + ACTS.command * (s / (1 + Math.abs(s)));
}

/** What a battle does to its commander's standing: the fielded on each side, and whether they won. */
export function fieldGain(standing: number, own: number, foe: number, won: boolean): number {
  if (!won) return -Math.round(standing * FIELD.lost);
  // (A battle is the greater for the men on the field, and the more for beating a host larger than one's own.)
  const size = dmath.clamp(dmath.log10(Math.max(10, own + foe)) / 5, 0.2, 1.2),
    odds = dmath.clamp(dmath.sqrt(Math.max(1, foe) / Math.max(1, own)), 0.5, 2);
  return Math.round(FIELD.won + 300 * size * odds);
}

export const inquiryTerm = (standing: number): number => 1 + ACTS.inquiry * satOf(standing);
export const renownTerm = (standing: number): number => 1 + ACTS.renown * satOf(standing);
export const faithTerm = (standing: number): number => 1 + ACTS.faith * satOf(standing);
export const faithHolds = (standing: number): number => 1 - ACTS.faithHolds * satOf(standing);
export const healTerm = (standing: number): number => 1 - ACTS.heal * satOf(standing);
export const speaksFor = (standing: number): number => ACTS.speaks * satOf(standing);
export const patronTerm = (standing: number): number => ACTS.patron * satOf(standing);

/** Whether a people keep persons apart at all, by how their bodies live together (0 … 1): a hive keeps lines, not persons. */
export function keepsPersons(social: number | undefined): boolean {
  return (social ?? 0) < NOTE.hive;
}
