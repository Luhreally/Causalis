// Lives L2: every realm's wealth, weighed from what history holds. A realm holds what its lands'
// stores hold at their goods' usual worth, less what its lands owe the houses of lending; a head is
// that shared among its people, and made last year is what its lands made in the year past at the
// same worth. Plain reckoning: nothing is drawn, kept or saved, and the book is memoised per world
// and moment.
import { count, link, part, share, stat, yearNow } from "./inspect/words.ts";
import { realmColor } from "./colors.ts";
import { offworldSite } from "../gen/index.ts";
import { GOODS } from "../rules/index.ts";
import {
  creditOf,
  homePlanet,
  marketsOf,
  politiesOf,
  populationContext,
  realmName,
} from "../sim/index.ts";
import {
  FEW_PEOPLE,
  worthWords,
  type Block,
  type Stat,
  type WealthBook,
  type WealthLand,
  type WealthRow,
} from "../bridge/index.ts";
import type { Reading } from "./lenses.ts";
import type { QueryHandler } from "./host.ts";
import type { World } from "../kernel/index.ts";

/** A realm's row before its three places are set. */
type Unranked = Omit<WealthRow, "rankHead" | "rankAll" | "rankMade">;

const BOOKS = new WeakMap<World, { at: number; book: WealthBook }>();

/** Every realm's wealth, by worth a head (those of few people last), and every land of the home world. */
export function wealthBook(world: World): WealthBook {
  const hit = BOOKS.get(world);
  if (hit && hit.at === world.now) return hit.book;
  const book = buildBook(world);
  BOOKS.set(world, { at: world.now, book });
  return book;
}

/** A realm's row, or null when no standing realm has the ref. */
export function realmWealth(world: World, ref: string): WealthRow | null {
  return wealthBook(world).realms.find((r) => r.ref === ref) ?? null;
}

/** A land's wealth under the wealth lens: its realm's place by a head, in all, or made last year. */
export function wealthReading(world: World, cell: number, way: string): Reading {
  const book = wealthBook(world),
    l = book.lands.find((x) => x.cell === cell);
  if (!l || l.realm < 0)
    return {
      line: "Wealth: this land belongs to no realm",
      stats: [
        { label: "Its own, a head", value: worthWords(l ? l.worth / Math.max(1, l.people) : 0) },
      ],
    };
  const r = book.realms[l.realm]!,
    n = book.realms.length,
    line =
      way === "all"
        ? `Wealth: ${r.short}, ${worthWords(r.worth)} in all (${r.rankAll} of ${n})`
        : way === "made"
          ? `Wealth: ${r.short} made ${worthWords(r.madeHead)} a head last year (${r.rankMade} of ${n})`
          : `Wealth: ${r.short}, ${worthWords(r.head)} a head (${r.rankHead} of ${n})`;
  return {
    line,
    stats: [
      { label: "In all", value: worthWords(r.worth) },
      { label: "A head", value: worthWords(r.head) },
      { label: "Made last year, a head", value: worthWords(r.madeHead) },
      { label: "This land's own, a head", value: worthWords(l.worth / Math.max(1, l.people)) },
    ],
  };
}

/** A realm's wealth as the stats of its page: a headline, and the parts that make it. */
export function wealthStats(world: World, ref: string): Stat[] {
  const book = wealthBook(world),
    r = book.realms.find((x) => x.ref === ref);
  if (!r) return [];
  const n = book.realms.length,
    parts = [
      part("In all", `${worthWords(r.worth)}, ${r.rankAll} of ${n}`),
      part("Made last year, a head", `${worthWords(r.madeHead)}, ${r.rankMade} of ${n}`),
      part("Owed the houses", worthWords(r.owed)),
      part([link("Its stores", `${ref}#stores`)], worthWords(r.stores)),
      ...(r.topGood ? [part(`Most of it in ${r.topGood.name}`, share(r.topGood.share))] : []),
    ];
  return [
    stat(
      "Wealth",
      [link(`${worthWords(r.head)} a head, ${r.rankHead} of ${n}`, "world:ledger#wealth")],
      { parts },
    ),
  ];
}

