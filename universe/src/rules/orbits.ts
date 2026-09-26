// The laws of orbits (docs/architecture §25): where a body is on its orbit at any time,
// by Kepler's equation — analytic, never integrated. The generator, the simulation and
// the view all read the same law.
import { dmath } from "../kernel/index.ts";

/** An orbit's elements: size (any unit), eccentricity, periapsis and phase (radians), period (days). */
export type Elements = {
  readonly a: number;
  readonly e: number;
  readonly periapsis: number;
  readonly phase: number;
  readonly periodDays: number;
};

/** Solve Kepler's equation E − e sin E = M by Newton's method (a few steps suffice). */
export function eccentricAnomaly(mean: number, e: number): number {
  let x = mean;
  for (let k = 0; k < 8; k++) x -= (x - e * dmath.sin(x) - mean) / (1 - e * dmath.cos(x));
  return x;
}

/** Where on its orbit a body is at sim time t (seconds), in the units of its `a`, about what it circles. */
export function orbitXY(o: Elements, t: number): { x: number; y: number } {
  const mean = o.phase + (dmath.TAU * t) / (86_400 * o.periodDays),
    ea = eccentricAnomaly(dmath.mod(mean, dmath.TAU), o.e),
    // In the orbit's own frame, then turned to its periapsis.
    px = o.a * (dmath.cos(ea) - o.e),
    py = o.a * Math.sqrt(1 - o.e * o.e) * dmath.sin(ea),
    c = dmath.cos(o.periapsis),
    s = dmath.sin(o.periapsis);
  return { x: px * c - py * s, y: px * s + py * c };
}

/** Kilometres in an astronomical unit. */
export const AU_KM = 1.496e8;
