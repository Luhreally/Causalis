// A realm's money and its fears, read for the pages (sim/finance, rules/finance.ts; asked 2026-11-14: "more visuals for econmy view
// tab like and like the stocks ... bonds, diffrent citizens owning stocks from diffrent countires, like emergent cold war dynamics").
// A realm's Money tab: what it pays to borrow and each part of that, its debt and who holds it, its listed works and who holds
// them, what its own people hold abroad, each through the years; how its wealth is owned. Its Fears: whom it fears and why, in
// words, with the four numbers behind each one tap down. The world's Money tab: the great realms' yields on one chart, who holds
// whom as a square of realms in their colours, the works' makings through the years. Its Camps tab: the two camps where two great
// realms fear each other, who stands with which, and the wars one paid for against the other's way. And the Camps lens for the
// map. Everything is read off what the world keeps: nothing here is kept or drawn, and reading it moves nothing.
import { yearOfMoment, type Ref, type World } from "../../kernel/index.ts";
import type { Block, Item, Line, Stat } from "../../bridge/index.ts";
import {
  FINANCE,
  LOSERS,
  WAY_NAMES,
  campsOf,
  campsStand,
  fearMoves,
  greatRealms,
  losersBefore,
  wayDistance,
  ownWords,
  wayWords,
  type CampRealm,
  type Camps,
} from "../../rules/index.ts";
import {
  FINANCE_EVENTS,
  creditOf,
  debtOf,
  diplomacyOf,
  financeOf,
  homePlanet,
  loreOf,
  politiesOf,
  populationContext,
  realmName,
  threatFrom,
  wayOf,
  yieldNow,
  type Fear,
  type Money,
  type Polity,
} from "../../sim/index.ts";
import { realmColor } from "../colors.ts";
import { WORKS_MAKINGS, fromSteps, yearsOf, TRADE_STEPS, type Log } from "../years.ts";
import { wayRow } from "./board.ts";
import { realmLink } from "./names.ts";
import { claimOf, count, item, link, part, stat, yearNow } from "./words.ts";
import type { Reading } from "../lenses.ts";

type Rgb = readonly [number, number, number];
type Point = { x: number; y: number };

const HOME: Rgb = [0.62, 0.64, 0.6],
  REST: Rgb = [0.4, 0.42, 0.44],
  CAMP: readonly [Rgb, Rgb] = [
    [0.86, 0.42, 0.26],
    [0.26, 0.56, 0.86],
  ],
  /** Each making's colour on the works' chart (WORKS_MAKINGS). */
  MAKING: readonly Rgb[] = [
    [0.55, 0.7, 0.95],
    [0.72, 0.74, 0.78],
    [0.45, 0.45, 0.5],
    [0.8, 0.62, 0.2],
    [0.9, 0.56, 0.3],
    [0.82, 0.86, 0.9],
    [0.76, 0.5, 0.82],
    [0.6, 0.82, 0.5],
    [0.86, 0.72, 0.56],
  ];

const pc = (bp: number) => `${(bp / 100).toFixed(1)} in a hundred a year`,
  hundredth = (x: number) => (x / 100).toFixed(2),
  nameOf = (world: World, ref: string) => {
    const p = politiesOf(world).get(ref as Ref);
    return p ? realmName(p) : "a realm now gone";
  };

/** A log's points, each value turned as `of` gives it. */
function points(log: Log<number> | undefined, of: (v: number) => number): Point[] {
  return log ? log.y.map((y, i) => ({ x: y, y: of(log.v[i]!) })) : [];
}
/** The same with a point now. */
function through(log: Log<number> | undefined, of: (v: number) => number, now: number, y: number) {
  const pts = points(log, of);
  if (!pts.length) return pts;
  if (pts.at(-1)!.x === now) pts[pts.length - 1] = { x: now, y };
  else pts.push({ x: now, y });
  return pts;
}

// —— The camps, read once a moment ————————————————————————————————————————————————————————————————

type CampsRead = {
  readonly nodes: readonly CampRealm[];
  readonly camps: Camps | null;
  /** Each realm's side: 0 or 1; absent, of neither. */
  readonly side: ReadonlyMap<string, 0 | 1>;
  /**
   * The two great realms every realm's way is read between: the camps' poles; where no camps stand, the two realms, each great
   * enough to be a pole, held and owned the least alike (null: a world with fewer than two great realms).
   */
  readonly axis: readonly [string, string] | null;
  /** Each realm's lean between them: -1 held as the first is, 1 as the second. */
  readonly lean: ReadonlyMap<string, number>;
};
const CAMPS = new WeakMap<World, { at: number; read: CampsRead }>();

