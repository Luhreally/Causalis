// The town mode's own inspector (asked 2026-11-25: "the ui and ux could be better ... there should be more detail"): what
// the host tells the page of one of a place's people, or of one of its lots, laid out as a colony sim's inspector is
// laid out: who and what first (a portrait, what they are at and why, their mood and health, four need bars), the rest
// a tab away, and the long sentences behind ⓘ. Read of the place as kept: asking moves nothing (host/placeinspect.ts).
import type { Portrait } from "./inspect.ts";
import type { MemberState } from "./body.ts";
import type { WoundMember } from "./wounds.ts";
import type { PlaceBillRow, PlaceStoreTakes } from "./place.ts";

/** One reason a mood stands where it does: said, how much it moves it (points of a hundred), and for how long yet. */
export type PlaceThought = {
  readonly words: string;
  readonly size: number;
  /** Days it will go on for, as things stand (null: while what causes it lasts). */
  readonly days: number | null;
  /** Its sign. */
  readonly icon: string;
  /** Whom or what it came of: one of the town's people, or one of its lots (null: nothing one). */
  readonly from?: { readonly ref: string | null; readonly name: string } | null;
};

/** A need of theirs: its name, how full it is (0 … 1), how hard it presses (0 … 1). */
export type PlaceNeed = {
  readonly name: string;
  readonly level: number;
  readonly press: number;
  /** A need met by the day, not by the hour (comfort, beauty): what meets it or does not, in words; none sought before work. */
  readonly words?: string;
};

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
  /** Their family's page in the town (P3). */
  readonly familyRef: string;
  /** Their character and mind (R2). */
  readonly characterRef: string;
  /** Their body and what it is written in (R4). */
  readonly bodyRef: string;
  /** R1. Their nearest kin a tap away: mother, father, the one they are paired with, their children (the most told). */
  readonly kin: readonly {
    readonly name: string;
    readonly ref: string | null;
    readonly words: string;
  }[];
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
  /** P4. Their household's table (the foods its pantry holds), and what they take and need (null: nothing). */
  readonly table: string;
  readonly takes: string | null;
  /** P6. The bondage they are held in, in words (null: free), and whether your word may free them. */
  readonly bond: string | null;
  readonly freeable: boolean;
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
  /**
   * Their day (the Work tab, N7): today an hour at a time from midnight, at work, at play or at home; and its working day,
   * its days of rest, its games, line by line.
   */
  readonly day: readonly ("work" | "play" | "home")[];
  readonly dayRows: readonly (readonly [string, string])[];
  /**
   * Whom they know (the Social tab, N8), the most thought of first: each named, how they know them and what they think of
   * them (-100 … 100), and a line of the count (friends, rivals).
   */
  readonly ties: readonly (PlaceNamed & {
    readonly regard: number;
    /** Why, the strongest reasons first (Q2), and their portrait for the web. */
    readonly why: string;
    readonly portrait: Portrait | null;
  })[];
  readonly tiesWords: string;
  /** What those they know think of each other (indices into `ties`), for the web; and how the town thinks of them. */
  readonly web: readonly { readonly a: number; readonly b: number; readonly regard: number }[];
  readonly repute: string;
  /** What they have and wear (the Gear tab), line by line; a thing of theirs with its page's ref (O5). */
  readonly gear: readonly (readonly [string, string, string | null])[];
  /** R3. What they hold slot by slot, and all they hold and carry by the stuff it is. */
  readonly inventory: PlaceInventory;
  /** Their temper in a few words, and in full. */
  readonly temper: string;
  readonly temperWords: string;
  /** Their own nature (its facets) and what they hold dear, in a few words each. */
  readonly nature: string;
  readonly values: string;
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
  /**
   * How closely they are followed (tiers: 0 in full, 1 at the hour, 2 among the folk), said; and whether by the player's
   * word, for good or (`soft`) for a day from being looked at.
   */
  readonly tier: {
    readonly tier: number;
    readonly words: string;
    readonly pinned: boolean;
    readonly soft: boolean;
  };
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
  /** Its works (N11), the latest first: what each is and shows, said, and its maker. */
  readonly works: readonly PlaceNamed[];
  /** What is made here and its bills (N10), and, for one of its stores, what it takes (null: it is no store). */
  readonly bills: readonly PlaceBillRow[];
  readonly takes: PlaceStoreTakes | null;
  /** Going up: how far (0 … 1), what is seen of it, and its hands (null: it stands). */
  readonly site: { readonly share: number; readonly stage: string; readonly hands: number } | null;
  /** A line under it (what it is for, what lies on it). */
  readonly words: string;
  /**
   * Its zone by your order (O2): a meeting place, kept clear, or none; whether it may be kept clear (no store: its
   * households fetch their food there); and whose company it gathers (a meeting place: those of so many homes).
   */
  readonly zone: "meet" | "clear" | null;
  readonly clearable: boolean;
  readonly zoneWords: string;
  /**
   * Whether it is the guard's post by your order (O7), whether it may be one (any lot, its walls' site), and what comes of
   * it: those standing to arms there, the homes within a cry of it watched.
   */
  /** P5. How warm it keeps those in it against the cold out of doors, in words (null: not a building one is in). */
  readonly warmth: string | null;
  readonly post: boolean;
  readonly postable: boolean;
  readonly postWords: string;
  /**
   * What the town could be asked to raise here (P1), on the lots this one is of in step with its size: each with the
   * first of those lots, and how many households live on them now, whose homes it would clear.
   */
  readonly raiseHere: readonly {
    readonly what: string;
    readonly icon: string;
    readonly name: string;
    readonly note: string;
    readonly at: number;
    readonly lots: number;
    readonly clears: number;
  }[];
  /** What its ground is: its land's soil, and the rock under it. */
  readonly ground: string;
};

