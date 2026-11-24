// Life's kinds in play (Round D): new kinds branching where a stock is cut off and pressed, and the kinds that live with
// and off one another.
//
// Speciation: a stock cut off from its kind (on a small body of land, or one a risen sea has cut off) no longer mixes
// with it, and drifts and is selected apart a generation at a time: the shorter its generations (they go as its body's
// weight to about the third power: Kleiber's slow clock), the harder it is pressed (hunted, its ground's warmth turned),
// the sooner it is a kind of its own. Some thousands of generations apart, it is told a new kind. On a small land the
// large grow smaller (there is less to feed them, and no great hunter) and the small larger (nothing hunts them):
// Foster's island rule, the further the smaller the land.
//
// Partners: the eaters of the dead and the small hunters that pick a beast clean keep down what lives off it; the seed
// eaters and the browsers carry the seeds of what they eat to where it grows again. Parasites: a kind that lives off a
// beast persists where its hosts are close enough together for it to pass from one to the next (a threshold density,
// as for any sickness), its load rising toward one less one over how far past that threshold they crowd; what it takes
// of its host is its harm, chosen by the same trade-off as a sickness's (rules/pathogens.ts) for one that passes by touch.
import { dmath } from "../kernel/index.ts";
import { bestDeadliness } from "./pathogens.ts";

export const SPECIATION = {
  /** The generations a stock cut off must go apart, unpressed, to be a kind of its own. */
  generations: 3000,
  /** A beast of 1 kg breeds every year; its generation goes as its weight to this power. */
  clock: 0.3,
  /** How much harder each pressure drives it apart: hunted (its wild thinned to nothing), its ground turned a degree. */
  hunted: 2,
  perDegree: 0.4,
  /** Larger than this (kg) a beast grows smaller on a small land; smaller than the next, larger. */
  dwarfs: 100,
  giants: 5,
  /** A land this large (km²) is as a mainland to it. */
  mainland: 1e6,
} as const;

/** A beast's generation (years) by its weight (kg). */
export function generationYears(kg: number): number {
  return Math.max(0.2, dmath.pow(Math.max(0.001, kg), SPECIATION.clock));
}

/** How far a stock cut off goes apart a year (a share of the way to a kind of its own). */
export function divergence(kg: number, hunted: number, turnedDegrees: number): number {
  const press =
    1 +
    SPECIATION.hunted * dmath.clamp(hunted, 0, 1) +
    SPECIATION.perDegree * Math.abs(turnedDegrees);
  return press / (generationYears(kg) * SPECIATION.generations);
}

/** What a kind cut off on a land of this area grows to, against its parent (Foster's rule: the smaller the land, the more). */
export function islandSize(
  kg: number,
  areaKm2: number,
  hunted: boolean,
): { size: number; how: "smaller" | "larger" } {
  const small = dmath.clamp(
    1 - dmath.log10(Math.max(1, areaKm2)) / dmath.log10(SPECIATION.mainland),
    0,
    1,
  );
  if (kg >= SPECIATION.dwarfs || (kg > SPECIATION.giants && hunted))
    return { size: dmath.clamp(1 - 0.7 * small, 0.25, 0.95), how: "smaller" };
  return { size: dmath.clamp(1 + 1.5 * small, 1.05, 2.5), how: "larger" };
}

export const PARASITES = {
  /** The flocks' head a herder keeps. */
  headPerHerder: 8,
  /** Below this many head a km² of pasture a flock's parasites cannot pass from beast to beast. */
  threshold: 15,
  /** A land's wild stock (hundredths of the most it holds) below which its beasts' parasites die out. */
  wildThreshold: 40,
  /** How much of a parasite's passing the eaters of the dead and the small hunters each take away, at their full. */
  cleaners: 0.3,
  /** The share of the way a land's load goes a year toward what its hosts' crowding holds. */
  pace: 0.2,
  /** What the seed carriers add to a land's wild food, at their full. */
  carriers: 0.08,
} as const;

/** A parasite's load on a land's hosts (0 … 1): endemic at one less one over its reproduction (as a sickness's is). */
export function parasiteLoad(density: number, threshold: number, cleaned: number): number {
  const r0 =
    (Math.max(0, density) / Math.max(1e-6, threshold)) * (1 - dmath.clamp(cleaned, 0, 0.9));
  return r0 <= 1 ? 0 : 1 - 1 / r0;
}

/** What a parasite takes of its hosts' yield at a load: its harm by the trade-off of one passing by touch among them. */
export function parasiteToll(load: number, crowded: number): number {
  return dmath.clamp(load * 2 * bestDeadliness("touch", crowded), 0, 0.6);
}

// Selection in play (2026-11-23): a kind's stock carries heritable traits, each measured in its own spread (one standard
// deviation of the kind as made): its body's size, its coat (how much cold it is made for), its wariness. Each land asks
// something of them (its warmth against what the kind was made for, how hard its people hunt it), and the stock's mean
// moves toward what its lands ask a generation at a time by the breeder's equation, R = h²S: the response is the
// heritable share of the selection differential, S = (θ − z)/(1 + ω²) under fitness falling away about the best as a
// bell of width ω (Lande's). A stock behind a barrier moves toward what its own lands ask, while what crosses the barrier
// pulls it back (migration, m a generation); gone far enough apart, by drift and by what each side was selected for, it
// is a kind of its own.

