// A place (town mode, first slice; asked 2026-11-25): one entered town kept in detail. The god game holds a town as
// counts (its land's people by sex, age and trade, its market's stocks, its fabric of lots); the people seen in the town
// view are read off the world each time it is looked at and nothing of them lasts. A place lasts: every one of the
// town's people is an individual with needs, a household, a home lot, a place of work and what they carry, and every
// building and pantry holds stocks good by good. It is made from the world's state and its seed at the moment of
// entry, stepped in ten-minute ticks to the world's own clock while it is looked at, kept when it is left (in the save
// too), and brought forward on return: tick by tick for a short absence, reconciled against the world's counts for a
// long one. It is a faithful refinement of the world's numbers: it shares them out, it never changes a total.
//
// How it stays out of history. The store is observational and outside the rules (as readings.years is): never hashed,
// no part of the ruleset's identity, nothing kept until a town is entered. It has no system on the scheduler: it is
// advanced only when its frame is asked for, on a fixed grid of ticks, so asking often or seldom gives the same place.
// Its draws go through the world's Rng on a stream of its own that is not put in the ruleset's registry.
//
// What bounds it. Only entered towns are kept: at most PLACES_MOST of them and PEOPLE_MOST people in all, the least
// lately entered let go first. A town of more than PLACE_MOST people keeps that many as individuals, a whole-number
// share of its table (its heart's homes); the rest stay counts, and the two add up to the town.
//
// How management reaches the world (second slice). Orders are kernel commands kept by a ruled store that is out of the
// hash until the first is given (sim/town/managed.ts): the hands put to each trade, the food its granary holds back, the
// goods its market will not let go; what a town is asked to raise is the god game's own asking (sim/town/asks.ts). The
// place reads its orders and lives by them. What it then did that its land's reckoning would not have (hands changed
// from trade to trade, those dead of want) is told back in a command of its own, `place.settle`, its numbers told by
// the host as the command is taken (Universe.told, settleOf below), at each month's turn while the town is watched and
// on leaving; the world writes them to its land's counts, never more than the land has. What those hands then make is
// the land's own reckoning of its trades: the made and the used are counted once, there, not here as well. A managed
// town's table is its land's shared as if it had moved no one, with those it moved laid over it (targetTable).
//
// What each of its people carries besides (third slice). Health: hurt at their work by their trade's own wear (hazardOf),
// or sick of the sickness its land's own reckoning has come this year or last (sim/health), abed at home by the days a
// wound takes with who tends it (rules/healing.ts); who dies of a sickness is the world's to say, and at a matching the
// sick are the first to go, so nothing is counted twice. A mood, from needs met over the days gone and what befell their
// household, with its causes kept; it moves what their work is worth, and too low it heeds no order to change work. A
// friend made in company. Orders by name (a trade, a building), a building's work stopped, a household given a home.
//
// Sites (fourth slice). A building the town was asked to raise (sim/town/asks.ts) is a site of the place while it goes up:
// one of its buildings, not yet worked in. Left alone it goes up by its land's month, exactly as in the god game, and the
// place only shows how far it has got. Taken in hand by an order (sim/town/managed.ts place.site, so many hands), a crew of
// the place's own grown is put to it: they bring what it is built of from outside the town a load at a time (a third of
// their body's weight), build it in at the site (SITE_TONNES to a person-month, the world's own bill), wear the tools its
// carriers bring it from the market, and eat half again as much for the work. What they did is told to its land with the
// town's other doings (place.settle: person-months, and over how long); the land's month puts no hands of its own to the
// site for the time told, so nothing is raised twice, and the thing is finished by the world's own rule, there.
// Its walls are a site too, though they stand on no lot: its place is the length of their line the work has come to
// (PLACE_AT.walls; bridge/streets.ts wallAt), where its crew builds and its view draws them.
//
// What threatens it (fourth slice). The world's own reckoning says what a fire, a quake, fire from the sky, a strike from
// the air, a battle, a siege, a sickness or a lean year costs a town; the place says whom. A strike (host/town.ts
// strikesOn: what the town's plan is told) is read as its clock passes it: the households whose home it took are named
// and go to the building opened to them by an order, or in with others; as many are hurt as the strike's own count, abed
// as a wound is; and as many die as the world's count says, those of the homes struck first, taken only of the kinds its
// land's count is short by (a death the place cannot yet place waits for the next matching, and is told then). A fire is
// fought for a day by the grown who live near it. At a year's turn its men's tally in each battle (host/burials.ts) names
// who fell and who came home wounded. While a siege lies about it no one goes out to its fields. At every matching the
// sick who go are told as dead of their sickness, and in a lean year those long in want as starved. Nothing is removed
// here that the world has not removed, and nothing twice: who dies is the world's count, kind for kind.
// Orders against them (sim/town/managed.ts place.respond, place.shelter) change what comes only through the world's own
// rules, which read them; here they move who stands where: a watch of so many who go to any fire in the town, the sick's
// households kept from the square, a share of its grown standing to arms.
//
// What opening it over real worlds found (fifth slice). What a town eats. Its land's month wins a month's food, eats, and
// keeps what is left; a town lives by the day. Its own hands win what its fields and flocks ripen by the calendar (a year's
// making to each hand its land counts at them, up to the town's share by head: `ripe`, `win`); the rest of its share, what
// its land's foragers and the farmers outside it win, is brought in to its store through the month (`bring`); a mouth eats
// what its land's reckoning counts it to eat; and between two reckonings it has some days' bread in the house (breadOf).
// So where its land was fed the town is, and where its land went short the town goes short by about as much, and it is no
// longer all in want beside a full store, or all fed in a famine. Its people live in all its homes, each as full as the
// town is of its beds. What strikes at a month's turn is read before the matching. A sickness that comes is read at the
// matching after: its dead are the share of its land's it killed, named, and those who took it and lived lie abed. The
// dead the world has counted are all named at a year's turn, whatever kinds its people are, and counted beside the log.
// Who turns out to a fire lives within a cry of it by its streets. Those who lose a home and find no room under another
// live in the square, in their land's own weather, until a building is opened or a home has room.
//
// Stated limits. A town's table is a reading (the world keeps none per town): its land's ages and sexes by head-count,
// its trades leaned to where its land's buildings of each work stand (tradeLean). Only the
// holders of its roster's lines are the god game's named people here (linkRoster); a realm's key figures stand before
// their doors as the town view has them, without needs. Its clock is the town view's standard day and year, not the
// world's own (see frameOf). A walk between the lots nearest its square is reckoned by the very streets its view walks
// (bridge/streets.ts: the street graph is the bridge's, read by both); a walk out to its fields, to one's own field
// where its plan means it to lie (host/village.ts townFieldsMeant: the fan its view draws, before its ground is read; a
// field its ground moved is walked to where it was meant). Wool, hides
// and the rest that no one here wins come and go at the month's matching. A land of several peoples is read by its
// first's body. What the granary holds back and the market forbids move who eats and who works within the town; they
// reach the world only through who then changes trade or dies. Deaths of want are reckoned only in a managed town,
// where they can be told to its land. If a managed town is let go from memory before it is settled (the cap, below),
// what it had yet to tell is lost with it: the page settles on leaving, so this needs a fifth town entered meanwhile.
//
import {
  DAY,
  HOUR,
  MONTH,
  YEAR,
  Hasher,
  apportion,
  hashString,
  type Ref,
  type Stream,
  type StateStore,
  type World,
} from "../kernel/index.ts";
import { LOT_D, LOT_W, PLACE_ACT, PLACE_AT, placeFieldOf } from "../bridge/index.ts";
import {
  BANDS,
  CIVICS,
  DRESS,
  FEMALE,
  FOODS,
  G,
  GOODS,
  HEAL_CARE,
  HEAL_DAYS,
  HEAL_TENDED,
  HOLDS,
  MEMBERS,
  OUR_STATURE,
  anatomyOf,
  bodyFunction,
  limbShare,
  healDays,
  hurtWeights,
  lastingOf,
  memberOf,
  outcomeOf,
  woundCare,
  type Anatomy,
  type Member,
  type Blow,
  type Lasting,
  type Tended,
  LESSON_RESPONSE,
  SKILL_LEVELS,
  SKILL_WORDS,
  levelOf,
  OCC,
  OCCUPATIONS,
  RECIPES,
  SEXES,
  TOOL_GAIN,
  WANTS,
  WAY,
  ownLeaning,
  bandOf,
  tendedBy,
  coatOf,
  dayOf,
  nightFall,
  affordancesOf,
  type BodyPlan,
  type LifeHistory,
} from "../rules/index.ts";
import {
  SHARE,
  SHARES_STORE,
  SITE_TONNES,
  SITE_TOOL_MONTHS,
  WORK_SHARE,
  ASK_PULL,
  asksOf,
  cultureOf,
  heartOf,
  siegesOf,
  siteInHand,
  siteMostHands,
  siteOwed,
  homePlanet,
  levelsOf,
  lifeOf,
  familySizeOf,
  managedDead,
  managedOf,
  MANAGED_TRADES,
  PRIO_KINDS,
  prioOf,
  prioTrade,
  healthOf,
  kindBody,
  lifeOfBody,
  loreOf,
  marketsOf,
  mixOf,
  peopleNameOf,
  moneyStore,
  populationContext,
  townsOf,
  type Ask,
  type Managed,
  type SettleBuilt,
  type SettleDead,
  type SettleMove,
  type Settlement,
} from "../sim/index.ts";
import { streetDoor, streetsOf, townLots, type Streets, type TownStrike } from "../bridge/index.ts";
import { battleWords, battlesOfYear, townTally } from "./burials.ts";
import { linesOf, townRoster, workOf as lineWork, folkWork } from "./roster.ts";
import { strikesOn, townPlan } from "./town.ts";
import { townFieldsMeant, townSite } from "./village.ts";

// —— Measures ————————————————————————————————————————————————————————————————————————————————————————————————————

/** A tick of a place's clock (seconds): ten minutes. */
export const PLACE_TICK = 600;
const MICRO_ = 1_000_000;
/** The most of a town's people kept as individuals; the most places kept; the most people in all of them. */
export const PLACE_MOST = 6000;
export const PLACES_MOST = 4;
export const PEOPLE_MOST = 12_000;
/** An absence stepped tick by tick: no longer than this (seconds), and across no more than one month's turn. */
export const EXACT_MOST = 3 * DAY;
/** After a long absence, and at its making, a place is stepped this long before it is shown, so its day is under way. */
const SETTLE = DAY;
/** Stocks are kept in millionths of the market's units, whole numbers. */
export const MICRO = 1_000_000;
/** A need runs 0 … FULL. */
const FULL = 65535;
/** Ticks of work in a person-month, as the world's month reckons one (a third of their time at work: WORK_SHARE). */
export const TICKS_PM = Math.round((MONTH * WORK_SHARE) / PLACE_TICK);
/** What a tick of building uses of what the thing is built of (millionths of a tonne), and wears of tools (of a measure). */
const SITE_USE = Math.round((SITE_TONNES * MICRO_) / TICKS_PM),
  SITE_WEAR = Math.round(MICRO_ / (SITE_TOOL_MONTHS * TICKS_PM));
/** One put to a site by its town's order: what `bound` holds for them. And one standing to arms by its order. */
export const BOUND_SITE = 254;
export const BOUND_ARMS = 253;
/**
 * A voice, as sound: what a person's talk and their cry come to a metre off, the stillest air, and what wakes a sleeper
 * (watts a square metre: 60, 90, 30 and 55 decibels). The world keeps no measure of a voice: these are a person's of our
 * own kind, taken for every people.
 */
export const VOICE = { talk: 1e-6, cry: 1e-3, still: 1e-9, wake: 10 ** -6.5 } as const;
/** A year's food that fed fewer than so many in a thousand of its land's needs is a lean one (sim/town/asks.ts: hungry). */
const LEAN = 800;
/** The trades a site's crew is taken from, the first first: the hands a site takes are the fields' (sim/town/asks.ts drain). */
const CREW_FROM: readonly number[] = [OCC.farmer, OCC.herder, OCC.trader, OCC.crafter];
/** The share of a body's own day it sleeps. */
const SLEEP_SHARE = 1 / 3;
/** How fast one walks (metres a second), and the ground a lot takes with its share of street (square metres). */
const WALK = 1.2;
const LOT_GROUND = 200;
/** What a household fetches at once from the town's stores: so many days of its eating. */
const FETCH_DAYS = 7;
/** A load one carries (units of the market's). */
const LOAD = 1;
/** Happenings kept for a place's pages: one for each of its people, no fewer than the first and no more than the second. */
const LOG_LEAST = 96,
  LOG_MOST = 600;

/** Where one is that is no lot (nowhere yet, the fields outside the town, its square), and what one is doing: as the page reads them. */
export const AT = PLACE_AT;
export const ACT = PLACE_ACT;
export const ACT_WORDS = [
  "at rest",
  "asleep",
  "eating",
  "at work",
  "fetching food",
  "carrying",
  "getting warm",
  "among others",
  "waiting",
  "fetching goods",
  "abed",
  "building",
  "bringing what a site is built of",
  "fighting a fire",
  "standing to arms",
  "at a burial",
] as const;

/** Why: the force that decided it. */
export const WHY = {
  none: 0,
  hunger: 1,
  tired: 2,
  cold: 3,
  lone: 4,
  work: 5,
  pantry: 6,
  noFood: 7,
  noStuff: 8,
  young: 9,
  load: 10,
  asleep: 11,
  dark: 12,
  haul: 13,
  shut: 14,
  abed: 15,
  site: 16,
  stuff: 17,
  stopped: 18,
  raised: 19,
  fire: 20,
  arms: 21,
  siege: 22,
  apart: 23,
  turned: 24,
  burial: 25,
} as const;

/** What happened to someone, as a place's log tells it. */
export const HAP = {
  born: 0,
  died: 1,
  came: 2,
  left: 3,
  trade: 4,
  starved: 5,
  ordered: 6,
  sick: 7,
  hurt: 8,
  well: 9,
  assigned: 10,
  moved: 11,
  unheeded: 12,
  bare: 13,
  crew: 14,
  uncrew: 15,
  homeless: 16,
  struckDead: 17,
  struckHurt: 18,
  fell: 19,
  wounded: 20,
  famine: 21,
  plague: 22,
  mustered: 23,
  stoodDown: 24,
  rehoused: 25,
  sheltered: 26,
  mending: 27,
  paired: 28,
  buried: 29,
  ofAge: 30,
} as const;
/** The happenings that are a death. */
const HAP_DEATH: ReadonlySet<number> = new Set([1, 5, 17, 19, 21, 22]);
const HAP_WORDS = [
  "was born",
  "died",
  "came to the town",
  "left the town",
  "took up other work",
  "died of want",
  "was put to other work by the town's orders",
  "fell sick",
  "was hurt at their work",
  "is well again",
  "was put to work by name, by your order",
  "moved with their household to a home given them by your order",
  "would not heed an order to change their work: their mood is too low",
  "found the pantry bare",
  "was put to building, by your order",
  "went back to their own work from a site",
  "lost their home, and their household with them",
  "died",
  "was hurt",
  "fell in battle",
  "came home wounded from battle",
  "starved, in their land's lean year",
  "died of a sickness",
  "stood to arms, by your order",
  "stood down from arms",
  "found a home again with their household",
  "was taken in under a roof with their household, in the building opened to them",
  "is up again, their wound bound",
  "was paired",
  "was buried",
  "came of age",
];

/** The place's draws: through the world's Rng, on a stream no registry holds (it is no part of the ruleset's identity). */
const PLACE_DRAW: Stream = Object.freeze({
  tag: "place.draw",
  version: 1,
  salt: hashString("place.draw#1", 0x2f0b3c6d),
});
const P = {
  age: 1,
  need: 2,
  house: 3,
  worth: 4,
  craft: 5,
  pick: 6,
  rank: 7,
  mother: 8,
  settle: 9,
  angle: 10,
  dying: 11,
  order: 12,
  sick: 13,
  mood: 14,
  ail: 15,
  hurt: 16,
  crew: 17,
  struck: 18,
  arms: 19,
  watch: 20,
  wound: 21,
  due: 22,
} as const;

const NEEDS = 4;
const N = { food: 0, rest: 1, cold: 2, lone: 3 } as const;
export const NEED_WORDS = ["hunger", "tiredness", "cold", "want of company"] as const;
const GOOD_COUNT = GOODS.length;
const OCCS = OCCUPATIONS.length;
const ROWS = SEXES * BANDS;

/** Which of a town's buildings a making is done in, the first that stands (as host/chain.ts reads them). */
const MAKING_AT: Readonly<Record<number, readonly string[]>> = {
  [G.tools]: ["factory", "smithy", "workshop"],
  [G.pottery]: ["kiln", "factory", "workshop"],
  [G.clothing]: ["workshop", "factory"],
  [G.machines]: ["factory", "workshop"],
  [G.copper]: ["smithy", "workshop"],
  [G.tin]: ["smithy", "workshop"],
  [G.iron]: ["smithy", "factory", "workshop"],
};
const KIND_INDEX = new Map<string, number>(CIVICS.map((c, i) => [c.kind as string, i]));
/** (A building's kind among CIVICS; -1 the square; -2 the walls, while they go up.) */
const KIND_WALLS = -2;
const kindName = (k: number): string =>
  k === KIND_WALLS ? "walls" : k < 0 ? "square" : (CIVICS[k]?.kind ?? "building");
/** Where each trade works when no making says: the first of these that stands. */
const TRADE_AT: Readonly<Record<number, readonly string[]>> = {
  [OCC.trader]: ["market", "docks", "station"],
  [OCC.leader]: ["hall", "temple", "shrine", "offices", "academy"],
};
const FOOD_STORES = ["granary", "market"] as const;

// —— Columns —————————————————————————————————————————————————————————————————————————————————————————————————————

/** The people of a place, by column. */
type People = {
  n: number;
  id: Uint32Array;
  /** The day they were born (days of the world's clock; before its first day, negative). */
  born: Int32Array;
  /** Sex × 16 + trade. */
  sexOcc: Uint8Array;
  /** Their making (a recipe's place + 1; 0: none). */
  craft: Uint8Array;
  house: Uint16Array;
  work: Int32Array;
  needs: Uint16Array;
  act: Uint8Array;
  why: Uint8Array;
  at: Int32Array;
  to: Int32Array;
  eta: Uint16Array;
  /** The whole of the walk they are on, in ticks (0: on none): how far along they are is read off it. */
  trip: Uint16Array;
  carryGood: Uint8Array;
  carry: Int32Array;
  /** The line of the town's roster they hold (host/roster.ts; its number + 1, 0: none), and which holder of it they are. */
  line: Uint32Array;
  lineN: Uint16Array;
  /** Ticks a need of theirs has stood full, less the ticks none has since: how long they have gone in want. */
  lack: Uint16Array;
  /** How they are (0 well, 1 hurt, 2 sick), the ticks they have yet to lie abed, and what of (CAUSE; 16 + a sickness's place in the place's names of them). */
  health: Uint8Array;
  ill: Uint16Array;
  cause: Uint8Array;
  /** Their mood, -100 … 100, and what moves it (MOOD's bits). */
  mood: Int8Array;
  moodWhy: Uint8Array;
  /** The trade an order by name holds them to (+ 1; 255: a building only; 254: a site's crew; 0: none). */
  bound: Uint8Array;
  /** A friend made in company (their number; 0: none yet). */
  friend: Uint32Array;
  /**
   * What a wound left them with, for good (0: nothing): the member it was to (its place in MEMBERS, + 1) and, sixteen
   * times, what came of it (1 a scar, 2 a limb left lame). rules/anatomy.ts.
   */
  mark: Uint8Array;
  /**
   * The time gone since they last ate, in half ticks (three a tick while raising a building, which hungers half again):
   * a meal is what its land's reckoning counts a mouth to eat in that time, however much of it was slept.
   */
  owed: Uint16Array;
  /**
   * The ticks they have given to their own trade's work (rules/life.ts: the hours one has given to one's craft, six ticks
   * each; no more counted than a master's), begun anew at a new trade.
   */
  skill: Uint16Array;
  /** The trade they have turned to for now, their own having nothing for them (its place in OCCUPATIONS; 0: their own). */
  turn: Uint8Array;
  /** The one they are paired with (their number; 0: no one; PROMISED: a pairing with their friend is set for a day to come). */
  mate: Uint32Array;
};
/** Bytes a person takes in a place's columns. */
export const PERSON_BYTES =
  4 +
  4 +
  1 +
  1 +
  2 +
  4 +
  2 * NEEDS +
  1 +
  1 +
  4 +
  4 +
  2 +
  2 +
  1 +
  4 +
  4 +
  2 +
  2 +
  1 +
  2 +
  1 +
  1 +
  1 +
  1 +
  4 +
  1 +
  2 +
  2 +
  1 +
  4;

function peopleOf(cap: number): People {
  return {
    n: 0,
    id: new Uint32Array(cap),
    born: new Int32Array(cap),
    sexOcc: new Uint8Array(cap),
    craft: new Uint8Array(cap),
    house: new Uint16Array(cap),
    work: new Int32Array(cap),
    needs: new Uint16Array(cap * NEEDS),
    act: new Uint8Array(cap),
    why: new Uint8Array(cap),
    at: new Int32Array(cap),
    to: new Int32Array(cap),
    eta: new Uint16Array(cap),
    trip: new Uint16Array(cap),
    carryGood: new Uint8Array(cap),
    carry: new Int32Array(cap),
    line: new Uint32Array(cap),
    lineN: new Uint16Array(cap),
    lack: new Uint16Array(cap),
    health: new Uint8Array(cap),
    ill: new Uint16Array(cap),
    cause: new Uint8Array(cap),
    mood: new Int8Array(cap),
    moodWhy: new Uint8Array(cap),
    bound: new Uint8Array(cap),
    friend: new Uint32Array(cap),
    mark: new Uint8Array(cap),
    owed: new Uint16Array(cap),
    skill: new Uint16Array(cap),
    turn: new Uint8Array(cap),
    mate: new Uint32Array(cap),
  };
}
const PEOPLE_COLS = [
  "id",
  "born",
  "sexOcc",
  "craft",
  "house",
  "work",
  "needs",
  "act",
  "why",
  "at",
  "to",
  "eta",
  "trip",
  "carryGood",
  "carry",
  "line",
  "lineN",
  "lack",
  "health",
  "ill",
  "cause",
  "mood",
  "moodWhy",
  "bound",
  "friend",
  "mark",
  "owed",
  "skill",
  "turn",
  "mate",
] as const;
type Col = (typeof PEOPLE_COLS)[number];
const widthOf = (c: Col) => (c === "needs" ? NEEDS : 1);

function grown(p: People, cap: number): People {
  const q = peopleOf(cap);
  q.n = p.n;
  for (const c of PEOPLE_COLS)
    (q[c] as Uint8Array).set((p[c] as Uint8Array).subarray(0, p.n * widthOf(c)));
  return q;
}

/** A household: where it lives, what it lives on, what its pantry holds. */
type Houses = {
  n: number;
  /** For its family's name. */
  key: number[];
  home: number[];
  /** Which fifth of its land's incomes it is of (0: the poorest), and its year's income in grain. */
  fifth: number[];
  means: number[];
  members: number[];
  /** Its pantry, food by food (FOODS' order), millionths. */
  pantry: number[];
  /** The day one of it last died (-1: none has), and the day it was given a new home (-1: never). */
  grief: number[];
  fresh: number[];
  /** The day it lost its home to what struck the town (-1: it has not). */
  lost: number[];
  /** Which of its land's peoples it is of (0: its world's first; n: the n-th besides, sim/population/mix.ts). */
  kind: number[];
};

/** A building with stocks: the square (lot AT.square, kind -1), then each of the town's other buildings standing. */
type Buildings = {
  lot: number[];
  kind: number[];
  start: number[];
  /** Good by good, millionths: GOOD_COUNT to each. */
  stock: number[];
  /** A site, still going up: the asking behind it (its number among its town's, + 1; 0: it stands). */
  site: number[];
};

/** A site the place has in hand (sim/town/managed.ts place.site): what its own people have done on it. */
export type PlaceSite = {
  /** The asking (its number among its town's), and the lot it stands on. */
  readonly n: number;
  readonly lot: number;
  /** Work done on it that its land has not been told, in thousandths of a person's tick; and since when it goes untold. */
  ticks: number;
  from: number;
  /** What it is built of, brought and not yet built in, and all that was brought (millionths of a tonne). */
  stuff: number;
  brought: number;
  /** A walls' site: the length of their line the work has come to (its place in the order they go up). */
  k?: number;
};

/** What the world said when the place was last matched to it: what its ticks run on until the next match. */
type Matched = {
  /** The month of the world's clock it was matched in. */
  month: number;
  /** The land's people then, and the town's (all of them), and those kept here. */
  land: number;
  town: number;
  /** A worker-year's making of each good in its land (units), for those of the trade that makes it. */
  made: number[];
  /** What a year of each trade's work was worth (grain). */
  wage: number[];
  /** Its land's incomes by fifth (thousandths). */
  fifths: number[];
  /** The ways of making its land's crafters worked (a mask over RECIPES). */
  kinds: number;
  /** Lots of the town's plan taken (for how far its fields lie). */
  lots: number;
  /** What its land brings in to its stores (bringOf: millionths a tick, FOODS' order; absent in an old save: nothing). */
  bring?: number[];
  /** What one of its own hands wins in a year at its fields, and at its flocks (bringOf; absent: as `made` has them). */
  win?: number[];
  /** What its land wins of each food in a year at the rate last read, and its books' year so far then (FOODS' order). */
  rate?: number[];
  ytd?: number[];
  /**
   * Its land's peoples where it is of more than one (sim/population/mix.ts: the shares of its world's first, then of each
   * besides, thousandths). Absent: of its world's first people alone.
   */
  mix?: number[];
  /**
   * What its land knows of caring for the hurt and the sick, 0 … 1 (rules/wounds.ts woundCare: herb-lore, medicine, clean
   * water, the small causes of sickness, each as far as it is known there), and whether it knows herb-lore, so that its
   * town keeps a healer (host/village.ts healerOf). Absent in an old save: nothing known.
   */
  care?: number;
  healer?: boolean;
  /** How far its land's food met its needs in the month last reckoned (thousandths; absent in an old save: all of them). */
  fedNow?: number;
  /** How far its land's food met its needs in the year last reckoned (thousandths; absent in an old save: all of them). */
  fed?: number;
  /** Whether a siege lies about it (sim/war/siege.ts: it is its land's heart, and its land is besieged). */
  sieged?: boolean;
  /** Its land's ways (rules/ways.ts WAY_TRAITS' order, each 0 … 1; absent in an old save: the middle of each). */
  ways?: number[];
};

export type PlaceHap = {
  t: number;
  what: number;
  id: number;
  a: number;
  b: number;
  /** Of one who is gone with it (dead, or left): their household's key and their sex, by which they are still named. */
  k?: number;
  s?: number;
};

export type Place = {
  readonly town: Ref;
  readonly cell: number;
  readonly key: number;
  /** When it was made, and its clock now (seconds of the world's, on the grid of ticks). */
  readonly entered: number;
  t: number;
  /** When it was last looked at, by the store's count of lookings. */
  used: number;
  nextId: number;
  nextHouse: number;
  people: People;
  houses: Houses;
  bldgs: Buildings;
  matched: Matched;
  /** The town's share of its land's stocks when last matched, and what the place has made less what it has eaten and used since. */
  base: number[];
  flow: number[];
  log: PlaceHap[];
  /**
   * What it has done by its orders that its land has not yet been told (sim/town/managed.ts place.settle): those who
   * changed trade, [row, from, to, count] one after another, and those who died of want, [row, trade, count].
   */
  moves: number[];
  dead: number[];
  /** The orders its hands were last put to work by (their shares, said), so they are put once. */
  ordered: string;
  /** Its sites in hand, and what its town was asked to raise as last read (said), so its buildings are read anew when it changes. */
  sites: PlaceSite[];
  sited: string;
  /**
   * Its realm's key figures who live in it (host/leaders.ts: its ruler, an heir, a keeper), each one of its own people:
   * the figure's page, and who they are here.
   */
  figRef: string[];
  figId: number[];
  figName: string[];
  /** The sicknesses its people have had, by name and page ("name|ref"): a person's cause says which by its place here. */
  ills: string[];
  /** The moment up to which what struck its town has been read (host/town.ts strikesOn). */
  seen: number;
  /** The last coming of a sickness to its land it has read (the outbreak's event; "": none yet). */
  plague: string;
  /**
   * How many its log has told of each kind of death, and of those who took a sickness that came and lived, this year and
   * last, four numbers each: the year, what (HAP), of what (a cause, a battle, a sickness; 0), how many. Its log lets go
   * of the oldest lines; a count of the dead does not.
   */
  counts: number[];
  /**
   * Deaths the world has counted that the place has yet to name, one after another: what of (a CAUSE; 100 + a battle's
   * place in `wars`), and how many. The next of its people its land's count takes are told as these.
   */
  tolls: number[];
  /** Those a strike killed whom the place has taken off its people before its town's count was reckoned anew: [year, count]. */
  gone: number[];
  /** A fire being fought: the lot, and until when (none: empty). */
  fire: number[];
  /** The battles its men were in, by name and event ("the battle at …|ref"), and the year whose battles have been read. */
  wars: string[];
  war: number;
  /** What was made and used of each good since the day began (millionths), and the day. */
  day: number;
  madeDay: number[];
  usedDay: number[];
  /** What its land brought in to its stores of each good since the day began (millionths). */
  cameDay: number[];
  /**
   * What its fields and flocks have ready to be won of each good (millionths): it comes by the calendar, as its land's
   * own reckoning has it (a year's making to each of its hands at them), and is won by whoever of them is out there, so
   * that its hands win what its land counts them to win and no more, however long their day.
   */
  ripe: number[];
  /**
   * What its land's count has brought it that it has yet to live: four numbers each, the soonest first: when (its clock),
   * what (DUE), and two numbers of it. Its town's count is reckoned once a year, at the year's turn: the births, deaths,
   * comings and goings that brings are lived on the days of the year after, each on a day and at an hour of its own; what
   * a month's turn brings (its land's ages and trades move by the month), on the days of that month. What waits is counted
   * as lived at every matching, so nothing is brought twice. A burial the day after a death, and a pairing promised, wait
   * here too.
   */
  due: number[];
  /** A burial being held: where, until when, and whose household stands by (none: empty). */
  rite: number[];
};

/** What waits in a place's `due`: a death, a leaving, a birth, a coming, a burial, a pairing. */
const DUE = { die: 1, leave: 2, born: 3, come: 4, bury: 5, pair: 6 } as const;
/** One promised to their friend: their pairing is set for a day to come. */
const PROMISED = 0xffffffff;

// —— What the world says of a town ————————————————————————————————————————————————————————————————————————————————

