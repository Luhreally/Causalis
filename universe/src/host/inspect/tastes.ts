// What each realm's people love, and what it entails (asked 2026-11-16: "add what's popular in different realms and what that
// realistically entails ... on the ledger, and explain it in the relevant tab of the land, town or nation"). And what crosses its
// borders unseen, ware by ware (sim/money/contraband.ts), and each kind of what calms, wakes, brings visions and eases pain, kind by
// kind. Pure reads of the stores as their systems last set them: nothing here is reckoned anew or flows back.
//   Popular: what a realm's people take most a head against the world's middle realm (the median of the realms that take any): of
//     the goods its markets used (the economy's books), each kind of intoxicant (Round B's INTOX rows), the spice its cooks keep their
//     food with (the society sweep's table) and the feasts it keeps (its rest).
//   What it entails: what that comes to by the sim's own rules there, each line its rule's and its page's: who come to need what
//     they take and die of it (rules/intox.ts INTOX_HOLD), what its treasury takes of it, what comes from abroad and from whom, what
//     crosses unseen and who carries it (the contraband and the underworld), the food its spice keeps, the grievance its feasts ease.
// Read once a year a world (the stores turn yearly), the same for every page of that year.
import type { World } from "../../kernel/index.ts";
import type { Block, Line, Row, Span, Stat } from "../../bridge/index.ts";
import {
  CONTRA_CAUSES,
  CONTRA_WHY,
  G,
  GOODS,
  INTOX_KINDS,
  INTOX_WORDS,
  KEEPING,
  KEEPING_MEANS,
  WARE_ARMS,
  WARE_COUNT,
  WARE_INTOX,
  kindCost,
  wareName,
  type ContraCause,
} from "../../rules/index.ts";
import {
  BAR,
  BAR_STORE,
  DUTY,
  INTOX,
  INTOX_STORE,
  KINDS_STORE,
  KIND_ROW,
  LEISURE_ROW,
  LEISURE_STORE,
  TABLE,
  TABLE_STORE,
  TARIFF_STORE,
  contrabandOf,
  intoxLineages,
  kindBarred,
  kindOfGroup,
  marketsOf,
  moneyStore,
  politiesOf,
  populationContext,
  potencyOf,
  revenueOf,
  societyStore,
  underworldOf,
  type Contraband,
  type Polity,
} from "../../sim/index.ts";
import { groupWords } from "../../causal/index.ts";
import { groupRef } from "../underworld.ts";
import { count, link, part, stat, yearNow } from "./words.ts";
import { pct } from "./ledger-kit.ts";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s),
  grain = (n: number) =>
    n > 0 && n < 10 ? `${n.toFixed(2)} grain's worth` : `${count(Math.round(n))} grain's worth`,
  times = (x: number) => `${x >= 10 ? Math.round(x) : x.toFixed(1)}×`,
  ordinal = (n: number) => {
    const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
    return `${count(n)}${s}`;
  };

// —— What a people can love ——————————————————————————————————————————————————————————————————————————————

/** A thing a people takes, and how its amount is said. */
export type Taste = {
  readonly id: string;
  /** "tools", "what calms", "spice". */
  readonly name: string;
  /** Who loves it most: "the greatest buyers of tools". */
  readonly most: string;
  /** Its amount a head, said ("2.1 a head a year", "12% take it"). */
  readonly say: (v: number) => string;
  /** Its good (GOODS), its kind of intoxicant (INTOX_KINDS), or neither. */
  readonly good?: number;
  readonly kind?: number;
};

