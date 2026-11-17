// The great stones and comets (the Frontier lane; the small ones, under 150 m, are rules/nature.ts STARS). How often a world
// is struck is the Moon's record read for its system's age: the stones left from the making fall off fast in the first
// billion years and slowly after (Neukum's chronology, the Moon's dated craters); a giant past the frost line stirs a belt
// into the paths of the inner worlds; and comets fall from the far cloud, a shower of them for two million years after a
// star has passed close by, as often as the stars about home are thick and quick (π b² n v). How hard a stone strikes is
// half its mass by the square of its speed, its speed its fall's and the world's own pull's; what it brings down within
// so many km goes as the cube root of that; the sea it falls in rises against the coasts for ten times as far; and the dust
// and the soot of the fires it lights darken the whole sky past some hundred thousand megatons (Toon et al. 1997).
//
// A people that watches its sky finds a stone years before it falls, the greater the longer before; it turns it aside by a
// nudge along its path that grows threefold with each year (DART's kinetic push, its ejecta returning some three times the
// push), or with the greatest fire where it knows it. Pure tables and functions.
import { dmath } from "../kernel/index.ts";

export type ImpactClass = {
  readonly id: "regional" | "great" | "dooming";
  /** Its width (m), and the years between such strikes on an Earth now. */
  readonly metres: number;
  readonly everyYears: number;
};

/** The great stones, by width (est from the near-Earth surveys: Harris & D'Abramo 2015, and the 66-million-year crater). */
export const IMPACTS: readonly ImpactClass[] = [
  { id: "regional", metres: 300, everyYears: 70_000 },
  { id: "great", metres: 1000, everyYears: 600_000 },
  { id: "dooming", metres: 10_000, everyYears: 100_000_000 },
];

export const IMPACT = {
  /** The Moon's chronology (Neukum 2001): N(t) = a (e^{b t} − 1) + c t, t in Gyr before now, craters past 1 km a km². */
  chronoA: 5.44e-14,
  chronoB: 6.93,
  chronoC: 8.38e-4,
  /** An Earth's system's age, Gyr (its rate is 1). */
  earthGyr: 4.5,
  /** The most a young system's rate is of an Earth's (the first heavy rain is no part of a chronicle). */
  youngMost: 1000,
  /** What a belt with no giant past the frost line to stir it sends inward, of an Earth's (est). */
  unstirred: 0.5,
  /** The share of the great stones that are comets on an Earth (est: a tenth or less). */
  comets: 0.1,
  /** A star passing within this many light-years of home sets off a shower, and for so many years; it raises the comets so many times (Hut et al. 1987). */
  showerLy: 0.3,
  showerYears: 2e6,
  showerTimes: 20,
  /** The stars' mean speed past home (km/s). */
  passKms: 25,
  /** A stone's density and its speed from afar (kg/m³, km/s); a comet's. */
  stoneKgM3: 2600,
  stoneKms: 17,
  cometKgM3: 600,
  cometKms: 50,
  /** A megaton's joules. */
  mtJ: 4.184e15,
  /** What a strike brings down within so many km for each cube root of a megaton (est from Collins et al. 2005: a km stone's some 120 km). */
  reachKmMt3: 3,
  /** How much farther its sea's wave reaches coasts than its blast reaches lands (est: Ward & Asphaug 2000). */
  waveTimes: 10,
  /** The share of a land's people who die at the middle of a strike, and on a coast at its wave's foot (est). */
  deadAtMiddle: 0.6,
  deadAtCoast: 0.15,
  /** A strike's dust and soot at the whole sky, as the great fire's soot is measured: 1 at so many megatons (est from Toon et al. 1997). */
  skyMt: 1e6,
  /** What of the dust is left in the high air each year after (est: dust falls in a year or two, the soot lasts). */
  dustKept: 0.45,
  /** The share of every land's people who die under the burning sky of the greatest (the ejecta falling back, est). */
  burningSky: 0.1,
  /** From what megatons the burning sky comes (est). */
  burningMt: 1e7,
  /** The years before it falls that a watched sky finds a km stone; the most; a comet's from the far cloud (est). */
  leadAtKm: 30,
  leadMost: 100,
  cometLead: 2,
  /** The push a nudging craft's mass gives, by its ejecta (β), and its speed against the stone (km/s): DART's. */
  beta: 3,
  hitKms: 10,
  /** How much more push a kilogram of the greatest fire set off beside it gives than a kilogram struck (est). */
  fireTimes: 1000,
  /** A craft sent out of orbit to meet a stone costs so many times its weight put in orbit (est: the speed past orbit). */
  pastOrbit: 3,
} as const;

