// Halls seen from orbit (Phase 10 M95): where a body's colony sites stand on its face, and the
// domes a site's halls are drawn as. The simulation keeps a site's halls and people, not their
// place on the body, so the view places them: each site on the ground nearest one of three
// directions spread about the body, a little north of its equator — the same each time.
import { sphereGrid } from "../kernel/index.ts";

/** Each site's cell of a body's world grid: the ground (not sea) nearest its direction. */
export function hallCells(frequency: number, cover: Uint8Array, sites = 3): number[] {
  const grid = sphereGrid(frequency),
    p = grid.positions,
    out: number[] = [];
  for (let k = 0; k < sites; k++) {
    const theta = 0.7 + (k * 2 * Math.PI) / sites,
      phi = 0.25,
      dx = Math.cos(theta) * Math.cos(phi),
      dy = Math.sin(phi),
      dz = Math.sin(theta) * Math.cos(phi);
    let ground = -1,
      groundDot = -Infinity,
      any = 0,
      anyDot = -Infinity;
    for (let c = 0; c < grid.count; c++) {
      const d = p[c * 3]! * dx + p[c * 3 + 1]! * dy + p[c * 3 + 2]! * dz;
      if (d > anyDot) {
        anyDot = d;
        any = c;
      }
      // (Sea is 1; ground and ice bear halls.)
      if (cover[c] !== 1 && d > groundDot) {
        groundDot = d;
        ground = c;
      }
    }
    out.push(ground >= 0 ? ground : any);
  }
  return out;
}

/**
 * A site's domes, by its people: the great hall in the middle and the rest about it, each
 * where it stands in the site's own plane (in globe radii) and how large.
 */
export function hallDomes(people: number): { u: number; v: number; r: number }[] {
  const n = Math.max(1, Math.min(7, 1 + Math.floor(Math.log2(Math.max(1, people / 50))))),
    out = [{ u: 0, v: 0, r: 0.011 }];
  for (let i = 1; i < n; i++) {
    const a = ((i - 1) / (n - 1)) * 2 * Math.PI;
    out.push({ u: Math.cos(a) * 0.022, v: Math.sin(a) * 0.022, r: 0.007 });
  }
  return out;
}
