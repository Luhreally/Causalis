// Over time (asked 2026-11-13: "am i able to see stats and like graphs over time in the country/land/league panels"): a
// realm's, a land's and an alliance's numbers through the years, each as it was in its year, read from what history keeps
// (the population's years) and what is kept beside it (host/years.ts). A realm's past is its own lands' of each year, never
// the lands it holds now; what befell it (its wars, its rulers, the god's hand) is marked on its lines. Each line ends at
// now, read as the page reads its own numbers, so its latest is the page's. Pure readings, made when a page is read.
import type { Ref, World } from "../../kernel/index.ts";
import {
  fieldedOf,
  homePlanet,
  marketsOf,
  orderOf,
  politiesOf,
  populationContext,
  warsOf,
  type Polity,
  type War,
} from "../../sim/index.ts";
import {
  worthWords,
  type Block,
  type SeriesMark,
  type SeriesUnit,
  type Tab,
} from "../../bridge/index.ts";
import { FOODS } from "../../rules/index.ts";
import { offworldSite } from "../../gen/index.ts";
import { realmColor } from "../colors.ts";
import { realmWealth } from "../wealth.ts";
import {
  LAND_COLUMNS,
  fromSteps,
  logAt,
  UNREAD,
  owedByLand,
  sentByLand,
  storesWorth,
  yearsOf,
  type RealmLog,
  type YearsStore,
} from "../years.ts";
import { count, share, yearNow } from "./words.ts";

type Point = { x: number; y: number };
type Rgb = readonly [number, number, number];

/** At most so many points a line (its first and last kept). */
export const MOST_POINTS = 160;
/** At most so many happenings marked on a line, the latest. */
const MOST_MARKS = 60;

/** At most `most` points, evenly through (the first and last kept). */
export function thinPoints(points: readonly Point[], most = MOST_POINTS): Point[] {
  if (points.length <= most) return [...points];
  return Array.from(
    { length: most },
    (_, i) => points[Math.round((i * (points.length - 1)) / (most - 1))]!,
  );
}

const WRITE: Readonly<Record<SeriesUnit, (y: number) => string>> = {
  count: (y) => count(y),
  share: (y) => share(y),
  worth: (y) => worthWords(y),
  price: (y) => y.toFixed(2),
  months: (y) => y.toFixed(1),
};

/** A line: its points thinned, its latest in words (the last point's, as the page writes it). */
function series(
  title: string,
  units: string,
  unit: SeriesUnit,
  points: readonly Point[],
  extra: { note?: string; marks?: readonly SeriesMark[]; color?: Rgb; latest?: string } = {},
): Block {
  const last = points.at(-1);
  return {
    type: "series",
    title,
    units,
    unit,
    points: thinPoints(points),
    latest: extra.latest ?? (last ? `${WRITE[unit](last.y)} ${units}` : "—"),
    ...(extra.note ? { note: extra.note } : {}),
    ...(extra.marks?.length ? { marks: extra.marks.slice(-MOST_MARKS) } : {}),
    ...(extra.color ? { color: extra.color } : {}),
  };
}

/** A point now, after a line's kept years (the last kept is of a year closed, now is the year open). */
function withNow(points: Point[], now: number, y: number): Point[] {
  if (points.at(-1)?.x === now) points[points.length - 1] = { x: now, y };
  else points.push({ x: now, y });
  return points;
}

// ————— A realm —————

/** A realm's own years: its lands of each year, and their people, how they ate, and its host. */
export type RealmThrough = {
  readonly ref: string;
  /** The years history keeps that it stood in (its lands then), each with its numbers. */
  readonly years: readonly number[];
  readonly people: readonly number[];
  readonly lands: readonly number[];
  /** How well they ate in their leanest month (a share). */
  readonly fed: readonly number[];
  /** Its host (absent where it was not yet read). */
  readonly host: readonly (number | null)[];
  /** The decades its lands' own numbers were read in, with them summed: grievance (a share), wealth a head, trade. */
  readonly decades: readonly number[];
  readonly grievance: readonly number[];
  readonly worth: readonly number[];
  readonly trade: readonly number[];
  readonly log: RealmLog | null;
  /** The first year kept of it. */
  readonly first: number | null;
};

const THROUGH = new WeakMap<World, { at: number; by: Map<string, RealmThrough> }>();

