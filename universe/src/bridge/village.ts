// The microscope's plan of a village, as the host sends it (docs/architecture §9,
// watch mode): what the view needs to draw a village's day. Positions are metres
// from the village's middle.
import type { HostKinds } from "./wars.ts";
/** How far a village's water lies out along its way, and how far the lake reaches about that point (metres). */
export const WATER_OUT = 700;
export const LAKE_R = 220;

/** A lineage's body plan as it crosses to the page (the rules' creature body, in plain values). */
export type BeastPlan = {
  readonly symmetry: string;
  readonly segments: number;
  readonly legs: number;
  readonly fins: number;
  readonly wings: number;
  readonly covering: string;
  readonly size: number;
  readonly moves: string;
  readonly eats: string;
  readonly level: number;
  readonly neck: number;
  readonly tail: number;
  readonly features: readonly string[];
  readonly warm: boolean;
};

/**
 * How a village lives now (Phase 9 M86), for what its people are seen doing and saying:
 * how well its land was fed last year (0 … 1) and whether its people grow in number; its
 * realm at war (its young drill in the square); its people's grievance against their
 * rulers (0 … 1: hot words, a brawl); its faith; what it talks of, most pressing first
 * (keys the view gives signs); the next home rising as it grows (where, and how far built);
 * the watched households mourning a death this year, and those with a newborn.
 */
export type VillageLife = {
  readonly fed: number;
  readonly growing: boolean;
  readonly war: boolean;
  readonly unrest: number;
  readonly faith: string | null;
  readonly talk: readonly string[];
  readonly site: {
    readonly x: number;
    readonly z: number;
    readonly yaw: number;
    readonly progress: number;
  } | null;
  readonly mourning: readonly string[];
  readonly newborn: readonly string[];
  /**
   * A battle fought in its land this year or last (M87), as history fought it: each side's
   * name and colour, whether the attacker won, how many fell, and the battle's event.
   */
  readonly battle?: {
    readonly attacker: BattleSide;
    readonly defender: BattleSide;
    readonly won: boolean;
    readonly fallen: number;
    readonly year: number;
    readonly event: string;
  } | null;
};

/** A side of a village's battle: its realm's name and colour, and its host's kinds (what it bears). */
export type BattleSide = {
  readonly name: string;
  readonly color: readonly [number, number, number];
  readonly host?: HostKinds | null;
};

export type VillagePlan = {
  readonly ref: string;
  readonly name: string;
  readonly population: number;
  readonly market: boolean;
  /** Whether the god's hand rests here: then everyone shown is one of the hand's people. */
  readonly hand: boolean;
  /** The biome the village stands in (gen's code), for the ground's colour. */
  readonly biome: number;
  readonly seed: number;
  /** Positions in metres from the village's middle; `household` for the watched homes. */
  readonly homes: readonly { x: number; z: number; yaw: number; household: string | null }[];
  readonly fields: readonly { x: number; z: number; w: number; d: number; yaw: number }[];
  readonly pasture: { x: number; z: number; r: number };
  /** How far out the wild begins. */
  readonly wild: number;
  readonly water: { x: number; z: number } | null;
  /**
   * How its houses are built (the land's design): walls, roof and shape by
   * realization id ("mudbrick", "flat", "court"), the roof's pitch in degrees, and
   * the design's ref for its why.
   */
  readonly house: {
    readonly walls: string;
    readonly roof: string;
    readonly form: string;
    readonly pitch: number;
    readonly design: string | null;
  };
  /** Where the road out leads, at the edge of what is shown. */
  readonly road: { x: number; z: number };
  /**
   * A city's quarters, if it is one: blocks of `blockM` metres, `blocks` to a side,
   * each put to a use (0 open, 1 houses, 2 crowded houses, 3 market, 4 workshops,
   * 5 temple), and whether the road through it is paved.
   */
  readonly districts: {
    readonly blocks: number;
    readonly blockM: number;
    readonly uses: readonly number[];
    readonly paved: boolean;
  } | null;
  readonly people: readonly {
    ref: string;
    name: string;
    home: number;
    age: number;
    occupation: number;
    child: boolean;
    /** The tool they carry to work, in words (Phase 15 M125: a watched person's own). */
    tool?: string;
  }[];
  /**
   * How far their land has come, for what they wear and carry (art track A2): gatherers
   * in hides, farmers in undyed cloth, smiths' people in dyed cloth, the engines' in
   * coats, the modern world in bright colours. Absent: farmers.
   */
  readonly era?: "forage" | "farm" | "metal" | "industry" | "modern";
  /** What its tools are headed with (Phase 15 M122: the land's best metal within reach). */
  readonly metal?: "stone" | "copper" | "bronze" | "iron" | "steel";
  /** How it lives now (M86). Absent: a quiet day. */
  readonly life?: VillageLife;
  /**
   * What lives about it (Phase 8 M77): the land's wild lineages, each with how much of it
   * still stands against what the land first held (its hunters, against as many as the
   * game kept); its flocks and how many of the village keep them; and whether the land's
   * hunters raid the flocks. Absent: nothing drawn.
   */
  readonly fauna?: {
    readonly wild: readonly {
      readonly ref: string;
      readonly name: string;
      readonly niche: string;
      readonly size: number;
      readonly wool: boolean;
      readonly stock: number;
      /** Its body (M83–85), as the view builds it. */
      readonly body?: BeastPlan | null;
    }[];
    readonly flock: {
      readonly ref: string;
      readonly name: string;
      readonly size: number;
      readonly wool: boolean;
      readonly herders: number;
      readonly body?: BeastPlan | null;
    } | null;
    readonly raided: boolean;
  };
  /**
   * The land's works about it (Phase 8 M78), each where it stands (metres from the middle):
   * its mine — a pit, or a shaft under its headframe in the engines' age, or a quarry — and
   * what it digs (coal where the land digs it, ore where it smelts copper, stone where it
   * builds in stone); its oil well; its factory. Absent or null: none.
   */
  readonly works?: {
    readonly mine: {
      readonly x: number;
      readonly z: number;
      readonly kind: "pit" | "shaft" | "quarry";
      readonly what: "coal" | "ore" | "stone";
      /** The event that explains it (its first digging), if one was recorded. */
      readonly ref: string | null;
    } | null;
    readonly well: { readonly x: number; readonly z: number; readonly ref: string } | null;
    readonly factory: { readonly x: number; readonly z: number; readonly ref: string } | null;
  };
  /** Their body, as the figure needs it (null: upright apes, as ever). */
  readonly body: {
    readonly clade: string;
    readonly medium: "land" | "shore" | "water";
    readonly symmetry: "bilateral" | "radial";
    readonly manipulators: string;
    readonly limbs: number;
    readonly skin: string;
    readonly size: number;
    /** How long they live, years: their old age comes as late. */
    readonly span: number;
  } | null;
};
