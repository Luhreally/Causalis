// A town's people by line (Phase 55 M225): one of every LINE of its people kept by name, the holder
// of a line, each for a natural term (the young taking it after the old), and what history did to
// them. Its battles levied them by twelves of the men its tally sent: the eligible men of its lines,
// the same men to every call of a war while they live, and the fallen and the wounded among them.
// A fire or a quake killed or hurt some of them, counted from the year after. A fallen holder's line
// stands empty a year or a few, then another takes it. It is read from the battle record (the town's
// tally of its men, M224) and the strikes history tells, never drawn, so looking moves nothing, and
// names are given only when asked for.
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
const PER_TERM = 16;
/** Rosters kept for a world before they are all let go. */
const ROSTERS_MOST = 4096;

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
  readonly rosters: Map<string, Roster>;
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
 * the world's year runs (a year to come is folded afresh each time).
 */
export function townRoster(world: World, town: string, year?: number): Roster {
  const c = cachesOf(world),
    y = year === undefined ? c.year : Math.floor(year),
    key = `${town}|${y}`,
    known = c.rosters.get(key);
  if (known) return known;
  const made = foldRoster(world, town, y, null, c);
  // (A year to come is never kept: its battles are not yet fought.)
  if (y <= c.year) {
    if (c.rosters.size >= ROSTERS_MOST) c.rosters.clear();
    c.rosters.set(key, made);
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

// ---- The fold ----

/** A holder as the fold gathers their fates (handed out read-only). */
type Kept = {
  readonly ref: string;
  readonly line: number;
  readonly n: number;
  readonly key: number;
  readonly sex: 0 | 1;
  readonly born: number;
  readonly from: number;
  end: number;
  fates: readonly HolderFate[];
  struck: readonly StrikeFate[];
  died: number | null;
};
// (Most holders are never levied nor struck: they share these until they are.)
const NO_FATES: readonly HolderFate[] = Object.freeze([]),
  NO_STRIKES: readonly StrikeFate[] = Object.freeze([]);
/** A line's place in a packed order key: the key above, the line below (lines are fewer). */
const SLOT = 2097152;
/** No term found yet (no term is numbered so low). */
const NO_TERM = -2147483648;
// (The order of a levy and of its fates, packed: SLOT · key + line; one fold at a time.)
let order = new Float64Array(256),
  fated = new Float64Array(64);

/** Put the `m` least of the first `n` of a packed order first, least first (few by selection). */
function leastFirst(a: Float64Array, n: number, m: number): void {
  if (m < 8)
    for (let i = 0; i < m; i++) {
      let least = i;
      for (let j = i + 1; j < n; j++) if (a[j]! < a[least]!) least = j;
      const x = a[i]!;
      a[i] = a[least]!;
      a[least] = x;
    }
  else if (n > 32) {
    // (A great city's levy takes few of its many lines: those few found first, then put in order.)
    if (m < n) selectLeast(a, n, m);
    a.subarray(0, m).sort();
  } else
    for (let i = 1; i < n; i++) {
      const x = a[i]!;
      let j = i - 1;
      for (; j >= 0 && a[j]! > x; j--) a[j + 1] = a[j]!;
      a[j + 1] = x;
    }
}
/** Put the `m` least of the first `n` first, in no order (Hoare's selection: the keys are distinct). */
function selectLeast(a: Float64Array, n: number, m: number): void {
  const k = m - 1;
  let lo = 0,
    hi = n - 1;
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
/** A death on a line: its year, the term and replacement of the one who died, how long the line stands empty. */
type Death = {
  readonly year: number;
  readonly term: number;
  readonly r: number;
  readonly empty: number;
};
/**
 * A line as the fold has it: where its terms fall (term τ runs from τ·term − phi), the holders met,
 * its deaths in order, and who holds it as far as the fold has gone, from heldFrom to before heldTo.
 */
type Line = {
  readonly phi: number;
  readonly kept: Kept[];
  deaths: Death[] | null;
  held: Kept | null;
  heldFrom: number;
  heldTo: number;
};
/** One of the window's happenings to the town, in time order. */
type Step =
  | {
      readonly t: number;
      readonly event: string;
      readonly seq: number;
      readonly war: War;
      readonly b: Battle;
      readonly side: 0 | 1;
      readonly land: LandFell;
      readonly tally: readonly [number, number, number];
    }
  | {
      readonly t: number;
      readonly event: string;
      readonly seq: number;
      readonly strike: Struck;
      readonly dead: number;
    };

const numberOf = (term: number, r: number) => term * PER_TERM + Math.min(r, PER_TERM - 1) + 1;

/**
 * hashString(`${prefix}${a}`), or of `${prefix}${a} ${b}`, for whole numbers a and b: the words of
 * the prefix absorbed once, the digits fed as the text would give them (kernel/hash.ts's reckoning,
 * exactly). Every line and holder key of a town begins with its name.
 */
function hashAfter(prefix: string): (a: number, b?: number) => number {
  const even = prefix.length - (prefix.length % 2),
    chars: number[] = [],
    digits = (x: number) => {
      const at = chars.length;
      do {
        chars.push(48 + (x % 10));
        x = Math.floor(x / 10);
      } while (x > 0);
      for (let i = at, j = chars.length - 1; i < j; i++, j--) {
        const c = chars[i]!;
        chars[i] = chars[j]!;
        chars[j] = c;
      }
    };
  let start = 0,
    words = 0;
  for (let i = 0; i < even; i += 2) {
    start = mix(start, prefix.charCodeAt(i) | (prefix.charCodeAt(i + 1) << 16));
    words++;
  }
  return (a, b) => {
    // (An odd prefix's last character pairs with the first of the rest.)
    chars.length = 0;
    if (even < prefix.length) chars.push(prefix.charCodeAt(even));
    digits(a);
    if (b !== undefined) {
      chars.push(32);
      digits(b);
    }
    let h = start,
      w = words;
    for (let i = 0; i < chars.length; i += 2) {
      h = mix(h, chars[i]! | ((i + 1 < chars.length ? chars[i + 1]! : 0) << 16));
      w++;
    }
    return finish(mix(h, even + chars.length), w + 1);
  };
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
    keyOf = hashAfter(`folk ${town} `),
    lines: Line[] = [],
    // (Whether an age is grown and of fighting age, as the fold asks it; each war's levy order.)
    fights: boolean[] = [],
    levyKeys = new Map<string, number>();

  // Each line's phase, and the holder of its term as last found where no one has died on it, kept in
  // arrays: a battle's levy looks at every line of the town that day, and a great city has tens of
  // thousands of them. A holder is made only when a fate falls on them, or they are asked for.
  let phis = new Int32Array(0),
    natTau = new Int32Array(0),
    natBorn = new Int32Array(0),
    natSex = new Uint8Array(0),
    // (1: someone has died on the line.)
    mourned = new Uint8Array(0);
  const room = (n: number) => {
      if (n <= phis.length) return;
      const size = Math.max(n, 2 * phis.length, 64),
        p = new Int32Array(size).fill(-1),
        t = new Int32Array(size).fill(NO_TERM),
        b = new Int32Array(size),
        x = new Uint8Array(size),
        d = new Uint8Array(size);
      p.set(phis);
      t.set(natTau);
      b.set(natBorn);
      x.set(natSex);
      d.set(mourned);
      phis = p;
      natTau = t;
      natBorn = b;
      natSex = x;
      mourned = d;
    },
    phiOf = (k: number): number => {
      room(k + 1);
      let phi = phis[k]!;
      if (phi < 0) phis[k] = phi = keyOf(k) % term;
      return phi;
    };
  const lineOf = (k: number): Line =>
      lines[k] ??
      (lines[k] = {
        phi: phiOf(k),
        kept: [],
        deaths: null,
        held: null,
        heldFrom: 0,
        heldTo: 0,
      }),
    fits = (age: number) =>
      fights[age] ??
      (age >= 0
        ? (fights[age] = age >= life.adulthood && fighting(life, bandOf(age, life)))
        : false);

  /**
   * Line k's holder in year y where no one has died on it — its term's own, as holderAt would make
   * them — found without making them: whether a man (natSex), and when born (natBorn).
   */
  function naturalAt(k: number, y: number): void {
    const phi = phiOf(k),
      tau = Math.floor((y + phi) / term);
    if (natTau[k] === tau) return;
    const key = keyOf(k, numberOf(tau, 0)),
      v = u(key, 3);
    natTau[k] = tau;
    natSex[k] = (key >>> 5) & 1;
    natBorn[k] =
      tau * term - phi - (youngest + Math.floor(Math.max(0, span - term - youngest) * v * v));
  }

  /** The holder r of a line's term τ, who took it in `from` (the same object each time asked). */
  function holderBy(line: Line, k: number, tau: number, r: number, from: number): Kept {
    const n = numberOf(tau, r);
    for (const h of line.kept) if (h.n === n) return h;
    const key = keyOf(k, n),
      v = u(key, 3),
      h: Kept = {
        ref: townsfolkRef(town, k, n),
        line: k,
        n,
        key,
        sex: ((key >>> 5) & 1) as 0 | 1,
        // (Young-skewed: most take a line as children or in their prime, a few late.)
        born: from - (youngest + Math.floor(Math.max(0, span - term - youngest) * v * v)),
        from,
        end: tau * term - line.phi + term,
        fates: NO_FATES,
        struck: NO_STRIKES,
        died: null,
      };
    line.kept.push(h);
    return h;
  }

  /** Line k's holder in year y, as the deaths folded so far leave it (null: it stands empty). */
  function holderAt(k: number, y: number): Kept | null {
    const line = lineOf(k);
    if (line.held !== null && y >= line.heldFrom && y < line.heldTo) return line.held;
    const tau = Math.floor((y + line.phi) / term),
      start = tau * term - line.phi;
    let last: Death | undefined;
    if (line.deaths)
      for (let i = line.deaths.length - 1; i >= 0 && !last; i--)
        if (line.deaths[i]!.year <= y) last = line.deaths[i];
    let h: Kept | null;
    if (!last) h = holderBy(line, k, tau, 0, start);
    else if (last.year === y) {
      // (One who died this year still held it this year.)
      const n = numberOf(last.term, last.r);
      h = line.kept.find((x) => x.n === n) ?? null;
    } else {
      const back = last.year + last.empty + 1;
      if (y < back) return null;
      // The rest of the term to the next of its holders, else the next term's own from when it is
      // held again.
      h =
        tau === last.term
          ? holderBy(line, k, tau, last.r + 1, back)
          : holderBy(line, k, tau, 0, Math.max(start, back));
    }
    if (h) {
      line.held = h;
      line.heldFrom = h.from;
      line.heldTo = h.died === null ? h.end : h.died + 1;
    }
    return h;
  }

  function die(h: Kept, at: number): void {
    const line = lineOf(h.line),
      d: Death = {
        year: at,
        term: Math.floor((h.n - 1) / PER_TERM),
        r: (h.n - 1) % PER_TERM,
        empty: 1 + (h.key % EMPTY_MOST),
      };
    h.died = at;
    h.end = at + 1;
    room(h.line + 1);
    mourned[h.line] = 1;
    if (line.held === h) line.heldTo = at + 1;
    if (line.deaths) line.deaths.push(d);
    else line.deaths = [d];
  }

  // The window's battles the town sent men to, and the strikes on it, in time order (ties by event).
  const steps: Step[] = [],
    fight = (war: War, b: Battle, side: 0 | 1, land: LandFell | undefined) => {
      // (An older save's battle has no record of its men; an old one has let its towns go.)
      if (!land || land[0] !== cell || land[4] === undefined) return;
      if (b.year < first || b.year >= year || idx < 0) return;
      const towns = land[4],
        at = 3 * idx;
      if (at + 2 >= towns.length || towns[at]! <= 0) return;
      steps.push({
        t: (b.year + 1) * YEAR,
        event: b.event,
        seq: steps.length,
        war,
        b,
        side,
        land,
        tally: [towns[at]!, towns[at + 1]!, towns[at + 2]!],
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
          steps.push({ t: e.t, event: e.event, seq: steps.length, strike: e, dead });
      }
  }
  steps.sort(
    (p, q) => p.t - q.t || (p.event < q.event ? -1 : p.event > q.event ? 1 : p.seq - q.seq),
  );

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

  const battles: RosterBattle[] = [],
    strikes: RosterStrike[] = [];
  for (const step of steps) {
    if ("strike" in step) {
      // Each line's holder dies at the town's share of the dead, or is hurt at its share of the hurt.
      const { strike: e, dead } = step,
        at = yearOfMoment(e.t),
        p = Math.min(1, dead / Math.max(1, population)),
        count = Math.ceil(population / LINE),
        hk = hashString(e.event),
        men: RosterStrike["men"][number][] = [];
      for (let k = 0; k < count; k++) {
        // (The line's chance first: its holder is made only where it falls.)
        const v = u(finish(mix(hk, k), 3), 1),
          fate = v < p ? "died" : v < p + p * STRIKE_HURT[e.kind] ? "hurt" : null;
        if (!fate) continue;
        const h = holderAt(k, at);
        if (!h || h.died !== null) continue;
        const struck: StrikeFate = { event: e.event, kind: e.kind, year: at, fate };
        if (h.struck === NO_STRIKES) h.struck = [struck];
        else (h.struck as StrikeFate[]).push(struck);
        if (fate === "died") die(h, at);
        men.push({ line: k, holder: h, fate });
      }
      strikes.push({ event: e.event, kind: e.kind, year: at, dead, lines: count, men });
      continue;
    }
    const { war, b, side, land, tally } = step,
      [sent, dead, hurt] = tally,
      at = b.year,
      // Its lines that day: its people as the record split its land's men by them.
      people = Math.max(sent, Math.round((sent * landPeopleAt(at)) / Math.max(1, land[1]))),
      count = Math.min(SLOT - 1, Math.ceil(people / LINE)),
      levyKey = levyKeys.get(war.ref) ?? hashString(`levy ${war.ref} ${town}`);
    levyKeys.set(war.ref, levyKey);
    if (order.length < count) order = new Float64Array(Math.max(count, 2 * order.length));
    let eligible = 0;
    room(count);
    for (let k = 0; k < count; k++) {
      if (mourned[k] === 1) {
        const h = holderAt(k, at);
        if (h !== null && h.died === null && h.sex === 1 && fits(at - h.born))
          order[eligible++] = finish(mix(levyKey, k), 1) * SLOT + k;
      } else {
        // (No one has died on it: its term's own holder.)
        naturalAt(k, at);
        if (natSex[k] === 1 && fits(at - natBorn[k]!))
          order[eligible++] = finish(mix(levyKey, k), 1) * SLOT + k;
      }
    }
    // The levy, by twelves of the men it sent: the first of its eligible lines in the order of its
    // war (by key, then line), so the same men answer every call of a war while they live.
    const wanted = eligible > 0 ? Math.min(eligible, levyLinesOf(b.event, town, sent)) : 0,
      men: RosterMan[] = [];
    if (wanted > 0) {
      leastFirst(order, eligible, wanted);
      const fell = Math.min(wanted, fellLinesOf(b.event, town, dead)),
        hurtLines = Math.min(wanted - fell, hurtLinesOf(b.event, town, hurt)),
        fateKey = hashString(`fate ${b.event} ${town}`),
        wounded = b.wounded?.[side] ?? 0,
        maimedShare = wounded > 0 ? (b.maimed?.[side] ?? 0) / wounded : 0,
        // (Drawn only where the side was maimed at all.)
        eventKey = maimedShare > 0 ? hashString(b.event) : 0;
      // Their fates in the order of the battle: the first fall, the next come home wounded (maimed
      // as often as the wounded of their side were), the rest stood.
      if (fated.length < wanted) fated = new Float64Array(Math.max(wanted, 2 * fated.length));
      for (let i = 0; i < wanted; i++) {
        const k = order[i]! % SLOT;
        fated[i] = finish(mix(fateKey, k), 1) * SLOT + k;
      }
      leastFirst(fated, wanted, wanted);
      for (let i = 0; i < wanted; i++) {
        const k = fated[i]! % SLOT,
          h = holderAt(k, at)!,
          fate: Fate =
            i < fell
              ? "fell"
              : i < fell + hurtLines
                ? maimedShare > 0 && u(h.key ^ eventKey, 9) < maimedShare
                  ? "maimed"
                  : "hurt"
                : "stood",
          told: HolderFate = { event: b.event, war: war.ref, side, year: at, land: b.land, fate };
        if (h.fates === NO_FATES) h.fates = [told];
        else (h.fates as HolderFate[]).push(told);
        if (fate === "fell") die(h, at);
        men.push({ line: k, holder: h, fate });
      }
      // (By line: few, by insertion.)
      if (men.length > 32) men.sort((p, q) => p.line - q.line);
      else
        for (let i = 1; i < men.length; i++) {
          const m = men[i]!;
          let j = i - 1;
          for (; j >= 0 && men[j]!.line > m.line; j--) men[j + 1] = men[j]!;
          men[j + 1] = m;
        }
    }
    battles.push({
      event: b.event,
      war: war.ref,
      side,
      year: at,
      land: b.land,
      tally: [sent, dead, hurt],
      lines: count,
      eligible,
      men,
    });
  }

  /** A holder by line and number, met in the fold or as the deaths folded leave them; null: none. */
  function holderOf(k: number, n: number): Kept | null {
    if (!Number.isInteger(k) || k < 0 || !Number.isInteger(n) || n < 1) return null;
    const line = lineOf(k),
      met = line.kept.find((h) => h.n === n);
    if (met) return met;
    const tau = Math.floor((n - 1) / PER_TERM),
      r = (n - 1) % PER_TERM,
      start = tau * term - line.phi,
      ds = line.deaths ?? [];
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
    return from < start + term && from <= year ? holderBy(line, k, tau, r, from) : null;
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
        family = tongueName(
          { ...speech.family, seed: speech.family.seed ^ 0xf00d },
          hashString(`${town} line ${Math.floor(h.line / 4)}`),
        );
      names.set(h.ref, (name = `${given} ${family}`));
    }
    return name;
  };

  return {
    town,
    year,
    holder: (line) => (Number.isInteger(line) && line >= 0 ? holderAt(line, year) : null),
    holderOf,
    battles,
    battle: (event) => battles.find((rb) => rb.event === event) ?? null,
    strikes,
    nameOf,
  };
}
