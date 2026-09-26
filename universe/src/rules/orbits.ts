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

/** The star's pull, km³/s², for one solar mass; a planet's, for one home-world mass. */
const GM_SUN = 1.327e11;
const GM_HOME = 3.986e5;
/** Low orbit, this far above the ground (km). */
const LOW_ORBIT_KM = 300;

/** A body as a transfer needs it: where it circles and how big and heavy it is. */
export type Bodylike = {
  /** Index of what it circles in the system's list (-1: the star); orbit size (AU, or thousands of km about a planet). */
  readonly around: number;
  readonly a: number;
  readonly periodDays: number;
  /** Home-world masses and radii; surface air (bar). */
  readonly mass: number;
  readonly radius: number;
  readonly pressure: number;
};

/** Circular orbital speed (km/s) at radius r (km) about a body of pull gm. */
const circular = (gm: number, r: number) => Math.sqrt(gm / r);

/** A body's low orbit: its radius (km), its speed (km/s) and the speed to escape from it. */
function lowOrbit(b: Bodylike): { r: number; v: number; escape: number } {
  const gm = GM_HOME * b.mass,
    r = b.radius * 6371 + LOW_ORBIT_KM;
  return { r, v: circular(gm, r), escape: Math.sqrt((2 * gm) / r) };
}

/** A Hohmann transfer between circular orbits r1 → r2 (km) about pull gm: the two burns (km/s) and the time (days). */
export function hohmann(
  gm: number,
  r1: number,
  r2: number,
): { v1: number; v2: number; days: number } {
  const a = (r1 + r2) / 2;
  return {
    v1: Math.abs(circular(gm, r1) * (Math.sqrt((2 * r2) / (r1 + r2)) - 1)),
    v2: Math.abs(circular(gm, r2) * (1 - Math.sqrt((2 * r1) / (r1 + r2)))),
    days: (Math.PI * Math.sqrt((a * a * a) / gm)) / 86_400,
  };
}

/** The speed to set down on a body from its low orbit: its orbital speed, much of it taken by its air if it has one. */
export function landing(b: Bodylike): number {
  const low = lowOrbit(b);
  return low.v * (b.pressure > 0.05 ? 0.25 : 1) + 0.1 * b.mass;
}

export type Route = {
  /** From the home world's low orbit to the target's surface: the speed (km/s) the ship must gain. */
  readonly speed: number;
  readonly depart: number;
  readonly arrive: number;
  readonly land: number;
  /** How long the crossing takes (days), and how often the way opens (days; 0: always). */
  readonly days: number;
  readonly window: number;
};

/**
 * The way from the home world's low orbit to another body's ground, by the cheapest
 * simple path: a Hohmann transfer about the star (or, for the home world's own moons,
 * about the home world), leaving low orbit and entering the target's with the help of
 * each world's pull, then down to its ground.
 */
export function routeTo(bodies: readonly Bodylike[], target: number, starMass: number): Route {
  const home = bodies[0]!,
    t = bodies[target]!,
    fromLow = lowOrbit(home);
  // A moon of the home world: a transfer about the home world itself.
  if (t.around === 0) {
    const gm = GM_HOME * home.mass,
      h = hohmann(gm, fromLow.r, t.a * 1000),
      // Falling in beside the moon, it must slow into its low orbit.
      low = lowOrbit(t),
      arrive = Math.max(0, Math.sqrt(h.v2 * h.v2 + low.escape * low.escape) - low.v),
      land = landing(t);
    return { speed: h.v1 + arrive + land, depart: h.v1, arrive, land, days: h.days, window: 0 };
  }
  // Another planet, or a moon of one: about the star to the planet's orbit.
  const planet = t.around < 0 ? t : bodies[t.around]!,
    gm = GM_SUN * starMass,
    AU = 1.496e8,
    h = hohmann(gm, home.a * AU, planet.a * AU),
    depart = Math.sqrt(h.v1 * h.v1 + fromLow.escape * fromLow.escape) - fromLow.v;
  let arrive: number;
  if (t.around < 0) {
    const low = lowOrbit(t);
    arrive = Math.sqrt(h.v2 * h.v2 + low.escape * low.escape) - low.v;
  } else {
    // Into the planet's pull, and down its well to the moon's orbit, then into the moon's.
    const gmP = GM_HOME * planet.mass,
      rMoon = t.a * 1000,
      atMoon = Math.sqrt(h.v2 * h.v2 + (2 * gmP) / rMoon) - circular(gmP, rMoon),
      low = lowOrbit(t);
    arrive = atMoon + Math.max(0, low.escape - low.v) * 0.5;
  }
  const land = landing(t),
    synodic = 1 / Math.abs(1 / home.periodDays - 1 / planet.periodDays);
  return { speed: depart + arrive + land, depart, arrive, land, days: h.days, window: synodic };
}
