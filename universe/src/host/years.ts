// What a realm and a land were, year by year (asked 2026-11-13: "am i able to see stats and like graphs over time in the
// country/land/league panels"), so that a realm's past is its own and not the sum of the lands it holds now.
//
// Read each year as it closes, after everything of it is done. A realm is its lands, and the population's history already
// keeps every land's people and how they ate, year by year (every year for a century, one in ten to a thousand, then one in a
// hundred): so what is kept here is which realm each land was of, as it changed, and from that a realm's people, its lands
// and how well they ate are its own lands' in each year, exactly. What history does not keep is kept beside it: each land's
// grievance, its stores of food, its wealth, its trade and its dead of sickness, once a decade; and of each realm, as each
// changed, its host against its people, its standing, its tithe, the alliance it stood in, its rulers and the god's
// blessings and curses on it. Thinned as the years go by (EVERY_YEARS and after), so that a far world's save holds a few
// numbers a land a century, not a year.
//
// A reading only: it is no system and no part of the rules, it hashes nothing and draws nothing, and the world runs the same
// with it or without it (tests/host/years.test.ts). A save made before it loads; its years begin there.
import { yearOfMoment, type Hasher, type StateStore, type World } from "../kernel/index.ts";
import { FOODS, GOODS } from "../rules/index.ts";
import {
  creditOf,
  fieldedOf,
  healthOf,
  marketsOf,
  orderOf,
  politiesOf,
  populationContext,
  type Polity,
} from "../sim/index.ts";
import { blocsOf } from "./inspect/ties.ts";

/**
 * What is kept, as the years go by: a change of a realm or of a land's realm, every one for EVERY_YEARS; a land's own numbers,
 * every decade for DECADE_YEARS; then of each, one in fifty years, and past SPARSE_YEARS one in a hundred.
 */
export const EVERY_YEARS = 100,
  DECADE_YEARS = 200,
  SPARSE_YEARS = 1000;
/** A realm's rulers are marked for this long. */
export const RULER_YEARS = 400;
/** A realm's standing is written again when it has moved by this many in a hundred. */
export const STANDING_MOVES = 2;
/** A land's own numbers are read once a decade. */
export const LAND_EVERY = 10;
/** A realm's host against its people is written again when it has moved by this share of itself. */
export const HOST_MOVES = 0.02;

/** A land's numbers in a decade's year, in this order in its row. */
export const LAND_COLUMNS = [
  /** Its grievance against its realm (a hundred: as great as it goes). */
  "grievance",
  /** Its stores of food, in tenths of a month's eating for its people. */
  "food",
  /** What it holds a head: its stores at their usual worth, less what it owes (in steps, below nothing where it owes more). */
  "worth",
  /** What it sent along the roads and the sea in the year, at the goods' usual worth (in steps). */
  "trade",
  /** Its dead of sickness, all of them since its years were first kept. */
  "sick",
] as const;
export type LandColumn = (typeof LAND_COLUMNS)[number];

/** Whether a decade's year of a land is still kept in `now`. */
function keptDecade(year: number, now: number): boolean {
  return (
    year >= now - DECADE_YEARS ||
    (year % 50 === 0 && year >= now - SPARSE_YEARS) ||
    year % 100 === 0
  );
}

/** A number to two figures (a reading of the past to be drawn, not added up to the coin). */
export function twoFigures(n: number): number {
  const a = Math.abs(n);
  if (a < 100) return Math.round(n);
  const step = 10 ** (Math.floor(Math.log10(a)) - 1);
  return Math.round(n / step) * step;
}

/** A land's number in a decade it was not read in (no one lived there then): nothing to draw. */
export const UNREAD = -1_000_000;

/** How many steps a tenfold a worth is kept in: each within some 5% of what it was. */
export const STEPS = 24;

/** A worth as kept: steps of a tenfold (a twenty-fourth: some 10% apart), signed. Small whole numbers, each like the last, fold small. */
export function toSteps(n: number): number {
  return Math.sign(n) * Math.round(STEPS * Math.log10(1 + Math.abs(n)));
}

/** What toSteps kept, back as a worth (to within some 5%). */
export function fromSteps(k: number): number {
  return Math.sign(k) * (10 ** (Math.abs(k) / STEPS) - 1);
}

/** A value as it changed: the year each change was first so, and what it then was. */
export type Log<V> = { y: number[]; v: V[] };

