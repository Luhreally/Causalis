// What a people's bodies pass on, and what selects it (the breadth gaps, 2026-11-24: "heritable variation within a people",
// "coevolution"). A people's traits have a spread, part of it passed on; what its land kills its young by moves their mean a
// generation at a time by the breeder's equation, R = h²S: the response is the heritable share of the selection
// differential. rules/lineage.ts has it for the beasts; this is a people's, and two kinds selecting each other.
//
// A people on its land. What a land costs a body not made for it is a toll on its deaths (rules/demography.ts: the thin air
// of the heights, the cold on the ill-clothed; sim/population/systems.ts the heat past what a body sheds). Only the dead
// who had not yet borne are selected out: the toll on a life table's young (`youngHazard`, the hazard a young one lives
// through to bear) is the fitness it costs, `pressure` = hazard x toll x the share of the toll a body wholly taken to
// the land is spared. A trait a spread of which spares `1/most` of that is under a gradient of pressure/most a spread
// (Lande and Arnold), and its mean moves h² x that a generation: so a people takes to a land as fast as the land kills
// those who have not (`takenTo`), and not at all to a land that asks nothing. Once this was one authored pace, the same
// ten generations for every land and every trait (adaptedOf, kept for what it was).
//   Stature goes with the cold (Bergmann's rule, as the beasts': rules/lineage.ts SELECTION.sizeDegrees), as far as the
//     people have taken to their land's cold (`statureAsked`, `weightBy`).
//
// Two kinds selecting each other (`resistAfter`, `raceStep`):
//   A host and its sickness. Those of a people a sickness kills leave no more young; what spared the rest is the more
//     common after (one generation's selection on a thing that is there or is not: its variance is p(1 − p), so it
//     starts slowly, runs, and slows: `resistAfter`). The sickness's harm among hosts who resist it is the less, below
//     the harm that spreads it best (rules/pathogens.ts bestDeadliness), so it is selected back up: each one's trait
//     moves by the other's pressure (the Red Queen: Van Valen 1973).
//   A hunter and its prey. The prey's wariness and the hunter's keenness, in spreads: what the prey escapes goes as the
//     one against the other, each is selected by what it gains of that and held back by what its trait costs; the prey
//     runs for its life and the hunter for its dinner (Dawkins and Krebs 1979), so the prey keeps ahead (`raceStep`).
//     The two as made are already what their race has made them (`raceRest`: where neither gains by moving); what is kept
//     is how far each has since gone from that (`raceFrom`), so a kind no one presses does not move, and a prey a people's
//     hunt makes warier moves its hunter.
// Pure functions.
import { dmath } from "../kernel/index.ts";
import { SELECTION } from "./lineage.ts";
import { youngLost, type LifeHistory } from "./species.ts";

export const HEREDITY = {
  /**
   * How much of each trait's spread among a people is passed on (h², est from our own kind's twins and kin: stature the
   * most; what a body bears of cold, heat and thin air about two-fifths; what it resists of a sickness about a third).
   */
  heritability: { stature: 0.8, cold: 0.4, heat: 0.4, air: 0.4, sickness: 0.3 },
  /** Spreads from a people as made at which a body is wholly taken to what its land asks (rules/lineage.ts SELECTION.most). */
  most: SELECTION.most,
  /** Of a people a sickness has not yet tried, the share that happen to resist it (est: what is there before selection). */
  standing: 0.01,
  /** Of its harm, what one who resists a sickness is spared (est). */
  spared: 0.6,
  /** The prey's stake in a chase against the hunter's (its life against a dinner: est, some four to one). */
  life: 4,
  /** What a spread of wariness or keenness costs its bearer (of its fitness, a spread squared: time not feeding, a keener body's upkeep; est). */
  cost: 0.3,
  /** A hunter's keenness gone this far (spreads) from what it was made, by what its prey has become, is told. */
  raceTold: 0.25,
} as const;

export type PeopleTrait = keyof typeof HEREDITY.heritability;

/** The hazard a young one of a life table lives through to bear, at plenty: what selection can act through. */
export function youngHazard(life: LifeHistory): number {
  return -dmath.log(Math.max(1e-6, 1 - youngLost(life)));
}

/** The breeder's equation: the response of a trait's mean a generation, the heritable share of the selection differential. */
export function responseOf(heritability: number, selection: number): number {
  return dmath.clamp(heritability, 0, 1) * selection;
}

/**
 * What a land's toll asks of a body: the fitness a body not taken to it loses (`hazard` x `toll`, the share more of its
 * deaths, x `spared`, the share of that a body wholly taken to it is spared).
 */
export function landPressure(hazard: number, toll: number, spared: number): number {
  return Math.max(0, hazard) * Math.max(0, toll) * dmath.clamp(spared, 0, 1);
}

/**
 * How far a land's people have taken to what it asks (0 … 1), `generations` after they came: each generation's response
 * (h² x the selection differential, pressure/most a spread of unit variance) against the spreads that take to it wholly.
 */
export function takenTo(generations: number, heritability: number, pressure: number): number {
  if (!(generations > 0) || !(pressure > 0)) return 0;
  if (generations === Infinity) return 1;
  const most = HEREDITY.most;
  return dmath.clamp((generations * responseOf(heritability, pressure / most)) / most, 0, 1);
}

/**
 * The spreads of stature a land's cold has moved its people by (the colder the larger, Bergmann's rule as the beasts'),
 * as far as they have taken to its cold: `colder` its warmth below what their body was made for, °C.
 */
