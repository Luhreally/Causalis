// The people bar and the history written out, as the page asks for them (B1). See host/bar.ts and host/inspect/written.ts.
import type { Line, Portrait } from "./inspect.ts";

/** How a reading stands, for its colour: nothing else is said by it. */
export type BarTone = "good" | "plain" | "poor" | "bad";

/** One reading of a person: a word or two for the bar, and the sentence their page says. */
export type BarReading = {
  readonly glyph: string;
  /** What this person holds in that place: "Mood", or where history keeps none, what it does keep. */
  readonly label: string;
  readonly short: string;
  readonly words: string;
  readonly tone: BarTone;
};

export type BarReadings = {
  readonly mood: BarReading;
  readonly doing: BarReading;
  readonly health: BarReading;
};

/** Why someone is on the bar. */
export type BarWhy =
  "pin" | "followed" | "ruler" | "greatest" | "plot" | "rival" | "heir" | "foe" | "news" | "elder";

export type BarPerson = {
  /** The same person: their page and their name. */
  readonly key: string;
  /** What pressing opens: their own page (or, for one gone, what became of them). */
  readonly ref: string;
  readonly name: string;
  readonly kind: BarWhy;
  readonly why: string;
  readonly pinned: boolean;
  readonly gone: boolean;
  /** The face their page shows; null: one history no longer draws. */
  readonly portrait: Portrait | null;
  readonly readings: BarReadings;
};

/** A person kept on the bar by the viewer: their page, and who it was when they were pinned. */
export type BarPin = { readonly ref: string; readonly name: string };

export type BarAsk = {
  readonly cell: number | null;
  readonly town: string | null;
  readonly pins: readonly BarPin[];
  readonly followed: readonly string[];
};

export type BarRead = {
  readonly year: number;
  readonly people: readonly BarPerson[];
};

/** A thing of the file: a page's own words, cut to what can be carried. */
export type WrittenEntry = {
  readonly ref: string;
  readonly title: string;
  readonly sub: Line;
  readonly rows: readonly { readonly label: string; readonly value: Line }[];
  readonly lists: readonly {
    readonly title: string;
    readonly items: readonly Line[];
    readonly more: number;
  }[];
};

export type WrittenYear = {
  readonly year: number;
  readonly lines: readonly Line[];
  /** The events it tells: a name elsewhere that opens one comes here. */
  readonly events: readonly string[];
};

/** What a world's history holds, and which of it goes in the file. */
export type WrittenIndex = {
  readonly title: string;
  readonly sub: string;
  readonly year: number;
  readonly realms: readonly string[];
  readonly wars: readonly string[];
  readonly people: readonly string[];
  readonly years: readonly number[];
  /** What was left out to keep it something a phone can carry, in sentences; the file says the same. */
  readonly left: readonly string[];
};

/** A slice of the file's reading. */
export type WrittenAsk =
  | { readonly kind: "realms" | "wars" | "people"; readonly refs: readonly string[] }
  | { readonly kind: "years"; readonly years: readonly number[] };
