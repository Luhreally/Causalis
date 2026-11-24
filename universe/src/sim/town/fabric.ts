// A town's fabric (Phase 23, asked for 2026-10-24: "i cant see the cities form and evolve and
// get that type of detail i got from the og causalisis"): every town is built lot by lot along
// streets laid out at its founding — lots taken in the order its plan gives them, from its
// square outward — and what stands on each lot is history: homes raised as people come, as many
// a year as the town's hands raise; rebuilt higher as its land learns to build higher, its heart
// highest (townhouses about the square, then tenements, blocks, high-rises, each ring of the
// town a step lower than the one within); homes let fall from its edge when its people go,
// their ruins weathering away; burnt, shaken down or sacked; its other buildings — a shrine, a
// granary, a smithy, a mill, a temple, workshops, a school, factories, a station — begun once
// its land knows what each asks and the town is large enough for it; walls raised about it when
// war comes near. What is kept is how it stands and since when, run by run (homes raised
// together at one level in one design are one run; runs never overlap, a run changed over is
// cut back, and a ruin weathered away is let go), so the fabric of twenty thousand towns stays
// small; the view reads from it what stands on any lot, and since when.
import { courtIn } from "../order/institutions-kept.ts";
import {
  YEAR,
  defineEventType,
  dmath,
  type Hasher,
  hashString,
  mix,
  yearOfMoment,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  CIVICS,
  CIVIC_INDEX,
  CIVIC_SITE,
  HOLDS,
  HOME_LEVELS,
  LEVEL,
  civic,
  heartCan,
  heartLevel,
  needsMet,
  seatSite,
  wallYears,
  ZONING_NEEDS,
  OCC,
  adultHazard,
  civicsHeld,
  civicsPaying,
  keptFixed,
  keptPeople,
  leastEver,
  payingPeople,
  timePreference,
  type CivicDef,
  type CivicKind,
  type CivicSite,
  type TownUse,
} from "../../rules/index.ts";
import { Civics, NO_FALL, Runs, type Change, type Civic } from "./packed.ts";
import type { MarketStore } from "../economy/market.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { Settlement } from "../population/stores.ts";
import { knows, loreOf } from "../lore/lore.ts";
import { watersOf } from "../ecology/ecology.ts";
import { citiesOf } from "../city/city.ts";
import { beliefOf } from "../belief/belief.ts";
import { cultureOf } from "../culture/culture.ts";
import { designsOf } from "../design/design.ts";
import { politiesOf } from "../polity/polity.ts";
import { landReach } from "../order/order.ts";
import { warsOf } from "../war/war.ts";
import {
  HEART_BLOCKS,
  QUARTER,
  QUARTERS,
  floodGround,
  floodWary,
  quarterOf,
  townSeed,
} from "./sites.ts";

export const TOWN_EVENTS = {
  walled: defineEventType("town.walled", 3),
  temple: defineEventType("town.temple", 3),
  forsaken: defineEventType("town.forsaken", 3),
};

/** How a town's streets are laid out, from its founding: winding lanes, a grid, rings about its heart. */
export const TOWN_FAMILIES = ["lanes", "grid", "rings"] as const;
export type TownFamily = (typeof TOWN_FAMILIES)[number];

/** What happened to a run of lots. */
export const CHANGE = {
  /** Homes raised on open ground (or on ruins). */
  built: 0,
  /** Homes rebuilt higher in their place. */
  raised: 1,
  /** Homes let fall: their people gone, they stand empty and go to ruin. */
  fell: 2,
  /** Homes burnt, shaken down or sacked. */
  razed: 3,
  /** Homes pulled down to make room for one of the town's other buildings. */
  cleared: 4,
  /** Homes burned from the air: their lots lie in ash, not to be built on, until their years are up (see rise). */
  burned: 5,
} as const;

/** Whether a run is of homes standing (built, or rebuilt higher). */
const isHome = (what: number) => what === CHANGE.built || what === CHANGE.raised;

/**
 * A run of lots changed together: [what, first lot, end lot (exclusive), first year, last year,
 * level, design] — built and raised runs are of one level and one design (the year the land's
 * design was realized, -1 before it had one: a run ends where it changed). A run of several
 * years was changed lot by lot through them, in order (a fallen run from its top lot down).
 * No two runs share a lot: what stands on a lot is its run's. A town's runs are kept in the order of their lots, so
 * the runs over any stretch are found by halving, not by going over a great town's ten thousand.
 */
export type { Change } from "./packed.ts";

export { Civics, NO_FALL, Runs, plainCivic, type Civic } from "./packed.ts";

/** A town's walls: begun, done, and the lots they ring (the town as it stood). */
export type Walls = {
  readonly start: number;
  readonly end: number;
  readonly reach: number;
};

export type Fabric = {
  readonly town: Ref;
  readonly family: TownFamily;
  /** Which of the years it weighs its buildings in (of CIVIC_EVERY), from its name. */
  readonly phase: number;
  /** The next lot of its plan never yet taken. */
  next: number;
  /** Homes standing (or rising) at each level. */
  homes: number[];
  /**
   * Runs of lots taken once and open again (fallen, razed, passed over), lowest first: each run's first lot and the lot past its
   * last, one after the other in one list of numbers (a great town has thousands of runs, a world a million: a pair of its own
   * each held 72 bytes of the heap where two numbers hold 16).
   */
  open: number[];
  /** What it rebuilds to (its heart's level × 8 + its edge's), the lot its rebuilding has come to, and the lots it had when it last came to its edge (-1 while it is going over them). */
  aim: number;
  raise: number;
  passed: number;
  /** Its runs, in the order of their lots: kept as columns (see packed.ts). */
  readonly changes: Runs;
  /** Its other buildings, in the order they were begun: kept as columns (see packed.ts). */
  readonly civics: Civics;
  walls: Walls | null;
  /** Years in a row it has had far more homes than people. */
  lean: number;
  /** The event of its forsaking, while every home of it is fallen. */
  forsaken: Ref | null;
  /**
   * What its form turns on (bridge/form.ts), each set down the year it happened and never changed after, so no block of it
   * ever moves for the years gone by:
   *  `engines`: the lots it had taken when engines came to its land (-1: they are not come); what it has taken since was
   *   laid for them.
   *  `order`: how far its realm's will was done on its land (tenths of a whole reach, sim/order/order.ts landReach) when it
   *   was founded, when its walls were begun and when engines came: three digits of sixteen, lowest first (15: not yet).
   *   Where a realm's will is done, ground is measured out before it is built.
   *  `place`: its market place: the lots it had taken at its first market × 4, and how great a place its people then
   *   asked (1 … 3) (-1: it has held no market).
   * KEPT_NOT in a save from before they were kept, and in a town the eye reckons apart: read as before, and nothing set down.
   */
  engines: number;
  order: number;
  place: number;
};

/** A kept number of a town's form that was never kept (a save from before; a town read apart). */
export const KEPT_NOT = -2;
/** No reach set down yet (a digit of Fabric.order), and a town's order with none. */
export const ORDER_NONE = 15;
export const ORDER_NEW = ORDER_NONE * 0x111;
/** The digits of Fabric.order. */
export const ORDER_AT = { founded: 0, walled: 1, engines: 2 } as const;
/** A town's realm's reach on its land as it was set down at one of ORDER_AT (0 … 1; null: not set down). */
export function orderAt(f: Fabric, at: number): number | null {
  if (f.order < 0) return null;
  const d = (f.order >> (4 * at)) & 15;
  return d === ORDER_NONE ? null : d / 10;
}
/** What a land must know for engines to have come to it (as host/roads.ts machinesYear reads it). */
const ENGINES = "electricity|sea-electricity|engines";
/**
 * How great a market place a town's people ask at its first market: one block, two across its main street, four. (A market
 * comes to a town young: on first light the 551 towns that ever held one had 8 lots then at the median, 57 at the ninth
 * tenth.)
 */
export function placeClass(people: number): number {
  return people >= 250 ? 3 : people >= 60 ? 2 : 1;
}

/** How many lots each building takes: a smithy one, a market hall a row of four, a factory a block. */
export const CIVIC_LOTS: Readonly<Record<CivicKind, number>> = {
  shrine: 1,
  granary: 2,
  kiln: 1,
  smithy: 1,
  market: 4,
  mill: 2,
  temple: 4,
  hall: 4,
  school: 2,
  workshop: 2,
  docks: 4,
  academy: 4,
  baths: 4,
  observatory: 2,
  hospital: 4,
  factory: 8,
  station: 8,
  power: 8,
  offices: 2,
  fusion: 8,
  minds: 4,
  vats: 8,
  well: 1,
  prison: 2,
};

/** Years a run must have stood untouched before it is history and may join the run it continues (a home takes at most three to raise). */
export const SETTLED = 4;
/** Years a ruin stands before it is weathered away (and a fallen building is let go). */
export const RUIN_YEARS = 60;
/** The years a lot burned from the air lies in ash before it rises again (est: a street is cleared and rebuilt in a few). Under SETTLED, so a burned run never joins another. */
export const ASH_YEARS = 3;
/** How many sticks of loads a raid's hits come in: each its own stretch of lots. */
const STICKS = 4;
/** A town weighs its other buildings and its walls one year in so many (each in its own). */
export const CIVIC_EVERY = 3;

/** What a fold into the digest tells. */
const FOLD = {
  found: 0,
  change: 1,
  fell: 2,
  replaced: 3,
  begun: 4,
  walls: 5,
  forsaken: 6,
  livedIn: 7,
  /** What its form turns on, set down: which (0 its reach when founded, 1 when walled, 2 when engines came, 3 its market place, 4 the lots it had when engines came), and the number. */
  form: 8,
} as const;

/**
 * A fabric as saved: [town, family, next, aim, raise, passed, lean, forsaken, walls, designs,
 * runs, buildings, fallen] — its runs flat, seven numbers each (what, from as told from the end
 * of the run before, how many lots, start as told from the start of the run before, how many
 * years, level, which of its designs), its buildings three (kind, first lot as told from the
 * building before's, start as told from the building before's: how many lots and years each
 * takes is its kind's), and of the few fallen, which and how many years each stood. Its homes
 * and open lots are read again from them (there are tens of thousands of towns).
 */
type Saved = [
  town: Ref,
  family: number,
  next: number,
  aim: number,
  raise: number,
  passed: number,
  lean: number,
  forsaken: Ref | null,
  walls: [start: number, end: number, reach: number] | null,
  designs: number[],
  runs: number[],
  civics: number[],
  fallen: number[],
  /** (Absent in a save from before they were kept.) */
  form?: [engines: number, order: number, place: number],
];

/**
 * A town as its settling last went over it: the year, and the first year after it that anything of it comes due
 * (see TownBuilder.settle).
 */
type Settled = {
  readonly year: number;
  due: number;
  /** The last year it was asked to settle, due or not; its buildings as it last went over them. */
  asked: number;
  /** Its buildings' version (see Civics) and how many it had. */
  civics: number;
  buildings: number;
};

/** A town's ruins as its settling keeps them: every run of it no home stands in, and the first year one weathers away. */
type Ruins = { list: number[]; next: number };

export class TownStore implements StateStore {
  readonly name = "town.fabric";
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  private readonly map = new Map<string, Fabric>();
  /** (Each town's fabric by the settlement itself, for the year's walk over them: a cache, let go on loading.) */
  private readonly bySettlement = new Map<Settlement, Fabric>();
  /** (Each town as its settling last went over it: a cache, let go on loading.) */
  readonly settled = new Map<Fabric, Settled>();
  /**
   * (Each town's runs laid or parted in the years before they come to be history, and its ruins, for its settling to
   * go over instead of every run it has: a cache, let go on loading. A town with none is gone over whole.)
   */
  readonly young = new Map<Fabric, number[]>();
  readonly ruins = new Map<Fabric, Ruins>();
  /** (Towns whose next settling goes over every run: something changed that the young runs and ruins do not tell.) */
  readonly whole = new Set<Fabric>();
  /** (Towns with lots in ash, for the year's walk over them: what their runs tell, read again on loading.) */
  readonly ashen = new Set<Fabric>();
  /** (Of towns wary of floods, their open runs that hold only flood ground: a cache, never saved. homeOpen) */
  readonly flooded = new Map<Ref, Flooded>();
  /** Every change folded in as it is made, for the checkpoints: two lanes of the kernel's absorber. */
  private a = 0x2545f491 | 0;
  private b = 0x6a09e667 | 0;

  /** The fabric of a colony's town, as the eye reads it (Phase 64: see SettlementStore.seen). */
  seen: ((town: Ref) => Fabric | undefined) | null = null;

