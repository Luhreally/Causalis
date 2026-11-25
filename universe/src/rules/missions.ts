// Missionaries (the last breadth gaps, 2026-11-24): a faith spread only as a land took it from a neighbour who spoke alike.
// Here a faith with houses and a granary sends its own people where they would win it the most: a land its believers already
// deal with (their trade reaches it), weighed by what the land's people would come to give against what keeping preachers
// among them costs.
// - Who can be reached: a land its houses' lands trade with (its seat's and a few more, others each time), of another belief.
// - What a mission wins: preachers live among a people and speak as they do, so likeness of tongue, which a faith crossing a
//   border by itself needs twice over, weighs nothing; what is left is how hard the land holds what it has (a faith held is
//   left a third as readily as the old beliefs) and how devout the senders are. A year's chance is that of a neighbour's faith
//   on a road (MISSION.base, as sim/belief spreads it); over the mission's years, the chance it is won at all.
// - What it is worth: the land's people, by that chance, giving as the faith's own faithful give a head, over a generation.
// - What it costs: a preacher to as many as a parish holds, a tenth of that to open a land (MISSION.open), each kept twice
//   over (his food, and his road and roof among strangers) for the mission's years; paid from the faith's granary at once.
// - Who can go: preachers are its own clergy, and it can spare a tenth of them (MISSION.spare): a faith of a few houses opens
//   no great land. And they go only where they are let: a realm whose law allows one faith, not theirs, bars them.
// Sent where the worth is more than the cost and its granary holds it; one mission a faith at a time.
// Pure functions.
import { dmath } from "../kernel/index.ts";

export const MISSION = {
  /** A faith weighs sending a mission once in so many years; a mission lasts as many. */
  every: 10,
  years: 10,
  /** A year's chance a land takes a faith from those who bring it by road, before how it holds its own and how devout they are (sim/belief/belief.ts: 0.05, by a road 1.5). */
  base: 0.075,
  /** A land that holds a faith leaves it this readily against one of the old beliefs. */
  held: 0.3,
  /** Of the clergy a people would keep (`parish`: a priest to 250), the share that opens a land. */
  parish: 0.004,
  open: 0.1,
  /** The lands of a faith its preachers set out from when it weighs a mission: its seat's and so many of its others. */
  houses: 8,
  /** The fewest sent, and the share of its clergy a faith can spare to send. */
  fewest: 2,
  spare: 0.1,
  /** What keeps one preacher abroad a year (grain: his year's food twice). */
  keep: 24,
  /** Years of the converts' giving a faith counts (a generation). */
  horizon: 25,
} as const;

/** A year's chance a land takes a faith from its preachers: `holdsFaith` where it holds another already; `piety` the senders'. */
export function missionChance(holdsFaith: boolean, piety: number): number {
  return dmath.clamp(
    MISSION.base * (holdsFaith ? MISSION.held : 1) * (0.5 + dmath.clamp(piety, 0, 1)),
    0,
    1,
  );
}

/** Whether a faith with `clergy` can send `preachers`, to a land whose realm's law allows one faith alone (`oneFaith`) that is or is not `theirs`. */
export function missionCanGo(
  preachers: number,
  clergy: number,
  oneFaith: boolean,
  theirs: boolean,
): boolean {
  return preachers <= clergy * MISSION.spare && (!oneFaith || theirs);
}

/** How many a faith sends to a land of `people`. */
export function preachersFor(people: number): number {
  return Math.max(MISSION.fewest, Math.round(Math.max(0, people) * MISSION.parish * MISSION.open));
}

/** The chance a land is won at all over a mission's years (0 … 1). */
export function missionWon(holdsFaith: boolean, piety: number): number {
  return 1 - dmath.pow(1 - missionChance(holdsFaith, piety), MISSION.years);
}

/**
 * What a mission to a land is worth against its cost (grain): `people` there, `won` the chance it is won over the mission's
 * years (missionWon), and `giving` what one of the faithful gives the faith a year (grain).
 */
export function missionWorthWon(
  people: number,
  won: number,
  giving: number,
): { worth: number; cost: number; won: number; preachers: number } {
  const preachers = preachersFor(people);
  return {
    worth: Math.max(0, people) * won * Math.max(0, giving) * MISSION.horizon,
    cost: preachers * MISSION.keep * MISSION.years,
    won,
    preachers,
  };
}

/** The same, from whether the land holds a faith already and how devout the senders are. */
export function missionWorth(
  people: number,
  holdsFaith: boolean,
  piety: number,
  giving: number,
): { worth: number; cost: number; won: number; preachers: number } {
  return missionWorthWon(people, missionWon(holdsFaith, piety), giving);
}