/** How much more a system of this age is struck than an Earth's now (the Moon's record: 1 past some three billion years). */
export function youngRate(ageGyr: number): number {
  const k = IMPACT,
    rate = (tAgo: number) => k.chronoC + k.chronoA * k.chronoB * dmath.exp(k.chronoB * tAgo),
    ago = Math.max(0, k.earthGyr - Math.max(0, ageGyr));
  return Math.min(k.youngMost, rate(ago) / rate(0));
}

/** The chance that a star passed close enough to set off a shower that still falls: π b² n v T, by the stars about home. */
export function showerChance(starsPerLy3: number): number {
  const k = IMPACT,
    lyPerYear = k.passKms / 299_792,
    n = Math.PI * k.showerLy * k.showerLy * Math.max(0, starsPerLy3) * lyPerYear * k.showerYears;
  return 1 - dmath.exp(-n);
}

/** How much more a world is struck than an Earth now: its system's age, its belt stirred or not, and comets in a shower. */
export function strikeRate(ageGyr: number, stirred: boolean, shower: boolean): number {
  const k = IMPACT;
  return (
    youngRate(ageGyr) *
    ((1 - k.comets) * (stirred ? 1 : k.unstirred) + k.comets * (shower ? k.showerTimes : 1))
  );
}

/** A year's chance of each class striking, so many times an Earth's rate, over so many years (at least one). */
export function strikeChance(cls: ImpactClass, rate: number, years: number): number {
  return 1 - dmath.exp(-(rate * Math.max(0, years)) / cls.everyYears);
}

/** A strike's energy (Mt): half its mass by its speed squared, its speed from afar and the world's own pull's (km/s). */
export function strikeMt(metres: number, comet: boolean, escapeKms: number): number {
  const k = IMPACT,
    r = metres / 2,
    mass = (comet ? k.cometKgM3 : k.stoneKgM3) * (4 / 3) * Math.PI * r * r * r,
    v = (comet ? k.cometKms : k.stoneKms) * 1000,
    vEsc = escapeKms * 1000;
  return (0.5 * mass * (v * v + vEsc * vEsc)) / k.mtJ;
}

/** How far a strike brings down what stands (km). */
export const strikeReachKm = (mt: number): number =>
  IMPACT.reachKmMt3 * dmath.cbrt(Math.max(0, mt));

/** The share of a land's people who die by its distance from the middle (km), inland; on a coast, by the wave's. */
export function strikeDead(km: number, reachKm: number, sea: boolean): number {
  const k = IMPACT,
    far = sea ? reachKm * k.waveTimes : reachKm;
  if (km >= far) return 0;
  return (sea ? k.deadAtCoast : k.deadAtMiddle) * (1 - km / far);
}

/** The dust and soot a strike sends up, at the whole sky (as the great fire's soot: 1 is a sky darkened through). */
export const strikeDust = (mt: number): number => Math.min(1, Math.max(0, mt) / IMPACT.skyMt);

/** The share of every land's people who die under the burning sky of the greatest strikes (0 under it). */
export const burningSky = (mt: number): number =>
  mt >= IMPACT.burningMt ? IMPACT.burningSky * Math.min(1, mt / (10 * IMPACT.burningMt)) : 0;

/** The years before it falls that a watched sky finds a stone of this width, or a comet. */
export function leadYears(metres: number, comet: boolean): number {
  const k = IMPACT;
  if (comet) return k.cometLead;
  return Math.min(k.leadMost, k.leadAtKm * dmath.pow(Math.max(1, metres) / 1000, 0.5));
}

/**
 * The tonnes a craft must weigh to turn a stone aside by its world's girth with `years` left: the speed change it needs
 * (the nudge along its path grows threefold a year), times its mass, over the push a tonne gives. With the greatest fire,
 * a thousand times less.
 */
export function turningTonnes(
  metres: number,
  comet: boolean,
  years: number,
  radiusKm: number,
  fire: boolean,
): number {
  const k = IMPACT,
    r = metres / 2,
    mass = (comet ? k.cometKgM3 : k.stoneKgM3) * (4 / 3) * Math.PI * r * r * r,
    seconds = Math.max(0.05, years) * 3.156e7,
    dv = (radiusKm * 1000) / (3 * seconds),
    kg = (mass * dv) / (k.beta * k.hitKms * 1000);
  return kg / 1000 / (fire ? k.fireTimes : 1);
}
