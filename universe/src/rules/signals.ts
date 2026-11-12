// Carrying a signal far and fast, and seeing a world whole (signals, docs/architecture/first-principles-plan.md, "Signals", asked 2026-11-11: "the
// utility of phones and laptops and information age ... from first principles where this emerges if necessary", and "the whole
// world should technically be explored before they reach space"). Two functions, each a ladder of means read from what a land
// knows, and each means from what its world allows (the principles' own `needs`, `asks` and `media`: rules/principles.ts
// SIGNAL_TREE). What a land's signals do is one number, its `signal` effect, read where history already reads distance and
// delay: the margin traders see between markets, how far from its seat a host keeps in step, the share of a land's trades that
// is information work. Never a device, a person or a message. Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import type { Medium } from "./bodies.ts";

export type Knows = (id: string) => boolean;

/** The signal steps, in the order a land comes to them where its world allows each (rules/principles.ts SIGNAL_TREE). */
export const SIGNAL_STEPS: readonly string[] = [
  "telegraph",
  "telephone",
  "radio",
  "sea-sound",
  "computing",
  "hand-sets",
  "solid-state",
  "networks",
  "pocket-machines",
];

/**
 * A way a word goes far: what it asks a land to know (each list is any of), how far a word goes in a day by it, and what it is.
 * The speeds are a message's, not the medium's: a rider's relays, the key and its clerks at each station, an exchange's
 * operator, a voice on the air. (Estimates from Earth's own: the Persian post's 300 km a day, the mail train's, the telegraph's
 * hour from London to Bombay in 1870, minutes for a long-distance call.)
 */
export type WordWay = {
  readonly id: string;
  readonly by: readonly (readonly string[])[];
  readonly kmADay: number;
  /** What it is, on land and shore, and under water. */
  readonly name: string;
  readonly water?: string;
  /** Only for a people of these media. */
  readonly media?: readonly Medium[];
};

export const WORD_WAYS: readonly WordWay[] = [
  { id: "foot", by: [], kmADay: 40, name: "a runner", water: "a swimmer" },
  { id: "rider", by: [["riding"]], kmADay: 100, name: "a rider", media: ["land", "shore"] },
  {
    id: "current",
    by: [["current-reading"]],
    kmADay: 120,
    name: "a messenger riding the currents",
    media: ["water"],
  },
  { id: "ship", by: [["shipbuilding"]], kmADay: 150, name: "a letter by ship" },
  {
    id: "post",
    by: [["riding"], ["roads"]],
    kmADay: 300,
    name: "riders in relays on the post roads",
    media: ["land", "shore"],
  },
  { id: "rail", by: [["railways"]], kmADay: 800, name: "the mail train", media: ["land", "shore"] },
  { id: "wire", by: [["telegraph"]], kmADay: 24_000, name: "a word down the telegraph's wire" },
  {
    id: "voice",
    by: [["telephone"]],
    kmADay: 300_000,
    name: "a voice down the wire, through its exchanges",
  },
  {
    id: "sound",
    by: [["sea-sound"]],
    kmADay: 130_000,
    name: "a voice through the deep",
    media: ["water"],
  },
  {
    id: "air",
    by: [["radio"]],
    kmADay: 8_000_000,
    name: "a voice on waves through the air",
    media: ["land", "shore"],
  },
  { id: "web", by: [["networks"]], kmADay: 80_000_000, name: "words through a web of machines" },
];

/** The fastest way a word goes from a land, and how long it takes over a thousand kilometres. */
export function wordPace(
  knows: Knows,
  medium: Medium,
): {
  readonly way: WordWay;
  readonly kmADay: number;
  readonly days: number;
  readonly words: string;
} {
  let best = WORD_WAYS[0]!;
  for (const w of WORD_WAYS)
    if (
      (!w.media || w.media.includes(medium)) &&
      w.by.every((any) => any.some(knows)) &&
      w.kmADay > best.kmADay
    )
      best = w;
  const days = 1000 / best.kmADay;
  return { way: best, kmADay: best.kmADay, days, words: delayWords(days) };
}

