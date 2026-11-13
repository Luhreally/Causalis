// Companies and a realm's exchange, late in a world (asked 2026-11-12: "in sophsiticated econmomy yk stocks and stuff later on"). A company is
// a land's works read as one: once a land has works and knows banking (or a house of lending stands in it), what it makes the most of at its
// works is a company, named for its town and its making — "Ur Motor Works", "Kish Steel Company". Its year is its land's books: what it
// made of its good, its share of that (host/inspect/wares.ts), at what its market paid, for each of the five years a market keeps. A share's
// price follows that, and a realm's exchange, at its seat, lists its greatest with an index over the same years. Nothing here is kept:
// it is read when a page asks, once a moment, and history moves no differently for anyone reading it.
import { worldChemistry } from "../../gen/index.ts";
import type { Ref, World } from "../../kernel/index.ts";
import type { Block, BoardRow, PageModel, Tab } from "../../bridge/index.ts";
import { COIN_A_UNIT, G, GOODS, roleWord } from "../../rules/index.ts";
import {
  creditOf,
  homePlanet,
  loreOf,
  marketGoodRef,
  marketsOf,
  politiesOf,
  realmName,
} from "../../sim/index.ts";
import { makingTown } from "../chain.ts";
import { boardRef, wayRow } from "./board.ts";
import { MACHINE_KINDS, clothOf, madeWares, type WareName } from "./wares.ts";
import { coinWords } from "./living.ts";
import { count, link, many, stat, yearNow } from "./words.ts";

/** A company: a land's works at one making, its years by its land's books. */
export type Company = {
  readonly key: string;
  readonly name: string;
  /** What it makes, in a few words: "motor cars and lorries", "steel". */
  readonly what: string;
  readonly good: number;
  readonly cell: number;
  readonly town: { readonly ref: string; readonly name: string } | null;
  /** Its share of its land's making of its good. */
  readonly part: number;
  /** What it took in a year, in coin, each of the years its land's books keep (oldest first). */
  readonly years: readonly { readonly year: number; readonly coin: number }[];
  /** What it is worth now, in coin: WORTH_YEARS of what it took in its last year. */
  readonly worth: number;
  /** A share's price now, in coin. */
  readonly share: number;
};

/** A company is worth this many years of what it takes in. */
const WORTH_YEARS = 2;
/**
 * How many shares a company is divided into: so many that one sold for between a hundred and a thousand coin in the first year its books
 * keep (a power of ten, as a company splits its shares when they grow dear). A share's price moves from there with what it takes in.
 */
function sharesOf(first: number, now: number): number {
  let n = 1;
  while (first / n >= 1000) n *= 10;
  // (And split again, tenfold, whenever one has grown past ten thousand since.)
  while (now / n >= 10_000) n *= 10;
  return n;
}
/** A making under this share of its land's good is no company of its own. */
const LEAST_PART = 0.15;
/** At most this many companies to a land. */
const MOST = 4;

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  /** Each word of a name begun high: "palm fibre" → "Palm Fibre", "horse-hair" → "Horse-hair". */
  title = (s: string) => s.split(" ").map(cap).join(" ");

/** Whether a land's works can be companies: works, and lending, by banking known or a house standing in it. */
export function hasCompanies(world: World, cell: number): boolean {
  const m = marketsOf(world).get(cell);
  if (!m?.works || !loreOf(world).get(cell, "currency")) return false;
  return (
    !!loreOf(world).get(cell, "banking") ||
    !!creditOf(world)
      ?.standing()
      .some((h) => h.cell === cell)
  );
}

