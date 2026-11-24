// A world's air and what it keeps off and lets go (the planet's last gaps, 2026-11-24). Pure functions.
//
// - Escape: a star's wind tears at the top of an air its world's field does not hold it off; what it carries away a billion
//   years is as the wind's pressure, the share of it the field lets through and the face the world shows it, over the weight
//   of its air and the depth of the well it must climb out of (its mass over its radius). A small unsheltered world near an
//   active star is left thin air; a heavy one, or one behind a field, keeps its own. Its fire below breathes air back, so it
//   thins toward where the two balance and not to nothing.
import { dmath } from "../kernel/index.ts";

export const ESCAPE = {
  /**
   * The share of an Earth's air an unsheltered Earth would lose a billion years to the Sun's wind at Earth's distance (est:
   * fitted so that a world of Mars's size and place, with no field, loses about a quarter of a bar-deep air in four billion).
   */
  rate: 0.15,
  /** The share of its air a world's fire below breathes back a billion years, where its plates turn (est). */
  breath: 0.2,
  /** Under this share lost a world's air is as it was made (nothing is reckoned). */
  least: 0.05,
} as const;

/**
 * The share of its air a world loses a billion years to its star's wind: the wind's pressure at its orbit (the Sun's at Earth
 * 1), the share its field keeps off (0 … 1), its mass and radius against Earth's and its air's pressure in bars.
 */
export function airLoss(w: {
  readonly wind: number;
  readonly shelter: number;
  readonly mass: number;
  readonly radius: number;
  readonly pressure: number;
}): number {
  // (Its face over its well's depth: R² over M/R. The weight of its air: its pressure over its pull, on its face.)
  const well = (w.radius * w.radius * w.radius) / Math.max(0.01, w.mass);
  return (
    (ESCAPE.rate * Math.max(0, w.wind) * dmath.clamp(1 - w.shelter, 0, 1) * well) /
    Math.max(0.05, w.pressure)
  );
}

/**
 * What is left of a world's air after so many billion years of losing that share, its fire below breathing some back (`fire`:
 * 1 where its plates turn): it falls toward where the two balance. 1 where the loss is under a twentieth.
 */
export function airKept(lossAGyr: number, gyr: number, fire = 1): number {
  const loss = Math.max(0, lossAGyr),
    back = ESCAPE.breath * Math.max(0, fire),
    rests = loss + back > 0 ? back / (loss + back) : 1,
    kept = rests + (1 - rests) * dmath.exp(-(loss + back) * Math.max(0, gyr));
  return 1 - kept < ESCAPE.least ? 1 : kept;
}
