// Floods in play (the sweep, Nature lane): a river overruns its banks when a year's peak flow passes what its channel holds.
// The peaks of a river's years scatter as extremes do (Gumbel's law); a wet year raises them more than in step with its rain
// (the ground soaked, more of each storm runs off), and a cleared watershed sheds its rain faster than a wooded one. On the
// flat land by a river (its floodplain) a great flood drowns that year's fields and wets its stores, drowns a few, and lays its
// silt, which feeds the fields after (the Nile's gift). Pure functions; sim/planet/floods.ts keeps the state. Estimates are
// marked "est".
import { dmath } from "../kernel/index.ts";

export const FLOOD = {
  /** The years between floods that drown a floodplain's fields at its usual rain, its watershed wooded (est: a 25-year flood). */
  returnYears: 25,
  /** How a river's yearly peaks scatter: Gumbel's scale on the log of the peak (est: peaks' spread some three tenths). */
  scatter: 0.3,
  /** How much faster a year's peak rises than its rain (its power, est: twice: the ground soaked runs off). */
  rainPower: 2,
  /** How much higher a peak runs off a watershed with no woods than off a wooded one (est: a third). */
  cleared: 0.3,
  /** A land is a floodplain where its slopes are this gentle or less (rise over run, est). */
  plain: 0.02,
  /** Of a floodplain's harvest, the share a flood of its usual greatness drowns (est), and the most. */
  fields: 0.35,
  fieldsMost: 0.9,
  /** Of its people, the share it drowns at its usual greatness (est: most see it come), and of its stores, the share wetted. */
  dead: 0.0005,
  deadMost: 0.02,
  stores: 0.12,
  /** Its silt, as a share of the land's topsoil, at its usual greatness, and the most (est). */
  silt: 0.004,
  siltMost: 0.03,
  /** How far past its usual greatness a flood may run: its size is 1 + this × an exponential draw (est). */
  spread: 0.6,
} as const;

/** Where a 1-in-T year flood stands on the Gumbel scale. */
const gumbelAt = (p: number): number => -dmath.log(-dmath.log(1 - p));

/**
 * A floodplain's chance of a flood that drowns its fields this year: its year's rain against its usual (`rain`, 1: usual) and
 * the share of its watershed still wooded (`forest`, 0 … 1).
 */
export function floodChance(rain: number, forest: number): number {
  const x0 = gumbelAt(1 / FLOOD.returnYears),
    lift =
      FLOOD.rainPower * dmath.log(Math.max(0.05, rain)) +
      dmath.log(1 + FLOOD.cleared * (1 - dmath.clamp(forest, 0, 1))),
    x = x0 - lift / FLOOD.scatter;
  return dmath.clamp(1 - dmath.exp(-dmath.exp(-x)), 0, 0.95);
}

/** A flood's greatness (1: its usual) from a uniform draw. */
export function floodSize(u: number): number {
  return 1 + FLOOD.spread * -dmath.log(Math.max(1e-9, u));
}

/** What a flood of a greatness does to its floodplain: its harvest drowned, its people drowned, its stores wetted, its silt. */
export function floodHarm(size: number): {
  fields: number;
  dead: number;
  stores: number;
  silt: number;
} {
  return {
    fields: Math.min(FLOOD.fieldsMost, FLOOD.fields * size),
    dead: Math.min(FLOOD.deadMost, FLOOD.dead * size * size),
    stores: Math.min(0.6, FLOOD.stores * size),
    silt: Math.min(FLOOD.siltMost, FLOOD.silt * size),
  };
}
