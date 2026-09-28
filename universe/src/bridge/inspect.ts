import type { Arms } from "./arms.ts";
import type { BeastPlan, VillagePlan } from "./village.ts";

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
  /** The concept it is a measure of (its page in the book of concepts, M97). */
  readonly concept?: string;
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
  /** Several things' numbers on one chart through the years, each its own colour, its name a link. */
  | {
      readonly type: "lines";
      readonly title: string;
      readonly series: readonly {
        readonly name: string;
        readonly ref?: string;
        readonly color: Rgb;
        readonly points: readonly { readonly x: number; readonly y: number }[];
      }[];
      readonly unit?: "people" | "share" | "price" | "count";
      /** Each line on a small chart of its own scale, side by side (their sizes far apart). */
      readonly apart?: boolean;
    }
  /** Things side by side as bars: each its name (a link), its amount, its colour. */
  | {
      readonly type: "bars";
      readonly title: string;
      readonly bars: readonly {
        readonly label: Line;
        readonly ref?: string;
        readonly value: number;
        readonly color?: Rgb;
      }[];
      readonly unit?: "people" | "share" | "price" | "count";
    }
  /**
   * What something is made of (Phase 15 M122): its parts as one bar of their shares, then each
   * part — its name (a link to its page), its share, and how much of it there is, with its unit.
   */
  | {
      readonly type: "composition";
      readonly title?: string;
      readonly parts: readonly {
        readonly name: Line;
        readonly share: number;
        /** How much, in words with its unit ("1.2 t", "340 g"). */
        readonly amount?: string;
        readonly color: Rgb;
      }[];
      /** A line under it: what it is of, or what it is measured against. */
      readonly note?: string;
    }
  /**
   * A store's year as a flow (Phase 15 M123): what it began with, each line in (+) or out (−),
   * what it ended with — and whether they balance, as every change to a stock must.
   */
  | {
      readonly type: "flow";
      readonly title: string;
      readonly opening: number;
      readonly rows: readonly {
        readonly label: Line;
        readonly value: number;
        readonly sign: 1 | -1;
      }[];
      readonly closing: number;
      /** Its last line's words ("Ended with"; a year not yet over, "Stands at"). */
      readonly closingWords?: string;
      /** What is counted ("grain"). */
      readonly unit?: string;
      readonly balanced: boolean;
    }
  /** What someone is like, as chips that open their pages (Phase 14 M118): a person's traits. */
  | {
      readonly type: "chips";
      readonly title?: string;
      readonly chips: readonly {
        readonly icon: string;
        readonly name: string;
        readonly ref: string | null;
        /** What it means, for its tooltip. */
        readonly words?: string;
      }[];
    }
  /** A family's tree (Phase 14 M118): its generations, the eldest first, each its people. */
  | {
      readonly type: "tree";
      readonly title: string;
      readonly rows: readonly {
        /** The generation's word: "Grandparents", "Parents", "Children". */
        readonly label: string;
        readonly people: readonly {
          readonly name: Line;
          /** A few words: their age and work, or when they lived. */
          readonly note: string;
          readonly woman: boolean;
          /** The one whose tree it is. */
          readonly self?: boolean;
          readonly dead?: boolean;
        }[];
      }[];
    }
  /** Things through the years: each a bar from its beginning to its end (or on to now). */
  | {
      readonly type: "timeline";
      readonly title: string;
      readonly from: number;
      readonly to: number;
      readonly rows: readonly {
        readonly label: Line;
        readonly ref?: string;
        readonly from: number;
        /** Its end, or null while it lasts. */
        readonly to: number | null;
        readonly color?: Rgb;
        /** A word on it (its lands, its fallen). */
        readonly words?: string;
      }[];
    }
  /**
   * Two sides set against each other (Phase 11 M103): each row's two amounts pulled apart in a
   * bar, each side's words at its end — two realms side by side, a war's tally.
   */
  | {
      readonly type: "tally";
      readonly title?: string;
      readonly sides: readonly [
        { readonly name: Line; readonly color: Rgb },
        { readonly name: Line; readonly color: Rgb },
      ];
      readonly rows: readonly {
        readonly label: string;
        readonly a: number;
        readonly b: number;
        readonly words: readonly [string, string];
      }[];
    }
  | { readonly type: "why"; readonly title?: string; readonly ref: string }
  /** The page's picture large, with what it is made of named (a lineage's anatomy). */
  | { readonly type: "anatomy"; readonly title?: string }
  /** Something to do (the god's acts, meeting a family, the hand): the page's tools draw it. */
  | {
      readonly type: "tool";
      readonly tool: string;
      readonly args: Readonly<Record<string, unknown>>;
    };

export type Tab = { readonly id: string; readonly name: string; readonly blocks: readonly Block[] };

type Rgb = readonly [number, number, number];