/** What a company of a good's making is called after its town: by what it makes. */
function worksName(world: World, cell: number, good: number, w: WareName | null): string | null {
  const chem = worldChemistry(homePlanet(world).generated),
    knows = (id: string) => !!loreOf(world).get(cell, id);
  switch (good) {
    case G.machines: {
      if (!w) return "Machine Works";
      if (w.key.startsWith("arms:")) return "Arms Works";
      const k = MACHINE_KINDS.find((x) => `machine:${x.id}` === w.key);
      return k?.works ?? "Machine Works";
    }
    case G.iron:
      return knows("steel") ? "Steel Company" : "Iron Company";
    case G.copper:
      return "Copper Company";
    case G.tin:
      return `${cap(roleWord(chem, "tin"))} Company`;
    case G.coal:
      return "Coal Company";
    case G.oil:
      return "Oil Company";
    case G.clothing:
      // (Its mills where its weavers' cloth is what it makes most, its leather works where its tanners'.)
      return !knows("factories") || !w
        ? null
        : w.key === "leather"
          ? "Leather Works"
          : `${title(clothOf(world, cell).kind)} Mills`;
    case G.tools:
      // (No works knaps stone: a land whose tools are stone has no tool company.)
      return w?.key.startsWith("arms:")
        ? "Arms Works"
        : knows("factories") && w && w.key !== "tools:stone"
          ? "Tool Works"
          : null;
    case G.pottery:
      return knows("factories") ? "Pottery Works" : null;
    default:
      return null;
  }
}

/** The goods a land's works can be companies of, the machines first. */
const WORKS_GOODS = [
  G.machines,
  G.iron,
  G.coal,
  G.oil,
  G.copper,
  G.tin,
  G.clothing,
  G.tools,
  G.pottery,
];

/** A land's companies, the greatest first (none: no works, or no lending to found them on). */
export function companiesOf(world: World, cell: number): readonly Company[] {
  const c = cacheOf(world),
    had = c.lands.get(cell);
  if (had) return had;
  const out: Company[] = [];
  const m = marketsOf(world).get(cell);
  if (m && hasCompanies(world, cell)) {
    const town = makingTown(world, cell),
      named = town?.name ?? "",
      seen = new Set<string>();
    for (const good of WORKS_GOODS) {
      if (m.book("made", good) <= 0) continue;
      // (Its own making of the good, each thing of it: the machines its works turn out, the arms its works make for its realm.)
      const own = madeWares(world, cell, good),
        things =
          good === G.machines || good === G.tools
            ? own.filter((w) => w.share >= LEAST_PART)
            : own.slice(0, 1);
      for (const w of things) {
        const works = worksName(world, cell, good, w);
        if (!works || !named) continue;
        const name = `${named} ${works}`;
        if (seen.has(name)) continue;
        seen.add(name);
        const part = good === G.machines || good === G.tools ? w.share : 1,
          years = m.years.map((y) => ({
            year: y.year,
            coin: (y.ledger[0]?.[good] ?? 0) * (y.price[good] ?? 0) * COIN_A_UNIT * part,
          })),
          now = years.at(-1)?.coin ?? m.book("made", good) * m.price[good]! * COIN_A_UNIT * part,
          first = years.find((y) => y.coin > 0)?.coin ?? now;
        if (!(now > 0)) continue;
        out.push({
          key: `${cell}:${good}:${w.key}`,
          name,
          what: good === G.iron ? (works.startsWith("Steel") ? "steel" : "iron") : w.name,
          good,
          cell,
          town: town ? { ref: town.ref, name: town.name } : null,
          part,
          years,
          worth: now * WORTH_YEARS,
          share: (now * WORTH_YEARS) / sharesOf(first * WORTH_YEARS, now * WORTH_YEARS),
        });
      }
    }
    out.sort((a, b) => b.worth - a.worth || (a.key < b.key ? -1 : 1));
    out.splice(MOST);
  }
  c.lands.set(cell, out);
  return out;
}

/** A realm's exchange: at its seat's town, its greatest companies, and an index of them all over the years its books keep. */
export type Exchange = {
  readonly realm: string;
  readonly name: string;
  readonly town: { readonly ref: string; readonly name: string };
  readonly companies: readonly Company[];
  /** What its companies took in, all together, against the first year's (100). */
  readonly index: readonly { readonly year: number; readonly value: number }[];
};

