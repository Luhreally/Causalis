// How far a people's "us" reaches toward beings of other bodies (the breadth round, 2026-11-23; the audit's "moral circle toward
// aliens", absent: a people of the stars was met by every people alike, whatever it was). A people counts as its own those it
// imagines one with it (rules/folk.ts: a valley's before letters, as wide as its readers and its word reach after); toward a being of
// another body it reaches as far as that being is like it: the medium it lives in, the senses it knows the world by, its limbs, its
// size, how closely it lives with its own, the life it is made of. A faith whose power harms is wary of strangers, who bring
// sickness; one whose power gives shares, one whose power knows is curious. Where the circle reaches, a meeting leans to wonder and
// trade and away from fear and war, and a people sends its fleets against the other the less. Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import type { BodyPlan } from "./bodies.ts";

export const CIRCLE = {
  /** Of a people's "us", the share that reaches a being wholly unlike it: the rest as far as it is like. */
  unlike: 0.3,
  /** What a faith's power does to the circle, at a creed wholly of it. */
  harms: -0.25,
  gives: 0.15,
  knows: 0.15,
  /** At a circle of 1, the share of a meeting's lean to war and to fear it takes away, and what it adds to wonder and trade. */
  war: 0.6,
  fear: 0.3,
  warm: 0.4,
} as const;

const clamp01 = (x: number) => dmath.clamp(x, 0, 1);

/** How alike two bodies are (0 … 1): medium, senses, the limbs that handle things, size, sociality, and the life they are of. */
export function bodyLikeness(
  a: Pick<BodyPlan, "medium" | "senses" | "manipulators" | "size" | "social" | "symmetry">,
  b: Pick<BodyPlan, "medium" | "senses" | "manipulators" | "size" | "social" | "symmetry">,
  sameLife: boolean,
): number {
  const sa = new Set(a.senses),
    both = b.senses.filter((x) => sa.has(x)).length,
    senses = both / Math.max(1, new Set([...a.senses, ...b.senses]).size),
    size = dmath.sqrt(Math.min(a.size, b.size) / Math.max(1e-6, a.size, b.size));
  return clamp01(
    0.2 * (a.medium === b.medium ? 1 : 0) +
      0.2 * senses +
      0.15 * (a.manipulators === b.manipulators ? 1 : 0) +
      0.1 * (a.symmetry === b.symmetry ? 1 : 0) +
      0.1 * size +
      0.1 * (1 - Math.min(1, Math.abs(a.social - b.social) * 2)) +
      0.15 * (sameLife ? 1 : 0),
  );
}

/** How far a people's circle reaches toward a being (0 … 1): its "us" (rules/folk.ts), the being's likeness, its faith's powers. */
export function moralCircle(r: {
  /** How far its "us" reaches (0 … 1). */
  readonly reach: number;
  readonly likeness: number;
  /** Its faith's creed, as shares of the powers (0 … 1 each; none: 0). */
  readonly harms: number;
  readonly gives: number;
  readonly knows: number;
}): number {
  return clamp01(
    clamp01(r.reach) * (CIRCLE.unlike + (1 - CIRCLE.unlike) * clamp01(r.likeness)) +
      CIRCLE.harms * clamp01(r.harms) +
      CIRCLE.gives * clamp01(r.gives) +
      CIRCLE.knows * clamp01(r.knows),
  );
}

/** A meeting's leanings (wonder, fear, trade, war) as a circle bends them. */
export function circleLeans(
  w: readonly [number, number, number, number],
  circle: number,
): [number, number, number, number] {
  const c = clamp01(circle);
  return [
    w[0] * (1 + CIRCLE.warm * c),
    w[1] * (1 - CIRCLE.fear * c),
    w[2] * (1 + CIRCLE.warm * c),
    w[3] * (1 - CIRCLE.war * c),
  ];
}

/** A circle in words. */
export function circleWords(circle: number): string {
  return circle >= 0.6
    ? "they count beings like these among their own"
    : circle >= 0.35
      ? "they count beings like these half their own"
      : circle >= 0.15
        ? "beings like these are strangers to them, but not beasts"
        : "beings like these are no one to them";
}
