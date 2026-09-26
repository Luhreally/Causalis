// Markets (docs/architecture §20): one per peopled province. A market holds the
// province's goods as integer stocks and a price for each — a value signal, since
// there is no money yet — and keeps a ledger of the year: what was made, used,
// brought in and sent out, what spoiled, and what migrants carried. Every change
// to a stock goes through the ledger, so a year always balances.
import { Hasher, defineKind, makeRef, type Ref, type StateStore } from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import { G, GOODS, OCCUPATIONS } from "../../rules/index.ts";

export const GOOD_COUNT = GOODS.length;

/** A good's market in a province: why its price is what it is. */
export const MARKET_GOOD = defineKind("mkt", "a good in a market", "structural");
export function marketGoodRef(cell: number, good: number): Ref {
  return makeRef(MARKET_GOOD, cell, good);
}

export const LEDGER = ["made", "used", "in", "out", "spoiled", "carriedIn", "carriedOut"] as const;
export type LedgerLine = (typeof LEDGER)[number];
const LINE: Readonly<Record<LedgerLine, number>> = {
  made: 0,
  used: 1,
  in: 2,
  out: 3,
  spoiled: 4,
  carriedIn: 5,
  carriedOut: 6,
};
const INCREASES: readonly boolean[] = [true, false, true, false, false, true, false];

/** A market's year, kept for the charts and the explainer. */
export type MarketYear = {
  readonly year: number;
  readonly price: readonly number[];
  readonly stock: readonly number[];
  /** By ledger line, then good. */
  readonly ledger: readonly (readonly number[])[];
};

/** How many years of each market's full books are kept (the explainer reads the last). */
export const MARKET_YEARS = 5;
/** A market's prices through the years, for the charts: every year for this long, then every tenth. */
export const PRICE_YEARS = 100;

/** What food and tools cost against their usual worth, in a year (thousandths). */
export type PricePoint = { readonly year: number; readonly food: number; readonly tools: number };

export class Market {
  readonly cell: number;
  readonly ref: Ref;
  readonly stock = new Array<number>(GOOD_COUNT).fill(0);
  readonly price = GOODS.map((g) => g.value);
  /** This year's ledger: line × good. */
  readonly ledger = new Array<number>(LEDGER.length * GOOD_COUNT).fill(0);
  /** The stock when this year began. */
  readonly opening = new Array<number>(GOOD_COUNT).fill(0);
  /** Last year's share of what was wanted that was had, in thousandths. */
  toolCover = 0;
  clothingCover = 0;
  potteryCover = 0;
  /** What a year of each occupation's work was worth last year, in grain. */
  readonly wage = new Array<number>(OCCUPATIONS.length).fill(0);
  /** What the province's carriers earned moving goods last year, in grain. */
  tradeMargin = 0;
  /** Whether its people know how to smelt and work metal, and how they came to. */
  metalworking: Ref | null = null;
  /** The famine the latest relief answered, so one famine brings one relief. */
  reliefFor: Ref | null = null;
  years: MarketYear[] = [];
  /** Prices through the years, thinned with age. */
  series: PricePoint[] = [];
  /** Every closed year folded in as it closed, so a checkpoint need not hash them all again. */
  yearsDigest = "";

  constructor(cell: number) {
    this.cell = cell;
    this.ref = cellRef(0, cell);
  }

  line(line: LedgerLine, good: number): number {
    return this.ledger[LINE[line] * GOOD_COUNT + good]!;
  }

  /** Change a stock through a ledger line; returns the amount moved. */
  move(line: LedgerLine, good: number, n: number): number {
    if (!Number.isInteger(n) || n < 0) throw new Error(`bad amount ${n} of ${GOODS[good]!.id}`);
    if (!n) return 0;
    const up = INCREASES[LINE[line]]!;
    if (!up && n > this.stock[good]!)
      throw new Error(`${this.cell} has ${this.stock[good]} ${GOODS[good]!.id}, not ${n}`);
    this.stock[good] = this.stock[good]! + (up ? n : -n);
    const i = LINE[line] * GOOD_COUNT + good;
    this.ledger[i] = this.ledger[i]! + n;
    return n;
  }

  /** Take up to n, as much as there is. */
  take(line: LedgerLine, good: number, n: number): number {
    return this.move(line, good, Math.min(n, this.stock[good]!));
  }

  food(foods: readonly number[]): number {
    let n = 0;
    for (const g of foods) n += this.stock[g]!;
    return n;
  }

  /** Close the year: keep its line, start the next. */
  closeYear(year: number): void {
    const ledger = LEDGER.map((_, l) => this.ledger.slice(l * GOOD_COUNT, (l + 1) * GOOD_COUNT));
    const line: MarketYear = { year, price: [...this.price], stock: [...this.stock], ledger };
    this.years.push(line);
    this.yearsDigest = new Hasher().string(this.yearsDigest).value(line).hex();
    if (this.years.length > MARKET_YEARS) this.years.splice(0, this.years.length - MARKET_YEARS);
    const ratio = (g: number) => Math.round((1000 * this.price[g]!) / GOODS[g]!.value);
    this.series.push({ year, food: ratio(G.grain), tools: ratio(G.tools) });
    // Older than a century, keep one year in ten.
    const old = this.series.length - PRICE_YEARS - 1;
    if (old >= 0 && this.series[old]!.year % 10 !== 0) this.series.splice(old, 1);
    this.ledger.fill(0);
    this.opening.splice(0, GOOD_COUNT, ...this.stock);
  }

