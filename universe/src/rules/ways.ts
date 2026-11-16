// A people's ways from what they are and where they live (asked 2026-11-15: "i want every theorotical system to be in the game
// ... down to first principles", and of a people's ways in particular, that every species answered a famine, a road or a god's
// act alike, from ways that all began at the middle). Eight ways a land keeps (sim/culture/culture.ts), each 0 … 1 between two
// poles; nothing here names a people or a world. A people's first ways are read off its body, as the bodies' grammar gives it
// (rules/bodies.ts): how fast it lives and how many young it has (a short life with many young is a bold one that saves little
// and keeps no custom long), how closely it lives together (those who live as one hold to their kin and their rank and are wary
// of strangers), how it bears and feeds its young, what it eats (a hunter prizes valour), its medium (those of the water hold no
// ground and keep few walls), its blood, its size and its senses. And off the land each lives in, as it was made: how sharp its
// seasons are (who must store for a winter saves, keeps a calendar and lets those who hold the stores rule), how much it gives a
// body of theirs, how sure its rain is (who cannot count on the sky share and pray), how sickly its warmth and wet are (who lives
// among fevers is wary of strangers), how broken its ground is, the sea at its edge, a river. Then what a land lives through
// presses its ways year by year, as much as it was measured to be: hunger as deep as it went, a god seen to act, each new thing
// its people come to know; and what it has seen go well moves them as evidence does a realm's (rules/learn.ts): how a land stood
// on each way against where most lands stand, times how it then fared, its own years and those of the lands it deals with, the
// way it has seen go well pulled toward. A part is a reading of a continuous quantity; its offsets say how far it presses each
// way at its fullest. Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import type { BodyPlan, Diet, Bearing, Medium } from "./bodies.ts";
import { LEARNING, evidenceKept } from "./learn.ts";

/** The eight ways, in the order a land keeps them. */
export const WAY_TRAITS = [
  "kinship",
  "hierarchy",
  "piety",
  "valour",
  "trade",
  "openness",
  "tradition",
  "thrift",
] as const;
export type WayTrait = (typeof WAY_TRAITS)[number];
export const WAY: Readonly<Record<WayTrait, number>> = Object.fromEntries(
  WAY_TRAITS.map((t, i) => [t, i]),
) as Record<WayTrait, number>;

/** An offset on each way, by name (absent: none). */
type Lean = Partial<Record<WayTrait, number>>;
const lean = (l: Lean): number[] => WAY_TRAITS.map((t) => l[t] ?? 0);

/**
 * One thing a body or a land is, read as a number about its middle (below nothing: toward its other end), and how far it
 * presses each way at a reading of one: so a body's or a land's ways are the sum of its parts' readings times their leans.
 */
export type WayPart = {
  readonly id: string;
  /** In words, at each end ("short lives, many young" … "long lives, few young"). */
  readonly words: readonly [low: string, high: string];
  readonly leans: readonly number[];
};

/** What a body's parts press its people's ways to. */
export const BODY_PARTS: readonly WayPart[] = [
  {
    // (A short life with many young is lived fast: it dares, spends what it has, and its customs turn over with its quick
    // generations. Life history's fast end: a reading of how many young a birth brings and how long a life runs, both against
    // those of an upright ape.)
    id: "pace",
    words: ["long lives and few young", "short lives and many young"],
    leans: lean({ valour: 0.08, thrift: -0.08, tradition: -0.06, kinship: -0.04 }),
  },
  {
    // (Those who live close together count kin and keep rank, and are wary of those who are not theirs.)
    id: "together",
    words: ["living apart", "living close together"],
    leans: lean({ kinship: 0.15, hierarchy: 0.2, openness: -0.1, tradition: 0.05 }),
  },
  {
    // (A young carried in the body and fed from it binds its bearer and her kin to it; spawn left to the water binds no one.)
    id: "care",
    words: ["young left to fend", "young carried and fed"],
    leans: lean({ kinship: 0.08, thrift: 0.04 }),
  },
  {
    // (A hunter of other flesh lives by daring and keeps its grounds to itself; a grazer by the herd.)
    id: "hunts",
    words: ["grazing and gathering", "hunting"],
    leans: lean({ valour: 0.16, openness: -0.06, trade: -0.04 }),
  },
  {
    // (In the water no ground is held and no wall stands; on the shore two worlds meet.)
    id: "fluid",
    words: ["life on the ground", "life in the water"],
    leans: lean({ openness: 0.06, hierarchy: -0.06, trade: 0.04 }),
  },
  {
    // (A great body is its own weapon.)
    id: "heavy",
    words: ["small bodies", "great bodies"],
    leans: lean({ valour: 0.05 }),
  },
  {
    // (A warm body burns its food through every season: it must store against the lean one.)
    id: "warm",
    words: ["cold blood", "warm blood"],
    leans: lean({ thrift: 0.06 }),
  },
  {
    // (Who knows their own by scent is wary of the scent of others.)
    id: "scent",
    words: ["", "knowing their own by scent"],
    leans: lean({ kinship: 0.04, openness: -0.03 }),
  },
  {
    // (A word that carries through the deep or the dark is hard to keep from strangers.)
    id: "carries",
    words: ["", "hearing one another far off"],
    leans: lean({ openness: 0.04, trade: 0.02 }),
  },
];

