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
  /**
   * What a share of what it makes, turned to arms for a war, weighs in that war's reckoning against a like share of its people
   * fallen or kept from their work: goods come of what is made beyond bread, and are made again next year (est: a fourth).
   */
  dear: 0.25,
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

/**
 * Who a realm can send to war (its levy's share of its fighting men), from what its people are and what is asked of them. A man
 * under arms is not at his work, so a realm can send no more than what its people make beyond their food can feed. Of those,
 * it sends as many as will go: more where its people prize valour, the more as they hold its rule rightful (or, where the
 * army rules, as far as it compels them), more where they bear arms of their own, and more as a war puts much of what they
 * have at stake, the more as they have a say. A standing army keeps more of them drilled. Its footing then fields more on
 * top, and a peace may have it stand down part of its host.
 */
export const MOBILISE = {
  /**
   * The share of its fighting men it can feed under arms is what it has to spare, and the slack of a year a campaign between
   * sowing and harvest takes from no one's food, within these.
   */
  slack: 0.1,
  spareLeast: 0.05,
  spareMost: 0.6,
  /** Of those it can feed, the share who go at middling valour, standing and arms, no war pressing. */
  base: 0.3,
  /** How much its people's own arms add (at the most where the realm holds none of them), and what a full stake adds at a full say. */
  ownArms: 0.5,
  stake: 0.4,
  /** How much a standing army, as its arms are learned, keeps more drilled. */
  drilled: 0.3,
  /**
   * Of its fighting men, the most a realm keeps under arms at peace (est: a man in twelve of them, some two in a hundred of its
   * people: the great standing armies of the eighteenth and nineteenth centuries kept one to two, Prussia's near four).
   */
  standingMost: 0.08,
} as const;

/** A realm's levy's share of its fighting men (MOBILISE). */
export function levyShare(e: {
  /** Of what its people make, the share beyond their food. */
  readonly spare: number;
  /** Its people's valour, how far they hold its rule rightful, their say, and how far its holders keep the arms (0 … 1). */
  readonly valour: number;
  readonly standing: number;
  readonly voice: number;
  readonly force: number;
  /** Whether the army holds its rule: it compels, as far as it keeps the arms. */
  readonly army: boolean;
  /** The most of what it has a war of its stands to take (0 at peace). */
  readonly stake: number;
  /** Its standing army's arms (the `arms` effect where it keeps one, else 0). */
  readonly drilled: number;
  readonly footing: number;
  /** Of its host, the share a peace has it stand down. */
  readonly disarm: number;
}): number {
  const feed = dmath.clamp(MOBILISE.slack + e.spare, MOBILISE.spareLeast, MOBILISE.spareMost),
    held = e.army ? Math.max(e.standing, e.force) : e.standing,
    will =
      MOBILISE.base *
        (0.5 + dmath.clamp(e.valour, 0, 1)) *
        (0.5 + dmath.clamp(held, 0, 1)) *
        (1 + MOBILISE.ownArms * (1 - dmath.clamp(e.force, 0, 1))) +
      MOBILISE.stake * dmath.clamp(e.stake, 0, 1) * (0.5 + dmath.clamp(e.voice, 0, 1)),
    drilled = 1 + MOBILISE.drilled * Math.max(0, e.drilled);
  // (Of those it can feed, as many as will go, drill bringing more of them: never more than it can feed. Drill multiplied past
  // that, a realm that had learned much of arms fielded every fighting man it had, a quarter of all its people, at peace too.)
  return (
    (feed * dmath.clamp(will * drilled, 0, 1) + footingTerms(e.footing, 0).fields) *
    (1 - dmath.clamp(e.disarm, 0, 1))
  );
}
