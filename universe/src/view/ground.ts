// What stands on a village's ground that a walker cannot walk through (Phase 9 M85–M86):
// its water — save to a swimmer — and its homes, each a solid on the ground (a home as long
// as it is built: a core along its length, rounded at its ends; the water and a round home a
// circle); and the push that keeps a walker out of them, to the nearest point of the wall,
// so that passing one is a smooth step around it and never a jump. A walker is kept its own
// reach off them (a beast's half-length as drawn), so its body does not pass into a wall.
import { LAKE_R, type VillagePlan } from "../bridge/index.ts";
import { houseLook } from "./village.ts";

/**
 * A solid on the ground: its middle and how far its wall stands from its core; a long one's
 * core runs along a unit axis (ax, az), `half` its length each way (0: a circle).
 */
export type Solid = {
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly ax?: number;
  readonly az?: number;
  readonly half?: number;
};

export type Ground = {
  readonly lake: Solid | null;
  readonly homes: readonly Solid[];
  /** How far out from the middle the homes reach (a walker further out passes none). */
  readonly homesReach: number;
};

type Point = { readonly x: number; readonly z: number };

const GROUNDS = new WeakMap<VillagePlan, Ground>();

/** A village's solid ground, from its plan (metres; kept while the plan stands). */
export function villageGround(plan: VillagePlan): Ground {
  const known = GROUNDS.get(plan);
  if (known) return known;
  const g = groundOf(plan);
  GROUNDS.set(plan, g);
  return g;
}

function groundOf(plan: VillagePlan): Ground {
  const look = houseLook(plan.house),
    // (A house's drawn measures are tenths of its metres; its roof overhangs its walls.)
    long = look.length * 10 * 1.15,
    wide = look.width * 10 * 1.15,
    r = look.round ? Math.max(long, wide) / 2 : Math.min(long, wide) / 2,
    half = look.round ? 0 : Math.abs(long - wide) / 2,
    alongLength = long >= wide,
    homes = plan.homes.map((h) => {
      // (A home's length runs along its own x, turned by its yaw.)
      const c = Math.cos(h.yaw),
        s = Math.sin(h.yaw);
      return alongLength
        ? { x: h.x, z: h.z, r, ax: c, az: -s, half }
        : { x: h.x, z: h.z, r, ax: s, az: c, half };
    });
  let reach = 0;
  for (const h of homes) reach = Math.max(reach, Math.hypot(h.x, h.z) + h.r + h.half);
  return {
    lake: plan.water ? { x: plan.water.x, z: plan.water.z, r: LAKE_R } : null,
    homes,
    homesReach: reach,
  };
}

/** The point of a solid's core nearest (px, pz). */
function coreNear(s: Solid, px: number, pz: number): [number, number] {
  const h = s.half ?? 0;
  if (!h) return [s.x, s.z];
  const ax = s.ax ?? 1,
    az = s.az ?? 0,
    t = Math.max(-h, Math.min(h, (px - s.x) * ax + (pz - s.z) * az));
  return [s.x + ax * t, s.z + az * t];
}

/** How far a point stands clear of a solid's wall (less than nothing: inside it). */
export function clearOf(s: Solid, p: Point): number {
  const [cx, cz] = coreNear(s, p.x, p.z);
  return Math.hypot(p.x - cx, p.z - cz) - s.r;
}

/** Push `p` out of `s` (with `reach` to spare) to the nearest point of its wall, in place. */
function pushOut(s: Solid, p: { x: number; z: number }, reach: number): void {
  const [cx, cz] = coreNear(s, p.x, p.z),
    r = s.r + reach,
    dx = p.x - cx,
    dz = p.z - cz,
    d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;
  const d = Math.sqrt(d2);
  if (d < 1e-9) {
    // (On the core itself: out across it.)
    p.x = cx - (s.az ?? 0) * r;
    p.z = cz + (s.ax ?? 1) * r;
    return;
  }
  p.x = cx + (dx / d) * r;
  p.z = cz + (dz / d) * r;
}

/**
 * Keep a walker `reach` metres across out of the water and the homes (in place) — pushed
 * again where homes stand so close that out of one is into the next.
 */
export function keepOut(ground: Ground, p: { x: number; z: number }, reach: number): void {
  for (let pass = 0; pass < 3; pass++) {
    const x = p.x,
      z = p.z;
    if (ground.lake) pushOut(ground.lake, p, reach);
    if (p.x * p.x + p.z * p.z < (ground.homesReach + reach) ** 2)
      for (const h of ground.homes) pushOut(h, p, reach);
    if (p.x === x && p.z === z) return;
  }
}

