// Those a court sentences, and those it holds (asked 2026-11-22: a court sentenced only those the world keeps by name, and a prison's
// count was a share of a number). A court's lands do wrongs as their people live: small wrongs by how many they are, more where
// they go hungry and where their grievance runs high, and more brought under a seat that holds by arms; the killings done there
// (the underworld's, as sim/order/underworld.ts reckons them); and the young of its gangs its watch takes (that system's jailed).
// Of the wrongs done, those brought are as many as the court reaches, is not bought, and the watch is honest (the court's and the
// watch's rows: sim/order/institutions.ts). What comes of each is by how grave it is and by the realm's own law (rules/deeds.ts
// sentenceOf's weighing, for townsfolk): a fine for most small wrongs and for those who can pay; death by how grave and how harsh
// the seat; labour where the seat rules by decree; else held. A realm of custom and vengeance keeps no prison: what would be held
// pays or works for the wronged; one law for all finds some not guilty and puts fewer to death; a people whose bodies live as one
// put no one to death and hold no one apart, but set them to the common work. Those held leave as their terms run out (a mean,
// by how grave their wrongs were). Pure tables and functions. Pages say what, who, cost and effect: never how.
import { dmath } from "../kernel/index.ts";

export const SENTENCE = {
  /** Of a land's people, those brought before a full court a year for small wrongs, at the mildest and fed. */
  petty: 0.0015,
  /** How many more where its people go hungry: at its leanest month short by half, this many times more. */
  want: 2,
  /** How many more where its grievance is at the full (a land's discontent of 1). */
  grief: 1,
  /** For each one killed in a land, so many brought. */
  perKilling: 0.6,
  /** How grave each is (0 … 1): a small wrong, a gang's young, a killing. */
  pettyGrave: 0.15,
  gangGrave: 0.45,
  killGrave: 0.85,
  /** The years one is held, on the mean: for a small wrong, for a grave one (a gang's young between). */
  pettyTerm: 1,
  graveTerm: 6,
  /**
   * Of those brought, the share found not guilty: by any court, so many (some did no wrong, or it is not shown); under one law
   * for all, half as many again; and how much of death is left there.
   */
  acquits: 0.15,
  acquitsLaw: 1.5,
  lessDeath: 0.4,
  /** Under custom and vengeance, how much more often blood is asked. */
  vengeance: 1.3,
  /** The grief of a land a year, for each of its people put to death and each put to labour (of its people), and at the most. */
  griefDeath: 40,
  griefLabour: 2,
  griefMost: 0.03,
  /**
   * A realm's courts reckon their lands once in so many years, for each of those years (what a court does changes slowly, and its
   * many are counted, not followed). Then how many years of a land's dead are kept for its people (host/roster.ts reads who).
   */
  every: 5,
  deadKept: 46,
} as const;

/** What comes of those brought, as shares (fined, death, labour, held, not guilty): rules/deeds.ts sentenceOf, for townsfolk. */
export function sentenceMix(f: {
  /** How grave the wrongs (0 … 1). */
  readonly grave: number;
  /** How harsh its realm's justice (rules/deeds.ts harshOf). */
  readonly harsh: number;
  /** How far its judges are bought (0 … 1). */
  readonly bought: number;
  /** Its seat rules by decree (and puts the held to labour). */
  readonly decree: boolean;
  /** Its realm's justice (sim/order/laws.ts): 0 custom and vengeance, 1 the ruler's courts, 2 one law for all. */
  readonly justice: number;
  /** A people whose bodies live as one. */
  readonly hive: boolean;
}): [fined: number, death: number, labour: number, held: number, acquitted: number] {
  const g = dmath.clamp(f.grave, 0, 1),
    h = dmath.clamp(f.harsh, 0, 1),
    // (A bought court finds fewer not guilty of those who cannot pay; a hive tries no one apart.)
    acquitted = f.hive
      ? 0
      : SENTENCE.acquits *
        (f.justice === 2 ? SENTENCE.acquitsLaw : 1) *
        (1 - 0.5 * dmath.clamp(f.bought, 0, 1)),
    rest = 1 - acquitted,
    fined = (0.7 * (1 - g) + 0.2 * dmath.clamp(f.bought, 0, 1)) * (1 - 0.5 * g),
    death0 =
      (1 - fined) *
      // (Death by how grave, twice over: a small wrong is seldom a hanging one, a killing often.)
      g *
      g *
      (0.1 + 0.6 * h) *
      (f.justice === 2 ? SENTENCE.lessDeath : f.justice === 0 ? SENTENCE.vengeance : 1),
    death = Math.min(1 - fined, death0),
    labour0 = (1 - fined - death) * (f.decree ? 0.5 : 0.1),
    held0 = Math.max(0, 1 - fined - death - labour0);
  let mix: [number, number, number, number];
  // (Custom keeps no prison: what would be held pays the wronged, or works for them.)
  if (f.justice === 0) mix = [fined + 0.6 * held0, death, labour0 + 0.4 * held0, 0];
  else mix = [fined, death, labour0, held0];
  // (A hive puts no one to death and holds no one apart: those it would are set to the common work.)
  if (f.hive) mix = [mix[0], 0, mix[1] + mix[2] + mix[3], 0];
  return [mix[0] * rest, mix[1] * rest, mix[2] * rest, mix[3] * rest, acquitted];
}

/** Those brought for small wrongs a year, of a land's people: by how hungry, how aggrieved, how harsh, and how far the court reaches. */
export function pettyBrought(
  people: number,
  leanest: number,
  grief: number,
  harsh: number,
  reach: number,
): number {
  const short = dmath.clamp(1 - leanest / 1000, 0, 0.5) * 2;
  return (
    Math.max(0, people) *
    SENTENCE.petty *
    (1 + SENTENCE.want * short) *
    (1 + SENTENCE.grief * dmath.clamp(grief, 0, 1)) *
    (0.6 + 0.8 * dmath.clamp(harsh, 0, 1)) *
    dmath.clamp(reach, 0, 1)
  );
}
