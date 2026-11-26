// The town mode's own inspector (asked 2026-11-25: "the ui and ux could be better ... there should be more detail"): what
// the host tells the page of one of a place's people, or of one of its lots, laid out as a colony sim's inspector is
// laid out: who and what first (a portrait, what they are at and why, their mood and health, four need bars), the rest
// a tab away, and the long sentences behind ⓘ. Read of the place as kept: asking moves nothing (host/placeinspect.ts).
import type { Portrait } from "./inspect.ts";
import type { MemberState } from "./body.ts";
import type { WoundMember } from "./wounds.ts";

/** One reason a mood stands where it does: said, how much it moves it (points of a hundred), and for how long yet. */
export type PlaceThought = {
  readonly words: string;
  readonly size: number;
  /** Days it will go on for, as things stand (null: while what causes it lasts). */
  readonly days: number | null;
  /** Its sign. */
  readonly icon: string;
};

/** A need of theirs: its name, how full it is (0 … 1), how hard it presses (0 … 1). */
export type PlaceNeed = { readonly name: string; readonly level: number; readonly press: number };

/** One of the people named on an inspector: who, their page, a word beside them. */
export type PlaceNamed = {
  readonly id: number | null;
  readonly ref: string;
  readonly name: string;
  readonly words: string;
};

export type PlaceInspectPerson = {
  readonly kind: "person";
  readonly id: number;
  /** Their page in the place, and the god game's page of them where it has one (a key figure, one of its roster). */
  readonly ref: string;
  readonly page: string;
  readonly name: string;
  readonly portrait: Portrait | null;
  readonly age: number;
  /** Their trade, in a word ("farmer", "child"), and the trade an order holds them to (null: none). */
  readonly trade: string;
  readonly bound: string | null;
  /** What they are at now, and why, in a line each. */
  readonly now: string;
  readonly why: string;
  /** Where they are (a lot or PLACE_AT) and where they are going. */
  readonly at: number;
  readonly to: number;
  /** Their mood (-100 … 100), said in a word, the mood below which they heed no order, and its reasons. */
  readonly mood: number;
  readonly moodWord: string;
  readonly breakAt: number;
  readonly thoughts: readonly PlaceThought[];
  /** Their four needs, and the fullness at which a need presses harder than their next hour's work is worth. */
  readonly needs: readonly PlaceNeed[];
  readonly serves: number;
  /** How they are: 0 well, 1 hurt, 2 sick, 3 up with a wound bound; said in a line (null: well); days in want. */
  readonly health: number;
  readonly healthWords: string | null;
  readonly mark: string | null;
  readonly lack: number;
  /** Their skill at their trade, said short ("skilled, 1,240 h"), and in full. */
  readonly skill: string | null;
  readonly skillWords: string | null;
  /** Their skill at every kind of work (the Skills tab): its name, hours, level in a word, how fit for it, whether taught it. */
  readonly skills: readonly {
    readonly name: string;
    readonly hours: number;
    readonly level: number;
    readonly words: string;
    readonly fit: number;
    readonly passion: boolean;
    readonly own: boolean;
  }[];
  /** What their household taught them, said (null: nothing yet). */
  readonly taught: string | null;
  /**
   * Their body as it is (the Health tab): each member not whole, its words and how it is (abed with a wound, mending,
   * scarred, lame), drawn on their figure; and how they are, line by line.
   */
  readonly body: readonly {
    readonly member: WoundMember;
    readonly words: string;
    readonly state: MemberState;
  }[];
  readonly healthRows: readonly (readonly [string, string])[];
  /** What they have and wear (the Gear tab), line by line. */
  readonly gear: readonly (readonly [string, string])[];
  /** Their temper in a few words, and in full. */
  readonly temper: string;
  readonly temperWords: string;
  /** Their home and their work: the lot, said. */
  readonly home: { readonly lot: number; readonly words: string; readonly ref: string };
  readonly work: { readonly lot: number; readonly words: string; readonly ref: string } | null;
  /** What they carry, said (null: nothing); their household's pantry, said. */
  readonly holds: string | null;
  readonly pantry: string;
  /** Who they live with, whom they are paired with, their friend. */
  readonly household: readonly PlaceNamed[];
  readonly mate: PlaceNamed | null;
  readonly friend: PlaceNamed | null;
  /** What befell them since the town was entered, the latest first, each on its day. */
  readonly life: readonly string[];
  /** The long sentences, for those who ask (ⓘ): how a need is weighed against work, what a mood moves. */
  readonly prose: readonly string[];
};

export type PlaceInspectLot = {
  readonly kind: "lot";
  readonly lot: number;
  readonly ref: string;
  /** What it is ("the smithy", "a home"), its sign, and how long it has stood (years; null: not told). */
  readonly name: string;
  readonly icon: string;
  readonly years: number | null;
  /** Who works in it, lives in it, is in it now: how many, and the first of each by name. */
  readonly working: number;
  readonly living: number;
  readonly here: number;
  readonly people: readonly PlaceNamed[];
  /** What it holds, good by good, the most first: its name, how much, its unit. */
  readonly stock: readonly { readonly name: string; readonly n: number; readonly unit: string }[];
  /** Its work stopped by an order (null: no work is done in it). */
  readonly shut: boolean | null;
  /** Going up: how far (0 … 1), what is seen of it, and its hands (null: it stands). */
  readonly site: { readonly share: number; readonly stage: string; readonly hands: number } | null;
  /** A line under it (what it is for, what lies on it). */
  readonly words: string;
};

export type PlaceInspect = PlaceInspectPerson | PlaceInspectLot;

/** The readings a town mode lays over its lots (N5): needs, mood, room, work, age, danger. */
export type PlaceOverlayKind = "needs" | "mood" | "room" | "work" | "age" | "danger";
/** One lot's reading: its value 0 … 1 (low to high on its legend) and what it is in words. */
export type PlaceOverlayLot = { readonly lot: number; readonly v: number; readonly words: string };
export type PlaceOverlay = {
  readonly of: PlaceOverlayKind;
  readonly lots: readonly PlaceOverlayLot[];
  /** What its low and high ends are, and which is the good one (its colours: good green, bad red; "none" a plain ramp). */
  readonly low: string;
  readonly high: string;
  readonly good: "low" | "high" | "none";
  /** A fire burning: its lot, and how far a cry from it carries (metres). */
  readonly fire: { readonly lot: number; readonly reach: number } | null;
};