/** The lands ever of a realm, by the changes kept of each land's realm. */
function landsEverOf(store: YearsStore, ref: string): number[] {
  const out: number[] = [];
  for (const [cell, log] of store.landRealm) if (log.v.includes(ref)) out.push(cell);
  return out;
}

/** A realm's own years (null: none kept of it): read once a moment. On the home world only, where asked (as an alliance counts). */
export function realmThrough(world: World, ref: string, home = false): RealmThrough | null {
  const store = yearsOf(world);
  if (!store) return null;
  let memo = THROUGH.get(world);
  if (!memo || memo.at !== world.now) THROUGH.set(world, (memo = { at: world.now, by: new Map() }));
  const key = home ? `${ref}|home` : ref,
    hit = memo.by.get(key);
  if (hit) return hit;
  const g = homePlanet(world).generated;
  const history = populationContext(world).history,
    log = store.realms.get(ref) ?? null,
    lands = landsEverOf(store, ref).filter((c) => !home || !offworldSite(g, c)),
    by = new Map<number, { people: number; fed: number; lands: number }>(),
    decades = new Map<number, { people: number; grieved: number; net: number; trade: number }>();
  for (const c of lands) {
    const realmLog = store.landRealm.get(c)!,
      isOf = (y: number) => y >= realmLog.first && logAt(realmLog, y) === ref;
    for (const line of history.yearsOf(c)) {
      if (!isOf(line.year)) continue;
      const a = by.get(line.year) ?? { people: 0, fed: 0, lands: 0 };
      a.people += line.population;
      a.fed += line.population * Math.min(1000, line.fed);
      a.lands++;
      by.set(line.year, a);
    }
    const rows = store.landRows(c);
    if (!rows) continue;
    const people = new Map(history.yearsOf(c).map((l) => [l.year, l.population] as const));
    rows.years.forEach((y, i) => {
      if (!isOf(y) || rows.cols[0]![i]! === UNREAD) return;
      const n = people.get(y) ?? 0,
        a = decades.get(y) ?? { people: 0, grieved: 0, net: 0, trade: 0 };
      a.people += n;
      a.grieved += n * (rows.cols[LAND_COLUMNS.indexOf("grievance")]![i]! / 100);
      a.net += n * fromSteps(rows.cols[LAND_COLUMNS.indexOf("worth")]![i]!);
      a.trade += fromSteps(rows.cols[LAND_COLUMNS.indexOf("trade")]![i]!);
      decades.set(y, a);
    });
  }
  const years = [...by.keys()].sort((a, b) => a - b),
    ds = [...decades.keys()].sort((a, b) => a - b),
    read: RealmThrough = {
      ref,
      years,
      people: years.map((y) => by.get(y)!.people),
      lands: years.map((y) => by.get(y)!.lands),
      fed: years.map((y) => {
        const a = by.get(y)!;
        return a.people ? a.fed / a.people / 1000 : 1;
      }),
      host: years.map((y) => {
        const s = logAt(log?.host, y);
        return s === undefined ? null : Math.round((by.get(y)!.people * s) / 10_000);
      }),
      decades: ds,
      grievance: ds.map((y) => {
        const a = decades.get(y)!;
        return a.people ? a.grieved / a.people : 0;
      }),
      worth: ds.map((y) => {
        const a = decades.get(y)!;
        return a.people ? Math.max(0, a.net) / a.people : 0;
      }),
      trade: ds.map((y) => decades.get(y)!.trade),
      log,
      first: log?.first ?? null,
    };
  memo.by.set(key, read);
  return read;
}

/** A realm's numbers now, as its page reads them. */
export function realmNow(world: World, r: Polity) {
  const ctx = populationContext(world),
    sent = sentByLand(world),
    realms = politiesOf(world);
  let people = 0,
    grieved = 0,
    trade = 0;
  for (const c of r.members) {
    const n = ctx.provinces.get(c)?.total() ?? 0;
    people += n;
    grieved += n * Math.min(1, realms.discontent(c).level);
    trade += sent.get(c) ?? 0;
  }
  return {
    people,
    lands: r.members.length,
    grievance: people ? grieved / people : 0,
    trade,
    worth: realmWealth(world, r.ref)?.head ?? null,
    standing: orderOf(world)?.of(r.ref)?.legitimacy ?? null,
    tithe: r.tribute,
  };
}

/** A war's words on a realm's lines. */
function warWords(world: World, ref: string, w: War): string {
  const other = politiesOf(world).get((w.attacker === ref ? w.defender : w.attacker) as Ref),
    name = other?.town ?? "a realm now gone";
  if (w.civil) return `a civil war against ${name}`;
  return w.attacker === ref ? `made war on ${name}` : `${name} made war on it`;
}

