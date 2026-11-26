// How a wound heals (Phase 55 M229; asked for 2026-10-26: "Healers tending the wounded"): so many
// days abed, then so many more up and about with it bound, by what came of it — a wound that
// healed, one that scarred, a limb left lame, a member lost (a hand, an arm, a leg, an eye) — the
// longer for a burn, a ball or a crushing, the shorter where care is known (rules/wounds.ts
// woundCare) and where it is tended best: at a hospital, by a healer, at home, by kin. Who tends
// it: a hospital where the town keeps one; else its healer, where its land knows herb-lore; else
// their household; else kin. Those who cannot walk are borne home from the road on litters: every
// one abed where care is known so far (LITTER_CARE); elsewhere one whose leg is lost or lamed.
import { DIED_OF_WOUNDS, WOUNDS, type Blow } from "./wounds.ts";
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

// —— A wound by the hour (town mode N9, asked 2026-11-26: "health by body member: bleeding, pain, infection, a doctor's
// work, a stock of medicine"). What the world's tables say of wounds in a year (rules/wounds.ts: of the wounded, the share
// who die of it later without care, DIED_OF_WOUNDS; how much of that full care saves, WOUNDS.save) is lived here hour by
// hour by a body that bleeds and may fester, and by whoever comes to stop the one and fight the other.
//   Bleeding. A wound bleeds as hard as its blow opened it, and a wound left alone bleeds the less as it clots, by half
//     each ten minutes (est: a cut stops of itself within minutes; a deep one slows as it clots). Untended it loses twice
//     its first ten minutes' blood. A dressing stops it. A body that has lost two fifths of its blood dies of it (the
//     surgeons' fourth class of haemorrhage: past 40% it cannot be lived through untreated); past three in ten it cannot
//     stand. Its blood comes back slowly: about four in a thousand a day (est: what a donor gives, a tenth, is made again
//     in four to eight weeks).
//   Infection. A wound festers or it does not, a day or two after it was dealt; one that festers grows worse by a quarter
//     of itself and a little more each day, and the body fights it off by so much a day: the more by the care that is
//     brought to it (rules/wounds.ts woundCare: what its land knows of herbs and medicine, of clean water and of the small
//     causes of sickness), the less as its blood is short. Past the most a body bears it dies of it; brought to nothing,
//     it is clean.
//   The shares are the world's: of wounds left untended where nothing is known of care, as many bleed to death as die of
//     festering, and the two together are DIED_OF_WOUNDS's share; full care, brought to every one of them, saves as many
//     of the festering as WOUNDS.save says. Pure.

/** Blood, as the share of a body's own lost: past `fatal` it dies, past `faint` it cannot stand; `back` comes back a day. */
export const BLOOD = { fatal: 0.4, faint: 0.3, back: 0.004 } as const;
/** Of the deaths that follow a wound untended, the share that bleed (the rest fester; est). */
export const BLED_SHARE = 0.5;
/** How far a festering may grow before the body dies of it (its own measure: a festering begins at 1 … 8). */
export const FESTER_MOST = 63;
/** A festering's growth a day: a quarter of itself, and one more. */
const FESTER_GROWS = 0.25,
  FESTER_ADDS = 1;
/** What a body untended, its blood whole, fights off a day (of the same measure). */
const FIGHT = 2;
/** Where a festering begins (r 0 … 1): 1 at the least, FESTER_SPAN more at the most. */
const FESTER_SPAN = 7;

/** How hard a wound of a blow bleeds at first (the share of the body's blood it loses in its first ten minutes), by its own draw u (0 … 1). */
export function bleedOf(blow: Blow, u: number): number {
  // (Untended, a wound loses twice its first ten minutes': it bleeds to death where u⁴ passes fatal / (2 × top), as many as
  // BLED_SHARE of DIED_OF_WOUNDS.)
  const died = DIED_OF_WOUNDS[blow] * BLED_SHARE,
    top = BLOOD.fatal / (2 * (1 - died) ** 4);
  return top * Math.max(0, Math.min(1, u)) ** 4;
}
/** The share of wounds of a blow that fester: as many die of it untended as DIED_OF_WOUNDS's other half. */
export function festerChance(blow: Blow): number {
  return (DIED_OF_WOUNDS[blow] * (1 - BLED_SHARE)) / lethalShare(FIGHT);
}
/** Where a festering begins, by its own draw r (0 … 1). */
export const festerStart = (r: number): number => 1 + FESTER_SPAN * Math.max(0, Math.min(1, r));
/** Of festerings, the share a body fighting so much a day dies of (those that begin past where the fight holds them). */
function lethalShare(fight: number): number {
  const holds = (fight - FESTER_ADDS) / FESTER_GROWS;
  return Math.max(0, Math.min(1, 1 - (holds - 1) / FESTER_SPAN));
}
/**
 * What full care adds to a body's fight a day: so much that of the festerings that would kill it untended, as many live as
 * WOUNDS.save says.
 */
const FIGHT_CARE = (() => {
  const want = (1 - WOUNDS.save) * lethalShare(FIGHT);
  // (lethalShare is 1 - ((fight - adds) / grows - 1) / span: solved for the fight that leaves `want`.)
  return ((1 - want) * FESTER_SPAN + 1) * FESTER_GROWS + FESTER_ADDS - FIGHT;
})();
/** What a day's remedies in hand add to a body's fight, of the share of its land's care they bring (0 … 1). */
export const remedyFight = (remedies: number): number =>
  FIGHT_CARE * Math.max(0, Math.min(1, remedies));
/** What a body fights off of a festering a day: by the care brought to it (0 … 1), the less as its blood is short. */
export function fightOf(care: number, bloodLost: number): number {
  return (
    (FIGHT + FIGHT_CARE * Math.max(0, Math.min(1, care))) *
    (1 - Math.max(0, Math.min(1, bloodLost / BLOOD.fatal)) * 0.5)
  );
}
/** A festering a day on (0: clean): grown by itself, less what the body fights off. */
export function festerNext(load: number, fight: number): number {
  return Math.max(0, load + FESTER_ADDS + FESTER_GROWS * load - fight);
}
/**
 * How much a hurt body hurts, 0 … 1: a wound fresh and abed (its flesh open) more than one mending; a festering the more as
 * it grows; a wound not yet dressed the more; blood lost makes it no worse, but faint.
 */
export function painOf(abed: boolean, mending: boolean, dressed: boolean, fester: number): number {
  const wound = abed ? 0.55 : mending ? 0.2 : 0;
  if (!wound && !fester) return 0;
  return Math.min(1, wound + (abed && !dressed ? 0.15 : 0) + 0.4 * Math.min(1, fester / FESTER_MOST));
}
/**
 * The share of a land's care that is brought by remedies in hand (herb-lore's and medicine's, rules/wounds.ts
 * CARE_PRINCIPLES), and so wants a stock of them; the rest (clean water, the small causes of sickness) is in the hands that
 * dress a wound.
 */
export const REMEDY_PRINCIPLES: ReadonlySet<string> = new Set(["herbalism", "medicine"]);
