// Crops tamed and carried (the sweep, Nature lane): a crop is a wild plant a people has sown and reaped long enough for its
// seed to change. A wild grass sown gives less than a tamed one: its ears shatter before they are cut and its seeds sprout
// unevenly; each harvest cut with a sickle and sown again from what was cut keeps the seeds that stayed on the ear, so over
// the generations the stand turns to one that waits to be reaped (the domestication syndrome). The heavier its seed, the
// faster the turn (what is sown is what was cut, and a heavy seed is cut first); a crop grown from cuttings and tubers turns
// more slowly, a generation being some years. And a crop fits the land it was bred on: its warmth, its rain, and the length of
// its days (a crop flowers by the day's length: bred at one latitude, it flowers at the wrong time far to the north or south of
// it). Carried to a land like its own, it gives as at home; carried across many degrees of latitude it gives little until it has
// been sown there long enough to fit, so crops pass readily along a continent's east and west and slowly along its north and
// south (Diamond 1997, from the plants' own day lengths). Where two peoples meet, by land or sea, each takes up the other's
// crop where it would give more: the exchange of crops on contact.
//
// Pure tables and functions: sim/ecology/crops.ts keeps each land's crop. Estimates are marked "est".
import { dmath } from "../kernel/index.ts";

export const CROPS = {
  /**
   * Years a wild grass, sown and reaped as early farmers did, takes to turn into a tamed crop at an average seed and an
   * average share of its land sown (est: Hillman and Davies 1990 found 20 to 200 years under a sickle's strong selection; the
   * archaeology some 1,000 to 2,000, harvests cut green and seed gathered from the ground).
   */
  tameYears: 1000,
  /** A crop of roots and fruit, grown from cuttings and tubers, a generation some years: slower (est). */
  gardenYears: 3000,
  /** What a wild stand sown gives against its tamed crop's harvest (est: most of a wild stand's seed falls before the cut). */
  wild: 0.6,
  /** The seed's weight a crop of roots and fruit is reckoned at, against a grass's (0 … 1), and a sea people's beds (est). */
  gardenSeed: 0.5,
  /**
   * How the seed's weight tells in a harvest: a crop gives as 0.7 + 0.6 × its seed (est: the great cereals' heavy grain
   * against a wild grass's), each land's own against its own best wild plant, so a land sowing its own gives as it always did.
   */
  seedBase: 0.7,
  seedGain: 0.6,
  /** The most a crop carried from afar gives against the land's own best (est). */
  most: 1.5,
  /** Within this many degrees of latitude of where it was bred a crop's days are its own; past it, it fits less (est). */
  dayBand: 6,
  /** How fast its fit falls past that band (degrees: a crop 12° further north or south gives some six in ten). */
  dayWidth: 12,
  /** Past its warmth's tolerance a crop's fit falls with this many of its tolerances (est). */
  warmWidth: 1,
  /** The least a crop gives on the land it fits worst, if it is sown there at all (est). */
  least: 0.25,
  /** The share of the way a crop's warmth and days move toward its land's in a year of sowing there (est: some five centuries). */
  adapt: 1 / 500,
  /** A land takes up a crop it has met where it would give this much more than its own (est: a tenth). */
  better: 1.1,
  /** A crop of roots and fruit: how far from its warmth it bears (°C), and its rain from half to twice its own (est). */
  gardenTolerance: 8,
} as const;

/** What a crop's harvest is against its tamed self's: from a wild stand sown (CROPS.wild) to all of it. */
export function cropYield(tame: number): number {
  return CROPS.wild + (1 - CROPS.wild) * dmath.clamp(tame, 0, 1);
}

/**
 * How far toward tamed a crop goes in `years` of sowing: by its seed's weight (0 … 1), the share of its land's farmland
 * its fields use (more sown, more selected), and whether it is grown from cuttings and tubers.
 */
export function tameStep(
  tame: number,
  years: number,
  seed: number,
  farmed: number,
  garden: boolean,
): number {
  const pace =
    ((0.5 + dmath.clamp(seed, 0, 1)) * (0.5 + dmath.clamp(farmed, 0, 1))) /
    (garden ? CROPS.gardenYears : CROPS.tameYears);
  return Math.min(1, Math.max(0, tame) + pace * Math.max(0, years));
}

/** What a crop of this seed's weight gives, as its share of the harvest (before its fit and tameness). */
export function seedWorth(seed: number): number {
  return CROPS.seedBase + CROPS.seedGain * dmath.clamp(seed, 0, 1);
}

/** A crop as bred: the warmth and the latitude it fits (degrees; latitude north or south alike), and its range. */
export type CropStrain = {
  readonly warm: number;
  readonly lat: number;
  readonly tolerance: number;
  readonly rainMin: number;
  readonly rainMax: number;
};

/** A land a crop is sown on: its warmth (°C), its rain (mm), its latitude (degrees, north or south alike). */
export type CropField = { readonly warm: number; readonly rain: number; readonly lat: number };

/** How well a crop fits a land (CROPS.least … 1): its warmth within its tolerance, its rain within its range, its days. */
export function cropFit(s: CropStrain, f: CropField): number {
  const tol = Math.max(1, s.tolerance),
    off = Math.max(0, Math.abs(f.warm - s.warm) - tol) / (tol * CROPS.warmWidth),
    warm = dmath.exp(-0.5 * off * off),
    rain =
      f.rain < s.rainMin
        ? Math.max(0, f.rain) / Math.max(1, s.rainMin)
        : f.rain > s.rainMax
          ? Math.sqrt(s.rainMax / Math.max(1, f.rain))
          : 1,
    dl = Math.max(0, Math.abs(Math.abs(f.lat) - Math.abs(s.lat)) - CROPS.dayBand) / CROPS.dayWidth,
    day = dmath.exp(-0.5 * dl * dl);
  return Math.max(CROPS.least, warm * rain * day);
}

/** A crop's warmth and days after `years` of sowing on a land: some of the way toward the land's own. */
export function adaptStep(s: CropStrain, f: CropField, years: number): CropStrain {
  const k = 1 - dmath.pow(1 - CROPS.adapt, Math.max(0, years));
  return {
    ...s,
    warm: s.warm + k * (f.warm - s.warm),
    lat: Math.abs(s.lat) + k * (Math.abs(f.lat) - Math.abs(s.lat)),
  };
}

/**
 * What a land's crop gives against what its fields always gave (the land's own best wild plant, tamed and bred there): its
 * tameness, its fit, and its seed's weight against the land's own.
 */
export function cropGives(tame: number, fit: number, seed: number, ownSeed: number): number {
  return Math.min(CROPS.most, (cropYield(tame) * fit * seedWorth(seed)) / seedWorth(ownSeed));
}

/** A crop of roots and fruit (or a sea people's beds) bred on a land: it fits that land. */
export function gardenStrain(f: CropField): CropStrain {
  return {
    warm: f.warm,
    lat: Math.abs(f.lat),
    tolerance: CROPS.gardenTolerance,
    rainMin: Math.round(Math.max(0, f.rain) * 0.5),
    rainMax: Math.round(Math.max(0, f.rain) * 2 + 100),
  };
}
