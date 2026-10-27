// A town's people by line (Phase 55 M225): one of every LINE of its people kept by name, the holder
// of a line, each for a natural term (the young taking it after the old), and what history did to
// them. Its battles levied them by twelves of the men its tally sent: the eligible men of its lines,
// the same men to every call of a war while they live, and the fallen and the wounded among them.
// A fire or a quake killed or hurt some of them, counted from the year after. A fallen holder's line
// stands empty a year or a few, then another takes it. It is read from the battle record (the town's
// tally of its men, M224) and the strikes history tells, never drawn, so looking moves nothing, and
// names are given only when asked for. The fold keeps each levy as its lines and their fates, and
// the deaths on each line; a holder, and a battle's men, are made from them only when asked for, so
// a great city's roster stays small however many men its battles took.
import {
  YEAR,
  finish,
  hashString,
  mix,
  yearOfMoment,
  type Ref,
  type World,
} from "../kernel/index.ts";
import {
  cradleTongue,
  personName,
  tongueName,
  tonguePersonName,
  type Tongue,
} from "../gen/index.ts";
import { OCC, STRIKE_HURT, bandOf, type LandFell, type LifeHistory } from "../rules/index.ts";
import {
  DISASTER_EVENTS,
  LOCAL_ACT_EVENTS,
  cultureOf,
  fighting,
  populationContext,
  warsOf,
  type Battle,
  type PopulationContext,
  type War,
} from "../sim/index.ts";
import { townsfolkRef } from "../bridge/index.ts";

/** People a line stands for: one of every LINE of a town's people is kept by name. */
export const LINE = 12;
/** A natural holder's years at a line, upright apes (× the people's span / 70). */
export const TERM = 30;
/** A fallen holder's line stands empty 1 … EMPTY_MOST years. */
export const EMPTY_MOST = 4;
/** The battles and strikes folded: those of the years since the world's year less these (their town tallies kept). */
export const ROSTER_YEARS = 39;

/**
 * The longest term, for the longest-lived peoples. A holder who fell leaves his natural term well
 * before the record lets his battle's towns go, so no roster built without that battle brings him
 * back.
 */
const TERM_MOST = 36;
/** Holders numbered to a term: its natural holder and the replacements after him. */
export const PER_TERM = 16;
/** Rosters kept for a world before the least lately asked for are let go. */
const ROSTERS_MOST = 4096;
/**
 * What a world's rosters may keep, in bytes as reckoned (roughly), before the least lately asked
 * for are let go.
 */
const ROSTER_BYTES = 96 * 1024 * 1024;

export type Fate = "stood" | "hurt" | "maimed" | "fell";
/** A battle a holder was levied for, and how he came home, or did not. */
export type HolderFate = {
  readonly event: string;
  readonly war: string;
  readonly side: 0 | 1;
  readonly year: number;
  readonly land: number;
  readonly fate: Fate;
};
/** What a fire sent on the town, or a quake or a fire from the sky on its land, did to a holder. */
export type StrikeFate = {
  readonly event: string;
  readonly kind: "fire" | "quake" | "meteor";
  readonly year: number;
  readonly fate: "died" | "hurt";
};
/** One who held a town's line. */
export type Holder = {
  /** Their page: `folk:<town>:<line>:<n>`. */
  readonly ref: string;
  readonly line: number;
  /** τ·16 + r + 1: their term τ, and r the replacements before them in it (at most 15). */
  readonly n: number;
  readonly key: number;
  /** 1: a man. */
  readonly sex: 0 | 1;
  readonly born: number;
  /** The year they took the line. */
  readonly from: number;
  /** The year they ceased to hold it: their term's end, or the year after their death. */
  readonly end: number;
  /** Their battles in the window, oldest first. */
  readonly fates: readonly HolderFate[];
  readonly struck: readonly StrikeFate[];
  /** The year they fell or a strike killed them (null: none). */
  readonly died: number | null;
};
export type RosterMan = { readonly line: number; readonly holder: Holder; readonly fate: Fate };
/** A battle the town sent men to, as its lines tell it. */
export type RosterBattle = {
  readonly event: string;
  readonly war: string;
  readonly side: 0 | 1;
  readonly year: number;
  readonly land: number;
  /** The town's men in it, as the record tells them: sent, fallen, wounded who lived. */
  readonly tally: readonly [number, number, number];
  /** Its lines that day, and how many of them held a man grown and of fighting age. */
  readonly lines: number;
  readonly eligible: number;
  /** The levied, by line. */
  readonly men: readonly RosterMan[];
};
/** A fire or a quake as the town's lines tell it: its dead among the town, the lines it fell on. */
export type RosterStrike = {
  readonly event: string;
  readonly kind: "fire" | "quake" | "meteor";
  readonly year: number;
  readonly dead: number;
  readonly lines: number;
  readonly men: readonly {
    readonly line: number;
    readonly holder: Holder;
    readonly fate: "died" | "hurt";
  }[];
};
export type Roster = {
  readonly town: string;
  readonly year: number;
  /** The line's holder in the roster's year (null: it stands empty, its holder dead lately). */
  holder(line: number): Holder | null;
  /** A holder by line and number: any met in the fold (the dead too), else a natural holder (r = 0); null: none. */
  holderOf(line: number, n: number): Holder | null;
  /** Oldest first. */
  readonly battles: readonly RosterBattle[];
  battle(event: string): RosterBattle | null;
  /** Oldest first. */
  readonly strikes: readonly RosterStrike[];
  /** Their name in the land's tongue (memoized). */
  nameOf(h: Holder): string;
};
/** The work a land's people do (forager … leader), and how many of them do each. */
export type FolkWork = {
  readonly kinds: readonly number[];
  readonly counts: readonly number[];
  readonly total: number;
};

const u = (seed: number, n: number) => finish(mix(seed, n), 13) / 4294967296;

/** x rounded down, or up by a keyed chance of its fraction: on average x, the same each time. */
function keyedRound(x: number, h: number): number {
  const whole = Math.floor(x);
  return whole + (u(h, 7) < x - whole ? 1 : 0);
}

/**
 * A town's lines in a battle's levy, before its eligible lines bound them: by twelves of the men it
 * sent, of those who fell, and of those who came home hurt, each rounded by its own keyed chance
 * (the roll's skip asks the same, so the two cannot part).
 */
export const levyLinesOf = (event: string, town: string, sent: number): number =>
  keyedRound(sent / LINE, hashString(`levy ${event} ${town}`));
export const fellLinesOf = (event: string, town: string, dead: number): number =>
  keyedRound(dead / LINE, hashString(`fell ${event} ${town}`));
