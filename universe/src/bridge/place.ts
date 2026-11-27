// A place (town mode, first slice): what the host tells the page of a town kept in detail (host/place.ts). Its people
// are the plan's people while the mode is on, each by a ref of their own; where each is, lot by lot, comes a few times
// a second and the page draws them between.

/**
 * Where one is that is no lot: nowhere yet, the fields and pastures outside the town, its square, and the site of its
 * walls while they go up (they stand on no lot: the length of their line the work has come to).
 */
export const PLACE_AT = { none: -1, fields: -2, square: -3, walls: -4 } as const;
/** The number a walls' site goes by in its page's ref (a lot's is its number and three). */
export const PLACE_WALLS_REF = 999_999_999;

/** What one of a place's people is doing (host/place.ts ACT). */
export const PLACE_ACT = {
  idle: 0,
  sleep: 1,
  eat: 2,
  work: 3,
  fetch: 4,
  carry: 5,
  warm: 6,
  visit: 7,
  wait: 8,
  /** Gone to fetch what a building has made, for the market. */
  haul: 9,
  /** Abed, hurt or sick. */
  abed: 10,
  /** At work on a site, raising what the town was asked for; and gone for a load of what it is built of. */
  build: 11,
  stuff: 12,
  /** Fighting a fire in the town; and standing to arms in its square, by an order. */
  brigade: 13,
  guard: 14,
  /** At a burial, with their household. */
  mourn: 15,
  /** Held by the town's justice, in its court or its stocks (N11). */
  held: 17,
  /** The town's healer at the bedside of one of its hurt (N9). */
  tend: 16,
} as const;

/** The page of one of a place's people, and of one of its lots (its square and its fields too). */
export const placePersonRef = (town: string, id: number): string => `plc:${town}:${id}`;
export const placeLotRef = (town: string, lot: number): string =>
  `plcl:${town}:${lot === PLACE_AT.walls ? PLACE_WALLS_REF : lot + 3}`;
/** Who a plan's person is in their town's place (null: not one of a place's). */
export function placedId(ref: string): number | null {
  if (!ref.startsWith("plc:")) return null;
  const id = Number(ref.slice(ref.lastIndexOf(":") + 1));
  return Number.isInteger(id) ? id : null;
}

/** A scramble of two whole numbers, for where one of many stands or goes: the same each time, in the host and the page. */
export function placeSpread(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  return (h ^ (h >>> 13)) >>> 0;
}
/** Which of its town's fields is one's own to work (who they are in the place; how many fields): the host reckons the walk to it, the page draws it. */
export const placeFieldOf = (id: number, fields: number): number =>
  fields > 0 ? placeSpread(id, 3) % fields : -1;

/** A place's people as they stand at a tick: those asked for, in the order asked. */
export type PlaceFrame = {
  readonly town: string;
  /** The place's clock (seconds of the world's), and the length of its tick. */
  readonly t: number;
  readonly tick: number;
  /** The share of its year gone from midwinter, as its own hemisphere has it (0 … 1), and its air's warmth now (°C). */
  readonly season: number;
  readonly warmth: number;
  /** How many the town holds, how many of them the place keeps one by one, its households. */
  readonly people: number;
  readonly kept: number;
  readonly households: number;
  /** For each asked: where they are, where they are going, the ticks left of the walk and its whole (0: on none). */
  readonly at: readonly number[];
  readonly to: readonly number[];
  readonly eta: readonly number[];
  readonly trip: readonly number[];
  readonly act: readonly number[];
  /** Hunger and tiredness, 0 … 1; whether they carry anything; why they do what they do, in words. */
  readonly hunger: readonly number[];
  readonly tired: readonly number[];
  readonly carries: readonly boolean[];
  readonly why: readonly string[];
  /**
   * What is drawn over each one's head near the eye (Q1): the memory that bears most on them now, else what they are at
   * where it is their work, as a sign ("": nothing); and whom of those asked each is talking with where they stand (their
   * place in the list; -1: no one), warmly or not.
   */
  readonly bubble: readonly string[];
  readonly talk: readonly number[];
  readonly warm: readonly boolean[];
  /** How many are at each thing now, of all the place keeps (host/place.ts ACT's order). */
  readonly doing: readonly number[];
  /** What wants its manager's eye now, the most pressing first: said, and the page that tells more (null: none). */
  readonly notices: readonly PlaceNotice[];
  /** Whether it has been given orders, and how many of its doings by them its land has yet to be told. */
  readonly managed: boolean;
  readonly unsettled: number;
  /** The month of the world's clock its tick stands in: at its turn what is unsettled is told. */
  readonly month: number;
  /**
   * Its sites in hand (buildings it was asked to raise, worked by its own people): the lot each stands on, how far it has
   * got (0 … 1), whether it is stopped, and whether all it wants is done here and its land has yet to be told.
   */
  readonly sites: readonly {
    readonly lot: number;
    readonly share: number;
    readonly stopped: boolean;
    readonly raised: boolean;
  }[];
};

