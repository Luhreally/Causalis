// Who does what, by the body that bears and the work a land asks (the society sweep, asked 2026-11-16: "gender roles and kin roles
// from a species' body and its labour"). Before it, every grown one of a people worked the same work, bearer or not, and what a child
// cost its mother's work was nothing. Now:
//   How different the sexes' bodies are (DIMORPHISM) comes of how a kind pairs: where one holds several, the strong win partners and
//     grow stronger by it (sexual selection: est, apes that keep harems are half again as heavy in the male); where two raise their
//     young together, a little; where a hive's one bears for all, its workers are one body.
//   What the fields ask of strength (fieldStrength): the plough, drawn and held, asks for the upper body's (Boserup: hoe fields were
//     worked by all, ploughed fields by the stronger); the hunt asks some; machines ask none.
//   How much of a bearer's work goes beyond the home (rolesTarget): the years her young do not hold her (round C's bearingHeld, as many
//     young as her people now bear); of those, the work she can do as well as any (less as fields ask a strength her body lacks);
//     less again where work moves off the family's own fields into shops and works where she cannot keep her young by her, and back
//     as schooling opens the work of the head and machines do the heavy.
//   A people's way holds what its work once asked long after (est: the plough's ways show in its daughters' work a millennium on): the
//     norm moves toward the work's target a fiftieth a year (ROLES.pace).
//   What it costs (forgone): a mother whose work is away from home gives it up for each child; that is a child's cost (Becker), the
//     more as work lies in towns and works.
// Pure functions.
import { dmath } from "../kernel/index.ts";
import type { Pairing } from "./self.ts";

const clamp01 = (x: number): number => dmath.clamp(x, 0, 1);

/** How far the sexes' bodies differ (0: one body; 1: as far as any kind's), by how a kind pairs. */
export const DIMORPHISM: Readonly<Record<Pairing, number>> = {
  harem: 0.8,
  life: 0.25,
  season: 0.15,
  brood: 0,
  none: 0.05,
};

export const ROLES = {
  /** A mother's work given up as her young hold her: the share of her bearing years they hold, by this. */
  held: 1.2,
  /** How far a strength-asking field shuts out the weaker body, at the most different bodies. */
  strength: 0.9,
  /** How far work moved into towns and works, away from the home, shuts out those who keep young. */
  towns: 0.5,
  /** How far schooling and machines open work again, of the years free of young. */
  schooled: 0.45,
  /** The share of the way a people's norm goes toward what its work asks in a year (a fiftieth: some centuries to come round). */
  pace: 0.02,
  /** What a child costs (rules/children.ts childCost) where all its mother's work is away from home and given up for it. */
  cost: 0.6,
} as const;

/** What a land's fields and hunt ask of strength (0 … 1): the plough the most, the hoe little, machines none. */
export function fieldStrength(cultivating: boolean, plough: boolean, machines: number): number {
  const asks = !cultivating ? 0.3 : plough ? 0.7 : 0.25;
  return asks * (1 - clamp01(machines));
}

/** What sets how much of a bearer's work goes beyond the home. */
export type RoleMeans = {
  /** The share of her bearing years her young hold her, as many as her people bear now. */
  readonly held: number;
  readonly dimorphism: number;
  readonly strength: number;
  /** The share of its people in towns, of them who read, of its work engines do. */
  readonly towns: number;
  readonly readers: number;
  readonly machines: number;
};

/** The share of a bearer's work, of one who does not bear, that her land's work would have of her now (0.05 … 0.95). */
export function rolesTarget(m: RoleMeans): number {
  const free = dmath.clamp(1 - ROLES.held * clamp01(m.held), 0.1, 1),
    fields = free * (1 - ROLES.strength * clamp01(m.dimorphism) * clamp01(m.strength)),
    away =
      fields * (1 - ROLES.towns * clamp01(m.towns) * (1 - clamp01(m.readers))) +
      ROLES.schooled * clamp01(m.readers) * clamp01(m.machines) * free;
  return dmath.clamp(away, 0.05, 0.95);
}

/** A people's norm, `years` on toward what its work asks. */
export function normStep(norm: number, target: number, years: number): number {
  return norm + (1 - dmath.pow(1 - ROLES.pace, Math.max(0, years))) * (target - norm);
}

/** What a child costs its mother's work (rules/children.ts childCost's third part): as far as her work is away from home. */
export function forgone(norm: number, towns: number, machines: number): number {
  return ROLES.cost * clamp01(norm) * clamp01(clamp01(towns) + clamp01(machines));
}

/** The share of a realm's seats a people's bearers hold, by their norm and how different their bodies are (a reading). */
export function bearersRule(norm: number, dimorphism: number): number {
  return clamp01(0.5 * clamp01(norm) * (1 - 0.5 * clamp01(dimorphism)) + 0.02);
}