export const hurtLinesOf = (event: string, town: string, hurt: number): number =>
  keyedRound(hurt / LINE, hashString(`hurt ${event} ${town}`));

/**
 * How a people's lines are held: its span (the lower edge of its last band), a natural term at a
 * line (TERM for the span of upright apes, scaled by span, 4 … TERM_MOST years), and the youngest
 * to take one.
 */
export function lineShape(life: LifeHistory): { span: number; term: number; youngest: number } {
  const span = life.bands.at(-1)!;
  return {
    span,
    term: Math.min(TERM_MOST, Math.max(4, Math.round((TERM * span) / 70))),
    youngest: Math.max(1, Math.round((4 * span) / 70)),
  };
}

/** The land's work mix, as today's folk loop reads it (forager … leader). */
export function folkWork(world: World, cell: number): FolkWork {
  const land = populationContext(world).provinces.get(cell),
    kinds = [OCC.forager, OCC.farmer, OCC.herder, OCC.crafter, OCC.trader, OCC.leader],
    counts = kinds.map((o) => land?.occupation(o) ?? 0);
  return { kinds, counts, total: counts.reduce((a, b) => a + b, 0) };
}

/**
 * The name of the family to every four of a town's lines, as four folk share a home, in its land's
 * family names' tongue (Phase 55 wave 5: their kin bear it too).
 */
export function houseName(family: Tongue, town: string, line: number): string {
  return tongueName(
    { ...family, seed: family.seed ^ 0xf00d },
    hashString(`${town} line ${Math.floor(line / 4)}`),
  );
}

/** A grown holder's work by their key: u(key, 2) over the mix (a farmer where it has none). */
export function workOf(key: number, work: FolkWork): number {
  if (work.total > 0) {
    let pick = u(key, 2) * work.total;
    for (let j = 0; j < work.kinds.length; j++) {
      pick -= work.counts[j]!;
      if (pick < 0) return work.kinds[j]!;
    }
  }
  return OCC.farmer;
}

// ---- What the fold reads: every battle by the land it drew on, every strike by where it fell ----

/** A battle side's tally for a land: its war, its index there, the side, the land's index, its year. */
type Entry = readonly [war: War, k: number, side: 0 | 1, j: number, year: number];
type WindowIndex = {
  readonly wars: readonly War[];
  readonly count: number;
  readonly byCell: ReadonlyMap<number, readonly Entry[]>;
};
const WINDOWS = new WeakMap<World, WindowIndex>();

/**
 * Every battle of record by the lands that sent men to it, rebuilt when one is fought (or the wars
 * are loaded anew). The battle itself is read fresh from its war at use, since its towns may since
 * have been let go.
 */
function windowOf(world: World): WindowIndex {
  const wars = warsOf(world).all();
  let count = 0;
  for (const w of wars) count += w.battles.length;
  const known = WINDOWS.get(world);
  if (known && known.wars === wars && known.count === count) return known;
  const byCell = new Map<number, Entry[]>();
  for (const war of wars)
    war.battles.forEach((b, k) => {
      for (const side of [0, 1] as const)
        b.fell?.[side].forEach((land, j) => {
          // (A land whose towns are let go folds into no roster.)
          if (land[4] === undefined) return;
          const entry: Entry = [war, k, side, j, b.year],
            at = byCell.get(land[0]);
          if (at) at.push(entry);
          else byCell.set(land[0], [entry]);
        });
    });
  const built: WindowIndex = { wars, count, byCell };
  WINDOWS.set(world, built);
  return built;
}

type StrikeKind = StrikeFate["kind"];
/** A strike as history tells it, and the dead it told (a fire its town's, a quake or a fire from the sky its land's). */
type Struck = {
  readonly event: string;
  readonly t: number;
  readonly kind: StrikeKind;
  readonly told: number;
};
/** Fires by the town they were sent on, quakes and fires from the sky by their land's ref. */
type StrikeIndex = {
  readonly fires: ReadonlyMap<string, readonly Struck[]>;
  readonly lands: ReadonlyMap<string, readonly Struck[]>;
};

/** What a world's rosters keep, for the world's year it was made in. */
type Caches = {
  readonly cleared: number;
  readonly year: number;
  now: number;
  readonly ctx: PopulationContext;
  /** By town and year, the least lately asked for first. */
  readonly rosters: Map<string, Roster>;
  /** What they keep, as reckoned. */
  bytes: number;
  strikes: StrikeIndex | null;
  /** The battles by land, as found current at `now` (null: not yet looked at since). */
  window: WindowIndex | null;
};
const CACHES = new WeakMap<World, Caches>();
/** Bumped by clearRosters: every world's caches made before are let go. */
let cleared = 0;

/**
 * A world's caches, made anew when its year turns (the window moves on, and with it what every
 * roster folds), when it goes back, and after clearRosters.
 */
function cachesOf(world: World): Caches {
  const year = Math.floor(world.now / YEAR);
  let c = CACHES.get(world);
  if (!c || c.cleared !== cleared || c.year !== year || world.now < c.now) {
    c = {
      cleared,
      year,
      now: world.now,
      ctx: populationContext(world),
      rosters: new Map(),
      bytes: 0,
      strikes: null,
      window: null,
    };
    CACHES.set(world, c);
  } else if (c.now !== world.now) {
    // (A battle is fought only as the world moves on.)
    c.now = world.now;
    c.window = null;
  }
  return c;
}

/** Every strike history still tells, read once a year (as host/town.ts strikesOn reads them). */
function strikesOf(world: World, c: Caches): StrikeIndex {
  if (c.strikes) return c.strikes;
  const fires = new Map<string, Struck[]>(),
    lands = new Map<string, Struck[]>(),
    add = (into: Map<string, Struck[]>, at: string, s: Struck) => {
      const list = into.get(at);
      if (list) list.push(s);
      else into.set(at, [s]);
    };
  for (const e of world.events.all()) {
    const kind: StrikeKind | null =
      e.type === LOCAL_ACT_EVENTS.fire.type
        ? "fire"
        : e.type === DISASTER_EVENTS.quake.type
          ? "quake"
          : e.type === DISASTER_EVENTS.meteor.type
            ? "meteor"
            : null;
    if (!kind) continue;
    const told = (e.data as { dead?: unknown } | null)?.dead,
      s: Struck = { event: e.id, t: e.t, kind, told: typeof told === "number" ? told : 0 };
    if (kind === "fire") {
      if (e.subjects[0] !== undefined) add(fires, e.subjects[0], s);
    } else if (e.place !== null) add(lands, e.place, s);
  }
  return (c.strikes = { fires, lands });
}