/** A thing inside a building (O3), on its grid of tiles: what, its sign, its name, where and how big (tiles), said. */
export type PlaceInsideThing = {
  readonly kind: string;
  readonly glyph: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly d: number;
  readonly words: string;
  /** Its page, a thing one holds (O5), else null. */
  readonly ref: string | null;
};
/**
 * Inside a lot (O3): its grid (tiles a metre square, across and deep, the street's side at the top), its rooms, what
 * stands in them, those here now on their tiles, and what the plan does not show, said.
 */
export type PlaceInspectInside = {
  readonly kind: "inside";
  readonly lot: number;
  readonly ref: string;
  readonly lotRef: string;
  readonly name: string;
  readonly icon: string;
  readonly w: number;
  readonly d: number;
  readonly rooms: readonly {
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly d: number;
    /** Its room read (O4): its floor a head, its beds, its hearth, or its benches for those who work there. */
    readonly words: string;
  }[];
  readonly things: readonly PlaceInsideThing[];
  /** The things of its people kept here (O5), each to its page: a cook's pot, the tools of those at home in its chest. */
  readonly items: readonly {
    readonly ref: string;
    readonly glyph: string;
    readonly name: string;
    readonly words: string;
  }[];
  readonly people: readonly {
    readonly id: number;
    readonly ref: string;
    readonly name: string;
    readonly x: number;
    readonly y: number;
    readonly words: string;
  }[];
  readonly words: string;
};

/**
 * A thing one of a town's people holds, on its own page (O5, asked for an artifact page: creator, owner, material, what it
 * was made for): what it is and of what, how fine against what the town's middling hands make of it, who made it and
 * when, who holds it, how worn and how long it has left in use, and what it is to its holder.
 */
export type PlaceInspectItem = {
  readonly kind: "item";
  readonly ref: string;
  readonly name: string;
  readonly icon: string;
  readonly holder: { readonly name: string; readonly ref: string };
  readonly maker: { readonly name: string; readonly ref: string | null } | null;
  readonly stuff: string;
  /** Its quality (5 … 99), its grade, and what the town's middling hands make of its kind. */
  readonly q: number;
  readonly grade: string;
  readonly mid: number;
  /** Thousandths of its life used, and the days of use left it (at the rate it is used). */
  readonly wear: number;
  readonly daysLeft: number;
  readonly made: string;
  /** What it is for, where it is, and what it is to its holder's mood (a condition while they hold it). */
  readonly use: string;
  readonly where: string;
  readonly mood: number;
};