/** What a land's parts press its people's ways to. */
export const LAND_PARTS: readonly WayPart[] = [
  {
    // (Who must store for a winter saves, keeps a calendar, and lets those who hold the stores rule.)
    id: "seasons",
    words: ["mild seasons", "sharp seasons"],
    leans: lean({ thrift: 0.08, tradition: 0.04, hierarchy: 0.03 }),
  },
  {
    // (A land that gives much feeds strangers too; want draws kin together and breeds raids.)
    id: "plenty",
    words: ["a land that gives little", "a land that gives much"],
    leans: lean({ openness: 0.05, kinship: -0.04, valour: -0.04, thrift: -0.03 }),
  },
  {
    // (Who cannot count on the sky shares what it gives, and prays.)
    id: "unsure",
    words: ["rain they can count on", "rain they cannot count on"],
    leans: lean({ piety: 0.06, kinship: 0.04, thrift: -0.02 }),
  },
  {
    // (Who lives among fevers is wary of strangers and keeps to what has kept them alive.)
    id: "sickly",
    words: ["", "warm, wet and feverish country"],
    leans: lean({ openness: -0.06, tradition: 0.04, kinship: 0.03 }),
  },
  {
    // (Broken ground is held by the bold and ruled by no one far off.)
    id: "rugged",
    words: ["level ground", "broken ground"],
    leans: lean({ valour: 0.06, hierarchy: -0.05, openness: -0.03 }),
  },
  {
    // (Where the land meets the sea, strangers come by.)
    id: "shore",
    words: ["no shore", "a shore"],
    leans: lean({ trade: 0.06, openness: 0.05 }),
  },
  {
    // (A river carries goods, and its fields want many hands kept at one work.)
    id: "river",
    words: ["no river", "a river"],
    leans: lean({ hierarchy: 0.04, trade: 0.03 }),
  },
  {
    // (Halls sealed on another body: kin and thrift keep everyone alive, and the old home's ways fit the new world ill.)
    id: "sealed",
    words: ["", "halls sealed against another world"],
    leans: lean({ kinship: 0.15, thrift: 0.15, tradition: -0.15, openness: -0.08 }),
  },
];

const PART_INDEX = (parts: readonly WayPart[]) => new Map(parts.map((p, i) => [p.id, i]));
const BODY_INDEX = PART_INDEX(BODY_PARTS),
  LAND_INDEX = PART_INDEX(LAND_PARTS);

/** How much young each way of bearing them is given, about its middle: carried and fed, laid, left. */
const CARE: Readonly<Record<Bearing, number>> = { live: 0.5, eggs: 0, spawn: -0.5 };
/** How far up the eating each diet lives, about its middle: flesh, both, what it strains from the water, plants. */
const HUNTS: Readonly<Record<Diet, number>> = { flesh: 0.5, both: 0, filter: -0.25, plants: -0.5 };
/** How far each medium is from holding ground. */
const FLUID: Readonly<Record<Medium, number>> = { land: 0, shore: 0.5, water: 1 };

