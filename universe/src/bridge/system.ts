// The home star's system as the observatory reads it (Phase 5 M46): the star, and each
// planet and moon with its orbit's elements (the view places them at any time by
// Kepler's law) and the facts of its ground, each with its reasons.

export type SystemPlanBody = {
  readonly ref: string;
  readonly designation: string;
  readonly kind: "home" | "rocky" | "giant" | "ice giant" | "moon";
  /** The index of the body it circles, or -1 for the star. */
  readonly around: number;
  /** Orbit: AU about the star, thousands of km about a planet; eccentricity; radians; days. */
  readonly a: number;
  readonly e: number;
  readonly periapsis: number;
  readonly phase: number;
  readonly periodDays: number;
  readonly mass: number;
  readonly radius: number;
  readonly gravity: number;
  readonly escape: number;
  readonly temperature: number;
  readonly pressure: number;
  readonly air: string;
  readonly water: string;
  readonly radiation: number;
  readonly because: readonly string[];
};

export type SystemPlan = {
  readonly star: {
    readonly ref: string;
    readonly spectral: string;
    readonly mass: number;
    readonly luminosity: number;
    readonly temperature: number;
    readonly ageGyr: number;
  };
  readonly frostLine: number;
  readonly bodies: readonly SystemPlanBody[];
};
