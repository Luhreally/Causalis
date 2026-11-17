// A universe's own laws (the sweep, Nature lane): the Creator's dials that reach physics rather than one world's matter. Each is a
// number against our universe's (1: ours, and a world of ours is exactly as it was):
// - `burn`: how much of its hydrogen a star can burn before its core is spent and it swells. A star's light is set by its mass
//   and so unchanged; its life goes as its fuel, so a star of a quick-burning universe lives a tenth as long: it is younger when
//   its world is met (its age is drawn as a share of its life), its life has had less time to arise and climb, and fewer of the
//   galaxy's stars still shine.
// - `gravity`: the strength of gravity. A world's pull on what stands on it goes as it (g = G M / R²), its escape speed as its
//   root (v = √(2 G M / R)) and its year as one over its root (Kepler: P = 2π √(a³ / G M)): its bodies' size, its walls, what
//   holds its air and what it costs to leave it follow from those. (est: its stars' light is kept as their mass gives it here;
//   a stronger gravity would also squeeze its stars brighter, which this dial does not follow.)
// - `binding`: the strength of chemistry's bonds: what a material holds before it breaks and how hot it melts go as it. The
//   materials' rules (rules/materials.ts, the Materials round, not yet merged here) derive stiffness from an atom's cohesive
//   energy and strength from its world's warmth against its melt, so the law reaches them all through `boundAtom`: an atom of
//   this universe, its cohesive energy and its melting point scaled. The hook: read the world's laws (HomeWorld.laws) where
//   ATOMS is read, and pass each atom through it. Until then nothing reads it, and a world of ours never would.
import { dmath } from "../kernel/index.ts";

export type Laws = { readonly burn: number; readonly gravity: number; readonly binding: number };

/** Our universe's. */
export const OUR_LAWS: Laws = Object.freeze({ burn: 1, gravity: 1, binding: 1 });

/** Whether a universe's laws are other than ours. */
export function lawsDiffer(l: Laws): boolean {
  return l.burn !== 1 || l.gravity !== 1 || l.binding !== 1;
}

/** A star's main-sequence life (billions of years) by its mass (Suns): ten billion years at the Sun's, as its fuel lets it. */
export function starLifetime(mass: number, burn = 1): number {
  return 10 * dmath.pow(mass, -2.5) * burn;
}

/** A body's pull (Earth gravities) and escape speed (km/s), by its mass and radius (Earth's), under a gravity. */
export function bodyPull(
  mass: number,
  radius: number,
  gravity = 1,
): { readonly g: number; readonly escape: number } {
  return {
    g: (gravity * mass) / (radius * radius),
    escape: 11.19 * Math.sqrt((gravity * mass) / radius),
  };
}

/** What a year (or any orbit's period) is against ours, under a gravity. */
export function yearUnder(gravity = 1): number {
  return gravity === 1 ? 1 : 1 / Math.sqrt(gravity);
}

/**
 * What chemistry's bonds make of a material against ours, under a binding (the hook for materials: est, a bond's energy sets
 * both how hard it is pulled apart and how hot its lattice shakes loose).
 */
export function bondScale(binding = 1): { readonly strength: number; readonly melts: number } {
  return { strength: binding, melts: binding };
}

/** An atom as a universe of this binding has it: its cohesive energy (eV) and its pure solid's melting point (K) scaled; ours unchanged. */
export function boundAtom<A extends { readonly ecoh: number; readonly meltK: number }>(
  a: A,
  binding = 1,
): A {
  return binding === 1 ? a : { ...a, ecoh: a.ecoh * binding, meltK: a.meltK * binding };
}
