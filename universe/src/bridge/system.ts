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

/** Who has reached the sky, and the colonies set down on the system's bodies (Phase 5 M54). */
export type SkyState = {
  readonly programs: readonly {
    readonly realm: string;
    readonly name: string;
    readonly satellite: number | null;
    readonly crew: number | null;
    readonly station: number | null;
    readonly colonies: number;
  }[];
  readonly colonies: readonly {
    readonly cell: number;
    /** The body's index in the system plan, and which of its sites. */
    readonly body: number;
    readonly site: number;
    readonly people: number;
    /** Last month's food against need, thousandths. */
    readonly fed: number;
    /** The realm that rules it now (null: none), and the one that founded it. */
    readonly realm: string | null;
    readonly founder: string | null;
    readonly founded: number;
    readonly event: string | null;
  }[];
  /**
   * Fleets of war between the stars (M87): the realm that sent it and its enemy, the star it
   * sails for, when it sailed and arrives, and how its battle went (null: not yet fought).
   */
  readonly fleets?: readonly {
    readonly realm: string;
    readonly enemy: string;
    /** The two by their refs, and the fleet's strength (its counter's, Phase 11 M101). */
    readonly realmRef: string;
    readonly enemyRef: string;
    readonly strength: number;
    readonly star: string | null;
    readonly sailed: number;
    readonly arrives: number;
    readonly won: boolean | null;
    readonly event: string;
  }[];
  /** Ships to other stars, and the halls they founded there (Phase 6 M58–M59). */
  readonly ships?: readonly {
    readonly cell: number;
    readonly star: string;
    readonly distance: number;
    readonly departed: number;
    readonly arrives: number;
    readonly arrived: boolean;
    readonly people: number;
    readonly realm: string | null;
    readonly voyage: string;
  }[];
  /** The peoples of other stars (Phase 18 M133–M134): what each holds, its ships, whom it met. */
  readonly peoples?: PeoplesSky;
};

/** How the peoples of other stars stand among them, for the cluster's view (Phase 18 M134). */
export type PeoplesSky = {
  /** The home star's ref: where envoys to the home world sail. */
  readonly home: string;
  readonly civs: readonly {
    readonly ref: string;
    /** What it calls itself ("the Kaari"), and what it is ("trunked giants"). */
    readonly name: string;
    readonly kind: string;
    readonly star: string;
    /** Its colour among the stars. */
    readonly color: readonly [number, number, number];
    /** The year it came to the stars (in ours), and the stars it holds. */
    readonly stars: number;
    readonly holds: readonly {
      readonly star: string;
      readonly year: number;
      /** Taken from another people by its fleets. */
      readonly taken: boolean;
    }[];
  }[];
  readonly ships: readonly {
    readonly civ: string;
    readonly kind: "settlers" | "envoys" | "fleet";
    readonly from: string;
    readonly to: string;
    readonly sailed: number;
    readonly arrives: number;
    readonly event: string;
  }[];
  readonly meetings: readonly {
    readonly civ: string;
    /** Whom they met: a realm, a land of the home world with no realm, or another people. */
    readonly other: string;
    readonly with: "realm" | "land" | "people";
    readonly otherName: string;
    readonly star: string;
    readonly year: number;
    /** How each met the other: "wonder", "fear", "trade" or "war". */
    readonly theirs: string;
    readonly ours: string;
    /** How the two stand now (-1 … 1), and whether they can speak yet. */
    readonly regard: number;
    readonly talking: boolean;
    readonly exchanges: number;
    readonly raids: number;
    readonly last: number;
    readonly event: string;
  }[];
  readonly raids: readonly {
    readonly civ: string;
    readonly star: string;
    readonly year: number;
    readonly won: boolean;
    readonly taken: boolean;
    readonly event: string;
  }[];
  readonly landings: readonly {
    readonly civ: string;
    readonly cell: number;
    readonly year: number;
    readonly omen: boolean;
    readonly event: string;
  }[];
};

/** The stars within the cluster's reach of home (Phase 6 M56), each where it lies. */
export type ClusterStar = {
  readonly ref: string;
  /** Light-years from home: in the disk's plane (x, y) and above it (z). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly distance: number;
  readonly spectral: string;
  readonly mass: number;
  readonly luminosity: number;
  readonly temperature: number;
  readonly ageGyr: number;
  readonly remnant: boolean;
  /** Its worlds, and how many of them hold seas. */
  readonly planets: number;
  readonly seas: number;
};

export type ClusterPlan = {
  readonly radius: number;
  readonly stars: readonly ClusterStar[];
};

/** The galaxy's shape (M80): its disk's radius and scale length, its arms and their pitch, where home lies (ly, radians). */
export type GalaxyPlan = {
  readonly radius: number;
  readonly scale: number;
  readonly arms: number;
  readonly pitch: number;
  readonly homeRadius: number;
  readonly homeAngle: number;
};

/** One star's page: the star and its worlds. */
export type StarPage = ClusterStar & {
  readonly worlds: readonly {
    readonly kind: string;
    readonly a: number;
    readonly mass: number;
    readonly gravity: number;
    readonly temperature: number;
    readonly pressure: number;
    readonly air: string;
    readonly water: string;
  }[];
};
