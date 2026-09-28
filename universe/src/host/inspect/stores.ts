// Stores broken down (Phase 15 M123, asked for 2026-09-28: Classic's detail — "it breaks down
// inventory"): a land's stores by good (units, weight, worth, how long each lasts at last
// year's use) and by what they are made of; each good's year as a flow — what it began with,
// each line in and out, what it ended with — that must balance, as Classic's conservation
// ledger showed its matter; a realm's and the world's stores summed. Pure reads of the
// markets' books, which every change to a stock goes through (sim/economy/market.ts).
import { FOODS, GOODS, GOOD_MATTER, SUBSTANCE, SUBSTANCES } from "../../rules/index.ts";
import type { World } from "../../kernel/index.ts";
import {
  LEDGER,
  populationContext,
  type Market,
  type MarketStore,
  type MarketYear,
} from "../../sim/index.ts";
import type { Block, Line, Row } from "../../bridge/index.ts";
import { count, link, stat } from "./words.ts";
import { landLink } from "./names.ts";
import { elementsOf, goodHere, weight } from "./matter.ts";

/** Each ledger line as a flow says it, and which way it moves a stock. */
const LINES: Readonly<Record<(typeof LEDGER)[number], { words: string; sign: 1 | -1 }>> = {
  made: { words: "made here (fields, herds, the wild, crafts and works)", sign: 1 },
  in: { words: "brought in by road and sea", sign: 1 },
  carriedIn: { words: "carried in by those who came", sign: 1 },
  used: { words: "used (eaten, worn out, worked into other goods, burned)", sign: -1 },
  out: { words: "sent out", sign: -1 },
  spoiled: { words: "spoiled in store", sign: -1 },
  carriedOut: { words: "carried out by those who left", sign: -1 },
};

/** A good's year: what it began with, each line, what it ended with, and whether they balance. */
export type GoodFlow = {
  readonly opening: number;
  readonly lines: readonly { readonly line: (typeof LEDGER)[number]; readonly value: number }[];
  readonly closing: number;
  /** Closing less what the opening and the lines make: zero when the books balance. */
  readonly out: number;
};

/**
 * A good's flow in a closed year of a market's books (its opening the year before's close,
 * where that is kept), or in the year so far (`year` null: the opening this year began with).
 */
export function flowOf(m: Market, g: number, year: MarketYear | null): GoodFlow | null {
  let opening: number, closing: number, ledger: (line: number) => number;
  if (year) {
    const i = m.years.indexOf(year),
      before = i > 0 ? m.years[i - 1] : undefined;
    if (!before) return null;
    opening = before.stock[g]!;
    closing = year.stock[g]!;
    ledger = (l) => year.ledger[l]![g]!;
  } else {
    opening = m.opening[g]!;
    closing = m.stock[g]!;
    ledger = (l) => m.line(LEDGER[l]!, g);
  }
  const lines = LEDGER.map((line, l) => ({ line, value: ledger(l) }));
  let sum = opening;
  for (const x of lines) sum += LINES[x.line].sign * x.value;
  return { opening, lines, closing, out: closing - sum };
}

/** A flow as a page's block (`ongoing`: a year not yet over, which stands at its close). */
export function flowBlock(title: string, f: GoodFlow, unit: string, ongoing = false): Block {
  return {
    type: "flow",
    title,
    opening: f.opening,
    closing: f.closing,
    ...(ongoing ? { closingWords: "Stands at" } : {}),
    rows: f.lines
      .filter((x) => x.value)
      .map((x) => ({ label: [LINES[x.line].words], value: x.value, sign: LINES[x.line].sign })),
    unit,
    balanced: f.out === 0,
  };
}

/** How long a stock lasts at a year's use: in months under two years, else in years. */
function lasts(stock: number, used: number): string {
  if (!used) return stock ? "not used" : "—";
  const years = stock / used;
  return years < 2 ? `${Math.round(years * 12)} months` : `${years.toFixed(1)} years`;
}

