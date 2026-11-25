// How a body walks, reckoned from the body (asked 2026-11-25: "make the walking animation and their movements more
// fluid"). Nothing here is a table of poses: a walk is what a leg of a given length does under a given pull at a given
// speed.
//   The stride. Bodies of every size on legs take strides of the same shape at the same Froude number v²/(g·h), h the
//   hip's height (dynamic similarity; Alexander's fit over walking and running animals, two legs and four:
//   stride = 2.3·h·(v²/gh)^0.3). The exponent and the 2.3 are measured, not derived. The beat is then v / stride, so a
//   foot on the ground stays where it was set: the legs' turn goes by the ground covered, never by a clock.
//   The swing. In a walk each step is a leg's reach before and behind the hip: step = 2·h·sin(swing), a stride two of
//   them. Past the speed a walk ends at (Froude 0.5, measured: the stance leg can no longer hold the body down on its
//   arc) the stride is lengthened by flight, not by reach: the swing stays at the walk's widest.
//   The pace of one's own. An easy walk is at Froude 0.25 (measured: where a walk costs least a metre), so longer legs
//   walk faster as the root of their length, and a child's shorter ones patter.
//   The rise and fall. The hip rides its leg's arc: with a foot down and the leg swung an angle from upright it stands
//   lower by h·(1 − cos). (Reckoned in render/folk.ts from the legs as posed.)
//   The lean. A body speeding up leans so that the ground's push passes through its weight: tan(lean) = a / g; and no
//   further than its leg can reach to catch it (the walk's widest swing).
// The body walking here is the one drawn: a town's figures stand several times life (rules/figure.ts) and it is their
// drawn legs that must meet the ground, so the hip's height is the drawn one.
import { SENESCENCE } from "../rules/index.ts";
import type { Figure } from "./figure.ts";

/** A home world's pull at the ground (m/s²): a people's own is this times its world's g. */
export const PULL = 9.80665;
/** The Froude number of an easy walk, and the one a walk ends at (both measured of walking animals). */
export const EASY = 0.25;
export const WALK_ENDS = 0.5;
/** Alexander's fit: a stride in hip heights is 2.3 times the Froude number to the 0.3. */
const FIT = 2.3,
  POWER = 0.3;

/** A figure's hip above the ground in its own units at its scale's 1 (0: no leg to walk on), and its legs' own swing. */
export function hipOf(figure: Figure): { hip: number; swing: number } {
  let hip = 0,
    swing = 0;
  for (const p of figure.parts)
    if (p.role === "leg" && p.swing) {
      hip = Math.max(hip, p.y + (p.pivot ?? 0));
      swing = Math.max(swing, Math.abs(p.swing));
    }
  return { hip, swing };
}

/** A stride's length (m) at speed `v` (m/s) on a hip `hip` high (m) under a pull `g` (m/s²). */
export function strideLength(v: number, hip: number, g = PULL): number {
  if (!(v > 0) || !(hip > 0)) return 0;
  return FIT * hip * Math.pow((v * v) / (g * hip), POWER);
}

/** One's own easy pace (m/s). */
export function easyPace(hip: number, g = PULL): number {
  return Math.sqrt(EASY * g * Math.max(0, hip));
}

/** The widest a leg swings from upright in a walk (radians): its reach at the speed a walk ends at. */
export const WIDEST = Math.asin((FIT * Math.pow(WALK_ENDS, POWER)) / 4);

/** How far a leg swings from upright at speed `v` (radians): half a step's reach each way, no wider than a walk's widest. */
export function legSwing(v: number, hip: number, g = PULL): number {
  if (!(v > 0) || !(hip > 0)) return 0;
  const froude = Math.min(WALK_ENDS, (v * v) / (g * hip));
  return Math.asin(Math.min(1, (FIT * Math.pow(froude, POWER)) / 4));
}

/** How far a body leans into a speeding up of `a` (m/s²; back, slowing): radians, no further than its leg reaches. */
export function leanOf(a: number, g = PULL): number {
  return Math.max(-WIDEST, Math.min(WIDEST, Math.atan2(a, g)));
}

/**
 * What age has taken of an easy pace (1: none). The rules keep one measure of a body's wearing, the share of the grown
 * it takes in a year (rules/species.ts SENESCENCE: doubling every ninth year of an ape's seventy); a walk's cost goes
 * as its speed, so the pace is taken down by that share. A reading of the rules' own number, not a measured law of
 * gait: at sixty an ape's pace is as good as whole, at seventy a seventh is gone, at eighty a third.
 */
export function agePace(age: number, span = 70): number {
  const wear = SENESCENCE.wear * Math.exp(SENESCENCE.grows * age * (70 / Math.max(1, span)));
  return Math.max(0.25, 1 - wear);
}
