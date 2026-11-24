// A world's slow swings and its star's companion (breadth round, 2026-11-23).
//
// Its axis wobbles round like a top's as its star and its moon pull on its bulge (the bulge its turning raises), so the season
// its world is nearest its star at comes round again; its tilt nods; its orbit's ellipse breathes with the pull of the other
// planets and of a companion star. None of it changes how much light the world gets in a year by much, but it moves which
// hemisphere's summers are the warm ones and how warm, and ice lives and dies by its summers (Milankovitch 1941). The rates are
// the bodies': a world turning slowly, or with a small moon or none, precesses slowly; without a great moon to steady it, its
// tilt wanders far (Laskar 1993).
//
// A star is born with a companion as often as stars of its mass are (Raghavan et al. 2010: a quarter of the red dwarfs, near half
// of the Sun's kind, more of the heavier), at a spread of distances (a log-normal about fifty times the Earth's). A planet keeps
// its orbit only well inside its companion's (Holman and Wiegert 1999): where the companion would have torn its world from
// its orbit, that world would not be there to be seen, so no world is seen with one so near.
import { dmath } from "../kernel/index.ts";

/** A star's companion: its mass (Suns), its light (Suns), its orbit (AU, eccentricity), and its light at the home world. */
export type Companion = {
  readonly mass: number;
  readonly luminosity: number;
  readonly a: number;
  readonly e: number;
  /** Its light at the home world against the home star's. */
  readonly share: number;
  /** How much brighter than a full moon of Earth's it shines in the home world's sky. */
  readonly moons: number;
};

/** The share of stars of a mass born with a companion. */
export function companionOdds(mass: number): number {
  return dmath.clamp(0.2 + 0.26 * mass, 0.2, 0.75);
}

/**
 * A star's companion from four draws in [0, 1) (its own keyed draws): whether one was born, its distance (a log-normal, 10^(1.7
 * ± 1.5)), its mass (a share of the star's), its orbit's eccentricity; null where none was, or where one so near would leave no
 * world at the home world's orbit.
 */
export function companionOf(
  star: { readonly mass: number; readonly luminosity: number },
  homeAu: number,
  u: readonly [number, number, number, number, number],
): Companion | null {
  if (u[0] >= companionOdds(star.mass)) return null;
  const g = Math.sqrt(-2 * dmath.log(Math.max(1e-9, u[1]))) * dmath.cos(2 * Math.PI * u[2]),
    a = dmath.pow(10, 1.7 + 1.5 * g),
    e = 0.6 * u[4],
    mass = star.mass * (0.1 + 0.9 * u[3]),
    // (Holman and Wiegert's critical orbit, for a companion of about the star's mass: some 0.46 of the binary's, less 0.6 of it for
    // each tenth of eccentricity, here kept simple.)
    stable = homeAu < a * (0.46 - 0.38 * e) * (1 - 0.3 * (mass / (mass + star.mass)));
  if (!stable) return null;
  const luminosity = dmath.pow(mass, 3.5),
    share =
      luminosity /
      Math.max(1e-9, star.luminosity) /
      (((a / Math.max(1e-6, homeAu)) * a) / Math.max(1e-6, homeAu)),
    // (The full moon of Earth's is some 1/400,000 of the Sun's light.)
    moons = share * 400000;
  return { mass, luminosity, a, e, share, moons };
}

/** A world's swings: its tilt's nod (degrees, years), its ellipse's breathing (eccentricity, years), its precession (years). */
export type Cycles = {
  readonly tiltAmp: number;
  readonly tiltYears: number;
  readonly eccAmp: number;
  readonly eccYears: number;
  readonly precessYears: number;
  /** Whether a great moon steadies its tilt. */
  readonly steadied: boolean;
  /** Where in each the chronicle opens (radians). */
  readonly phases: readonly [number, number, number];
  /** Its orbit's eccentricity about which it breathes. */
  readonly ecc: number;
};