/**
 * A town's roster in `year` (default: Math.floor(world.now / YEAR)): cached by town and year while
 * the world's year runs (a year to come is folded afresh each time), the least lately asked for let
 * go first when the world's rosters grow past what they may keep.
 */
export function townRoster(world: World, town: string, year?: number): Roster {
  const c = cachesOf(world),
    y = year === undefined ? c.year : Math.floor(year),
    key = `${town}|${y}`,
    known = c.rosters.get(key);
  if (known) {
    // (Asked for again: the last to be let go.)
    c.rosters.delete(key);
    c.rosters.set(key, known);
    return known;
  }
  const made = foldRoster(world, town, y, null, c);
  // (A year to come is never kept: its battles are not yet fought.)
  if (y <= c.year) {
    const kept = INNER.get(made)!;
    c.rosters.set(key, made);
    kept.into = c;
    c.bytes += kept.bytes;
    for (const [k, r] of c.rosters) {
      if (c.bytes <= ROSTER_BYTES && c.rosters.size <= ROSTERS_MOST) break;
      if (r === made) break;
      const gone = INNER.get(r)!;
      c.rosters.delete(k);
      c.bytes -= gone.bytes;
      gone.into = null;
    }
  }
  return made;
}

/** The same, folding these battles (no cache; tests pass stripped battles for old saves). */
export function rosterOf(
  world: World,
  town: string,
  year: number,
  fought: readonly { readonly war: War; readonly b: Battle }[],
): Roster {
  return foldRoster(world, town, Math.floor(year), fought, cachesOf(world));
}

/** Let every roster go, and the strikes they were read from (not the battles by land). */
export function clearRosters(): void {
  cleared++;
}

/** What a fold asks beyond its lines, in rosterCost's lines. */
const FOLD_COST = 100;

/**
 * What folding a town's roster to `year` asks, reckoned in lines levied (each some two hundred
 * nanoseconds on the desk, as measured): a line for every twelve men its window's battles before
 * that year took (each found among those not eligible, then given its fate); half the lines its
 * levies look at, four for each levied, at most all of them (each seen once, its holders' keys
 * hashed); a thirty-second of its lines for each battle (each line's key in its war's order) and a
 * twentieth for each strike (a chance rolled for each line); and FOLD_COST more. Read from the
 * record alone, so the same whatever has been folded (the roll bounds its rosters by it).
 */
export function rosterCost(world: World, town: string, year: number): number {
  const c = cachesOf(world),
    ctx = c.ctx,
    s = ctx.settlements.get(town as Ref);
  if (!s) return 0;
  const idx = ctx.settlements.inProvince(s.cell).findIndex((x) => x.ref === s.ref),
    first = c.year - ROSTER_YEARS,
    y = Math.floor(year),
    lines = Math.ceil(Math.max(0, s.population) / LINE);
  let sent = 0,
    battles = 0;
  for (const [war, k, side, j, at] of (c.window ??= windowOf(world)).byCell.get(s.cell) ?? []) {
    if (at < first || at >= y) continue;
    const towns = war.battles[k]?.fell?.[side]?.[j]?.[4];
    if (towns && 3 * idx + 2 < towns.length && towns[3 * idx]! > 0) {
      sent += towns[3 * idx]!;
      battles++;
    }
  }
  // (Its strikes as the fold counts them: a fire its town's dead, a quake its share of its land's.)
  const index = strikesOf(world, c),
    land = ctx.provinces.get(s.cell),
    all = land?.total() ?? 0,
    share = all > 0 ? Math.min(1, s.population / all) : 0;
  let strikes = 0;
  for (const list of [index.fires.get(town), land && index.lands.get(land.ref)])
    for (const e of list ?? []) {
      const at = yearOfMoment(e.t),
        dead = e.kind === "fire" ? e.told : Math.round(e.told * share);
      if (at >= first && at < y && dead > 0) strikes++;
    }
  const levied = Math.ceil(sent / LINE);
  return (
    levied +
    Math.ceil(Math.min(lines, 4 * levied) / 2) +
    Math.ceil((lines * battles) / 32) +
    strikes * Math.ceil(lines / 20) +
    FOLD_COST
  );
}

/**
 * A town's men of one of its battles, the first of each lot by line — 0 the fallen, 1 the wounded
 * who lived (the maimed among them), 2 the rest — no more of each than `most` asks: only those are
 * made (a roll names a few of a great levy). Empty: no such battle in the roster.
 */
export function levyHead(
  roster: Roster,
  event: string,
  side: 0 | 1,
  most: readonly [number, number, number],
): [RosterMan[], RosterMan[], RosterMan[]] {
  return INNER.get(roster)?.head(event, side, most) ?? [[], [], []];
}

// ---- The fold ----

/** What the roster keeps beside what it hands out, and what that is reckoned to weigh. */
type Inner = {
  bytes: number;
  /** The caches it is kept in (null: none, or let go). */
  into: Caches | null;
  head(
    event: string,
    side: 0 | 1,
    most: readonly [number, number, number],
  ): [RosterMan[], RosterMan[], RosterMan[]];
};
const INNER = new WeakMap<Roster, Inner>();

// (Most holders are never levied nor struck: they share these until they are.)
const NO_FATES: readonly HolderFate[] = Object.freeze([]),
  NO_STRIKES: readonly StrikeFate[] = Object.freeze([]);
/** A line's place in a packed order key: the key above, the line below (lines are fewer). */
const SLOT = 2097152;
/** No term found yet (no term is numbered so low). */
const NO_TERM = -2147483648;
/** A levied man's fate as the fold keeps it. */
const STOOD = 0,
  HURT = 1,
  MAIMED = 2,
  FELL = 3;
const FATES: readonly Fate[] = ["stood", "hurt", "maimed", "fell"];
/** The lot a fate is told in: 0 the fallen, 1 the wounded (the maimed among them), 2 the rest. */
const LOT: readonly (0 | 1 | 2)[] = [2, 1, 1, 0];
/** A struck holder's fate as the fold keeps it. */
const DIED = 0;
const STRUCK: readonly ("died" | "hurt")[] = ["died", "hurt"];
const NO_LINES = new Int32Array(0),
  NO_CODES = new Uint8Array(0);

// The fold's scratch, one fold at a time (a fold asks nothing that folds another): each line's
// phase, and its key's hash as far as its number (see lineState); the holder of its term as last
// found where no one has died on it — its term, its key, and the years it is a man grown and of
// fighting age, from … to (none: a woman); whether someone has died on it; and the order of a
// levy's fates, packed SLOT · key + place.
let phis = new Int32Array(0),
  lineHs = new Int32Array(0),
  lineNs = new Uint8Array(0),
  natTau = new Int32Array(0),
  natKey = new Uint32Array(0),
  natFrom = new Int32Array(0),
  natTo = new Int32Array(0),
  mourned = new Uint8Array(0),
  fated = new Float64Array(64);

