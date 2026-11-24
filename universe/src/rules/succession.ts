// Woods coming back (the sweep, Nature lane): a cleared or burned land's woods return as fast as its ground grows things, its
// grass and shrubs first and its trees over them: a wet, warm land's in a few decades, a cold or dry one's over centuries.
// How fast a land grows is its net primary production, read off its warmth and its rain by Lieth's Miami model (1975: the least
// of what its warmth and its rain allow); its woods' regrowth goes as that against the temperate woods' the ecology's pace was
// set by. Pure functions; sim/ecology/ecology.ts steps the woods by it.
import { dmath } from "../kernel/index.ts";

export const SUCCESSION = {
  /** The Miami model: the most a land grows (g of dry matter a m² a year), and its warmth's and its rain's terms. */
  most: 3000,
  warmA: 1.315,
  warmB: 0.119,
  rainK: 0.000664,
  /** What temperate woods grow (10 °C, 800 mm: some 1,240 g/m²): where the woods' old pace holds. */
  temperate: 1236,
  /** Its pace no less and no more than these many times the temperate woods' (est). */
  least: 0.15,
  fastest: 2.5,
} as const;

/** A land's net primary production (g/m² a year) by its warmth (degrees) and its rain (mm a year). */
export function primaryGrowth(warm: number, rainMm: number): number {
  const s = SUCCESSION,
    byWarm = s.most / (1 + dmath.exp(s.warmA - s.warmB * warm)),
    byRain = s.most * (1 - dmath.exp(-s.rainK * Math.max(0, rainMm)));
  return Math.min(byWarm, byRain);
}

/** How fast a land's woods come back (a share of what is missing a year), its pace at temperate woods' growth `base`. */
export function regrowthPace(base: number, warm: number, rainMm: number): number {
  return (
    base *
    dmath.clamp(
      primaryGrowth(warm, rainMm) / SUCCESSION.temperate,
      SUCCESSION.least,
      SUCCESSION.fastest,
    )
  );
}

/**
 * A land's woods' age (the sweep, Nature lane): the mean age of its trees. Woods let alone stand at their climax, old trees dying
 * and young ones filling their gaps (the mean age moves as 1 − age / climax a year); woods cut keep the age of what is left;
 * woods coming back bring young trees, the new growth as old as half the years it took.
 */
export const STAND = {
  /** The mean age of old woods let alone (years, est: temperate and tropical old growth, trees of 100 to 400 years). */
  climax: 250,
  /**
   * What young woods add to a land's game, wholly young and wholly wooded (est: a cut or burned wood's first decades of shoots,
   * shrubs and edges feed browsers and their hunters some half again over a closed old canopy), and the years over which the
   * gain fades by e as the canopy closes.
   */
  young: 0.5,
  youngYears: 20,
} as const;

/** What a land's woods' age adds to its game (1 at old growth): young regrowth browses the more, by its share of the land. */
export function youngGame(age: number, forest: number): number {
  return (
    1 + STAND.young * dmath.clamp(forest, 0, 1) * dmath.exp(-Math.max(0, age) / STAND.youngYears)
  );
}

/** A land's woods' mean age after `years`, their share of the land going from `before` to `after`. */
export function standStep(age: number, before: number, after: number, years = 1): number {
  const aged = age + years * (1 - age / STAND.climax);
  if (after <= before || after <= 0) return aged;
  return (before * aged + ((after - before) * years) / 2) / after;
}