/** The value of a log in a year (undefined: before its first). */
export function logAt<V>(log: Log<V> | undefined, year: number): V | undefined {
  if (!log) return undefined;
  let lo = 0,
    hi = log.y.length - 1,
    at = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (log.y[mid]! <= year) {
      at = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return at < 0 ? undefined : log.v[at];
}

function logPut<V>(log: Log<V>, year: number, v: V): void {
  if (log.v.length && log.v.at(-1) === v) return;
  if (log.y.at(-1) === year) {
    log.v[log.v.length - 1] = v;
    return;
  }
  log.y.push(year);
  log.v.push(v);
}

/** Past a century, the last change of each fifty years; past a thousand years, of each century (its last change always kept). */
function logThin<V>(log: Log<V>, now: number): void {
  const n = log.y.length;
  if (n < 2 || log.y[1]! >= now - EVERY_YEARS) return;
  const bin = (y: number) =>
    y >= now - EVERY_YEARS
      ? y
      : y >= now - SPARSE_YEARS
        ? -1 - Math.floor(y / 50)
        : -1e6 - Math.floor(y / 100);
  const y: number[] = [],
    v: V[] = [];
  for (let i = 0; i < n; i++) {
    if (i + 1 < n && bin(log.y[i + 1]!) === bin(log.y[i]!)) continue;
    if (v.length && v.at(-1) === log.v[i]) continue;
    y.push(log.y[i]!);
    v.push(log.v[i]!);
  }
  log.y = y;
  log.v = v;
}

const emptyLog = <V>(): Log<V> => ({ y: [], v: [] });
const copyLog = <V>(l: Log<V>): Log<V> => ({ y: [...l.y], v: [...l.v] });

/** What is kept of a realm as it changed. */
export type RealmLog = {
  /** The first year read of it. */
  first: number;
  /** Its host, in ten-thousandths of its people. */
  host: Log<number>;
  /** Its standing with its people, in a hundred (-1: not yet reckoned). */
  standing: Log<number>;
  /** Its tithe, in a hundred of each land's grain. */
  tithe: Log<number>;
  /** The head of the alliance it stood in ("": none). */
  bloc: Log<string>;
  /** The years a new ruler came (those of the last RULER_YEARS). */
  rulers: number[];
  /** The god's blessings (0) and curses (1) on it. */
  acts: Log<number>;
};

/** Every realm's and every land's years, as they were. */
export class YearsStore implements StateStore {
  readonly name = "readings.years";
  readonly observational = true;
  readonly outsideRules = true;
  /** Saved packed by column (kernel/pack.ts): long rows of whole numbers. */
  readonly packed = true;
  /** The decades' years of the lands' rows, and each land's row from its first. */
  landYears: number[] = [];
  readonly lands = new Map<number, { from: number; cols: number[][] }>();
  /** Each land's realm as it changed ("": none), and the first year read of it. */
  readonly landRealm = new Map<number, Log<string> & { first: number }>();
  readonly realms = new Map<string, RealmLog>();
  /** The last year read (-1: none yet). */
  last = -1;

  hashInto(h: Hasher): void {
    // (Never asked: a reading is no part of the world's hash.)
    h.int(0);
  }

  /** A land's decades: each year kept and its numbers by column (null: none kept). */
  landRows(cell: number): { years: number[]; cols: number[][] } | null {
    const r = this.lands.get(cell);
    if (!r) return null;
    return {
      years: this.landYears.slice(r.from, r.from + (r.cols[0]?.length ?? 0)),
      cols: r.cols,
    };
  }

  save(): unknown {
    return {
      last: this.last,
      landYears: this.landYears,
      lands: [...this.lands].map(([key, r]) => ({ key, from: r.from, cols: r.cols })),
      landRealm: [...this.landRealm].map(([key, l]) => ({ key, first: l.first, y: l.y, v: l.v })),
      realms: [...this.realms].map(([key, r]) => ({
        key,
        first: r.first,
        host: r.host,
        standing: r.standing,
        tithe: r.tithe,
        bloc: r.bloc,
        rulers: r.rulers,
        acts: r.acts,
      })),
    };
  }

  load(state: unknown): void {
    const s = state as {
      last: number;
      landYears: number[];
      lands: { key: number; from: number; cols: number[][] }[];
      landRealm: { key: number; first: number; y: number[]; v: string[] }[];
      realms: (RealmLog & { key: string })[];
    };
    this.last = s.last;
    this.landYears = [...s.landYears];
    this.lands.clear();
    for (const r of s.lands)
      this.lands.set(r.key, { from: r.from, cols: r.cols.map((c) => [...c]) });
    this.landRealm.clear();
    for (const l of s.landRealm)
      this.landRealm.set(l.key, { first: l.first, y: [...l.y], v: [...l.v] });
    this.realms.clear();
    for (const r of s.realms)
      this.realms.set(r.key, {
        first: r.first,
        host: copyLog(r.host),
        standing: copyLog(r.standing),
        tithe: copyLog(r.tithe),
        bloc: copyLog(r.bloc),
        rulers: [...r.rulers],
        acts: copyLog(r.acts),
      });
  }
}

/** A world's years, if it keeps them. */
export function yearsOf(world: World): YearsStore | null {
  return world.hasStore("readings.years") ? world.store<YearsStore>("readings.years") : null;
}

/** What reading the years has cost in this process, for the gates to tell: years read, and their milliseconds in all. */
export const YEARS_COST = { years: 0, ms: 0 };

/** Keep a world's years from now on: read each year as it closes. */
export function installYears(world: World): void {
  if (!world.hasStore("polity.states") || !world.hasStore("population.provinces")) return;
  const store = world.register(new YearsStore());
  world.addRecorder((t) => {
    const t0 = performance.now();
    readYear(world, store, t);
    YEARS_COST.years++;
    YEARS_COST.ms += performance.now() - t0;
  });
}

const pct = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 100);