/** What pulls on a world: its star's mass and its distance, its day, its moons and the planets and companion that tug its orbit. */
export type CycleInputs = {
  readonly starMass: number;
  readonly orbitAu: number;
  readonly dayHours: number;
  readonly ecc: number;
  /** Each moon of its own: mass (Earth masses) and distance (thousands of km). */
  readonly moons: readonly { readonly mass: number; readonly a: number }[];
  /** Each other planet and companion: mass (Suns) and distance from its star (AU). */
  readonly tuggers: readonly { readonly mass: number; readonly a: number }[];
  readonly phases: readonly [number, number, number];
};

/** Earth's: the Sun's pull on its bulge one, the Moon's 2.2 of it; its planets' tug on its ellipse (Venus and Jupiter most). */
export const EARTH_CYCLES = {
  precessYears: 25800,
  tiltAmp: 1.2,
  tiltYears: 41000,
  eccAmp: 0.02,
  eccYears: 100000,
  moonPull: 2.2,
  tug: 8e-6,
  /** The most its tilt wanders without a great moon (degrees, on these spans). */
  wander: 9,
} as const;

/** A world's swings from what pulls on it. */
export function cyclesOf(i: CycleInputs): Cycles {
  const E = EARTH_CYCLES,
    au = Math.max(1e-3, i.orbitAu),
    sun = i.starMass / (au * au * au);
  let moon = 0;
  for (const m of i.moons) {
    const d = Math.max(1, m.a) / 384.4;
    moon += (E.moonPull * (m.mass / 0.0123)) / (d * d * d);
  }
  // (The bulge goes with the square of its turning, the wobble against its turning once: the rate with the turning, by the pull.)
  const pull = sun + moon,
    precessYears = Math.min(
      5e6,
      (E.precessYears * (i.dayHours / 24) * (1 + E.moonPull)) / Math.max(1e-6, pull),
    ),
    steadied = moon >= 0.5 * E.moonPull,
    tiltAmp = E.tiltAmp + (E.wander - E.tiltAmp) * (1 - Math.min(1, moon / E.moonPull));
  let tug = 0;
  for (const t of i.tuggers) {
    const r = Math.min(t.a, i.orbitAu) / Math.max(t.a, i.orbitAu);
    tug += t.mass * r * r * r;
  }
  return {
    tiltAmp,
    tiltYears: (precessYears * E.tiltYears) / E.precessYears,
    eccAmp: Math.min(0.06, E.eccAmp * Math.min(3, tug / E.tug)),
    eccYears: E.eccYears,
    precessYears,
    steadied,
    phases: i.phases,
    ecc: i.ecc,
  };
}

/** How much warmer its summers are at a high latitude, year `year` against the year its chronicle opened (degrees; north +). */
export const SUMMER = { perTilt: 0.6, perPrecession: 30 } as const;

/** Its tilt, eccentricity and climatic precession (e sin of where its summer's perihelion lies) in a year, less the first year's. */
export function swingAt(
  c: Cycles,
  year: number,
): { tilt: number; ecc: number; precession: number } {
  const at = (years: number, phase: number) => dmath.sin((2 * Math.PI * year) / years + phase),
    ecc = Math.max(0, c.ecc + c.eccAmp * at(c.eccYears, c.phases[1])),
    ecc0 = Math.max(0, c.ecc + c.eccAmp * dmath.sin(c.phases[1])),
    tilt = c.tiltAmp * (at(c.tiltYears, c.phases[0]) - dmath.sin(c.phases[0])),
    precession = ecc * at(c.precessYears, c.phases[2]) - ecc0 * dmath.sin(c.phases[2]);
  return { tilt, ecc, precession };
}

/** What a year's swings do to a high latitude's summers, against the first year (degrees; a hemisphere's sign, +1 north). */
export function summerWarmth(c: Cycles, year: number, north: boolean): number {
  const s = swingAt(c, year);
  return SUMMER.perTilt * s.tilt + (north ? 1 : -1) * SUMMER.perPrecession * s.precession;
}
