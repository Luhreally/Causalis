// Lives L1 and L2: a realm's key figures and every realm's wealth as the page reads them. Plain data,
// made by host/leaders.ts and host/wealth.ts from what history holds; nothing here is kept.
import { hashString } from "../kernel/index.ts";

export type LeaderKind = "ruler" | "general" | "lender";

export const LEADER_ICON: Readonly<Record<LeaderKind, string>> = {
  ruler: "👑",
  general: "⚔️",
  lender: "🏦",
};

/** Who the god's hand is laid from, to find them among a town's people (hand.lay's `as`). */
export type LaidAs = {
  readonly name: string;
  readonly age: number;
  readonly occupation: number;
  readonly sex: number;
};

/** One of a realm's key figures. */
export type Leader = {
  /** Their page: `rule:<realm>`, `seat:<town>:lender:0`, or the event that is all history keeps of them. */
  readonly ref: string;
  readonly kind: LeaderKind;
  readonly name: string;
  /** "Ruler of the commonwealth of Braeol". */
  readonly title: string;
  /** What they did, a sentence or two. */
  readonly did: string;
  /** The event that says why (null: none). */
  readonly why: string | null;
  /** The town they live in, and its name (null: history keeps none). */
  readonly town: string | null;
  readonly townName: string | null;
  /** Who to lay the hand from (null: not to be had). */
  readonly as: LaidAs | null;
  /** Why they cannot be possessed, in words (null: they can). */
  readonly cannot: string | null;
};

export type LeaderList = {
  readonly realm: string;
  readonly realmName: string;
  readonly leaders: readonly Leader[];
};

/** A key figure living in a town drawn: their page, name, title, and which of its homes. */
export type PlanFigure = {
  readonly ref: string;
  readonly name: string;
  readonly title: string;
  readonly home: number;
};

export type WealthMeasure = "head" | "all" | "made" | "land";

/** One standing realm's wealth. */
export type WealthRow = {
  readonly ref: string;
  /** Its seat's name, and its whole name. */
  readonly short: string;
  readonly name: string;
  readonly color: readonly [number, number, number];
  readonly people: number;
  readonly lands: number;
  /** Its lands' stores at their goods' usual worth, what they owe, and the one less the other (never below nothing). */
  readonly stores: number;
  readonly owed: number;
  readonly worth: number;
  /** What its lands made last year at usual worth. */
  readonly made: number;
  /** Worth a head, made a head (0: no people). */
  readonly head: number;
  readonly madeHead: number;
  /** Fewer than FEW_PEOPLE: listed last. */
  readonly few: boolean;
  /** Places among the standing realms, from 1. */
  readonly rankHead: number;
  readonly rankAll: number;
  readonly rankMade: number;
  /** The good most of its stores' worth lies in, and its share (null: stores empty). */
  readonly topGood: { readonly name: string; readonly share: number } | null;
};

/** One land of the home world. `realm` is its realm's index in `realms` (-1: none). */
export type WealthLand = {
  readonly cell: number;
  readonly realm: number;
  readonly people: number;
  readonly worth: number;
};

/** Every realm, by worth a head (those of few people last), and every land of the home world. */
export type WealthBook = {
  readonly year: number;
  readonly realms: readonly WealthRow[];
  readonly lands: readonly WealthLand[];
};

/** A realm of fewer is listed last by worth a head: a few left sitting on what their dead left. */
export const FEW_PEOPLE = 1000;
/** A figure's home is one of a town's homes this near its square, by their ref. */
export const NEAREST_HOMES = 8;

/** Which of a town's homes a figure lives in (`plan.homes` index): the same every time. */
export function homeOfFigure(ref: string, homes: number): number {
  return homes > 0 ? (hashString(ref) >>> 0) % Math.min(NEAREST_HOMES, homes) : 0;
}

const WORTH_UNITS: readonly (readonly [number, string])[] = [
  [1e15, "quadrillion"],
  [1e12, "trillion"],
  [1e9, "billion"],
  [1e6, "million"],
  [1e3, "thousand"],
];

/** A large amount in words, three figures: "128 thousand", "5.18 billion". */
export function worthWords(n: number): string {
  for (const [u, name] of WORTH_UNITS)
    if (n >= u * 0.9995) return `${Number((n / u).toPrecision(3))} ${name}`;
  return Math.round(n).toLocaleString("en");
}
