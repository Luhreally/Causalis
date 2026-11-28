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
// where its plan lays it on its ground (host/village.ts townFieldsMeant: the one laying its view draws by; a field its
// ground moved is walked to where it is drawn). Wool, hides
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
  dmath,
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
  CARE_PRINCIPLES,
  REMEDY_PRINCIPLES,
  BLOOD,
  FESTER_MOST,
  bleedOf,
  festerChance,
  festerNext,
  festerStart,
  fightOf,
  painOf,
  remedyFight,
  ART,
  HOLD,
  SENSE_ARTS,
  SENTENCE,
  harshOf,
  keepsPersons,
  sentenceMix,
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
  LIFE_WANTS,
  OCCUPATIONS,
  RECIPES,
  SEXES,
  TOOL_GAIN,
  WANTS,
  WAY,
  ownLeaning,
  ownNature,
  TEMPER,
  TISSUES,
  tissueOf,
  tissuePain,
  tissueMends,
  tissueTakes,
  type Tissue,
  qualityOf,
  type Edge,
  WAY_TRAITS,
  bandOf,
  tendedBy,
  coatOf,
  dayOf,
  nightFall,
  affordancesOf,
  type BodyPlan,
  type LifeHistory,
  LEISURE,
  restDays,
} from "../rules/index.ts";
import {
  LEISURE_ROW,
  LEISURE_STORE,
  societyStore,
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
  beliefOf,
  INTOX,
  INTOX_STORE,
  intoxDependent,
  intoxLost,
  CIVIC_LOTS,
  artOf,
  courtIn,
  holdOf,
  lawOf,
  orderOf,
  politiesOf,
  MANAGED_TRADES,
  PRIO_FIRE_OWN,
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
import { landCloth, toolMade, townStuff } from "./chain.ts";
import { GATE_ASKS, GATE_WHO, gateOn, type GateKind } from "./placegate.ts";

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
/**
 * A body's blood, as a place counts it (N9): so many parts to the whole; past BLOOD_FATAL of them lost it dies, past
 * BLOOD_FAINT it cannot stand (rules/healing.ts BLOOD). A festering's bits: seen to fester or not, and dressed.
 */
const BLOOD_UNITS = 250,
  BLOOD_FATAL = Math.round(BLOOD.fatal * BLOOD_UNITS),
  BLOOD_FAINT = Math.round(BLOOD.faint * BLOOD_UNITS),
  FESTER_SEEN = 64,
  FESTER_DRESSED = 128,
  FESTER_LOAD = 63;
/** A dose of remedies gathered in so many ticks (est: a handful of a known plant found and cut in an hour about the fields). */
const HERB_TICKS = 6;
/** The doses a healer keeps by them: one for so many of the town, and never fewer than the least. */
const HERBS_PER = 60,
  HERBS_LEAST = 4;
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
  "tending the hurt",
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
  /** Their day's work done, or a day of rest: at their people's games in the square (N7). */
  play: 26,
  /** A day of rest, or out of their working day: at home. */
  rest: 27,
  /** The town's healer, gone to one of its hurt who wants them; and out gathering the remedies they treat with (N9). */
  tend: 28,
  herbs: 29,
  /** A maker whose making's good the town holds as much of as its bill asks, with nothing else billed to make (N10). */
  billMet: 30,
  /** Broken by a mood too low to bear (N11): wandering dazed, eating all in sight, or lashing out; and held, or at labour, by the town's justice. */
  broke: 31,
  held: 32,
  labour: 33,
  /** Kept clear by your order (O2): the work where they work stopped, and their home gone to by no one. */
  clear: 34,
  /** O7: keeping the night's watch at the guard's post, by turns. */
  watch: 35,
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
  /** What its head decided, stewarding it (host/steward.ts says it). */
  steward: 31,
  /** Words with one they cannot abide (a: theirs), and blows (N8). */
  quarrel: 32,
  brawl: 33,
  /** Dead of a wound (N9): bled to death, and of one that festered. */
  bled: 34,
  festered: 35,
  /**
   * N11: broke down, a mood too low to bear (a: how, BREAK's); brought before the town's justice (a: the wronged, b: what
   * came of it, VERDICT's); let go at their term's end; put to death by it; and made a work (a: its lot).
   */
  broke: 36,
  judged: 37,
  freed: 38,
  executed: 39,
  madeWork: 40,
  /** Stole from another household, in want (a: one of it; b: the food taken, millionths; items: the thing taken). */
  stole: 41,
  /** Q2: two paired who could no longer abide each other parted (`a`: the other). */
  parted: 42,
  /** O7: caught stealing by the watch at the guard's post (`a`: one of the household they would have robbed). */
  caught: 43,
  /** Come to its gate (P2): `a` their line in `gates`, `b` how many (GATE_TURNED added: turned away by its order). */
  gate: 44,
  /** Seized by a strange mood (P8): they made a masterwork, `a` the lot it is kept at. */
  inspired: 45,
} as const;
/** On a gate's line (HAP.gate): those who asked to live in the town turned away, its gate shut to them by order. */
export const GATE_TURNED = 1 << 20;
/** The happenings that are a death. */
const HAP_DEATH: ReadonlySet<number> = new Set([1, 5, 17, 19, 21, 22, 34, 35, 39]);
/** Whether a happening of a place's log is a death. */
export const hapIsDeath = (what: number): boolean => HAP_DEATH.has(what);
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
  "gave an order, as the town's head",
  "quarrelled",
  "came to blows",
  "bled to death of their wound",
  "died of a wound that festered",
  "broke down, their mood too low to bear",
  "was brought before the town's justice",
  "was let go, their term served",
  "was put to death by the town's justice",
  "made a work",
  "stole from another household",
  "parted from the one they were paired with",
  "was caught stealing by the watch",
  "came to the gate",
  "was seized by a strange mood",
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
  steward: 23,
  meet: 24,
  bleed: 25,
  fester: 26,
  brk: 27,
  judge: 28,
  art: 29,
  vital: 30,
  gear: 31,
  theft: 32,
  strange: 33,
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
  /**
   * What they remember that bears on their mood, THOUGHTS a person (0: none): each its kind (THOUGHT) × 2^24, what it
   * moved their mood by when it befell them (points + 128) × 2^16, and the day it did (the world's day, its last 16 bits).
   * It fades by halves (THOUGHT_HALF) and is let go once it moves them by less than a point.
   */
  thought: Uint32Array;
  /**
   * The ticks they have given to each kind of work but their own trade's, which `skill` counts (SKILL_KINDS' order, six
   * ticks an hour; their own trade's slot unused, 0): the hours of a trade they have left are kept with it, and taken up
   * again should they come back to it (rules/life.ts: the hours one has given to a craft are their skill at it).
   */
  hours: Uint16Array;
  /** The kind of work their household taught them as they grew (SKILL_KINDS' place + 1; 0: none): their passion. */
  taught: Uint8Array;
  /**
   * Whom they know (N8): up to TIES of the place's people by their number (0: none), and what they think of each, -100 …
   * 100 (`regard`): made and moved as they meet, at home, at work and about their street (meetDay).
   */
  tie: Uint32Array;
  regard: Int8Array;
  /**
   * A wound by the hour (N9; rules/healing.ts): how hard it bleeds now (`bleed`) and the blood they have lost (`blood`),
   * each in BLOOD_UNITS of their body's whole; and its festering (`fester`): the festering itself in its low six bits (0:
   * clean, to FESTER_MOST), whether it has been seen to fester or not (64), and whether it is dressed (128).
   */
  bleed: Uint8Array;
  blood: Uint8Array;
  fester: Uint8Array;
  /**
   * How closely they are followed (TIER's; the tiers asked for 2026-11-26, so the mode can go deeper a person): in full,
   * every ten minutes; light, at the hour; or among the folk, every three hours. Each is turned at their own stride (their
   * number setting its hour), their walk by the tick, and on coming where they were going. A byte: the tier in its two
   * low bits; above them, for one raised into full within a stride, the ticks of it their last turn already did the
   * work of.
   */
  tier: Uint8Array;
  /**
   * How many ticks into their stride their needs are reckoned to (tiers): what they did within it, each at its own
   * ticks, so that a meal had within a stride is not hungered after for the whole of it. 0 at every turn of theirs; 0
   * always for one in full. A byte.
   */
  reck: Uint8Array;
  /**
   * The tissue their wound reached (asked 2026-11-26: "members and tissues"; rules/tissues.ts TISSUES' place + 1; 0: no
   * wound, or one dealt before tissues were): it sets how much the wound hurts, how long it mends and what of its member's
   * work it takes. A byte, kept while it mends; a scar's or a lame limb's is in `mark`.
   */
  tissue: Uint8Array;
  /**
   * P3. Their mother and father (their numbers; 0: not known, one who came to the town grown, or born before parents were
   * kept): those born in the town are born to one who bears and the one she is paired with, so a family's tree is the
   * place's own.
   */
  mother: Uint32Array;
  father: Uint32Array;
};
/**
 * The kinds of work one's hours are counted at (N6): the six trades' own, in OCCUPATIONS' order past the dependent's (a
 * forager hunts and gathers; a trader hauls), then raising a building (and bringing what it is built of), tending one of
 * their own household abed (rules/healing.ts: a household tends its own where no healer or hospital does), fighting a
 * fire, and cooking at their hearth (each meal eaten at home is made there).
 */
export const SKILL_KINDS = [
  "hunting",
  "fields",
  "herds",
  "crafts",
  "hauling",
  "leading",
  "building",
  "healing",
  "fire",
  "cooking",
] as const;
export const SK = {
  hunting: 0,
  fields: 1,
  herds: 2,
  crafts: 3,
  hauling: 4,
  leading: 5,
  building: 6,
  healing: 7,
  fire: 8,
  cooking: 9,
} as const;
const KINDS_N = SKILL_KINDS.length;
/** A trade's kind of work (its place in OCCUPATIONS, less the dependent's; a dependent has none: -1). */
export const tradeKind = (occ: number): number => occ - 1;
/**
 * How many things one remembers at once (the weakest let go for a new one): six, 24 bytes a person, so a person of a
 * place stays within its hundred bytes (96). Few hold more than two at once (a town of 600 held 8 among them all after
 * a quiet season), so a sixth is let go only in a year of many sorrows, and then the faintest.
 */
export const THOUGHTS = 6;
/** Whom one knows at the most (N8): about a dozen, as many as most hold close (the sympathy group of a dozen or so). */
export const TIES = 12;
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
  4 +
  4 * THOUGHTS +
  // (N6: the hours given to each kind of work, and the kind their household taught them.)
  2 * SKILL_KINDS.length +
  1 +
  // (N8: whom they know, by number, and what they think of each.)
  5 * TIES +
  // (N9: a wound's bleeding, the blood lost, its festering.)
  3 +
  // (Tiers: how closely they are followed, and how far into their stride their needs are reckoned.)
  2 +
  // (The tissue a wound reached.)
  1 +
  // (P3: their mother and father.)
  4 +
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
    thought: new Uint32Array(cap * THOUGHTS),
    hours: new Uint16Array(cap * SKILL_KINDS.length),
    taught: new Uint8Array(cap),
    tie: new Uint32Array(cap * TIES),
    regard: new Int8Array(cap * TIES),
    bleed: new Uint8Array(cap),
    blood: new Uint8Array(cap),
    fester: new Uint8Array(cap),
    tier: new Uint8Array(cap),
    reck: new Uint8Array(cap),
    tissue: new Uint8Array(cap),
    mother: new Uint32Array(cap),
    father: new Uint32Array(cap),
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
  "thought",
  "hours",
  "taught",
  "tie",
  "regard",
  "bleed",
  "blood",
  "fester",
  "tier",
  "reck",
  "tissue",
  "mother",
  "father",
] as const;
type Col = (typeof PEOPLE_COLS)[number];
const widthOf = (c: Col) =>
  c === "needs"
    ? NEEDS
    : c === "thought"
      ? THOUGHTS
      : c === "hours"
        ? SKILL_KINDS.length
        : c === "tie" || c === "regard"
          ? TIES
          : 1;

/**
 * Room for more in the same people: each column made longer, the object itself kept. (Made anew, whatever held the place's
 * people across a coming or a birth read on in the old columns, which no longer moved: tests that held them saw a town
 * stand still from the day it outgrew its room, and passed or failed by whether its world's town grew that far.)
 */
function grown(p: People, cap: number): People {
  const q = peopleOf(cap);
  for (const c of PEOPLE_COLS) {
    (q[c] as Uint8Array).set((p[c] as Uint8Array).subarray(0, p.n * widthOf(c)));
    (p as Record<Col, unknown>)[c] = q[c];
  }
  return p;
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
  /** Of that care, the share brought by remedies in hand (rules/healing.ts REMEDY_PRINCIPLES; absent: none). */
  remedies?: number;
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
  /** Done by its head's order, not the player's (a town stewarded: host/steward.ts). */
  o?: number;
};

/**
 * What a town's head keeps while it stewards (host/steward.ts): the number of its last order; what it set each matter to
 * ("respond:firebreaks", "site:3", "prio:412", "shelter"), as the town's orders would say it; the last handed over; the matters it leaves to
 * the player, who has spoken for them; and its orders decided and not yet seen standing, numbered, with when.
 */
export type Steward = {
  n: number;
  /** The last of them handed to the page (each is handed over once: kept, so a save goes on as it would have). */
  handed?: number;
  did: Record<string, string>;
  let: string[];
  orders: {
    n: number;
    t: number;
    type: string;
    args: Record<string, unknown>;
    key: string;
    why: string;
  }[];
};

/**
 * What a place reads of its steward (host/steward.ts), set where that is loaded: its head's look, on every tick of a town
 * stewarded; its head's lines told; and whether a matter stands as its head set it. Absent: no town is stewarded.
 */
export const PLACE_HOOKS: {
  look: ((world: World, place: Place) => void) | null;
  told: ((place: Place, x: PlaceHap) => string) | null;
  heads: ((place: Place, key: string) => boolean) | null;
} = { look: null, told: null, heads: null };

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
  /**
   * How it is run while it is entered (bridge/placemodes.ts PLACE_MODES: 0 or absent by hand, 1 watched, 2 by its own
   * head). Kept here, out of the world's hash: choosing a way moves nothing of history.
   */
  mode?: number;
  /** Its head's memory while it stewards (host/steward.ts; absent: never stewarded). */
  steward?: Steward;
  /**
   * Its healer (N9), where its land knows herb-lore: one of its people by number (the grown with most hours at healing),
   * the remedies they have gathered and not used (doses), and whom they have seen of the festering today ([day, ...their
   * numbers]). Absent: none chosen yet, none gathered, none seen.
   */
  healer?: number;
  herbs?: number;
  tended?: number[];
  /**
   * N11. Those broken down now, three numbers each: who (their number), how (BREAK's), and till when (seconds). Those its
   * justice holds, three each: who, till when, and how (VERDICT's: held, or at labour). Its works, seven each: the lot it
   * is at, when it was made (seconds), its maker (their number), what it shows (a happening of its log: what, whom, when,
   * in days), and how fine it is (WORK_QUALITY's). Absent: none.
   */
  breaks?: number[];
  held?: number[];
  works?: number[];
  /** P8. Its works made in a strange mood, two numbers each: when it was made (seconds) and its maker (their number). */
  arts?: number[];
  /**
   * R1. Its dead remembered: the last MOURN_KEPT of those who died of it, MOURN_STRIDE numbers each, as they stood at their
   * death (placeMourned). Absent: none died since it was kept so.
   */
  mourned?: number[];
  /** P2. Those come to its gate, a line each: what (GATE_KINDS'), from where, and why, and the event behind it. Absent: none. */
  gates?: string[];
  /**
   * Those followed in full by the player's word (tiers), two numbers each: who (their number), and till when (seconds;
   * -1: till it is unsaid). Absent: none.
   */
  pins?: number[];
  /**
   * What only those followed in full keep (asked 2026-11-26: "deeper full-tier state"), by their number: what they
   * remember, every one of it with whom or what it came of (DEEP_THOUGHTS of it). Filled from what they were (their
   * column's memories, their household, their ties and the place's log) when they come into full, and let go of to their
   * columns when they leave it. Absent: none in full yet.
   */
  deep?: Map<number, Deep>;
  /**
   * What it has lived of its own this year (vitalDay): its year, and how many were born and died so of it. Its town's count
   * is that year's turn's: its people are the count with these, and with what waits. Absent: none yet.
   */
  vital?: number[];
};

/**
 * What waits in a place's `due`: a death, a leaving, a birth, a coming, a burial, a pairing; and a birth to one who bears
 * (vitalDay: `a` her number, `b` the child's sex).
 */
export const DUE = { die: 1, leave: 2, born: 3, come: 4, bury: 5, pair: 6, bear: 7 } as const;
/** A death due that a year's turn brought (a bit of its `b`): of the year gone's count. */
const DUE_GONE = 1 << 16;
/** A death due of the place's own (vitalDay; a bit of its `b`): lived, it is of its year's `vital`. */
const DUE_OWN = 1 << 17;
/** One more born (0) or dead (1) of a place's own this year. */
function vitalCount(place: Place, k: 0 | 1): void {
  const year = Math.floor(place.t / YEAR);
  if (!place.vital || place.vital[0] !== year) place.vital = [year, 0, 0];
  place.vital[1 + k]!++;
}
/** What a place has lived of its own this year (vitalDay): born and dead. */
export function placeOwn(place: Place): { born: number; died: number } {
  const v = place.vital;
  return v && v[0] === Math.floor(place.t / YEAR)
    ? { born: v[1]!, died: v[2]! }
    : { born: 0, died: 0 };
}
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

/**
 * P5. What a town's clothes keep off of the cold out of doors (0 … 0.6): its land's cloth (host/chain.ts landCloth: wool,
 * a beast's hair or down, else a plant's fibre), as fine as its middling hands make a garment (gearMid), worn by all. Est.:
 * a woollen coat keeps off half the cold a body's skin would feel, a plant's weave a quarter; read once a year a place.
 */
const CLOTH_KEEPS: readonly (readonly [RegExp, number])[] = [
  [/woollen/, 0.5],
  [/-down/, 0.55],
  [/-hair/, 0.45],
];
const DRESSED = new WeakMap<Place, { year: number; w: number }>();
export function dressWarmth(world: World, place: Place): number {
  const year = Math.floor(place.t / YEAR),
    was = DRESSED.get(place);
  if (was && was.year === year) return was.w;
  const s = stuffsOf(world, place),
    keeps = CLOTH_KEEPS.find(([re]) => re.test(s.cloth))?.[1] ?? 0.25,
    w = Math.max(
      0,
      Math.min(0.6, keeps * Math.max(0.5, Math.min(1.2, gearMid(s, GEAR.garment) / 60))),
    );
  DRESSED.set(place, { year, w });
  return w;
}
/**
 * P5. What each building's walls let in of the cold out of doors, where no fire is kept in it (its lot to the share; a lot
 * not listed lets in none: a home, warmed at its hearth, or a building whose work keeps a fire). Est.: walls without a fire
 * keep out seven tenths of it. Read again when its buildings change.
 */
const ROOM_LETS = 0.3;
const HEARTHS: ReadonlySet<string> = new Set([
  "smithy",
  "kiln",
  "baths",
  "factory",
  "power",
  "hospital",
  "vats",
]);
const LETS = new WeakMap<Place, { n: number; lot: number; lets: Map<number, number> }>();
function roomLets(place: Place): Map<number, number> {
  const b = place.bldgs,
    was = LETS.get(place);
  if (was && was.n === b.lot.length && was.lot === (b.lot[b.lot.length - 1] ?? -1)) return was.lets;
  const lets = new Map<number, number>();
  for (let k = 0; k < b.lot.length; k++)
    if (!HEARTHS.has(kindName(b.kind[k]!))) lets.set(b.lot[k]!, ROOM_LETS);
  LETS.set(place, { n: b.lot.length, lot: b.lot[b.lot.length - 1] ?? -1, lets });
  return lets;
}
/** What a building's walls let in of the cold out of doors (P5; 0: none, a home or one with a fire in it). */
export const placeRoomLets = (place: Place, lot: number): number => roomLets(place).get(lot) ?? 0;

/** How far the cold bites one out of doors, 0 … 1: by the air now and their coat (rules/dress.ts warmthNeeded's measure). */
const coldOf = (f: Frame, warmth: number): number =>
  f.water ? 0 : Math.max(0, Math.min(1, (DRESS.comfort - warmth) / DRESS.span)) * f.coat;

/** How far the cold bites one of a place's people out of doors now, 0 … 1 (its land's air at its clock, their coat). */
export function placeCold(world: World, place: Place): number {
  const f = frameOf(world, place.cell);
  return coldOf(f, airOf(f, place.t).warmth);
}
/** A place's season (the share of its year gone from midwinter, its own hemisphere's) and its air's warmth now: read only. */
export function placeAir(world: World, place: Place): { season: number; warmth: number } {
  const f = frameOf(world, place.cell);
  return { season: clockOf(f, place.t).season, warmth: airOf(f, place.t).warmth };
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
function careOf(
  world: World,
  cell: number,
  year: number,
): { care: number; healer: boolean; remedies: number } {
  const lore = loreOf(world),
    known = (id: string) => (lore.get(cell, id)?.year ?? Infinity) <= year,
    care = woundCare(known);
  let remedies = 0;
  for (const [id, weight] of CARE_PRINCIPLES)
    if (REMEDY_PRINCIPLES.has(id) && known(id)) remedies += weight;
  return { care, healer: known("herbalism"), remedies: Math.min(care, remedies) };
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
        ...(p.deep?.size ? { deep: deepSaved(p.deep) } : {}),
        ...readingsSaved(p),
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
        ...(p.mode ? { mode: p.mode } : {}),
        ...(p.steward ? { steward: p.steward } : {}),
        ...(p.healer ? { healer: p.healer } : {}),
        ...(p.herbs ? { herbs: p.herbs } : {}),
        ...(p.tended?.length ? { tended: p.tended } : {}),
        ...(p.breaks?.length ? { breaks: p.breaks } : {}),
        ...(p.held?.length ? { held: p.held } : {}),
        ...(p.works?.length ? { works: p.works } : {}),
        ...(p.gates?.length ? { gates: p.gates } : {}),
        ...(p.arts?.length ? { arts: p.arts } : {}),
        ...(p.mourned?.length ? { mourned: p.mourned } : {}),
        ...(p.pins?.length ? { pins: p.pins } : {}),
        ...(p.vital ? { vital: p.vital } : {}),
        ...(UNPAIRED.has(p) ? { unpaired: true } : {}),
        // (Read from a save kept before skill was, and not brought on since: still to be reckoned.)
        ...(UNSKILLED.has(p) ? { unskilled: true } : {}),
        ...(UNTAUGHT.has(p) ? { untaught: true } : {}),
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
        ...(raw.mode ? { mode: raw.mode as number } : {}),
        ...(raw.steward ? { steward: structuredClone(raw.steward as Steward) } : {}),
        ...(raw.healer ? { healer: raw.healer as number } : {}),
        ...(raw.herbs ? { herbs: raw.herbs as number } : {}),
        ...(raw.tended ? { tended: [...(raw.tended as number[])] } : {}),
        ...(raw.breaks ? { breaks: [...(raw.breaks as number[])] } : {}),
        ...(raw.held ? { held: [...(raw.held as number[])] } : {}),
        ...(raw.works ? { works: [...(raw.works as number[])] } : {}),
        ...(raw.gates ? { gates: [...(raw.gates as string[])] } : {}),
        ...(raw.arts ? { arts: [...(raw.arts as number[])] } : {}),
        ...(raw.mourned ? { mourned: [...(raw.mourned as number[])] } : {}),
        ...(raw.pins ? { pins: [...(raw.pins as number[])] } : {}),
        ...(raw.vital ? { vital: [...(raw.vital as number[])] } : {}),
        ...(raw.deep
          ? { deep: deepLoaded(raw.deep as { n: number[]; stuffs: string[]; ops?: number[] }) }
          : {}),
      });
      readingsLoaded(this.places.at(-1)!, raw);
      if (unskilled) UNSKILLED.add(this.places.at(-1)!);
      if (!cols.taught || raw.untaught === true) UNTAUGHT.add(this.places.at(-1)!);
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
    // (Tiers all full, as a place kept before them reads: hashed as one kept before them was, so the two are told alike.)
    // (So with parents, P3: a place kept before them, or with no one born since, is told as it was.)
    if (
      (c === "tier" || c === "reck" || c === "mother" || c === "father") &&
      !a.subarray(0, p.people.n).some((x) => x)
    )
      continue;
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
  // (What only those in full keep: hashed only where any is kept, so a place kept before it is told as it was.)
  if (p.deep?.size) {
    const d = deepSaved(p.deep);
    for (const x of d.n) h.int(x);
    for (const x of d.stuffs) h.string(x);
    for (const x of d.ops) h.int(x);
  }
  for (const x of p.houses.means) h.float(x);
  for (const x of [...p.matched.made, ...p.matched.wage]) h.float(x);
  for (const x of p.log)
    h.int(x.t)
      .int(x.what)
      .int(x.id)
      .int(x.a)
      .int(x.b)
      .int(x.k ?? 0)
      .int(x.s ?? 0)
      .int(x.o ?? 0);
  h.int(p.healer ?? 0).int(p.herbs ?? 0);
  for (const x of p.tended ?? []) h.int(x);
  h.int(p.breaks?.length ?? 0)
    .int(p.held?.length ?? 0)
    .int(p.works?.length ?? 0);
  for (const x of p.breaks ?? []) h.int(x);
  for (const x of p.held ?? []) h.int(x);
  for (const x of p.works ?? []) h.int(x);
  // (Its works of a strange mood: hashed only where any was made, so a place kept before them is told as it was.)
  if (p.arts?.length) {
    h.int(p.arts.length);
    for (const x of p.arts) h.int(x);
  }
  // (Its dead remembered: hashed only where any is, so a place kept before them is told as it was.)
  if (p.mourned?.length) {
    h.int(p.mourned.length);
    for (const x of p.mourned) h.int(x);
  }
  // (Those come to its gate: hashed only where any came, so a place kept before them is told as it was.)
  if (p.gates?.length) {
    h.int(p.gates.length);
    for (const x of p.gates) h.int(hashString(x));
  }
  // (Those followed by word: hashed only where there are any, so a place kept before tiers is told as it was.)
  if (p.pins?.length) {
    h.int(p.pins.length);
    for (const x of p.pins) h.int(x);
  }
  if (p.vital) for (const x of p.vital) h.int(x);
  h.string(p.ordered)
    .string(p.sited)
    .string(p.plague)
    .int(p.mode ?? 0)
    .string(p.steward ? JSON.stringify(p.steward) : "");
  p.figRef.forEach((ref, k) => h.string(ref).int(p.figId[k]!));
  return h.hex();
}

// —— Reading a place —————————————————————————————————————————————————————————————————————————————————————————————

const sexOf = (p: People, i: number) => p.sexOcc[i]! >> 4;
const occOf = (p: People, i: number) => p.sexOcc[i]! & 15;
const ageOf = (p: People, i: number, t: number) => (t / DAY - p.born[i]!) / 365;

/** The ticks one has given to a kind of work (SKILL_KINDS' place): their own trade's are `skill`'s, the rest `hours`'. */
export function hoursAt(p: People, i: number, kind: number): number {
  return kind === tradeKind(occOf(p, i)) ? p.skill[i]! : p.hours[i * KINDS_N + kind]!;
}
/**
 * One put to another trade (or come of age into one): the hours of the trade they leave kept with its kind of work, and
 * those they have at the new one taken up as their skill at it. One who comes of age into the work their household taught
 * them comes to it with what it taught (TAUGHT_TICKS).
 */
function retrade(place: Place, i: number, to: number): void {
  const p = place.people,
    from = occOf(p, i),
    at = i * KINDS_N;
  if (from === to) return;
  if (from !== OCC.dependent) p.hours[at + tradeKind(from)] = p.skill[i]!;
  p.sexOcc[i] = (sexOf(p, i) << 4) | to;
  if (from === OCC.dependent && to !== OCC.dependent) {
    // (Of age: what their household taught them, kept as the kind it is.)
    const k = houseKind(place, i);
    if (k >= 0) {
      p.taught[i] = k + 1;
      p.hours[at + k] = Math.max(p.hours[at + k]!, TAUGHT_TICKS);
    }
  }
  p.skill[i] = to === OCC.dependent ? 0 : p.hours[at + tradeKind(to)]!;
  if (to !== OCC.dependent) p.hours[at + tradeKind(to)] = 0;
}
/**
 * One grown, come to the place or found in it as it is entered: the work their household keeps taken as what it taught
 * them, its hours with it (where they have fewer).
 */
function teach(place: Place, i: number): void {
  const p = place.people,
    k = houseKind(place, i);
  if (occOf(p, i) === OCC.dependent || k < 0) return;
  p.taught[i] = k + 1;
  if (k === tradeKind(occOf(p, i))) p.skill[i] = Math.max(p.skill[i]!, TAUGHT_TICKS);
  else p.hours[i * KINDS_N + k] = Math.max(p.hours[i * KINDS_N + k]!, TAUGHT_TICKS);
}
/**
 * The hours a household teaches its young of the work it keeps before they are grown (rules/life.ts LIFE_WANTS.teach:
 * two hundred, when grown they take up that work), in ticks.
 */
const TAUGHT_TICKS = LIFE_WANTS.teach.goal * 6;
/**
 * The kind of work a household keeps: the trade most of its grown (themselves left out) hold, the eldest's where as many
 * hold two (-1: none of its grown keeps a trade).
 */
function houseKind(place: Place, i: number): number {
  const p = place.people,
    h = p.house[i]!,
    held = new Array<number>(OCCUPATIONS.length).fill(0),
    eldest = new Array<number>(OCCUPATIONS.length).fill(Infinity);
  for (let j = 0; j < p.n; j++) {
    if (j === i || p.house[j] !== h) continue;
    const o = occOf(p, j);
    if (o === OCC.dependent) continue;
    held[o]!++;
    eldest[o] = Math.min(eldest[o]!, p.born[j]!);
  }
  let best = -1;
  for (let o = 1; o < held.length; o++)
    if (
      held[o]! > 0 &&
      (best < 0 || held[o]! > held[best]! || (held[o] === held[best] && eldest[o]! < eldest[best]!))
    )
      best = o;
  return best < 0 ? -1 : tradeKind(best);
}

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

/** How many fields a place's plan lays (O6: its fields' page reads who is on which by it; 0: its plan not read). */
export function placeFieldCount(world: World, place: Place): number {
  layLots(world, place);
  return LAID.get(place)?.fieldX.length ?? 0;
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
      plan,
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
  p.thought.fill(0, i * THOUGHTS, (i + 1) * THOUGHTS);
  p.hours.fill(0, i * KINDS_N, (i + 1) * KINDS_N);
  p.taught[i] = 0;
  p.tie.fill(0, i * TIES, (i + 1) * TIES);
  p.regard.fill(0, i * TIES, (i + 1) * TIES);
  // (A wound's bleeding, the blood lost and its festering, and their tier: none. The slot is the one the last of the
  // place's people was moved out of when another was let go, and kept what they had: a child born bleeding of another's
  // wound, or raised into full with another's ticks of work already done.)
  p.bleed[i] =
    p.blood[i] =
    p.fester[i] =
    p.tier[i] =
    p.reck[i] =
    p.tissue[i] =
    p.mother[i] =
    p.father[i] =
      0;
  place.houses.members[house]!++;
  return i;
}