/** What befell a realm, marked: its wars begun, its new rulers, the god's blessings and curses. */
function realmMarks(world: World, ref: string, wars: readonly War[], log: RealmLog | null) {
  const war: SeriesMark[] = wars.map((w) => ({
    x: w.declared,
    kind: "war",
    label: warWords(world, ref, w),
  }));
  const ruler: SeriesMark[] = (log?.rulers ?? []).map((y) => ({
    x: y,
    kind: "ruler",
    label: "a new ruler",
  }));
  const acts: SeriesMark[] = (log?.acts.y ?? []).map((y, i) => ({
    x: y,
    kind: log!.acts.v[i] ? "curse" : "bless",
    label: log!.acts.v[i] ? "the god cursed it" : "the god blessed it",
  }));
  const by = (...lists: SeriesMark[][]) => lists.flat().sort((a, b) => a.x - b.x);
  return { war, ruler, acts, by };
}

/** A step log read at each of some years (null where it had not begun). */
function stepAt(
  log: RealmLog["standing"] | undefined,
  years: readonly number[],
): (number | null)[] {
  return years.map((y) => {
    const v = logAt(log, y);
    return v === undefined || v < 0 ? null : v;
  });
}

const points = (years: readonly number[], values: readonly (number | null)[]): Point[] =>
  years.flatMap((x, i) =>
    values[i] === null || values[i] === undefined ? [] : [{ x, y: values[i]! }],
  );