  get(town: Ref): Fabric | undefined {
    return this.map.get(town) ?? this.seen?.(town);
  }
  /** A settlement's fabric (as get, by the settlement). */
  of(s: Settlement): Fabric | undefined {
    let f = this.bySettlement.get(s);
    if (!f) {
      f = this.map.get(s.ref);
      if (f) this.bySettlement.set(s, f);
    }
    return f;
  }
  all(): Fabric[] {
    return [...this.map.values()].sort((a, b) => (a.town < b.town ? -1 : 1));
  }
  add(f: Fabric): Fabric {
    this.map.set(f.town, f);
    this.fold(f.town, FOLD.found, TOWN_FAMILIES.indexOf(f.family));
    return f;
  }
  /** Fold what happened to a town into the digest (whole numbers, each within 32 bits). */
  fold(town: Ref, ...values: number[]): void {
    let a = this.a,
      b = this.b;
    const t = hashString(town);
    a = mix(a, t);
    b = mix(b, t ^ 0x5bd1e995);
    for (const v of values) {
      a = mix(a, v);
      b = mix(b, v ^ 0x5bd1e995);
    }
    this.a = a;
    this.b = b;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const f of this.map.values()) if (f.forsaken) out.push(f.forsaken);
    return out;
  }
  hashInto(h: Hasher): void {
    h.word(this.a).word(this.b).int(this.map.size);
  }
  save(): unknown {
    const steps = this.saveSteps();
    for (;;) {
      const r = steps.next();
      if (r.done) return r.value;
    }
  }
  /** save(), a thousand towns a piece (a world at 1,500 has twenty-three thousand): its columns written town by town. */
  *saveSteps(): Generator<void, unknown, void> {
    const all = this.all(),
      columns = newColumns();
    for (let i = 0; i < all.length; i++) {
      intoColumns(columns, all[i]!);
      if (i % 1000 === 999) yield;
    }
    return { digest: [this.a, this.b], towns: columns };
  }
  load(state: unknown): void {
    // (Town by town, in a save from before Phase 66.)
    const s = state as { digest: [number, number]; fabrics?: Saved[]; towns?: SavedColumns };
    this.map.clear();
    this.bySettlement.clear();
    this.settled.clear();
    this.young.clear();
    this.ruins.clear();
    this.whole.clear();
    this.ashen.clear();
    this.flooded.clear();
    [this.a, this.b] = s.digest;
    for (const saved of s.fabrics ?? fromColumns(s.towns!)) {
      const f = unpack(saved);
      this.map.set(f.town, f);
      if (hasBurned(f.changes)) this.ashen.add(f);
    }
  }
}

/**
 * All the towns' fabrics as a save keeps them (Phase 66): each thing about them in a column across every
 * town, a town's runs, buildings and designs one after another in theirs, with how many are its own. Most
 * of a world's towns differ in little, and what little it is lies in few of the columns.
 */
type SavedColumns = {
  readonly heads: readonly (readonly unknown[])[];
  readonly designs: readonly number[];
  readonly designsOf: readonly number[];
  readonly runs: readonly (readonly number[])[];
  readonly runsOf: readonly number[];
  readonly civics: readonly (readonly number[])[];
  readonly civicsOf: readonly number[];
  readonly fallen: readonly number[];
  readonly fallenOf: readonly number[];
};
const HEADS = 12,
  /** (The heads of a save from before a town's form's numbers were kept.) */
  HEADS_OLD = 9,
  RUN_COLUMNS = 7,
  CIVIC_COLUMNS = 3;

/** (Scratch: the lot of the last building of each kind, as a town's are written.) */
const LAST_OF = new Float64Array(CIVICS.length);

type Columns = {
  heads: unknown[][];
  designs: number[];
  designsOf: number[];
  runs: number[][];
  runsOf: number[];
  civics: number[][];
  civicsOf: number[];
  fallen: number[];
  fallenOf: number[];
};

function newColumns(): Columns {
  return {
    heads: Array.from({ length: HEADS }, () => []),
    designs: [],
    designsOf: [],
    runs: Array.from({ length: RUN_COLUMNS }, () => []),
    runsOf: [],
    civics: Array.from({ length: CIVIC_COLUMNS }, () => []),
    civicsOf: [],
    fallen: [],
    fallenOf: [],
  };
}

/** A town written into the columns as toColumns writes what pack gives of it, with no list of its own between. */
function intoColumns(c: Columns, f: Fabric): void {
  const h = c.heads;
  h[0]!.push(f.town);
  h[1]!.push(TOWN_FAMILIES.indexOf(f.family));
  h[2]!.push(f.next);
  h[3]!.push(f.aim);
  h[4]!.push(f.raise);
  h[5]!.push(f.passed);
  h[6]!.push(f.lean);
  h[7]!.push(f.forsaken);
  h[8]!.push(f.walls ? [f.walls.start, f.walls.end, f.walls.reach] : null);
  h[9]!.push(f.engines);
  h[10]!.push(f.order);
  h[11]!.push(f.place);
  const R = f.changes,
    designs: number[] = [],
    runs = c.runs;
  let to = 0,
    start = 0;
  for (let i = 0; i < R.length; i++) {
    const s = R.slot(i),
      a = R.v(s, 1),
      b = R.v(s, 2),
      first = R.v(s, 3),
      design = R.v(s, 6);
    let d = designs.indexOf(design);
    if (d < 0) d = designs.push(design) - 1;
    runs[0]!.push(R.v(s, 0));
    runs[1]!.push(a - to);
    runs[2]!.push(b - a);
    runs[3]!.push(first - start);
    runs[4]!.push(R.v(s, 4) - first);
    runs[5]!.push(R.v(s, 5));
    runs[6]!.push(d);
    to = b;
    start = first;
  }
  c.designsOf.push(designs.length);
  for (const d of designs) c.designs.push(d);
  c.runsOf.push(R.length);
  const cs = f.civics,
    civics = c.civics;
  c.civicsOf.push(cs.length);
  LAST_OF.fill(0);
  let fallen = 0;
  for (let i = 0; i < cs.length; i++) {
    const kind = cs.kindAt(i),
      at = cs.lotAt(i);
    civics[0]!.push(kind);
    civics[1]!.push(at - LAST_OF[kind]!);
    civics[2]!.push(cs.startAt(i));
    LAST_OF[kind] = at;
    if (cs.fellAt(i) !== NO_FALL) {
      c.fallen.push(i, cs.fellAt(i) - cs.startAt(i));
      fallen += 2;
    }
  }
  c.fallenOf.push(fallen);
}

function fromColumns(c: SavedColumns): Saved[] {
  const out: Saved[] = [];
  let d = 0,
    r = 0,
    v = 0,
    f = 0;
  for (let n = 0; n < c.designsOf.length; n++) {
    const runs: number[] = [],
      civics: number[] = [];
    for (let i = 0; i < c.runsOf[n]!; i++, r++)
      for (let k = 0; k < RUN_COLUMNS; k++) runs.push(c.runs[k]![r]!);
    let wasAt = 0,
      wasStart = 0;
    const lastOf = new Map<number, number>();
    for (let i = 0; i < c.civicsOf[n]!; i++, v++) {
      const kind = c.civics[0]![v]!,
        at = c.civics[1]![v]! + (lastOf.get(kind) ?? 0),
        start = c.civics[2]![v]!;
      civics.push(kind, at - wasAt, start - wasStart);
      lastOf.set(kind, at);
      wasAt = at;
      wasStart = start;
    }
    const head = c.heads.slice(0, HEADS_OLD).map((h) => h[n]);
    out.push([
      ...head,
      c.designs.slice(d, d + c.designsOf[n]!),
      runs,
      civics,
      c.fallen.slice(f, f + c.fallenOf[n]!),
      ...(c.heads.length > HEADS_OLD ? [[c.heads[9]![n], c.heads[10]![n], c.heads[11]![n]]] : []),
    ] as Saved);
    d += c.designsOf[n]!;
    f += c.fallenOf[n]!;
  }
  return out;
}

/** A fabric as it was saved, its homes and open lots read again from what stands. */
function unpack(s: Saved): Fabric {
  const [town, family, next, aim, raise, passed, lean, forsaken, walls, designs, runs] = s,
    packed = s[11],
    fallen = s[12],
    changes = new Runs(runs.length / 7),
    civics = new Civics(packed.length / 3);
  let to = 0,
    start = 0;
  for (let i = 0; i < runs.length; i += 7) {
    const from = to + runs[i + 1]!,
      first = start + runs[i + 3]!;
    to = from + runs[i + 2]!;
    start = first;
    changes.insert(
      changes.length,
      changes.alloc(
        runs[i]!,
        from,
        to,
        first,
        first + runs[i + 4]!,
        runs[i + 5]!,
        designs[runs[i + 6]!]!,
      ),
    );
  }
  // (A save from before kept them in the order they were made.)
  if (!inLotOrder(changes)) changes.sortByLots();
  let at = 0;
  start = 0;
  for (let i = 0; i < packed.length; i += 3) {
    const def = CIVICS[packed[i]!]!;
    at += packed[i + 1]!;
    start += packed[i + 2]!;
    civics.add(packed[i]!, at, CIVIC_LOTS[def.kind], start, start + def.years);
  }
  for (let i = 0; i < fallen.length; i += 2) {
    const j = fallen[i]!;
    civics.setFell(j, civics.startAt(j) + fallen[i + 1]!);
  }
  const f: Fabric = {
    town,
    family: TOWN_FAMILIES[family]!,
    phase: phaseOf(town),
    next,
    homes: HOME_LEVELS.map(() => 0),
    open: [],
    aim,
    raise,
    passed,
    changes,
    civics,
    walls: walls ? { start: walls[0], end: walls[1], reach: walls[2] } : null,
    lean,
    forsaken,
    engines: s[13]?.[0] ?? KEPT_NOT,
    order: s[13]?.[1] ?? KEPT_NOT,
    place: s[13]?.[2] ?? KEPT_NOT,
  };
  readStanding(f);
  return f;
}

/**
 * A fabric's homes at each level, and open, every lot it has taken with no home on it and no building
 * standing on it: what levelsOf and civicMask tell lot by lot, read by the spans its runs and buildings cut
 * its lots into, each run over those before it. (A town of a world built over has millions of lots, and a
 * save read back has thousands of towns: Phase 66.)
 */
export function readStanding(f: Fabric): void {
  const next = f.next,
    clip = (x: number) => Math.max(0, Math.min(next, x)),
    cuts: number[] = [0, next];
  const R = f.changes;
  for (let i = 0; i < R.length; i++) {
    const c = R.slot(i),
      what = R.v(c, 0);
    if (isHome(what) || what === CHANGE.burned) cuts.push(clip(R.v(c, 1)), clip(R.v(c, 2)));
  }
  const cs = f.civics;
  for (let j = 0; j < cs.length; j++)
    if (cs.fellAt(j) === NO_FALL) cuts.push(clip(cs.lotAt(j)), clip(cs.lotAt(j) + cs.lotsAt(j)));
  const xs = Int32Array.from(cuts.sort((a, b) => a - b));
  let places = 0;
  for (let i = 0; i < xs.length; i++) if (i === 0 || xs[i] !== xs[i - 1]) xs[places++] = xs[i]!;
  const spans = places - 1,
    spanAt = (x: number) => {
      let lo = 0,
        hi = places - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (xs[mid]! < x) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    },
    level = new Int8Array(Math.max(0, spans)).fill(-1),
    under = new Uint8Array(Math.max(0, spans)),
    // (The next span no later run has painted: the last run over a lot is the one that stands on it.)
    free = new Int32Array(Math.max(0, spans) + 1),
    find = (i: number) => {
      while (free[i] !== i) {
        free[i] = free[free[i]!]!;
        i = free[i]!;
      }
      return i;
    };
  for (let i = 0; i <= spans; i++) free[i] = i;
  for (let k = R.length - 1; k >= 0; k--) {
    const c = R.slot(k);
    if (!isHome(R.v(c, 0))) continue;
    const to = spanAt(clip(R.v(c, 2)));
    for (let i = find(spanAt(clip(R.v(c, 1)))); i < to; i = find(i)) {
      level[i] = R.v(c, 5);
      free[i] = i + 1;
    }
  }
  for (let j = 0; j < cs.length; j++) {
    if (cs.fellAt(j) !== NO_FALL) continue;
    const to = spanAt(clip(cs.lotAt(j) + cs.lotsAt(j)));
    for (let i = spanAt(clip(cs.lotAt(j))); i < to; i++) under[i] = 1;
  }
  // (Lots in ash are neither homes nor open.)
  for (let k = 0; k < R.length; k++) {
    const c = R.slot(k);
    if (R.v(c, 0) !== CHANGE.burned) continue;
    const to = spanAt(clip(R.v(c, 2)));
    for (let i = spanAt(clip(R.v(c, 1))); i < to; i++) under[i] = 1;
  }
  for (let i = 0; i < spans; i++) {
    const from = xs[i]!,
      to = xs[i + 1]!;
    if (!under[i] && level[i]! >= 0) {
      f.homes[level[i]!]! += to - from;
      continue;
    }
    if (under[i]) continue;
    const n = f.open.length;
    if (n && f.open[n - 1] === from) f.open[n - 1] = to;
    else f.open.push(from, to);
  }
}