/** A world's camps now (rules/finance.ts campsOf), over its standing realms. */
export function campsRead(world: World): CampsRead {
  const hit = CAMPS.get(world);
  if (hit && hit.at === world.now) return hit.read;
  const ctx = populationContext(world),
    store = financeOf(world),
    diplomacy = diplomacyOf(world),
    sworn = new Map<string, string[]>();
  for (const r of diplomacy.all())
    if (r.pact) {
      (sworn.get(r.a) ?? sworn.set(r.a, []).get(r.a)!).push(r.b);
      (sworn.get(r.b) ?? sworn.set(r.b, []).get(r.b)!).push(r.a);
    }
  const nodes: CampRealm[] = politiesOf(world)
      .living()
      .map((p) => ({
        ref: p.ref,
        way: wayOf(world, p.ref),
        people: p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
        fears: (store?.of(p.ref)?.fears ?? []).map((f) => ({ of: f.of, level: f.level / 100 })),
        sworn: sworn.get(p.ref) ?? [],
      })),
    camps = campsOf(nodes),
    side = new Map<string, 0 | 1>();
  if (camps) camps.camps.forEach((c, i) => c.forEach((r) => side.set(r, i as 0 | 1)));
  let axis: [string, string] | null = camps ? [camps.poles[0], camps.poles[1]] : null;
  if (!axis) {
    const great = greatRealms(nodes).slice(0, 12);
    let far = 0;
    for (let i = 0; i < great.length; i++)
      for (let j = i + 1; j < great.length; j++) {
        const d = wayDistance(great[i]!.way, great[j]!.way);
        if (d > far) {
          far = d;
          axis = [great[i]!.ref, great[j]!.ref];
        }
      }
  }
  const lean = new Map<string, number>();
  if (axis) {
    const x = nodes.find((r) => r.ref === axis![0])!,
      y = nodes.find((r) => r.ref === axis![1])!;
    for (const r of nodes) {
      const dx = wayDistance(r.way, x.way),
        dy = wayDistance(r.way, y.way);
      lean.set(r.ref, dx + dy > 0 ? (dx - dy) / (dx + dy) : 0);
    }
  }
  const read = { nodes, camps, side, axis, lean };
  CAMPS.set(world, { at: world.now, read });
  return read;
}

// —— A realm's money ————————————————————————————————————————————————————————————————————————————————

/** A fear in a sentence: whom, how each is held and owned, and who would lose. */
function fearWords(world: World, r: Polity, f: Fear): Line {
  const mine = wayOf(world, r.ref),
    theirs = wayOf(world, f.of);
  return [
    f.level >= FINANCE.feared * 100 ? "It fears how " : "It is wary of how ",
    realmLink(world, f.of),
    ` is held: there ${wayWords(theirs)}; here ${wayWords(mine)}. ${losersBefore(f.who)[0]!.toUpperCase()}${losersBefore(f.who).slice(1)} would lose by it.`,
  ];
}

/** A fear's numbers, one tap down: the four it is the product of, and what it presses. */
function fearParts(world: World, r: Polity, f: Fear) {
  const mine = wayOf(world, r.ref),
    theirs = wayOf(world, f.of),
    moves = fearMoves(mine, theirs, threatFrom(f)),
    press = (["arms kept from its people", "how many decide", "how freely word moves"] as const)
      .map((name, k) => ({ name, v: moves[k]! }))
      .filter((x) => Math.abs(x.v) >= 0.01);
  return [
    part("how unlike their ways are", hundredth(f.unlike)),
    part("× how well the other's is seen to work", hundredth(f.works)),
    part("× how far its people are exposed to it", hundredth(f.exposed)),
    part(`× what ${losersBefore(f.who)} would lose`, hundredth(f.loss)),
    part(`× ${FINANCE.fear}, to at most 1: this year's`, hundredth(f.now)),
    part("half of last year's and half of this", hundredth(f.level)),
    ...WAY_NAMES.map((n, k) =>
      part(`  ${n}: here against there`, `${mine[k]!.toFixed(2)} / ${theirs[k]!.toFixed(2)}`),
    ),
    ...press.map((x) => part(`it presses ${x.name}`, `${x.v > 0 ? "+" : ""}${x.v.toFixed(2)}`)),
  ];
}

