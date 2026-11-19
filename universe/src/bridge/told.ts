// A year told (asked 2026-11-19: "whats a good way to like absorb everything thats going on like a summary of the year but quite
// detailed or enough where each year is distinct ... and like generative visuals if it can be light enough. and not just for the
// years but also for countries maybe?"): what one year of a world was, or of one realm in it, or a run of years, as its page asks
// for it. Read from what history already keeps when the page is opened, and from nothing else: host/inspect/told.ts.
import type { Line, PageArt, PageBanner } from "./inspect.ts";

type Rgb = readonly [number, number, number];

/** A line told: its words (names linked), what it opens (its happening, whose page tells why), and its year in a run of years. */
export type ToldItem = { readonly line: Line; readonly ref: string | null; readonly year?: number };

/** What a lead's picture is drawn of: a scene of the place or the sides (a page's banner), and what happened there over it. */
export type ToldMotif =
  | "battle"
  | "peace"
  | "fall"
  | "rise"
  | "crown"
  | "sickness"
  | "famine"
  | "woods"
  | "dig"
  | "fire"
  | "eruption"
  | "quake"
  | "flood"
  | "found"
  | "faith"
  | "coin"
  | "ship"
  | "star"
  | "beast"
  | "strife"
  | "quiet";

export type ToldVignette = {
  readonly motif: ToldMotif;
  readonly scene: PageBanner | null;
  /** What its small chances are drawn from (its happening's own number). */
  readonly key: number;
  /** The colours of those it names (realms'), the first the doer's. */
  readonly tints: readonly Rgb[];
};

/** What a year (or a run of them) is told by first: a headline, a few sentences, its picture, and the ways on from it. */
export type ToldLead = {
  readonly headline: string;
  readonly lines: readonly ToldItem[];
  readonly vignette: ToldVignette | null;
  /** What led to it, and what came of it, as far as history holds either. */
  readonly before: readonly ToldItem[];
  readonly after: readonly ToldItem[];
};

export type ToldSection = {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  /** A short paragraph: what was counted of it. */
  readonly text: Line;
  readonly items: readonly ToldItem[];
  /** How many more lines of it the Years hold. */
  readonly more: number;
};

/** One of the numbers that move: its value, how it stands against the year before and ten years before, and its last years. */
export type ToldFigure = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /** Against the year before, and ten years before: its words, and which way (0: as it was; null: not kept). */
  readonly year1: { readonly words: string; readonly way: -1 | 0 | 1 } | null;
  readonly year10: { readonly words: string; readonly way: -1 | 0 | 1 } | null;
  /** Whether more of it is good (1), bad (-1) or neither (0): how its change is lit. */
  readonly good: -1 | 0 | 1;
  /** Its years, oldest first, the last its own: each a year and what it then was. */
  readonly points: readonly { readonly x: number; readonly y: number }[];
  /** The page that tells more of it. */
  readonly ref?: string;
};

/** A world's lands as a flat map draws them: where each lies and what grows there. Asked once a world. */
export type ToldMapBase = {
  readonly key: string;
  /** Each land's east and north, in thousandths of a radian. */
  readonly lon: readonly number[];
  readonly lat: readonly number[];
  readonly biome: readonly number[];
  /** How far apart neighbouring lands lie, in radians. */
  readonly step: number;
};

export type ToldMark = {
  readonly kind: "battle" | "strike" | "sickness" | "famine" | "quake" | "fire" | "flood" | "town";
  readonly cell: number;
};

/** A year's map: who held each peopled land, what changed hands in it, and where its great things fell. */
export type ToldMap = {
  readonly base: string;
  readonly realms: readonly { readonly ref: string; readonly name: string; readonly color: Rgb }[];
  /** The lands held, and the realm of each (its place in `realms`). */
  readonly lands: readonly number[];
  readonly owner: readonly number[];
  /** The lands that came to a new realm in the year (hatched in its colour), and those that fell to no one. */
  readonly gained: readonly number[];
  readonly lost: readonly number[];
  readonly marks: readonly ToldMark[];
  /** A realm's year: its own lands, for the map to draw near. */
  readonly focus?: readonly number[];
  /** What its marks mean, in the order drawn. */
  readonly legend: readonly { readonly kind: string; readonly words: string }[];
  /** Said under it where its borders are remembered only roughly. */
  readonly note?: string;
};

export type YearTold = {
  /** The year told, or a run's first and last. */
  readonly year: number;
  readonly to: number;
  readonly now: number;
  /** The first year anything is told of. */
  readonly first: number;
  readonly subject: { readonly ref: string; readonly name: string; readonly color: Rgb } | null;
  /** Over its headline: "Year 1,204", "1,200 to 1,209". */
  readonly kicker: string;
  readonly leads: readonly ToldLead[];
  /** A run of years: each year's own headline, the greatest first, each a way to that year. */
  readonly years: readonly {
    readonly year: number;
    readonly headline: string;
    readonly worth: number;
  }[];
  readonly sections: readonly ToldSection[];
  readonly figures: readonly ToldFigure[];
  readonly map: ToldMap | null;
  /** Said plainly where less is remembered of it than of a year lately lived. */
  readonly less: Line | null;
  /** The world its pictures are drawn in the colours of. */
  readonly art: PageArt["world"] | null;
  /** How long it took to read (ms), for a gate to weigh. */
  readonly ms: number;
};