/** Whether (x, z) is clear of the water by `margin` metres. */
export function dryAt(ground: Ground, x: number, z: number, margin: number): boolean {
  const l = ground.lake;
  return !l || Math.hypot(x - l.x, z - l.z) > l.r + margin;
}

/** The distance from a point to a segment. */
function toSegment(px: number, pz: number, a: Point, b: Point): number {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    len2 = dx * dx + dz * dz,
    t = len2 > 0 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / len2)) : 0;
  return Math.hypot(px - (a.x + dx * t), pz - (a.z + dz * t));
}

/** A solid's core as a segment (both ends the middle, for a circle). */
function coreOf(s: Solid): [Point, Point] {
  const h = s.half ?? 0,
    ax = s.ax ?? 1,
    az = s.az ?? 0;
  return [
    { x: s.x - ax * h, z: s.z - az * h },
    { x: s.x + ax * h, z: s.z + az * h },
  ];
}

/** The nearest two segments come (nothing, where they cross). */
function between(p: Point, q: Point, a: Point, b: Point): number {
  const cross = (o: Point, u: Point, v: Point) =>
      (u.x - o.x) * (v.z - o.z) - (u.z - o.z) * (v.x - o.x),
    d1 = cross(p, q, a),
    d2 = cross(p, q, b),
    d3 = cross(a, b, p),
    d4 = cross(a, b, q);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  return Math.min(
    toSegment(a.x, a.z, p, q),
    toSegment(b.x, b.z, p, q),
    toSegment(p.x, p.z, a, b),
    toSegment(q.x, q.z, a, b),
  );
}

/** The first solid the way from p to q passes through (not one it starts or ends in). */
function firstHit(ground: Ground, p: Point, q: Point, reach: number): Solid | null {
  const dx = q.x - p.x,
    dz = q.z - p.z,
    len2 = dx * dx + dz * dz;
  let best: Solid | null = null,
    bestT = Infinity;
  // The way's box: a solid whose middle stands further off it than its own reach cannot be
  // hit, and most of a village's homes are far from any one way (so they cost a comparison).
  const x0 = Math.min(p.x, q.x),
    x1 = Math.max(p.x, q.x),
    z0 = Math.min(p.z, q.z),
    z1 = Math.max(p.z, q.z);
  const test = (s: Solid) => {
    const r = s.r + reach,
      span = r + (s.half ?? 0);
    if (s.x < x0 - span || s.x > x1 + span || s.z < z0 - span || s.z > z1 + span) return;
    if (clearOf(s, p) < reach || clearOf(s, q) < reach) return;
    const [a, b] = coreOf(s);
    if (between(p, q, a, b) >= r) return;
    const t = len2 > 0 ? ((s.x - p.x) * dx + (s.z - p.z) * dz) / len2 : 0;
    if (t < bestT) {
      bestT = t;
      best = s;
    }
  };
  if (ground.lake) test(ground.lake);
  for (const h of ground.homes) test(h);
  return best;
}

/**
 * A way from `a` to `b` round the solids between, as the points to pass (a walker's
 * `reach` kept off each wall): where the straight way would pass through one, it turns at
 * the wall beside it — a few turns at most.
 */
export function route(ground: Ground, a: Point, b: Point, reach: number): Point[] {
  const way: Point[] = [a, b];
  for (let pass = 0; pass < 4; pass++) {
    let turned = false;
    for (let k = 0; k + 1 < way.length && way.length < 10; k++) {
      const p = way[k]!,
        q = way[k + 1]!,
        s = firstHit(ground, p, q, reach);
      if (!s) continue;
      // Beside the solid, on the side the way passes: out from its core through the way's
      // nearest point to it, a little past its wall.
      const dx = q.x - p.x,
        dz = q.z - p.z,
        len2 = dx * dx + dz * dz || 1,
        t = Math.max(0, Math.min(1, ((s.x - p.x) * dx + (s.z - p.z) * dz) / len2)),
        on = { x: p.x + dx * t, z: p.z + dz * t },
        [cx, cz] = coreNear(s, on.x, on.z);
      let ox = on.x - cx,
        oz = on.z - cz;
      if (Math.hypot(ox, oz) < 1e-6) {
        ox = -dz;
        oz = dx;
      }
      const n = Math.hypot(ox, oz) || 1,
        out = (s.r + reach) * 1.15 + 0.5,
        turn = { x: cx + (ox / n) * out, z: cz + (oz / n) * out };
      // (Clear of any wall beside it, too.)
      keepOut(ground, turn, reach);
      way.splice(k + 1, 0, turn);
      turned = true;
      k++;
    }
    if (!turned) break;
  }
  return way;
}