/**
 * Something that wants the manager's eye now (the mode's alert column): said, the page that tells more, its sign, how
 * grave it is (3 a danger now, 2 a want to see to, 1 worth knowing), how many it touches (0: not a count), where it is
 * (a lot or PLACE_AT; null: nowhere in one place) and whom (their number in the place; null: no one), and how seldom its
 * kind has come in this town (0 … 1, as host/placewatch.ts reckons it: the seldomer first among the equally grave).
 */
export type PlaceNotice = {
  readonly key: string;
  readonly words: string;
  readonly ref: string | null;
  readonly icon: string;
  readonly level: number;
  readonly n: number;
  readonly lot: number | null;
  readonly id: number | null;
  readonly rare: number;
};

/** The trades an order can put hands to, in the order its shares are given (sim/town/managed.ts MANAGED_TRADES). */
export const PLACE_TRADES = ["Fields", "Herds", "Crafts", "Hauling"] as const;

/** One of a place's people on its People sheet. */
export type PlacePersonRow = {
  readonly ref: string;
  readonly name: string;
  /** Their trade (the world's occupation column), said, and what they are doing. */
  readonly occ: number;
  readonly trade: string;
  readonly doing: string;
  /** Their needs, 0 … 1 (hunger, tiredness, cold, want of company), and which presses most. */
  readonly needs: readonly number[];
  readonly worst: number;
  /** Days they have gone in want. */
  readonly lack: number;
  /** What wants the manager's eye in them, said ("3 days in want", "at ease"), and how much (0 none … 3 grave). */
  readonly attention: string;
  readonly level: number;
  /** Their mood, -100 … 100; how they are (0 well, 1 hurt, 2 sick, 3 up again with a wound bound); the trade an order holds them to (null: none). */
  readonly mood: number;
  readonly health: number;
  readonly bound: string | null;
  /** Who they are in the place, for an order given them; and their household (its key), for a home given it. */
  readonly id: number;
  readonly house: number;
  /** The lot their household lives on. */
  readonly homeLot: number;
  /** The building an order puts them at (its lot; null: none). */
  readonly post: number | null;
  /** Pinned: kept on the god game's people bar (📌), or followed in full by your word in the town. */
  readonly pinned: boolean;
};
export type PlacePeopleSheet = {
  /** How many of each trade (the world's occupation columns), and the rows asked for: the most pressed first. */
  readonly trades: readonly number[];
  /** Of those of no trade, how many are young (the rest are grown and keep none, most of them old). */
  readonly children: number;
  readonly rows: readonly PlacePersonRow[];
  readonly all: number;
  /**
   * How many of its people are pinned (the people bar's pins asked, and those followed by your word), and which of the
   * pins asked are of its people (the rest are elsewhere, or gone).
   */
  readonly pinned: number;
  readonly pinsHere: readonly string[];
  /** The buildings one can be put at by name, and the homes with most room a household can be given. */
  readonly posts: readonly { readonly lot: number; readonly name: string }[];
  readonly homes: readonly { readonly lot: number; readonly room: number }[];
};
/** One good on its Stocks sheet. */
export type PlaceStockRow = {
  readonly good: number;
  readonly name: string;
  readonly food: boolean;
  /** What it is made of here (null: it is what it is). */
  readonly stuff: string | null;
  /** All the place holds of it, what was made and used of it today (units). */
  readonly held: number;
  readonly made: number;
  readonly used: number;
  /** What its land brought in to its stores of it today (units): the town's share of what its land wins outside it. */
  readonly came: number;
  /** Where it lies: each building or kind of place holding any, the most first. */
  readonly where: readonly {
    readonly ref: string | null;
    readonly name: string;
    readonly n: number;
  }[];
  /** Whether its market will not let it go. */
  readonly forbidden: boolean;
  /** What a unit of it is ("months' food": one person's for a month), and how many days it lasts at today's use (null: none used). */
  readonly unit: string;
  readonly days: number | null;
  /** What the place held of it at each day's turn while it was looked at, the last thirty, the oldest first. */
  readonly trend: readonly number[];
};
export type PlaceStocksSheet = {
  readonly rows: readonly PlaceStockRow[];
  /** Months of food its granary holds back, and the days of food it holds in all. */
  readonly hold: number;
  readonly foodDays: number;
  /**
   * The remedies its healer keeps by them (N9), where its land knows herb-lore: doses in hand and wanted, and the healer
   * (null: none kept).
   */
  readonly remedies: PlaceHealerRow | null;
};
/**
 * A good a town makes, and its bill (N10): how much the town holds of it (units), how much its bill asks it to hold (null:
 * no bill, its makers at their own making; 0: make none), the step its keys move that by, its makers (whose own making
 * it is) and those making it now, and where it is made (a building's page, or null: at home or outside the town).
 */