/** Everything of a world a place's ticks read that never changes: its people's body, its day, its land's warmth. */
type Frame = {
  readonly life: LifeHistory;
  readonly body: BodyPlan | null;
  /** Its own day (seconds), how often they sleep in it, the share of it lit at midsummer and midwinter. */
  readonly day: number;
  readonly sleeps: number;
  readonly lit: readonly [number, number];
  readonly south: boolean;
  readonly year: number;
  readonly mean: number;
  readonly swing: number;
  readonly fall: number;
  readonly coat: number;
  readonly water: boolean;
  readonly social: number;
  readonly sight: number;
  readonly hearth: number;
  /** Levels a tick: hunger awake, tiredness awake, rest asleep, want of company. */
  readonly hunger: number;
  readonly tire: number;
  readonly rest: number;
  readonly lone: number;
  /** Food a grown one eats in a day (millionths), and in half a tick. */
  readonly daily: number;
  readonly half: number;
  /** The legs their body goes on and the arms it handles with (rules/bodies.ts bodyFunction; a ring of tentacles goes on half of them). */
  readonly legs: number;
  readonly arms: number;
  /** What one carries of stone or timber at once (millionths of a tonne): a third of their body's weight (est, as a beast bears). */
  readonly load: number;
  /** Their body's members: what a wound can be to (rules/anatomy.ts). */
  readonly anatomy: Anatomy;
};
const FRAMES = new WeakMap<World, Map<number, Frame>>();

/**
 * A land's frame for one of its peoples (`kind` 0: its world's first; n: the n-th besides, sim/population/mix.ts): their own
 * body's coat, sight, company, appetite, load and members. Its bands of life stay its world's first people's: its land's
 * table is counted by them.
 */
function frameOf(world: World, cell: number, kind = 0): Frame {
  let of = FRAMES.get(world);
  if (!of) FRAMES.set(world, (of = new Map()));
  let f = of.get(cell * 256 + kind);
  if (f) return f;
  const g = homePlanet(world).generated,
    store = kind > 0 ? mixOf(world) : null,
    own = store && store.kinds[kind - 1] ? kindBody(g, store, kind) : null,
    life = own ? { ...lifeOf(world), appetite: lifeOfBody(own).appetite } : lifeOf(world),
    body = own ?? g.life.people?.body ?? null,
    // (The town view's sky keeps a standard day and year whatever the world's own (view/weather.ts, view/village.ts), and
    // a place is seen under that sky: it keeps the same clock, or its people would sleep under the view's noon. When the
    // view takes a world's own day, this is the one line to change: g.planet.dayHours, and yearDays below.)
    dayHours = 24,
    lat = g.grid.lat[cell] ?? 0,
    d = dayOf(lat, g.planet.tilt, dayHours),
    day = DAY,
    // (A body's own day: one sleep and one waking, as often in its world's day as its people sleep.)
    cycle = day / d.sleeps,
    awake = cycle * (1 - SLEEP_SHARE),
    // (Warm blood burns twice what cold does, rules/species.ts: it is hungry twice as often. Three meals to a waking.)
    meal = (awake / 3) * (body && !body.warm ? 2 : 1),
    perSecond = (life.appetite * MICRO) / MONTH,
    does = body ? bodyFunction(body) : { legs: 2, arms: 2 };
  f = {
    life,
    body,
    day,
    sleeps: d.sleeps,
    lit: [d.summerLight / dayHours, d.winterLight / dayHours],
    south: lat < 0,
    year: YEAR,
    mean: g.climate.temperature[cell] ?? 10,
    swing: g.climate.seasonality[cell] ?? 8,
    fall: d.fall,
    coat: coatOf(body?.skin),
    water: body?.medium === "water",
    social: body?.social ?? 0.5,
    sight: body ? affordancesOf(body).sight : 1,
    hearth: Math.max(1, familySizeOf(world)),
    hunger: Math.max(1, Math.round((FULL * PLACE_TICK) / meal)),
    tire: Math.max(1, Math.round((FULL * PLACE_TICK) / awake)),
    rest: Math.max(1, Math.round((FULL * PLACE_TICK) / (cycle * SLEEP_SHARE))),
    lone: Math.round(((body?.social ?? 0.5) * FULL * PLACE_TICK) / (2 * awake)),
    daily: perSecond * DAY,
    half: (perSecond * PLACE_TICK) / 2,
    legs: does.legs > 0 ? does.legs : Math.max(1, does.arms / 2),
    arms: Math.max(1, does.legs > 0 ? does.arms : does.arms / 2),
    load: Math.max(1000, Math.round(((body?.size ?? 60) / 3) * 1000)),
    anatomy: anatomyOf(body),
  };
  of.set(cell * 256 + kind, f);
  return f;
}

/** Which of its land's peoples one of a place's people is of: their household's. */
const kindOf = (place: Place, i: number): number => place.houses.kind[place.people.house[i]!] ?? 0;
/** Their own people's frame. */
const frameFor = (world: World, place: Place, i: number): Frame =>
  frameOf(world, place.cell, kindOf(place, i));

/** Which people one of a place's is of, where its land is of more than one: their number, and their people's name (null: of one people). */
export function placeKind(
  world: World,
  place: Place,
  i: number,
): { kind: number; name: string } | null {
  if (!place.matched.mix || place.matched.mix.filter((x) => x > 0).length < 2) return null;
  const kind = kindOf(place, i);
  return { kind, name: peopleNameOf(homePlanet(world).generated, mixOf(world), kind) };
}

/**
 * The people a household new to a place is of, where its land is of more than one: the one the place is shortest of
 * against its land's shares, by its people now. 0 where its land is of one.
 */
function kindFor(place: Place): number {
  const mix = place.matched.mix;
  if (!mix || mix.length < 2) return 0;
  const have = new Array<number>(mix.length).fill(0);
  let all = 0,
    sum = 0;
  for (let h = 0; h < place.houses.n; h++) {
    have[place.houses.kind[h] ?? 0]! += place.houses.members[h]!;
    all += place.houses.members[h]!;
  }
  for (const x of mix) sum += Math.max(0, x);
  let best = 0,
    short = -Infinity;
  for (let k = 0; k < mix.length; k++) {
    if (!(mix[k]! > 0)) continue;
    const lack = (mix[k]! / Math.max(1, sum)) * (all + 1) - have[k]!;
    if (lack > short) {
      short = lack;
      best = k;
    }
  }
  return best;
}

/** The share of the year gone at a moment, from midwinter, and of its day, from midnight. */
function clockOf(f: Frame, t: number): { season: number; hour: number } {
  const y = (((t % f.year) + f.year) % f.year) / f.year,
    season = f.south ? (y + 0.5) % 1 : y;
  return { season, hour: (((t % f.day) + f.day) % f.day) / f.day };
}

/** How warm the air is at a moment (its land's degrees), and whether its sun is up. */
export function airOf(f: Frame, t: number): { warmth: number; lit: boolean } {
  const { season, hour } = clockOf(f, t),
    high = (1 - Math.cos(2 * Math.PI * season)) / 2,
    light = f.lit[1] + (f.lit[0] - f.lit[1]) * high;
  return {
    warmth:
      f.mean -
      f.swing * Math.cos(2 * Math.PI * season) +
      (f.fall / 2) * Math.sin(2 * Math.PI * (hour - 0.375)),
    lit: Math.abs(hour - 0.5) < light / 2,
  };
}

/** How far the cold bites one out of doors, 0 … 1: by the air now and their coat (rules/dress.ts warmthNeeded's measure). */
const coldOf = (f: Frame, warmth: number): number =>
  f.water ? 0 : Math.max(0, Math.min(1, (DRESS.comfort - warmth) / DRESS.span)) * f.coat;

/** How far the cold bites one of a place's people out of doors now, 0 … 1 (its land's air at its clock, their coat). */
export function placeCold(world: World, place: Place): number {
  const f = frameOf(world, place.cell);
  return coldOf(f, airOf(f, place.t).warmth);
}

/** The trades plied in buildings, and the buildings each is plied in (their kinds): where those of the trade live. */
const PLIED_AT: readonly (readonly [number, readonly string[]])[] = [
  [OCC.crafter, ["smithy", "kiln", "workshop", "factory"]],
  [OCC.trader, ["market", "docks", "station"]],
  [OCC.leader, ["hall", "temple", "shrine", "offices", "academy"]],
];
/**
 * The hands a building has room for: its lot's floor by the ground one at work takes, a circle a body's length about them
 * with a tool in hand. A people lay their lots to their own measure (rules/stature.ts lotScale), so it is the same count
 * for any people.
 */
export const HANDS_A_BUILDING = Math.floor((LOT_W * LOT_D) / (Math.PI * OUR_STATURE ** 2));
type Plied = {
  readonly year: number;
  /** Its land's towns' people, and their buildings each trade is plied in (PLIED_AT's order). */
  readonly people: number;
  readonly all: readonly number[];
  readonly towns: ReadonlyMap<string, readonly number[]>;
};
const PLIED = new WeakMap<World, Map<number, Plied>>();
/** Where a land's trades are plied: the buildings of each among its towns, read once a year. */
function pliedIn(world: World, cell: number): Plied {
  let of = PLIED.get(world);
  if (!of) PLIED.set(world, (of = new Map()));
  const year = Math.floor(world.now / YEAR),
    was = of.get(cell);
  if (was && was.year === year) return was;
  const ctx = populationContext(world),
    fabrics = townsOf(world),
    all = PLIED_AT.map(() => 0),
    towns = new Map<string, number[]>();
  let people = 0;
  for (const t of ctx.settlements.seenIn(cell)) {
    if (t.population <= 0) continue;
    people += t.population;
    const f = fabrics.get(t.ref);
    if (!f) continue;
    const mine = PLIED_AT.map(() => 0);
    for (const c of f.civics) {
      if ((c.fell !== null && c.fell <= year) || c.end > year) continue;
      PLIED_AT.forEach(([, kinds], k) => {
        if (kinds.includes(c.kind)) {
          mine[k]!++;
          all[k]!++;
        }
      });
    }
    towns.set(t.ref, mine);
  }
  const read: Plied = { year, people, all, towns };
  of.set(cell, read);
  return read;
}

/**
 * How a town leans from its share by head of each trade (a number a trade; 1: by heads): those of a trade plied in
 * buildings live where its buildings stand. As many of its land's of the trade as its buildings of that work have room
 * for (HANDS_A_BUILDING each) follow them, town by town; the rest, who ply it at home and by the road, are shared by
 * heads: a market town holds more of its land's traders and a town with no smithy fewer of its crafters. By heads where
 * its land has no such building.
 */
export function tradeLean(world: World, s: Settlement): number[] {
  const lean = new Array<number>(OCCS).fill(1),
    plied = pliedIn(world, s.cell),
    mine = plied.towns.get(s.ref);
  if (!mine || plied.people <= 0 || s.population <= 0) return lean;
  const heads = s.population / plied.people,
    land = populationContext(world).provinces.get(s.cell);
  PLIED_AT.forEach(([occ], k) => {
    const of = land?.occupation(occ) ?? 0;
    if (plied.all[k]! <= 0 || of <= 0) return;
    // (Of its land's of the trade, the share its buildings of the work have room for.)
    const housed = Math.min(1, (HANDS_A_BUILDING * plied.all[k]!) / of);
    lean[occ] = 1 - housed + (housed * (mine[k]! / plied.all[k]!)) / heads;
  });
  return lean;
}

/**
 * A town's own table (sex and band by trade). Its ages and sexes are its land's, shared by head-count to as many as the
 * town holds, largest remainders first; within each, its trades are its land's leaned to where each is plied (tradeLean:
 * its land's crafters, traders and leaders live by its buildings of their work), its foragers left out while the rest of
 * the land can fill it, since they live in no town. Whole numbers, never more of a kind than its land has, adding up to
 * the town's people (or to its land's, where the town's count has run ahead of it within a year).
 */
export function townTable(
  world: World,
  s: Settlement,
  /** What a managed town has moved of its land's counts (sim/town/managed.ts Managed.own): shared as if it had not. */
  own: readonly number[] | null = null,
  /** Those of it dead since its count was last reckoned. */
  less = 0,
): number[] {
  const p = populationContext(world).provinces.get(s.cell),
    out = new Array<number>(ROWS * OCCS).fill(0);
  if (!p) return out;
  const w = new Array<number>(ROWS * OCCS);
  let settled = 0,
    all = 0;
  for (let r = 0; r < ROWS; r++)
    for (let o = 0; o < OCCS; o++) {
      const c = Math.max(0, p.counts.get(r, o) - (own?.[r * OCCS + o] ?? 0));
      w[r * OCCS + o] = c;
      all += c;
      if (o !== OCC.forager) settled += c;
    }
  const people = Math.max(0, Math.min(Math.round(s.population) - less, all));
  if (people <= 0) return out;
  if (people <= settled) for (let r = 0; r < ROWS; r++) w[r * OCCS + OCC.forager] = 0;
  const lean = tradeLean(world, s);
  if (lean.every((x) => x === 1)) return apportion(people, w);
  // Its ages and sexes by heads; within each, its trades leaned, none past what its land has of the kind.
  const rows = new Array<number>(ROWS).fill(0);
  for (let r = 0; r < ROWS; r++) for (let o = 0; o < OCCS; o++) rows[r]! += w[r * OCCS + o]!;
  const each = apportion(people, rows);
  for (let r = 0; r < ROWS; r++) {
    let left = each[r]!;
    const open = new Array<number>(OCCS).fill(0);
    for (let o = 0; o < OCCS; o++) open[o] = w[r * OCCS + o]! * lean[o]!;
    // (What a leaning would take past its land's count of a kind goes to the row's other trades.)
    for (let pass = 0; pass < OCCS && left > 0 && open.some((x) => x > 0); pass++) {
      const got = apportion(left, open);
      let over = false;
      for (let o = 0; o < OCCS; o++) {
        const room = w[r * OCCS + o]! - out[r * OCCS + o]!,
          take = Math.min(got[o]!, room);
        out[r * OCCS + o]! += take;
        left -= take;
        if (take >= room) {
          open[o] = 0;
          over ||= got[o]! > take;
        }
      }
      if (!over) break;
    }
  }
  return out;
}

/** The part of a town's table kept as individuals: all of it, or PLACE_MOST of it shared the same way. */
export function keptTable(table: readonly number[]): number[] {
  let all = 0;
  for (const c of table) all += c;
  return all <= PLACE_MOST ? [...table] : apportion(PLACE_MOST, table);
}

/**
 * The table a place's people are matched to: its town's, and where the town is managed (sim/town/managed.ts) its land's
 * shared as if the town had moved no one, with those it moved laid over it: the hands its orders changed stay changed,
 * told to its land already or not yet. No kind below nothing: what a row lacks is taken of its fullest kind.
 */
export function targetTable(world: World, s: Settlement, place: Place | null): number[] {
  const m = managedOf(world)?.get(s.ref),
    year = Math.floor(world.now / YEAR);
  let waiting = 0;
  if (place) for (let k = 0; k < place.dead.length; k += 3) waiting += place.dead[k + 2]!;
  // (And those a strike killed, taken off its people here already: its town's count is reckoned anew at the year's turn.)
  if (place)
    for (let k = 0; k < place.gone.length; k += 2)
      if (place.gone[k] === year) waiting += place.gone[k + 1]!;
  const t = keptTable(townTable(world, s, m?.own ?? null, managedDead(m, year) + waiting));
  if (!m && !place?.moves.length) return t;
  if (m) for (let c = 0; c < t.length; c++) t[c]! += m.own[c]!;
  if (place)
    for (let k = 0; k < place.moves.length; k += 4) {
      const row = place.moves[k]!,
        n = place.moves[k + 3]!;
      t[row * OCCS + place.moves[k + 1]!]! -= n;
      t[row * OCCS + place.moves[k + 2]!]! += n;
    }
  for (let r = 0; r < ROWS; r++)
    for (let o = 0; o < OCCS; o++) {
      const c = r * OCCS + o;
      while (t[c]! < 0) {
        let most = r * OCCS;
        for (let k = 1; k < OCCS; k++) if (t[r * OCCS + k]! > t[most]!) most = r * OCCS + k;
        if (t[most]! <= 0) {
          t[c] = 0;
          break;
        }
        const give = Math.min(-t[c]!, t[most]!);
        t[most]! -= give;
        t[c]! += give;
      }
    }
  return t;
}

/** A town's share of its land's stocks, good by good, in millionths: by the heads kept against its land's. */
function stockShare(world: World, cell: number, kept: number): number[] {
  const m = marketsOf(world).get(cell),
    land = populationContext(world).provinces.get(cell)?.total() ?? 0,
    out = new Array<number>(GOOD_COUNT).fill(0);
  if (!m || land <= 0) return out;
  for (let g = 0; g < GOOD_COUNT; g++)
    out[g] = Math.floor((Math.max(0, m.stock[g]!) * MICRO * Math.min(kept, land)) / land);
  return out;
}

/** What a land knows of healing by a year: the care its hurt and sick get, and whether its towns keep a healer. */
function careOf(world: World, cell: number, year: number): { care: number; healer: boolean } {
  const lore = loreOf(world),
    known = (id: string) => (lore.get(cell, id)?.year ?? Infinity) <= year;
  return { care: woundCare(known), healer: known("herbalism") };
}

/**
 * What a land makes of a good in a year, as its books say: last year's; of a food, which its land's month brings in month
 * by month, this year's so far at a year's rate once a month of it is reckoned, so that a year of failed fields is one here
 * while it is one there.
 */
function landMade(
  m: NonNullable<ReturnType<ReturnType<typeof marketsOf>["get"]>>,
  g: number,
  month: number,
  /** What was read at a matching before, in the same year: then the months since, at a year's rate. */
  was?: Matched,
): number {
  const ran = ((month % 12) + 12) % 12;
  if (!GOODS[g]!.food || ran <= 0) return Math.max(0, m.book("made", g));
  const k = FOODS.indexOf(g),
    since = was?.ytd && was.month < month && month - was.month < ran ? month - was.month : 0;
  return since > 0
    ? (Math.max(0, m.line("made", g) - was!.ytd![k]!) * 12) / since
    : (Math.max(0, m.line("made", g)) * 12) / ran;
}

/**
 * What comes in to a town's stores from its land (millionths a tick, FOODS' order): its share by head of the food its land
 * wins, less what its own people win of it. A town holds none of its land's foragers and may hold few of its farmers, and
 * its land's reckoning feeds its mouths as any others: what they eat that they did not win is brought to its market.
 */
function bringOf(world: World, place: Place): void {
  const m = marketsOf(world).get(place.cell),
    matched = place.matched,
    land = matched.land,
    p = place.people,
    own = new Array<number>(GOOD_COUNT).fill(0);
  matched.bring = FOODS.map(() => 0);
  matched.win = [matched.made[G.grain]!, matched.made[G.meat]!];
  if (!m || land <= 0) return;
  for (let i = 0; i < p.n; i++) {
    const occ = occOf(p, i);
    if (occ === OCC.farmer) own[G.grain]!++;
    else if (occ === OCC.herder) own[G.meat]!++;
  }
  // (Its share by head of what its land wins of each food in a year, as its books had it at this matching.)
  const share = (g: number) =>
    (matched.rate?.[FOODS.indexOf(g)] ?? 0) * (Math.min(p.n, land) / land);
  // What its own hands win is theirs up to its share: a town that holds more than its share of its land's herders (its
  // foragers live in no town) wins the rest for its land, and it is eaten out there.
  [G.grain, G.meat].forEach((g, k) => {
    if (own[g]! > 0) matched.win![k] = Math.min(matched.made[g]!, share(g) / own[g]!);
  });
  matched.bring = FOODS.map((g) => {
    const k = g === G.grain ? 0 : g === G.meat ? 1 : -1,
      won = k >= 0 ? own[g]! * matched.win![k]! : 0;
    return Math.max(0, Math.round((share(g) - won) * ((PLACE_TICK * MICRO) / YEAR)));
  });
}

function matchedOf(world: World, s: Settlement, month: number, was?: Matched): Matched {
  const ctx = populationContext(world),
    p = ctx.provinces.get(s.cell),
    m = marketsOf(world).get(s.cell),
    made = new Array<number>(GOOD_COUNT).fill(0),
    occ = (o: number) => Math.max(1, p?.occupation(o) ?? 0);
  if (m)
    for (let g = 0; g < GOOD_COUNT; g++) {
      // (What its land made of each last year, to each of those whose work it is.)
      const by =
        g === G.grain ? occ(OCC.farmer) : g === G.meat ? occ(OCC.herder) : occ(OCC.crafter);
      made[g] = landMade(m, g, month, was) / by;
    }
  const row = moneyStore(world, SHARES_STORE)?.get(s.cell);
  return {
    month,
    land: p?.total() ?? 0,
    town: Math.round(s.population),
    made,
    wage: m ? [...m.wage] : new Array<number>(OCCS).fill(0),
    fifths: row
      ? [0, 1, 2, 3, 4].map((i) => row[SHARE.fifths + i] ?? 200)
      : [200, 200, 200, 200, 200],
    kinds: m?.kinds ?? 0,
    lots: townsOf(world).get(s.ref)?.next ?? 0,
    rate: FOODS.map((g) => (m ? landMade(m, g, month, was) : 0)),
    ytd: FOODS.map((g) => (m ? Math.max(0, m.line("made", g)) : 0)),
    ...careOf(world, s.cell, Math.floor(month / 12)),
    ...(mixOf(world)?.lands.get(s.cell) ? { mix: [...mixOf(world)!.lands.get(s.cell)!] } : {}),
    fedNow: p?.fed ?? 1000,
    fed: ctx.history.yearsOf(s.cell).at(-1)?.fed ?? 1000,
    ways: [...(cultureOf(world).get(s.cell)?.traits ?? [])].map((x) => Math.round(x * 1000) / 1000),
    sieged: besieged(world, s),
  };
}

// —— The store ———————————————————————————————————————————————————————————————————————————————————————————————————

export class PlaceStore implements StateStore {
  readonly name = "readings.places";
  readonly observational = true;
  readonly outsideRules = true;
  readonly packed = true;
  readonly places: Place[] = [];
  private uses = 0;

  dormant(): boolean {
    return this.places.length === 0;
  }
  hashInto(h: Hasher): void {
    // (Never asked: a place is no part of the world's hash.)
    h.int(0);
  }
  get(town: string): Place | undefined {
    return this.places.find((p) => p.town === town);
  }
  touch(place: Place): void {
    place.used = ++this.uses;
  }
  /** A place kept, the least lately entered let go while there are too many or they hold too many. */
  keep(place: Place): void {
    this.places.push(place);
    this.touch(place);
    const people = () => this.places.reduce((n, p) => n + p.people.n, 0);
    while (this.places.length > 1 && (this.places.length > PLACES_MOST || people() > PEOPLE_MOST)) {
      let least = -1;
      for (let i = 0; i < this.places.length; i++)
        if (
          this.places[i] !== place &&
          // (One with doings its land has yet to be told is kept until they are told: place.settle, on leaving.)
          !this.places[i]!.moves.length &&
          !this.places[i]!.dead.length &&
          (least < 0 || this.places[i]!.used < this.places[least]!.used)
        )
          least = i;
      if (least < 0) break;
      this.places.splice(least, 1);
    }
  }
  drop(town: string): void {
    const at = this.places.findIndex((p) => p.town === town);
    if (at >= 0) this.places.splice(at, 1);
  }
  /** Bytes its places' columns hold, as reckoned. */
  bytes(): number {
    let b = 0;
    for (const p of this.places)
      b +=
        p.people.id.length * PERSON_BYTES +
        p.houses.n * (5 + FOODS.length) * 8 +
        p.bldgs.lot.length * (4 + GOOD_COUNT) * 8 +
        p.sites.length * 48 +
        p.log.length * 40;
    return b;
  }

  save(): unknown {
    return {
      uses: this.uses,
      places: this.places.map((p) => ({
        town: p.town,
        cell: p.cell,
        entered: p.entered,
        t: p.t,
        used: p.used,
        nextId: p.nextId,
        nextHouse: p.nextHouse,
        people: Object.fromEntries(
          PEOPLE_COLS.map((c) => [
            c,
            Array.from((p.people[c] as Uint8Array).subarray(0, p.people.n * widthOf(c))),
          ]),
        ),
        houses: {
          key: p.houses.key,
          home: p.houses.home,
          fifth: p.houses.fifth,
          means: p.houses.means,
          members: p.houses.members,
          pantry: p.houses.pantry,
          grief: p.houses.grief,
          fresh: p.houses.fresh,
          lost: p.houses.lost,
          kind: p.houses.kind,
        },
        bldgs: p.bldgs,
        matched: p.matched,
        base: p.base,
        flow: p.flow,
        log: p.log,
        moves: p.moves,
        dead: p.dead,
        ordered: p.ordered,
        sites: p.sites,
        sited: p.sited,
        figRef: p.figRef,
        figId: p.figId,
        figName: p.figName,
        ills: p.ills,
        seen: p.seen,
        plague: p.plague,
        counts: p.counts,
        tolls: p.tolls,
        gone: p.gone,
        fire: p.fire,
        wars: p.wars,
        war: p.war,
        day: p.day,
        madeDay: p.madeDay,
        usedDay: p.usedDay,
        cameDay: p.cameDay,
        ripe: p.ripe,
        due: p.due,
        rite: p.rite,
        ...(UNPAIRED.has(p) ? { unpaired: true } : {}),
        // (Read from a save kept before skill was, and not brought on since: still to be reckoned.)
        ...(UNSKILLED.has(p) ? { unskilled: true } : {}),
      })),
    };
  }

  load(state: unknown): void {
    const s = state as { uses?: number; places?: Record<string, unknown>[] };
    this.uses = s.uses ?? 0;
    this.places.length = 0;
    for (const raw of s.places ?? []) {
      const cols = raw.people as Record<Col, number[]>,
        n = cols.id.length,
        people = peopleOf(Math.max(16, n));
      people.n = n;
      // (A column a save from before did not keep begins empty.)
      for (const c of PEOPLE_COLS) if (cols[c]) (people[c] as Uint8Array).set(cols[c]);
      const unskilled = !cols.skill || raw.unskilled === true;
      const h = raw.houses as Omit<Houses, "n">,
        b = raw.bldgs as Buildings,
        town = raw.town as Ref;
      this.places.push({
        town,
        cell: raw.cell as number,
        key: hashString(`place ${town}`),
        entered: raw.entered as number,
        t: raw.t as number,
        used: raw.used as number,
        nextId: raw.nextId as number,
        nextHouse: raw.nextHouse as number,
        people,
        houses: {
          n: h.key.length,
          key: [...h.key],
          home: [...h.home],
          fifth: [...h.fifth],
          means: [...h.means],
          members: [...h.members],
          pantry: [...h.pantry],
          grief: h.grief ? [...h.grief] : h.key.map(() => -1),
          fresh: h.fresh ? [...h.fresh] : h.key.map(() => -1),
          lost: h.lost ? [...h.lost] : h.key.map(() => -1),
          kind: h.kind ? [...h.kind] : h.key.map(() => 0),
        },
        bldgs: {
          lot: [...b.lot],
          kind: [...b.kind],
          start: [...b.start],
          stock: [...b.stock],
          site: b.site ? [...b.site] : b.lot.map(() => 0),
        },
        matched: structuredClone(raw.matched as Matched),
        base: [...(raw.base as number[])],
        flow: [...(raw.flow as number[])],
        log: (raw.log as PlaceHap[]).map((x) => ({ ...x })),
        moves: [...((raw.moves as number[] | undefined) ?? [])],
        dead: [...((raw.dead as number[] | undefined) ?? [])],
        ordered: (raw.ordered as string | undefined) ?? "",
        sites: ((raw.sites as PlaceSite[] | undefined) ?? []).map((x) => ({ ...x })),
        sited: (raw.sited as string | undefined) ?? "",
        figRef: [...((raw.figRef as string[] | undefined) ?? [])],
        figId: [...((raw.figId as number[] | undefined) ?? [])],
        figName: [...((raw.figName as string[] | undefined) ?? [])],
        ills: [...((raw.ills as string[] | undefined) ?? [])],
        // (A save from before strikes were read: none before the moment it was kept at.)
        seen: (raw.seen as number | undefined) ?? (raw.t as number),
        plague: (raw.plague as string | undefined) ?? "",
        counts: [...((raw.counts as number[] | undefined) ?? [])],
        tolls: [...((raw.tolls as number[] | undefined) ?? [])],
        gone: [...((raw.gone as number[] | undefined) ?? [])],
        fire: [...((raw.fire as number[] | undefined) ?? [])],
        wars: [...((raw.wars as string[] | undefined) ?? [])],
        war: (raw.war as number | undefined) ?? Math.floor((raw.t as number) / YEAR),
        day: (raw.day as number | undefined) ?? 0,
        madeDay: [
          ...((raw.madeDay as number[] | undefined) ?? new Array<number>(GOOD_COUNT).fill(0)),
        ],
        usedDay: [
          ...((raw.usedDay as number[] | undefined) ?? new Array<number>(GOOD_COUNT).fill(0)),
        ],
        cameDay: [
          ...((raw.cameDay as number[] | undefined) ?? new Array<number>(GOOD_COUNT).fill(0)),
        ],
        ripe: [...((raw.ripe as number[] | undefined) ?? new Array<number>(GOOD_COUNT).fill(0))],
        due: [...((raw.due as number[] | undefined) ?? [])],
        rite: [...((raw.rite as number[] | undefined) ?? [])],
      });
      if (unskilled) UNSKILLED.add(this.places.at(-1)!);
      if (!cols.mate || raw.unpaired === true) UNPAIRED.add(this.places.at(-1)!);
    }
  }
}

/** Kept beside a world that has towns (host/planet.ts): empty, and nothing of it asked, until a town is entered. */
export function installPlaces(world: World): void {
  if (!world.hasStore("population.settlements") || !world.hasStore("town.fabric")) return;
  if (!world.hasStore("readings.places")) world.register(new PlaceStore());
}

export function placesOf(world: World): PlaceStore | null {
  return world.peek<PlaceStore>("readings.places") ?? null;
}

/** Everything a place holds as one number, for telling two alike (tests; a place is in no world's hash). */
export function placeDigest(p: Place): string {
  const h = new Hasher().string(p.town).int(p.entered).int(p.t).int(p.nextId).int(p.nextHouse);
  h.int(p.people.n);
  for (const c of PEOPLE_COLS) {
    const a = p.people[c] as Uint8Array;
    for (let i = 0; i < p.people.n * widthOf(c); i++) h.int(a[i]!);
  }
  for (const list of [
    p.houses.key,
    p.houses.home,
    p.houses.fifth,
    p.houses.members,
    p.houses.pantry,
    p.bldgs.lot,
    p.bldgs.kind,
    p.bldgs.start,
    p.bldgs.stock,
    p.bldgs.site,
    p.sites.flatMap((x) => [x.n, x.lot, x.ticks, x.from, x.stuff, x.brought, x.k ?? 0]),
    p.base,
    p.flow,
    p.moves,
    p.dead,
    p.madeDay,
    p.usedDay,
    p.cameDay,
    p.ripe,
    p.matched.bring ?? [],
    (p.matched.win ?? []).map((x) => Math.round(x * 1000)),
    p.day,
    p.matched.kinds,
    p.matched.land,
    p.matched.town,
    p.houses.lost,
    p.houses.kind,
    p.counts,
    p.seen,
    p.tolls,
    p.gone,
    p.fire,
    p.war,
    p.due,
    p.rite,
  ].flat())
    h.int(list);
  for (const x of p.houses.means) h.float(x);
  for (const x of [...p.matched.made, ...p.matched.wage]) h.float(x);
  for (const x of p.log)
    h.int(x.t)
      .int(x.what)
      .int(x.id)
      .int(x.a)
      .int(x.b)
      .int(x.k ?? 0)
      .int(x.s ?? 0);
  h.string(p.ordered).string(p.sited).string(p.plague);
  p.figRef.forEach((ref, k) => h.string(ref).int(p.figId[k]!));
  return h.hex();
}

