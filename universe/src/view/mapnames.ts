// A realm's name across its lands (Phase 10 M96), as a grand strategy map writes it: along
// the way its lands stretch, as long as they are. From its lands' middles on the globe: their
// centre, the line they run along (the long axis of their spread over the sphere's face),
// and how far they run each way. Pure — the page lays the name on the screen each frame.
import type { SphereGrid } from "../kernel/index.ts";

export type NameShape = {
  /** The centre of its lands, on the unit sphere. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** The way its lands stretch (a unit tangent at the centre), and how far each way (radians). */
  readonly ax: number;
  readonly ay: number;
  readonly az: number;
  readonly half: number;
};

/** The shape a name is written on, for lands whose middles are `spots` of the grid. */
export function nameShape(spots: readonly number[], grid: SphereGrid): NameShape | null {
  if (!spots.length) return null;
  const p = grid.positions;
  let x = 0,
    y = 0,
    z = 0;
  for (const s of spots) {
    x += p[s * 3]!;
    y += p[s * 3 + 1]!;
    z += p[s * 3 + 2]!;
  }
  const l = Math.hypot(x, y, z) || 1;
  x /= l;
  y /= l;
  z /= l;
  // A tangent basis at the centre: east (about the pole), and north.
  let ex = z,
    ey = 0,
    ez = -x;
  const el = Math.hypot(ex, ey, ez);
  if (el < 1e-6) {
    ex = 1;
    ez = 0;
  } else {
    ex /= el;
    ez /= el;
  }
  const nx = y * ez - z * ey,
    ny = z * ex - x * ez,
    nz = x * ey - y * ex;
  // The spread of its lands over that face, and its long axis.
  let suu = 0,
    svv = 0,
    suv = 0;
  const uv = spots.map((s) => {
    const dx = p[s * 3]! - x,
      dy = p[s * 3 + 1]! - y,
      dz = p[s * 3 + 2]! - z,
      u = dx * ex + dy * ey + dz * ez,
      v = dx * nx + dy * ny + dz * nz;
    suu += u * u;
    svv += v * v;
    suv += u * v;
    return [u, v] as const;
  });
  const theta = spots.length > 1 ? 0.5 * Math.atan2(2 * suv, suu - svv) : 0,
    cu = Math.cos(theta),
    cv = Math.sin(theta);
  let half = 0;
  for (const [u, v] of uv) half = Math.max(half, Math.abs(u * cu + v * cv));
  // (A land alone, or lands in a line: as wide as a land at the least.)
  half = Math.max(half + 0.02, 0.035);
  return {
    x,
    y,
    z,
    ax: ex * cu + nx * cv,
    ay: ey * cu + ny * cv,
    az: ez * cu + nz * cv,
    half,
  };
}

/** A name as laid on the screen: its middle, turn (degrees), letter size and letters. */
export type LaidName = {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly size: number;
  readonly chars: number;
  /** How much it matters (its lands): the more, the sooner it is written. */
  readonly rank?: number;
};

/** A laid name's box: its middle, its half-length along its turn and half-height across. */
function boxOf(n: LaidName) {
  const a = (n.angle * Math.PI) / 180;
  return {
    x: n.x,
    y: n.y,
    // (Spaced capitals: each letter and its space some 0.95 of the letters' size.)
    hw: (n.chars * n.size * 0.95) / 2,
    hh: n.size * 0.62,
    ux: Math.cos(a),
    uy: Math.sin(a),
  };
}

/** Whether two laid names' boxes cross (the separating axis test for turned boxes). */
function overlap(a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>): boolean {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  for (const [ux, uy] of [
    [a.ux, a.uy],
    [-a.uy, a.ux],
    [b.ux, b.uy],
    [-b.uy, b.ux],
  ] as const) {
    const reach = (r: ReturnType<typeof boxOf>) =>
      r.hw * Math.abs(r.ux * ux + r.uy * uy) + r.hh * Math.abs(-r.uy * ux + r.ux * uy);
    if (Math.abs(dx * ux + dy * uy) > reach(a) + reach(b)) return false;
  }
  return true;
}

/**
 * How large each name can be written without crossing another: the greatest realms' first,
 * as a grand strategy map writes them; a name that would cross one already written is tried
 * smaller (three quarters, then half its size), and left out (0) if it still would.
 */
export function namesThatFit(names: readonly LaidName[], least = 8): number[] {
  const order = names
      .map((_, i) => i)
      .sort(
        (a, b) =>
          (names[b]!.rank ?? names[b]!.size) - (names[a]!.rank ?? names[a]!.size) ||
          names[b]!.size - names[a]!.size ||
          a - b,
      ),
    kept: ReturnType<typeof boxOf>[] = [],
    fits = names.map(() => 0);
  for (const i of order)
    for (const k of [1, 0.75, 0.5]) {
      const n = names[i]!;
      if (n.size * k < least) break;
      const box = boxOf({ ...n, size: n.size * k });
      if (kept.some((b) => overlap(b, box))) continue;
      kept.push(box);
      fits[i] = k;
      break;
    }
  return fits;
}

/** Whether a point (a seat's star) falls within a laid name's letters. */
export function withinName(n: LaidName, x: number, y: number): boolean {
  const b = boxOf(n),
    dx = x - b.x,
    dy = y - b.y;
  return Math.abs(dx * b.ux + dy * b.uy) < b.hw && Math.abs(-dx * b.uy + dy * b.ux) < b.hh;
}
