// What a tie between two realms' rulers makes of them, by how their people make kin (the culture sweep, 2026-11-16; audit
// "Non-human kin (hive, brood, graft)", where a hive's gift of brood, a reef grafted and young fostered were a marriage in other
// words). A people's body says how it makes kin, and so what a tie between two of its houses is:
//   wed: a pair bond's child is half of each house: the two are kin by half, and a claim passes by the child, as long as one of
//     the marriage or its child lives (a life of their kind; an upright ape's 60 years);
//   foster: young raised among another people are of neither's blood: they count both as theirs, their kin do not; a quarter;
//   brood: a hive is one mother's young. Brood given are of the giver's line, raised in the other hive and taking its scent: kin
//     to both by as much as a hive's members are to one another (a half among those who live loosely together, three quarters in
//     a hive that lives wholly as one). A hive's rule passes by its mother's line, not by a marriage: when its line fails, a mother
//     raised from the brood it was given takes the seat, if that brood has grown, and no hive marches for one; and the line given
//     lasts as long as a line of theirs does, not a life: a line fails when a generation leaves no heir (rules/houses.ts heirs);
//   graft: a reef grafted onto another grows as one body: half of each is the other's. Two reefs so joined fuse when one's seat
//     stands empty, as far as they think well of each other; its line lasts as the reef does, as a hive's line.
// The kin a tie makes is what it asks when it is called on (a call to kin comes as far as they are kin), and what it is remembered
// at. Where no court names anyone, a ruler's death leaves no one as often as a line of theirs leaves no heir: the chance a
// generation's heirs are none (Poisson, rules/houses.ts heirsChance), an upright ape's some one in eight.
// Pure tables and functions.
import { dmath } from "../kernel/index.ts";
import type { TieForm } from "./ties.ts";

export const KIN_FORMS = {
  /** The kin a tie makes of two houses, by its form (brood: from `broodLeast` to `broodMost` by how wholly the hive lives as one). */
  wed: 0.5,
  foster: 0.25,
  graft: 0.5,
  broodLeast: 0.5,
  broodMost: 0.75,
  /** How closely a hive lives together, from which its brood are the more one another's kin (rules/holds.ts hiveOf). */
  hiveFrom: 0.9,
  /** A tie is remembered at a people-with-no-houses' tie (rules/ties.ts tieOther) and this much for each of kin. */
  regardBy: 0.2,
  /** The kin a marriage makes, against which a call to kin asks what it always did (rules/ties.ts comes.kin). */
  callAt: 0.5,
  /** Years a marriage's claim stands for an upright ape (rules/ties.ts claimYears), and its life span; a line at most so many times it. */
  claimYears: 60,
  apeSpan: 70,
  lineMost: 4,
} as const;

/** Whether a tie passes by a line (a hive's mother's, a reef's) rather than a life. */
export const byLine = (form: TieForm): boolean => form === "brood" || form === "graft";

/** The kin a tie makes of two houses (0 … 1), by its form and how closely its people live together. */
export function tieKin(form: TieForm, social: number): number {
  if (form !== "brood") return KIN_FORMS[form];
  const hive = dmath.clamp((social - KIN_FORMS.hiveFrom) / (1 - KIN_FORMS.hiveFrom), 0, 1);
  return KIN_FORMS.broodLeast + (KIN_FORMS.broodMost - KIN_FORMS.broodLeast) * hive;
}

/** What a tie is remembered at, given what a people with no houses remembers theirs at. */
export function tieRegard(form: TieForm, social: number, tieOther: number): number {
  return tieOther + KIN_FORMS.regardBy * tieKin(form, social);
}

/** A call to kin's base chance, given what it was for a marriage: as far as the tie makes them kin. */
export function kinCall(form: TieForm, social: number, comesKin: number): number {
  return (comesKin * tieKin(form, social)) / KIN_FORMS.callAt;
}

/** The chance a generation of theirs leaves a line no heir (`heirs`: heirs expected, rules/houses.ts heirsExpected). */
export function heirlessChance(heirs: number): number {
  return dmath.exp(-Math.max(0, heirs));
}

/**
 * How long a tie's claim stands, years: a marriage's or a fostering's for a life of their kind; a line's (brood, graft) until a
 * generation leaves it no heir, on the mean (a generation over the chance of that), at most `lineMost` lives.
 */
export function claimYearsOf(
  form: TieForm,
  span: number,
  generation: number,
  heirs: number,
): number {
  const life = (KIN_FORMS.claimYears * Math.max(5, span)) / KIN_FORMS.apeSpan;
  if (!byLine(form)) return life;
  const fails = Math.max(1e-6, heirlessChance(heirs));
  return Math.min(KIN_FORMS.lineMost * life, Math.max(life, Math.max(1, generation) / fails));
}
