// A land's unable, kept (society/unable.ts): one row a land, in thousandths of its grown unless said. Their share; of it those maimed in
// its realm's wars, weakened by its settled sicknesses, short of breath in its foul air, hurt at their work; the share of them someone
// keeps (of the unable); whether their number has been told (0 or 1). This file reaches only the kernel and the society's kept rows, so
// the population's year reads it without a circle.
import type { World } from "../../kernel/index.ts";
import { societyStore } from "./kept.ts";

export const UNABLE_STORE = "society.unable";
export const UNABLE_WIDTH = 7;
export const UNABLE_ROW = {
  share: 0,
  war: 1,
  sick: 2,
  smoke: 3,
  mishap: 4,
  kept: 5,
  told: 6,
} as const;

/** The share of a land's grown unable to work (0 where none is reckoned). */
export function unableOf(world: World, cell: number): number {
  return (societyStore(world, UNABLE_STORE)?.at(cell, UNABLE_ROW.share) ?? 0) / 1000;
}
