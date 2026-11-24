// What the dark between the stars does to those aboard (the Frontier lane; how fast a ship goes and how long it takes are
// rules/starships.ts). Out of any star's wind the galaxy's own rays come in from every side, some 0.6 sieverts a year to a
// body unshielded (the Voyagers' and Curiosity's counts), and a ship's walls stop a share of them; each sievert takes some
// one in twenty of those it falls on, in time. A ship meets the thin gas and dust ahead at its own speed: the dust's blows
// go as the square of that speed and their number as the speed, so a ship three times as fast is struck some twenty-seven
// times as hard a year, and its shield's wear and breaches with it. And its clock runs slow by Lorentz's factor: those
// aboard live fewer years than pass at home, and die and are born by their own. Pure tables and functions.
import { dmath } from "../kernel/index.ts";

export const CROSSING = {
  /** The galaxy's rays a year, unshielded, out of a star's wind (Sv, est). */
  raysSv: 0.6,
  /** What a ship's walls and stores let through of them (est: some tonnes a square metre of water and hull). */
  shielded: 0.25,
  /** Those it takes in time for each sievert (ICRP's one in twenty). */
  perSv: 0.05,
  /** The deaths a year of a people at rest, as the toll is reckoned against (est). */
  restDeaths: 0.015,
  /** The dust's toll at a tenth of light's speed, as a share more of the deaths aboard (est: breaches, the shield's wear). */
  dustAtTenth: 0.12,
  /** The most the dark's toll may come to (aboard a ship whose builders know their speed). */
  most: 2.5,
} as const;

/** Lorentz's factor for a speed (a share of light's). */
export function lorentz(v: number): number {
  const b = dmath.clamp(v, 0, 0.999);
  return 1 / Math.sqrt(1 - b * b);
}

/** The years that pass aboard for so many at home, at a cruise (the speeding and braking counted at it). */
export const yearsAboard = (homeYears: number, v: number): number => homeYears / lorentz(v);

/**
 * Whether a ship's clock lets a home year go by unlived: the n-th year of its crossing (1 the first) is one in which
 * no one aboard grows a year older, where the years its slow clock has fallen behind home's first come to a whole
 * one more. At three-tenths of light's speed one year in some twenty-two; at a twentieth, one in eight hundred.
 */
export function clockSlips(n: number, v: number): boolean {
  if (!(v > 0) || n < 1) return false;
  const behind = 1 - 1 / lorentz(v);
  return Math.floor(n * behind) > Math.floor((n - 1) * behind);
}

/**
 * A crossing as each end knows it: the years gone at home, the years lived (and its cargo aged) aboard at the
 * speed it kept, and the years after its coming before its word, at light's speed, reaches home.
 */
export function crossingClocks(
  ly: number,
  homeYears: number,
): { readonly home: number; readonly aboard: number; readonly word: number; readonly v: number } {
  const v = homeYears > 0 ? Math.min(0.999, Math.max(0, ly) / homeYears) : 0;
  return {
    home: homeYears,
    aboard: yearsAboard(homeYears, v),
    word: Math.ceil(Math.max(0, ly)),
    v,
  };
}

/**
 * How much likelier death is aboard a ship crossing at this speed than at rest, by the home's year: the galaxy's rays
 * through its walls, the dust's blows at its speed, the whole slowed by its clock. Exactly 1 at rest in a star's wind.
 */
export function darkToll(v: number): number {
  const k = CROSSING;
  if (!(v > 0)) return 1;
  const rays = 1 + (k.raysSv * k.shielded * k.perSv) / k.restDeaths,
    dust = 1 + k.dustAtTenth * dmath.pow(v / 0.1, 3);
  return Math.min(k.most, (rays * dust) / lorentz(v));
}