/** A realm's Over time tab: its own numbers through the years, and what befell it, marked. */
export function realmTimeTab(world: World, r: Polity): Tab {
  const t = realmThrough(world, r.ref),
    now = yearNow(world),
    living = r.ended === null,
    color = realmColor(r.ref),
    wars = warsOf(world)
      .all()
      .filter((w) => w.attacker === r.ref || w.defender === r.ref);
  if (!t || t.years.length + (living ? 1 : 0) < 2)
    return {
      id: "time",
      name: "Over time",
      blocks: [
        {
          type: "text",
          lines: [
            [
              t?.first !== null && t?.first !== undefined
                ? `Its years have been kept since year ${t.first}: there are not yet enough of them to draw.`
                : "No years of it were kept: it stood before this world's years began to be kept.",
            ],
          ],
        },
      ],
    };
  const n = realmNow(world, r),
    m = realmMarks(world, r.ref, wars, t.log),
    live = <T>(pts: Point[], y: T | null, f: (v: T) => number) =>
      living && y !== null ? withNow(pts, now, f(y)) : pts,
    years = t.years;
  // Wars fought at once, and the fallen, read off its wars (history keeps every war and its battles).
  const span = [years[0]!, living ? now : years.at(-1)!] as const,
    fought = years.map(
      (y) => wars.filter((w) => w.declared <= y && (w.ended ?? Infinity) >= y).length,
    ),
    bin = span[1] - span[0] <= 400 ? 10 : span[1] - span[0] <= 2000 ? 50 : 100,
    fell = new Map<number, number>();
  for (const w of wars) {
    const side = w.attacker === r.ref ? 0 : 1;
    if (!w.fallen[side]) continue;
    for (const b of w.battles) {
      if (b.year < span[0]) continue;
      const k = Math.floor(b.year / bin) * bin;
      fell.set(k, (fell.get(k) ?? 0) + b.fallen[side]);
    }
  }
  const fallen: Point[] = [];
  for (let k = Math.floor(span[0] / bin) * bin; k <= span[1]; k += bin)
    fallen.push({ x: k, y: fell.get(k) ?? 0 });
  const blocks: Block[] = [
    {
      type: "text",
      lines: [
        [
          `Each line is ${r.town} as it was in each year: its own lands of that year, not the lands it holds now. ` +
            `History keeps every year of the last century, then one in ten, then one in a hundred; its lands' own numbers once a decade. ` +
            (living ? "Each line ends now." : `It fell in year ${r.ended}: its lines end there.`),
        ],
      ],
    },
    series(
      "People",
      "people",
      "count",
      live(points(years, t.people), n.people, (v) => v),
      {
        color,
        marks: m.by(m.war, m.ruler, m.acts),
        ...(living ? { latest: `${count(n.people)} people` } : {}),
      },
    ),
    series(
      "Lands",
      "lands",
      "count",
      live(points(years, t.lands), n.lands, (v) => v),
      {
        color,
        marks: m.war,
        note: "A land gained or lost is a step in it.",
      },
    ),
    series("How well fed", "of what they need", "share", points(years, t.fed), {
      color,
      note: "In their leanest month of the year, by its lands' people.",
    }),
  ];
  if (t.decades.length + (living ? 1 : 0) >= 2)
    blocks.push(
      series(
        "Wealth a head",
        "a head",
        "worth",
        live(points(t.decades, t.worth), n.worth, (v) => v),
        {
          color,
          note: "Its lands' stores at their goods' usual worth, less what they owed, shared among its people; read once a decade, to within a twentieth.",
        },
      ),
    );
  {
    const host = points(years, t.host);
    // (Now as its army's page counts it: its fighting men, the share of them it fields.)
    if (living) withNow(host, now, Math.round(fieldedOf(populationContext(world), r)));
    if (host.length >= 2)
      blocks.push(
        series("Its host", "men", "count", host, {
          color,
          marks: m.war,
          note: "The men it fields: its fighting men, the share of them it sends. Its share of its people is kept as it moves by a fiftieth.",
        }),
      );
  }
  blocks.push(
    series(
      "Wars fought",
      "wars at once",
      "count",
      live(points(years, fought), wars.filter((w) => w.ended === null).length, (v) => v),
      {
        color,
        marks: m.war,
      },
    ),
    series("Its fallen in war", `fallen in ${bin} years`, "count", fallen, {
      color,
      marks: m.war,
      note: `Its dead in battle, each ${bin} years, from its wars' battles.`,
    }),
  );
  if (t.decades.length + (living ? 1 : 0) >= 2)
    blocks.push(
      series(
        "Grievance",
        "of the most there is",
        "share",
        live(points(t.decades, t.grievance), n.grievance, (v) => v),
        {
          color,
          marks: m.by(m.ruler, m.acts),
          note: "Its lands' grievance against it, by their people; read once a decade.",
        },
      ),
    );
  {
    const standing = points(
      years,
      stepAt(t.log?.standing, years).map((v) => (v === null ? null : v / 100)),
    );
    if (living && n.standing !== null) withNow(standing, now, n.standing);
    if (standing.length >= 2)
      blocks.push(
        series("Standing with its people", "of full standing", "share", standing, {
          color,
          marks: m.by(m.ruler, m.acts),
          note: "Kept as it moves by two in a hundred.",
        }),
      );
  }
  {
    const tithe = points(
      years,
      stepAt(t.log?.tithe, years).map((v) => (v === null ? null : v / 100)),
    );
    if (living) withNow(tithe, now, Math.round(r.tribute * 100) / 100);
    if (tithe.length >= 2)
      blocks.push(
        series("Tithe", "of each land's grain to the seat", "share", tithe, {
          color,
          marks: m.ruler,
        }),
      );
  }
  if (t.decades.length + (living ? 1 : 0) >= 2)
    blocks.push(
      series(
        "Trade",
        "sent",
        "worth",
        live(points(t.decades, t.trade), n.trade, (v) => v),
        {
          color,
          marks: m.war,
          note: "What its lands sent along the roads and over the sea in a year, at the goods' usual worth; read once a decade.",
        },
      ),
    );
  return { id: "time", name: "Over time", blocks };
}

// ————— A land —————