const perHead = (v: number) => `${v >= 10 ? count(Math.round(v)) : v.toFixed(2)} a head a year`;
/** The goods a people is said to love of (what its markets use: food eaten, what it wears and works with, what it burns). */
const LOVED_GOODS: readonly [number, string][] = [
  [G.grain, "the greatest eaters of grain"],
  [G.meat, "the greatest eaters of flesh and milk"],
  [G.wild, "the greatest eaters of what the wild gives"],
  [G.clothing, "the greatest buyers of clothes"],
  [G.pottery, "the greatest buyers of pots"],
  [G.tools, "the most tools a head"],
  [G.machines, "the most machines a head"],
  [G.coal, "the greatest burners of coal"],
  [G.oil, "the greatest burners of oil"],
  [G.iron, "the most iron worked a head"],
  [G.copper, "the most copper worked a head"],
];
const KIND_MOST: Readonly<Record<string, string>> = {
  calming: "whose people take the most of what calms",
  waking: "whose people take the most of what wakes",
  visions: "whose rites take the most of what brings visions",
  easing: "whose people take the most of what eases pain",
};

export const TASTES: readonly Taste[] = [
  ...LOVED_GOODS.map(([g, most]) => ({
    id: GOODS[g]!.id,
    name: GOODS[g]!.name,
    most,
    say: perHead,
    good: g,
  })),
  ...INTOX_KINDS.map((k, i) => ({
    id: k,
    name: INTOX_WORDS[k].name,
    most: KIND_MOST[k]!,
    say: (v: number) => `${pct(v)} of its people take it`,
    kind: i,
  })),
  {
    id: "spice",
    name: "spice",
    most: "whose cooks use the most spice",
    say: (v: number) => `cooks with it ${pct(v)} as far as a hot land can`,
  },
  {
    id: "feasts",
    name: "feasts",
    most: "who keep the most feast days",
    say: (v: number) => `${Math.round(v)} feast days a year`,
  },
];
const SPICE = TASTES.findIndex((t) => t.id === "spice"),
  FEASTS = TASTES.findIndex((t) => t.id === "feasts"),
  SPICE_MEAN = KEEPING_MEANS.indexOf("spice");

/** Each standing realm's people and its amount of each taste a head, the world's middle, and who loves what. */
export type TastesRead = {
  readonly year: number;
  /** By realm: its people, and each taste's amount (TASTES order; 0 where none). */
  readonly realms: ReadonlyMap<string, { readonly people: number; readonly v: readonly number[] }>;
  /** Each taste's middle among the realms that take any (0: none does). */
  readonly middle: readonly number[];
  /** Each taste's realms that take any, the most first. */
  readonly order: readonly (readonly string[])[];
};

const KEPT = new WeakMap<World, TastesRead>();

/** Every standing realm's tastes, once a year. */
export function tastesRead(world: World): TastesRead {
  const year = yearNow(world),
    hit = KEPT.get(world);
  if (hit && hit.year === year) return hit;
  const ctx = populationContext(world),
    markets = marketsOf(world),
    intox = moneyStore(world, INTOX_STORE),
    table = societyStore(world, TABLE_STORE),
    rest = societyStore(world, LEISURE_STORE),
    realms = new Map<string, { people: number; v: number[] }>();
  for (const r of politiesOf(world).all()) {
    if (r.ended !== null) continue;
    const v = new Array<number>(TASTES.length).fill(0);
    let people = 0;
    for (const c of r.members) {
      const n = ctx.provinces.get(c)?.total() ?? 0;
      if (n <= 0) continue;
      people += n;
      const m = markets.get(c),
        ix = intox?.get(c),
        tb = table?.get(c),
        rs = rest?.get(c);
      TASTES.forEach((t, i) => {
        if (t.good !== undefined) v[i]! += m ? m.book("used", t.good) : 0;
        else if (t.kind !== undefined) v[i]! += ix ? (n * ix[INTOX.use + t.kind]!) / 1000 : 0;
      });
      if (tb) v[SPICE]! += (n * tb[TABLE.means + SPICE_MEAN]!) / 1000;
      if (rs) v[FEASTS]! += n * rs[LEISURE_ROW.feasts]!;
    }
    if (people <= 0) continue;
    realms.set(r.ref, { people, v: v.map((x) => x / people) });
  }
  const middle: number[] = [],
    order: string[][] = [];
  TASTES.forEach((_, i) => {
    const taking = [...realms].filter(([, x]) => x.v[i]! > 0);
    taking.sort((a, b) => b[1].v[i]! - a[1].v[i]! || (a[0] < b[0] ? -1 : 1));
    order.push(taking.map(([ref]) => ref));
    const vs = taking.map(([, x]) => x.v[i]!).sort((a, b) => a - b);
    middle.push(vs.length ? vs[Math.floor(vs.length / 2)]! : 0);
  });
  const read = { year, realms, middle, order };
  KEPT.set(world, read);
  return read;
}

