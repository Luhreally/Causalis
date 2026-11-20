// People out of their place by a war or a ruin, one rule (2026-11-19): those a host took and holds, those who fled what struck
// their land, and what was done to either against the custom of their time. A person out of place is somewhere, is someone's
// to feed, and is owed home: so each record says where they are, who holds or shelters them, where they are of, and what put
// them there. What becomes of the held is the holder's reckoning at the peace (man for man; a price; their work; or let go);
// what becomes of the fled is their own (they settle where they came to, a share a year). A wrong done to them has a doer.
// est: of a beaten host of the age of the pike a tenth or more was taken where quarter was the custom (Agincourt's prisoners
// outnumbered its captors' dead; Pavia 1525); a ransom ran from a season's to a few years' pay by rank; camps of the fled
// empty over a decade where they are let settle (UNHCR protracted-situation medians run longer where they are not).

export const HELD = {
  /** Of a beaten host's living, the share taken where it lost as many as it killed; more the worse it was beaten, to `most`. */
  caught: 0.03,
  caughtMost: 0.12,
  /** Fewer than this are not held apart (they are let go on the field, or go with the dead). */
  least: 20,
  /** Of those held, the share who die of their keeping in a year. */
  wasted: 0.04,
  /** What is asked for one of them: this many years of a grown person's bread. */
  price: 1.5,
  /** Of what its seat could spare, the most a realm gives to have its people back. */
  gives: 0.25,
  /** What two realms remember of it. */
  kept: -0.25,
  home: 0.1,
  /** No quarter: at this, the beaten are put to death (quarterScore); a town stormed after its camp's dying adds `storm`. */
  line: 0.44,
  storm: 0.12,
  /** Of a stormed land's people, the share put to the sword at the line, and the most. */
  sword: 0.02,
  swordMost: 0.06,
  /** What is remembered of it, and what a reckoning gives back. */
  wrong: -0.5,
  answered: 0.2,
  /** How long a wrong is kept by its war (years). */
  years: 120,
  /**
   * A wrong no peace answered may be answered at home (ownScore): from `own` its doer is tried by their own people and cast
   * down; from `ownDeath` they die for it. Below that, where the wronged keep the doer's people's own faith, that faith
   * names it a wrong (`censure`: what it takes from the doer's name, of the line). What each gives back between the realms.
   */
  own: 0.3,
  ownDeath: 0.5,
  cast: 1.5,
  censure: 0.5,
  answeredOwn: 0.15,
  answeredFaith: 0.05,
} as const;

/** What weighs on a people's answering, itself, for a wrong done in its name that no peace made it answer for (each 0 … 1). */
export type OwnRead = {
  /** How far its people have a say in its rule now; whether its law counts strangers its own. */
  readonly voice: number;
  readonly citizens: number;
  /** Whether the wronged keep its own faith. */
  readonly kin: number;
  /** Whether it is ruled now by another than ruled when it was done. */
  readonly later: number;
  /** How high the one who ordered it stands among them, apart from the infamy of it. */
  readonly standing: number;
  /** Whether the war it was done in was won (a people does not try those who won for it). */
  readonly won: number;
};

/** The parts of a people's answering for its own wrong, in the order told: name, value, what it adds. */
export function ownParts(r: OwnRead): { name: string; value: number; by: number }[] {
  return [
    {
      name: "a people with a say in what is done in their name",
      value: r.voice,
      by: 0.45 * r.voice,
    },
    { name: "a law that counts strangers its own", value: r.citizens, by: 0.2 * r.citizens },
    { name: "the wronged keep its own faith", value: r.kin, by: 0.15 * r.kin },
    { name: "a ruler who did not order it", value: r.later, by: 0.2 * r.later },
    { name: "the one who ordered it stands high", value: r.standing, by: -0.25 * r.standing },
    { name: "the war was won", value: r.won, by: -0.15 * r.won },
  ];
}

export function ownScore(r: OwnRead): number {
  return ownParts(r).reduce((s, p) => s + p.by, 0);
}

/** How a people answers for its own wrong: its doer dies for it, is cast down, is named by its faith, or nothing (null). */
export function ownReckoning(r: OwnRead): "own" | "cast" | "censured" | null {
  const s = ownScore(r);
  return s >= HELD.ownDeath ? "own" : s >= HELD.own ? "cast" : r.kin > 0 ? "censured" : null;
}

