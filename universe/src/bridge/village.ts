// The microscope's plan of a village, as the host sends it (docs/architecture §9,
// watch mode): what the view needs to draw a village's day. Positions are metres
// from the village's middle.
import type { HostKinds } from "./wars.ts";
import type { TownPlan } from "./town.ts";
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
/**
 * A feast a town keeps (Phase 33 M174): its day (days since the world began), why — the harvest
 * home, a peace its realm made, its realm's new ruler crowned, its faith's holy day — its words,
 * and what it answers to.
 */
export type Feast = {
  readonly day: number;
  readonly occasion: "harvest" | "peace" | "crowning" | "holy";
  readonly words: string;
  readonly ref: string | null;
};

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
  /** The feasts it keeps this year and the next (Phase 33 M174). */
  readonly feasts?: readonly Feast[];
  /**
   * Whether it is its land's heart (Phase 40 M204: bridge/wars heartTown): the battles for its land
   * are fought before it, its sieges laid about it. Its land's battle (`battle`) is told to it alone.
   */
  readonly heart?: boolean;
  /** The year in its fields (Phase 44 M206), as history has it. Absent: a fair year. */
  readonly fields?: FieldYear;
};

/**
 * The year in a town's fields (Phase 44 M206), as its land's history has it: what grows its crop
 * — this year's rain, its soil, the vermin in its grain, the warming on its fields — and the god's
 * hand on its rain and its harvest now, since when; and the events behind each, for its why.
 */
export type FieldYear = {
  /** This year's rain against its usual (1 as usual; below 0.72 a drought), as the year began. */
  readonly rain: number;
  /** The god's rain on its land now: sent (1), withheld (−1), neither (0); since when (world seconds). */
  readonly sent: 1 | 0 | -1;
  readonly sentFrom: number;
  /** The god's hand on its harvest now: blessed (1), blighted (−1), neither (0); since when. */
  readonly gift: 1 | 0 | -1;
  readonly giftFrom: number;
  /** Its soil (1 as it first was … worn toward 0). */
  readonly soil: number;
  /** The share of its grain the small game eats, where it has grown past what it was. */
  readonly vermin: number;
  /** What the warming does to its fields (1 as ever; below, hot fields give less). */
  readonly heat: number;
  /** The events behind it: the year's drought, the god's acts on its rain and harvest, its soil worn. */
  readonly why: readonly string[];
};

/** A side of a village's battle: its realm's name and colour, and its host's kinds (what it bears). */
export type BattleSide = {
  readonly name: string;
  readonly color: readonly [number, number, number];
  readonly host?: HostKinds | null;
};

/** What a town keeps in store (Phase 39 M198), by kind. */
export const STORE_KINDS = ["grain", "food", "wood", "stone", "ore", "tools"] as const;
export type StoreKind = (typeof STORE_KINDS)[number];
export type StoreBook = Readonly<Record<StoreKind, number>>;

/**
 * What a town holds in store and how it flows (Phase 39 M198), for the errands that move it: what
 * it held at moment `t` (world seconds) — its share of its land's stocks, by its share of the
 * land's people — and what a year brings in and takes out at that share (its land's books for the
 * year past). Grain is its granary's; food, its other food (meat, milk, what the wild gives); ore,
 * what it digs (copper's rock, coal); tools, what its smiths make. History keeps no count of wood
 * and stone: those are its yard's, the view's own.
 */
export type TownStores = {
  readonly t: number;
  readonly have: StoreBook;
  readonly made: StoreBook;
  readonly used: StoreBook;
};

/**
 * A good its land traded last year, at the town's share by its people (Phase 48 M210): which (the
 * goods' id), in words, the town of the land it went to or came from, and how much a year (the
 * markets' units: a unit of food, a person's month of eating).
 */
export type TradeGood = {
  readonly good: string;
  readonly what: string;
  readonly land: string;
  readonly count: number;
};

/** What its land traded last year, at its share: what went out, and what came in (the most first). */
export type TownTrade = {
  readonly out: readonly TradeGood[];
  readonly in: readonly TradeGood[];
};

/**
 * What a town's things are made of this year, as its scene draws them and its people's words tell
 * them (Phase 51 M213): its tools' heads, of its land's own stone or the metal it works, and how
 * that came to it; the metal its smiths work (null: its tools still of stone); the copper ore of
 * its own ground, which its works dig and smelt by the diggings, and the charcoal they burn (null:
 * none of its own — its metal comes from a neighbour's ground or down the road).
 */
export type TownStuff = {
  readonly tool: {
    readonly name: string;
    readonly colour: readonly [number, number, number];
    readonly of: string;
  };
  readonly metal: {
    readonly name: string;
    readonly colour: readonly [number, number, number];
  } | null;
  readonly ore: {
    readonly name: string;
    readonly colour: readonly [number, number, number];
    readonly fuel: string;
  } | null;
  /** The clay its potters dig: its name, the ware it fires to, its colour drying and fired. */
  readonly clay: {
    readonly name: string;
    readonly ware: string;
    readonly raw: readonly [number, number, number];
    readonly fired: readonly [number, number, number];
  };
  /** What its weavers weave, and its colour undyed. */
  readonly cloth: { readonly name: string; readonly colour: readonly [number, number, number] };
  /** Its land's wood: its hafts, its firing, its charcoal. */
  readonly wood: string;
};

/** One of the god's wonders in a village or town (Phase 42 M201). */
export type Wonder = {
  readonly kind: "spring" | "shrine";
  readonly at: number;
  readonly x: number | null;
  readonly z: number | null;
  readonly event: string;
};

