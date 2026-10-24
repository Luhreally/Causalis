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
import {
  YEAR,
  defineEventType,
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
  HOLDS,
  HOME_LEVELS,
  LEVEL,
  civic,
  needsMet,
  wallYears,
  type CivicKind,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { Settlement } from "../population/stores.ts";
import { knows, loreOf } from "../lore/lore.ts";
import { watersOf } from "../ecology/ecology.ts";
import { citiesOf } from "../city/city.ts";
import { beliefOf } from "../belief/belief.ts";
import { cultureOf } from "../culture/culture.ts";
import { designsOf } from "../design/design.ts";
import { politiesOf } from "../polity/polity.ts";
import { warsOf } from "../war/war.ts";

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
} as const;

/** Whether a run is of homes standing (built, or rebuilt higher). */
const isHome = (what: number) => what === CHANGE.built || what === CHANGE.raised;

/**
 * A run of lots changed together: [what, first lot, end lot (exclusive), first year, last year,
 * level, design] — built and raised runs are of one level and one design (the year the land's
 * design was realized, -1 before it had one: a run ends where it changed). A run of several
 * years was changed lot by lot through them, in order (a fallen run from its top lot down).
 * No two runs share a lot: what stands on a lot is its run's.
 */
export type Change = [
  what: number,
  from: number,
  to: number,
  start: number,
  end: number,
  level: number,
  design: number,
];

/** One of a town's other buildings: its first lot, how many it takes, when begun and done, when it fell. */
export type Civic = {
  readonly kind: CivicKind;
  readonly at: number;
  readonly lots: number;
  readonly start: number;
  readonly end: number;
  fell: number | null;
};

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
  /** Runs of lots taken once and open again (fallen, razed, passed over), lowest first. */
  open: [number, number][];
  /** What it rebuilds to (its heart's level × 8 + its edge's), the lot its rebuilding has come to, and the lots it had when it last came to its edge (-1 while it is going over them). */
  aim: number;
  raise: number;
  passed: number;
  changes: Change[];
  civics: Civic[];
  walls: Walls | null;
  /** Years in a row it has had far more homes than people. */
  lean: number;
  /** The event of its forsaking, while every home of it is fallen. */
  forsaken: Ref | null;
};

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
};

/** Years a run must have stood untouched before it is history and may join the run it continues (a home takes at most three to raise). */
export const SETTLED = 4;
/** Years a ruin stands before it is weathered away (and a fallen building is let go). */
export const RUIN_YEARS = 60;
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
];

export class TownStore implements StateStore {
  readonly name = "town.fabric";
  private readonly map = new Map<string, Fabric>();
  /** (Each town's fabric by the settlement itself, for the year's walk over them: a cache, let go on loading.) */
  private readonly bySettlement = new Map<Settlement, Fabric>();
  /** Every change folded in as it is made, for the checkpoints: two lanes of the kernel's absorber. */
  private a = 0x2545f491 | 0;
  private b = 0x6a09e667 | 0;

  get(town: Ref): Fabric | undefined {
    return this.map.get(town);
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
    return { digest: [this.a, this.b], fabrics: this.all().map(pack) };
  }
  load(state: unknown): void {
    const s = state as { digest: [number, number]; fabrics: Saved[] };
    this.map.clear();
    this.bySettlement.clear();
    [this.a, this.b] = s.digest;
    for (const saved of s.fabrics) {
      const f = unpack(saved);
      this.map.set(f.town, f);
    }
  }
}

/** A fabric as saved (see Saved). */
function pack(f: Fabric): Saved {
  const designs: number[] = [],
    runs: number[] = [],
    civics: number[] = [],
    fallen: number[] = [];
  let to = 0,
    start = 0;
  for (const c of f.changes) {
    let d = designs.indexOf(c[6]);
    if (d < 0) d = designs.push(c[6]) - 1;
    runs.push(c[0], c[1] - to, c[2] - c[1], c[3] - start, c[4] - c[3], c[5], d);
    to = c[2];
    start = c[3];
  }
  let at = 0;
  start = 0;
  f.civics.forEach((c, i) => {
    civics.push(CIVIC_INDEX.get(c.kind)!, c.at - at, c.start - start);
    at = c.at;
    start = c.start;
    if (c.fell !== null) fallen.push(i, c.fell - c.start);
  });
  return [
    f.town,
    TOWN_FAMILIES.indexOf(f.family),
    f.next,
    f.aim,
    f.raise,
    f.passed,
    f.lean,
    f.forsaken,
    f.walls ? [f.walls.start, f.walls.end, f.walls.reach] : null,
    designs,
    runs,
    civics,
    fallen,
  ];
}

