// Trade among the stars, told (Phase 71, first slice): what is carried, from where, why (what is short there and plenty here), what the
// crossing costs, who gains by it and what it did; a port as the eye reads it; and, where nothing comes, why not, in the numbers that
// say so. Pure reads of `sim/space/trade.ts`.
import type { Ref, World } from "../kernel/index.ts";
import { offworldSite } from "../gen/index.ts";
import {
  G,
  GOODS,
  MACHINE_GAIN,
  RECIPES,
  TOOL_GAIN,
  crossingBy,
  crossingWithin,
  marginOf,
  perBulk,
  STAR_DRIVES,
  type Crossing,
} from "../rules/index.ts";
import {
  STAGE_WORDS,
  clusterOf,
  courtOf,
  folkStage,
  homePlanet,
  marketsOf,
  politiesOf,
  populationContext,
  starSitesOf,
  tradeOf,
  tradeWhyNot,
  whyNot,
  type Folk,
  type StarRun,
} from "../sim/index.ts";
import type { Block, Item, PageModel, PortCaller, PortPlan, Stat } from "../bridge/index.ts";
import { realmColor } from "./colors.ts";
import { peopleWords as bigWords } from "./filling.ts";
import type { QueryHandler } from "./host.ts";
import { count, item, link, many, stat, yearNow } from "./inspect/words.ts";

const ONE = (n: number) => n.toFixed(n >= 100 ? 0 : 1);
const pct = (cover: number) => `${Math.round(cover / 10)}%`;

/** Where a land is, in words. */
function landWords(world: World, cell: number): string {
  if (cell < 0) return "another people's world";
  const g = homePlanet(world).generated,
    site = offworldSite(g, cell);
  if (!site) {
    const realm = politiesOf(world).of(cell);
    return realm ? `${realm.town} on the home world` : "a land of the home world";
  }
  const realm = politiesOf(world).of(cell);
  return site.body < 0
    ? `${realm ? `the halls of ${realm.town}` : "halls"} on a world of another star`
    : `${realm ? `the halls of ${realm.town}` : "halls"} on ${g.system.bodies[site.body]?.designation ?? "another world"}`;
}

