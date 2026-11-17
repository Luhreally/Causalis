// A star's own weather (the Frontier lane): its flares and the storms they send, by what kind of star it is. A star spins
// fast when young and its spin drives a churning field that snaps in flares; it brakes as its wind carries the spin off,
// and flares fewer the older it is (Skumanich's spin-down). A small red star churns through and through, and stays young
// in this for billions of years. How many flares come at each strength falls by a power of the strength (Kepler's and
// TESS's superflares, the Sun's own): one as great as 1859's Carrington flare on the Sun some once in 150 years.
//
// What a storm does at a world is its flare's strength over the square of the distance. Over its ground: a field turns
// the particles aside and they ring in it, and the ringing drives currents along every long wire laid on the ground, which
// burn the great transformers (Quebec, 1989, at some fifth of 1859's); where there is no field, they reach the air and
// ground instead. Its people are of its sky: what it lays on them every year is what they arose under, and only a storm
// past what they have known harms them. Halls of another world are built against its sky and harmed by its mean.
//
// Pure tables and functions: the same numbers for a page and for history.
import { dmath } from "../kernel/index.ts";

export const STAR_WEATHER = {
  /** A Carrington flare's energy (J): the yardstick (1859, some 5e25 J by its light). */
  carringtonJ: 5e25,
  /** Flares a year as great as a Carrington on a star still spinning fast, saturated (est: young suns and active red dwarfs). */
  saturated: 2,
  /** ...on the Sun at its age now: one in some 150 years (est from 1859, 1921 and the trees' rings of 774). */
  sunRate: 1 / 150,
  sunAgeGyr: 4.6,
  /** How many flares come at each strength: N(>E) ∝ E^-slope (0.8, the superflares' and the Sun's). */
  slope: 0.8,
  /** The greatest flare a star of the churning kind gives, in Carringtons (some 1e36 erg, the greatest seen on red dwarfs). */
  most: 2000,
  /** Past this mass a star's outer layers no longer churn and it flares little (an A star's: est). */
  calmFrom: 1.5,
  /** A storm at a world from which its long wires begin to burn their transformers, in Carringtons at it (1989's was a fifth). */
  gridFrom: 0.5,
  /** The share of a grid's transformers lost per tenfold of a storm past that (est from studies of a new 1859). */
  gridLoss: 0.3,
  /** A grid is built to bear so many times the greatest storm its world knows in a usual year, and its first harm at least (est). */
  design: 30,
  /** What a warning of a day or two takes off the loss, the grids switched apart (est), and a grid rebuilt against storms. */
  warned: 0.5,
  hardened: 0.3,
  /** Under no field, the storm's currents in the ground are this share of a field's (the particles come down instead). */
  unfielded: 0.2,
  /** The share of a land's people who die for each share of its grid lost: months without power, water or heat (est). */
  darkDead: 0.003,
  /** A storm told as a great one when it is this many times its world's usual yearly greatest, and as great as a grid's first harm (some once in 25 years about a red dwarf, a century at Earth). */
  told: 30,
  /** How a storm past the usual raises the deaths of a world's people where its field lets it through, and the most. */
  harm: 0.05,
  harmMost: 3,
  /** What a year's mean storm (Carringtons at it) lays on sealed halls of another world: deaths a share higher, and the most. */
  halls: 5e-5,
  hallsMost: 1,
} as const;

/** How long a star stays spinning fast and flaring at its height (Gyr): a Sun's few hundred million years, a small red star's eight billion (est from West et al. 2008). */
export function activeGyr(mass: number): number {
  const deep = dmath.clamp((0.9 - mass) / 0.75, 0, 1);
  return 0.3 + 7.5 * dmath.pow(deep, 1.5);
}

/** How fast a star's flaring falls once it has slowed: solved so that the Sun at its age now flares as it does. */
export const SPIN_DOWN =
  dmath.log(STAR_WEATHER.saturated / STAR_WEATHER.sunRate) /
  dmath.log(STAR_WEATHER.sunAgeGyr / activeGyr(1));

/** Flares a year at least as great as a Carrington, for a star of this mass and age. */
export function flareRate(mass: number, ageGyr: number): number {
  const w = STAR_WEATHER,
    active = activeGyr(mass),
    churn = dmath.clamp((w.calmFrom - mass) / 0.5, 0.05, 1),
    age = Math.max(0.01, ageGyr);
  return churn * w.saturated * (age <= active ? 1 : dmath.pow(active / age, SPIN_DOWN));
}

/** The greatest flare of so many years, from a draw (0 … 1): in Carringtons at the star, no greater than the most. */
export function greatestFlare(u: number, rate: number, years: number): number {
  const w = STAR_WEATHER,
    n = rate * Math.max(0, years);
  if (n <= 0) return 0;
  // (The greatest of a Poisson's flares: P(none past E) = exp(-n E^-slope).)
  const e = dmath.pow(n / Math.max(1e-12, -dmath.log(Math.max(1e-12, u))), 1 / w.slope);
  return Math.min(w.most, e);
}

/** A world's usual yearly greatest storm (the middle of its years), in Carringtons at it. */
export function usualStorm(rate: number, au: number): number {
  const e = dmath.pow(rate / dmath.LN2, 1 / STAR_WEATHER.slope);
  return Math.min(STAR_WEATHER.most, e) / Math.max(1e-4, au * au);
}

/** A year's storms summed, on the mean, in Carringtons at a world so far out (∫ of the slope's flares up to the most). */
export function meanStorms(rate: number, au: number): number {
  const w = STAR_WEATHER,
    k = 1 - w.slope,
    sum = ((rate * w.slope) / k) * (dmath.pow(w.most, k) - 1);
  return sum / Math.max(1e-4, au * au);
}

/** The storm a flare of so many Carringtons makes at a world so far out (AU). */
export const stormAt = (flare: number, au: number): number => flare / Math.max(1e-4, au * au);

/**
 * The share of a land's grid a storm burns out: by the storm at the world, how near the land lies to the poles (0 … 1, the
 * sine of its latitude: the ringing comes down about the poles), whether the world has a field, a warning and a grid
 * rebuilt against it. A grid is built for its world's sky: to bear its first harm, or what its builders have known many
 * times over where its star storms more. Exactly 0 under what it was built to bear.
 */
export function gridLost(
  storm: number,
  polar: number,
  field: boolean,
  warned: boolean,
  hardened: boolean,
  usual = 0,
): number {
  const w = STAR_WEATHER,
    p = dmath.clamp(polar, 0, 1),
    ground = storm * (0.3 + 0.7 * p * p) * (field ? 1 : w.unfielded),
    bears = Math.max(w.gridFrom, w.design * Math.max(0, usual));
  if (ground <= bears) return 0;
  const loss = Math.min(0.8, w.gridLoss * dmath.log10(ground / bears));
  return loss * (warned ? w.warned : 1) * (hardened ? w.hardened : 1);
}

/** What a storm past a world's usual lays on its people's deaths before its field (1: nothing past what they know). */
export function stormHarm(storm: number, usual: number): number {
  const w = STAR_WEATHER,
    past = storm / Math.max(1e-9, usual) - 3;
  return past > 0 ? 1 + Math.min(w.harmMost, w.harm * past) : 1;
}

/** What a year's mean storms lay on sealed halls of another world (1: nothing), the less where they are buried against its sky. */
export function hallsUnder(mean: number, buried: boolean): number {
  const w = STAR_WEATHER,
    k = Math.min(w.hallsMost, w.halls * Math.max(0, mean));
  return 1 + k * (buried ? 0.3 : 1);
}
