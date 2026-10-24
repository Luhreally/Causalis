// What a town builds (Phase 23, asked for 2026-10-24: "i cant see the cities form and evolve
// and get that type of detail i got from the og causalisis"): its homes, raised at a level —
// huts, houses, townhouses, tenements, blocks, high-rises — each holding so many and taking so
// long to raise; and its other buildings, each wanted once its land knows what it asks and the
// town is large enough for it, at the town's heart or at its edge as it stands then.

/** The levels a home is raised at. */
export const HOME_LEVELS = ["hut", "house", "townhouse", "tenement", "block", "high-rise"] as const;
export const LEVEL = {
  hut: 0,
  house: 1,
  townhouse: 2,
  tenement: 3,
  block: 4,
  highRise: 5,
} as const;
/** How many a home of each level holds. */
export const HOLDS: readonly number[] = [5, 6, 16, 48, 160, 600];
/** Months to raise a home of each level. */
export const HOME_MONTHS: readonly number[] = [1, 3, 8, 14, 24, 36];
/**
 * Years a home of each level stands before it is worn and rebuilt in its place: a hut a dozen, a
 * timber house fifty, a townhouse of stone a hundred and twenty, the tall ones of the machine
 * age less than a century.
 */
export const HOME_LIFE: readonly number[] = [12, 50, 120, 80, 70, 60];
/** Storeys of a home of each level. */
export const HOME_STOREYS: readonly number[] = [1, 1, 3, 5, 10, 24];

export type CivicKind =
  | "shrine"
  | "granary"
  | "kiln"
  | "smithy"
  | "market"
  | "mill"
  | "temple"
  | "hall"
  | "school"
  | "workshop"
  | "docks"
  | "academy"
  | "baths"
  | "observatory"
  | "hospital"
  | "factory"
  | "station"
  | "power"
  | "offices";

export type CivicDef = {
  readonly kind: CivicKind;
  /** In words: "a granary". */
  readonly name: string;
  /** What its land must know, every one ("a|b": either). */
  readonly needs: readonly string[];
  /** The fewest the town must hold. */
  readonly people: number;
  /** Only a market town (or a city) builds it. */
  readonly market?: true;
  /** Only a city. */
  readonly city?: true;
  /** Only where the land holds a faith. */
  readonly faith?: true;
  /** Only where a river or the sea is at hand. */
  readonly water?: true;
  /** At the town's heart (about its square), or at its edge as it stands when it is begun. */
  readonly place: "core" | "edge";
  /** Years to build. */
  readonly years: number;
  /** One for every so many of the town's people (else one), up to `most`. */
  readonly per?: number;
  readonly most?: number;
  /** What it takes the place of (a temple, the shrine it was). */
  readonly replaces?: CivicKind;
};