// —— Reading a place —————————————————————————————————————————————————————————————————————————————————————————————

const sexOf = (p: People, i: number) => p.sexOcc[i]! >> 4;
const occOf = (p: People, i: number) => p.sexOcc[i]! & 15;
const ageOf = (p: People, i: number, t: number) => (t / DAY - p.born[i]!) / 365;

/** A place's people counted as its town's table is (sex and band by trade), by their ages at its clock. */
export function placeTable(place: Place, life: LifeHistory): number[] {
  const out = new Array<number>(ROWS * OCCS).fill(0),
    p = place.people;
  for (let i = 0; i < p.n; i++)
    out[(sexOf(p, i) * BANDS + bandOf(ageOf(p, i, place.t), life)) * OCCS + occOf(p, i)]!++;
  return out;
}

/** Everything a place holds of each good (its buildings, its pantries, what is carried), millionths. */
export function placeStocks(place: Place): number[] {
  const out = new Array<number>(GOOD_COUNT).fill(0),
    { bldgs, houses, people } = place;
  for (let b = 0; b < bldgs.lot.length; b++)
    for (let g = 0; g < GOOD_COUNT; g++) out[g]! += bldgs.stock[b * GOOD_COUNT + g]!;
  for (let h = 0; h < houses.n; h++)
    for (let f = 0; f < FOODS.length; f++) out[FOODS[f]!]! += houses.pantry[h * FOODS.length + f]!;
  for (let i = 0; i < people.n; i++)
    if (people.carry[i]! > 0) out[people.carryGood[i]!]! += people.carry[i]!;
  return out;
}

/** Where a lot lies, as far as a place reckons walking: rings about the square, as a town takes its lots. */
function ringOf(place: Place, lot: number): readonly [number, number] {
  if (lot === AT.square || lot === AT.none) return [0, 0];
  const n = lot === AT.fields ? place.matched.lots + 400 : lot,
    r = Math.sqrt(((n + 1) * LOT_GROUND) / Math.PI),
    a = n * 2.399963229728653;
  return [r * Math.cos(a), r * Math.sin(a)];
}

/**
 * Where a town's lots lie, as its own plan lays them (host/town.ts townPlan, bridge/town.ts townLots: what its view
 * draws), in its streets' own frame: along its main way and across it. Read once for a place and again when its town
 * has taken more lots; never saved (it is the world's, read again).
 */
type Laid = {
  readonly lots: number;
  readonly u: Float32Array;
  readonly v: Float32Array;
  /**
   * Its streets as its view walks them (bridge/streets.ts), over the lots nearest its square, where each of those lots'
   * doors stands on them, and the lengths found (by the two lots); and what of its town they were read by, so that they
   * are read again when its town builds, burns or is walled.
   */
  readonly streets: Streets | null;
  readonly doorX: Float32Array;
  readonly doorZ: Float32Array;
  readonly walks: Map<number, number>;
  /** The lengths found out to its fields (by the door and the field) and to its walls' site (by the door and the length). */
  readonly fieldWalks: Map<number, number>;
  readonly wallWalks: Map<number, number>;
  readonly key: string;
  /**
   * Where its fields are meant to lie, each one's middle, and its pasture's, as its plan lays them (host/village.ts
   * townFieldsMeant; its plan's frame, metres from its square): a walk out to them is reckoned to one's own field, as its
   * view draws it, by its streets as far as they go. None where its plan is not read.
   */
  readonly fieldX: Float32Array;
  readonly fieldZ: Float32Array;
  readonly pasture: readonly [number, number] | null;
  /** Its lots' middles in its plan's frame (as `u`, `v` are in its streets'). */
  readonly x: Float32Array;
  readonly z: Float32Array;
};
const LAID = new WeakMap<Place, Laid>();
/** The most lots a place reads the lie of (those past them are reckoned by their ring). */
const LAID_MOST = 24_000;
/**
 * The lots, from its square out, a walk between which is reckoned by its very streets: those its view draws people of
 * (a place's plan shows whole households of its lowest lots, host/placeplan.ts). Past them, by the lie of its lots.
 */
const STREET_LOTS = 1536;
/** How near a wall one walks (metres): as its view's walkers (view/placefolk.ts). */
const STREET_REACH = 0.5;

/** What of a town its streets are laid by: read again when any of it changes. */
function streetsKey(world: World, place: Place): string {
  const f = townsOf(world).get(place.town);
  return f
    ? `${f.next}|${f.changes.length}|${f.civics.length}|${f.civics.version}|${f.walls ? `${f.walls.start},${f.walls.end}` : ""}|${Math.floor(place.t / YEAR)}`
    : "";
}

function layLots(world: World, place: Place): void {
  let most = 0;
  for (const lot of place.houses.home) most = Math.max(most, lot + 1);
  for (const lot of place.bldgs.lot) most = Math.max(most, lot + 1);
  most = Math.min(most, LAID_MOST);
  const was = LAID.get(place),
    key = streetsKey(world, place);
  if (was && was.lots >= most && was.key === key) return;
  const none = new Float32Array(0),
    site = townSite(world, place.town),
    plan = site ? townPlan(world, place.town, site.axis, most, site.water) : null;
  if (!plan)
    return void LAID.set(place, {
      lots: 0,
      u: none,
      v: none,
      streets: null,
      doorX: none,
      doorZ: none,
      walks: new Map(),
      fieldWalks: new Map(),
      wallWalks: new Map(),
      key,
      fieldX: none,
      fieldZ: none,
      pasture: null,
      x: none,
      z: none,
    });
  const lots = townLots(
      plan.family,
      plan.seed,
      plan.axis,
      Math.min(most, plan.lots),
      plan.water,
      plan.site ?? null,
      plan.lotSize ?? 1,
    ),
    n = lots.x.length,
    u = new Float32Array(n),
    v = new Float32Array(n),
    c = Math.cos(plan.axis),
    s = Math.sin(plan.axis);
  for (let k = 0; k < n; k++) {
    u[k] = lots.x[k]! * c + lots.z[k]! * s;
    v[k] = -lots.x[k]! * s + lots.z[k]! * c;
  }
  // Its streets, over the lots nearest its square: the plan of just those lots, as its view would be given it.
  const near = Math.min(n, STREET_LOTS),
    heart =
      near > 0 && near < plan.lots
        ? townPlan(world, place.town, site!.axis, near, site!.water)
        : near > 0
          ? plan
          : null,
    doorX = new Float32Array(heart ? near : 0),
    doorZ = new Float32Array(heart ? near : 0);
  let streets: Streets | null = null;
  if (heart) {
    streets = streetsOf(
      heart,
      heart.water ? { x: heart.water.x, z: heart.water.z, r: heart.water.r } : null,
    );
    for (let k = 0; k < doorX.length; k++) {
      const door = streetDoor(
        { x: lots.x[k]!, z: lots.z[k]!, yaw: lots.yaw[k]! },
        0,
        undefined,
        plan.lotSize ?? 1,
      );
      doorX[k] = door.x;
      doorZ[k] = door.z;
    }
  }
  const out = townFieldsMeant(
      world,
      place.town,
      lots,
      Math.min(most, plan.lots),
      townsOf(world).get(place.town)?.next ?? plan.lots,
    ),
    fieldX = Float32Array.from(out?.fields ?? [], (q) => q.x),
    fieldZ = Float32Array.from(out?.fields ?? [], (q) => q.z),
    pasture: readonly [number, number] | null = out ? [out.pasture.x, out.pasture.z] : null;
  // A walk found is kept while the streets it was found by stand as they did: a year turned, or a town that took more
  // lots within the blocks it held, lays the same streets, and the same walk between the same two doors (its streets
  // say what they are made of: bridge/streets.ts signature). The walks out to its fields besides, while its fields lie
  // where they did. Every walk was found anew at each year's turn and each lot taken.
  const same = (a: Float32Array, b: Float32Array, n: number): boolean => {
    for (let k = 0; k < n; k++) if (a[k] !== b[k]) return false;
    return true;
  };
  let walks = new Map<number, number>(),
    fieldWalks = new Map<number, number>(),
    wallWalks = new Map<number, number>();
  if (
    streets &&
    was?.streets &&
    was.streets.signature() === streets.signature() &&
    was.doorX.length <= doorX.length &&
    same(was.doorX, doorX, was.doorX.length) &&
    same(was.doorZ, doorZ, was.doorZ.length)
  ) {
    streets = was.streets;
    walks = was.walks;
    wallWalks = was.wallWalks;
    if (
      was.fieldX.length === fieldX.length &&
      same(was.fieldX, fieldX, fieldX.length) &&
      same(was.fieldZ, fieldZ, fieldZ.length) &&
      was.pasture?.[0] === pasture?.[0] &&
      was.pasture?.[1] === pasture?.[1]
    )
      fieldWalks = was.fieldWalks;
  }
  LAID.set(place, {
    lots: n,
    u,
    v,
    streets,
    doorX,
    doorZ,
    walks,
    fieldWalks,
    wallWalks,
    key,
    fieldX,
    fieldZ,
    pasture,
    x: Float32Array.from(lots.x),
    z: Float32Array.from(lots.z),
  });
}

/**
 * How far it is from one lot to another by the town's streets (metres). Between two of the lots nearest its square (and
 * its square), the very way its view walks: door to door by its streets' own graph (bridge/streets.ts), round its blocks,
 * its walls and its water. Past those, along its streets' two ways between where its plan lays the two lots; and by their
 * rings where the plan's lie is not read: the fields, lots past the read.
 */
export function streetLength(
  place: Place,
  a: number,
  b: number,
  /** Whose walk, where one end is its fields: their place among its people (to their own field; a herder's, to its pasture). */
  who = -1,
): number {
  if (a === b) return 0;
  if (a === AT.walls || b === AT.walls) return wallLength(place, a === AT.walls ? b : a);
  if ((a === AT.fields || b === AT.fields) && who >= 0) {
    const far = fieldLength(place, a === AT.fields ? b : a, who);
    if (far >= 0) return far;
  }
  const laid = LAID.get(place),
    at = (lot: number): readonly [number, number] | null =>
      lot === AT.square || lot === AT.none
        ? [0, 0]
        : laid && lot >= 0 && lot < laid.lots
          ? [laid.u[lot]!, laid.v[lot]!]
          : null,
    pa = at(a),
    pb = at(b);
  if (laid?.streets && pa && pb) {
    // (The square stands for a lot of its own, one past the last of them.)
    const doors = laid.doorX.length,
      ia = a < 0 ? doors : a,
      ib = b < 0 ? doors : b;
    // (A lot numbered one past the last of them is no square: it lies past the streets read.)
    if ((a < 0 || a < doors) && (b < 0 || b < doors)) {
      // (Kept by the two lots, the square as the lot past the most ever read: a town that reads more doors keeps its walks.)
      const ka = a < 0 ? STREET_LOTS : a,
        kb = b < 0 ? STREET_LOTS : b,
        key = Math.min(ka, kb) * (STREET_LOTS + 1) + Math.max(ka, kb);
      let far = laid.walks.get(key);
      if (far === undefined) {
        const lo = Math.min(ia, ib),
          hi = Math.max(ia, ib),
          door = (i: number) =>
            i === doors ? { x: 0, z: 0 } : { x: laid.doorX[i]!, z: laid.doorZ[i]! },
          way = laid.streets.route(door(lo), door(hi), STREET_REACH);
        far = 0;
        for (let k = 0; k + 1 < way.length; k++)
          far += Math.hypot(way[k + 1]!.x - way[k]!.x, way[k + 1]!.z - way[k]!.z);
        // (To a whole metre: the same walk reckoned on any machine. And never farther than by way of its square: the
        // way found between two doors is a good one, not always the shortest.)
        far = Math.round(far);
        if (a >= 0 && b >= 0)
          far = Math.min(
            far,
            streetLength(place, a, AT.square) + streetLength(place, AT.square, b),
          );
        // (No more than so many kept: a great town's every pair would be a million.)
        if (laid.walks.size >= 60_000) laid.walks.clear();
        laid.walks.set(key, far);
      }
      return far;
    }
  }
  if (pa && pb) {
    // (Along its two ways; and where one of the two lies among its streets, never farther than by way of its square.)
    const along = Math.abs(pa[0] - pb[0]) + Math.abs(pa[1] - pb[1]);
    return a >= 0 && b >= 0 && laid?.streets && Math.min(a, b) < laid.doorX.length
      ? Math.min(along, streetLength(place, a, AT.square) + streetLength(place, AT.square, b))
      : along;
  }
  const [ax, az] = ringOf(place, a),
    [bx, bz] = ringOf(place, b);
  return Math.hypot(ax - bx, az - bz);
}

/**
 * How far it is from a lot (or the square) out to one's own field, or for a herder to the pasture (metres; -1: its plan's
 * fields are not read, and it is reckoned by their ring): by its streets from the door where the lot is among those read,
 * as its view walks it; from the lot's middle straight across where it is past them.
 */
function fieldLength(place: Place, lot: number, who: number): number {
  const laid = LAID.get(place);
  if (!laid || !laid.pasture || !laid.fieldX.length) return -1;
  const p = place.people,
    k = occOf(p, who) === OCC.herder ? -1 : placeFieldOf(p.id[who]!, laid.fieldX.length),
    to =
      k < 0
        ? { x: laid.pasture[0], z: laid.pasture[1] }
        : { x: laid.fieldX[k]!, z: laid.fieldZ[k]! },
    doors = laid.doorX.length,
    from = lot < 0 ? doors : lot;
  if (lot >= laid.lots) return -1;
  if (!laid.streets || from > doors || (lot >= 0 && lot >= doors))
    return lot < 0 ? Math.hypot(to.x, to.z) : Math.hypot(to.x - laid.x[lot]!, to.z - laid.z[lot]!);
  // (Kept by the door and the field.)
  const key = (lot < 0 ? STREET_LOTS : lot) * 4096 + (k + 1);
  let far = laid.fieldWalks.get(key);
  if (far === undefined) {
    const door = from === doors ? { x: 0, z: 0 } : { x: laid.doorX[from]!, z: laid.doorZ[from]! },
      way = laid.streets.route(door, to, STREET_REACH);
    far = 0;
    for (let q = 0; q + 1 < way.length; q++)
      far += Math.hypot(way[q + 1]!.x - way[q]!.x, way[q + 1]!.z - way[q]!.z);
    far = Math.round(far);
    if (laid.fieldWalks.size >= 60_000) laid.fieldWalks.clear();
    laid.fieldWalks.set(key, far);
  }
  return far;
}

/**
 * How far it is from a lot (the square, the fields) to the site of its walls: the length of their line the work has come
 * to (PlaceSite.k), by its streets from the door, as its view draws the crew there; to the ring's first length where its
 * lengths are not read.
 */
function wallLength(place: Place, lot: number): number {
  const laid = LAID.get(place),
    at = laid?.streets?.wallAt ?? [],
    site = place.sites.find((x) => x.lot === AT.walls),
    to = at.length ? at[Math.min(at.length - 1, site?.k ?? 0)]! : null;
  if (!laid || !to) return Math.hypot(...ringOf(place, AT.fields));
  if (lot === AT.fields) return Math.hypot(...ringOf(place, AT.fields)) / 2;
  const doors = laid.doorX.length;
  if (!laid.streets || (lot >= 0 && lot >= doors))
    return lot >= 0 && lot < laid.lots
      ? Math.hypot(to.x - laid.x[lot]!, to.z - laid.z[lot]!)
      : Math.hypot(to.x, to.z);
  const from = lot < 0 ? doors : lot,
    key = (lot < 0 ? STREET_LOTS : lot) * 4096 + Math.min(4095, site?.k ?? 0);
  let far = laid.wallWalks.get(key);
  if (far === undefined) {
    const door = from === doors ? { x: 0, z: 0 } : { x: laid.doorX[from]!, z: laid.doorZ[from]! },
      way = laid.streets.route(door, to, STREET_REACH);
    far = 0;
    for (let q = 0; q + 1 < way.length; q++)
      far += Math.hypot(way[q + 1]!.x - way[q]!.x, way[q + 1]!.z - way[q]!.z);
    far = Math.round(far);
    if (laid.wallWalks.size >= 60_000) laid.wallWalks.clear();
    laid.wallWalks.set(key, far);
  }
  return far;
}

/** Ticks to walk from one to another (`who`: whose walk, for the way out to their own field). */
function ticksBetween(place: Place, a: number, b: number, who = -1): number {
  if (a === b) return 0;
  return Math.max(
    1,
    Math.min(65535, Math.round(streetLength(place, a, b, who) / (WALK * PLACE_TICK))),
  );
}

// —— Making a place ——————————————————————————————————————————————————————————————————————————————————————————————

function addPerson(place: Place, sex: number, occ: number, born: number, house: number): number {
  let p = place.people;
  if (p.n >= p.id.length) p = place.people = grown(p, Math.max(16, p.id.length * 2));
  const i = p.n++;
  p.id[i] = place.nextId++;
  p.born[i] = born;
  p.sexOcc[i] = (sex << 4) | occ;
  p.craft[i] = 0;
  p.house[i] = house;
  p.work[i] = AT.none;
  for (let k = 0; k < NEEDS; k++) p.needs[i * NEEDS + k] = 0;
  p.act[i] = ACT.idle;
  p.why[i] = WHY.none;
  p.at[i] = place.houses.home[house] ?? AT.square;
  p.to[i] = p.at[i]!;
  p.eta[i] = 0;
  p.trip[i] = 0;
  p.carryGood[i] = 0;
  p.carry[i] = 0;
  p.line[i] = 0;
  p.lineN[i] = 0;
  p.lack[i] = 0;
  p.health[i] = p.ill[i] = p.cause[i] = p.mood[i] = p.moodWhy[i] = p.bound[i] = p.friend[i] = 0;
  p.mark[i] = 0;
  p.owed[i] = 0;
  p.skill[i] = 0;
  p.turn[i] = 0;
  p.mate[i] = 0;
  place.houses.members[house]!++;
  return i;
}

function removePerson(place: Place, i: number): void {
  const p = place.people,
    last = p.n - 1;
  place.houses.members[p.house[i]!]!--;
  // (No one of the place is their friend any more.)
  // (And the one they were paired with, or promised to, is alone again.)
  for (let k = 0; k < p.n; k++) {
    if (p.friend[k] === p.id[i]) {
      p.friend[k] = 0;
      if (p.mate[k] === PROMISED) p.mate[k] = 0;
    }
    if (p.mate[k] === p.id[i]) p.mate[k] = 0;
  }
  // (What they carried is set down in the square.)
  if (p.carry[i]! > 0) place.bldgs.stock[p.carryGood[i]!]! += p.carry[i]!;
  if (i !== last)
    for (const c of PEOPLE_COLS) {
      const a = p[c] as Uint8Array,
        w = widthOf(c);
      for (let k = 0; k < w; k++) a[i * w + k] = a[last * w + k]!;
    }
  p.n = last;
}

function addHouse(place: Place, home: number, again = false): number {
  const h = place.houses;
  // (An emptied household's place is taken again, by one that comes after the place was made.)
  let at = -1;
  if (again)
    for (let k = 0; k < h.n; k++)
      if (h.members[k] === 0) {
        at = k;
        break;
      }
  if (at < 0) {
    at = h.n++;
    for (let f = 0; f < FOODS.length; f++) h.pantry.push(0);
  }
  h.key[at] = hashString(`${place.town} house ${place.nextHouse++}`);
  h.home[at] = home;
  h.fifth[at] = 0;
  h.means[at] = 0;
  h.members[at] = 0;
  h.grief[at] = h.fresh[at] = h.lost[at] = -1;
  // (A household that comes after the place was made is of the people it is shortest of.)
  h.kind[at] = again ? kindFor(place) : 0;
  return at;
}

/**
 * The town's home lots and how many each holds, lowest lot first, as far as is needed to house `people` where each home is
 * as full as the town is of its beds: a town's people live in all its homes, not in its heart's alone with the rest
 * standing empty, so what takes a tenth of its homes takes about a tenth of its people. (A town kept in part, PLACE_MOST of
 * its people, is its heart's homes so filled.)
 */
function homesFor(world: World, town: Ref, people: number): { lot: number[]; holds: number[] } {
  const f = townsOf(world).get(town),
    lot: number[] = [],
    holds: number[] = [];
  if (!f) return { lot, holds };
  let beds = 0;
  f.homes.forEach((n, level) => (beds += n * (HOLDS[level] ?? 5)));
  const all = Math.round(populationContext(world).settlements.get(town)?.population ?? people),
    full = beds > 0 ? Math.min(1, Math.max(all, people) / beds) : 1;
  let room = 0;
  for (let from = 0; from < f.next && room < people; from += 4096) {
    const to = Math.min(f.next, from + 4096),
      levels = levelsOf(f, from, to);
    for (let k = 0; k < levels.length && room < people; k++) {
      const level = levels[k]!;
      if (level < 0) continue;
      lot.push(from + k);
      holds.push(HOLDS[level] ?? 5);
      room += (HOLDS[level] ?? 5) * full;
    }
  }
  return { lot, holds };
}

/** What a town was asked to raise, where its world keeps askings (none where it keeps none). */
const asksIn = (world: World, town: string): readonly Ask[] =>
  world.hasStore("town.asks") ? asksOf(world).ofTown(town) : [];

/**
 * The town's other buildings now, behind its square: those standing, and those it was asked to raise still going up (its
 * sites). One asked for stands when its asking is done, whatever year its plan gave it; one no one asked for, at its year.
 */
function buildingsOf(world: World, town: Ref, year: number): Buildings {
  const f = townsOf(world).get(town),
    asks = asksIn(world, town),
    b: Buildings = { lot: [AT.square], kind: [-1], start: [0], stock: [], site: [0] };
  if (f)
    for (const c of f.civics) {
      if (c.fell !== null && c.fell <= year) continue;
      const a = asks.length
          ? asks.find((x) => x.work !== null && x.work.at === c.at && x.work.start === c.start)
          : undefined,
        rising = a ? a.work!.done === null : c.end > year;
      if (rising && (!a || a.work!.left)) continue;
      b.lot.push(c.at);
      b.kind.push(KIND_INDEX.get(c.kind) ?? -1);
      b.start.push(c.start);
      b.site.push(rising ? a!.n + 1 : 0);
    }
  // (Its walls while they go up: a site on no lot, at the length of their line the work has come to.)
  const walls = asks.find(
    (x) => x.what === "walls" && x.work !== null && x.work.done === null && !x.work.left,
  );
  if (walls) {
    b.lot.push(AT.walls);
    b.kind.push(KIND_WALLS);
    b.start.push(walls.work!.start);
    b.site.push(walls.n + 1);
  }
  b.stock = new Array<number>(b.lot.length * GOOD_COUNT).fill(0);
  return b;
}

/** The first of a place's buildings standing of any of these kinds (0, its square, where none stands). */
function buildingOf(place: Place, kinds: readonly string[]): number {
  const { kind, site } = place.bldgs;
  for (const name of kinds) {
    const k = KIND_INDEX.get(name);
    if (k === undefined) continue;
    for (let at = 1; at < kind.length; at++) if (kind[at] === k && !site[at]) return at;
  }
  return 0;
}
const bldgAt = (place: Place, lot: number): number => place.bldgs.lot.indexOf(lot);

/** Where one works, by their trade and their making: a building's lot, the fields, their own home. */
function workOf(world: World, place: Place, i: number): void {
  const p = place.people,
    occ = occOf(p, i),
    m = place.matched;
  p.craft[i] = 0;
  if (occ === OCC.dependent) p.work[i] = AT.none;
  else if (occ === OCC.farmer || occ === OCC.herder || occ === OCC.forager) p.work[i] = AT.fields;
  else if (occ === OCC.crafter) {
    p.craft[i] = craftFor(world, place, i);
    p.work[i] = makingLot(place, i);
  } else p.work[i] = place.bldgs.lot[buildingOf(place, TRADE_AT[occ] ?? [])]!;
}

/** Which of its land's makings is one's own (a recipe's place + 1; 0: its land makes nothing): drawn by what its land made of each, at its usual worth. */
function craftFor(world: World, place: Place, i: number): number {
  const m = place.matched;
  let total = 0;
  const worth = RECIPES.map((r, k) => {
    const w =
      (m.kinds >>> k) & 1 ? Math.max(1e-9, m.made[r.output[0]]! * GOODS[r.output[0]]!.value) : 0;
    total += w;
    return w;
  });
  if (total <= 0) return 0;
  let pick = world.rng.unit(PLACE_DRAW, place.key ^ place.people.id[i]!, 0, P.craft) * total;
  for (let k = 0; k < worth.length; k++) {
    pick -= worth[k]!;
    if (pick < 0) return k + 1;
  }
  return 0;
}

/** Where one's making is done: its building where one stands; outside the town for coal and oil; else at home. */
function makingLot(place: Place, i: number): number {
  const p = place.people,
    craft = p.craft[i]!,
    good = craft ? RECIPES[craft - 1]!.output[0] : -1,
    at = good >= 0 && MAKING_AT[good] ? buildingOf(place, MAKING_AT[good]) : -1;
  return good === G.coal || good === G.oil
    ? AT.fields
    : at > 0
      ? place.bldgs.lot[at]!
      : (place.houses.home[p.house[i]!] ?? AT.square);
}

/** Households' incomes: ranked by what their workers' trades earn, the fifths given their land's shares of its income. */
function reckonMeans(world: World, place: Place): void {
  const { houses, people: p, matched } = place,
    earned = new Array<number>(houses.n).fill(0);
  let total = 0;
  for (let i = 0; i < p.n; i++) {
    const w = matched.wage[occOf(p, i)] ?? 0;
    earned[p.house[i]!]! += w;
    total += w;
  }
  const live: number[] = [];
  for (let h = 0; h < houses.n; h++) if (houses.members[h]! > 0) live.push(h);
  const rank = (h: number) =>
    earned[h]! * (0.6 + 0.8 * world.rng.unit(PLACE_DRAW, houses.key[h]!, 0, P.rank));
  live.sort((a, b) => rank(a) - rank(b) || a - b);
  const per = [0, 0, 0, 0, 0];
  live.forEach((h, k) => {
    const q = Math.min(4, Math.floor((5 * k) / Math.max(1, live.length)));
    houses.fifth[h] = q;
    per[q]!++;
  });
  for (const h of live) {
    const q = houses.fifth[h]!;
    houses.means[h] = Math.round((total * (matched.fifths[q]! / 1000)) / Math.max(1, per[q]!));
  }
}

/** The food a town has in the house between its land's reckonings (millionths): FETCH_DAYS of its eating, as far as its land was fed. */
function breadOf(place: Place, f: Frame): number {
  return Math.round(
    place.people.n * f.daily * FETCH_DAYS * Math.min(1, (place.matched.fedNow ?? 1000) / 1000),
  );
}

/** Stocks come in to, or go out of, the place's stores: what the world's share says against what the place holds. */
function matchStocks(place: Place, share: readonly number[], f: Frame): void {
  const held = placeStocks(place),
    { bldgs, houses, people } = place,
    granary = buildingOf(place, FOOD_STORES),
    market = buildingOf(place, ["market"]);
  // The bread in the house. Its land's month wins a month's food and eats it in one reckoning, and what its stores hold
  // after is what was left over; a town lives day by day, and what it has won and not yet eaten is on its shelves. So much
  // of what it holds over its land's share is left it: some days' eating, as far as its land was fed (breadOf).
  let bread = breadOf(place, f);
  for (const g of FOODS) bread -= share[g]!;
  for (let g = 0; g < GOOD_COUNT; g++) {
    let d = share[g]! - held[g]!;
    if (d < 0 && GOODS[g]!.food && bread > 0) {
      const keep = Math.min(-d, bread);
      bread -= keep;
      d += keep;
    }
    const store = GOODS[g]!.food ? granary : market;
    if (d > 0) bldgs.stock[store * GOOD_COUNT + g]! += d;
    else if (d < 0) {
      // (Out of its stores first, the square and the rest after, then its pantries, then what is in hand.)
      const order = [store, ...bldgs.lot.map((_, b) => b).filter((b) => b !== store)];
      for (const b of order) {
        const take = Math.min(bldgs.stock[b * GOOD_COUNT + g]!, -d);
        bldgs.stock[b * GOOD_COUNT + g]! -= take;
        d += take;
        if (d >= 0) break;
      }
      const f = FOODS.indexOf(g);
      if (d < 0 && f >= 0)
        for (let h = 0; h < houses.n && d < 0; h++) {
          const take = Math.min(houses.pantry[h * FOODS.length + f]!, -d);
          houses.pantry[h * FOODS.length + f]! -= take;
          d += take;
        }
      for (let i = 0; i < people.n && d < 0; i++)
        if (people.carryGood[i] === g && people.carry[i]! > 0) {
          const take = Math.min(people.carry[i]!, -d);
          people.carry[i]! -= take;
          d += take;
        }
    }
  }
  place.base = [...share];
  place.flow = new Array<number>(GOOD_COUNT).fill(0);
}

function note(
  place: Place,
  what: number,
  id: number,
  a = 0,
  b = 0,
  /** Their place among its people, where they are gone with this: they are named by it after. */
  gone = -1,
): void {
  const p = place.people;
  if (HAP_DEATH.has(what))
    counted(
      place,
      what,
      what === HAP.struckDead || what === HAP.fell || what === HAP.plague ? a : 0,
      1,
    );
  place.log.push(
    gone >= 0
      ? { t: place.t, what, id, a, b, k: place.houses.key[p.house[gone]!]!, s: sexOf(p, gone) }
      : { t: place.t, what, id, a, b },
  );
  // (Let go of a few dozen at a time, not one at every telling: the oldest first, but a death is the last thing let go.
  // A battle's fallen and a sickness's dead were pushed out within weeks by the recoveries of those who lived.)
  const most = Math.max(LOG_LEAST, Math.min(LOG_MOST, place.people.n));
  if (place.log.length > most + 32) {
    let drop = place.log.length - most;
    const kept: PlaceHap[] = [];
    for (const x of place.log) {
      if (drop > 0 && !HAP_DEATH.has(x.what)) drop--;
      else kept.push(x);
    }
    if (drop > 0) kept.splice(0, drop);
    place.log = kept;
  }
}

