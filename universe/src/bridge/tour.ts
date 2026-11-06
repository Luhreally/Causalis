// The age of the stars as the eye is shown it (Phase 73, first slice): the moments history holds on this seed, each with the film it plays
// and the page it stops at; the map's lenses, and what each says; who rides aboard a ship of a fight. Plain data, made by host/tour.ts,
// host/starlens.ts and host/crew.ts from what history already holds. None of it is kept or enters history.

/** The lenses of the stars around. One on at a time. */
export type StarLens = "holds" | "peoples" | "lanes" | "trade" | "war";

/** The film a moment plays, or the place it is seen. */
export type TourFilm =
  | { readonly kind: "jump" }
  | { readonly kind: "landing"; readonly cell: number }
  | { readonly kind: "landfall"; readonly star: string; readonly index: number; readonly n: number }
  | { readonly kind: "contact"; readonly star: string; readonly index: number }
  | { readonly kind: "port"; readonly cell: number }
  | { readonly kind: "map"; readonly lens: StarLens; readonly star: string }
  | { readonly kind: "fleet"; readonly id: string }
  | { readonly kind: "nation"; readonly ref: string }
  | { readonly kind: "world"; readonly star: string; readonly planet: number }
  | { readonly kind: "filled"; readonly key: string }
  | { readonly kind: "fire"; readonly event: string }
  | { readonly kind: "far"; readonly event: string };

/** One moment of the age, as it happened on this seed. */
export type TourStop = {
  /** Which it is, for a gate and for the order of a tie. */
  readonly key: string;
  readonly year: number;
  /** One line: what it is. */
  readonly words: string;
  /** Where to stop and read (null: it has no page). */
  readonly page: string | null;
  readonly film: TourFilm;
  /** The lens the map wears just before it. */
  readonly lens: StarLens | null;
};

export type StarTour = {
  readonly stops: readonly TourStop[];
  /** The lenses with something to say here, for the eye's round among the stars (none: this world has not come to the stars). */
  readonly lenses: readonly StarLens[];
};

export type StarLensRgb = readonly [number, number, number];

export type StarLensMark = {
  readonly star: string;
  readonly color: StarLensRgb;
  /** How large, against a realm's mark. */
  readonly scale: number;
};

/** A line on the map: from one star to another (null: the home star). */
export type StarLensLine = {
  readonly a: string | null;
  readonly b: string | null;
  readonly color: StarLensRgb;
};

/** What a colour on the map means. */
export type StarLensKey = { readonly color: StarLensRgb; readonly words: string };

export type StarLensMap = {
  readonly lens: StarLens;
  readonly year: number;
  readonly marks: readonly StarLensMark[];
  readonly lines: readonly StarLensLine[];
  readonly keys: readonly StarLensKey[];
  /** A line of plain words: how it stands, or why there is nothing to see. */
  readonly note: string | null;
};

/** One who sailed in a ship of a fight: a person of the town it sailed from, with their page (null: history names no one there). */
export type ShipCrew = {
  readonly name: string;
  readonly ref: string;
  readonly words: string;
};