/** Every building a town raises besides its homes, the oldest crafts first. */
export const CIVICS: readonly CivicDef[] = [
  { kind: "shrine", name: "a shrine", needs: [], people: 40, faith: true, place: "core", years: 1 },
  {
    kind: "granary",
    name: "a granary",
    needs: ["granaries"],
    people: 120,
    place: "core",
    years: 2,
  },
  {
    kind: "kiln",
    name: "a potter's kiln",
    needs: ["pottery-wheel"],
    people: 150,
    place: "edge",
    years: 1,
  },
  { kind: "smithy", name: "a smithy", needs: ["bronze"], people: 200, place: "edge", years: 1 },
  {
    kind: "market",
    name: "a market hall",
    needs: [],
    people: 0,
    market: true,
    place: "core",
    years: 2,
  },
  {
    kind: "mill",
    name: "a mill",
    needs: ["mills"],
    people: 300,
    place: "edge",
    years: 2,
    per: 2500,
    most: 6,
  },
  {
    kind: "temple",
    name: "a temple",
    needs: ["masonry"],
    people: 600,
    faith: true,
    place: "core",
    years: 5,
    replaces: "shrine",
  },
  {
    kind: "hall",
    name: "a hall of law",
    needs: ["law-codes"],
    people: 800,
    market: true,
    place: "core",
    years: 3,
  },
  {
    kind: "school",
    name: "a school",
    needs: ["writing"],
    people: 500,
    place: "core",
    years: 2,
    per: 6000,
    most: 8,
  },
  {
    kind: "workshop",
    name: "a workshop",
    needs: ["carpentry"],
    people: 400,
    market: true,
    place: "edge",
    years: 1,
    per: 700,
    most: 16,
  },
  {
    kind: "docks",
    name: "docks",
    needs: ["shipbuilding"],
    people: 300,
    water: true,
    place: "edge",
    years: 3,
  },
  {
    kind: "academy",
    name: "an academy",
    needs: ["philosophy"],
    people: 2000,
    city: true,
    place: "core",
    years: 4,
  },
  {
    kind: "baths",
    name: "baths",
    needs: ["sanitation"],
    people: 1500,
    place: "core",
    years: 3,
    per: 10_000,
    most: 6,
  },
  {
    kind: "observatory",
    name: "an observatory",
    needs: ["astronomy", "mathematics"],
    people: 2500,
    city: true,
    place: "edge",
    years: 4,
  },
  {
    kind: "hospital",
    name: "a hospital",
    needs: ["medicine"],
    people: 3000,
    place: "core",
    years: 3,
    per: 20_000,
    most: 10,
  },
  {
    kind: "factory",
    name: "a factory",
    needs: ["factories"],
    people: 1500,
    place: "edge",
    years: 3,
    per: 5000,
    most: 30,
  },
  {
    kind: "station",
    name: "a railway station",
    needs: ["railways"],
    people: 2000,
    place: "edge",
    years: 3,
  },
  {
    kind: "power",
    name: "a power station",
    needs: ["electricity|sea-electricity"],
    people: 8000,
    place: "edge",
    years: 4,
    per: 80_000,
    most: 8,
  },
  {
    kind: "offices",
    name: "offices",
    needs: ["electricity|sea-electricity"],
    people: 15_000,
    city: true,
    place: "core",
    years: 4,
    per: 20_000,
    most: 40,
  },
];

export const CIVIC_INDEX: ReadonlyMap<CivicKind, number> = new Map(
  CIVICS.map((c, i) => [c.kind, i]),
);

/** A civic building's definition by kind. */
export function civic(kind: CivicKind): CivicDef {
  return CIVICS[CIVIC_INDEX.get(kind)!]!;
}

/** Years for a town's walls: a few, and more for a larger town to ring. */
export function wallYears(plots: number): number {
  return 3 + Math.ceil(Math.sqrt(plots) / 4);
}

/** What each of a town's other buildings is for, in a few words (its page says so). */
export const CIVIC_FOR: Readonly<Record<CivicKind, string>> = {
  shrine: "where the town brings its offerings to its gods",
  granary: "where the harvest is kept against lean years",
  kiln: "where the potters fire their pots",
  smithy: "where metal is worked into tools and arms",
  market: "where the land's goods are bought and sold under one roof",
  mill: "where grain is ground to flour",
  temple: "the house of the town's faith, raised in stone",
  hall: "where the law is kept and quarrels are heard",
  school: "where the young are taught their letters",
  workshop: "where crafters work side by side",
  docks: "where ships are loaded and unloaded",
  academy: "where the learned teach and dispute",
  baths: "where the town comes to wash",
  observatory: "where the sky is watched and reckoned",
  hospital: "where the sick are tended",
  factory: "where goods are made by machines",
  station: "where the railway stops",
  power: "where the town's electricity is made",
  offices: "where the town's business is done",
};

/** Each building's sign. */
export const CIVIC_ICON: Readonly<Record<CivicKind, string>> = {
  shrine: "⛩️",
  granary: "🌾",
  kiln: "🏺",
  smithy: "⚒️",
  market: "🏪",
  mill: "🌬️",
  temple: "🛕",
  hall: "🏛️",
  school: "🏫",
  workshop: "🔨",
  docks: "⚓",
  academy: "🎓",
  baths: "♨️",
  observatory: "🔭",
  hospital: "🏥",
  factory: "🏭",
  station: "🚉",
  power: "⚡",
  offices: "🏢",
};
