// Who comes to a town's gate (town mode, P2), read off its world's year, never drawn of nothing: the caravans of the lands
// its land traded with last year (sim/economy markets' flows into it, each land's goods); those its world moved into its
// land this year, at the town's share of its land's people, by what drove them (sim/population migrateYear: a war fled, a
// faith barred, the hope of wages, else hunger and crowding); the envoys come to its court where it is a realm's seat
// (sim/war/ties.ts, D1); and the raiders of a risen land fallen on those its holder posts there (sim/war/occupation.ts).
// (A world's year is reckoned at its end: what it moved, sent and fought in its year Y is told at the turn into Y + 1, the
// first moment of the place's year, and comes over it. yearOfMoment(t) of that turn is Y.)
// Each comes on a day of its year by a draw keyed on the town, what comes and from where, so the same world gives the same
// days wherever it is looked at from. Pure: imports nothing of the place, which reads it at each day's turn.
import { DAY, YEAR, hashString, yearOfMoment, type Ref, type World } from "../kernel/index.ts";
import { GOODS } from "../rules/index.ts";
import { marketsOf, occupationOf, politiesOf, populationContext, tiesOf } from "../sim/index.ts";

/** What comes to the gate. Those who ask to live in the town are its newcomers (GATE_ASKS). */
export const GATE_KINDS = [
  "caravan",
  "refugees",
  "faithful",
  "seekers",
  "hungry",
  "envoy",
  "raiders",
  "settlers",
] as const;
export type GateKind = (typeof GATE_KINDS)[number];
export const GATE_ASKS: ReadonlySet<GateKind> = new Set([
  "refugees",
  "faithful",
  "seekers",
  "hungry",
  "settlers",
]);
export const GATE_ICON: Readonly<Record<GateKind, string>> = {
  caravan: "🐫",
  refugees: "🏚️",
  faithful: "🙏",
  seekers: "🎒",
  hungry: "🥣",
  envoy: "📜",
  raiders: "🗡️",
  settlers: "🧳",
};
/** Who came, by what and how many, as a line of the town's log begins. */
export const GATE_WHO: Readonly<Record<GateKind, (n: number) => string>> = {
  caravan: (n) => `A caravan of ${n}`,
  refugees: (n) => (n === 1 ? "One fleeing a war" : `${n} fleeing a war`),
  faithful: (n) => (n === 1 ? "One fleeing for their faith" : `${n} fleeing for their faith`),
  seekers: (n) => (n === 1 ? "One seeking work" : `${n} seeking work`),
  hungry: (n) => (n === 1 ? "One hungry wanderer" : `${n} hungry wanderers`),
  envoy: () => "An envoy",
  raiders: (n) => `${n} raiders`,
  settlers: (n) => (n === 1 ? "One come to settle" : `${n} come to settle`),
};
/** A land's caravans a year (est.: a trader's round of a season, Phase 48's road trade taken a land at a time). */
const CARAVANS_A_YEAR = 4;
/** The most lands whose caravans come (the most traded with first), and the most of each kind told a year. */
const CARAVAN_LANDS = 4,
  MOST_A_YEAR = 24;

/** One come to the gate: on what day (days since the world began) and hour, what, how many, from where, and why. */
export type GateArrival = {
  readonly day: number;
  readonly hour: number;
  readonly kind: GateKind;
  readonly count: number;
  readonly from: string;
  /** What they bring, or why they come, in words to follow "from <land>," (never empty). */
  readonly why: string;
  /** The event behind it (a migration, an envoy's, a raid) for its page; null: none kept. */
  readonly ref: string | null;
};

const CACHE = new WeakMap<World, Map<string, { key: string; list: GateArrival[] }>>();

/** A land's market town, else its greatest: where its trade comes, and what it is named by. */
function hubOf(world: World, cell: number) {
  const towns = populationContext(world)
    .settlements.seenIn(cell)
    .filter((x) => x.population > 0);
  return (
    towns.find((x) => x.market !== null) ??
    [...towns].sort((a, b) => b.population - a.population)[0]
  );
}
const landName = (world: World, cell: number): string =>
  hubOf(world, cell)?.name ?? "a land beyond";

/**
 * Those who come to a town's gate in a year of its world (cached until what it is read off changes: the month's turn at
 * the most). Ordered by day, then hour.
 */