/**
 * What a page's picture shows (Phase 10 M93b), drawn from the same plans as the scenes: a
 * lineage's body, a person's figure in their clothes with their tools and hair, a town's
 * houses, a world, a star's light, a realm's flag (a war's two), a faith's sign.
 */
export type Portrait =
  | {
      readonly kind: "creature";
      readonly body: BeastPlan;
      readonly name: string;
      readonly wool: boolean;
    }
  | {
      readonly kind: "person";
      readonly ref: string;
      readonly age: number;
      readonly span: number;
      readonly occupation: number;
      readonly child: boolean;
      readonly era: NonNullable<VillagePlan["era"]>;
      readonly body: VillagePlan["body"];
    }
  | {
      readonly kind: "town";
      readonly house: VillagePlan["house"];
      readonly homes: number;
      readonly city: boolean;
      readonly key: number;
    }
  | {
      readonly kind: "world";
      readonly look: "home" | "rocky" | "giant" | "ice giant" | "moon";
      /** Its seas' share of its face, its ice's, how green its land (0 … 1). */
      readonly sea: number;
      readonly ice: number;
      readonly green: number;
      readonly air: boolean;
      readonly key: number;
    }
  | {
      readonly kind: "star";
      readonly temperature: number;
      readonly luminosity: number;
      readonly remnant: boolean;
    }
  | {
      readonly kind: "flag";
      readonly flags: readonly { readonly color: Rgb; readonly key: number }[];
    }
  | { readonly kind: "sign"; readonly color: Rgb; readonly tenet: string }
  /** A realm's arms (Phase 11 M102); a war's, its two sides' face to face. */
  | { readonly kind: "arms"; readonly arms: readonly Arms[] };

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
  /** The world's own: its chronicle, its ledger, the message log; and the book of concepts. */
  | "chronicle"
  | "ledger"
  | "stats"
  | "log"
  | "compare"
  | "concept"
  | "trait"
  /** Matter (Phase 15 M122): a substance, a reaction, a principle, a good the world over. */
  | "substance"
  | "reaction"
  | "principle"
  | "goods"
  | "unknown";

export type PageModel = {
  readonly ref: string;
  readonly kind: PageKind;
  readonly icon: string;
  readonly title: string;
  readonly subtitle: Line;
  /** The way up to it (the world, its realm, its land, its town…): each step a link. */
  readonly crumbs?: Line;
  /** Its own colour, where it has one (a realm's, a faith's). */
  readonly color: readonly [number, number, number] | null;
  /** Its picture, where it has one. */
  readonly portrait?: Portrait;
  readonly place: Place | null;
  readonly stats: readonly Stat[];
  readonly tabs: readonly Tab[];
  /** The tab to open on, when the ref asked for was a part of the thing (a land's people). */
  readonly tab?: string;
  /** Whether it can be followed (its tidings told as they come). */
  readonly followable: boolean;
  /** The world's year it was read in. */
  readonly year: number;
  /** How often (ms) it is worth reading again as the world runs, when not the usual. */
  readonly every?: number;
};

/** A thing in a few words, for a tooltip: its icon, name, a line and its first numbers. */
export type Tip = {
  readonly ref: string;
  readonly icon: string;
  readonly title: string;
  readonly line: string;
  readonly stats: readonly { readonly label: string; readonly value: string }[];
};

/**
 * An alert (Phase 10 M96): something that stands now and asks to be looked at, as a grand
 * strategy game's alerts ask — a realm followed at war, a land followed going hungry, a life
 * followed ended, a realm followed fallen, a first in the world.
 */
export type Alert = {
  readonly id: "war" | "hunger" | "death" | "fallen" | "first";
  readonly icon: string;
  readonly title: string;
  /** How it is lit: war red, want amber, loss grey, news cyan. */
  readonly tone: "war" | "want" | "loss" | "news";
  /** Each case of it: its words (names linked), the page it opens, and the key it is put by with. */
  readonly items: readonly { readonly line: Line; readonly ref: string; readonly key: string }[];
};

/** An answer the god's hand may give to a great happening (Phase 11 M100): its words, and the act it sends. */
export type Answer = {
  readonly label: string;
  readonly act: string;
  readonly args: Readonly<Record<string, unknown>>;
};

/** What one of the top bar's numbers is made of (Phase 10 M97): its greatest parts, each a line. */
export type Breakdown = {
  readonly title: string;
  readonly lines: readonly Line[];
  /** Beyond the lines: how many more, in words. */
  readonly more?: string;
};

/**
 * A page's ref and the tab it opens on: `war:0:3#attacker` opens the war's page on its
 * attacker's host.
 */
export function splitPageRef(ref: string): { ref: string; tab: string | null } {
  const i = ref.indexOf("#");
  return i < 0 ? { ref, tab: null } : { ref: ref.slice(0, i), tab: ref.slice(i + 1) };
}
