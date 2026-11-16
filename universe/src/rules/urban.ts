// Who lives in a land's town (the culture sweep, 2026-11-16; audit "Urbanisation", where a land's townsfolk were its trades'
// share of its settled people, an identity: no one came to a town for anything it gave). A town draws those who would do better
// there than in the fields. Its work pays its crafters and traders what it pays; not everyone who comes finds that work at once,
// so people come until the wage a newcomer can expect (the town's wage times the chance of finding the work: its trades' places
// against all who came for them) is no more than the fields' (as Harris and Todaro had it of a growing city's poor). A town of
// many is a sickly one (sim/health: its crowds are where sickness rises): those who weigh going weigh dying too, and the bigger
// the town, the less its wage is worth to them. So a land's town holds its trades and their kin, times the town's wage over the
// fields', less what its crowds cost, never fewer than its trades, never more than so many times them; moves take years: a land
// comes a share of the way a year. Pure tables and functions.
import { dmath } from "../kernel/index.ts";

export const URBAN = {
  /** A town's size at which its crowds breed sickness (sim/health/health.ts crowds: a town of 6,000). */
  crowd: 6000,
  /** Of a town's wage, the share its crowds cost at their worst (a town far past its crowd line). */
  crowdCost: 0.4,
  /** The most a town holds over its trades and their kin: so many times them. */
  most: 3,
  /** A land's town comes this share of the way to what it draws, a year. */
  pace: 0.05,
} as const;

/** What a town's wage is worth to one weighing going, against the fields', its crowds' sickness taken off (≥ 1: its trades stay). */
export function townDraw(townWage: number, fieldWage: number, town: number): number {
  if (!(townWage > 0) || !(fieldWage > 0)) return 1;
  const crowd = Math.max(0, town) / (Math.max(0, town) + URBAN.crowd),
    worth = (townWage / fieldWage) * (1 - URBAN.crowdCost * crowd);
  return dmath.clamp(worth, 1, URBAN.most);
}

/** A land's draw `years` on, from where it was toward what its town draws. */
export function drawAfter(was: number, target: number, years: number): number {
  return was + (target - was) * (1 - dmath.pow(1 - URBAN.pace, Math.max(0, years)));
}

/** A town's draw in words. */
export function drawWords(draw: number): string {
  return draw < 1.1
    ? "only its trades and their kin"
    : draw < 1.5
      ? "its trades, and some who came for work"
      : draw < 2.2
        ? "its trades, and many who came for work"
        : "far more than its trades: most came for work";
}