/** What a market's stores are made of: every good's weight, by the way it is made there. */
function storesMakeUp(world: World, markets: readonly Market[]): [string, number][] {
  const out = new Map<string, number>();
  for (const m of markets)
    GOODS.forEach((g, i) => {
      const kg = m.stock[i]! * GOOD_MATTER[g.id]!.unitKg;
      if (!kg) return;
      for (const [s, k] of goodHere(world, m.cell, g.id).parts)
        out.set(s, (out.get(s) ?? 0) + kg * k);
    });
  return [...out].sort((a, b) => b[1] - a[1]);
}

/** What stores are made of, as a composition: the heaviest parts, the rest as one. */
function makeUpOf(world: World, markets: readonly Market[], title: string): Block | null {
  const parts = storesMakeUp(world, markets),
    total = parts.reduce((s, [, kg]) => s + kg, 0);
  if (!total) return null;
  const top = parts.slice(0, 8).map(([s, kg]) => [s, kg / total] as [string, number]),
    rest = 1 - top.reduce((s, [, k]) => s + k, 0);
  const block = {
    type: "composition" as const,
    title,
    parts: top.map(([s, k]) => {
      const kgOf = total * k;
      return {
        name: [link(nameOf(s), `subst:${s}`)] as Line,
        share: k,
        amount: weight(kgOf),
        color: colourOf(s),
      };
    }),
    note: `${weight(total)} in all${rest > 0.001 ? `; the rest, ${(rest * 100).toFixed(1)}%, in lesser parts` : ""}. Down to its elements: ${elementsOf(
      parts.map(([s, kg]) => [s, kg / total] as [string, number]),
    )
      .slice(0, 4)
      .map(([e, k]) => `${e} ${Math.round(k * 100)}%`)
      .join(", ")}.`,
  };
  return block;
}

const nameOf = (id: string) => SUBSTANCES[SUBSTANCE[id]!]!.name;
const colourOf = (id: string) => SUBSTANCES[SUBSTANCE[id]!]!.colour;

/** Whether every good's last closed year balanced in these markets, and how many were checked. */
function booksBalance(markets: readonly Market[]): { checked: number; off: number } {
  let checked = 0,
    off = 0;
  for (const m of markets) {
    const last = m.years[m.years.length - 1];
    if (!last) continue;
    GOODS.forEach((_, g) => {
      const f = flowOf(m, g, last);
      if (!f) return;
      checked++;
      if (f.out !== 0) off++;
    });
  }
  return { checked, off };
}

/** A land's Stores tab: its goods by weight, worth and how long they last; what they are made of. */
export function landStoresBlocks(world: World, cell: number): Block[] {
  const markets = world.store<MarketStore>("economy.markets"),
    m = markets.get(cell),
    people = populationContext(world).provinces.get(cell)?.total() ?? 0;
  if (!m) return [];
  const last = m.years[m.years.length - 1],
    held = GOODS.map((g, i) => ({ g, i, n: m.stock[i]! })).filter((x) => x.n > 0),
    kg = held.reduce((s, x) => s + x.n * GOOD_MATTER[x.g.id]!.unitKg, 0),
    worth = held.reduce((s, x) => s + x.n * m.price[x.i]!, 0),
    food = FOODS.reduce((s, f) => s + m.stock[f]!, 0),
    books = booksBalance([m]);
  const rows: Row[] = held.map((x) => ({
    cells: [
      [link(x.g.name, `mkt:${cell}:${x.i}`)],
      [count(x.n)],
      [weight(x.n * GOOD_MATTER[x.g.id]!.unitKg)],
      [lasts(x.n, last ? last.ledger[1]![x.i]! : 0)],
    ],
    keys: [
      x.g.name,
      x.n,
      x.n * GOOD_MATTER[x.g.id]!.unitKg,
      last ? x.n / Math.max(1, last.ledger[1]![x.i]!) : 0,
    ],
  }));
  const blocks: Block[] = [
    {
      type: "facts",
      rows: [
        stat("Its stores weigh", weight(kg)),
        stat("Worth", `${count(worth)} grain`),
        stat(
          "Food put by",
          people ? `${(food / people).toFixed(1)} months for each of its people` : "—",
        ),
        stat(
          "Its books",
          books.checked
            ? books.off
              ? `${books.off} of ${books.checked} goods' years do not balance`
              : `every good's year balances (${books.checked} of ${books.checked})`
            : "not a whole year kept yet",
        ),
      ],
    },
    {
      type: "table",
      title: "What it holds",
      columns: ["Good", "Units", "Weight", "Lasts"],
      rows,
    },
  ];
  const made = makeUpOf(world, [m], "What its stores are made of");
  if (made) blocks.push(made);
  return blocks;
}