/** A land's Over time tab: its people and how they ate, its grievance, stores, wealth, trade, sickness and towns. */
export function landTimeTab(world: World, cell: number): Tab | null {
  const ctx = populationContext(world),
    p = ctx.provinces.get(cell);
  if (!p) return null;
  const store = yearsOf(world),
    history = ctx.history.yearsOf(cell),
    now = yearNow(world),
    realms = politiesOf(world),
    m = marketsOf(world).get(cell),
    people = p.total(),
    rows = store?.landRows(cell) ?? null,
    realmLog = store?.landRealm.get(cell),
    col = (name: (typeof LAND_COLUMNS)[number]) => LAND_COLUMNS.indexOf(name);
  // Its realm through the years, marked where it changed.
  const marks: SeriesMark[] = [];
  if (realmLog)
    realmLog.y.forEach((y, i) => {
      if (!i && y <= realmLog.first) return;
      const to = realmLog.v[i]!,
        r = to ? realms.get(to as Ref) : undefined;
      marks.push({
        x: y,
        kind: "realm",
        label: to ? `of ${r?.town ?? "a realm now gone"} from then` : "of no realm from then",
      });
    });
  const kept = (c: number): Point[] =>
    rows
      ? rows.years.flatMap((x, i) =>
          rows.cols[c]![i]! === UNREAD ? [] : [{ x, y: rows.cols[c]![i]! }],
        )
      : [];
  const blocks: Block[] = [
    {
      type: "text",
      lines: [
        [
          "Each line is this land as it was in each year. History keeps every year of the last century, then one in ten, then one in a hundred; its own numbers beside that once a decade. Each line ends now.",
        ],
      ],
    },
  ];
  const peopleLine = withNow(
    history.map((y) => ({ x: y.year, y: y.population })),
    now,
    people,
  );
  blocks.push(
    series("People", "people", "count", peopleLine, { marks, latest: `${count(people)} people` }),
  );
  if (history.length >= 2)
    blocks.push(
      series(
        "How well fed",
        "of what they need",
        "share",
        history.map((y) => ({ x: y.year, y: Math.min(1, y.fed / 1000) })),
        { note: "In their leanest month of each year." },
      ),
    );
  if (rows) {
    blocks.push(
      series(
        "Grievance",
        "of the most there is",
        "share",
        withNow(
          kept(col("grievance")).map((q) => ({ x: q.x, y: q.y / 100 })),
          now,
          Math.min(1, realms.discontent(cell).level),
        ),
        {
          marks,
          note: "Against the realm it was of; read once a decade.",
        },
      ),
    );
    const food = people && m ? m.food(FOODS) / people : 0;
    blocks.push(
      series(
        "Food put by",
        "months",
        "months",
        withNow(
          kept(col("food")).map((q) => ({ x: q.x, y: q.y / 10 })),
          now,
          food,
        ),
        {
          note: "The months its stores of food would feed its people; read once a decade, to two figures.",
        },
      ),
    );
    const owed = owedByLand(world).get(cell) ?? 0,
      worth = people ? Math.max(0, storesWorth(world, cell) - owed) / people : 0;
    blocks.push(
      series(
        "Wealth a head",
        "a head",
        "worth",
        withNow(
          kept(col("worth")).map((q) => ({ x: q.x, y: Math.max(0, fromSteps(q.y)) })),
          now,
          worth,
        ),
        {
          note: "Its stores at their goods' usual worth, less what it owed, shared among its people; read once a decade, to within a twentieth.",
        },
      ),
    );
    blocks.push(
      series(
        "Trade",
        "sent",
        "worth",
        withNow(
          kept(col("trade")).map((q) => ({ x: q.x, y: fromSteps(q.y) })),
          now,
          sentByLand(world).get(cell) ?? 0,
        ),
        {
          note: "What it sent along the roads and over the sea in a year, at the goods' usual worth; read once a decade.",
        },
      ),
    );
    // Its dead of sickness: of each span between two years kept, a year's on the mean.
    const sick = kept(col("sick")),
      dead: Point[] = [];
    for (let i = 1; i < sick.length; i++)
      dead.push({
        x: sick[i]!.x,
        y: Math.max(0, sick[i]!.y - sick[i - 1]!.y) / Math.max(1, sick[i]!.x - sick[i - 1]!.x),
      });
    if (dead.length >= 2)
      blocks.push(
        series("Dead of sickness", "a year", "count", dead, {
          note: "A year's dead of sickness, on the mean of each span between two years kept.",
        }),
      );
  }
  blocks.push(
    series(
      "Towns",
      "towns",
      "count",
      withNow(
        history.map((y) => ({ x: y.year, y: y.settlements })),
        now,
        ctx.settlements.seenIn(cell).length,
      ),
      { marks },
    ),
  );
  const prices = m?.series ?? [];
  if (prices.length >= 2)
    blocks.push(
      series(
        "The price of food",
        "of its usual worth",
        "price",
        prices.map((y) => ({ x: y.year, y: y.food / 1000 })),
        { note: "Against its usual worth, 1.00." },
      ),
    );
  return { id: "time", name: "Over time", blocks };
}

// ————— An alliance —————

