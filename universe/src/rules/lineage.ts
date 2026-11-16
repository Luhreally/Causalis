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
