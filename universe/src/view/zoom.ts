// One zoom (Phase 9 M88): a zoom step against a scale's nearest and farthest views. Within
// them, the distance moves; pushed on past an edge, the push gathers — and once it has gone
// a third again past the edge, the zoom goes through to the next scale (in or out).

/** How far past an edge a push must go to go through (the log of the zoom: a third again). */
export const BEYOND = Math.log(1.35);

export type ZoomState = {
  readonly distance: number;
  /** How far past an edge the push has gathered (the log of the zoom asked beyond it), and which. */
  readonly beyond: number;
  readonly way: "in" | "out";
};

/**
 * One step of zoom by `factor` within [lo, hi]: the new state, and whether it went through
 * (the push gathered past an edge far enough), and which way.
 */
export function zoomStep(
  s: ZoomState,
  factor: number,
  lo: number,
  hi: number,
): ZoomState & { through: "in" | "out" | null } {
  const want = s.distance * factor,
    atFar = want > hi && s.distance >= hi * 0.999,
    atNear = want < lo && s.distance <= lo * 1.001;
  if (atFar || atNear) {
    const way = atFar ? "out" : "in",
      beyond = (s.way === way ? s.beyond : 0) + Math.abs(Math.log(factor));
    return beyond >= BEYOND
      ? { distance: s.distance, beyond: 0, way, through: way }
      : { distance: s.distance, beyond, way, through: null };
  }
  return { distance: Math.max(lo, Math.min(hi, want)), beyond: 0, way: s.way, through: null };
}

type Point = { readonly x: number; readonly y: number; readonly z: number };

/**
 * A flat scene's target, slid as the view zooms by `k` (the new distance over the old) so
 * that what is under the pointer stays about where it was: toward it closing in, away from
 * it drawing back — kept within `bounds` of the scene's middle, if it has them.
 */
export function towardOnFlat(
  target: Point,
  at: Point,
  k: number,
  bounds: { readonly x: number; readonly z: number; readonly reach: number } | null,
): { x: number; z: number } {
  let x = target.x + (at.x - target.x) * (1 - k),
    z = target.z + (at.z - target.z) * (1 - k);
  if (bounds) {
    const dx = x - bounds.x,
      dz = z - bounds.z,
      d = Math.hypot(dx, dz);
    if (d > bounds.reach) {
      x = bounds.x + (dx / d) * bounds.reach;
      z = bounds.z + (dz / d) * bounds.reach;
    }
  }
  return { x, z };
}

/**
 * A globe's view (its turn and tilt, in degrees), turned as the view closes in by `k` so
 * that the point under the pointer comes toward the middle; drawing back leaves it facing
 * as it was (the globe is let go of, not pushed away).
 */
export function towardOnGlobe(
  yaw: number,
  pitch: number,
  at: Point,
  k: number,
): { yaw: number; pitch: number } {
  if (k >= 1) return { yaw, pitch };
  const len = Math.hypot(at.x, at.y, at.z) || 1,
    toYaw = (Math.atan2(at.x, at.z) * 180) / Math.PI,
    toPitch = (-Math.asin(Math.max(-1, Math.min(1, at.y / len))) * 180) / Math.PI,
    // (The short way round.)
    turn = ((((toYaw - yaw) % 360) + 540) % 360) - 180,
    s = 1 - k;
  return { yaw: yaw + turn * s, pitch: pitch + (toPitch - pitch) * s };
}