export function statureAsked(colder: number, taken: number): number {
  return (
    dmath.clamp(colder / SELECTION.sizeDegrees, -HEREDITY.most, HEREDITY.most) *
    dmath.clamp(taken, 0, 1)
  );
}

/** A body's weight against its people's as made, so many spreads of stature on (a spread a tenth of its weight, on its log). */
export function weightBy(spreads: number): number {
  return dmath.exp(SELECTION.sizePerSpread * spreads);
}

/**
 * The share of a people that resists a sickness after it killed `killed` of them (0 … 1 of those it burned among), where
 * `p` resisted before: those who resist die of it `spared` the less, and what is left is the more of them.
 */
export function resistAfter(p: number, killed: number, heritability = 1): number {
  const q = dmath.clamp(p, 0, 1),
    m = dmath.clamp(killed, 0, 0.95);
  if (!(m > 0) || q <= 0 || q >= 1) return q;
  // (Those who do not resist die at d, those who do at d·(1 − spared): in all, m = d·(1 − q·spared).)
  const d = Math.min(0.99, m / (1 - q * HEREDITY.spared)),
    after = (q * (1 - d * (1 - HEREDITY.spared))) / (1 - m);
  return dmath.clamp(q + responseOf(heritability, after - q), 0, 1);
}

/** A sickness's harm among hosts of whom `p` resist it, against its harm among hosts who do not (x). */
export function harmAmong(p: number): number {
  return 1 - HEREDITY.spared * dmath.clamp(p, 0, 1);
}

/**
 * A hunter and its prey, `generations` on (each its own): the prey's wariness `x` and the hunter's keenness `y`, in
 * spreads. What the prey escapes goes as 1/(1 + e^(y − x)); each is selected by what a spread more gains it of that (the
 * prey by `life` times the hunter's stake) less what its trait costs, by the breeder's equation with their heritabilities.
 * `met`: how much of the prey's dying the hunter is (0 … 1), and of the hunter's eating the prey.
 */
export function raceStep(
  x: number,
  y: number,
  preyGenerations: number,
  hunterGenerations: number,
  met = 1,
  heritability: number = SELECTION.heritability[2]!,
): { x: number; y: number } {
  const steps = Math.max(1, Math.min(40, Math.ceil(Math.max(preyGenerations, hunterGenerations)))),
    dx = Math.max(0, preyGenerations) / steps,
    dy = Math.max(0, hunterGenerations) / steps,
    m = dmath.clamp(met, 0, 1),
    most = HEREDITY.most;
  let px = x,
    hy = y;
  for (let i = 0; i < steps; i++) {
    const escape = 1 / (1 + dmath.exp(hy - px)),
      edge = escape * (1 - escape),
      gx = HEREDITY.life * m * edge - HEREDITY.cost * px,
      gy = m * edge - HEREDITY.cost * hy;
    px = dmath.clamp(px + dx * responseOf(heritability, gx), -most, most);
    hy = dmath.clamp(hy + dy * responseOf(heritability, gy), -most, most);
  }
  return { x: px, y: hy };
}

const RESTS = new Map<number, { x: number; y: number }>();
/**
 * Where a hunter and its prey stand when neither gains by moving, for how much they meet (to a hundredth): what each kind
 * as made already is, the prey's wariness the more by its stake.
 */
export function raceRest(met = 1): { readonly x: number; readonly y: number } {
  const m = Math.round(dmath.clamp(met, 0, 1) * 100);
  let r = RESTS.get(m);
  if (!r) {
    r = { x: 0, y: 0 };
    for (let i = 0; i < 60; i++) r = raceStep(r.x, r.y, 40, 40, m / 100);
    RESTS.set(m, r);
  }
  return r;
}

/**
 * A hunter and its prey `generations` on, each by how far it has gone from what it was made (spreads: the prey's wariness
 * `dx`, the hunter's keenness `dy`), from where they rest. The hunter is selected by what a spread more keenness gains it
 * of the prey as it now is, less what it costs; the prey by how much more (or less) a spread of wariness gains it against
 * the hunter as it now is than against the hunter as made (what else moves its wariness, and what holds it, is its own
 * selection's: rules/lineage.ts). Neither moves while neither is moved.
 */
export function raceFrom(
  dx: number,
  dy: number,
  preyGenerations: number,
  hunterGenerations: number,
  met = 1,
  heritability: number = SELECTION.heritability[2]!,
): { x: number; y: number } {
  const rest = raceRest(met),
    most = HEREDITY.most,
    m = dmath.clamp(met, 0, 1),
    steps = Math.max(1, Math.min(40, Math.ceil(Math.max(preyGenerations, hunterGenerations)))),
    sx = Math.max(0, preyGenerations) / steps,
    sy = Math.max(0, hunterGenerations) / steps,
    // (What a spread more of either gains at a gap between them: the slope of what the prey escapes.)
    edge = (gap: number) => {
      const escape = 1 / (1 + dmath.exp(gap));
      return escape * (1 - escape);
    };
  let x = dx,
    y = dy;
  for (let i = 0; i < steps; i++) {
    const gap = rest.y + y - (rest.x + x),
      gx = HEREDITY.life * m * (edge(gap) - edge(rest.y - (rest.x + x))),
      gy = m * edge(gap) - HEREDITY.cost * (rest.y + y);
    x = dmath.clamp(x + sx * responseOf(heritability, gx), -most, most);
    y = dmath.clamp(y + sy * responseOf(heritability, gy), -most, most);
  }
  return { x, y };
}