/** A fabric as it was saved, its homes and open lots read again from what stands. */
function unpack(s: Saved): Fabric {
  const [town, family, next, aim, raise, passed, lean, forsaken, walls, designs, runs] = s,
    packed = s[11],
    fallen = s[12],
    changes: Change[] = [],
    civics: Civic[] = [];
  let to = 0,
    start = 0;
  for (let i = 0; i < runs.length; i += 7) {
    const from = to + runs[i + 1]!,
      first = start + runs[i + 3]!;
    to = from + runs[i + 2]!;
    start = first;
    changes.push([
      runs[i]!,
      from,
      to,
      first,
      first + runs[i + 4]!,
      runs[i + 5]!,
      designs[runs[i + 6]!]!,
    ]);
  }
  let at = 0;
  start = 0;
  for (let i = 0; i < packed.length; i += 3) {
    const def = CIVICS[packed[i]!]!;
    at += packed[i + 1]!;
    start += packed[i + 2]!;
    civics.push({
      kind: def.kind,
      at,
      lots: CIVIC_LOTS[def.kind],
      start,
      end: start + def.years,
      fell: null,
    });
  }
  for (let i = 0; i < fallen.length; i += 2) {
    const c = civics[fallen[i]!]!;
    c.fell = c.start + fallen[i + 1]!;
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
  };
  // (Its homes at each level; open, every lot it has taken with no home on it and no
  // building standing on it.)
  const levels = levelsOf(f, 0, next),
    under = civicMask(f, 0, next);
  for (let p = 0; p < next; p++) {
    if (levels[p]! >= 0) f.homes[levels[p]!]!++;
    if (levels[p]! >= 0 || under[p]) continue;
    const last = f.open.at(-1);
    if (last && last[1] === p) last[1] = p + 1;
    else f.open.push([p, p + 1]);
  }
  return f;
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
  const out = new Int8Array(Math.max(0, to - from)).fill(-1);
  for (const [what, a, b, , , level] of f.changes) {
    if (!isHome(what)) continue;
    const lo = Math.max(a, from),
      hi = Math.min(b, to);
    for (let p = lo; p < hi; p++) out[p - from] = level;
  }
  for (const c of f.civics) {
    if (c.fell !== null) continue;
    const lo = Math.max(c.at, from),
      hi = Math.min(c.at + c.lots, to);
    for (let p = lo; p < hi; p++) out[p - from] = -1;
  }
  return out;
}

/** Which of lots [from, to) its standing buildings (other than homes) take, now: 1 where one does. */
export function civicMask(f: Fabric, from: number, to: number): Uint8Array {
  const out = new Uint8Array(Math.max(0, to - from));
  for (const c of f.civics) {
    if (c.fell !== null) continue;
    const lo = Math.max(c.at, from),
      hi = Math.min(c.at + c.lots, to);
    for (let p = lo; p < hi; p++) out[p - from] = 1;
  }
  return out;
}

/** The lots its standing buildings (other than homes) take, now. */
export function civicLots(f: Fabric): Set<number> {
  const out = new Set<number>();
  for (const c of f.civics) if (c.fell === null) for (let k = 0; k < c.lots; k++) out.add(c.at + k);
  return out;
}

/**
 * The level a town may rebuild its heart to: houses once its land farms; townhouses where it
 * builds in stone and the town is of some size; tenements in an industrial city; blocks in an
 * electric one; high-rises in a great city that reckons with machines.
 */
export function topLevel(k: (id: string) => boolean, people: number, city: boolean): number {
  if (city && people >= 50_000 && k("electronics")) return LEVEL.highRise;
  if (city && people >= 8000 && k("electricity|sea-electricity") && k("steel")) return LEVEL.block;
  if (city && people >= 2500 && k("steam-engine")) return LEVEL.tenement;
  if (people >= 1200 && k("masonry")) return LEVEL.townhouse;
  return k("cultivation") ? LEVEL.house : LEVEL.hut;
}

