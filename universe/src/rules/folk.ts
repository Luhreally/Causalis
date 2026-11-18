// Who a people count as their own, and how far that "us" reaches (the culture sweep, 2026-11-16; audit "Identity, ethnicity" and
// "Nationalism", where one number stood in for both: how unlike their seat's a land's speech was, squared, in a band's age and a
// reading one alike). Two readings a land, each a number:
//   kin to its seat: how much a land shares with those who rule it: their speech (whom they can talk with), their faith, their
//     ways, and a lot shared under one rule (a land held for generations has fought the same wars and paid the same tithe). A
//     land that shares all of it counts its seat's people its own; one that shares none counts them strangers.
//   how far its "us" reaches: before anyone reads, a people's own are those they meet, their valley and their kin's; a ruler of
//     other speech three valleys off is far, and so are those of their own speech beyond the hills. Those who read come to
//     imagine as one all who read as they do, people they will never meet (as print made nations of Earth's peoples); the
//     faster word joins a realm's far lands, the wider; a war against those of other speech draws the line sharper while it lasts.
// Then: a land ruled by those it counts strangers chafes, the more the wider its "us" reaches (a nation under another's rule is
// aggrieved where a valley under a far lord is not); and a realm whose people count themselves one with its seat is held the more
// rightful, as far as they imagine themselves one. A land's identity moves slowly: a share of the way a year.
// Pure tables and functions; nothing here names a people or a world.
import { dmath } from "../kernel/index.ts";

export const FOLK = {
  /** How a land weighs what it shares with its seat's people: speech, faith, ways, a lot shared under one rule. Summing to one. */
  tongue: 0.55,
  faith: 0.2,
  ways: 0.15,
  years: 0.1,
  /** Ways this far apart (the mean gap over the eight, 0 … 1) are as strange as ways can be. */
  waysApart: 0.35,
  /** Generations of a people's own life held under one rule that make a lot shared half of what it will be. */
  shared: 2,
  /** How far a people's "us" reaches before anyone reads (a band's, a chief's: those they meet). */
  least: 0.1,
  /** Of the rest of the way, the share that readers make (by the root of their share) and that word joining far lands makes. */
  read: 0.7,
  joined: 0.3,
  /**
   * Added while their realm is at war with a realm of other speech, and after its peace as far as those who lived through it are
   * still among them (warRemembered): an "us" made against strangers in arms is not unmade by the peace, it goes with the
   * generation that fought.
   */
  war: 0.15,
  /** The share of a life after which none who were grown at a war's end are left (a people of 70 years: 40). */
  warLives: 4 / 7,
  /**
   * Grievance a year from being ruled by those a land counts strangers (at kin 0), at an "us" no wider than a valley's and at its
   * widest: between, by how far it reaches. It falls as the square of kin's shortfall from the middle, and is none above it.
   */
  apartNarrow: 0.4,
  apartWide: 1.6,
  /** A land's identity comes this share of the way to what it is now, a year. */
  pace: 0.08,
  /** A realm's standing from its people counting themselves one with its seat, at their "us" widest (kin 1 against kin 0.6). */
  oneness: 0.1,
  /** The kin at which a people counts its seat's neither its own nor strangers. */
  middle: 0.6,
} as const;

/** What a land shares with its seat's people. */
export type FolkTies = {
  /** How alike their speech is (0 … 1, gen/words.ts tongueLikeness). */
  readonly like: number;
  /** Whether they hold the same faith (both of the old beliefs: the same). */
  readonly sameFaith: boolean;
  /** The mean gap over the eight ways (0 … 1). */
  readonly waysGap: number;
  /** Years the land has been held by this rule. */
  readonly years: number;
  /** A life of their people, years (a generation is a third of it, an upright ape's 25 of 70). */
  readonly span: number;
};

