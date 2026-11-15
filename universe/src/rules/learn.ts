// What a realm learns of how to hold itself, from what it has seen come of it (asked 2026-11-14: "its still to handcrafted like
// things should emerge from like first principles ... emergent data driven"). No lesson is written here. A realm keeps a small record
// of evidence: each piece is how some realm stood (its four numbers, rules/holds.ts, each as far as it lay from the middle) and how
// that realm then fared, measured: its people, its lands, its standing with its people, its wealth a head, how it ate. Its own years
// are such pieces, and so are others' it could see, weighed by how near they are, how like it they are, how freely word leaves them
// and how far it heeds outsiders at all. What it believes of each number is the association the record supports: a running sum of
// (how far past what is usual among realms, toward the high end, the realm stood) × (how it fared), over the evidence, each fading
// with the years: where all stand alike, a fate says nothing of how they stand. A belief pulls its
// own number toward the end that has been seen to go well, the more the more evidence stands behind it. So a realm overthrown while
// its choices lay in one hand comes to share them, and one that watches free-spoken neighbours fall comes to watch its own: by the
// same rule, from who stood how when it happened. What a people counts as faring well is read off its ways (the warlike count lands,
// the trading wealth), so the same year teaches two peoples differently. Pure functions and a few figures.
import { dmath } from "../kernel/index.ts";
import { HOLD_KINDS, type Blame, type Hold, type WaysRead } from "./holds.ts";

/** What a realm's faring is measured in, in the order it is kept. */
export const FORTUNES = ["people", "lands", "standing", "wealth", "fed"] as const;
export type Fortune = (typeof FORTUNES)[number];

/** The figures every realm learns by, whatever befell it. */
export const LEARNING = {
  /** What of a realm's fortune is kept each year: a faded sum of its years' changes, the last two or three most of it. */
  kept: 0.6,
  /** Years for a piece of evidence to weigh half what it did: a lifetime's telling, as a practice is kept (rules/lessons.ts). */
  half: 60,
  /** The evidence a belief must stand on to be leaned on at half its strength: one clear fate of one's own. */
  prior: 0.5,
  /** How far a belief held as firmly as can be moves what is wanted of its number. */
  learn: 0.5,
  /** A piece of evidence that moves a realm's beliefs this far in all is told as a lesson; this far, kept for its page. */
  told: 0.1,
  noted: 0.05,
  /** A realm tells a fate of its own as a lesson once in so many years, unless it moved it this far. */
  tellEvery: 15,
  great: 0.4,
  /** A realm keeps its last few pieces of evidence, for its page, and the few it has learned most from. */
  taught: 8,
  gone: 3,
  teachers: 6,
  /** Each ten years a realm looks at itself and at this many of the nearest realms it can see. */
  look: 3,
} as const;

const unit = (x: number) => Math.max(-1, Math.min(1, x));

/** How a realm stands in a year, as its fortune is measured. */
export type Faring = {
  readonly people: number;
  readonly lands: number;
  /** Its standing with its people (0 … 1). */
  readonly standing: number;
  /** What its lands hold a head. */
  readonly wealth: number;
  /** How its people ate in their leanest month (0 … 1). */
  readonly fed: number;
};

/**
 * A realm's year, measured: what changed, each as a share of what it had (a twentieth of its people lost, a third of its lands, a
 * fifth of its standing each weigh about as much; hunger weighs as long as it lasts), in the order of FORTUNES.
 */
export function yearOf(before: Faring, now: Faring): number[] {
  const ln = (a: number, b: number) => (a > 0 && b > 0 ? dmath.log(a / b) : 0);
  return [
    8 * ln(now.people, before.people),
    1.5 * ln(now.lands, before.lands),
    3 * (now.standing - before.standing),
    ln(now.wealth + 1, before.wealth + 1),
    -3 * Math.max(0, 1 - now.fed),
  ];
}

/**
 * The parts of a year that every realm shares in, and so say nothing of how any one of them stood: its people's growth and its
 * wealth's are counted against the mean of the realms measured that year (an age in which all grow teaches no one anything).
 */
export const SHARED: readonly boolean[] = [true, false, false, true, false];

/** A realm's fortune after a year: what it was, faded, and the year's changes (yearOf). Each within -1 … 1. */
export function fortuneAfter(was: readonly number[], year: readonly number[]): number[] {
  return year.map((x, i) => unit(LEARNING.kept * (was[i] ?? 0) + unit(x)));
}

/** The fortune of a realm that is gone: everything lost. */
export const FALLEN: readonly number[] = FORTUNES.map(() => -1);

/** What a people counts as faring well, read off its ways: shares of the whole, in the order of FORTUNES. */
export function valuesOf(w: WaysRead): number[] {
  const v = [
      0.15 + (w.kinship ?? 0.5),
      0.15 + w.valour,
      0.15 + w.hierarchy,
      0.15 + w.trade,
      0.15 + w.thrift,
    ],
    sum = v.reduce((s, x) => s + x, 0);
  return v.map((x) => x / sum);
}

