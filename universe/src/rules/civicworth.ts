// What a town's building is worth to it (breadth round, 2026-11-23): a building rises where its use pays for its cost in that town.
// Its cost is the work of raising it (builders a lot a year, its lots and its years, at the going wage of those who build), carried
// as a yearly charge: what waiting is worth to its people (rules/thrift.ts timePreference), its wearing out over its life, and its
// upkeep. Its use is what it adds to, or saves of, the year of each of those it serves (all its people, or its crafters, traders,
// learned or young) at their own work's worth. The first of a kind rises once those it serves are enough for its use to carry its
// charge; more rise as each, serving the next of them (up to the many one building serves, rules/buildings.ts `per`), still pays;
// it falls, as before, once its town has emptied to a third of the people it first rose among. What a building does is written here, a share of a year; where, when
// and how many is each town's: its size, who works in it, what they earn against its builders, how patient its people are.
// Pure tables and functions.
import type { CivicDef, CivicKind } from "./buildings.ts";

/** Who a building serves. */
export const CIVIC_USERS = ["people", "crafters", "traders", "learned", "young"] as const;
export type CivicUsers = (typeof CIVIC_USERS)[number];
export const USERS_WORDS: Readonly<Record<CivicUsers, string>> = {
  people: "all its people",
  crafters: "its crafters",
  traders: "its traders",
  learned: "its learned",
  young: "its young",
};

/**
 * What each building does for each of those it serves, as a share of their year's work (est: the days a year it saves or adds).
 * A market hall in a market town always pays (a roof over what is sold there is half again what is sold); a well is only asked.
 */
export const CIVIC_USE: Readonly<
  Record<CivicKind, { readonly users: CivicUsers; readonly gain: number }>
> = {
  // (Offerings and rites brought to one place: two or three days of each one's year.)
  shrine: { users: "people", gain: 0.0072 },
  // (The harvest kept dry and counted against a lean year: three or four days of each one's food.)
  granary: { users: "people", gain: 0.0096 },
  // (Pots fired hot and many at once: a fortieth more of a crafter's work, of what is fired.)
  kiln: { users: "crafters", gain: 0.024 },
  smithy: { users: "crafters", gain: 0.018 },
  market: { users: "traders", gain: 0.3 },
  // (Grain ground by water or wind: a day or two of each one's grinding by hand.)
  mill: { users: "people", gain: 0.0042 },
  temple: { users: "people", gain: 0.0096 },
  // (Quarrels heard and settled in a day, not fought out: a day or two of each one's year.)
  hall: { users: "people", gain: 0.0045 },
  // (Letters learned: a hundredth more of each child's later work, each year.)
  school: { users: "young", gain: 0.0078 },
  workshop: { users: "crafters", gain: 0.018 },
  docks: { users: "traders", gain: 0.36 },
  academy: { users: "learned", gain: 0.24 },
  // (Washing, and the sickness it keeps off.)
  baths: { users: "people", gain: 0.0024 },
  observatory: { users: "learned", gain: 0.12 },
  // (The sick tended: half a day of each one's year not lost.)
  hospital: { users: "people", gain: 0.0012 },
  // (Engines under one roof: a sixteenth more of each crafter's work.)
  factory: { users: "crafters", gain: 0.06 },
  station: { users: "traders", gain: 0.12 },
  power: { users: "people", gain: 0.0012 },
  offices: { users: "traders", gain: 0.0054 },
  fusion: { users: "people", gain: 0.00048 },
  minds: { users: "people", gain: 0.00012 },
  vats: { users: "people", gain: 0.000144 },
  well: { users: "people", gain: 0 },
  prison: { users: "people", gain: 0.0006 },
};

/** Each of those served, by its place in CIVIC_USERS. */
const USER_AT: Readonly<Record<CivicUsers, number>> = {
  people: 0,
  crafters: 1,
  traders: 2,
  learned: 3,
  young: 4,
};

/** Builders a lot keeps at work a year while it rises (est: a crew of six). */
export const BUILDERS_A_LOT = 6;
/** Years a building serves before it is worn out (est), and what keeping it up costs a year, as a share of raising it. */
export const CIVIC_LIFE = 80;
export const CIVIC_UPKEEP = 0.02;

/** A town as its buildings are weighed: its people, the share of them each building serves, what they earn against its builders. */
export type TownUse = {
  readonly people: number;
  /** By CIVIC_USERS: the share of its people each serves (0 … 1). */
  readonly share: readonly number[];
  /** By CIVIC_USERS: what a year of their work is worth against a builder's. */
  readonly worth: readonly number[];
  /** What waiting is worth to its people, a year (rules/thrift.ts). */
  readonly preference: number;
};

/** A building's yearly charge, in builders' years: the work of raising it carried at its people's patience, its wear and upkeep. */
export function civicCharge(def: CivicDef, lots: number, preference: number): number {
  return def.years * lots * BUILDERS_A_LOT * (preference + 1 / CIVIC_LIFE + CIVIC_UPKEEP);
}

/** What one of those a building serves gains by it a year, in builders' years. */
function eachGains(def: CivicDef, town: TownUse): number {
  const use = CIVIC_USE[def.kind],
    u = USER_AT[use.users];
  return use.gain * Math.max(0, town.worth[u] ?? 1);
}

/** The fewest people at which a first building of a kind pays in a town like this one (Infinity: it never does). */
export function payingPeople(def: CivicDef, lots: number, town: TownUse): number {
  const u = USER_AT[CIVIC_USE[def.kind].users],
    each = eachGains(def, town) * Math.max(0, town.share[u] ?? 0);
  return each > 0 ? civicCharge(def, lots, town.preference) / each : Infinity;
}

/**
 * How many of a kind pay in a town: each serving up to `per` of its people (all of them where it has no `per`), the next rising
 * while those it would serve make its use worth its charge; never more than `most`.
 */
export function civicsPaying(def: CivicDef, lots: number, town: TownUse): number {
  const least = payingPeople(def, lots, town);
  if (!(town.people >= least)) return 0;
  if (!def.per) return 1;
  const full = Math.floor(town.people / def.per),
    rest = town.people - full * def.per,
    n = (def.per >= least ? full : 0) + (rest >= least ? 1 : 0);
  return Math.max(1, Math.min(def.most ?? 99, n));
}
