// Halls seen from orbit (Phase 10 M95): where a body's colony sites stand on its face, and the
// domes a site's halls are drawn as. The simulation keeps a site's halls and people, not their
// place on the body, so the view places them: each site on the ground nearest one of three
// directions spread about the body, a little north of its equator — the same each time.
export { hallCells } from "../rules/index.ts";

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