/** A good's year in a land's market: last year's flow and this year's so far. */
export function goodYearBlocks(world: World, cell: number, g: number): Block[] {
  const m = world.store<MarketStore>("economy.markets").get(cell);
  if (!m) return [];
  const unit = GOODS[g]!.name,
    last = m.years[m.years.length - 1],
    closed = last ? flowOf(m, g, last) : null,
    now = flowOf(m, g, null)!;
  return [
    ...(closed && last ? [flowBlock(`Year ${last.year}`, closed, unit)] : []),
    flowBlock("This year so far", now, unit, true),
  ];
}

/** Several lands' stores summed (a realm's, the world's): by good, with the most holding. */
export function storesSummed(
  world: World,
  cells: readonly number[] | null,
  title: string,
): Block[] {
  const all = world.store<MarketStore>("economy.markets").all(),
    markets = cells ? all.filter((m) => cells.includes(m.cell)) : all;
  if (!markets.length) return [];
  const units = GOODS.map((_, i) => markets.reduce((s, m) => s + m.stock[i]!, 0)),
    kg = GOODS.reduce((s, g, i) => s + units[i]! * GOOD_MATTER[g.id]!.unitKg, 0),
    worth = markets.reduce((s, m) => s + m.stock.reduce((t, n, i) => t + n * m.price[i]!, 0), 0),
    books = booksBalance(markets),
    rich = [...markets]
      .map((m) => ({ m, w: m.stock.reduce((t, n, i) => t + n * m.price[i]!, 0) }))
      .sort((a, b) => b.w - a.w || a.m.cell - b.m.cell)
      .slice(0, 8);
  const rows: Row[] = GOODS.map((g, i) => ({ g, i }))
    .filter((x) => units[x.i]! > 0)
    .map((x) => ({
      cells: [
        [link(x.g.name, `good:${x.g.id}`)],
        [count(units[x.i]!)],
        [weight(units[x.i]! * GOOD_MATTER[x.g.id]!.unitKg)],
      ],
      keys: [x.g.name, units[x.i]!, units[x.i]! * GOOD_MATTER[x.g.id]!.unitKg],
    }));
  const blocks: Block[] = [
    {
      type: "facts",
      title,
      rows: [
        stat("Stores weigh", weight(kg)),
        stat("Worth", `${count(worth)} grain`),
        stat("Markets", count(markets.length)),
        stat(
          "The books",
          books.off
            ? `${books.off} of ${books.checked} goods' years do not balance`
            : `every good's year balances (${count(books.checked)})`,
        ),
      ],
    },
    { type: "table", title: "What they hold", columns: ["Good", "Units", "Weight"], rows },
    {
      type: "bars",
      title: "The lands that hold the most (worth, in grain)",
      bars: rich.map((x) => ({
        label: [landLink(world, x.m.cell)],
        ref: `cell:0:${x.m.cell}`,
        value: Math.round(x.w),
      })),
      unit: "count",
    },
  ];
  const made = makeUpOf(world, markets, "What they are made of");
  if (made) blocks.push(made);
  return blocks;
}
