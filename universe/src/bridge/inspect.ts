import type { Arms } from "./arms.ts";
import type { BeastPlan, VillagePlan } from "./village.ts";
import type { WoundLook, WoundMember } from "./wounds.ts";
import type { MemberState } from "./body.ts";

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
  /** A small picture beside it (Phase 54 M223): the stone, the ore, the metal, the tool itself. */
  readonly thumb?: Portrait;
};

/** A row of a table: its cells, the page it opens, and what to sort each column by. */
export type Row = {
  readonly ref?: string;
  readonly cells: readonly Line[];
  readonly keys?: readonly (number | string)[];
  /** A small picture at the row's start (Phase 54 M223). */
  readonly thumb?: Portrait;
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
  /**
   * A tree of life (Phase 17 M129): lines of descent through time, each a bar from when it
   * arose to its end, hung from its mother's bar where it branched off.
   */
  | {
      readonly type: "phylo";
      readonly title?: string;
      /** The chart's span, millions of years ago: its oldest moment, and now (0). */
      readonly from: number;
      readonly to: number;
      /** Where the chart's scale turns from the dawn's long ages to the near ones (My ago). */
      readonly fold?: number;
      readonly lines: readonly PhyloLine[];
      /** The line whose page it is, lit with its ancestry. */
      readonly focus?: number;
    }
  /**
   * Bodies in a row (Phase 17 M129): a line of descent, each its picture, its name and a few
   * words — or, `apart`, bodies side by side that are no line (no arrows between them).
   */
  | {
      readonly type: "lineup";
      readonly title?: string;
      readonly apart?: boolean;
      readonly items: readonly {
        readonly ref: string;
        readonly name: string;
        readonly body: BeastPlan | null;
        /** Its sign where it has no body to draw (a cell, a plant, the people). */
        readonly icon?: string;
        readonly words: string;
        readonly self?: boolean;
      }[];
    }
  /**
   * A drop under the glass (Phase 17 M131, the smallest scale): a place's water — or its wet
   * soil — as a microscope shows it, its small lives moving, eating and dividing, each kind a
   * line of the tree of life. The view runs it; the same seed shows the same lives.
   */
  | {
      readonly type: "drop";
      readonly title?: string;
      readonly habitat: "sea" | "fresh" | "soil" | "ice";
      readonly seed: number;
      /** How much light reaches it (0 … 1), how warm it is (°C), how much food is in it (0 … 1). */
      readonly light: number;
      readonly warmth: number;
      readonly food: number;
      readonly kinds: readonly DropKind[];
      /** The kind whose page it is (most of the drop, and named first). */
      readonly focus?: string;
      readonly words?: string;
    }
  | { readonly type: "why"; readonly title?: string; readonly ref: string }
  /**
   * A thread back to the beginning (Phase 36 M182): from a life, a town or a land, each step a
   * scale further back — the town, the land, the people, their line, life's dawn, the world, its
   * galaxy — its sign, its scale, when, its words (each name a link), and the page it opens.
   */
  | {
      readonly type: "thread";
      readonly title?: string;
      readonly steps: readonly {
        readonly icon: string;
        readonly scale: string;
        readonly when: string;
        readonly line: Line;
        readonly ref?: string;
      }[];
    }
  /** The page's picture large, with what it is made of named (a lineage's anatomy). */
  | { readonly type: "anatomy"; readonly title?: string }
  /**
   * A person's body drawn whole (Phase 55 wave 5): their figure in their people's look, each
   * member of their people's plan marked as it is — struck, healing, scarred, lame, lost (drawn
   * gone), the blow that killed — and told.
   */
  | {
      readonly type: "body";
      readonly title?: string;
      readonly person: Extract<Portrait, { kind: "person" }>;
      readonly members: readonly {
        readonly member: WoundMember;
        /** Its name, theirs ("his left hand"). */
        readonly words: string;
        readonly state: MemberState;
      }[];
    }
  /** Something to do (the god's acts, meeting a family, the hand): the page's tools draw it. */
  | {
      readonly type: "tool";
      readonly tool: string;
      readonly args: Readonly<Record<string, unknown>>;
    };

/** A kind of small life in a drop: what it is called there, its line, how it lives. */
export type DropKind = {
  readonly ref: string;
  /** What it is called in the drop ("small cells"), and the line of the tree it is of. */
  readonly name: string;
  readonly line: string;
  /** How it lives: by what floats in the water, by light, by taking in other cells; or many cells as one. */
  readonly way: "eater" | "light" | "hunter" | "colony";
  readonly color: Rgb;
  /** Its size across, micrometres. */
  readonly size: number;
  /** Its share of the drop's lives at the start. */
  readonly share: number;
};

/** A line of a tree of life, as the chart draws it. */
export type PhyloLine = {
  readonly id: number;
  /** Its mother line (-1: the root, or a mother not shown). */
  readonly parent: number;
  readonly ref: string;
  readonly name: string;
  /** When it arose and where its bar ends, millions of years ago (0: now). */
  readonly from: number;
  readonly end: number;
  /** It lives (its bar runs to now), it died out (a cross at its end), or it lives on in its daughters. */
  readonly fate: "lives" | "died" | "line";
  readonly color: Rgb;
  /** What it was, in a few words. */
  readonly words?: string;
};

export type Tab = { readonly id: string; readonly name: string; readonly blocks: readonly Block[] };

type Rgb = readonly [number, number, number];

/**
 * How a substance's crystals or grains grow (Phase 54 M223), and so how its specimen is cut: salt
 * and galena in cubes, magnetite in octahedra, garnet in dodecahedra, quartz in six-sided prisms
 * capped by points, calcite in rhombs, malachite in rounded grapes, native copper in branching
 * dendrites, gold in nuggets, flint in nodules and obsidian broken in shells.
 */
export type Habit =
  | "cubic"
  | "octahedral"
  | "dodecahedral"
  | "tetrahedral"
  | "hexagonal"
  | "rhombic"
  | "prismatic"
  | "bladed"
  | "acicular"
  | "platy"
  | "botryoidal"
  | "dendritic"
  | "nugget"
  | "nodular"
  | "conchoidal"
  | "earthy"
  | "massive"
  | "fibrous"
  | "granular";

/** What a portion of a substance is shown as: a crystal, a lump, a bar, a heap, in a flask… */
export type MatterForm =
  | "crystal"
  | "lump"
  | "ingot"
  | "powder"
  | "liquid"
  | "gas"
  | "glass"
  | "fibre"
  | "sheet"
  | "flesh";

/** How its face takes the light. */
export type Lustre =
  | "metallic"
  | "submetallic"
  | "adamantine"
  | "vitreous"
  | "resinous"
  | "waxy"
  | "greasy"
  | "pearly"
  | "silky"
  | "dull";

/** How a made thing was made, which says how it is drawn: flaked, hammered, poured, thrown… */
export type MadeHow =
  "knapped" | "forged" | "cast" | "thrown" | "woven" | "sewn" | "machined" | "carved" | "grown";

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
      /** How their wounds show now (Phase 55 M226; absent: none). */
      readonly look?: WoundLook;
    }
  | {
      readonly kind: "town";
      readonly house: VillagePlan["house"];
      readonly homes: number;
      readonly city: boolean;
      readonly key: number;
      /** Its world's life's colours, for its turf roofs (Phase 57; absent: Earth's green). */
      readonly lifeLook?: string;
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
      /** What grows on the home world, in its life's colours (Phase 57; absent: Earth's green). */
      readonly lifeLook?: string;
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
  | { readonly kind: "arms"; readonly arms: readonly Arms[] }
  /**
   * A substance as a specimen (Phase 54 M223): cut as it grows, coloured and lit as it shines,
   * light passing through it as clear as it is; a metal as a bar, a liquid in its flask, a gas in
   * its glass. `key` turns and jitters it, the same each time.
   */
  | {
      readonly kind: "matter";
      readonly form: MatterForm;
      readonly habit: Habit | null;
      readonly color: Rgb;
      readonly lustre: Lustre;
      /** How much light passes through it (0 opaque … 1 clear as glass). */
      readonly clarity: number;
      /** Mohs, where it has one: the harder, the crisper its edges. */
      readonly hardness: number | null;
      readonly key: number;
    }
  /**
   * An element as it stands pure (Phase 54 M223): a metal's bar, a gas glowing in its sealed glass,
   * sulphur's yellow crystals, carbon's black, sodium kept under oil.
   */
  | {
      readonly kind: "element";
      readonly symbol: string;
      readonly state: "solid" | "liquid" | "gas";
      readonly sort: "metal" | "metalloid" | "nonmetal" | "noble";
      readonly color: Rgb;
      /** Kept under oil: it burns in the air. */
      readonly kept: boolean;
      readonly key: number;
    }
  /**
   * A made thing (Phase 54 M223): a tool, an arm, a pot, a garment, a machine's part — its shape by
   * its `form` ("axe", "sickle", "storage jar", "rifle", "tunic"), drawn as it was made of its stuff:
   * a flint head flaked, a bronze one cast and ground, iron hammered dark, a pot thrown and fired.
   */
  | {
      readonly kind: "thing";
      readonly form: string;
      readonly made: MadeHow;
      readonly color: Rgb;
      readonly lustre: Lustre;
      /** Its haft, stock or handle, where it has one. */
      readonly haft: Rgb | null;
      /** 0 … 100: the finer, the truer its lines. */
      readonly quality: number;
      /** 0 … 1: how worn it is (nicks, dulled shine, a darker haft). */
      readonly worn: number;
      readonly key: number;
    };

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
  /** An element (Phase 54 M223): what it is, where it is found, what holds it. */
  | "element"
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
  /** A thing someone holds (Phase 15 M125): a tool, a garment, a pot. */
  | "thing"
  /** The field guide to matter (`world:matter`). */
  | "matter"
  /** The tree of life (`world:tree`), and a line of it no living lineage is (Phase 17). */
  | "tree"
  | "clade"
  /** A sickness (Phase 20 M140). */
  | "sickness"
  /** A house of lending (Phase 21 M143). */
  | "house"
  /** A lot of a town, one of its other buildings, its walls (Phase 25 M151). */
  | "lot"
  | "building"
  | "walls"
  /** A band's camp on its land (Phase 28 M159). */
  | "camp"
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
  readonly id:
    "war" | "hunger" | "order" | "sickness" | "credit" | "strife" | "death" | "fallen" | "first";
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

/**
 * A world's stage (Phase 31 M167, asked for 2026-10-24: "every stage like spore"): what its peoples
 * have come to — bands, villages, realms, cities, writing, iron, engines, electricity, orbit, other
 * worlds — the one reached
 * last in that order, and each with the year it was first reached and where (null: not yet).
 */
export type WorldStage = {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly stages: readonly {
    readonly id: string;
    readonly icon: string;
    readonly name: string;
    /** What first made it so, as the chronicle's firsts name it ("🏙️ A city"). */
    readonly first: string | null;
    readonly year: number | null;
    readonly land: number | null;
    readonly ref: string | null;
  }[];
};

/** A first in the world, as the chronicle tells them: what, when, where, and its happening. */
export type WorldFirst = {
  readonly what: string;
  readonly year: number;
  readonly land: number | null;
  readonly ref: string | null;
  /** The stage of the world it opens ("Villages", "Iron"), if it opens one (Phase 31 M167). */
  readonly stage?: string;
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
