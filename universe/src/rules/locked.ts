// A world locked to its star (the planet's last gaps, 2026-11-24). A star's tide on a world goes as the star's mass over the
// cube of the world's distance; where it is some thirty times the Sun's on Earth it has braked the world's turning within its
// age, and one face looks at the star for good. That face is the day side: the star stands still over one point, the ground
// under it is the warmest and its air rises and rains there; the far side has no light at all and only what warmth the air and
// seas carry round to it. The thicker the air, the more it carries and the less the two sides differ.
import { dmath } from "../kernel/index.ts";

export const LOCKED = {
  /** The star's tide (Suns over astronomical units cubed) past which a world is locked. */
  tide: 30,
  /** Degrees between the point under the star and the dark side under one bar of air (est, from models of such worlds). */
  contrast: 50,
  /** The mean of the day side's share of light over the whole globe (the cosine of the star's height, none on the dark side). */
  mean: 0.25,
} as const;

/** Whether a star's tide has locked a world at this distance (astronomical units) to it. */
export function tideLocked(starMass: number, a: number): boolean {
  return starMass / (a * a * a) > LOCKED.tide;
}

/**
 * How much warmer than its world's mean a place on a locked world is, by the cosine of its angle from the point under the
 * star (1 under it, 0 at the edge of the light, below 0 in the dark) and its air's pressure in bars: the globe's mean is kept.
 */
export function lockedWarmth(mu: number, pressure: number): number {
  const contrast = LOCKED.contrast / Math.sqrt(dmath.clamp(pressure, 0.05, 20));
  return contrast * (Math.max(0, mu) - LOCKED.mean);
}

/**
 * A place's light on a locked world against its world's mean light (what a turning world's ground gets, day and night
 * together): four times it under the star, none in the dark.
 */
export function lockedLight(mu: number): number {
  return Math.max(0, mu) / LOCKED.mean;
}

/**
 * Where the star stands in the sky of a place on a locked world, as the share of a turning world's day at which its sun stands
 * as high (0.25: at the sky's edge, 0.5: overhead; under 0.25 it is night): it never moves from there.
 */
export function lockedDay(mu: number): number {
  return 0.25 + dmath.asin(dmath.clamp(mu, -1, 1)) / (2 * Math.PI);
}

/** How much of its usual rain falls at a place on a locked world: the air rises under the star, and the dark side is dry. */
export function lockedRising(mu: number): number {
  const up = Math.max(0, mu);
  return up * up * up;
}