/** One of a realm's tastes: what, how much a head, against the world's middle, and its place among the realms. */
export type Loved = {
  readonly taste: number;
  readonly v: number;
  readonly ratio: number;
  readonly rank: number;
  readonly of: number;
};

/** A people loves a thing where it takes at least this many times the world's middle realm. */
export const LOVED = 1.25;

/** A realm's most loved things, the most beyond the world's middle first (at most `n`). */
export function lovedOf(world: World, realm: string, n = 3): Loved[] {
  const t = tastesRead(world),
    me = t.realms.get(realm);
  if (!me) return [];
  const out: Loved[] = [];
  TASTES.forEach((_, i) => {
    const v = me.v[i]!,
      mid = t.middle[i]!;
    if (v <= 0 || mid <= 0) return;
    const ratio = v / mid;
    if (ratio < LOVED || t.order[i]!.length < 3) return;
    out.push({ taste: i, v, ratio, rank: t.order[i]!.indexOf(realm) + 1, of: t.order[i]!.length });
  });
  return out.sort((a, b) => b.ratio - a.ratio || a.taste - b.taste).slice(0, n);
}

/** "tools: 2.10 a head a year, 3.1× the world's middle (2nd of 140)". */
export function lovedWords(l: Loved): string {
  const t = TASTES[l.taste]!;
  return `${t.name}: ${t.say(l.v)}, ${times(l.ratio)} the world's middle (${ordinal(l.rank)} of ${count(l.of)})`;
}

// —— What crosses unseen ————————————————————————————————————————————————————————————————————————————————

/** A ware's why, in words. */
export const contraWhy = (w: Contraband): string =>
  CONTRA_WHY[(CONTRA_CAUSES[w.cause] ?? "tariff") as ContraCause];

/** "tools (34% unseen: its tariff on goods from abroad)". */
export function contraWords(w: Contraband): string {
  return `${wareName(w.ware)} (${pct(w.share)} unseen: ${contraWhy(w)})`;
}

/** Those of a realm's underworld who carry what crosses unseen: its cartels, each a link (none where none stands). */
export function carriersOf(world: World, r: Polity): Span[] {
  const v = underworldOf(world)?.of(r.ref);
  return (v?.groups ?? [])
    .filter((g) => kindOfGroup(g) === "cartel")
    .slice(0, 2)
    .map((g) => link(cap(groupWords(g.name, kindOfGroup(g))), groupRef(r.ref, g.event)));
}

/** A realm's wares smuggled, ware by ware (none where none is kept). */
export function realmContrabandBlocks(world: World, r: Polity): Block[] {
  const wares = contrabandOf(world, r.ref);
  if (!wares.length) return [];
  const carriers = carriersOf(world, r),
    rows: Row[] = wares.map((w) => ({
      ref: `${r.ref}#underworld`,
      cells: [[cap(wareName(w.ware))], [pct(w.share)], [cap(contraWhy(w))], [grain(w.worth)]],
      keys: [wareName(w.ware), w.share, w.cause, w.worth],
    }));
  return [
    {
      type: "table",
      title: "What crosses its borders unseen",
      columns: ["What", "Unseen", "Why", "A year"],
      rows,
      fit: true,
    },
    {
      type: "text",
      lines: [
        [
          "What is worth much for its bulk slips past first: a cart of tin or tools hides as well as a cart of grain and is worth a dozen of it.",
        ],
        ...(carriers.length
          ? [["Carried by ", ...joinSpans(carriers), "."] as Line]
          : [
              [
                "No group of its underworld carries it as one: those who carry it are many and small.",
              ] as Line,
            ]),
      ],
    },
  ];
}

