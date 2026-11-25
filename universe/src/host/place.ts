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
// Stated limits of this slice. A town's table is its land's shared by head-count (the world keeps none per town). Its
// people are not the roster's line-holders (host/roster.ts): they have names and pages of their own here. Its clock is
// the town view's standard day and year, not the world's own (see frameOf). A walk is reckoned by its length, not by
// the streets. Carriers bring a making its stuff; what is made waits where it was made, and wool, hides and the rest
// that no one here wins come and go at the month's matching. A land of several peoples is read by its first's body.
//
// WHAT A LATER SLICE NEEDS, for the player's management here to change the world (not done in this slice):
//  1. Commands. Anything the player does in a place (set a priority, move a stock, forbid a door) must be a kernel
//     command in the log, so that a save replays; the place would then be a ruled store, hashed from the first
//     command on (dormant before it, as town.asks is), and its stream registered: a rule-version bump.
//  2. A way back for totals. Today the world's month and year reckon the land's stocks, births and deaths, and the
//     place is reconciled to them. For management to matter the land's reckoning must read the place where one is
//     kept: the town's share of its land's making and eating (`flow` below is already that ledger, good by good),
//     its deaths by hunger and cold by band, fed into economy/systems.ts and population/systems.ts as the town's
//     part of the land's sums, the rest of the land reckoned as now.
//  3. A share that is the town's own. A town's table here is its land's table shared by head-count; the world keeps
//     no table per town. If a managed town is to differ from its land (fewer hungry, more smiths), the town's own
//     counts must be kept by the world, or the land's reckoning must take them from the place.
//  4. The same clock for all of a land. A place steps in minutes, its land in months: what the place made this month
//     must enter the land's books once, at the month's turn, never twice (the reconcile below is where it would).
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
import { PLACE_ACT, PLACE_AT } from "../bridge/index.ts";
import {
  BANDS,
  CIVICS,
  DRESS,
  FEMALE,
  FOODS,
  G,
  GOODS,
  HOLDS,
  OCC,
  OCCUPATIONS,
  RECIPES,
  SEXES,
  bandOf,
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
  homePlanet,
  levelsOf,
  lifeOf,
  familySizeOf,
  marketsOf,
  moneyStore,
  populationContext,
  townsOf,
  type Settlement,
} from "../sim/index.ts";

// —— Measures ————————————————————————————————————————————————————————————————————————————————————————————————————

/** A tick of a place's clock (seconds): ten minutes. */
export const PLACE_TICK = 600;
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
/** Of their time, the share the world's year takes its people to be at work: what a worker-year's making is spread over. */
const WORK_SHARE = 1 / 3;
/** The share of a body's own day it sleeps. */
const SLEEP_SHARE = 1 / 3;
/** How fast one walks (metres a second), and the ground a lot takes with its share of street (square metres). */
const WALK = 1.2;
const LOT_GROUND = 200;
/** What a household fetches at once from the town's stores: so many days of its eating. */
const FETCH_DAYS = 7;
/** A load one carries (units of the market's). */
const LOAD = 1;
/** Happenings kept for a place's pages. */
const LOG_MOST = 96;

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
} as const;

/** What happened to someone, as a place's log tells it. */
export const HAP = { born: 0, died: 1, came: 2, left: 3, trade: 4 } as const;
const HAP_WORDS = ["was born", "died", "came to the town", "left the town", "took up other work"];

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
const kindName = (k: number): string => (k < 0 ? "square" : (CIVICS[k]?.kind ?? "building"));
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
};
/** Bytes a person takes in a place's columns. */
export const PERSON_BYTES = 4 + 4 + 1 + 1 + 2 + 4 + 2 * NEEDS + 1 + 1 + 4 + 4 + 2 + 2 + 1 + 4;

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
};

/** A building with stocks: the square (lot AT.square, kind -1), then each of the town's other buildings standing. */
type Buildings = {
  lot: number[];
  kind: number[];
  start: number[];
  /** Good by good, millionths: GOOD_COUNT to each. */
  stock: number[];
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
};

export type PlaceHap = { t: number; what: number; id: number; a: number; b: number };

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
};

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
  /** Food a person eats to a level of hunger (millionths). */
  readonly bite: number;
  /** Food a grown one eats in a day (millionths). */
  readonly daily: number;
};
const FRAMES = new WeakMap<World, Map<number, Frame>>();

