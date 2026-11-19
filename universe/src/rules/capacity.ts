// How far a seat's will is done in a land (the state's reach; asked 2026-11-18: "a chiefdom of year 300, a feudal patchwork, a realm
// in civil war, an overstretched empire's far provinces, an occupied land and a modern state cannot all have near-full capacity").
// It was a list of things a realm has or has not (writing 0.3, two means of carrying word 0.2, few lands 0.25, an old seat 0.1, on
// 0.15), which every lettered realm of a few lands completes by its sixth century: 0.95 for nine realms in ten from then on, whatever
// became of them. Here it is a chain, each link a share of what the one before leaves, so the weakest tells:
//   at the seat (seatLinks): what it can set down and send (word of mouth; writing, as far as there are readers to serve it and
//     clerks who keep accounts: Goody; Scott's legibility), the officials it can keep (what its treasury takes of what its people
//     earn: the tax share, the usual measure of a state's capacity, Besley and Persson; less what it cannot pay), how much of what is
//     ordered is done and not sold (what is skimmed; offices held by kin), how far it is obeyed unforced (its standing: Levi's
//     quasi-voluntary compliance), habits of obedience not yet formed under a new seat, and a seat fought over or doubted;
//   in each land (landKeeps): how far it lies from the seat against how far the realm's means carry word (steps over its own land,
//     a sea crossing two: Herbst and Stasavage on distance), ground that hides people from the count (Scott's hills), a people who
//     resent the rule, and a land held by force, as far as it is resisted.
// A realm's reach is its lands', by their people. All shares are estimates against those names; pages say what, never a how.
// Pure functions.
import { dmath } from "../kernel/index.ts";

const clamp01 = (x: number): number => dmath.clamp(x, 0, 1);

export const REACH = {
  /** What a seat with no writing can set down and send: what a ruler and his kin see and say themselves. */
  unlettered: 0.45,
  /** With writing and hardly a reader beyond its scribes; what readers add, whole where `readersFull` of its seat's land read; what clerks who keep accounts add. */
  lettered: 0.65,
  readers: 0.2,
  readersFull: 0.8,
  clerks: 0.15,
  /** What a seat's officials do on nothing but their own land's dues, and the share of what its people earn at which its treasury keeps all the officials it has use for (est: a fifth to a third in the states of Earth's last century, a twentieth in its old empires). */
  unpaid: 0.6,
  takenFull: 0.2,
  /** The most a treasury short of what it spends loses of its officials' work. */
  short: 0.25,
  /** Of what is skimmed, the share lost to what the seat wills; of offices held by kin, the share. */
  skimmed: 0.5,
  kin: 0.2,
  /** What a rule held rightful by none still gets done by force alone. */
  forced: 0.7,
  /** A new seat's obedience, and the years in which the habit forms (two generations). */
  fresh: 0.8,
  settles: 60,
  /** A seat fought over within; a seat in a crisis of its standing. */
  civil: 0.6,
  crisis: 0.85,
  /** Steps from the seat at which a land is reached half as well, with no means of carrying word but feet: each means the realm knows (roads, sail, post, rail, wire) adds `carries`. */
  steps: 3,
  carries: 1.5,
  /** The most hard ground takes, at `relief` metres of spread in its fine ground's heights. */
  ground: 0.3,
  relief: 800,
  /** The most a land's resentment takes; the least a land held by force loses, however quiet. */
  resents: 0.3,
  occupied: 0.3,
  /** The least and the most a realm's reach is read as. */
  least: 0.05,
  most: 0.95,
} as const;

/** One link of the chain: what it is, the measure it was read from, and the share of what the links before it left that it keeps. */
export type ReachLink = { readonly name: string; readonly value: number; readonly keeps: number };

export type SeatFacts = {
  /** Its seat writes; its clerks keep accounts (bureaucracy); the share of its seat's land who read (0 … 1). */
  readonly writing: boolean;
  readonly clerks: boolean;
  readonly readers: number;
  /** What its treasury takes of what its people earn (0 … 1), and what it goes short of what it takes in (0 … 1 and over). */
  readonly taken: number;
  readonly short: number;
  /** What is skimmed (0 … 1); the share of its offices held by its great houses' kin (0 … 1). */
  readonly corruption: number;
  readonly kin: number;
  /** How far its rule is held rightful (0 … 1). */
  readonly legitimacy: number;
  /** Years since its founding. */
  readonly age: number;
  /** A civil war being fought over it; a crisis of its standing. */
  readonly civil: boolean;
  readonly crisis: boolean;
};