function joinSpans(xs: readonly Span[]): Span[] {
  const out: Span[] = [];
  xs.forEach((x, i) => {
    if (i) out.push(i === xs.length - 1 ? " and " : ", ");
    out.push(x);
  });
  return out;
}

// —— What a love entails ———————————————————————————————————————————————————————————————————————————————

/** What a realm's people's love of each of its most loved things comes to there, by the sim's own rules (each a link to its page). */
export function entailStats(world: World, r: Polity, loved = lovedOf(world, r.ref)): Stat[] {
  const out: Stat[] = [],
    wares = contrabandOf(world, r.ref),
    unseen = new Map(wares.map((w) => [w.ware, w])),
    duty = moneyStore(world, TARIFF_STORE)?.get(r.ref),
    bar = moneyStore(world, BAR_STORE)?.get(r.ref),
    kinds = moneyStore(world, KINDS_STORE)?.get(r.ref),
    revenue = revenueOf(world, r.ref),
    carriers = carriersOf(world, r),
    treasury = `${r.ref}#treasury`,
    under = `${r.ref}#underworld`,
    markets = marketsOf(world),
    seat = markets.get(r.seat);
  for (const l of loved) {
    const t = TASTES[l.taste]!,
      parts: ReturnType<typeof part>[] = [];
    if (t.kind !== undefined) {
      const k = INTOX_KINDS[t.kind]!,
        cost = kindCost(k, l.v),
        harm = potencyOf(world, r.ref),
        barred = kindBarred(world, r.ref, t.kind),
        reach = (kinds?.[KIND_ROW.width * t.kind + KIND_ROW.reach] ?? 0) / 1000,
        from = kinds?.[KIND_ROW.width * t.kind + KIND_ROW.from] ?? 0,
        seller = from
          ? politiesOf(world)
              .all()
              .find((p) => p.ref.endsWith(`:${from - 1}`))
          : undefined,
        w = unseen.get(WARE_INTOX + t.kind);
      parts.push(
        part(
          "come to need it (rules: INTOX_HOLD)",
          `${(cost.dependent * 1000).toFixed(1)} in a thousand of its people`,
        ),
        part(
          cost.lost >= 0 ? "work lost to it" : "work it keeps them at",
          `${pct(Math.abs(cost.lost))} of its crafts'`,
        ),
        part(
          "die of it a year",
          `${(cost.deaths * 1e5 * (harm.potency > 1 ? 1.2 : 1)).toFixed(1)} in a hundred thousand`,
        ),
      );
      if (k === "visions") parts.push(part("its rites draw on it", pct(Math.min(1, l.v * 3))));
      if (k === "easing")
        parts.push(part("pain it eases among its sick and wounded", pct(Math.min(1, l.v * 2))));
      parts.push(
        part(
          "where it comes from",
          reach > 0.05
            ? `${pct(reach)} of what is wanted from abroad${seller ? `, most from ${seller.town}` : ""}`
            : "its own lands",
        ),
      );
      if (barred >= 0.1)
        parts.push(part([link("its law", treasury)], `forbids it, ${pct(barred)}`));
      else if (bar && bar[BAR.excise]! > 0 && revenue > 0)
        parts.push(
          part(
            [link("its excise on them", treasury)],
            `${pct(bar[BAR.excise]! / 1000)} of their worth; ${pct(bar[BAR.revenue]! / Math.max(1, revenue))} of its treasury`,
          ),
        );
      if (w)
        parts.push(
          part(
            [link("crosses its borders unseen", under)],
            `${pct(w.share)}: ${contraWhy(w)}${carriers.length ? "" : ", carried by many small hands"}`,
          ),
        );
      if (w && carriers.length)
        parts.push(part(["carried by ", ...joinSpans(carriers)], grain(w.worth) + " a year"));
    } else if (t.good !== undefined) {
      const g = t.good,
        price = seat?.price[g] ?? GOODS[g]!.value;
      let used = 0,
        brought = 0;
      for (const c of r.members) {
        const m = markets.get(c);
        if (!m) continue;
        used += m.book("used", g);
        brought += m.book("in", g);
      }
      parts.push(part("costs its people", `${grain(l.v * price)} a head a year`));
      if (used > 0 && brought > 0)
        parts.push(part("comes in from other lands", pct(Math.min(1, brought / used))));
      const rate = duty?.[DUTY.rate] ?? 0;
      if (rate > 0)
        parts.push(part([link("its tariff on goods from abroad", treasury)], pct(rate / 1000)));
      const w = unseen.get(g);
      if (w) {
        parts.push(
          part([link("crosses its borders unseen", under)], `${pct(w.share)}: ${contraWhy(w)}`),
        );
        if (carriers.length)
          parts.push(part(["carried by ", ...joinSpans(carriers)], grain(w.worth) + " a year"));
      }
    } else if (l.taste === SPICE) {
      parts.push(
        part("spares its food's spoiling (rules: KEEPING)", pct(KEEPING.spice * Math.min(1, l.v))),
        part(
          "where it comes from",
          "what grows about its own lands: no market of this world sells it",
        ),
      );
    } else if (l.taste === FEASTS) {
      const rest = societyStore(world, LEISURE_STORE);
      let relief = 0,
        people = 0;
      for (const c of r.members) {
        const row = rest?.get(c),
          n = populationContext(world).provinces.get(c)?.total() ?? 0;
        if (!row || !n) continue;
        relief += n * row[LEISURE_ROW.relief]!;
        people += n;
      }
      parts.push(
        part(
          "grievance they ease a year (rules: feastRelief)",
          pct(people ? relief / people / 10_000 : 0),
        ),
        part("days not worked", `${Math.round(l.v)} a year beside its holy days`),
      );
    }
    out.push(
      stat(
        cap(t.name),
        `${t.say(l.v)}: ${times(l.ratio)} the world's middle, ${ordinal(l.rank)} of ${count(l.of)}`,
        { parts },
      ),
    );
  }
  // And what crosses its borders unseen that it does not love beyond others: what its laws and its wars make worth carrying.
  for (const w of wares) {
    if (
      loved.some(
        (l) =>
          TASTES[l.taste]!.good === w.ware ||
          (TASTES[l.taste]!.kind !== undefined && WARE_INTOX + TASTES[l.taste]!.kind! === w.ware),
      )
    )
      continue;
    if (w.share < 0.2) continue;
    out.push(
      stat(cap(wareName(w.ware)), `${pct(w.share)} of it crosses its borders unseen`, {
        parts: [
          part("why", contraWhy(w)),
          part("worth a year", grain(w.worth)),
          ...(w.ware === WARE_ARMS
            ? [
                part(
                  [link("its underworld", under)],
                  "armed against its crackdown: its groups the stronger in their wars",
                ),
              ]
            : []),
          ...(carriers.length ? [part(["carried by ", ...joinSpans(carriers)], "")] : []),
        ],
      }),
    );
  }
  return out;
}

