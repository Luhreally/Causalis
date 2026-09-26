// The population's stores: the provinces (counts and food), the settlements, and
// the macro history — the birth, death and migration ledgers every later
// resolution of a person is conditioned on (docs/architecture §14–15).
import { Hasher, defineKind, type Ref, type StateStore } from "../../kernel/index.ts";
import { BANDS, OCCUPATIONS } from "../../rules/index.ts";
import { Province } from "./model.ts";

export const SETTLEMENT = defineKind("town", "settlement", "minted");

export class PopulationStore implements StateStore {
  readonly name = "population.provinces";
  private readonly map = new Map<number, Province>();
  /** The provinces in cell order, kept until one is added. */
  private sorted: Province[] | null = null;

  get(cell: number): Province | undefined {
    return this.map.get(cell);
  }

  add(p: Province): Province {
    if (this.map.has(p.cell)) throw new Error(`province ${p.cell} is already peopled`);
    this.map.set(p.cell, p);
    this.sorted = null;
    return p;
  }

  /** Every peopled province, in cell order (the order every system visits them). */
  all(): readonly Province[] {
    return (this.sorted ??= [...this.map.values()].sort((a, b) => a.cell - b.cell));
  }

  total(): number {
    let n = 0;
    for (const p of this.map.values()) n += p.total();
    return n;
  }

  hashInto(h: Hasher): void {
    const all = this.all();
    h.int(all.length);
    for (const p of all) p.hashInto(h);
  }

  save(): unknown {
    return { provinces: this.all().map((p) => p.save()) };
  }

  load(state: unknown): void {
    this.map.clear();
    this.sorted = null;
    for (const s of (state as { provinces: unknown[] }).provinces) {
      const p = Province.load(s);
      this.map.set(p.cell, p);
    }
  }
}

export type Settlement = {
  readonly ref: Ref;
  readonly name: string;
  readonly cell: number;
  /** The tile of the province's region map where it stands. */
  readonly tile: number;
  readonly founded: number;
  readonly decision: Ref;
  readonly event: Ref;
  population: number;
  /** The event that made it its province's market town, if it is one. */
  market: Ref | null;
  /** A shrine the god raised there, and a spring the god opened (the events). */
  shrine?: Ref | null;
  spring?: Ref | null;
};

export class SettlementStore implements StateStore {
  readonly name = "population.settlements";
  private list: Settlement[] = [];
  /** The same settlements by province (in founding order) and by ref. */
  private readonly byCell = new Map<number, Settlement[]>();
  private readonly byRef = new Map<string, Settlement>();
  /** What never changes of each settlement (where and when it was founded, and why), folded in as it was. */
  private founding = "";

  add(s: Settlement): Settlement {
    this.list.push(s);
    this.index(s);
    this.fold(s);
    return s;
  }

  private fold(s: Settlement): void {
    this.founding = new Hasher()
      .string(this.founding)
      .string(s.ref)
      .string(s.name)
      .int(s.cell)
      .int(s.tile)
      .int(s.founded)
      .string(s.decision)
      .string(s.event)
      .hex();
  }

  private index(s: Settlement): void {
    const here = this.byCell.get(s.cell);
    if (here) here.push(s);
    else this.byCell.set(s.cell, [s]);
    this.byRef.set(s.ref, s);
  }

  all(): readonly Settlement[] {
    return this.list;
  }

  /** A province's settlements, in the order they were founded (a copy: the caller may add to it). */
  inProvince(cell: number): Settlement[] {
    return [...(this.byCell.get(cell) ?? [])];
  }

  get(ref: Ref): Settlement | undefined {
    return this.byRef.get(ref);
  }

  hashInto(h: Hasher): void {
    // The foundings by their fold; then what changes, settlement by settlement.
    h.string(this.founding).int(this.list.length);
    for (const s of this.list) {
      h.int(s.population).string(s.market ?? "");
      if (s.shrine || s.spring) h.string(s.shrine ?? "").string(s.spring ?? "");
    }
  }

  save(): unknown {
    return { settlements: this.list };
  }