/** A body read as its parts' numbers (BODY_PARTS' order). */
export function bodyReading(b: BodyPlan | null | undefined): number[] {
  if (!b) return BODY_PARTS.map(() => 0);
  const young = Math.max(1, b.young),
    span = Math.max(5, b.span);
  const r = new Array<number>(BODY_PARTS.length).fill(0);
  r[BODY_INDEX.get("pace")!] = dmath.clamp(
    0.25 * dmath.log(young) - 0.6 * dmath.log(span / 70),
    -1,
    1,
  );
  r[BODY_INDEX.get("together")!] = b.social - 0.6;
  r[BODY_INDEX.get("care")!] = CARE[b.bearing] ?? 0;
  r[BODY_INDEX.get("hunts")!] = HUNTS[b.diet] ?? 0;
  r[BODY_INDEX.get("fluid")!] = FLUID[b.medium] ?? 0;
  r[BODY_INDEX.get("heavy")!] = dmath.clamp(
    dmath.log(Math.max(1, b.size) / 60) / dmath.LN10,
    -1,
    1,
  );
  r[BODY_INDEX.get("warm")!] = b.warm ? 0.5 : -0.5;
  r[BODY_INDEX.get("scent")!] = b.senses.includes("smell")
    ? b.senses.includes("hearing")
      ? 0.5
      : 1
    : 0;
  r[BODY_INDEX.get("carries")!] =
    b.medium === "water" || b.senses.includes("echo") || b.senses.includes("electric") ? 1 : 0;
  return r;
}

/** What a land is, as its people's ways read it: each a number about its middle. */
export type LandReading = {
  /** Half the year's swing of warmth (°C). */
  readonly seasonality: number;
  /** What a square kilometre of it gives a body of theirs a year in the wild, against what one eats (person-years). */
  readonly gives: number;
  /** Its rain against the mean of the lands its people can live in (1: as most). */
  readonly rain: number;
  /** How far its ground rises and falls against its neighbours' (m, on the mean). */
  readonly relief: number;
  /** The share of its neighbours of the other kind, land against sea. */
  readonly shore: number;
  readonly river: boolean;
  /** Halls on another body. */
  readonly sealed: boolean;
};

/** A land read as its parts' numbers (LAND_PARTS' order). */
export function landReading(l: LandReading): number[] {
  const r = new Array<number>(LAND_PARTS.length).fill(0),
    plenty = dmath.clamp(dmath.log(Math.max(1e-4, l.gives) / 0.25) / dmath.log(4), -1, 1),
    wet = dmath.clamp(l.rain - 1, 0, 1);
  r[LAND_INDEX.get("seasons")!] = dmath.clamp((l.seasonality - 8) / 10, -1, 1);
  r[LAND_INDEX.get("plenty")!] = plenty;
  r[LAND_INDEX.get("unsure")!] = dmath.clamp(1 - l.rain, -1, 1);
  r[LAND_INDEX.get("sickly")!] = Math.max(0, plenty) * wet;
  r[LAND_INDEX.get("rugged")!] = dmath.clamp(l.relief / 800, 0, 1) - 0.2;
  r[LAND_INDEX.get("shore")!] = dmath.clamp(l.shore, 0, 1) - 0.2;
  r[LAND_INDEX.get("river")!] = (l.river ? 1 : 0) - 0.2;
  r[LAND_INDEX.get("sealed")!] = l.sealed ? 1 : 0;
  return r;
}

/** What parts read so press each way: the sum of each part's reading times its lean. */
export function leansOf(parts: readonly WayPart[], reading: readonly number[]): number[] {
  const out = WAY_TRAITS.map(() => 0);
  parts.forEach((p, i) => {
    const v = reading[i] ?? 0;
    if (v) for (let k = 0; k < out.length; k++) out[k]! += v * p.leans[k]!;
  });
  return out;
}

/** A people's ways as their body and their land make them, before anything has befallen them (each 0 … 1). */
export function waysFrom(body: readonly number[], land: readonly number[]): number[] {
  return WAY_TRAITS.map((_, k) => dmath.clamp(0.5 + (body[k] ?? 0) + (land[k] ?? 0), 0.05, 0.95));
}

/**
 * The parts that press a way most, the heaviest first, each its part, its reading and how far it presses that way: for a
 * land's page ("why they are so").
 */
export function partsFor(
  parts: readonly WayPart[],
  reading: readonly number[],
  k: number,
): { part: WayPart; value: number; press: number }[] {
  return parts
    .map((part, i) => ({ part, value: reading[i] ?? 0, press: (reading[i] ?? 0) * part.leans[k]! }))
    .filter((x) => Math.abs(x.press) >= 0.005)
    .sort((a, b) => Math.abs(b.press) - Math.abs(a.press) || (a.part.id < b.part.id ? -1 : 1));
}