/**
 * A town's fields and its flock (O6): who is out in them now and on which field (its plan's, by placeFieldOf; -1: with the
 * flock at its pasture), how many work them, at the place's hour. The page lays them on the town's own plan: each field's
 * crop as it stands at that hour, the year in them, the flock and what is after it (view/fields.ts, as its 3D draws them).
 */
export type PlaceInspectFields = {
  readonly kind: "fields";
  readonly ref: string;
  readonly lotRef: string;
  readonly name: string;
  readonly icon: string;
  /** The place's clock, to the hour; and how many fields it lays. */
  readonly t: number;
  readonly fields: number;
  readonly working: {
    readonly farmers: number;
    readonly herders: number;
    readonly foragers: number;
  };
  readonly people: readonly {
    readonly id: number;
    readonly ref: string;
    readonly name: string;
    readonly field: number;
    readonly words: string;
  }[];
  /** Those out in them past the ones listed; and how many are on each field now, and with the flock. */
  readonly more: number;
  readonly onField: readonly number[];
  readonly atPasture: number;
};

/**
 * What lies below a town and the water it draws (O8): its land's soil and its rocks, each its share; what its lodes have
 * given, how deep they are dug, and whether they gave out; its water at hand (a river, a lake, the sea) or its wells,
 * and the rain on its land. Read of its world: the same as its land's page and its Build sheet tell.
 */
export type PlaceInspectBelow = {
  readonly kind: "below";
  readonly ref: string;
  readonly lotRef: string;
  readonly name: string;
  readonly icon: string;
  readonly soil: string;
  readonly rocks: readonly { readonly name: string; readonly share: number }[];
  /** Each lode dug: what of, how deep (0 the top … 3 the deepest), and the year it gave out (null: worked still). */
  readonly lodes: readonly {
    readonly name: string;
    readonly tier: number;
    readonly out: number | null;
    readonly words: string;
  }[];
  /** Its water at hand (null: none), its wells standing, the rain on its land (mm a year), and all of it said. */
  readonly water: "river" | "lake" | "sea" | null;
  readonly wells: number;
  readonly rain: number;
  readonly undersea: boolean;
  readonly words: string;
};

/**
 * A work of the town on its own page (O9): what it is, how fine, where it is kept, who made it and when, what it shows
 * (a happening of the town, and whom), and the homes it is in sight of, whose finest it is.
 */
export type PlaceInspectWork = {
  readonly kind: "work";
  readonly ref: string;
  readonly lotRef: string;
  readonly name: string;
  readonly icon: string;
  readonly quality: string;
  readonly kept: string;
  readonly made: string;
  readonly maker: { readonly name: string; readonly ref: string | null };
  readonly shows: string;
  readonly whom: { readonly name: string; readonly ref: string } | null;
  readonly seenBy: number;
  readonly words: string;
};
/**
 * A town's legends (O9): its works, the finest first, each to its page; the battles its men were in; and the rarest of
 * what its log keeps, the oldest first, each with whom it befell, a tap away while they are of the town.
 */
export type PlaceInspectLegends = {
  readonly kind: "legends";
  readonly ref: string;
  readonly lotRef: string;
  readonly name: string;
  readonly icon: string;
  readonly works: readonly {
    readonly ref: string;
    readonly name: string;
    readonly words: string;
  }[];
  readonly battles: readonly { readonly name: string; readonly ref: string }[];
  readonly lines: readonly {
    readonly when: string;
    readonly words: string;
    readonly ref: string | null;
  }[];
  readonly words: string;
};

/**
 * A town's gate (P2): who has come to it this year and who is to come, each on its day, what they are and from where, why
 * they came, and the page of what sent them; whether it is shut to newcomers by order, and what that does.
 */
export type PlaceInspectGate = {
  readonly kind: "gate";
  readonly ref: string;
  readonly lotRef: string;
  readonly name: string;
  readonly icon: string;
  readonly shut: boolean;
  readonly orderWords: string;
  readonly arrivals: readonly {
    readonly when: string;
    readonly icon: string;
    readonly who: string;
    readonly words: string;
    readonly ref: string | null;
    readonly past: boolean;
    readonly asks: boolean;
  }[];
  readonly words: string;
};