function frameOf(world: World, cell: number): Frame {
  let of = FRAMES.get(world);
  if (!of) FRAMES.set(world, (of = new Map()));
  let f = of.get(cell);
  if (f) return f;
  const g = homePlanet(world).generated,
    life = lifeOf(world),
    body = g.life.people?.body ?? null,
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
    perSecond = (life.appetite * MICRO) / MONTH;
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
    bite: (perSecond * meal) / FULL,
    daily: perSecond * DAY,
  };
  of.set(cell, f);
  return f;
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

/**
 * A town's own table (sex and band by trade): its land's, shared by head-count to as many as the town holds, largest
 * remainders first; its foragers left out while the rest of the land can fill it, since they live in no town. Whole
 * numbers, never more of a kind than its land has, adding up to the town's people (or to its land's, where the
 * town's count has run ahead of it within a year).
 */
export function townTable(world: World, s: Settlement): number[] {
  const p = populationContext(world).provinces.get(s.cell),
    out = new Array<number>(ROWS * OCCS).fill(0);
  if (!p) return out;
  const w = new Array<number>(ROWS * OCCS);
  let settled = 0,
    all = 0;
  for (let r = 0; r < ROWS; r++)
    for (let o = 0; o < OCCS; o++) {
      const c = p.counts.get(r, o);
      w[r * OCCS + o] = c;
      all += c;
      if (o !== OCC.forager) settled += c;
    }
  const people = Math.max(0, Math.min(Math.round(s.population), all));
  if (people <= 0) return out;
  if (people <= settled) for (let r = 0; r < ROWS; r++) w[r * OCCS + OCC.forager] = 0;
  return apportion(people, w);
}

/** The part of a town's table kept as individuals: all of it, or PLACE_MOST of it shared the same way. */
export function keptTable(table: readonly number[]): number[] {
  let all = 0;
  for (const c of table) all += c;
  return all <= PLACE_MOST ? [...table] : apportion(PLACE_MOST, table);
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

function matchedOf(world: World, s: Settlement, month: number): Matched {
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
      made[g] = Math.max(0, m.book("made", g)) / by;
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
          (least < 0 || this.places[i]!.used < this.places[least]!.used)
        )
          least = i;
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
        p.bldgs.lot.length * (3 + GOOD_COUNT) * 8 +
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
        },
        bldgs: p.bldgs,
        matched: p.matched,
        base: p.base,
        flow: p.flow,
        log: p.log,
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
      for (const c of PEOPLE_COLS) (people[c] as Uint8Array).set(cols[c]);
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
        },
        bldgs: { lot: [...b.lot], kind: [...b.kind], start: [...b.start], stock: [...b.stock] },
        matched: structuredClone(raw.matched as Matched),
        base: [...(raw.base as number[])],
        flow: [...(raw.flow as number[])],
        log: (raw.log as PlaceHap[]).map((x) => ({ ...x })),
      });
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
    p.base,
    p.flow,
    p.matched.kinds,
    p.matched.land,
    p.matched.town,
  ].flat())
    h.int(list);
  for (const x of p.houses.means) h.float(x);
  for (const x of [...p.matched.made, ...p.matched.wage]) h.float(x);
  for (const x of p.log) h.int(x.t).int(x.what).int(x.id).int(x.a).int(x.b);
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

