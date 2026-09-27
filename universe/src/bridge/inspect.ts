// Every thing's page (Phase 10 M91, docs/architecture §31): what the host says of any ref —
// its title and icon, where it is to be seen, its headline numbers with what makes them
// and what explains them, and tabs of blocks. Every name in a page is a link to its own.

/** A run of words, or a name that opens its own page. */
export type Span = string | { readonly text: string; readonly ref: string };
/** A line: runs of words and names. */
export type Line = readonly Span[];

/** Where a thing is to be seen, for "go to it". */
export type Place =
  | { readonly scale: "globe"; readonly spot: number }
  | { readonly scale: "region"; readonly cell: number; readonly tile?: number }
  | {
      readonly scale: "village";
      readonly town: string;
      readonly person?: string;
      readonly household?: string;
    }
  | { readonly scale: "system"; readonly body?: number }
  | { readonly scale: "cluster"; readonly star: string }
  | { readonly scale: "galaxy"; readonly star: string }
  /** A body of the home star's system seen whole. */
  | { readonly scale: "body"; readonly index: number }
  /** A world of another star's, seen whole. */
  | { readonly scale: "world"; readonly star: string; readonly index: number };

/** One part of a number: what it is, and how much of the whole. */
export type Part = { readonly label: Line; readonly value: string };

/** A headline number (or word): what makes it, part by part, and the ref whose why explains it. */
export type Stat = {
  readonly label: string;
  readonly value: Line;
  readonly why?: string;
  readonly parts?: readonly Part[];
};

/** An entry of a list: its words, the page it opens, and the why that explains it. */
export type Item = {
  readonly line: Line;
  readonly ref?: string;
  readonly why?: string;
  readonly year?: number;
};

/** A row of a table: its cells, the page it opens, and what to sort each column by. */
export type Row = {
  readonly ref?: string;
  readonly cells: readonly Line[];
  readonly keys?: readonly (number | string)[];
};

export type Block =
  | { readonly type: "text"; readonly title?: string; readonly lines: readonly Line[] }
  | { readonly type: "facts"; readonly title?: string; readonly rows: readonly Stat[] }
  | {
      readonly type: "list";
      readonly title?: string;
      readonly items: readonly Item[];
      /** How many more there are than are listed. */
      readonly more?: number;
    }
  | {
      readonly type: "table";
      readonly title?: string;
      readonly columns: readonly string[];
      readonly rows: readonly Row[];
    }
  | {
      readonly type: "chart";
      readonly title: string;
      readonly points: readonly { readonly x: number; readonly y: number }[];
      readonly unit?: "people" | "share" | "price" | "count";
    }
  | { readonly type: "why"; readonly title?: string; readonly ref: string }
  /** Something to do (the god's acts, meeting a family, the hand): the page's tools draw it. */
  | {
      readonly type: "tool";
      readonly tool: string;
      readonly args: Readonly<Record<string, unknown>>;
    };

export type Tab = { readonly id: string; readonly name: string; readonly blocks: readonly Block[] };

export type PageKind =
  | "land"
  | "spot"
  | "town"
  | "household"
  | "person"
  | "memory"
  | "realm"
  | "relation"
  | "war"
  | "battle"
  | "starwar"
  | "faith"
  | "language"
  | "design"
  | "good"
  | "lineage"
  | "deposit"
  | "plate"
  | "age"
  | "star"
  | "planet"
  | "moon"
  | "colony"
  | "civilization"
  | "world"
  | "event"
  | "decision"
  | "act"
  | "agent"
  | "unknown";

export type PageModel = {
  readonly ref: string;
  readonly kind: PageKind;
  readonly icon: string;
  readonly title: string;
  readonly subtitle: Line;
  /** Its own colour, where it has one (a realm's, a faith's). */
  readonly color: readonly [number, number, number] | null;
  readonly place: Place | null;
  readonly stats: readonly Stat[];
  readonly tabs: readonly Tab[];
  /** The tab to open on, when the ref asked for was a part of the thing (a land's people). */
  readonly tab?: string;
  /** Whether it can be followed (its tidings told as they come). */
  readonly followable: boolean;
  /** The world's year it was read in. */
  readonly year: number;
};

/**
 * A page's ref and the tab it opens on: `war:0:3#attacker` opens the war's page on its
 * attacker's host.
 */
export function splitPageRef(ref: string): { ref: string; tab: string | null } {
  const i = ref.indexOf("#");
  return i < 0 ? { ref, tab: null } : { ref: ref.slice(0, i), tab: ref.slice(i + 1) };
}