export const FLED = {
  /** Of those who fled to a land, the share who settle into it in a year (twice that among their own tongue). */
  settle: 0.15,
  /** Fewer than this in a land from another are no longer told apart. */
  least: 30,
  /** A camp stands by a town from this many, and is told from this many come over a border. */
  camp: 150,
  told: 2000,
  /** What strangers sheltered weigh on those who shelter them: their share of the land's people, at the most this. */
  strain: 0.5,
  strainMost: 0.04,
} as const;

/** What put the fled on the road. */
export const FLED_KINDS = ["war", "ruin", "hunger"] as const;
export type FledKind = (typeof FLED_KINDS)[number];

/**
 * Of a beaten host, how many are taken: of its living, HELD.caught where it lost as many as it killed, by how many times as
 * many it lost (a rout is where prisoners are made), never more than HELD.caughtMost of them. None under HELD.least.
 */
export function caughtOf(living: number, lostBeaten: number, lostVictor: number): number {
  if (!(living > 0)) return 0;
  const rout = Math.min(4, Math.max(0.25, lostBeaten / Math.max(1, lostVictor))),
    n = Math.floor(living * Math.min(HELD.caughtMost, HELD.caught * rout));
  return n >= HELD.least ? n : 0;
}

/** What weighs on whether a host gives quarter (each 0 … 1). */
export type QuarterRead = {
  /** How strange the beaten are to it: their tongue, and whether they keep another faith. */
  readonly strange: number;
  readonly unbelief: number;
  /** How closed its people are to strangers; how far they prize valour. */
  readonly closed: number;
  readonly valour: number;
  /** Whether its host is hungry (it cannot feed those it takes). */
  readonly hungry: number;
  /** A wrong of theirs it remembers, unanswered. */
  readonly grudge: number;
  /** How far its people have a say in its rule, and whether its law counts strangers its own. */
  readonly voice: number;
  readonly citizens: number;
};

/** The parts of a host's refusing quarter, in the order told: name, value, what it adds. */
export function quarterParts(r: QuarterRead): { name: string; value: number; by: number }[] {
  return [
    { name: "the beaten speak another tongue", value: r.strange, by: 0.2 * r.strange },
    { name: "the beaten keep another faith", value: r.unbelief, by: 0.15 * r.unbelief },
    { name: "closed to strangers", value: r.closed, by: 0.2 * r.closed },
    { name: "a people given to war", value: r.valour, by: 0.1 * r.valour },
    { name: "a hungry host that cannot feed them", value: r.hungry, by: 0.2 * r.hungry },
    { name: "a wrong of theirs unanswered", value: r.grudge, by: 0.15 * r.grudge },
    {
      name: "a people with a say in what is done in their name",
      value: r.voice,
      by: -0.2 * r.voice,
    },
    { name: "a law that counts strangers its own", value: r.citizens, by: -0.25 * r.citizens },
  ];
}

export function quarterScore(r: QuarterRead): number {
  return quarterParts(r).reduce((s, p) => s + p.by, 0);
}

/**
 * The held at a peace, one side's `mine` (held by it) against the other's `theirs`: those changed man for man; then of what
 * the one who still holds any keeps, those given up without a price (it lost the war), those bought back (`afford`: how many
 * their realm can pay for), and the rest bound to its work (`binds`) or let go.
 */
export function settleHeld(i: {
  readonly held: readonly [number, number];
  /** Who had the better of the war: 0, 1, or null (neither). */
  readonly victor: 0 | 1 | null;
  /** Whether each side's people bind those they take; how many each could buy back. */
  readonly binds: readonly [boolean, boolean];
  readonly afford: readonly [number, number];
}): {
  exchanged: number;
  /** By holder: given up, bought back, bound, let go. */
  given: [number, number];
  bought: [number, number];
  bound: [number, number];
  freed: [number, number];
} {
  const exchanged = Math.min(i.held[0], i.held[1]),
    out = {
      exchanged,
      given: [0, 0] as [number, number],
      bought: [0, 0] as [number, number],
      bound: [0, 0] as [number, number],
      freed: [0, 0] as [number, number],
    };
  for (const s of [0, 1] as const) {
    const left = i.held[s] - exchanged;
    if (left <= 0) continue;
    // (The beaten give up what they hold: it is a term of the peace.)
    if (i.victor !== null && i.victor !== s) {
      out.given[s] = left;
      continue;
    }
    // (Whose people they are buys back as many as it can: afford[1 - s].)
    const bought = Math.min(left, Math.max(0, Math.floor(i.afford[1 - s]!)));
    out.bought[s] = bought;
    if (i.binds[s]) out.bound[s] = left - bought;
    else out.freed[s] = left - bought;
  }
  return out;
}
