// A town's fishing boats, read off its land (2026-11-22): as many as its share of the land's gatherers who go out by boat
// would crew, and of them, as many tied up at the jetty as its sea has failed them (sim/ecology/seas.ts: a reach fished down;
// a land's own waters, sim/ecology/ecology.ts `fish`). A people of the water go out on the reach they live in, boats or none.
// Pure reading: the same every time it is asked, nothing kept.
import type { World } from "../kernel/index.ts";
import { OCC } from "../rules/index.ts";
import { SEA, ecologyOf, loreOf, populationContext, seaOf } from "../sim/index.ts";

/** Hands to a boat. */
const CREW = 4;
/** The most boats a town's jetty holds. */
export const BOATS_MOST = 6;

/** A town's fishing boats (null: its people do not fish from boats). `laid`: of them, those tied up for want of a catch. */
export function fishingBoats(
  world: World,
  cell: number,
  people: number,
): { boats: number; laid: number; stock: number } | null {
  const ctx = populationContext(world),
    p = ctx.provinces.get(cell);
  if (!p) return null;
  const water = ctx.medium === "water";
  if (!water && !loreOf(world).get(cell, "fishing")) return null;
  const all = p.total();
  if (!all) return null;
  // (Of the town's people, the land's share who gather; of those, the part of their food the boats bring in.)
  const out = (people * p.occupation(OCC.forager)) / all,
    fishers = out * (water ? SEA.lives : SEA.boats),
    boats = Math.max(1, Math.min(BOATS_MOST, Math.round(fishers / CREW))),
    // (What is left to catch: its reach of sea where it goes out on one, else its own waters.)
    sea = seaOf(ctx, cell).sea,
    own = ecologyOf(world).get(cell)?.fish,
    stock = sea ? sea.stock : own !== undefined && own >= 0 ? own : 1,
    // (Not worth going out for: on its reach, those the sea's own reckoning keeps in (sea.out); on its own waters, as they
    // fall below poor.)
    idle = sea
      ? 1 - (sea.out ?? 1)
      : Math.min(1, Math.max(0, (SEA.poor - stock) / (SEA.poor - SEA.least))),
    laid = Math.round(boats * idle);
  return { boats, laid: Math.max(0, laid), stock };
}

/** A town's boats as its plan carries them (empty: its people do not fish from boats, and its plan draws them by its size). */
export function planBoats(
  world: World,
  cell: number,
  people: number,
): { boats?: number; laid?: number } {
  const b = fishingBoats(world, cell, people);
  return b ? { boats: b.boats, ...(b.laid ? { laid: b.laid } : {}) } : {};
}