/** So many more counted of a kind (place.counts), this year; those of before last year let go. */
function counted(place: Place, what: number, of: number, n: number): void {
  const year = Math.floor(place.t / YEAR),
    c = place.counts;
  for (let k = c.length - 4; k >= 0; k -= 4) if (c[k]! < year - 1) c.splice(k, 4);
  for (let k = 0; k < c.length; k += 4)
    if (c[k] === year && c[k + 1] === what && c[k + 2] === of) return void (c[k + 3]! += n);
  c.push(year, what, of, n);
}

/** A household for a newcomer: one with fewer than a hearth's mouths, else a new one in the home with most room. */
function houseFor(
  world: World,
  place: Place,
  id: number,
  f: Frame,
  homes: { lot: number[]; holds: number[] },
): number {
  const h = place.houses,
    open: number[] = [];
  for (let k = 0; k < h.n; k++) if (h.members[k]! > 0 && h.members[k]! < f.hearth) open.push(k);
  if (open.length)
    return open[world.rng.index(open.length, PLACE_DRAW, place.key ^ id, place.t, P.house)]!;
  return addHouse(place, roomiest(place, homes), true);
}

/** The home lot with most room left for its size (the square where the town has no home). */
function roomiest(place: Place, homes: { lot: number[]; holds: number[] }): number {
  if (!homes.lot.length) return AT.square;
  const living = new Map<number, number>();
  for (let k = 0; k < place.houses.n; k++)
    living.set(
      place.houses.home[k]!,
      (living.get(place.houses.home[k]!) ?? 0) + place.houses.members[k]!,
    );
  let best = 0,
    least = Infinity;
  for (let k = 0; k < homes.lot.length; k++) {
    const full = (living.get(homes.lot[k]!) ?? 0) / homes.holds[k]!;
    if (full < least) {
      least = full;
      best = k;
    }
  }
  return homes.lot[best]!;
}

/**
 * A place's people brought to the world's table: within a sex and band, those of a trade its town now has too many of
 * take up one it is short of; then those a band has too many of die (as many as its people's table says die in the
 * time gone) or leave; then those it is short of are born into a household, or come to the town. Who, by keyed draws.
 * After it the place's table is the town's, kind for kind.
 */
function matchPeople(
  world: World,
  place: Place,
  s: Settlement,
  f: Frame,
  years: number,
  span: number,
  /** At a year's turn, the year gone: its land's own count of that year's dead says how many of those gone died. */
  gone: number | null = null,
  /**
   * Whether the dead its world has counted and the place has yet to name (its tolls) are all named now, of whatever kind
   * its people are: at a year's turn, and when a sickness has come.
   */
  owed = false,
  /**
   * Over how long what its land's count has brought it is lived out (seconds; a place watched): each death, leaving,
   * birth and coming on a day of its own (`due`). Its land reckons its people month by month and its town's count once a
   * year: what a year's turn brings is lived over the year to come, what a month's brings over the month. 0: all at
   * once, as a place come back to is matched.
   */
  spread = 0,
): void {
  const target = targetTable(world, s, place),
    now = placeTable(place, f.life),
    p = () => place.people,
    cellOf = (i: number) =>
      (sexOf(p(), i) * BANDS + bandOf(ageOf(p(), i, place.t), f.life)) * OCCS + occOf(p(), i),
    draw = (i: number, purpose: number) =>
      world.rng.unit(PLACE_DRAW, place.key ^ p().id[i]!, place.t, purpose),
    // What waits to be lived is counted as lived: one due to die or to leave is gone from its table already, one due
    // to be born or to come is of it. So nothing its land's count brought it is brought again while it waits.
    waiting = new Set<number>(),
    // (Those of a kind, in the order a draw gives them.)
    ofCell = (c: number) => {
      const list: number[] = [];
      for (let i = 0; i < p().n; i++) if (cellOf(i) === c && !waiting.has(p().id[i]!)) list.push(i);
      const d = new Map(list.map((i) => [i, draw(i, P.pick)]));
      return list.sort((a, b) => d.get(a)! - d.get(b)! || p().id[a]! - p().id[b]!);
    };
  for (let k = 0; k < place.due.length; k += 4) {
    const what = place.due[k + 1]!;
    if (what === DUE.born || what === DUE.come) now[place.due[k + 2]!]!++;
    else if (what === DUE.die || what === DUE.leave) {
      const i = placeIndexOf(place, place.due[k + 2]!);
      if (i < 0) continue;
      now[cellOf(i)]!--;
      waiting.add(p().id[i]!);
    }
  }
  let changed = false;
  const lean = (place.matched.fed ?? 1000) < LEAN;
  // (Of each band of its land, the share that died in the year gone, as its land's history counted them: a lean year's
  // and a sickness's dead with the rest. Where no year is gone, by its people's table of dying for the time gone.)
  let died: number[] | null = null;
  if (gone !== null) {
    const ctx = populationContext(world),
      land = ctx.provinces.get(place.cell);
    if (land) {
      died = [];
      for (let b = 0; b < BANDS; b++) {
        let alive = 0;
        for (let sex = 0; sex < SEXES; sex++) alive += land.counts.rowSum(sex * BANDS + b);
        const dead = ctx.history.deathsIn(place.cell, gone, b);
        died.push(alive + dead > 0 ? dead / (alive + dead) : 0);
      }
    }
  }
  // (Who goes first: those hurt by what struck the town while the world's count of its dead is yet to be named here, and
  // the sick of a sickness whose dead are; then the sick: where the world's own reckoning took some of a kind, it took
  // those its sickness had; then, in a lean year, those long in want.)
  const tolled = (cause: number) => {
      for (let q = 0; q < place.tolls.length; q += 2) if (place.tolls[q] === cause) return true;
      return false;
    },
    first = (i: number) =>
      place.tolls.length &&
      ((p().health[i] === 1 && (p().cause[i]! & 7) >= CAUSE.fire) ||
        (p().health[i] === 2 && tolled(p().cause[i]!)))
        ? 0
        : p().health[i] === 2
          ? 1
          : lean && p().lack[i]! >= 144
            ? 2
            : 3;
  // A year's turn: its dead. Of each band, as many of the place's as its land's history counted dying of so many in the
  // year gone (those the place has told dead of that year already, and those it has yet to name, taken off: nothing
  // twice), whoever its table says; the sick and those long in want first. Its town's count held only what was left at
  // the year's end: a town that grew by a hundred buried thirty and saw four die. Those who come after them are their
  // juniors grown older, band by band, and at the foot the newborn.
  if (died) {
    let told = 0,
      quota = 0;
    for (let k = 0; k < place.counts.length; k += 4)
      if (place.counts[k] === gone && HAP_DEATH.has(place.counts[k + 1]!))
        told += place.counts[k + 3]!;
    for (let q = 0; q < place.tolls.length; q += 2) told += place.tolls[q + 1]!;
    for (let c = 0; c < ROWS * OCCS; c++)
      quota += Math.max(0, now[c]!) * died[Math.floor(c / OCCS) % BANDS]!;
    const left = quota > 0 ? Math.max(0, quota - told) / quota : 0;
    for (let c = 0; c < ROWS * OCCS && left > 0; c++) {
      const e = Math.max(0, now[c]!) * died[Math.floor(c / OCCS) % BANDS]! * left,
        n =
          Math.floor(e) +
          (world.rng.unit(PLACE_DRAW, place.key ^ c, place.t, P.dying, 1) < e % 1 ? 1 : 0);
      if (n <= 0) continue;
      const ids = ofCell(c)
        .sort((x, y) => first(x) - first(y))
        .slice(0, n)
        .map((i) => p().id[i]!);
      for (const id of ids) {
        const i = placeIndexOf(place, id),
          what =
            p().health[i] === 2 && p().cause[i]! >= CAUSE.sickness
              ? HAP.plague
              : lean && p().lack[i]! >= 144
                ? HAP.famine
                : HAP.died,
          of = what === HAP.plague ? p().cause[i]! - CAUSE.sickness : 0;
        now[c]!--;
        // (One starved, or dead of a sickness, is told at once, as what threatens a town is; one dead in their time, on a
        // day of the year to come.)
        if (spread > 0 && what === HAP.died) {
          dueIn(world, place, spread, id, DUE.die, id, what | (of << 8));
          waiting.add(id);
          continue;
        }
        const age = Math.round(ageOf(p(), i, place.t));
        if (what === HAP.plague) note(place, HAP.plague, id, of, age, i);
        else if (what === HAP.famine) note(place, HAP.famine, id, age, 0, i);
        else note(place, HAP.died, id, age, occOf(p(), i), i);
        place.houses.grief[p().house[i]!] = Math.floor(place.t / DAY);
        removePerson(place, i);
        changed = true;
      }
    }
  }
  // Ages first. One's age here is a reading of their band, and the world moves its bands by its own reckoning: where a
  // band has more than the world's and the next one fewer, those nearest the line between them (within the time gone)
  // are of the other side of it. No one comes or goes for a birthday.
  const reach = Math.max(years, 1 / 12) * 1.5 + 2 / 365,
    rowSum = (t: readonly number[], r: number) => {
      let n = 0;
      for (let o = 0; o < OCCS; o++) n += t[r * OCCS + o]!;
      return n;
    };
  for (let sex = 0; sex < SEXES; sex++)
    for (let band = 0; band + 1 < BANDS; band++) {
      const lo = sex * BANDS + band,
        hi = lo + 1,
        edge = f.life.bands[band + 1]!,
        overLo = rowSum(now, lo) - rowSum(target, lo),
        overHi = rowSum(now, hi) - rowSum(target, hi),
        up = overLo > 0 && overHi < 0,
        k = up
          ? Math.min(overLo, -overHi)
          : overHi > 0 && overLo < 0
            ? Math.min(overHi, -overLo)
            : 0;
      if (k <= 0) continue;
      // (Those of the fuller band, nearest the line first.)
      const from = up ? lo : hi,
        near: number[] = [];
      for (let i = 0; i < p().n; i++)
        if (sexOf(p(), i) * BANDS + bandOf(ageOf(p(), i, place.t), f.life) === from)
          if (Math.abs(ageOf(p(), i, place.t) - edge) <= reach && !waiting.has(p().id[i]!))
            near.push(i);
      near.sort(
        (a, b) =>
          Math.abs(ageOf(p(), a, place.t) - edge) - Math.abs(ageOf(p(), b, place.t) - edge) ||
          p().id[a]! - p().id[b]!,
      );
      for (const i of near.slice(0, k)) {
        const was = cellOf(i);
        // (One reckoned the younger is so by a month and a half: not across the line again before the next month's turn.)
        p().born[i] = Math.floor(place.t / DAY - edge * 365) + (up ? 0 : 45);
        now[was]!--;
        now[cellOf(i)]!++;
      }
    }
  // Trades changed within a sex and band.
  for (let r = 0; r < ROWS; r++) {
    for (let o = 0; o < OCCS; o++) {
      let over = now[r * OCCS + o]! - target[r * OCCS + o]!;
      if (over <= 0) continue;
      // (Those an order holds to their trade by name are the last to be moved from it.)
      const movers = ofCell(r * OCCS + o).sort(
        (a, b) => (p().bound[a] ? 1 : 0) - (p().bound[b] ? 1 : 0),
      );
      for (let to = 0; to < OCCS && over > 0; to++) {
        let short = target[r * OCCS + to]! - now[r * OCCS + to]!;
        while (short > 0 && over > 0) {
          const i = movers.shift()!;
          p().sexOcc[i] = (sexOf(p(), i) << 4) | to;
          p().skill[i] = 0;
          p().turn[i] = 0;
          workOf(world, place, i);
          // (One just grown who takes up their first work has come of age.)
          note(
            place,
            o === OCC.dependent && ageOf(p(), i, place.t) < f.life.adulthood + 3
              ? HAP.ofAge
              : HAP.trade,
            p().id[i]!,
            o,
            to,
          );
          now[r * OCCS + o]!--;
          now[r * OCCS + to]!++;
          short--;
          over--;
          changed = true;
        }
      }
    }
  }
  // Those a kind has too many of: dead or gone. (Taken by id, since taking one moves another into its place.)
  for (let c = 0; c < ROWS * OCCS; c++) {
    const over = now[c]! - target[c]!;
    if (over <= 0) continue;
    const band = Math.floor(c / OCCS) % BANDS,
      // (As many of them dead as its people's table says die of so many in the time gone, a year's at a year's turn: a
      // part of one by a keyed draw. The rest left.)
      // (At a year's turn its dead are taken already, above: whoever is over then has left.)
      expected = died ? 0 : now[c]! * (f.life.mortality[band] ?? 0.02) * span,
      dying = Math.min(
        over,
        Math.floor(expected) +
          (world.rng.unit(PLACE_DRAW, place.key ^ c, place.t, P.dying) < expected % 1 ? 1 : 0),
      ),
      grown = band > 0 && f.life.bands[band]! >= f.life.adulthood,
      ids = ofCell(c)
        .sort((a, b) => first(a) - first(b))
        .slice(0, over)
        .map((i) => p().id[i]!);
    ids.forEach((id, k) => {
      const i = p().id.subarray(0, p().n).indexOf(id),
        age = Math.round(ageOf(p(), i, place.t));
      // How they are told: as one of the dead the world has counted and the place has yet to name (a strike's, a battle's:
      // a battle's are of its grown); else, of those its people's table says die, the sick as dead of their sickness and
      // in a lean year those long in want as starved; the rest died, or left.
      let toll = -1;
      for (let q = 0; q < place.tolls.length && toll < 0; q += 2)
        if (place.tolls[q]! < 100 || grown) toll = q;
      if (toll >= 0) {
        const of = place.tolls[toll]!;
        if (of >= 100) note(place, HAP.fell, id, of - 100, age, i);
        else if (of >= CAUSE.sickness) note(place, HAP.plague, id, of - CAUSE.sickness, age, i);
        else note(place, HAP.struckDead, id, of, age, i);
        if (--place.tolls[toll + 1]! <= 0) place.tolls.splice(toll, 2);
      } else if (
        spread > 0 &&
        !(
          k < dying &&
          ((p().health[i] === 2 && p().cause[i]! >= CAUSE.sickness) ||
            (lean && p().lack[i]! >= 144))
        )
      ) {
        // (Not now: on a day of the month to come, of what they would be told to have died of now; or gone on one.)
        const what =
          k >= dying
            ? HAP.left
            : p().health[i] === 2 && p().cause[i]! >= CAUSE.sickness
              ? HAP.plague
              : lean && p().lack[i]! >= 144
                ? HAP.famine
                : HAP.died;
        dueIn(
          world,
          place,
          spread,
          id,
          what === HAP.left ? DUE.leave : DUE.die,
          id,
          what | ((what === HAP.plague ? p().cause[i]! - CAUSE.sickness : 0) << 8),
        );
        return;
      } else if (k < dying && p().health[i] === 2 && p().cause[i]! >= CAUSE.sickness)
        note(place, HAP.plague, id, p().cause[i]! - CAUSE.sickness, age, i);
      else if (k < dying && lean && p().lack[i]! >= 144) note(place, HAP.famine, id, age, 0, i);
      else note(place, k < dying ? HAP.died : HAP.left, id, age, occOf(p(), i), i);
      if (k < dying || toll >= 0) place.houses.grief[p().house[i]!] = Math.floor(place.t / DAY);
      removePerson(place, i);
    });
    now[c] = target[c]!;
    changed = true;
  }
  // The dead its world has counted that no kind was over by: named all the same. Its land's count lost them (a sickness
  // takes of every kind, a strike's dead were its own), and where its town's count did not fall by as many, as many have
  // come to it from its land since: those are told as come, below. So the dead the place tells are the world's count of
  // them, and its people after are its town's, kind for kind.
  if (owed && place.tolls.length) {
    const all: number[] = [];
    for (let i = 0; i < p().n; i++) all.push(i);
    const d = new Map(all.map((i) => [i, draw(i, P.dying)])),
      grownAt = (i: number) => ageOf(p(), i, place.t) >= f.life.adulthood,
      ids = all
        .sort((a, b) => first(a) - first(b) || d.get(a)! - d.get(b)! || p().id[a]! - p().id[b]!)
        .map((i) => p().id[i]!);
    for (const id of ids) {
      if (!place.tolls.length || p().n <= 1) break;
      const i = placeIndexOf(place, id);
      let toll = -1;
      for (let q = 0; q < place.tolls.length && toll < 0; q += 2)
        if (place.tolls[q]! < 100 || (grownAt(i) && occOf(p(), i) !== OCC.dependent)) toll = q;
      if (toll < 0) continue;
      const of = place.tolls[toll]!,
        age = Math.round(ageOf(p(), i, place.t));
      if (of >= 100) note(place, HAP.fell, id, of - 100, age, i);
      else if (of >= CAUSE.sickness) note(place, HAP.plague, id, of - CAUSE.sickness, age, i);
      else note(place, HAP.struckDead, id, of, age, i);
      if (--place.tolls[toll + 1]! <= 0) place.tolls.splice(toll, 2);
      place.houses.grief[p().house[i]!] = Math.floor(place.t / DAY);
      now[cellOf(i)]!--;
      removePerson(place, i);
      changed = true;
    }
  }
  // Those a kind is short of: born, or come.
  let homes: { lot: number[]; holds: number[] } | null = null;
  for (let c = 0; c < ROWS * OCCS; c++) {
    const short = target[c]! - now[c]!;
    if (short <= 0) continue;
    const row = Math.floor(c / OCCS),
      sex = Math.floor(row / BANDS),
      band = row % BANDS,
      occ = c % OCCS,
      lo = f.life.bands[band]!,
      hi = band + 1 < BANDS ? f.life.bands[band + 1]! : lo + f.life.oldest;
    for (let k = 0; k < short; k++) {
      if (spread > 0) {
        // (Born, or come, on a day of the month to come.)
        dueIn(world, place, spread, c * 4096 + k, band === 0 ? DUE.born : DUE.come, c, 0);
        continue;
      }
      const id = place.nextId,
        u = world.rng.unit(PLACE_DRAW, place.key ^ id, place.t, P.age),
        // (A newborn is of the time gone; anyone else of their band.)
        age = band === 0 ? Math.min(hi - lo, Math.max(years, 1 / 12)) * u : lo + (hi - lo) * u,
        born = Math.floor(place.t / DAY - age * 365);
      let house = -1;
      if (band === 0) {
        // (Born to a household with one who bears, of the age to.)
        const mothers: number[] = [];
        for (let i = 0; i < p().n; i++)
          if (
            sexOf(p(), i) === FEMALE &&
            (f.life.fertility[bandOf(ageOf(p(), i, place.t), f.life)] ?? 0) > 0
          )
            mothers.push(p().house[i]!);
        if (mothers.length)
          house =
            mothers[
              world.rng.index(mothers.length, PLACE_DRAW, place.key ^ id, place.t, P.mother)
            ]!;
      }
      if (house < 0) {
        homes ??= homesFor(
          world,
          place.town,
          target.reduce((a, b) => a + b, 0),
        );
        house = houseFor(world, place, id, f, homes);
      }
      const i = addPerson(place, sex, occ, born, house);
      place.people.skill[i] = skillAt(f, age, occ);
      workOf(world, place, i);
      note(place, band === 0 ? HAP.born : HAP.came, id, band === 0 ? 0 : Math.round(age), occ);
    }
    changed = true;
  }
  if (changed) reckonMeans(world, place);
}

/**
 * A thing set for a day of the span to come (`due`): the day and the hour by a keyed draw, on the place's grid of ticks;
 * kept the soonest first.
 */
function dueIn(
  world: World,
  place: Place,
  span: number,
  key: number,
  what: number,
  a: number,
  b: number,
): void {
  const days = Math.max(1, Math.floor(span / DAY)),
    day = Math.floor(world.rng.unit(PLACE_DRAW, place.key ^ key, place.t, P.due, what) * days),
    tick = Math.floor(world.rng.unit(PLACE_DRAW, place.key ^ key, place.t, P.due, what + 16) * 144);
  dueAt(place, place.t + day * DAY + tick * PLACE_TICK, what, a, b);
}
function dueAt(place: Place, t: number, what: number, a: number, b: number): void {
  const d = place.due;
  let at = d.length;
  while (at > 0 && d[at - 4]! > t) at -= 4;
  d.splice(at, 0, t, what, a, b);
}

/** Where a town buries its dead: at its temple or its shrine where one stands, else in its square. */
const graveLot = (place: Place): number =>
  place.bldgs.lot[buildingOf(place, ["temple", "shrine"])]!;

/**
 * The pairs of a place's households, read when it is made: in each, its grown men and women, the eldest first, one to
 * one. (Whom its world's people pair with is theirs to say after: friends made in company, in the tick.)
 */
function pairHouses(place: Place, f: Frame): void {
  const p = place.people,
    of = new Map<number, [number[], number[]]>();
  for (let i = 0; i < p.n; i++) {
    if (p.mate[i] || ageOf(p, i, place.t) < f.life.adulthood) continue;
    let h = of.get(p.house[i]!);
    if (!h) of.set(p.house[i]!, (h = [[], []]));
    h[sexOf(p, i) === FEMALE ? 0 : 1]!.push(i);
  }
  for (const [women, men] of of.values()) {
    const eldest = (a: number, b: number) => p.born[a]! - p.born[b]! || p.id[a]! - p.id[b]!;
    women.sort(eldest);
    men.sort(eldest);
    for (let k = 0; k < Math.min(women.length, men.length); k++) {
      p.mate[women[k]!] = p.id[men[k]!]!;
      p.mate[men[k]!] = p.id[women[k]!]!;
    }
  }
}

/**
 * What is due at a place's clock, lived (`all`: everything that waits, at once: before a matching). A death: told as
 * what it was of, their household grieving, their burial set for the next morning. A leaving. A birth: to one who bears,
 * of an age to, one paired before any other, into her household. A coming: to a household with room, or a new one. A
 * burial: their household stands by for two hours where the town buries its dead. A pairing: the two are one household's,
 * the one of the smaller going to the other's.
 */
function liveDue(world: World, place: Place, f: Frame, all = false): void {
  const d = place.due;
  let changed = false;
  while (d.length && (all || d[0]! <= place.t)) {
    const [, what, a, b] = d.splice(0, 4) as [number, number, number, number],
      p = place.people,
      day = Math.floor(place.t / DAY);
    if (what === DUE.die || what === DUE.leave) {
      const i = placeIndexOf(place, a);
      if (i < 0) continue;
      const age = Math.round(ageOf(p, i, place.t)),
        h = p.house[i]!;
      if (what === DUE.leave) note(place, HAP.left, a, age, occOf(p, i), i);
      else {
        const told = b & 255;
        if (told === HAP.plague) note(place, HAP.plague, a, b >> 8, age, i);
        else if (told === HAP.famine) note(place, HAP.famine, a, age, 0, i);
        else note(place, HAP.died, a, age, occOf(p, i), i);
        place.houses.grief[h] = day;
        // (Buried the next morning, two hours before the middle of the day.)
        if (!all) dueAt(place, (day + 1) * DAY + 10 * HOUR, DUE.bury, a, h * 2 + sexOf(p, i));
      }
      removePerson(place, i);
      changed = true;
    } else if (what === DUE.born || what === DUE.come) {
      const row = Math.floor(a / OCCS),
        sex = Math.floor(row / BANDS),
        band = row % BANDS,
        occ = a % OCCS,
        id = place.nextId,
        lo = f.life.bands[band]!,
        hi = band + 1 < BANDS ? f.life.bands[band + 1]! : lo + f.life.oldest,
        age =
          what === DUE.born
            ? 0
            : lo + (hi - lo) * world.rng.unit(PLACE_DRAW, place.key ^ id, place.t, P.age);
      let house = -1,
        mother = 0;
      if (what === DUE.born) {
        // (Born to one who bears, of the age to: one paired, where any is.)
        const mothers: number[] = [],
          paired: number[] = [];
        for (let i = 0; i < p.n; i++)
          if (
            sexOf(p, i) === FEMALE &&
            (f.life.fertility[bandOf(ageOf(p, i, place.t), f.life)] ?? 0) > 0
          )
            (p.mate[i] && p.mate[i] !== PROMISED ? paired : mothers).push(i);
        const of = paired.length ? paired : mothers;
        if (of.length) {
          const m = of[world.rng.index(of.length, PLACE_DRAW, place.key ^ id, place.t, P.mother)]!;
          house = p.house[m]!;
          mother = p.id[m]!;
        }
      }
      if (house < 0) house = houseFor(world, place, id, f, homesFor(world, place.town, p.n + 1));
      const i = addPerson(place, sex, occ, Math.floor(place.t / DAY - age * 365), house);
      place.people.skill[i] = skillAt(f, age, occ);
      workOf(world, place, i);
      note(
        place,
        what === DUE.born ? HAP.born : HAP.came,
        id,
        what === DUE.born ? mother : Math.round(age),
        occ,
      );
      changed = true;
    } else if (what === DUE.bury) {
      const h = b >> 1;
      place.rite = [graveLot(place), place.t + 2 * HOUR, h];
      place.log.push({
        t: place.t,
        what: HAP.buried,
        id: a,
        a: place.houses.members[h] ?? 0,
        b: 0,
        k: place.houses.key[h] ?? 0,
        s: b & 1,
      });
    } else if (what === DUE.pair) {
      const i = placeIndexOf(place, a),
        j = placeIndexOf(place, b);
      if (i < 0 || j < 0 || p.mate[i] !== PROMISED || p.mate[j] !== PROMISED) continue;
      p.mate[i] = b;
      p.mate[j] = a;
      // (One household of the two: the one of the smaller goes to the other's.)
      const hi = p.house[i]!,
        hj = p.house[j]!;
      if (hi !== hj) {
        const mover =
            place.houses.members[hi]! < place.houses.members[hj]! ||
            (place.houses.members[hi] === place.houses.members[hj] && a > b)
              ? i
              : j,
          from = p.house[mover]!,
          to = mover === i ? hj : hi,
          old = place.houses.home[from]!,
          home = place.houses.home[to]!;
        place.houses.members[from]!--;
        place.houses.members[to]!++;
        p.house[mover] = to;
        if (p.work[mover] === old) p.work[mover] = home;
        if (!p.eta[mover] && p.at[mover] === old) p.at[mover] = p.to[mover] = home;
      }
      note(place, HAP.paired, a, b);
      changed = true;
    }
  }
  if (changed) reckonMeans(world, place);
}

/** The place matched to the world as it is now: its numbers for the ticks to come, its people, its stocks. */
function reconcile(
  world: World,
  place: Place,
  s: Settlement,
  f: Frame,
  month: number,
  /** Whether it is watched across this turn: what its land's count brings it is then lived over the month to come. */
  watched = false,
): void {
  // (Come back to after a while: what waited is lived at once, and its people matched as they then are.)
  if (!watched) {
    liveDue(world, place, f, true);
    place.rite = [];
  }
  const years = Math.max(0, (month - place.matched.month) / 12),
    turned = Math.floor(month / 12) > Math.floor(place.matched.month / 12);
  const was = place.matched.month;
  restand(world, place);
  place.matched = matchedOf(world, s, month, place.matched);
  // (Those a strike killed, taken off its people here: let go of once its town's count has been reckoned anew.)
  for (let k = place.gone.length - 2; k >= 0; k -= 2)
    if (place.gone[k]! < Math.floor(place.t / YEAR)) place.gone.splice(k, 2);
  // A year's turn: its men's tally in the battles fought at it. Who fell is told as its land's count takes them, below;
  // who came home wounded, after.
  const back = turned ? warYear(world, place) : [];
  const came = outbreakRead(world, place, month, was);
  rehome(world, place, f, CAUSE.none);
  // (The world reckons its births and deaths by the year: a matching across a year's turn tells a year's.)
  matchPeople(
    world,
    place,
    s,
    f,
    years,
    turned ? Math.max(1, years) : Math.max(1 / 12, years),
    turned && years <= 1 ? Math.floor(month / 12) - 1 : null,
    turned || !!came,
    // (A year's turn's, over the year to come but for its last weeks; a month's, over the month but for its last days.)
    !watched ? 0 : turned ? YEAR - 40 * DAY : 28 * DAY,
  );
  // (The dead of a sickness are named at the matching it came by, and no later: its count is not kept for other deaths.)
  for (let k = place.tolls.length - 2; k >= 0; k -= 2)
    if (place.tolls[k]! >= CAUSE.sickness && place.tolls[k]! < 100) place.tolls.splice(k, 2);
  if (came) sickened(world, place, came.at, came.lived);
  bringOf(world, place);
  // (What stood unwon in its fields at the month's turn is its land's count's, not its own: reckoned from nothing again.)
  place.ripe.fill(0);
  // (Anyone whose work stood in a building now gone works where their trade does now.)
  const p = place.people;
  for (let i = 0; i < p.n; i++)
    if (
      p.work[i]! >= 0 &&
      bldgAt(place, p.work[i]!) < 0 &&
      p.work[i] !== place.houses.home[p.house[i]!]
    )
      workOf(world, place, i);
  for (let k = 0; k < back.length; k += 2) woundOf(world, place, f, back[k]!, back[k + 1]!);
  // (A death counted that no one of the place could be told as, a year on: let go.)
  if (turned) place.tolls.length = 0;
  crewSites(world, place, f);
  armsCrew(world, place, f);
  matchStocks(place, stockShare(world, place.cell, p.n), f);
  unlinkRoster(world, place);
}

/**
 * A sickness come to its land since the place was last matched (sim/health: an outbreak's dead are taken from its land's
 * count the moment it comes). The world's count says how many: the share of its land's people it killed. The place says
 * whom: so many of its own are the next its land's count takes, told as dead of it, the sick first; and for each of its
 * dead as many more lay sick of it and lived as the sickness's own deadliness leaves (of those who take it, so many die).
 * Which sickness (its place among the place's names of them), and how many lived through it; null: none came.
 */
function outbreakRead(
  world: World,
  place: Place,
  month: number,
  /** The month the place was last matched in. */
  was: number,
): { at: number; lived: number } | null {
  const health = healthOf(world),
    last = health?.land(place.cell)?.last,
    sickness = last ? health!.get(last.sickness) : undefined;
  if (!last || !sickness || last.event === place.plague) return null;
  place.plague = last.event;
  // (One that came before the place was last matched and went unread, a save from before they were read: long counted.)
  if (last.year < Math.floor(was / 12) || last.year > Math.floor(month / 12)) return null;
  const name = `${sickness.name}|${sickness.ref}`;
  let at = place.ills.indexOf(name);
  if (at < 0) at = place.ills.push(name) - 1;
  // (A cause is a byte, and a battle's begin at 100.)
  if (at >= 100 - CAUSE.sickness) return null;
  // (Its land's count lost them the moment it came; its town's own count is reckoned anew only at the next year's turn,
  // and till then says nothing of them. They are counted off its people here from now, as a strike's dead are: so no one
  // of the town stands in for its dead, and at the year's turn those its count has taken in since are told as come.)
  const dead = Math.round(last.share * place.people.n);
  if (dead > 0) {
    place.tolls.push(CAUSE.sickness + at, dead);
    place.gone.push(Math.floor(month / 12), dead);
  }
  return {
    at,
    lived: Math.round(dead * (1 / Math.max(0.02, Math.min(1, sickness.deadliness)) - 1)),
  };
}