/**
 * Room in the scratch for `n` lines, each line's phase and term not yet found and none mourned,
 * and no line yet looked at by a levy.
 */
function scratch(n: number): void {
  if (n > phis.length) {
    const size = Math.max(n, 2 * phis.length, 64);
    phis = new Int32Array(size);
    lineHs = new Int32Array(size);
    lineNs = new Uint8Array(size);
    natTau = new Int32Array(size);
    natKey = new Uint32Array(size);
    natFrom = new Int32Array(size);
    natTo = new Int32Array(size);
    mourned = new Uint8Array(size);
  }
  phis.fill(-1, 0, n);
  natTau.fill(NO_TERM, 0, n);
  mourned.fill(0, 0, n);
  looked = fitting = 0;
}

/** Put the `m` least of a[lo … lo + n) first, in no order (Hoare's selection: the keys are distinct). */
function selectLeast(a: Float64Array, lo: number, n: number, m: number): void {
  const k = lo + m - 1;
  let hi = lo + n - 1;
  while (lo < hi) {
    const x = a[lo]!,
      y = a[(lo + hi) >>> 1]!,
      z = a[hi]!,
      pivot = x < y ? (y < z ? y : x < z ? z : x) : x < z ? x : y < z ? z : y;
    let i = lo,
      j = hi;
    while (i <= j) {
      while (a[i]! < pivot) i++;
      while (a[j]! > pivot) j--;
      if (i <= j) {
        const t = a[i]!;
        a[i++] = a[j]!;
        a[j--] = t;
      }
    }
    if (k <= j) hi = j;
    else if (k >= i) lo = i;
    else return;
  }
}

/** Whether a sorted list of lines holds line k: its place, or −1. */
function placeOf(lines: Int32Array, k: number): number {
  let lo = 0,
    hi = lines.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1,
      x = lines[mid]!;
    if (x < k) lo = mid + 1;
    else if (x > k) hi = mid - 1;
    else return mid;
  }
  return -1;
}

/**
 * The ages a people's holder is grown and of fighting age, from … to (sim's rule: from the first
 * band that fights at or past coming of age to the first that no longer does), by its life.
 */
const FIT = new WeakMap<LifeHistory, readonly [number, number]>();
function fitOf(life: LifeHistory): readonly [number, number] {
  let fit = FIT.get(life);
  if (!fit) {
    const fits = (age: number) => age >= life.adulthood && fighting(life, bandOf(age, life));
    let from = 0;
    // (No holder lives past the people's span.)
    while (from <= life.bands.at(-1)! && !fits(from)) from++;
    let to = from;
    while (fits(to)) to++;
    FIT.set(life, (fit = [from, to]));
  }
  return fit;
}

/**
 * A death on a line: its year, the term and replacement of the one who died, how long the line
 * stands empty, and the step of the fold it fell in.
 */
type Death = {
  readonly year: number;
  readonly term: number;
  readonly r: number;
  readonly empty: number;
  readonly step: number;
};
/** One of the window's happenings to the town, in time order, and the lines it looks at. */
type Step =
  | {
      readonly t: number;
      readonly event: string;
      readonly seq: number;
      readonly count: number;
      readonly war: War;
      readonly b: Battle;
      readonly side: 0 | 1;
      readonly land: LandFell;
      readonly tally: readonly [number, number, number];
      /** Its lines in the levy before its eligible lines bound them (levyLinesOf). */
      readonly target: number;
    }
  | {
      readonly t: number;
      readonly event: string;
      readonly seq: number;
      readonly count: number;
      readonly strike: Struck;
      readonly dead: number;
    };
/** A battle or a strike as the fold keeps it: the lines it fell on, by line, and what it did. */
type Kept = {
  readonly year: number;
  readonly lines: Int32Array;
  readonly fates: Uint8Array;
};
type KeptBattle = Kept & { readonly told: RosterBattle };
type KeptStrike = Kept & { readonly told: RosterStrike };

const numberOf = (term: number, r: number) => term * PER_TERM + Math.min(r, PER_TERM - 1) + 1;

/** The characters a line's key is fed past its prefix (see prefixOf). */
const CHARS = new Int32Array(48);
/** Put x's decimal digits (x whole, 0 … 2³¹ − 1) at CHARS[at …]: where they end. */
function digitsAt(x: number, at: number): number {
  let end = at + 1;
  for (let p = 10; p <= x; p *= 10) end++;
  for (let i = end - 1; i >= at; i--) {
    const y = (x / 10) | 0;
    CHARS[i] = 48 + x - 10 * y;
    x = y;
  }
  return end;
}

/**
 * A town's keys, hashString(`folk <town> <line>`) and hashString(`folk <town> <line> <n>`), as
 * kernel/hash.ts reckons them, exactly: the words of the prefix absorbed once (its last character,
 * where odd, pairs with the first of the rest), then a line's digits, then a holder's number.
 */
type Prefix = {
  readonly even: number;
  readonly odd: number;
  readonly start: number;
  readonly words: number;
};
function prefixOf(prefix: string): Prefix {
  const even = prefix.length - (prefix.length % 2);
  let start = 0,
    words = 0;
  for (let i = 0; i < even; i += 2) {
    start = mix(start, prefix.charCodeAt(i) | (prefix.charCodeAt(i + 1) << 16));
    words++;
  }
  return { even, odd: even < prefix.length ? prefix.charCodeAt(even) : -1, start, words };
}

// (A line's state, as lineState leaves it: the hash of its whole words, and the characters fed
// after the prefix's words — the last left over where they are odd, the last of its digits.)
let stateH = 0,
  stateN = 0;