/** The links at the seat, in order; each keeps a share of what the ones before left. */
export function seatLinks(f: SeatFacts): ReachLink[] {
  const R = REACH,
    readers = clamp01(f.readers / R.readersFull),
    records = f.writing
      ? Math.min(1, R.lettered + R.readers * readers + (f.clerks ? R.clerks : 0))
      : R.unlettered,
    taken = clamp01(f.taken / R.takenFull),
    short = clamp01(f.short),
    out: ReachLink[] = [
      {
        name: !f.writing
          ? "no writing at its seat: what is ordered goes by word of mouth"
          : f.clerks
            ? "its records, clerks, and those who can read them"
            : "writing at its seat, and those who can read it",
        value: f.writing ? readers : 0,
        keeps: records,
      },
      {
        name: "the officials its treasury's takings keep",
        value: clamp01(f.taken),
        keeps: R.unpaid + (1 - R.unpaid) * taken,
      },
    ];
  if (short > 0)
    out.push({
      name: "a treasury short of what it spends",
      value: short,
      keeps: 1 - R.short * short,
    });
  if (f.corruption > 0)
    out.push({
      name: "what is skimmed between its lands and its seat",
      value: clamp01(f.corruption),
      keeps: 1 - R.skimmed * clamp01(f.corruption),
    });
  if (f.kin > 0)
    out.push({
      name: "offices held by kin, not the able",
      value: clamp01(f.kin),
      keeps: 1 - R.kin * clamp01(f.kin),
    });
  out.push({
    name: "how far its rule is held rightful, and obeyed unforced",
    value: clamp01(f.legitimacy),
    keeps: R.forced + (1 - R.forced) * clamp01(f.legitimacy),
  });
  if (f.age < R.settles)
    out.push({
      name: "a seat not yet old",
      value: Math.max(0, f.age),
      keeps: R.fresh + (1 - R.fresh) * clamp01(f.age / R.settles),
    });
  if (f.civil) out.push({ name: "a seat fought over within", value: 1, keeps: R.civil });
  if (f.crisis) out.push({ name: "a rule in crisis", value: 1, keeps: R.crisis });
  return out;
}

/**
 * The seat's links' product alone: what `linked(seatLinks(f))` comes to, to the bit (the same shares multiplied in the same order),
 * without the links: for the many readings a year that want only the number.
 */
export function seatKeeps(f: SeatFacts): number {
  const R = REACH,
    short = clamp01(f.short);
  let x = f.writing
    ? Math.min(
        1,
        R.lettered + R.readers * clamp01(f.readers / R.readersFull) + (f.clerks ? R.clerks : 0),
      )
    : R.unlettered;
  x *= R.unpaid + (1 - R.unpaid) * clamp01(f.taken / R.takenFull);
  if (short > 0) x *= 1 - R.short * short;
  if (f.corruption > 0) x *= 1 - R.skimmed * clamp01(f.corruption);
  if (f.kin > 0) x *= 1 - R.kin * clamp01(f.kin);
  x *= R.forced + (1 - R.forced) * clamp01(f.legitimacy);
  if (f.age < R.settles) x *= R.fresh + (1 - R.fresh) * clamp01(f.age / R.settles);
  if (f.civil) x *= R.civil;
  if (f.crisis) x *= R.crisis;
  return x;
}

/**
 * The chance a year that a land whose grievance has passed the line breaks away, of what its grievance alone would make it: as far
 * as the seat's hand is not in the land to hold it. A seat that reaches a restive land keeps it (its officers, its garrison, its
 * courts are there); one whose word hardly comes loses it as soon as it will go.
 */
export function slipsAway(reach: number): number {
  return 1 - clamp01(reach);
}

export type LandReachFacts = {
  /** Steps from the seat (a sea crossing two), and how many means of carrying word the realm's seat knows. */
  readonly steps: number;
  readonly carriers: number;
  /** The spread of its fine ground's heights (m). */
  readonly relief: number;
  /** Its people's grievance against the realm (0 … 1). */
  readonly grievance: number;
  /** Held by force: how far it is resisted (0 … 1); null where it is the realm's own. */
  readonly resisted: number | null;
};

/** How well a land is reached for its distance alone (0 … 1; 1 at the seat). */
export function near(steps: number, carriers: number): number {
  return 1 / (1 + Math.max(0, steps) / (REACH.steps + REACH.carries * Math.max(0, carriers)));
}
/** What a land's ground leaves of the seat's reach. */
export function groundKeeps(relief: number): number {
  return 1 - REACH.ground * clamp01(Math.max(0, relief) / REACH.relief);
}
/** What a land's resentment leaves. */
export function resentKeeps(grievance: number): number {
  return 1 - REACH.resents * clamp01(grievance);
}
/** What holding a land by force leaves: the less the more it is resisted. */
export function forceKeeps(resisted: number | null): number {
  return resisted === null ? 1 : 1 - Math.max(REACH.occupied, clamp01(resisted));
}
/** The share of the seat's reach that is felt in one land (0 … 1). */
export function landKeeps(f: LandReachFacts): number {
  return (
    near(f.steps, f.carriers) *
    groundKeeps(f.relief) *
    resentKeeps(f.grievance) *
    forceKeeps(f.resisted)
  );
}

/** A chain's product. */
export function linked(links: readonly ReachLink[]): number {
  let x = 1;
  for (const l of links) x *= l.keeps;
  return x;
}

/**
 * What each link takes of a whole reach, so that they sum to what is missing (value − 1): a chain's loss shared among its links by
 * how much each alone would take (its logarithm's share).
 */
export function linkLosses(links: readonly ReachLink[], value: number): number[] {
  const logs = links.map((l) => -dmath.log(dmath.clamp(l.keeps, 1e-6, 1e6))),
    all = logs.reduce((s, x) => s + x, 0);
  return logs.map((x) => (all !== 0 ? ((value - 1) * x) / all : 0));
}
