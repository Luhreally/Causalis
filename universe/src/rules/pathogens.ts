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
  /**
   * Hosts a land at which a sickness's harm that spreads it best is half again what it is among few (short-sighted evolution:
   * the deadliest strain within a host wins it where hosts carry more than one, as they do the more the more crowded; but a
   * host carries one strain or several, so crowding can no more than double it). As first set, crowds lifted it without end,
   * and on first light at 700, its lands some 700 thousand strong, a foul-water sickness was selected to kill six in ten it
   * took.
   */
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
  // (Of wild beasts hunted: of another kind, as the herds' are, but met only in the hunt.)
  wild: 0.5,
  crowds: 0.1,
  "the god": 0.3,
  "the stars": 0.15,
};

/**
 * How much a sickness's passing needs its host up and about, where it burns: one of foul water passes as one of touch where
 * drains and clean water keep it from the water (`drained`, the share of its hosts so kept), and is selected milder there, as
 * Ewald has it of cholera.
 */
export function mobilityOf(route: string, drained = 0): number {
  const m = MOBILITY[route] ?? 0.8;
  return route === "water" ? m + dmath.clamp(drained, 0, 1) * (MOBILITY.touch! - m) : m;
}

/** A host's years, over which a sickness that spares its survivors only a while comes back on it (as health.ts's "for life"). */
export const HOST_YEARS = 60;

/**
 * The harm (a share of those it takes who die) that spreads a sickness best: by how it passes, how crowded its hosts, the
 * share of them kept from foul water, and how long it spares those it leaves. A sickness that spares its survivors only a while
 * comes back on the same hosts again and again, and a host it kills is every later bout's passing lost: the harm that spreads
 * it best is the less by as many bouts as a host's life holds (a share, `lasting` years of HOST_YEARS). As first set it was
 * selected as deadly as one met once, and a foul-water cramps of alien 55 that spares five years killed a fifth of those it
 * took every five years: 40 million of 63 million in fifty years.
 */
export function bestDeadliness(
  route: string,
  crowded: number,
  drained = 0,
  lasting = HOST_YEARS,
): number {
  const k =
      TRADE_OFF *
      (1 - mobilityOf(route, drained)) *
      dmath.clamp(lasting / HOST_YEARS, 1 / HOST_YEARS, 1),
    c = Math.max(0, crowded),
    crowd = 1 + c / (c + EVOLVE.crowd);
  return dmath.clamp((k * crowd) / (1 + k * crowd), 0.002, 0.6);
}

/**
 * Where a sickness's reach stands on its trade-off for a harm: as many as it passes to before its host is well or dead. It
 * makes more of itself to pass on the more it takes of its host (its harm over its host's mending, to the trade-off's power),
 * but has the less time to, the more it kills: so reach rises with harm toward the harm that spreads it best and falls past it.
 * (As first set reach rose with harm alone, and a foul-water flux selected to kill a quarter came to take nine in ten of those
 * it reached, a black death every fourteen years.)
 */
export function reachFor(
  route: string,
  deadliness: number,
  first: { reach: number; deadliness: number },
  drained = 0,
  lasting = HOST_YEARS,
): number {
  const k =
      TRADE_OFF *
      (1 - mobilityOf(route, drained)) *
      dmath.clamp(lasting / HOST_YEARS, 1 / HOST_YEARS, 1),
    // (Its passing as harm against mending, x = d / (1 - d), to the power k, over the time a host carries it, 1 + x.)
    spread = (d: number) => {
      const x = dmath.clamp(d, 1e-4, 0.95) / (1 - dmath.clamp(d, 1e-4, 0.95));
      return dmath.pow(x, k) / (1 + x);
    };
  return dmath.clamp((first.reach * spread(deadliness)) / spread(first.deadliness), 0.05, 0.95);
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