function removePerson(place: Place, i: number): void {
  const p = place.people,
    last = p.n - 1;
  place.deep?.delete(p.id[i]!);
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
export function homesFor(
  world: World,
  town: Ref,
  people: number,
): { lot: number[]; holds: number[] } {
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
function makingLot(place: Place, i: number, craft = place.people.craft[i]!): number {
  const p = place.people,
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
  /** The year a death is counted to (its land's count's): the year it is told in, but for one a year's turn brought. */
  year = Math.floor(place.t / YEAR),
): void {
  const p = place.people;
  if (HAP_DEATH.has(what))
    counted(
      place,
      what,
      what === HAP.struckDead || what === HAP.fell || what === HAP.plague ? a : 0,
      1,
      year,
    );
  remembered(place, what, id, a, b, gone);
  if (HAP_DEATH.has(what)) mourn(place, gone >= 0 ? gone : placeIndexOf(place, id), what, a);
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

/** A line of a place's log, for what tells it from outside (host/steward.ts). */
export const placeNote = (place: Place, what: number, id: number, a = 0, b = 0): void =>
  note(place, what, id, a, b);
/** A line just told marked as done by its head's order, where the matter stands as its head set it. */
function byHead(place: Place, key: string): void {
  const x = place.log.at(-1);
  if (x && PLACE_HOOKS.heads?.(place, key)) x.o = 1;
}
/** A head's own draw for a matter (host/steward.ts): the same on every day. */
export const stewardDraw = (world: World, place: Place, id: number, k: number): number =>
  world.rng.unit(PLACE_DRAW, place.key ^ id, 0, P.steward, k);

/** So many more counted of a kind (place.counts), this year; those of before last year let go. */
function counted(
  place: Place,
  what: number,
  of: number,
  n: number,
  year = Math.floor(place.t / YEAR),
): void {
  const c = place.counts,
    now = Math.floor(place.t / YEAR);
  for (let k = c.length - 4; k >= 0; k -= 4) if (c[k]! < now - 1) c.splice(k, 4);
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
  /**
   * Whether each sex and band is held to the place's own (a month's turn while it is watched): it lives its births and
   * deaths day by day (vitalDay), so a month's turn only moves its people between trades. Its town's count is reckoned
   * once a year; its land's month moves the shape of it, and that shape brought its land's births again on a month's
   * turn, and told its old as gone where they had died.
   */
  hold = false,
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
    else if (what === DUE.bear) {
      if (placeIndexOf(place, place.due[k + 2]!) >= 0)
        now[place.due[k + 3]! * BANDS * OCCS + OCC.dependent]!++;
    } else if (what === DUE.die || what === DUE.leave) {
      const i = placeIndexOf(place, place.due[k + 2]!);
      if (i < 0) continue;
      now[cellOf(i)]!--;
      waiting.add(p().id[i]!);
    }
  }
  if (hold)
    for (let r = 0; r < ROWS; r++) {
      let want = 0,
        of = 0;
      for (let o = 0; o < OCCS; o++) {
        want += Math.max(0, now[r * OCCS + o]!);
        of += target[r * OCCS + o]!;
      }
      // (So many of each as the place has, shared among the trades as its town's count shares them; a band its town's
      // count has none of, as the place has them.)
      const split =
        of > 0
          ? apportion(want, target.slice(r * OCCS, (r + 1) * OCCS))
          : now.slice(r * OCCS, (r + 1) * OCCS).map((x) => Math.max(0, x));
      for (let o = 0; o < OCCS; o++) target[r * OCCS + o] = split[o]!;
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
          // (Counted, when told, to the year gone whose count brought it: DUE_GONE.)
          dueIn(world, place, spread, id, DUE.die, id, what | (of << 8) | DUE_GONE);
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
          retrade(place, i, to);
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
      teach(place, i);
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
export const graveLot = (place: Place): number =>
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
        const told = b & 255,
          // (One a year's turn brought is of the year gone's count: told now, counted to it, so the next turn's quota
          // does not take them off what it brings. Counted to the year told in, every other year's turn brought a year's
          // dead and the next almost none.)
          year = Math.floor(place.t / YEAR) - (b & DUE_GONE ? 1 : 0);
        if (told === HAP.plague) note(place, HAP.plague, a, (b >> 8) & 255, age, i, year);
        else if (told === HAP.famine) note(place, HAP.famine, a, age, 0, i, year);
        else note(place, HAP.died, a, age, occOf(p, i), i, year);
        if (b & DUE_OWN) vitalCount(place, 1);
        place.houses.grief[h] = day;
        // (Buried the next morning, two hours before the middle of the day.)
        if (!all) dueAt(place, (day + 1) * DAY + 10 * HOUR, DUE.bury, a, h * 2 + sexOf(p, i));
      }
      removePerson(place, i);
      changed = true;
    } else if (what === DUE.come && gateShut(world, place)) {
      // (Its gate shut to newcomers by order, P2: one who would have come to live in it goes on to another of its land's
      // towns; the town is short of them till it opens, when its land's count brings them again.)
      turnedAway(place);
      continue;
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
        mother = 0,
        father = 0;
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
          // (Of her and the one she is paired with: P3.)
          father = p.mate[m] && p.mate[m] !== PROMISED ? p.mate[m]! : 0;
        }
      }
      if (house < 0) house = houseFor(world, place, id, f, homesFor(world, place.town, p.n + 1));
      const i = addPerson(place, sex, occ, Math.floor(place.t / DAY - age * 365), house);
      place.people.mother[i] = mother;
      place.people.father[i] = father;
      place.people.skill[i] = skillAt(f, age, occ);
      teach(place, i);
      workOf(world, place, i);
      note(
        place,
        what === DUE.born ? HAP.born : HAP.came,
        id,
        what === DUE.born ? mother : Math.round(age),
        occ,
      );
      changed = true;
    } else if (what === DUE.bear) {
      // (Born to her, into her household: vitalDay.)
      const m = placeIndexOf(place, a);
      if (m < 0) continue;
      const id = place.nextId,
        i = addPerson(place, b, OCC.dependent, Math.floor(place.t / DAY), p.house[m]!);
      // (Hers, and the one she is paired with: P3.)
      p.mother[i] = a;
      p.father[i] = p.mate[m] && p.mate[m] !== PROMISED ? p.mate[m]! : 0;
      place.people.skill[i] = skillAt(f, 0, OCC.dependent);
      teach(place, i);
      workOf(world, place, i);
      note(place, HAP.born, id, a, OCC.dependent);
      vitalCount(place, 0);
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
      reason(place, i, j, REASON.wed, 12);
      reason(place, j, i, REASON.wed, 12);
      changed = true;
    }
  }
  if (changed) reckonMeans(world, place);
}

/** The better part of a year a young is carried (rules/children.ts BEARING: carried so, and nursed two more). */
const CARRIED = Math.round(0.75 * YEAR);
/**
 * A day's births and deaths in a place watched (asked 2026-11-26: a town of 5,492 told none in a month, and in the year
 * after it was entered one dead a month where its land's count has a dozen). Its town's count is reckoned once a year,
 * and a year's turn brought the year gone's to be lived over the year to come: a town entered after a turn lived next to
 * none of its own year, and its dead were told as having left. Now each of its people dies on a day by their band's
 * share of its land's dead in the year gone (its land's own count, as a year's turn reads it: rules of no new number),
 * and each who bears gives birth by her band's share of its land's births that year, the more the more her band bears
 * (its life table's fertility), into her own household; a child a girl by its land's own youngest. What it lives so is
 * counted against what the next year's turn brings: the dead told this year come off its quota, and a band's newborn come
 * short by as many as were born; between two turns a month's matching holds each band to the place's own (matchPeople
 * `hold`), so nothing is brought twice. Each by a draw keyed on who they are and the day, the same in every tier.
 */
function vitalDay(world: World, place: Place, f: Frame): void {
  const ctx = populationContext(world),
    land = ctx.provinces.get(place.cell),
    p = place.people;
  if (!land || p.n === 0) return;
  const year = Math.floor(place.t / YEAR) - 1,
    life = f.life,
    dies = new Float64Array(BANDS),
    bears = new Float64Array(BANDS);
  let weight = 0,
    young = 0;
  for (let b = 0; b < BANDS; b++) {
    let alive = 0;
    for (let sex = 0; sex < SEXES; sex++) alive += land.counts.rowSum(sex * BANDS + b);
    const dead = ctx.history.deathsIn(place.cell, year, b);
    dies[b] = alive + dead > 0 ? dead / (alive + dead) / 365 : 0;
    weight += land.counts.rowSum(FEMALE * BANDS + b) * (life.fertility[b] ?? 0);
  }
  const births = ctx.history.birthsIn(place.cell, year);
  for (let b = 0; b < BANDS; b++)
    bears[b] = weight > 0 ? (births * (life.fertility[b] ?? 0)) / weight / 365 : 0;
  for (let sex = 0; sex < SEXES; sex++) young += land.counts.rowSum(sex * BANDS);
  const girl = young > 0 ? land.counts.rowSum(FEMALE * BANDS) / young : 0.5;
  // (One due to die or to leave already is not drawn again.)
  let due: Set<number> | null = null;
  for (let k = 0; k < place.due.length; k += 4)
    if (place.due[k + 1] === DUE.die || place.due[k + 1] === DUE.leave)
      (due ??= new Set()).add(place.due[k + 2]!);
  // (One who has borne a child within the better part of a year carries none yet: rules/children.ts BEARING.)
  const bore = new Set<number>();
  for (const x of place.log)
    if (x.what === HAP.born && x.a && x.t > place.t - CARRIED) bore.add(x.a);
  const dead: number[] = [],
    mothers: number[] = [];
  for (let i = 0; i < p.n; i++) {
    const id = p.id[i]!;
    if (due?.has(id)) continue;
    const band = bandOf(ageOf(p, i, place.t), life);
    if (
      dies[band]! > 0 &&
      world.rng.unit(PLACE_DRAW, place.key ^ id, place.t, P.vital, 0) < dies[band]!
    )
      dead.push(id);
    else if (
      sexOf(p, i) === FEMALE &&
      bears[band]! > 0 &&
      !bore.has(id) &&
      world.rng.unit(PLACE_DRAW, place.key ^ id, place.t, P.vital, 1) < bears[band]!
    )
      mothers.push(id);
  }
  // (Each on a tick of the day by a draw, lived as what waits is (liveDue): a death told as one in their time, their
  // household grieving and their burial the next morning; a birth into her household.)
  const at = (id: number, k: number) =>
    place.t +
    Math.floor(
      world.rng.unit(PLACE_DRAW, place.key ^ id, place.t, P.vital, k) * (DAY / PLACE_TICK),
    ) *
      PLACE_TICK;
  for (const id of mothers)
    dueAt(
      place,
      at(id, 3),
      DUE.bear,
      id,
      world.rng.unit(PLACE_DRAW, place.key ^ id, place.t, P.vital, 2) < girl ? FEMALE : 1 - FEMALE,
    );
  for (const id of dead) dueAt(place, at(id, 4), DUE.die, id, HAP.died | DUE_OWN);
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
    // (Watched between two years' turns: its births and deaths are its own, lived day by day.)
    watched && !turned,
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
    // (The tissue it reached, by the draw it bleeds by: the deeper, the harder. rules/tissues.ts.)
    tissue = tissueOf(blow, member, r(3)),
    days = healDays(outcome, member, blow, care, tendedOf(place, i));
  p.health[i] = 1;
  p.tissue[i] = TISSUES.indexOf(tissue) + 1;
  // (What it was of, and the member it was to, eight times over: bound while it mends, that member does none of its share.)
  p.cause[i] = cause | ((MEMBERS.indexOf(member) + 1) << 3);
  p.ill[i] = Math.max(1, Math.round(days.abed * tissueMends(blow, member, tissue))) * 144;
  // (It bleeds as hard as the blow opened it, and is neither dressed nor yet seen to fester or not: N9. A wound brought
  // home from a battle was dressed on the field, and bled there.)
  p.bleed[i] =
    cause === CAUSE.battle
      ? 0
      : Math.min(BLOOD_UNITS, Math.round(bleedOf(blow, r(3)) * BLOOD_UNITS));
  p.fester[i] = cause === CAUSE.battle ? FESTER_DRESSED : 0;
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
    else if (what === DUE.bear) {
      if (placeIndexOf(place, place.due[k + 2]!) >= 0) n++;
    } else if (
      (what === DUE.die || what === DUE.leave) &&
      placeIndexOf(place, place.due[k + 2]!) >= 0
    )
      n--;
  }
  return n;
}
/** What waits for a place to live it (its `due`), as tests and tools read it: when, and what. */
export function placeDue(place: Place): { t: number; what: string; a: number; b: number }[] {
  const names = ["", "die", "leave", "born", "come", "bury", "pair", "bear"],
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
    b0 = bound && bound !== lame ? limbShare(bound, f.legs, f.arms) : { going: 0, handling: 0 },
    // (A member bound while it mends does none of its share where its bone was broken, a little where only its skin was
    // cut: rules/tissues.ts. One dealt before tissues were, all of it.)
    t = tissueAt(p, i),
    by = bound && t ? tissueTakes(t) : 1,
    b = { going: b0.going * by, handling: b0.handling * by };
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
    orders = managedOf(world)?.get(place.town),
    key = `${lot}|${place.fire[1]}|${watch}|${p.n}|${place.nextId}|${orders?.prio?.join(",") ?? ""}`,
    was = FIRE_CREWS.get(place);
  if (was && was.key === key) return was.ids;
  // (Their priority at a fire, where any are set for them: one set never to fight one does not go; a watch is kept by
  // those set to it first, by how high.)
  const prios = prioMap(orders),
    FIRE = PRIO_KINDS.indexOf("fire"),
    atFire = (i: number): number => {
      const packed = prios?.get(p.id[i]!);
      return packed === undefined ? PRIO_FIRE_OWN : prioOf(packed)[FIRE]!;
    };
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
    if (prios && atFire(i) === 0) continue;
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
    hands.sort(
      (a, b) =>
        (prios ? atFire(b) - atFire(a) : 0) || draw.get(a)! - draw.get(b)! || p.id[a]! - p.id[b]!,
    );
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
    byHead(place, "respond:muster");
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
        return packed === undefined ? 1 : prioOf(packed)[PRIO_KINDS.indexOf("building")]!;
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
      const site = place.sites.find((x) => x.lot === lot);
      if (site) byHead(place, `site:${site.n}`);
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
  homesByFit(place, homes);
  linkRoster(world, place, s, f);
  pairHouses(place, f);
  // (Each one's skill, by the years they have had at their trade since they were grown, at the age they are now.)
  for (let i = 0; i < place.people.n; i++)
    place.people.skill[i] = skillAt(f, ageOf(place.people, i, t), occOf(place.people, i));
  for (let i = 0; i < place.people.n; i++) teach(place, i);
  reckonMeans(world, place);
  bringOf(world, place);
  stockOut(place, f, stockShare(world, s.cell, n));
  layLots(world, place);
  syncSites(world, place, f);
  armsCrew(world, place, f);
  // (Whom each knows, and what they think of them, from the years they have met before it was entered: a few weeks'
  // meetings' worth, no words or blows among them told.)
  meetDay(world, place, SEEN_BEFORE);
  // (Two paired who could not abide each other had parted before it was entered: none told, Q2.)
  {
    const p = place.people,
      today = Math.floor(place.t / DAY);
    for (let i = 0; i < p.n; i++) {
      const m = p.mate[i] && p.mate[i] !== PROMISED ? placeIndexOf(place, p.mate[i]!) : -1;
      if (
        m > i &&
        p.mate[m] === p.id[i] &&
        opinionNow(place, i, m, today) <= PART_AT &&
        opinionNow(place, m, i, today) <= PART_AT
      )
        p.mate[i] = p.mate[m] = 0;
    }
  }
  // Its day under way before it is seen; then its stocks are the world's again, to the last millionth.
  while (place.t < t) tick(world, place, f);
  matchStocks(place, stockShare(world, s.cell, place.people.n), f);
  unworked(place);
  place.log.length = 0;
  place.counts.length = 0;
  return place;
}

/**
 * Its households in its homes as they fit, once its people are dealt among them: the largest first, each into the home
 * with the most beds still free (the lowest lot of those as free). Dealt by their place among all the beds alone, a home
 * of six could take two households of eleven while the next held two, in a town with a bed for each; so a town crowds only
 * where it has fewer beds than people. One whose work or whereabouts was their household's home goes with it.
 */
