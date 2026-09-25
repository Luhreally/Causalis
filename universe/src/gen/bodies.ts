// A star and a planet from the seed and a prior (docs/architecture §24): the
// numbers everything else is built on, from textbook relations — main-sequence
// luminosity and lifetime, the habitable zone, Kepler's third law, surface
// gravity from mass and radius, and the energy balance of the planet's surface.
import { defineStream, dmath, type Rng } from "../kernel/index.ts";
import type { Prior, Range } from "../rules/index.ts";
import { planetRef, starRef } from "./kinds.ts";

const BODIES = defineStream("gen.bodies");

function draw(rng: Rng, range: Range, subject: number, n: number): number {
  return rng.range(range[0], range[1], BODIES, subject, 0, 0, n);
}

export type Star = {
  readonly ref: string;
  /** Solar masses, luminosities, radii. */
  readonly mass: number;
  readonly luminosity: number;
  readonly radius: number;
  /** Surface temperature, kelvin. */
  readonly temperature: number;
  readonly spectral: string;
  readonly lifetimeGyr: number;
  readonly ageGyr: number;
  /** Habitable zone edges, astronomical units. */
  readonly zoneInner: number;
  readonly zoneOuter: number;
};

function spectralClass(t: number): string {
  const classes: [number, string][] = [
    [30000, "O"],
    [10000, "B"],
    [7500, "A"],
    [6000, "F"],
    [5200, "G"],
    [3700, "K"],
    [0, "M"],
  ];
  const i = classes.findIndex(([lo]) => t >= lo),
    [lo, letter] = classes[i]!,
    hi = i > 0 ? classes[i - 1]![0] : lo * 2;
  const sub = Math.max(0, Math.min(9, Math.floor(10 * (1 - (t - lo) / (hi - lo)))));
  return `${letter}${sub}V`;
}

export function makeStar(rng: Rng, prior: Prior): Star {
  const mass = draw(rng, prior.star.mass, 1, 0),
    luminosity = mass < 0.43 ? 0.23 * dmath.pow(mass, 2.3) : dmath.pow(mass, 4),
    radius = dmath.pow(mass, 0.8),
    temperature = 5778 * dmath.pow(luminosity / (radius * radius), 0.25),
    lifetimeGyr = 10 * dmath.pow(mass, -2.5),
    ageGyr = lifetimeGyr * draw(rng, prior.star.age, 1, 1);
  return {
    ref: starRef(0),
    mass,
    luminosity,
    radius,
    temperature,
    spectral: spectralClass(temperature),
    lifetimeGyr,
    ageGyr,
    zoneInner: Math.sqrt(luminosity / 1.1),
    zoneOuter: Math.sqrt(luminosity / 0.53),
  };
}

export type Planet = {
  readonly ref: string;
  readonly star: string;
  readonly orbitAu: number;
  /** Year in standard days, day in hours. */
  readonly yearDays: number;
  readonly dayHours: number;
  /** Axial tilt in degrees. */
  readonly tilt: number;
  /** Earth masses, radii and surface gravities. */
  readonly mass: number;
  readonly radius: number;
  readonly gravity: number;
  /** Starlight received, Earth = 1. */
  readonly insolation: number;
  readonly albedo: number;
  readonly greenhouse: number;
  /** Mean surface temperature, °C. */
  readonly meanTemperature: number;
  readonly oceanFraction: number;
  readonly plateCount: number;
  readonly continental: number;
};

export function makePlanet(rng: Rng, prior: Prior, star: Star): Planet {
  const p = prior.planet,
    zone = draw(rng, p.zone, 2, 0),
    orbitAu = star.zoneInner + (star.zoneOuter - star.zoneInner) * zone,
    mass = draw(rng, p.mass, 2, 1),
    radius = dmath.pow(mass, 0.27),
    albedo = draw(rng, p.albedo, 2, 2),
    greenhouse = draw(rng, p.greenhouse, 2, 3),
    insolation = star.luminosity / (orbitAu * orbitAu),
    equilibrium = 278.6 * dmath.pow(insolation, 0.25) * dmath.pow(1 - albedo, 0.25);
  return {
    ref: planetRef(0),
    star: star.ref,
    orbitAu,
    yearDays: 365.25 * Math.sqrt((orbitAu * orbitAu * orbitAu) / star.mass),
    dayHours: draw(rng, p.day, 2, 4),
    tilt: draw(rng, p.tilt, 2, 5),
    mass,
    radius,
    gravity: mass / (radius * radius),
    insolation,
    albedo,
    greenhouse,
    meanTemperature: equilibrium + greenhouse - 273.15,
    oceanFraction: draw(rng, p.oceanFraction, 2, 6),
    plateCount: Math.round(draw(rng, p.plates, 2, 7)),
    continental: draw(rng, p.continental, 2, 8),
  };
}
