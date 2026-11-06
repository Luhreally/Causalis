// The years as the page asks for them (A1): which years have something told, what each says, and what a
// run of years came to. See host/inspect/annals.ts for how a line is chosen.
import type { Line } from "./inspect.ts";

/** A line of a year: its kind (ANNAL_KINDS' place), how much it is worth a person's time, its words. */
export type AnnalLine = {
  readonly kind: number;
  readonly worth: number;
  readonly line: Line;
  /** What the whole line opens. */
  readonly ref: string;
};

export type AnnalYear = { readonly year: number; readonly lines: readonly AnnalLine[] };

/** Every year with something told, oldest first, each with a mask: a bit by kind, and ANNAL_ALL for all. */
export type AnnalsIndex = {
  readonly now: number;
  readonly years: readonly number[];
  readonly masks: readonly number[];
};

/** What a run of years came to. */
export type RunTold = {
  readonly from: number;
  readonly to: number;
  readonly years: number;
  readonly lines: readonly { readonly line: Line; readonly ref: string | null }[];
};

/** The kinds a line can be, in the order the filter shows them. */
export const ANNAL_KINDS = [
  { id: "wars", icon: "⚔️", name: "Wars", words: "Wars and falls" },
  { id: "firsts", icon: "💡", name: "Firsts", words: "Firsts and knowledge" },
  { id: "sorrows", icon: "🦠", name: "Sorrows", words: "Disasters and sickness" },
  { id: "people", icon: "👑", name: "People", words: "People and rulers" },
  { id: "stars", icon: "🌌", name: "Stars", words: "The stars" },
] as const;
/** The bit of a year's mask for a line a person with no filter would want. */
export const ANNAL_ALL = 1 << ANNAL_KINDS.length;
/** A line worth this much is told with no filter; a filter tells down to the second. */
export const ALL_WORTH = 4;
export const KIND_WORTH = 2;
/** Of a year: the most lines told with no filter, and under a filter. */
export const ALL_LINES = 3;
export const KIND_LINES = 4;