/** The wealth page: the account of it, the two rankings, a comparison, and every realm. */
export function wealthBlocks(world: World): Block[] {
  const { realms } = wealthBook(world);
  if (realms.length < 2) return [{ type: "text", lines: [["No two realms stand yet to weigh."]] }];
  const byAll = [...realms].sort((a, b) => a.rankAll - b.rankAll),
    rich = realms[0]!,
    poor = [...realms].reverse().find((r) => !r.few) ?? realms.at(-1)!,
    great = byAll[0]!,
    least = byAll.at(-1)!,
    account = [
      "What a realm holds: everything in its lands' stores, each good at its usual worth, less what its lands owe the houses of lending. A head is that shared among its people. Made last year is what its lands made in the year past, at the same worth, a head. Homes, roads, works and ships are not counted: history keeps those as what stands, not as a worth.",
    ];
  if (great.topGood)
    account.push(
      `Tools never wear out in the record, so old lands pile them up for centuries: in ${great.short}, the greatest, ${share(great.topGood.share)} of what it holds is ${great.topGood.name}. So worth a head says how long a people have been making as much as how they live now: made last year says that better.`,
    );
  account.push(
    "Realms of fewer than 1,000 people are listed last: a few left sitting on what their dead left would head the list.",
  );
  return [
    { type: "text", lines: account.map((t) => [t]) },
    {
      type: "bars",
      title: "The ten richest, a head",
      bars: realms.slice(0, 10).map((r) => ({
        label: [link(r.short, r.ref)],
        ref: r.ref,
        value: r.head,
        color: [...r.color],
      })),
      unit: "count",
    },
    {
      type: "bars",
      title: "The ten greatest, in all",
      bars: byAll.slice(0, 10).map((r) => ({
        label: [link(r.short, r.ref)],
        ref: r.ref,
        value: r.worth,
        color: [...r.color],
      })),
      unit: "count",
    },
    {
      type: "tool",
      tool: "wealth.compare",
      args: {
        realms: realms.map((r) => ({ ref: r.ref, short: r.short })),
        a: rich.ref,
        b: poor.ref,
      },
    },
    {
      type: "list",
      title: "Set side by side",
      items: [
        {
          line: [`${rich.short} beside ${poor.short}: the richest and the poorest, a head`],
          ref: `compare:${rich.ref}|${poor.ref}`,
        },
        ...(great.ref !== least.ref
          ? [
              {
                line: [`${great.short} beside ${least.short}: the greatest and the least, in all`],
                ref: `compare:${great.ref}|${least.ref}`,
              },
            ]
          : []),
      ],
    },
    {
      type: "table",
      title: "Every realm",
      columns: ["Realm", "A head", "In all", "Made last year, a head", "People"],
      rows: realms.map((r) => ({
        ref: r.ref,
        cells: [
          [link(r.short, r.ref)],
          [worthWords(r.head)],
          [worthWords(r.worth)],
          [worthWords(r.madeHead)],
          [count(r.people)],
        ],
        keys: [r.short, r.head, r.worth, r.madeHead, r.people],
      })),
    },
  ];
}

/** The host's queries of the wealth book. */
export const WEALTH_QUERIES: Readonly<Record<string, QueryHandler>> = {
  "wealth.book": (world) => wealthBook(world),
};

function byRef(a: { readonly ref: string }, b: { readonly ref: string }): number {
  return a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0;
}

/** The book as the world stands: every realm weighed, then every land of the home world. */
function buildBook(world: World): WealthBook {
  const ctx = populationContext(world),
    markets = marketsOf(world),
    owedBy = new Map<number, number>();
  for (const loan of creditOf(world)?.loans ?? [])
    if (loan.ended === null) owedBy.set(loan.cell, (owedBy.get(loan.cell) ?? 0) + loan.owed);

  // A land's stores at their goods' usual worth (each good into `byGood` when given), and what its
  // books say it made last year at that worth; added into `t` in good order.
  const addLand = (t: { stores: number; made: number }, cell: number, byGood: number[] | null) => {
    const m = markets.get(cell);
    for (let g = 0; g < GOODS.length; g++) {
      const value = GOODS[g]!.value,
        worth = Math.max(0, m?.stock[g] ?? 0) * value;
      t.stores += worth;
      if (byGood) byGood[g] = (byGood[g] ?? 0) + worth;
      t.made += (m?.years.at(-1)?.ledger[0]?.[g] ?? 0) * value;
    }
  };

  const raw: Unranked[] = politiesOf(world)
    .living()
    .map((p) => {
      const t = { stores: 0, made: 0 },
        byGood = GOODS.map(() => 0);
      let people = 0,
        owed = 0;
      for (const c of p.members) {
        people += ctx.provinces.get(c)?.total() ?? 0;
        addLand(t, c, byGood);
        owed += owedBy.get(c) ?? 0;
      }
      let top = -1,
        topWorth = 0;
      byGood.forEach((w, g) => {
        if (w > topWorth) {
          top = g;
          topWorth = w;
        }
      });
      const worth = Math.max(0, t.stores - owed);
      return {
        ref: p.ref,
        short: p.town,
        name: realmName(p),
        color: realmColor(p.ref),
        people,
        lands: p.members.length,
        stores: t.stores,
        owed,
        worth,
        made: t.made,
        head: people ? worth / people : 0,
        madeHead: people ? t.made / people : 0,
        few: people < FEW_PEOPLE,
        topGood:
          t.stores > 0 && top >= 0 ? { name: GOODS[top]!.name, share: topWorth / t.stores } : null,
      };
    });

  const byHead = [...raw].sort(
      (a, b) => Number(a.few) - Number(b.few) || b.head - a.head || byRef(a, b),
    ),
    rankOf = (sorted: readonly Unranked[]) =>
      new Map(sorted.map((r, i) => [r.ref, i + 1] as const)),
    allAt = rankOf([...raw].sort((a, b) => b.worth - a.worth || byRef(a, b))),
    madeAt = rankOf([...raw].sort((a, b) => b.madeHead - a.madeHead || byRef(a, b))),
    realms: WealthRow[] = byHead.map((r, i) => ({
      ...r,
      rankHead: i + 1,
      rankAll: allAt.get(r.ref)!,
      rankMade: madeAt.get(r.ref)!,
    }));

  const home = homePlanet(world).generated,
    placeOf = new Map(realms.map((r, i) => [r.ref, i] as const)),
    lands: WealthLand[] = [];
  for (const p of ctx.provinces.all()) {
    if (offworldSite(home, p.cell)) continue;
    const t = { stores: 0, made: 0 },
      polity = politiesOf(world).of(p.cell);
    addLand(t, p.cell, null);
    lands.push({
      cell: p.cell,
      realm: polity ? (placeOf.get(polity.ref) ?? -1) : -1,
      people: p.total(),
      worth: Math.max(0, t.stores - (owedBy.get(p.cell) ?? 0)),
    });
  }
  return { year: yearNow(world), realms, lands };
}