export type PlaceBillRow = {
  readonly good: number;
  readonly name: string;
  readonly unit: string;
  readonly held: number;
  readonly until: number | null;
  readonly step: number;
  readonly makers: number;
  readonly making: number;
  readonly where: string;
  readonly ref: string | null;
  /** Its place among the bills (0 the first; null: no bill). */
  readonly order: number | null;
};
/** One of a town's stores and what it takes (N10): the store (0 its market, 1 its granary), and each good it is for. */
export type PlaceStoreTakes = {
  readonly store: number;
  readonly goods: readonly { readonly good: number; readonly name: string; readonly takes: boolean; readonly held: number }[];
};
/** A place's healer (N9): who, their page, what they are at, their doses of remedies in hand and wanted, the hurt abed. */
export type PlaceHealerRow = {
  readonly ref: string;
  readonly name: string;
  readonly doing: string;
  readonly doses: number;
  readonly wanted: number;
  readonly abed: number;
  readonly festering: number;
};
export type PlaceWorkSheet = {
  /** Its grown hands at each trade an order can move now, and the shares ordered (thousandths; null: as its land has them). */
  readonly hands: readonly number[];
  readonly shares: readonly number[] | null;
  /** The rest of its people: leaders, those with no trade (the young and the old), foragers. */
  readonly leaders: number;
  readonly dependents: number;
  /** Those waiting at their work for want of stuff, and those in want a day or more. */
  readonly waiting: number;
  readonly inWant: number;
  readonly unsettled: number;
  /** Those too low in mood to heed an order to change their work, and those abed, hurt or sick. */
  readonly unheeding: number;
  readonly abed: number;
  /** Its healer, where its land knows herb-lore (N9; null: none). */
  readonly healer: PlaceHealerRow | null;
  /** Its bills (N10): each good its land knows how to make, those billed first in their order. */
  readonly bills: readonly PlaceBillRow[];
  /** Its buildings where work is done: how many work at each, and whether its work is stopped by order. */
  readonly buildings: readonly {
    readonly lot: number;
    readonly ref: string;
    readonly name: string;
    readonly working: number;
    readonly shut: boolean;
  }[];
  /** What it was asked to raise that is still going up. */
  readonly sites: readonly PlaceSiteRow[];
  /**
   * Who works at what, and in what order (its priorities, place.prio): the kinds of work, and its grown at the trades an
   * order can move, those with priorities set first, as many as a sheet shows; and how many there are in all.
   */
  readonly grid: {
    /** The kinds a priority is set for (PRIO_KINDS'), and the kinds each row's skill is told at (the same, then those that take none). */
    readonly kinds: readonly string[];
    readonly skills: readonly string[];
    readonly rows: readonly PlacePrioRow[];
    readonly all: number;
  };
};
/** One of a place's people on its priorities grid. */
export type PlacePrioRow = {
  readonly id: number;
  readonly ref: string;
  readonly name: string;
  /** Their trade (the world's occupation column), and their skill at it in a word ("a master"). */
  readonly occ: number;
  readonly skill: string;
  /** Their priorities, a kind each (0 never … 3 first), and whether any were set by an order (else as they are of themselves). */
  readonly kinds: readonly number[];
  readonly set: boolean;
  /** What they have turned to for now, their own trade having nothing for them (the occupation column; 0: their own). */
  readonly turned: number;
  /** Their skill at each of the grid's skill columns (PlaceWorkSheet.grid.skills' order). */
  readonly skills: readonly PlaceSkillCell[];
};
/** One's skill at a kind of work, short: hours given to it, its level (0 new … 4 a master), how fit for it, whether taught it. */
export type PlaceSkillCell = {
  readonly hours: number;
  readonly level: number;
  readonly words: string;
  readonly fit: number;
  readonly passion: boolean;
};
/** A site on a place's Work sheet. */
export type PlaceSiteRow = {
  /** The asking behind it (its number among its town's), its lot's page, and what it will be ("granary"). */
  readonly ask: number;
  readonly ref: string;
  readonly name: string;
  /** How far it has got (0 … 1), and what is seen of it ("its walls rising"). */
  readonly share: number;
  readonly stage: string;
  /** Whether the town has it in hand, with how many hands, the most it can put to it, and how many are at it now. */
  readonly inHand: boolean;
  readonly hands: number;
  readonly most: number;
  readonly busy: number;
  /** Why no more: how its town took the asking up ("the town took the asking up gladly"). */
  readonly spares: string;
  /** What it is built of, in a word, and the tonnes of it lying on the site and still wanted. */
  readonly stuff: string;
  readonly lying: number;
  readonly wants: number;
  readonly stopped: boolean;
  readonly raised: boolean;
  /** Months more, at its hands' usual rate. */
  readonly months: number;
};
/**
 * What happened in a place, day by day, the latest first: when (its clock), said, the page that tells more, and the day
 * it is of ("Today", "Yesterday", "Day 41 of year 150"). A death or a hurt has a line of its own; of the rest a day tells
 * a few of a kind and counts the others.
 */