/** A land's stores at their goods' usual worth (as the wealth book weighs them). */
export function storesWorth(world: World, cell: number): number {
  const m = marketsOf(world).get(cell);
  if (!m) return 0;
  let n = 0;
  for (let g = 0; g < GOODS.length; g++) n += Math.max(0, m.stock[g] ?? 0) * GOODS[g]!.value;
  return n;
}

const OWED = new WeakMap<World, { at: number; n: number; by: Map<number, number> }>(),
  SENT = new WeakMap<World, { at: number; flows: unknown; n: number; by: Map<number, number> }>();

/** What each land owes the houses of lending now (read once a moment: every land's page asks). */
export function owedByLand(world: World): Map<number, number> {
  const loans = creditOf(world)?.loans ?? [],
    hit = OWED.get(world);
  if (hit && hit.at === world.now && hit.n === loans.length) return hit.by;
  const owed = new Map<number, number>();
  for (const loan of loans)
    if (loan.ended === null) owed.set(loan.cell, (owed.get(loan.cell) ?? 0) + loan.owed);
  OWED.set(world, { at: world.now, n: loans.length, by: owed });
  return owed;
}

/** What each land sent along the roads and the sea in the year just past, at the goods' usual worth (read once a moment). */
export function sentByLand(world: World): Map<number, number> {
  const flows = marketsOf(world).flows,
    hit = SENT.get(world);
  if (hit && hit.at === world.now && hit.flows === flows && hit.n === flows.length) return hit.by;
  const sent = new Map<number, number>();
  for (const f of flows) sent.set(f.from, (sent.get(f.from) ?? 0) + f.count * GOODS[f.good]!.value);
  SENT.set(world, { at: world.now, flows, n: flows.length, by: sent });
  return sent;
}

/** A realm's host now, in ten-thousandths of its people. */
export function hostShare(world: World, r: Polity): number {
  const ctx = populationContext(world);
  let people = 0;
  for (const c of r.members) people += ctx.provinces.get(c)?.total() ?? 0;
  return people ? Math.round((fieldedOf(ctx, r) / people) * 10_000) : 0;
}

/** A land's numbers now, as its decade's row would keep them. */
export function landNow(
  world: World,
  cell: number,
  owed = owedByLand(world),
  sent = sentByLand(world),
): number[] {
  const p = populationContext(world).provinces.get(cell),
    people = p?.total() ?? 0,
    m = marketsOf(world).get(cell),
    net = storesWorth(world, cell) - (owed.get(cell) ?? 0);
  return [
    pct(politiesOf(world).discontent(cell).level),
    people && m ? Math.min(99_000, twoFigures((m.food(FOODS) / people) * 10)) : 0,
    people ? toSteps(net / people) : 0,
    toSteps(sent.get(cell) ?? 0),
    healthOf(world)?.land(cell)?.dead ?? 0,
  ];
}

