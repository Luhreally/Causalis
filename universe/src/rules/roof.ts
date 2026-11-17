// Without a roof (the society sweep, asked 2026-11-16 by name: "homelessness, derived"). A rule says what a thing does; a town's own
// numbers say how much:
//   The cheapest roof (roofCost): what a household pays a year for the least home its town has: the work of raising it carried at a
//     lender's rate over the years it stands, dearer as more come to the town than its homes hold (they bid for the least of them),
//     and a share of what the town's ground earns its holders a household (trade's town rent, where it is kept: its edge asks little
//     of what its heart asks).
//   Who cannot meet it (shutOut): of a town's households, those whose earnings, after the food they must have, fall short of it, read
//     off its five fifths (Round B's shares), each fifth's earnings spread about its mean. The poor eat first: a household gives what
//     it must to food and keeps at least a tenth of what it earns for all else.
//   Who else has none: those come to the town beyond the homes it has built (its draw outrunning its building); those turned out by
//     war, fire, quake and flood, housed again as the town rebuilds; some of those who need what they take; some of the frail no one
//     keeps (rooflessAll: each a chance, together).
//   Who takes them in (takenIn): their kin first, as far as their kind keeps its kin (newcomers have fewer kin in the town); then the
//     temple's alms; then the realm's provision, where it pays for those its healers and kin do not reach. The rest are on the street.
//   What it does: the street's cold kills as the cold asks of an unclothed body (rules/dress.ts warmth needed), its crowding and
//     hunger breed sickness (and those taken in are crowded too); the poorest want leads to theft; a town's street people breed
//     grievance against the realm that leaves them there.
// Pure functions.
import { dmath } from "../kernel/index.ts";

const clamp01 = (x: number): number => dmath.clamp(x, 0, 1);

export const ROOF = {
  /** The worker-years it takes to raise a household's least roof, the years it stands, a lender's rate a year (est; trade's HEART.carry). */
  build: 1,
  lasts: 30,
  carry: 0.07,
  /** Of a town's ground rent a household, the share its least lot asks. */
  edge: 0.2,
  /** How far the least rent rises for each one beyond the homes built, against those housed. */
  bid: 1.5,
  /** How widely a fifth's earnings spread about its mean (a share of it either way). */
  spread: 0.3,
  /** The least share of its earnings a household keeps from food for all else. */
  kept: 0.1,
  /** Of those who need what they take, the share who lose their roof; of the frail no one keeps in a town, the share with none. */
  addicted: 0.15,
  old: 0.3,
  /** Of those turned out, the share housed again in a year as the town rebuilds. */
  rebuilt: 0.35,
  /** Of a town's homes, the share each kind of blow takes (est: a battle in its streets, a sack, a quake, a fire, a stone, a wildfire, a flood). */
  struck: {
    "war.battle": 0.03,
    "war.strike": 0.08,
    "act.quake": 0.1,
    "act.fire": 0.06,
    "act.meteor": 0.1,
    "wild.fire": 0.03,
    "act.flood": 0.06,
  } as Readonly<Record<string, number>>,
  /** How much less kin take in those newly come to a town. */
  newcomers: 0.5,
  /** A town new within this many years has its settlers raise their own roofs as it rises. */
  settling: 10,
  /** How much more often the street's people die in the cold, at the full warmth a body needs of clothes. */
  cold: 1,
  /** How much more the roofless die of a sickness (as the bound: crowded, ill-fed, untended), and those taken in, crowded, this share of it. */
  sick: 0.5,
  doubled: 0.3,
  /** The grievance a year a land breeds, at all its people on the street. */
  grievance: 1,
  /** How much more a town's year is due in cases, at all its people on the street. */
  crime: 2,
} as const;

/** A household's least roof a year (grain's worth): raised and carried, bid up by those beyond the homes built, and its ground. */
export function roofCost(earns: number, groundRent: number, beyond: number): number {
  const carried = ROOF.build * Math.max(0, earns) * (ROOF.carry + 1 / ROOF.lasts);
  return carried * (1 + ROOF.bid * Math.max(0, beyond)) + ROOF.edge * Math.max(0, groundRent);
}

/**
 * Of a town's households, the share whose earnings after food fall short of the least roof: each fifth (its share of all earnings,
 * five of them summing to one) earning `household` × 5 × its share on the mean, spread ROOF.spread either way.
 */
export function shutOut(
  fifths: readonly number[],
  household: number,
  food: number,
  roof: number,
): number {
  let out = 0;
  for (const f of fifths) {
    // (Never under the food it eats: who earns nothing eats what kin, holders or alms give it, as the population feeds every one.)
    const earned = Math.max(Math.max(0, food), Math.max(0, household) * 5 * Math.max(0, f)),
      lo = earned * (1 - ROOF.spread),
      hi = earned * (1 + ROOF.spread),
      // (What is left of an earning e after food: e - food, never under a tenth of e.)
      left = (e: number) => Math.max(ROOF.kept * e, e - food);
    const a = left(lo),
      b = left(hi);
    out += 0.2 * (b <= a ? (roof > a ? 1 : 0) : clamp01((roof - a) / (b - a)));
  }
  return clamp01(out);
}

/** All who have no roof of their own, of several chances each (shares of the town). */
export function rooflessAll(parts: readonly number[]): number {
  let keep = 1;
  for (const p of parts) keep *= 1 - clamp01(p);
  return 1 - keep;
}

/** Who takes a town's roofless in, as shares of them: kin, the temple, the realm, and the rest on the street. */
export function takenIn(
  kin: number,
  alms: number,
  publicCare: number,
  newShare: number,
): { kin: number; temple: number; realm: number; street: number } {
  const k = clamp01(kin) * (1 - ROOF.newcomers * clamp01(newShare)),
    t = (1 - k) * clamp01(alms),
    r = (1 - k - t) * clamp01(publicCare);
  return { kin: k, temple: t, realm: r, street: Math.max(0, 1 - k - t - r) };
}
