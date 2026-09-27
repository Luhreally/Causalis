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

/** Keep a walker `reach` metres across out of the water and the homes (in place). */
export function keepOut(ground: Ground, p: { x: number; z: number }, reach: number): void {
  if (ground.lake) pushOut(ground.lake, p, reach);
  if (p.x * p.x + p.z * p.z < (ground.homesReach + reach) ** 2)
    for (const h of ground.homes) pushOut(h, p, reach);
}

/** Whether (x, z) is clear of the water by `margin` metres. */
export function dryAt(ground: Ground, x: number, z: number, margin: number): boolean {
  const l = ground.lake;
  return !l || Math.hypot(x - l.x, z - l.z) > l.r + margin;
}
