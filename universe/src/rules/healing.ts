// How a wound heals (Phase 55 M229; asked for 2026-10-26: "Healers tending the wounded"): so many
// days abed, then so many more up and about with it bound, by what came of it — a wound that
// healed, one that scarred, a limb left lame, a member lost (a hand, an arm, a leg, an eye) — the
// longer for a burn, a ball or a crushing, the shorter where care is known (rules/wounds.ts
// woundCare) and where it is tended best: at a hospital, by a healer, at home, by kin. Who tends
// it: a hospital where the town keeps one; else its healer, where its land knows herb-lore; else
// their household; else kin. Those who cannot walk are borne home from the road on litters: every
// one abed where care is known so far (LITTER_CARE); elsewhere one whose leg is lost or lamed.
import type { Blow } from "./wounds.ts";
import type { Member, Outcome } from "./anatomy.ts";

export type Tended = "hospital" | "healer" | "household" | "kin";
/** Days abed, then days up with it bound, by what came of a wound (a member lost: which). */
export const HEAL_DAYS = {
  healed: [2, 12],
  scarred: [5, 21],
  lame: [14, 42],
  hand: [14, 35],
  arm: [14, 35],
  leg: [21, 42],
  eye: [7, 21],
} as const;
/** How a blow's wound draws its days out: a burn's, a ball's and a crushing's the most. */
export const HEAL_BLOW: Readonly<Record<Blow, number>> = {
  edge: 1,
  point: 1.1,
  blunt: 0.9,
  shot: 1.25,
  crush: 1.2,
  fire: 1.4,
};
/** How who tends it draws them in or out. */
export const HEAL_TENDED: Readonly<Record<Tended, number>> = {
  hospital: 0.85,
  healer: 0.95,
  household: 1,
  kin: 1.1,
};
/** Care at its fullest takes so much off the days. */
export const HEAL_CARE = 0.3;
/** Where care is known so far, the wounded abed are borne home from the road on litters. */
export const LITTER_CARE = 0.35;

/** A wound's days abed, then up with it bound (each at least one). */
export function healDays(
  outcome: Outcome,
  member: Member,
  blow: Blow,
  care: number,
  tended: Tended,
): { readonly abed: number; readonly mending: number } {
  const kind =
      outcome !== "lost"
        ? outcome
        : member === "eye-l" || member === "eye-r"
          ? "eye"
          : member === "hand-l" || member === "hand-r"
            ? "hand"
            : member === "leg-l" || member === "leg-r"
              ? "leg"
              : "arm",
    [abed, mending] = HEAL_DAYS[kind],
    f = HEAL_BLOW[blow] * (1 - HEAL_CARE * Math.min(1, Math.max(0, care))) * HEAL_TENDED[tended];
  return { abed: Math.max(1, Math.round(abed * f)), mending: Math.max(1, Math.round(mending * f)) };
}

/** Who tends a wound: a hospital, else the healer, else the household, else kin. */
export function tendedBy(hospital: boolean, healer: boolean, household: boolean): Tended {
  return hospital ? "hospital" : healer ? "healer" : household ? "household" : "kin";
}

/** Whether one wounded comes home on a litter: abed still when they come, and care known so far — or a leg lost or lamed, whatever is known. */
export function borneHome(
  care: number,
  member: Member,
  outcome: Outcome,
  abedAtHome: boolean,
): boolean {
  return (
    abedAtHome &&
    (care >= LITTER_CARE ||
      ((member === "leg-l" || member === "leg-r") && (outcome === "lost" || outcome === "lame")))
  );
}
