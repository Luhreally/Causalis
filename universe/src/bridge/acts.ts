// The god's acts as the globe plays them (Phase 12 M106): each act in force, or cast lately,
// where it falls — its kind (rain, a blight, a plague, fire on a town, war set between two
// realms…), the point of the globe it falls on (and for an act between two realms, the other's
// seat), a colour where it has one, how much of its time is left — and, for the god's palette,
// what a land is: whose, of what faith, its towns.

/** What plays where an act falls. */
export type ActKindShown =
  | "rain"
  | "drought"
  | "bounty"
  | "blight"
  | "plague"
  | "healing"
  | "inspiration"
  | "fire"
  | "spring"
  | "shrine"
  | "war"
  | "peace"
  | "friendship"
  | "discord"
  | "rising"
  | "conversion"
  | "quake"
  | "meteor"
  | "crater"
  | "flood"
  | "settle"
  | "union"
  | "bless"
  | "curse"
  | "ways"
  | "tongue"
  | "faith";

export type ActMark = {
  readonly kind: ActKindShown;
  /** Where it falls: a point of the unit globe (a land's middle, or a town). */
  readonly at: readonly [number, number, number];
  /** For an act between two realms: the other's seat. */
  readonly to: readonly [number, number, number] | null;
  /** Its colour, where it has one (a faith's, a realm's). */
  readonly color: readonly [number, number, number] | null;
  /** How much of its time is left (1 … 0): it fades as it ends. */
  readonly left: number;
  /** Its event (its page). */
  readonly event: string;
  /** The land it falls on (-1: none of one land), and the town, where it falls on one (Phase 30). */
  readonly cell: number;
  readonly town: string | null;
  /** When it was done, or began (the near views play a moment's act as it happens). */
  readonly from: number;
};

export type ActsMap = { readonly year: number; readonly acts: readonly ActMark[] };

/**
 * A land's sky (Phase 30 M162): what its weather is made from — its climate, this year's rain
 * against its usual, and the god's acts on it now — for the near views to play day by day.
 */
export type LandSky = {
  readonly cell: number;
  /** Its mean warmth (°C), half its yearly swing (°C), and its rain in a usual year (mm). */
  readonly warmth: number;
  readonly swing: number;
  readonly wet: number;
  /** This year's rain against its usual (1 as usual; below 0.72 a drought). */
  readonly year: number;
  /** The god's rain on it now: sent (1), withheld (-1), or neither (0). */
  readonly sent: 1 | 0 | -1;
  /** The god's acts on it now, as the globe plays them. */
  readonly acts: readonly ActMark[];
};

/** A land as the god's palette sees it: whose it is, its faith, its towns. */
export type PaletteLand = {
  readonly cell: number;
  readonly name: string;
  readonly people: number;
  readonly realm: {
    readonly ref: string;
    readonly name: string;
    readonly color: readonly [number, number, number];
    /** Its lands (for the palette to light them). */
    readonly lands: readonly number[];
    /** Whether this land is its seat. */
    readonly seat: boolean;
    /** The realms it is at war with. */
    readonly foes: readonly string[];
  } | null;
  readonly faith: {
    readonly ref: string;
    readonly name: string;
    readonly color: readonly [number, number, number];
  } | null;
  /** The tongue it speaks (Phase 14 M117). */
  readonly tongue: {
    readonly ref: string;
    readonly name: string;
    readonly color: readonly [number, number, number];
  } | null;
  /** Its towns, the greatest first: whether each is a city, has a shrine, a spring. */
  readonly towns: readonly {
    readonly ref: string;
    readonly name: string;
    readonly people: number;
    readonly city: boolean;
    readonly shrine: boolean;
    readonly spring: boolean;
  }[];
};
