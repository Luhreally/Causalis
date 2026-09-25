// Generation priors (docs/architecture §34): the ranges a universe's generators
// draw from. The Earth reference is not a special case in code — it is the
// `earthlike` prior (and, once calibrated, a seed found under it); alien worlds
// come from `open`. Both run through exactly the same generators.

/** A closed range [lo, hi] a generator draws uniformly from. */
export type Range = readonly [number, number];

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
};

export const PRIORS: Readonly<Record<string, Prior>> = { earthlike: EARTHLIKE, open: OPEN };
