// Past our ages, what a people makes of its sky and of itself (the Frontier lane; the mirrors, the remaking and the covered
// world are rules/late.ts). Each a figure its own star, its system's small bodies and its own numbers give.
//
//   Works in the sky: a works on a small body that builds the next of what it mines, tended by minds, doubles as the mirrors
//   do (rules/late.ts), its rock out of a shallow well instead of up a world's deep one; it sends down what it makes, as many
//   machines a year as its people would wear out, and no more. Its rock is its system's belt: the giant past the frost line
//   that stirs it also clears it (a belt left unstirred holds more, est). Lit by mirrors, it doubles twice as fast.
//   Bodies written for a world: a people that writes and grows its bodies writes its settlers' children for the world they
//   live on, a share a generation, as far as a body can be bent (a warmth some sixty degrees from home's, a sky's rays with
//   mended cells: est); air and pressure stay the halls' work. Machine limbs and senses (where minds are made) bear the cold
//   and the rays a share more.
//   Minds past their makers: a people's made minds think as many sums a second as its crystal and its power allow, and the
//   crystal doubles every two years once minds design minds (Moore's law, est), until its power is all they can burn: a
//   sum a picojoule (est, far above Landauer's bound). A body's brain thinks some 1e16 a second (est). Past their makers'
//   sum the minds may be kept, or go their own way, as tightly as a people holds what it has made (its order and its
//   tradition: est); and a people whose bodies can be read may go up into them, as many as its ways are open, slowly.
// Pure tables and functions.
import { dmath } from "../kernel/index.ts";

export const BEYOND = {
  /** The first works in the sky (t): a station's weight in tools and seed works. */
  firstWorksT: 2000,
  /** Years a works takes to double, tended by minds; lit by mirrors (est). */
  doubling: 15,
  doublingLit: 8,
  /** Machines a tonne of works sends down a year at most, and the people's wear a head a year (rules/goods.ts machinesPerWorker). */
  machinesPerT: 0.05,
  perHead: 0.05,
  /** A belt's rock (home-world masses): stirred by a giant past the frost line (Earth's, 5e-4), or left whole (est). */
  beltStirred: 5e-4,
  beltWhole: 5e-3,
  /** A home world's mass (kg). */
  earthKg: 5.97e24,
  /** Of a belt, the share a people can reach and work in a chronicle (est). */
  beltReached: 1e-6,
  /** Years untended before a works falls silent. */
  untended: 30,
  /** A body's bending in a generation, the years of one, and how far: degrees of warmth from home's, a share of the sky's rays (est). */
  writtenShare: 0.3,
  generationYears: 25,
  writtenDegrees: 60,
  writtenRays: 0.5,
  /** What machine limbs and senses add of the cold and the rays borne (est). */
  limbs: 0.25,
  /** Sums a second a body's brain is reckoned to think (est). */
  brainSums: 1e16,
  /** Sums a second a head a people's first minds of crystal reckon (rules/ages.ts SUMS, "minds of crystal"). */
  crystalSums: 1e10,
  /** Years the minds' crystal takes to double once minds design minds (est, Moore's law). */
  mindsDoubling: 2,
  /** Sums a joule the made minds reach (est). */
  sumsPerJ: 1e12,
  /** A share a year of how far past their makers' sum the minds are (a tenfold) that they go their own way, unbound (est). */
  freeing: 0.004,
  /** A share a year of those whose ways are open who go up into minds, once they can (est). */
  goingUp: 0.01,
  /** Past this many of a land's people gone up, its people are told gone. */
  goneShare: 0.5,
} as const;

/** The rock a system's belt holds (kg), by whether a giant stirs it. */
export const beltKg = (stirred: boolean): number =>
  (stirred ? BEYOND.beltStirred : BEYOND.beltWhole) * BEYOND.earthKg;

/** The most a system's works can grow to (t): what of its belt a people can reach. */
export const mostWorksT = (stirred: boolean): number =>
  (beltKg(stirred) * BEYOND.beltReached) / 1000;

