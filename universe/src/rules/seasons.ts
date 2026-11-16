// The farming year, and what a people must have put by to reach its reaping. A year's grain comes
// in at the reaping; what a people gathers, hunts and herds comes in the year through. So at the
// turn of a year a land needs in store what its people will eat until the reaping begins, less
// what the year gives them before it: the more of their food is reaped, the more they must hold.
// A people has the children it can see fed to the reaping (rules: a household reckons by its
// granary, not by today's bread): its fertility by the share of that store it holds, squared as
// its hunger is.

import { dmath } from "../kernel/index.ts";

/** The share of a world's year gone (0 … 1) when its fields are ripe and reaped. */
export const HARVEST: readonly [number, number] = [0.6, 0.78];
/** When they are sown. */
export const SOWING: readonly [number, number] = [0.18, 0.34];

/** Less than this in store, in months of eating, a town is lean: a fortnight. */
export const LEAN_MONTHS = 0.5;

/**
 * The months of eating a land must hold at the turn of a year to see its reaping in without its granaries going
 * lean: the months until the reaping is done (what is cut first is eaten first, and the last of it is not in the
 * granary until the end), by the share of its food that is reaped (`reaped`, 0 … 1: what is gathered, hunted and
 * herded comes in month by month), and the fortnight under which it is lean.
 */
export function storeNeeded(reaped: number): number {
  return 12 * HARVEST[1] * Math.max(0, Math.min(1, reaped)) + LEAN_MONTHS;
}

/**
 * What a people keeps of its fertility by what it has put by (1: all it needs to reach the
 * reaping, or more): the share held of the store needed, raised to THRIFT. Smooth from nothing
 * in store to the whole of it.
 */
export function thrift(months: number, reaped: number): number {
  const share = Math.max(0, Math.min(1, months / storeNeeded(reaped)));
  return dmath.pow(share, THRIFT);
}

/** How sharply a people's births answer to its store (2: as they answer to hunger, by fed squared). */
export const THRIFT = 2;

// Seasons and days lived (Round D). A world's tilt sets how far its warmth swings through its year (gen/climate.ts: the
// swing grows with the tilt), its spin how long its nights are and so how far its warmth falls between noon and dawn,
// and its orbit how long its year is in the days its people count. From them, a land's growing season: the share of its
// year warm enough for its life to grow (above five degrees of its liquid), its nights' frost raising that line where
// they are long; and its lean season, the months between harvests its stores must last, spoiling as they wait. Its
// fields yield by those against what the same land would under Earth's tilt, day and year (the biomes' yields are
// Earth's): a world turned on its side has short summers at middle latitudes, a world without tilt none at all where
// its mean is cool, a world of long nights frosts its sprouts, a world of a long year starves through a winter of years.
// And its people's day: the light and dark they live by, and how many times a day they sleep.

/** Earth's tilt (degrees), day (hours) and year (days): the world the biomes' yields were read on. */
export const EARTH_SKY = { tilt: 23.44, dayHours: 24, yearDays: 365.25 } as const;
/** The warmth (degrees of its liquid above its freezing) its life grows above. */
export const GROWS_ABOVE = 5;
/** The share of a land's stored food spoiled a month as it waits for the next harvest. */
export const SPOIL = 0.03;
/** How far a land's warmth falls from noon to dawn under a day of Earth's length (degrees), and how it grows with the night. */
export const NIGHT_FALL = 10;
/** Yields no more or less than this against Earth's sky. */
export const SEASON_BOUNDS = [0.3, 1.5] as const;
/** A day longer than this (hours) is slept in twice; longer than the second, three times. */
export const SLEEPS = [36, 60] as const;

/** How far a world's warmth swings through its year for its tilt, as gen/climate.ts makes it. */
export function swingOfTilt(tilt: number): number {
  return 0.35 + tilt / 40;
}

/** The share of a sinusoidal year warmer than `above`. */
export function shareAbove(mean: number, swing: number, above: number): number {
  const x = mean - above;
  if (swing <= 1e-9) return x > 0 ? 1 : 0;
  const r = x / swing;
  return r >= 1 ? 1 : r <= -1 ? 0 : 1 - dmath.acos(r) / Math.PI;
}

/** How far a land's warmth falls between noon and dawn under a day of so many hours. */
export function nightFall(dayHours: number): number {
  return NIGHT_FALL * Math.sqrt(Math.max(1, dayHours) / EARTH_SKY.dayHours);
}

export type Season = {
  /** The share of its year its life grows in, and under Earth's sky. */
  readonly grows: number;
  readonly growsEarth: number;
  /** Its lean season (standard months), and under Earth's sky. */
  readonly lean: number;
  readonly leanEarth: number;
  /** What its fields yield against under Earth's sky. */
  readonly factor: number;
};

/**
 * A land's seasons: its mean and half its yearly swing (degrees of its liquid), its world's tilt, day (hours) and year
 * (standard days).
 */
export function seasonOf(
  mean: number,
  swing: number,
  tilt: number,
  dayHours: number,
  yearDays: number,
): Season {
  const earthSwing = (swing * swingOfTilt(EARTH_SKY.tilt)) / swingOfTilt(tilt),
    // (A long night's frost raises the line its sprouts must stand above.)
    frost = (nightFall(dayHours) - nightFall(EARTH_SKY.dayHours)) / 2,
    grows = shareAbove(mean, swing, GROWS_ABOVE + frost),
    growsEarth = shareAbove(mean, earthSwing, GROWS_ABOVE),
    lean = (1 - grows) * ((12 * yearDays) / EARTH_SKY.yearDays),
    leanEarth = (1 - growsEarth) * 12,
    keep = dmath.exp((-SPOIL * lean) / 2),
    keepEarth = dmath.exp((-SPOIL * leanEarth) / 2),
    // (Where even Earth's sky gives it hardly a season, its biome's yield already says so.)
    factor =
      growsEarth < 0.05
        ? 1
        : dmath.clamp(
            ((grows / growsEarth) * keep) / keepEarth,
            SEASON_BOUNDS[0],
            SEASON_BOUNDS[1],
          );
  return { grows, growsEarth, lean, leanEarth, factor };
}

export type Day = {
  /** The hours of light and of dark at midsummer and at midwinter, at its latitude (hours of its day). */
  readonly summerLight: number;
  readonly winterLight: number;
  /** Whether its summer sun never sets, or its winter sun never rises. */
  readonly midnightSun: boolean;
  readonly polarNight: boolean;
  /** How many times in a day its people sleep. */
  readonly sleeps: number;
  /** How long a night is at the equinox (standard hours), and how far its warmth falls in it. */
  readonly night: number;
  readonly fall: number;
};

/** A people's day at a latitude (radians) on a world of a tilt (degrees) and a day (hours). */
export function dayOf(lat: number, tilt: number, dayHours: number): Day {
  const t = (tilt * Math.PI) / 180,
    // (The sun's hour angle at its setting: cos h = −tan φ tan δ.)
    lit = (decl: number) => {
      const c = -dmath.tan(lat) * dmath.tan(decl);
      return c <= -1 ? 1 : c >= 1 ? 0 : dmath.acos(c) / Math.PI;
    },
    summer = lit(lat >= 0 ? t : -t),
    winter = lit(lat >= 0 ? -t : t);
  return {
    summerLight: summer * dayHours,
    winterLight: winter * dayHours,
    midnightSun: summer >= 1,
    polarNight: winter <= 0,
    sleeps: dayHours > SLEEPS[1] ? 3 : dayHours > SLEEPS[0] ? 2 : 1,
    night: dayHours / 2,
    fall: nightFall(dayHours),
  };
}