/**
 * Those who took a sickness that came and lived: so many of the place's well lie sick of it now, abed for the days a
 * sickness that marks takes with who tends them (rules/healing.ts), each a different while of them, so that they are
 * up again one after another over the weeks after. Who, by a keyed draw: those long in want first.
 */
function sickened(world: World, place: Place, at: number, n: number): void {
  const p = place.people,
    care = 1 - HEAL_CARE * (place.matched.care ?? 0),
    well: number[] = [];
  for (let i = 0; i < p.n; i++) if (!p.health[i]) well.push(i);
  const draw = new Map(
    well.map((i) => [i, world.rng.unit(PLACE_DRAW, place.key ^ p.id[i]!, place.t, P.ail)]),
  );
  well.sort(
    (a, b) =>
      (p.lack[b]! >= 144 ? 1 : 0) - (p.lack[a]! >= 144 ? 1 : 0) ||
      draw.get(a)! - draw.get(b)! ||
      p.id[a]! - p.id[b]!,
  );
  let told = 0;
  for (const i of well.slice(0, n)) {
    const tended = HEAL_TENDED[tendedOf(place, i)] * care,
      // (From the days abed of a sickness that marks, to those and its days of mending: each by a draw of their own.)
      days =
        HEAL_DAYS.scarred[0] +
        HEAL_DAYS.scarred[1] * world.rng.unit(PLACE_DRAW, place.key ^ p.id[i]!, place.t, P.ail, 1);
    p.health[i] = 2;
    p.cause[i] = CAUSE.sickness + at;
    p.ill[i] = Math.max(1, Math.round(days * tended * 144));
    // (A few are told by name; all are counted. A great sickness lays hundreds low in a day.)
    if (told++ < SICK_TOLD) note(place, HAP.sick, p.id[i]!, at);
  }
  if (well.length && n > 0) counted(place, HAP.sick, at, Math.min(n, well.length));
}
/** Of those a sickness lays low at its coming, how many the log names. */
const SICK_TOLD = 12;

/** Whether a siege lies about a town: its land is besieged, and it is its land's heart (sim/war/siege.ts). */
function besieged(world: World, s: Settlement): boolean {
  const sieges = siegesOf(world);
  if (!sieges || sieges.dormant()) return false;
  for (const war of sieges.wars())
    if (sieges.of(war)?.land === s.cell)
      return heartOf(populationContext(world), s.cell)?.ref === s.ref;
  return false;
}

/**
 * The households whose home stands no longer (its town's fabric holds no home on their lot) are named, and go to the
 * building opened to them by an order (sim/town/managed.ts place.shelter) if it stands, else in with others in the home
 * with most room. And those sheltering in a building go to a home once one has room. Which households lost theirs.
 */
function rehome(world: World, place: Place, f: Frame, cause: number): number[] {
  const fab = townsOf(world).get(place.town),
    h = place.houses,
    p = place.people;
  if (!fab) return [];
  const lots = new Set<number>(),
    sheltering: number[] = [],
    roofless: number[] = [];
  for (let k = 0; k < h.n; k++) {
    if (h.members[k]! <= 0) continue;
    // (Those who lost a home and found no roof live in the square, in the weather.)
    if (h.home[k]! < 0) {
      if (h.lost[k]! >= 0) roofless.push(k);
      continue;
    }
    if (bldgAt(place, h.home[k]!) > 0) sheltering.push(k);
    else lots.add(h.home[k]!);
  }
  const sorted = [...lots].sort((a, b) => a - b),
    gone = new Set<number>();
  for (let k = 0; k < sorted.length;) {
    const from = sorted[k]!,
      to = Math.min(fab.next, from + 4096),
      levels = to > from ? levelsOf(fab, from, to) : null;
    for (; k < sorted.length && sorted[k]! < from + 4096; k++)
      if (!levels || sorted[k]! >= to || levels[sorted[k]! - from]! < 0) gone.add(sorted[k]!);
  }
  if (!gone.size && !sheltering.length && !roofless.length) return [];
  const orders = managedOf(world)?.get(place.town),
    sb = orders && orders.shelter >= 0 ? bldgAt(place, orders.shelter) : -1,
    shelter = sb > 0 && !place.bldgs.site[sb] ? orders!.shelter : -1,
    homes = homesFor(world, place.town, p.n),
    day = Math.floor(place.t / DAY),
    out: number[] = [],
    move = (k: number, to: number, what: number): void => {
      const old = h.home[k]!;
      h.home[k] = to;
      let told = false;
      for (let i = 0; i < p.n; i++) {
        if (p.house[i] !== k) continue;
        if (!told) note(place, what, p.id[i]!, cause, to);
        told = true;
        if (p.work[i] === old) p.work[i] = to;
      }
    };
  // Who lives on each lot, and the home with most room that can take so many more (-1: none can).
  const living = new Map<number, number>();
  for (let k = 0; k < h.n; k++)
    if (h.members[k]! > 0 && !gone.has(h.home[k]!))
      living.set(h.home[k]!, (living.get(h.home[k]!) ?? 0) + h.members[k]!);
  const roomFor = (members: number): number => {
    let best = -1,
      least = Infinity;
    for (let q = 0; q < homes.lot.length; q++) {
      const there = living.get(homes.lot[q]!) ?? 0,
        full = there / homes.holds[q]!;
      if (there + members > homes.holds[q]! || full >= least) continue;
      least = full;
      best = homes.lot[q]!;
    }
    return best;
  };
  const settleIn = (k: number, to: number, what: number): void => {
    living.set(to, (living.get(to) ?? 0) + h.members[k]!);
    move(k, to, what);
  };
  // Those whose home is gone: to the building opened to them; else in with others where a home has room for them; else
  // they have no roof, and live in the square in whatever weather their land has.
  for (let k = 0; k < h.n; k++) {
    if (h.members[k]! <= 0 || !gone.has(h.home[k]!)) continue;
    h.lost[k] = day;
    out.push(k);
    const room = shelter >= 0 ? shelter : roomFor(h.members[k]!);
    settleIn(k, room >= 0 ? room : AT.square, HAP.homeless);
  }
  // (Out of the weather into the building opened; and out of it, or the weather, into a home once one has room for them.)
  for (const k of [...roofless, ...sheltering]) {
    const room = roomFor(h.members[k]!);
    if (room >= 0) settleIn(k, room, HAP.rehoused);
    else if (shelter >= 0 && h.home[k] !== shelter) settleIn(k, shelter, HAP.sheltered);
  }
  layLots(world, place);
  return out;
}

/** The blow a hurt of each cause is (rules/wounds.ts Blow): what a fire does, what falling stone does, what a tool does. */
function blowOf(place: Place, i: number, cause: number): Blow {
  if (cause === CAUSE.fire || cause === CAUSE.meteor || cause === CAUSE.raid) return "fire";
  if (cause === CAUSE.quake) return "crush";
  if (cause === CAUSE.battle) return "edge";
  // (At their work: a herder by a beast, one at a machine by it, anyone else by the edge of their own tool.)
  const p = place.people,
    occ = occOf(p, i);
  return occ === OCC.herder
    ? "blunt"
    : p.craft[i] && RECIPES[p.craft[i]! - 1]!.output[0] === G.machines
      ? "crush"
      : "edge";
}

/** Who tends one of a place's hurt or sick: its hospital where it keeps one, else its healer where its land knows herb-lore, else their household, else kin. */
export function tendedOf(place: Place, i: number): Tended {
  return tendedBy(
    buildingOf(place, ["hospital"]) > 0,
    !!place.matched.healer,
    place.houses.members[place.people.house[i]!]! > 1,
  );
}

/**
 * One of a place's people hurt, of a cause: where on their body, by the blow it was; what comes of it (healed clean, a
 * scar, a limb left lame: the fewer lamed the more its land knows of care); and abed for the days such a wound takes
 * with that care and who tends it (rules/healing.ts healDays). What it leaves them with is kept (`mark`).
 */
function wound(world: World, place: Place, i: number, cause: number): void {
  const p = place.people,
    f = frameFor(world, place, i),
    blow = blowOf(place, i, cause),
    care = place.matched.care ?? 0,
    r = (k: number) => world.rng.unit(PLACE_DRAW, place.key ^ p.id[i]!, place.t, P.wound, k),
    member = memberOf(hurtWeights(f.anatomy, blow), r(0)),
    outcome = outcomeOf(member, blow, care, r(1)),
    days = healDays(outcome, member, blow, care, tendedOf(place, i));
  p.health[i] = 1;
  // (What it was of, and the member it was to, eight times over: bound while it mends, that member does none of its share.)
  p.cause[i] = cause | ((MEMBERS.indexOf(member) + 1) << 3);
  p.ill[i] = days.abed * 144;
  // (A worse mark is not lost to a lighter one.)
  const mark =
    outcome === "healed" ? 0 : (MEMBERS.indexOf(member) + 1) | ((outcome === "lame" ? 2 : 1) << 4);
  if (mark >> 4 >= p.mark[i]! >> 4) p.mark[i] = mark || p.mark[i]!;
}

/** What a wound left one with, read: the member in their body's words ("their left leg"), what came of it, how it shows. */
export function placeMark(
  world: World,
  place: Place,
  i: number,
): { member: string; outcome: "scarred" | "lame"; lasting: Lasting } | null {
  const mark = place.people.mark[i]!,
    member = MEMBERS[(mark & 15) - 1];
  if (!mark || !member) return null;
  const a = frameFor(world, place, i).anatomy,
    outcome = mark >> 4 === 2 ? "lame" : "scarred";
  return {
    member: (a.words[member] ?? "~ body").replace(/~/g, "their"),
    outcome,
    lasting: lastingOf(a, member, outcome),
  };
}
/** The one whom one of a place's people is paired with, or promised to (their number; null: no one). */
export function placeMate(place: Place, i: number): { id: number; promised: boolean } | null {
  const p = place.people,
    mate = p.mate[i]!;
  if (!mate) return null;
  return mate === PROMISED ? { id: p.friend[i]!, promised: true } : { id: mate, promised: false };
}
/** How many a place's people are with what waits counted as lived: those due to be born or to come with them, those due to die or to leave not. */
export function placeSettled(place: Place): number {
  let n = place.people.n;
  for (let k = 0; k < place.due.length; k += 4) {
    const what = place.due[k + 1]!;
    if (what === DUE.born || what === DUE.come) n++;
    else if (
      (what === DUE.die || what === DUE.leave) &&
      placeIndexOf(place, place.due[k + 2]!) >= 0
    )
      n--;
  }
  return n;
}
/** What waits for a place to live it (its `due`), as tests and tools read it: when, and what. */
export function placeDue(place: Place): { t: number; what: string; a: number; b: number }[] {
  const names = ["", "die", "leave", "born", "come", "bury", "pair"],
    out: { t: number; what: string; a: number; b: number }[] = [];
  for (let k = 0; k < place.due.length; k += 4)
    out.push({
      t: place.due[k]!,
      what: names[place.due[k + 1]!] ?? "",
      a: place.due[k + 2]!,
      b: place.due[k + 3]!,
    });
  return out;
}
/** The legs and arms of one of a place's people, by their own people's body. */
export function placeLimbs(world: World, place: Place, i: number): { legs: number; arms: number } {
  const f = frameFor(world, place, i);
  return { legs: f.legs, arms: f.arms };
}
/** A member in the words of the body of one of a place's people: "their left leg". */
export function placeMember(world: World, place: Place, i: number, member: Member): string {
  return (frameFor(world, place, i).anatomy.words[member] ?? "~ body").replace(/~/g, "their");
}
/** What one hurt is hurt of (a CAUSE), and the member the wound is to (null: a save from before it was kept, or sick). */
export function hurtOf(place: Place, i: number): { cause: number; member: Member | null } {
  const c = place.people.cause[i]!;
  return place.people.health[i] === 2
    ? { cause: c, member: null }
    : { cause: c & 7, member: MEMBERS[(c >> 3) - 1] ?? null };
}
/**
 * What a wound takes of one's going and of one's handling, 0 … 1: the share of their body's legs and arms that the member
 * it left lame was, and the one bound while it mends (rules/anatomy.ts limbShare, by their own people's body). A leg of
 * two is half one's going; an arm of two, half one's handling; a body bound about its trunk handles nothing till it mends.
 */
export function woundTakes(
  world: World,
  place: Place,
  i: number,
): { going: number; handling: number } {
  const p = place.people,
    mark = p.mark[i]!,
    lame = mark >> 4 === 2 ? MEMBERS[(mark & 15) - 1] : undefined,
    bound = p.health[i] === 3 ? MEMBERS[(p.cause[i]! >> 3) - 1] : undefined;
  if (!lame && !bound) return { going: 0, handling: 0 };
  const f = frameFor(world, place, i),
    a = lame ? limbShare(lame, f.legs, f.arms) : { going: 0, handling: 0 },
    b = bound && bound !== lame ? limbShare(bound, f.legs, f.arms) : { going: 0, handling: 0 };
  return { going: Math.min(1, a.going + b.going), handling: Math.min(1, a.handling + b.handling) };
}
/** How many times as long a walk takes one for it (1: as long as anyone; never more than four times). */
export const gaitOf = (going: number): number => 1 / (1 - Math.min(0.75, going));
/** What a strike is, as a cause of hurt and death. */
const STRIKE_CAUSE: Readonly<Record<TownStrike["kind"], number>> = {
  fire: 3,
  quake: 4,
  meteor: 5,
  raid: 6,
};

/**
 * A strike on the town, as its place's clock passes it. The world has counted what it cost (how many homes, how many
 * dead, and by the strike's own ratio how many hurt who lived); the place says whom: the households whose home is gone
 * are named and housed; as many are hurt, abed as a wound is, those of the homes struck first; and as many die as the
 * world's count, those of the homes struck first, of the kinds its land's count is short by. A fire is fought for a day.
 */
function struck(world: World, place: Place, s: Settlement, f: Frame, k: TownStrike): void {
  const cause = STRIKE_CAUSE[k.kind],
    year = Math.floor(place.t / YEAR),
    day = Math.floor(place.t / DAY),
    before = place.houses.home.slice();
  restand(world, place);
  const lost = new Set(rehome(world, place, f, cause)),
    p = () => place.people,
    // (Who was nearest it: those of the homes it took, then anyone, by a keyed draw.)
    near: number[] = [];
  for (let i = 0; i < p().n; i++) near.push(i);
  const draw = new Map(
    near.map((i) => [i, world.rng.unit(PLACE_DRAW, place.key ^ p().id[i]!, place.t, P.struck)]),
  );
  near.sort(
    (a, b) =>
      (lost.has(p().house[a]!) ? 0 : 1) - (lost.has(p().house[b]!) ? 0 : 1) ||
      draw.get(a)! - draw.get(b)! ||
      p().id[a]! - p().id[b]!,
  );
  const order = near.map((i) => p().id[i]!);
  let toll = k.dead ?? 0;
  const taken = new Set<number>();
  if (toll > 0) {
    // (Counted off its town's people from now: its town's own count is reckoned anew only at the year's turn.)
    place.gone.push(year, toll);
    const target = targetTable(world, s, place),
      now = placeTable(place, f.life);
    for (const i of near) {
      if (toll <= 0) break;
      const c =
        (sexOf(p(), i) * BANDS + bandOf(ageOf(p(), i, place.t), f.life)) * OCCS + occOf(p(), i);
      if (now[c]! <= target[c]!) continue;
      now[c]!--;
      taken.add(p().id[i]!);
      toll--;
    }
    for (const id of order) {
      if (!taken.has(id)) continue;
      const i = placeIndexOf(place, id);
      note(place, HAP.struckDead, id, cause, Math.round(ageOf(p(), i, place.t)), i);
      place.houses.grief[p().house[i]!] = day;
      removePerson(place, i);
    }
    // (Those the place cannot yet place among its land's kinds are named at the next matching.)
    if (toll > 0) place.tolls.push(cause, toll);
  }
  let hurt = k.hurt ?? 0;
  for (const id of order) {
    if (hurt <= 0) break;
    const i = placeIndexOf(place, id);
    if (i < 0 || p().health[i]) continue;
    wound(world, place, i, cause);
    note(place, HAP.struckHurt, id, cause);
    hurt--;
  }
  // (A fire, or what fire came down with: fought for a day where it fell, or where the first home it took stood.)
  if (k.kind !== "quake") {
    const first = [...lost][0],
      at = k.lot >= 0 ? k.lot : first !== undefined ? before[first]! : AT.square;
    place.fire = [at, k.at + DAY, cryReach(world, place)];
  }
  if (lost.size || taken.size) reckonMeans(world, place);
}

/**
 * Its men's tally in the battles fought at the year's turn just passed (host/burials.ts townTally: sent, fallen, wounded
 * who lived): its fallen are the next of its grown its land's count takes, told as fallen there; its wounded, [battle,
 * count] one after another, are named once its people are matched.
 */
function warYear(world: World, place: Place): number[] {
  const year = Math.floor(place.t / YEAR),
    back: number[] = [];
  if (year <= place.war) return back;
  place.war = year;
  for (const { b } of battlesOfYear(world, year - 1))
    for (const side of [0, 1] as const) {
      const tally = townTally(world, b, side, place.town);
      if (!tally || tally[0] <= 0 || place.wars.length >= 150) continue;
      const name = `${battleWords(world, b.land)}|${b.event}`;
      let at = place.wars.indexOf(name);
      if (at < 0) at = place.wars.push(name) - 1;
      if (tally[1] > 0) place.tolls.push(100 + at, tally[1]);
      if (tally[2] > 0) back.push(at, tally[2]);
    }
  return back;
}

/** So many of its grown come home wounded from a battle: those who stood to arms first, then by a keyed draw. Abed as a wound is. */
function woundOf(world: World, place: Place, f: Frame, battle: number, n: number): void {
  const p = place.people,
    free: number[] = [];
  for (let i = 0; i < p.n; i++)
    if (!p.health[i] && occOf(p, i) !== OCC.dependent && ageOf(p, i, place.t) >= f.life.adulthood)
      free.push(i);
  const draw = new Map(
    free.map((i) => [i, world.rng.unit(PLACE_DRAW, place.key ^ p.id[i]!, place.t, P.struck)]),
  );
  free.sort(
    (a, b) =>
      (p.bound[a] === BOUND_ARMS ? 0 : 1) - (p.bound[b] === BOUND_ARMS ? 0 : 1) ||
      draw.get(a)! - draw.get(b)! ||
      p.id[a]! - p.id[b]!,
  );
  for (const i of free.slice(0, n)) {
    wound(world, place, i, CAUSE.battle);
    note(place, HAP.wounded, p.id[i]!, battle);
  }
}

/**
 * How many of a town's grown hands keep its fire watch where it is ordered to: the answer's own asking (rules/lessons.ts
 * firebreaks: `asks`) of the hands a priority gladly taken up pulls, the very hands its land's harvest is short by for it.
 */
export function watchWanted(hands: number): number {
  return Math.max(
    1,
    Math.round((LESSON_RESPONSE.get("firebreaks")?.asks ?? 0) * ASK_PULL.glad * hands),
  );
}

/**
 * How far a cry carries in a town, by its streets (metres): out to where it is no louder than the town's own noise, and
 * no further than the stillest air lets it, or, where the town lies in the dark and asleep, than wakes a sleeper. A cry
 * thins as any sound does, by the square of how far it has come; the town's noise is the talk of those awake and out of
 * their homes, spread over its ground (each as loud as a voice, summed over a disc of the town's size: twice a voice's
 * loudness at a metre, times how many, times the logarithm of its reach, over its reach squared). So a cry carries a few
 * dozen metres through a busy day, a few dozen through a sleeping night, and a kilometre across a still dawn.
 */
export function cryReach(world: World, place: Place): number {
  const p = place.people,
    f = frameOf(world, place.cell);
  let out = 0;
  for (let i = 0; i < p.n; i++)
    if (
      p.act[i] !== ACT.sleep &&
      p.act[i] !== ACT.abed &&
      (p.eta[i]! > 0 || p.at[i] !== place.houses.home[p.house[i]!])
    )
      out++;
  const reach = Math.sqrt((Math.max(1, place.matched.lots) * LOT_GROUND) / Math.PI),
    noise = (2 * VOICE.talk * out * Math.log(Math.max(Math.E, reach))) / (reach * reach),
    floor = airOf(f, place.t).lit ? VOICE.still : VOICE.wake;
  return Math.round(Math.sqrt(VOICE.cry / Math.max(noise, floor)));
}

/**
 * Who turns out to a fire. Of themselves, the grown at a trade whose home stands within a cry of it by the town's streets,
 * but for one of each household with young of the first band and no elder at home, who stays with them. Where a watch is
 * kept by order, its watch besides, from anywhere in the town: so many of its grown hands as the order takes from its
 * fields (watchWanted), who by a keyed draw. Kept while the fire burns and its people stand as they are.
 */
const FIRE_CREWS = new WeakMap<Place, { key: string; ids: Set<number> }>();
function fireCrew(world: World, place: Place, f: Frame, lot: number, watch: boolean): Set<number> {
  const p = place.people,
    key = `${lot}|${place.fire[1]}|${watch}|${p.n}|${place.nextId}`,
    was = FIRE_CREWS.get(place);
  if (was && was.key === key) return was.ids;
  // (How far the cry of it carried when it was raised: kept with the fire. One kept from before it was: as it would now.)
  if (place.fire.length === 2) place.fire.push(cryReach(world, place));
  const cry = place.fire[2] ?? 0,
    ids = new Set<number>(),
    young = new Uint8Array(place.houses.n),
    elder = new Uint8Array(place.houses.n),
    hands: number[] = [];
  for (let i = 0; i < p.n; i++) {
    const age = ageOf(p, i, place.t);
    if (bandOf(age, f.life) === 0) young[p.house[i]!] = 1;
    else if (age >= f.life.adulthood && occOf(p, i) === OCC.dependent) elder[p.house[i]!] = 1;
  }
  for (let i = 0; i < p.n; i++) {
    if (occOf(p, i) === OCC.dependent || ageOf(p, i, place.t) < f.life.adulthood) continue;
    if (CREW_FROM.includes(occOf(p, i))) hands.push(i);
    const h = p.house[i]!,
      home = place.houses.home[h]!;
    if (streetLength(place, home < 0 ? AT.square : home, lot < 0 ? AT.square : lot) > cry) continue;
    // (The first of a household with young and no elder stays with them.)
    if (young[h] === 1 && !elder[h]) {
      young[h] = 2;
      continue;
    }
    ids.add(p.id[i]!);
  }
  if (watch) {
    const draw = new Map(
      hands.map((i) => [i, world.rng.unit(PLACE_DRAW, place.key ^ p.id[i]!, 0, P.watch)]),
    );
    hands.sort((a, b) => draw.get(a)! - draw.get(b)! || p.id[a]! - p.id[b]!);
    for (const i of hands.slice(0, watchWanted(hands.length))) ids.add(p.id[i]!);
  }
  FIRE_CREWS.set(place, { key, ids });
  return ids;
}

/** How many of a town's grown hands stand to arms where it is ordered to: what a priority gladly taken up pulls of them. */
export function armsWanted(hands: number): number {
  return Math.round(ASK_PULL.glad * hands);
}

/**
 * Those standing to arms by its order (sim/town/managed.ts place.respond, muster) made up: so many of its grown at the
 * trades an order can move (armsWanted), well and held by no other order, taken as a site's crew is; all stood down
 * where the order is let go.
 */
function armsCrew(world: World, place: Place, f: Frame): void {
  const p = place.people,
    on = !!managedOf(world)?.get(place.town)?.held.includes("muster"),
    have: number[] = [],
    free: number[] = [];
  let hands = 0;
  for (let i = 0; i < p.n; i++) {
    if (p.bound[i] === BOUND_ARMS) have.push(i);
    if (!CREW_FROM.includes(occOf(p, i)) || ageOf(p, i, place.t) < f.life.adulthood) continue;
    hands++;
    if (!p.bound[i] && !p.ill[i]) free.push(i);
  }
  const want = on ? armsWanted(hands) : 0;
  while (have.length > want) {
    const i = have.pop()!;
    p.bound[i] = 0;
    workOf(world, place, i);
    if (p.act[i] === ACT.guard) p.act[i] = ACT.idle;
    note(place, HAP.stoodDown, p.id[i]!);
  }
  if (have.length >= want) return;
  const draw = new Map(
    free.map((i) => [i, world.rng.unit(PLACE_DRAW, place.key ^ p.id[i]!, 0, P.arms)]),
  );
  free.sort(
    (a, b) =>
      CREW_FROM.indexOf(occOf(p, a)) - CREW_FROM.indexOf(occOf(p, b)) ||
      draw.get(a)! - draw.get(b)! ||
      p.id[a]! - p.id[b]!,
  );
  for (const i of free.slice(0, want - have.length)) {
    if (p.carry[i]! > 0) place.bldgs.stock[p.carryGood[i]!]! += p.carry[i]!;
    p.carry[i] = 0;
    p.bound[i] = BOUND_ARMS;
    note(place, HAP.mustered, p.id[i]!);
  }
}

/** Its buildings as they stand now: one fallen gives up its stock to the square, one raised begins empty. */
function restand(world: World, place: Place): void {
  const stand = buildingsOf(world, place.town, Math.floor(place.t / YEAR)),
    old = place.bldgs;
  for (let b = 0; b < old.lot.length; b++) {
    let to = stand.lot.findIndex((lot, k) => lot === old.lot[b] && stand.start[k] === old.start[b]);
    if (to < 0) to = 0;
    for (let g = 0; g < GOOD_COUNT; g++)
      stand.stock[to * GOOD_COUNT + g]! += old.stock[b * GOOD_COUNT + g]!;
  }
  place.bldgs = stand;
}

/** What its town was asked to raise, as a place reads it: each building asked for, done or going up, and by whose hands. */
function sitesKey(world: World, place: Place): string {
  const asks = asksIn(world, place.town);
  if (!asks.length) return "";
  const m = managedOf(world)?.get(place.town);
  let key = "";
  for (const a of asks) {
    const w = a.work;
    if (!w || (w.at < 0 && a.what !== "walls")) continue;
    key += w.left
      ? `${a.n}x `
      : w.done !== null
        ? `${a.n}d `
        : `${a.n}${siteInHand(m, a.n) ? `h${w.hands}` : ""} `;
  }
  return key;
}

/**
 * A place's sites brought to what its town was asked to raise now: its buildings read anew where an asking was given,
 * finished or given up; the sites it has in hand kept (one newly taken begins with nothing brought), the rest let go; and
 * each one's crew made up. Asked every time the place is brought on; nothing is done where nothing has changed.
 */
function syncSites(world: World, place: Place, f: Frame): void {
  const key = sitesKey(world, place);
  if (key === place.sited) return;
  place.sited = key;
  restand(world, place);
  const m = managedOf(world)?.get(place.town),
    next: PlaceSite[] = [];
  for (let b = 1; b < place.bldgs.lot.length; b++) {
    const n = place.bldgs.site[b]! - 1;
    if (n < 0 || !siteInHand(m, n)) continue;
    next.push(
      place.sites.find((x) => x.n === n) ?? {
        n,
        lot: place.bldgs.lot[b]!,
        ticks: 0,
        from: place.t,
        stuff: 0,
        brought: 0,
      },
    );
  }
  place.sites = next;
  crewSites(world, place, f);
}

/**
 * Each site's crew made up to the hands its asking has: those too many go back to their own work; those wanting are taken
 * of its grown and well whom no order holds, its farmers first (the hands a site takes are the fields', sim/town/asks.ts),
 * who by a keyed draw. They keep their trade in its land's count: what they do not bring in is the drain its land's
 * harvest already bears for the site.
 */
function crewSites(world: World, place: Place, f: Frame): void {
  const p = place.people,
    asks = asksIn(world, place.town),
    want = new Map<number, number>(),
    have = new Map<number, number[]>(),
    prios = prioMap(managedOf(world)?.get(place.town)),
    release = (i: number): void => {
      // (Back to their own work: held to the trade their priorities name, where any are set for them.)
      const packed = prios?.get(p.id[i]!),
        trade = packed === undefined ? -1 : prioTrade(prioOf(packed), occOf(p, i));
      p.bound[i] = trade >= 0 ? trade + 1 : 0;
      workOf(world, place, i);
      if (p.act[i] === ACT.build || p.act[i] === ACT.stuff) p.act[i] = ACT.idle;
      note(place, HAP.uncrew, p.id[i]!);
    };
  for (const x of place.sites) want.set(x.lot, asks[x.n]?.work?.hands ?? 0);
  for (let i = 0; i < p.n; i++) {
    if (p.bound[i] !== BOUND_SITE) continue;
    if (!want.has(p.work[i]!)) release(i);
    else if (have.has(p.work[i]!)) have.get(p.work[i]!)!.push(i);
    else have.set(p.work[i]!, [i]);
  }
  for (const [lot, n] of want) {
    const crew = have.get(lot) ?? [];
    while (crew.length > n) release(crew.pop()!);
    if (crew.length >= n) continue;
    const free: number[] = [];
    for (let i = 0; i < p.n; i++)
      if (
        // (Held by no order; or only to the trade their priorities name, which say besides whether they build.)
        (!p.bound[i] || (p.bound[i]! < BOUND_ARMS - 1 && !!prios?.has(p.id[i]!))) &&
        !p.ill[i] &&
        CREW_FROM.includes(occOf(p, i)) &&
        ageOf(p, i, place.t) >= f.life.adulthood
      )
        free.push(i);
    // (Those set to building first, by how high; one set never to build is not taken. Then its fields' hands, as before.)
    const prio = prios,
      building = (i: number): number => {
        const packed = prio?.get(p.id[i]!);
        return packed === undefined ? 1 : (packed >> (2 * (PRIO_KINDS.length - 1))) & 3;
      };
    if (prio)
      for (let k = free.length - 1; k >= 0; k--) if (building(free[k]!) === 0) free.splice(k, 1);
    const draw = new Map(
      free.map((i) => [i, world.rng.unit(PLACE_DRAW, place.key ^ p.id[i]!, lot, P.crew)]),
    );
    free.sort(
      (a, b) =>
        (prio ? building(b) - building(a) : 0) ||
        CREW_FROM.indexOf(occOf(p, a)) - CREW_FROM.indexOf(occOf(p, b)) ||
        draw.get(a)! - draw.get(b)! ||
        p.id[a]! - p.id[b]!,
    );
    for (const i of free.slice(0, n - crew.length)) {
      // (What they had in hand is set down in the square.)
      if (p.carry[i]! > 0) place.bldgs.stock[p.carryGood[i]!]! += p.carry[i]!;
      p.carry[i] = 0;
      p.bound[i] = BOUND_SITE;
      p.craft[i] = 0;
      p.work[i] = lot;
      if (!p.eta[i]) p.act[i] = ACT.idle;
      note(place, HAP.crew, p.id[i]!, lot);
    }
  }
}

