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