/** Whom a realm fears and why: a plain reading, each fear's numbers one tap down. */
export function realmFearBlocks(world: World, r: Polity): Block[] {
  const m = financeOf(world)?.of(r.ref);
  if (!m) return [];
  const body = homePlanet(world).generated.life.people?.body,
    own = m.own.map((x) => x / 100),
    way = wayOf(world, r.ref),
    read = campsRead(world),
    side = read.side.get(r.ref),
    blocks: Block[] = [];
  const top = m.fears[0],
    lines: Line[] = [];
  if (top && top.level >= 10) lines.push(fearWords(world, r, top));
  else
    lines.push([
      "It fears no realm's way: none it meets is held unlike it, seen to fare better, and near enough to its people at once.",
    ]);
  if (read.camps && side !== undefined)
    lines.push([
      "It stands with ",
      realmLink(world, read.camps.poles[side]),
      " against ",
      realmLink(world, read.camps.poles[side === 0 ? 1 : 0]),
      read.camps.poles[side] === r.ref ? ", the head of its camp." : ".",
    ]);
  blocks.push({ type: "text", title: "Whom it fears", lines });
  if (m.fears.length)
    blocks.push({
      type: "facts",
      title: "Its fears, and the numbers behind each",
      rows: m.fears.map((f) =>
        stat(nameOf(world, f.of), [`${hundredth(f.level)}: ${losersBefore(f.who)} would lose`], {
          why: m.told === f.of ? (m.toldEvent ?? null) : null,
          parts: fearParts(world, r, f),
        }),
      ),
    });
  const log = yearsOf(world)?.realms.get(r.ref)?.fear,
    pts = through(log, (v) => v / 100, yearNow(world), (top?.level ?? 0) / 100);
  if (pts.length >= 2)
    blocks.push({
      type: "series",
      title: "Its greatest fear",
      units: "of 1",
      unit: "price",
      points: pts,
      latest: `${hundredth(top?.level ?? 0)} of 1`,
      note: "How much it fears the way of the realm it fears most, year by year: how unlike × how well seen to work × how exposed × what its holders would lose.",
      color: realmColor(r.ref),
    });
  blocks.push({
    type: "facts",
    title: "Its own way",
    rows: [
      stat("Who decides, whose the wealth", wayWords(way)),
      stat("Its wealth", ownWords(own, body), {
        why: m.ownEvents?.[1] ?? m.ownEvents?.[0] ?? null,
        parts: [
          part("among how many it lies (0 a few, 1 every household)", own[0]!.toFixed(2)),
          part("how much the realm holds for all", own[1]!.toFixed(2)),
        ],
      }),
    ],
  });
  return blocks;
}

