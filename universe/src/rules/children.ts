// How many children a people bears, from what raising them asks and how many live (asked 2026-11-15: "every theoretical system
// ... first principles", where the demographic transition was a straight line on a land's kilowatts a head: all its old
// fertility below a quarter of a kilowatt, four in ten less at two and a quarter, whatever its people were or how many of
// their young lived, so that a world with power to spare shrank without end and one short of coal never began to). Now:
//   a people bears what its bodies can (its life table's fertility, the hungry the less) until it has as many children living
//   to bear their own as it wants: those it wants are as many as replace it, and more the less each costs to raise;
//   a child costs the more where it must be schooled before it works (those who read: rules/letters.ts), and where its work
//   is not wanted, machines doing what hands and beasts did (the work a land turns that is not its bodies' or beasts').
//   how many of those born live to bear is read off the people's own life table under what presses on its deaths now
//   (medicine, smoke, cold), so a people that keeps more of its young bears fewer, whatever its body: a spawning people of
//   the sea, most of whose young die, comes to the same end by the same rule as an ape.
// A people at the end of it replaces itself and a little over: it levels off, as far as its food allows. Pure functions.
import { dmath } from "../kernel/index.ts";
import { bandWidth, diedInBirthYear, girlsOf, riskUnder, type LifeHistory } from "./species.ts";

export const CHILDREN = {
  /** Children living to bear that replace a people: a mother for each mother (a girl is 0.488 of those an ape bears; a people's own
   * share where it is known, rules/species.ts girlsOf). */
  replace: 1 / 0.488,
  /** What a people at the end of its transition wants past replacing itself (a twentieth more). */
  over: 0.05,
  /** Living children wanted past replacement where a child costs nothing to raise: more than any body bears. */
  free: 6,
  /** How fast what a child costs brings that down: at its full cost (schooled, its work not wanted), a hundredth is left. */
  cost: 2.5,
  /**
   * What a child costs where all its people read (schooled before it works), and where machines do all the work: a child's
   * hands are wanted in the fields and at the bench until machines do that work, and it is that more than schooling that
   * makes a child dear (on first light with work weighed as schooling, a world nine-tenths machine-driven at 850 still
   * wanted 2.6 living a mother, and was held at 1.2 billion by hunger alone).
   */
  schooled: 1,
  idle: 2,
} as const;

/**
 * What raising a child costs (0 … CHILDREN.schooled + CHILDREN.idle, and what its mother gives up): its schooling, its work not
 * wanted, and the work its mother gives up for it where her work is away from home (the society sweep, rules/roles.ts forgone).
 */
export function childCost(readers: number, machines: number, forgone = 0): number {
  return (
    CHILDREN.schooled * dmath.clamp(readers, 0, 1) +
    CHILDREN.idle * dmath.clamp(machines, 0, 1) +
    Math.max(0, forgone)
  );
}

/**
 * Children living to bear a people wants, a mother, at a cost of raising them; and `age` more where only her children would keep
 * her when she is old (the society sweep, rules/care.ts keptOld).
 */
export function childrenWanted(cost: number, age = 0, girls = 0.488): number {
  return (
    (1 / Math.max(0.05, girls)) * (1 + CHILDREN.over) +
    CHILDREN.free * dmath.exp(-CHILDREN.cost * cost) +
    Math.max(0, age)
  );
}

type Bearing = { readonly born: number; readonly at: number };
/** All a mother bears in her life at plenty, and the age she bears at, on the mean (a life table's own). */
export function bearingOf(life: LifeHistory): Bearing {
  let born = 0,
    at = 0;
  for (let k = 0; k < life.bands.length; k++) {
    const n = life.fertility[k]! * bandWidth(k, life);
    born += n;
    at += n * (life.bands[k]! + bandWidth(k, life) / 2);
  }
  return { born, at: born > 0 ? at / born : 0 };
}