/** An alliance's Over time tab: its realms' people, lands and hosts summed in each year it has stood, and who joined and left. */
export function allianceTimeTab(
  world: World,
  a: { readonly head: Ref; readonly color: Rgb },
  /** Its numbers now, as its page says them. */
  now: {
    readonly realms: number;
    readonly lands: number;
    readonly people: number;
    readonly host: number;
  },
): Tab {
  const store = yearsOf(world),
    head = store?.realms.get(a.head),
    year = yearNow(world),
    realms = politiesOf(world),
    name = (ref: string) => realms.get(ref as Ref)?.town ?? "a realm now gone",
    empty = (words: string): Tab => ({
      id: "time",
      name: "Over time",
      blocks: [{ type: "text", lines: [[words]] }],
    });
  if (!store || !head)
    return empty(
      "No years of it were kept: its head stood before this world's years began to be kept.",
    );
  // The head it stood under in each year (its own head realm's alliance), and since when it has stood without a break.
  const headAt = (y: number) => (y >= head.first ? (logAt(head.bloc, y) ?? "") : ""),
    own = realmThrough(world, a.head, true)!;
  // (The last years of its head's own, each standing in an alliance, back to the first that did not.)
  let from = own.years.length;
  while (from > 0 && headAt(own.years[from - 1]!) !== "") from--;
  const stood = own.years.slice(from),
    heads = new Set(head.bloc.v.filter(Boolean)),
    candidates = [...store.realms].filter(([, l]) => l.bloc.v.some((h) => heads.has(h))),
    inIt = (ref: string, l: RealmLog, y: number) =>
      y >= l.first && headAt(y) !== "" && logAt(l.bloc, y) === headAt(y);
  const sum = new Map<number, { realms: number; people: number; lands: number; host: number }>();
  for (const [ref, l] of candidates) {
    const t = realmThrough(world, ref, true);
    if (!t) continue;
    t.years.forEach((y, i) => {
      if (y < (stood[0] ?? Infinity) || !inIt(ref, l, y)) return;
      const s = sum.get(y) ?? { realms: 0, people: 0, lands: 0, host: 0 };
      s.realms++;
      s.people += t.people[i]!;
      s.lands += t.lands[i]!;
      s.host += t.host[i] ?? 0;
      sum.set(y, s);
    });
  }
  // Who joined and who left: each change of a realm's alliance, or of the head it stood under, read as it fell.
  const changes = [...new Set(candidates.flatMap(([, l]) => l.bloc.y).concat(head.bloc.y))]
      .filter((y) => y > (stood[0] ?? Infinity))
      .sort((x, z) => x - z),
    marks: SeriesMark[] = [];
  for (const y of changes)
    for (const [ref, l] of candidates) {
      const was = inIt(ref, l, y - 1),
        is = inIt(ref, l, y);
      if (was !== is)
        marks.push({
          x: y,
          kind: is ? "join" : "leave",
          label: `${name(ref)} ${is ? "joined" : "left"}`,
        });
    }
  const ys = [...sum.keys()].sort((x, z) => x - z),
    line = (
      f: (s: { realms: number; people: number; lands: number; host: number }) => number,
      live: number,
    ) =>
      withNow(
        ys.map((x) => ({ x, y: f(sum.get(x)!) })),
        year,
        live,
      );
  if (ys.length < 1)
    return empty(
      `Its years have been kept since year ${head.first}: it has not yet stood long enough in them to draw.`,
    );
  const blocks: Block[] = [
    {
      type: "text",
      lines: [
        [
          `Its realms of each year, summed: those who stood with its head then, not its realms of now. It has stood since year ${stood[0] ?? year} as history keeps its years (every year of the last century, then one in ten). Past a century, one change in fifty years of who stood with whom is kept.`,
        ],
      ],
    },
    series(
      "Realms in it",
      "realms",
      "count",
      line((s) => s.realms, now.realms),
      { color: a.color, marks },
    ),
    series(
      "People",
      "people",
      "count",
      line((s) => s.people, now.people),
      { color: a.color, marks },
    ),
    series(
      "Lands",
      "lands",
      "count",
      line((s) => s.lands, now.lands),
      { color: a.color, marks },
    ),
    series(
      "Hosts",
      "men",
      "count",
      line((s) => s.host, Math.round(now.host)),
      {
        color: a.color,
        marks,
        note: "The men its realms field, each's share of its people kept as it moves by a fiftieth.",
      },
    ),
  ];
  if (marks.length)
    blocks.push({
      type: "list",
      title: "Who joined it and who left, the latest first",
      items: [...marks]
        .reverse()
        .slice(0, 30)
        .map((m) => ({ line: [`Year ${m.x}: ${m.label}`], year: m.x })),
    });
  return { id: "time", name: "Over time", blocks };
}