/** A realm's money: what it pays to borrow, what it owes and to whom, its listed works and who holds them, what its people hold abroad. */
export function realmMoneyBlocks(world: World, r: Polity): Block[] {
  const store = financeOf(world),
    m = store?.of(r.ref);
  if (!store || !m) return [];
  const ctx = populationContext(world),
    now = yearNow(world),
    y = yieldNow(ctx, r),
    owed = debtOf(m),
    abroad = owed - m.home,
    log = yearsOf(world)?.realms.get(r.ref),
    color = realmColor(r.ref),
    faithless = creditOf(world)?.faithless(r.ref, now),
    banking = !!loreOf(world).get(r.seat, "banking"),
    blocks: Block[] = [];
  // (A realm whose seat knows no banking, that owes nothing and is held by no one: it has no money to tell of.)
  if (!banking && owed <= 0 && !m.shares.length && !m.burnt?.length && m.income <= 0) return [];
  const rows: Stat[] = [];
  if (y && banking)
    rows.push(
      stat(
        "New debt would cost it",
        y.rate > FINANCE.shut
          ? `${pc(y.rate * 10_000)}: more than anyone will lend at`
          : pc(y.rate * 10_000),
        {
          parts: y.parts.map((p) =>
            part(p.name, `${p.value >= 0 ? "+" : ""}${(p.value * 100).toFixed(1)}`),
          ),
        },
      ),
    );
  rows.push(
    stat(
      "It has sold",
      owed > 0
        ? `${count(owed)} grain's worth, at ${pc(m.coupon)}: ${count(m.home)} to its own people, ${count(abroad)} abroad`
        : "no debt",
      {
        why: m.sale ?? null,
        ...(y
          ? {
              parts: [
                part("in years of what it takes in", y.burden.toFixed(2)),
                part("what it takes in a year", count(y.takings)),
              ],
            }
          : {}),
      },
    ),
  );
  if (m.paid > 0) rows.push(stat("It paid abroad this year", `${count(m.paid)} grain`));
  if (m.income > 0)
    rows.push(stat("Came home to its people from abroad", `${count(m.income)} grain's worth`));
  if (m.missed > 0)
    rows.push(stat("Interest unpaid", m.missed === 1 ? "a year" : `${m.missed} years running`));
  if (faithless)
    rows.push(
      stat("Held faithless", `since year ${faithless.year}: none lends it`, {
        why: faithless.event,
      }),
    );
  for (const [w, e] of m.chests ?? [])
    rows.push(stat("A war paid for by debt sold", [link("its war", w)], { why: e }));
  blocks.push({ type: "facts", title: "Its debt", rows });
  if (!banking && owed <= 0 && !m.shares.length)
    blocks.push({
      type: "text",
      lines: [
        [
          "Its seat does not know banking: it sells no debt, and no shares of its works are bought or sold.",
        ],
      ],
    });
  // Through the years: what it would pay, and what it owes.
  const rate = through(log?.rate, (v) => v / 100, now, m.rate / 100);
  if (rate.length >= 2)
    blocks.push({
      type: "series",
      title: "What it pays to borrow",
      units: "in a hundred a year",
      unit: "price",
      points: rate,
      latest: `${(m.rate / 100).toFixed(1)} in a hundred a year`,
      note: `Above ${FINANCE.shut * 100} no one buys its debt. Its record, its debt against its takings, its wars and how it is held move it.`,
      color,
    });
  const owes = through(log?.owed, (v) => fromSteps(v, TRADE_STEPS), now, owed);
  if (owes.length >= 2)
    blocks.push({
      type: "series",
      title: "What it owes",
      units: "grain's worth",
      unit: "worth",
      points: owes,
      latest: `${count(owed)} grain's worth`,
      color,
    });
  // Who holds its debt.
  if (owed > 0)
    blocks.push({
      type: "composition",
      title: "Who holds its debt",
      parts: [
        { name: ["its own people"], share: m.home / owed, amount: `${count(m.home)}`, color: HOME },
        ...m.held.map(([q, n]) => ({
          name: ["the people of ", realmLink(world, q)] as Line,
          share: n / owed,
          amount: `${count(n)}`,
          color: realmColor(q) as Rgb,
        })),
      ],
      note: "In grain's worth. Interest and a part of the debt go home to each people abroad each year, in food from its lands' stores.",
    });
  // Who holds its listed works.
  if (m.worth > 0) {
    const out = m.shares.reduce((s, [, n]) => s + n, 0) + m.rest;
    blocks.push({
      type: "composition",
      title: "Who holds its listed works",
      parts: [
        { name: ["its own people"], share: 1 - out / 10_000, color: HOME },
        ...m.shares.map(([q, n]) => ({
          name: ["the people of ", realmLink(world, q)] as Line,
          share: n / 10_000,
          color: realmColor(q) as Rgb,
        })),
        ...(m.rest > 0
          ? [{ name: ["others abroad"] as Line, share: m.rest / 10_000, color: REST }]
          : []),
      ],
      note: `Its works listed are worth ${count(m.worth)} grain's worth (two years of what they made). A holding follows how open both realms are, their regard, their peace and what the works return; a war between them, or a realm closing itself, takes it.`,
    });
    const listed = through(log?.listed, (v) => fromSteps(v, TRADE_STEPS), now, m.worth);
    if (listed.length >= 2)
      blocks.push({
        type: "series",
        title: "Its listed works' worth",
        units: "grain's worth",
        unit: "worth",
        points: listed,
        latest: `${count(m.worth)} grain's worth`,
        color,
      });
  }
  // What its people hold abroad.
  const held: { ref: Ref; share: number; debt: number }[] = [];
  for (const o of store.all()) {
    if (o.realm === r.ref) continue;
    const share = o.shares.find(([q]) => q === r.ref)?.[1] ?? 0,
      debt = o.held.find(([q]) => q === r.ref)?.[1] ?? 0;
    if (share > 0 || debt > 0) held.push({ ref: o.realm, share, debt });
  }
  if (held.length)
    blocks.push({
      type: "table",
      title: "What its people hold abroad",
      columns: ["Realm", "Of its listed works", "Of its debt"],
      fit: true,
      rows: held
        .sort((a, b) => b.share - a.share || b.debt - a.debt)
        .map((h) => ({
          ref: h.ref,
          cells: [
            [realmLink(world, h.ref)],
            [h.share ? `${(h.share / 100).toFixed(1)}%` : "—"],
            [h.debt ? `${count(h.debt)} grain's worth` : "—"],
          ],
          keys: [nameOf(world, h.ref), h.share, h.debt],
        })),
    });
  if (m.burnt?.length)
    blocks.push({
      type: "list",
      title: "Whom its people lost by, and will not buy of",
      items: m.burnt.map(([q, year]) =>
        item([
          realmLink(world, q),
          `, year ${year}: not again before year ${year + FINANCE.burnt}`,
        ]),
      ),
    });
  const told: Item[] = [m.refusal, m.sale]
    .filter((e): e is Ref => !!e)
    .map((e) => ({ ...item([claimOf(world, e)], e), why: e }));
  if (told.length) blocks.push({ type: "list", title: "Its last sale and refusal", items: told });
  return blocks;
}