/** A realm's "What its people love" block, for its Treasury tab (none where nothing is loved beyond the world's middle). */
export function realmTastesBlocks(world: World, r: Polity): Block[] {
  const rows = entailStats(world, r);
  if (!rows.length) return [];
  return [{ type: "facts", title: "What its people love, and what it comes to", rows }];
}

/** A land's tastes against its realm's and the world's: what it takes most a head beyond the world's middle (none where nothing). */
export function landTastesBlocks(world: World, cell: number): Block[] {
  const ctx = populationContext(world),
    n = ctx.provinces.get(cell)?.total() ?? 0,
    r = politiesOf(world).of(cell);
  if (n <= 0 || !r || r.ended !== null) return [];
  const t = tastesRead(world),
    m = marketsOf(world).get(cell),
    ix = moneyStore(world, INTOX_STORE)?.get(cell),
    tb = societyStore(world, TABLE_STORE)?.get(cell),
    rs = societyStore(world, LEISURE_STORE)?.get(cell),
    rows: Stat[] = [];
  const mine: { i: number; v: number; ratio: number }[] = [];
  TASTES.forEach((taste, i) => {
    const v =
      taste.good !== undefined
        ? (m?.book("used", taste.good) ?? 0) / n
        : taste.kind !== undefined
          ? (ix?.[INTOX.use + taste.kind] ?? 0) / 1000
          : i === SPICE
            ? (tb?.[TABLE.means + SPICE_MEAN] ?? 0) / 1000
            : (rs?.[LEISURE_ROW.feasts] ?? 0);
    const mid = t.middle[i]!;
    if (v > 0 && mid > 0 && v / mid >= LOVED) mine.push({ i, v, ratio: v / mid });
  });
  mine.sort((a, b) => b.ratio - a.ratio || a.i - b.i);
  for (const x of mine.slice(0, 3)) {
    const taste = TASTES[x.i]!,
      parts: ReturnType<typeof part>[] = [];
    if (taste.kind !== undefined) {
      const cost = kindCost(INTOX_KINDS[taste.kind]!, x.v);
      parts.push(
        part("come to need it", `${(cost.dependent * 1000).toFixed(1)} in a thousand`),
        part("die of it a year", `${(cost.deaths * 1e5).toFixed(1)} in a hundred thousand`),
        part(
          cost.lost >= 0 ? "work lost to it" : "work it keeps them at",
          pct(Math.abs(cost.lost)),
        ),
      );
    } else if (taste.good !== undefined && m) {
      const used = m.book("used", taste.good),
        brought = m.book("in", taste.good);
      if (used > 0) parts.push(part("comes in from other lands", pct(Math.min(1, brought / used))));
      parts.push(part("costs its people", `${grain(x.v * m.price[taste.good]!)} a head a year`));
    } else if (x.i === SPICE)
      parts.push(part("spares its food's spoiling", pct(KEEPING.spice * Math.min(1, x.v))));
    rows.push(
      stat(cap(taste.name), `${taste.say(x.v)}: ${times(x.ratio)} the world's middle realm`, {
        parts,
      }),
    );
  }
  // Its realm's wares smuggled, as they reach it: most across a border land's.
  const wares = contrabandOf(world, r.ref).filter((w) => w.share >= 0.1);
  if (wares.length)
    rows.push(
      stat("Crosses its realm's borders unseen", wares.map(contraWords).join("; "), {
        parts: [part([link("its realm's underworld", `${r.ref}#underworld`)], "who carries it")],
      }),
    );
  return rows.length ? [{ type: "facts", title: "What its people love", rows }] : [];
}

