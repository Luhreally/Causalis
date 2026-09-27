// How a person's limbs move (Phase 9 M86): walking, the stride; at work, the work's own
// motion — both arms raised and brought down with the hoe and the pick, swept low with the
// sickle, one arm casting seed, the hammer's quick blows on the rising walls, reaching for
// what the wild gives, the rod held out over the water, hands in talk and haggling, the
// spear thrust in the drill with a step, fists and a boxer's shuffle in a brawl, children
// running at play. A pure function of the limb, what its person is at and the screen's
// clock, so the same moment always looks the same and watching never touches history.
import type { FigurePart } from "./figure.ts";
import type { Task } from "./village.ts";

/** Strides a second at an easy walk. */
export const STRIDES = 1.6;

/**
 * How far a limb is swung now, radians about its hinge (a hip, a shoulder): `walking` or at
 * `task`, at screen time `t` seconds; `i` sets each person a little out of step.
 */
export function limbPitch(
  part: FigurePart,
  task: Task | null,
  walking: boolean,
  t: number,
  i: number,
): number {
  const swing = part.swing ?? 0;
  if (!swing) return 0;
  const ph = t * 2 * Math.PI,
    off = i * 1.7,
    // The right arm (and leg) swings with a positive sign on an upright figure.
    right = swing > 0;
  if (walking) return swing * Math.sin(ph * STRIDES + off);
  if (part.role === "leg") {
    if (task === "drill") return 0.35 * Math.sign(swing) * Math.max(0, Math.sin(ph * 0.8 + off));
    if (task === "brawl") return 0.3 * Math.sign(swing) * Math.sin(ph * 2.2 + off);
    if (task === "play") return swing * 1.3 * Math.sin(ph * 2.4 + off);
    return 0;
  }
  switch (task) {
    case "hoe":
    case "dig":
      // Raised forward and up, and brought down.
      return -0.4 - 1.8 * Math.max(0, Math.sin(ph * (task === "dig" ? 1.1 : 0.8) + off));
    case "reap":
      return -0.9 + 0.55 * Math.sin(ph * 0.9 + off);
    case "sow":
      return right ? -0.3 - 1.1 * Math.max(0, Math.sin(ph * 0.7 + off)) : -0.5;
    case "hammer":
    case "build":
      return right ? -0.9 - 0.8 * Math.abs(Math.sin(ph * 1.6 + off)) : -0.6;
    case "gather":
      return -0.9 + 0.45 * Math.sin(ph * 0.6 + off + (right ? Math.PI : 0));
    case "fish":
      return -0.95 + 0.05 * Math.sin(ph * 0.3 + off);
    case "herd":
      return right ? -0.35 : 0;
    case "talk":
    case "haggle":
      // Hands now and then, as the talk runs.
      return (
        -0.2 -
        0.55 *
          Math.max(0, Math.sin(ph * 0.5 + off + (right ? 2 : 0))) *
          (Math.sin(ph * 0.13 + i) > 0 ? 1 : 0.2)
      );
    case "drill":
      return -0.2 - 1.4 * Math.max(0, Math.sin(ph * 0.8 + off));
    case "brawl":
      return -1.5 * Math.max(0, Math.sin(ph * 2.2 + off + (right ? Math.PI : 0)));
    case "play":
      return swing * 1.3 * Math.sin(ph * 2.4 + off);
    default:
      return 0;
  }
}

/** How far a body rises off the ground now: a hop at play, a bounce in a brawl. */
export function bobOf(task: Task | null, t: number, i: number): number {
  const ph = t * 2 * Math.PI + i * 1.7;
  if (task === "play") return 0.03 * Math.abs(Math.sin(ph * 2.4));
  if (task === "brawl") return 0.012 * Math.abs(Math.sin(ph * 2.2));
  return 0;
}