/** A land's realm's money, for the land's Economy tab: what its realm pays to borrow through the years, and the way to the rest. */
export function landMoneyBlocks(world: World, cell: number): Block[] {
  const r = politiesOf(world).of(cell),
    m = r && r.ended === null ? financeOf(world)?.of(r.ref) : undefined;
  if (!r || !m || !loreOf(world).get(r.seat, "banking")) return [];
  const now = yearNow(world),
    owed = debtOf(m),
    rate = through(yearsOf(world)?.realms.get(r.ref)?.rate, (v) => v / 100, now, m.rate / 100),
    out = m.shares.reduce((s, [, n]) => s + n, 0) + m.rest,
    blocks: Block[] = [];
  if (rate.length >= 2)
    blocks.push({
      type: "series",
      title: `What ${realmName(r)} pays to borrow`,
      units: "in a hundred a year",
      unit: "price",
      points: rate,
      latest: `${(m.rate / 100).toFixed(1)} in a hundred a year`,
      color: realmColor(r.ref),
    });
  blocks.push(
    wayRow(
      "🏦",
      `The money of ${realmName(r)}`,
      `${r.ref}#money`,
      [
        owed > 0 ? `owes ${count(owed)}` : "owes nothing",
        `pays ${(m.rate / 100).toFixed(1)}%`,
        ...(m.worth > 0 ? [`${(out / 100).toFixed(1)}% of its works held abroad`] : []),
      ].join(", "),
    ),
  );
  return blocks;
}

/** Who abroad holds a realm's listed works, for its exchange's page (nothing where no one does). */
export function exchangeHolders(world: World, realm: string): Block[] {
  const m = financeOf(world)?.of(realm);
  if (!m || m.worth <= 0) return [];
  const out = m.shares.reduce((s, [, n]) => s + n, 0) + m.rest,
    blocks: Block[] = [
      {
        type: "composition",
        title: "Who holds what is listed here",
        parts: [
          { name: ["its own people"], share: 1 - out / 10_000, color: HOME },
          ...m.shares.map(([q, n]) => ({
            name: ["the people of ", realmLink(world, q)] as Line,
            share: n / 10_000,
            color: realmColor(q) as Rgb,
          })),
          ...(m.rest > 0
            ? [{ name: ["others abroad"] as Line, share: m.rest / 10_000, color: REST }]
            : []),
        ],
      },
    ],
    listed = through(
      yearsOf(world)?.realms.get(realm)?.listed,
      (v) => fromSteps(v, TRADE_STEPS),
      yearNow(world),
      m.worth,
    );
  if (listed.length >= 2)
    blocks.push({
      type: "series",
      title: "What is listed here, through the years",
      units: "grain's worth",
      unit: "worth",
      points: listed,
      latest: `${count(m.worth)} grain's worth`,
      color: realmColor(realm),
    });
  return blocks;
}

// —— The world's money ——————————————————————————————————————————————————————————————————————————————

/**
 * The realms a world's money is drawn for: those most held by others and holding of others first (so the square of who holds whom
 * shows what holdings there are), then those that owe or list the most.
 */