function lineState(p: Prefix, k: number): void {
  let n = 0;
  if (p.odd >= 0) CHARS[n++] = p.odd;
  n = digitsAt(k, n);
  let h = p.start;
  for (let i = 0; i + 1 < n; i += 2) h = mix(h, CHARS[i]! | (CHARS[i + 1]! << 16));
  stateH = h;
  stateN = n;
}
/** hashString(`folk <town> <line>`), from the line's state. */
function lineKey(p: Prefix, h: number, n: number, k: number): number {
  let w = p.words + (n >> 1);
  if ((n & 1) === 1) {
    h = mix(h, 48 + (k % 10));
    w++;
  }
  return finish(mix(h, p.even + n), w + 1);
}
/** hashString(`folk <town> <line> <n>`), from the line's state. */
function holderKey(p: Prefix, h: number, n: number, k: number, number: number): number {
  let w = p.words + (n >> 1),
    m = 0;
  if ((n & 1) === 1) CHARS[m++] = 48 + (k % 10);
  CHARS[m++] = 32;
  m = digitsAt(number, m);
  for (let i = 0; i < m; i += 2) {
    h = mix(h, CHARS[i]! | ((i + 1 < m ? CHARS[i + 1]! : 0) << 16));
    w++;
  }
  return finish(mix(h, p.even + n + m - (n & 1)), w + 1);
}
/** A town's keys asked for one at a time (not in the fold's loops). */
function keysOf(p: Prefix): (k: number, n?: number) => number {
  return (k, n) => {
    lineState(p, k);
    return n === undefined ? lineKey(p, stateH, stateN, k) : holderKey(p, stateH, stateN, k, n);
  };
}

/**
 * What the fold's loops read of a town and its people: its keys' prefix, the term, the youngest to
 * take a line and the spread of ages past that, and the ages grown and of fighting age, from … to.
 */
type Shape = {
  readonly pre: Prefix;
  readonly term: number;
  readonly youngest: number;
  readonly spread: number;
  readonly fitFrom: number;
  readonly fitTo: number;
};

/**
 * A holder's age on taking a line, by their key (young-skewed: most as children or in their prime,
 * a few late).
 */
function tookAt(s: Shape, key: number): number {
  const v = u(key, 3);
  return s.youngest + Math.floor(s.spread * v * v);
}

/**
 * Line k's holder of term τ where no one has died on it, as the scratch keeps them: their key, and
 * the years they are a man grown and of fighting age (none: a woman). The line seen.
 */
function natural(s: Shape, k: number, tau: number, phi: number): void {
  const key = holderKey(s.pre, lineHs[k]!, lineNs[k]!, k, numberOf(tau, 0));
  natTau[k] = tau;
  natKey[k] = key;
  if (((key >>> 5) & 1) === 1) {
    const born = tau * s.term - phi - tookAt(s, key);
    natFrom[k] = born + s.fitFrom;
    natTo[k] = born + s.fitTo;
  } else natFrom[k] = natTo[k] = 0;
}

/** Line k seen in the fold: its key's hash as far as its number, and its phase, in the scratch. */
function seenLine(s: Shape, k: number): number {
  lineState(s.pre, k);
  lineHs[k] = stateH;
  lineNs[k] = stateN;
  return (phis[k] = lineKey(s.pre, stateH, stateN, k) % s.term);
}

/** Every key a levy's order is by (finish's 32 bits). */
const KEYS = 4294967296;

// (What a levy looks at, as levyOf leaves it, one fold at a time: the eligible lines it found, by
// line, and their keys in its war's order; how many lines were eligible, where it looked at every
// one (−1: it did not); and the lines the fold's levies have looked at, and found eligible.)
let levied = new Int32Array(64),
  levyKeys = new Uint32Array(64),
  packed = new Float64Array(64),
  everyFit = -1,
  looked = 0,
  fitting = 0;

/**
 * A battle's levy: the first `target` of its lines below `count` whose holder in year `at` is a man
 * grown and of fighting age (`mourning` asks it of a line someone has died on), in the order of its
 * war (by key, finish(mix(war, line), 1), then line). Only the lines whose keys come first are
 * looked at, as many as the levy asks by the share of lines the fold's levies have found eligible
 * (and a quarter more), and every line where those held too few. Put in `levied` by line: how
 * many, fewer only where too few of all its lines were eligible.
 */
function levyOf(
  s: Shape,
  war: number,
  count: number,
  at: number,
  target: number,
  mourning: (k: number) => boolean,
): number {
  if (levied.length < count) {
    const size = Math.max(count, 2 * levied.length);
    levied = new Int32Array(size);
    levyKeys = new Uint32Array(size);
    packed = new Float64Array(size);
  }
  const term = s.term,
    q = Math.floor(at / term),
    q1 = q + 1,
    // (A line's term that day: the next where its phase reaches past the edge.)
    edge = q1 * term - at,
    lines = levied,
    keys = levyKeys,
    phase = phis,
    dying = mourned,
    terms = natTau,
    from = natFrom,
    to = natTo,
    share = looked > 0 ? Math.max(0.05, fitting / looked) : 0.25;
  let below = Math.min(KEYS, Math.ceil(((1.25 * target + 32) / (share * count)) * KEYS)),
    n = 0;
  for (;;) {
    n = 0;
    for (let k = 0; k < count; k++) {
      const x = finish(mix(war, k), 1);
      if (x >= below) continue;
      looked++;
      let phi = phase[k]!;
      if (phi < 0) phi = seenLine(s, k);
      if (dying[k] === 1) {
        if (!mourning(k)) continue;
      } else {
        const tau = phi >= edge ? q1 : q;
        if (terms[k] !== tau) natural(s, k, tau, phi);
        if (at < from[k]! || at >= to[k]!) continue;
      }
      keys[n] = x;
      lines[n++] = k;
    }
    fitting += n;
    if (n >= target || below >= KEYS) break;
    // (Too few among the first: every line looked at.)
    below = KEYS;
  }
  everyFit = below >= KEYS ? n : -1;
  if (n <= target) return n;
  // The first `target` of them in the war's order: those at or before the target-th.
  for (let i = 0; i < n; i++) packed[i] = keys[i]! * SLOT + lines[i]!;
  selectLeast(packed, 0, n, target);
  let last = 0;
  for (let i = 0; i < target; i++) if (packed[i]! > last) last = packed[i]!;
  let m = 0;
  for (let i = 0; i < n; i++) if (keys[i]! * SLOT + lines[i]! <= last) lines[m++] = lines[i]!;
  return m;
}

/**
 * The town's lines folded through the battles and strikes of the window, from the world's year less
 * ROSTER_YEARS to `year`. The start is the same for every roster made this year, so a battle's
 * roster and today's tell its men alike. A battle of year B happens at (B+1)·YEAR, a strike at its
 * event's moment.
 */