/** A part's reading in words: the end it lies toward ("short lives and many young"), or nothing about its middle. */
export function wayPartWords(part: WayPart, value: number): string {
  return Math.abs(value) < 0.05 ? "" : part.words[value > 0 ? 1 : 0];
}

// —— What a land lives through ————————————————————————————————————————————————————————————————————————————

/** How far a year of each thing lived through presses the ways, at its fullest, for a people who live as long as an upright ape. */
export const LIVED = {
  /** A year as hungry as can be, in its leanest month. */
  hunger: lean({ thrift: 0.05, piety: 0.02, openness: -0.012 }),
  /** A god seen to act among them: devotion, the more the less devout they were (a people at the middle, half this). */
  sign: 0.12,
  /** Each thing they came to know: custom loosens (a land that comes to one a year in ten keeps two in a hundred less to custom). */
  known: -0.004,
  /**
   * Below this in their leanest month (thousandths of enough), a year is a hungry one, and how far below it, as a share, how
   * hungry: a season's want that comes every year is the lean month every people has, not hunger that teaches.
   */
  enough: 700,
} as const;

/** How hungry a year was (0 … 1), from its leanest month (thousandths of enough). */
export function hungerOf(leanest: number): number {
  return dmath.clamp((LIVED.enough - leanest) / LIVED.enough, 0, 1);
}

/**
 * How fast a people's ways move against an upright ape's: as a generation is long, for a way is learned anew by each, its root
 * so that a people of thirty years moves half again as fast as one of seventy, not twice (much is learned within a life).
 */
export function waysPace(span: number): number {
  return dmath.clamp(dmath.sqrt(70 / Math.max(5, span)), 0.6, 1.7);
}

/** How fast a people's ways relax toward what their body, land, lessons and faith make them, a year, at an upright ape's pace. */
export const WAYS_RELAX = 0.02;

// —— What a land has seen go well ———————————————————————————————————————————————————————————————————————

/** The figures a land learns its ways by (rules/learn.ts holds a realm's; these are the same machinery, eight ways wide). */
export const WAYS_LEARNING = {
  /** The most a belief held as firmly as can be moves what a way is drawn to. */
  most: 0.2,
  /** A land weighs its evidence once in so many years, each land in its own year. */
  every: 10,
  /** It looks at itself and at so many of the lands it deals with most. */
  look: 3,
  /** A piece of evidence that moves some way's pull this far is told. */
  told: 0.05,
} as const;

/** What a land believes of each way, as kept: the sum of its evidence for standing high on it, and how much evidence that is. */
export type WaysBelief = {
  readonly a: readonly number[];
  readonly n: readonly number[];
  readonly at: number;
};

export const noWaysBelief = (year: number): WaysBelief => ({
  a: WAY_TRAITS.map(() => 0),
  n: WAY_TRAITS.map(() => 0),
  at: year,
});

/** How far a land stood from where lands usually stand on each way (-1 … 1), times how it fared, by its weight. */
export function waysEvidence(
  stance: readonly number[],
  usual: readonly number[],
  fared: number,
  weight: number,
): number[] {
  return WAY_TRAITS.map(
    (_, k) => weight * fared * dmath.clamp(2 * ((stance[k] ?? 0.5) - (usual[k] ?? 0.5)), -1, 1),
  );
}

/** A belief with evidence added in a year, what it had faded to then (half its weight in LEARNING.half years). Thousandths. */
export function waysBelieveAfter(
  b: WaysBelief,
  evidence: readonly number[],
  year: number,
): WaysBelief {
  const keep = evidenceKept(year - b.at),
    round = (x: number) => Math.round(x * 1000) / 1000 || 0;
  return {
    a: b.a.map((x, k) => round(x * keep + (evidence[k] ?? 0))),
    n: b.n.map((x, k) => round(x * keep + Math.abs(evidence[k] ?? 0))),
    at: Math.max(year, b.at),
  };
}

/** What a land's belief asks of each way in a year: so much more (or less) drawn to it, at most WAYS_LEARNING.most. */
export function waysPull(b: WaysBelief | undefined, year: number): number[] {
  if (!b) return WAY_TRAITS.map(() => 0);
  const keep = evidenceKept(year - b.at);
  return WAY_TRAITS.map((_, k) => {
    const a = (b.a[k] ?? 0) * keep,
      n = (b.n[k] ?? 0) * keep;
    return n > 0 ? (WAYS_LEARNING.most * a) / (n + LEARNING.prior) : 0;
  });
}
