// How a person's limbs move (Phase 9 M86): walking, the stride; at work, the work's own
// motion — both arms raised and brought down with the hoe and the pick, swept low with the
// sickle, one arm casting seed, the hammer's quick blows on the rising walls, reaching for
// what the wild gives, the rod held out over the water, hands in talk and haggling, the
// spear thrust in the drill with a step, fists and a boxer's shuffle in a brawl, children
// running at play; the axe swung high and down into the trunk, and a load lifted down or up at a
// store (Phase 39 M198). A pure function of the limb, what its person is at and the screen's
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
  // (A bier borne on the shoulder: the arms up to hold it, the legs in a slow step.)
  if (walking && task === "bear")
    return part.role === "arm" ? -2.7 : swing * 0.7 * Math.sin(ph * STRIDES * 0.8 + off);
  if (walking) return swing * Math.sin(ph * STRIDES + off);
  if (part.role === "leg") {
    if (task === "drill") return 0.35 * Math.sign(swing) * Math.max(0, Math.sin(ph * 0.8 + off));
    if (task === "brawl") return 0.3 * Math.sign(swing) * Math.sin(ph * 2.2 + off);
    if (task === "play") return swing * 1.3 * Math.sin(ph * 2.4 + off);
    // (A dance's step, kept to the tune: the ring's off together.)
    if (task === "dance") return swing * 1.1 * Math.sin(ph * 1.6 + i * 0.05);
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
    case "chop":
      // Both hands on the haft: raised over the shoulder and brought down hard.
      return -0.6 - 1.9 * Math.max(0, Math.sin(ph * 1.25 + off)) ** 0.6;
    case "load":
      // Reaching down for the load and lifting it, or setting it down.
      return -0.7 - 0.5 * Math.abs(Math.sin(ph * 0.9 + off));
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
    case "dance":
      // Hands up and swinging, in time with the ring.
      return -1.3 - 0.6 * Math.sin(ph * 1.6 + i * 0.05 + (right ? Math.PI : 0));
    case "feast":
      // A cup or a bite raised now and then; the other hand on the table.
      return right ? -0.5 - 0.9 * Math.max(0, Math.sin(ph * 0.45 + off)) : -0.45;
    case "learn":
      // Still in their rows; now and then a hand up to answer (Phase 41 M199).
      return right && Math.sin(t * 0.7 + i * 2.3) > 0.9 ? -2.7 : -0.12;
    case "pray":
      // Hands together before them; raised all together now and then, as the prayer goes.
      return Math.sin(t * 0.32 + i * 0.03) > 0.82 ? -2.4 : -1.15 + 0.04 * Math.sin(ph * 0.4 + off);
    case "throw":
      // Both hands at the clay turning on the wheel.
      return -1.0 + 0.12 * Math.sin(ph * 1.3 + (right ? Math.PI / 2 : 0));
    case "tend":
      // Feeding the kiln's fire, working the millstones: both arms pushed out and drawn back.
      return -0.7 - 0.6 * Math.max(0, Math.sin(ph * 0.7 + off));
    // A fire fought (Phase 42 M201): a bucket swung up and its water thrown on the flames; buckets
    // passed hand to hand down the line; one dipped and drawn up full; and, watching, a hand to
    // the head now and then.
    case "douse":
      return -0.3 - 1.9 * Math.max(0, Math.sin(ph * 0.55 + off)) ** 0.7;
    case "pass":
      return -1.1 + 0.55 * Math.sin(ph * 0.8 + i * 0.4 + (right ? 0 : Math.PI));
    case "fill":
      return -0.9 - 0.5 * Math.max(0, Math.sin(ph * 0.5 + off));
    case "watch":
      return right && Math.sin(t * 0.37 + i * 1.3) > 0.8 ? -2.6 : 0;
    // A funeral (Phase 43 M205): hands clasped before them, head bowed; the bearers' up to the bier.
    case "mourn":
      return -0.55;
    case "bear":
      return -2.7;
    default:
      return 0;
  }
}

/** How far a body rises off the ground now: a hop at play, a bounce in a brawl. */
export function bobOf(task: Task | null, t: number, i: number): number {
  const ph = t * 2 * Math.PI + i * 1.7;
  if (task === "play") return 0.03 * Math.abs(Math.sin(ph * 2.4));
  if (task === "brawl") return 0.012 * Math.abs(Math.sin(ph * 2.2));
  if (task === "dance") return 0.022 * Math.abs(Math.sin(t * 2 * Math.PI * 1.6 + i * 0.05));
  return 0;
}
