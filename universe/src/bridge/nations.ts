// Realms among the stars, as the view reads them (Phase 72, first slice): who holds which star, and one realm's coming apart.
export type NationRgb = readonly [number, number, number];

export type NationRow = {
  readonly ref: string;
  readonly name: string;
  readonly color: NationRgb;
  readonly worlds: number;
  readonly people: number;
  readonly greatest: number;
  /** What a page calls it, read off who is held and how. */
  readonly word: string;
};

export type NationStar = {
  /** The star, the realm's row (-1: its own people), and how it stands. */
  readonly star: string;
  readonly nation: number;
  readonly seat: boolean;
  readonly dark: boolean;
};

export type NationMap = {
  readonly year: number;
  readonly nations: readonly NationRow[];
  readonly stars: readonly NationStar[];
  /** A realm come apart, the greatest of them, to watch (null: none yet). */
  readonly fallen: string | null;
};

export type NationFallWorld = {
  readonly star: string;
  readonly key: string;
  /** The year it came to the realm; the year it left (null: it is held yet). */
  readonly since: number;
  readonly left: number | null;
  readonly dark: boolean;
};

export type NationFall = {
  readonly ref: string;
  readonly name: string;
  readonly color: NationRgb;
  readonly greatest: number;
  readonly greatestYear: number;
  readonly fellYear: number | null;
  /** From when to when to watch it. */
  readonly from: number;
  readonly to: number;
  readonly worlds: readonly NationFallWorld[];
  /** A war history holds to take one back: its fight, to watch (null: no fleet was sent, or none has come). */
  readonly fleet: string | null;
  readonly fleetWords: string | null;
  /** What those cut off have lost, each in numbers. */
  readonly lost: readonly string[];
};

/** Where great news of a realm among the stars is to be seen. */
export type NationSight = {
  readonly nation: string | null;
  readonly key: string | null;
};