/**
 * A town's dead and their burying (Phase 43 M205): how many of it die a year (its share, by its
 * people, of its land's dead last year), how many lie in its graveyard when its year began (its
 * share of its land's dead since it was founded, as far back as history holds them), and the
 * watched households' dead of these few years, by name — when, how old, from which of its homes.
 */
export type VillageRest = {
  /** The year its graves are counted to the beginning of (the plan's year). */
  readonly year: number;
  readonly perYear: number;
  readonly graves: number;
  readonly named: readonly {
    readonly name: string;
    readonly year: number;
    readonly age: number;
    readonly home: number;
  }[];
};

export type VillagePlan = {
  readonly ref: string;
  readonly name: string;
  /** The land it stands in (Phase 30: its weather). */
  readonly cell?: number;
  /** Its land's middle on the globe's grid, as the wars map names lands (Phase 40 M204). */
  readonly spot?: number;
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
  /**
   * Its fabric (Phase 23 M149): lot by lot along its streets, what stands on each and since when
   * — drawn in place of the homes and quarters above where it has one.
   */
  readonly town?: TownPlan;
  /**
   * The god's wonders in it (Phase 42 M201): a spring welled up, a shrine raised — when, and
   * where the hand set it (metres from its middle; null: where the hand did not say).
   */
  readonly wonders?: readonly Wonder[];
  /** Its dead and their burying (Phase 43 M205; absent: none told). */
  readonly rest?: VillageRest;
  readonly people: readonly {
    ref: string;
    name: string;
    home: number;
    age: number;
    occupation: number;
    child: boolean;
    /** The tool they carry to work, in words (Phase 15 M125: a watched person's own). */
    tool?: string;
    /**
     * One of the town's people the observer has not met (Phase 39 M198): drawn so a town is seen
     * as full as it is, at its work — the view's, never history's.
     */
    folk?: boolean;
    /** What one of the town's many is, said: "a crafter of Sairis" (Phase 50 M212). */
    role?: string;
    /**
     * One of the town's makers, kept at their trade day on day (Phase 50 M212): a smith at the
     * forge, a potter at the kilns, a weaver at the workshops — the seat they hold, named as the
     * pages of its buildings name them, and their years at it.
     */
    trade?: {
      readonly kind: "smith" | "potter" | "weaver" | "founder" | "machinist";
      readonly seat: number;
      readonly years: number;
    };
  }[];
  /** What it holds in store and how that flows (Phase 39 M198). Absent: a village's usual. */
  readonly stores?: TownStores;
  /** What its land traded last year, at its share (Phase 48 M210). Absent: none. */
  readonly trade?: TownTrade;
  /**
   * How far their land has come, for what they wear and carry (art track A2): gatherers
   * in hides, farmers in undyed cloth, smiths' people in dyed cloth, the engines' in
   * coats, the modern world in bright colours. Absent: farmers.
   */
  readonly era?: "forage" | "farm" | "metal" | "industry" | "modern";
  /** What its tools are headed with (Phase 15 M122: the land's best metal within reach). */
  readonly metal?: "stone" | "copper" | "bronze" | "iron" | "steel";
  /** What its things are made of, and its own ore (Phase 51 M213). Absent: as the age has it. */
  readonly stuff?: TownStuff;
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
  /**
   * Visitors from another star (Phase 18 M134): a people of the stars just come down here (or
   * seen to come and go, before this world could speak), kept here as an embassy while the two
   * stand well, or its fleet over the land in war. Their ship in the sky; and, unless in war, a
   * few of them among the people in their own bodies, in their own colour.
   */
  readonly visitors?: readonly Visitor[];
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
    /** What their own look is made of, on a world not Earth (Phase 34; none: their kind's plain figure). */
    readonly folk?: FolkFacts | null;
  } | null;
};

/**
 * What a people's look is made of on a world other than Earth (Phase 34 M176): a key of their
 * own, their planet's pull (g) and their star's warmth (kelvin), the warmth (°C), rain (mm) and
 * ground (biome) of the land they rose in, and what their forebears grew, as the tree of life
 * has them (their neck and tail, what grew on them, their eyes, feelers, markings, covering and
 * pairs of legs). The view makes their look of it.
 */
export type FolkFacts = {
  readonly key: number;
  readonly gravity: number;
  readonly star: number;
  readonly warmth: number;
  readonly rain: number;
  readonly biome: number;
  readonly forebears: {
    readonly neck: number;
    readonly tail: number;
    readonly grows: readonly string[];
    readonly eyes: number;
    readonly feelers: boolean;
    readonly pattern: string;
    readonly covering: string;
    readonly legs: number;
  } | null;
};

/** A people of another star at a land (Phase 18 M134). */
export type Visitor = {
  readonly civ: string;
  /** What it calls itself ("the Laxai"), and what it is ("trunked giants"). */
  readonly name: string;
  readonly kind: string;
  readonly body: NonNullable<VillagePlan["body"]>;
  readonly color: readonly [number, number, number];
  /** Why they are here: come down now, come and gone as an omen, an embassy, or a fleet's raid. */
  readonly why: "landing" | "omen" | "embassy" | "raid";
  readonly year: number;
  /** The event to open: their landing, their latest exchange, or the raid. */
  readonly event: string;
  /** How many of them stand among the people (none in war). */
  readonly count: number;
  /** How they came, and how the land met them ("wonder", "fear", "trade", "war"), if they met. */
  readonly theirs: string | null;
  readonly ours: string | null;
};