const goodsOf = (r: StarRun): { good: number; n: number }[] =>
  r.landed
    .map((n, good) => ({ good, n }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n * GOODS[b.good]!.value - a.n * GOODS[a.good]!.value);

const carriedWords = (r: StarRun): string => {
  const g = goodsOf(r).slice(0, 3);
  return g.length ? g.map((x) => GOODS[x.good]!.name).join(", ") : "nothing yet come in";
};

const whyClosed: Readonly<Record<NonNullable<StarRun["closedWhy"]>, string>> = {
  gone: "the world it ran to is gone",
  war: "those at its two ends went to war",
  empty: "no one is left there to send to",
  fallen: "no one holds the land it sent from now",
  unpaid: "what it could carry no longer pays for the crossing",
};

/** How the crossing is made up, in words. */
function crossingWords(r: StarRun, machinePrice: number): string {
  const c = {
      machines: r.machinesTonne,
    } as Crossing,
    grain = perBulk(c, machinePrice);
  return `${r.ly > 0 ? `${ONE(r.ly)} light-years` : "Among one star's own worlds"}, ${Math.ceil(r.years)} years${r.hops ? ` by ${many(r.hops, "lane", "lanes")}` : r.ly > 0 ? " straight across, on its drive" : ""}. Each tonne costs ${count(Math.round(r.machinesTonne))} machines to carry, hull and fuel: at what a machine fetches, ${ONE(grain)} in grain a sack's weight, so goods must clear that to go.`;
}

/** What a run did: each from what the land's books said when it opened and what they say now. */
function didLines(world: World, r: StarRun): string[] {
  const ctx = populationContext(world),
    m = marketsOf(world).get(r.to),
    people = ctx.provinces.get(r.to)?.total() ?? 0,
    out: string[] = [];
  if (!m) return out;
  const b = r.before;
  if (m.machineCover > b.machines + 100)
    out.push(
      `Machines: its workers had ${pct(b.machines)} of those they wear out when this opened, and have ${pct(m.machineCover)} now. The same hands bring in ${Math.round(((1 + (MACHINE_GAIN * m.machineCover) / 1000) / (1 + (MACHINE_GAIN * b.machines) / 1000) - 1) * 100)}% more.`,
    );
  if (m.toolCover > b.tools + 100)
    out.push(
      `Tools: from ${pct(b.tools)} of what wears out to ${pct(m.toolCover)}: ${Math.round(((1 + (TOOL_GAIN * m.toolCover) / 1000) / (1 + (TOOL_GAIN * b.tools) / 1000) - 1) * 100)}% more from the same hands.`,
    );
  if (m.potteryCover > b.pottery + 100)
    out.push(
      `Pots: there is no clay to dig here. It had ${pct(b.pottery)} of the pots it wants and has ${pct(m.potteryCover)} now, and what it stores keeps the longer for it.`,
    );
  if (m.clothingCover > b.clothing + 100)
    out.push(
      `Clothing: from ${pct(b.clothing)} of what it wants to ${pct(m.clothingCover)}; those without warm clothes die the more easily in the cold.`,
    );
  // What it can make now that it could not.
  for (const { good } of goodsOf(r).slice(0, 3)) {
    if (!m.stock[good]) continue;
    const makes = RECIPES.filter(
      (x) => x.inputs.some(([g]) => g === good) && whyNot(ctx, r.to, m, x) === null,
    )[0];
    if (makes)
      out.push(`With ${GOODS[good]!.name} in its stores, its crafters can make ${makes.name}.`);
  }
  for (const { good } of goodsOf(r).slice(0, 2))
    out.push(
      `${GOODS[good]!.name[0]!.toUpperCase()}${GOODS[good]!.name.slice(1)}: ${ONE(b.prices[good] ?? 0)} there when this opened, ${ONE(m.price[good]!)} now.`,
    );
  out.push(`It held ${bigWords(b.people)} when this opened, and holds ${bigWords(people)} now.`);
  const lost = r.lost.reduce((n, x) => n + x, 0);
  if (r.raided)
    out.push(
      `${many(r.raided, "hold", "holds")} taken on the way, last by ${r.raider ?? "those unknown"} in year ${r.lastRaidYear}: ${count(lost)} goods that never came.`,
    );
  if (r.closed) {
    const left = goodsOf(r)[0];
    if (left)
      out.push(
        `Since the last ship, in year ${r.lastIn}, ${GOODS[left.good]!.name} fetches ${ONE(m.price[left.good]!)} here and ${count(m.stock[left.good]!)} is left: no one brings more.`,
      );
  }
  return out;
}

/** Who gains by it. */
function gainWords(world: World, r: StarRun): string {
  const realm = politiesOf(world).get(r.realm),
    voice = realm
      ? courtOf(world)
          ?.of(realm.ref)
          ?.figures.find((f) => f.seat === "traders")
      : undefined,
    at = r.house.cell >= 0 ? politiesOf(world).of(r.house.cell) : null;
  return `${r.house.name[0]!.toUpperCase()}${r.house.name.slice(1)}${at ? ` of ${at.town}` : ""} has cleared ${bigWords(Math.round(r.house.worth))} in grain by it${r.house.rich ? ", and is counted among the great houses" : ""}.${voice ? ` ${voice.name} speaks for the traders at ${realm!.town}'s court.` : ""}`;
}

/** A run as a row. */
const runRow = (world: World, r: StarRun): Item =>
  item(
    `${r.closed ? "Ended: " : ""}${carriedWords(r)} from ${r.civ ? `the ${r.name.replace(/^the /, "")}` : r.name}, ${r.house.name}: since ${r.year}, ${many(r.ships, "ship", "ships")} in${r.raided ? `, ${r.raided} taken` : ""}${r.hops ? `, by ${many(r.hops, "lane", "lanes")}` : ""}`,
    r.ref,
  );

/** A run's own page. */
export function runPage(world: World, ref: string): PageModel {
  const r = tradeOf(world)?.get(ref);
  if (!r) throw new Error(`no run ${ref}`);
  const markets = marketsOf(world),
    from = r.from >= 0 ? markets.get(r.from) : null,
    to = markets.get(r.to),
    machine = from ? from.price[G.machines]! : GOODS[G.machines]!.value * 0.33,
    // (What it came for: of all it has carried, what stood widest between the two markets when it opened. The most carried may have come later, at no gap at all.)
    gap = (g: number) => (r.before.prices[g] ?? 0) - (r.before.here[g] ?? 0),
    top = [...goodsOf(r)].sort((a, b) => gap(b.good) - gap(a.good))[0],
    short = top
      ? `${GOODS[top.good]!.name} fetched ${ONE(r.before.prices[top.good] ?? 0)} there, and cost ${ONE(r.before.here[top.good] ?? 0)} here`
      : `what it wanted fetched more there than it cost here`,
    stats: Stat[] = [
      stat("Carries", carriedWords(r)),
      stat(
        "From",
        r.from >= 0
          ? [link(landWords(world, r.from), `cell:0:${r.from}`)]
          : `the ${r.name.replace(/^the /, "")}`,
      ),
      stat("To", [link(landWords(world, r.to), `cell:0:${r.to}`)]),
      stat("Ships in", count(r.ships)),
      ...(r.raided ? [stat("Holds taken", count(r.raided))] : []),
      stat("The house's gain", `${bigWords(Math.round(r.house.worth))} in grain`),
    ],
    goods = goodsOf(r);
  return {
    ref,
    kind: "world",
    icon: r.raided ? "⚔️" : "🛰️",
    title: `${r.house.name[0]!.toUpperCase()}${r.house.name.slice(1)}'s run`,
    subtitle: [
      r.closed
        ? `It ended in year ${r.closedYear}: ${whyClosed[r.closedWhy!]}.`
        : `Running since year ${r.year}, ${r.name} sending.`,
    ],
    color: null,
    place: null,
    stats,
    tabs: [
      {
        id: "overview",
        name: "Overview",
        blocks: [
          {
            type: "text",
            title: "Why it runs",
            lines: [
              [
                `When it opened, ${short}${top && gap(top.good) <= 0 ? "." : ": short there, plenty here."}`,
              ],
              [crossingWords(r, machine)],
              ...(to && from
                ? [
                    [
                      `Today a sack's weight of grain would not pay its way: it fetches ${ONE(to.price[G.grain]!)} there, ${ONE(from.price[G.grain]!)} here.`,
                    ],
                  ].filter(
                    () =>
                      marginOf(
                        G.grain,
                        from.price[G.grain]!,
                        to.price[G.grain]!,
                        { machines: r.machinesTonne, years: r.years } as Crossing,
                        machine,
                        0,
                      ) <= 0,
                  )
                : []),
            ],
          },
          { type: "text", title: "Who gains", lines: [[gainWords(world, r)]] },
          {
            type: "text",
            title: "What it did",
            lines: didLines(world, r).map((l) => [l]),
          },
          ...(goods.length
            ? [
                {
                  type: "list" as const,
                  title: "What has come to port",
                  items: goods.map((x) =>
                    item(`${count(x.n)} ${GOODS[x.good]!.name}`, `good:${GOODS[x.good]!.id}`),
                  ),
                },
              ]
            : []),
          {
            type: "list",
            title: "How it went",
            items: [
              item(`Opened in year ${r.year}`, r.opened),
              ...(r.first ? [item(`Its first ship in, year ${r.firstYear}`, r.first)] : []),
              ...(r.lastRaid ? [item(`Last taken, year ${r.lastRaidYear}`, r.lastRaid)] : []),
              ...(r.closed ? [item(`Ended, year ${r.closedYear}`, r.closed)] : []),
            ],
          },
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** What crosses, read off the numbers: a land's prices against a way with a lane and one without. */
function wayLines(world: World): string[] {
  const runs = tradeOf(world)?.all() ?? [],
    byLane = runs.filter((r) => r.hops > 0),
    byDrive = runs.filter((r) => r.hops === 0 && r.ly > 0),
    within = runs.filter((r) => r.ly === 0),
    sum = (list: readonly StarRun[]) => {
      const n = new Map<number, number>();
      for (const r of list)
        r.landed.forEach((x, g) => {
          if (x) n.set(g, (n.get(g) ?? 0) + x);
        });
      return [...n.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([g]) => GOODS[g]!.name)
        .join(", ");
    },
    out: string[] = [
      "A rocket's fuel goes by its speed, not how far it goes; a lane's goes by the light-year and the ship, whatever it carries; every year under way ties up a hull and spoils what spoils. So goods cross when what they fetch there beats all that, and no list says which.",
    ];
  if (byDrive.length)
    out.push(
      `On a drive alone, ${many(byDrive.length, "run", "runs")}, ${Math.round(byDrive.reduce((n, r) => n + r.years, 0) / byDrive.length)} years a crossing on the mean: ${sum(byDrive) || "nothing yet come in"}.`,
    );
  if (byLane.length)
    out.push(
      `By lanes, ${many(byLane.length, "run", "runs")}, ${Math.round(byLane.reduce((n, r) => n + r.years, 0) / byLane.length)} years a crossing on the mean: ${sum(byLane) || "nothing yet come in"}.`,
    );
  if (within.length)
    out.push(
      `Among the home star's own worlds, ${many(within.length, "run", "runs")}: ${sum(within) || "nothing yet come in"}.`,
    );
  if (!byLane.length && !byDrive.length) {
    const fus = crossingBy(STAR_DRIVES[0]!, 10),
      sail = crossingBy(STAR_DRIVES[1]!, 10);
    out.push(
      `Ten light-years would cost a tonne ${count(Math.round(fus.machines))} machines on a fusion drive and ${count(Math.round(sail.machines))} under a sail, against ${count(Math.round(crossingWithin().machines))} among a star's own worlds: no one has yet found what clears that.`,
    );
  }
  return out;
}

/** The page of all of it. */
export function tradePage(world: World): PageModel {
  const store = tradeOf(world),
    runs = [...(store?.all() ?? [])].sort((a, b) => b.house.worth - a.house.worth),
    open = runs.filter((r) => !r.closed),
    ended = runs.filter((r) => r.closed),
    ships = runs.reduce((n, r) => n + r.ships, 0),
    raids = runs.reduce((n, r) => n + r.raided, 0);
  return {
    ref: "world:trade",
    kind: "world",
    icon: "🛰️",
    title: "Trade among the stars",
    subtitle: [
      runs.length
        ? `${many(open.length, "run", "runs")} running, ${many(ended.length, "ended", "ended")} of those kept, in year ${yearNow(world)}.`
        : "Nothing has yet been carried across for gain.",
    ],
    color: null,
    place: null,
    stats: [
      stat("Running", count(open.length)),
      stat("Ships in", count(ships)),
      stat("Holds taken", count(raids)),
    ],
    tabs: [
      {
        id: "all",
        name: "All of them",
        blocks: [
          { type: "text", title: "What crosses, and why", lines: wayLines(world).map((l) => [l]) },
          ...(open.length
            ? [
                {
                  type: "list" as const,
                  title: "Running",
                  items: open.slice(0, 40).map((r) => runRow(world, r)),
                },
              ]
            : []),
          ...(ended.length
            ? [
                {
                  type: "list" as const,
                  title: "Ended",
                  items: ended.slice(0, 24).map((r) => runRow(world, r)),
                },
              ]
            : []),
        ],
      },
    ],
    followable: false,
    year: yearNow(world),
  };
}

/** What a land's page says of what comes to it, and where nothing does, why not, in its numbers. */
export function tradeBlocks(world: World, cell: number): Block[] {
  const g = homePlanet(world).generated;
  if (!offworldSite(g, cell)) return [];
  const m = marketsOf(world).get(cell);
  if (!m || !populationContext(world).provinces.get(cell)?.total()) return [];
  const runs = (tradeOf(world)?.all() ?? []).filter((r) => r.to === cell);
  if (!runs.length) {
    const no = tradeWhyNot(populationContext(world), cell);
    return [{ type: "text", title: "What comes here from other worlds", lines: [[no]] }];
  }
  const top = runs.find((r) => !r.closed) ?? runs.at(-1)!;
  return [
    {
      type: "list",
      title: "What comes here from other worlds",
      items: runs.slice(-6).map((r) => runRow(world, r)),
    },
    { type: "text", title: "What it has done here", lines: didLines(world, top).map((l) => [l]) },
  ];
}

/** What a world's page says of it: each land's. */
export function tradeWorldBlocks(
  world: World,
  star: string | null,
  planet: number,
  body: number,
): Block[] {
  const g = homePlanet(world).generated;
  const sites = starSitesOf(world);
  for (let i = 0; i < g.offworld.sites.length; i++) {
    const site = g.offworld.sites[i]!,
      cell = g.offworld.base + i;
    if (star ? site.body >= 0 : site.body !== body) continue;
    if (star) {
      const s = sites?.get(cell);
      if (!s || s.star !== star || s.planet !== planet) continue;
    }
    const b = tradeBlocks(world, cell);
    if (b.length) return b;
  }
  return [];
}

/** What a people's page says: who they deal with, or why no one does. */
export function folkTradeBlocks(world: World, f: Folk): Block[] {
  const year = yearNow(world),
    stage = folkStage(f, year),
    runs = (tradeOf(world)?.all() ?? []).filter((r) => r.civ === f.ref);
  if (runs.length)
    return [
      {
        type: "list",
        title: "What they carry to others",
        items: runs.slice(-6).map((r) => runRow(world, r)),
      },
    ];
  // What a crossing to them would cost the best anyone can do, against what they could give.
  const star = clusterOf(world).find((s) => s.ref === f.star),
    fus = star ? crossingBy(STAR_DRIVES[0]!, star.distance) : null,
    best = GOODS.filter((x) => !x.food && (x.id === "hides" || x.id === "wool")).reduce(
      (n, x) => Math.max(n, (3 * x.value) / x.bulk),
      0,
    ),
    machine = GOODS[G.machines]!.value / 3,
    dear = fus ? perBulk(fus, machine) : 0,
    made = stage === "signals" || stage === "orbit" || stage === "stars";
  const line = made
    ? stage === "stars"
      ? `They sail, and could sell what they make, but none who hold a land away have met them and speak with them, so no ship of theirs calls at any port.`
      : `They are ${STAGE_WORDS[stage]}: their goods stay on their own world, for they have no ship to send and no one comes to them for gain.`
    : `No one trades with them. They are ${STAGE_WORDS[stage]}, and have no port and no one to sell to. The most their hides or wool could fetch is ${ONE(best)} a sack's weight${fus ? `; the crossing to them, ${ONE(star!.distance)} light-years, costs ${ONE(dear)} in grain a sack's weight at best on a fusion drive` : ""}. ${dear > best ? "What they have is not worth what it would cost to fetch." : "Nothing of theirs is wanted that anyone would come for yet."}`;
  return [{ type: "text", title: "Trade", lines: [[line]] }];
}

/** A port as the eye reads it (null: no run has ever come here). */
export function portPlanOf(world: World, cell: number): PortPlan | null {
  const runs = (tradeOf(world)?.all() ?? []).filter(
    (r) => r.to === cell && r.ships + r.under.length > 0,
  );
  if (!runs.length) return null;
  const open = runs.filter((r) => !r.closed),
    callers: PortCaller[] = open.slice(0, 6).map((r) => ({
      ref: r.ref,
      who: r.name,
      color: realmColor(r.civ ?? r.realm),
      far: !!r.civ,
      every: Math.max(1, Math.ceil(r.years / 4)),
      lanes: r.hops,
      goods: goodsOf(r)
        .slice(0, 2)
        .map((x) => GOODS[x.good]!.name),
    })),
    busy = open.reduce((n, r) => n + 10 / Math.max(1, Math.ceil(r.years / 4)), 0),
    came = runs.reduce((n, r) => n + r.landed.reduce((a, x, g) => a + x * GOODS[g]!.bulk, 0), 0),
    last = runs.reduce(
      (n, r) =>
        r.lastRaidYear > (n?.year ?? 0) ? { year: r.lastRaidYear, by: r.raider ?? "" } : n,
      null as { year: number; by: string } | null,
    ),
    pads = Math.min(9, Math.max(1, open.length * 2 + Math.floor(busy / 6))),
    stacks = Math.min(288, Math.max(6, Math.round(Math.log10(1 + came) * 36))),
    peoples = new Set(open.map((r) => r.civ ?? "ours")).size,
    head = open.length
      ? `${many(open.length, "run", "runs")} ${open.length === 1 ? "calls" : "call"} here, about ${Math.round(busy)} ships a decade${peoples > 1 ? `, of ${peoples} peoples` : ""}`
      : `No ship calls now: its last came in year ${runs.reduce((n, r) => Math.max(n, r.lastIn), 0)}`;
  return {
    cell,
    callers,
    pads: open.length ? pads : Math.min(pads, 3),
    sheds: Math.min(4, Math.max(1, Math.ceil(pads / 2))),
    stacks,
    busy,
    quiet: !open.length,
    raided: last,
    head,
    run: (open[0] ?? runs[0]!).ref,
  };
}

export const TRADE_QUERIES: Readonly<Record<string, QueryHandler>> = {
  /** A land's port (null: none). */
  "trade.port": (world, args) => portPlanOf(world, (args as { cell: number }).cell),
  /** Every run, for a gate or a list. */
  "trade.list": (world) =>
    (tradeOf(world)?.all() ?? []).map((r) => ({
      ref: r.ref,
      to: r.to,
      from: r.from,
      civ: r.civ,
      ships: r.ships,
      raided: r.raided,
      hops: r.hops,
      ly: r.ly,
      closed: r.closedWhy,
      event: r.lastRaid,
    })),
};