/**
 * Of those born, the share of a whole bearing life they live to bear (1: every one of them bears all her body could), with
 * deaths `m` times as pressing: reckoned as the simulation reckons a land (rules/species.ts growthOf), the newborn's deaths
 * spread over its first year, each band's deaths at its yearly chance and a width-th of each band growing into the next at
 * the year's end. (A band left at an even pace, not at its last birthday: where the young mostly die, as a spawning
 * people's do, the few who grow up fast are the ones who live, and reading every one as staying its band's full width
 * counted a fish's people at a sixtieth of those it raises.)
 */
export function livingToBear(life: LifeHistory, m: number): number {
  return livingOf(life, m, bearingOf(life).born);
}

/** The same, of a life table whose mothers bear `born` in all (its bearingOf's). */
function livingOf(life: LifeHistory, m: number, born: number): number {
  if (born <= 0) return 0;
  let reach = 1 - diedInBirthYear(riskUnder(life.mortality[0]!, m)),
    bears = 0;
  for (let k = 0; k < life.bands.length; k++) {
    const d = Math.min(1, riskUnder(life.mortality[k]!, m)),
      w = bandWidth(k, life),
      // (Each year in the band: counted at its start, then lives the year, then a width-th go on.)
      stay = (1 - d) * (1 - 1 / w),
      years = stay < 1 ? 1 / (1 - stay) : w;
    // (The newborn come into their band after the year's deaths, a width-th of them going on at once: the first year
    // counted from the year's end. Every later band is come into at a year's end too, and first counted at the next.)
    const first = k === 0 ? (1 - 1 / w) * years : years,
      on = k === 0 ? years / w : ((1 - d) / w) * years;
    bears += reach * life.fertility[k]! * first;
    if (k + 1 < life.bands.length) reach *= on;
  }
  return bears / born;
}

/**
 * Of what its bodies could bear, the share a people bears (0 … 1): as many as it wants living, over those who would live of
 * all it could bear.
 */
export function childrenKept(life: LifeHistory, m: number, cost: number, age = 0): number {
  const b = bearingOf(life),
    could = b.born * livingOf(life, m, b.born);
  return could > 0 ? Math.min(1, childrenWanted(cost, age, girlsOf(life)) / could) : 1;
}

// Who of a people can be spared to fight (asked of round "peoples": reproduction and kin by species, where a levy took the
// grown men alone, whatever the body): those who bear are kept from war as far as bearing and nursing their young holds their
// grown years. A mother who carries each young the better part of a year and nurses it two more, five times over, spends some
// two-fifths of the years she bears in it, and is not sent; a spawning mother, who leaves her young to the water, goes with the
// rest. Read off the body and its life table, the same for any people.
export const BEARING = {
  /** The years a young holds its mother, carried and nursed, by how it is borne (an upright ape's three; a span's worth). */
  holds: { live: 2.75, eggs: 0.25, spawn: 0 } as Readonly<Record<string, number>>,
  /** The share of her bearing years held by her young past which a mother is not sent at all. */
  spared: 0.25,
} as const;

/** The share of a mother's bearing years her young hold her (0 …), by her body and its life table. */
export function bearingHeld(
  body:
    { readonly bearing: string; readonly young: number; readonly span: number } | null | undefined,
  life: LifeHistory,
): number {
  if (!body) return (BEARING.holds.live! * bearingOf(life).born) / bearingYears(life);
  const births = bearingOf(life).born / Math.max(1, body.young),
    holds = (BEARING.holds[body.bearing] ?? 0) * (body.span / 70);
  return (births * holds) / bearingYears(life);
}

/** The years in which a mother bears, by her life table (those of its bands where any are born). */
function bearingYears(life: LifeHistory): number {
  let years = 0;
  for (let k = 0; k < life.bands.length; k++)
    if (life.fertility[k]! > 0) years += bandWidth(k, life);
  return Math.max(1, years);
}

/** Of those who bear, the share a levy may take as it takes the others (0 … 1). */
export function bearersServe(held: number): number {
  return dmath.clamp(1 - held / BEARING.spared, 0, 1);
}
