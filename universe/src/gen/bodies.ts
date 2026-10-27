// A star and a planet from the seed and a prior (docs/architecture §24): the
// numbers everything else is built on, from textbook relations — main-sequence
// luminosity and lifetime, the habitable zone, Kepler's third law, surface
// gravity from mass and radius, and the energy balance of the planet's surface.
import { defineStream, dmath, type Rng } from "../kernel/index.ts";
import {
  KINDS,
  earthDegrees,
  kelvinPerDegree,
  type NovelKind,
  type Prior,
  type Range,
  type WorldKind,
} from "../rules/index.ts";
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

/** The oldest a star of the disk can be (billions of years): the galaxy itself is no older. */
export const OLDEST_STAR_GYR = 12.6;

/**
 * A star's age as it is told: what it has burned through of its life, but never older than
 * the galaxy (a small dim star's life is far longer than the universe has yet lasted).
 */
export function starAgeGyr(s: { readonly ageGyr: number }): number {
  return Math.min(s.ageGyr, OLDEST_STAR_GYR);
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
  /** Its kind, where it is not rocky (Phase 56: rules/kinds.ts). Absent on a rocky world. */
  readonly kind?: NovelKind;
  /**
   * The warmth its climate is built on, where its liquid freezes and boils away from where water does
   * (Phase 56): its mean in degrees of its liquid's band, as a rocky world's is in °C. Absent where
   * the two are one.
   */
  readonly climate?: number;
};

/** A world's kind: its planet's, rocky where it says none (Phase 56). */
export function worldKindOf(g: { readonly planet: Planet }): WorldKind {
  return g.planet.kind ?? "rocky";
}

/** The warmth a world's climate is built on: its mean, read in its liquid's degrees (Phase 56). */
export function climateMean(p: Planet): number {
  return p.climate ?? p.meanTemperature;
}

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

/**
 * A planet of a kind (Phase 56): the planet its seed draws (its twin), read through its liquid. A
 * kind whose liquid freezes and boils where water does keeps its twin's orbit and warmth. Where it
 * does not (ammonia water, methane), its warmth stands between its liquid's freezing and boiling as
 * its twin's stands between water's — so its climate, seas and ice are its liquid's — and is set
 * where that warmth truly falls: its equilibrium and greenhouse scaled to its liquid's band, its
 * orbit moved out to where its star's light gives that equilibrium (the energy balance read
 * backwards), its year by Kepler's law. Either way it says its kind.
 */
export function kindPlanet(twin: Planet, kind: NovelKind, star: Star): Planet {
  if (earthDegrees(kind)) return { ...twin, kind };
  const k = kelvinPerDegree(kind),
    grey = 278.6 * dmath.pow(1 - twin.albedo, 0.25),
    equilibrium = grey * dmath.pow(twin.insolation, 0.25),
    real = KINDS[kind].liquid.freezeK + k * (equilibrium - 273.15),
    insolation = dmath.pow(real / grey, 4),
    orbitAu = Math.sqrt(star.luminosity / insolation),
    greenhouse = k * twin.greenhouse;
  return {
    ...twin,
    orbitAu,
    yearDays: 365.25 * Math.sqrt((orbitAu * orbitAu * orbitAu) / star.mass),
    insolation,
    greenhouse,
    meanTemperature: real + greenhouse - 273.15,
    kind,
    climate: twin.meanTemperature,
  };
}
