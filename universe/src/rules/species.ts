// Life histories and occupations (docs/architecture §15, §17). The upright apes'
// table is Earth's; any other people's is derived from its body (Phase 4 M37,
// `lifeHistoryOf`). Rates are yearly and pre-modern — a total fertility near five,
// four children in ten dying before fifteen, few living past seventy — with time
// compressed as the chronicle compresses it (bands to iron in centuries, not
// millennia): at plenty a people grows about three-quarters of a hundredth a year.

import { dmath } from "../kernel/index.ts";
import { affordancesOf, type BodyPlan } from "./bodies.ts";

export type LifeHistory = {
  readonly name: string;
  /** Lower edge of each age band, in years; the last band is open-ended. */
  readonly bands: readonly number[];
  /** Births per woman per year in each band, at plenty. */
  readonly fertility: readonly number[];
  /** Chance of dying within a year in each band, at plenty. */
  readonly mortality: readonly number[];
  /** Age at which a child takes up an occupation. */
  readonly adulthood: number;
  /** Food a person eats, against an upright ape (1: a unit a month). */
  readonly appetite: number;
  /** How wide the last, open-ended band is taken to be, in years. */
  readonly oldest: number;
};

export const HUMANLIKE: LifeHistory = {
  name: "humanlike",
  bands: [0, 5, 10, 15, 20, 30, 40, 50, 60, 70],
  fertility: [0, 0, 0, 0.1, 0.22, 0.18, 0.06, 0, 0, 0],
  mortality: [0.085, 0.015, 0.008, 0.01, 0.014, 0.018, 0.024, 0.04, 0.075, 0.16],
  adulthood: 15,
  appetite: 1,
  oldest: 10,
};

export const BANDS = HUMANLIKE.bands.length;
export const SEXES = 2;
export const FEMALE = 0;
export const MALE = 1;

/** How people live. Children are dependents until adulthood. */
export const OCCUPATIONS = [
  "dependent",
  "forager",
  "farmer",
  "herder",
  "crafter",
  "trader",
  "leader",
] as const;
export type Occupation = (typeof OCCUPATIONS)[number];
export const OCC = {
  dependent: 0,
  forager: 1,
  farmer: 2,
  herder: 3,
  crafter: 4,
  trader: 5,
  leader: 6,
} as const;

/** Food a worker of each occupation brings in a year when land allows (dependents: none). */
// A worker must feed their dependents too: about 1.6 people in a young society.
export const PRODUCTIVITY: readonly number[] = [0, 2.0, 3.2, 2.4, 0, 0, 0];

/** Width in years of each age band (the last as its life history says). */
export function bandWidth(band: number, life: LifeHistory = HUMANLIKE): number {
  const lo = life.bands[band]!,
    hi = life.bands[band + 1];
  return hi === undefined ? life.oldest : hi - lo;
}

/** The band an age falls in, by a life history's bands. */
export function bandOf(age: number, life: LifeHistory = HUMANLIKE): number {
  let b = 0;
  while (b + 1 < life.bands.length && life.bands[b + 1]! <= age) b++;
  return b;
}

/**
 * A people's life table from its body: the upright apes' table stretched to the body's
 * span (bands, coming of age and yearly rates alike); fertility by its fecundity, with
 * the young's first years the more perilous as more are born, so that a people at
 * plenty still about renews itself at the apes' pace for its span; appetite by its
 * size (three-quarters of a power, as life's metabolism scales) and halved for cold
 * blood. The canonical upright ape's is Earth's table itself.
 */
export function lifeHistoryOf(body: BodyPlan): LifeHistory {
  if (body.clade === "ape" && body.span === 70 && body.size === 60 && body.young === 1)
    return HUMANLIKE;
  const k = body.span / 70,
    f = affordancesOf(body).fecundity,
    bands: number[] = [];
  for (const b of HUMANLIKE.bands)
    bands.push(Math.max(bands.length ? bands.at(-1)! + 1 : 0, Math.round(b * k)));
  // The first years: the apes' share surviving them, divided among f times the young.
  // (Survivors leave a band a width-th a year, so a year's survival q gives a share
  // (q / w) / (1 − q (1 − 1/w)) through it; solved for q.)
  const through = (q: number, w: number) => q / w / (1 - q * (1 - 1 / w)),
    w0 = bands[1]! - bands[0]!,
    target = through(1 - HUMANLIKE.mortality[0]!, 5) / Math.max(1, f),
    infant = 1 - target / (1 / w0 + target * (1 - 1 / w0));
  return {
    name: body.clade,
    bands,
    fertility: HUMANLIKE.fertility.map((x) => (x * f) / k),
    mortality: HUMANLIKE.mortality.map((x, i) =>
      i === 0 ? (f > 1 ? infant : x / k) : Math.min(0.95, x / k),
    ),
    adulthood: Math.max(1, Math.round(HUMANLIKE.adulthood * k)),
    appetite: dmath.pow(body.size / 60, 0.75) * (body.warm ? 1 : 0.5),
    oldest: Math.max(1, Math.round(10 * k)),
  };
}