/** The level of homes at the edge of a town whose heart is built to `top`: houses, or townhouses in an industrial city. */
export function edgeLevel(top: number, city: boolean): number {
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

/** Where a building of `lots` lots may stand: at a lot its size divides (so a block's half is a half). */
const aligned = (p: number, lots: number) => Math.ceil(p / lots) * lots;

/** Whether runs a and b may be one: the same change, level and design, side by side. */
const joins = (a: Change, b: Change) =>
  a[0] === b[0] && a[5] === b[5] && a[6] === b[6] && (a[2] === b[1] || b[2] === a[1]);

/**
 * Whether runs of homes a and b, the one after the other with no run between, may be one across
 * the lots between them: the same change, level and design, and every lot between them a standing
 * building's (a building among a town's homes does not part them; should it fall, its lots are
 * cut out again).
 */
function across(f: Fabric, a: Change, b: Change): boolean {
  if (a[0] !== b[0] || a[5] !== b[5] || a[6] !== b[6] || b[1] <= a[2]) return false;
  return isHome(a[0]) && buildingsOnly(f, a[2], b[1]);
}

/** Whether every lot of [from, to) is a standing building's (building after building, from the first). */
function buildingsOnly(f: Fabric, from: number, to: number): boolean {
  for (let p = from; p < to;) {
    let next = p;
    for (const c of f.civics)
      if (c.fell === null && c.at <= p && c.at + c.lots > p) {
        next = c.at + c.lots;
        break;
      }
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
  constructor(ctx: PopulationContext, year: number) {
    this.ctx = ctx;
    this.year = year;
    this.store = townsOf(ctx.world);
  }

  /**
   * A change made: kept as the run of its lots, the runs it changes over let go where it covers
   * them, cut back where it covers an end, and parted where it falls within one.
   */
  change(f: Fabric, what: number, from: number, to: number, level: number, design: number): void {
    if (to <= from) return;
    const year = this.year,
      runs = f.changes;
    this.store.fold(f.town, FOLD.change, what, from, to, year, level, design);
    this.cut(f, from, to);
    // (Within a year: a run continued, as one.)
    const last = runs.at(-1),
      run: Change = [what, from, to, year, year, level, design];
    if (last && last[3] === year && last[4] === year && joins(last, run)) {
      last[1] = Math.min(last[1], from);
      last[2] = Math.max(last[2], to);
      return;
    }
    runs.push(run);
  }

  /** Lots [from, to) cut out of the runs over them: those it covers let go, an end cut back, one it falls within parted. */
  private cut(f: Fabric, from: number, to: number): void {
    const runs = f.changes;
    let w = 0,
      part: Change | null = null;
    for (let r = 0; r < runs.length; r++) {
      const c = runs[r]!;
      if (c[2] > from && c[1] < to) {
        if (c[1] >= from && c[2] <= to) continue;
        if (c[1] < from && c[2] > to) {
          part = [c[0], to, c[2], c[3], c[4], c[5], c[6]];
          c[2] = from;
        } else if (c[1] < from) c[2] = from;
        else c[1] = to;
      }
      runs[w++] = c;
    }
    runs.length = w;
    if (part) runs.push(part);
  }

  /**
   * A town's history settled, as each year begins: ruins weathered away (and buildings long
   * fallen let go); homes rebuilt long since are homes like any other; its runs in the
   * order of their lots, and those years-old joined to the run beside them of the same change,
   * level and design, or across lots only standing buildings take (the years within a joined
   * run let go).
   */
  settle(f: Fabric): void {
    const old = this.year - SETTLED,
      gone = this.year - RUIN_YEARS;
    let c = f.changes,
      due = false,
      weathered = false;
    // (Only a year a run comes to be history, or a ruin weathers away, changes anything here.)
    for (const b of c)
      if (b[4] === old) due = true;
      else if (!isHome(b[0]) && b[4] < gone) weathered = due = true;
    if (weathered) c = f.changes = c.filter((b) => isHome(b[0]) || b[4] >= gone);
    if (due) this.join(f, c, old);
    if (f.civics.some((x) => x.fell !== null && x.fell < gone))
      f.civics = f.civics.filter((x) => x.fell === null || x.fell >= gone);
  }

  /** Runs years-old joined, in the order of their lots (see settle). */
  private join(f: Fabric, c: Change[], old: number): void {
    for (const b of c) if (isHome(b[0]) && b[4] <= old) b[0] = CHANGE.built;
    c.sort((a, b) => a[1] - b[1]);
    let w = 0;
    for (let i = 0; i < c.length; i++) {
      const b = c[i]!,
        a = w > 0 ? c[w - 1]! : null;
      if (a && a[4] <= old && b[4] <= old && (joins(a, b) || across(f, a, b))) {
        a[2] = b[2];
        a[3] = Math.min(a[3], b[3]);
        a[4] = Math.max(a[4], b[4]);
        continue;
      }
      c[w++] = b;
    }
    c.length = w;
  }

  /** Take a lot for a home: the lowest open lot, else the next of the plan. */
  takeLot(f: Fabric): number {
    const run = f.open[0];
    if (run) {
      const p = run[0];
      if (++run[0] >= run[1]) f.open.shift();
      return p;
    }
    return f.next++;
  }

  /** Lots [from, to) open again. */
  release(f: Fabric, from: number, to: number): void {
    if (to <= from) return;
    f.open.push([from, to]);
    f.open.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const r of f.open) {
      const last = merged.at(-1);
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push([r[0], r[1]]);
    }
    f.open = merged;
  }

  /** Lots [from, to) taken out of the open runs, for a building to stand on. */
  claim(f: Fabric, from: number, to: number): void {
    const out: [number, number][] = [];
    for (const [a, b] of f.open) {
      if (b <= from || a >= to) out.push([a, b]);
      else {
        if (a < from) out.push([a, from]);
        if (b > to) out.push([to, b]);
      }
    }
    f.open = out;
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
  grow(f: Fabric, people: number, top: number, edge: number, design: number): void {
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
        levels = levelsOf(f, from, span),
        under = civicMask(f, from, span);
      let run = -1,
        level = -1,
        p = from;
      const done = (to: number) => {
        if (run >= 0) this.change(f, CHANGE.raised, run, to, level, design);
        run = -1;
      };
      for (; p < span && room > 0 && hands > 0; p++) {
        const was = levels[p - from]!,
          to = lotLevel(p, n, top, edge);
        if (was < 0 || was >= to || under[p - from]) {
          done(p);
          continue;
        }
        if (run >= 0 && to !== level) done(p);
        if (run < 0) {
          run = p;
          level = to;
        }
        f.homes[was]!--;
        f.homes[to]!++;
        room -= HOLDS[to]! - HOLDS[was]!;
        hands -= HOLDS[to]!;
      }
      done(p);
      f.raise = p;
      if (p >= n) f.passed = n;
    }
    // New homes: on open lots first (the lowest), then at the edge.
    let run = -1,
      level = -1,
      at = -1;
    while (room > 0 && hands > 0) {
      const p = this.takeLot(f),
        to = lotLevel(p, n, top, edge);
      if (run >= 0 && (p !== at + 1 || to !== level)) {
        this.change(f, CHANGE.built, run, at + 1, level, design);
        run = -1;
      }
      if (run < 0) {
        run = p;
        level = to;
      }
      at = p;
      f.homes[to]!++;
      room -= HOLDS[to]!;
      hands -= HOLDS[to]!;
    }
    if (run >= 0) this.change(f, CHANGE.built, run, at + 1, level, design);
  }

  /** Homes let fall from the edge, a few a year, where the town has long had far more than it needs. */
  shrink(f: Fabric, people: number): void {
    const housing = housingOf(f);
    if (housing === 0 || housing <= people / 0.6) {
      f.lean = 0;
      return;
    }
    if (++f.lean < 3) return;
    let excess = housing - Math.ceil(people / 0.8),
      count = Math.max(1, Math.ceil(homesOf(f) * 0.05)),
      top = -1;
    const from = Math.max(0, f.next - 512),
      levels = levelsOf(f, from, f.next),
      under = civicMask(f, from, f.next),
      fall = (lo: number) => {
        if (top < 0) return;
        this.change(f, CHANGE.fell, lo, top + 1, 0, 0);
        this.release(f, lo, top + 1);
        top = -1;
      };
    for (let p = f.next - 1; p >= from && excess > 0 && count > 0; p--) {
      const was = levels[p - from]!;
      if (was < 0 || under[p - from]) {
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
  raze(f: Fabric, share: number, edge: boolean): number {
    const levels = levelsOf(f, 0, f.next),
      under = civicMask(f, 0, f.next),
      standing: number[] = [];
    for (let p = 0; p < f.next; p++) if (levels[p]! >= 0 && !under[p]) standing.push(p);
    const n = Math.min(standing.length, Math.ceil(standing.length * share)),
      down = edge ? standing.slice(-n) : standing.slice(0, n);
    let run = -1,
      at = -1;
    const done = () => {
      if (run < 0) return;
      this.change(f, CHANGE.razed, run, at + 1, 0, 0);
      this.release(f, run, at + 1);
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

  /** A building gone: fallen out of use or taken the place of, its lots open again. */
  private fall(f: Fabric, c: Civic, why: number): void {
    c.fell = this.year;
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
    // What stands of each kind (what took a building's place stands for it: a temple is the
    // town's shrine), and what is rising; one fallen out of use a year, its town emptied to
    // below a third of what it asks.
    HAVE.fill(0);
    RISING.fill(0);
    let emptied = false;
    for (const c of f.civics) {
      if (c.fell !== null) continue;
      const def = civic(c.kind);
      if (!emptied && c.end <= this.year && people < Math.max(30, def.people) / 3) {
        this.fall(f, c, FOLD.fell);
        emptied = true;
        continue;
      }
      const i = CIVIC_INDEX.get(c.kind)!;
      HAVE[i]!++;
      if (c.end > this.year) RISING[i] = 1;
      if (def.replaces) HAVE[CIVIC_INDEX.get(def.replaces)!]!++;
    }
    let begun = 0;
    for (let i = 0; i < CIVICS.length && begun < (city ? 2 : 1); i++) {
      const def = CIVICS[i]!;
      if (people < def.people || (def.market && !s.market) || (def.city && !city)) continue;
      const want = def.per
        ? Math.max(1, Math.min(def.most ?? 99, Math.floor(people / def.per)))
        : 1;
      if (HAVE[i]! >= want || RISING[i]) continue;
      if ((def.faith && !faith()) || (def.water && !water()) || !needsMet(def, k)) continue;
      // (What it takes the place of comes down first: it may rise where that stood.)
      const old = def.replaces
        ? f.civics.find((c) => c.fell === null && c.kind === def.replaces)
        : undefined;
      if (old) this.fall(f, old, FOLD.replaced);
      const lots = CIVIC_LOTS[def.kind],
        at = this.siteFor(f, lots, def.place);
      this.clearFor(f, at, lots);
      f.civics.push({
        kind: def.kind,
        at,
        lots,
        start: this.year,
        end: this.year + def.years,
        fell: null,
      });
      this.store.fold(f.town, FOLD.begun, i, at, this.year);
      begun++;
      // (A temple raised is told: its town's faith in stone.)
      if (def.kind === "temple") {
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

  /** Where a building of `lots` lots goes: about the square (the innermost lots no other building has), or at the edge. */
  siteFor(f: Fabric, lots: number, place: "core" | "edge"): number {
    if (place === "core") {
      const under = civicMask(f, 0, f.next);
      for (let p = 0; p < f.next; p += lots) {
        let free = true;
        for (let q = p; q < Math.min(p + lots, f.next) && free; q++) free = !under[q];
        if (free) return p;
      }
    }
    return aligned(f.next, lots);
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

/** Scratch for a town's buildings by kind: how many stand, whether one is rising. */
const HAVE = new Int32Array(CIVICS.length),
  RISING = new Uint8Array(CIVICS.length);

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
    changes: [],
    civics: [],
    walls: null,
    lean: 0,
    forsaken: null,
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
 * The towns' year: each housed as its people ask and its hands allow; and, one year in
 * CIVIC_EVERY (each town in its own, and in its first), its other buildings weighed and its
 * walls.
 */
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
  for (const w of warsOf(world).all())
    for (let i = w.battles.length - 1; i >= 0; i--) {
      const b = w.battles[i]!;
      if (b.year < year - 30) break;
      fought.add(b.land);
      const fallen = b.fallen[0] + b.fallen[1];
      if (b.year === year - 1 && b.won && fallen >= 100)
        sacked.set(b.land, (sacked.get(b.land) ?? 0) + fallen);
    }
  for (const s of ctx.settlements.all()) {
    let f = store.of(s);
    if (!f) {
      if (s.population <= 0) continue;
      f = found(ctx, s);
    }
    const cell = s.cell,
      k = (id: string) =>
        id.includes("|") ? id.split("|").some((x) => knows(ctx, cell, x)) : knows(ctx, cell, id),
      city = !!cities.get(s.ref),
      people = s.population,
      weighs = f.next === 0 || (year + f.phase) % CIVIC_EVERY === 0;
    builder.settle(f);
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
      builder.grow(f, people, top, edgeLevel(top, city), designSince(ctx, cell));
    } else builder.shrink(f, people);
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

/** Raze a share of a town's homes, the heart first (a fire, a quake, fire from the sky): how many came down. */
export function razeTown(ctx: PopulationContext, town: Ref, share: number, t: SimTime): number {
  const f = townsOf(ctx.world).get(town);
  return f ? new TownBuilder(ctx, yearOfMoment(t)).raze(f, share, false) : 0;
}

/** Teach a peopled world its towns' fabric. */
export function installTowns(world: World, ctx: () => PopulationContext): TownStore {
  const store = world.register(new TownStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "191.town.year", every: YEAR, run: (t) => townYear(ctx(), t) });
  return store;
}