  hashInto(h: Hasher): void {
    h.int(this.cell).value(this.stock).value(this.opening).value(this.ledger);
    for (const p of this.price) h.float(p);
    for (const w of this.wage) h.float(w);
    h.int(this.toolCover)
      .int(this.clothingCover)
      .int(this.potteryCover)
      .float(this.tradeMargin)
      .string(this.metalworking ?? "")
      .string(this.reliefFor ?? "")
      .string(this.yearsDigest)
      .int(this.series.length);
  }

  save(): unknown {
    return {
      cell: this.cell,
      stock: this.stock,
      price: this.price,
      ledger: this.ledger,
      opening: this.opening,
      toolCover: this.toolCover,
      clothingCover: this.clothingCover,
      potteryCover: this.potteryCover,
      wage: this.wage,
      tradeMargin: this.tradeMargin,
      metalworking: this.metalworking,
      reliefFor: this.reliefFor,
      years: this.years,
      yearsDigest: this.yearsDigest,
      series: this.series,
    };
  }

  static load(state: unknown): Market {
    const s = state as ReturnType<Market["save"]> & Record<string, unknown>;
    const m = new Market(s.cell as number);
    const fill = (into: number[], from: unknown) =>
      into.splice(0, into.length, ...(from as number[]));
    fill(m.stock, s.stock);
    fill(m.price, s.price);
    fill(m.ledger, s.ledger);
    fill(m.opening, s.opening);
    fill(m.wage, s.wage);
    m.toolCover = s.toolCover as number;
    m.clothingCover = s.clothingCover as number;
    m.potteryCover = s.potteryCover as number;
    m.tradeMargin = s.tradeMargin as number;
    m.metalworking = s.metalworking as Ref | null;
    m.reliefFor = s.reliefFor as Ref | null;
    m.years = s.years as MarketYear[];
    m.yearsDigest = s.yearsDigest as string;
    m.series = s.series as PricePoint[];
    return m;
  }
}

/** Goods moved between two markets in a year. */
export type TradeFlow = {
  readonly from: number;
  readonly to: number;
  readonly good: number;
  readonly count: number;
};

export class MarketStore implements StateStore {
  readonly name = "economy.markets";
  private readonly map = new Map<number, Market>();
  /** Routes that have carried goods, by "a:b" (a < b): the event that opened each. */
  private readonly routes = new Map<string, Ref>();
  /** Those of them that cross the sea, and each land's partners across it (in cell order). */
  private readonly sea = new Set<string>();
  private readonly partners = new Map<number, number[]>();
  /** Last year's trade, in canonical order. */
  flows: TradeFlow[] = [];

  get(cell: number): Market | undefined {
    return this.map.get(cell);
  }

  /** The market of a province, opened the first time it is needed. */
  of(cell: number): Market {
    let m = this.map.get(cell);
    if (!m) this.map.set(cell, (m = new Market(cell)));
    return m;
  }

  all(): Market[] {
    return [...this.map.values()].sort((a, b) => a.cell - b.cell);
  }

  route(a: number, b: number): Ref | undefined {
    return this.routes.get(a < b ? `${a}:${b}` : `${b}:${a}`);
  }

  openRoute(a: number, b: number, event: Ref, bySea = false): void {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    this.routes.set(key, event);
    if (bySea) this.crossing(key);
  }

  private crossing(key: string): void {
    this.sea.add(key);
    const [a, b] = key.split(":").map(Number) as [number, number];
    for (const [x, y] of [
      [a, b],
      [b, a],
    ] as const) {
      const list = this.partners.get(x) ?? [];
      if (!list.includes(y)) list.push(y);
      list.sort((u, v) => u - v);
      this.partners.set(x, list);
    }
  }

  /** Whether the road between two lands crosses the sea. */
  bySea(a: number, b: number): boolean {
    return this.sea.has(a < b ? `${a}:${b}` : `${b}:${a}`);
  }

  /** The lands a land's ships have reached across the sea. */
  seaPartners(cell: number): readonly number[] {
    return this.partners.get(cell) ?? [];
  }

  allRoutes(): [string, Ref][] {
    return [...this.routes.entries()].sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  }

  /** What history must keep for the markets to explain themselves: roads opened, crafts learned. */
  pinned(): Ref[] {
    const refs = this.allRoutes().map(([, r]) => r);
    for (const m of this.all()) if (m.metalworking) refs.push(m.metalworking);
    return refs;
  }

  /** What each occupation's year of work was worth in a province last year, if it has a market. */
  wagesOf(cell: number): readonly number[] | null {
    const m = this.map.get(cell);
    return m && m.years.length ? m.wage : null;
  }

  hashInto(h: Hasher): void {
    const all = this.all();
    h.int(all.length);
    for (const m of all) m.hashInto(h);
    h.value(this.allRoutes())
      .value(this.flows)
      .value([...this.sea].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
  }

  save(): unknown {
    return {
      markets: this.all().map((m) => m.save()),
      routes: this.allRoutes(),
      sea: [...this.sea].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)),
      flows: this.flows,
    };
  }

  load(state: unknown): void {
    const s = state as {
      markets: unknown[];
      routes: [string, Ref][];
      sea?: string[];
      flows: TradeFlow[];
    };
    this.map.clear();
    for (const m of s.markets) {
      const market = Market.load(m);
      this.map.set(market.cell, market);
    }
    this.routes.clear();
    for (const [k, v] of s.routes) this.routes.set(k, v);
    this.sea.clear();
    this.partners.clear();
    for (const k of s.sea ?? []) this.crossing(k);
    this.flows = s.flows;
  }
}