  load(state: unknown): void {
    this.list = (state as { settlements: Settlement[] }).settlements.map((s) => ({ ...s }));
    this.byCell.clear();
    this.byRef.clear();
    this.founding = "";
    for (const s of this.list) {
      this.index(s);
      this.fold(s);
    }
  }
}

/** One migration: who went where, when, and why (a decision and its event). */
export type Flow = {
  readonly from: number;
  readonly to: number;
  readonly year: number;
  readonly count: number;
  /** Movers by occupation. */
  readonly byOccupation: readonly number[];
  readonly decision: Ref;
  readonly event: Ref;
};

/** A province's year in numbers. */
export type YearSummary = {
  readonly year: number;
  readonly population: number;
  readonly byOccupation: readonly number[];
  readonly fed: number;
  readonly settlements: number;
};

/**
 * The macro history (docs/architecture §15): births by province and year, deaths
 * by province, year and age band, every migration, and each province's year.
 */
/**
 * Births, deaths and moves are kept for living memory — as long as anyone alive could
 * have been born, died or moved — then let go (they are folded into the digest already).
 * A year's summary is kept every year for a century, then one year in ten.
 */
export const LIVING_MEMORY = 120;
const SUMMARY_YEARS = 100;

export class HistoryStore implements StateStore {
  readonly name = "population.history";
  private readonly births = new Map<number, number[]>();
  private readonly deaths = new Map<number, number[]>();
  private flowList: Flow[] = [];
  private readonly years = new Map<number, YearSummary[]>();
  private digest = "";
  private sealedYear = -1;
  private sealedFlows = 0;
  /** The first year births and deaths are still held for; how many moves have been let go. */
  private firstYear = 0;
  private flowBase = 0;

  addBirths(cell: number, year: number, n: number): void {
    const at = year - this.firstYear;
    if (!n || at < 0) return;
    const a = this.births.get(cell) ?? [];
    while (a.length <= at) a.push(0);
    a[at] = a[at]! + n;
    this.births.set(cell, a);
  }

  addDeaths(cell: number, year: number, band: number, n: number): void {
    const at = year - this.firstYear;
    if (!n || at < 0) return;
    const a = this.deaths.get(cell) ?? [];
    while (a.length < (at + 1) * BANDS) a.push(0);
    a[at * BANDS + band] = a[at * BANDS + band]! + n;
    this.deaths.set(cell, a);
  }

  addFlow(f: Flow): void {
    this.flowList.push(f);
  }

  addYear(cell: number, s: YearSummary): void {
    const a = this.years.get(cell) ?? [];
    a.push(s);
    this.years.set(cell, a);
  }

  birthsIn(cell: number, year: number): number {
    return year < this.firstYear ? 0 : (this.births.get(cell)?.[year - this.firstYear] ?? 0);
  }

  deathsIn(cell: number, year: number, band?: number): number {
    const a = this.deaths.get(cell);
    if (!a || year < this.firstYear) return 0;
    const at = year - this.firstYear;
    if (band !== undefined) return a[at * BANDS + band] ?? 0;
    let n = 0;
    for (let b = 0; b < BANDS; b++) n += a[at * BANDS + b] ?? 0;
    return n;
  }

  /** The moves still held (within living memory); the first is move number `flowOffset`. */
  flows(): readonly Flow[] {
    return this.flowList;
  }

  /** How many moves have been let go: move number i is flows()[i - flowOffset]. */
  get flowOffset(): number {
    return this.flowBase;
  }

  /** Move number i (numbered from the first ever), if it is still held. */
  flowAt(i: number): Flow | undefined {
    return this.flowList[i - this.flowBase];
  }

  flowsInto(cell: number): Flow[] {
    return this.flowList.filter((f) => f.to === cell);
  }

  yearsOf(cell: number): readonly YearSummary[] {
    return this.years.get(cell) ?? [];
  }

  /** Every event the ledgers hold on to: they must never be forgotten. */
  pinned(): Ref[] {
    return this.flowList.flatMap((f) => [f.decision, f.event]);
  }