/** The traits, in their order in every list of them. */
export const TRAITS = ["size", "coat", "wary"] as const;
export type Trait = (typeof TRAITS)[number];

export const SELECTION = {
  /** How much of each trait's spread is passed on (h²): the body's size the most, behaviour the least. */
  heritability: [0.45, 0.35, 0.25],
  /** The width of fitness about the best (ω², in spreads squared): the wider, the weaker selection. */
  width: 8,
  /** Degrees of warmth below what a kind was made for that ask a spread more coat, and a spread more size (Bergmann's rule). */
  coatDegrees: 4,
  sizeDegrees: 8,
  /** Spreads of wariness a stock hunted to nothing is pressed toward, and of size it is pressed down (the hunt takes the largest). */
  waryHunted: 2.5,
  sizeHunted: 1.2,
  /** The most a trait goes from the kind as made, in spreads. */
  most: 3,
  /** A spread of size is so much of the body's weight (on its log). */
  sizePerSpread: 0.1,
  /** What of a hunt the warier escape, at three spreads. */
  escape: 0.4,
  /** A kind's trait gone this many spreads from where it was first seen is told. */
  told: 1,
} as const;

/** What a land asks of a kind's traits (spreads): `colder` its warmth below what the kind was made for (°C), `hunted` 0 … 1. */
export function traitsAsked(colder: number, hunted: number): [number, number, number] {
  const h = dmath.clamp(hunted, 0, 1),
    m = SELECTION.most;
  return [
    dmath.clamp(colder / SELECTION.sizeDegrees - SELECTION.sizeHunted * h, -m, m),
    dmath.clamp(colder / SELECTION.coatDegrees, -m, m),
    dmath.clamp(SELECTION.waryHunted * h, -m, m),
  ];
}

/** A trait's mean after so many generations of selection toward `asked` (the breeder's equation, step on step). */
export function selected(z: number, asked: number, generations: number, trait: number): number {
  const k = SELECTION.heritability[trait]! / (1 + SELECTION.width);
  return asked + (z - asked) * dmath.pow(1 - k, Math.max(0, generations));
}

/** A stock's mean pulled toward the stock beyond its barrier by what crosses it (`m` a generation). */
export function migrated(z: number, other: number, m: number, generations: number): number {
  return other + (z - other) * dmath.pow(1 - dmath.clamp(m, 0, 1), Math.max(0, generations));
}

/**
 * How a stock fares against how it fared as made, for its traits against what its land asks now (`gap`) and asked as made
 * (`gap0`), both in spreads: mean fitness under the bell falls as the square of the gap (Lande's load).
 */
export function traitFit(gap: number, gap0: number): number {
  return dmath.clamp(
    dmath.exp(-(gap * gap - gap0 * gap0) / (2 * (SELECTION.width + 1))),
    0.3,
    1.15,
  );
}

/** What of a hunt a stock of this wariness escapes (spreads; none for the unwary). */
export function waryEscape(wary: number): number {
  return SELECTION.escape * dmath.clamp(wary / SELECTION.most, 0, 1);
}

/**
 * What lies between a stock and the rest of its kind, and what crosses it a generation (the share of a stock's breeders
 * come from beyond): heights a body must climb; dry or frozen ground it cannot feed on; a great river; the sea; and, with
 * nothing between, the length of a range itself, its far end bred mostly of its own (Wright's isolation by distance).
 * Read off the ground between, never its name.
 */
export const BARRIERS = {
  heights: 0.004,
  dry: 0.006,
  cold: 0.005,
  river: 0.01,
  sea: 0.002,
  far: 0.02,
} as const;
export type Barrier = keyof typeof BARRIERS;

export const ISOLATES = {
  /** Ground this high (m) is heights to a beast. */
  heights: 2200,
  /** A river carrying this much (of its world's greatest, by the root) parts what lives on either bank. */
  river: 0.25,
  /** A stock behind a barrier must hold at least so many lands of its kind to be one. */
  least: 2,
  /**
   * How much faster a parted stock grows apart for each spread (squared, over its traits as a distance) selection holds
   * it from the rest: what each side is bred for, it is bred away from the other (isolation as a by-product of selection).
   */
  press: 7,
  /** How much of an island's drift a stock behind a barrier keeps (what crosses it mixes some back). */
  drift: 0.5,
  /** The most stocks behind barriers a world keeps track of. */
  most: 48,
  /**
   * A range of at least so many lands has far ends: its lands whose warmth asks a coat at least `cline` spreads from what
   * the range as a whole asks, so many of them together at the least, are a stock of their own by distance.
   */
  span: 30,
  cline: 1,
  endLeast: 4,
} as const;

/**
 * How far a stock behind a barrier goes toward a kind of its own a year (a share of the way): its drift, as an island's
 * (`divergence`) but for what crosses, and the faster the further selection holds it from the rest (`gap`, spreads),
 * a generation at a time.
 */
export function apartness(kg: number, gap: number, hunted: number, turnedDegrees: number): number {
  return (
    ISOLATES.drift * divergence(kg, hunted, turnedDegrees) +
    (ISOLATES.press * gap * gap) / (generationYears(kg) * SPECIATION.generations)
  );
}
