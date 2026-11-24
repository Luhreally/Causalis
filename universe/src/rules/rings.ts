// Rings and worlds without a star (the planet's last gaps, 2026-11-24). A ring is a moon that came inside its planet's Roche
// limit, where the planet's tide across the moon outdoes the moon's own pull on itself and it is torn to pieces: the limit is
// the planet's radius by 2.44 by the cube root of the planet's density over the moon's (a fluid body's). So light giants keep
// rings of ice far out, and dense rocky worlds would tear a rock moon only close in. A world without a star was flung out of
// its system by a giant's pull while the system was young: a galaxy holds as many as its giants threw out.
import { dmath } from "../kernel/index.ts";

export const RING = {
  /** Roche's number for a fluid moon. */
  roche: 2.44,
  /** Earth's mean density, and a moon's of ice and of rock, g/cm³. */
  earth: 5.51,
  ice: 0.93,
  rock: 3.1,
  /** A planet this heavy (Earth masses) has drawn a moon inward as often as not (its moons gather with its mass). */
  half: 10,
  /** How near its planet such a moon ends, in the planet's radii: from just over its face to several radii out. */
  nearest: 1.15,
  spread: 7,
} as const;

/** A planet's Roche limit for a moon of a density, in the planet's own radii (mass and radius against Earth's). */
export function rocheLimit(mass: number, radius: number, moonDensity: number): number {
  const density = (RING.earth * mass) / Math.max(1e-9, radius * radius * radius);
  return RING.roche * dmath.pow(density / Math.max(0.1, moonDensity), 1 / 3);
}

export type Ring = {
  /** Its inner and outer edges, in its planet's radii: from where the moon came apart out to the Roche limit. */
  readonly inner: number;
  readonly outer: number;
  /** Whether it is of ice (bright) or of rock and dust (dark). */
  readonly ice: boolean;
  /** Where the moon stood when it was torn (the planet's radii), and the limit it was inside. */
  readonly at: number;
  readonly roche: number;
};

/**
 * A planet's ring from three draws in [0, 1): whether a moon was drawn inward (the likelier the heavier the planet), where it
 * ended, and nothing more. Null where none was, or where it ended outside the Roche limit and is a moon still.
 */
export function ringOf(
  p: { readonly mass: number; readonly radius: number; readonly icy: boolean },
  u: readonly [number, number],
): Ring | null {
  if (u[0] >= p.mass / (p.mass + RING.half)) return null;
  const at = RING.nearest * dmath.pow(RING.spread, u[1]),
    roche = rocheLimit(p.mass, p.radius, p.icy ? RING.ice : RING.rock);
  if (at >= roche) return null;
  return { inner: Math.max(1.05, at * 0.8), outer: roche, ice: p.icy, at, roche };
}

/** Worlds flung out (est). */
export const ROGUES = {
  /** Giants a star of the Sun's mass and metals keeps (Johnson et al. 2010: some 7 in 100, as its mass, 10^(1.2 [Fe/H])). */
  giants: 0.07,
  metals: 1.2,
  /** Lesser worlds each giant throws clear of its star as it settles (est: about as much again as it keeps). */
  flung: 4,
} as const;

/** The worlds without a star a star of this mass and these metals has thrown out, on the mean. */
export function roguesAStar(starMass: number, feH = 0): number {
  return ROGUES.giants * Math.max(0, starMass) * dmath.pow(10, ROGUES.metals * feH) * ROGUES.flung;
}