/** A realm's exchange (null: its seat keeps no exchange, or it has too few companies to list). */
export function exchangeOf(world: World, realm: string): Exchange | null {
  const c = cacheOf(world);
  if (c.realms.has(realm)) return c.realms.get(realm)!;
  const r = politiesOf(world).get(realm as Ref),
    town = r ? makingTown(world, r.seat) : null;
  let out: Exchange | null = null;
  if (r && town && loreOf(world).get(r.seat, "banking")) {
    const companies = r.members.flatMap((cell) => companiesOf(world, cell));
    if (companies.length >= 2) {
      companies.sort((a, b) => b.worth - a.worth || (a.key < b.key ? -1 : 1));
      const sums = new Map<number, number>();
      for (const co of companies)
        for (const y of co.years) sums.set(y.year, (sums.get(y.year) ?? 0) + y.coin);
      const years = [...sums].sort((a, b) => a[0] - b[0]),
        first = years[0]?.[1] ?? 0;
      out = {
        realm,
        name: `The ${town.name} Exchange`,
        town: { ref: town.ref, name: town.name },
        companies,
        index: first > 0 ? years.map(([year, v]) => ({ year, value: (100 * v) / first })) : [],
      };
    }
  }
  c.realms.set(realm, out);
  return out;
}

/** The page of a realm's exchange (`exchange:<realm>`). */
export const exchangeRef = (realm: string): string => `exchange:${realm}`;

/** A company's line as the exchange's board shows it: its name, what it makes and where, a share's price, how it has gone. */
function companyRow(world: World, co: Company): BoardRow {
  const y0 = co.years[0],
    y1 = co.years.at(-1),
    r = y0 && y1 && y0.coin > 0 ? y1.coin / y0.coin : 1,
    span = y0 && y1 ? Math.max(1, y1.year - y0.year) : 0,
    years = span === 1 ? "a year" : `${count(span)} years`;
  return {
    ref: marketGoodRef(co.cell, co.good),
    icon: ICONS[GOODS[co.good]!.id] ?? "🏭",
    name: co.name,
    each: `${co.what}${co.town ? `, at ${co.town.name}` : ""}`,
    price: `${coinWords(co.share)} coin a share`,
    tone: "usual",
    words: !span
      ? "new on the list"
      : r >= 1.08
        ? `up ${Math.round((r - 1) * 100)}% in ${years}`
        : r <= 0.92
          ? `down ${Math.round((1 - r) * 100)}% in ${years}`
          : `steady over ${years}`,
    arrow: !span ? "" : r >= 1.08 ? "▲" : r <= 0.92 ? "▼" : "●",
    trend: "",
    shelf: 0,
  };
}
const ICONS: Readonly<Record<string, string>> = {
  machines: "🏭",
  iron: "⚙️",
  copper: "🟠",
  tin: "⚪",
  coal: "⚫",
  oil: "🛢️",
  clothing: "🧥",
  tools: "🔨",
  pottery: "🏺",
};

/** The board's listing: at most this many companies, and no more than so many of one making (or one land's tool works would be all of it). */
const LISTED = 10,
  OF_A_MAKING = 3;

/** The companies the exchange's board lists: the greatest by worth, no more than a few of each making. */
function listedOf(e: Exchange): readonly Company[] {
  const making = (c: Company) => c.name.slice(c.town ? c.town.name.length : 0),
    had = new Map<string, number>(),
    first: Company[] = [];
  for (const c of e.companies) {
    const n = had.get(making(c)) ?? 0;
    if (n < OF_A_MAKING && first.length < LISTED) {
      first.push(c);
      had.set(making(c), n + 1);
    }
  }
  return first;
}

