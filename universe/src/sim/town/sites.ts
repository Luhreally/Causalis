// Where a town's buildings go (asked 2026-11-16): by what each needs of its ground, not by the order its lots come. A town's
// plan is taken in quarters, eight to each round of its growth — toward its water, its lee, its high ground, its busiest way
// in, and four more — a pure function of its seed and the block (bridge/sites.ts lays each quarter's blocks that way on the
// ground, so what is reckoned here is what is seen). A mill is begun on a block toward the water; a smithy's smoke on one in
// the lee; a granary on the high ground near the square; the station toward the way in. Nothing is kept: the quarter of a
// block is read again whenever it is asked.
import { cellRef } from "../../gen/index.ts";
import { hashString, mix, type World } from "../../kernel/index.ts";
import { lessened } from "../lore/lessons-store.ts";

/** The quarters (bridge/sites.ts QUARTER: the same numbers). */
export const QUARTER = { water: 0, lee: 1, high: 2, road: 3 } as const;
export const QUARTERS = 8;
const PATTERN = [3, 4, 0, 5, 1, 6, 2, 7] as const;
/** The blocks about the square that are a town's heart (bridge/sites.ts HEART_BLOCKS). */
export const HEART_BLOCKS = 8;

/** A town's plan's seed, as its plan is drawn (host/town.ts townPlan's). */
export function townSeed(town: string): number {
  return hashString(`town ${town}`);
}

/** Which quarter a block of a town's plan is taken in (bridge/sites.ts quarterOf, the same). */
export function quarterOf(seed: number, block: number): number {
  const round = Math.floor(block / QUARTERS),
    turn = (mix(mix(0x51ed270b, seed), round) >>> 0) % QUARTERS;
  return PATTERN[(block + turn) % QUARTERS]!;
}

/** Whether a block is ground a town wary of floods keeps its new homes off: toward its water, past its heart. */
export function floodGround(seed: number, block: number): boolean {
  return block >= HEART_BLOCKS && quarterOf(seed, block) === QUARTER.water;
}

/** Whether a land's towns are wary of floods: they have flooded, and learned from it (raised floors and a way to the high ground). */
export function floodWary(world: World, cell: number, year: number): boolean {
  return lessened(world, cellRef(0, cell), "flood", year) < 1;
}