/** Read the year that closes at t. */
export function readYear(world: World, store: YearsStore, t: number): void {
  const year = yearOfMoment(t);
  if (year <= store.last) return;
  store.last = year;
  const ctx = populationContext(world),
    realms = politiesOf(world);
  // Which realm each land is of.
  for (const p of ctx.provinces.all()) {
    let log = store.landRealm.get(p.cell);
    if (!log) store.landRealm.set(p.cell, (log = { first: year, ...emptyLog<string>() }));
    logPut(log, year, realms.of(p.cell)?.ref ?? "");
  }
  // Each land's own numbers, once a decade.
  if (year % LAND_EVERY === 0) {
    const owed = owedByLand(world),
      sent = sentByLand(world);
    store.landYears.push(year);
    const at = store.landYears.length - 1;
    for (const p of ctx.provinces.all()) {
      let row = store.lands.get(p.cell);
      if (!row) store.lands.set(p.cell, (row = { from: at, cols: LAND_COLUMNS.map(() => []) }));
      // (A decade it was not read in, as when no one lived there: nothing to draw.)
      while (row.from + row.cols[0]!.length < at) for (const c of row.cols) c.push(UNREAD);
      landNow(world, p.cell, owed, sent).forEach((v, i) => row.cols[i]!.push(v));
    }
  }
  // Each standing realm, as it changed.
  const blocs = blocsOf(world),
    order = orderOf(world);
  for (const r of realms.living()) {
    let log = store.realms.get(r.ref);
    if (!log)
      store.realms.set(
        r.ref,
        (log = {
          first: year,
          host: emptyLog(),
          standing: emptyLog(),
          tithe: emptyLog(),
          bloc: emptyLog(),
          rulers: [],
          acts: emptyLog(),
        }),
      );
    const share = hostShare(world, r),
      was = log.host.v.at(-1);
    if (was === undefined || Math.abs(share - was) > Math.max(1, was * HOST_MOVES))
      logPut(log.host, year, share);
    const legitimacy = order?.of(r.ref)?.legitimacy;
    const standing = legitimacy === undefined ? -1 : pct(legitimacy),
      stood = log.standing.v.at(-1);
    if (
      stood === undefined ||
      stood < 0 !== standing < 0 ||
      Math.abs(standing - stood) >= STANDING_MOVES
    )
      logPut(log.standing, year, standing);
    logPut(log.tithe, year, Math.round(r.tribute * 100));
    const head = blocs.head.get(r.ref);
    logPut(log.bloc, year, head && blocs.blocs.has(head) ? head : "");
    if (log.rulers.at(-1) !== r.ruler.since) log.rulers.push(r.ruler.since);
  }
  // The god's blessings and curses on a realm, this year.
  for (let i = world.events.count - 1; i >= 0; i--) {
    const e = world.events.at(i),
      y = yearOfMoment(e.t);
    if (y < year) break;
    const kind = e.type === "act.bless" ? 0 : e.type === "act.curse" ? 1 : -1;
    const log = kind >= 0 && y === year ? store.realms.get(e.subjects[0] ?? "") : undefined;
    if (log) {
      log.acts.y.push(year);
      log.acts.v.push(kind);
    }
  }
  // A decade closed: what is no longer kept let go.
  if (year % 10 === 0) thinYears(store, year);
}

function thinYears(store: YearsStore, now: number): void {
  for (const l of store.landRealm.values()) logThin(l, now);
  for (const r of store.realms.values()) {
    logThin(r.host, now);
    logThin(r.standing, now);
    logThin(r.tithe, now);
    logThin(r.bloc, now);
    if (r.rulers.length && r.rulers[0]! < now - RULER_YEARS)
      r.rulers = r.rulers.filter((y) => y >= now - RULER_YEARS);
  }
  const keep = store.landYears.map((y) => keptDecade(y, now));
  if (keep.every(Boolean)) return;
  const before = [0];
  for (let i = 0; i < keep.length; i++) before.push(before[i]! + (keep[i] ? 1 : 0));
  for (const [cell, row] of store.lands) {
    const kept = (_: unknown, i: number) => keep[row.from + i]!;
    row.cols = row.cols.map((c) => c.filter(kept));
    row.from = before[row.from]!;
    if (!row.cols[0]!.length) store.lands.delete(cell);
  }
  store.landYears = store.landYears.filter((_, i) => keep[i]);
}