/** A place made of a town as it stands now. */
function makePlace(world: World, s: Settlement): Place | null {
  const f = frameOf(world, s.cell),
    t = Math.floor(world.now / PLACE_TICK) * PLACE_TICK,
    start = t - SETTLE,
    month = Math.floor(world.now / MONTH),
    table = targetTable(world, s, null),
    n = table.reduce((a, b) => a + b, 0),
    key = hashString(`place ${s.ref}`);
  // (A town whose land keeps no table of its people, a colony's on another body: nothing to keep one by one.)
  if (n <= 0) return null;
  const place: Place = {
    town: s.ref,
    cell: s.cell,
    key,
    entered: t,
    t: start,
    used: 0,
    nextId: 1,
    nextHouse: 0,
    people: peopleOf(Math.max(16, n)),
    houses: {
      n: 0,
      key: [],
      home: [],
      fifth: [],
      means: [],
      members: [],
      pantry: [],
      grief: [],
      fresh: [],
      lost: [],
      kind: [],
    },
    bldgs: buildingsOf(world, s.ref, Math.floor(world.now / YEAR)),
    matched: matchedOf(world, s, month),
    base: new Array<number>(GOOD_COUNT).fill(0),
    flow: new Array<number>(GOOD_COUNT).fill(0),
    log: [],
    moves: [],
    dead: [],
    ordered: "",
    sites: [],
    sited: "",
    figRef: [],
    figId: [],
    figName: [],
    ills: [],
    seen: t,
    // (What came to its land before it was made is in its people's count already.)
    plague: healthOf(world)?.land(s.cell)?.last?.event ?? "",
    counts: [],
    tolls: [],
    gone: [],
    fire: [],
    wars: [],
    war: Math.floor(t / YEAR),
    day: Math.floor(t / DAY),
    madeDay: new Array<number>(GOOD_COUNT).fill(0),
    usedDay: new Array<number>(GOOD_COUNT).fill(0),
    cameDay: new Array<number>(GOOD_COUNT).fill(0),
    ripe: new Array<number>(GOOD_COUNT).fill(0),
    due: [],
    rite: [],
  };
  // Its households, each in a home: as many as a hearth's mouths make of its people, the homes filled from its heart.
  // (Each home takes of them by its beds: so many households as its share of all the beds read.)
  const homes = homesFor(world, s.ref, n),
    count = Math.max(1, Math.ceil(n / f.hearth));
  let beds = 0;
  for (const b of homes.holds) beds += b;
  let home = 0,
    passed = homes.holds[0] ?? 0;
  for (let h = 0; h < count; h++) {
    // (The household whose place among them falls within this home's beds lives in it.)
    const at = ((h + 0.5) / count) * beds;
    while (passed <= at && home + 1 < homes.lot.length) passed += homes.holds[++home]!;
    addHouse(place, homes.lot[home] ?? AT.square);
  }
  // (Of its land's peoples, where it is of more than one: its households by its land's shares, which by a keyed draw.)
  const mix = place.matched.mix;
  if (mix && mix.filter((x) => x > 0).length > 1) {
    const each = apportion(
        count,
        mix.map((x) => Math.max(0, x)),
      ),
      order = Array.from({ length: count }, (_, h) => h).sort(
        (a, b) =>
          world.rng.unit(PLACE_DRAW, key ^ place.houses.key[a]!, 0, P.house) -
            world.rng.unit(PLACE_DRAW, key ^ place.houses.key[b]!, 0, P.house) || a - b,
      );
    let at = 0;
    each.forEach((n, k) => {
      for (let q = 0; q < n; q++) place.houses.kind[order[at++]!] = k;
    });
  }
  // Its people, kind by kind: the grown who work head households in turn, the rest are dealt among them by a draw.
  let head = 0;
  for (let c = 0; c < table.length; c++) {
    const row = Math.floor(c / OCCS),
      sex = Math.floor(row / BANDS),
      band = row % BANDS,
      occ = c % OCCS,
      lo = f.life.bands[band]!,
      hi = band + 1 < BANDS ? f.life.bands[band + 1]! : lo + f.life.oldest;
    for (let k = 0; k < table[c]!; k++) {
      const id = place.nextId,
        age = lo + (hi - lo) * world.rng.unit(PLACE_DRAW, key ^ id, t, P.age),
        // (Born on a day that keeps them in their band at the place's first moment and through its settling day.)
        born = Math.min(
          Math.floor(start / DAY - lo * 365),
          Math.max(Math.ceil(t / DAY - hi * 365) + 1, Math.floor(t / DAY - age * 365)),
        ),
        house =
          occ !== OCC.dependent && age >= f.life.adulthood
            ? head++ % count
            : world.rng.index(count, PLACE_DRAW, key ^ id, t, P.house);
      const i = addPerson(place, sex, occ, born, house);
      for (let q = 0; q < NEEDS; q++)
        place.people.needs[i * NEEDS + q] = Math.floor(
          world.rng.unit(PLACE_DRAW, key ^ id, t, P.need, q) * FULL * 0.6,
        );
      // (As long since their last meal as so much hunger takes to come.)
      place.people.owed[i] = Math.round((2 * place.people.needs[i * NEEDS + N.food]!) / f.hunger);
      workOf(world, place, i);
    }
  }
  linkRoster(world, place, s, f);
  pairHouses(place, f);
  // (Each one's skill, by the years they have had at their trade since they were grown, at the age they are now.)
  for (let i = 0; i < place.people.n; i++)
    place.people.skill[i] = skillAt(f, ageOf(place.people, i, t), occOf(place.people, i));
  reckonMeans(world, place);
  bringOf(world, place);
  stockOut(place, f, stockShare(world, s.cell, n));
  layLots(world, place);
  syncSites(world, place, f);
  armsCrew(world, place, f);
  // Its day under way before it is seen; then its stocks are the world's again, to the last millionth.
  while (place.t < t) tick(world, place, f);
  matchStocks(place, stockShare(world, s.cell, place.people.n), f);
  unworked(place);
  place.log.length = 0;
  place.counts.length = 0;
  return place;
}

/** The work of a day stepped only to set a place going is none of its sites': its land's month reckoned that day. */
function unworked(place: Place): void {
  for (const x of place.sites) {
    x.ticks = 0;
    x.from = place.t;
  }
}

/** A town's share of its land's stocks laid out: a month's food in each pantry while it lasts, the rest in its stores. */
function stockOut(place: Place, f: Frame, share: readonly number[]): void {
  const { bldgs, houses } = place,
    left = [...share];
  for (let h = 0; h < houses.n; h++) {
    let want = houses.members[h]! * f.daily * 30;
    for (let k = 0; k < FOODS.length && want > 0; k++) {
      // (No pantry takes more than its even share of a food: a lean town's pantries are all lean.)
      const g = FOODS[k]!,
        take = Math.floor(Math.min(want, left[g]!, share[g]! / Math.max(1, houses.n)));
      houses.pantry[h * FOODS.length + k] = take;
      left[g]! -= take;
      want -= take;
    }
  }
  const granary = buildingOf(place, FOOD_STORES),
    market = buildingOf(place, ["market"]);
  for (let g = 0; g < GOOD_COUNT; g++) {
    if (left[g]! <= 0) continue;
    if (GOODS[g]!.food) {
      bldgs.stock[granary * GOOD_COUNT + g]! += left[g]!;
      continue;
    }
    // (What a making is made of lies half where it is worked; what is made, a third where it was made.)
    let rest = left[g]!;
    const users = RECIPES.filter((r) => r.inputs.some(([x]) => x === g))
        .map((r) => buildingOf(place, MAKING_AT[r.output[0]] ?? []))
        .filter((b, k, all) => b > 0 && all.indexOf(b) === k),
      maker = buildingOf(place, MAKING_AT[g] ?? []);
    if (users.length) {
      const each = Math.floor(rest / 2 / users.length);
      for (const b of users) bldgs.stock[b * GOOD_COUNT + g]! += each;
      rest -= each * users.length;
    } else if (maker > 0) {
      const there = Math.floor(rest / 3);
      bldgs.stock[maker * GOOD_COUNT + g]! += there;
      rest -= there;
    }
    bldgs.stock[market * GOOD_COUNT + g]! += rest;
  }
  // (And the bread in the house, where its land's stores hold less: of the food its land wins most of. See matchStocks.)
  let bread = breadOf(place, f);
  for (const g of FOODS) bread -= share[g]!;
  if (bread > 0) {
    const rate = place.matched.rate ?? [];
    let k = 0;
    for (let q = 1; q < FOODS.length; q++) if ((rate[q] ?? 0) > (rate[k] ?? 0)) k = q;
    let all = 0;
    for (let h = 0; h < houses.n; h++) all += houses.members[h]!;
    for (let h = 0; h < houses.n && all > 0; h++)
      houses.pantry[h * FOODS.length + k]! += Math.floor((bread * houses.members[h]!) / all);
  }
  place.base = [...share];
  place.flow = new Array<number>(GOOD_COUNT).fill(0);
}

// —— The tick ————————————————————————————————————————————————————————————————————————————————————————————————————

/** Ticks of work in a year of one's trade, as the world's year reckons it (a third of their time). */
const SKILL_YEAR = Math.round((YEAR * WORK_SHARE) / PLACE_TICK);
/** The most ticks counted: a master's (rules/life.ts SKILL_LEVELS' last, six ticks an hour); past it there is no more to learn. */
const SKILL_MOST = SKILL_LEVELS[SKILL_LEVELS.length - 1]! * 6;
/** The level one new to a trade begins at, and a master's (rules/life.ts SKILL_LEVELS). */
const SKILL_TOP = SKILL_LEVELS.length - 1;
/** The hours one of a place's people has given to their trade, and what that makes them at it (rules/life.ts levelOf). */
export function placeSkill(
  place: Place,
  i: number,
): { hours: number; level: number; words: string } {
  const hours = Math.floor(place.people.skill[i]! / 6),
    level = levelOf(hours);
  return { hours, level, words: SKILL_WORDS[level] ?? "" };
}
/**
 * What a level of skill is worth against a master's, as the world's own rule pays it (rules/life.ts dayWage: a tenth
 * more for each level): a master's hour is worth 1.4 of one new to it. A hand turned to work not their own is new to it.
 * It is what their hour wins or makes here: a master's is what its land counts a hand of the trade to make, one new to
 * it five sevenths of that. (Not what the hour is worth to them against rest: one new to a trade works to learn it.)
 */
export const skillWorth = (level: number): number => (1 + 0.1 * level) / (1 + 0.1 * SKILL_TOP);
/**
 * How much oftener than a master one at a level is hurt at their work: the same making by a hand worth less takes so
 * many more of its motions, and a fifth of what its tools wear is worn on the hand (hazardOf).
 */
export const skillHazard = (level: number): number => 1 / skillWorth(level);
const SKILL_NEW = skillWorth(0);
/** Places read from a save kept before pairings were: their households' pairs are read when the place is next brought on. */
const UNPAIRED = new WeakSet<Place>();
/** Places read from a save kept before skill was: each one's is reckoned from their age when the place is next brought on. */
const UNSKILLED = new WeakSet<Place>();
/** The skill one of an age comes with, at a trade kept since they were grown (ticks). */
function skillAt(f: Frame, age: number, occ: number): number {
  return occ === OCC.dependent
    ? 0
    : Math.min(SKILL_MOST, Math.max(0, Math.round((age - f.life.adulthood) * SKILL_YEAR)));
}

/**
 * What one's own nature adds to or takes from their work's worth: drawn once from who they are, and kept while the place
 * is in memory (it was drawn anew for every one at every tick).
 */
const WORTH_OWN = new WeakMap<Place, { id: Uint32Array; own: Float64Array }>();
function ownWorth(world: World, place: Place, i: number): number {
  const p = place.people;
  let c = WORTH_OWN.get(place);
  if (!c || c.id.length !== p.id.length)
    WORTH_OWN.set(
      place,
      (c = { id: new Uint32Array(p.id.length), own: new Float64Array(p.id.length) }),
    );
  if (c.id[i] !== p.id[i]) {
    c.id[i] = p.id[i]!;
    c.own[i] = (world.rng.unit(PLACE_DRAW, place.key ^ p.id[i]!, 0, P.worth) - 0.5) * 0.16;
  }
  return c.own[i]!;
}

/** What the next hour's work is worth to one, 0 … 1: by what their trade earns against their land's, a little their own. */
export function workWorth(
  world: World,
  place: Place,
  i: number,
  mean = meanWage(place),
  /** What each trade earns against its land's, as tradeWorth has it: reckoned once for a tick's every one. */
  trades: readonly number[] | null = null,
): number {
  const p = place.people,
    occ = occOf(p, i);
  if (occ === OCC.dependent) return 0;
  const earns = trades ? trades[occ]! : tradeWorth(place, mean)[occ]!,
    own = ownWorth(world, place, i);
  // (And by their mood: a quarter more at its best, a quarter less at its worst. And less by the share of their handling
  // a wound bound, or an arm or a hand left stiff, takes: of any work but a leader's, which is words.)
  const hurt =
    (p.mark[i]! >> 4 === 2 || p.health[i] === 3) && occ !== OCC.leader
      ? 1 - woundTakes(world, place, i).handling
      : 1;
  return Math.max(0.05, Math.min(0.9, (0.45 + earns + own) * (1 + p.mood[i]! / 400) * hurt));
}
/** What each trade's work is worth by what it earns against the mean of its land's trades (workWorth's part of it, a trade each). */
function tradeWorth(place: Place, mean: number): number[] {
  const m = place.matched,
    out = new Array<number>(OCCS);
  for (let occ = 0; occ < OCCS; occ++) {
    const ratio =
      mean > 0 && m.wage[occ]! > 0 ? Math.min(4, Math.max(0.25, m.wage[occ]! / mean)) : 1;
    out[occ] = 0.12 * Math.log2(ratio);
  }
  return out;
}

/** What a person's ailing is of. */
export const CAUSE = {
  none: 0,
  accident: 1,
  want: 2,
  fire: 3,
  quake: 4,
  meteor: 5,
  raid: 6,
  battle: 7,
  sickness: 16,
} as const;
/** A strike's or a battle's hurt and dead, said: "in the fire". */
export const CAUSE_WORDS: readonly string[] = [
  "",
  "at their work",
  "of want",
  "in the fire",
  "when the ground shook",
  "when fire fell from the sky",
  "in the strike from the air",
  "in battle",
];
/** What moves a mood (bits). */
export const MOOD = {
  want: 1,
  ailing: 2,
  bereaved: 4,
  pantry: 8,
  friend: 16,
  home: 32,
  ordered: 64,
  homeless: 128,
} as const;
export const MOOD_WORDS: readonly (readonly [number, string])[] = [
  [MOOD.want, "days gone hungry, cold or without rest"],
  [MOOD.ailing, "hurt or sick"],
  [MOOD.bereaved, "a death in the household this month"],
  [MOOD.pantry, "a pantry with a week's food in it"],
  [MOOD.friend, "a friend made in company"],
  [MOOD.home, "a new home this month"],
  [MOOD.ordered, "held to a trade by an order, not their own choosing"],
  [MOOD.homeless, "their home lost these two months"],
];
/**
 * One's own temper, as far as it bears on their mood: each leaning half their land's way and half their own nature, drawn
 * once from who they are (rules/temper.ts, as a ruler's is). How close they hold their kin (a death at home), how they
 * take being bidden (an order), how they lean on company (a friend), how they set store by plenty (a full pantry), how
 * boldly they bear hardship (want, a home lost). Each 0 … 1; the middle is as most are.
 */
export type PlaceTemper = {
  readonly kin: number;
  readonly bidden: number;
  readonly sociable: number;
  readonly thrifty: number;
  readonly bold: number;
};
export function placeTemper(place: Place, i: number): PlaceTemper {
  const w = place.matched.ways,
    way = (k: number) => w?.[k] ?? 0.5,
    who = place.key ^ place.people.id[i]!,
    born = place.people.born[i]!;
  return {
    kin: ownLeaning(who, born, way(WAY.kinship), 11),
    bidden: ownLeaning(who, born, way(WAY.hierarchy), 12),
    sociable: ownLeaning(who, born, way(WAY.openness), 13),
    thrifty: ownLeaning(who, born, way(WAY.thrift), 14),
    bold: ownLeaning(who, born, way(WAY.valour), 15),
  };
}
/** How much a thing weighs with one of a leaning, against most (1): half as much at the least, half as much again at the most. */
export const leans = (x: number): number => 0.5 + x;

/** Below this a mood heeds no order to change its work. */
export const MOOD_UNHEEDING = -50;
/**
 * The chance a year that work harms the one at it: of the tools and machines their trade wears out in a year (rules/goods.ts
 * WANTS), a fifth are worn on the hand that held them. Nothing for one who uses none.
 */
export function hazardOf(place: Place, occ: number, craft: number): number {
  if (occ !== OCC.farmer && occ !== OCC.herder && occ !== OCC.crafter) return 0;
  const machines =
    occ === OCC.crafter && craft > 0 && RECIPES[craft - 1]!.output[0] === G.machines
      ? 1
      : place.matched.made[G.machines]! > 0
        ? 0.5
        : 0;
  return 0.2 * (WANTS.toolsPerWorker + 4 * machines * WANTS.machinesPerWorker);
}
/** What a year's work is worth in a place's land, the mean of its trades that earn. */
function meanWage(place: Place): number {
  let sum = 0,
    n = 0;
  for (let o = 1; o < OCCS; o++)
    if (place.matched.wage[o]! > 0) {
      sum += place.matched.wage[o]!;
      n++;
    }
  return n ? sum / n : 0;
}
/** How hard a need presses, 0 … 1: little while it is slight, all at once near its full. */
export const pressOf = (level: number): number => level * level * level;
/** What lying idle is worth: no work worth less than this is gone to, no need pressing less is served. */
export const IDLE_WORTH = 0.2;

function go(place: Place, i: number, to: number, world: World | null = null): void {
  const p = place.people;
  p.to[i] = to;
  let ticks = ticksBetween(place, p.at[i]!, to, i);
  // (A leg left lame, or bound while it mends, goes at a limp: by the legs they have left to go on.)
  if (ticks && world && (p.mark[i]! >> 4 === 2 || p.health[i] === 3)) {
    const going = woundTakes(world, place, i).going;
    if (going > 0) ticks = Math.min(65535, Math.round(ticks * gaitOf(going)));
  }
  p.eta[i] = p.trip[i] = ticks;
  if (!p.eta[i]) p.at[i] = to;
}

/** Food taken from a pantry to a hunger (millionths wanted): the foods in turn. What was eaten. */
function eatFrom(place: Place, h: number, want: number): number {
  let eaten = 0;
  for (let k = 0; k < FOODS.length && want > 0; k++) {
    const at = h * FOODS.length + k,
      take = Math.min(place.houses.pantry[at]!, Math.ceil(want));
    place.houses.pantry[at]! -= take;
    place.flow[FOODS[k]!]! -= take;
    place.usedDay[FOODS[k]!]! += take;
    want -= take;
    eaten += take;
  }
  return eaten;
}