function homesByFit(place: Place, homes: { lot: number[]; holds: number[] }): void {
  const h = place.houses,
    p = place.people,
    k = homes.lot.length;
  if (!k) return;
  const free = homes.holds.slice(),
    was = Array.from(h.home),
    order = Array.from({ length: h.n }, (_, x) => x).sort(
      (a, b) => h.members[b]! - h.members[a]! || a - b,
    );
  for (const x of order) {
    let best = 0;
    for (let q = 1; q < k; q++) if (free[q]! > free[best]!) best = q;
    free[best]! -= h.members[x]!;
    h.home[x] = homes.lot[best]!;
  }
  for (let i = 0; i < p.n; i++) {
    const x = p.house[i]!,
      old = was[x]!,
      now = h.home[x]!;
    if (old === now) continue;
    if (p.work[i] === old) p.work[i] = now;
    if (p.at[i] === old) p.at[i] = now;
    if (p.to[i] === old) p.to[i] = now;
  }
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
 * How fit one's body is now for a kind of work (0 … 1): the share of their handling a wound bound, or an arm or a hand left
 * stiff, takes (woundTakes, rules/anatomy.ts limbShare), of any work but leading, which is words. What it takes of their
 * going is in their walk (gaitOf), slower to wherever the work is, and is not counted again here.
 */
function fitFor(world: World, place: Place, i: number, kind: number): number {
  return kind === SK.leading ? 1 : Math.max(0, 1 - woundTakes(world, place, i).handling);
}
/** One's hours, level, fitness and passion at a kind of work. */
export type PlaceSkillAt = {
  /** Hours given to it, and the level they make (rules/life.ts levelOf) and in a word. */
  readonly hours: number;
  readonly level: number;
  readonly words: string;
  /** How fit their body is for it now, 0 … 1 (1: whole; less by what a wound or a lamed limb takes of what it is done with). */
  readonly fit: number;
  /** Whether it is the work their household taught them. */
  readonly passion: boolean;
};
/** One's skill at every kind of work (SKILL_KINDS' order): the hours, what their body is fit for, what they were taught. */
export function placeSkills(world: World, place: Place, i: number): PlaceSkillAt[] {
  const p = place.people,
    marked = p.mark[i]! >> 4 === 2 || p.health[i] === 3;
  return SKILL_KINDS.map((_, k) => {
    const hours = Math.floor(hoursAt(p, i, k) / 6),
      level = levelOf(hours);
    return {
      hours,
      level,
      words: SKILL_WORDS[level] ?? "",
      fit: marked ? fitFor(world, place, i, k) : 1,
      passion: p.taught[i] === k + 1,
    };
  });
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
/** Places read from a save kept before pairings were: their households' pairs are read when the place is next brought on. */
const UNPAIRED = new WeakSet<Place>();
/** Places read from a save kept before skill was: each one's is reckoned from their age when the place is next brought on. */
const UNSKILLED = new WeakSet<Place>();
/** Places read from a save kept before the hours of each kind of work were: what each household taught read when next brought on. */
const UNTAUGHT = new WeakSet<Place>();
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

/** The most the next hour's work is worth to anyone (workWorth's bound). */
const WORTH_MOST = 0.9;
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
  // a wound bound, or an arm or a hand left stiff, takes: of any work but a leader's, which is words (fitFor).)
  const hurt =
    p.mark[i]! >> 4 === 2 || p.health[i] === 3 ? fitFor(world, place, i, tradeKind(occ)) : 1;
  return Math.max(0.05, Math.min(WORTH_MOST, (0.45 + earns + own) * (1 + p.mood[i]! / 400) * hurt));
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
  // (Each half their land's way and half a facet of their own nature: FACETS, in the leanings' order.)
  return {
    kin: ownLeaning(who, born, way(WAY.kinship), 11),
    bidden: ownLeaning(who, born, way(WAY.hierarchy), 12),
    sociable: ownLeaning(who, born, way(WAY.openness), 13),
    thrifty: ownLeaning(who, born, way(WAY.thrift), 14),
    bold: ownLeaning(who, born, way(WAY.valour), 15),
  };
}
/**
 * One's own nature (asked 2026-11-26: "a handful of facets that drive the existing temper"), six facets each 0 … 1, drawn
 * once from who they are, as their temper's own half is (rules/temper.ts ownNature): warmth (the own half of how close
 * they hold their kin), deference (of how they take being bidden), zest (of how they lean on company), prudence (of how
 * they set store by plenty), nerve (of how boldly they bear hardship), and wonder: how far they take to those unlike them
 * and to new ways, which no leaning of their land's carries. A temper is its land's ways met by these.
 */
export const FACETS = ["warmth", "deference", "zest", "prudence", "nerve", "wonder"] as const;
export function placeFacets(place: Place, i: number): number[] {
  const who = place.key ^ place.people.id[i]!,
    born = place.people.born[i]!;
  return [11, 12, 13, 14, 15, 16].map((salt) => ownNature(who, born, salt));
}
/**
 * What one holds dear (asked 2026-11-26: "values that colour ties, quarrels and breaks"): their land's eight ways
 * (rules/ways.ts: kin, rank, the gods, valour, trade, strangers, custom, thrift), each half their land's and half their
 * own (a draw of who they are). Two alike in them take to each other the more, two who hold one dear at opposite ends
 * come to words over it the oftener, and one who holds the gods dear breaks down at their altar.
 */
export const VALUES_N = WAY_TRAITS.length;
export function placeValues(
  place: Place,
  i: number,
  out = new Float64Array(VALUES_N),
): Float64Array {
  const w = place.matched.ways,
    who = place.key ^ place.people.id[i]!,
    born = place.people.born[i]!;
  for (let k = 0; k < VALUES_N; k++) out[k] = ownLeaning(who, born, w?.[k] ?? 0.5, 30 + k);
  return out;
}
/**
 * How far two hold one of their values at opposite ends of it, 0 … 1 (`at`, where given, set to which): each one's
 * distance from their land's middle (its way), the product where they lie on two sides, against the most two can.
 */
export function valueClash(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  ways: readonly number[] | undefined,
  at?: { k: number },
): number {
  let most = 0;
  for (let k = 0; k < VALUES_N; k++) {
    const m = (1 - TEMPER_OWN) * Math.max(0, Math.min(1, ways?.[k] ?? 0.5)) + TEMPER_OWN / 2,
      x = (-(a[k]! - m) * (b[k]! - m)) / ((TEMPER_OWN / 2) * (TEMPER_OWN / 2));
    if (x > most) {
      most = x;
      if (at) at.k = k;
    }
  }
  return Math.min(1, most);
}
/** One's own half of a leaning (rules/temper.ts TEMPER.own). */
const TEMPER_OWN = TEMPER.own;
/** How far apart two drawn at random hold a value, on the mean: their own halves, E|U1 - U2| = 1/3 of it. */
const VALUE_APART = TEMPER_OWN / 3;
/** How much a thing weighs with one of a leaning, against most (1): half as much at the least, half as much again at the most. */
export const leans = (x: number): number => 0.5 + x;

/**
 * What one remembers that bears on their mood (asked 2026-11-25 for the mood's reasons as a colony sim shows them): what
 * befell them or theirs that the place tells of already, each moving their mood by so much, weighed by their own temper,
 * and fading by halves. What a household's dates already reckon (a death in it, a home new or lost) is not remembered
 * besides, so nothing is counted twice.
 */
export const THOUGHT = {
  born: 1,
  paired: 2,
  friendDied: 3,
  ofAge: 4,
  fire: 5,
  games: 6,
  feast: 7,
  quarrel: 8,
  brawl: 9,
  /** N11: a break spent (its strain let out), held by the town's justice, a wrong done them judged, and a fine work seen. */
  catharsis: 10,
  heldBy: 11,
  righted: 12,
  admired: 13,
  /** A thing of theirs worn out and made anew (its maker), and robbed (the thief). */
  newGear: 14,
  robbed: 15,
  /** Q2: parted from the one they were paired with. */
  parted: 16,
} as const;
/** Days in which each kind fades to half. */
const THOUGHT_HALF: readonly number[] = [
  0, 30, 60, 20, 30, 10, 3, 10, 5, 15, 5, 10, 10, 4, 10, 20, 30,
];
const thoughtKind = (v: number): number => v >>> 24;
const thoughtSize = (v: number): number => ((v >>> 16) & 255) - 128;
/**
 * A memory's day is kept to its last thirteen bits (22 years; none is held past a year and a half: a size of 127 halved
 * to a point in seven of its longest half-lives, 60 days); the three above them tell whom or what it came of apart
 * (`srcTag`), so the same befalling one twice in a day from two of them is two things, and from one is one.
 */
const DAY_BITS = 0x1fff;
const thoughtAge = (v: number, today: number): number => (today - (v & DAY_BITS)) & DAY_BITS;
const thoughtTag = (v: number): number => (v >>> 13) & 7;
/**
 * Whom or what a memory came of (asked 2026-11-26: "each with its source"): one of the place's people by their number
 * (1 …), a lot of it by its number (`srcLot`: -10 less it; its square, fields and walls so too), or nothing (0).
 */
export const srcLot = (lot: number): number => -10 - lot;
export const lotOfSrc = (src: number): number => -10 - src;
/** Three bits that tell sources apart (0: none). */
const srcTag = (src: number): number => (src ? 1 + ((Math.imul(src, 0x9e3779b1) >>> 0) % 7) : 0);
/** How many memories one followed in full keeps, each with its source: as many as a colonist of RimWorld's holds at once. */
export const DEEP_THOUGHTS = 24;
/** What one followed in full keeps besides their columns (Place.deep). */
export type Deep = {
  /** Their memories, as their columns keep them (THOUGHTS' layout), and each one's source. */
  readonly th: Uint32Array;
  readonly src: Int32Array;
  /**
   * The things they hold, each its own (Item); the ticks of their own trade's work their tool's wear is reckoned to; and
   * whether their things are filled yet (on coming into full, at their next day's turn).
   */
  items: Item[];
  worked: number;
  filled: boolean;
  /**
   * What moved their view of those they know (Q2), each its own: OPINIONS of them, three numbers each (whom, by their
   * number; the reason, packed as a memory is: its kind, its size and its day; and who told them of it, for a thing heard).
   */
  readonly ops: Int32Array;
};
/**
 * A thing one holds, each its own (asked 2026-11-26: "single items: material from the world's own stuffs, quality from the
 * maker's skill and tools, the maker's name, and wear"): a tool of their trade (a farmer's, a herder's, a crafter's), a
 * garment, their household's pot (its cook's). Of what its land makes such things of (host/chain.ts: its tools' stone or
 * metal, its cloth, its clay), of a quality from that stuff, its land's craft at the work and its maker's years at it
 * (rules/stuffs.ts qualityOf, Classic's tool's), by one of the town's own who makes such things (else bought in, or made
 * at home), worn by use over the life its land's reckoning gives such things (rules/goods.ts WANTS: a tool four years of
 * its trade's work), and made anew when worn out.
 */
export type Item = {
  /** GEAR's. */
  readonly k: number;
  readonly stuff: string;
  /** Quality, 5 … 99. */
  readonly q: number;
  /** Thousandths of its life used. */
  wear: number;
  /** Its maker: their number, their household's key and their sex (for their name, living or gone); 0: bought in. */
  readonly maker: number;
  readonly mk: number;
  readonly ms: number;
  /** The day it was made. */
  readonly made: number;
};
export const GEAR = { tool: 1, garment: 2, pot: 3 } as const;
/** The good each kind of thing is of. */
const GEAR_GOOD: Readonly<Record<number, number>> = {
  [GEAR.tool]: G.tools,
  [GEAR.garment]: G.clothing,
  [GEAR.pot]: G.pottery,
};
/** How long each lasts in use, days: its land's reckoning of what wears out a year (WANTS). */
const gearLife = (k: number): number =>
  Math.round(
    365 /
      (k === GEAR.tool
        ? WANTS.toolsPerWorker
        : k === GEAR.garment
          ? WANTS.clothingPerPerson
          : WANTS.potteryPerPerson),
  );
/**
 * What a cloth and a fired clay take of a tool's measure of a stuff (keen, tough) for quality (est.: a cloth holds no edge;
 * how well it is woven and wears is the most of it, as a pot's firing is).
 */
const CLOTH_EDGE: Edge = { keen: 0.45, tough: 0.5 },
  CLAY_EDGE: Edge = { keen: 0.4, tough: 0.45 };
/** What a place's things are made of this year: its tools' stuff and its edge, its cloth, its ware; its land's craft at each. */
type Stuffs = {
  readonly year: number;
  readonly tool: { readonly name: string; readonly edge: Edge };
  readonly cloth: string;
  readonly ware: string;
  readonly craft: Readonly<Record<number, number>>;
};
const STUFFS = new WeakMap<Place, Stuffs>();
function stuffsOf(world: World, place: Place): Stuffs {
  const year = Math.floor(place.t / YEAR),
    was = STUFFS.get(place);
  if (was && was.year === year) return was;
  const made = toolMade(world, place.cell, `place ${place.town}`, year, false, place.town),
    town = townStuff(world, place.cell, year),
    lore = loreOf(world),
    craft = (w: "tools" | "clothing" | "pottery") =>
      Math.min(1, Math.max(0, lore.effect(place.cell, w)));
  const s: Stuffs = {
    year,
    tool: { name: made.stuff, edge: made.edge },
    cloth: landCloth(world, place.cell).kind,
    ware: town.clay.ware,
    craft: {
      [GEAR.tool]: craft("tools"),
      [GEAR.garment]: craft("clothing"),
      [GEAR.pot]: craft("pottery"),
    },
  };
  STUFFS.set(place, s);
  return s;
}
/** What a kind of thing is made of, and its measure. */
function gearStuff(s: Stuffs, k: number): { name: string; edge: Edge } {
  return k === GEAR.tool
    ? s.tool
    : k === GEAR.garment
      ? { name: s.cloth, edge: CLOTH_EDGE }
      : { name: s.ware, edge: CLAY_EDGE };
}
/** The quality one of the town's middling hands (six years at it, as rules/stuffs.ts takes one made at home) makes a kind to. */
function gearMid(s: Stuffs, k: number): number {
  return qualityOf(gearStuff(s, k).edge, s.craft[k] ?? 0, 6);
}
/** The kinds of thing one holds: a garment; a tool where their trade works with one; their household's pot where they are its cook. */
function gearKinds(place: Place, i: number, f: Frame): number[] {
  const p = place.people,
    occ = occOf(p, i),
    out: number[] = [GEAR.garment];
  if (occ === OCC.farmer || occ === OCC.herder || occ === OCC.crafter) out.push(GEAR.tool);
  const hd = houseDay(place, f);
  if (hd.cook[p.house[i]!] === p.id[i]) out.push(GEAR.pot);
  return out;
}
/**
 * A thing made for one of a place's people on a day: by one of the town's own who makes its good (a crafter at a making of
 * it, by a draw), else, a garment or a pot, at home by the one of their household who has given most to crafts, else bought
 * in; of its quality by its stuff, its land's craft and its maker's years at it.
 */
function gearMade(world: World, place: Place, i: number, k: number, day: number, s: Stuffs): Item {
  const p = place.people,
    good = GEAR_GOOD[k]!,
    makers: number[] = [];
  for (let j = 0; j < p.n; j++)
    if (occOf(p, j) === OCC.crafter && p.craft[j] && RECIPES[p.craft[j]! - 1]!.output[0] === good)
      makers.push(j);
  let m = -1;
  if (makers.length)
    m = makers[world.rng.index(makers.length, PLACE_DRAW, place.key ^ p.id[i]!, day, P.gear, k)]!;
  else if (k !== GEAR.tool) {
    let most = -1;
    for (let j = 0; j < p.n; j++)
      if (
        p.house[j] === p.house[i] &&
        ageOf(p, j, place.t) >= frameOf(world, place.cell).life.adulthood
      ) {
        const h = hoursAt(p, j, SK.crafts);
        if (h > most) {
          most = h;
          m = j;
        }
      }
  }
  const years = m >= 0 ? hoursAt(p, m, SK.crafts) / SKILL_YEAR : 6,
    st = gearStuff(s, k);
  return {
    k,
    stuff: st.name,
    q: qualityOf(st.edge, s.craft[k] ?? 0, years),
    wear: 0,
    maker: m >= 0 ? p.id[m]! : 0,
    mk: m >= 0 ? place.houses.key[p.house[m]!]! : 0,
    ms: m >= 0 ? sexOf(p, m) : 0,
    made: day,
  };
}
/**
 * One's things as they hold them on coming into full (promotion): each of their kinds, made by a draw some way into its
 * life (a thing in use is as likely any way through it), its maker of the town as it is now.
 */
function gearFilled(world: World, place: Place, i: number, f: Frame): Item[] {
  const s = stuffsOf(world, place),
    today = Math.floor(place.t / DAY),
    id = place.people.id[i]!;
  return gearKinds(place, i, f).map((k) => {
    const u = world.rng.unit(PLACE_DRAW, place.key ^ id, 0, P.gear, 100 + k),
      life = gearLife(k),
      day = today - Math.floor(u * life),
      it = gearMade(world, place, i, k, day, s);
    it.wear = Math.floor(u * 1000);
    return it;
  });
}
/** Wear on one's things for a day of use (one in full, at their day's turn); one worn out made anew, where one can be had. */
function gearDay(world: World, place: Place, i: number, d: Deep, f: Frame): void {
  const p = place.people,
    s = stuffsOf(world, place),
    today = Math.floor(place.t / DAY),
    worked = p.skill[i]!,
    kinds = gearKinds(place, i, f);
  // (A thing of a kind they no longer hold, given up: a tool of a trade left, a pot to the household's new cook.)
  d.items = d.items.filter((x) => kinds.includes(x.k));
  for (const k of kinds)
    if (!d.items.some((x) => x.k === k)) d.items.push(gearMade(world, place, i, k, today, s));
  const did = Math.max(0, worked - d.worked);
  d.worked = worked;
  for (let n = 0; n < d.items.length; n++) {
    const x = d.items[n]!;
    // (A tool by the work done with it: four years of its trade's; the rest by the day.)
    x.wear += Math.round(
      x.k === GEAR.tool ? (did * 1000 * WANTS.toolsPerWorker) / SKILL_YEAR : 1000 / gearLife(x.k),
    );
    if (x.wear < 1000) continue;
    x.wear = 1000;
    // (Made anew where the town makes it or its market holds it; else made do with.)
    // (A garment or a pot can be made at home; a tool is had of the town's own makers or its market's stock.)
    const it = gearMade(world, place, i, x.k, today, s),
      market = buildingOf(place, ["market"]);
    if (x.k === GEAR.tool && !it.maker && place.bldgs.stock[market * GOOD_COUNT + G.tools]! < MICRO)
      continue;
    d.items[n] = it;
    remember(place, i, THOUGHT.newGear, 3, it.maker);
  }
}
/** One's things as they hold them now (read only): kept where they are in full, else as they would be on coming into it. */
export function placeGear(world: World, place: Place, i: number): Item[] {
  const d =
    (place.people.tier[i]! & 3) === TIER.full ? place.deep?.get(place.people.id[i]!) : undefined;
  return d?.filled ? d.items : gearFilled(world, place, i, frameFor(world, place, i));
}
/**
 * A thing one holds against its town (O5, read only): what the town's middling hands make of its kind, what it is to its
 * holder's mood (gearTerm), and its life in days of use.
 */
export function placeGearReading(
  world: World,
  place: Place,
  x: Item,
): { mid: number; term: number; life: number } {
  const s = stuffsOf(world, place);
  return { mid: gearMid(s, x.k), term: gearTerm(s, x), life: gearLife(x.k) };
}
/** What a thing is worth to one who holds it, against what the town's middling hands make, and worn out. */
function gearTerm(s: Stuffs, x: Item): number {
  return x.wear >= 1000 ? -3 : Math.round((x.q - gearMid(s, x.k)) / (x.k === GEAR.tool ? 8 : 10));
}
function deepOf(place: Place, i: number): Deep | null {
  const t = place.people.tier[i]! & 3;
  if (t !== TIER.full) return null;
  const id = place.people.id[i]!,
    deep = (place.deep ??= new Map());
  let d = deep.get(id);
  if (!d) deep.set(id, (d = deepFilled(place, i)));
  return d;
}
/**
 * One's deep memories filled from what they were (promotion): each of their columns' memories, its source found again
 * from their own history by its kind and its tag: the place's log of that day (a child born to their household, the one
 * they were paired with, a friend dead, one they came to blows with, one judged for a wrong done them), then those they
 * know and live with, then where it befell (the square, a fire's lot, a fine work's). One whose tag nothing matches is
 * kept without one; nothing is made up.
 */
function deepFilled(place: Place, i: number): Deep {
  const p = place.people,
    th = new Uint32Array(DEEP_THOUGHTS),
    src = new Int32Array(DEEP_THOUGHTS);
  for (let k = 0; k < THOUGHTS; k++) {
    const v = p.thought[i * THOUGHTS + k]!;
    th[k] = v;
    src[k] = v ? sourceFound(place, i, v) : 0;
  }
  // (Their things are filled at their day's turn, where the world is to hand: gearFilled, the same as a reading of them.)
  return {
    th,
    src,
    items: [],
    worked: p.skill[i]!,
    filled: false,
    ops: new Int32Array(OPINIONS * 3),
  };
}
function sourceFound(place: Place, i: number, v: number): number {
  const tag = thoughtTag(v),
    p = place.people,
    me = p.id[i]!;
  if (!tag) return 0;
  const day = v & DAY_BITS,
    kind = thoughtKind(v),
    ok = (src: number) => src !== 0 && srcTag(src) === tag,
    lotsOf = () => [
      AT.square,
      AT.fields,
      place.houses.home[p.house[i]!]!,
      p.work[i]!,
      ...place.bldgs.lot,
      ...(place.fire.length ? [place.fire[0]!] : []),
    ];
  // (A memory of a place, the square's games and feasts, a work admired, a fire: at a place before among people, whose
  // three bits may tell the same.)
  if (
    kind === THOUGHT.games ||
    kind === THOUGHT.feast ||
    kind === THOUGHT.admired ||
    kind === THOUGHT.fire
  ) {
    for (const lot of lotsOf()) if (ok(srcLot(lot))) return srcLot(lot);
    const w = place.works ?? [];
    for (let k = 0; k + 6 < w.length; k += 7) if (ok(srcLot(w[k]!))) return srcLot(w[k]!);
  }
  // (The log of that day: whoever it names beside them.)
  for (let k = place.log.length - 1; k >= 0; k--) {
    const x = place.log[k]!;
    if ((Math.floor(x.t / DAY) & DAY_BITS) !== day) continue;
    for (const who of [x.id, x.a, x.b])
      if (
        who !== me &&
        ok(who) &&
        (x.id === me ||
          x.a === me ||
          x.b === me ||
          kind === THOUGHT.born ||
          kind === THOUGHT.friendDied)
      )
        return who;
  }
  // (Those they know and live with.)
  const known: number[] = [p.mate[i]!, p.friend[i]!];
  for (let k = 0; k < TIES; k++) known.push(p.tie[i * TIES + k]!);
  for (const who of known) if (who !== PROMISED && ok(who)) return who;
  for (let j = 0; j < p.n; j++) if (p.house[j] === p.house[i] && ok(p.id[j]!)) return p.id[j]!;
  // (Where it befell.)
  for (const lot of lotsOf()) if (ok(srcLot(lot))) return srcLot(lot);
  return 0;
}
/** A place's deep store as numbers, by number, for its save and its digest: each one's number, then their memories and sources. */
function deepSaved(deep: Map<number, Deep>): { n: number[]; stuffs: string[]; ops: number[] } {
  const n: number[] = [],
    stuffs: string[] = [],
    ops: number[] = [];
  for (const id of [...deep.keys()].sort((a, b) => a - b)) {
    const d = deep.get(id)!;
    n.push(id, ...d.th, ...d.src, d.worked, d.filled ? 1 : 0, d.items.length);
    for (const x of d.items) {
      let s = stuffs.indexOf(x.stuff);
      if (s < 0) s = stuffs.push(x.stuff) - 1;
      n.push(x.k, x.q, x.wear, x.maker, x.mk, x.ms, x.made, s);
    }
    // (Their reasons apart, so a place kept before they were reads as it was.)
    if (d.ops.some((v) => v !== 0)) ops.push(id, ...d.ops);
  }
  return { n, stuffs, ops };
}
function deepLoaded(raw: { n: number[]; stuffs: string[]; ops?: number[] }): Map<number, Deep> {
  const out = new Map<number, Deep>(),
    a = raw.n;
  for (let k = 0; k < a.length;) {
    const id = a[k++]!,
      th = Uint32Array.from(a.slice(k, (k += DEEP_THOUGHTS))),
      src = Int32Array.from(a.slice(k, (k += DEEP_THOUGHTS))),
      worked = a[k++]!,
      filled = a[k++] === 1,
      many = a[k++]!,
      items: Item[] = [];
    for (let q = 0; q < many; q++, k += 8)
      items.push({
        k: a[k]!,
        q: a[k + 1]!,
        wear: a[k + 2]!,
        maker: a[k + 3]!,
        mk: a[k + 4]!,
        ms: a[k + 5]!,
        made: a[k + 6]!,
        stuff: raw.stuffs[a[k + 7]!] ?? "",
      });
    out.set(id, { th, src, worked, filled, items, ops: new Int32Array(OPINIONS * 3) });
  }
  const o = raw.ops ?? [];
  for (let k = 0; k + OPINIONS * 3 < o.length + 1; k += 1 + OPINIONS * 3)
    out.get(o[k]!)?.ops.set(o.slice(k + 1, k + 1 + OPINIONS * 3));
  return out;
}
/** One leaving full: what they remember kept to their columns, the strongest first. */
function deepLetGo(place: Place, i: number): void {
  const id = place.people.id[i]!,
    d = place.deep?.get(id);
  if (!d) return;
  // (What moved their view of each, rolled into their regard of them as it would settle: Q2.)
  for (let k = 0; k < OPINIONS; k++) if (d.ops[k * 3 + 1]) reasonSettled(place, i, d, k);
  place.deep!.delete(id);
  const today = Math.floor(place.t / DAY),
    order = [...d.th.keys()]
      .filter((k) => d.th[k])
      .sort(
        (a, b) =>
          Math.abs(thoughtNow(d.th[b]!, today)) - Math.abs(thoughtNow(d.th[a]!, today)) || a - b,
      ),
    at = i * THOUGHTS;
  for (let k = 0; k < THOUGHTS; k++)
    place.people.thought[at + k] = k < order.length ? d.th[order[k]!]! : 0;
}
/** Whom or what each of one's memories came of, in their columns' order where they are not followed in full (read only). */
export function placeThoughtSources(place: Place, i: number): { v: number; src: number }[] {
  const d =
      (place.people.tier[i]! & 3) === TIER.full ? place.deep?.get(place.people.id[i]!) : undefined,
    out: { v: number; src: number }[] = [];
  if (d) {
    for (let k = 0; k < DEEP_THOUGHTS; k++) if (d.th[k]) out.push({ v: d.th[k]!, src: d.src[k]! });
    return out;
  }
  // (As they would be filled on coming into full: nothing shown is other than what they will be.)
  for (let k = 0; k < THOUGHTS; k++) {
    const v = place.people.thought[i * THOUGHTS + k]!;
    if (v) out.push({ v, src: sourceFound(place, i, v) });
  }
  return out;
}
/** What a memory moves a mood by now (points), as it has faded. */
const thoughtNow = (v: number, today: number): number =>
  thoughtSize(v) * dmath.halved(thoughtAge(v, today), THOUGHT_HALF[thoughtKind(v)] ?? 30);
/**
 * Something one of a place's people will remember, of whom or what (`src`): kept, in place of the weakest memory where
 * all are taken; and, for one followed in full, among their deep memories with its source besides (DEEP_THOUGHTS).
 */
function remember(place: Place, i: number, kind: number, size: number, src = 0): void {
  const p = place.people,
    s = Math.max(-127, Math.min(127, Math.round(size))),
    today = Math.floor(place.t / DAY),
    at = i * THOUGHTS,
    tag = srcTag(src);
  if (!s) return;
  const nv = ((kind << 24) | ((s + 128) << 16) | (tag << 13) | (today & DAY_BITS)) >>> 0,
    d = deepOf(place, i);
  if (d) {
    let slot = -1,
      weakest = Infinity;
    for (let k = 0; k < DEEP_THOUGHTS; k++) {
      const w0 = d.th[k]!;
      if (!w0) {
        if (slot < 0 || weakest > 0) {
          slot = k;
          weakest = 0;
        }
        continue;
      }
      if (thoughtKind(w0) === kind && d.src[k] === src && thoughtAge(w0, today) < 1) {
        slot = -2;
        break;
      }
      const w = Math.abs(thoughtNow(w0, today));
      if (w < weakest) {
        weakest = w;
        slot = k;
      }
    }
    if (slot >= 0) {
      d.th[slot] = nv;
      d.src[slot] = src;
    }
  }
  let slot = -1,
    weakest = Infinity;
  for (let k = 0; k < THOUGHTS; k++) {
    const v = p.thought[at + k]!;
    if (!v) {
      if (slot < 0 || weakest > 0) {
        slot = k;
        weakest = 0;
      }
      continue;
    }
    // (The same befalling them twice in a day of one source is one thing: a fire fought by turns, a cry heard again.)
    if (thoughtKind(v) === kind && thoughtTag(v) === tag && thoughtAge(v, today) < 1) return;
    const w = Math.abs(thoughtNow(v, today));
    if (w < weakest) {
      weakest = w;
      slot = k;
    }
  }
  p.thought[at + slot] = nv;
}
/** Whether one of a place's people has a memory of a kind from today already. */
function heldToday(place: Place, i: number, kind: number): boolean {
  const today = Math.floor(place.t / DAY);
  for (let k = 0; k < THOUGHTS; k++) {
    const v = place.people.thought[i * THOUGHTS + k]!;
    if (v && thoughtKind(v) === kind && thoughtAge(v, today) < 1) return true;
  }
  return false;
}
/** What one thinks of another past which they are a friend, and under which a rival (N8). */
export const FRIEND_AT = 25,
  RIVAL_AT = -30;
/** Under this both ways, two who meet quarrel; under this, two hot tempers come to blows. */
const QUARREL_AT = -30,
  BRAWL_AT = -60;
/** How often two rivals of middling temper who meet have words (each meeting), the hotter the oftener. */
const QUARREL_ODDS = 0.1;
/** The meetings a place's people are taken to have had before it is entered (rounds of meetDay's). */
const SEEN_BEFORE = 20;
/** How bold two tempers must be, between them, to come to blows (rules/temper.ts valour's leaning, 0 … 1). */
const BRAWL_BOLD = 0.6;

/**
 * A day's meetings (N8): each of a place's people meets two others, one of their household, one they work beside, or one
 * of their street (the households either side of theirs), as a draw falls; and what each thinks of the other moves by how
 * alike they are of temper (the five leanings host/place.ts placeTemper draws from their land's ways and their own nature:
 * like takes to like), the more for kin, the less in a low mood. Each keeps a dozen at the most; a new one takes the place
 * of one they think least of either way. Two who cannot abide each other quarrel when they meet, and remember it; two
 * hot tempers among them come to blows, and are parted. What they think fades a point a week where they do not meet.
 */
/** A draw of a day's meetings (meetDay's). */
function meetDraw(world: World, place: Place, i: number, k: number): number {
  return world.rng.unit(PLACE_DRAW, place.key ^ place.people.id[i]!, place.t, P.meet, k);
}
/** One's view of another moved: found among those they know, or taken up in a free place or the one they think least of. */
function tieMove(p: People, a: number, b: number, by: number): number {
  const at = a * TIES,
    id = p.id[b]!;
  let slot = -1,
    weakest = 1000,
    found = false;
  for (let k = 0; k < TIES; k++) {
    const v = p.tie[at + k]!;
    if (v === id) {
      slot = k;
      found = true;
      break;
    }
    const w = v === 0 ? -1 : Math.abs(p.regard[at + k]!);
    if (w < weakest) {
      weakest = w;
      slot = k;
    }
  }
  if (!found) {
    // (A stranger: taken up only in a free place, or in that of one they hardly think of.)
    if (weakest > 5) return 0;
    p.tie[at + slot] = id;
    p.regard[at + slot] = 0;
  }
  const r = Math.max(-100, Math.min(100, p.regard[at + slot]! + by));
  p.regard[at + slot] = r;
  return r;
}
/**
 * Why one thinks as they do of another (asked 2026-11-26, "deeper social life": an opinion of each one known that is the
 * sum of sourced reasons with their own decay, as a colony sim's). Their regard (N8) is what their meetings have made of
 * it, alike of temper and of what they hold dear; on it, what has passed between them, each a reason with its size, its
 * day and its source, fading by halves as a memory does: words had (a quarrel), blows, a theft from their household, a
 * thing told them of the other by one they trust, a mate's jealousy, their pairing, their parting. Kept so by those
 * followed in full (Place.deep); for the rest, and as each fades, the share that stays is rolled into their regard.
 * Besides, what holds while it holds and is kept nowhere: kin who keep them (their household's grown, to its young and
 * old), or let them go wanting.
 */
export const REASON = {
  words: 1,
  blows: 2,
  stole: 3,
  told: 4,
  jealous: 5,
  wed: 6,
  parted: 7,
} as const;
/** Days in which each kind of reason fades to half. */
const REASON_HALF: readonly number[] = [0, 6, 20, 30, 8, 10, 60, 40];
/** What each kind of reason is, said of the other (the Social tab). */
export const REASON_WORDS: readonly string[] = [
  "",
  "had words with them",
  "came to blows with them",
  "stole from their household",
  "heard of them from another",
  "too taken with their mate",
  "were paired",
  "parted",
];
/** How many reasons one followed in full keeps at once, of all they know. */
export const OPINIONS = 10;
/** The share of a reason that stays in one's regard once it has faded (est.: half, as a quarrel's words leave a point). */
const REASON_SETTLES = 0.5;
/** Kin who keep one (their household's grown, to its young and old); and the same household gone without food. */
const KIN_KEEPS = 4,
  KIN_WANTING = -3;
/** How often one tells another of a third they think much of either way, each meeting; and the share of it told on. */
const TELL_ODDS = 0.3,
  TELL_SHARE = 0.1;
/** What one thinks of another before a mate sees them taken with each other; and how often the mate sees it. */
const SMITTEN_AT = 50,
  JEALOUS_ODDS = 0.25;
/** Under this both ways, two paired part. */
export const PART_AT = -40;
const reasonKind = (v: number): number => v >>> 24;
const reasonSize = (v: number): number => ((v >>> 16) & 255) - 128;
const reasonAge = (v: number, today: number): number => (today - (v & 0xffff)) & 0xffff;
const reasonNow = (v: number, today: number): number =>
  reasonSize(v) * dmath.halved(reasonAge(v, today), REASON_HALF[reasonKind(v)] ?? 10);
/** One of a's reasons let go, its share rolled into their regard of whom it was of. */
function reasonSettled(place: Place, a: number, d: Deep, k: number): void {
  const v = d.ops[k * 3 + 1]!,
    j = placeIndexOf(place, d.ops[k * 3]!),
    by = Math.round(reasonSize(v) * REASON_SETTLES);
  d.ops[k * 3] = d.ops[k * 3 + 1] = d.ops[k * 3 + 2] = 0;
  if (j >= 0 && by) tieMove(place.people, a, j, by);
}
/** A day's turn: each reason faded to nothing let go, what stays of it in their regard. */
function reasonsFaded(place: Place, a: number, d: Deep, today: number): void {
  for (let k = 0; k < OPINIONS; k++) {
    const v = d.ops[k * 3 + 1]!;
    if (v && Math.abs(reasonNow(v, today)) < 1) reasonSettled(place, a, d, k);
  }
}
/**
 * A reason a has to think better or worse of b (indices), of a kind, and who told them (a number; 0: none): kept as its
 * own by one followed in full, in place of the weakest where all are taken (its share rolled into their regard); for the
 * rest, its share put to their regard at once.
 */
function reason(place: Place, a: number, b: number, kind: number, size: number, from = 0): void {
  const p = place.people,
    s = Math.max(-127, Math.min(127, Math.round(size)));
  if (!s || a === b) return;
  const d = deepOf(place, a);
  if (!d) {
    const by = Math.round(s * REASON_SETTLES);
    if (by) tieMove(p, a, b, by);
    return;
  }
  const whom = p.id[b]!,
    today = Math.floor(place.t / DAY),
    ops = d.ops,
    nv = ((kind << 24) | ((s + 128) << 16) | (today & 0xffff)) >>> 0;
  let slot = -1,
    weakest = Infinity;
  for (let k = 0; k < OPINIONS; k++) {
    const v = ops[k * 3 + 1]!;
    if (!v) {
      if (weakest > 0) {
        slot = k;
        weakest = 0;
      }
      continue;
    }
    // (The same from the same that day: the one, the larger.)
    if (
      ops[k * 3] === whom &&
      reasonKind(v) === kind &&
      ops[k * 3 + 2] === from &&
      reasonAge(v, today) < 1
    ) {
      if (Math.abs(s) > Math.abs(reasonSize(v))) ops[k * 3 + 1] = nv;
      return;
    }
    const w = Math.abs(reasonNow(v, today));
    if (w < weakest) {
      weakest = w;
      slot = k;
    }
  }
  if (ops[slot * 3 + 1]) reasonSettled(place, a, d, slot);
  ops[slot * 3] = whom;
  ops[slot * 3 + 1] = nv;
  ops[slot * 3 + 2] = from;
}
/** What holds between kin while it holds (kept nowhere): their household's grown keep its young and old, or let them go wanting. */
function kinTerm(place: Place, i: number, j: number): number {
  const p = place.people,
    h = p.house[i]!;
  if (h !== p.house[j] || occOf(p, i) !== OCC.dependent || occOf(p, j) === OCC.dependent) return 0;
  let food = 0;
  for (let f = 0; f < FOODS.length; f++) food += place.houses.pantry[h * FOODS.length + f]!;
  return food > 0 ? KIN_KEEPS : KIN_WANTING;
}
/** What one thinks of another past their regard: their reasons now (kept in full), and what holds between kin. */
function opinionMore(place: Place, i: number, j: number, today: number): number {
  const p = place.people;
  let n = kinTerm(place, i, j);
  const d = (p.tier[i]! & 3) === TIER.full ? place.deep?.get(p.id[i]!) : undefined;
  if (d) {
    const whom = p.id[j]!;
    for (let k = 0; k < OPINIONS; k++)
      if (d.ops[k * 3] === whom && d.ops[k * 3 + 1]) n += reasonNow(d.ops[k * 3 + 1]!, today);
  }
  return n;
}
/** One's regard of another (by number) as their ties keep it (0: not known). */
function regardOf(p: People, i: number, id: number): number {
  for (let k = 0; k < TIES; k++) if (p.tie[i * TIES + k] === id) return p.regard[i * TIES + k]!;
  return 0;
}
/** What one thinks of another, all told (-100 … 100). */
function opinionNow(place: Place, i: number, j: number, today: number): number {
  return Math.max(
    -100,
    Math.min(100, regardOf(place.people, i, place.people.id[j]!) + opinionMore(place, i, j, today)),
  );
}
/**
 * A meeting's talk, as i has it with j (meetDay's, a day lived): now and then i tells j of the one they think most of
 * either way (a third), and j takes it as far as they trust i, a tenth of it at the most; and where i is taken with j,
 * their mate may see it, and think the worse of j by as much as they think of i.
 */
function talked(
  world: World,
  place: Place,
  i: number,
  j: number,
  k: number,
  ri: number,
  rj: number,
): void {
  const p = place.people;
  // (Drawn only where j would take it: a draw is keyed, so one not drawn moves no other.)
  if (rj > 0 && meetDraw(world, place, i, 100 + k) < TELL_ODDS) {
    let third = 0,
      most = 0;
    for (let q = 0; q < TIES; q++) {
      const id = p.tie[i * TIES + q]!,
        r = p.regard[i * TIES + q]!;
      if (id && id !== p.id[j] && Math.abs(r) > Math.abs(most)) {
        third = id;
        most = r;
      }
    }
    const t = third ? placeIndexOf(place, third) : -1,
      by = Math.round(most * TELL_SHARE * Math.min(1, rj / 50));
    if (t >= 0 && t !== j && by) reason(place, j, t, REASON.told, by, p.id[i]!);
  }
  const mate = p.mate[i]!;
  if (
    ri >= SMITTEN_AT &&
    mate &&
    mate !== PROMISED &&
    mate !== p.id[j] &&
    p.house[i] !== p.house[j] &&
    sexOf(p, i) !== sexOf(p, j)
  ) {
    const m = placeIndexOf(place, mate);
    if (m >= 0 && meetDraw(world, place, i, 200 + k) < JEALOUS_ODDS) {
      const fond = Math.max(0, Math.min(1, regardOf(p, m, p.id[i]!) / 50));
      if (fond > 0) reason(place, m, j, REASON.jealous, -8 * fond);
    }
  }
}
/** Two paired part: neither the other's any more (still of one household), each remembering it and thinking the worse. */
function partWays(place: Place, i: number, m: number): void {
  const p = place.people;
  p.mate[i] = p.mate[m] = 0;
  if (p.friend[i] === p.id[m]) p.friend[i] = 0;
  if (p.friend[m] === p.id[i]) p.friend[m] = 0;
  note(place, HAP.parted, p.id[i]!, p.id[m]!);
  for (const [a, b] of [
    [i, m],
    [m, i],
  ] as const) {
    remember(place, a, THOUGHT.parted, -8, p.id[b]!);
    reason(place, a, b, REASON.parted, -10);
  }
}
/** How strongly a memory must bear on one now to be shown over their head (Q1; points of mood). */
const BUBBLE_AT = 5;
/**
 * The memory that bears most on one now, as their columns keep it (the same at every tier): its kind, less than nought
 * where it lowers them (0: none bears so much as BUBBLE_AT). For what is drawn over their head (Q1).
 */
export function placeStrongest(place: Place, i: number): number {
  const p = place.people,
    today = Math.floor(place.t / DAY);
  let best = 0,
    kind = 0;
  for (let k = 0; k < THOUGHTS; k++) {
    const v = p.thought[i * THOUGHTS + k]!;
    if (!v) continue;
    const n = thoughtNow(v, today);
    if (Math.abs(n) > Math.abs(best)) {
      best = n;
      kind = thoughtKind(v);
    }
  }
  return Math.abs(best) >= BUBBLE_AT ? (best > 0 ? kind : -kind) : 0;
}
/** One's regard of another (indices; null: they do not know them). */
export function placeRegard(place: Place, i: number, j: number): number | null {
  const p = place.people,
    id = p.id[j]!;
  for (let k = 0; k < TIES; k++) if (p.tie[i * TIES + k] === id) return p.regard[i * TIES + k]!;
  return null;
}
/** What one thinks of another, and why (read only): their regard, each reason now with whom it came of, and kin's. */
export function placeOpinion(
  place: Place,
  i: number,
  j: number,
): {
  total: number;
  regard: number;
  kin: number;
  reasons: { kind: number; size: number; days: number; from: number }[];
} {
  const p = place.people,
    today = Math.floor(place.t / DAY),
    regard = regardOf(p, i, p.id[j]!),
    kin = kinTerm(place, i, j),
    d = (p.tier[i]! & 3) === TIER.full ? place.deep?.get(p.id[i]!) : undefined,
    reasons: { kind: number; size: number; days: number; from: number }[] = [];
  if (d)
    for (let k = 0; k < OPINIONS; k++) {
      const v = d.ops[k * 3 + 1]!;
      if (d.ops[k * 3] !== p.id[j] || !v) continue;
      const size = Math.round(reasonNow(v, today));
      if (size)
        reasons.push({
          kind: reasonKind(v),
          size,
          days: reasonAge(v, today),
          from: d.ops[k * 3 + 2]!,
        });
    }
  reasons.sort((a, b) => Math.abs(b.size) - Math.abs(a.size) || a.kind - b.kind);
  const total = Math.max(
    -100,
    Math.min(100, regard + kin + reasons.reduce((n, x) => n + x.size, 0)),
  );
  return { total, regard, kin, reasons };
}
/** How the town thinks of one (read only): how many know them, and of those how many think well and how many ill of them. */
export function placeRepute(
  place: Place,
  i: number,
): { known: number; well: number; ill: number; mean: number } {
  const p = place.people,
    id = p.id[i]!;
  let known = 0,
    well = 0,
    ill = 0,
    sum = 0;
  for (let k = 0; k < p.n * TIES; k++)
    if (p.tie[k] === id) {
      const r = p.regard[k]!;
      known++;
      sum += r;
      if (r >= FRIEND_AT) well++;
      else if (r <= RIVAL_AT) ill++;
    }
  return { known, well, ill, mean: known ? sum / known : 0 };
}
function meetDay(world: World, place: Place, rounds = 1): void {
  const p = place.people,
    n = p.n;
  if (n < 2) return;
  const temper = new Float32Array(n * 5),
    // (What each holds dear, and their wonder: how little like takes to like with them. FACETS, VALUES.)
    values = new Float64Array(n * VALUES_N),
    wonder = new Float32Array(n),
    ways = place.matched.ways,
    byHouse = new Map<number, number[]>(),
    byWork = new Map<number, number[]>(),
    here = new Set<number>();
  for (let i = 0; i < n; i++) here.add(p.id[i]!);
  // (Those gone from the place since are known no more: let go once a day, not at each going, which scanned every tie of
  // the place for each of a month's matched dead.)
  for (let k = 0; k < n * TIES; k++)
    if (p.tie[k] && !here.has(p.tie[k]!)) {
      p.tie[k] = 0;
      p.regard[k] = 0;
    }
  for (let i = 0; i < n; i++) {
    const t = placeTemper(place, i);
    temper[i * 5] = t.kin;
    temper[i * 5 + 1] = t.bidden;
    temper[i * 5 + 2] = t.sociable;
    temper[i * 5 + 3] = t.thrifty;
    temper[i * 5 + 4] = t.bold;
    placeValues(place, i, values.subarray(i * VALUES_N, (i + 1) * VALUES_N));
    wonder[i] = ownNature(place.key ^ p.id[i]!, p.born[i]!, 16);
    const h = p.house[i]!;
    (byHouse.get(h) ?? byHouse.set(h, []).get(h)!).push(i);
    const w = p.work[i]!;
    if (w !== 0) (byWork.get(w) ?? byWork.set(w, []).get(w)!).push(i);
  }
  const today = Math.floor(place.t / DAY);
  for (let round = 0; round < rounds; round++)
    for (let i = 0; i < n; i++) {
      for (let m = 0; m < 2; m++) {
        const k = round * 8 + m * 4,
          r = meetDraw(world, place, i, k),
          h = p.house[i]!,
          pool =
            r < 0.35
              ? byHouse.get(h)
              : r < 0.7 && p.work[i] !== 0
                ? byWork.get(p.work[i]!)
                : (byHouse.get(h + (meetDraw(world, place, i, k + 2) < 0.5 ? -1 : 1)) ??
                  byHouse.get(h));
        if (!pool || pool.length < 2) continue;
        const j = pool[Math.floor(meetDraw(world, place, i, k + 1) * pool.length)]!;
        if (j === i) continue;
        let dist = 0;
        for (let q = 0; q < 5; q++) dist += Math.abs(temper[i * 5 + q]! - temper[j * 5 + q]!);
        dist /= 5;
        let apart = 0;
        for (let q = 0; q < VALUES_N; q++)
          apart += Math.abs(values[i * VALUES_N + q]! - values[j * VALUES_N + q]!);
        apart /= VALUES_N;
        const kin = p.house[i] === p.house[j],
          // (Like takes to like: alike past the mean of two drawn at random, warmer; unlike, cooler. Kin the warmer by how
          // close each holds them; a low mood sours a meeting. And alike in what they hold dear, past two drawn at random,
          // warmer, the less for those of much wonder: half as much at the most, half again at the least.)
          base =
            40 * (0.19 - dist) + 40 * (VALUE_APART - apart) * (1.5 - (wonder[i]! + wonder[j]!) / 2),
          ri = tieMove(
            p,
            i,
            j,
            Math.round(base + (kin ? 4 * temper[i * 5]! : 0) + Math.min(0, p.mood[i]!) / 25),
          ),
          rj = tieMove(
            p,
            j,
            i,
            Math.round(base + (kin ? 4 * temper[j * 5]! : 0) + Math.min(0, p.mood[j]!) / 25),
          );
        if (rounds > 1) continue;
        // (What they tell each other of a third, and a mate who sees them taken with each other: Q2.)
        talked(world, place, i, j, k, ri, rj);
        talked(world, place, j, i, k + 16, rj, ri);
        // (The other's opinion read only where the first's could come to words: most who meet think well enough of each other.)
        const oi = ri + opinionMore(place, i, j, today);
        if (oi > QUARREL_AT) continue;
        const oj = rj + opinionMore(place, j, i, today);
        if (oj > QUARREL_AT) continue;
        // Two who cannot abide each other: words, now and then, the more often the hotter their tempers; and between hot
        // tempers who think worst of each other, blows, parted by those about them.
        // (The oftener where they hold one thing dear at its two ends: half as often where they hold nothing so, half again
        // where they could not be further apart on it.)
        const bold = (temper[i * 5 + 4]! + temper[j * 5 + 4]!) / 2,
          clash =
            0.5 +
            valueClash(
              values.subarray(i * VALUES_N, (i + 1) * VALUES_N),
              values.subarray(j * VALUES_N, (j + 1) * VALUES_N),
              ways,
            ),
          flare = meetDraw(world, place, i, k + 3);
        if (flare >= QUARREL_ODDS * 2 * bold * clash) continue;
        const blows =
          oi <= BRAWL_AT &&
          oj <= BRAWL_AT &&
          bold >= BRAWL_BOLD &&
          flare < QUARREL_ODDS * bold * clash;
        for (const [a, b] of [
          [i, j],
          [j, i],
        ] as const) {
          remember(
            place,
            a,
            blows ? THOUGHT.brawl : THOUGHT.quarrel,
            (blows ? -10 : -4) * leans(1 - temper[a * 5 + 2]!),
            p.id[b]!,
          );
          reason(place, a, b, blows ? REASON.blows : REASON.words, blows ? -6 : -2);
        }
        // (Blows are told in the log; words are only remembered, and told on the Social tab: three a day in a town of
        // five hundred filled a log a town keeps to about its people's number, and pushed out its births and comings.)
        // (And blows are a wrong, brought before the town's justice: N11.)
        if (blows) {
          note(place, HAP.brawl, p.id[i]!, p.id[j]!);
          judge(world, place, i, j);
        }
      }
    }
  // (What is not met again fades: a point a week toward nothing.)
  if (today % 7 === 0)
    for (let k = 0; k < n * TIES; k++) {
      const r = p.regard[k]!;
      if (r > 0) p.regard[k] = r - 1;
      else if (r < 0) p.regard[k] = r + 1;
    }
}

/** One of a place's people's ties (N8), the most thought of first: whom, what they think of them, and how they know them. */
export function placeTies(
  place: Place,
  i: number,
): { j: number; regard: number; opinion: number; how: "household" | "work" | "street" }[] {
  const p = place.people,
    today = Math.floor(place.t / DAY),
    out: { j: number; regard: number; opinion: number; how: "household" | "work" | "street" }[] =
      [];
  for (let k = 0; k < TIES; k++) {
    const id = p.tie[i * TIES + k]!;
    if (!id) continue;
    const j = placeIndexOf(place, id);
    if (j < 0) continue;
    out.push({
      j,
      regard: p.regard[i * TIES + k]!,
      opinion: Math.max(
        -100,
        Math.min(100, p.regard[i * TIES + k]! + opinionMore(place, i, j, today)),
      ),
      how:
        p.house[j] === p.house[i]
          ? "household"
          : p.work[i] !== 0 && p.work[j] === p.work[i]
            ? "work"
            : "street",
    });
  }
  return out.sort((a, b) => b.opinion - a.opinion || a.j - b.j);
}
/** What one thinks of another, said. */
export function regardWords(r: number): string {
  return r >= 60
    ? "a close friend"
    : r >= FRIEND_AT
      ? "a friend"
      : r >= 5
        ? "on good terms"
        : r > -5
          ? "known to them"
          : r > RIVAL_AT
            ? "on poor terms"
            : "a rival";
}

/** What of what befell whom a place's log tells is remembered, and by whom (note's hook). */
function remembered(
  place: Place,
  what: number,
  id: number,
  a: number,
  b: number,
  gone: number,
): void {
  const p = place.people,
    of = (i: number) => placeTemper(place, i);
  if (what === HAP.born) {
    // (A child born to the household: each of it is glad, the closer to their kin the more.)
    const c = placeIndexOf(place, id);
    if (c < 0) return;
    for (let k = 0; k < p.n; k++)
      if (k !== c && p.house[k] === p.house[c])
        remember(place, k, THOUGHT.born, 20 * leans(of(k).kin), id);
  } else if (what === HAP.paired) {
    for (const who of [id, a, b]) {
      const k = who ? placeIndexOf(place, who) : -1;
      if (k >= 0)
        remember(place, k, THOUGHT.paired, 30 * leans(of(k).sociable), who === id ? a : id);
    }
  } else if (what === HAP.ofAge) {
    const k = placeIndexOf(place, id);
    if (k >= 0) remember(place, k, THOUGHT.ofAge, 10);
  } else if (HAP_DEATH.has(what)) {
    // (A friend of another household dead: their own household's grief is its date's, not a memory besides.)
    const i = gone >= 0 ? gone : placeIndexOf(place, id),
      house = i >= 0 ? p.house[i]! : -1;
    for (let k = 0; k < p.n; k++)
      if (k !== i && p.friend[k] === id && p.house[k] !== house)
        remember(place, k, THOUGHT.friendDied, -25 * leans(of(k).sociable), id);
  }
}

/** Below this a mood heeds no order to change its work. */
export const MOOD_UNHEEDING = -50;
/** Where a mood stands with nothing bearing on it: most are a little content. */
export const MOOD_BASE = 15;
/**
 * One thing bearing on a mood: what it is (MOOD's bit; 0 for a memory, whose kind is THOUGHT's), how far it moves it
 * (points), and its days left (null: while it lasts).
 */
export type MoodTerm = {
  readonly bit: number;
  readonly size: number;
  readonly days: number | null;
  readonly thought?: number;
  /** A state of their household's or their work's that bears on it (COND), not one of MOOD's bits. */
  readonly cond?: number;
  /** Whom or what it is of (srcLot's numbering; 0 or absent: nothing one). */
  readonly src?: number;
};
/**
 * What bears on a mood from how one lives (asked 2026-11-26: "many at once, each with its own weight"): the meals their
 * household's cook makes them, by the cook's skill at it (N6's cooking hours: a novice's poor, a master's a pleasure);
 * at the work their household taught them, or kept from it; one of their household abed, or a friend.
 */
export const COND = {
  cook: 1,
  passion: 2,
  kept: 3,
  kinAbed: 4,
  friendAbed: 5,
  /** A thing of theirs (Deep.items): its quality against what the town's own hands make, or worn out. */
  tool: 6,
  garment: 7,
  pot: 8,
  /** Their home's room for those who sleep in it (NeedsDay), and a fine work in sight of its door. */
  room: 9,
  beauty: 10,
  /** O4: their post in a building whose floor has no bench left for them (benchless): at the yard and the door. */
  crowded: 11,
  /** P4: what they take and have come to need, as their land's people do (sim/money intox): it costs them. */
  craving: 12,
  /** P4: their household's table: the foods its pantry holds, one alone a meagre fare, many a varied one. */
  fare: 13,
  /** P6: held in bondage, as their land's people are (sim/order bonds): its kind weighs on them. */
  bound: 14,
  /** P7: a shrine or temple of the town to keep their faith's rites at, or none where their faith asks one. */
  rite: 15,
  /** P7: one of rank (a leader by trade, one of its realm's key figures): a hall befitting it, or none, as their people hold rank. */
  rank: 16,
} as const;
/**
 * P7. What the town gives its faith and its rank, read once a day a place: its land's faith (sim/belief) and how devout and
 * how given to rank its people are (sim/culture ways: piety, hierarchy); whether it has a shrine or a temple standing, and
 * a hall. Est. weights: a shrine is worth up to four to the devout, its want up to three; a hall up to two to its leaders,
 * its want up to five where rank is held high.
 */
export type PlaceRites = {
  readonly day: number;
  readonly faith: string | null;
  readonly piety: number;
  readonly hierarchy: number;
  readonly shrines: readonly number[];
  readonly hall: number;
  readonly rite: number;
  readonly rank: number;
};
const RITES = new WeakMap<Place, PlaceRites>();
export function placeRites(world: World, place: Place): PlaceRites {
  const day = Math.floor(place.t / DAY),
    was = RITES.get(place);
  if (was && was.day === day) return was;
  const ways = cultureOf(world).get(place.cell)?.traits,
    piety = ways?.[WAY.piety] ?? 0.5,
    hierarchy = ways?.[WAY.hierarchy] ?? 0.5,
    faith = beliefOf(world).of(place.cell).faith,
    b = place.bldgs,
    shrines: number[] = [];
  let hall = -1;
  for (let k = 0; k < b.lot.length; k++) {
    const kind = kindName(b.kind[k]!);
    if (kind === "shrine" || kind === "temple") shrines.push(b.lot[k]!);
    else if (kind === "hall" && hall < 0) hall = b.lot[k]!;
  }
  const r = {
    day,
    faith: faith ? (beliefOf(world).get(faith)?.name ?? null) : null,
    piety,
    hierarchy,
    shrines,
    hall,
    rite: !faith
      ? 0
      : shrines.length
        ? Math.round(4 * piety)
        : piety > 0.5
          ? -Math.round(6 * (piety - 0.5)) || -1
          : 0,
    rank:
      hall >= 0
        ? Math.round(2 * hierarchy)
        : hierarchy > 0.5
          ? -Math.round(10 * (hierarchy - 0.5)) || -1
          : 0,
  };
  RITES.set(place, r);
  return r;
}
/** P6. What each kind of bondage weighs on a mood (BONDS' order; est.: a chattel's the heaviest, an indenture's term the lightest). */
const BOND_MOOD = [-8, -3, -4, -2, -3] as const;
/**
 * P6. Who of a place is held in bondage, as its land's people are (sim/order/order.ts: the share of them in each kind,
 * read once a year a place), by a keyed draw on their number, and not those freed by your word (managed freed).
 */
export type PlaceBonds = {
  readonly shares: readonly number[];
  readonly freed: ReadonlySet<number>;
};
const BONDS_KEPT = new WeakMap<Place, { year: number; n: number; b: PlaceBonds }>();
export function placeBonds(world: World, place: Place): PlaceBonds {
  const year = Math.floor(place.t / YEAR),
    freed = managedOf(world)?.get(place.town)?.freed ?? [],
    was = BONDS_KEPT.get(place);
  if (was && was.year === year && was.n === freed.length) return was.b;
  const b = {
    shares: [...(orderOf(world)?.lands.get(place.cell)?.shares ?? [])],
    freed: new Set(freed),
  };
  BONDS_KEPT.set(place, { year, n: freed.length, b });
  return b;
}
/** The kind of bondage one of a place is held in (its place in BONDS; -1: free, or freed by your word). P6. */
export function placeBondOf(place: Place, id: number, b: PlaceBonds | undefined): number {
  if (!b || !b.shares.length || b.freed.has(id)) return -1;
  const u = (Math.imul(id ^ place.key ^ 0x5bd1e995, 0x85ebca6b) >>> 0) / 4294967296;
  let at = 0;
  for (let k = 0; k < b.shares.length; k++) {
    at += b.shares[k]!;
    if (u < at) return k;
  }
  return -1;
}
/** Whether one of a place was held in bondage and freed by your word (P6). */
export const placeFreed = (place: Place, id: number, b: PlaceBonds | undefined): boolean =>
  !!b?.freed.has(id) && placeBondOf(place, id, { shares: b.shares, freed: new Set() }) >= 0;
/**
 * P4. How much a table of one food alone weighs on a mood where others of the town eat of more, and one of more than one
 * (est.: about a plain pot against a fine one). Its households hold one food or two (first light, year 150: grain, and
 * meat and milk for one in ten of a herding town's), so two are a varied table.
 */
const FARE_ONE = -2,
  FARE_MANY = 3,
  FARE_MANY_FOODS = 2;
/** P4. What needing what one takes weighs on a mood, all the while (est.: half a crowded bench's). */
const CRAVING_MOOD = -4;
/**
 * P4. What its land's people take and how many need it (sim/money/intox.ts, read once a year a place): the share of them
 * who need it, the kind most taken, and what a tick's making by one who needs it is worth: their land's work lost to it
 * shared among those who need it (more where what wakes keeps them at it). Those of the town who need it are the share of
 * them its keyed draw takes, by number.
 */
export type PlaceDrink = { readonly share: number; readonly worth: number; readonly kind: number };
const DRINK = new WeakMap<Place, { year: number; d: PlaceDrink }>();
export function placeDrink(world: World, place: Place): PlaceDrink {
  const year = Math.floor(place.t / YEAR),
    was = DRINK.get(place);
  if (was && was.year === year) return was.d;
  const share = intoxDependent(world, place.cell),
    lost = intoxLost(world, place.cell),
    row = moneyStore(world, INTOX_STORE)?.get(place.cell);
  let kind = 0;
  for (let k = 1; k < 4; k++)
    if ((row?.[INTOX.use + k] ?? 0) > (row?.[INTOX.use + kind] ?? 0)) kind = k;
  const d = {
    share,
    worth: share > 0 ? Math.max(0.4, Math.min(1.2, 1 - lost / share)) : 1,
    kind,
  };
  DRINK.set(place, { year, d });
  return d;
}
/** P4. The most foods any household of a place holds, read once a day (its tables are told against it). */
const FARE = new WeakMap<Place, { day: number; most: number }>();
export function fareMost(place: Place, day: number): number {
  const was = FARE.get(place);
  if (was && was.day === day) return was.most;
  const h = place.houses;
  let most = 0;
  for (let k = 0; k < h.n; k++) {
    let n = 0;
    for (let f = 0; f < FOODS.length; f++) if (h.pantry[k * FOODS.length + f]! > 0) n++;
    if (n > most) most = n;
  }
  FARE.set(place, { day, most });
  return most;
}
/** Whether one of a place needs what its land takes (P4): its keyed draw on their number against the share who do. */
export const placeTakes = (place: Place, id: number, share: number): boolean =>
  share > 0 && (Math.imul(id ^ place.key, 0x9e3779b1) >>> 0) / 4294967296 < share;
/**
 * What a household's home gives it each day of two needs besides the hourly ones (asked 2026-11-26: "more needs where the
 * world has the means, such as warmth, comfort, beauty and company, each with a cause in the place"; warmth and company are
 * the hourly needs N.cold and N.lone, met by a roof and by company): comfort, its home's beds (rules/buildings.ts HOLDS, by
 * what stands on its lot) for all who sleep under it, crowded where a household that lost its home has found room under
 * another's or a town has outgrown its beds; and beauty, the finest of the town's works (N11) to be made out from its door,
 * where the town has any. Read once a day at its first tick, the same for every tier, and kept nowhere.
 */
type NeedsDay = {
  readonly day: number;
  /** Beds for each who sleeps under its home (1: as many as they; past it, room to spare). */
  readonly room: Float32Array;
  /** The lot of the finest work in sight of its door, and how fine (WORK_QUALITY's; -1: none). */
  readonly seen: Int32Array;
  readonly fine: Int8Array;
};
const NEEDS_DAY = new WeakMap<Place, NeedsDay>();
/**
 * How far from a door a work is made out (metres): a thing of a person's height at the arc an eye singles a thing out by
 * among others, a degree (est.).
 */
const WORK_SEEN = Math.round(1.7 / Math.tan(Math.PI / 180));
function needsDayOf(world: World, place: Place): NeedsDay {
  const p = place.people,
    houses = place.houses,
    n = houses.n,
    room = new Float32Array(n).fill(1),
    seen = new Int32Array(n).fill(-1),
    fine = new Int8Array(n).fill(-1),
    fab = townsOf(world).get(place.town),
    sleepers = new Map<number, number>();
  for (let i = 0; i < p.n; i++) {
    const lot = houses.home[p.house[i]!]!;
    if (lot >= 0) sleepers.set(lot, (sleepers.get(lot) ?? 0) + 1);
  }
  const beds = new Map<number, number>();
  if (fab)
    for (const lot of sleepers.keys()) {
      const level = lot < fab.next ? levelsOf(fab, lot, lot + 1)[0]! : -1;
      beds.set(lot, level >= 0 ? (HOLDS[level] ?? 5) : 0);
    }
  for (let h = 0; h < n; h++) {
    const lot = houses.home[h]!,
      b = beds.get(lot) ?? 0;
    if (lot >= 0 && b > 0) room[h] = b / Math.max(1, sleepers.get(lot) ?? 1);
  }
  // (The finest work to be made out from each door: works stand at lots of the town's laid plan.)
  if (place.works?.length) {
    layLots(world, place);
    const laid = LAID.get(place),
      w = place.works;
    if (laid && laid.lots > 0)
      for (let h = 0; h < n; h++) {
        const lot = houses.home[h]!;
        if (lot < 0 || lot >= laid.lots || !houses.members[h]) continue;
        for (let k = 0; k + 6 < w.length; k += 7) {
          const at = w[k]!,
            q = w[k + 6]!;
          if (at < 0 || at >= laid.lots || q <= fine[h]!) continue;
          const d = Math.hypot(laid.u[at]! - laid.u[lot]!, laid.v[at]! - laid.v[lot]!);
          if (d <= WORK_SEEN) {
            fine[h] = q;
            seen[h] = at;
          }
        }
      }
  }
  return { day: Math.floor(place.t / DAY), room, seen, fine };
}
/** The day's reading of its homes' comfort and beauty: kept by the tick, else read for the asking. */
function needsDay(world: World, place: Place, keep = false): NeedsDay {
  const was = NEEDS_DAY.get(place);
  if (was && was.day === Math.floor(place.t / DAY) && was.room.length === place.houses.n)
    return was;
  const d = needsDayOf(world, place);
  if (keep) NEEDS_DAY.set(place, d);
  return d;
}
/**
 * Comfort's weight on a mood: by the doublings of room each has (none at a bed each; crowded, the more the fewer beds; a
 * little at room to spare), as Classic weighs a home; beauty's by how fine the work and how much they wonder at things
 * (FACETS' wonder).
 */
const roomTerm = (room: number): number =>
  Math.max(-20, Math.min(4, Math.round(6 * Math.log2(room))));
const beautyTerm = (fine: number, wonder: number): number =>
  Math.round((1 + fine) * 2 * leans(wonder));
/**
 * A place's households read once a day at its first tick (so the same whoever asks, and whenever): each one's cook (the
 * grown one of it, up and about, who has given the most hours to cooking) and their level at it, and one of it abed.
 */
type HouseDay = {
  day: number;
  cook: Int32Array;
  level: Int8Array;
  abed: Int32Array;
};
const HOUSE_DAY = new WeakMap<Place, HouseDay>();
/**
 * What a place reads at its first tick of a day (its households' day, HouseDay; and, as they came, its things' stuffs a
 * year and its homes' comfort and beauty a day), kept in its save: each is read of the place as it stood at that tick,
 * and a place gone on with from a save made later in the day would read it anew of the place as it stands then.
 */
function readingsSaved(place: Place): Record<string, unknown> {
  const out: Record<string, unknown> = {},
    hd = HOUSE_DAY.get(place);
  if (hd) out.hday = [hd.day, ...hd.cook, ...hd.level, ...hd.abed];
  const st = STUFFS.get(place);
  if (st) out.stuffs = st;
  const nd = NEEDS_DAY.get(place);
  if (nd) out.nday = [nd.day, ...nd.room, ...nd.seen, ...nd.fine];
  return out;
}
function readingsLoaded(place: Place, raw: Record<string, unknown>): void {
  const hd = raw.hday as number[] | undefined;
  if (hd) {
    const n = (hd.length - 1) / 3;
    HOUSE_DAY.set(place, {
      day: hd[0]!,
      cook: Int32Array.from(hd.slice(1, 1 + n)),
      level: Int8Array.from(hd.slice(1 + n, 1 + 2 * n)),
      abed: Int32Array.from(hd.slice(1 + 2 * n)),
    });
  }
  if (raw.stuffs) STUFFS.set(place, structuredClone(raw.stuffs) as Stuffs);
  const nd = raw.nday as number[] | undefined;
  if (nd) {
    const n = (nd.length - 1) / 3;
    NEEDS_DAY.set(place, {
      day: nd[0]!,
      room: Float32Array.from(nd.slice(1, 1 + n)),
      seen: Int32Array.from(nd.slice(1 + n, 1 + 2 * n)),
      fine: Int8Array.from(nd.slice(1 + 2 * n)),
    });
  }
}
function houseDayOf(place: Place, f: Frame): HouseDay {
  const p = place.people,
    n = place.houses.n,
    cook = new Int32Array(n),
    level = new Int8Array(n),
    abed = new Int32Array(n),
    most = new Int32Array(n).fill(-1);
  for (let i = 0; i < p.n; i++) {
    const h = p.house[i]!;
    if (p.health[i] === 1 || p.health[i] === 2) {
      if (!abed[h]) abed[h] = p.id[i]!;
      continue;
    }
    if (ageOf(p, i, place.t) < f.life.adulthood) continue;
    const hours = hoursAt(p, i, SK.cooking);
    if (hours > most[h]!) {
      most[h] = hours;
      cook[h] = p.id[i]!;
      level[h] = levelOf(Math.floor(hours / 6));
    }
  }
  return { day: Math.floor(place.t / DAY), cook, level, abed };
}
/** The day's reading of its households: kept by the tick (dayOf: true), else read for the asking and not kept. */
function houseDay(place: Place, f: Frame, keep = false): HouseDay {
  const was = HOUSE_DAY.get(place),
    today = Math.floor(place.t / DAY);
  // (A household made since the day's reading has none of it till the next: its cook and its abed read as none.)
  if (was && was.day === today) return was;
  const d = houseDayOf(place, f);
  if (keep) HOUSE_DAY.set(place, d);
  return d;
}
/**
 * What bears on one's mood now, each by how much, weighed by their own temper (placeTemper): from needs met over the days
 * gone and what befell their household. The mood goes a quarter of the way to where these put it each day (tick).
 */
function moodTerms(
  place: Place,
  i: number,
  lackDays: number,
  today: number,
  fk: Frame,
  /** Read to be told (the inspector): each memory's source found where it is not kept. */
  told = false,
  /** The day's comfort and beauty of its homes (NeedsDay; absent: none read). */
  nd: NeedsDay | undefined = NEEDS_DAY.get(place),
): MoodTerm[] {
  const p = place.people,
    houses = place.houses,
    h = p.house[i]!,
    temper = placeTemper(place, i),
    out: MoodTerm[] = [],
    hd = houseDay(place, fk);
  // Comfort and beauty: their home's beds for all under it, and a fine work in sight of its door.
  if (nd && h < nd.room.length) {
    const home = houses.home[h]!,
      room = roomTerm(nd.room[h]!);
    if (room && home >= 0)
      out.push({
        bit: 0,
        cond: COND.room,
        size: room,
        days: null,
        src: srcLot(home),
      });
    if (nd.fine[h]! >= 0)
      out.push({
        bit: 0,
        cond: COND.beauty,
        size: beautyTerm(nd.fine[h]!, placeFacets(place, i)[5]!),
        days: null,
        src: srcLot(nd.seen[h]!),
      });
  }
  if (lackDays >= 0.25)
    out.push({
      bit: MOOD.want,
      size: -(Math.min(70, 25 * lackDays + 15) * leans(1 - temper.bold)),
      days: null,
    });
  // (Sick, by a quarter; hurt, by how much it hurts them: a wound fresh and open, a festering, N9.)
  if (p.health[i])
    out.push({
      bit: MOOD.ailing,
      size: p.health[i] === 2 ? -25 : -(10 + 40 * placeWound(place, i).pain),
      days: Math.ceil(p.ill[i]! / 144),
    });
  if (houses.grief[h]! >= 0 && today - houses.grief[h]! <= 30) {
    // (Whose death: the last of their household the log tells dead.)
    let dead = 0;
    for (let k = place.log.length - 1; k >= 0 && !dead; k--) {
      const x = place.log[k]!;
      if (
        HAP_DEATH.has(x.what) &&
        x.k === houses.key[h] &&
        Math.floor(x.t / DAY) >= houses.grief[h]! - 1
      )
        dead = x.id;
    }
    out.push({
      bit: MOOD.bereaved,
      size: -(35 * leans(temper.kin)),
      days: 31 - (today - houses.grief[h]!),
      src: dead,
    });
  }
  let pantry = 0,
    foods = 0;
  for (let k = 0; k < FOODS.length; k++) {
    const x = houses.pantry[h * FOODS.length + k]!;
    pantry += x;
    if (x > 0) foods++;
  }
  // (Their table, P4: the foods their pantry holds; one food alone weighs only where others of the town eat of many.)
  if ((foods === 1 && fareMost(place, today) >= FARE_MANY_FOODS) || foods >= FARE_MANY_FOODS)
    out.push({
      bit: 0,
      cond: COND.fare,
      size: foods === 1 ? FARE_ONE : FARE_MANY,
      days: null,
      ...(houses.home[h]! >= 0 ? { src: srcLot(houses.home[h]!) } : {}),
    });
  // (Their faith's rites and their rank, P7: for the grown.)
  const rites = RITES.get(place);
  if (rites && ageOf(p, i, place.t) >= fk.life.adulthood) {
    if (rites.rite)
      out.push({
        bit: 0,
        cond: COND.rite,
        size: rites.rite,
        days: null,
        ...(rites.shrines.length ? { src: srcLot(rites.shrines[0]!) } : {}),
      });
    if (rites.rank && (occOf(p, i) === OCC.leader || place.figId.includes(p.id[i]!)))
      out.push({
        bit: 0,
        cond: COND.rank,
        size: rites.rank,
        days: null,
        ...(rites.hall >= 0 ? { src: srcLot(rites.hall) } : {}),
      });
  }
  // (Held in bondage, P6.)
  const bond = placeBondOf(place, p.id[i]!, BONDS_KEPT.get(place)?.b);
  if (bond >= 0) out.push({ bit: 0, cond: COND.bound, size: BOND_MOOD[bond] ?? -3, days: null });
  // (What they take and need, P4.)
  if (
    ageOf(p, i, place.t) >= fk.life.adulthood &&
    placeTakes(place, p.id[i]!, DRINK.get(place)?.d.share ?? 0)
  )
    out.push({ bit: 0, cond: COND.craving, size: CRAVING_MOOD, days: null });
  if (pantry >= houses.members[h]! * fk.daily * FETCH_DAYS)
    out.push({ bit: MOOD.pantry, size: 15 * leans(temper.thrifty), days: null });
  if (p.friend[i])
    out.push({
      bit: MOOD.friend,
      size: (10 + 15 * fk.social) * leans(temper.sociable),
      days: null,
      src: p.friend[i]!,
    });
  if (houses.fresh[h]! >= 0 && today - houses.fresh[h]! <= 30)
    out.push({ bit: MOOD.home, size: 20, days: 31 - (today - houses.fresh[h]!) });
  if (houses.lost[h]! >= 0 && today - houses.lost[h]! <= 60)
    out.push({
      bit: MOOD.homeless,
      size: -(30 * leans(1 - temper.bold)),
      days: 61 - (today - houses.lost[h]!),
    });
  if (p.bound[i] && p.bound[i]! < BOUND_ARMS)
    out.push({ bit: MOOD.ordered, size: -(10 * leans(1 - temper.bidden)), days: null });
  // How they live (COND): their household's cooking, if they eat at its hearth; at the work they were taught, or kept
  // from it; one of their household abed, or a friend.
  const grown = ageOf(p, i, place.t) >= fk.life.adulthood;
  if (pantry > 0 && hd.cook[h]) {
    const size = 2 * hd.level[h]! - 2;
    if (size) out.push({ bit: 0, cond: COND.cook, size, days: null, src: hd.cook[h]! });
  }
  if (grown && p.taught[i] && occOf(p, i) !== OCC.dependent) {
    const own = tradeKind(occOf(p, i)) === p.taught[i]! - 1;
    out.push({
      bit: 0,
      cond: own ? COND.passion : COND.kept,
      size: own ? 6 : -3,
      days: null,
    });
  }
  // (Their post in a building past what its floor takes: crowded at the yard and the door, while it holds. O4.)
  if (grown && p.work[i]! >= 0 && benchless(place)[i])
    out.push({ bit: 0, cond: COND.crowded, size: -CROWDED_MOOD, days: null });
  if (hd.abed[h] && hd.abed[h] !== p.id[i])
    out.push({
      bit: 0,
      cond: COND.kinAbed,
      size: -(8 * leans(temper.kin)),
      days: null,
      src: hd.abed[h]!,
    });
  if (p.friend[i]) {
    const j = placeIndexOf(place, p.friend[i]!);
    if (j >= 0 && p.house[j] !== h && (p.health[j] === 1 || p.health[j] === 2))
      out.push({
        bit: 0,
        cond: COND.friendAbed,
        size: -(5 * leans(temper.sociable)),
        days: null,
        src: p.friend[i]!,
      });
  }
  // What they remember, as it has faded; and the days till it is let go: for one followed in full, every one of it with
  // its source (Place.deep), else their columns'.
  const d = (p.tier[i]! & 3) === TIER.full ? place.deep?.get(p.id[i]!) : undefined,
    mem = d ? d.th : p.thought,
    from = d ? 0 : i * THOUGHTS,
    to = d ? DEEP_THOUGHTS : (i + 1) * THOUGHTS;
  // The things they hold (one in full): each against what the town's middling hands make, or worn out; of its maker.
  const st = d?.filled ? STUFFS.get(place) : undefined;
  if (d && st)
    for (const x of d.items) {
      const size = gearTerm(st, x);
      if (size)
        out.push({
          bit: 0,
          cond: x.k === GEAR.tool ? COND.tool : x.k === GEAR.garment ? COND.garment : COND.pot,
          size,
          days: null,
          src: x.maker,
        });
    }
  for (let k = from; k < to; k++) {
    const v = mem[k]!;
    if (!v) continue;
    const now = thoughtNow(v, today);
    if (Math.abs(now) < 1) continue;
    const half = THOUGHT_HALF[thoughtKind(v)] ?? 30;
    out.push({
      bit: 0,
      size: now,
      days: Math.max(
        1,
        Math.ceil(half * Math.log2(Math.abs(thoughtSize(v)))) - thoughtAge(v, today),
      ),
      thought: thoughtKind(v),
      // (Where they are not followed in full, found as it would be on coming into full, for the telling only.)
      src: d ? d.src[k]! : told ? sourceFound(place, i, v) : 0,
    });
  }
  return out;
}
/** What bears on one of a place's people's mood now, as their next day's turn will weigh it (read only). */
export function placeMoodTerms(world: World, place: Place, i: number): MoodTerm[] {
  return moodTerms(
    place,
    i,
    place.people.lack[i]! / 144,
    Math.floor(place.t / DAY),
    frameFor(world, place, i),
    true,
    needsDay(world, place),
  );
}
/** Each household's comfort and beauty today (read only; NeedsDay's): beds for each under its home, the finest work in sight. */
export function placeNeedsDay(
  world: World,
  place: Place,
): { room: Float32Array; fine: Int8Array; seen: Int32Array } {
  const d = needsDay(world, place);
  return { room: d.room, fine: d.fine, seen: d.seen };
}
/** One's household's comfort and beauty now (read only): beds for each under their home, and the finest work in sight. */
export function placeNeedsMore(
  world: World,
  place: Place,
  i: number,
): { room: number; beds: number; under: number; fine: number; seen: number } {
  const nd = needsDay(world, place),
    h = place.people.house[i]!,
    home = place.houses.home[h]!;
  let under = 0;
  for (let j = 0; j < place.people.n; j++)
    if (place.houses.home[place.people.house[j]!] === home) under++;
  const room = nd.room[h] ?? 1;
  return {
    room,
    beds: Math.round(room * under),
    under,
    fine: nd.fine[h] ?? -1,
    seen: nd.seen[h] ?? -1,
  };
}
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

/**
 * A place's day (N7, rules/leisure.ts as its land reckons it each year, sim/society/everyday.ts leisureYear): how long its
 * working day is (a worker works until what his work earns keeps him and his: the longer the nearer his earnings lie to his
 * bread), from when to when (hours of its day: from an hour after its first light), whether today is a day of rest and which (its
 * holy days by its piety, its feasts by what it has to spare, and the days any people rests), and the games its people
 * play. Out of its working day and on a day of rest, work is worth little to them, and they rest or play.
 */
export type PlaceDay = {
  readonly hours: number;
  readonly from: number;
  readonly to: number;
  readonly rest: "holy" | "feast" | "rest" | null;
  readonly days: { readonly holy: number; readonly feasts: number; readonly all: number };
  /** Its games (rules/leisure.ts GAMES bits). */
  readonly games: number;
  /** What bread costs of what a day's work earns in its land (0 … 1; null: not reckoned, its day a third of the day's). */
  readonly need: number | null;
};
/** What work is worth to one out of their working day, or on a day of rest, against what it is worth in it. */
export const OFF_WORTH = 0.1;
/** Whether work out of the working day is worth less than an hour's rest to anyone (so that it need not be reckoned). */
const OFF_IDLE = WORTH_MOST * OFF_WORTH < IDLE_WORTH;
/**
 * What an hour's play is worth to one at it, against a need that would send them off (an hour's rest at home is worth
 * IDLE_WORTH): the games and the company keep them out a while yet, tired as the day has left them.
 */
export const PLAY_WORTH = 0.4;
/** How long after first light a working day begins (hours): time to rise and eat. */
const WORK_AFTER_DAWN = 1;
export function placeDayOf(world: World, place: Place, t = place.t): PlaceDay {
  const f = frameOf(world, place.cell),
    { season } = clockOf(f, t),
    // (Its working day begins with the light, as its sun rises today: where its people wake.)
    light = f.lit[1] + (f.lit[0] - f.lit[1]) * ((1 - Math.cos(2 * Math.PI * season)) / 2),
    from = 24 * (0.5 - light / 2) + WORK_AFTER_DAWN,
    row = societyStore(world, LEISURE_STORE)?.get(place.cell),
    hours = row ? row[LEISURE_ROW.hours]! / 10 : 24 * WORK_SHARE,
    days = row
      ? {
          holy: row[LEISURE_ROW.holy]!,
          feasts: row[LEISURE_ROW.feasts]!,
          all: LEISURE.rest + row[LEISURE_ROW.holy]! + row[LEISURE_ROW.feasts]!,
        }
      : restDays(0.5, 0.5),
    // (Its days of rest spread evenly through its year, and each of them holy, a feast or a plain rest as its land keeps
    // them in a year, in a fixed order: the golden ratio's, so that none falls in a run.)
    d = Math.floor(t / DAY),
    share = Math.min(1, days.all / 365),
    k = Math.floor(d * share),
    off = Math.floor((d + 1) * share) > k,
    x = (k * 0.6180339887) % 1,
    rest = !off
      ? null
      : x < days.holy / days.all
        ? "holy"
        : x < (days.holy + days.feasts) / days.all
          ? "feast"
          : "rest";
  return {
    hours,
    from,
    to: from + hours,
    rest,
    days,
    games: row ? row[LEISURE_ROW.games]! : 0,
    need: row ? row[LEISURE_ROW.need]! / 1000 : null,
  };
}
/** Whether a moment is in a place's working day: not a day of rest, and between its hours. */
const hourOf = (t: number): number => ((((t % DAY) + DAY) % DAY) / DAY) * 24;
const inWorkDay = (day: PlaceDay, t: number): boolean => {
  const h = hourOf(t);
  return day.rest === null && h >= day.from && h < day.to;
};
/**
 * One of a place's people's day as it falls today, an hour at a time from midnight: at work (their working day, where they
 * keep a trade), at play (their day's work done, or a day of rest, by light), or at home (asleep or at rest). What their
 * needs press on them comes first, as it does in the hour.
 */
export function placeDayStrip(world: World, place: Place, i: number): ("work" | "play" | "home")[] {
  const f = frameOf(world, place.cell),
    d0 = Math.floor(place.t / DAY) * DAY,
    day = placeDayOf(world, place, place.t),
    works = occOf(place.people, i) !== OCC.dependent;
  return Array.from({ length: 24 }, (_, h) => {
    const t = d0 + h * HOUR + HOUR / 2;
    if (works && inWorkDay(day, t)) return "work";
    return airOf(f, t).lit && !inWorkDay(day, t) && (day.rest !== null || h + 0.5 >= day.to)
      ? "play"
      : "home";
  });
}
/** What one of a place's people is doing, said ("at work", "at games"). */
export function actWords(p: Place["people"], i: number): string {
  return p.why[i] === WHY.play && p.act[i] === ACT.visit
    ? "at games"
    : (ACT_WORDS[p.act[i]!] ?? "");
}

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

/**
 * What a tick of a place reads for each of its people's turn (turnOf), reckoned once a tick: its hour and its air, its
 * orders, its stores, its fire and its burial, its sites, its day; and its own ways of reckoning what each of its people
 * asks of it. (Each one's turn was the body of one loop in the tick, a function of nine hundred lines: a branch first
 * taken threw the whole of it back to be compiled again, and an hour of a town of 5,500 just entered took half a second.)
 */
function tickCx(world: World, place: Place, f: Frame) {
  const p = place.people,
    { houses, bldgs, matched } = place,
    t = place.t,
    air = airOf(f, t),
    cold = coldOf(f, air.warmth),
    // (Out of doors one grows as cold as the air is, in a couple of hours, and no colder: mild air chills a little and
    // stops there. It ran on to the full in any chill at all, and those left without a roof in mild weather died of it.)
    // (Less what the town's clothes keep off: P5, dressWarmth.)
    dressed = 1 - dressWarmth(world, place),
    coldTo0 = Math.round(cold * dressed * FULL),
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
    // Its bills (N10): the units of each good it is to hold (-1: no bill), the goods billed in their order, and what it
    // holds of each and how it makes each now, read as a tick first asks; and what its stores will not take (its market's
    // by the good, its granary's by GOOD_COUNT and the good).
    keepTo = orders?.bills ? billsOf(orders.bills) : null,
    billOrder = orders?.bills ? orders.bills.filter((_, k) => k % 2 === 0) : null,
    heldNow = orders?.bills ? new Float64Array(GOOD_COUNT).fill(-1) : null,
    madeBy = orders?.bills ? new Int16Array(GOOD_COUNT).fill(-1) : null,
    refused = orders?.refuse ? refusedOf(orders.refuse) : null,
    // (Where food carried to store goes: its granary, else its market, where each will take it; else it stays at home.)
    foodTo = (g: number, home: number): number =>
      !refused
        ? bldgs.lot[foodStore]!
        : foodStore !== market && !refused.has(GOOD_COUNT + g)
          ? bldgs.lot[foodStore]!
          : !refused.has(g)
            ? bldgs.lot[market]!
            : home,
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
    // (What each of them died of: of want, or of a wound, N9.)
    dyingWhy: number[] = [],
    // (Buildings whose work is stopped by order.)
    shut = orders?.shut.length ? new Set(orders.shut) : null,
    // Its zones by order (O2): its lots kept clear, and where those of each home go for company and their games.
    zoned = orders?.zones?.length ? zonesOf(place, orders.zones) : null,
    // (Where those standing to arms stand by its order: O7. Undefined: the square.)
    post = orders?.post,
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
    apartLeft = apart ? 1 - (LESSON_RESPONSE.get("quarantine")?.most ?? 0) : 1,
    // Its day (rules/leisure.ts): in its working day work is worth what it is; out of it, and on a day of rest, little.
    today0 = placeDayOf(world, place, t),
    working = inWorkDay(today0, t),
    offWork = working ? 1 : OFF_WORTH,
    // (Their day's work done, or a day of rest, by light: the hours they play in.)
    playing = air.lit && !working && (today0.rest !== null || hourOf(t) >= today0.to);
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
    meetDay(world, place);
    // (Whom its healer has seen of the festering is begun again each day.)
    if (place.tended) place.tended = [place.day];
    // (Its works wear away, a fiftieth a year: rules/art.ts ART.wear. Those broken down or held who are gone, let go.)
    if (place.works) wearWorks(world, place);
    if (place.breaks || place.held) pruneGone(place);
    if (place.pins) prunePins(place);
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
          // (What its market will not take stays where it was made: N10.)
          if (bldgs.stock[b * GOOD_COUNT + g]! >= LOAD * MICRO && !refused?.has(g))
            hauls.push([b, g]);
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
    coldTos = fs ? fs.map((x) => Math.round(coldOf(x, air.warmth) * dressed * FULL)) : null,
    // (What a building's walls let in of the cold, where no fire is kept in it: P5, roomLets.)
    lets = cold > 0 ? roomLets(place) : null,
    darks = fs ? fs.map((x) => (air.lit ? 1 : 1 - 0.7 * x.sight)) : null;
  // (Its columns as each one's turn reads them, taken out of its people once a tick.)
  const cAct = p.act,
    cWhy = p.why,
    cAt = p.at,
    cNeeds = p.needs,
    cCarry = p.carry,
    cId = p.id,
    cCarryGood = p.carryGood,
    cHealth = p.health,
    cIll = p.ill,
    cHouse = p.house,
    cLack = p.lack,
    cEta = p.eta,
    cOwed = p.owed,
    cBound = p.bound,
    cSexOcc = p.sexOcc;
  // Its healer (N9), where its land knows herb-lore: chosen again where there is none, or theirs is abed or gone.
  const hospital = buildingOf(place, ["hospital"]) > 0;
  let healerAt = matched.healer && place.healer ? placeIndexOf(place, place.healer) : -1;
  if (!matched.healer) place.healer = undefined;
  else if (healerAt < 0 || p.health[healerAt] === 1 || p.health[healerAt] === 2) {
    healerAt = healerOf(place, f);
    place.healer = healerAt >= 0 ? p.id[healerAt]! : undefined;
  }
  // (Those at home, by household: asked only where one lies with a wound undressed.)
  let atHome: Map<number, number[]> | null = null;
  const homeFolk = (h: number): readonly number[] => {
    if (!atHome) {
      atHome = new Map();
      for (let q = 0; q < p.n; q++)
        if (!p.eta[q] && p.at[q] === houses.home[p.house[q]!])
          (atHome.get(p.house[q]!) ?? atHome.set(p.house[q]!, []).get(p.house[q]!)!).push(q);
    }
    return atHome.get(h) ?? [];
  };
  return {
    world,
    place,
    f,
    p,
    houses,
    bldgs,
    matched,
    t,
    air,
    cold,
    coldTo0,
    chill,
    warmUp,
    dark0,
    perTick,
    win,
    ripens,
    foodStore,
    market,
    mean,
    trades,
    orders,
    reserve,
    barred,
    free,
    madeOf,
    usedOf,
    tickNo,
    today,
    dying,
    shut,
    fireLot,
    riteLot,
    riteHouse,
    fireOut,
    apart,
    apartLeft,
    today0,
    working,
    offWork,
    playing,
    keepDays,
    sickHouses,
    sitesNow,
    ailing,
    visitor,
    zoned,
    post,
    lets,
    drink: placeDrink(world, place),
    bonds: placeBonds(world, place),
    rites: placeRites(world, place),
    // (The last come for company to each meeting place this tick, as `visitor` is the square's: O2.)
    visitAt: zoned?.meets.length ? new Map<number, number>() : null,
    // (Tiers: how far into their stride the tick a turn is at stands (`base`), how far past that tick a turn that goes on
    // within it stands, in ticks, and the ticks till the working day
    // begins or ends from this tick, read once a tick when first asked: -1 not yet.)
    ahead: 0,
    base: 0,
    flip: -1,
    // (Whether a feast day is kept as one: -1 not yet asked this tick.)
    feast: -1,
    // (Asked for by the first turn that needs it, and kept for the rest of the tick.)
    hasGrown: hasGrown as Uint8Array | null,
    setDown,
    wantsNow,
    haulsNow,
    prios,
    tickWin,
    turnPlace,
    hasWork,
    turns,
    eat,
    fs,
    coldTos,
    darks,
    cAct,
    cWhy,
    cAt,
    cNeeds,
    cCarry,
    cId,
    cCarryGood,
    cHealth,
    cIll,
    cHouse,
    cLack,
    cEta,
    cOwed,
    cBound,
    cSexOcc,
    dyingWhy,
    hospital,
    healerAt,
    homeFolk,
    keepTo,
    billOrder,
    heldNow,
    madeBy,
    foodTo,
    breakOf: place.breaks?.length ? byId(place.breaks, 3) : null,
    heldOf: place.held?.length ? byId(place.held, 3) : null,
    worksAt: place.works?.length ? worksByLot(place) : null,
  };
}
type TickCx = ReturnType<typeof tickCx>;

/** One of a place's people's turn in a tick: their needs move, and they do what presses most. */
/**
 * One of a place's people's turn: what the ticks since their last turn did to them (`k` of them: their needs, their
 * want, a wound's bleeding, their mending; 0, a turn between their strides, on coming where they were going), and what
 * they do now, for the `wk` ticks till their next turn (their work's yield and its hours; 0: a turn that only decides).
 * In full, a tick each (1, 1). Tiers.
 */
function turnOf(cx: TickCx, i: number, k: number, wk: number): void {
  const {
    world,
    place,
    f,
    p,
    houses,
    bldgs,
    matched,
    t,
    air,
    cold,
    coldTo0,
    chill,
    warmUp,
    dark0,
    perTick,
    win,
    ripens,
    foodStore,
    market,
    mean,
    trades,
    orders,
    barred,
    free,
    madeOf,
    usedOf,
    tickNo,
    today,
    dying,
    shut,
    fireLot,
    riteLot,
    riteHouse,
    fireOut,
    apart,
    apartLeft,
    today0,
    working,
    offWork,
    playing,
    keepDays,
    sickHouses,
    sitesNow,
    ailing,
    setDown,
    wantsNow,
    haulsNow,
    prios,
    tickWin,
    turnPlace,
    hasWork,
    turns,
    eat,
    fs,
    coldTos,
    darks,
    cAct,
    cWhy,
    cAt,
    cNeeds,
    cCarry,
    cId,
    cCarryGood,
    cHealth,
    cIll,
    cHouse,
    cLack,
    cEta,
    cOwed,
    cBound,
    cSexOcc,
    dyingWhy,
    hospital,
    healerAt,
    homeFolk,
    keepTo,
    foodTo,
    breakOf,
    heldOf: heldBy,
    worksAt,
    zoned,
  } = cx;
  const kind = fs ? (houses.kind[cHouse[i]!] ?? 0) : 0,
    fk = fs ? (fs[kind] ?? f) : f,
    coldTo = coldTos ? (coldTos[kind] ?? coldTo0) : coldTo0,
    dark = darks ? (darks[kind] ?? dark0) : dark0;
  const at0 = i * NEEDS,
    asleep = cAct[i] === ACT.sleep,
    h = cHouse[i]!,
    home0 = houses.home[h]!,
    // (A home kept clear by your order: its household shelters at the meeting place nearest it, else the square. O2.)
    home = zoned?.clear.has(home0) ? meetFor(place, zoned, home0) : home0,
    moving = cEta[i]! > 0,
    inside = !moving && cAt[i]! !== AT.fields && cAt[i]! !== AT.square && cAt[i]! !== AT.walls;
  // (What the fields and the flocks give comes by the calendar, to each hand its land counts at them.)
  // (Not to one put to a site or standing to arms: what those do not bring in, its land's harvest already bears.)
  const trade = cSexOcc[i]! & 15;
  if (cBound[i]! >= BOUND_ARMS && cBound[i] !== 255) {
    // (nothing)
  } else if (trade === OCC.farmer) place.ripe[G.grain]! += ripens[0]! * k;
  else if (trade === OCC.herder) place.ripe[G.meat]! += ripens[1]! * k;
  // Needs, for the ticks of their stride not yet reckoned (tiers: all of them, for one in full).
  if (k > 0) {
    const rk = cx.p.reck[i]!;
    if (k > rk) accrue(cx, i, k - rk, fk, coldTo, asleep, moving, inside);
    // (One raised into full within a stride may stand reckoned some ticks ahead: those are not reckoned again.)
    if (rk) cx.p.reck[i] = rk > k ? rk - k : 0;
  }
  // Want: a need of the body's standing full. How long it has, less how long it has not since.
  const inWant =
    cNeeds[at0 + N.food]! >= 0.95 * FULL ||
    cNeeds[at0 + N.rest]! >= 0.95 * FULL ||
    cNeeds[at0 + N.cold]! >= 0.95 * FULL;
  cLack[i] = inWant ? Math.min(65535, cLack[i]! + k) : Math.max(0, cLack[i]! - k);
  const lackDays = cLack[i]! / 144;
  // Days in want bring sickness and death, by their people's own table of dying, the more the longer: asked of each
  // once a day. Only in a town managed: there its dead are told to its land (place.settle), elsewhere its land's own
  // reckoning says who dies.
  // (Once a day: at the turn of theirs that falls on it, whatever their stride.)
  if (orders && lackDays >= 1 && (tickNo + cId[i]!) % 144 < k) {
    const base = (f.life.mortality[bandOf(ageOf(p, i, t), f.life)] ?? 0.02) / 365,
      chance = Math.min(0.5, base * (1 + lackDays) ** 3);
    if (world.rng.chance(chance, PLACE_DRAW, place.key ^ cId[i]!, tickNo, P.sick)) {
      dying.push(i);
      dyingWhy.push(HAP.starved);
      return;
    }
  }
  // A wound bleeding (N9): their blood lost by the tick, the less as it clots (by half each ten minutes: rules/healing.ts).
  // Past what a body can lose, dead of it where the town is managed (its dead are told to its land, as those of want);
  // elsewhere its land's own reckoning says who dies, and they lie at the edge of it.
  for (let s = 0; s < k && p.bleed[i]; s++) {
    const lost = Math.min(BLOOD_UNITS, p.blood[i]! + p.bleed[i]!);
    p.bleed[i] = p.bleed[i]! >> 1;
    if (lost >= BLOOD_FATAL && orders) {
      p.blood[i] = lost;
      dying.push(i);
      dyingWhy.push(HAP.bled);
      return;
    }
    p.blood[i] = Math.min(lost, BLOOD_FATAL - 1);
  }
  // Once a day, each in turn: their mood, and what may befall them.
  if ((tickNo + cId[i]!) % 144 < k) {
    // (Their blood made again, a little a day, once they bleed no more: rules/healing.ts BLOOD.back.)
    if (p.blood[i] && !p.bleed[i])
      p.blood[i] = Math.max(0, p.blood[i]! - Math.round(BLOOD.back * BLOOD_UNITS));
    // A wound abed festers or it does not, and a festering grows, or is fought off (N9).
    if (cHealth[i] === 1 && festerDay(cx, i)) {
      dying.push(i);
      dyingWhy.push(HAP.festered);
      return;
    }
    // Two friends, both grown and neither paired, of two households and of one people: promised, and paired on a day
    // of the weeks to come (asked of the one numbered lower).
    if (p.friend[i]! > cId[i]! && !p.mate[i] && ageOf(p, i, t) >= f.life.adulthood) {
      const j = placeIndexOf(place, p.friend[i]!);
      if (
        j >= 0 &&
        !p.mate[j] &&
        cHouse[j] !== h &&
        sexOf(p, j) !== sexOf(p, i) &&
        ageOf(p, j, t) >= f.life.adulthood &&
        (houses.kind[cHouse[j]!] ?? 0) === (houses.kind[h] ?? 0)
      ) {
        p.mate[i] = p.mate[j] = PROMISED;
        dueAt(
          place,
          t +
            (1 + Math.floor(world.rng.unit(PLACE_DRAW, place.key ^ cId[i]!, t, P.due) * 27)) * DAY,
          DUE.pair,
          cId[i]!,
          cId[j]!,
        );
      }
    }
    // Two paired who can no longer abide each other part (Q2), asked of the one numbered lower.
    // (Their regard first: one not followed in full has no reasons past it, and mates are both grown, so no kin's term; most
    // think too well of their mate to part.)
    const mate = p.mate[i]!;
    if (
      mate &&
      mate !== PROMISED &&
      mate > cId[i]! &&
      (regardOf(p, i, mate) <= PART_AT || (p.tier[i]! & 3) === TIER.full)
    ) {
      const m = placeIndexOf(place, mate);
      if (
        m >= 0 &&
        opinionNow(place, i, m, today) <= PART_AT &&
        opinionNow(place, m, i, today) <= PART_AT
      )
        partWays(place, i, m);
    }
    // (Each day their own work is looked to again: back to it once it has something for them.)
    if (p.turn[i] && hasWork(i, cSexOcc[i]! & 15)) p.turn[i] = 0;
    // Mood, from needs met over the days gone and what befell their household: a quarter of the way to where those
    // put it, each day. A body that lives closer together leans more on its friends.
    // (And by their own temper: what each of these weighs with them, against most. rules/temper.ts.)
    let why = 0,
      to = MOOD_BASE;
    const dp = deepOf(place, i);
    if (dp) {
      for (let k = 0; k < DEEP_THOUGHTS; k++)
        if (dp.th[k] && Math.abs(thoughtNow(dp.th[k]!, today)) < 1) dp.th[k] = dp.src[k] = 0;
      reasonsFaded(place, i, dp, today);
      // (Their things: filled on coming into full, then worn by the day's use, and made anew when worn out.)
      if (!dp.filled) {
        dp.items = gearFilled(world, place, i, fk);
        dp.worked = p.skill[i]!;
        dp.filled = true;
      } else gearDay(world, place, i, dp, fk);
    }
    for (const x of moodTerms(place, i, lackDays, today, fk)) {
      why |= x.bit;
      to += x.size;
    }
    p.moodWhy[i] = why;
    // (What has faded past a point is let go.)
    for (let k = i * THOUGHTS; k < (i + 1) * THOUGHTS; k++)
      if (p.thought[k] && Math.abs(thoughtNow(p.thought[k]!, today)) < 1) p.thought[k] = 0;
    p.mood[i] = Math.max(-100, Math.min(100, Math.round(p.mood[i]! + (to - p.mood[i]!) / 4)));
    // A mood too low to bear breaks, the oftener the deeper (N11).
    if (
      p.mood[i]! < MOOD_UNHEEDING &&
      !cHealth[i] &&
      !breakOf?.has(cId[i]!) &&
      !heldBy?.has(cId[i]!) &&
      ageOf(p, i, t) >= f.life.adulthood &&
      breakDay(cx, i)
    )
      return;
    // In want with a bare pantry and low of mood, one may steal from a household about their street (theft).
    if (
      lackDays >= 1 &&
      p.mood[i]! < 0 &&
      !cHealth[i] &&
      !breakOf?.has(cId[i]!) &&
      !heldBy?.has(cId[i]!) &&
      ageOf(p, i, t) >= f.life.adulthood &&
      theftDay(cx, i, lackDays, fk)
    )
      return;
    if (!cHealth[i]) {
      const sick = ailing(),
        // (One in want takes a sickness the sooner.)
        takes = sick ? sick.chance * (1 + lackDays) * apartLeft : 0;
      if (takes > 0 && world.rng.chance(takes, PLACE_DRAW, place.key ^ cId[i]!, tickNo, P.ail)) {
        // (Abed for the days a sickness takes, the fewer the more its land knows of care and the better it is tended.)
        cHealth[i] = 2;
        p.cause[i] = CAUSE.sickness + sick!.at;
        cIll[i] = Math.max(
          1,
          Math.round(
            HEAL_DAYS.scarred[0] *
              HEAL_TENDED[tendedOf(place, i)] *
              (1 - HEAL_CARE * (matched.care ?? 0)) *
              144,
          ),
        );
        note(place, HAP.sick, cId[i]!, sick!.at);
      } else if (
        cAct[i] === ACT.work &&
        world.rng.chance(
          (hazardOf(place, occOf(p, i), p.craft[i]!) / 365) *
            skillHazard(
              levelOf(Math.floor(hoursAt(p, i, tradeKind(p.turn[i]! || occOf(p, i))) / 6)),
            ),
          PLACE_DRAW,
          place.key ^ cId[i]!,
          tickNo,
          P.hurt,
        )
      ) {
        // (A hurt at work: where, and what comes of it, by the blow it was; abed as such a wound is. rules/healing.ts.)
        wound(world, place, i, CAUSE.accident);
        note(place, HAP.hurt, cId[i]!, occOf(p, i));
      }
    }
  }
  // (One taken sick or wounded at a turn of their stride: followed in full from it, as they would be had it befallen them
  // a turn before; a turn of theirs falls on a tick every stride shares. Tiers.)
  if (wk > 1 && k > 0 && (cHealth[i] === 1 || cHealth[i] === 2 || p.bleed[i])) {
    p.tier[i] = TIER.full;
    wk = 1;
  }
  if (moving) {
    // (A turn that only decides, between ticks, walks no step: the walk is by the tick. Tiers.)
    if (k > 0 && --cEta[i]! === 0) {
      cAt[i] = p.to[i]!;
      p.trip[i] = 0;
      // (Come where they were going within a stride: the rest of it at what they came for. Tiers.)
      if (wk > 1) goOn(cx, i, 1, wk - 1);
    }
    return;
  }
  // Up again with a wound still bound: well when its days of mending are done.
  if (cHealth[i] === 3) {
    if (cIll[i]! <= Math.max(1, k)) {
      cIll[i] = 0;
      cHealth[i] = 0;
      note(place, HAP.well, cId[i]!);
    } else cIll[i]! -= k;
  }
  // Hurt or sick: home, and abed there until it is over, fed from the pantry by their household.
  else if (cIll[i]! > 0) {
    cWhy[i] = WHY.abed;
    cAct[i] = ACT.abed;
    if (cAt[i] !== home) {
      go(place, i, home, world);
      return;
    }
    if (cNeeds[at0 + N.food]! > 0.5 * FULL) eat(i, h, fk);
    cNeeds[at0 + N.rest] = Math.max(0, cNeeds[at0 + N.rest]! - fk.rest * Math.max(1, k));
    // (A wound not yet dressed is dressed by whoever of their household is at home, or by themselves where they can
    // stand, or at the town's hospital where it keeps one: its bleeding stopped. N9.)
    if (cHealth[i] === 1 && !(p.fester[i]! & FESTER_DRESSED)) {
      let by = hospital ? i : -1;
      if (by < 0)
        for (const q of homeFolk(h))
          if (q !== i && !p.health[q] && ageOf(p, q, t) >= f.life.adulthood) {
            by = q;
            break;
          }
      if (by < 0 && p.blood[i]! < BLOOD_FAINT && ageOf(p, i, t) >= f.life.adulthood) by = i;
      if (by >= 0) {
        p.bleed[i] = 0;
        p.fester[i] = p.fester[i]! | FESTER_DRESSED;
        if (by !== i) {
          const at = by * KINDS_N + SK.healing;
          p.hours[at] = Math.min(SKILL_MOST, p.hours[at]! + 3);
        }
      }
    }
    // (Too faint to stand, or a wound festering: abed still, however its days of lying abed have run.)
    const step = Math.max(1, k);
    if (
      cIll[i]! <= step &&
      cHealth[i] === 1 &&
      (p.blood[i]! >= BLOOD_FAINT || (p.fester[i]! & FESTER_LOAD) > 0)
    ) {
      cIll[i] = 1;
      return;
    }
    cIll[i] = Math.max(0, cIll[i]! - step);
    if (cIll[i] === 0) {
      cAct[i] = ACT.idle;
      // (A wound's days abed done: up and about with it bound for its days of mending. rules/healing.ts.)
      const mark = p.mark[i]!,
        member = MEMBERS[(mark & 15) - 1],
        cause = cHealth[i] === 1 ? p.cause[i]! & 7 : p.cause[i]!,
        mending =
          cHealth[i] === 1
            ? healDays(
                mark && member ? (mark >> 4 === 2 ? "lame" : "scarred") : "healed",
                member ?? "trunk",
                blowOf(place, i, cause),
                matched.care ?? 0,
                tendedOf(place, i),
              ).mending
            : 0,
        // (As long again as the tissue it reached takes to mend, against its blow's mean: rules/tissues.ts.)
        reached = tissueAt(p, i),
        wounded = MEMBERS[(p.cause[i]! >> 3) - 1],
        mends = reached && wounded ? tissueMends(blowOf(place, i, cause), wounded, reached) : 1;
      if (mending > 0) {
        cHealth[i] = 3;
        cIll[i] = Math.min(65535, Math.max(1, Math.round(mending * mends)) * 144);
        note(place, HAP.mending, cId[i]!, cause);
      } else {
        cHealth[i] = 0;
        p.tissue[i] = 0;
        note(place, HAP.well, cId[i]!);
      }
    }
    return;
  }
  // (Asleep, with neither hunger nor cold pressing past what rest is worth, and nothing in hand and no fire to turn out
  // to: asleep still, whatever their work is worth to them. Half a town's hours are such, and none of them asks it.)
  if (
    asleep &&
    fireLot === null &&
    h !== riteHouse &&
    i !== healerAt &&
    cCarry[i] === 0 &&
    cNeeds[at0 + N.rest]! > 0.04 * FULL
  ) {
    const hf = cNeeds[at0 + N.food]! / FULL,
      cf = cNeeds[at0 + N.cold]! / FULL;
    if (hf * hf * hf < IDLE_WORTH && cf * cf * cf < IDLE_WORTH) {
      cWhy[i] = WHY.asleep;
      if (wk > 1) wakes(cx, i, wk);
      return;
    }
  }
  const hunger = pressOf(cNeeds[at0 + N.food]! / FULL),
    tired = pressOf(cNeeds[at0 + N.rest]! / FULL),
    chilled = pressOf(cNeeds[at0 + N.cold]! / FULL),
    lone = pressOf(cNeeds[at0 + N.lone]! / FULL),
    occ = occOf(p, i),
    // (One long in want is worth less at their work: sick with it.) (Out of their working day it is worth a tenth of
    // what it is, and that is less than an hour's rest whatever it is, so it is not reckoned: workWorth is 0.9 at the
    // most, and a tenth of it short of IDLE_WORTH.)
    worth =
      occ === OCC.dependent || (!working && OFF_IDLE)
        ? 0
        : workWorth(world, place, i, mean, trades) *
          dark *
          offWork *
          (1 - Math.min(0.6, 0.15 * lackDays)),
    bar = Math.max(worth, playing ? PLAY_WORTH : IDLE_WORTH);
  // What is carried is set down where it was bound.
  if (cCarry[i]! > 0 && cAct[i] === ACT.carry) {
    const b = bldgAt(place, cAt[i]!);
    if (cAt[i] === home && GOODS[cCarryGood[i]!]!.food)
      houses.pantry[h * FOODS.length + FOODS.indexOf(cCarryGood[i]!)]! += cCarry[i]!;
    else bldgs.stock[(b < 0 ? 0 : b) * GOOD_COUNT + cCarryGood[i]!]! += cCarry[i]!;
    cCarry[i] = 0;
    cAct[i] = ACT.idle;
  } else if (cCarry[i]! > 0 && cAt[i] === home && GOODS[cCarryGood[i]!]!.food) {
    // (And what the day's work in the fields gave comes home with whoever won it, whatever brought them home: it waited
    // in hand for a full load, a month's food and three weeks' reaping, and a land that eats what it reaps went hungry
    // beside it.)
    houses.pantry[h * FOODS.length + FOODS.indexOf(cCarryGood[i]!)]! += cCarry[i]!;
    cCarry[i] = 0;
  }
  // Held by the town's justice, or at labour for it, till their term is served; and one broken down, till it is spent
  // (N11). (Their household brings them their food.)
  if (heldBy?.has(cId[i]!)) {
    if (breakOf?.has(cId[i]!)) breakSpent(cx, i);
    if (heldTurn(cx, i, h, fk)) return;
  }
  if (breakOf?.has(cId[i]!) && breakTurn(cx, i, h, fk)) return;
  // A fine work where they are, seen once a day (N11): a thought by how fine it is.
  if (worksAt && !moving && inside && (tickNo + cId[i]!) % 6 < k) {
    const q = worksAt.get(cAt[i]!);
    if (q !== undefined) remember(place, i, THOUGHT.admired, 2 + 2 * q, srcLot(cAt[i]!));
  }
  // A fire in the town: the grown who live within a cry of it turn out to fight it, asleep or not, until it is out or
  // hunger takes them off; and its watch, where one is kept (fireCrew).
  if (fireLot !== null && hunger < 0.6 && fireOut!.has(cId[i]!)) {
    // (Turned out to fight it: a fear and a toil remembered, the more by the timid.)
    if (cAct[i] !== ACT.brigade)
      remember(
        place,
        i,
        THOUGHT.fire,
        -12 * leans(1 - placeTemper(place, i).bold),
        srcLot(fireLot),
      );
    cAct[i] = ACT.brigade;
    cWhy[i] = WHY.fire;
    if (cAt[i] !== fireLot) go(place, i, fireLot, world);
    return;
  }
  // The town's healer (N9): to one of its hurt who wants them, asleep or not where a wound lies undressed; awake, to the
  // festering they have not yet seen today, with a day's remedies.
  if (i === healerAt && hunger < 0.6) {
    const q = patientFor(cx, !asleep);
    if (q >= 0) {
      cAct[i] = ACT.tend;
      cWhy[i] = WHY.tend;
      const there = houses.home[cHouse[q]!]!;
      if (cAt[i] !== there) go(place, i, there, world);
      else treat(cx, q);
      return;
    }
  }
  // A burial of one of their household: they stand by it, while neither hunger nor cold presses past their work.
  if (h === riteHouse && hunger < bar && chilled < bar) {
    cAct[i] = ACT.mourn;
    cWhy[i] = WHY.burial;
    if (cAt[i] !== riteLot) go(place, i, riteLot!, world);
    return;
  }
  // Asleep: until rested, or hunger or cold wakes them.
  if (asleep && cNeeds[at0 + N.rest]! > 0.04 * FULL && hunger < bar && chilled < bar) {
    cWhy[i] = WHY.asleep;
    if (wk > 1) wakes(cx, i, wk);
    return;
  }
  // Come for what a building has made: a load of it taken up, for the market.
  if (cAct[i] === ACT.haul) {
    const b = Math.max(0, bldgAt(place, cAt[i]!)),
      g = cCarryGood[i]!,
      take = Math.floor(Math.min(bldgs.stock[b * GOOD_COUNT + g]!, LOAD * MICRO));
    if (take > 0 && b !== market) {
      setDown(i);
      bldgs.stock[b * GOOD_COUNT + g]! -= take;
      cCarry[i] = take;
      cAct[i] = ACT.carry;
      cWhy[i] = WHY.load;
      go(place, i, bldgs.lot[market]!, world);
    } else cAct[i] = ACT.idle;
    return;
  }
  // Fetching: at the store, take what the household eats in some days; then home.
  if (cAct[i] === ACT.fetch) {
    const b = Math.max(0, bldgAt(place, cAt[i]!));
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
      cCarryGood[i] = best;
      cCarry[i] = take;
    }
    cAct[i] = cCarry[i]! > 0 ? ACT.carry : ACT.idle;
    cWhy[i] = cCarry[i]! > 0 ? WHY.pantry : WHY.noFood;
    go(place, i, home, world);
    return;
  }
  // Gone for a load of what a site is built of: taken up outside the town, and set down at the site.
  if (cAct[i] === ACT.stuff) {
    const sn = cBound[i] === BOUND_SITE ? sitesNow?.get(p.work[i]!) : undefined;
    if (sn && cAt[i] === AT.fields) {
      cWhy[i] = WHY.stuff;
      go(place, i, sn.site.lot, world);
      return;
    }
    if (sn && cAt[i] === sn.site.lot) {
      sn.site.stuff += fk.load;
      sn.site.brought += fk.load;
    }
    cAct[i] = ACT.idle;
  }
  const press = Math.max(hunger, tired, chilled, lone);
  if (press > bar) {
    if (hunger === press) {
      // Hunger: eat at home; a pantry bare, one who is grown fetches from the town's stores.
      if (cAt[i] !== home) {
        // (Bound home to eat: told as eating from the moment they turn for it.)
        cAct[i] = ACT.eat;
        cWhy[i] = WHY.hunger;
        go(place, i, home, world);
        return;
      }
      const [eaten, want] = eat(i, h, fk);
      if (eaten > 0) {
        cAct[i] = ACT.eat;
        cWhy[i] = WHY.hunger;
        // (Fed, and the pantry holds a day's food for the household yet: no more to do. Fed on its last crumbs, one
        // who is grown goes for more before the rest go hungry: a herder's children went a day in want beside a full
        // store, their one grown eating what little came home and never finding the pantry quite bare.)
        let pantry = 0;
        for (let k = 0; k < FOODS.length; k++) pantry += houses.pantry[h * FOODS.length + k]!;
        if (eaten >= want * 0.5 && pantry >= houses.members[h]! * fk.daily) {
          // (A meal is a tick: one followed at a stride turns to what comes next for the rest of it. Tiers.)
          if (wk > 1) goOn(cx, i, 1, wk - 1);
          return;
        }
      }
      // (Where no one grown lives, whoever is hungry goes: a household of children alone went hungry beside a full store.)
      let hasGrown = cx.hasGrown;
      if (!hasGrown) {
        hasGrown = cx.hasGrown = new Uint8Array(houses.n);
        for (let q = 0; q < p.n; q++)
          if ((!cIll[q] || cHealth[q] === 3) && ageOf(p, q, t) >= f.life.adulthood)
            hasGrown[cHouse[q]!] = 1;
      }
      const grown = ageOf(p, i, t) >= f.life.adulthood || !hasGrown[h];
      // (From its granary; that bare, or held back, from its market; that bare, from its square.)
      let from = -1;
      for (const b of foodStore === market ? [foodStore, 0] : [foodStore, market, 0])
        if (from < 0 && FOODS.some((g) => free(b, g) > 0)) from = b;
      if (grown && from >= 0) {
        cAct[i] = ACT.fetch;
        cWhy[i] = WHY.pantry;
        go(place, i, bldgs.lot[from]!, world);
        return;
      }
      if (eaten > 0) {
        if (wk > 1) goOn(cx, i, 1, wk - 1);
        return;
      }
      // (Nothing to eat: whatever presses next.)
      cWhy[i] = WHY.noFood;
      if (tired > bar && tired >= chilled && cAt[i] === home) {
        cAct[i] = ACT.sleep;
        return;
      }
    } else if (tired === press) {
      if (cAt[i] !== home) {
        cAct[i] = ACT.idle;
        cWhy[i] = WHY.tired;
        go(place, i, home, world);
      } else {
        cAct[i] = ACT.sleep;
        cWhy[i] = WHY.tired;
      }
      return;
    } else if (chilled === press) {
      cAct[i] = ACT.warm;
      cWhy[i] = WHY.cold;
      if (cAt[i] !== home) go(place, i, home, world);
      else if (wk > 1) {
        // (Warm again within the stride, at so much a tick: the rest of it at what comes next. Tiers.)
        const d = Math.max(1, Math.ceil(cNeeds[at0 + N.cold]! / Math.max(1, warmUp)));
        if (d < wk) goOn(cx, i, d, wk - d);
      }
      return;
    } else if (sickHouses?.has(h)) {
      // (One of a household with sickness in it, kept apart by order: at home, wanting company.)
      cAct[i] = ACT.idle;
      cWhy[i] = WHY.apart;
      if (cAt[i] !== home) go(place, i, home, world);
      return;
    } else {
      cAct[i] = ACT.visit;
      cWhy[i] = WHY.lone;
      // (For company: to the square, or to a meeting place nearer their home, O2.)
      const gather = zoned ? meetFor(place, zoned, home) : AT.square;
      if (cAt[i] !== gather) go(place, i, gather, world);
      else {
        // (Two there for company at once, neither with a friend yet: each the other's.)
        const v = gather === AT.square ? cx.visitor : (cx.visitAt?.get(gather) ?? -1);
        if (v >= 0 && !p.friend[i] && !p.friend[v] && cHouse[v] !== h) {
          p.friend[i] = cId[v]!;
          p.friend[v] = cId[i]!;
        }
        if (gather === AT.square) cx.visitor = i;
        else cx.visitAt?.set(gather, i);
        if (wk > 1) {
          // (Company had within the stride, at so much a tick: the rest of it at what comes next. Tiers.)
          const d = Math.max(1, Math.ceil(cNeeds[at0 + N.lone]! / Math.max(1, 12 * fk.lone)));
          if (d < wk) goOn(cx, i, d, wk - d);
        }
      }
      return;
    }
  }
  // (The guard's post kept through the night by turns, out of the working day and while nothing presses them: one in
  // WATCH_TURNS of those standing to arms each night, each their own night of them. O7.)
  if (
    cx.post !== undefined &&
    cBound[i] === BOUND_ARMS &&
    !working &&
    (cId[i]! + today) % WATCH_TURNS === 0
  ) {
    cAct[i] = ACT.guard;
    cWhy[i] = WHY.watch;
    if (cAt[i] !== cx.post) go(place, i, cx.post, world);
    dayTurns(cx, i, wk, occ);
    return;
  }
  if (worth < IDLE_WORTH && playing && !sickHouses?.has(h)) {
    // Their day's work done, or a day of rest: at their people's games in the square (rules/leisure.ts gamesOf: what
    // their body, their land's lore and their ways give them to play), or among others there where it plays none; a
    // feast day's company. Remembered gladly, a feast the more.
    cAct[i] = ACT.visit;
    cWhy[i] = WHY.play;
    const gather = zoned ? meetFor(place, zoned, home) : AT.square;
    if (cAt[i] !== gather) go(place, i, gather, world);
    else if (!moving) {
      const kind = today0.rest === "feast" && feastKept(cx) ? THOUGHT.feast : THOUGHT.games;
      if (!heldToday(place, i, kind))
        remember(
          place,
          i,
          kind,
          (kind === THOUGHT.feast ? 8 : 3) * leans(placeTemper(place, i).sociable),
          srcLot(gather),
        );
    }
    dayTurns(cx, i, wk, occ);
    return;
  }
  if (worth < IDLE_WORTH) {
    // Nothing presses and no work is worth going to: at home, abed while it is dark.
    if (cAt[i] !== home) {
      cAct[i] = ACT.idle;
      go(place, i, home, world);
    } else cAct[i] = air.lit ? ACT.idle : ACT.sleep;
    cWhy[i] = occ === OCC.dependent ? WHY.young : air.lit && !working ? WHY.rest : WHY.dark;
    dayTurns(cx, i, wk, occ);
    return;
  }
  // The healer, with none of the hurt wanting them and their remedies short: out about the fields to gather more, the
  // faster the more they know of it (N9), in the hours their work would have had. Not while a siege lies about the town:
  // no one goes out to its fields, and the healer went out for herbs past the foe's lines.
  if (i === healerAt && !matched.sieged && (place.herbs ?? 0) < herbsWanted(place)) {
    cAct[i] = ACT.work;
    cWhy[i] = WHY.herbs;
    if (cAt[i] !== AT.fields) go(place, i, AT.fields, world);
    else
      place.herbs =
        (place.herbs ?? 0) +
        Math.round((1000 / HERB_TICKS) * ticksWorth(hoursAt(p, i, SK.healing)) * wk);
    return;
  }
  // Work: what the next hour of it is worth passes every need. (Their own, or what they have turned to for now.)
  const turned = p.turn[i]!,
    doing = turned || occ,
    // (A maker's making now: their own; or, where the town holds as much of its good as its bill asks, the first good
    // billed that it holds less of and its land knows how to make, its stuff to hand; 0: none. N10.)
    making = keepTo && !turned && doing === OCC.crafter ? makingNow(cx, i) : p.craft[i]!,
    work = turned
      ? turnPlace(i, turned)
      : making && making !== p.craft[i]
        ? makingLot(place, i, making)
        : p.work[i]!;
  if (shut?.has(work) || zoned?.clear.has(work)) {
    // Their building's work is stopped by order, or where they work is kept clear (O2): at home, waiting.
    cAct[i] = ACT.wait;
    cWhy[i] = shut?.has(work) ? WHY.shut : WHY.clear;
    if (cAt[i] !== home) go(place, i, home, world);
    return;
  }
  // Standing to arms by order: at their post (O7), else in the square, in the hours their work would have had.
  if (cBound[i] === BOUND_ARMS) {
    const post = cx.post ?? AT.square;
    cAct[i] = ACT.guard;
    cWhy[i] = WHY.arms;
    if (cAt[i] !== post) go(place, i, post, world);
    return;
  }
  // A siege lies about the town: no one goes out to its fields.
  if (work === AT.fields && matched.sieged) {
    cAct[i] = ACT.wait;
    cWhy[i] = WHY.siege;
    if (cAt[i] !== home) go(place, i, home, world);
    return;
  }
  const sn = cBound[i] === BOUND_SITE ? sitesNow?.get(work) : undefined;
  if (sn) {
    // One of a site's crew. Stopped (as its land's month stops it), or all it wants done and waiting on the telling: home.
    if (sn.stopped || sn.left <= 0) {
      cAct[i] = ACT.wait;
      cWhy[i] = sn.stopped ? WHY.stopped : WHY.raised;
      if (cAt[i] !== home) go(place, i, home, world);
      return;
    }
    cWhy[i] = WHY.site;
    if (cAt[i] !== work) {
      cAct[i] = ACT.build;
      go(place, i, work, world);
      return;
    }
    // (Nothing on the site to build in: a load of it fetched from outside the town.)
    if (sn.site.stuff < SITE_USE) {
      cAct[i] = ACT.stuff;
      cWhy[i] = WHY.stuff;
      go(place, i, AT.fields, world);
      return;
    }
    // A tick's building: what it is built of built in, tools worn; with none to hand the work is worth what a hand without
    // tools is (rules/goods.ts TOOL_GAIN). (Each tick of their stride, as long as there is stuff to build in.)
    cAct[i] = ACT.build;
    for (let s = 0; s < wk && sn.site.stuff >= SITE_USE && sn.left > 0; s++) {
      sn.site.stuff -= SITE_USE;
      const tools = sn.b > 0 ? bldgs.stock[sn.b * GOOD_COUNT + G.tools]! : 0,
        gain = tools >= SITE_WEAR ? 1000 : Math.round(1000 / (1 + TOOL_GAIN));
      if (tools >= SITE_WEAR) {
        bldgs.stock[sn.b * GOOD_COUNT + G.tools]! -= SITE_WEAR;
        usedOf(G.tools, SITE_WEAR);
      }
      sn.site.ticks += gain;
      sn.left -= gain;
    }
    return;
  }
  if (!making && doing === OCC.crafter && p.craft[i]) {
    // The town holds as much of their making's good as its bill asks, and of nothing else billed that they could make
    // (N10): what their priorities name next, where any has work; else at home.
    if (prios && turns(i, occ)) return;
    cAct[i] = ACT.wait;
    cWhy[i] = WHY.billMet;
    if (cAt[i] !== home) go(place, i, home, world);
    return;
  }
  if (cAt[i] !== work) {
    // (Setting out from a home that holds more than it keeps: a load of the rest goes to the town's store on the way,
    // for those who reap nothing. In a dearth a home keeps a day's food and no more.)
    if (cAt[i] === home && work === AT.fields && cCarry[i] === 0) {
      const keep = houses.members[h]! * fk.daily * keepDays,
        least = Math.min(LOAD * MICRO, houses.members[h]! * fk.daily);
      let pantry = 0;
      for (let k = 0; k < FOODS.length; k++) pantry += houses.pantry[h * FOODS.length + k]!;
      if (pantry - keep >= least)
        for (let k = FOODS.length - 1; k >= 0; k--) {
          const take = Math.floor(
              Math.min(houses.pantry[h * FOODS.length + k]!, pantry - keep, LOAD * MICRO),
            ),
            to = foodTo(FOODS[k]!, home);
          if (take <= 0 || to === home) continue;
          houses.pantry[h * FOODS.length + k]! -= take;
          cCarryGood[i] = FOODS[k]!;
          cCarry[i] = take;
          cAct[i] = ACT.carry;
          cWhy[i] = WHY.load;
          go(place, i, to, world);
          break;
        }
      if (cAct[i] === ACT.carry && cCarry[i]! > 0) return;
    }
    cAct[i] = ACT.work;
    cWhy[i] = turned ? WHY.turned : WHY.work;
    go(place, i, work, world);
    return;
  }
  // (One followed at a stride works till a need would press past their work, as one followed in full stops at it: the
  // need come to that, their work's yield for those ticks, and the rest of the stride turned to what presses. Tiers.)
  let cut = 0;
  if (wk > 1) {
    const flip = flipTicks(cx) - cx.ahead,
      d = Math.min(
        workTicks(cx, i, fk, bar, coldTo, inside),
        working && flip > 0 ? flip : Infinity,
      );
    if (d < wk) {
      cut = wk - d;
      wk = d;
    }
  }
  try {
    cAct[i] = ACT.work;
    cWhy[i] = turned ? WHY.turned : WHY.work;
    // (An hour given to one's own trade is an hour of skill at it: rules/life.ts. One turned to another trade's work
    // gives it to that trade's, below with the rest of their hours.)
    if (!turned) {
      const was = p.skill[i]!,
        to = was + wk;
      if (was < SKILL_MOST) p.skill[i] = Math.min(SKILL_MOST, to);
      // (A master's hours past the top of their skill count toward it no more, but their tool wears by them all the same:
      // what is reckoned to its wear (Deep.worked) is set back by as much. Their tool had worn no more once they were a
      // master, and a farmer of fifty held a hoe as new as the day it was made.)
      if (to > SKILL_MOST && (p.tier[i]! & 3) === TIER.full) {
        const dp = place.deep?.get(p.id[i]!);
        if (dp) dp.worked -= to - Math.max(was, SKILL_MOST);
      }
    }
    if (doing === OCC.farmer || doing === OCC.herder) {
      // What the fields and the flocks give is brought in a load at a time: home while the pantry is short, else to the store.
      // (Won as fast as a hand that works a third of its time must to win its year's making, of what is ready.)
      // (By their skill at it: a hand turned to it from another trade by the hours they have given that trade's work.)
      const g = doing === OCC.farmer ? G.grain : G.meat,
        skilled = ticksWorth(hoursAt(p, i, tradeKind(doing))),
        per = tickWin[doing === OCC.farmer ? 0 : 1]! * skilled,
        // (One followed at a stride fills a load and sets out with it as one followed in full does: so many ticks of their
        // stride at it, and their going put off by them. Tiers.)
        worked =
          wk > 1 && per > 0
            ? Math.min(wk, Math.max(1, Math.ceil((LOAD * MICRO - cCarry[i]!) / per)))
            : wk,
        made = Math.min(place.ripe[g]!, Math.round(per * worked));
      // (Nothing stands ready to be won: what their priorities name next, if any has work.)
      if (made <= 0 && worked > 0 && (turned || prios) && turns(i, occ)) return;
      place.ripe[g]! -= made;
      if (cCarryGood[i] !== g) setDown(i);
      cCarryGood[i] = g;
      cCarry[i]! += made;
      madeOf(g, made);
      if (cCarry[i]! >= LOAD * MICRO) {
        let pantry = 0;
        for (let k = 0; k < FOODS.length; k++) pantry += houses.pantry[h * FOODS.length + k]!;
        cAct[i] = ACT.carry;
        cWhy[i] = WHY.load;
        go(
          place,
          i,
          pantry < houses.members[h]! * fk.daily * keepDays ? home : foodTo(g, home),
          world,
        );
        if (wk > 1 && cEta[i]) cEta[i] = Math.min(65535, cEta[i]! + worked - 1);
      }
    } else if (doing === OCC.crafter && making) {
      // A work, for its own sake, as much of their time as its land's makers give to works (rules/art.ts ART.hands): one
      // a month of a maker's work long, so its chance a tick is that share over a month's ticks (N11). (Drawn at one tick
      // in WORK_SIEVE of each maker's, at as many times the chance: a draw at every maker's every tick was a tenth of a
      // tick's cost in a town of 5,500.)
      // (One followed at a stride: drawn where their drawing tick falls within the ticks of work to come, from the tick
      // their work there begins; not within ticks gone, which another turn of theirs may have drawn already. Tiers.)
      const from = tickNo + cx.ahead;
      if (
        (WORK_SIEVE - ((from + cId[i]!) % WORK_SIEVE)) % WORK_SIEVE < wk &&
        world.rng.chance(
          (WORK_SIEVE * ART.hands) / WORK_TICKS,
          PLACE_DRAW,
          place.key ^ cId[i]!,
          from,
          P.art,
        ) &&
        makeWork(cx, i)
      )
        return;
      // A making: its stuff taken from where it is worked, the made thing left there; for want of stuff, none.
      const r = RECIPES[making - 1]!,
        [good, per] = r.output,
        // (One who works at home takes their stuff from the market and leaves what they make there.)
        at = bldgAt(place, cAt[i]!),
        b = at < 0 ? market : at,
        made = Math.round(
          matched.made[good]! *
            perTick *
            ticksWorth(hoursAt(p, i, tradeKind(doing))) *
            wk *
            // (At their own building with no bench left there for them: at the yard and the door. O4.)
            (at > 0 && cAt[i] === p.work[i] && benchless(place)[i] ? BENCHLESS_WORTH : 1) *
            // (Needing what they take: their share of the work its land loses to it. P4.)
            (cx.drink.share && placeTakes(place, cId[i]!, cx.drink.share) ? cx.drink.worth : 1),
        );
      let can = made;
      // (What its market will not let go is not to be had there.)
      const has = (x: number) => (barred(b, x) ? 0 : bldgs.stock[b * GOOD_COUNT + x]!);
      for (const [x, amount] of r.inputs) can = Math.min(can, Math.floor((has(x) * per) / amount));
      if (can <= 0 && made > 0) {
        if ((turned || prios) && turns(i, occ)) return;
        if (turned) return;
        cAct[i] = ACT.wait;
        cWhy[i] = WHY.noStuff;
        return;
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
      if (cAt[i] !== bldgs.lot[market]) return;
      const wants = wantsNow();
      for (let k = 0; k < wants.length; k++) {
        const [b, x] = wants[k]!,
          has = barred(market, x) ? 0 : bldgs.stock[market * GOOD_COUNT + x]!;
        if (has <= 0) continue;
        const take = Math.min(has, LOAD * MICRO);
        setDown(i);
        bldgs.stock[market * GOOD_COUNT + x]! -= take;
        cCarryGood[i] = x;
        cCarry[i] = take;
        cAct[i] = ACT.carry;
        cWhy[i] = WHY.load;
        go(place, i, bldgs.lot[b]!, world);
        wants.splice(k, 1);
        break;
      }
      if (cAct[i] === ACT.carry) return;
      // (And what its buildings have made, a load of it lying there: fetched for the market, one carrier to each.)
      const haul = haulsNow().shift();
      if (!haul && (turned || prios)) turns(i, occ);
      if (haul) {
        setDown(i);
        cCarryGood[i] = haul[1];
        cCarry[i] = 0;
        cAct[i] = ACT.haul;
        cWhy[i] = WHY.haul;
        go(place, i, bldgs.lot[haul[0]]!, world);
      }
    }
  } finally {
    if (cut > 0) goOn(cx, i, wk, cut);
  }
}

// —— Bills and stores (N10) ————————————————————————————————————————————————————————————————————————————————————————

/** A town's bills read: the units of each good it is to hold (GOODS' order; -1: no bill). */
function billsOf(bills: readonly number[]): Float64Array {
  const out = new Float64Array(GOOD_COUNT).fill(-1);
  for (let k = 0; k + 1 < bills.length; k += 2) out[bills[k]!] = bills[k + 1]!;
  return out;
}
/** What a town's stores will not take, read: its market's by the good, its granary's by GOOD_COUNT and the good. */
function refusedOf(refuse: readonly number[]): Set<number> {
  const out = new Set<number>();
  for (let k = 0; k + 1 < refuse.length; k += 2) out.add(refuse[k]! * GOOD_COUNT + refuse[k + 1]!);
  return out;
}
/** What a place holds of a good, in units: in its buildings, its pantries and in hand (the Stocks sheet's `held`). */
export function placeHeld(place: Place, g: number): number {
  const { bldgs, houses, people: p } = place;
  let n = 0;
  for (let b = 0; b < bldgs.lot.length; b++) n += bldgs.stock[b * GOOD_COUNT + g]!;
  const f = FOODS.indexOf(g);
  if (f >= 0) for (let h = 0; h < houses.n; h++) n += houses.pantry[h * FOODS.length + f]!;
  for (let q = 0; q < p.n; q++) if (p.carry[q]! > 0 && p.carryGood[q] === g) n += p.carry[q]!;
  return n / MICRO;
}
/** What a tick holds of a good billed, as it first asks. */
function heldOf(cx: TickCx, g: number): number {
  const was = cx.heldNow![g]!;
  return was >= 0 ? was : (cx.heldNow![g] = placeHeld(cx.place, g));
}
/**
 * How a place makes a good now (a recipe's place + 1; 0: it cannot): of its land's makings of it, the latest its land
 * knows, its stuff to hand where it is made (its building of the kind, else its market), as its makers' own are.
 */
function makesOf(cx: TickCx, g: number): number {
  const was = cx.madeBy![g]!;
  if (was >= 0) return was;
  const { place, matched, bldgs, market, barred } = cx,
    at = MAKING_AT[g] ? buildingOf(place, MAKING_AT[g]) : -1,
    b = at > 0 ? at : market;
  let out = 0;
  for (let k = RECIPES.length - 1; k >= 0 && !out; k--) {
    const r = RECIPES[k]!;
    if (r.output[0] !== g || !((matched.kinds >>> k) & 1)) continue;
    if (r.inputs.every(([x]) => !barred(b, x) && bldgs.stock[b * GOOD_COUNT + x]! > 0)) out = k + 1;
  }
  return (cx.madeBy![g] = out);
}
/**
 * One maker's making now, by the town's bills (N10): their own while the town holds less of its good than its bill asks
 * (or it has none); else the first good billed that it holds less of, as the town makes it now (makesOf); 0: none.
 */
function makingNow(cx: TickCx, i: number): number {
  const { p, keepTo, billOrder } = cx,
    own = p.craft[i]!;
  if (!keepTo || !billOrder) return own;
  if (own) {
    const g = RECIPES[own - 1]!.output[0];
    if (keepTo[g]! < 0 || heldOf(cx, g) < keepTo[g]!) return own;
  }
  for (const g of billOrder) {
    if (keepTo[g]! <= 0 || heldOf(cx, g) >= keepTo[g]!) continue;
    const r = makesOf(cx, g);
    if (r) return r;
  }
  return 0;
}
/** A place's stores' lots (N10): its market's, and its granary's (-1: it keeps none apart from its market). */
export function placeStores(place: Place): { market: number; granary: number } {
  const market = buildingOf(place, ["market"]),
    food = buildingOf(place, FOOD_STORES);
  return {
    market: place.bldgs.lot[market] ?? -1,
    granary: food !== market ? (place.bldgs.lot[food] ?? -1) : -1,
  };
}
/**
 * A place's zones as its orders give them (O2), read once for each giving of them: the lots kept clear (never its
 * stores: its households fetch their food from them), its meeting places (none kept clear), and, as asked, the meeting
 * place nearest each home by the streets where it is nearer than the square.
 */
type Zoned = {
  readonly of: readonly number[];
  readonly year: number;
  readonly clear: ReadonlySet<number>;
  readonly meets: readonly number[];
  readonly near: Map<number, number>;
};
const ZONED = new WeakMap<Place, Zoned>();
/** The zones a place's orders give its lots, by their number (sim/town/managed.ts ZONES' order). */
export const ZONE = { meet: 0, clear: 1 } as const;
function zonesOf(place: Place, zones: readonly number[]): Zoned {
  const year = Math.floor(place.t / YEAR),
    was = ZONED.get(place);
  if (was && was.of === zones && was.year === year) return was;
  const st = placeStores(place),
    clear = new Set<number>(),
    meets: number[] = [];
  for (let k = 0; k < zones.length; k += 2) {
    const lot = zones[k]!;
    if (zones[k + 1] === ZONE.meet) meets.push(lot);
    else if (zones[k + 1] === ZONE.clear && lot !== st.market && lot !== st.granary) clear.add(lot);
  }
  const z: Zoned = {
    of: zones,
    year,
    clear,
    meets: meets.filter((lot) => !clear.has(lot)),
    near: new Map(),
  };
  ZONED.set(place, z);
  return z;
}
/** Where those of a home go for company and their games: the meeting place nearest it by the streets, if nearer than the square. */
function meetFor(place: Place, z: Zoned, home: number): number {
  if (!z.meets.length) return AT.square;
  let at = z.near.get(home);
  if (at !== undefined) return at;
  at = AT.square;
  let best = streetLength(place, home, AT.square);
  for (const lot of z.meets) {
    const d = streetLength(place, home, lot);
    if (d < best) {
      best = d;
      at = lot;
    }
  }
  z.near.set(home, at);
  return at;
}
/** A lot's zone by a place's orders (ZONE's; -1: none), and whether a zone holds there (a store is never kept clear). */
export function placeZone(
  world: World,
  place: Place,
  lot: number,
): { zone: number; holds: boolean } {
  const zones = ordersOf(world, place.town)?.zones;
  let zone = -1;
  for (let k = 0; zones && k < zones.length; k += 2) if (zones[k] === lot) zone = zones[k + 1]!;
  if (zone < 0) return { zone, holds: false };
  const z = zonesOf(place, zones!);
  return { zone, holds: zone === ZONE.clear ? z.clear.has(lot) : z.meets.includes(lot) };
}
/** Where those of a home of a place go for company now: a meeting place by its orders, or the square (O2). */
export function placeMeetFor(world: World, place: Place, home: number): number {
  const zones = ordersOf(world, place.town)?.zones;
  return zones?.length ? meetFor(place, zonesOf(place, zones), home) : AT.square;
}
/** A lot's floor as its grid lays it (O3): tiles a metre square, across and deep, less its yard, for a building over `lots`. */
export function lotGrid(lots = 1): { w: number; d: number } {
  return { w: Math.max(3, LOT_W * lots - 2), d: Math.max(4, LOT_D - 4) };
}
/** Of those standing to arms, how many share the night's watch at the guard's post by turns (O7): each one night in so many (est.: a watch of four). */
export const WATCH_TURNS = 4;
/**
 * Whether a home is watched by the guard at its post now (O7): a post given by its order, one standing to arms there this
 * very turn, and the home within a cry of it by its streets (cryReach: as far as a shout for the watch carries now).
 */
export function watched(world: World, place: Place, home: number): boolean {
  const post = managedOf(world)?.get(place.town)?.post;
  if (post === undefined || home < 0) return false;
  const p = place.people;
  let kept = false;
  for (let i = 0; i < p.n && !kept; i++)
    kept = p.bound[i] === BOUND_ARMS && p.act[i] === ACT.guard && p.at[i] === post;
  return kept && streetLength(place, post, home) <= cryReach(world, place);
}
/** How many lots a building of a place stands over (its town's plan: a smithy one, a market hall four; a home one). */
export function lotsOf(place: Place, lot: number): number {
  const b = bldgAt(place, lot);
  return b > 0
    ? ((CIVIC_LOTS as Readonly<Record<string, number>>)[kindName(place.bldgs.kind[b]!)] ?? 1)
    : 1;
}
/**
 * The benches a building's floor takes (O4): each two tiles by one with an aisle a tile wide about it, set in rows from
 * its front wall, as its plan lays them (host/placeinside.ts): three tiles across and two deep a bench.
 */
export function benchesFit(lots = 1): number {
  const { w, d } = lotGrid(lots);
  return Math.floor((w + 1) / 3) * Math.floor((d + 1) / 2);
}
/**
 * What one at work in a building without a bench there is worth at their making (O4): at the yard and the door, with
 * no bench and their tools not to hand, half (est). Its benches go to those who work there in the order of the place's
 * people, as its plan gives them.
 */
export const BENCHLESS_WORTH = 0.5;
/** What working crowded, with no bench of one's own, takes from a mood while it holds (est: as being kept from one's taught work, a little more). */
const CROWDED_MOOD = 4;
type Benched = { day: number; n: number; none: Uint8Array };
const BENCHED = new WeakMap<Place, Benched>();
/** Those of a place at work in a building whose floor has no bench left for them, read once a day (1: benchless). */
export function benchless(place: Place): Uint8Array {
  const p = place.people,
    day = Math.floor(place.t / DAY),
    was = BENCHED.get(place);
  if (was && was.day === day && was.n === p.n) return was.none;
  const none = new Uint8Array(p.n),
    taken = new Map<number, number>();
  for (let i = 0; i < p.n; i++) {
    const lot = p.work[i]!;
    if (lot < 0 || bldgAt(place, lot) <= 0) continue;
    const k = (taken.get(lot) ?? 0) + 1;
    taken.set(lot, k);
    if (k > benchesFit(lotsOf(place, lot))) none[i] = 1;
  }
  BENCHED.set(place, { day, n: p.n, none });
  return none;
}
/** Where a place makes a good: its building of the kind (-1: none; it is made at home, or outside the town). */
export function placeMakingAt(place: Place, g: number): number {
  const at = MAKING_AT[g] ? buildingOf(place, MAKING_AT[g]) : -1;
  return at > 0 ? at : -1;
}
/** The goods a place's land knows how to make (GOODS' order), and of its makers how many make each as their own. */
export function placeMakings(place: Place): { good: number; makers: number }[] {
  const m = place.matched,
    p = place.people,
    by = new Map<number, number>();
  RECIPES.forEach((r, k) => {
    if ((m.kinds >>> k) & 1 && !by.has(r.output[0])) by.set(r.output[0], 0);
  });
  for (let i = 0; i < p.n; i++) {
    const c = p.craft[i]!;
    if (c && occOf(p, i) === OCC.crafter) {
      const g = RECIPES[c - 1]!.output[0];
      by.set(g, (by.get(g) ?? 0) + 1);
    }
  }
  return [...by].map(([good, makers]) => ({ good, makers })).sort((a, b) => a.good - b.good);
}

// —— Breaks, justice and works (N11) ——————————————————————————————————————————————————————————————————————————————

/** How one breaks down (place.breaks): wandering dazed, eating all in sight, lashing out at what is about them. */
export const BREAK = { wander: 1, binge: 2, wreck: 3, pray: 4 } as const;
/** What a town's justice did with one brought before it (rules/sentences.ts sentenceMix's order), and its words. */
export const VERDICT = { fined: 1, death: 2, labour: 3, held: 4, freed: 5 } as const;
/**
 * How long a break lasts: half a waking day, the strain of a mood past bearing let out (and after, a thought of relief
 * the more for the deeper it was). A day's chance of one is the square of how far the mood lies below MOOD_UNHEEDING, of
 * the way from there to the bottom: one at the very bottom breaks most days, one at the edge of it seldom.
 */
const BREAK_TICKS = (8 * HOUR) / PLACE_TICK;
/** What one eating all in sight eats, in days of their food; and what one lashing out spoils, in loads at the boldest. */
const BINGE_DAYS = 3,
  WRECK_LOADS = 1;
/** A fine: what the household of one fined pays, in days of its food (to the wronged household, or to the town's store). */
const FINE_DAYS = 7;
/** A work is a month of a maker's working time long (rules/art.ts counts works in work-years): its ticks. */
const WORK_TICKS = Math.round((YEAR * WORK_SHARE) / 12 / PLACE_TICK);
/** Makers are drawn for a work at one tick in so many of theirs. */
const WORK_SIEVE = 64;
/** The works a building holds at the most: the oldest worn away first past it. */
const WORKS_MOST = 24;
/** A work's quality by its maker's skill (0 new … 4 a master), in a word. */
export const WORK_QUALITY = ["crude", "plain", "good", "fine", "masterful"] as const;

/** A flat list of so many numbers each, by the first (a person's number): its place in the list. */
function byId(list: readonly number[], each: number): Map<number, number> {
  const out = new Map<number, number>();
  for (let k = 0; k + each - 1 < list.length; k += each) out.set(list[k]!, k);
  return out;
}
/** A place's works by lot: the finest's quality at each (its works' seventh number is their quality). */
function worksByLot(place: Place): Map<number, number> {
  const w = place.works!,
    out = new Map<number, number>();
  for (let k = 0; k + 6 < w.length; k += 7)
    out.set(w[k]!, Math.max(out.get(w[k]!) ?? 0, w[k + 6]!));
  return out;
}
/** A day of a place's works: each wears away at its land's rate (ART.wear a year), drawn by when it was made. */
function wearWorks(world: World, place: Place): void {
  const w = place.works!,
    keep: number[] = [];
  for (let k = 0; k + 6 < w.length; k += 7)
    if (
      !world.rng.chance(
        ART.wear / 365,
        PLACE_DRAW,
        place.key ^ w[k + 2]!,
        place.t,
        P.art,
        w[k + 1]!,
      )
    )
      keep.push(...w.slice(k, k + 7));
  if (keep.length) place.works = keep;
  else delete place.works;
}
/**
 * Whether a town keeps its feast day as a feast: a feast is of what it has to spare (rules/leisure.ts), and it has
 * none while any of its people starve, whatever its land keeps. (A town that starved under its own hold, its store
 * full and held, feasted the while: found when the release's world moved, 2026-11-26.) Read once a tick, and only on a
 * feast day.
 */
function feastKept(cx: TickCx): boolean {
  if (cx.feast < 0) {
    const { p, cNeeds } = cx,
      most = 0.95 * FULL;
    cx.feast = 1;
    for (let i = 0; i < p.n; i++)
      if (cNeeds[i * NEEDS + N.food]! >= most) {
        cx.feast = 0;
        break;
      }
  }
  return cx.feast === 1;
}
/** One's day, a mood too low to bear: a break begun (true), by their temper. */
function breakDay(cx: TickCx, i: number): boolean {
  const { world, place, p, t, tickNo, bldgs } = cx,
    deep = (MOOD_UNHEEDING - p.mood[i]!) / (100 + MOOD_UNHEEDING);
  if (!world.rng.chance(deep * deep, PLACE_DRAW, place.key ^ p.id[i]!, tickNo, P.brk)) return false;
  // (The bold lash out at what is about their work; those who set no store by plenty eat all in sight; the rest wander
  // dazed. One bold whose work has nothing about it to lash out at, wanders.)
  // (And one who holds the gods dear, where the town has an altar, kneels at it the break through: VALUES.)
  const temper = placeTemper(place, i),
    work = p.work[i]!,
    b = bldgAt(place, work),
    afield = work === AT.fields,
    altar = buildingOf(place, ["temple", "shrine"]),
    devout = placeValues(place, i)[WAY.piety]! >= 0.62 && altar > 0,
    how =
      temper.bold >= 0.5 && (b > 0 || afield)
        ? BREAK.wreck
        : temper.thrifty < 0.5
          ? BREAK.binge
          : devout
            ? BREAK.pray
            : BREAK.wander;
  (place.breaks ??= []).push(p.id[i]!, how, t + BREAK_TICKS * PLACE_TICK);
  note(place, HAP.broke, p.id[i]!, how);
  p.act[i] = ACT.idle;
  p.why[i] = WHY.broke;
  if (how === BREAK.wreck) {
    // What lies about their work spoiled, the more the bolder: a wrong to the town, brought before its justice. At a
    // building, what it holds most of; at the fields, the crop or the flock standing ready there. (Before 2026-11-26 one
    // at the fields lashed out at nothing and was brought before no one, though their break was told as a wreck.)
    const most = WRECK_LOADS * LOAD * MICRO * temper.bold;
    if (b > 0) {
      let top = -1,
        g = -1;
      for (let x = 0; x < GOOD_COUNT; x++)
        if (bldgs.stock[b * GOOD_COUNT + x]! > top) {
          top = bldgs.stock[b * GOOD_COUNT + x]!;
          g = x;
        }
      const lost = g >= 0 ? Math.floor(Math.min(top, most)) : 0;
      if (lost > 0) {
        bldgs.stock[b * GOOD_COUNT + g]! -= lost;
        place.flow[g]! -= lost;
        place.usedDay[g]! += lost;
      }
    } else {
      const g = (p.sexOcc[i]! & 15) === OCC.herder ? G.meat : G.grain;
      place.ripe[g] = Math.max(0, place.ripe[g]! - Math.floor(Math.min(place.ripe[g]!, most)));
    }
    judge(world, place, i, -1);
  }
  return true;
}
/**
 * One in want stealing (asked 2026-11-26: things "held, used, traded and stolen"): their household's pantry bare, of a
 * day by a draw, the likelier the longer in want, the lower their mood and the less biddable they are; from the household
 * about their street (either side of theirs, as they meet: meetDay) with the fuller pantry, a day's food for their own
 * household, and where one of it is followed in full, the finest of their things not worn out. The robbed remember it,
 * and it is a wrong brought before the town's justice (N11).
 */
function theftDay(cx: TickCx, i: number, lackDays: number, fk: Frame): boolean {
  const { world, place, p, t } = cx,
    houses = place.houses,
    h = p.house[i]!,
    nf = FOODS.length,
    held = (x: number) => {
      let n = 0;
      for (let k = 0; k < nf; k++) n += houses.pantry[x * nf + k]!;
      return n;
    };
  if (held(h) >= fk.daily) return false;
  const temper = placeTemper(place, i),
    chance = Math.min(1, lackDays / 7) * (-p.mood[i]! / 100) * (1 - temper.bidden);
  if (!world.rng.chance(chance, PLACE_DRAW, place.key ^ p.id[i]!, Math.floor(t / DAY), P.theft))
    return false;
  const want = houses.members[h]! * fk.daily;
  let v = -1;
  for (const x of [h - 1, h + 1])
    if (
      x >= 0 &&
      x < houses.n &&
      houses.members[x]! > 0 &&
      held(x) >= want &&
      (v < 0 || held(x) > held(v))
    )
      v = x;
  if (v < 0) return false;
  // (Within a cry of the guard's post, while it is kept: caught in the act, nothing taken, and brought before its
  // justice. O7.)
  if (watched(world, place, houses.home[v]!)) {
    let j = -1;
    for (let q = 0; q < p.n && j < 0; q++)
      if (p.house[q] === v && ageOf(p, q, t) >= fk.life.adulthood) j = q;
    note(place, HAP.caught, p.id[i]!, j >= 0 ? p.id[j]! : 0);
    judge(world, place, i, j, WRONG.theft, true);
    p.act[i] = ACT.idle;
    return false;
  }
  // (A day's food for their household, each food in its share of what the robbed held.)
  const all = held(v);
  let took = 0;
  for (let k = 0; k < nf; k++) {
    const n = Math.floor((houses.pantry[v * nf + k]! * want) / all);
    houses.pantry[v * nf + k]! -= n;
    houses.pantry[h * nf + k]! += n;
    took += n;
  }
  // (One of the robbed household: the grown one of it there is first; the finest of the things of any of it in full.)
  let j = -1,
    best: { d: Deep; n: number } | null = null;
  for (let q = 0; q < p.n; q++) {
    if (p.house[q] !== v) continue;
    if (j < 0 && ageOf(p, q, t) >= fk.life.adulthood) j = q;
    const d = (p.tier[q]! & 3) === TIER.full ? place.deep?.get(p.id[q]!) : undefined;
    if (d?.filled)
      d.items.forEach((x, n) => {
        if (x.wear < 1000 && (!best || x.q > best.d.items[best.n]!.q)) best = { d, n };
      });
  }
  if (best) {
    const b = best as { d: Deep; n: number },
      [thing] = b.d.items.splice(b.n, 1),
      mine = (p.tier[i]! & 3) === TIER.full ? place.deep?.get(p.id[i]!) : undefined;
    // (Kept by the thief where they are followed in full; else sold on, out of the town.)
    if (mine?.filled && thing) mine.items.push(thing);
  }
  note(place, HAP.stole, p.id[i]!, j >= 0 ? p.id[j]! : 0, took);
  for (let q = 0; q < p.n; q++)
    if (p.house[q] === v) {
      const hurt = leans(placeTemper(place, q).thrifty);
      remember(place, q, THOUGHT.robbed, -10 * hurt, p.id[i]!);
      reason(place, q, i, REASON.stole, -12 * hurt);
    }
  judge(world, place, i, j, WRONG.theft);
  p.act[i] = ACT.idle;
  return false;
}
/**
 * Whether one's break is spent by now, and if so the strain let out (a thought of relief) and the break let go: so too for
 * one held or at labour for the town's justice, whose break runs out as anyone's (held, it was never spent, and no relief
 * came till their term was served).
 */
function breakSpent(cx: TickCx, i: number): boolean {
  const { place, p, t, breakOf } = cx,
    k = breakOf!.get(p.id[i]!)!,
    list = place.breaks!;
  if (t < list[k + 2]!) return false;
  list.splice(k, 3);
  if (!list.length) delete place.breaks;
  breakOf!.clear();
  if (place.breaks) for (const [id, at] of byId(place.breaks, 3)) breakOf!.set(id, at);
  remember(place, i, THOUGHT.catharsis, 20);
  return true;
}
/** What a wrong brought before a place's justice was (VERDICT's in `b`'s low bits; this, sixteen times it). */
export const WRONG = { blows: 0, theft: 1 } as const;
/** A tick of one broken down: as their break has them, till it is spent (false: it is spent, and they go on as they would). */
function breakTurn(cx: TickCx, i: number, h: number, fk: Frame): boolean {
  const { world, place, p, houses, breakOf } = cx,
    k = breakOf!.get(p.id[i]!)!,
    list = place.breaks!,
    // (How, in its low three bits; whether one eating all in sight has eaten yet, eight.)
    how = list[k + 1]! & 7;
  if (breakSpent(cx, i)) return false;
  p.act[i] = how === BREAK.binge ? ACT.eat : ACT.idle;
  p.why[i] = WHY.broke;
  const home = houses.home[h]!;
  if (how === BREAK.binge) {
    if (p.at[i] !== home) go(place, i, home, world);
    else if (!(list[k + 1]! & 8)) {
      // (All in sight, once home: days of food eaten at once, and no hunger left in them.)
      eatFrom(place, h, BINGE_DAYS * fk.daily);
      p.needs[i * NEEDS + N.food] = 0;
      p.owed[i] = 0;
      list[k + 1] = list[k + 1]! | 8;
    }
    return true;
  }
  // (One kneels at the town's altar; the rest wander dazed about the square.)
  const to =
    how === BREAK.pray ? place.bldgs.lot[buildingOf(place, ["temple", "shrine"])]! : AT.square;
  if (p.at[i] !== to) go(place, i, to, world);
  return true;
}
/** A tick of one held by the town's justice (false: their term is served, and they are let go). */
function heldTurn(cx: TickCx, i: number, h: number, fk: Frame): boolean {
  const { world, place, p, t, heldOf } = cx,
    k = heldOf!.get(p.id[i]!)!,
    list = place.held!;
  if (t >= list[k + 1]!) {
    list.splice(k, 3);
    if (!list.length) delete place.held;
    heldOf!.clear();
    if (place.held) for (const [id, at] of byId(place.held, 3)) heldOf!.set(id, at);
    note(place, HAP.freed, p.id[i]!);
    return false;
  }
  const labour = list[k + 2] === VERDICT.labour,
    at = labour ? AT.fields : heldAt(place);
  p.act[i] = labour ? ACT.work : ACT.held;
  p.why[i] = labour ? WHY.labour : WHY.held;
  if (p.at[i] !== at) go(place, i, at, world);
  // (Their household brings them their food, as it would eat it at home; and they sleep where they are held.)
  if (p.needs[i * NEEDS + N.food]! > FULL / 2) {
    const want = p.owed[i]! * fk.half,
      eaten = want > 0 ? eatFrom(place, h, want) : 0;
    if (eaten > 0) {
      const left = 1 - Math.min(1, eaten / want);
      p.needs[i * NEEDS + N.food] = Math.round(p.needs[i * NEEDS + N.food]! * left);
      p.owed[i] = Math.round(p.owed[i]! * left);
    }
  }
  if (!cx.air.lit)
    p.needs[i * NEEDS + N.rest] = Math.max(0, p.needs[i * NEEDS + N.rest]! - fk.rest);
  return true;
}
/** Where a place holds those its justice holds: a court, a prison or a barracks of its own, else stocks in its square. */
function heldAt(place: Place): number {
  const b = buildingOf(place, ["prison", "court", "barracks", "townhall", "hall"]);
  return b > 0 ? place.bldgs.lot[b]! : AT.square;
}
/** A place's law (N11), read of its realm as it stands now: how harsh, its justice, how far bought, by decree, how far it reaches. */
export function placeLaw(
  world: World,
  place: Place,
): {
  harsh: number;
  justice: number;
  bought: number;
  decree: boolean;
  hive: boolean;
  reach: number;
} {
  const realm = politiesOf(world).of(place.cell),
    order = realm ? orderOf(world)?.of(realm.ref) : undefined,
    row = courtIn(world, place.cell),
    hive = !keepsPersons(homePlanet(world).generated.life.people?.body.social),
    // (Where no court holds the land, the wronged and their kin bring it, and custom settles it.)
    court = row.court > 0;
  return {
    harsh: harshOf(holdOf(world, realm?.ref, HOLD.force), holdOf(world, realm?.ref, HOLD.voice)),
    justice: court && order ? lawOf(order, "justice").position : 0,
    bought: row.bought,
    decree: realm?.law === 1,
    hive,
    reach: court ? Math.max(0, row.court - 0.5 * row.bought) : 1,
  };
}
/**
 * A wrong brought before a place's justice (N11): one of its people (i) who wronged another (j; -1: the town, what they
 * spoiled). Brought as far as its court reaches; what comes of it drawn by its realm's own law (rules/sentences.ts
 * sentenceMix, a small wrong's gravity): a fine, paid of their household's food to the wronged household (or to the
 * town's store); labour or a term held (SENTENCE.pettyTerm on the mean, a year); death where the town is managed (else
 * held: its land's own reckoning says who dies); or let go.
 */
function judge(world: World, place: Place, i: number, j: number, wrong = 0, caught = false): void {
  const p = place.people,
    law = placeLaw(world, place),
    r = (k: number) => world.rng.unit(PLACE_DRAW, place.key ^ p.id[i]!, place.t, P.judge, k);
  // (One caught in the act by the watch is brought before it whatever its reach. O7.)
  if (!caught && r(0) >= law.reach) return;
  const mix = sentenceMix({
      grave: SENTENCE.pettyGrave,
      harsh: law.harsh,
      bought: law.bought,
      decree: law.decree,
      justice: law.justice,
      hive: law.hive,
    }),
    u = r(1) * mix.reduce((a, b) => a + b, 0);
  let verdict: number = VERDICT.freed;
  for (let k = 0, sum = 0; k < 5; k++)
    if (u < (sum += mix[k]!)) {
      verdict = [VERDICT.fined, VERDICT.death, VERDICT.labour, VERDICT.held, VERDICT.freed][k]!;
      break;
    }
  const orders = !!managedOf(world)?.get(place.town);
  if (verdict === VERDICT.death && !orders) verdict = VERDICT.held;
  note(place, HAP.judged, p.id[i]!, j >= 0 ? p.id[j]! : 0, verdict | (wrong << 4));
  if (j >= 0) remember(place, j, THOUGHT.righted, verdict === VERDICT.freed ? -5 : 6, p.id[i]!);
  const f = frameOf(world, place.cell);
  if (verdict === VERDICT.fined) {
    // (Its household's food, as much as it has: to the wronged household under custom, else to the town's store.)
    const take = eatFromTo(place, p.house[i]!, FINE_DAYS * f.daily);
    if (j >= 0 && law.justice === 0)
      for (let k = 0; k < FOODS.length; k++)
        place.houses.pantry[p.house[j]! * FOODS.length + k]! += take[k]!;
    else {
      const b = Math.max(0, buildingOf(place, ["granary", "market"]));
      for (let k = 0; k < FOODS.length; k++)
        place.bldgs.stock[b * GOOD_COUNT + FOODS[k]!]! += take[k]!;
    }
  } else if (verdict === VERDICT.held || verdict === VERDICT.labour) {
    const days = Math.max(1, Math.round(365 * SENTENCE.pettyTerm * (0.5 + r(2))));
    (place.held ??= []).push(p.id[i]!, place.t + days * DAY, verdict);
    remember(place, i, THOUGHT.heldBy, -25);
  } else if (verdict === VERDICT.death)
    (EXECUTED.get(place) ?? EXECUTED.set(place, []).get(place)!).push(p.id[i]!);
}
/** Those a place's justice put to death this tick, by number, to die at its end with its other dead (tick's epilogue). */
const EXECUTED = new WeakMap<Place, number[]>();
/** Of a place's broken down and held, those gone from it let go (at the day's turn). */
function pruneGone(place: Place): void {
  for (const key of ["breaks", "held"] as const) {
    const list = place[key];
    if (!list) continue;
    const keep: number[] = [];
    for (let k = 0; k + 2 < list.length; k += 3)
      if (placeIndexOf(place, list[k]!) >= 0) keep.push(list[k]!, list[k + 1]!, list[k + 2]!);
    if (keep.length) place[key] = keep;
    else delete place[key];
  }
}
/** Food taken from a household's pantry, each food in turn, as much as it has: what was taken of each (FOODS' order). */
function eatFromTo(place: Place, h: number, want: number): number[] {
  const out = FOODS.map(() => 0);
  for (let k = 0; k < FOODS.length && want > 0; k++) {
    const at = h * FOODS.length + k,
      take = Math.min(place.houses.pantry[at]!, Math.ceil(want));
    place.houses.pantry[at]! -= take;
    out[k] = take;
    want -= take;
  }
  return out;
}
/** One of a place's makers at a work (N11): what it shows, a happening of its log; made where they work. False: none to make. */
function makeWork(cx: TickCx, i: number): boolean {
  const { place, p, t } = cx,
    lot = p.at[i]!;
  if (lot < 0 || lot === AT.fields || lot === AT.square || lot === AT.walls) return false;
  // (What it shows: the gravest of the last year's happenings, the latest of them; else the town itself.)
  let shows: PlaceHap | null = null;
  for (let k = place.log.length - 1; k >= 0; k--) {
    const x = place.log[k]!;
    if (t - x.t > YEAR) break;
    if (
      WORK_SUBJECTS.has(x.what) &&
      (!shows || (HAP_GRAVE.has(x.what) && !HAP_GRAVE.has(shows.what)))
    )
      shows = x;
  }
  const level = levelOf(Math.floor(hoursAt(p, i, SK.crafts) / 6)),
    w = (place.works ??= []),
    // (A strange mood, P8: one long at their craft, by their wonder, makes a masterwork past their skill, now and again.)
    strange =
      level >= STRANGE_LEVEL &&
      cx.world.rng.chance(
        STRANGE_CHANCE * placeFacets(place, i)[5]!,
        PLACE_DRAW,
        place.key ^ p.id[i]!,
        Math.floor(t / PLACE_TICK),
        P.strange,
      );
  w.push(
    lot,
    t,
    p.id[i]!,
    shows ? shows.what : -1,
    shows ? shows.id : 0,
    shows ? Math.floor(shows.t / DAY) : 0,
    strange ? 4 : Math.max(0, Math.min(4, level)),
  );
  if (strange) (place.arts ??= []).push(t, p.id[i]!);
  // (Past the most a building holds, its oldest worn away.)
  let at = 0;
  for (let k = 0; k + 6 < w.length; k += 7) if (w[k] === lot) at++;
  if (at > WORKS_MOST) {
    const first = w.findIndex((x, k) => k % 7 === 0 && x === lot);
    w.splice(first, 7);
  }
  note(place, strange ? HAP.inspired : HAP.madeWork, p.id[i]!, lot);
  p.act[i] = ACT.work;
  p.why[i] = WHY.work;
  return true;
}
/**
 * P8. A strange mood: of a maker's works, the share made in one, by their wonder (their sixth facet, 0 … 1), once they are
 * fine at their craft (est.: an eighth of the works of the most wondering of masters; first light's town of 2,200 makes some
 * twenty works a year, most by its masters, so one or two of a strange mood a year, and its town of 600 one every few years).
 */
const STRANGE_CHANCE = 1 / 8,
  STRANGE_LEVEL = 3;
/**
 * R1. One of a place's dead as they stood at their death, kept for their page: MOURN_STRIDE numbers. Their number, when
 * (seconds), what took them and what it was of (as its log's line), sex and trade (sexOcc), their household's key and home
 * lot, the day they were born, mother, father, mate, friend, their trade; their memories then (MOURN_MEMS: kind and size
 * now); those they thought most and least of (MOURN_TIES: their number and opinion).
 */
export const MOURN_MEMS = THOUGHTS,
  MOURN_TIES = 3,
  MOURN_STRIDE = 12 + 2 * MOURN_MEMS + 2 * MOURN_TIES,
  /** The most of its dead a place keeps a page for (the oldest let go first). */
  MOURN_KEPT = 64;
export type Mourned = {
  readonly id: number;
  readonly t: number;
  readonly what: number;
  readonly a: number;
  readonly sexOcc: number;
  readonly key: number;
  readonly home: number;
  readonly born: number;
  readonly mother: number;
  readonly father: number;
  readonly mate: number;
  readonly friend: number;
  readonly memories: readonly { readonly thought: number; readonly size: number }[];
  readonly ties: readonly { readonly id: number; readonly opinion: number }[];
};
function mourn(place: Place, i: number, what: number, a: number): void {
  if (i < 0 || i >= place.people.n) return;
  const p = place.people,
    today = Math.floor(place.t / DAY),
    h = p.house[i]!,
    rec: number[] = [
      p.id[i]!,
      Math.floor(place.t),
      what,
      a | 0,
      p.sexOcc[i]!,
      place.houses.key[h] ?? 0,
      place.houses.home[h] ?? -1,
      p.born[i]!,
      p.mother[i]!,
      p.father[i]!,
      p.mate[i] === PROMISED ? 0 : p.mate[i]!,
      p.friend[i]!,
    ];
  // (What they carried in mind at the end: each memory's kind and its size then.)
  for (let k = 0; k < MOURN_MEMS; k++) {
    const v = p.thought[i * THOUGHTS + k]!,
      now = v ? Math.round(thoughtNow(v, today)) : 0;
    rec.push(now ? thoughtKind(v) : 0, now);
  }
  // (Those they thought most of, and the one they thought least of where they thought ill of anyone.)
  const ties = placeTies(place, i),
    chosen = ties.slice(0, MOURN_TIES - 1);
  const worst = ties.at(-1);
  if (worst && worst.opinion < 0 && !chosen.includes(worst)) chosen.push(worst);
  else if (ties[MOURN_TIES - 1]) chosen.push(ties[MOURN_TIES - 1]!);
  for (let k = 0; k < MOURN_TIES; k++) {
    const t = chosen[k];
    rec.push(t ? p.id[t.j]! : 0, t ? t.opinion : 0);
  }
  const m = (place.mourned ??= []);
  m.push(...rec);
  if (m.length > MOURN_KEPT * MOURN_STRIDE) m.splice(0, m.length - MOURN_KEPT * MOURN_STRIDE);
}
/** One of a place's dead as their page reads them (R1; null: none kept by that number). */
export function placeMourned(place: Place, id: number): Mourned | null {
  const m = place.mourned ?? [];
  for (let o = m.length - MOURN_STRIDE; o >= 0; o -= MOURN_STRIDE) {
    if (m[o] !== id) continue;
    const memories: { thought: number; size: number }[] = [],
      ties: { id: number; opinion: number }[] = [];
    for (let k = 0; k < MOURN_MEMS; k++)
      if (m[o + 12 + 2 * k])
        memories.push({ thought: m[o + 12 + 2 * k]!, size: m[o + 13 + 2 * k]! });
    for (let k = 0; k < MOURN_TIES; k++) {
      const at = o + 12 + 2 * MOURN_MEMS + 2 * k;
      if (m[at]) ties.push({ id: m[at]!, opinion: m[at + 1]! });
    }
    return {
      id,
      t: m[o + 1]!,
      what: m[o + 2]!,
      a: m[o + 3]!,
      sexOcc: m[o + 4]!,
      key: m[o + 5]!,
      home: m[o + 6]!,
      born: m[o + 7]!,
      mother: m[o + 8]!,
      father: m[o + 9]!,
      mate: m[o + 10]!,
      friend: m[o + 11]!,
      memories,
      ties,
    };
  }
  return null;
}
/** The dead of a place kept for their pages (R1), the latest first: their numbers. */
export function placeMournedIds(place: Place): number[] {
  const m = place.mourned ?? [],
    out: number[] = [];
  for (let o = m.length - MOURN_STRIDE; o >= 0; o -= MOURN_STRIDE) out.push(m[o]!);
  return out;
}
/** Whether a work of a place was made in a strange mood (P8). */
export function placeArt(place: Place, made: number, maker: number): boolean {
  const a = place.arts ?? [];
  for (let k = 0; k + 1 < a.length; k += 2) if (a[k] === made && a[k + 1] === maker) return true;
  return false;
}
/** The happenings a work may show: its gravest, and its glad days. */
const WORK_SUBJECTS: ReadonlySet<number> = new Set([
  HAP.died,
  HAP.starved,
  HAP.struckDead,
  HAP.fell,
  HAP.famine,
  HAP.plague,
  HAP.bled,
  HAP.festered,
  HAP.born,
  HAP.paired,
  HAP.buried,
  HAP.brawl,
  HAP.homeless,
  HAP.executed,
]);
/** A place's works at a lot, read (N11): what each shows, who made it, when, how fine; the latest first. */
export function placeWorks(
  world: World,
  place: Place,
  lot: number,
): {
  what: number;
  whom: number;
  day: number;
  maker: number;
  made: number;
  quality: number;
  form: string;
}[] {
  const w = place.works ?? [],
    form =
      artOf(world, place.cell)?.form ??
      SENSE_ARTS[homePlanet(world).generated.life.people?.body.senses[0] ?? "sight"],
    out = [];
  for (let k = w.length - 7; k >= 0; k -= 7)
    if (w[k] === lot)
      out.push({
        made: w[k + 1]!,
        maker: w[k + 2]!,
        what: w[k + 3]!,
        whom: w[k + 4]!,
        day: w[k + 5]!,
        quality: w[k + 6]!,
        form,
      });
  return out;
}
/** One of a place's people broken down, or held, read (N11; null: neither). */
export function placeBreak(place: Place, i: number): { how: number; left: number } | null {
  const list = place.breaks ?? [],
    id = place.people.id[i]!;
  for (let k = 0; k + 2 < list.length; k += 3)
    if (list[k] === id) return { how: list[k + 1]! & 7, left: Math.max(0, list[k + 2]! - place.t) };
  return null;
}
export function placeJailed(place: Place, i: number): { how: number; left: number } | null {
  const list = place.held ?? [],
    id = place.people.id[i]!;
  for (let k = 0; k + 2 < list.length; k += 3)
    if (list[k] === id) return { how: list[k + 2]!, left: Math.max(0, list[k + 1]! - place.t) };
  return null;
}

// —— A wound by the hour, and the healer's work (N9) —————————————————————————————————————————————————————————————————

/** The doses of remedies a place's healer keeps by them (thousandths: place.herbs). */
const herbsWanted = (place: Place): number =>
  1000 * Math.max(HERBS_LEAST, Math.ceil(place.people.n / HERBS_PER));
/** A place's healer: of its grown who are not abed, the one with the most hours at healing (the lowest numbered of as many). */
function healerOf(place: Place, f: Frame): number {
  const p = place.people;
  let best = -1,
    most = -1;
  for (let i = 0; i < p.n; i++) {
    if (p.health[i] === 1 || p.health[i] === 2 || occOf(p, i) === OCC.dependent) continue;
    if (ageOf(p, i, place.t) < f.life.adulthood) continue;
    const h = hoursAt(p, i, SK.healing);
    if (h > most || (h === most && p.id[i]! < p.id[best]!)) {
      most = h;
      best = i;
    }
  }
  return best;
}
/** Whether a place's healer has seen one of its festering today. */
const seenToday = (place: Place, id: number): boolean =>
  !!place.tended && place.tended.indexOf(id, 1) > 0;
/**
 * Of a place's hurt abed at home, the one who wants its healer most (-1: none): a wound undressed first, the hardest
 * bleeding of them first; then, where the healer is awake, one festering they have not seen today, the worst first.
 */
function patientFor(cx: TickCx, awake: boolean): number {
  const { place, p, houses } = cx;
  let best = -1,
    want = 0,
    worst = -1;
  for (let q = 0; q < p.n; q++) {
    if (p.health[q] !== 1 || p.eta[q] || p.at[q] !== houses.home[p.house[q]!]) continue;
    const v = p.fester[q]!,
      need = !(v & FESTER_DRESSED)
        ? 2
        : awake && v & FESTER_LOAD && !seenToday(place, p.id[q]!)
          ? 1
          : 0,
      how = need === 2 ? p.bleed[q]! : v & FESTER_LOAD;
    if (need > want || (need === want && need > 0 && how > worst)) {
      best = q;
      want = need;
      worst = how;
    }
  }
  return best;
}
/**
 * The healer at the bedside of one of the hurt: the wound dressed, its bleeding stopped; a festering they have not seen
 * today washed and given a day's remedies from those they have gathered (rules/healing.ts remedyFight: the share of its
 * land's care that remedies bring), or from its hospital's where it keeps one.
 */
function treat(cx: TickCx, q: number): void {
  const { place, p, matched, hospital } = cx,
    v = p.fester[q]!;
  p.bleed[q] = 0;
  let next = v | FESTER_DRESSED;
  if (v & FESTER_LOAD && !seenToday(place, p.id[q]!)) {
    if (hospital || (place.herbs ?? 0) >= 1000) {
      if (!hospital) place.herbs = (place.herbs ?? 0) - 1000;
      const load = Math.max(
        0,
        Math.round(
          (v & FESTER_LOAD) - remedyFight(Math.min(matched.care ?? 0, matched.remedies ?? 0)),
        ),
      );
      next = (next & ~FESTER_LOAD) | load;
    }
    (place.tended ??= [place.day]).push(p.id[q]!);
  }
  p.fester[q] = next;
}
/**
 * A day of a wound abed (N9): the first day's turn after it was dealt says whether it festers (rules/healing.ts
 * festerChance, by its blow); a festering grows, and the body fights it off by the care brought to it: that of clean hands
 * where it is dressed (its land's care less what remedies bring), and remedies at its hospital. The healer's remedies are
 * brought at their visit (treat). True: it has killed them (only where the town is managed, as a bleeding).
 */
function festerDay(cx: TickCx, i: number): boolean {
  const { world, place, p, matched, orders, hospital } = cx,
    v = p.fester[i]!,
    dressed = v & FESTER_DRESSED,
    blow = blowOf(place, i, p.cause[i]! & 7);
  if (!(v & FESTER_SEEN)) {
    const r = (k: number) => world.rng.unit(PLACE_DRAW, place.key ^ p.id[i]!, place.t, P.fester, k),
      festers = r(0) < festerChance(blow);
    p.fester[i] = FESTER_SEEN | dressed | (festers ? Math.round(festerStart(r(1))) : 0);
    return false;
  }
  const load = v & FESTER_LOAD;
  if (!load) return false;
  const care = matched.care ?? 0,
    remedies = Math.min(care, matched.remedies ?? 0),
    brought = dressed ? care - remedies + (hospital ? remedies : 0) : 0,
    n = festerNext(load, fightOf(brought, p.blood[i]! / BLOOD_UNITS)),
    // (Whole steps a day, away from where the body's fight and the festering's growth balance: rounded, a load beside
    // that balance stood at it for good, abed and neither dying nor mending. At the balance itself the body wins.)
    next = n > load ? Math.ceil(n) : Math.max(0, n < load ? Math.floor(n) : load - 1);
  if (next >= FESTER_MOST) {
    if (orders) return true;
    // (Where the town is not managed its land's own reckoning says who dies of it: here the fever breaks, and they
    // come through it. It stood at its height for good, and they never rose.)
    p.fester[i] = FESTER_SEEN | dressed;
    return false;
  }
  p.fester[i] = FESTER_SEEN | dressed | next;
  return false;
}
/** One of a place's people's wound by the hour, read (N9): how hard it bleeds, the blood lost, its festering, their pain. */
export type PlaceWoundRead = {
  /** The share of their blood it loses in ten minutes now, and that lost (0 … 1); past `faint` they cannot stand. */
  readonly bleeding: number;
  readonly blood: number;
  readonly faint: boolean;
  /** Its festering (0: clean; FESTER_MOST: what kills), whether it has yet been seen to fester or not, and dressed. */
  readonly fester: number;
  readonly seen: boolean;
  readonly dressed: boolean;
  /** How much it hurts them, 0 … 1 (rules/healing.ts painOf, by the tissue it reached: rules/tissues.ts). */
  readonly pain: number;
  /** Whether the healer has seen to its festering today. */
  readonly tended: boolean;
  /** The tissue it reached (null: none known). */
  readonly tissue: Tissue | null;
};
/** The tissue one's wound reached (null: none, or one dealt before tissues were). */
const tissueAt = (p: People, i: number): Tissue | null => TISSUES[p.tissue[i]! - 1] ?? null;
/** How much a wound hurts (0 … 1): its days and its festering (rules/healing.ts painOf), by the tissue it reached. */
function woundPain(place: Place, i: number, v: number): number {
  const p = place.people,
    base = painOf(p.health[i] === 1, p.health[i] === 3, !!(v & FESTER_DRESSED), v & FESTER_LOAD),
    t = tissueAt(p, i),
    member = MEMBERS[(p.cause[i]! >> 3) - 1];
  if (!t || !member) return base;
  return Math.min(1, base * tissuePain(blowOf(place, i, p.cause[i]! & 7), member, t));
}
export function placeWound(place: Place, i: number): PlaceWoundRead {
  const p = place.people,
    v = p.fester[i]!,
    hurt = p.health[i] === 1 || p.health[i] === 3;
  return {
    bleeding: p.bleed[i]! / BLOOD_UNITS,
    blood: p.blood[i]! / BLOOD_UNITS,
    faint: p.blood[i]! >= BLOOD_FAINT,
    fester: v & FESTER_LOAD,
    seen: !!(v & FESTER_SEEN),
    dressed: !!(v & FESTER_DRESSED),
    pain: hurt ? woundPain(place, i, v) : 0,
    tissue: tissueAt(p, i),
    tended: seenToday(place, p.id[i]!),
  };
}
/** A place's healer, read (N9): who (their place among its people; -1: none), and the doses of remedies by them, and wanted. */
export function placeHealer(place: Place): { i: number; doses: number; wanted: number } {
  const i = place.healer ? placeIndexOf(place, place.healer) : -1;
  return {
    i,
    doses: Math.floor((place.herbs ?? 0) / 1000),
    wanted: herbsWanted(place) / 1000,
  };
}

/** One tick of a place: every one's needs move, and each does what presses most. */
// —— Tiers (asked 2026-11-26) ———————————————————————————————————————————————————————————————————————————————————————
// A town's people followed as closely as they matter where the eye and the story are: in full, a tick each, those the
// player follows, its notables (its healer, those who lead it) and their households, and any caught up in a happening
// (abed, bleeding, at a fire, at a burial, tending the hurt, broken down, held by its justice); light, at the hour, the
// households of those caught up and the friends and the paired of those in full; the rest among the folk, every three
// hours. Every one keeps all of their columns, so whoever is looked at is there in full, and one's tier changes only
// how often they are turned. What they do at a turn is done for the ticks to come (their work's yield, its hours); what
// ends within the stride (a meal, company, warmth, waking, a need pressing past their work, the working day's turn) ends
// at its tick, and they turn again then to what comes next; their walk is by the tick, and on coming where they were
// going they turn for the rest of their stride; a fire about them turns them out at once. Their needs are reckoned at
// each of those ticks for what they did up to it (`reck`), so a meal had within a stride is not hungered after for the
// whole of it. (Measured, tools/place-ab.ts --tiers, a town of 5,492 thirty days from three days three apart: its
// grain, tools, food, people, births, deaths and what befell it agree with all in full, within a day's spread; a tick
// 0.29-0.35 ms warm against 0.67-0.83 in full, 0.5 cold against 0.9. Before the reckoning by the tick its grain came
// short by a seventh: a meal within a stride was hungered after for all of it, and its folk went home to eat again
// within the hour. A work's draw falls once in 64 ticks of a maker's work in either: 63.6 in full, 64.7 in tiers, over
// ten days.)

/**
 * One of a place's people's needs gone on `k` ticks at what they are doing: hungrier, tireder or rested, colder or
 * warmer, lonelier or in company; and what they have yet to eat.
 */
function accrue(
  cx: TickCx,
  i: number,
  k: number,
  fk: Frame,
  coldTo: number,
  asleep: boolean,
  moving: boolean,
  inside: boolean,
): void {
  const { cNeeds, cAct, cOwed, chill, warmUp } = cx,
    at0 = i * NEEDS;
  // Needs. (One raising a building, or carrying to it, is hungry half again as fast: sim/town/asks.ts feed.)
  cNeeds[at0 + N.food] = Math.min(
    FULL,
    cNeeds[at0 + N.food]! +
      (asleep
        ? fk.hunger >> 2
        : cAct[i] === ACT.build || cAct[i] === ACT.stuff
          ? fk.hunger + (fk.hunger >> 1)
          : fk.hunger) *
        k,
  );
  // (What they have yet to eat grows by the clock, asleep or awake: its land's reckoning counts a mouth by the month.)
  cOwed[i] = Math.min(
    65535,
    cOwed[i]! + (cAct[i] === ACT.build || cAct[i] === ACT.stuff ? 3 : 2) * k,
  );
  cNeeds[at0 + N.rest] = asleep
    ? Math.max(0, cNeeds[at0 + N.rest]! - fk.rest * k)
    : Math.min(FULL, cNeeds[at0 + N.rest]! + fk.tire * k);
  const chilled0 = cNeeds[at0 + N.cold]!,
    // (Indoors, a home or a building with a fire in it keeps all the cold out; any other walls keep out most of it. P5.)
    to = inside
      ? cx.lets && coldTo
        ? Math.round(coldTo * (cx.lets.get(cx.cAt[i]!) ?? 0))
        : 0
      : coldTo;
  cNeeds[at0 + N.cold] =
    chilled0 > to ? Math.max(to, chilled0 - warmUp * k) : Math.min(to, chilled0 + chill * k);
  // (Company is had among others in the square; work neither gives it nor takes it, nor does sleep.)
  if (!moving && cAct[i] === ACT.visit)
    cNeeds[at0 + N.lone] = Math.max(0, cNeeds[at0 + N.lone]! - 12 * fk.lone * k);
  else if (!asleep && (moving || cAct[i] !== ACT.work))
    cNeeds[at0 + N.lone] = Math.min(FULL, cNeeds[at0 + N.lone]! + fk.lone * k);
}
/**
 * One followed at a stride's needs reckoned to `to` ticks into it, at what they have been doing since they were last
 * reckoned (tiers).
 */
function reckon(cx: TickCx, i: number, to: number): void {
  const p = cx.p,
    rk = p.reck[i]!;
  if (to <= rk) return;
  const kind = cx.fs ? (cx.houses.kind[p.house[i]!] ?? 0) : 0,
    fk = cx.fs ? (cx.fs[kind] ?? cx.f) : cx.f,
    coldTo = cx.coldTos ? (cx.coldTos[kind] ?? cx.coldTo0) : cx.coldTo0,
    moving = p.eta[i]! > 0,
    where = p.at[i]!;
  accrue(
    cx,
    i,
    to - rk,
    fk,
    coldTo,
    p.act[i] === ACT.sleep,
    moving,
    !moving && where !== AT.fields && where !== AT.square && where !== AT.walls,
  );
  p.reck[i] = to;
}
/**
 * One followed at a stride gone on with after `used` ticks of it at what they were at: turned to what comes next for
 * the `rest`, and any walk they set out on then put off by those ticks, so they come where they go when one followed
 * in full would (its figure stands till then). Tiers.
 */
function goOn(cx: TickCx, i: number, used: number, rest: number, wake = false): void {
  const eta = cx.p.eta,
    was = eta[i]!,
    flip = flipTicks(cx),
    w0 = cx.working,
    o0 = cx.offWork,
    p0 = cx.playing,
    a0 = cx.ahead;
  // (Gone on with as the hour it is then: their needs reckoned to it, at what they were doing; past the working day's turn
  // within the stride, its other side.)
  cx.ahead = a0 + used;
  reckon(cx, i, cx.base + cx.ahead);
  if (wake) cx.p.act[i] = ACT.idle;
  const real = inWorkDay(cx.today0, cx.t);
  if (flip > 0 && cx.ahead >= flip) {
    cx.working = !real;
    cx.offWork = cx.working ? 1 : OFF_WORTH;
    cx.playing = cx.air.lit && !cx.working;
  }
  turnOf(cx, i, 0, rest);
  cx.working = w0;
  cx.offWork = o0;
  cx.playing = p0;
  cx.ahead = a0;
  if (!was && eta[i]) eta[i] = Math.min(65535, eta[i]! + used);
}
/** The ticks from this one till the working day begins or ends (TIER_ROUND at the most: not within any stride). */
function flipTicks(cx: TickCx): number {
  if (cx.flip < 0) {
    const now = inWorkDay(cx.today0, cx.t);
    let n = 1;
    while (n < TIER_ROUND && inWorkDay(cx.today0, cx.t + n * PLACE_TICK) === now) n++;
    cx.flip = n;
  }
  return cx.flip;
}
/**
 * One of a trade resting or at play at a turn of a stride, their working day beginning within it: turned to it at its
 * hour, as one followed in full is, not at their next turn. Tiers.
 */
function dayTurns(cx: TickCx, i: number, wk: number, occ: number): void {
  if (wk <= 1 || cx.working || occ === OCC.dependent) return;
  const d = flipTicks(cx) - cx.ahead;
  if (d > 0 && d < wk) goOn(cx, i, d, wk - d);
}
/**
 * The ticks one at work can give it before a need presses past what it is worth to them (at its rates at work: hunger,
 * tiredness, and the cold out of doors), at least one.
 */
function workTicks(
  cx: TickCx,
  i: number,
  fk: Frame,
  bar: number,
  coldTo: number,
  inside: boolean,
): number {
  const p = cx.p,
    at = i * NEEDS,
    line = FULL * Math.cbrt(Math.min(1, bar)),
    until = (now: number, rate: number) =>
      rate <= 0 ? Infinity : Math.max(1, Math.ceil((line - now) / rate));
  let d = Math.min(until(p.needs[at + N.food]!, fk.hunger), until(p.needs[at + N.rest]!, fk.tire));
  if (!inside && coldTo > line) d = Math.min(d, until(p.needs[at + N.cold]!, cx.chill));
  return d;
}
/**
 * One asleep at a turn of a stride: woken within it where their rest is done before it ends (by so much a tick), and
 * turned to what comes next for the rest of it, as one followed in full would wake.
 */
function wakes(cx: TickCx, i: number, wk: number): void {
  const p = cx.p,
    h = p.house[i]!,
    kind = cx.fs ? (cx.houses.kind[h] ?? 0) : 0,
    fk = cx.fs ? (cx.fs[kind] ?? cx.f) : cx.f,
    at = i * NEEDS + N.rest,
    over = p.needs[at]! - 0.04 * FULL,
    d = over <= 0 ? 1 : Math.ceil(over / Math.max(1, fk.rest));
  if (d >= wk) return;
  goOn(cx, i, d, wk - d, true);
}
/** The tiers, and how many ticks a turn is in each (each a whole share of the next, and of a day). */
export const TIER = { full: 0, light: 1, folk: 2 } as const;
export const TIER_STRIDE: number[] = [1, 6, 18];
/** The strides set otherwise, each a whole share of the next and of the round (tools measuring them). */
export function placeStrides(light: number, folk: number): void {
  TIER_STRIDE[1] = light;
  TIER_STRIDE[2] = folk;
}
const TIER_ROUND = 18;
export const TIER_WORDS = [
  "followed in full",
  "followed at the hour",
  "among the folk, every three hours",
] as const;
/** Whether a place's people are followed in tiers (tools set it off to follow all in full, to measure against). */
let TIERED = true;
export function placeTiered(on: boolean): void {
  TIERED = on;
}
/** Who matters in full this tick, read once: by number, and each household so (2: with one followed in full by the
 * player's word or a notable; 1: with one caught up in a happening). */
type TierWorth = { readonly full: Set<number>; readonly house: Uint8Array };
function tierWorth(cx: TickCx): TierWorth {
  const { place, p, houses, healerAt, breakOf, heldOf } = cx,
    full = new Set<number>(),
    house = new Uint8Array(houses.n),
    so = p.sexOcc,
    hs = p.house,
    health = p.health,
    bleed = p.bleed,
    act = p.act,
    id = p.id;
  const mark = (i: number, h: number) => {
    full.add(id[i]!);
    house[hs[i]!] = Math.max(house[hs[i]!]!, h);
  };
  for (let i = 0; i < p.n; i++) {
    if ((so[i]! & 15) === OCC.leader) mark(i, 2);
    else {
      const a = act[i]!;
      if (
        health[i] === 1 ||
        health[i] === 2 ||
        bleed[i] ||
        a === ACT.brigade ||
        a === ACT.mourn ||
        a === ACT.tend
      )
        mark(i, 1);
    }
  }
  if (healerAt >= 0) mark(healerAt, 2);
  const pins = place.pins;
  if (pins)
    for (let k = 0; k < pins.length; k += 2) {
      const i = placeIndexOf(place, pins[k]!);
      if (i >= 0) mark(i, 2);
    }
  for (const m of [breakOf, heldOf])
    if (m)
      for (const who of m.keys()) {
        const i = placeIndexOf(place, who);
        if (i >= 0) mark(i, 1);
      }
  return { full, house };
}
/** The tier one would be at now. */
function tierOf(cx: TickCx, w: TierWorth, i: number): number {
  const p = cx.p,
    h = w.house[p.house[i]!]!;
  if (h === 2 || w.full.has(p.id[i]!)) return TIER.full;
  if (h === 1 || (p.friend[i] && w.full.has(p.friend[i]!)) || (p.mate[i] && w.full.has(p.mate[i]!)))
    return TIER.light;
  return TIER.folk;
}
/** How closely one of a place's people is followed, and whether by the player's word (and till when: -1, till unsaid). */
export function placeTier(
  place: Place,
  i: number,
): { tier: number; words: string; pinned: number | null } {
  const id = place.people.id[i]!,
    pins = place.pins ?? [];
  let pinned: number | null = null;
  for (let k = 0; k < pins.length; k += 2) if (pins[k] === id) pinned = pins[k + 1]!;
  // (One followed or looked at is in full from the next tick: so told at once, paused or not.)
  const tier = pinned !== null ? TIER.full : place.people.tier[i]! & 3;
  return { tier, words: TIER_WORDS[tier] ?? TIER_WORDS[0], pinned };
}
/**
 * Those the player follows or looks at (`pins`), among the light or the folk, raised into full at once (tiers): their
 * needs reckoned to this tick, and the ticks of their stride their last turn already did the work of (its yield, its
 * hours) gone through in full with none (`tier`'s bits above its two low ones, spent a tick at a time by countHours).
 * Raised at any tick: full is a stride of one, which every tick shares.
 */
function raise(cx: TickCx, T: number): void {
  const { p, place } = cx,
    pins = place.pins!;
  for (let k = 0; k < pins.length; k += 2) {
    const i = placeIndexOf(place, pins[k]!);
    if (i < 0) continue;
    const was = p.tier[i]! & 3;
    if (was === TIER.full) continue;
    const s = TIER_STRIDE[was]!,
      a = ((T + p.id[i]!) % TIER_ROUND) % s;
    if (p.reck[i]! < a) reckon(cx, i, a);
    p.reck[i] = p.reck[i]! - a;
    p.tier[i] = TIER.full | ((s - a - 1) << 2);
  }
}
/**
 * One of a place's people followed in full by the player's word, or let go of (tiers): `until` the moment it holds to
 * (seconds; -1 till unsaid), or null to let go. Kept with the place. They are followed so from their next turn on.
 */
export function placePin(place: Place, id: number, until: number | null): void {
  const list = (place.pins ?? []).slice(),
    at = list.findIndex((x, k) => k % 2 === 0 && x === id);
  if (at >= 0) list.splice(at, 2);
  if (until !== null && placeIndexOf(place, id) >= 0) list.push(id, until);
  if (list.length) place.pins = list;
  else delete place.pins;
}
/** Those followed by word whose time has run or who are gone, let go of (each day). */
function prunePins(place: Place): void {
  const list = place.pins!,
    keep: number[] = [];
  for (let k = 0; k + 1 < list.length; k += 2)
    if ((list[k + 1]! < 0 || list[k + 1]! > place.t) && placeIndexOf(place, list[k]!) >= 0)
      keep.push(list[k]!, list[k + 1]!);
  if (keep.length) place.pins = keep;
  else delete place.pins;
}

function tick(world: World, place: Place, f: Frame): void {
  // (Its households read for the day at its first tick: COND; and its homes' comfort and beauty.)
  houseDay(place, f, true);
  needsDay(world, place, true);
  const cx = tickCx(world, place, f),
    { p, houses, t, today, dying, dyingWhy } = cx;
  // Each at their tier's stride (tiers): in full a tick each; light and folk at their hour, their walk by the tick and
  // a turn on coming where they were going, and turned out at once to a fire about them. Their tier read again at their
  // turns that fall on a stride of both the one they were at and the one it would be.
  const T = cx.tickNo,
    tier = p.tier,
    eta = p.eta,
    ids = p.id,
    worthy = TIERED ? tierWorth(cx) : null;
  for (let i = 0; i < p.n; i++) {
    const was = tier[i]! & 3;
    if (!worthy) {
      turnOf(cx, i, 1, 1);
      continue;
    }
    const at = (T + ids[i]!) % TIER_ROUND;
    // (One in full a tick each; one raised into full within a stride, its ticks already worked at their last turn done
    // with no more work's worth till they are spent, and in full till then.)
    if (was === TIER.full && (tier[i]! > 3 || at % TIER_STRIDE[TIER.light]! !== 0)) {
      turnOf(cx, i, 1, tier[i]! > 3 ? 0 : 1);
      continue;
    }
    const s = TIER_STRIDE[was]!,
      a = at % s;
    if (a !== 0) {
      if (eta[i]) {
        if (eta[i] === 1) {
          // (Come where they were going: their needs reckoned to now, on the way, and a turn.)
          reckon(cx, i, a);
          eta[i] = 0;
          p.at[i] = p.to[i]!;
          p.trip[i] = 0;
          const left = s - 1 - a;
          cx.base = a;
          if (left > 0) turnOf(cx, i, 0, left);
          cx.base = 0;
        } else eta[i]!--;
      } else if (cx.fireLot !== null && p.act[i] !== ACT.brigade && cx.fireOut!.has(ids[i]!)) {
        reckon(cx, i, a);
        cx.base = a;
        turnOf(cx, i, 0, 0);
        cx.base = 0;
      }
      continue;
    }
    let now = tierOf(cx, worthy, i);
    if (at !== 0 && now === TIER.folk) now = TIER.light;
    // (Leaving full: what only full keeps let go of to their columns.)
    if (was === TIER.full && now !== TIER.full && place.deep) deepLetGo(place, i);
    tier[i] = now;
    turnOf(cx, i, s, TIER_STRIDE[now]!);
  }
  // (Those its justice put to death this tick die with its other dead, in their places' order: N11.)
  const put = EXECUTED.get(place);
  if (put) {
    EXECUTED.delete(place);
    for (const id of put) {
      const i = placeIndexOf(place, id);
      if (i < 0 || dying.includes(i)) continue;
      let at = dying.findIndex((x) => x > i);
      if (at < 0) at = dying.length;
      dying.splice(at, 0, i);
      dyingWhy.splice(at, 0, HAP.executed);
    }
  }
  // The hours given this tick to kinds of work but one's own trade's (N6; their own trade's are counted at it, above).
  countHours(place, f, worthy ? T : -1);
  // Those the player follows or looks at, among the light or the folk: in full from the next tick, not their next turn.
  if (worthy && place.pins) raise(cx, T);
  // Those who died of want, or of a wound: told, kept for its land's telling, and gone.
  for (let k = dying.length - 1; k >= 0; k--) {
    const i = dying[k]!,
      row = sexOf(p, i) * BANDS + bandOf(ageOf(p, i, t), f.life);
    note(place, dyingWhy[k]!, p.id[i]!, Math.round(ageOf(p, i, t)), occOf(p, i), i);
    place.dead.push(row, occOf(p, i), 1);
    houses.grief[p.house[i]!] = today;
    removePerson(place, i);
  }
  place.t = t + PLACE_TICK;
}

/** What a number of ticks given to a kind of work is worth an hour, against a master's (skillWorth: a master's, 1). */
const ticksWorth = (ticks: number): number =>
  ticks >= SKILL_MOST ? 1 : skillWorth(levelOf(Math.floor(ticks / 6)));

/**
 * A tick's hours at the kinds of work that are not one's own trade's: at another trade's, turned to it; raising a building
 * or bringing what it is built of; tending one of their household abed whom it tends (awake, at home, and grown); at a
 * fire; and eating at home, a meal made at their hearth. Each grown one at one kind a tick (no more than a master's).
 */
function countHours(place: Place, f: Frame, T = -1): void {
  const p = place.people,
    houses = place.houses;
  // (The households with one of theirs abed whom they tend themselves: no healer or hospital does.)
  let tending: Uint8Array | null = null;
  for (let i = 0; i < p.n; i++)
    if ((p.health[i] === 1 || p.health[i] === 2) && tendedOf(place, i) === "household")
      (tending ??= new Uint8Array(houses.n))[p.house[i]!] = 1;
  for (let i = 0; i < p.n; i++) {
    // (One followed at a stride: counted at their turn, the stride's ticks to come; one raised into full within it, not
    // again for the ticks their last turn counted. Tiers.)
    const tb = p.tier[i]!;
    if (tb > 3) {
      p.tier[i] = tb - 4;
      continue;
    }
    const s = T < 0 ? 1 : TIER_STRIDE[tb]!;
    if (s > 1 && ((T + p.id[i]!) % TIER_ROUND) % s !== 0) continue;
    const act = p.act[i]!,
      home = houses.home[p.house[i]!]!;
    let kind = -1;
    if (act === ACT.work)
      kind = p.why[i] === WHY.herbs ? SK.healing : p.turn[i] ? tradeKind(p.turn[i]!) : -1;
    else if (act === ACT.tend) kind = SK.healing;
    else if (act === ACT.build || act === ACT.stuff) kind = SK.building;
    else if (act === ACT.brigade) kind = SK.fire;
    else if (act === ACT.eat && p.at[i] === home && !p.eta[i]) kind = SK.cooking;
    else if (
      tending?.[p.house[i]!] &&
      !p.health[i] &&
      act !== ACT.sleep &&
      act !== ACT.abed &&
      p.at[i] === home &&
      !p.eta[i]
    )
      kind = SK.healing;
    if (kind < 0 || kind === tradeKind(occOf(p, i))) continue;
    if (ageOf(p, i, place.t) < f.life.adulthood) continue;
    const at = i * KINDS_N + kind;
    if (p.hours[at]! < SKILL_MOST) p.hours[at] = Math.min(SKILL_MOST, p.hours[at]! + s);
  }
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
      retrade(place, i, to);
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
  if (UNTAUGHT.has(place)) {
    UNTAUGHT.delete(place);
    for (let i = 0; i < place.people.n; i++) teach(place, i);
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
      if (place.mode === 2) PLACE_HOOKS.look?.(world, place);
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
    // (A day's births and deaths, at its turn.)
    if (place.t % DAY === 0) {
      vitalDay(world, place, f);
      gateDay(world, place);
    }
    if (place.due.length && place.due[0]! <= place.t) liveDue(world, place, f);
    tick(world, place, f);
    ticks++;
    // (A town stewarded: its head looks it over, on the hour.)
    if (place.mode === 2) PLACE_HOOKS.look?.(world, place);
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
  if (place) warmPlace(world, place);
  return place ?? null;
}

/** Whether a place's ways of reckoning have been gone through yet in this page (warmPlace). */
let warmed = false;
/**
 * The first place entered in a page made ready to be watched (asked 2026-11-26: a tick's cost right after entering):
 * a copy of it ticked through a day and thrown away, so that every way its people's turns go (the night, waking, work,
 * meals, the evening's play) has been gone through once before the place itself is. A page's script engine makes its
 * fast code of a function from the ways it has seen it go, and throws it away, to make it again, at the first turn it
 * had not seen (the dawn's work, the noon meal, the evening's games): in a town of 5,500 the first day's ticks cost four
 * times the next days', each hour of it that first met a new way 50 to 90 ms. Gone through here, it costs as much once,
 * while the place is being entered. Nothing of the copy is the place's: only the walks it found, which are the walks
 * the place would find (a walk is its streets' and its two doors' alone), are kept with the place's own.
 */
function warmPlace(world: World, place: Place): void {
  if (warmed) return;
  warmed = true;
  const from = new PlaceStore(),
    into = new PlaceStore();
  from.places.push(place);
  into.load(from.save());
  const copy = into.places[0],
    laid = LAID.get(place);
  if (!copy) return;
  if (laid) LAID.set(copy, laid);
  const f = frameOf(world, place.cell);
  for (let k = 0; k < DAY / PLACE_TICK; k++) tick(world, copy, f);
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

/**
 * Where one of a place's people stands among its columns, by their number (-1: not of it). Where each was last found is
 * kept, and taken where it still holds them (numbers are never given twice); else they are looked for one by one, as
 * before. (Each one's friend was looked for so once a day, a sweep of the whole place for each: in a town of 5,500 a
 * fifth of a millisecond every tick.)
 */
const FOUND = new WeakMap<Place, Map<number, number>>();
export function placeIndexOf(place: Place, id: number): number {
  const p = place.people;
  let found = FOUND.get(place);
  if (!found) FOUND.set(place, (found = new Map()));
  const at = found.get(id);
  if (at !== undefined && at < p.n && p.id[at] === id) return at;
  for (let i = 0; i < p.n; i++)
    if (p.id[i] === id) {
      // (No more kept than its people and as many again: those gone are let go once they pass it.)
      if (found.size >= 2 * p.n + 64) found.clear();
      found.set(id, i);
      return i;
    }
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
    case HAP.steward:
      return PLACE_HOOKS.told?.(place, x) ?? HAP_WORDS[x.what]!;
    case HAP.quarrel:
      return named?.(x.a) ? `quarrelled with ${named(x.a)}, whom they cannot abide` : "quarrelled";
    case HAP.brawl:
      return named?.(x.a)
        ? `came to blows with ${named(x.a)} and was parted from them`
        : "came to blows";
    case HAP.broke:
      return x.a === BREAK.wreck
        ? "broke down, their mood too low to bear, and lashed out at what lay about their work"
        : x.a === BREAK.binge
          ? "broke down, their mood too low to bear, and ate all in sight at home"
          : x.a === BREAK.pray
            ? "broke down, their mood too low to bear, and knelt at the town's altar"
            : "broke down, their mood too low to bear, and wandered dazed about the square";
    case HAP.judged: {
      const theft = x.b >> 4 === WRONG.theft,
        v = x.b & 15,
        of = theft
          ? named?.(x.a)
            ? ` for stealing from the household of ${named(x.a)}`
            : " for stealing"
          : named?.(x.a)
            ? ` for the blows with ${named(x.a)}`
            : x.a
              ? ""
              : " for what they spoiled";
      return v === VERDICT.fined
        ? `was brought before the town's justice${of}, and fined: their household paid a week's food`
        : v === VERDICT.death
          ? `was brought before the town's justice${of}, and put to death for it`
          : v === VERDICT.labour
            ? `was brought before the town's justice${of}, and set to labour at the fields for a term`
            : v === VERDICT.held
              ? `was brought before the town's justice${of}, and held for a term`
              : `was brought before the town's justice${of}, and let go`;
    }
    case HAP.parted:
      return named?.(x.a)
        ? `parted from ${named(x.a)}, whom they could no longer abide, and lives on under one roof with them`
        : "parted from the one they were paired with";
    case HAP.gate: {
      const [, from, why] = (place.gates?.[x.a] ?? "").split("|"),
        turned = x.b & GATE_TURNED ? ", and were turned away, its gate shut to newcomers" : "";
      return `came to the gate from ${from || "beyond"}, ${why || "on the road"}${turned}`;
    }
    case HAP.caught:
      return named?.(x.a)
        ? `was caught by the watch stealing from the household of ${named(x.a)}, being in want`
        : "was caught stealing by the watch, being in want";
    case HAP.stole:
      return named?.(x.a)
        ? `stole a day's food from the household of ${named(x.a)}, being in want`
        : "stole food, being in want";
    case HAP.inspired: {
      const b = place.bldgs.lot.indexOf(x.a);
      return `was seized by a strange mood, and made a masterwork past their own skill, kept ${b > 0 ? `at the ${kindName(place.bldgs.kind[b]!)}` : "at home"}`;
    }
    case HAP.madeWork: {
      const b = place.bldgs.lot.indexOf(x.a);
      return b > 0
        ? `made a work, kept at the ${kindName(place.bldgs.kind[b]!)}`
        : "made a work, kept at home";
    }
    default:
      return x.o
        ? (HAP_WORDS[x.what] ?? "").replace("by your order", "by its head's order")
        : (HAP_WORDS[x.what] ?? "");
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
  HAP.bled,
  HAP.festered,
  HAP.broke,
  HAP.judged,
  HAP.executed,
  // (Each of its head's decisions a line of its own, with its reason.)
  HAP.steward,
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
  "orders of the town's head",
  "quarrelled",
  "came to blows",
  "bled to death of their wounds",
  "died of wounds that festered",
  "broke down",
  "were brought before the town's justice",
  "were let go, their terms served",
  "were put to death by the town's justice",
  "made works",
  "stole from other households",
  "parted from those they were paired with",
  "were caught stealing by the watch",
  "came to the gate",
  "were seized by strange moods",
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

/** Whether a town's gate is shut to newcomers by order (P2). */
export const gateShut = (world: World, place: Place): boolean =>
  managedOf(world)?.get(place.town)?.gate === 0;

/**
 * Those come to its gate today, as its clock passes the day's turn (P2: host/placegate.ts reads them off its world's year),
 * each told at the hour they come: those who ask to live in it turned away where its gate is shut by order.
 */
function gateDay(world: World, place: Place): void {
  const day = Math.floor(place.t / DAY),
    come = gateOn(world, place.town, place.cell, day);
  if (!come.length) return;
  const shut = gateShut(world, place);
  for (const x of come) {
    const line = `${x.kind}|${x.from}|${x.why}|${x.ref ?? ""}`,
      gates = (place.gates ??= []);
    let k = gates.indexOf(line);
    if (k < 0) k = gates.push(line) - 1;
    place.log.push({
      // (Told at the day's turn, as its log keeps its days in order; the hour they come is the gate's page's.)
      t: place.t,
      what: HAP.gate,
      id: 0,
      a: k,
      b: x.count | (shut && GATE_ASKS.has(x.kind) ? GATE_TURNED : 0),
    });
  }
}

/** One its land's count brought to live in it, turned away at its gate shut by order (P2): told a line a day, counted. */
function turnedAway(place: Place): void {
  const line = "settlers|elsewhere in its land|asking to live in the town|",
    gates = (place.gates ??= []);
  let k = gates.indexOf(line);
  if (k < 0) k = gates.push(line) - 1;
  const last = place.log.at(-1),
    day = Math.floor(place.t / DAY);
  if (last && last.what === HAP.gate && last.a === k && Math.floor(last.t / DAY) === day) last.b++;
  else place.log.push({ t: place.t, what: HAP.gate, id: 0, a: k, b: 1 | GATE_TURNED });
}

/** Who a line of its log is of where it is no one of the town (P2: those come to its gate), else null. */
export function hapSubject(place: Place, x: PlaceHap): string | null {
  if (x.what !== HAP.gate) return null;
  const kind = (place.gates?.[x.a] ?? "").split("|")[0] as GateKind,
    n = x.b & (GATE_TURNED - 1);
  return GATE_WHO[kind]?.(n) ?? `${n} travellers`;
}

/** The page that tells more of what happened to someone (null: none): the battle, the sickness. */
export function hapRef(place: Place, x: PlaceHap): string | null {
  if (x.what === HAP.gate) return place.gates?.[x.a]?.split("|")[3] || null;
  if (x.what === HAP.fell || x.what === HAP.wounded) return place.wars[x.a]?.split("|")[1] ?? null;
  if (x.what === HAP.plague || x.what === HAP.sick) return place.ills[x.a]?.split("|")[1] ?? null;
  return null;
}

/** What happened to someone, in words ("died", "took up other work"). */
export const hapWords = (what: number): string => HAP_WORDS[what] ?? "";