/** One's family in the town (P3): each of their kin a key while of the town, as deep as it has kept them. */
export type PlaceInspectFamily = {
  readonly kind: "family";
  readonly ref: string;
  readonly personRef: string;
  readonly name: string;
  readonly icon: string;
  readonly parents: readonly {
    readonly name: string;
    readonly ref: string | null;
    readonly words: string;
  }[];
  readonly grandparents: PlaceInspectFamily["parents"];
  readonly mate: PlaceInspectFamily["parents"][number] | null;
  /** Their pairing set for a day to come with the one named (courting). */
  readonly promised: boolean;
  readonly siblings: PlaceInspectFamily["parents"];
  readonly children: PlaceInspectFamily["parents"];
  readonly grandchildren: PlaceInspectFamily["parents"];
  readonly words: string;
};

/**
 * The bound of a town (P6): the share of its land's people in each kind of bondage and how many of the town so; captives its
 * realm holds in its land; those its justice holds; and the bound of the town, each a key to their page, where your word
 * may free them.
 */
export type PlaceInspectBound = {
  readonly kind: "bound";
  readonly ref: string;
  readonly lotRef: string;
  readonly name: string;
  readonly icon: string;
  readonly kinds: readonly {
    readonly name: string;
    readonly words: string;
    readonly here: number;
  }[];
  readonly captives: string | null;
  readonly held: number;
  readonly people: readonly {
    readonly name: string;
    readonly ref: string;
    readonly words: string;
  }[];
  readonly freed: number;
  readonly words: string;
};

/**
 * A town's faith and rank (P7): its land's faith and whom it worships, how devout and how given to rank its people are, its
 * shrines and temples (each a key) and what having them or not is to its people; its hall, and those of rank, each a key,
 * with what it is to them.
 */
export type PlaceInspectFaith = {
  readonly kind: "faith";
  readonly ref: string;
  readonly lotRef: string;
  readonly name: string;
  readonly icon: string;
  readonly faith: string;
  readonly ways: string;
  readonly shrines: readonly { readonly name: string; readonly ref: string }[];
  readonly riteWords: string;
  readonly hall: { readonly name: string; readonly ref: string } | null;
  readonly rankWords: string;
  readonly ranked: readonly {
    readonly name: string;
    readonly ref: string;
    readonly words: string;
  }[];
  readonly words: string;
};

/**
 * What one holds (R3): each thing in its slot, how worn, working or not; and all they hold and carry by the stuff it is,
 * each with its weight (kg) and its colour as the world's matter has it.
 */
export type PlaceInventory = {
  readonly slots: readonly {
    readonly slot: string;
    readonly icon: string;
    readonly name: string;
    readonly ref: string | null;
    /** Its life used, 0 … 100. */
    readonly wear: number;
    readonly state: "working" | "failing" | "worn out";
  }[];
  readonly materials: readonly {
    readonly name: string;
    readonly kg: number;
    readonly colour: string;
  }[];
  readonly kg: number;
};

/**
 * One of a town's dead (R1), on a page that outlives them: what took them and when, their life in short, their kin and
 * those they knew a tap away (living or kept so), and what they carried in mind at the end.
 */
export type PlaceInspectDead = {
  readonly kind: "dead";
  readonly ref: string;
  readonly name: string;
  readonly icon: string;
  /** "Died day 41 of year 150, aged 63". */
  readonly sub: string;
  /** What took them, as the town's log told it. */
  readonly death: string;
  /** Their life in short: born where and when, their trade, their household's home. */
  readonly life: readonly string[];
  /** Their kin (parents, mate, children) and those they knew, each with what they were to them. */
  readonly kin: PlaceInspectFamily["parents"];
  readonly knew: PlaceInspectFamily["parents"];
  /** What they carried in mind at the end: each memory's icon, words and its weight then. */
  readonly memories: readonly {
    readonly icon: string;
    readonly words: string;
    readonly size: number;
  }[];
};

/**
 * One's character and mind (R2), as Classic's character and mind cards had them: their traits as tags, each with what it
 * does; their best skills; what they want most now and how long they have been in want; what they have come to; and their
 * mind: what drives them, their leanings against most, how they learn, and the senses their people have.
 */