/** One tick of a place: every one's needs move, and each does what presses most. */
function tick(world: World, place: Place, f: Frame): void {
  const p = place.people,
    { houses, bldgs, matched } = place,
    t = place.t,
    air = airOf(f, t),
    cold = coldOf(f, air.warmth),
    // (Out of doors one grows as cold as the air is, in a couple of hours, and no colder: mild air chills a little and
    // stops there. It ran on to the full in any chill at all, and those left without a roof in mild weather died of it.)
    coldTo0 = Math.round(cold * FULL),
    chill = Math.round((FULL * PLACE_TICK) / (2 * HOUR)),
    warmUp = Math.round((FULL * PLACE_TICK) / HOUR),
    // (Work by a body that sees by light is worth less in the dark.)
    dark0 = air.lit ? 1 : 1 - 0.7 * f.sight,
    perTick = (PLACE_TICK * MICRO) / (YEAR * WORK_SHARE),
    // (What a tick ripens for one of its hands at its fields, and at its flocks.)
    win = matched.win ?? [matched.made[G.grain]!, matched.made[G.meat]!],
    ripens = [
      Math.round((win[0]! * PLACE_TICK * MICRO) / YEAR),
      Math.round((win[1]! * PLACE_TICK * MICRO) / YEAR),
    ],
    foodStore = buildingOf(place, FOOD_STORES),
    market = buildingOf(place, ["market"]),
    mean = meanWage(place),
    trades = tradeWorth(place, mean),
    // Its orders, where it is managed (sim/town/managed.ts): what its granary holds back, what its market will not let go.
    orders = managedOf(world)?.get(place.town),
    reserve = orders ? orders.hold * p.n * f.daily * 30 : 0,
    barred = (b: number, g: number) => b === market && !!orders && orders.forbidden.includes(g),
    // (The food a store will let a household have: all of it, less what the granary is told to hold back.)
    free = (b: number, g: number): number => {
      if (barred(b, g)) return 0;
      const has = bldgs.stock[b * GOOD_COUNT + g]!;
      if (b !== foodStore || reserve <= 0) return has;
      let all = 0;
      for (const x of FOODS) all += bldgs.stock[b * GOOD_COUNT + x]!;
      return Math.max(0, Math.min(has, all - reserve));
    },
    madeOf = (g: number, n: number) => {
      place.flow[g]! += n;
      place.madeDay[g]! += n;
    },
    usedOf = (g: number, n: number) => {
      place.flow[g]! -= n;
      place.usedDay[g]! += n;
    },
    tickNo = Math.floor(t / PLACE_TICK),
    today = Math.floor(t / DAY),
    dying: number[] = [],
    // (Buildings whose work is stopped by order.)
    shut = orders?.shut.length ? new Set(orders.shut) : null,
    // A fire being fought, where: by the grown who live near it, or by all of them where a watch is kept by order.
    fireLot = place.fire.length && t < place.fire[1]! ? place.fire[0]! : null,
    // A burial being held: where, and whose household stands by.
    riteLot = place.rite.length && t < place.rite[1]! ? place.rite[0]! : null,
    riteHouse = riteLot === null ? -1 : place.rite[2]!,
    fireOut =
      fireLot === null
        ? null
        : fireCrew(world, place, f, fireLot, !!orders?.held.includes("firebreaks")),
    // The sick kept apart by order: fewer take a sickness (the world's own measure of it, rules/lessons.ts), and their
    // households keep from the square.
    apart = !!orders?.held.includes("quarantine"),
    apartLeft = apart ? 1 - (LESSON_RESPONSE.get("quarantine")?.most ?? 0) : 1;
  // A dearth: its stores hold less than its households would fetch at once. Then a home keeps, and fetches, a day's food
  // and no more, so that what there is goes round.
  // What its land brings in to its store this tick: nothing while a siege lies about it.
  if (matched.bring && !matched.sieged)
    for (let k = 0; k < FOODS.length; k++) {
      const n = matched.bring[k]!;
      if (n <= 0) continue;
      bldgs.stock[foodStore * GOOD_COUNT + FOODS[k]!]! += n;
      place.flow[FOODS[k]!]! += n;
      place.cameDay[FOODS[k]!]! += n;
    }
  let stored = 0;
  for (const b of foodStore === market ? [foodStore, 0] : [foodStore, market, 0])
    for (const g of FOODS) stored += bldgs.stock[b * GOOD_COUNT + g]!;
  for (let k = 0; k < houses.n * FOODS.length; k++) stored += houses.pantry[k]!;
  const keepDays = stored < p.n * f.daily * FETCH_DAYS ? 1 : FETCH_DAYS;
  let sickHouses: Set<number> | null = null;
  if (apart && place.ills.length) {
    sickHouses = new Set();
    for (let i = 0; i < p.n; i++) if (p.health[i] === 2) sickHouses.add(p.house[i]!);
  }
  // Its sites in hand, by their lot: what each has yet to be worked (thousandths of a tick), and whether it is stopped.
  let sitesNow: Map<number, { site: PlaceSite; b: number; left: number; stopped: boolean }> | null =
    null;
  if (place.sites.length) {
    const asks = asksIn(world, place.town);
    sitesNow = new Map();
    for (const site of place.sites) {
      const w = asks[site.n]?.work;
      if (!w || w.done !== null || w.left) continue;
      const left =
        (w.effort + siteOwed(world, asks[site.n]!) - w.worked) * TICKS_PM * 1000 - site.ticks;
      // (Its walls go up a length at a time about their ring: the one the work has come to.)
      if (site.lot === AT.walls) {
        const n = LAID.get(place)?.streets?.wallAt.length ?? 0,
          share = Math.max(0, Math.min(0.999, 1 - left / (w.effort * TICKS_PM * 1000)));
        site.k = n > 0 ? Math.floor(share * n) : 0;
      }
      sitesNow.set(site.lot, {
        site,
        b: bldgAt(place, site.lot),
        left,
        stopped: w.stops.at(-1)?.to === null,
      });
    }
  }
  // The sickness about in its land now, if its land's own reckoning has one come this year or last (sim/health): who
  // of the place takes it is drawn here, a day at a time, so that as many take it in a year as it reaches of those not
  // spared it. Who dies of it is the world's to say: at the month's matching the sick are the first to go.
  let ail: { at: number; chance: number } | null | undefined;
  const ailing = (): { at: number; chance: number } | null => {
    if (ail !== undefined) return ail;
    ail = null;
    const health = healthOf(world),
      last = health?.land(place.cell)?.last,
      sickness = last ? health!.get(last.sickness) : undefined;
    if (!last || !sickness || Math.floor(t / YEAR) - last.year > 1) return ail;
    const name = `${sickness.name}|${sickness.ref}`;
    let at = place.ills.indexOf(name);
    if (at < 0) at = place.ills.push(name) - 1;
    if (place.ills.length > 200) return ail;
    ail = {
      at,
      chance: (sickness.reach * (1 - health!.immune(place.cell, sickness.ref))) / 365,
    };
    return ail;
  };
  let visitor = -1,
    hasGrown: Uint8Array | null = null;
  if (Math.floor(t / DAY) !== place.day) {
    place.day = Math.floor(t / DAY);
    place.madeDay.fill(0);
    place.usedDay.fill(0);
    place.cameDay.fill(0);
  }
  let wants: [number, number][] | null = null,
    hauls: [number, number][] | null = null;
  // (Before another load is taken up, what is in hand is set down where they stand: one put from the fields to hauling
  // by an order still held part of a load of grain, and it was lost when they took up another.)
  const setDown = (i: number): void => {
    if (p.carry[i]! <= 0) return;
    const b = bldgAt(place, p.at[i]!);
    bldgs.stock[(b < 0 ? 0 : b) * GOOD_COUNT + p.carryGood[i]!]! += p.carry[i]!;
    p.carry[i] = 0;
  };
  // What its working buildings lack of what its land's makings are made of (one load to each), and what they have made, a
  // load of it lying there: reckoned once a tick, when first asked.
  const wantsNow = (): [number, number][] => {
      if (wants) return wants;
      wants = [];
      // (A site in hand wants tools while it has less than a day's wear for its crew.)
      if (sitesNow)
        for (const sn of sitesNow.values())
          if (
            sn.b > 0 &&
            !sn.stopped &&
            sn.left > 0 &&
            bldgs.stock[sn.b * GOOD_COUNT + G.tools]! < SITE_WEAR * 144
          )
            wants.push([sn.b, G.tools]);
      for (let b = 1; b < bldgs.lot.length; b++) {
        if (b === market || bldgs.site[b]) continue;
        const made = MAKING_GOODS.get(bldgs.kind[b]!);
        if (!made) continue;
        RECIPES.forEach((r, k) => {
          if (!((matched.kinds >>> k) & 1) || !made.includes(r.output[0])) return;
          for (const [x] of r.inputs)
            if (
              bldgs.stock[b * GOOD_COUNT + x]! < LOAD * MICRO &&
              !wants!.some((w) => w[0] === b && w[1] === x)
            )
              wants!.push([b, x]);
        });
      }
      return wants;
    },
    haulsNow = (): [number, number][] => {
      if (hauls) return hauls;
      hauls = [];
      for (let b = 1; b < bldgs.lot.length; b++) {
        if (b === market || bldgs.site[b]) continue;
        for (const g of MAKING_GOODS.get(bldgs.kind[b]!) ?? [])
          if (bldgs.stock[b * GOOD_COUNT + g]! >= LOAD * MICRO) hauls.push([b, g]);
      }
      return hauls;
    };
  // Priorities set for its people by name (place.prio): when one's own trade has nothing for them, the trade set next
  // highest that has: grain or beasts standing unwon, a making whose stuff is to hand, a load waiting to be carried. Done
  // as one new to it; what it wins or makes is the place's, as any hand's is.
  const prios = prioMap(orders),
    tickWin = [Math.round(win[0]! * perTick), Math.round(win[1]! * perTick)],
    turnPlace = (i: number, to: number): number =>
      to === OCC.farmer || to === OCC.herder
        ? AT.fields
        : to === OCC.trader
          ? bldgs.lot[market]!
          : makingLot(place, i),
    hasWork = (i: number, to: number): boolean => {
      if (to === OCC.farmer) return tickWin[0]! > 0 && place.ripe[G.grain]! >= tickWin[0]!;
      if (to === OCC.herder) return tickWin[1]! > 0 && place.ripe[G.meat]! >= tickWin[1]!;
      if (to === OCC.trader)
        return (
          haulsNow().length > 0 ||
          wantsNow().some(
            ([, x]) => !barred(market, x) && bldgs.stock[market * GOOD_COUNT + x]! > 0,
          )
        );
      if (!p.craft[i]) p.craft[i] = craftFor(world, place, i);
      if (!p.craft[i]) return false;
      const r = RECIPES[p.craft[i]! - 1]!,
        lot = makingLot(place, i);
      if (lot === AT.fields || shut?.has(lot)) return false;
      const at = bldgAt(place, lot),
        b = at < 0 ? market : at;
      return (
        matched.made[r.output[0]]! > 0 &&
        r.inputs.every(([x]) => !barred(b, x) && bldgs.stock[b * GOOD_COUNT + x]! > 0)
      );
    },
    /** One whose work has nothing for them turns to the next their priorities name that has (true: they have). */
    turns = (i: number, own: number): boolean => {
      if (p.turn[i]) {
        // (What they had turned to has run out too: back to their own.)
        p.turn[i] = 0;
        return false;
      }
      const packed = prios?.get(p.id[i]!);
      if (packed === undefined) return false;
      let to = 0,
        most = 0;
      MANAGED_TRADES.forEach((occ, k) => {
        const x = (packed >> (2 * k)) & 3;
        if (occ !== own && x > most && hasWork(i, occ)) {
          most = x;
          to = occ;
        }
      });
      if (!to) return false;
      p.turn[i] = to;
      p.act[i] = ACT.work;
      p.why[i] = WHY.turned;
      go(place, i, turnPlace(i, to), world);
      return true;
    };
  // A meal: what its land's reckoning counts a mouth to eat in the time since their last (the young, their share of it),
  // as far as the pantry has it; their hunger and what they have yet to eat fall by as much of it as they got. A body
  // asleep hungers a quarter as fast, so it wakes hungry less often through a long dark season, and eats as much.
  const eat = (i: number, h: number, fk: Frame): [number, number] => {
    const want = p.owed[i]! * fk.half * (bandOf(ageOf(p, i, t), f.life) === 0 ? f.life.young : 1);
    if (want <= 0) return [0, 0];
    const eaten = eatFrom(place, h, want);
    if (eaten > 0) {
      const left = 1 - Math.min(1, eaten / want);
      p.needs[i * NEEDS + N.food] = Math.round(p.needs[i * NEEDS + N.food]! * left);
      p.owed[i] = Math.round(p.owed[i]! * left);
    }
    return [eaten, want];
  };
  // Its land's peoples, where it is of more than one: each of its people by their own people's body.
  const fs =
      matched.mix && matched.mix.length > 1
        ? matched.mix.map((_, k) => frameOf(world, place.cell, k))
        : null,
    coldTos = fs ? fs.map((x) => Math.round(coldOf(x, air.warmth) * FULL)) : null,
    darks = fs ? fs.map((x) => (air.lit ? 1 : 1 - 0.7 * x.sight)) : null;
  for (let i = 0; i < p.n; i++) {
    const kind = fs ? (houses.kind[p.house[i]!] ?? 0) : 0,
      fk = fs ? (fs[kind] ?? f) : f,
      coldTo = coldTos ? (coldTos[kind] ?? coldTo0) : coldTo0,
      dark = darks ? (darks[kind] ?? dark0) : dark0;
    const at0 = i * NEEDS,
      asleep = p.act[i] === ACT.sleep,
      h = p.house[i]!,
      home = houses.home[h]!,
      moving = p.eta[i]! > 0,
      inside = !moving && p.at[i]! !== AT.fields && p.at[i]! !== AT.square && p.at[i]! !== AT.walls;
    // (What the fields and the flocks give comes by the calendar, to each hand its land counts at them.)
    // (Not to one put to a site or standing to arms: what those do not bring in, its land's harvest already bears.)
    const trade = p.sexOcc[i]! & 15;
    if (p.bound[i]! >= BOUND_ARMS && p.bound[i] !== 255) {
      // (nothing)
    } else if (trade === OCC.farmer) place.ripe[G.grain]! += ripens[0]!;
    else if (trade === OCC.herder) place.ripe[G.meat]! += ripens[1]!;
    // Needs. (One raising a building, or carrying to it, is hungry half again as fast: sim/town/asks.ts feed.)
    p.needs[at0 + N.food] = Math.min(
      FULL,
      p.needs[at0 + N.food]! +
        (asleep
          ? fk.hunger >> 2
          : p.act[i] === ACT.build || p.act[i] === ACT.stuff
            ? fk.hunger + (fk.hunger >> 1)
            : fk.hunger),
    );
    // (What they have yet to eat grows by the clock, asleep or awake: its land's reckoning counts a mouth by the month.)
    p.owed[i] = Math.min(
      65535,
      p.owed[i]! + (p.act[i] === ACT.build || p.act[i] === ACT.stuff ? 3 : 2),
    );
    p.needs[at0 + N.rest] = asleep
      ? Math.max(0, p.needs[at0 + N.rest]! - fk.rest)
      : Math.min(FULL, p.needs[at0 + N.rest]! + fk.tire);
    const chilled0 = p.needs[at0 + N.cold]!;
    p.needs[at0 + N.cold] =
      inside || chilled0 > coldTo
        ? Math.max(inside ? 0 : coldTo, chilled0 - warmUp)
        : Math.min(coldTo, chilled0 + chill);
    // (Company is had among others in the square; work neither gives it nor takes it, nor does sleep.)
    if (!moving && p.act[i] === ACT.visit)
      p.needs[at0 + N.lone] = Math.max(0, p.needs[at0 + N.lone]! - 12 * fk.lone);
    else if (!asleep && (moving || p.act[i] !== ACT.work))
      p.needs[at0 + N.lone] = Math.min(FULL, p.needs[at0 + N.lone]! + fk.lone);
    // Want: a need of the body's standing full. How long it has, less how long it has not since.
    const inWant =
      p.needs[at0 + N.food]! >= 0.95 * FULL ||
      p.needs[at0 + N.rest]! >= 0.95 * FULL ||
      p.needs[at0 + N.cold]! >= 0.95 * FULL;
    p.lack[i] = inWant ? Math.min(65535, p.lack[i]! + 1) : Math.max(0, p.lack[i]! - 1);
    const lackDays = p.lack[i]! / 144;
    // Days in want bring sickness and death, by their people's own table of dying, the more the longer: asked of each
    // once a day. Only in a town managed: there its dead are told to its land (place.settle), elsewhere its land's own
    // reckoning says who dies.
    if (orders && lackDays >= 1 && (tickNo + p.id[i]!) % 144 === 0) {
      const base = (f.life.mortality[bandOf(ageOf(p, i, t), f.life)] ?? 0.02) / 365,
        chance = Math.min(0.5, base * (1 + lackDays) ** 3);
      if (world.rng.chance(chance, PLACE_DRAW, place.key ^ p.id[i]!, tickNo, P.sick)) {
        dying.push(i);
        continue;
      }
    }
    // Once a day, each in turn: their mood, and what may befall them.
    if ((tickNo + p.id[i]!) % 144 === 0) {
      // Two friends, both grown and neither paired, of two households and of one people: promised, and paired on a day
      // of the weeks to come (asked of the one numbered lower).
      if (p.friend[i]! > p.id[i]! && !p.mate[i] && ageOf(p, i, t) >= f.life.adulthood) {
        const j = placeIndexOf(place, p.friend[i]!);
        if (
          j >= 0 &&
          !p.mate[j] &&
          p.house[j] !== h &&
          sexOf(p, j) !== sexOf(p, i) &&
          ageOf(p, j, t) >= f.life.adulthood &&
          (houses.kind[p.house[j]!] ?? 0) === (houses.kind[h] ?? 0)
        ) {
          p.mate[i] = p.mate[j] = PROMISED;
          dueAt(
            place,
            t +
              (1 + Math.floor(world.rng.unit(PLACE_DRAW, place.key ^ p.id[i]!, t, P.due) * 27)) *
                DAY,
            DUE.pair,
            p.id[i]!,
            p.id[j]!,
          );
        }
      }
      // (Each day their own work is looked to again: back to it once it has something for them.)
      if (p.turn[i] && hasWork(i, p.sexOcc[i]! & 15)) p.turn[i] = 0;
      // Mood, from needs met over the days gone and what befell their household: a quarter of the way to where those
      // put it, each day. A body that lives closer together leans more on its friends.
      // (And by their own temper: what each of these weighs with them, against most. rules/temper.ts.)
      const temper = placeTemper(place, i);
      let why = 0,
        to = 15;
      if (lackDays >= 0.25) {
        why |= MOOD.want;
        to -= Math.min(70, 25 * lackDays + 15) * leans(1 - temper.bold);
      }
      if (p.health[i]) {
        why |= MOOD.ailing;
        to -= 25;
      }
      if (houses.grief[h]! >= 0 && today - houses.grief[h]! <= 30) {
        why |= MOOD.bereaved;
        to -= 35 * leans(temper.kin);
      }
      let pantry = 0;
      for (let k = 0; k < FOODS.length; k++) pantry += houses.pantry[h * FOODS.length + k]!;
      if (pantry >= houses.members[h]! * fk.daily * FETCH_DAYS) {
        why |= MOOD.pantry;
        to += 15 * leans(temper.thrifty);
      }
      if (p.friend[i]) {
        why |= MOOD.friend;
        to += (10 + 15 * fk.social) * leans(temper.sociable);
      }
      if (houses.fresh[h]! >= 0 && today - houses.fresh[h]! <= 30) {
        why |= MOOD.home;
        to += 20;
      }
      if (houses.lost[h]! >= 0 && today - houses.lost[h]! <= 60) {
        why |= MOOD.homeless;
        to -= 30 * leans(1 - temper.bold);
      }
      if (p.bound[i] && p.bound[i]! < BOUND_ARMS) {
        why |= MOOD.ordered;
        to -= 10 * leans(1 - temper.bidden);
      }
      p.moodWhy[i] = why;
      p.mood[i] = Math.max(-100, Math.min(100, Math.round(p.mood[i]! + (to - p.mood[i]!) / 4)));
      if (!p.health[i]) {
        const sick = ailing(),
          // (One in want takes a sickness the sooner.)
          takes = sick ? sick.chance * (1 + lackDays) * apartLeft : 0;
        if (takes > 0 && world.rng.chance(takes, PLACE_DRAW, place.key ^ p.id[i]!, tickNo, P.ail)) {
          // (Abed for the days a sickness takes, the fewer the more its land knows of care and the better it is tended.)
          p.health[i] = 2;
          p.cause[i] = CAUSE.sickness + sick!.at;
          p.ill[i] = Math.max(
            1,
            Math.round(
              HEAL_DAYS.scarred[0] *
                HEAL_TENDED[tendedOf(place, i)] *
                (1 - HEAL_CARE * (matched.care ?? 0)) *
                144,
            ),
          );
          note(place, HAP.sick, p.id[i]!, sick!.at);
        } else if (
          p.act[i] === ACT.work &&
          world.rng.chance(
            (hazardOf(place, occOf(p, i), p.craft[i]!) / 365) *
              skillHazard(levelOf(Math.floor(p.skill[i]! / 6))),
            PLACE_DRAW,
            place.key ^ p.id[i]!,
            tickNo,
            P.hurt,
          )
        ) {
          // (A hurt at work: where, and what comes of it, by the blow it was; abed as such a wound is. rules/healing.ts.)
          wound(world, place, i, CAUSE.accident);
          note(place, HAP.hurt, p.id[i]!, occOf(p, i));
        }
      }
    }
    if (moving) {
      if (--p.eta[i]! === 0) {
        p.at[i] = p.to[i]!;
        p.trip[i] = 0;
      }
      continue;
    }
    // Up again with a wound still bound: well when its days of mending are done.
    if (p.health[i] === 3) {
      if (p.ill[i]! <= 1) {
        p.ill[i] = 0;
        p.health[i] = 0;
        note(place, HAP.well, p.id[i]!);
      } else p.ill[i]!--;
    }
    // Hurt or sick: home, and abed there until it is over, fed from the pantry by their household.
    else if (p.ill[i]! > 0) {
      p.why[i] = WHY.abed;
      p.act[i] = ACT.abed;
      if (p.at[i] !== home) {
        go(place, i, home, world);
        continue;
      }
      if (p.needs[at0 + N.food]! > 0.5 * FULL) eat(i, h, fk);
      p.needs[at0 + N.rest] = Math.max(0, p.needs[at0 + N.rest]! - fk.rest);
      if (--p.ill[i]! === 0) {
        p.act[i] = ACT.idle;
        // (A wound's days abed done: up and about with it bound for its days of mending. rules/healing.ts.)
        const mark = p.mark[i]!,
          member = MEMBERS[(mark & 15) - 1],
          cause = p.health[i] === 1 ? p.cause[i]! & 7 : p.cause[i]!,
          mending =
            p.health[i] === 1
              ? healDays(
                  mark && member ? (mark >> 4 === 2 ? "lame" : "scarred") : "healed",
                  member ?? "trunk",
                  blowOf(place, i, cause),
                  matched.care ?? 0,
                  tendedOf(place, i),
                ).mending
              : 0;
        if (mending > 0) {
          p.health[i] = 3;
          p.ill[i] = Math.min(65535, mending * 144);
          note(place, HAP.mending, p.id[i]!, cause);
        } else {
          p.health[i] = 0;
          note(place, HAP.well, p.id[i]!);
        }
      }
      continue;
    }
    // (Asleep, with neither hunger nor cold pressing past what rest is worth, and nothing in hand and no fire to turn out
    // to: asleep still, whatever their work is worth to them. Half a town's hours are such, and none of them asks it.)
    if (
      asleep &&
      fireLot === null &&
      h !== riteHouse &&
      p.carry[i] === 0 &&
      p.needs[at0 + N.rest]! > 0.04 * FULL
    ) {
      const hf = p.needs[at0 + N.food]! / FULL,
        cf = p.needs[at0 + N.cold]! / FULL;
      if (hf * hf * hf < IDLE_WORTH && cf * cf * cf < IDLE_WORTH) {
        p.why[i] = WHY.asleep;
        continue;
      }
    }
    const hunger = pressOf(p.needs[at0 + N.food]! / FULL),
      tired = pressOf(p.needs[at0 + N.rest]! / FULL),
      chilled = pressOf(p.needs[at0 + N.cold]! / FULL),
      lone = pressOf(p.needs[at0 + N.lone]! / FULL),
      occ = occOf(p, i),
      // (One long in want is worth less at their work: sick with it.)
      worth =
        occ === OCC.dependent
          ? 0
          : workWorth(world, place, i, mean, trades) * dark * (1 - Math.min(0.6, 0.15 * lackDays)),
      bar = Math.max(worth, IDLE_WORTH);
    // What is carried is set down where it was bound.
    if (p.carry[i]! > 0 && p.act[i] === ACT.carry) {
      const b = bldgAt(place, p.at[i]!);
      if (p.at[i] === home && GOODS[p.carryGood[i]!]!.food)
        houses.pantry[h * FOODS.length + FOODS.indexOf(p.carryGood[i]!)]! += p.carry[i]!;
      else bldgs.stock[(b < 0 ? 0 : b) * GOOD_COUNT + p.carryGood[i]!]! += p.carry[i]!;
      p.carry[i] = 0;
      p.act[i] = ACT.idle;
    } else if (p.carry[i]! > 0 && p.at[i] === home && GOODS[p.carryGood[i]!]!.food) {
      // (And what the day's work in the fields gave comes home with whoever won it, whatever brought them home: it waited
      // in hand for a full load, a month's food and three weeks' reaping, and a land that eats what it reaps went hungry
      // beside it.)
      houses.pantry[h * FOODS.length + FOODS.indexOf(p.carryGood[i]!)]! += p.carry[i]!;
      p.carry[i] = 0;
    }
    // A fire in the town: the grown who live within a cry of it turn out to fight it, asleep or not, until it is out or
    // hunger takes them off; and its watch, where one is kept (fireCrew).
    if (fireLot !== null && hunger < 0.6 && fireOut!.has(p.id[i]!)) {
      p.act[i] = ACT.brigade;
      p.why[i] = WHY.fire;
      if (p.at[i] !== fireLot) go(place, i, fireLot, world);
      continue;
    }
    // A burial of one of their household: they stand by it, while neither hunger nor cold presses past their work.
    if (h === riteHouse && hunger < bar && chilled < bar) {
      p.act[i] = ACT.mourn;
      p.why[i] = WHY.burial;
      if (p.at[i] !== riteLot) go(place, i, riteLot!, world);
      continue;
    }
    // Asleep: until rested, or hunger or cold wakes them.
    if (asleep && p.needs[at0 + N.rest]! > 0.04 * FULL && hunger < bar && chilled < bar) {
      p.why[i] = WHY.asleep;
      continue;
    }
    // Come for what a building has made: a load of it taken up, for the market.
    if (p.act[i] === ACT.haul) {
      const b = Math.max(0, bldgAt(place, p.at[i]!)),
        g = p.carryGood[i]!,
        take = Math.floor(Math.min(bldgs.stock[b * GOOD_COUNT + g]!, LOAD * MICRO));
      if (take > 0 && b !== market) {
        setDown(i);
        bldgs.stock[b * GOOD_COUNT + g]! -= take;
        p.carry[i] = take;
        p.act[i] = ACT.carry;
        p.why[i] = WHY.load;
        go(place, i, bldgs.lot[market]!, world);
      } else p.act[i] = ACT.idle;
      continue;
    }
    // Fetching: at the store, take what the household eats in some days; then home.
    if (p.act[i] === ACT.fetch) {
      const b = Math.max(0, bldgAt(place, p.at[i]!));
      // (One food to a load: the one the store has most of. It took the first it found, and where that was a few crumbs
      // of meat beside a full bin of grain a household's fetcher came home with the crumbs.)
      const want = houses.members[h]! * fk.daily * keepDays;
      let best = -1,
        most = 0;
      for (const g of FOODS) {
        const has = free(b, g);
        if (has > most) {
          most = has;
          best = g;
        }
      }
      const take = best < 0 ? 0 : Math.floor(Math.min(want, most, 2147483647));
      if (take > 0) {
        setDown(i);
        bldgs.stock[b * GOOD_COUNT + best]! -= take;
        p.carryGood[i] = best;
        p.carry[i] = take;
      }
      p.act[i] = p.carry[i]! > 0 ? ACT.carry : ACT.idle;
      p.why[i] = p.carry[i]! > 0 ? WHY.pantry : WHY.noFood;
      go(place, i, home, world);
      continue;
    }
    // Gone for a load of what a site is built of: taken up outside the town, and set down at the site.
    if (p.act[i] === ACT.stuff) {
      const sn = p.bound[i] === BOUND_SITE ? sitesNow?.get(p.work[i]!) : undefined;
      if (sn && p.at[i] === AT.fields) {
        p.why[i] = WHY.stuff;
        go(place, i, sn.site.lot, world);
        continue;
      }
      if (sn && p.at[i] === sn.site.lot) {
        sn.site.stuff += fk.load;
        sn.site.brought += fk.load;
      }
      p.act[i] = ACT.idle;
    }
    const press = Math.max(hunger, tired, chilled, lone);
    if (press > bar) {
      if (hunger === press) {
        // Hunger: eat at home; a pantry bare, one who is grown fetches from the town's stores.
        if (p.at[i] !== home) {
          // (Bound home to eat: told as eating from the moment they turn for it.)
          p.act[i] = ACT.eat;
          p.why[i] = WHY.hunger;
          go(place, i, home, world);
          continue;
        }
        const [eaten, want] = eat(i, h, fk);
        if (eaten > 0) {
          p.act[i] = ACT.eat;
          p.why[i] = WHY.hunger;
          // (Fed, and the pantry holds a day's food for the household yet: no more to do. Fed on its last crumbs, one
          // who is grown goes for more before the rest go hungry: a herder's children went a day in want beside a full
          // store, their one grown eating what little came home and never finding the pantry quite bare.)
          let pantry = 0;
          for (let k = 0; k < FOODS.length; k++) pantry += houses.pantry[h * FOODS.length + k]!;
          if (eaten >= want * 0.5 && pantry >= houses.members[h]! * fk.daily) continue;
        }
        // (Where no one grown lives, whoever is hungry goes: a household of children alone went hungry beside a full store.)
        if (!hasGrown) {
          hasGrown = new Uint8Array(houses.n);
          for (let q = 0; q < p.n; q++)
            if ((!p.ill[q] || p.health[q] === 3) && ageOf(p, q, t) >= f.life.adulthood)
              hasGrown[p.house[q]!] = 1;
        }
        const grown = ageOf(p, i, t) >= f.life.adulthood || !hasGrown[h];
        // (From its granary; that bare, or held back, from its market; that bare, from its square.)
        let from = -1;
        for (const b of foodStore === market ? [foodStore, 0] : [foodStore, market, 0])
          if (from < 0 && FOODS.some((g) => free(b, g) > 0)) from = b;
        if (grown && from >= 0) {
          p.act[i] = ACT.fetch;
          p.why[i] = WHY.pantry;
          go(place, i, bldgs.lot[from]!, world);
          continue;
        }
        if (eaten > 0) continue;
        // (Nothing to eat: whatever presses next.)
        p.why[i] = WHY.noFood;
        if (tired > bar && tired >= chilled && p.at[i] === home) {
          p.act[i] = ACT.sleep;
          continue;
        }
      } else if (tired === press) {
        if (p.at[i] !== home) {
          p.act[i] = ACT.idle;
          p.why[i] = WHY.tired;
          go(place, i, home, world);
        } else {
          p.act[i] = ACT.sleep;
          p.why[i] = WHY.tired;
        }
        continue;
      } else if (chilled === press) {
        p.act[i] = ACT.warm;
        p.why[i] = WHY.cold;
        if (p.at[i] !== home) go(place, i, home, world);
        continue;
      } else if (sickHouses?.has(h)) {
        // (One of a household with sickness in it, kept apart by order: at home, wanting company.)
        p.act[i] = ACT.idle;
        p.why[i] = WHY.apart;
        if (p.at[i] !== home) go(place, i, home, world);
        continue;
      } else {
        p.act[i] = ACT.visit;
        p.why[i] = WHY.lone;
        if (p.at[i] !== AT.square) go(place, i, AT.square, world);
        else {
          // (Two in the square for company at once, neither with a friend yet: each the other's.)
          if (visitor >= 0 && !p.friend[i] && !p.friend[visitor] && p.house[visitor] !== h) {
            p.friend[i] = p.id[visitor]!;
            p.friend[visitor] = p.id[i]!;
          }
          visitor = i;
        }
        continue;
      }
    }
    if (worth < IDLE_WORTH) {
      // Nothing presses and no work is worth going to: at home, abed while it is dark.
      if (p.at[i] !== home) {
        p.act[i] = ACT.idle;
        go(place, i, home, world);
      } else p.act[i] = air.lit ? ACT.idle : ACT.sleep;
      p.why[i] = occ === OCC.dependent ? WHY.young : WHY.dark;
      continue;
    }
    // Work: what the next hour of it is worth passes every need. (Their own, or what they have turned to for now.)
    const turned = p.turn[i]!,
      doing = turned || occ,
      work = turned ? turnPlace(i, turned) : p.work[i]!;
    if (shut?.has(work)) {
      // Their building's work is stopped by order: at home, waiting.
      p.act[i] = ACT.wait;
      p.why[i] = WHY.shut;
      if (p.at[i] !== home) go(place, i, home, world);
      continue;
    }
    // Standing to arms by order: in the square, in the hours their work would have had.
    if (p.bound[i] === BOUND_ARMS) {
      p.act[i] = ACT.guard;
      p.why[i] = WHY.arms;
      if (p.at[i] !== AT.square) go(place, i, AT.square, world);
      continue;
    }
    // A siege lies about the town: no one goes out to its fields.
    if (work === AT.fields && matched.sieged) {
      p.act[i] = ACT.wait;
      p.why[i] = WHY.siege;
      if (p.at[i] !== home) go(place, i, home, world);
      continue;
    }
    const sn = p.bound[i] === BOUND_SITE ? sitesNow?.get(work) : undefined;
    if (sn) {
      // One of a site's crew. Stopped (as its land's month stops it), or all it wants done and waiting on the telling: home.
      if (sn.stopped || sn.left <= 0) {
        p.act[i] = ACT.wait;
        p.why[i] = sn.stopped ? WHY.stopped : WHY.raised;
        if (p.at[i] !== home) go(place, i, home, world);
        continue;
      }
      p.why[i] = WHY.site;
      if (p.at[i] !== work) {
        p.act[i] = ACT.build;
        go(place, i, work, world);
        continue;
      }
      // (Nothing on the site to build in: a load of it fetched from outside the town.)
      if (sn.site.stuff < SITE_USE) {
        p.act[i] = ACT.stuff;
        p.why[i] = WHY.stuff;
        go(place, i, AT.fields, world);
        continue;
      }
      // A tick's building: what it is built of built in, tools worn; with none to hand the work is worth what a hand without
      // tools is (rules/goods.ts TOOL_GAIN).
      p.act[i] = ACT.build;
      sn.site.stuff -= SITE_USE;
      const tools = sn.b > 0 ? bldgs.stock[sn.b * GOOD_COUNT + G.tools]! : 0,
        gain = tools >= SITE_WEAR ? 1000 : Math.round(1000 / (1 + TOOL_GAIN));
      if (tools >= SITE_WEAR) {
        bldgs.stock[sn.b * GOOD_COUNT + G.tools]! -= SITE_WEAR;
        usedOf(G.tools, SITE_WEAR);
      }
      sn.site.ticks += gain;
      sn.left -= gain;
      continue;
    }
    if (p.at[i] !== work) {
      // (Setting out from a home that holds more than it keeps: a load of the rest goes to the town's store on the way,
      // for those who reap nothing. In a dearth a home keeps a day's food and no more.)
      if (p.at[i] === home && work === AT.fields && p.carry[i] === 0) {
        const keep = houses.members[h]! * fk.daily * keepDays,
          least = Math.min(LOAD * MICRO, houses.members[h]! * fk.daily);
        let pantry = 0;
        for (let k = 0; k < FOODS.length; k++) pantry += houses.pantry[h * FOODS.length + k]!;
        if (pantry - keep >= least)
          for (let k = FOODS.length - 1; k >= 0; k--) {
            const take = Math.floor(
              Math.min(houses.pantry[h * FOODS.length + k]!, pantry - keep, LOAD * MICRO),
            );
            if (take <= 0) continue;
            houses.pantry[h * FOODS.length + k]! -= take;
            p.carryGood[i] = FOODS[k]!;
            p.carry[i] = take;
            p.act[i] = ACT.carry;
            p.why[i] = WHY.load;
            go(place, i, bldgs.lot[foodStore]!, world);
            break;
          }
        if (p.act[i] === ACT.carry && p.carry[i]! > 0) continue;
      }
      p.act[i] = ACT.work;
      p.why[i] = turned ? WHY.turned : WHY.work;
      go(place, i, work, world);
      continue;
    }
    p.act[i] = ACT.work;
    p.why[i] = turned ? WHY.turned : WHY.work;
    // (An hour given to one's own trade is an hour of skill at it: rules/life.ts.)
    if (!turned && p.skill[i]! < SKILL_MOST) p.skill[i]!++;
    if (doing === OCC.farmer || doing === OCC.herder) {
      // What the fields and the flocks give is brought in a load at a time: home while the pantry is short, else to the store.
      // (Won as fast as a hand that works a third of its time must to win its year's making, of what is ready.)
      // (By their skill: a hand turned to it from another trade wins as one new to it.)
      const g = doing === OCC.farmer ? G.grain : G.meat,
        skilled = turned
          ? SKILL_NEW
          : p.skill[i]! >= SKILL_MOST
            ? 1
            : skillWorth(levelOf(Math.floor(p.skill[i]! / 6))),
        made = Math.min(
          place.ripe[g]!,
          Math.round(tickWin[doing === OCC.farmer ? 0 : 1]! * skilled),
        );
      // (Nothing stands ready to be won: what their priorities name next, if any has work.)
      if (made <= 0 && (turned || prios) && turns(i, occ)) continue;
      place.ripe[g]! -= made;
      if (p.carryGood[i] !== g) setDown(i);
      p.carryGood[i] = g;
      p.carry[i]! += made;
      madeOf(g, made);
      if (p.carry[i]! >= LOAD * MICRO) {
        let pantry = 0;
        for (let k = 0; k < FOODS.length; k++) pantry += houses.pantry[h * FOODS.length + k]!;
        p.act[i] = ACT.carry;
        p.why[i] = WHY.load;
        go(
          place,
          i,
          pantry < houses.members[h]! * fk.daily * keepDays ? home : bldgs.lot[foodStore]!,
          world,
        );
      }
    } else if (doing === OCC.crafter && p.craft[i]) {
      // A making: its stuff taken from where it is worked, the made thing left there; for want of stuff, none.
      const r = RECIPES[p.craft[i]! - 1]!,
        [good, per] = r.output,
        // (One who works at home takes their stuff from the market and leaves what they make there.)
        at = bldgAt(place, p.at[i]!),
        b = at < 0 ? market : at,
        made = Math.round(
          matched.made[good]! *
            perTick *
            (turned
              ? SKILL_NEW
              : p.skill[i]! >= SKILL_MOST
                ? 1
                : skillWorth(levelOf(Math.floor(p.skill[i]! / 6)))),
        );
      let can = made;
      // (What its market will not let go is not to be had there.)
      const has = (x: number) => (barred(b, x) ? 0 : bldgs.stock[b * GOOD_COUNT + x]!);
      for (const [x, amount] of r.inputs) can = Math.min(can, Math.floor((has(x) * per) / amount));
      if (can <= 0 && made > 0) {
        if ((turned || prios) && turns(i, occ)) continue;
        if (turned) continue;
        p.act[i] = ACT.wait;
        p.why[i] = WHY.noStuff;
        continue;
      }
      for (const [x, amount] of r.inputs) {
        const used = Math.min(bldgs.stock[b * GOOD_COUNT + x]!, Math.ceil((can * amount) / per));
        bldgs.stock[b * GOOD_COUNT + x]! -= used;
        usedOf(x, used);
      }
      bldgs.stock[b * GOOD_COUNT + good]! += can;
      madeOf(good, can);
    } else if (doing === OCC.trader) {
      // A carrier: what a working building has made goes to the market; what one lacks and the market holds goes to it.
      if (p.at[i] !== bldgs.lot[market]) continue;
      const wants = wantsNow();
      for (let k = 0; k < wants.length; k++) {
        const [b, x] = wants[k]!,
          has = barred(market, x) ? 0 : bldgs.stock[market * GOOD_COUNT + x]!;
        if (has <= 0) continue;
        const take = Math.min(has, LOAD * MICRO);
        setDown(i);
        bldgs.stock[market * GOOD_COUNT + x]! -= take;
        p.carryGood[i] = x;
        p.carry[i] = take;
        p.act[i] = ACT.carry;
        p.why[i] = WHY.load;
        go(place, i, bldgs.lot[b]!, world);
        wants.splice(k, 1);
        break;
      }
      if (p.act[i] === ACT.carry) continue;
      // (And what its buildings have made, a load of it lying there: fetched for the market, one carrier to each.)
      const haul = haulsNow().shift();
      if (!haul && (turned || prios)) turns(i, occ);
      if (haul) {
        setDown(i);
        p.carryGood[i] = haul[1];
        p.carry[i] = 0;
        p.act[i] = ACT.haul;
        p.why[i] = WHY.haul;
        go(place, i, bldgs.lot[haul[0]]!, world);
      }
    }
  }
  // Those who died of want: told, kept for its land's telling, and gone.
  for (let k = dying.length - 1; k >= 0; k--) {
    const i = dying[k]!,
      row = sexOf(p, i) * BANDS + bandOf(ageOf(p, i, t), f.life);
    note(place, HAP.starved, p.id[i]!, Math.round(ageOf(p, i, t)), occOf(p, i), i);
    place.dead.push(row, occOf(p, i), 1);
    houses.grief[p.house[i]!] = today;
    removePerson(place, i);
  }
  place.t = t + PLACE_TICK;
}

/** The goods a kind of building makes (MAKING_AT turned about). */
const MAKING_GOODS = new Map<number, number[]>();
for (const [good, kinds] of Object.entries(MAKING_AT))
  for (const kind of kinds) {
    const k = KIND_INDEX.get(kind);
    if (k === undefined) continue;
    if (!MAKING_GOODS.has(k)) MAKING_GOODS.set(k, []);
    MAKING_GOODS.get(k)!.push(Number(good));
  }