function greatest(world: World, most: number): Money[] {
  const store = financeOf(world);
  if (!store) return [];
  const all = store.all(),
    crossed = new Map<string, number>(),
    add = (r: string, n: number) => crossed.set(r, (crossed.get(r) ?? 0) + n);
  for (const m of all) {
    for (const [q, n] of m.shares) {
      add(q, (n / 10_000) * m.worth);
      add(m.realm, (n / 10_000) * m.worth);
    }
    for (const [q, n] of m.held) {
      add(q, n);
      add(m.realm, n);
    }
  }
  const own = (m: Money) => m.worth + debtOf(m),
    by = (m: Money) => crossed.get(m.realm) ?? 0;
  return all
    .filter((m) => own(m) + by(m) > 0)
    .sort((a, b) => by(b) - by(a) || own(b) - own(a) || (a.realm < b.realm ? -1 : 1))
    .slice(0, most);
}

/** The world's money: yields, who holds whom, the works' makings through the years. */
export function moneyLedger(world: World): Block[] {
  const store = financeOf(world),
    great = greatest(world, 8);
  if (!store || !great.length)
    return [
      {
        type: "text",
        lines: [
          [
            "No realm has sold debt or listed its works yet: both come where a seat knows banking. Until then realms borrow of the houses of lending (the Credit tab).",
          ],
        ],
      },
    ];
  const now = yearNow(world),
    years = yearsOf(world),
    blocks: Block[] = [],
    all = store.all(),
    owing = all.filter((m) => debtOf(m) > 0);
  // Who holds whom: a square of the greatest, each cell a share of the column's listed works and debt.
  const refs = great.map((m) => m.realm),
    cells = refs.map((holder) =>
      great.map((m) => {
        if (m.realm === holder) return 0;
        const owed = debtOf(m),
          share = (m.shares.find(([q]) => q === holder)?.[1] ?? 0) / 10_000,
          debt = owed > 0 ? (m.held.find(([q]) => q === holder)?.[1] ?? 0) / owed : 0,
          worth = m.worth + owed;
        return worth > 0 ? (share * m.worth + debt * owed) / worth : 0;
      }),
    );
  if (cells.some((row) => row.some((x) => x > 0)))
    blocks.push({
      type: "owning",
      title: "Who holds whom",
      realms: great.map((m) => ({
        ref: m.realm,
        name: nameOf(world, m.realm),
        color: realmColor(m.realm),
      })),
      cells,
      note: "Each row a people, each column a realm: how much of that realm's listed works and debt, together, that people holds. Press a square for its number.",
    });
  // What each pays to borrow, through the years.
  const lines = great
    .filter((m) => m.rate > 0)
    .slice(0, 6)
    .map((m) => ({
      name: nameOf(world, m.realm),
      ref: m.realm as string,
      color: realmColor(m.realm) as Rgb,
      points: through(years?.realms.get(m.realm)?.rate, (v) => v / 100, now, m.rate / 100),
    }))
    .filter((s) => s.points.length >= 2);
  if (lines.length)
    blocks.push({
      type: "lines",
      title: "What each pays to borrow (in a hundred a year)",
      series: lines,
      unit: "price",
    });
  if (owing.length)
    blocks.push({
      type: "bars",
      title: "What each owes (grain's worth)",
      bars: [...owing]
        .sort((a, b) => debtOf(b) - debtOf(a))
        .slice(0, 10)
        .map((m) => ({
          label: [realmLink(world, m.realm)],
          ref: m.realm,
          value: debtOf(m),
          color: realmColor(m.realm),
        })),
      unit: "count",
    });
  // The works' makings through the years.
  const works = years?.works;
  if (works && works.years.length >= 2) {
    const series = WORKS_MAKINGS.map((id, i) => ({
      name: id,
      color: MAKING[i]!,
      points: works.years.map((y, k) => ({ x: y, y: fromSteps(works.cols[i]![k]!, TRADE_STEPS) })),
    })).filter((s) => s.points.some((p) => p.y > 0));
    if (series.length)
      blocks.push({
        type: "lines",
        title: "What the world's works make, by making (grain's worth a year)",
        series,
        unit: "count",
        // (Each making on its own scale: tools and cloth are a hundred times the least of them.)
        apart: true,
      });
  }
  blocks.push({
    type: "table",
    title: "Every realm's money",
    columns: ["Realm", "Pays", "Owes", "Abroad", "Listed", "Held abroad", "Its wealth"],
    few: 12,
    rows: all
      .filter((m) => m.rate > 0 && (debtOf(m) > 0 || m.worth > 0))
      .sort((a, b) => b.worth + debtOf(b) - (a.worth + debtOf(a)))
      .map((m) => {
        const owed = debtOf(m),
          out = m.shares.reduce((s, [, n]) => s + n, 0) + m.rest;
        return {
          ref: m.realm,
          cells: [
            [realmLink(world, m.realm)],
            [`${(m.rate / 100).toFixed(1)}%`],
            [owed ? count(owed) : "—"],
            [owed ? `${Math.round((100 * (owed - m.home)) / owed)}%` : "—"],
            [m.worth ? count(m.worth) : "—"],
            [m.worth ? `${(out / 100).toFixed(1)}%` : "—"],
            [
              ownWords(
                m.own.map((x) => x / 100),
                homePlanet(world).generated.life.people?.body,
              ),
            ],
          ],
          keys: [
            nameOf(world, m.realm),
            m.rate,
            owed,
            owed ? (owed - m.home) / owed : 0,
            m.worth,
            out,
            m.own[1]! * 100 + m.own[0]!,
          ],
        };
      }),
  });
  // Debts refused, the newest first.
  const refused: Item[] = [];
  for (let i = world.events.count - 1; i >= 0 && refused.length < 8; i--) {
    const e = world.events.at(i);
    if (e.type === FINANCE_EVENTS.refused.type)
      refused.push({ ...item([claimOf(world, e.id)], e.id, yearOfMoment(e.t)), why: e.id });
  }
  if (refused.length)
    blocks.push({ type: "list", title: "Debts refused, the newest first", items: refused });
  return blocks;
}

