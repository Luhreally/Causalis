// Seasonal herding (the last breadth gaps, 2026-11-24): herders were an occupation in a fixed land. Here a land's herders
// drive their flocks to a neighbouring land's pasture for the season its grass stands, where that pays.
// - What is there to gain: the neighbour's pasture its own herders leave ungrazed (its capacity less what their work takes),
//   for the share of the year its grass grows (rules/seasons.ts shareAbove: its mean warmth and its seasons' swing against the
//   warmth grass grows above). A cold upland with few people and a short summer gives a little; a wide empty steppe much.
// - What it costs: the days on the way there and back, a flock walking DROVE.day kilometres a day, as a share of the year
//   (the world's own year, in its days): that share of all the herders' work is spent on the road.
// - Whether it pays: what their work yields on their own pasture and the away pasture together, less the road, against what
//   it yields at home alone (the same saturating yield a land's herders have: sim/population saturate). Taken up where the
//   gain is DROVE.least or more; let go when it no longer is.
// A people who herd and whose own land gives little move with the grass; one with pasture to spare stays home. Pure functions.
import { dmath } from "../kernel/index.ts";

export const DROVE = {
  /** Kilometres a flock is driven in a day (est: 15, a day's walk grazing as it goes). */
  day: 15,
  /** A land's herders weigh it once in so many years. */
  every: 5,
  /** The least gain it is taken up for (a share of what they make). */
  least: 0.05,
  /** The most of the year on the road before no one would (a share). */
  roadMost: 0.25,
} as const;

/** What a land's herders make of a pasture of `capacity` with `work` (their heads by what a head works): saturating. */
function herdYield(capacity: number, work: number): number {
  return capacity > 0 && work > 0 ? capacity * (1 - dmath.exp(-work / capacity)) : 0;
}

/** A neighbouring pasture as a land's herders weigh it. */
export type AwayPasture = {
  /** Its pasture its own herders leave ungrazed (the units of the home pasture). */
  readonly spare: number;
  /** The share of the year its grass grows (0 … 1). */
  readonly grows: number;
  /** How far it lies (km). */
  readonly km: number;
};

/**
 * What driving its flocks to an away pasture is worth to a land's herders: `gain`, what they make with it against what they
 * make at home alone (over 1: more); `extra`, the pasture it adds; `road`, the share of their year spent on the way. `yearDays`
 * is the world's year in days.
 */
export function droveWorth(
  pasture: number,
  work: number,
  away: AwayPasture,
  yearDays: number,
): { gain: number; extra: number; road: number } {
  const extra = Math.max(0, away.spare) * dmath.clamp(away.grows, 0, 1),
    road = (2 * Math.max(0, away.km)) / (DROVE.day * Math.max(1, yearDays)),
    home = herdYield(pasture, work);
  if (!(home > 0) || !(extra > 0) || road >= DROVE.roadMost) return { gain: 1, extra, road };
  return { gain: (herdYield(pasture + extra, work) * (1 - road)) / home, extra, road };
}

/** Whether it is taken up; once taken up (`kept`), it is kept while it gives half as much: the way is known and the huts stand. */
export const drovePays = (gain: number, kept = false): boolean =>
  gain >= 1 + (kept ? DROVE.least / 2 : DROVE.least);