/** A fabric's open runs as pairs, each its first lot and the lot past its last (for what reads them one by one). */
export function openRuns(f: Fabric): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < f.open.length; i += 2) out.push([f.open[i]!, f.open[i + 1]!]);
  return out;
}

/** Whether runs are in the order of their lots. */
function inLotOrder(runs: Runs): boolean {
  for (let i = 1; i < runs.length; i++)
    if (runs.v(runs.slot(i), 1) < runs.v(runs.slot(i - 1), 1)) return false;
  return true;
}

/** Whether any of a town's lots lie in ash. */
function hasBurned(runs: Runs): boolean {
  for (let i = 0; i < runs.length; i++) if (runs.v(runs.slot(i), 0) === CHANGE.burned) return true;
  return false;
}

/** The first of a town's runs (in the order of their lots) that ends past lot x: where the runs over x begin. */
export function runAfter(runs: Runs, x: number): number {
  let lo = 0,
    hi = runs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (runs.v(runs.slot(mid), 2) <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** How many of a town's runs (in the order of their lots) begin before lot x. */
function runsBefore(runs: Runs, x: number): number {
  let lo = 0,
    hi = runs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (runs.v(runs.slot(mid), 1) < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The run lot p stands in, if any. */
export function runAt(f: Fabric, p: number): Change | undefined {
  const c = f.changes.get(runAfter(f.changes, p));
  return c && c[1] <= p ? c : undefined;
}

/** Which of the years a town weighs its buildings in, from its name. */
const phaseOf = (town: Ref) => hashString(`town ${town}`) % CIVIC_EVERY;

export function townsOf(world: World): TownStore {
  return world.store<TownStore>("town.fabric");
}

/** People a town's homes hold. */
export function housingOf(f: Fabric): number {
  let n = 0;
  for (let level = 0; level < f.homes.length; level++) n += f.homes[level]! * HOLDS[level]!;
  return n;
}

/** Homes standing (or rising) in a town. */
export function homesOf(f: Fabric): number {
  let n = 0;
  for (const c of f.homes) n += c;
  return n;
}

/**
 * What stands on lots [from, to) now: a home's level, or -1 for a lot with none (a run of homes
 * long built may pass over the lots of a building standing among them: those are the building's).
 */
export function levelsOf(f: Fabric, from: number, to: number): Int8Array {
  return levelsInto(f, from, to, new Int8Array(Math.max(0, to - from)));
}

/** Scratch for the year's builder: what stands on a stretch of lots, and which of them a building takes. */
let LEVELS = new Int8Array(1024),
  UNDER = new Uint8Array(1024);
function scratchLevels(f: Fabric, from: number, to: number): Int8Array {
  const n = Math.max(0, to - from);
  if (LEVELS.length < n) LEVELS = new Int8Array(n * 2);
  return levelsInto(f, from, to, LEVELS.subarray(0, n));
}
function scratchMask(f: Fabric, from: number, to: number): Uint8Array {
  const n = Math.max(0, to - from);
  if (UNDER.length < n) UNDER = new Uint8Array(n * 2);
  return maskInto(f, from, to, UNDER.subarray(0, n));
}

/** levelsOf, into `out` (of to - from). */
function levelsInto(f: Fabric, from: number, to: number, out: Int8Array): Int8Array {
  out.fill(-1);
  // (Only the runs over the stretch, found by halving: a great town's runs are many, and asked of every year it builds.)
  const runs = f.changes;
  for (let r = runAfter(runs, from); r < runs.length; r++) {
    const c = runs.slot(r),
      a = runs.v(c, 1);
    if (a >= to) break;
    if (!isHome(runs.v(c, 0))) continue;
    const lo = Math.max(a, from),
      hi = Math.min(runs.v(c, 2), to);
    if (lo < hi) out.fill(runs.v(c, 5), lo - from, hi - from);
  }
  const cs = f.civics;
  for (let j = 0; j < cs.length; j++) {
    if (cs.fellAt(j) !== NO_FALL) continue;
    const lo = Math.max(cs.lotAt(j), from),
      hi = Math.min(cs.lotAt(j) + cs.lotsAt(j), to);
    if (lo < hi) out.fill(-1, lo - from, hi - from);
  }
  return out;
}

/** Which of lots [from, to) its standing buildings (other than homes) take, now: 1 where one does. */
export function civicMask(f: Fabric, from: number, to: number): Uint8Array {
  return maskInto(f, from, to, new Uint8Array(Math.max(0, to - from)));
}

/** civicMask, into `out` (of to - from). */
function maskInto(f: Fabric, from: number, to: number, out: Uint8Array): Uint8Array {
  out.fill(0);
  const cs = f.civics;
  for (let j = 0; j < cs.length; j++) {
    if (cs.fellAt(j) !== NO_FALL) continue;
    const lo = Math.max(cs.lotAt(j), from),
      hi = Math.min(cs.lotAt(j) + cs.lotsAt(j), to);
    if (lo < hi) out.fill(1, lo - from, hi - from);
  }
  return out;
}

/**
 * The highest of lots [from, to) a home stands on now, as levelsOf tells it (-1 where none does):
 * run by run, past the buildings standing on them.
 */
/** The first of a town's standing buildings on lot p (-1: none). */
function standingOn(cs: Civics, p: number): number {
  for (let j = 0; j < cs.length; j++)
    if (cs.fellAt(j) === NO_FALL && cs.lotAt(j) <= p && cs.lotAt(j) + cs.lotsAt(j) > p) return j;
  return -1;
}

/** A town's standing buildings of at least a lot, as [first lot, end lot], in the order of their lots. */
function standingSpans(cs: Civics): [number, number][] {
  const out: [number, number][] = [];
  for (let j = 0; j < cs.length; j++)
    if (cs.fellAt(j) === NO_FALL && cs.lotsAt(j) > 0)
      out.push([cs.lotAt(j), cs.lotAt(j) + cs.lotsAt(j)]);
  return out.sort((a, b) => a[0] - b[0]);
}

function highestHome(f: Fabric, from: number, to: number): number {
  // (From the last run over the stretch back: the first lot found is the highest.)
  const runs = f.changes;
  for (let r = runsBefore(runs, to) - 1; r >= 0; r--) {
    const c = runs.slot(r),
      what = runs.v(c, 0),
      a = runs.v(c, 1),
      b = runs.v(c, 2);
    if (b <= from) break;
    if (!isHome(what)) continue;
    for (let p = Math.min(b, to) - 1; p >= Math.max(a, from);) {
      const j = standingOn(f.civics, p);
      if (j < 0) return p;
      p = f.civics.lotAt(j) - 1;
    }
  }
  return -1;
}

/**
 * The lots of [0, next) homes stand on now, as runs [first lot, end lot, level] in the order of
 * their lots: what levelsOf and civicMask tell lot by lot, told run by run (a great town has a
 * hundred thousand lots). Null where two runs of homes share a lot (there the later stands).
 */
function standingRuns(f: Fabric): [number, number, number][] | null {
  const R = f.changes,
    // (Both in the order of their lots: each is passed once, whatever the size of the town.)
    civics = standingSpans(f.civics),
    out: [number, number, number][] = [];
  let end = 0,
    i = 0;
  for (let r = 0; r < R.length; r++) {
    const c = R.slot(r);
    if (!isHome(R.v(c, 0))) continue;
    const a = R.v(c, 1),
      b = R.v(c, 2),
      level = R.v(c, 5);
    const lo = Math.max(a, 0),
      hi = Math.min(b, f.next);
    if (lo >= hi) continue;
    if (lo < end) return null;
    end = hi;
    for (let p = lo; p < hi;) {
      while (i < civics.length && civics[i]![1] <= p) i++;
      const on = civics[i];
      if (!on || on[0] >= hi) {
        out.push([p, hi, level]);
        break;
      }
      if (on[0] > p) out.push([p, on[0], level]);
      p = Math.max(p, on[1]);
    }
  }
  return out;
}

/** The lots its standing buildings (other than homes) take, now. */
export function civicLots(f: Fabric): Set<number> {
  const out = new Set<number>();
  const cs = f.civics;
  for (let j = 0; j < cs.length; j++)
    if (cs.fellAt(j) === NO_FALL) for (let k = 0; k < cs.lotsAt(j); k++) out.add(cs.lotAt(j) + k);
  return out;
}

/**
 * The level a town may rebuild its heart to (p87, rules/trade.ts heartLevel): of the kinds of home its
 * people know how to raise, the tallest whose ground at the heart is worth building so, by the walk
 * a household there saves against the town's edge (bid rent), not at a count of people. (`city` is
 * read no more: a city's heart is dear by its size, as any town's.)
 */
export function topLevel(k: (id: string) => boolean, people: number, _city: boolean): number {
  return heartLevel(people, HOLDS, heartCan(k));
}

/** The level of homes at the edge of a town whose heart is built to `top`: houses, or townhouses in an industrial city. */
export function edgeLevel(top: number, city: boolean): number {
  // (A city of spires has no low edge: Phase 66.)
  if (top >= LEVEL.spire) return LEVEL.block;
  return Math.min(top, city && top >= LEVEL.tenement ? LEVEL.townhouse : LEVEL.house);
}

/**
 * The level lot `p` of a town of `n` lots is built to: its heart the highest it builds, each
 * ring outward a step lower, down to its edge's (the lots are taken outward from the square, so
 * how far out a lot stands goes as the root of its place among them).
 */
export function lotLevel(p: number, n: number, top: number, edge: number): number {
  if (top <= edge || p >= n) return edge;
  return Math.max(edge, top - Math.floor(Math.sqrt(p / n) * (top - edge + 1)));
}

/**
 * The first lot of [p, end) past p a home is built to another level than `level` (lot p's), or end: lotLevel only
 * falls as lots go outward, so its lots of one level lie together.
 */
export function sameLevel(
  p: number,
  end: number,
  n: number,
  top: number,
  edge: number,
  level: number,
): number {
  if (top <= edge || p >= n) return end;
  let lo = p + 1,
    hi = end;
  while (lo < hi) {
    const mid = lo + ((hi - lo) >> 1);
    if (lotLevel(mid, n, top, edge) === level) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Where a building of `lots` lots may stand: at a lot its size divides (so a block's half is a half). */
const aligned = (p: number, lots: number) => Math.ceil(p / lots) * lots;

/** The first lot from p a home may take in a town wary of floods: past the ground toward its water. */
function dryStart(seed: number, p: number): number {
  while (floodGround(seed, Math.floor(p / 8))) p = (Math.floor(p / 8) + 1) * 8;
  return p;
}
/** Where the stretch from p a home may take ends, in a town wary of floods: at the next block toward its water. */
function dryStretch(seed: number, p: number): number {
  let b = Math.floor(p / 8) + 1;
  while (!floodGround(seed, b)) b++;
  return b * 8;
}
/**
 * (Of a town wary of floods, how many of its first open runs hold only flood ground, as last found: its open runs and the
 * last of those, by which it is known to hold. Every change to its open runs but a building's lots taken makes them anew;
 * one taken out or parted moves the last off its place. A cache, never history.)
 */
export interface Flooded {
  open: number[];
  /** (The first lot of the last of them: runs are in the order of their lots, so another in its place begins elsewhere.) */
  last: number;
  n: number;
}
/** Of a town wary of floods, its first open run with a lot a home may take (-1: none). */
function homeOpen(f: Fabric, seed: number, from: number, kept: Map<Ref, Flooded>): number {
  const was = kept.get(f.town);
  const open = f.open,
    runs = open.length >> 1;
  if (was && was.open === open && was.n <= runs && open[2 * (was.n - 1)] === was.last)
    from = Math.max(from, was.n);
  for (let i = from; i < runs; i++) {
    if (dryStart(seed, open[2 * i]!) < open[2 * i + 1]!) {
      if (i > 0) kept.set(f.town, { open, last: open[2 * (i - 1)]!, n: i });
      return i;
    }
  }
  if (runs) kept.set(f.town, { open, last: open[2 * (runs - 1)]!, n: runs });
  return -1;
}
/** Past so many lots a great town embanks its water and builds over the ground toward it again. */
export const DRY_MOST = 20_000;

/** Run b joined into run a, the one before it: its lots and its years. */
function merge(R: Runs, a: number, b: number): void {
  R.w(a, 2, R.v(b, 2));
  R.w(a, 3, Math.min(R.v(a, 3), R.v(b, 3)));
  R.w(a, 4, Math.max(R.v(a, 4), R.v(b, 4)));
}

/** Whether runs (slots) a and b may be one: the same change, level and design, side by side. */
const joins = (R: Runs, a: number, b: number) =>
  R.v(a, 0) === R.v(b, 0) &&
  R.v(a, 5) === R.v(b, 5) &&
  R.v(a, 6) === R.v(b, 6) &&
  (R.v(a, 2) === R.v(b, 1) || R.v(b, 2) === R.v(a, 1));

/**
 * Whether runs of homes a and b, the one after the other with no run between, may be one across
 * the lots between them: the same change, level and design, and every lot between them a standing
 * building's (a building among a town's homes does not part them; should it fall, its lots are
 * cut out again).
 */
function across(f: Fabric, a: number, b: number): boolean {
  const R = f.changes;
  if (
    R.v(a, 0) !== R.v(b, 0) ||
    R.v(a, 5) !== R.v(b, 5) ||
    R.v(a, 6) !== R.v(b, 6) ||
    R.v(b, 1) <= R.v(a, 2)
  )
    return false;
  return isHome(R.v(a, 0)) && buildingsOnly(f, R.v(a, 2), R.v(b, 1));
}

/** Whether every lot of [from, to) is a standing building's (building after building, from the first). */
function buildingsOnly(f: Fabric, from: number, to: number): boolean {
  for (let p = from; p < to;) {
    const j = standingOn(f.civics, p),
      next = j < 0 ? p : f.civics.lotAt(j) + f.civics.lotsAt(j);
    if (next === p) return false;
    p = next;
  }
  return true;
}

/** The year its land's house design was realized (-1 before it had one). */
function designSince(ctx: PopulationContext, cell: number): number {
  const p = ctx.provinces.get(cell);
  return p ? (designsOf(ctx.world).of(p.ref)?.since ?? -1) : -1;
}

/** The family of a town's streets: its people's, by their tongue (a people lay out their towns alike). */
function familyOf(ctx: PopulationContext, s: Settlement): TownFamily {
  const tongue = cultureOf(ctx.world).get(s.cell)?.tongue;
  return TOWN_FAMILIES[hashString(`streets ${tongue ?? s.ref}`) % TOWN_FAMILIES.length]!;
}

export class TownBuilder {
  private readonly ctx: PopulationContext;
  private readonly year: number;
  private readonly store: TownStore;
  /** Whether what a land knows meets each building's needs, by the land's own test of it (see meets). */
  private readonly met = new Map<(id: string) => boolean, boolean[]>();
  /** (`store`: another store than the world's, for a fabric the eye reckons apart from history's: Phase 64.) */
  constructor(ctx: PopulationContext, year: number, store: TownStore = townsOf(ctx.world)) {
    this.ctx = ctx;
    this.year = year;
    this.store = store;
  }

  /**
   * A change made: kept as the run of its lots, the runs it changes over let go where it covers
   * them, cut back where it covers an end, and parted where it falls within one.
   */
  change(f: Fabric, what: number, from: number, to: number, level: number, design: number): void {
    if (to <= from) return;
    this.cut(f, from, to);
    this.laid(f, what, from, to, level, design);
  }

  /** A change on lots no run stands over: kept as the run of its lots. */
  private laid(
    f: Fabric,
    what: number,
    from: number,
    to: number,
    level: number,
    design: number,
  ): void {
    const year = this.year,
      R = f.changes,
      run = this.made(f, what, from, to, level, design),
      // (In the order of their lots: between the runs that end by its first lot and those after.)
      i = runAfter(R, from),
      left = i > 0 ? R.slot(i - 1) : -1,
      right = i < R.length ? R.slot(i) : -1;
    // (Within a year: a run continued, as one, on either side. The run made is then let go: what its settling kept
    // of it tells it gone.)
    const fresh = (c: number) => c >= 0 && R.v(c, 3) === year && R.v(c, 4) === year;
    if (fresh(left) && joins(R, left, run)) {
      R.w(left, 2, to);
      if (fresh(right) && joins(R, left, right)) {
        R.w(left, 2, R.v(right, 2));
        R.removeAt(i);
      }
      R.release(run);
      return;
    }
    if (fresh(right) && joins(R, right, run)) {
      R.w(right, 1, from);
      R.release(run);
      return;
    }
    R.insert(i, run);
  }

  /** A change made this year, told to the digest and to the town's next settling: the run it is. */
  private made(
    f: Fabric,
    what: number,
    from: number,
    to: number,
    level: number,
    design: number,
  ): number {
    const year = this.year;
    this.comesDue(f, year + SETTLED);
    this.store.fold(f.town, FOLD.change, what, from, to, year, level, design);
    const run = f.changes.alloc(what, from, to, year, year, level, design);
    this.track(f, run);
    return run;
  }

  /** Lots [from, to) cut out of the runs over them: those it covers let go, an end cut back, one it falls within parted. */
  private cut(f: Fabric, from: number, to: number): void {
    // (Only the runs over the stretch, found by halving: they lie together in the order of their lots.)
    const R = f.changes,
      i = runAfter(R, from);
    let j = i,
      kept = 0;
    const keep: number[] = [];
    for (; j < R.length; j++) {
      const c = R.slot(j),
        a = R.v(c, 1),
        b = R.v(c, 2);
      if (a >= to) break;
      if (a >= from && b <= to) continue;
      if (a < from && b > to) {
        const part = R.alloc(R.v(c, 0), to, b, R.v(c, 3), R.v(c, 4), R.v(c, 5), R.v(c, 6));
        keep.push(c, part);
        this.track(f, part);
        R.w(c, 2, from);
        continue;
      }
      if (a < from) R.w(c, 2, from);
      else R.w(c, 1, to);
      keep.push(c);
      kept++;
    }
    if (j - i === kept && keep.length === kept) return;
    R.replace(i, j, keep);
  }

  /**
   * A town's history settled, as each year begins: ruins weathered away (and buildings long
   * fallen let go); homes rebuilt long since are homes like any other; its runs in the
   * order of their lots, and those years-old joined to the run beside them of the same change,
   * level and design, or across lots only standing buildings take (the years within a joined
   * run let go).
   */
  settle(f: Fabric): void {
    const year = this.year,
      store = this.store,
      last = store.settled.get(f),
      asked = last?.asked;
    if (last) last.asked = year;
    // (A change lays runs that come due and a building's fall comes due, each bringing that year nearer; a run cut
    // back or parted keeps its years, and what is let go brings nothing due: so whatever changed since, nothing does.)
    if (last && last.year < year && year < last.due) return;
    const young = store.young.get(f),
      ruins = store.ruins.get(f);
    // (Gone over whole the first time, and after a year it was not asked, or its buildings were not only added to.)
    if (
      !last ||
      !young ||
      !ruins ||
      asked !== year - 1 ||
      last.civics !== f.civics.version ||
      f.civics.length < last.buildings ||
      store.whole.delete(f)
    ) {
      this.settleAll(f);
      return;
    }
    this.settleYoung(f, last, young, ruins);
  }

  /**
   * Settle as settleAll would, going over only the runs that may change: the young come to be history this year, the
   * runs beside ruins weathered away, and beside each building raised since (between two runs only buildings may
   * stand). Every run else was gone over as it came to be history, with all it now has beside it.
   */
  private settleYoung(f: Fabric, last: Settled, young: number[], ruins: Ruins): void {
    const year = this.year,
      store = this.store,
      old = year - SETTLED,
      gone = year - RUIN_YEARS,
      // (Runs as kept: a run let go, or joined into another, is told gone.)
      beside: number[] = [],
      R = f.changes;
    let next = Infinity,
      dueNow = false;
    if (ruins.next <= year) {
      const weathered = ruins.list.filter((h) => R.alive(h) && R.v(R.slotOf(h), 4) < gone);
      if (weathered.length) {
        dueNow = true;
        R.keep((b) => isHome(R.v(b, 0)) || R.v(b, 4) >= gone);
        // (A ruin let go keeps its numbers till its slot is taken again: none is taken here.)
        for (const h of weathered) {
          const i = runAfter(R, R.v(R.slotOf(h), 1));
          if (i > 0) beside.push(R.handle(R.slot(i - 1)));
        }
      }
      // (Kept in place: those still standing and not yet weathered.)
      const list = ruins.list;
      let w = 0;
      ruins.next = Infinity;
      for (const h of list)
        if (R.alive(h) && R.v(R.slotOf(h), 4) >= gone) {
          list[w++] = h;
          ruins.next = Math.min(ruins.next, R.v(R.slotOf(h), 4) + RUIN_YEARS + 1);
        }
      list.length = w;
    }
    // (Only a year a run comes to be history, or a ruin weathers away, joins anything, as settleAll: a year brought near by a
    // change since let go brings nothing due, and a run parted that was history already, or a building raised since, waits
    // for one that does. Joined in any other year, a town that went on joined across a building where one loaded from a
    // save, going over all its runs, did not: juniper, Noubuey and Vigramenford.)
    if (!dueNow)
      for (const h of young)
        if (R.alive(h) && R.v(R.slotOf(h), 4) === old) {
          dueNow = true;
          break;
        }
    // (Kept in place: those still young, and those waiting.)
    let w = 0;
    for (const h of young) {
      if (!R.alive(h)) continue;
      const c = R.slotOf(h),
        end = R.v(c, 4);
      if (dueNow && end <= old) {
        if (isHome(R.v(c, 0))) R.w(c, 0, CHANGE.built);
        beside.push(h);
      } else {
        young[w++] = h;
        if (end > old) next = Math.min(next, end + SETTLED);
      }
    }
    young.length = w;
    const cs = f.civics;
    if (dueNow)
      for (let k = last.buildings; k < cs.length; k++) {
        if (cs.fellAt(k) !== NO_FALL) continue;
        const i = runAfter(R, cs.lotAt(k));
        if (i > 0) beside.push(R.handle(R.slot(i - 1)));
      }
    if (beside.length) this.joinAbout(f, beside, old);
    let fallen = false;
    for (let k = 0, cs = f.civics; k < cs.length; k++) {
      const x = cs.fellAt(k);
      if (x === NO_FALL) continue;
      else if (x < gone) fallen = true;
      else next = Math.min(next, x + RUIN_YEARS + 1);
    }
    if (fallen) f.civics.keep((k) => f.civics.fellAt(k) === NO_FALL || f.civics.fellAt(k) >= gone);
    next = Math.min(next, ruins.next);
    store.settled.set(f, {
      year,
      due: next,
      asked: year,
      civics: f.civics.version,
      // (Not due, those raised since wait; where fallen ones were let go, their places shift, and all are gone over then.)
      buildings: dueNow ? f.civics.length : fallen ? 0 : last.buildings,
    });
  }

  /** Every run of a town gone over: see settle. */
  private settleAll(f: Fabric): void {
    const year = this.year,
      old = year - SETTLED,
      gone = year - RUIN_YEARS;
    const R = f.changes;
    let due = false,
      weathered = false,
      fallen = false,
      // The next year anything comes due: a run SETTLED years on, a ruin or a building fallen
      // RUIN_YEARS on.
      next = Infinity;
    // (Only a year a run comes to be history, or a ruin weathers away, changes anything here.)
    for (let i = 0; i < R.length; i++) {
      const b = R.slot(i),
        end = R.v(b, 4),
        home = isHome(R.v(b, 0));
      if (end === old) due = true;
      else if (!home && end < gone) weathered = due = true;
      if (end + SETTLED > year) next = Math.min(next, end + SETTLED);
      if (!home && end + RUIN_YEARS >= year) next = Math.min(next, end + RUIN_YEARS + 1);
    }
    for (let k = 0, cs = f.civics; k < cs.length; k++) {
      const x = cs.fellAt(k);
      if (x === NO_FALL) continue;
      else if (x < gone) fallen = true;
      else next = Math.min(next, x + RUIN_YEARS + 1);
    }
    if (weathered) R.keep((b) => isHome(R.v(b, 0)) || R.v(b, 4) >= gone);
    if (due) this.join(f, old);
    if (fallen) f.civics.keep((k) => f.civics.fellAt(k) === NO_FALL || f.civics.fellAt(k) >= gone);
    const list: number[] = [],
      young: number[] = [];
    let ruinsNext = Infinity;
    for (let i = 0; i < R.length; i++) {
      const b = R.slot(i);
      if (!isHome(R.v(b, 0))) {
        list.push(R.handle(b));
        ruinsNext = Math.min(ruinsNext, R.v(b, 4) + RUIN_YEARS + 1);
      }
      if (R.v(b, 4) > old) young.push(R.handle(b));
    }
    this.store.young.set(f, young);
    this.store.ruins.set(f, { list, next: ruinsNext });
    // (Where nothing came due, nothing was joined: the runs on either side of a building raised before now, history both,
    // stand apart until something comes due, when every one of them is gone over as if raised since. Told it was gone over,
    // a world loaded from a save, whose first settling is this one, never joined a run across a building raised before it
    // was saved that the world that went on joined when its next run came to be history: juniper, a kiln at Stethisen.)
    this.store.settled.set(f, {
      year,
      due: next,
      asked: year,
      civics: f.civics.version,
      buildings: due ? f.civics.length : 0,
    });
  }

  /** A run made or parted, for the town's settling to go over as it comes to be history, and as a ruin weathers. */
  private track(f: Fabric, run: number): void {
    const R = f.changes,
      h = R.handle(run);
    this.store.young.get(f)?.push(h);
    if (isHome(R.v(run, 0))) return;
    const ruins = this.store.ruins.get(f);
    if (!ruins) return;
    ruins.list.push(h);
    ruins.next = Math.min(ruins.next, R.v(run, 4) + RUIN_YEARS + 1);
  }

  /**
   * The runs about each of `about` joined as join would join them: each with the run before it and those after, while
   * each is history and joins or is joined across buildings.
   */
  private joinAbout(f: Fabric, about: number[], old: number): void {
    const R = f.changes,
      // (Each by its first lot as it was when kept: a run let go keeps its numbers till its slot is taken again,
      // and none is taken here.)
      firstOf = (h: number) => R.v(R.slotOf(h), 1);
    about.sort((a, b) => firstOf(a) - firstOf(b));
    for (const h of about) {
      if (!R.alive(h)) continue;
      const c = R.slotOf(h);
      if (R.v(c, 4) > old) continue;
      let i = runAfter(R, R.v(c, 1)),
        cur = c;
      const left = i > 0 ? R.slot(i - 1) : -1;
      if (left >= 0 && R.v(left, 4) <= old && (joins(R, left, cur) || across(f, left, cur))) {
        merge(R, left, cur);
        R.removeAt(i);
        cur = left;
        i--;
      }
      for (;;) {
        if (i + 1 >= R.length) break;
        const right = R.slot(i + 1);
        if (R.v(right, 4) > old || !(joins(R, cur, right) || across(f, cur, right))) break;
        merge(R, cur, right);
        R.removeAt(i + 1);
      }
    }
  }

  /** Something of a town comes due in `year` (a change, a fall): its next settling goes over it by then. */
  private comesDue(f: Fabric, year: number): void {
    const last = this.store.settled.get(f);
    if (last && year < last.due) last.due = year;
  }

  /** Runs years-old joined, in the order of their lots (see settle). */
  private join(f: Fabric, old: number): void {
    // (Its runs are in the order of their lots already.)
    const R = f.changes;
    for (let i = 0; i < R.length; i++) {
      const b = R.slot(i);
      if (isHome(R.v(b, 0)) && R.v(b, 4) <= old) R.w(b, 0, CHANGE.built);
    }
    let w = 0;
    for (let i = 0; i < R.length; i++) {
      const b = R.slot(i),
        a = w > 0 ? R.order[w - 1]! : -1;
      if (a >= 0 && R.v(a, 4) <= old && R.v(b, 4) <= old && (joins(R, a, b) || across(f, a, b))) {
        merge(R, a, b);
        R.release(b);
        continue;
      }
      R.order[w++] = b;
    }
    R.length = w;
  }

  /** Take a lot for a home: the lowest open lot, else the next of the plan. */
  takeLot(f: Fabric): number {
    const open = f.open;
    if (open.length) {
      const p = open[0]!;
      if (++open[0]! >= open[1]!) open.splice(0, 2);
      return p;
    }
    return f.next++;
  }

  /** Lots [from, to) open again. */
  release(f: Fabric, from: number, to: number): void {
    if (to <= from) return;
    // (Its open runs are in the order of their lots, and none touches another: the stretch goes in where it falls, made one with
    // those it touches, as openMerged would make them over all of them. Sorting them all for each stretch let go was most of the
    // time a town emptying took, its homes falling a few lots a year: tests/sim/town.test.ts holds the two the same.)
    const open = f.open,
      runs = open.length >> 1;
    let lo = 0,
      hi = runs;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (open[2 * mid + 1]! < from) lo = mid + 1;
      else hi = mid;
    }
    let a = from,
      b = to,
      j = lo;
    for (; j < runs && open[2 * j]! <= b; j++) {
      a = Math.min(a, open[2 * j]!);
      b = Math.max(b, open[2 * j + 1]!);
    }
    // (A list made anew, as openMerged makes it: what keeps a town's open runs by their list knows them changed.)
    const out = new Array<number>(open.length - 2 * (j - lo) + 2);
    for (let i = 0; i < 2 * lo; i++) out[i] = open[i]!;
    out[2 * lo] = a;
    out[2 * lo + 1] = b;
    for (let i = 2 * j, k = 2 * lo + 2; i < open.length; i++, k++) out[k] = open[i]!;
    f.open = out;
  }

  /** release as it was: the stretch put with the rest and all of them sorted and made one (for tests/sim/town.test.ts). */
  releaseBySort(f: Fabric, from: number, to: number): void {
    if (to <= from) return;
    f.open.push(from, to);
    this.openMerged(f);
  }

  /** The open runs in the order of their lots, those that touch made one. */
  private openMerged(f: Fabric): void {
    // (By their first lots, in the order they stand where two begin at one lot: as a sort of the pairs kept them.)
    const open = f.open,
      order = Array.from({ length: open.length >> 1 }, (_, i) => i).sort(
        (a, b) => open[2 * a]! - open[2 * b]! || a - b,
      ),
      merged: number[] = [];
    for (const i of order) {
      const a = open[2 * i]!,
        b = open[2 * i + 1]!,
        n = merged.length;
      if (n && a <= merged[n - 1]!) merged[n - 1] = Math.max(merged[n - 1]!, b);
      else merged.push(a, b);
    }
    f.open = merged;
  }

  /** Lots [from, to) taken out of the open runs, for a building to stand on. */
  claim(f: Fabric, from: number, to: number): void {
    // (The open runs are in the order of their lots: only those over the stretch are gone over.)
    const open = f.open,
      runs = open.length >> 1;
    let lo = 0,
      hi = runs;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (open[2 * mid + 1]! <= from) lo = mid + 1;
      else hi = mid;
    }
    let j = lo;
    const keep: number[] = [];
    for (; j < runs && open[2 * j]! < to; j++) {
      const a = open[2 * j]!,
        b = open[2 * j + 1]!;
      if (a < from) keep.push(a, from);
      if (b > to) keep.push(to, b);
    }
    if (j > lo || keep.length) open.splice(2 * lo, 2 * (j - lo), ...keep);
    if (to > f.next) {
      this.release(f, f.next, from);
      f.next = to;
    }
  }

  /**
   * Homes for `people`, as many as a year's hands raise: first its homes gone over from the
   * square outward, each rebuilt to its ring's level where it stands lower, then new homes on
   * its open lots and at its edge, each at its ring's level.
   */
  grow(
    f: Fabric,
    people: number,
    top: number,
    edge: number,
    design: number,
    /** Wary of floods: no new home toward its water past its heart (sim/town/sites.ts). */
    dry = false,
  ): void {
    let room = people - housingOf(f),
      // People's worth of homes a year's hands raise.
      hands = Math.max(30, Math.round(people / 4));
    if (room <= 0) return;
    const n = f.next,
      aim = top * 8 + edge;
    // Gone over anew when what it builds has changed, or it has spread a good way since.
    if (f.aim !== aim || (f.passed >= 0 && n >= f.passed * 1.15 + 8)) {
      f.aim = aim;
      f.raise = 0;
      f.passed = -1;
    }
    if (f.passed < 0) {
      const from = f.raise,
        span = Math.min(n, from + 512),
        levels = scratchLevels(f, from, span),
        under = scratchMask(f, from, span);
      let run = -1,
        level = -1,
        p = from;
      const done = (to: number) => {
        if (run >= 0) this.change(f, CHANGE.raised, run, to, level, design);
        run = -1;
      };
      // (Lots alike taken together, as lot by lot they would be: what stands on them, whether a building does, and
      // the level they are rebuilt to, which falls only ring by ring. Every town goes over its lots so, every year.)
      let to = -1,
        rings = from;
      while (p < span && room > 0 && hands > 0) {
        if (p >= rings) {
          to = lotLevel(p, n, top, edge);
          rings = sameLevel(p, span, n, top, edge, to);
        }
        const was = levels[p - from]!,
          u = under[p - from]!;
        let e = p + 1;
        while (e < rings && levels[e - from] === was && under[e - from] === u) e++;
        if (was < 0 || was >= to || u) {
          done(p);
          p = e;
          continue;
        }
        if (run >= 0 && to !== level) done(p);
        if (run < 0) {
          run = p;
          level = to;
        }
        const dRoom = HOLDS[to]! - HOLDS[was]!,
          dHands = HOLDS[to]!,
          k = Math.min(e - p, Math.ceil(room / dRoom), Math.ceil(hands / dHands));
        f.homes[was]! -= k;
        f.homes[to]! += k;
        room -= k * dRoom;
        hands -= k * dHands;
        p += k;
      }
      done(p);
      f.raise = p;
      if (p >= n) f.passed = n;
    }
    // New homes: on open lots first (the lowest), then at the edge.
    let run = -1,
      level = -1,
      at = -1;
    const seed = dry ? townSeed(f.town) : 0;
    // (Of a town wary of floods, the open runs before this one hold only flood ground: taking lots makes none of them any other.)
    let past = 0;
    while (room > 0 && hands > 0) {
      const usable = dry ? homeOpen(f, seed, past, this.store.flooded) : f.open.length ? 0 : -1;
      if (usable >= 0) past = usable;
      // (A town wary of floods leaves the ground toward its water open at its edge: for its mills and docks. Past every
      // open run, it is the last of them.)
      if (dry && usable < 0)
        while (floodGround(seed, Math.floor(f.next / 8))) {
          const from = f.next,
            last = f.open.length - 1;
          f.next = (Math.floor(from / 8) + 1) * 8;
          if (last > 0 && f.open[last] === from) f.open[last] = f.next;
          else f.open.push(from, f.next);
        }
      // (Past its open lots and its lots of last year, every new home is of its edge's level: all
      // of them at once, a great town raising thousands of lots in a year: Phase 66.)
      if (usable < 0 && f.next >= n && (run < 0 || (f.next === at + 1 && level === edge))) {
        const from = f.next,
          homes = Math.min(
            Math.ceil(Math.min(room, hands) / HOLDS[edge]!),
            dry ? dryStretch(seed, from) - from : Infinity,
          );
        if (run < 0) {
          run = from;
          level = edge;
        }
        f.next = from + homes;
        at = f.next - 1;
        f.homes[edge]! += homes;
        room -= homes * HOLDS[edge]!;
        hands -= homes * HOLDS[edge]!;
        if (!dry) break;
        continue;
      }
      // (An open run's lots of one level taken together, as many as the year's hands and its room take, as the
      // lowest open lot one at a time would take them: a great town raises tens of thousands of homes a year.)
      const open = usable >= 0,
        o0 = open ? f.open[2 * usable]! : 0,
        o1 = open ? f.open[2 * usable + 1]! : 0,
        p = open ? (dry ? dryStart(seed, o0) : o0) : f.next,
        stop = open ? (dry ? Math.min(o1, dryStretch(seed, p)) : o1) : 0,
        to = lotLevel(p, n, top, edge),
        hold = HOLDS[to]!,
        k = Math.min(
          open ? sameLevel(p, stop, n, top, edge, to) - p : 1,
          Math.ceil(Math.min(room, hands) / hold),
        );
      if (open) {
        // (Taken from its first open lot, or, wary of floods, from past the ground toward its water within it.)
        if (p > o0) {
          if (p + k < o1) f.open.splice(2 * usable + 2, 0, p + k, o1);
          f.open[2 * usable + 1] = p;
        } else if ((f.open[2 * usable] = o0 + k) >= o1) f.open.splice(2 * usable, 2);
      } else f.next += k;
      if (run >= 0 && (p !== at + 1 || to !== level)) {
        this.change(f, CHANGE.built, run, at + 1, level, design);
        run = -1;
      }
      if (run < 0) {
        run = p;
        level = to;
      }
      at = p + k - 1;
      f.homes[to]! += k;
      room -= k * hold;
      hands -= k * hold;
    }
    if (run >= 0) this.change(f, CHANGE.built, run, at + 1, level, design);
  }

  /** Homes let fall from the edge, a few a year, where the town has long had far more than it needs. */
  shrink(f: Fabric, people: number, years = 1): void {
    const housing = housingOf(f);
    if (housing === 0 || housing <= people / 0.6) {
      f.lean = 0;
      return;
    }
    if ((f.lean += years) < 3) return;
    // (Gone over from the highest lot a home stands on: a town long lean has let its last lots
    // fall already, and would go over them every year.)
    let from = Math.max(0, f.next - 512),
      high = highestHome(f, from, f.next);
    // (And where its last 512 lots have all fallen and homes stand below them, from the highest of those. Until 2026-11-23 such a
    // town shrank no further: on first light at 1,500, 13,472 of its 24,451 towns held no one, 5,640 of them lean fifty years
    // and more, and 115 were forsaken; their 475,000 runs and 288,000 buildings were over half its towns' save. Let fall, 20,732
    // of 25,057 are forsaken there, 184 lean so long, and its towns keep 206,000 runs and 108,000 buildings: 3.2 MB, not 11.1.)
    if (high < 0) {
      high = highestHome(f, 0, from);
      from = Math.max(0, high - 511);
    }
    if (high < 0) return;
    let excess = housing - Math.ceil(people / 0.8),
      count = Math.max(
        1,
        Math.ceil(homesOf(f) * (years === 1 ? 0.05 : 1 - dmath.pow(0.95, years))),
      ),
      top = -1;
    // (What stands on its lots, a building's lots none of its homes': levelsInto tells those -1, as it tells a lot with none.)
    const levels = scratchLevels(f, from, high + 1),
      fall = (lo: number) => {
        if (top < 0) return;
        this.change(f, CHANGE.fell, lo, top + 1, 0, 0);
        this.release(f, lo, top + 1);
        top = -1;
      };
    for (let p = high; p >= from && excess > 0 && count > 0; p--) {
      const was = levels[p - from]!;
      if (was < 0) {
        fall(p + 1);
        continue;
      }
      if (top < 0) top = p;
      f.homes[was]!--;
      excess -= HOLDS[was]!;
      count--;
      if (excess <= 0 || count <= 0) fall(p);
    }
    fall(from);
  }

  /** A share of a town's homes razed: its heart first, or its edge for a town sacked. */
  raze(
    f: Fabric,
    share: number,
    edge: boolean,
    near?: number,
    kind: number = CHANGE.razed,
  ): number {
    // (Run by run where it may be: a great town sacked has a hundred thousand lots.)
    const runs = near === undefined ? standingRuns(f) : null;
    if (runs) {
      let all = 0;
      for (const [a, b] of runs) all += b - a;
      const n = Math.min(all, Math.ceil(all * share));
      if (n >= 1) return this.razeRuns(f, runs, n, edge, kind);
      if (all === 0) return 0;
    }
    const levels = levelsOf(f, 0, f.next),
      under = civicMask(f, 0, f.next),
      standing: number[] = [];
    for (let p = 0; p < f.next; p++) if (levels[p]! >= 0 && !under[p]) standing.push(p);
    const n = Math.min(standing.length, Math.ceil(standing.length * share)),
      // (About a lot, where one is given — the nearest it along the plan first: Phase 42 M201.)
      down =
        near !== undefined
          ? [...standing]
              .sort((a, b) => Math.abs(a - near) - Math.abs(b - near) || a - b)
              .slice(0, n)
              .sort((a, b) => a - b)
          : edge
            ? standing.slice(-n)
            : standing.slice(0, n);
    let run = -1,
      at = -1;
    const done = () => {
      if (run < 0) return;
      this.change(f, kind, run, at + 1, 0, 0);
      if (kind !== CHANGE.burned) this.release(f, run, at + 1);
      run = -1;
    };
    for (const p of down) {
      if (run >= 0 && p !== at + 1) done();
      if (run < 0) run = p;
      at = p;
      f.homes[levels[p]!]!--;
    }
    done();
    return down.length;
  }

  /**
   * A share of a town's homes burned from the air, about its heart, as far out as loads miss: hits about a
   * point thin as e^(-r²/2σ²) and a plan's lots go as r², so a lot's number thins as an exponential, `about`
   * lots to its mean. Each stick's lots run on from where it landed (no draw); what falls past its last home
   * hits nothing. Their lots lie in ash until rise. How many homes burned.
   */
  burn(f: Fabric, share: number, about: number, places: number = STICKS): number {
    const runs = standingRuns(f);
    if (!runs) return this.raze(f, share, false, undefined, CHANGE.burned);
    let all = 0;
    for (const [a, b] of runs) all += b - a;
    const n = Math.min(all, Math.ceil(all * share));
    if (n < 1) return 0;
    const sticks = Math.max(1, Math.min(places, n)),
      reach = 1 - dmath.exp(-f.next / about),
      salt = homesOf(f),
      starts: number[] = [];
    for (let i = 0; i < sticks; i++) {
      const u = (hashString(`loads ${f.town} ${this.year} ${salt} ${i}`) >>> 0) / 2 ** 32;
      starts.push(Math.floor(-about * dmath.log(1 - u * reach)));
    }
    starts.sort((a, b) => a - b);
    const down: [number, number, number][] = [];
    let r = 0,
      p = 0,
      burned = 0;
    starts.forEach((q, i) => {
      let left = Math.floor(n / sticks) + (i < n % sticks ? 1 : 0);
      p = Math.max(p, q);
      while (left > 0 && r < runs.length) {
        const [a, b, level] = runs[r]!;
        if (b <= p) {
          r++;
          continue;
        }
        const from = Math.max(a, p),
          k = Math.min(left, b - from);
        down.push([from, from + k, level]);
        left -= k;
        burned += k;
        p = from + k;
      }
    });
    this.layDown(f, down, CHANGE.burned);
    if (burned > 0) this.store.ashen.add(f);
    return burned;
  }

  /**
   * What the greatest fire makes flat (W5): a share of a town's homes from its heart out, nothing between them spared, the
   * buildings among them too. All of that ground lies in ash for `ash` years, one run: no one builds on it till then. The
   * run keeps the height of what stood (`level`) and its years (`design`). How many homes.
   */
  flatten(f: Fabric, share: number, ash: number): number {
    const runs = standingRuns(f);
    if (!runs) return this.raze(f, share, false, undefined, CHANGE.burned);
    let all = 0,
      top = 0;
    for (const [a, b, level] of runs) {
      all += b - a;
      top = Math.max(top, level);
    }
    const n = Math.min(all, Math.ceil(all * share));
    if (n < 1) return 0;
    let left = n,
      reach = 0;
    for (const [a, b, level] of runs) {
      const k = Math.min(left, b - a);
      f.homes[level]! -= k;
      reach = a + k;
      left -= k;
      if (left <= 0) break;
    }
    // (In the order of their lots: one it reaches may carry it on to the end of its own.)
    const buildings = f.civics.filter((c) => c.fell === null && c.lots > 0);
    buildings.sort((a, b) => a.at - b.at);
    for (const c of buildings) {
      if (c.at >= reach) break;
      reach = Math.max(reach, c.at + c.lots);
      c.fell = this.year;
      this.comesDue(f, this.year + RUIN_YEARS + 1);
      this.store.fold(f.town, FOLD.fell, CIVIC_INDEX.get(c.kind)!, c.at);
    }
    this.claim(f, 0, reach);
    this.change(f, CHANGE.burned, 0, reach, top, ash);
    this.store.ashen.add(f);
    return n;
  }

  /**
   * Lots that have lain their years in ash: homes again while its people want them (its edge lets its own fall
   * in time, if that leaves it too many), open ground if not.
   */
  rise(f: Fabric, people: number, top: number, edge: number, design: number): void {
    // (A great city has thousands of runs and hundreds that rise in a year: its runs are gone over once, each due
    // one's lots told in its place, and its open lots once. Runs never share a lot, so a burned run let go is all a
    // cut would do, and what goes on its lots stands over nothing.)
    const R = f.changes,
      year = this.year,
      // (A run's design says how long it lies, where that is not a rocket's: see flatten.)
      isDue = (c: number) =>
        R.v(c, 0) === CHANGE.burned && R.v(c, 4) + (R.v(c, 6) || ASH_YEARS) <= year;
    let due = false;
    for (let i = 0; i < R.length && !due; i++) due = isDue(R.slot(i));
    if (!due) {
      if (!hasBurned(R)) this.store.ashen.delete(f);
      return;
    }
    const opened: [number, number][] = [],
      out: number[] = [],
      n = f.next;
    let room = people / 0.6 - housingOf(f);
    const lay = (what: number, a: number, b: number, level: number, d: number) => {
      const run = this.made(f, what, a, b, level, d),
        last = out.length ? out[out.length - 1]! : -1;
      // (Within a year: a run continued, as one; the run made let go.)
      if (last >= 0 && R.v(last, 3) === year && R.v(last, 4) === year && joins(R, last, run)) {
        R.w(last, 2, b);
        R.release(run);
      } else out.push(run);
    };
    for (let r = 0, end = R.length; r < end; r++) {
      const c = R.slot(r);
      if (!isDue(c)) {
        out.push(c);
        continue;
      }
      const a = R.v(c, 1),
        b = R.v(c, 2);
      // (A building may have gone up on them since.)
      const under = civicMask(f, a, b);
      // (Where one has, nothing is laid on its lots: the runs either side may join across it, which its settling
      // finds only going over every run.)
      if (under.includes(1)) this.store.whole.add(f);
      let run = -1,
        level = -1,
        clear = a;
      const done = (to: number) => {
        if (run < 0) return;
        if (level >= 0) lay(CHANGE.built, run, to, level, design);
        else {
          lay(CHANGE.razed, run, to, 0, 0);
          opened.push([run, to]);
        }
        run = -1;
      };
      // (Lot by lot as its people want them, the lots of one level together.)
      for (let p = a; p < b;) {
        if (under[p - a]) {
          done(p);
          p++;
          continue;
        }
        if (clear <= p) for (clear = p + 1; clear < b && !under[clear - a];) clear++;
        const to = room > 0 ? lotLevel(p, n, top, edge) : -1,
          k =
            to < 0
              ? clear - p
              : Math.min(sameLevel(p, clear, n, top, edge, to) - p, Math.ceil(room / HOLDS[to]!));
        if (run >= 0 && to !== level) done(p);
        if (run < 0) {
          run = p;
          level = to;
        }
        if (to >= 0) {
          f.homes[to]! += k;
          room -= k * HOLDS[to]!;
        }
        p += k;
      }
      done(b);
    }
    R.become(out);
    if (opened.length) {
      for (const r of opened) f.open.push(r[0], r[1]);
      this.openMerged(f);
    }
    if (!hasBurned(R)) this.store.ashen.delete(f);
  }

  /**
   * Raze's `n` lots of the runs homes stand on, its edge's last or its heart's first, razed as it
   * razes them lot by lot: each stretch of lots side by side one change.
   */
  private razeRuns(
    f: Fabric,
    runs: [number, number, number][],
    n: number,
    edge: boolean,
    kind: number,
  ): number {
    const down: [number, number, number][] = [];
    for (let i = edge ? runs.length - 1 : 0, left = n; left > 0; i += edge ? -1 : 1) {
      const [a, b, level] = runs[i]!,
        k = Math.min(left, b - a);
      down.push(edge ? [b - k, b, level] : [a, a + k, level]);
      left -= k;
    }
    if (edge) down.reverse();
    this.layDown(f, down, kind);
    return n;
  }

  /** Stretches of homes brought down, each stretch of lots side by side one change: open again, unless in ash. */
  private layDown(
    f: Fabric,
    down: readonly (readonly [number, number, number])[],
    kind: number,
  ): void {
    let run = -1,
      at = -1;
    const done = () => {
      if (run < 0) return;
      this.change(f, kind, run, at, 0, 0);
      if (kind !== CHANGE.burned) this.release(f, run, at);
      run = -1;
    };
    for (const [a, b, level] of down) {
      if (run >= 0 && a !== at) done();
      if (run < 0) run = a;
      at = b;
      f.homes[level]! -= b - a;
    }
    done();
  }

  /** A building gone: fallen out of use or taken the place of, its lots open again. */
  private fall(f: Fabric, c: Civic, why: number): void {
    c.fell = this.year;
    this.comesDue(f, this.year + RUIN_YEARS + 1);
    this.cut(f, c.at, c.at + c.lots);
    this.release(f, c.at, c.at + c.lots);
    this.store.fold(f.town, why, CIVIC_INDEX.get(c.kind)!, c.at);
  }

  /**
   * Its other buildings: one begun a year (two in a city) of those it wants and lacks, the
   * oldest crafts first. Its land's faith and waters are asked only of the buildings that need
   * them, and what it knows only of those it lacks.
   */
  civics(
    f: Fabric,
    s: Settlement,
    k: (id: string) => boolean,
    city: boolean,
    faith: () => boolean,
    water: () => boolean,
  ): void {
    const people = s.population;
    // (What its buildings are worth to it: who works in it, what they earn, how patient they are, rules/civicworth.ts. Read
    // once a weighing, and only once a kind it lacks is open to it: most of a world's towns, weighed, want nothing new.)
    let use: TownUse | null = null;
    // What stands of each kind (what took a building's place stands for it: a temple is the
    // town's shrine), and what is rising; one fallen out of use a weighing at most, its use no longer worth
    // what keeping it up costs (rules/civicworth.ts keptPeople).
    HAVE.fill(0);
    RISING.fill(0);
    // (Each kind asked of once: a great town has a hundred and fifty buildings, weighed one year in three. Of those standing,
    // one is asked whether its use still pays its upkeep each weighing, in turn: the one the year's turn comes to, counted
    // among those standing.)
    const cs = f.civics;
    let standing = 0;
    for (let j = 0; j < cs.length; j++) if (cs.fellAt(j) === NO_FALL) standing++;
    const asked = standing > 0 ? Math.floor(this.year / CIVIC_EVERY) % standing : -1;
    for (let j = 0, at = -1; j < cs.length; j++) {
      if (cs.fellAt(j) !== NO_FALL) continue;
      const i = cs.kindAt(j);
      if (
        ++at === asked &&
        cs.endAt(j) <= this.year &&
        people <
          (Number.isNaN(KEPT_FIXED[i]!)
            ? keptPeople(CIVICS[i]!, CIVIC_LOTS[CIVICS[i]!.kind], (use ??= townUseOf(this.ctx, s)))
            : KEPT_FIXED[i]!)
      ) {
        this.fall(f, cs.get(j)!, FOLD.fell);
        continue;
      }
      HAVE[i]!++;
      if (cs.endAt(j) > this.year) RISING[i] = 1;
      if (REPLACES[i]! >= 0) HAVE[REPLACES[i]!]!++;
    }
    let begun = 0;
    for (let i = 0; i < CIVICS.length && begun < (city ? 2 : 1); i++) {
      const def = CIVICS[i]!;
      if ((def.market && !s.market) || (def.city && !city) || RISING[i] || people < LEAST_EVER[i]!)
        continue;
      if (!this.meets(def, i, k)) continue;
      // (As many as its people hold, where a first pays in this town: rules/civicworth.ts. Its use read only where it holds fewer.)
      if (HAVE[i]! >= civicsHeld(def, people)) continue;
      use ??= townUseOf(this.ctx, s);
      const want =
        people >= payingPeople(def, CIVIC_LOTS[def.kind], use)
          ? civicsPaying(def, CIVIC_LOTS[def.kind], use)
          : 0;
      if (want < 1 || HAVE[i]! >= want) continue;
      if ((def.faith && !faith()) || (def.water && !water())) continue;
      // (A prison only where its land's court holds people.)
      if (def.held && !(courtIn(this.ctx.world, s.cell).held > 0)) continue;
      // (What it takes the place of comes down first: it may rise where that stood.)
      const old = def.replaces
        ? f.civics.find((c) => c.fell === null && c.kind === def.replaces)
        : undefined;
      if (old) this.fall(f, old, FOLD.replaced);
      const lots = CIVIC_LOTS[def.kind],
        at = this.siteBy(f, lots, this.wants(def.kind, s, k), false);
      this.clearFor(f, at, lots);
      f.civics.add(i, at, lots, this.year, this.year + def.years);
      this.store.fold(f.town, FOLD.begun, i, at, this.year);
      if (def.kind === "market") this.firstMarket(f, people);
      begun++;
      // (A temple raised is told: its town's faith in stone. Not one the eye reckons apart: reading a town changes nothing.)
      if (def.kind === "temple" && this.store === townsOf(this.ctx.world)) {
        const why = causeOf(this.ctx, s.cell, def.kind);
        this.ctx.world.events.emit({
          type: TOWN_EVENTS.temple.type,
          subjects: [s.ref],
          place: this.ctx.provinces.get(s.cell)?.ref ?? null,
          causes: why ? [{ ref: why, role: "enabler", weight: 1 }] : [],
          data: { name: s.name },
        });
      }
    }
  }

  /**
   * Whether what a land knows (k) meets a building's needs: asked once of each test of a land's
   * knowledge (a land's towns weighed in a year share one, and nothing they build changes it).
   */
  private meets(def: CivicDef, i: number, k: (id: string) => boolean): boolean {
    let met = this.met.get(k);
    if (!met) this.met.set(k, (met = []));
    return (met[i] ??= needsMet(def, k));
  }

  /**
   * Where a building of a kind would go in a town (rules/buildings.ts CIVIC_SITE): a seat's halls on its high ground; its
   * works kept out in its lee where its land has written law to zone them, else among its homes.
   */
  wants(kind: CivicKind, s: Settlement, k: (id: string) => boolean): CivicSite {
    // (A realm keeps its seat's town by its land and its name.)
    const realm = politiesOf(this.ctx.world).of(s.cell),
      seat = !!realm && realm.seat === s.cell && realm.town === s.name,
      want = seat ? seatSite(kind) : CIVIC_SITE[kind];
    return want === "works" ? (k(ZONING_NEEDS) ? "lee" : "homes") : want;
  }

  /**
   * Where a building of `lots` lots goes, by what it wants of the ground (see CIVIC_SITE): the first lots no other building
   * stands on from the square outward — of its quarter, where it wants one (the high ground near the square) — or, for one
   * that wants the water, the lee or the way in, the first open lots of that quarter, else the first block of it at the edge
   * (to the end of the next round of the town's growth at most: the lots passed over lie open for its homes). `heart`: whatever it wants,
   * near the square (a great town asked for it).
   */
  siteBy(f: Fabric, lots: number, want: CivicSite, heart: boolean): number {
    const q =
      want === "water"
        ? QUARTER.water
        : want === "lee"
          ? QUARTER.lee
          : want === "high"
            ? QUARTER.high
            : want === "road"
              ? QUARTER.road
              : -1;
    if (want === "heart" || want === "homes" || want === "high" || heart)
      return this.siteFor(f, lots, "core", q, want === "homes" ? HEART_BLOCKS * 8 : 0);
    if (q < 0) return this.siteFor(f, lots, "edge");
    const seed = townSeed(f.town),
      ofQuarter = (p: number) => quarterOf(seed, Math.floor(p / 8)) === q;
    // (Open ground of its quarter first: what fell or was passed over, the nearest the square. A few dozen runs at most.)
    const open = f.open;
    for (let i = 0; i < Math.min(open.length >> 1, 32); i++) {
      const a = open[2 * i]!,
        b = open[2 * i + 1]!;
      for (let p = aligned(a, lots); p + lots <= b && p - a < 64; p += lots)
        if (ofQuarter(p) && Math.floor(p / 8) === Math.floor((p + lots - 1) / 8)) return p;
    }
    const e = aligned(f.next, lots);
    for (let b = Math.floor(e / 8); b < (Math.floor(e / 8 / QUARTERS) + 2) * QUARTERS; b++) {
      if (quarterOf(seed, b) !== q) continue;
      const p = Math.max(e, b * 8);
      if (p + lots <= (b + 1) * 8) return p;
    }
    return e;
  }

  /**
   * Where a building of `lots` lots goes: about the square (the innermost lots no other building has, from lot `from`; of
   * quarter `q` where one is asked), or at the edge.
   */
  siteFor(f: Fabric, lots: number, place: "core" | "edge", q = -1, from = 0): number {
    if (place === "core") {
      // (By the spans its standing buildings take, not lot by lot: a great town has tens of millions of lots,
      // and this is asked each year of whichever towns are building. Phase 66.)
      // (Nor on lots in ash: no one builds there till its years are out. 2026-11-13: a shrine and a granary rose
      // the year the greatest fire flattened a town's heart, on its ash.)
      // (A town with no lots in ash is not among the ashen: its runs need not be gone over for them.)
      const ash = !this.store || this.store.ashen.has(f),
        spans = (standingSpans(f.civics) as (readonly [number, number])[])
          .concat(
            ash
              ? f.changes.filter((c) => c[0] === CHANGE.burned).map((c) => [c[1], c[2]] as const)
              : [],
          )
          .sort((a, b) => a[0] - b[0]);
      let i = 0,
        reach = -1;
      const seed = q >= 0 ? townSeed(f.town) : 0;
      for (let p = aligned(from, lots); p < f.next; p += lots) {
        // (Of its quarter only, a block at a time: the rest of the block passed over.)
        if (q >= 0 && quarterOf(seed, Math.floor(p / 8)) !== q) {
          p = (Math.floor(p / 8) + 1) * 8 - lots;
          continue;
        }
        const end = Math.min(p + lots, f.next);
        while (i < spans.length && spans[i]![0] < end) reach = Math.max(reach, spans[i++]![1]);
        if (reach <= p) return p;
      }
      // (None of its quarter open yet: the next block of it at the edge.)
      if (q >= 0) {
        const e = aligned(f.next, lots);
        for (let b = Math.floor(e / 8); b < (Math.floor(e / 8 / QUARTERS) + 2) * QUARTERS; b++) {
          const p = Math.max(e, b * 8);
          if (quarterOf(seed, b) === q && p + lots <= (b + 1) * 8) return p;
        }
      }
    }
    return aligned(f.next, lots);
  }

  /**
   * One of its buildings begun at the asking (H1): on the lots its own plan would give it, what it takes the place of coming down first. Its `end` is its kind's,
   * as every building's is when it is read back; how long it truly takes is its ask's.
   */
  askedCivic(f: Fabric, kind: CivicKind): { at: number; lots: number } {
    const def = civic(kind),
      old = def.replaces
        ? f.civics.find((c) => c.fell === null && c.kind === def.replaces)
        : undefined;
    if (old) this.fall(f, old, FOLD.replaced);
    // (At a great town's edge it would rise past what anyone can be shown: there, by its heart.)
    const lots = CIVIC_LOTS[kind],
      at = this.siteBy(f, lots, CIVIC_SITE[kind], f.next > ASKED_EDGE_LOTS);
    this.clearFor(f, at, lots);
    f.civics.add(CIVIC_INDEX.get(kind)!, at, lots, this.year, this.year + def.years);
    this.store.fold(f.town, FOLD.begun, CIVIC_INDEX.get(kind)!, at, this.year);
    if (kind === "market") this.firstMarket(f, this.ctx.settlements.get(f.town)?.population ?? 0);
    return { at, lots };
  }

  /**
   * Its first market: its market place is held on the ground it would have taken next, as great as its people ask
   * (Fabric.place). Set down once.
   */
  firstMarket(f: Fabric, people: number): void {
    if (f.place !== -1) return;
    f.place = f.next * 4 + placeClass(people);
    this.store.fold(f.town, FOLD.form, 3, f.place);
  }

  /** Its realm's reach on its land set down (Fabric.order: at one of ORDER_AT), once. */
  orderSet(f: Fabric, at: number, cell: number): void {
    if (f.order < 0 || ((f.order >> (4 * at)) & 15) !== ORDER_NONE) return;
    const tenths = Math.max(0, Math.min(10, Math.round(landReach(this.ctx, cell) * 10)));
    f.order = (f.order & ~(15 << (4 * at))) | (tenths << (4 * at));
    this.store.fold(f.town, FOLD.form, at, tenths);
  }

  /** Its walls begun at the asking (H1), about the town as it stands. */
  askedWalls(f: Fabric): { at: number; lots: number } {
    f.walls = { start: this.year, end: this.year + wallYears(f.next), reach: f.next };
    this.store.fold(f.town, FOLD.walls, this.year, f.next);
    const cell = this.ctx.settlements.get(f.town)?.cell;
    if (cell !== undefined) this.orderSet(f, ORDER_AT.walled, cell);
    return { at: -1, lots: 0 };
  }

  /** A site given up (H1): what stands of it goes to ruin. */
  askedFall(f: Fabric, c: Civic): void {
    this.fall(f, c, FOLD.fell);
  }

  /** Lots [at, at + lots) made ready for a building: their homes pulled down, the lots taken. */
  clearFor(f: Fabric, at: number, lots: number): void {
    const end = Math.min(at + lots, f.next),
      levels = levelsOf(f, at, end);
    let run = -1;
    for (let p = at; p < end; p++) {
      const was = levels[p - at]!;
      if (was >= 0) {
        f.homes[was]!--;
        if (run < 0) run = p;
      } else if (run >= 0) {
        this.change(f, CHANGE.cleared, run, p, 0, 0);
        run = -1;
      }
    }
    if (run >= 0) this.change(f, CHANGE.cleared, run, end, 0, 0);
    this.claim(f, at, at + lots);
  }
}

/** Past so many lots, what a town is asked to raise rises near its heart, not at its edge. */
const ASKED_EDGE_LOTS = 300;

/**
 * A town as its buildings are weighed (rules/civicworth.ts TownUse): its people; the share of them each kind of building serves (its
 * land's crafters, traders and learned shared among its land's towns by their size, all of them in the town at most; its people's
 * young); what each earns against those who build, paid the going wage (its land's wages); and what waiting is worth to its people
 * (rules/thrift.ts).
 */
export function townUseOf(ctx: PopulationContext, s: Settlement): TownUse {
  // (A town weighed apart from a world, as a plan is drawn alone, reads as a town of no trades: its people's buildings only.)
  const prov = ctx.provinces?.get(s.cell),
    m = ctx.world?.peek<MarketStore>("economy.markets")?.get(s.cell),
    people = Math.max(0, s.population);
  // (Its land's people by what they do, each counted once.)
  let total = 0;
  if (prov) for (let o = 0; o < USE_OCC.length; o++) total += USE_OCC[o] = prov.occupation(o);
  if (!prov || total <= 0 || people <= 0)
    return { people, share: [1, 0, 0, 0, 0], worth: [1, 1, 1, 1, 1], preference: 0.05 };
  let towns = 0;
  for (const o of ctx.settlements?.inProvince(s.cell) ?? [s]) towns += Math.max(0, o.population);
  const inTown = (occ: number) =>
      Math.min(1, (USE_OCC[occ]! * (people / Math.max(people, towns))) / people),
    w = m?.wage,
    workers = total - USE_OCC[OCC.dependent]!;
  // (Its builders are paid the going wage, what a worker's year fetches on the mean: a building's cost and use are both in it.
  // What one of those it serves earns is held within a quarter and four times it: a trade idle one year earns next to nothing.)
  let paid = 0;
  if (w) for (let o = 1; o < w.length && o < USE_OCC.length; o++) paid += w[o]! * USE_OCC[o]!;
  const mean = workers > 0 ? paid / workers : 0,
    against = (x: number) => (mean > 0 && x > 0 ? Math.min(4, Math.max(0.25, x / mean)) : 1);
  return {
    people,
    share: [
      1,
      inTown(OCC.crafter),
      inTown(OCC.trader),
      inTown(OCC.leader),
      USE_OCC[OCC.dependent]! / total,
    ],
    worth: [
      1,
      against(w?.[OCC.crafter] ?? 0),
      against(w?.[OCC.trader] ?? 0),
      against(w?.[OCC.leader] ?? 0),
      1,
    ],
    preference: timePreference(adultHazard(ctx.life), prov.leanest / 1000),
  };
}
/** (townUseOf's own numbers, a land's people by occupation: filled anew each reading.) */
const USE_OCC = new Float64Array(Object.keys(OCC).length);

/** Scratch for a town's buildings by kind: how many stand, whether one is rising. */
const HAVE = new Int32Array(CIVICS.length),
  /** Each kind's fewest people to pay in any town, and what keeps it where that rests on its people alone (rules/civicworth.ts). */
  LEAST_EVER = Float64Array.from(CIVICS, (d) => leastEver(d, CIVIC_LOTS[d.kind])),
  KEPT_FIXED = Float64Array.from(CIVICS, (d) => keptFixed(d, CIVIC_LOTS[d.kind])),
  RISING = new Uint8Array(CIVICS.length),
  /** Each kind's: the people below which one long built falls out of use, and the kind it takes the place of (-1: none). */
  REPLACES = Int8Array.from(CIVICS, (d) => (d.replaces ? CIVIC_INDEX.get(d.replaces)! : -1));

/** A town's fabric begun: its family of streets from its people, and nothing built. */
function found(ctx: PopulationContext, s: Settlement): Fabric {
  return townsOf(ctx.world).add({
    town: s.ref,
    family: familyOf(ctx, s),
    phase: phaseOf(s.ref),
    next: 0,
    homes: HOLDS.map(() => 0),
    open: [],
    aim: -1,
    raise: 0,
    passed: -1,
    changes: new Runs(),
    civics: new Civics(),
    walls: null,
    lean: 0,
    forsaken: null,
    engines: -1,
    order: ORDER_NEW,
    place: -1,
  });
}

/** Whether war has come near a town: its land fought over these thirty years, or its realm at war these ten. */
function threatened(
  ctx: PopulationContext,
  s: Settlement,
  year: number,
  fought: Set<number>,
): boolean {
  if (fought.has(s.cell)) return true;
  const realm = politiesOf(ctx.world).of(s.cell);
  return (
    !!realm &&
    warsOf(ctx.world)
      .fighting(realm.ref)
      .some((w) => w.ended === null || w.ended >= year - 10)
  );
}

/**
 * What a land knows, as its towns ask it through a year's building: each answer once (its towns
 * ask alike, and nothing a town builds changes what its land knows).
 */
function knower(ctx: PopulationContext, cell: number): (id: string) => boolean {
  const known = new Map<string, boolean>();
  return (id) => {
    let v = known.get(id);
    if (v === undefined)
      known.set(
        id,
        (v = id.includes("|")
          ? id.split("|").some((x) => knows(ctx, cell, x))
          : knows(ctx, cell, id)),
      );
    return v;
  };
}

/**
 * The towns' year: each housed as its people ask and its hands allow; and, one year in
 * CIVIC_EVERY (each town in its own, and in its first), its other buildings weighed and its
 * walls.
 */
/** A town's spare homes are let fall once in this many years, in its turn. */
const SHRINK_EVERY = 3;

export function townYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = townsOf(world),
    year = yearOfMoment(t),
    cities = citiesOf(world),
    beliefs = beliefOf(world),
    builder = new TownBuilder(ctx, year);
  // The lands fought over these thirty years; and those whose defenders lost a hard fight last
  // year, whose greatest town is sacked.
  const fought = new Set<number>(),
    sacked = new Map<number, number>();
  for (const w of warsOf(world).hot())
    for (let i = w.battles.length - 1; i >= 0; i--) {
      const b = w.battles[i]!;
      if (b.year < year - 30) break;
      fought.add(b.land);
      const fallen = b.fallen[0] + b.fallen[1];
      if (b.year === year - 1 && b.won && fallen >= 100)
        sacked.set(b.land, (sacked.get(b.land) ?? 0) + fallen);
    }
  /** Each land's towns' wariness of floods, asked once a year. */
  const wary = new Map<number, boolean>();
  const knowers = new Map<number, (id: string) => boolean>(),
    knowerOf = (cell: number) => {
      const k = knower(ctx, cell);
      knowers.set(cell, k);
      return k;
    };
  for (const s of ctx.settlements.all()) {
    let f = store.of(s);
    if (!f) {
      if (s.population <= 0) continue;
      f = found(ctx, s);
      builder.orderSet(f, ORDER_AT.founded, s.cell);
    }
    const cell = s.cell,
      k = knowers.get(cell) ?? knowerOf(cell),
      city = !!cities.get(s.ref),
      people = s.population,
      weighs = f.next === 0 || (year + f.phase) % CIVIC_EVERY === 0;
    // (Engines come to its land: what it has taken by now was laid before them. Set down once.)
    if (f.engines === -1 && k(ENGINES)) {
      f.engines = f.next;
      store.fold(f.town, FOLD.form, 4, f.next);
      builder.orderSet(f, ORDER_AT.engines, cell);
    }
    builder.settle(f);
    if (store.ashen.has(f)) {
      const top = topLevel(k, people, city);
      builder.rise(f, people, top, edgeLevel(top, city), designSince(ctx, cell));
    }
    const fallen = sacked.get(cell);
    if (fallen && ctx.settlements.inProvince(cell).every((o) => o.population <= people))
      builder.raze(f, Math.min(0.12, 0.01 + fallen / Math.max(1, people) / 20), true);
    // Its other buildings first (about the square, before its first homes take the lots).
    if (weighs)
      builder.civics(
        f,
        s,
        k,
        city,
        () => !!beliefs.of(cell).faith,
        () => watersOf(ctx.generated, cell),
      );
    if (people > housingOf(f)) {
      const top = topLevel(k, people, city);
      f.lean = 0;
      let dry = wary.get(cell);
      if (dry === undefined) wary.set(cell, (dry = floodWary(world, cell, year)));
      builder.grow(
        f,
        people,
        top,
        edgeLevel(top, city),
        designSince(ctx, cell),
        dry && f.next < DRY_MOST,
      );
    }
    // (A town with homes to spare lets them fall in its turn, once in SHRINK_EVERY years and as many years' worth at once: its
    // empty homes are gone over lot by lot, and most towns of an old world have some.)
    else if ((year + f.phase) % SHRINK_EVERY === 0) builder.shrink(f, people, SHRINK_EVERY);
    if (
      weighs &&
      !f.walls &&
      (s.market || people >= 600) &&
      k("fortification") &&
      threatened(ctx, s, year, fought)
    ) {
      const known = loreOf(world).get(cell, "fortification");
      f.walls = { start: year, end: year + wallYears(f.next), reach: f.next };
      // (Told, as war comes near; not held on to for ever: fifteen thousand towns are walled.)
      world.events.emit({
        type: TOWN_EVENTS.walled.type,
        subjects: [s.ref],
        place: ctx.provinces.get(cell)?.ref ?? null,
        causes: known ? [{ ref: known.event, role: "enabler", weight: 1 }] : [],
        data: { name: s.name },
      });
      store.fold(f.town, FOLD.walls, year, f.next);
      builder.orderSet(f, ORDER_AT.walled, cell);
    }
    // Forsaken: every home of a town that had them fallen (and lived in again, no longer).
    const empty = homesOf(f) === 0 && f.next > 0;
    if (empty && !f.forsaken) {
      f.forsaken = world.events.emit({
        type: TOWN_EVENTS.forsaken.type,
        subjects: [s.ref],
        place: ctx.provinces.get(cell)?.ref ?? null,
        data: { name: s.name },
      });
      store.fold(f.town, FOLD.forsaken);
    } else if (!empty && f.forsaken) {
      f.forsaken = null;
      store.fold(f.town, FOLD.livedIn);
    }
  }
}

/** The learning a building waited on: of what it needs, the one its land came to last (its event). */
export function causeOf(ctx: PopulationContext, cell: number, kind: CivicKind): Ref | null {
  let best: { year: number; event: Ref } | null = null;
  for (const need of civic(kind).needs)
    for (const id of need.split("|")) {
      const known = loreOf(ctx.world).get(cell, id);
      if (known && (!best || known.year > best.year)) best = known;
    }
  return best?.event ?? null;
}

/**
 * Raze a share of a town's homes (a fire, a quake, fire from the sky): the heart first, or those
 * nearest a lot of its plan where one is given (a fire sent where it falls: Phase 42 M201). How
 * many came down.
 */
export function razeTown(
  ctx: PopulationContext,
  town: Ref,
  share: number,
  t: SimTime,
  near?: number,
): number {
  const f = townsOf(ctx.world).get(town);
  return f ? new TownBuilder(ctx, yearOfMoment(t)).raze(f, share, false, near) : 0;
}

/** A share of a town's homes burned from the air, `about` lots from its heart (see TownBuilder.burn): how many. */
export function burnTown(
  ctx: PopulationContext,
  town: Ref,
  share: number,
  t: SimTime,
  about: number,
  /** In how many places (W3: a rocket's hits are few and tight); by default, a stream's. */
  places?: number,
): number {
  const f = townsOf(ctx.world).get(town);
  return f ? new TownBuilder(ctx, yearOfMoment(t)).burn(f, share, about, places) : 0;
}

/** What the greatest fire makes flat (see TownBuilder.flatten): how many homes. */
export function flattenTown(
  ctx: PopulationContext,
  town: Ref,
  share: number,
  t: SimTime,
  ash: number,
): number {
  const f = townsOf(ctx.world).get(town);
  return f ? new TownBuilder(ctx, yearOfMoment(t)).flatten(f, share, ash) : 0;
}

/** Whether any of a town's homes stand (or rise). */
export function homesStand(world: World, town: Ref): boolean {
  return !!townsOf(world)
    .get(town)
    ?.homes.some((n) => n > 0);
}

/** Teach a peopled world its towns' fabric. */
export function installTowns(world: World, ctx: () => PopulationContext): TownStore {
  const store = world.register(new TownStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "191.town.year", every: YEAR, run: (t) => townYear(ctx(), t) });
  return store;
}