/** The world's camps: the two, who stands with which, the greatest fears, and the wars one paid for against the other's way. */
export function campsLedger(world: World): Block[] {
  const store = financeOf(world);
  if (!store) return [];
  const read = campsRead(world),
    people = new Map(read.nodes.map((n) => [n.ref, n.people])),
    all = read.nodes.reduce((s, n) => s + n.people, 0),
    blocks: Block[] = [];
  if (read.camps) {
    const c = read.camps,
      stand = campsStand(c);
    blocks.push({
      type: "text",
      title: stand ? "Two camps" : "Two great realms that fear each other",
      lines: [
        [
          realmLink(world, c.poles[0]),
          ` (${wayWords(wayOf(world, c.poles[0] as Ref))}) and `,
          realmLink(world, c.poles[1]),
          ` (${wayWords(wayOf(world, c.poles[1] as Ref))}) fear each other's way: ${c.fear.toFixed(2)} between them, of 2.`,
        ],
        [
          stand
            ? `${c.camps[0].length} realms stand with the first and ${c.camps[1].length} with the second; ${c.apart.length} stand apart.`
            : `${c.camps[0].length - 1} other realms stand with the first and ${c.camps[1].length - 1} with the second: not two camps yet, while one of the two stands alone. A realm stands with one when it is nearer it in its way and bound to its side by a fear of the other or an oath. ${c.apart.length} stand apart.`,
        ],
      ],
    });
    blocks.push({
      type: "composition",
      title: "The world's people, by camp",
      parts: [
        {
          name: ["with ", realmLink(world, c.poles[0])],
          share: c.camps[0].reduce((s, r) => s + (people.get(r) ?? 0), 0) / Math.max(1, all),
          color: CAMP[0],
        },
        {
          name: ["with ", realmLink(world, c.poles[1])],
          share: c.camps[1].reduce((s, r) => s + (people.get(r) ?? 0), 0) / Math.max(1, all),
          color: CAMP[1],
        },
        {
          name: ["apart"],
          share: c.apart.reduce((s, r) => s + (people.get(r) ?? 0), 0) / Math.max(1, all),
          color: REST,
        },
      ],
    });
    c.camps.forEach((members, i) =>
      blocks.push({
        type: "list",
        title: `With ${nameOf(world, c.poles[i]!)}`,
        items: members
          .slice(0, 24)
          .map((r) => item([realmLink(world, r), `: ${wayWords(wayOf(world, r as Ref))}`], r)),
        ...(members.length > 24 ? { more: members.length - 24 } : {}),
      }),
    );
  } else
    blocks.push({
      type: "text",
      title: "No camps",
      lines: [
        [
          `No two great realms fear each other's way enough: camps stand where two realms, each among the world's ${FINANCE.campGreat} most peopled or with ${Math.round(FINANCE.campShare * 100)} in a hundred of its people, fear each other ${FINANCE.campFear} between them.`,
        ],
      ],
    });
  // The greatest fears.
  const fears = store
    .all()
    .flatMap((m) => m.fears.map((f) => ({ m, f })))
    .filter((x) => x.f.level >= 10)
    .sort((a, b) => b.f.level - a.f.level)
    .slice(0, 16);
  if (fears.length)
    blocks.push({
      type: "table",
      title: "The greatest fears",
      columns: ["Realm", "Fears", "Fear", "Who would lose"],
      few: 8,
      fit: true,
      rows: fears.map(({ m, f }) => ({
        ref: m.realm,
        cells: [
          [realmLink(world, m.realm)],
          [realmLink(world, f.of)],
          [hundredth(f.level)],
          [LOSERS[f.who]!],
        ],
        keys: [nameOf(world, m.realm), nameOf(world, f.of), f.level, f.who],
      })),
    });
  // Wars one people paid for against a way it feared.
  const backed: Item[] = [];
  for (let i = world.events.count - 1; i >= 0 && backed.length < 10; i--) {
    const e = world.events.at(i);
    if (e.type === FINANCE_EVENTS.sold.type && (e.data as { backer?: string } | null)?.backer)
      backed.push({ ...item([claimOf(world, e.id)], e.id, yearOfMoment(e.t)), why: e.id });
  }
  if (backed.length)
    blocks.push({
      type: "list",
      title: "Wars paid for by a people who feared the foe's way",
      items: backed,
    });
  return blocks;
}

