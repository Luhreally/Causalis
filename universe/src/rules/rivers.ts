// Rivers that move (breadth round, 2026-11-23): a river on a flat plain builds its bed up with its own silt until a great flood
// breaks out of it for the lower ground beside it and keeps that way (an avulsion; Slingerland and Smith 2004). The greater the
// flood, the flatter the plain and the more silt the river lays there in its year, the likelier. Pure rules; sim/planet/rivers.ts
// moves the bed. Estimates are marked "est".
import { dmath } from "../kernel/index.ts";

export const AVULSION = {
  /** A flood this great or more (its usual 1: planet/floods.ts) can break out for good (est: some one in twelve of them). */
  size: 2.5,
  /** Of such floods on a plain as flat as can be and laying silt fast, the share that move the river (est: a great river's lower
   * course moves some once in five hundred to a thousand years). */
  chance: 0.06,
  /** Slopes (rise over run) past which a river keeps its valley (FLOOD.plain's). */
  flat: 0.02,
  /** The year's silt (a share of the topsoil) at which a bed builds up at its fastest. */
  silt: 0.02,
  /** The new way may stand at most this many metres above the old bed. */
  above: 15,
  /** Tiles about a town or village (of its land's map) that must stay dry for its river to move. */
  clear: 3,
  /** The most moves kept for the pages. */
  kept: 32,
} as const;

/** The chance a flood of `size` on a plain of `slope`, laying `silt` this year, moves its river for good. */
export function avulsionChance(size: number, slope: number, silt: number): number {
  if (size < AVULSION.size) return 0;
  const great = Math.min(2, 1 + (size - AVULSION.size) / 2),
    flat = dmath.clamp(1 - slope / AVULSION.flat, 0, 1),
    laid = 0.5 + 0.5 * dmath.clamp(silt / AVULSION.silt, 0, 1);
  return dmath.clamp(AVULSION.chance * great * flat * laid, 0, 0.25);
}