/** Ticks to walk from one to another. */
function ticksBetween(place: Place, a: number, b: number): number {
  if (a === b) return 0;
  const [ax, az] = ringOf(place, a),
    [bx, bz] = ringOf(place, b);
  return Math.max(
    1,
    Math.min(65535, Math.round(Math.hypot(ax - bx, az - bz) / (WALK * PLACE_TICK))),
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
  place.houses.members[house]!++;
  return i;
}

function removePerson(place: Place, i: number): void {
  const p = place.people,
    last = p.n - 1;
  place.houses.members[p.house[i]!]!--;
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
  return at;
}

/** The town's home lots and how many each holds, lowest lot first, as far as is needed to house `people`. */
function homesFor(world: World, town: Ref, people: number): { lot: number[]; holds: number[] } {
  const f = townsOf(world).get(town),
    lot: number[] = [],
    holds: number[] = [];
  if (!f) return { lot, holds };
  let room = 0;
  for (let from = 0; from < f.next && room < people; from += 4096) {
    const to = Math.min(f.next, from + 4096),
      levels = levelsOf(f, from, to);
    for (let k = 0; k < levels.length && room < people; k++) {
      const level = levels[k]!;
      if (level < 0) continue;
      lot.push(from + k);
      holds.push(HOLDS[level] ?? 5);
      room += HOLDS[level] ?? 5;
    }
  }
  return { lot, holds };
}

/** The town's other buildings standing now, behind its square. */
function buildingsOf(world: World, town: Ref, year: number): Buildings {
  const f = townsOf(world).get(town),
    b: Buildings = { lot: [AT.square], kind: [-1], start: [0], stock: [] };
  if (f)
    for (const c of f.civics) {
      if (c.end > year || (c.fell !== null && c.fell <= year)) continue;
      b.lot.push(c.at);
      b.kind.push(KIND_INDEX.get(c.kind) ?? -1);
      b.start.push(c.start);
    }
  b.stock = new Array<number>(b.lot.length * GOOD_COUNT).fill(0);
  return b;
}

/** The first of a place's buildings of any of these kinds (0, its square, where none stands). */
function buildingOf(place: Place, kinds: readonly string[]): number {
  for (const kind of kinds) {
    const k = KIND_INDEX.get(kind),
      at = k === undefined ? -1 : place.bldgs.kind.indexOf(k);
    if (at > 0) return at;
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
    // (Which of its land's makings is theirs: drawn by what its land made of each, at its usual worth.)
    let total = 0;
    const worth = RECIPES.map((r, k) => {
      const w =
        (m.kinds >>> k) & 1 ? Math.max(1e-9, m.made[r.output[0]]! * GOODS[r.output[0]]!.value) : 0;
      total += w;
      return w;
    });
    let craft = 0;
    if (total > 0) {
      let pick = world.rng.unit(PLACE_DRAW, place.key ^ p.id[i]!, 0, P.craft) * total;
      for (let k = 0; k < worth.length; k++) {
        pick -= worth[k]!;
        if (pick < 0) {
          craft = k + 1;
          break;
        }
      }
    }
    p.craft[i] = craft;
    const good = craft ? RECIPES[craft - 1]!.output[0] : -1,
      at = good >= 0 && MAKING_AT[good] ? buildingOf(place, MAKING_AT[good]) : -1;
    // (Coal and oil are won outside the town; with no building of its kind standing, a making is done at home.)
    p.work[i] =
      good === G.coal || good === G.oil
        ? AT.fields
        : at > 0
          ? place.bldgs.lot[at]!
          : (place.houses.home[p.house[i]!] ?? AT.square);
  } else p.work[i] = place.bldgs.lot[buildingOf(place, TRADE_AT[occ] ?? [])]!;
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

/** Stocks come in to, or go out of, the place's stores: what the world's share says against what the place holds. */
function matchStocks(place: Place, share: readonly number[]): void {
  const held = placeStocks(place),
    { bldgs, houses, people } = place,
    granary = buildingOf(place, FOOD_STORES),
    market = buildingOf(place, ["market"]);
  for (let g = 0; g < GOOD_COUNT; g++) {
    let d = share[g]! - held[g]!;
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

function note(place: Place, what: number, id: number, a = 0, b = 0): void {
  place.log.push({ t: place.t, what, id, a, b });
  if (place.log.length > LOG_MOST) place.log.splice(0, place.log.length - LOG_MOST);
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
): void {
  const target = keptTable(townTable(world, s)),
    now = placeTable(place, f.life),
    p = () => place.people,
    cellOf = (i: number) =>
      (sexOf(p(), i) * BANDS + bandOf(ageOf(p(), i, place.t), f.life)) * OCCS + occOf(p(), i),
    draw = (i: number, purpose: number) =>
      world.rng.unit(PLACE_DRAW, place.key ^ p().id[i]!, place.t, purpose),
    // (Those of a kind, in the order a draw gives them.)
    ofCell = (c: number) => {
      const list: number[] = [];
      for (let i = 0; i < p().n; i++) if (cellOf(i) === c) list.push(i);
      const d = new Map(list.map((i) => [i, draw(i, P.pick)]));
      return list.sort((a, b) => d.get(a)! - d.get(b)! || p().id[a]! - p().id[b]!);
    };
  let changed = false;
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
          if (Math.abs(ageOf(p(), i, place.t) - edge) <= reach) near.push(i);
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
      const movers = ofCell(r * OCCS + o);
      for (let to = 0; to < OCCS && over > 0; to++) {
        let short = target[r * OCCS + to]! - now[r * OCCS + to]!;
        while (short > 0 && over > 0) {
          const i = movers.shift()!;
          p().sexOcc[i] = (sexOf(p(), i) << 4) | to;
          workOf(world, place, i);
          note(place, HAP.trade, p().id[i]!, o, to);
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
      expected = now[c]! * (f.life.mortality[band] ?? 0.02) * span,
      dying = Math.min(
        over,
        Math.floor(expected) +
          (world.rng.unit(PLACE_DRAW, place.key ^ c, place.t, P.dying) < expected % 1 ? 1 : 0),
      ),
      ids = ofCell(c)
        .slice(0, over)
        .map((i) => p().id[i]!);
    ids.forEach((id, k) => {
      const i = p().id.subarray(0, p().n).indexOf(id);
      note(
        place,
        k < dying ? HAP.died : HAP.left,
        id,
        Math.round(ageOf(p(), i, place.t)),
        occOf(p(), i),
      );
      removePerson(place, i);
    });
    now[c] = target[c]!;
    changed = true;
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
      workOf(world, place, i);
      note(place, band === 0 ? HAP.born : HAP.came, id, Math.round(age), occ);
    }
    changed = true;
  }
  if (changed) reckonMeans(world, place);
}

/** The place matched to the world as it is now: its numbers for the ticks to come, its people, its stocks. */
function reconcile(world: World, place: Place, s: Settlement, f: Frame, month: number): void {
  const years = Math.max(0, (month - place.matched.month) / 12),
    turned = Math.floor(month / 12) > Math.floor(place.matched.month / 12),
    // (Its buildings as they stand now: one fallen gives up its stock to the square, one raised begins empty.)
    year = Math.floor(place.t / YEAR),
    stand = buildingsOf(world, place.town, year),
    old = place.bldgs;
  for (let b = 0; b < old.lot.length; b++) {
    let to = stand.lot.findIndex((lot, k) => lot === old.lot[b] && stand.start[k] === old.start[b]);
    if (to < 0) to = 0;
    for (let g = 0; g < GOOD_COUNT; g++)
      stand.stock[to * GOOD_COUNT + g]! += old.stock[b * GOOD_COUNT + g]!;
  }
  place.bldgs = stand;
  place.matched = matchedOf(world, s, month);
  // (The world reckons its births and deaths by the year: a matching across a year's turn tells a year's.)
  matchPeople(world, place, s, f, years, turned ? Math.max(1, years) : Math.max(1 / 12, years));
  // (Anyone whose work stood in a building now gone works where their trade does now.)
  const p = place.people;
  for (let i = 0; i < p.n; i++)
    if (
      p.work[i]! >= 0 &&
      bldgAt(place, p.work[i]!) < 0 &&
      p.work[i] !== place.houses.home[p.house[i]!]
    )
      workOf(world, place, i);
  matchStocks(place, stockShare(world, place.cell, p.n));
}

/** A place made of a town as it stands now. */
function makePlace(world: World, s: Settlement): Place | null {
  const f = frameOf(world, s.cell),
    t = Math.floor(world.now / PLACE_TICK) * PLACE_TICK,
    start = t - SETTLE,
    month = Math.floor(world.now / MONTH),
    table = keptTable(townTable(world, s)),
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
    houses: { n: 0, key: [], home: [], fifth: [], means: [], members: [], pantry: [] },
    bldgs: buildingsOf(world, s.ref, Math.floor(world.now / YEAR)),
    matched: matchedOf(world, s, month),
    base: new Array<number>(GOOD_COUNT).fill(0),
    flow: new Array<number>(GOOD_COUNT).fill(0),
    log: [],
  };
  // Its households, each in a home: as many as a hearth's mouths make of its people, the homes filled from its heart.
  const homes = homesFor(world, s.ref, n),
    count = Math.max(1, Math.ceil(n / f.hearth));
  let home = 0,
    room = homes.holds[0] ?? Infinity;
  for (let h = 0; h < count; h++) {
    // (Its last home takes whoever is left where the town has more people than beds.)
    while (room < f.hearth && home + 1 < homes.lot.length) room = homes.holds[++home]!;
    addHouse(place, homes.lot[home] ?? AT.square);
    room -= f.hearth;
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
      workOf(world, place, i);
    }
  }
  reckonMeans(world, place);
  stockOut(place, f, stockShare(world, s.cell, n));
  // Its day under way before it is seen; then its stocks are the world's again, to the last millionth.
  while (place.t < t) tick(world, place, f);
  matchStocks(place, stockShare(world, s.cell, place.people.n));
  place.log.length = 0;
  return place;
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
  place.base = [...share];
  place.flow = new Array<number>(GOOD_COUNT).fill(0);
}

// —— The tick ————————————————————————————————————————————————————————————————————————————————————————————————————

/** What the next hour's work is worth to one, 0 … 1: by what their trade earns against their land's, a little their own. */
export function workWorth(world: World, place: Place, i: number, mean = meanWage(place)): number {
  const p = place.people,
    occ = occOf(p, i),
    m = place.matched;
  if (occ === OCC.dependent) return 0;
  const ratio = mean > 0 && m.wage[occ]! > 0 ? Math.min(4, Math.max(0.25, m.wage[occ]! / mean)) : 1,
    own = (world.rng.unit(PLACE_DRAW, place.key ^ p.id[i]!, 0, P.worth) - 0.5) * 0.16;
  return Math.max(0.05, Math.min(0.9, 0.45 + 0.12 * Math.log2(ratio) + own));
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

function go(place: Place, i: number, to: number): void {
  const p = place.people;
  p.to[i] = to;
  p.eta[i] = p.trip[i] = ticksBetween(place, p.at[i]!, to);
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
    chill = Math.round((cold * FULL * PLACE_TICK) / (2 * HOUR)),
    warmUp = Math.round((FULL * PLACE_TICK) / HOUR),
    // (Work by a body that sees by light is worth less in the dark.)
    dark = air.lit ? 1 : 1 - 0.7 * f.sight,
    perTick = (PLACE_TICK * MICRO) / (YEAR * WORK_SHARE),
    foodStore = buildingOf(place, FOOD_STORES),
    market = buildingOf(place, ["market"]),
    mean = meanWage(place);
  let wants: [number, number][] | null = null;
  for (let i = 0; i < p.n; i++) {
    const at0 = i * NEEDS,
      asleep = p.act[i] === ACT.sleep,
      h = p.house[i]!,
      home = houses.home[h]!,
      moving = p.eta[i]! > 0,
      inside = !moving && p.at[i]! !== AT.fields && p.at[i]! !== AT.square;
    // Needs.
    p.needs[at0 + N.food] = Math.min(
      FULL,
      p.needs[at0 + N.food]! + (asleep ? f.hunger >> 2 : f.hunger),
    );
    p.needs[at0 + N.rest] = asleep
      ? Math.max(0, p.needs[at0 + N.rest]! - f.rest)
      : Math.min(FULL, p.needs[at0 + N.rest]! + f.tire);
    p.needs[at0 + N.cold] = inside
      ? Math.max(0, p.needs[at0 + N.cold]! - warmUp)
      : Math.min(FULL, p.needs[at0 + N.cold]! + chill);
    // (Company is had among others in the square; work neither gives it nor takes it, nor does sleep.)
    if (!moving && p.act[i] === ACT.visit)
      p.needs[at0 + N.lone] = Math.max(0, p.needs[at0 + N.lone]! - 12 * f.lone);
    else if (!asleep && (moving || p.act[i] !== ACT.work))
      p.needs[at0 + N.lone] = Math.min(FULL, p.needs[at0 + N.lone]! + f.lone);
    if (moving) {
      if (--p.eta[i]! === 0) {
        p.at[i] = p.to[i]!;
        p.trip[i] = 0;
      }
      continue;
    }
    const hunger = pressOf(p.needs[at0 + N.food]! / FULL),
      tired = pressOf(p.needs[at0 + N.rest]! / FULL),
      chilled = pressOf(p.needs[at0 + N.cold]! / FULL),
      lone = pressOf(p.needs[at0 + N.lone]! / FULL),
      occ = occOf(p, i),
      worth = occ === OCC.dependent ? 0 : workWorth(world, place, i, mean) * dark,
      bar = Math.max(worth, IDLE_WORTH);
    // What is carried is set down where it was bound.
    if (p.carry[i]! > 0 && p.act[i] === ACT.carry) {
      const b = bldgAt(place, p.at[i]!);
      if (p.at[i] === home && GOODS[p.carryGood[i]!]!.food)
        houses.pantry[h * FOODS.length + FOODS.indexOf(p.carryGood[i]!)]! += p.carry[i]!;
      else bldgs.stock[(b < 0 ? 0 : b) * GOOD_COUNT + p.carryGood[i]!]! += p.carry[i]!;
      p.carry[i] = 0;
      p.act[i] = ACT.idle;
    }
    // Asleep: until rested, or hunger or cold wakes them.
    if (asleep && p.needs[at0 + N.rest]! > 0.04 * FULL && hunger < bar && chilled < bar) {
      p.why[i] = WHY.asleep;
      continue;
    }
    // Fetching: at the store, take what the household eats in some days; then home.
    if (p.act[i] === ACT.fetch) {
      const b = Math.max(0, bldgAt(place, p.at[i]!));
      let want = houses.members[h]! * f.daily * FETCH_DAYS;
      for (let k = 0; k < FOODS.length && want > 0; k++) {
        const g = FOODS[k]!,
          take = Math.floor(Math.min(want, bldgs.stock[b * GOOD_COUNT + g]!, 2147483647));
        if (take <= 0) continue;
        bldgs.stock[b * GOOD_COUNT + g]! -= take;
        p.carryGood[i] = g;
        p.carry[i] = take;
        want = 0;
      }
      p.act[i] = p.carry[i]! > 0 ? ACT.carry : ACT.idle;
      p.why[i] = p.carry[i]! > 0 ? WHY.pantry : WHY.noFood;
      go(place, i, home);
      continue;
    }
    const press = Math.max(hunger, tired, chilled, lone);
    if (press > bar) {
      if (hunger === press) {
        // Hunger: eat at home; a pantry bare, one who is grown fetches from the town's stores.
        if (p.at[i] !== home) {
          p.act[i] = ACT.idle;
          p.why[i] = WHY.hunger;
          go(place, i, home);
          continue;
        }
        const want =
            p.needs[at0 + N.food]! *
            f.bite *
            (bandOf(ageOf(p, i, t), f.life) === 0 ? f.life.young : 1),
          eaten = eatFrom(place, h, want);
        if (eaten > 0) {
          p.needs[at0 + N.food] = Math.round(
            p.needs[at0 + N.food]! * (1 - Math.min(1, eaten / want)),
          );
          p.act[i] = ACT.eat;
          p.why[i] = WHY.hunger;
          continue;
        }
        const grown = ageOf(p, i, t) >= f.life.adulthood;
        let any = 0;
        for (const g of FOODS) any += bldgs.stock[foodStore * GOOD_COUNT + g]! + bldgs.stock[g]!;
        if (grown && any > 0) {
          let from = foodStore;
          if (FOODS.every((g) => bldgs.stock[foodStore * GOOD_COUNT + g]! <= 0)) from = 0;
          p.act[i] = ACT.fetch;
          p.why[i] = WHY.pantry;
          go(place, i, bldgs.lot[from]!);
          continue;
        }
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
          go(place, i, home);
        } else {
          p.act[i] = ACT.sleep;
          p.why[i] = WHY.tired;
        }
        continue;
      } else if (chilled === press) {
        p.act[i] = ACT.warm;
        p.why[i] = WHY.cold;
        if (p.at[i] !== home) go(place, i, home);
        continue;
      } else {
        p.act[i] = ACT.visit;
        p.why[i] = WHY.lone;
        if (p.at[i] !== AT.square) go(place, i, AT.square);
        continue;
      }
    }
    if (worth < IDLE_WORTH) {
      // Nothing presses and no work is worth going to: at home, abed while it is dark.
      if (p.at[i] !== home) {
        p.act[i] = ACT.idle;
        go(place, i, home);
      } else p.act[i] = air.lit ? ACT.idle : ACT.sleep;
      p.why[i] = occ === OCC.dependent ? WHY.young : WHY.dark;
      continue;
    }
    // Work: what the next hour of it is worth passes every need.
    const work = p.work[i]!;
    if (p.at[i] !== work) {
      p.act[i] = ACT.work;
      p.why[i] = WHY.work;
      go(place, i, work);
      continue;
    }
    p.act[i] = ACT.work;
    p.why[i] = WHY.work;
    if (occ === OCC.farmer || occ === OCC.herder) {
      // What the fields and the flocks give is brought in a load at a time: home while the pantry is short, else to the store.
      const g = occ === OCC.farmer ? G.grain : G.meat,
        made = Math.round(matched.made[g]! * perTick);
      if (p.carry[i]! <= 0) p.carryGood[i] = g;
      p.carry[i]! += made;
      place.flow[g]! += made;
      if (p.carry[i]! >= LOAD * MICRO) {
        let pantry = 0;
        for (let k = 0; k < FOODS.length; k++) pantry += houses.pantry[h * FOODS.length + k]!;
        p.act[i] = ACT.carry;
        p.why[i] = WHY.load;
        go(
          place,
          i,
          pantry < houses.members[h]! * f.daily * FETCH_DAYS ? home : bldgs.lot[foodStore]!,
        );
      }
    } else if (occ === OCC.crafter && p.craft[i]) {
      // A making: its stuff taken from where it is worked, the made thing left there; for want of stuff, none.
      const r = RECIPES[p.craft[i]! - 1]!,
        [good, per] = r.output,
        // (One who works at home takes their stuff from the market and leaves what they make there.)
        at = bldgAt(place, p.at[i]!),
        b = at < 0 ? market : at,
        made = Math.round(matched.made[good]! * perTick);
      let can = made;
      for (const [x, amount] of r.inputs)
        can = Math.min(can, Math.floor((bldgs.stock[b * GOOD_COUNT + x]! * per) / amount));
      if (can <= 0 && made > 0) {
        p.act[i] = ACT.wait;
        p.why[i] = WHY.noStuff;
        continue;
      }
      for (const [x, amount] of r.inputs) {
        const used = Math.min(bldgs.stock[b * GOOD_COUNT + x]!, Math.ceil((can * amount) / per));
        bldgs.stock[b * GOOD_COUNT + x]! -= used;
        place.flow[x]! -= used;
      }
      bldgs.stock[b * GOOD_COUNT + good]! += can;
      place.flow[good]! += can;
    } else if (occ === OCC.trader) {
      // A carrier: what a working building has made goes to the market; what one lacks and the market holds goes to it.
      if (p.at[i] !== bldgs.lot[market]) continue;
      // (What its working buildings lack of what its land's makings are made of, reckoned once a tick: one load to each.)
      if (!wants) {
        wants = [];
        for (let b = 1; b < bldgs.lot.length; b++) {
          if (b === market) continue;
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
      }
      for (let k = 0; k < wants.length; k++) {
        const [b, x] = wants[k]!,
          has = bldgs.stock[market * GOOD_COUNT + x]!;
        if (has <= 0) continue;
        const take = Math.min(has, LOAD * MICRO);
        bldgs.stock[market * GOOD_COUNT + x]! -= take;
        p.carryGood[i] = x;
        p.carry[i] = take;
        p.act[i] = ACT.carry;
        p.why[i] = WHY.load;
        go(place, i, bldgs.lot[b]!);
        wants.splice(k, 1);
        break;
      }
    }
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

// —— Entering, staying, coming back ——————————————————————————————————————————————————————————————————————————————

/** A place's needs and whereabouts drawn afresh after a long absence: at home, somewhere in their day. */
function settle(world: World, place: Place): void {
  const p = place.people;
  for (let i = 0; i < p.n; i++) {
    for (let q = 0; q < NEEDS; q++)
      p.needs[i * NEEDS + q] = Math.floor(
        world.rng.unit(PLACE_DRAW, place.key ^ p.id[i]!, place.t, P.settle, q) * FULL * 0.6,
      );
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
    return ticks;
  }
  while (place.t < now) {
    // (The month's turn: the world has reckoned its land, and the place is matched to it before its next tick.)
    const m = Math.floor(place.t / MONTH);
    if (m > place.matched.month) reconcile(world, place, s, f, m);
    tick(world, place, f);
    ticks++;
  }
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

/** What happened to someone, in words ("died", "took up other work"). */
export const hapWords = (what: number): string => HAP_WORDS[what] ?? "";
