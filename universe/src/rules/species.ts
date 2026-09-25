// Life histories and occupations (docs/architecture §15, §17). Phase 1 knows one
// species, human-like; Phase 4's biology grammar derives these numbers from a
// body plan instead. Rates are yearly and pre-modern: a total fertility near five,
// three children in ten dying before five, few living past seventy.

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
  /** Food a person eats in a year, in food units (1 = a person's need). */
  readonly appetite: number;
};

export const HUMANLIKE: LifeHistory = {
  name: "humanlike",
  bands: [0, 5, 10, 15, 20, 30, 40, 50, 60, 70],
  fertility: [0, 0, 0, 0.1, 0.22, 0.18, 0.06, 0, 0, 0],
  mortality: [0.07, 0.012, 0.007, 0.009, 0.012, 0.015, 0.02, 0.035, 0.07, 0.16],
  adulthood: 15,
  appetite: 1,
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

/** Width in years of each age band (the last is treated as ten years wide). */
export function bandWidth(band: number, life: LifeHistory = HUMANLIKE): number {
  const lo = life.bands[band]!,
    hi = life.bands[band + 1];
  return hi === undefined ? 10 : hi - lo;
}