/** How a realm fared (-1 … 1), as a people of these values counts it. */
export function faredBy(fortune: readonly number[], values: readonly number[]): number {
  let y = 0;
  for (let i = 0; i < FORTUNES.length; i++) y += (values[i] ?? 0) * (fortune[i] ?? 0);
  return unit(2 * y);
}

/** The parts of a fortune that weigh most in how it is counted, the heaviest first: each its kind and how it went. */
export function partsOf(
  fortune: readonly number[],
  values: readonly number[],
): { kind: Fortune; went: number }[] {
  return FORTUNES.map((kind, i) => ({
    kind,
    went: fortune[i] ?? 0,
    weight: Math.abs((values[i] ?? 0) * (fortune[i] ?? 0)),
  }))
    .filter((x) => x.weight > 0.01)
    .sort((a, b) => b.weight - a.weight)
    .map(({ kind, went }) => ({ kind, went }));
}

/** The share of what befalls anyone that a people puts to the gods, and so learns nothing from: the devout, most. */
export function chanceOf(w: WaysRead): number {
  return Math.max(0, Math.min(0.9, 1.4 * w.piety - 0.35));
}

/** How like another people's ways are to one's own (0 … 1): what befell those unlike us is held to say little of us. */
export function likeness(a: WaysRead, b: WaysRead): number {
  const d =
    Math.abs(a.hierarchy - b.hierarchy) +
    Math.abs(a.openness - b.openness) +
    Math.abs(a.tradition - b.tradition) +
    Math.abs(a.valour - b.valour) +
    Math.abs(a.piety - b.piety) +
    Math.abs(a.trade - b.trade) +
    Math.abs(a.thrift - b.thrift);
  return Math.max(0, 1 - (2 * d) / 7);
}

/**
 * How much another's fate weighs with a realm, against its own (1): by how near it is (1 at its border, nothing where its word
 * does not reach), how like it they are, how freely word leaves them (`shown`: their own number for word), and how far it heeds
 * outsiders (its openness).
 */
export function seenWeight(near: number, like: number, shown: number, openness: number): number {
  return Math.max(0, Math.min(1, near)) * like * (0.4 + 0.6 * shown) * (0.4 + 0.6 * openness);
}

/**
 * How far a realm stood from what is usual on each number (-1: far toward its low end; 1: far toward its high), from its numbers
 * and the mean of the realms then living (each 0 … 1). The usual is no written middle: it is where realms stand.
 */
export function leaningOf(stance: readonly number[], usual: readonly number[]): number[] {
  return HOLD_KINDS.map((_, k) => unit(2 * ((stance[k] ?? 0.5) - (usual[k] ?? 0.5))));
}

/** What one piece of evidence says of each number: how the realm stood on it against the usual, times how it fared, by its weight. */
export function evidenceOf(
  stance: readonly number[],
  usual: readonly number[],
  fared: number,
  weight: number,
): number[] {
  return leaningOf(stance, usual).map((d) => weight * d * fared);
}

/**
 * What a realm believes, as kept: for each number, the sum of its evidence for (+) and against (-) standing high on it, and how
 * much evidence that is; its own and what it saw befall others kept apart; faded to the year `at`.
 */
export type Belief = {
  /** Sums, four of its own then four seen. */
  a: number[];
  /** Evidence, four of its own then four seen. */
  n: number[];
  at: number;
};

export const noBelief = (year: number): Belief => ({
  a: [0, 0, 0, 0, 0, 0, 0, 0],
  n: [0, 0, 0, 0, 0, 0, 0, 0],
  at: year,
});

/** What is left of evidence after `years`. */
export function evidenceKept(years: number): number {
  return years <= 0 ? 1 : dmath.pow(0.5, years / LEARNING.half);
}

/** A belief with a piece of evidence added in a year (its own, or seen), what it had faded to then. Kept to thousandths. */
export function believeAfter(
  b: Belief,
  evidence: readonly number[],
  own: boolean,
  year: number,
): Belief {
  const keep = evidenceKept(year - b.at),
    at = own ? 0 : 4,
    round = (x: number) => Math.round(x * 1000) / 1000,
    a = b.a.map((x) => x * keep),
    n = b.n.map((x) => x * keep);
  for (let k = 0; k < 4; k++) {
    a[at + k]! += evidence[k] ?? 0;
    n[at + k]! += Math.abs(evidence[k] ?? 0);
  }
  return { a: a.map(round), n: n.map(round), at: Math.max(year, b.at) };
}

/**
 * What a realm believes of a number in a year (-1 … 1): above nothing, that standing high on it goes well (or low on it, ill);
 * under, the other way. Its strength is how one-sided the evidence is and how much of it there is, against LEARNING.prior.
 */
export function leanOf(b: Belief | undefined, k: number, year: number): number {
  if (!b) return 0;
  const keep = evidenceKept(year - b.at),
    a = (b.a[k]! + b.a[4 + k]!) * keep,
    n = (b.n[k]! + b.n[4 + k]!) * keep;
  return n > 0 ? a / (n + LEARNING.prior) : 0;
}