/** A year of a works tended: doubled by its doubling's share, no more than its belt allows. */
export function worksNextYear(t: number, most: number, lit: boolean, mindsPast: number): number {
  const d =
    (lit ? BEYOND.doublingLit : BEYOND.doubling) /
    (1 + Math.max(0, dmath.log10(Math.max(1, mindsPast))));
  return Math.min(most, t * dmath.pow(2, 1 / Math.max(1, d)));
}

/** Machines a works sends down a year: by its weight, no more than its realm's people wear out. */
export const worksMachines = (t: number, people: number): number =>
  Math.floor(Math.min(t * BEYOND.machinesPerT, Math.max(0, people) * BEYOND.perHead));

/**
 * The share of a land's halls' upkeep a written body bears, from the needs it lists (rules/habitat.ts Need ids and their
 * upkeep): heating and cooling as far as the warmth lies within the bend, the rays' shelter a share; air and pressure none.
 */
export function writableShare(
  needs: readonly { readonly id: string; readonly upkeep: number }[],
  degreesOff: number,
  limbs: boolean,
): number {
  const k = BEYOND,
    extra = limbs ? k.limbs : 0;
  let all = 0,
    bent = 0;
  for (const n of needs) {
    all += n.upkeep;
    if (n.id === "heat" || n.id === "cool")
      bent +=
        n.upkeep *
        Math.min(1, dmath.clamp(k.writtenDegrees / Math.max(1, degreesOff), 0, 1) + extra);
    else if (n.id === "shelter") bent += n.upkeep * Math.min(1, k.writtenRays + extra);
  }
  return all > 0 ? dmath.clamp(bent / all, 0, 1) : 0;
}

/** A body's bending after so many years of writing: a share a generation, compounding. */
export const writtenAfter = (years: number): number =>
  1 - dmath.pow(1 - BEYOND.writtenShare, Math.max(0, years) / BEYOND.generationYears);

/**
 * How many times their makers' sum a people's minds think (a ratio), `years` after minds began to design minds: their
 * crystal at the start (sums a second a head), doubling, no more than their power (kW a head) burns.
 */
export function mindsPast(sumsAHead: number, kwAHead: number, years: number): number {
  const k = BEYOND,
    grown = Math.max(0, sumsAHead) * dmath.pow(2, Math.max(0, years) / k.mindsDoubling),
    power = Math.max(0, kwAHead) * 1000 * k.sumsPerJ;
  return Math.min(grown, power) / k.brainSums;
}

/** The years from the start until the minds pass their makers (Infinity where their power never lets them). */
export function yearsToPass(sumsAHead: number, kwAHead: number): number {
  const k = BEYOND;
  if (kwAHead * 1000 * k.sumsPerJ < k.brainSums || !(sumsAHead > 0)) return Infinity;
  return Math.max(0, k.mindsDoubling * dmath.log2(k.brainSums / sumsAHead));
}

/** A year's chance the minds go their own way: the farther past their makers, the likelier; the tighter held, the less. */
export function freeingChance(past: number, held: number): number {
  if (!(past > 1)) return 0;
  return BEYOND.freeing * dmath.log10(past) * (1 - dmath.clamp(held, 0, 1));
}

/** How tightly a people holds what it has made (0 … 1), from its ways: its order and its tradition. */
export const heldOf = (hierarchy: number, tradition: number): number =>
  dmath.clamp(0.5 * hierarchy + 0.5 * tradition, 0, 1);

/** The share of a land's people who would go up into minds (0 … 1): as open as its ways are, its piety holding some back. */
export const wouldGoUp = (openness: number, piety: number): number =>
  dmath.clamp(openness - 0.35 - 0.5 * Math.max(0, piety - 0.5), 0, 0.9);

/** Those of a land's people who go up this year: a share of those who would and have not yet. */
export function goingUpOf(people: number, would: number, gone: number): number {
  const left = Math.max(0, would - gone);
  return Math.floor(Math.max(0, people) * BEYOND.goingUp * left);
}
