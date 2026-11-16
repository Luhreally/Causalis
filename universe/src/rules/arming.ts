// What a realm turns to arms (the last sweep, war): its footing, a share of what it makes. At peace it goes as Richardson's arms
// race (Arms and Insecurity, 1960). A realm arms as far as the rival it fears most is stronger than it would be unarmed (so the
// rival's arming is answered, and its own buys it no ease: the security dilemma), and as far as the old
// grudge runs. It is held back by what arming costs a people that has little to spare beyond its food, and the more where
// the people have a say. The rival reads the realm's host in turn, and answers. At war the footing rises with what the realm
// stands to lose and how badly the war goes for it: a people fighting for its seat turns much of what it makes to the war.
// What is turned to arms fields more of its men, arms them better, is paid from its treasury, and is a cost of the war that
// the war's reckoning reads. A realm that fears one side of a war and is not the other's rival sends the other a share of
// its own arming: that side is the stronger for it, the foe remembers who did it, and the one helped remembers too.
// Pure; sim/war/arming.ts keeps one row a realm.
import { dmath } from "../kernel/index.ts";

export const ARMING = {
  /** Footing, at full fear of a rival as strong as itself, of a people bearing it at the least cost (Richardson's defence coefficient). */
  answer: 0.04,
  /** Footing an old grudge adds at its bitterest (Richardson's grievance). */
  grudge: 0.01,
  /** A rival's strength over its own is read up to this many times. */
  ratioMost: 3,
  /** What arming costs a people with all it makes to spare (Richardson's fatigue), and how much more a people with a full say feels it. */
  fatigue: 1,
  say: 1,
  /** The least of what it makes a people is taken to have to spare, beyond its food. */
  spareLeast: 0.1,
  /** At war: the footing a realm with all it has at stake turns to arms, when the war is even. */
  war: 0.25,
  /** The most a realm can turn to arms. */
  most: 0.5,
  /** Each year, the share of the way to what it would have that footing moves: a treasury changes over years. */
  pace: 1 / 3,
  /**
   * What a whole footing adds to the share of its men a realm fields, and to what its host's arms are worth. What it keeps at
   * peace is a few hundredths of what it makes (sim/money TREASURY), so a footing of a twentieth makes its kit a fifth better
   * and fields a fortieth more of its men.
   */
  fields: 0.5,
  power: 4,
  /** A realm sends arms to one side of a war when its fear of the other is at least this. Of its own footing it sends this share. */
  backLeast: 0.3,
  backShare: 0.3,
  /** Footing sent is the least of this share of what the realm makes, at the least. */
  backFloor: 0.005,
  /** Of what the helped side makes, the most a gift can be worth to it. */
  giftMost: 0.3,
  /** Two realms each arming at least this much against the other are in an arms race (told). */
  race: 0.03,
} as const;

/** How much a realm has to fear from another: the fear it keeps of it, or how far their regard is below rivalry, the greater. */
export function rivalLevel(opinion: number, rivalry: number, fear: number): number {
  const bitter = dmath.clamp((rivalry - opinion) / Math.max(1e-6, 1 + rivalry), 0, 1);
  return Math.max(dmath.clamp(fear, 0, 1), bitter);
}

/** What arming costs a people, as Richardson's fatigue: more with little to spare beyond its food, more where its people have a say. */
export function fatigueOf(spare: number, voice: number): number {
  return (
    (ARMING.fatigue * (1 + ARMING.say * dmath.clamp(voice, 0, 1))) /
    Math.max(ARMING.spareLeast, Math.min(1, spare))
  );
}

/**
 * The footing a realm at peace would have: its answer to the rival it fears most (that rival's strength over its own, by its
 * fear of it), with its grudge, over what arming costs it.
 */
export function peaceFooting(e: {
  readonly threat: number;
  readonly ratio: number;
  readonly fatigue: number;
}): number {
  const t = dmath.clamp(e.threat, 0, 1),
    r = dmath.clamp(e.ratio, 0, ARMING.ratioMost);
  return dmath.clamp(
    (ARMING.answer * t * r + ARMING.grudge * t) / Math.max(1e-6, e.fatigue),
    0,
    ARMING.most,
  );
}

/**
 * The footing a realm at war would have: what it has at stake, the more as its chance is poor. A people bears a war's arming
 * better than peace's (the square root of the fatigue).
 */
export function warFooting(stake: number, chance: number, fatigue: number): number {
  return dmath.clamp(
    (ARMING.war * dmath.clamp(stake, 0, 1) * (2 - 2 * dmath.clamp(chance, 0, 1))) /
      Math.sqrt(Math.max(1e-6, fatigue)),
    0,
    ARMING.most,
  );
}

/** A year's footing: a share of the way from what it is to what it would be. */
export function footingYear(now: number, wanted: number): number {
  return dmath.clamp(now + ARMING.pace * (wanted - now), 0, ARMING.most);
}

/** What a realm sends one side of a war, as a share of what it makes: of its own footing, as far as it fears the other side. */
export function backingOf(footing: number, fear: number): number {
  return fear >= ARMING.backLeast
    ? ARMING.backShare * Math.max(ARMING.backFloor, footing) * dmath.clamp(fear, 0, 1)
    : 0;
}

/** What a footing (its own, and what is sent it) adds to the share a realm fields, and multiplies its arms' worth by. */
export function footingTerms(footing: number, gift: number): { fields: number; power: number } {
  const x = dmath.clamp(footing, 0, ARMING.most),
    g = dmath.clamp(gift, 0, ARMING.giftMost);
  return { fields: ARMING.fields * x, power: 1 + ARMING.power * (x + g) };
}