/** How much evidence stands behind a belief (0 … 1), and the share of it that is the realm's own. */
export function sureOf(
  b: Belief | undefined,
  k: number,
  year: number,
): { sure: number; own: number } {
  if (!b) return { sure: 0, own: 0 };
  const keep = evidenceKept(year - b.at),
    own = b.n[k]! * keep,
    n = own + b.n[4 + k]! * keep;
  return { sure: n / (n + LEARNING.prior), own: n > 0 ? own / n : 0 };
}

/** What a belief asks of its number: so much more (or less) wanted of it. */
export function pullOf(b: Belief | undefined, k: number, year: number): number {
  return LEARNING.learn * leanOf(b, k, year);
}

/**
 * How a realm took a piece of evidence, read off what it did with it: put to the gods where most of it was and little was left to
 * move it; another's fate that weighed almost nothing with it, held weakness; else by whether it drew its seat in (arms to its
 * host, fewer hands, words watched, fewer bonds: it blamed others) or opened it (it looked to itself).
 */
export function blameFrom(
  evidence: readonly number[],
  chance: number,
  own: boolean,
  weight: number,
): Blame {
  const [force, voice, word, trust] = evidence as [number, number, number, number],
    most = Math.max(Math.abs(force), Math.abs(voice), Math.abs(word), Math.abs(trust));
  if (chance >= 0.5 && most < MOVED) return "the gods'";
  if (!own && weight < 0.12) return "weakness";
  return force - voice - word - trust > 0 ? "theirs" : "ours";
}

// —— Readings in words: composed of how they stood and what was measured, never picked from a list of lessons ————————————

/** Each number's two ends, as a realm standing there is told ("with …"). */
export const STOOD_WORDS: Readonly<Record<Hold, readonly [low: string, high: string]>> = {
  force: ["arms in its people's hands", "arms kept to its host"],
  voice: ["its choices in few hands", "its choices carried by many"],
  word: ["its people's words watched", "word moving freely"],
  trust: ["bonds to no one", "bonds to many"],
};

/**
 * How a realm stood against what was usual, in words, from how far it stood from it on each number (leaningOf): the ends it stood
 * toward more than most (at most two), or "much as most do".
 */
export function stoodWords(leaned: readonly number[]): string {
  const far = HOLD_KINDS.map((h, k) => ({ h, d: leaned[k] ?? 0 }))
    .filter((x) => Math.abs(x.d) >= 0.15)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    .slice(0, 2)
    .map((x) => STOOD_WORDS[x.h][x.d > 0 ? 1 : 0]);
  return far.length ? `more than most with ${far.join(" and ")}` : "much as most do";
}

/** Each part of a fortune gone ill, and well. */
export const FORTUNE_WORDS: Readonly<Record<Fortune, readonly [ill: string, well: string]>> = {
  people: ["its people fewer", "its people more"],
  lands: ["lands lost", "lands won"],
  standing: ["its rule doubted", "its rule honoured"],
  wealth: ["its wealth spent", "its wealth grown"],
  fed: ["its people hungry", "its people fed"],
};

/** How a realm fared as a people counted it, kept for the telling: how (-1 … 1), then the parts that weighed most, each its place in FORTUNES plus one, signed by how it went. */
export function cameOf(fortune: readonly number[], values: readonly number[]): number[] {
  const y = faredBy(fortune, values);
  return [
    Math.round(y * 100),
    ...partsOf(fortune, values)
      .filter((p) => p.went * y > 0)
      .slice(0, 2)
      .map((p) => (FORTUNES.indexOf(p.kind) + 1) * (p.went > 0 ? 1 : -1)),
  ];
}

/** How a realm fared, in words, from what was kept of it (cameOf): "fared ill (lands lost, its rule doubted)". */
export function cameWords(came: readonly number[]): string {
  const y = (came[0] ?? 0) / 100,
    parts = came
      .slice(1)
      .map((k) => FORTUNE_WORDS[FORTUNES[Math.abs(k) - 1]!]?.[k > 0 ? 1 : 0])
      .filter(Boolean),
    how = Math.abs(y) < 0.05 ? "fared neither well nor ill" : y > 0 ? "fared well" : "fared ill";
  return parts.length ? `${how} (${parts.join(", ")})` : how;
}

/** A belief moved this far by a piece of evidence is told as moved. */
const MOVED = 0.03;

/** What a piece of evidence moved a realm to, in words: the ends it came to hold with (at most two), or nothing. */
export function movedWords(evidence: readonly number[]): string {
  const to = HOLD_KINDS.map((h, k) => ({ h, v: evidence[k] ?? 0 }))
    .filter((x) => Math.abs(x.v) >= MOVED)
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .slice(0, 2)
    .map((x) => STOOD_WORDS[x.h][x.v > 0 ? 1 : 0]);
  return to.length ? `came to hold more with ${to.join(" and ")}` : "";
}

/** What a realm believes of a number, in words: the end it has seen go well. */
export function beliefWords(h: Hold, lean: number): string {
  return `holds with ${STOOD_WORDS[h][lean > 0 ? 1 : 0]}`;
}
