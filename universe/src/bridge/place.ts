// A place (town mode, first slice): what the host tells the page of a town kept in detail (host/place.ts). Its people
// are the plan's people while the mode is on, each by a ref of their own; where each is, lot by lot, comes a few times
// a second and the page draws them between.

/** Where one is that is no lot: nowhere yet, the fields and pastures outside the town, its square. */
export const PLACE_AT = { none: -1, fields: -2, square: -3 } as const;

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
} as const;

/** The page of one of a place's people, and of one of its lots (its square and its fields too). */
export const placePersonRef = (town: string, id: number): string => `plc:${town}:${id}`;
export const placeLotRef = (town: string, lot: number): string => `plcl:${town}:${lot + 3}`;
/** Who a plan's person is in their town's place (null: not one of a place's). */
export function placedId(ref: string): number | null {
  if (!ref.startsWith("plc:")) return null;
  const id = Number(ref.slice(ref.lastIndexOf(":") + 1));
  return Number.isInteger(id) ? id : null;
}

/** A place's people as they stand at a tick: those asked for, in the order asked. */
export type PlaceFrame = {
  readonly town: string;
  /** The place's clock (seconds of the world's), and the length of its tick. */
  readonly t: number;
  readonly tick: number;
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

export type PlaceNotice = {
  readonly key: string;
  readonly words: string;
  readonly ref: string | null;
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
  /** Their mood, -100 … 100; how they are (0 well, 1 hurt, 2 sick); the trade an order holds them to (null: none). */
  readonly mood: number;
  readonly health: number;
  readonly bound: string | null;
  /** Who they are in the place, for an order given them; and their household (its key), for a home given it. */
  readonly id: number;
  readonly house: number;
  /** The building an order puts them at (its lot; null: none). */
  readonly post: number | null;
};
export type PlacePeopleSheet = {
  /** How many of each trade (the world's occupation columns), and the rows asked for: the most pressed first. */
  readonly trades: readonly number[];
  readonly rows: readonly PlacePersonRow[];
  readonly all: number;
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
};
export type PlaceStocksSheet = {
  readonly rows: readonly PlaceStockRow[];
  /** Months of food its granary holds back, and the days of food it holds in all. */
  readonly hold: number;
  readonly foodDays: number;
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
  readonly rows: readonly {
    readonly t: number;
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
  }[];
};
