// Who may leave a realm and who may come into it (2026-11-23, the audit's "emigration and entry policy": no realm held its
// people in or kept strangers out; every move between lands was the movers' own). Two numbers a realm, each 0 … 1, and nothing
// named: how far its seat bars its people from leaving (exit), and how far it keeps strangers from coming in (entry).
//   exit: a seat bars leaving as far as hands are worth more to it than they cost to keep (the Domar gain: where land is open
//         and hands are few, each tiller's wage stands far above his living, rules/labour.ts bindPull), as far as its arms reach
//         its lands to hold them (force x capacity), and as far as its people have no say in it: a people that carries its own
//         choices does not vote itself shut in. And as far as its seat watches every word and keeps every arm from its people
//         (rules/holds.ts word and force): a seat that fears what its people say fears what those who leave carry out and say
//         abroad, and has the hand to stop them; again as far as its people have no say. (First light at 1500: the Domar gain is
//         nothing anywhere, its hands many, and a gate read off it alone barred no one in a century.)
//   entry: a people shuts its gates as far as those who come are strangers to it and are many already (the share of its people
//         of other peoples, sim/culture/abroad.ts), the more as its "us" is narrow (rules/folk.ts: a valley's people count every
//         newcomer a stranger; one that imagines a wide us takes them in as its own in time, but only half: a nation draws its
//         line too); and opens them as far as its hands
//         are short (the same Domar gain: those who would till are wanted). A seat can keep out only as far as its arms reach.
// Both act on the moves between lands (sim/population migrateYear): a band leaving a land for another realm's goes through as
// far as both gates are open; those fleeing war get through half the bars (a guard does not stop a flight from the sword).
// Pure tables and functions; nothing here names a people or a world.
import { dmath } from "../kernel/index.ts";

export const BORDERS = {
  /** Each realm weighs its gates once in so many years, in its own year. */
  every: 10,
  /** How far the Domar gain, held by arms, among a people with no say, bars leaving (at full gain, hold and no say: 1.5, so 1). */
  exitBy: 1.5,
  /** How far a seat that keeps every arm and watches every word, among a people with no say, bars leaving. */
  watchedBy: 1.2,
  /** How far strangers already among them, as a share of its people, shut the gates at a narrow "us" (a tenth: wholly at 0.25). */
  strangersBy: 4,
  /** How far hands short (the Domar gain) open them. */
  shortBy: 0.6,
  /** Of a bar, the share that holds those who flee war. */
  warHeld: 0.5,
  /** Where each bar is told in other words: open below the first, guarded to the second, barred past it. */
  bands: [0.25, 0.6],
  /** How far past a line a bar must be before it is told in other words (it holds as it was nearer). */
  slack: 0.05,
} as const;

/** What a realm's gates are read from, people-weighted over its lands (each 0 … 1). */
export type GateRead = {
  /** The Domar gain: how far a tiller's wage stands above his living, as a share of it. */
  readonly gain: number;
  /** How far its arms hold its lands (force x capacity, as bondage reads it). */
  readonly hold: number;
  /** How widely its choices are carried (rules/holds.ts voice). */
  readonly voice: number;
  /** The share of its people of other peoples. */
  readonly strangers: number;
  /** How far its people's "us" reaches (rules/folk.ts nation). */
  readonly nation: number;
  /** How far its seat keeps the means of violence from its people, and how freely word moves (rules/holds.ts force, word). */
  readonly force: number;
  readonly word: number;
};

/** The parts of a realm's bar on leaving, in the order told: name, value, what it adds. */
export function exitParts(r: GateRead): { name: string; value: number; by: number }[] {
  const g = dmath.clamp(r.gain, 0, 1),
    h = dmath.clamp(r.hold, 0, 1),
    v = dmath.clamp(r.voice, 0, 1),
    f = dmath.clamp(r.force, 0, 1),
    w = dmath.clamp(r.word, 0, 1);
  return [
    {
      name: "hands worth more than they cost to keep",
      value: g,
      by: BORDERS.exitBy * g * h * (1 - v),
    },
    {
      name: "a seat that keeps the arms and watches every word",
      value: f * (1 - w),
      by: BORDERS.watchedBy * f * (1 - w) * (1 - v),
    },
  ];
}

/** The parts of a realm's bar on coming in, in the order told. */
export function entryParts(r: GateRead): { name: string; value: number; by: number }[] {
  const s = dmath.clamp(r.strangers, 0, 1),
    n = dmath.clamp(r.nation, 0, 1),
    g = dmath.clamp(r.gain, 0, 1),
    reach = 0.5 + 0.5 * dmath.clamp(r.hold, 0, 1);
  return [
    {
      name: "strangers many among them",
      value: s,
      by: BORDERS.strangersBy * s * (1 - 0.5 * n) * reach,
    },
    { name: "hands short", value: g, by: -BORDERS.shortBy * g * reach },
  ];
}

const sum = (xs: { by: number }[]) =>
  dmath.clamp(
    xs.reduce((s, x) => s + x.by, 0),
    0,
    1,
  );
/** A realm's bar on leaving (0 open … 1 barred). */
export const exitBar = (r: GateRead): number => sum(exitParts(r));
/** A realm's bar on coming in (0 open … 1 shut). */
export const entryBar = (r: GateRead): number => sum(entryParts(r));

/** A bar's band: 0 open, 1 guarded, 2 barred. */
export function gateBand(bar: number): number {
  return BORDERS.bands.filter((b) => bar >= b).length;
}

/** A bar in words. */
export function gateWords(which: "exit" | "entry", bar: number): string {
  const band = gateBand(bar);
  return which === "exit"
    ? ["free to leave", "kept from leaving without leave", "barred from leaving"][band]!
    : ["open to strangers", "guarded against strangers", "shut to strangers"][band]!;
}

/**
 * How far a band moving from a land of one realm to a land of another goes through (0 … 1): what the leaving realm's bar and
 * the coming one's leave open; those fleeing war get through half of each bar. Exactly 1 where neither bars.
 */
export function gatesOpen(exit: number, entry: number, war: boolean): number {
  const k = war ? BORDERS.warHeld : 1;
  return (1 - k * dmath.clamp(exit, 0, 1)) * (1 - k * dmath.clamp(entry, 0, 1));
}