export function gateArrivals(
  world: World,
  town: string,
  cell: number,
  year: number,
): GateArrival[] {
  const ctx = populationContext(world),
    s = ctx.settlements.get(town as Ref),
    month = Math.floor(world.now / (YEAR / 12)),
    key = `${year}|${month}`;
  let byTown = CACHE.get(world);
  if (!byTown) CACHE.set(world, (byTown = new Map()));
  const was = byTown.get(town);
  if (was && was.key === key) return was.list;
  const list: GateArrival[] = [];
  if (s && s.population > 0) {
    const all = ctx.provinces.get(cell)?.total() ?? 0,
      share = all > 0 ? Math.min(1, s.population / all) : 1,
      y0 = year * 365,
      // (A day of the year, and an hour of daylight, keyed on what comes.)
      on = (what: string, k: number, from = 0, span = 365 - from) => {
        const h = hashString(`${town}|${what}|${k}`, year) >>> 0,
          d = from + (h % Math.max(1, span));
        return { day: y0 + Math.min(364, d), hour: 8 + ((h >>> 9) % 9) };
      };
    // Caravans: of the lands its land traded with last year, the most traded with, each its goods.
    // (Its land's trade comes to its market town, else its greatest, whole; to another of its towns, at its share.)
    const markets = marketsOf(world),
      lands = new Map<number, Map<number, number>>(),
      traded = hubOf(world, cell)?.ref === s.ref ? 1 : share;
    for (const f of markets.flows) {
      if (f.to !== cell || f.from === cell) continue;
      let goods = lands.get(f.from);
      if (!goods) lands.set(f.from, (goods = new Map()));
      goods.set(f.good, (goods.get(f.good) ?? 0) + f.count * traded);
    }
    const ranked = [...lands.entries()]
      .map(([c, goods]) => ({ c, goods, n: [...goods.values()].reduce((a, b) => a + b, 0) }))
      .filter((x) => x.n >= 0.5)
      .sort((a, b) => b.n - a.n || a.c - b.c)
      .slice(0, CARAVAN_LANDS);
    for (const x of ranked) {
      const top = [...x.goods.entries()]
          .sort((a, b) => b[1] - a[1] || a[0] - b[0])
          .slice(0, 2)
          .map(([g]) => (GOODS[g]?.name ?? "goods").toLowerCase()),
        from = landName(world, x.c);
      for (let k = 0; k < CARAVANS_A_YEAR; k++)
        list.push({
          // (One a season: its trader's round.)
          ...on(
            `caravan|${x.c}`,
            k,
            Math.floor((k * 365) / CARAVANS_A_YEAR),
            Math.floor(365 / CARAVANS_A_YEAR),
          ),
          kind: "caravan",
          count: Math.max(2, Math.min(12, Math.round(Math.sqrt(x.n)))),
          from,
          why: `bringing ${top.join(" and ")}`,
          ref: null,
        });
    }
    // Those its world moved into its land this year, at the town's share: by what drove them.
    let told = 0;
    ctx.history.flowsInto(cell).forEach((f, k) => {
      if (f.year !== year - 1 || f.from === cell || told >= MOST_A_YEAR) return;
      const count = Math.round(f.count * share);
      if (count < 1) return;
      const why = (world.events.get(f.event)?.data as Record<string, unknown> | undefined)?.[
          "why"
        ] as string | undefined,
        kind: GateKind =
          why === "war"
            ? "refugees"
            : why === "faith"
              ? "faithful"
              : why === "wages"
                ? "seekers"
                : "hungry";
      told++;
      list.push({
        ...on(`moved|${f.from}`, k),
        kind,
        count,
        from: landName(world, f.from),
        why:
          kind === "refugees"
            ? "fleeing the fighting in their land, asking to live in the town"
            : kind === "faithful"
              ? "barred from keeping their faith at home, asking to live in the town"
              : kind === "seekers"
                ? "come for the wages here, asking to live and work in the town"
                : "come from a land that could not feed them all, asking to live in the town",
        ref: f.event,
      });
    });
    // Envoys come to its court, where it is its realm's seat.
    const realm = politiesOf(world).of(cell);
    if (realm && realm.seat === cell && realm.town === s.name) {
      const realms = politiesOf(world);
      tiesOf(world)
        .envoys()
        .forEach((e, k) => {
          if (e.year !== year - 1 || e.to !== realm.ref) return;
          const from = realms.get(e.from);
          list.push({
            ...on(`envoy|${e.event}`, k),
            kind: "envoy",
            count: 1,
            from: from ? landName(world, from.seat) : "a realm beyond",
            why: `${e.name}, sent to its court`,
            ref: `envoy:${e.event}`,
          });
        });
    }
    // Raiders: those risen in its land against its holder, fallen on those posted there this year.
    const raid = occupationOf(world)?.of(cell)?.raid,
      ev = raid ? world.events.get(raid) : undefined;
    if (ev && yearOfMoment(ev.t) === year - 1) {
      const data = ev.data as Record<string, unknown> | undefined,
        out = Number(data?.["out"] ?? 0),
        d = Math.max(0, Math.floor(ev.t / DAY) - y0);
      if (out > 0)
        list.push({
          // (Within a few days of the raid the world tells.)
          ...on(`raid|${raid}`, 0, d, 5),
          kind: "raiders",
          count: Math.max(1, Math.round(out * share)),
          from: String(data?.["b"] ?? "the hills"),
          why: "risen against the realm that holds the land, falling on those it posts here",
          ref: raid!,
        });
    }
  }
  list.sort(
    (a, b) => a.day - b.day || a.hour - b.hour || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0),
  );
  byTown.set(town, { key, list });
  return list;
}

/** Those of a year come on one day (the place's day turn reads it). */
export function gateOn(world: World, town: string, cell: number, day: number): GateArrival[] {
  return gateArrivals(world, town, cell, Math.floor(day / 365)).filter((x) => x.day === day);
}