// —— The Camps lens ————————————————————————————————————————————————————————————————————————————————

/**
 * A land under the Camps lens: -1 … 1, where its realm's way lies between the two great realms the world is read between (the
 * camps' poles; where no camps stand, the two great realms least alike): -1 held and owned as the first is, 1 as the second.
 * A realm that stands in a camp is drawn at least well to its side, a pole at its end. -2 for a land of no realm.
 */
export function campValue(world: World, cell: number): number {
  const r = politiesOf(world).of(cell);
  if (!r || r.ended !== null) return -2;
  const read = campsRead(world),
    side = read.side.get(r.ref);
  let v = read.lean.get(r.ref) ?? 0;
  if (side !== undefined) {
    const sign = side === 0 ? -1 : 1;
    v = read.camps!.poles[side] === r.ref ? sign : sign * Math.max(0.6, Math.abs(v));
  }
  return Math.round(v * 1000) / 1000;
}

/** A land under the Camps lens, in words: its realm's camp, whom it fears and how much, how it is held and owned. */
export function campReading(world: World, cell: number): Reading | null {
  const r = politiesOf(world).of(cell);
  if (!r || r.ended !== null) return null;
  const read = campsRead(world),
    m = financeOf(world)?.of(r.ref),
    side = read.side.get(r.ref),
    top = m?.fears[0],
    line =
      read.camps && side !== undefined
        ? read.camps.poles[side] === r.ref
          ? `${realmName(r)}: the head of a camp`
          : `${realmName(r)}: with ${nameOf(world, read.camps.poles[side]!)}`
        : read.camps
          ? `${realmName(r)}: of neither camp`
          : `${realmName(r)}: no camps stand`,
    lean = read.lean.get(r.ref) ?? 0,
    nearer = read.axis ? read.axis[lean <= 0 ? 0 : 1] : null;
  return {
    line,
    stats: [
      { label: "Held", value: wayWords(wayOf(world, r.ref)) },
      ...(nearer && read.axis
        ? [
            {
              label: "Nearer the way of",
              value:
                nearer === r.ref
                  ? "itself: one of the two great realms least alike"
                  : `${nameOf(world, nearer)} than ${nameOf(world, read.axis[lean <= 0 ? 1 : 0])}'s`,
            },
          ]
        : []),
      ...(top
        ? [
            { label: "Fears most", value: `${nameOf(world, top.of)}, ${hundredth(top.level)}` },
            { label: "Who would lose", value: LOSERS[top.who]! },
          ]
        : [{ label: "Fears", value: "no realm's way" }]),
      ...(m && m.rate > 0
        ? [{ label: "Pays to borrow", value: `${(m.rate / 100).toFixed(1)}%` }]
        : []),
    ],
  };
}