function foldRoster(
  world: World,
  town: string,
  year: number,
  fought: readonly { readonly war: War; readonly b: Battle }[] | null,
  c: Caches,
): Roster {
  const ctx = c.ctx,
    life = ctx.life,
    { span, term, youngest } = lineShape(life),
    s = ctx.settlements.get(town as Ref),
    cell = s?.cell ?? -1,
    population = s?.population ?? 0,
    // (A town is found in its land's tallies by its place in the land's founding order.)
    idx = s ? ctx.settlements.inProvince(cell).findIndex((x) => x.ref === s.ref) : -1,
    first = c.year - ROSTER_YEARS,
    pre = prefixOf(`folk ${town} `),
    keyOf = keysOf(pre),
    [fitFrom, fitTo] = fitOf(life),
    shape: Shape = {
      pre,
      term,
      youngest,
      spread: Math.max(0, span - term - youngest),
      fitFrom,
      fitTo,
    },
    took = (key: number) => tookAt(shape, key);

  // The land's people in a year: its yearly ledger at the last year not after it (as causal
  // populationIn reads it; the ledger runs oldest first).
  const ledger = cell >= 0 ? ctx.history.yearsOf(cell) : [],
    landPeopleAt = (y: number) => {
      let lo = 0,
        hi = ledger.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (ledger[mid]!.year <= y) lo = mid + 1;
        else hi = mid;
      }
      return lo > 0
        ? Math.max(1, ledger[lo - 1]!.population)
        : Math.max(1, ctx.provinces.get(cell)?.total() ?? 1);
    };

  // The window's battles the town sent men to, and the strikes on it, in time order (ties by event).
  const steps: Step[] = [],
    fight = (war: War, b: Battle, side: 0 | 1, land: LandFell | undefined) => {
      // (An older save's battle has no record of its men; an old one has let its towns go.)
      if (!land || land[0] !== cell || land[4] === undefined) return;
      if (b.year < first || b.year >= year || idx < 0) return;
      const towns = land[4],
        at = 3 * idx;
      if (at + 2 >= towns.length || towns[at]! <= 0) return;
      const sent = towns[at]!,
        // Its lines that day: its people as the record split its land's men by them.
        people = Math.max(sent, Math.round((sent * landPeopleAt(b.year)) / Math.max(1, land[1])));
      steps.push({
        t: (b.year + 1) * YEAR,
        event: b.event,
        seq: steps.length,
        count: Math.min(SLOT - 1, Math.ceil(people / LINE)),
        war,
        b,
        side,
        land,
        tally: [sent, towns[at + 1]!, towns[at + 2]!],
        target: levyLinesOf(b.event, town, sent),
      });
    };
  if (cell >= 0) {
    if (fought)
      for (const { war, b } of fought)
        for (const side of [0, 1] as const)
          for (const land of b.fell?.[side] ?? []) fight(war, b, side, land);
    else
      for (const [war, k, side, j, y] of (c.window ??= windowOf(world)).byCell.get(cell) ?? [])
        if (y >= first && y < year) {
          const b = war.battles[k];
          if (b) fight(war, b, side, b.fell?.[side]?.[j]);
        }
    // A fire sent on it, a quake or a fire from the sky on its land: the town's share of its dead
    // by its people (as host/town.ts strikesOn tells them). Those of the roster's own year count
    // from the next, so a roster never goes stale while its year runs.
    const index = strikesOf(world, c),
      land = ctx.provinces.get(cell),
      all = land?.total() ?? 0,
      share = all > 0 ? Math.min(1, population / all) : 0;
    for (const list of [index.fires.get(town), land && index.lands.get(land.ref)])
      for (const e of list ?? []) {
        const at = yearOfMoment(e.t),
          dead = e.kind === "fire" ? e.told : Math.round(e.told * share);
        if (at >= first && at < year && dead > 0)
          steps.push({
            t: e.t,
            event: e.event,
            seq: steps.length,
            count: Math.ceil(population / LINE),
            strike: e,
            dead,
          });
      }
  }
  steps.sort(
    (p, q) => p.t - q.t || (p.event < q.event ? -1 : p.event > q.event ? 1 : p.seq - q.seq),
  );

  // (A line is seen only as a levy or a strike comes to it.)
  let most = 0;
  for (const step of steps) most = Math.max(most, step.count);
  scratch(most);
  // The deaths on each line, in the order of the fold (a line holds at most one a year: it stands
  // empty after).
  const deaths = new Map<number, Death[]>();

  /** The key of line k's holder numbered n, in the fold (its line seen). */
  const keyIn = (k: number, n: number) => holderKey(pre, lineHs[k]!, lineNs[k]!, k, n);

  /**
   * Line k's holder in year y as the deaths of the fold's steps before `before` leave it (those of
   * later years not asked): their number and the year they took it, and whether they are dead (they
   * died in y, or every one of the term's numbers has been taken); null: the line stands empty.
   */
  function tenureAt(
    k: number,
    y: number,
    phi: number,
    before = Infinity,
  ): { readonly n: number; readonly from: number; readonly dead: boolean } | null {
    const tau = Math.floor((y + phi) / term),
      start = tau * term - phi,
      ds = deaths.get(k);
    let at = -1;
    if (ds)
      for (let i = ds.length - 1; i >= 0 && at < 0; i--)
        if (ds[i]!.year <= y && ds[i]!.step < before) at = i;
    if (at < 0) return { n: numberOf(tau, 0), from: start, dead: false };
    const last = ds![at]!,
      lastN = numberOf(last.term, last.r);
    if (last.year === y) {
      // (One who died this year still held it this year: from when he took it.)
      const before = at > 0 ? ds![at - 1]! : null,
        back = before ? before.year + before.empty + 1 : -Infinity;
      return {
        n: lastN,
        from: last.r > 0 ? back : Math.max(last.term * term - phi, back),
        dead: true,
      };
    }
    const back = last.year + last.empty + 1;
    if (y < back) return null;
    // The rest of the term to the next of its holders, else the next term's own from when it is
    // held again.
    const n = tau === last.term ? numberOf(tau, last.r + 1) : numberOf(tau, 0);
    return { n, from: tau === last.term ? back : Math.max(start, back), dead: n === lastN };
  }

  function die(k: number, n: number, key: number, at: number, step: number): void {
    const d: Death = {
        year: at,
        term: Math.floor((n - 1) / PER_TERM),
        r: (n - 1) % PER_TERM,
        empty: 1 + (key % EMPTY_MOST),
        step,
      },
      ds = deaths.get(k);
    mourned[k] = 1;
    if (ds) ds.push(d);
    else deaths.set(k, [d]);
  }

  const levies: KeptBattle[] = [],
    struck: KeptStrike[] = [],
    battles: RosterBattle[] = [],
    strikes: RosterStrike[] = [];
  for (let at_ = 0; at_ < steps.length; at_++) {
    const step = steps[at_]!,
      { count } = step;
    if ("strike" in step) {
      // Each line's holder dies at the town's share of the dead, or is hurt at its share of the hurt.
      const { strike: e, dead } = step,
        at = yearOfMoment(e.t),
        p = Math.min(1, dead / Math.max(1, population)),
        hk = hashString(e.event),
        q = Math.floor(at / term),
        edge = (q + 1) * term - at,
        hit: number[] = [],
        how: number[] = [];
      for (let k = 0; k < count; k++) {
        // (The line's chance first: its holder is found only where it falls.)
        const v = u(finish(mix(hk, k), 3), 1),
          fate = v < p ? DIED : v < p + p * STRIKE_HURT[e.kind] ? 1 : -1;
        if (fate < 0) continue;
        let phi = phis[k]!;
        if (phi < 0) phi = seenLine(shape, k);
        let n: number, key: number;
        if (mourned[k] === 1) {
          const h = tenureAt(k, at, phi);
          if (h === null || h.dead) continue;
          n = h.n;
          key = keyIn(k, n);
        } else {
          const tau = phi >= edge ? q + 1 : q;
          if (natTau[k] !== tau) natural(shape, k, tau, phi);
          n = numberOf(tau, 0);
          key = natKey[k]!;
        }
        hit.push(k);
        how.push(fate);
        if (fate === DIED) die(k, n, key, at, at_);
      }
      const told = lazily<RosterStrike>(
          { event: e.event, kind: e.kind, year: at, dead, lines: count },
          "men",
          () => menOf(kept, (k, f) => ({ line: k, holder: holderIn(k, at), fate: STRUCK[f]! })),
        ),
        kept: KeptStrike = {
          year: at,
          lines: Int32Array.from(hit),
          fates: Uint8Array.from(how),
          told,
        };
      struck.push(kept);
      strikes.push(told);
      continue;
    }
    const { war, b, side, tally, target } = step,
      [sent, dead, hurt] = tally,
      at = b.year;
    // The levy, by twelves of the men it sent: the first of its eligible lines in the order of its
    // war (by key, then line), so the same men answer every call of a war while they live. Where it
    // looked at every line, how many were eligible is known.
    let wanted = 0,
      eligible = -1;
    if (target > 0) {
      const mourning = (k: number) => {
        const h = tenureAt(k, at, phis[k]!);
        if (h === null || h.dead) return false;
        const key = keyIn(k, h.n),
          age = at - (h.from - took(key));
        return ((key >>> 5) & 1) === 1 && age >= fitFrom && age < fitTo;
      };
      wanted = levyOf(shape, hashString(`levy ${war.ref} ${town}`), count, at, target, mourning);
      eligible = everyFit;
    }
    let lines = NO_LINES,
      fates = NO_CODES;
    if (wanted > 0) {
      lines = levied.slice(0, wanted);
      fates = new Uint8Array(wanted);
      // Their fates in the order of the battle (by key, then line): the first fall, the next come
      // home wounded (maimed as often as the wounded of their side were), the rest stood.
      const fell = Math.min(wanted, fellLinesOf(b.event, town, dead)),
        hurtLines = Math.min(wanted - fell, hurtLinesOf(b.event, town, hurt)),
        fateKey = hashString(`fate ${b.event} ${town}`),
        wounded = b.wounded?.[side] ?? 0,
        maimedShare = wounded > 0 ? (b.maimed?.[side] ?? 0) / wounded : 0,
        // (Drawn only where the side was maimed at all.)
        eventKey = maimedShare > 0 ? hashString(b.event) : 0;
      if (fell + hurtLines > 0) {
        if (fated.length < wanted) fated = new Float64Array(Math.max(wanted, 2 * fated.length));
        for (let i = 0; i < wanted; i++) fated[i] = finish(mix(fateKey, lines[i]!), 1) * SLOT + i;
        if (fell > 0 && fell < wanted) selectLeast(fated, 0, wanted, fell);
        if (hurtLines > 0 && fell + hurtLines < wanted)
          selectLeast(fated, fell, wanted - fell, hurtLines);
        for (let j = 0; j < fell + hurtLines; j++) {
          const i = fated[j]! % SLOT,
            k = lines[i]!;
          let n: number, key: number;
          if (mourned[k] === 1) {
            n = tenureAt(k, at, phis[k]!)!.n;
            key = keyIn(k, n);
          } else {
            n = numberOf(natTau[k]!, 0);
            key = natKey[k]!;
          }
          if (j < fell) {
            fates[i] = FELL;
            die(k, n, key, at, at_);
          } else fates[i] = maimedShare > 0 && u(key ^ eventKey, 9) < maimedShare ? MAIMED : HURT;
        }
      }
    }
    const told: RosterBattle = {
        event: b.event,
        war: war.ref,
        side,
        year: at,
        land: b.land,
        tally: [sent, dead, hurt],
        lines: count,
        eligible,
        men: [],
      },
      kept: KeptBattle = { year: at, lines, fates, told },
      j = at_;
    // (Where its levy did not look at every line, how many were eligible is counted when asked.)
    if (eligible < 0) lazily(told, "eligible", () => eligibleAt(j, count, at));
    lazily(told, "men", () =>
      menOf(kept, (k, f) => ({ line: k, holder: holderIn(k, at), fate: FATES[f]! })),
    );
    levies.push(kept);
    battles.push(told);
  }
  // (The steps are not kept.)
  steps.length = 0;

  /**
   * How many of a battle's lines held a man grown and of fighting age, as the deaths of the steps
   * before it left them (the fold's j-th step, in year `at`).
   */
  function eligibleAt(j: number, count: number, at: number): number {
    let n = 0;
    for (let k = 0; k < count; k++) {
      lineState(pre, k);
      const h0 = stateH,
        n0 = stateN,
        phi = lineKey(pre, h0, n0, k) % term,
        ds = deaths.get(k);
      let key: number, born: number;
      if (ds && ds[0]!.step < j) {
        const h = tenureAt(k, at, phi, j);
        if (h === null || h.dead) continue;
        key = holderKey(pre, h0, n0, k, h.n);
        born = h.from - took(key);
      } else {
        const tau = Math.floor((at + phi) / term);
        key = holderKey(pre, h0, n0, k, numberOf(tau, 0));
        born = tau * term - phi - took(key);
      }
      if (((key >>> 5) & 1) === 1 && at - born >= fitFrom && at - born < fitTo) n++;
    }
    return n;
  }

  // ---- What the roster hands out, made from what the fold kept ----

  const made = new Map<number, Holder[]>(),
    inner: Inner = {
      // (Reckoned roughly, as measured: what the fold itself keeps, each battle and strike — its
      // record, and its men's lines and fates — and each line mourned.)
      bytes:
        4096 +
        levies.reduce((n, x) => n + 1024 + 5 * x.lines.length, 0) +
        struck.reduce((n, x) => n + 768 + 5 * x.lines.length, 0) +
        160 * deaths.size,
      into: null,
      head,
    },
    weigh = (bytes: number) => {
      inner.bytes += bytes;
      if (inner.into) inner.into.bytes += bytes;
    },
    phaseOf = (k: number) => keyOf(k) % term;

  /** The holder of line k numbered n who took it in `from` (the same object each time asked). */
  function holderBy(k: number, n: number, from: number): Holder {
    let list = made.get(k);
    if (list) {
      for (const h of list) if (h.n === n) return h;
    } else made.set(k, (list = []));
    const key = keyOf(k, n),
      tau = Math.floor((n - 1) / PER_TERM);
    let died: number | null = null;
    for (const d of deaths.get(k) ?? [])
      if (numberOf(d.term, d.r) === n) {
        died = d.year;
        break;
      }
    const end = died === null ? tau * term - phaseOf(k) + term : died + 1;
    // Their battles and strikes: those that fell on the line while they held it, oldest first.
    let fates = NO_FATES,
      hit = NO_STRIKES;
    for (const x of levies) {
      if (x.year < from || x.year >= end) continue;
      const i = placeOf(x.lines, k);
      if (i < 0) continue;
      const { event, war, side, year, land } = x.told,
        told: HolderFate = { event, war, side, year, land, fate: FATES[x.fates[i]!]! };
      if (fates === NO_FATES) fates = [told];
      else (fates as HolderFate[]).push(told);
    }
    for (const x of struck) {
      if (x.year < from || x.year >= end) continue;
      const i = placeOf(x.lines, k);
      if (i < 0) continue;
      const { event, kind, year } = x.told,
        told: StrikeFate = { event, kind, year, fate: STRUCK[x.fates[i]!]! };
      if (hit === NO_STRIKES) hit = [told];
      else (hit as StrikeFate[]).push(told);
    }
    const h: Holder = {
      ref: townsfolkRef(town, k, n),
      line: k,
      n,
      key,
      sex: ((key >>> 5) & 1) as 0 | 1,
      born: from - took(key),
      from,
      end,
      fates,
      struck: hit,
      died,
    };
    list.push(h);
    weigh(240 + 64 * (fates.length + hit.length));
    return h;
  }

  /** Line k's holder in year y, as the deaths folded leave it (null: it stands empty). */
  function holderAt(k: number, y: number): Holder | null {
    const h = tenureAt(k, y, phaseOf(k));
    return h && holderBy(k, h.n, h.from);
  }
  /** Line k's holder in a year of the window it was levied or struck in (there was one). */
  const holderIn = (k: number, y: number): Holder => holderAt(k, y)!;

  /** A battle's or a strike's men, by line, made when first asked for. */
  function menOf<T>(x: Kept, man: (k: number, fate: number) => T): T[] {
    const men: T[] = [];
    for (let i = 0; i < x.lines.length; i++) men.push(man(x.lines[i]!, x.fates[i]!));
    weigh(48 * men.length);
    return men;
  }

  function head(
    event: string,
    side: 0 | 1,
    most: readonly [number, number, number],
  ): [RosterMan[], RosterMan[], RosterMan[]] {
    const out: [RosterMan[], RosterMan[], RosterMan[]] = [[], [], []],
      x = levies.find((l) => l.told.event === event && l.told.side === side);
    if (!x) return out;
    let wanted = most[0] + most[1] + most[2];
    for (let i = 0; i < x.lines.length && wanted > 0; i++) {
      const f = x.fates[i]!,
        lot = out[LOT[f]!]!;
      if (lot.length >= most[LOT[f]!]!) continue;
      const k = x.lines[i]!;
      lot.push({ line: k, holder: holderIn(k, x.year), fate: FATES[f]! });
      wanted--;
    }
    return out;
  }

  /** A holder by line and number, met in the fold or as the deaths folded leave them; null: none. */
  function holderOf(k: number, n: number): Holder | null {
    if (!Number.isInteger(k) || k < 0 || !Number.isInteger(n) || n < 1) return null;
    for (const h of made.get(k) ?? []) if (h.n === n) return h;
    const tau = Math.floor((n - 1) / PER_TERM),
      r = (n - 1) % PER_TERM,
      start = tau * term - phaseOf(k),
      ds = deaths.get(k) ?? [];
    let from = start;
    if (r === 0) {
      // (Held from the start of its term, or from when it was held again after a death before it.)
      for (const d of ds) if (d.term < tau) from = Math.max(start, d.year + d.empty + 1);
    } else {
      // (A replacement holds it after the one before him in the term died.)
      const before = ds.find((d) => d.term === tau && d.r === r - 1);
      if (!before) return null;
      from = before.year + before.empty + 1;
    }
    return from < start + term && from <= year ? holderBy(k, n, from) : null;
  }

  // Names in the tongue of the land as it is when first asked: a given name by their key, and the
  // name of a family to every four lines, as four folk share a home.
  const names = new Map<string, string>();
  let speech: { readonly tongue: Tongue | undefined; readonly family: Tongue } | null = null;
  const nameOf = (h: Holder): string => {
    let name = names.get(h.ref);
    if (name === undefined) {
      if (!speech) {
        const tongue = cell >= 0 ? cultureOf(world).get(cell)?.tongue : undefined;
        speech = { tongue, family: tongue ?? cradleTongue(ctx.culture) };
      }
      const given = speech.tongue
          ? tonguePersonName(speech.tongue, h.key, h.sex)
          : personName(ctx.culture, h.key, h.sex),
        family = houseName(speech.family, town, h.line);
      names.set(h.ref, (name = `${given} ${family}`));
      weigh(96);
    }
    return name;
  };

  const roster: Roster = {
    town,
    year,
    holder: (line) => (Number.isInteger(line) && line >= 0 ? holderAt(line, year) : null),
    holderOf,
    battles,
    battle: (event) => battles.find((rb) => rb.event === event) ?? null,
    strikes,
    nameOf,
  };
  INNER.set(roster, inner);
  return roster;
}

/**
 * `told` with one more field, `name`, made by `make` when first read and kept from then on (an
 * own field, so it is copied and compared as any other).
 */
function lazily<T>(told: object, name: string, make: () => unknown): T {
  Object.defineProperty(told, name, {
    configurable: true,
    enumerable: true,
    get() {
      const value = make();
      Object.defineProperty(told, name, { value, enumerable: true, writable: false });
      return value;
    },
  });
  return told as T;
}