/** The priorities set for a managed town's people, by who (null: none set): read once for each list its orders hold. */
const PRIOS = new WeakMap<readonly number[], Map<number, number>>();
function prioMap(orders: Managed | null | undefined): Map<number, number> | null {
  const list = orders?.prio;
  if (!list || !list.length) return null;
  let map = PRIOS.get(list);
  if (!map) {
    map = new Map();
    for (let k = 0; k < list.length; k += 2) map.set(list[k]!, list[k + 1]!);
    PRIOS.set(list, map);
  }
  return map;
}
/** One's priorities, where any are set for them (PRIO_KINDS' order; null: none set). */
export function placePrio(world: World, place: Place, id: number): number[] | null {
  const packed = prioMap(managedOf(world)?.get(place.town))?.get(id);
  return packed === undefined ? null : prioOf(packed);
}

/**
 * A managed town's hands put to its orders (sim/town/managed.ts place.work): of its grown at the trades an order can
 * move, as many to each as its shares say; those of a trade with too many take up one with too few, who by a keyed
 * draw. Each is kept for its land's telling (place.settle). Done once for each order given.
 */
function applyOrders(world: World, place: Place, f: Frame): void {
  const orders = managedOf(world)?.get(place.town),
    work = orders?.work ?? null,
    key = orders
      ? `${work ? work.join(",") : ""}|${orders.assigned.join(",")}|${orders.housed.join(",")}|${orders.held.join(",")}|${orders.shelter}${orders.prio ? `|${orders.prio.join(",")}` : ""}`
      : "";
  if (key === place.ordered) return;
  // (A building opened, or shut again, to those without a home: they go to it, or from it, at once.)
  const sheltered = place.ordered.split("|")[4] ?? "-1";
  place.ordered = key;
  if (!orders) return;
  if (String(orders.shelter) !== sheltered) rehome(world, place, f, CAUSE.none);
  const p = place.people,
    at = (occ: number) => (MANAGED_TRADES as readonly number[]).indexOf(occ),
    rowOf = (i: number) => sexOf(p, i) * BANDS + bandOf(ageOf(p, i, place.t), f.life),
    change = (i: number, to: number, what: number) => {
      const from = occOf(p, i);
      if (from === to) return;
      p.sexOcc[i] = (sexOf(p, i) << 4) | to;
      p.skill[i] = 0;
      p.turn[i] = 0;
      note(place, what, p.id[i]!, from, to);
      place.moves.push(rowOf(i), from, to, 1);
    };
  // By name: each put to the trade said, and at the building said if it stands. One let be is their own again.
  const named = new Map<number, readonly [number, number]>();
  for (let k = 0; k < orders.assigned.length; k += 3)
    named.set(orders.assigned[k]!, [orders.assigned[k + 1]!, orders.assigned[k + 2]!]);
  // (Priorities set for one by name: of the four trades, the one set highest is the trade they are put to, as an order
  // by name puts them; the rest say what they turn to when it has nothing for them, in the tick.)
  const prio = prioMap(orders);
  for (let i = 0; i < p.n; i++) {
    const packed = prio?.get(p.id[i]!);
    if (packed !== undefined) {
      const trade = prioTrade(prioOf(packed), occOf(p, i));
      if (trade >= 0) named.set(p.id[i]!, [trade, named.get(p.id[i]!)?.[1] ?? -9]);
    }
    const order = named.get(p.id[i]!);
    if (!order) {
      if (p.bound[i] && p.bound[i]! < BOUND_ARMS) {
        p.bound[i] = 0;
        workOf(world, place, i);
      }
      continue;
    }
    const [trade, post] = order,
      grown = ageOf(p, i, place.t) >= f.life.adulthood;
    if (trade >= 0 && grown) change(i, trade, HAP.assigned);
    p.bound[i] = trade >= 0 && grown ? trade + 1 : 255;
    workOf(world, place, i);
    if (post >= 0 && bldgAt(place, post) > 0 && occOf(p, i) !== OCC.dependent) p.work[i] = post;
  }
  // Households given a home: where the lot holds one.
  if (orders.housed.length) {
    const f2 = townsOf(world).get(place.town);
    for (let k = 0; k < orders.housed.length; k += 2) {
      const h = place.houses.key.indexOf(orders.housed[k]!),
        lot = orders.housed[k + 1]!;
      if (h < 0 || !f2 || lot >= f2.next || place.houses.home[h] === lot) continue;
      if (levelsOf(f2, lot, lot + 1)[0]! < 0) continue;
      const old = place.houses.home[h]!;
      place.houses.home[h] = lot;
      place.houses.fresh[h] = Math.floor(place.t / DAY);
      let told = false;
      for (let i = 0; i < p.n; i++) {
        if (p.house[i] !== h) continue;
        if (!told) note(place, HAP.moved, p.id[i]!, old, lot);
        told = true;
        if (p.work[i] === old) p.work[i] = lot;
        if (p.at[i] === old && !p.eta[i]) p.at[i] = p.to[i] = lot;
      }
    }
    layLots(world, place);
  }
  // By share: of its grown at the trades an order can move, those no order holds by name, as many to each as said.
  if (work && !work.every((x) => x <= 0)) {
    const hands: number[][] = MANAGED_TRADES.map(() => []);
    for (let i = 0; i < p.n; i++) {
      const k = at(occOf(p, i));
      if (k >= 0 && !p.bound[i] && ageOf(p, i, place.t) >= f.life.adulthood) hands[k]!.push(i);
    }
    const all = hands.reduce((n, list) => n + list.length, 0),
      want = all > 0 ? apportion(all, work) : [];
    for (let from = 0; from < hands.length && all > 0; from++) {
      const list = hands[from]!,
        draw = new Map(
          list.map((i) => [i, world.rng.unit(PLACE_DRAW, place.key ^ p.id[i]!, place.t, P.order)]),
        );
      list.sort((a, b) => draw.get(a)! - draw.get(b)! || p.id[a]! - p.id[b]!);
      // (One too low in mood heeds no order to change their work, and is told so once.)
      const stay: number[] = [];
      for (let to = 0; to < hands.length && list.length + stay.length > want[from]!; to++) {
        if (to === from) continue;
        while (
          list.length > 0 &&
          list.length + stay.length > want[from]! &&
          hands[to]!.length < want[to]!
        ) {
          const i = list.pop()!;
          if (p.mood[i]! < MOOD_UNHEEDING) {
            note(place, HAP.unheeded, p.id[i]!, MANAGED_TRADES[from]!, MANAGED_TRADES[to]!);
            stay.push(i);
            continue;
          }
          change(i, MANAGED_TRADES[to]!, HAP.ordered);
          workOf(world, place, i);
          hands[to]!.push(i);
        }
      }
      list.push(...stay);
    }
  }
  // (One of a site's crew put elsewhere by name is made up for; those standing to arms made up, or stood down.)
  if (place.sites.length) crewSites(world, place, f);
  armsCrew(world, place, f);
  reckonMeans(world, place);
}

/**
 * What a managed town has done that its land has not been told, as its settling tells it (sim/town/managed.ts
 * place.settle), and let go of here: the host tells it as the command is taken (Universe.told). Null: nothing to tell,
 * or the town is not managed.
 */
export function settleOf(
  world: World,
  town: string,
): { town: string; moves: SettleMove[]; dead: SettleDead[]; built: SettleBuilt[] } | null {
  const place = placesOf(world)?.get(town);
  if (!place || !managedOf(world)?.get(town)) return null;
  // (Its sites in hand: the whole person-months its own people did on each, the rest kept; and over how long.)
  const built: SettleBuilt[] = [];
  for (const x of place.sites) {
    const seconds = place.t - x.from;
    if (seconds <= 0) continue;
    const months = Math.floor(x.ticks / (TICKS_PM * 1000));
    x.ticks -= months * TICKS_PM * 1000;
    x.from = place.t;
    built.push([x.n, months, seconds]);
  }
  if (!place.moves.length && !place.dead.length && !built.length) return null;
  const moves = new Map<string, number>(),
    dead = new Map<string, number>();
  for (let k = 0; k < place.moves.length; k += 4) {
    const key = `${place.moves[k]},${place.moves[k + 1]},${place.moves[k + 2]}`;
    moves.set(key, (moves.get(key) ?? 0) + place.moves[k + 3]!);
  }
  for (let k = 0; k < place.dead.length; k += 3) {
    const key = `${place.dead[k]},${place.dead[k + 1]}`;
    dead.set(key, (dead.get(key) ?? 0) + place.dead[k + 2]!);
  }
  place.moves = [];
  place.dead = [];
  const cells = (m: Map<string, number>) =>
    [...m].map(([key, n]) => [...key.split(",").map(Number), n]);
  return {
    town,
    moves: cells(moves) as unknown as SettleMove[],
    dead: cells(dead) as unknown as SettleDead[],
    built,
  };
}

/** A managed town's orders, as a place lives by them (null: it has none). */
export function ordersOf(world: World, town: string): Managed | null {
  return managedOf(world)?.get(town) ?? null;
}

/**
 * The town's named people of the god game for its people here (host/roster.ts): each holder of one of its roster's lines
 * is one of the place's own of the same sex, age band and work, who takes the holder's age. Where no one of the place
 * is of a holder's kind, that holder is not here (the place's table is its town's, and is not bent to them).
 */
function linkRoster(world: World, place: Place, s: Settlement, f: Frame): void {
  const p = place.people,
    year = Math.floor(place.t / YEAR),
    roster = townRoster(world, place.town, year),
    work = folkWork(world, place.cell),
    lines = Math.min(linesOf(Math.round(s.population)), Math.ceil(p.n / 12)),
    free = new Map<number, number[]>();
  for (let i = p.n - 1; i >= 0; i--) {
    p.line[i] = 0;
    const c = (sexOf(p, i) * BANDS + bandOf(ageOf(p, i, place.t), f.life)) * OCCS + occOf(p, i);
    if (!free.has(c)) free.set(c, []);
    free.get(c)!.push(i);
  }
  for (let k = 0; k < lines; k++) {
    const h = roster.holder(k);
    if (!h) continue;
    const age = year - h.born + 0.5,
      band = bandOf(age, f.life),
      occ = age < f.life.adulthood ? OCC.dependent : lineWork(h.key, work),
      i = free.get((rowSex(h.sex) * BANDS + band) * OCCS + occ)?.pop();
    if (i === undefined) continue;
    p.line[i] = k + 1;
    p.lineN[i] = h.n;
    p.born[i] = Math.floor(place.t / DAY - age * 365);
  }
}
/** A roster holder's sex (1: a man) as the world's table numbers the sexes. */
const rowSex = (sex: number): number => (sex === 1 ? 1 - FEMALE : FEMALE);

/**
 * One of its realm's key figures who lives in the town (their page, their sex as the town's plan has it: 1 a man) is one
 * of the place's own people: kept once found; else one of its grown who holds no roster's line and is no other figure,
 * a leader of their sex before any other, the lowest numbered first. Null: no one of the place can be them.
 */
export function placeFigure(
  place: Place,
  ref: string,
  name: string,
  sex: number | undefined,
  grown: number,
): number | null {
  const p = place.people,
    at = place.figRef.indexOf(ref);
  if (at >= 0) {
    if (placeIndexOf(place, place.figId[at]!) >= 0) return place.figId[at]!;
    // (Dead or gone since: another is found.)
    place.figRef.splice(at, 1);
    place.figId.splice(at, 1);
    place.figName.splice(at, 1);
  }
  const taken = new Set(place.figId);
  let best = -1,
    worth = -1;
  for (let i = 0; i < p.n; i++) {
    if (p.line[i] || taken.has(p.id[i]!) || ageOf(p, i, place.t) < grown) continue;
    const w =
      (occOf(p, i) === OCC.leader ? 4 : 0) +
      (sex === undefined || sexOf(p, i) === rowSex(sex) ? 2 : 0) +
      (occOf(p, i) !== OCC.dependent ? 1 : 0);
    if (w > worth || (w === worth && p.id[i]! < p.id[best]!)) {
      worth = w;
      best = i;
    }
  }
  if (best < 0) return null;
  place.figRef.push(ref);
  place.figId.push(p.id[best]!);
  place.figName.push(name);
  return p.id[best]!;
}

/** Those who hold a roster's line no longer (dead, or their term done) are the town's own again. */
function unlinkRoster(world: World, place: Place): void {
  const p = place.people;
  let roster: ReturnType<typeof townRoster> | null = null;
  for (let i = 0; i < p.n; i++) {
    if (!p.line[i]) continue;
    roster ??= townRoster(world, place.town, Math.floor(place.t / YEAR));
    if (roster.holder(p.line[i]! - 1)?.n !== p.lineN[i]) p.line[i] = 0;
  }
}

// —— Entering, staying, coming back ——————————————————————————————————————————————————————————————————————————————

/** A place's needs and whereabouts drawn afresh after a long absence: at home, somewhere in their day. */
function settle(world: World, place: Place): void {
  const p = place.people;
  for (let i = 0; i < p.n; i++) {
    for (let q = 0; q < NEEDS; q++)
      p.needs[i * NEEDS + q] = Math.floor(
        world.rng.unit(PLACE_DRAW, place.key ^ p.id[i]!, place.t, P.settle, q) * FULL * 0.6,
      );
    p.owed[i] = Math.round((2 * p.needs[i * NEEDS + N.food]!) / frameOf(world, place.cell).hunger);
    // (What was in hand is set down in the square.)
    if (p.carry[i]! > 0) place.bldgs.stock[p.carryGood[i]!]! += p.carry[i]!;
    p.carry[i] = 0;
    p.act[i] = ACT.idle;
    p.why[i] = WHY.none;
    p.at[i] = p.to[i] = place.houses.home[p.house[i]!] ?? AT.square;
    p.eta[i] = p.trip[i] = 0;
  }
}

/**
 * A place brought to the world's moment. Tick by tick where it is not far behind, matched to the world at the turn of
 * a month if one is crossed: exactly what staying would have made of it. Far behind (more than EXACT_MOST, or more
 * than one month's turn), its day is drawn afresh and stepped, and it is matched to the world as it is now. How many
 * ticks it took. (Its people's table is the town's at every matching; between two, they grow older by the clock, and
 * one may cross into the next band a little before the world's own reckoning moves its count.)
 */
export function advancePlace(world: World, place: Place): number {
  const s = populationContext(world).settlements.get(place.town);
  if (!s) return 0;
  const f = frameOf(world, place.cell),
    now = Math.floor(world.now / PLACE_TICK) * PLACE_TICK,
    month = Math.floor(world.now / MONTH);
  if (UNPAIRED.has(place)) {
    UNPAIRED.delete(place);
    pairHouses(place, f);
  }
  if (UNSKILLED.has(place)) {
    UNSKILLED.delete(place);
    for (let i = 0; i < place.people.n; i++)
      place.people.skill[i] = skillAt(f, ageOf(place.people, i, place.t), occOf(place.people, i));
  }
  layLots(world, place);
  // (What it was asked to raise read anew where that has changed; its hands put to any order given since: before its next
  // tick, and though the clock stands still.)
  syncSites(world, place, f);
  applyOrders(world, place, f);
  if (now <= place.t) return 0;
  let ticks = 0;
  if (now - place.t > EXACT_MOST || month - place.matched.month > 1) {
    // (Its day drawn afresh and stepped, then matched to the world at the very moment it is looked at.)
    place.t = now - SETTLE;
    settle(world, place);
    while (place.t < now) {
      tick(world, place, f);
      ticks++;
    }
    reconcile(world, place, s, f, month);
    unworked(place);
    // (What struck it while it was away is in its land's count already, matched just now: none of it is read again.)
    place.seen = world.now;
    place.fire = [];
    return ticks;
  }
  // What struck the town since it was last read (host/town.ts: what its plan is told), each as its clock passes it.
  const strikes =
    place.seen < world.now
      ? strikesOn(
          world,
          place.town,
          populationContext(world).provinces.get(place.cell)?.ref ?? null,
          place.seen,
        )
      : [];
  let next = 0;
  while (place.t < now) {
    // (The month's turn: the world has reckoned its land, and the place is matched to it before its next tick.)
    // (What struck it at that very turn is read first: the world's own fires and shakings come at a month's turn, a
    // raid at a year's, and matched first their homeless were told as losing their homes to nothing, their fire fought
    // in the square, and their dead named of anyone.)
    while (next < strikes.length && strikes[next]!.at <= place.t)
      struck(world, place, s, f, strikes[next++]!);
    const m = Math.floor(place.t / MONTH);
    if (m > place.matched.month) reconcile(world, place, s, f, m, true);
    if (place.due.length && place.due[0]! <= place.t) liveDue(world, place, f);
    tick(world, place, f);
    ticks++;
  }
  // (Those its clock has not yet come to wait for it.)
  place.seen = next < strikes.length ? strikes[next]!.at - 1 : world.now;
  return ticks;
}

/** A town entered: its place as kept, brought to now, or made of the town as it stands (null: no such town, or no one in it). */
export function enterPlace(world: World, town: string): Place | null {
  const store = placesOf(world),
    s = populationContext(world).settlements.get(town as Ref);
  if (!store || !s || Math.round(s.population) <= 0) return null;
  let place = store.get(town);
  if (place) {
    advancePlace(world, place);
    store.touch(place);
  } else {
    place = makePlace(world, s) ?? undefined;
    if (place) store.keep(place);
  }
  return place ?? null;
}

// —— What it tells ———————————————————————————————————————————————————————————————————————————————————————————————

export type PlacePersonRead = {
  readonly id: number;
  readonly sex: number;
  readonly age: number;
  readonly occupation: number;
  readonly craft: string | null;
  readonly house: number;
  readonly houseKey: number;
  readonly home: number;
  readonly work: number;
  readonly workKind: string | null;
  readonly needs: readonly number[];
  readonly act: number;
  readonly why: number;
  readonly worth: number;
  readonly at: number;
  readonly to: number;
  readonly eta: number;
  readonly carry: { readonly good: number; readonly amount: number } | null;
  readonly fifth: number;
  readonly means: number;
  readonly household: readonly number[];
  readonly pantry: readonly number[];
};

export function placeIndexOf(place: Place, id: number): number {
  const p = place.people;
  for (let i = 0; i < p.n; i++) if (p.id[i] === id) return i;
  return -1;
}

/** One of a place's people, read. */
export function placePerson(world: World, place: Place, id: number): PlacePersonRead | null {
  const p = place.people,
    i = placeIndexOf(place, id);
  if (i < 0) return null;
  const h = p.house[i]!,
    b = bldgAt(place, p.work[i]!),
    household: number[] = [];
  for (let k = 0; k < p.n; k++) if (p.house[k] === h && k !== i) household.push(p.id[k]!);
  return {
    id,
    sex: sexOf(p, i),
    age: ageOf(p, i, place.t),
    occupation: occOf(p, i),
    craft: p.craft[i] ? RECIPES[p.craft[i]! - 1]!.name : null,
    house: h,
    houseKey: place.houses.key[h]!,
    home: place.houses.home[h]!,
    work: p.work[i]!,
    workKind: b > 0 ? kindName(place.bldgs.kind[b]!) : null,
    needs: [0, 1, 2, 3].map((q) => p.needs[i * NEEDS + q]! / FULL),
    act: p.act[i]!,
    why: p.why[i]!,
    worth: workWorth(world, place, i),
    at: p.at[i]!,
    to: p.to[i]!,
    eta: p.eta[i]!,
    carry: p.carry[i]! > 0 ? { good: p.carryGood[i]!, amount: p.carry[i]! / MICRO } : null,
    fifth: place.houses.fifth[h]!,
    means: place.houses.means[h]!,
    household,
    pantry: FOODS.map((_, k) => place.houses.pantry[h * FOODS.length + k]! / MICRO),
  };
}

export type PlaceLotRead = {
  readonly lot: number;
  /** A building's kind ("square" for the square), or null for a home. */
  readonly kind: string | null;
  readonly start: number;
  /** What it holds, good by good (units). */
  readonly stock: readonly number[];
  /** Who lives here, who works here, who is here now: ids. */
  readonly living: readonly number[];
  readonly working: readonly number[];
  readonly here: readonly number[];
  readonly households: readonly {
    readonly house: number;
    readonly key: number;
    readonly fifth: number;
  }[];
};

/** A lot of a place, read: one of its buildings with its stocks, or a home with its pantries. */
export function placeLot(place: Place, lot: number): PlaceLotRead {
  const { people: p, houses, bldgs } = place,
    b = bldgAt(place, lot),
    stock = new Array<number>(GOOD_COUNT).fill(0),
    living: number[] = [],
    working: number[] = [],
    here: number[] = [],
    households: { house: number; key: number; fifth: number }[] = [];
  if (b >= 0)
    for (let g = 0; g < GOOD_COUNT; g++) stock[g] = bldgs.stock[b * GOOD_COUNT + g]! / MICRO;
  for (let h = 0; h < houses.n; h++)
    if (houses.home[h] === lot && houses.members[h]! > 0) {
      households.push({ house: h, key: houses.key[h]!, fifth: houses.fifth[h]! });
      for (let k = 0; k < FOODS.length; k++)
        stock[FOODS[k]!]! += houses.pantry[h * FOODS.length + k]! / MICRO;
    }
  for (let i = 0; i < p.n; i++) {
    if (houses.home[p.house[i]!] === lot) living.push(p.id[i]!);
    if (p.work[i] === lot) working.push(p.id[i]!);
    if (p.at[i] === lot && !p.eta[i]) here.push(p.id[i]!);
  }
  return {
    lot,
    kind: b >= 0 ? kindName(bldgs.kind[b]!) : null,
    start: b >= 0 ? bldgs.start[b]! : 0,
    stock,
    living,
    working,
    here,
    households,
  };
}

/** The homes of a place's town with most room to spare, for a household given one: each lot, and the room in it. */
export function placeHomes(world: World, place: Place, most = 4): { lot: number; room: number }[] {
  const homes = homesFor(world, place.town, place.people.n + 64),
    living = new Map<number, number>(),
    h = place.houses;
  for (let k = 0; k < h.n; k++)
    living.set(h.home[k]!, (living.get(h.home[k]!) ?? 0) + h.members[k]!);
  return homes.lot
    .map((lot, k) => ({ lot, room: homes.holds[k]! - (living.get(lot) ?? 0) }))
    .filter((x) => x.room > 0)
    .sort((a, b) => b.room - a.room || a.lot - b.lot)
    .slice(0, most);
}

/** A site of a place, read: how far it has got, what it wants, and who works it. */
export type PlaceSiteRead = {
  /** The asking behind it (its number among its town's), its lot, what it will be (a building's kind). */
  readonly n: number;
  readonly lot: number;
  readonly kind: string;
  /** How far it has got, 0 … 1: what its land has been told and what its own people have done since. */
  readonly share: number;
  readonly worked: number;
  readonly effort: number;
  /** Whether the place has it in hand, with how many, and the most it could put to it. */
  readonly inHand: boolean;
  readonly hands: number;
  readonly most: number;
  /** How its town took the asking up (sim/town/asks.ts): what bounds the hands it spares. */
  readonly answer: string;
  /** Its crew (their numbers), and how many of them are at it or carrying to it now. */
  readonly crew: readonly number[];
  readonly busy: number;
  /** What it is built of (tonnes): lying on the site, brought in all, and what the rest of it wants. */
  readonly stuff: number;
  readonly brought: number;
  readonly wants: number;
  /** Tools (measures): on the site, and what the rest of it will wear out. */
  readonly tools: number;
  readonly toolsWanted: number;
  /** Food the rest of it takes over what its hands would have eaten at home (measures: a person's month each). */
  readonly food: number;
  readonly stopped: boolean;
  /** All it wants is done here, and its land has yet to be told. */
  readonly raised: boolean;
  /** Months more at this rate (its hands at a third of their time, as its land's month reckons them). */
  readonly months: number;
};

/** A place's sites: every building its town was asked to raise that is still going up. */
export function placeSites(world: World, place: Place): PlaceSiteRead[] {
  const asks = asksIn(world, place.town),
    ctx = populationContext(world),
    p = place.people,
    out: PlaceSiteRead[] = [];
  for (let b = 1; b < place.bldgs.lot.length; b++) {
    const a = asks[place.bldgs.site[b]! - 1],
      w = a?.work;
    if (!a || !w || w.done !== null || w.left) continue;
    const lot = place.bldgs.lot[b]!,
      site = place.sites.find((x) => x.n === a.n),
      here = site ? site.ticks / (TICKS_PM * 1000) : 0,
      // (What its land's count runs ahead by is not yet done: sim/town/managed.ts siteOwed.)
      done = w.worked - siteOwed(world, a) + here,
      left = Math.max(0, w.effort - done),
      crew: number[] = [];
    let busy = 0;
    if (site)
      for (let i = 0; i < p.n; i++)
        if (p.bound[i] === BOUND_SITE && p.work[i] === lot) {
          crew.push(p.id[i]!);
          if (p.act[i] === ACT.build || p.act[i] === ACT.stuff) busy++;
        }
    out.push({
      n: a.n,
      lot,
      kind: kindName(place.bldgs.kind[b]!),
      share: Math.max(0, Math.min(1, done / w.effort)),
      worked: done,
      effort: w.effort,
      inHand: !!site,
      hands: w.hands,
      most: siteMostHands(ctx, a),
      answer: a.answer,
      crew,
      busy,
      stuff: (site?.stuff ?? 0) / MICRO,
      brought: (site?.brought ?? 0) / MICRO,
      wants: left * SITE_TONNES,
      tools: place.bldgs.stock[b * GOOD_COUNT + G.tools]! / MICRO,
      toolsWanted: left / SITE_TOOL_MONTHS,
      food: left / 2,
      stopped: w.stops.at(-1)?.to === null,
      raised: !!site && left <= 0,
      months: left / Math.max(1, w.hands),
    });
  }
  return out;
}

/** How far along a site is, in a word: what is seen of it. */
export function siteStage(share: number, kind = ""): string {
  if (kind === "walls")
    return share < 0.08
      ? "their line staked out and its footing dug"
      : share < 0.95
        ? `${Math.round(share * 100)} in a hundred of their ring standing, a length at a time`
        : "their last lengths closing and their gates being hung";
  return share < 0.08
    ? "its ground cleared and its footing dug"
    : share < 0.3
      ? "its frame going up"
      : share < 0.75
        ? "its walls rising"
        : share < 0.95
          ? "its roof going on"
          : "being fitted out";
}

/** What happened to someone, said in full: what struck them, which battle, which sickness. */
export function hapTold(
  place: Place,
  x: PlaceHap,
  /** One of the place by their number, named (a mother, the one paired with), where the teller can. */
  named: ((id: number) => string | null) | null = null,
): string {
  const battle = () => (place.wars[x.a] ?? "a battle").split("|")[0]!,
    ill = () => (place.ills[x.a] ?? "a sickness").split("|")[0]!;
  switch (x.what) {
    case HAP.born:
      return x.a > 0 && named?.(x.a) ? `was born to ${named(x.a)}` : "was born";
    case HAP.paired:
      return named?.(x.a) ? `and ${named(x.a)} were paired, and are one household` : "was paired";
    case HAP.buried:
      return `was buried, ${x.a === 1 ? "one of their household" : `${x.a} of their household`} standing by`;
    case HAP.ofAge:
      return `came of age, and took up work as ${OCCUPATIONS[x.b] === "crafter" ? "a crafter" : `a ${OCCUPATIONS[x.b] ?? "hand"}`}`;
    case HAP.homeless:
      return `lost their home${x.a ? ` ${CAUSE_WORDS[x.a]}` : ""}, and their household with them`;
    case HAP.struckDead:
      return `died ${CAUSE_WORDS[x.a] ?? ""}`.trim();
    case HAP.struckHurt:
      return `was hurt ${CAUSE_WORDS[x.a] ?? ""}`.trim();
    case HAP.fell:
      return `fell in ${battle()}`;
    case HAP.wounded:
      return `came home wounded from ${battle()}`;
    case HAP.plague:
      return `died of ${ill()}`;
    case HAP.sick:
      return `fell sick of ${ill()}`;
    default:
      return HAP_WORDS[x.what] ?? "";
  }
}

/**
 * What a place's log tells one line each however many there were in a day (a death, a hurt, a home lost); the rest are
 * told a few to a day and then counted, by what so many of them did.
 */
export const HAP_GRAVE: ReadonlySet<number> = new Set([
  HAP.died,
  HAP.starved,
  HAP.sick,
  HAP.hurt,
  HAP.unheeded,
  HAP.homeless,
  HAP.struckDead,
  HAP.struckHurt,
  HAP.fell,
  HAP.wounded,
  HAP.famine,
  HAP.plague,
]);
/** What many did, where they are counted: "were born". */
export const HAP_MANY: readonly string[] = [
  "were born",
  "died",
  "came to the town",
  "left the town",
  "took up other work",
  "died of want",
  "were put to other work by the town's orders",
  "fell sick",
  "were hurt at their work",
  "are well again",
  "were put to work by name, by your order",
  "moved to a home given them by your order",
  "would not heed an order",
  "found the pantry bare",
  "were put to building, by your order",
  "went back to their own work from a site",
  "lost their homes",
  "died",
  "were hurt",
  "fell in battle",
  "came home wounded",
  "starved",
  "died of a sickness",
  "stood to arms, by your order",
  "stood down from arms",
  "found a home again with their households",
  "were taken in under a roof, in the building opened to them",
  "are up again, their wounds bound",
  "were paired",
  "were buried",
  "came of age",
];

/** What many did, said with what of: "died of the red flux", "fell in the battle at Sairis's land". */
export function hapMany(place: Place, what: number, a: number): string {
  const battle = (place.wars[a] ?? "a battle").split("|")[0]!,
    ill = (place.ills[a] ?? "a sickness").split("|")[0]!;
  switch (what) {
    case HAP.struckDead:
      return `died ${CAUSE_WORDS[a] ?? ""}`.trim();
    case HAP.struckHurt:
      return `were hurt ${CAUSE_WORDS[a] ?? ""}`.trim();
    case HAP.homeless:
      return `lost their homes ${CAUSE_WORDS[a] ?? ""}`.trim();
    case HAP.fell:
      return `fell in ${battle}`;
    case HAP.wounded:
      return `came home wounded from ${battle}`;
    case HAP.plague:
      return `died of ${ill}`;
    case HAP.sick:
      return `fell sick of ${ill}`;
    default:
      return HAP_MANY[what] ?? "besides";
  }
}

/** The page that tells more of what happened to someone (null: none): the battle, the sickness. */
export function hapRef(place: Place, x: PlaceHap): string | null {
  if (x.what === HAP.fell || x.what === HAP.wounded) return place.wars[x.a]?.split("|")[1] ?? null;
  if (x.what === HAP.plague || x.what === HAP.sick) return place.ills[x.a]?.split("|")[1] ?? null;
  return null;
}

/** What happened to someone, in words ("died", "took up other work"). */
export const hapWords = (what: number): string => HAP_WORDS[what] ?? "";
