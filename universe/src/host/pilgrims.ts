// Pilgrims on a land's roads (sim/ideas/pilgrims.ts keeps each seat's sum and its greatest ways). It reads, it never touches:
// which of a land's roads out the pilgrims of a year go by is read off where the seat and each way's land lie. At the seat's
// own land each way comes in by the neighbour nearest the land it comes from; at a land a way begins in, it goes out by the
// neighbour nearest the seat. The lands between are not reckoned (a way is kept by its two ends).
import { homePlanet, pilgrimsOf } from "../sim/index.ts";
import type { World } from "../kernel/index.ts";
import { isProvinceWorld } from "../gen/index.ts";

/** Of a land's neighbours, the one nearest another land (itself where it is a neighbour). */
function nearest(world: World, cell: number, far: number): number | null {
  const g = homePlanet(world).generated;
  if (!isProvinceWorld(g)) return null;
  const p = g.grid.positions;
  let best: number | null = null,
    bestD = Infinity;
  for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++) {
    const n = g.grid.neighbours[k]!;
    if (n === far) return n;
    const dx = p[3 * n]! - p[3 * far]!,
      dy = p[3 * n + 1]! - p[3 * far + 1]!,
      dz = p[3 * n + 2]! - p[3 * far + 2]!,
      d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

/** The pilgrims a year who go between a land and one next to it, and to which seat the most of them go (0: none). */
export function pilgrimsBetween(
  world: World,
  cell: number,
  nb: number,
): { pilgrims: number; seat: number | null; of: string | null } {
  let pilgrims = 0,
    most = 0,
    seat: number | null = null,
    of: string | null = null;
  for (const p of pilgrimsOf(world)?.all() ?? []) {
    let n = 0;
    if (p.seat === cell) {
      for (const [from, k] of p.ways) if (nearest(world, cell, from) === nb) n += k;
    } else
      for (const [from, k] of p.ways)
        if (from === cell && nearest(world, cell, p.seat) === nb) n += k;
    if (!n) continue;
    pilgrims += n;
    if (n > most) {
      most = n;
      seat = p.seat;
      of = p.of;
    }
  }
  return { pilgrims, seat, of };
}

/** How many more are on a road at once for its pilgrims: one, and more for more. */
export function pilgrimsBusy(pilgrims: number): number {
  return pilgrims > 0 ? Math.max(1, Math.round(Math.log2(1 + pilgrims / 200))) : 0;
}