// —— Kind by kind ———————————————————————————————————————————————————————————————————————————————————————

/** One kind's reading in a realm: its lands that grow it, what is taken a head, from where, its law, what slips past, what it costs. */
export type KindRead = {
  readonly grown: number;
  readonly lands: number;
  readonly taken: number;
  readonly reach: number;
  readonly from: Polity | undefined;
  readonly barred: number;
  readonly excise: number;
  readonly unseen: number;
  readonly cost: ReturnType<typeof kindCost>;
};

/** A realm's reading of one kind (null: none of its lands keeps a row). */
export function kindRead(world: World, r: Polity, k: number): KindRead | null {
  const ctx = populationContext(world),
    intox = moneyStore(world, INTOX_STORE),
    kinds = moneyStore(world, KINDS_STORE)?.get(r.ref),
    bar = moneyStore(world, BAR_STORE)?.get(r.ref);
  let grown = 0,
    lands = 0,
    people = 0,
    taken = 0;
  for (const c of r.members) {
    const row = intox?.get(c),
      n = ctx.provinces.get(c)?.total() ?? 0;
    if (!row || n <= 0) continue;
    lands++;
    people += n;
    if (row[INTOX.have + k]! > 0) grown++;
    taken += (n * row[INTOX.use + k]!) / 1000;
  }
  if (!lands) return null;
  const from = kinds?.[KIND_ROW.width * k + KIND_ROW.from] ?? 0,
    w = contrabandOf(world, r.ref).find((x) => x.ware === WARE_INTOX + k),
    use = people ? taken / people : 0;
  return {
    grown,
    lands,
    taken: use,
    reach: (kinds?.[KIND_ROW.width * k + KIND_ROW.reach] ?? 0) / 1000,
    from: from
      ? politiesOf(world)
          .all()
          .find((p) => p.ref.endsWith(`:${from - 1}`))
      : undefined,
    barred: kindBarred(world, r.ref, k),
    excise: (bar?.[BAR.excise] ?? 0) / 1000,
    unseen: w?.share ?? 0,
    cost: kindCost(INTOX_KINDS[k]!, use),
  };
}