/** A delay in words: "25 days", "an hour", "11 minutes", "a second". */
export function delayWords(days: number): string {
  const s = days * 86_400;
  if (s < 1.5) return s < 0.05 ? "a blink" : "a second";
  if (s < 90) return `${Math.round(s)} seconds`;
  if (s < 3000) return `${Math.round(s / 60)} minutes`;
  if (s < 5400) return "an hour";
  if (days < 1.5) return `${Math.round(s / 3600)} hours`;
  return `${Math.round(days)} days`;
}

/** A way's name for a people of a medium. */
export const wayName = (w: WordWay, medium: Medium): string =>
  medium === "water" && w.water ? w.water : w.name;

/**
 * A land's connectivity: the share of its dealings its signals put on the line, from its `signal` effect (0 before the
 * telegraph: letters and riders are what history was weighed by before it, so nothing reads them twice). At most 0.95.
 */
export const connectivityOf = (signal: number): number => dmath.clamp(signal, 0, 0.95);

/**
 * What connectivity does, where history reads distance and delay. Each is exactly what it was at 0.
 * - trade: traders see a far market's price the day it moves, so they move more of what is spare (a share 0.25 → 0.25 × (1 + 2c))
 *   and act on a narrower margin (its weight 2 → 2 × (1 + 2c)); what a journey costs in waiting on word and finding a buyer, a
 *   share of its cost, is gone (× (1 − 0.3c)): prices between markets come together faster.
 * - war: a host far from its seat keeps in step with it; the thinning of supply with each step is taken down by 0.6 × c.
 * - work: a share of a land's crafters and traders is information work, clerks at the key, operators at the exchange, makers
 *   of programs; their work multiplies what its carriers can move (1 + 2 × that share).
 * (Estimates: a measure of what the wire did to Earth's grain prices, Chicago against Liverpool, is a halving of the spread
 * within twenty years of the cable; information work is near half of the work of a land past the web.)
 */
export const SIGNAL = {
  tradeShare: 2,
  tradeMargin: 2,
  tradeCost: 0.3,
  warSteadied: 0.6,
  infoWork: 0.45,
  carriers: 2,
} as const;

/** The share of a land's crafters and traders whose work is information, at a connectivity. */
export const infoShare = (c: number): number => SIGNAL.infoWork * c;

// —— Seeing a world whole —————————————————————————————————————————————————————————————————————————————————

/**
 * A way a people sees far: what it asks a land to know, and how far it sees (in lands' steps over ground, over sea, or km by
 * air). Everything its world's surface holds is known to a people once one of its lands has something in orbit: a camera there
 * sees the whole of its world within a day's turning. Before that, from their own lands, a day's walk round; their ships' roads
 * and the coasts they make, and a way in from each; what a machine flies over and back; what a rocket sees from its height.
 */
export type SightWay = {
  readonly id: string;
  readonly name: string;
  readonly by: readonly (readonly string[])[];
};
export const SIGHT_WAYS: readonly SightWay[] = [
  { id: "feet", name: "their own lands and those about them", by: [] },
  {
    id: "ships",
    name: "the coasts their ships come to, and a way inland",
    by: [["sailing", "current-reading"]],
  },
  { id: "wings", name: "what their machines fly over and back", by: [["powered-wings"]] },
  { id: "rocket", name: "what a rocket sees from its height", by: [["rocketry"]] },
  { id: "orbit", name: "the whole of its world, from orbit", by: [["orbital-flight"]] },
];

/** Lands' steps over the ground a people knows about each of its lands, and inland from a coast its ships come to. */
export const SIGHT_STEPS = { feet: 2, inland: 2 } as const;
/** A sounding rocket's height (km): what it sees is the horizon from there. */
export const ROCKET_HEIGHT_KM = 150;

/** How far a rocket at its height sees over a world of a radius (km): the horizon, √(2Rh). */
export const rocketSightKm = (radiusKm: number): number =>
  dmath.sqrt(2 * radiusKm * ROCKET_HEIGHT_KM);