  /**
   * Close a year: its lines — births, deaths, the year's summary, the moves — are
   * folded into the digest, never to change again, so a checkpoint hashes only the
   * year still open, however long history grows.
   */
  seal(year: number): void {
    const cells = [
      ...new Set([...this.births.keys(), ...this.deaths.keys(), ...this.years.keys()]),
    ].sort((a, b) => a - b);
    const h = new Hasher().string(this.digest).int(year),
      at = year - this.firstYear;
    for (const c of cells) {
      h.int(c).int(this.births.get(c)?.[at] ?? 0);
      const d = this.deaths.get(c);
      for (let b = 0; b < BANDS; b++) h.int(d?.[at * BANDS + b] ?? 0);
      const line = this.years.get(c)?.at(-1);
      if (line && line.year === year) h.value(line);
      else h.int(-1);
    }
    for (; this.sealedFlows < this.flowList.length; this.sealedFlows++)
      h.value(this.flowList[this.sealedFlows]);
    this.digest = h.hex();
    this.sealedYear = year;
    // Past living memory, a decade at a time: let the oldest births, deaths and moves go,
    // and thin the summaries of the years beyond a century to one in ten.
    if (year - this.firstYear >= LIVING_MEMORY + 10) {
      const drop = 10;
      for (const a of this.births.values()) a.splice(0, drop);
      for (const a of this.deaths.values()) a.splice(0, drop * BANDS);
      this.firstYear += drop;
      let gone = 0;
      while (gone < this.flowList.length && this.flowList[gone]!.year < this.firstYear) gone++;
      this.flowList.splice(0, gone);
      this.flowBase += gone;
      this.sealedFlows -= gone;
      for (const [c, lines] of this.years)
        this.years.set(
          c,
          lines.filter((s) => s.year >= year - SUMMARY_YEARS || s.year % 10 === 0),
        );
    }
  }

  hashInto(h: Hasher): void {
    h.string(this.digest).int(this.sealedYear).int(this.sealedFlows);
    // The year still open.
    const open = this.sealedYear + 1,
      first = this.firstYear,
      cells = [...new Set([...this.births.keys(), ...this.deaths.keys()])].sort((a, b) => a - b);
    for (const c of cells) {
      const born = this.births.get(c),
        dead = this.deaths.get(c);
      for (let y = open; y < first + (born?.length ?? 0); y++)
        h.int(c)
          .int(y)
          .int(born![y - first]!);
      for (let i = open * BANDS; i < first * BANDS + (dead?.length ?? 0); i++)
        h.int(c)
          .int(i)
          .int(dead![i - first * BANDS]!);
    }
    for (let i = this.sealedFlows; i < this.flowList.length; i++) h.value(this.flowList[i]);
  }

  save(): unknown {
    const obj = (m: Map<number, unknown>) =>
      [...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => [k, v] as [number, unknown]);
    return {
      births: obj(this.births),
      deaths: obj(this.deaths),
      flows: this.flowList,
      years: obj(this.years),
      digest: this.digest,
      sealedYear: this.sealedYear,
      sealedFlows: this.sealedFlows,
      firstYear: this.firstYear,
      flowBase: this.flowBase,
    };
  }

  load(state: unknown): void {
    const s = state as {
      births: [number, number[]][];
      deaths: [number, number[]][];
      flows: Flow[];
      years: [number, YearSummary[]][];
      digest: string;
      sealedYear: number;
      sealedFlows: number;
      firstYear?: number;
      flowBase?: number;
    };
    this.digest = s.digest;
    this.sealedYear = s.sealedYear;
    this.sealedFlows = s.sealedFlows;
    this.firstYear = s.firstYear ?? 0;
    this.flowBase = s.flowBase ?? 0;
    this.births.clear();
    this.deaths.clear();
    this.years.clear();
    for (const [k, v] of s.births) this.births.set(k, [...v]);
    for (const [k, v] of s.deaths) this.deaths.set(k, [...v]);
    for (const [k, v] of s.years)
      this.years.set(
        k,
        v.map((y) => ({ ...y })),
      );
    this.flowList = s.flows.map((f) => ({ ...f }));
  }
}

export const OCCUPATION_COUNT = OCCUPATIONS.length;