export type PlaceInspectCharacter = {
  readonly kind: "character";
  readonly ref: string;
  readonly personRef: string;
  readonly name: string;
  readonly icon: string;
  readonly traits: readonly {
    readonly tag: string;
    readonly meaning: string;
    readonly of: "temper" | "nature" | "values";
  }[];
  readonly skills: readonly {
    readonly name: string;
    readonly words: string;
    readonly hours: number;
    readonly passion: boolean;
  }[];
  /** What they want most now, and since when they have been in want (null: in want of nothing). */
  readonly want: string;
  readonly since: string | null;
  /** What they have come to, each on its day: paired, a child, of age, a masterwork, well again. */
  readonly fulfilled: readonly string[];
  readonly drive: string;
  /** Their five leanings, each against most (100: as most are). */
  readonly leanings: readonly {
    readonly name: string;
    readonly value: number;
    readonly words: string;
  }[];
  readonly learning: readonly string[];
  readonly senses: readonly { readonly name: string; readonly words: string }[];
};

/**
 * One's body, what it is made of and how it lives, and what it is written in (R4): the shares of their body by what it is
 * (est.), how they eat, breathe and keep warm, what poisons them; their heredity's chains, their cells' skins, their bones,
 * their kind and lineage, and what is their own.
 */
export type PlaceInspectBody = {
  readonly kind: "body";
  readonly ref: string;
  readonly personRef: string;
  readonly name: string;
  readonly icon: string;
  readonly sub: string;
  readonly body: string;
  readonly madeOf: readonly {
    readonly what: string;
    readonly share: number;
    readonly kg: number;
    readonly words: string;
  }[];
  readonly metabolism: readonly (readonly [string, string])[];
  readonly genome: readonly (readonly [string, string])[];
};

/**
 * What a town lives on (R5): all it holds by the stuff it is, what it made and used today, its water, its fuel, what
 * poisons its people, the vulnerabilities its readings name, and how steady it is.
 */
export type PlaceInspectMaking = {
  readonly kind: "making";
  readonly ref: string;
  readonly name: string;
  readonly icon: string;
  readonly sub: string;
  readonly stuffs: readonly {
    readonly name: string;
    readonly kg: number;
    readonly colour: string;
  }[];
  /** Kilograms of the stuffs past those told. */
  readonly rest: number;
  readonly making: readonly {
    readonly name: string;
    readonly made: number;
    readonly used: number;
    readonly came: number;
  }[];
  readonly water: string;
  readonly fuel: readonly string[];
  readonly poisons: string;
  readonly vulnerable: readonly {
    readonly name: string;
    readonly words: string;
    readonly ref: string | null;
  }[];
  readonly steady: "steady" | "strained" | "failing";
  readonly stability: readonly (readonly [string, string])[];
};

/**
 * A town's works and orders (R6): what is going up and how far each has got; what its land may find next and what each
 * asks, what it came to know last, its learned; and every standing order given it.
 */
export type PlaceInspectCivic = {
  readonly kind: "civic";
  readonly ref: string;
  readonly name: string;
  readonly icon: string;
  readonly sub: string;
  readonly sites: readonly {
    readonly name: string;
    readonly ref: string;
    /** How far it has got, 0 … 100. */
    readonly share: number;
    readonly words: string;
  }[];
  readonly findable: readonly { readonly name: string; readonly words: string }[];
  readonly known: readonly string[];
  readonly learned: string;
  readonly orders: readonly (readonly [string, string])[];
  /** Whether any order was given it (else it runs as its land runs it). */
  readonly managed: boolean;
  readonly year: number;
};

export type PlaceInspect =
  | PlaceInspectCivic
  | PlaceInspectMaking
  | PlaceInspectBody
  | PlaceInspectCharacter
  | PlaceInspectDead
  | PlaceInspectFaith
  | PlaceInspectBound
  | PlaceInspectFamily
  | PlaceInspectGate
  | PlaceInspectWork
  | PlaceInspectLegends
  | PlaceInspectBelow
  | PlaceInspectFields
  | PlaceInspectPerson
  | PlaceInspectLot
  | PlaceInspectInside
  | PlaceInspectItem;

/** The readings a town mode lays over its lots (N5): needs, mood, room, work, age, danger. */
export type PlaceOverlayKind =
  "needs" | "mood" | "room" | "comfort" | "work" | "age" | "danger" | "zones";
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