/** A realm's exchange, its page: its greatest companies, its index over the years, and what a share's price is. */
export function exchangePage(world: World, ref: string): PageModel {
  const realm = ref.slice("exchange:".length),
    e = exchangeOf(world, realm),
    r = politiesOf(world).get(realm as Ref),
    year = yearNow(world);
  if (!e || !r) {
    return {
      ref,
      kind: "goods",
      icon: "📈",
      title: "An exchange",
      subtitle: [r ? link(realmName(r), r.ref) : "Of a realm now gone"],
      color: null,
      place: null,
      stats: [],
      tabs: [
        {
          id: "listed",
          name: "Listed",
          blocks: [
            {
              type: "text",
              lines: [["No exchange stands there: no shares of any company are bought or sold."]],
            },
          ],
        },
      ],
      followable: false,
      year,
    };
  }
  const listed = listedOf(e),
    last = e.index.at(-1),
    first = e.index[0],
    blocks: Block[] = [
      {
        type: "board",
        title: `Year ${year}, the greatest listed`,
        known: null,
        coin: [
          `${many(e.companies.length, "company", "companies")} of ${realmName(r)}'s lands are listed here: the greatest, no more than ${OF_A_MAKING} of one making.`,
        ],
        note: null,
        shelves: ["Listed"],
        rows: listed.map((co) => companyRow(world, co)),
        ...(e.companies.length > listed.length ? { more: e.companies.length - listed.length } : {}),
      },
    ];
  if (e.index.length >= 2)
    blocks.push({
      type: "chart",
      title: `The ${e.town.name} index (${first!.year} = 100)`,
      points: e.index.map((x) => ({ x: x.year, y: Math.round(x.value * 10) / 10 })),
    });
  blocks.push({
    type: "text",
    lines: [
      [
        `A share's price follows its company's year: what its works made, its part of its land's making, at what its land's market paid. A company is reckoned worth ${WORTH_YEARS} years of what it takes in, its shares split so that one sold for a hundred to a thousand coin when its books begin, and split again whenever one grows past ten thousand. The index is all of them together against that first year. Press a line for what is made there.`,
      ],
    ],
  });
  blocks.push(wayRow("🏷️", `The market board of ${e.town.name}`, boardRef(e.town.ref)));
  const tabs: Tab[] = [{ id: "listed", name: "Listed", blocks }];
  return {
    ref,
    kind: "goods",
    icon: "📈",
    title: e.name,
    subtitle: ["The exchange of ", link(realmName(r), r.ref)],
    color: null,
    place: null,
    stats: [
      stat("Listed", count(e.companies.length)),
      ...(last && first && e.index.length >= 2
        ? [stat("Index", `${Math.round(last.value)} (${first.year} = 100)`)]
        : []),
    ],
    tabs,
    followable: false,
    year,
  };
}

/** The way to a realm's exchange, for a page that tells of it (none: it keeps none). */
export function exchangeWay(world: World, realm: string | null | undefined): Block | null {
  const e = realm ? exchangeOf(world, realm) : null;
  if (!e) return null;
  const last = e.index.at(-1);
  return wayRow(
    "📈",
    e.name,
    exchangeRef(e.realm),
    last && e.index.length >= 2 ? `index ${Math.round(last.value)}` : "",
  );
}

/** A land's companies, for its economy: each named, what it makes, a share's price; and the way to its realm's exchange. */
export function landCompanyBlocks(world: World, cell: number): Block[] {
  const cs = companiesOf(world, cell);
  if (!cs.length) return [];
  const realm = politiesOf(world).of(cell),
    e = realm ? exchangeOf(world, realm.ref) : null,
    blocks: Block[] = [
      {
        type: "facts",
        title: "Companies",
        rows: cs.map((co) =>
          stat(co.name, [
            link(co.what, marketGoodRef(co.cell, co.good)),
            `, ${coinWords(co.share)} coin a share`,
          ]),
        ),
      },
    ];
  if (e) blocks.push(wayRow("📈", e.name, exchangeRef(e.realm)));
  return blocks;
}

// —— Read once a moment ——————————————————————————————————————————————————————————————————————————

type Cache = {
  now: number;
  readonly lands: Map<number, readonly Company[]>;
  readonly realms: Map<string, Exchange | null>;
};
const CACHES = new WeakMap<World, Cache>();
function cacheOf(world: World): Cache {
  let c = CACHES.get(world);
  if (!c || c.now !== world.now) {
    c = { now: world.now, lands: new Map(), realms: new Map() };
    CACHES.set(world, c);
  }
  return c;
}
