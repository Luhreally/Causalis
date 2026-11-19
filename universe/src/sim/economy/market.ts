// Markets (docs/architecture §20): one per peopled province. A market holds the
// province's goods as integer stocks and a price for each — a value signal, since
// there is no money yet — and keeps a ledger of the year: what was made, used,
// brought in and sent out, what spoiled, and what migrants carried. Every change
// to a stock goes through the ledger, so a year always balances.
import { Hasher, defineKind, makeRef, type Ref, type StateStore } from "../../kernel/index.ts";
import { cellRef } from "../../gen/index.ts";
import { G, GLUT_YEARS, GOODS, OCCUPATIONS, type ToolMetal } from "../../rules/index.ts";

export const GOOD_COUNT = GOODS.length;
/** More than any land's number: two lands as one number (MarketStore.route). */
const ROUTE_SPAN = 2 ** 24;

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

/** What went of a good in one closed year's books: used, passed on within the year, and sent away of what was made there. */
function wentOf(y: readonly (readonly number[] | undefined)[], good: number): number {
  const made = y[LINE.made]?.[good] ?? 0,
    used = y[LINE.used]?.[good] ?? 0,
    came = y[LINE.in]?.[good] ?? 0,
    left = y[LINE.out]?.[good] ?? 0;
  return used + Math.min(came, left) + Math.min(made, Math.max(0, left - came));
}

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
/**
 * And past this, every fiftieth: a chart of a far world's three thousand years draws no more than that, and each of its six hundred
 * markets kept three hundred points of its far past, a tenth of its save's markets.
 */
export const PRICE_CENTURIES = 500;

/** What food and tools cost against their usual worth, in a year (thousandths). */
export type PricePoint = { readonly year: number; readonly food: number; readonly tools: number };

/**
 * From a year on, the metal most of a land's crafted tools were headed with (Phase 52 M216), and
 * the event that told it the first time the land made tools of a better metal than ever before.
 */
export type ToolMetalPoint = {
  readonly year: number;
  readonly metal: ToolMetal;
  readonly event: Ref | null;
};

/** A metal's point folded into its list's running fingerprint. */
function foldMetal(
  was: readonly [number, number],
  year: number,
  metal: string,
  event: Ref | null,
): [number, number] {
  return new Hasher()
    .word(was[0])
    .word(was[1])
    .int(year)
    .string(metal)
    .string(event ?? "")
    .lanes();
}

/** A market's metals are told year by year this far back (its kept years, and a lifetime's page); before, only each metal's first. */
export const METAL_YEARS = 120;

/**
 * A metal history thinned, or null where there is nothing to thin (looked at once in eight changes, past two dozen): each metal's
 * first point stays (when it first headed tools here, and the event of it), every change of the last METAL_YEARS, and the one
 * standing as they began. A market between two ores changes back and forth for an age: at year 1,500 the lists held 190,000 points.
 */
