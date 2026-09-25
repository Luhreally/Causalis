// The population's stores: the provinces (counts and food), the settlements, and
// the macro history — the birth, death and migration ledgers every later
// resolution of a person is conditioned on (docs/architecture §14–15).
import { defineKind, type Hasher, type Ref, type StateStore } from "../../kernel/index.ts";
import { BANDS, OCCUPATIONS } from "../../rules/index.ts";
import { Province } from "./model.ts";

export const SETTLEMENT = defineKind("town", "settlement", "minted");

export class PopulationStore implements StateStore {
  readonly name = "population.provinces";
  private readonly map = new Map<number, Province>();

  get(cell: number): Province | undefined {
    return this.map.get(cell);
  }

  add(p: Province): Province {
    if (this.map.has(p.cell)) throw new Error(`province ${p.cell} is already peopled`);
    this.map.set(p.cell, p);
    return p;
  }

  /** Every peopled province, in cell order (the order every system visits them). */
  all(): Province[] {
    return [...this.map.values()].sort((a, b) => a.cell - b.cell);
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
};

export class SettlementStore implements StateStore {
  readonly name = "population.settlements";
  private list: Settlement[] = [];

  add(s: Settlement): Settlement {
    this.list.push(s);
    return s;
  }

  all(): readonly Settlement[] {
    return this.list;
  }

  inProvince(cell: number): Settlement[] {
    return this.list.filter((s) => s.cell === cell);
  }

  get(ref: Ref): Settlement | undefined {
    return this.list.find((s) => s.ref === ref);
  }

  hashInto(h: Hasher): void {
    h.int(this.list.length);
    for (const s of this.list)
      h.string(s.ref)
        .string(s.name)
        .int(s.cell)
        .int(s.tile)
        .int(s.founded)
        .string(s.decision)
        .string(s.event)
        .int(s.population);
  }

  save(): unknown {
    return { settlements: this.list };
  }

  load(state: unknown): void {
    this.list = (state as { settlements: Settlement[] }).settlements.map((s) => ({ ...s }));
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
export class HistoryStore implements StateStore {
  readonly name = "population.history";
  private readonly births = new Map<number, number[]>();
  private readonly deaths = new Map<number, number[]>();
  private flowList: Flow[] = [];
  private readonly years = new Map<number, YearSummary[]>();

  addBirths(cell: number, year: number, n: number): void {
    if (!n) return;
    const a = this.births.get(cell) ?? [];
    while (a.length <= year) a.push(0);
    a[year] = a[year]! + n;
    this.births.set(cell, a);
  }

  addDeaths(cell: number, year: number, band: number, n: number): void {
    if (!n) return;
    const a = this.deaths.get(cell) ?? [];
    while (a.length < (year + 1) * BANDS) a.push(0);
    a[year * BANDS + band] = a[year * BANDS + band]! + n;
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
    return this.births.get(cell)?.[year] ?? 0;
  }

  deathsIn(cell: number, year: number, band?: number): number {
    const a = this.deaths.get(cell);
    if (!a) return 0;
    if (band !== undefined) return a[year * BANDS + band] ?? 0;
    let n = 0;
    for (let b = 0; b < BANDS; b++) n += a[year * BANDS + b] ?? 0;
    return n;
  }

  flows(): readonly Flow[] {
    return this.flowList;
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

  hashInto(h: Hasher): void {
    const cells = (m: Map<number, unknown>) => [...m.keys()].sort((a, b) => a - b);
    for (const c of cells(this.births)) h.int(c).value(this.births.get(c));
    for (const c of cells(this.deaths)) h.int(c).value(this.deaths.get(c));
    h.int(this.flowList.length);
    for (const f of this.flowList) h.value(f);
    for (const c of cells(this.years)) h.int(c).value(this.years.get(c));
  }

  save(): unknown {
    const obj = (m: Map<number, unknown>) =>
      [...m.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => [k, v] as [number, unknown]);
    return {
      births: obj(this.births),
      deaths: obj(this.deaths),
      flows: this.flowList,
      years: obj(this.years),
    };
  }

  load(state: unknown): void {
    const s = state as {
      births: [number, number[]][];
      deaths: [number, number[]][];
      flows: Flow[];
      years: [number, YearSummary[]][];
    };
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
