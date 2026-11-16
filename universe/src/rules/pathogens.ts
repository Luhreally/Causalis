// Pathogens that evolve (Round D). A sickness is a life that lives on its host, and what it is (how it passes, how many
// it reaches, how many it kills, which kinds it can live in) is selected as it passes from host to host, as any life's
// is. The rules are the epidemiologists':
// - The trade-off: a sickness that takes more from its host makes more of itself to pass on, but a host it kills, or
//   lays up, passes it no more. Its spread goes as its harm to a power under one, so there is a harm that spreads it
//   best (Anderson & May). How much a host must walk about to pass it sets that power: a sickness of the breath or of
//   touch needs its host up and about, one carried by foul water or by vermin does not (Ewald), so these grow deadlier.
// - Crowding: among many hosts close together, one that kills its host fast still finds the next, and the deadliest
//   strain within a host wins the host (short-sighted evolution): a sickness burning in great crowds grows deadlier.
// - Immunity: where most are spared it, a strain the spared are not spared spreads where the old cannot; so a sickness
//   whose survivors are spared for life throws up new strains, the more the more are spared.
// - Host range: a sickness come from herds or carried by vermin can live in more than one kind; as it passes among one
//   people it fits them and narrows. While it can still live in the herds, it waits in them and comes back to the
//   people who keep them.
// Pure functions; sim/health/strains.ts keeps each sickness's line and steps it yearly.
import { dmath } from "../kernel/index.ts";

/** How much a sickness's passing needs its host up and about, by how it passes (0: not at all). */
export const MOBILITY: Readonly<Record<string, number>> = {
  breath: 0.9,
  touch: 0.85,
  water: 0.6,
  vermin: 0.5,
};

/** The trade-off's power at the full (a host that need not walk about at all). */
export const TRADE_OFF = 0.5;

export const EVOLVE = {
  /** Crowds this many in the lands it burns in double the harm that spreads it best. */
  crowd: 40000,
  /** The share of the way to what selection favours it goes in a year, at the most (a great epidemic's). */
  pace: 0.12,
  /** Hosts taken a year for selection to move at its full pace. */
  full: 100000,
  /** A new strain's chance a year at the full (all spared, a great epidemic, survivors spared for life). */
  strain: 0.25,
  /** Of the spared of the old strain, the share spared the new. */
  cross: 0.5,
  /** How far a new strain's harm and reach fall from its parent's (a share, either way). */
  drift: 0.3,
  /** The share of its host range a sickness loses a year as it passes among one people. */
  narrows: 0.015,
  /** Held in herds while its range reaches this far, it can come back to those who keep them. */
  reservoir: 0.3,
  /** A sleeping sickness held in herds comes back to a herding land this often a year, at the full range. */
  spill: 0.04,
} as const;

/** How wide a new sickness's host range is (0: its people alone, 1: any kind of its world's life), by where it rose. */
export const FIRST_RANGE: Readonly<Record<string, number>> = {
  herds: 0.6,
  marsh: 0.45,
  crowds: 0.1,
  "the god": 0.3,
  "the stars": 0.15,
};

/** The harm (a share of those it takes who die) that spreads a sickness best: by how it passes and how crowded its hosts. */
export function bestDeadliness(route: string, crowded: number): number {
  const k = TRADE_OFF * (1 - (MOBILITY[route] ?? 0.8)),
    crowd = 1 + Math.max(0, crowded) / EVOLVE.crowd;
  return dmath.clamp((k * crowd) / (1 + k * crowd), 0.002, 0.6);
}

/**
 * Where a sickness's reach stands on its trade-off for a harm: its reach as it rose, by its harm against as it rose to the
 * trade-off's power (more harm, more of it to pass on).
 */
export function reachFor(
  route: string,
  deadliness: number,
  first: { reach: number; deadliness: number },
): number {
  const k = TRADE_OFF * (1 - (MOBILITY[route] ?? 0.8));
  return dmath.clamp(
    first.reach * dmath.pow(Math.max(1e-4, deadliness) / Math.max(1e-4, first.deadliness), k),
    0.05,
    0.95,
  );
}

/** How far selection moves a sickness this year: by how many hosts it took (the more, the more it is tried). */
export function selectionPace(taken: number): number {
  if (taken <= 0) return 0;
  return EVOLVE.pace * Math.min(1, dmath.log10(1 + taken) / dmath.log10(1 + EVOLVE.full));
}

/** A new strain's chance this year: by how many are spared it, how many it took, and how long its survivors are spared. */
export function strainChance(spared: number, taken: number, lasting: number): number {
  return (
    EVOLVE.strain *
    Math.max(0, Math.min(1, spared)) *
    Math.min(1, taken / EVOLVE.full) *
    Math.min(1, lasting / 60)
  );
}