export type PlaceLogSheet = {
  /** Its doings by its orders its land has yet to be told (told at the month's turn, or on leaving). */
  readonly unsettled: number;
  readonly rows: readonly {
    readonly t: number;
    /** What kind of happening (host/place.ts HAP), whom it was of by name, and what befell them said after it. */
    readonly what: number;
    readonly name: string;
    readonly told: string;
    /** What many of the kind did, said ("were hurt"), for a line of several. */
    readonly many: string;
    readonly words: string;
    readonly ref: string | null;
    readonly day: string;
  }[];
};

/** What threatens a place, whom it has touched, and what it can be held to against it. */
export type PlaceDangersSheet = {
  /** What bears on the town now, each said, with the page that tells more (null: none). */
  readonly now: readonly {
    readonly icon: string;
    readonly words: string;
    readonly ref: string | null;
  }[];
  /** Those hurt by what struck it or wounded in its battles, lying abed now: who, said, their page. */
  readonly hurt: readonly { readonly name: string; readonly words: string; readonly ref: string }[];
  /** Who tends its hurt and sick, and what its land knows of care, said. */
  readonly care: string;
  /** Households that lost their home these two months: how many, their people, how many of them shelter in a building. */
  readonly homeless: {
    readonly households: number;
    readonly people: number;
    readonly sheltered: number;
    /** Those of them with no roof at all: living in the square, in the weather. And how cold the air is on them now (0 … 1). */
    readonly roofless: number;
    readonly cold: number;
  };
  /** The building opened to those without a home (null: none), and those that could be. */
  readonly shelter: {
    readonly lot: number | null;
    readonly options: readonly { readonly lot: number; readonly name: string }[];
  };
  /** What it can be held to by an order: what it is, whether it stands, what it does, who it takes, what it costs. */
  readonly responses: readonly {
    readonly what: string;
    readonly name: string;
    readonly on: boolean;
    readonly does: string;
    readonly who: string;
    readonly cost: string;
    /** What it gains, and what it takes, in a few words each. */
    readonly gain: string;
    readonly price: string;
  }[];
};
