// Fleets on a world (the last sweep, war). A realm whose people know ships, and whose lands touch the sea, keeps warships.
// It builds them as far as its coasts have shipwrights and its woods have timber (from steam on, its works give the hulls).
// It keeps as many as its sea interest and its fears are worth: a share of what it makes, more in a war across the sea, and
// as many as the fleet of a rival it fears would need it to match. A hull wears out in a generation. Two fleets at war fight
// for the sea by Lanchester's square: a fleet's strength goes as its quality times its tonnes squared, and each side's
// command of the sea is its share of the two. Each loses ships as far as the other commands. A host goes over the sea only
// as far as hulls carry it, warships and merchantmen pressed alike, and lands the better the more its fleet commands the
// sea. A realm whose foe commands the sea is blockaded: its sea trade is cut by as much. A besieged seat on the coast is fed
// by its own ships. Pure; sim/war/navy.ts keeps a realm's tonnes and a war's command, and steps them yearly.
import { dmath } from "../kernel/index.ts";

export const NAVY = {
  /** Worker-years a tonne of warship takes to build, timber to guns. */
  build: 0.5,
  /** Years a hull lasts. */
  life: 25,
  /** Worker-years a tonne costs a year to keep in commission: crews, stores and repair. */
  keep: 0.15,
  /** Of a coastal land's crafters, the share a realm can set to building ships in a year. */
  wrights: 0.05,
  /** Of what a realm makes, the share a realm wholly on the sea keeps on ships at peace, and at war across the sea. */
  peace: 0.01,
  war: 0.03,
  /** The most of what it makes a realm will spend on ships. */
  most: 0.08,
  /** Of a feared rival's fleet within reach, as much again as it fears, a realm would match. */
  match: 1,
  /** Of a fleet beyond what is wanted, the share laid up a year. */
  laidUp: 0.1,
  /** Of the two fleets at war, the share that meets in a year, and of a fleet that meets the other, the share sunk at its foe's full command. */
  meet: 0.5,
  sink: 0.3,
  /** Tonnes of shipping a man and his kit need to cross the sea, and the tonnes of merchant shipping a coastal trader keeps. */
  perMan: 2,
  merchant: 3,
  /** A landing at full command of the sea, carried whole, fights at this share of its strength; at none, at `landingLeast` of it. */
  landingMost: 0.9,
  landingLeast: 0.3,
  /** Of a coastal seat's food, the share its ships bring in at full command. */
  relief: 0.8,
  /** A fleet under this many tonnes is laid up. */
  least: 10,
} as const;

/** What a tonne of a realm's warships is worth in a fight: its arms, their fire, and how far its ships can go to sea. */
export function hullQuality(arms: number, fire: number, seaSteps: number): number {
  const sea = 0.5 + (0.5 * dmath.clamp(dmath.log2(Math.max(1, seaSteps)), 0, 4)) / 4;
  return Math.max(0.01, arms) * (1 + Math.max(0, fire)) * sea;
}

/** What a tonne costs a year to keep, built and worn, in worker-years. */
export const TON_YEAR = NAVY.build / NAVY.life + NAVY.keep;

/**
 * The tonnes a realm would keep: a share of what it makes (its coasts' share of its lands at peace, more across the sea at
 * war), and as much as a feared rival's fleet within reach, by its fear; never more than it can bear. `worth` is what a
 * worker makes a year, in what it makes.
 */
export function navyWanted(e: {
  readonly made: number;
  readonly worth: number;
  readonly coast: number;
  readonly atSea: boolean;
  readonly footing: number;
  readonly rival: number;
}): number {
  const per = TON_YEAR * Math.max(1e-6, e.worth),
    share = dmath.clamp(
      e.coast * (NAVY.peace + e.footing) + (e.atSea ? NAVY.war : 0),
      0,
      NAVY.most,
    ),
    own = (share * e.made) / per,
    cap = (NAVY.most * e.made) / per;
  return Math.max(0, Math.min(cap, Math.max(own, NAVY.match * e.rival)));
}

/** A year's building and wear: toward what is wanted, as fast as its wrights can build it. */
export function fleetYear(
  tons: number,
  wanted: number,
  canBuild: number,
): {
  tons: number;
  built: number;
} {
  const worn = tons / NAVY.life,
    left = tons - worn,
    built = Math.max(0, Math.min(Math.max(0, canBuild), wanted - left)),
    laid = left > wanted ? (left - wanted) * NAVY.laidUp : 0,
    next = left + built - laid;
  return { tons: next < NAVY.least ? 0 : next, built };
}

/**
 * A year's fight for the sea between two fleets (Lanchester's square): each side's command is its share of `quality × tonnes²`,
 * and each loses, of the share that meets, as much as the other commands. A side with no fleet commands nothing and loses nothing.
 */
export function seaBattle(
  tonsA: number,
  qualityA: number,
  tonsB: number,
  qualityB: number,
): { command: [number, number]; sunk: [number, number] } {
  const sa = Math.max(0, qualityA) * tonsA * tonsA,
    sb = Math.max(0, qualityB) * tonsB * tonsB;
  if (!(sa + sb > 0)) return { command: [0, 0], sunk: [0, 0] };
  const ca = sa / (sa + sb),
    cb = 1 - ca;
  return {
    command: [ca, cb],
    sunk: [NAVY.meet * NAVY.sink * tonsA * cb, NAVY.meet * NAVY.sink * tonsB * ca],
  };
}

/** The share of a host the sea can carry: warships and merchantmen pressed, over its men. */
export function seaCarried(tons: number, merchant: number, men: number): number {
  return men > 0 ? dmath.clamp((tons + merchant) / (NAVY.perMan * men), 0, 1) : 1;
}

/** A landing's share of its host's strength, by its fleet's command of the sea and how much of the host is carried. */
export function landingShare(command: number, carry: number): number {
  return (
    (NAVY.landingLeast + (NAVY.landingMost - NAVY.landingLeast) * dmath.clamp(command, 0, 1)) *
    (0.5 + 0.5 * dmath.clamp(carry, 0, 1))
  );
}

/** How far a realm's sea trade is cut, by its foe's command of the sea: nothing up to an even sea, all of it at full command. */
export function blockadeOf(foeCommand: number): number {
  return dmath.clamp(2 * (foeCommand - 0.5), 0, 1);
}