/** How far a lot shared under one rule for `years` binds a land to its seat (0 … 1). */
export function sharedLot(years: number, span: number): number {
  const generation = (25 * Math.max(5, span)) / 70;
  return 1 - dmath.pow(0.5, Math.max(0, years) / (FOLK.shared * generation));
}

/** How much a land counts its seat's people its own (0 … 1). */
export function kinToSeat(t: FolkTies): number {
  const ways = 1 - dmath.clamp(t.waysGap / FOLK.waysApart, 0, 1);
  return dmath.clamp(
    FOLK.tongue * dmath.clamp(t.like, 0, 1) +
      FOLK.faith * (t.sameFaith ? 1 : 0) +
      FOLK.ways * ways +
      FOLK.years * sharedLot(t.years, t.span),
    0,
    1,
  );
}

/**
 * How far a land's "us" reaches (0 … 1): a valley's before letters, wider by the root of the share who read and by how far its
 * realm's word joins its lands (`joined`, 0 … 1 of the most it can), sharper at war with strangers and while that war is
 * remembered (`war`: 0 … 1, warRemembered; true for 1).
 */
export function nationTarget(readers: number, joined: number, war: boolean | number): number {
  const r = dmath.sqrt(dmath.clamp(readers, 0, 1)),
    j = dmath.clamp(joined, 0, 1);
  return dmath.clamp(
    FOLK.least +
      (1 - FOLK.least) * (FOLK.read * r + FOLK.joined * j) +
      FOLK.war * dmath.clamp(Number(war), 0, 1),
    0,
    1,
  );
}

/**
 * How far a war with strangers still sharpens a people's "us" (0 … 1): wholly while it is fought (`over` null), then as far as
 * those who lived through it are left, `over` years after its peace: none past `kept` years, however long they live (what is
 * read of a war so long over is no longer asked of the wars' store).
 */
export function warRemembered(over: number | null, span: number, kept: number): number {
  if (over === null) return 1;
  const lives = Math.min(kept, FOLK.warLives * Math.max(5, span));
  return dmath.clamp(1 - Math.max(0, over) / lives, 0, 1);
}

/** A land's identity `years` on, from where it was toward where it is drawn. */
export function folkAfter(was: number, target: number, years: number): number {
  return was + (target - was) * (1 - dmath.pow(1 - FOLK.pace, Math.max(0, years)));
}

/**
 * What being ruled by those it counts strangers breeds of grievance in a land a year: as far as its kin to the seat's people falls
 * short of the middle (FOLK.middle), where it counts them neither its own nor strangers. A land nearer its seat than that is no
 * stranger's subject: its oneness is the realm's standing (onenessStanding), not a grievance as well.
 */
export function apartGrievance(kin: number, nation: number): number {
  const apart = Math.max(0, FOLK.middle - dmath.clamp(kin, 0, 1)) / FOLK.middle,
    n = dmath.clamp(nation, 0, 1);
  return apart * apart * (FOLK.apartNarrow + (FOLK.apartWide - FOLK.apartNarrow) * n);
}

/** A realm's standing from how far its people count themselves one with its seat (people-weighted means of kin and reach). */
export function onenessStanding(kin: number, nation: number): number {
  return (
    (FOLK.oneness * dmath.clamp(nation, 0, 1) * dmath.clamp(kin - FOLK.middle, -1, 1)) /
    (1 - FOLK.middle)
  );
}

/** How far a people's "us" reaches, in words. */
export function nationWords(nation: number): string {
  return nation < 0.2
    ? "those they meet: their valley and their kin"
    : nation < 0.45
      ? "their kin's lands and their lord's"
      : nation < 0.7
        ? "many lands of their speech, as they hear of them"
        : "all who speak and read as they do, met or not";
}

/** How much a land counts its seat's people its own, in words. */
export function kinWords(kin: number): string {
  return kin >= 0.85
    ? "their own"
    : kin >= 0.7
      ? "near kin"
      : kin >= FOLK.middle
        ? "neither their own nor strangers"
        : kin >= 0.4
          ? "others"
          : "strangers";
}