function metalsKept<T extends { readonly year: number; readonly metal: ToolMetal }>(
  list: readonly T[],
  year: number,
): T[] | null {
  const n = list.length;
  if (n <= 24 || n % 8 !== 0) return null;
  const cut = year - METAL_YEARS,
    seen = new Set<ToolMetal>(),
    out: T[] = [];
  for (let i = 0; i < n; i++) {
    const x = list[i]!,
      first = !seen.has(x.metal);
    seen.add(x.metal);
    if (first || x.year > cut || (i + 1 < n && list[i + 1]!.year > cut)) out.push(x);
  }
  return out.length < n ? out : null;
}

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
  /** Of machines its workers wear out, and of fuel its engines would burn (Phase 3 M32). */
  machineCover = 0;
  powerCover = 0;
  /**
   * Of its crafters' year, the share there was use for the work of last year (thousandths; 1000 where it has no crafters): the
   * rest of their days they had nothing to make that anyone would use. What a crafter earned follows it (economy/systems.ts
   * wages), and its hands without work are who the underworld's idle are (sim/order/underworld.ts).
   */
  craftsWorked = 1000;
  /** Fuel its engines burned last year (units of coal and oil), for its power. */
  burned = 0;
  /** The year its works can run again after a rocket's fall (W3; 0: they do). */
  idleUntil = 0;
  /** Its first coal dug, first oil drawn and first machines made: the events. */
  mine: Ref | null = null;
  well: Ref | null = null;
  works: Ref | null = null;
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
  /** What its crafted tools were headed with, from each year it changed (Phase 52 M216). */
  toolMetals: ToolMetalPoint[] = [];
  /**
   * The best metal its crafters headed any tools with — what its smiths forged — from each year it
   * changed (M217; stone: none). Its tools in the main may still be stone.
   */
  forgedMetals: { readonly year: number; readonly metal: ToolMetal }[] = [];
  /** Each list's points folded in as they were added (read again off the lists on loading; never saved). */
  private toolFold: readonly [number, number] = [0, 0];
  private forgedFold: readonly [number, number] = [0, 0];
  /**
   * Whether this year's books are open with the economy's year reckoned in them: within the
   * moment the year turns, between the economy's year and the books closing. Never saved: the
   * books are always closed between moments.
   */
  reckoned = false;

  constructor(cell: number) {
    this.cell = cell;
    this.ref = cellRef(0, cell);
  }

  line(line: LedgerLine, good: number): number {
    return this.ledger[LINE[line] * GOOD_COUNT + good]!;
  }

  /**
   * A line of the latest reckoned year's books: this year's while they are open with the
   * economy's year in them, else the last closed year's — so the sim within the moment and the
   * pages between moments read the same year.
   */
  book(line: LedgerLine, good: number): number {
    if (this.reckoned) return this.line(line, good);
    return this.years.at(-1)?.ledger[LINE[line]]?.[good] ?? 0;
  }

  /**
   * What goes of a good here in a year: the most, in any of the last GLUT_YEARS closed years (the most, for a good smelted one
   * year is worked the next), of what it used, what it sent on of what came in that same year, and what it sent away of its own
   * making. What its making and what traders bring it are bounded by. (It was all it used and sent on, whatever it sent: a good
   * no one there used, sent on one year and brought back the next, counted as its use each time it left, and a market took in
   * three years of such "use". By first light's 1,500 a land of 66 million that wore out ten million garments a year took in six
   * thousand million one year and sent them all on the next, 96 a head, and the world's markets passed 260 thousand million
   * garments a year between them while 3 thousand million were worn: scratchpad/release/st4.mts.)
   */
  goes(good: number): number {
    let most = 0;
    for (let i = Math.max(0, this.years.length - GLUT_YEARS); i < this.years.length; i++)
      most = Math.max(most, wentOf(this.years[i]!.ledger, good));
    return most;
  }
  /** The same of its last closed year alone. */
  went(good: number): number {
    const last = this.years.at(-1)?.ledger;
    return last ? wentOf(last, good) : 0;
  }

  /** What its crafted tools were headed with in a year (now, if none is given); null: never said. */
  toolMetalIn(year?: number): ToolMetal | null {
    for (let i = this.toolMetals.length - 1; i >= 0; i--) {
      const p = this.toolMetals[i]!;
      if (year === undefined || p.year <= year) return p.metal;
    }
    return this.toolMetals.length ? "stone" : null;
  }

  /** Set down what its crafted tools were headed with this year, if it changed. */
  setToolMetal(year: number, metal: ToolMetal, event: Ref | null): void {
    if (this.toolMetals.at(-1)?.metal === metal) return;
    this.toolMetals.push({ year, metal, event });
    this.toolFold = foldMetal(this.toolFold, year, metal, event);
    const kept = metalsKept(this.toolMetals, year);
    if (kept) {
      this.toolMetals = kept;
      this.toolFold = [0, 0];
      for (const x of kept) this.toolFold = foldMetal(this.toolFold, x.year, x.metal, x.event);
    }
  }

  /** What its smiths forged in a year (now, if none is given); null: never said. */
  forgedIn(year?: number): ToolMetal | null {
    for (let i = this.forgedMetals.length - 1; i >= 0; i--) {
      const p = this.forgedMetals[i]!;
      if (year === undefined || p.year <= year) return p.metal;
    }
    return this.forgedMetals.length ? "stone" : null;
  }

  /** Set down what its smiths forged this year, if it changed. */
  setForged(year: number, metal: ToolMetal): void {
    if ((this.forgedMetals.at(-1)?.metal ?? "stone") === metal) return;
    this.forgedMetals.push({ year, metal });
    this.forgedFold = foldMetal(this.forgedFold, year, metal, null);
    const kept = metalsKept(this.forgedMetals, year);
    if (kept) {
      this.forgedMetals = kept;
      this.forgedFold = [0, 0];
      for (const x of kept) this.forgedFold = foldMetal(this.forgedFold, x.year, x.metal, null);
    }
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
    this.reckoned = false;
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
    // Older than five centuries, one in fifty (the point that passes that age this year, if it was kept).
    const far = year - PRICE_CENTURIES;
    if (far > 0 && far % 10 === 0 && far % 50 !== 0) {
      let lo = 0,
        hi = this.series.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (this.series[mid]!.year < far) lo = mid + 1;
        else hi = mid;
      }
      if (this.series[lo]?.year === far) this.series.splice(lo, 1);
    }
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
      .int(this.machineCover)
      .int(this.powerCover)
      .int(this.craftsWorked)
      .int(this.burned)
      .string(this.mine ?? "")
      .string(this.well ?? "")
      .string(this.works ?? "")
      .float(this.tradeMargin)
      .string(this.metalworking ?? "")
      .string(this.reliefFor ?? "")
      .string(this.yearsDigest)
      .int(this.series.length)
      // (Its metals' histories only ever grow: each point is folded in as it is added, and a checkpoint hashes the fold, not
      // every point again. They were nine tenths of a checkpoint's work at year 1,500.)
      .int(this.toolMetals.length)
      .word(this.toolFold[0])
      .word(this.toolFold[1])
      .int(this.forgedMetals.length)
      .word(this.forgedFold[0])
      .word(this.forgedFold[1]);
    // (Only while its works stand idle, W3: a market without it hashes as it did.)
    if (this.idleUntil) h.int(this.idleUntil);
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
      machineCover: this.machineCover,
      powerCover: this.powerCover,
      craftsWorked: this.craftsWorked,
      burned: this.burned,
      mine: this.mine,
      well: this.well,
      works: this.works,
      ...(this.idleUntil ? { idleUntil: this.idleUntil } : {}),
      wage: this.wage,
      tradeMargin: this.tradeMargin,
      metalworking: this.metalworking,
      reliefFor: this.reliefFor,
      years: this.years,
      yearsDigest: this.yearsDigest,
      series: this.series,
      toolMetals: this.toolMetals,
      forgedMetals: this.forgedMetals,
    };
  }

  static load(state: unknown): Market {
    const s = state as ReturnType<Market["save"]> & Record<string, unknown>;
    const m = new Market(s.cell as number);
    // A save from before goods were added holds fewer: those it lacks start empty (at
    // their usual price), and its ledger's lines are laid out by the goods it had.
    const had = (s.stock as number[]).length,
      fill = (into: number[], from: unknown) => {
        const v = from as number[];
        for (let i = 0; i < v.length && i < into.length; i++) into[i] = v[i]!;
      };
    fill(m.stock, s.stock);
    fill(m.price, s.price);
    fill(m.opening, s.opening);
    fill(m.wage, s.wage);
    const ledger = s.ledger as number[];
    for (let l = 0; l < LEDGER.length; l++)
      for (let g = 0; g < had && g < GOOD_COUNT; g++)
        m.ledger[l * GOOD_COUNT + g] = ledger[l * had + g]!;
    m.toolCover = s.toolCover as number;
    m.clothingCover = s.clothingCover as number;
    m.potteryCover = s.potteryCover as number;
    m.machineCover = (s.machineCover as number | undefined) ?? 0;
    m.powerCover = (s.powerCover as number | undefined) ?? 0;
    m.craftsWorked = (s.craftsWorked as number | undefined) ?? 1000;
    m.burned = (s.burned as number | undefined) ?? 0;
    m.mine = (s.mine as Ref | null | undefined) ?? null;
    m.well = (s.well as Ref | null | undefined) ?? null;
    m.works = (s.works as Ref | null | undefined) ?? null;
    m.idleUntil = (s.idleUntil as number | undefined) ?? 0;
    m.tradeMargin = s.tradeMargin as number;
    m.metalworking = s.metalworking as Ref | null;
    m.reliefFor = s.reliefFor as Ref | null;
    m.years = s.years as MarketYear[];
    m.yearsDigest = s.yearsDigest as string;
    m.series = s.series as PricePoint[];
    m.toolMetals = (s.toolMetals as ToolMetalPoint[] | undefined) ?? [];
    m.forgedMetals = (s.forgedMetals as Market["forgedMetals"] | undefined) ?? [];
    // (The folds are read off the lists as loaded: the same as folded point by point.)
    for (const x of m.toolMetals) m.toolFold = foldMetal(m.toolFold, x.year, x.metal, x.event);
    for (const x of m.forgedMetals) m.forgedFold = foldMetal(m.forgedFold, x.year, x.metal, null);
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

/**
 * Who keeps goods outside every market: a faith's granaries (sim/belief/temple.ts), the holds of ships between the stars
 * (sim/space/trade.ts), a far people's own worlds (sim/space/peoples.ts). What a market sends one of them is on its "out" line
 * and what one gives a market on its "in" line, as with any trade; and the store keeps, keeper by keeper and good by good, what
 * each took and gave in each year its markets keep, so that a year's "out" and "in" over all markets differ by exactly these.
 */
export const KEEPERS = ["granaries", "holds", "far"] as const;
export type Keeper = (typeof KEEPERS)[number];
/** A keeper's year in one good: what markets sent it and what it gave markets. */
export type KeptApart = readonly [keeper: number, good: number, took: number, gave: number];
export type ApartYear = { readonly year: number; readonly rows: readonly KeptApart[] };

export class MarketStore implements StateStore {
  readonly name = "economy.markets";
  /** Saved packed by column (kernel/pack.ts): each market keeps a row of numbers a year. */
  readonly packed = true;
  private readonly map = new Map<number, Market>();
  /** Routes that have carried goods, by "a:b" (a < b): the event that opened each. */
  private readonly routes = new Map<string, Ref>();
  /**
   * (The same roads by their two lands as one number, the lesser times ROUTE_SPAN and the greater: a road is asked for of every
   * flow and every neighbour, tens of thousands of times a year, and its key spelt each time was a good part of each asking.
   * Not state: kept as roads open, made anew on loading. `routesPlain`: every key is two lands' numbers so spelt, else the
   * spelt keys are asked.)
   */
  private readonly routeAt = new Map<number, Ref>();
  private routesPlain = true;
  private routeKept(key: string, event: Ref): void {
    const cut = key.indexOf(":"),
      a = Number(key.slice(0, cut)),
      b = Number(key.slice(cut + 1));
    if (
      cut > 0 &&
      Number.isInteger(a) &&
      Number.isInteger(b) &&
      a >= 0 &&
      a <= b &&
      b < ROUTE_SPAN &&
      `${a}:${b}` === key
    )
      this.routeAt.set(a * ROUTE_SPAN + b, event);
    else this.routesPlain = false;
  }
  /** Those of them that cross the sea, and each land's partners across it (in cell order). */
  private readonly sea = new Set<string>();
  private readonly partners = new Map<number, number[]>();
  /** Last year's trade, in canonical order. */
  flows: TradeFlow[] = [];
  /** What keepers outside the markets took and gave, in each year the markets keep (KEEPERS). */
  apart: ApartYear[] = [];
  /** The same of the year whose books are open, by keeper and good (keeper x GOOD_COUNT + good). */
  private readonly apartOpen = new Map<number, [took: number, gave: number]>();

  private apartRow(keeper: Keeper, good: number): [number, number] {
    const k = KEEPERS.indexOf(keeper) * GOOD_COUNT + good;
    let row = this.apartOpen.get(k);
    if (!row) this.apartOpen.set(k, (row = [0, 0]));
    return row;
  }

  /** Goods leave a market for a keeper outside every market; returns the amount. */
  sendApart(keeper: Keeper, m: Market, good: number, n: number): number {
    const moved = m.move("out", good, n);
    if (moved) this.apartRow(keeper, good)[0] += moved;
    return moved;
  }

  /** Goods come to a market from a keeper outside every market; returns the amount. */
  bringFromApart(keeper: Keeper, m: Market, good: number, n: number): number {
    const moved = m.move("in", good, n);
    if (moved) this.apartRow(keeper, good)[1] += moved;
    return moved;
  }

  /** The open year's rows, in keeper then good order. */
  private apartRows(): KeptApart[] {
    return [...this.apartOpen]
      .sort((a, b) => a[0] - b[0])
      .map(
        ([k, [took, gave]]) => [Math.floor(k / GOOD_COUNT), k % GOOD_COUNT, took, gave] as const,
      );
  }

  /** Close the keepers' year with the markets'. */
  closeApart(year: number): void {
    this.apart.push({ year, rows: this.apartRows() });
    this.apartOpen.clear();
    if (this.apart.length > MARKET_YEARS) this.apart.splice(0, this.apart.length - MARKET_YEARS);
  }
  /**
   * The same flows by each land they leave or reach, as their places in `flows` (a cache, never
   * saved: made again whenever the year's trade is set anew, or added to).
   */
  private flowsByLand: {
    readonly flows: readonly TradeFlow[];
    readonly length: number;
    readonly at: Map<number, number[]>;
  } | null = null;

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
    if (
      this.routesPlain &&
      a >= 0 &&
      b >= 0 &&
      a < ROUTE_SPAN &&
      b < ROUTE_SPAN &&
      (a | 0) === a &&
      (b | 0) === b
    )
      return this.routeAt.get(a < b ? a * ROUTE_SPAN + b : b * ROUTE_SPAN + a);
    return this.routes.get(a < b ? `${a}:${b}` : `${b}:${a}`);
  }

  /** Last year's flows out of or into any of these lands, each once, in canonical order. */
  flowsOf(cells: readonly number[]): TradeFlow[] {
    let index = this.flowsByLand;
    if (index?.flows !== this.flows || index.length !== this.flows.length) {
      const at = new Map<number, number[]>();
      this.flows.forEach((f, i) => {
        for (const cell of f.from === f.to ? [f.from] : [f.from, f.to]) {
          const list = at.get(cell);
          if (list) list.push(i);
          else at.set(cell, [i]);
        }
      });
      this.flowsByLand = index = { flows: this.flows, length: this.flows.length, at };
    }
    const seen = new Set<number>();
    for (const cell of cells) for (const i of index.at.get(cell) ?? []) seen.add(i);
    return [...seen].sort((a, b) => a - b).map((i) => this.flows[i]!);
  }

  /**
   * What a flow counts for as trade that binds the two lands it passed between, in units of its good: each good counted once
   * on its way from where it was made to where it is used, however many borders it crossed. A flow is a year's goods over one
   * border, and a good carried on is a flow again at the next: summed as they stand, a bale sold across four realms was four
   * realms' trade with their neighbours, and a realm on the road "traded" more than everything it used. So half of a flow
   * counts as far as it is the sender's own (of all it sent of the good in the year, what it did not itself take in), half as
   * far as it stays with the taker (of all it took in, what it did not send on); and what was only carried through counts for
   * what the carrying earned, the share of its worth where it came that it gained on the way: a toll's worth of tie, not a
   * trade's. Read off the year's flows alone (and the prices that year left), so what is kept of a reading of them stands
   * while they do.
   */
  boundOf(f: TradeFlow): number {
    let sums = this.flowSums;
    if (sums?.flows !== this.flows || sums.length !== this.flows.length) {
      const by = new Map<number, [sent: number, taken: number]>(),
        at = (cell: number, good: number) => {
          const k = cell * GOOD_COUNT + good;
          let row = by.get(k);
          if (!row) by.set(k, (row = [0, 0]));
          return row;
        };
      for (const x of this.flows) {
        at(x.from, x.good)[0] += x.count;
        at(x.to, x.good)[1] += x.count;
      }
      this.flowSums = sums = { flows: this.flows, length: this.flows.length, by };
    }
    const a = sums.by.get(f.from * GOOD_COUNT + f.good),
      b = sums.by.get(f.to * GOOD_COUNT + f.good);
    if (!a || !b || !(a[0] > 0) || !(b[1] > 0)) return f.count;
    const own = Math.max(0, a[0] - a[1]) / a[0],
      stays = Math.max(0, b[1] - b[0]) / b[1],
      whole = (own + stays) / 2,
      here = this.map.get(f.from)?.price[f.good] ?? 0,
      there = this.map.get(f.to)?.price[f.good] ?? 0,
      gained = there > 0 ? Math.max(0, 1 - here / there) : 0;
    return f.count * (whole + (1 - whole) * gained);
  }
  /** What each land sent and took of each good in the year's flows (a cache, never saved: made again with the year's trade). */
  private flowSums: {
    readonly flows: readonly TradeFlow[];
    readonly length: number;
    readonly by: Map<number, [sent: number, taken: number]>;
  } | null = null;

  /** (A count of roads opened or opened anew: what is kept of a reading of them is kept by it. Not state; it only grows.) */
  roadsOpened = 0;

  openRoute(a: number, b: number, event: Ref, bySea = false): void {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    this.routes.set(key, event);
    this.routeKept(key, event);
    this.roadsOpened++;
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
    for (const m of this.all()) {
      for (const r of [m.metalworking, m.mine, m.well, m.works]) if (r) refs.push(r);
      for (const p of m.toolMetals) if (p.event) refs.push(p.event);
    }
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
      .value(this.apart)
      .value(this.apartRows())
      .value([...this.sea].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
  }

  save(): unknown {
    return {
      markets: this.all().map((m) => m.save()),
      routes: this.allRoutes(),
      sea: [...this.sea].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)),
      flows: this.flows,
      apart: this.apart,
      apartOpen: this.apartRows(),
    };
  }

  load(state: unknown): void {
    const s = state as {
      markets: unknown[];
      routes: [string, Ref][];
      sea?: string[];
      flows: TradeFlow[];
      apart?: ApartYear[];
      apartOpen?: KeptApart[];
    };
    this.map.clear();
    for (const m of s.markets) {
      const market = Market.load(m);
      this.map.set(market.cell, market);
    }
    this.routes.clear();
    this.routeAt.clear();
    this.routesPlain = true;
    this.roadsOpened++;
    for (const [k, v] of s.routes) {
      this.routes.set(k, v);
      this.routeKept(k, v);
    }
    this.sea.clear();
    this.partners.clear();
    for (const k of s.sea ?? []) this.crossing(k);
    this.flows = s.flows;
    this.apart = s.apart ?? [];
    this.apartOpen.clear();
    for (const [keeper, good, took, gave] of s.apartOpen ?? [])
      this.apartOpen.set(keeper * GOOD_COUNT + good, [took, gave]);
  }
}
