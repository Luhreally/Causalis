// What stands on a village's ground that a walker cannot walk through (Phase 9 M85): its
// water — save to a swimmer — and its homes, each a circle on the ground; and the push that
// keeps a walker out of them, to the nearest point of the edge, so that passing one is a
// smooth step around it and never a jump. A walker is kept its own reach off them (a
// beast's half-length as drawn), so its body does not pass into a wall either.
import { LAKE_R, type VillagePlan } from "../bridge/index.ts";
import { houseLook } from "./village.ts";

export type Solid = { readonly x: number; readonly z: number; readonly r: number };

export type Ground = {
  readonly lake: Solid | null;
  readonly homes: readonly Solid[];
  /** How far out from the middle the homes reach (a walker further out passes none). */
  readonly homesReach: number;
};

/** A village's solid ground, from its plan (metres). */
export function villageGround(plan: VillagePlan): Ground {
  const look = houseLook(plan.house),
    // (A house's drawn measures are tenths of its metres; its roof overhangs its walls.)
    half = 5 * 1.15 * Math.hypot(look.length, look.width),
    homes = plan.homes.map((h) => ({ x: h.x, z: h.z, r: half }));
  let reach = 0;
  for (const h of homes) reach = Math.max(reach, Math.hypot(h.x, h.z) + h.r);
  return {
    lake: plan.water ? { x: plan.water.x, z: plan.water.z, r: LAKE_R } : null,
    homes,
    homesReach: reach,
  };
}

/** Push `p` out of `s` (with `reach` to spare) to the nearest point of its edge, in place. */
function pushOut(s: Solid, p: { x: number; z: number }, reach: number): void {
  const r = s.r + reach,
    dx = p.x - s.x,
    dz = p.z - s.z,
    d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return;
  const d = Math.sqrt(d2);
  if (d < 1e-9) {
    p.x = s.x + r;
    return;
  }
  p.x = s.x + (dx / d) * r;
  p.z = s.z + (dz / d) * r;
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

type Point = { readonly x: number; readonly z: number };

/** The first solid the way from p to q passes through (not one it starts or ends in). */
function firstHit(ground: Ground, p: Point, q: Point, reach: number): Solid | null {
  const dx = q.x - p.x,
    dz = q.z - p.z,
    len2 = dx * dx + dz * dz;
  let best: Solid | null = null,
    bestT = Infinity;
  const test = (s: Solid) => {
    const r = s.r + reach;
    if (Math.hypot(p.x - s.x, p.z - s.z) < r || Math.hypot(q.x - s.x, q.z - s.z) < r) return;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((s.x - p.x) * dx + (s.z - p.z) * dz) / len2)) : 0,
      cx = p.x + dx * t - s.x,
      cz = p.z + dz * t - s.z;
    if (cx * cx + cz * cz < r * r && t < bestT) {
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
 * the edge beside it — a few turns at most.
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
      // Beside the solid, on the side the way passes: out from its middle through the way's
      // nearest point, a little past its edge.
      const dx = q.x - p.x,
        dz = q.z - p.z,
        len2 = dx * dx + dz * dz || 1,
        t = Math.max(0, Math.min(1, ((s.x - p.x) * dx + (s.z - p.z) * dz) / len2));
      let ox = p.x + dx * t - s.x,
        oz = p.z + dz * t - s.z;
      const d = Math.hypot(ox, oz);
      if (d < 1e-6) {
        ox = -dz;
        oz = dx;
      }
      const n = Math.hypot(ox, oz) || 1,
        out = (s.r + reach) * 1.15 + 0.5,
        turn = { x: s.x + (ox / n) * out, z: s.z + (oz / n) * out };
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