/** A kind read, as a table's cells: grown, taken, from, law, unseen, what it costs. */
export function kindCells(k: KindRead): Line[] {
  return [
    [k.grown ? `${count(k.grown)} of ${count(k.lands)} lands` : "none"],
    [k.taken > 0 ? pct(k.taken) : "none"],
    k.reach > 0.05
      ? [`abroad (${pct(k.reach)})`, ...(k.from ? [": ", link(k.from.town, k.from.ref)] : [])]
      : [k.grown ? "its own lands" : "—"],
    [
      k.barred >= 0.5
        ? `forbidden (${pct(k.barred)})`
        : k.barred >= 0.1
          ? `frowned on (${pct(k.barred)})`
          : k.excise > 0
            ? `taxed ${pct(k.excise)}`
            : "allowed",
    ],
    [k.unseen > 0 ? pct(k.unseen) : "—"],
    [
      k.taken > 0
        ? `${(k.cost.dependent * 1000).toFixed(1)}‰ need it, ${(k.cost.deaths * 1e5).toFixed(1)} die a year in 100,000, work ${k.cost.lost >= 0 ? "−" : "+"}${pct(Math.abs(k.cost.lost))}`
        : "—",
    ],
  ];
}

export const KIND_COLUMNS = [
  "Grown",
  "Taken by",
  "From",
  "Law",
  "Unseen",
  "What it costs",
] as const;

/** Why a kind is taken nowhere in a world, in one honest line (null: it is taken somewhere). */
export function kindAbsent(
  world: World,
  k: number,
  lands: number,
  taken: number,
  traded: boolean,
): string | null {
  const name = INTOX_WORDS[INTOX_KINDS[k]!].name;
  if (taken > 0)
    return traded || !lands
      ? null
      : `Grown in ${many(lands)}, but no trade carries ${name} beyond the realms that grow it.`;
  if (lands > 0) return `Grown in ${many(lands)}, but no one there takes ${name}.`;
  const l = intoxLineages(populationContext(world));
  if (INTOX_KINDS[k] === "calming")
    return `No land of this world gives ${name}: none of its ${count(l.growing)} growing lineages holds it, and none of its peoples brews.`;
  return l.holding[k]
    ? `${cap(name)} grows in no peopled land: the ${count(l.holding[k]!)} of this world's ${count(l.growing)} growing lineages that hold it live where no one does.`
    : `No land of this world grows ${name}: none of its ${count(l.growing)} growing lineages holds it.`;
}
const many = (n: number) => `${count(n)} ${n === 1 ? "land" : "lands"}`;

/** A realm's "Kind by kind" table, for its section on what calms, wakes and eases (none where none is kept). */
export function realmKindBlocks(world: World, r: Polity): Block[] {
  const rows: Row[] = [];
  INTOX_KINDS.forEach((kind, k) => {
    const read = kindRead(world, r, k);
    if (!read || (!read.grown && read.taken <= 0)) return;
    rows.push({ cells: [[cap(INTOX_WORDS[kind].name)], ...kindCells(read)], keys: [k] });
  });
  return rows.length
    ? [
        {
          type: "table",
          title: "Kind by kind",
          columns: ["What", ...KIND_COLUMNS],
          rows,
          fit: true,
        },
      ]
    : [];
}

/** Every ware's place among the wares, for a test or a page: its name. */
export const WARE_NAMES: readonly string[] = Array.from({ length: WARE_COUNT }, (_, w) =>
  wareName(w),
);
