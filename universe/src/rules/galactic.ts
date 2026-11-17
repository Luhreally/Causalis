// The galaxy's own fire (the Frontier lane): the great stars that die as supernovae, the white dwarfs that blow up, and the
// rarer bursts of gamma rays, by where home lies in its galaxy. Great stars are born in the spiral arms and live only a few
// million years, so they die where they were born: an arm holds most of them, the disk's inner parts more than its outer.
// Near the Sun's place a supernova comes within 26 light-years (where it strips half the ozone: Gehrels et al. 2003)
// some once in 700 million years; a burst aimed this way within a few thousand some once in half a billion (Melott and
// Thomas 2011). Far rarer than a chronicle is long, as they should be: they fall on the deep years, and on some world in
// some chronicle. A great star dying anywhere a people can see by eye is a new star in its sky some once in two centuries
// (the guest stars of 185, 1006, 1054, 1181, 1572, 1604).
//
// What the burst does to a world: its ozone stripped, its people's deaths higher and its fields' yields lower under the
// light that comes through for some twenty years (rules/planet.ts burstHarm, by distance and its field's shelter).
// Pure tables and functions.
import { dmath } from "../kernel/index.ts";

export const GALACTIC = {
  /** Supernovae a year a cubic light-year at the Sun's place: 1.5 a Gyr within 8 parsecs (est, Gehrels et al. 2003). */
  supernovaLy3: 1.5e-9 / ((4 / 3) * Math.PI * 26 * 26 * 26),
  /** Of them, the share from white dwarfs blowing up, spread through the disk and not in the arms (est). */
  whiteShare: 0.25,
  /** How many times thicker the great stars lie along an arm than between (est from the arms' young stars). */
  armContrast: 3,
  /** The Sun's distance from its galaxy's middle (ly). */
  sunRadiusLy: 26_000,
  /** Within this many light-years a supernova's burst harms a world (rules/planet.ts harmLy's twice: its light is felt). */
  reachLy: 52,
  /** A burst of gamma rays at a world harmful enough to strip a third of its ozone: a year's chance at the Sun's place (est). */
  burstPerYear: 2e-9,
  /** The years a gamma burst's harm lasts, and its harm against a supernova's at the edge of its reach (est). */
  burstYears: 15,
  burstHarm: 1.6,
  /** New stars seen by eye a year, at the Sun's place in its galaxy (est from the guest stars of record). */
  guestPerYear: 1 / 200,
  /** The share of a world's fields' yields lost for each share more of its deaths under a burst (UV on leaves, est). */
  fieldsPerHarm: 0.5,
} as const;

/** The galaxy's shape as these rules read it (gen/galaxy.ts Galaxy). */
export type GalaxyShape = {
  readonly radius: number;
  readonly scale: number;
  readonly arms: number;
  readonly pitch: number;
  readonly homeRadius: number;
  readonly homeAngle: number;
};

/** How far into an arm home lies: 1 at its crest, −1 between (the logarithmic spiral of gen/galaxy.ts densityAt). */
export function armPhase(g: GalaxyShape): number {
  const pitch = (g.pitch * Math.PI) / 180;
  return dmath.cos(
    g.arms * (g.homeAngle - dmath.log(Math.max(1, g.homeRadius)) / dmath.tan(pitch)),
  );
}

/** How many more great stars die about home than at the Sun's place: its arm and its distance from the middle. */
export function youngStarsAt(g: GalaxyShape): number {
  const c = GALACTIC.armContrast,
    // (The Sun lies at an arm's edge: its own phase reads about zero, and its stars as many as the mean.)
    arm = (1 + (c - 1) * Math.max(0, armPhase(g))) / ((1 + c) / 2),
    radial = dmath.exp(-(g.homeRadius - GALACTIC.sunRadiusLy) / Math.max(1000, g.scale));
  return Math.max(0.05, arm) * dmath.clamp(radial, 0.05, 20);
}

/** Supernovae a year within so many light-years of home. */
export function supernovaRate(g: GalaxyShape, withinLy: number): number {
  const k = GALACTIC,
    v = (4 / 3) * Math.PI * withinLy * withinLy * withinLy,
    radial = dmath.clamp(
      dmath.exp(-(g.homeRadius - k.sunRadiusLy) / Math.max(1000, g.scale)),
      0.05,
      20,
    );
  return k.supernovaLy3 * v * ((1 - k.whiteShare) * youngStarsAt(g) + k.whiteShare * radial);
}

/** Bursts of gamma rays a year harmful at home: where great stars die oftener, oftener. */
export const gammaRate = (g: GalaxyShape): number => GALACTIC.burstPerYear * youngStarsAt(g);

/** New stars seen by eye a year from home. */
export const guestRate = (g: GalaxyShape): number => GALACTIC.guestPerYear * youngStarsAt(g);

/** A distance for a supernova within `reach`, from a draw: as many in each shell as its volume holds. */
export const burstDistance = (u: number, reach: number): number =>
  reach * dmath.cbrt(Math.max(1e-6, Math.min(1, u)));

/** What a burst's harm takes of a land's fields (1: none), by what it lays on deaths. */
export function fieldsUnderBurst(harm: number): number {
  return dmath.clamp(1 - GALACTIC.fieldsPerHarm * Math.max(0, harm - 1), 0.3, 1);
}
