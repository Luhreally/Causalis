// Generation priors (docs/architecture §34): the ranges a universe's generators
// draw from. The Earth reference is not a special case in code — it is the
// `earthlike` prior (and, once calibrated, a seed found under it); alien worlds
// come from `open`. Both run through exactly the same generators.

/** A closed range [lo, hi] a generator draws uniformly from. */
export type Range = readonly [number, number];

/** A template body of a prior: its orbit against the home world's, its mass, its kind. */
export type TemplateBody = {
  readonly a: Range;
  readonly mass: Range;
  readonly kind: "rocky" | "giant" | "ice giant";
  /** How rich in air-making volatiles, 0..1 (a shrouded hot world is rich). */
  readonly volatiles: Range;
  readonly moons: Range;
};

/** How the home star's other bodies are drawn (docs/architecture §24, Phase 5 M46). */
export type SystemPrior = {
  /** A fixed family of bodies (the Earthlike prior's Sun-like system), or null: drawn freely. */
  readonly template: readonly TemplateBody[] | null;
  /** Worlds inside the home world's orbit, and beyond it (when drawn freely). */
  readonly inner: Range;
  readonly outer: Range;
  /** Each orbit's ratio to the one inside it. */
  readonly spacing: Range;
  readonly homeMoons: Range;
};

export type Prior = {
  readonly name: string;
  readonly star: {
    /** Solar masses. */
    readonly mass: Range;
    /** Fraction of the star's main-sequence life already spent. */
    readonly age: Range;
  };
  readonly planet: {
    /** Earth masses. */
    readonly mass: Range;
    /** Where in the habitable zone the orbit lies: 0 its inner edge, 1 its outer. */
    readonly zone: Range;
    /** Axial tilt, degrees. */
    readonly tilt: Range;
    /** Length of a day, hours. */
    readonly day: Range;
    readonly oceanFraction: Range;
    /** Warming by the atmosphere, kelvin. */
    readonly greenhouse: Range;
    readonly albedo: Range;
    readonly plates: Range;
    /** Share of the surface with continental crust. */
    readonly continental: Range;
  };
  readonly system: SystemPrior;
};

export const EARTHLIKE: Prior = {
  name: "earthlike",
  star: { mass: [0.95, 1.05], age: [0.4, 0.55] },
  planet: {
    mass: [0.9, 1.1],
    zone: [0.06, 0.16],
    tilt: [20, 27],
    day: [21, 27],
    oceanFraction: [0.66, 0.74],
    greenhouse: [30, 36],
    albedo: [0.28, 0.32],
    plates: [10, 16],
    continental: [0.36, 0.42],
  },
  // A system like the Sun's: a small scorched world and a shrouded hot one inside, a
  // great moon, a small cold red world outside, two gas giants and two of ice.
  system: {
    template: [
      { a: [0.36, 0.42], mass: [0.04, 0.07], kind: "rocky", volatiles: [0, 0.05], moons: [0, 0] },
      { a: [0.68, 0.76], mass: [0.7, 0.9], kind: "rocky", volatiles: [0.9, 1], moons: [0, 0] },
      { a: [1.45, 1.6], mass: [0.09, 0.12], kind: "rocky", volatiles: [0.03, 0.05], moons: [1, 2] },
      { a: [5, 5.4], mass: [300, 330], kind: "giant", volatiles: [0, 1], moons: [4, 4] },
      { a: [9.2, 9.8], mass: [90, 100], kind: "giant", volatiles: [0, 1], moons: [3, 4] },
      { a: [18.5, 19.5], mass: [13, 16], kind: "ice giant", volatiles: [0, 1], moons: [2, 3] },
      { a: [29, 31], mass: [16, 18], kind: "ice giant", volatiles: [0, 1], moons: [1, 2] },
    ],
    inner: [2, 2],
    outer: [5, 5],
    spacing: [1.4, 1.9],
    homeMoons: [1, 1],
  },
};

export const OPEN: Prior = {
  name: "open",
  star: { mass: [0.35, 1.6], age: [0.1, 0.9] },
  planet: {
    mass: [0.3, 3],
    zone: [0, 1],
    tilt: [0, 60],
    day: [8, 80],
    oceanFraction: [0.1, 0.95],
    greenhouse: [5, 80],
    albedo: [0.2, 0.45],
    plates: [6, 20],
    continental: [0.15, 0.6],
  },
  system: { template: null, inner: [0, 3], outer: [2, 7], spacing: [1.4, 2.2], homeMoons: [0, 3] },
};

export const PRIORS: Readonly<Record<string, Prior>> = { earthlike: EARTHLIKE, open: OPEN };
