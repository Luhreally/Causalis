// Trade among the stars (Phase 71, first slice; galaxy-plan.md, Phase 71). A colony's market has no road: what its ground cannot
// give, its people go without, and its prices say so. Once a year here, after the economy's year and before its books close: what
// is under way comes in or is taken, and each run lades its next hold; every few years, the land that would gain most by a new run
// gets one. What is carried is what clears (rules/freight.ts): what it fetches there, less all it cost here and on the way. What
// it does is the market's own: goods come in by the ledger, and the covers, prices, food and deaths that read them follow.
// Nothing here until a land away from home has people on it, so a history before that holds bit for bit.
import {
  YEAR,
  defineEventType,
  defineKind,
  defineStream,
  hashString,
  makeRef,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { cellRef, isProvinceWorld, tonguePersonName } from "../../gen/index.ts";
import {
  BULK_TONNES,
  G,
  GOODS,
  HOLD_GOODS,
  HOLD_TONNES,
  PAY_HEAD,
  RECIPES,
  SMELTING,
  cheapestCrossing,
  holdOf,
  longestCrossing,
  needsMet,
  perBulk,
  starDriveFor,
  STAR_DRIVES,
  survives,
  type Offer,
  type Crossing,
  type Load,
} from "../../rules/index.ts";
import { cultureOf } from "../culture/culture.ts";
import { GOOD_COUNT, type Market } from "../economy/market.ts";
import { knows } from "../lore/lore.ts";
import { politiesOf, type Polity } from "../polity/polity.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";
import { farOf, fireOf } from "../war/fire.ts";
import { warsOf } from "../war/war.ts";
import { civilizationsNear } from "./contact.ts";
import { LANE_ROW, laneLawOf, laneMapOf, laneRoute, laneYearOf } from "./lanes.ts";
import { folkByRef } from "./natives.ts";
import { peopleWords, peoplesOf } from "./peoples.ts";
import { machinesOfRealm, spaceOf, spendMachines } from "./space.ts";
import { starSitesOf } from "./stars.ts";
import { starWarsOf, type StarWar } from "./starwar.ts";
import { TradeStore, tradeOf, type Convoy, type StarRun } from "./trade-store.ts";

export const RUN = defineKind("run", "a run between the stars", "minted");

export const TRADE_EVENTS = {
  opened: defineEventType("trade.opened", 4),
  /** A run's first ship in. */
  came: defineEventType("trade.came", 4),
  /** The first goods to cross between the stars for gain; the first from another people. */
  first: defineEventType("trade.first", 6),
  raided: defineEventType("trade.raided", 5),
  /** The first hold ever taken. */
  firstRaid: defineEventType("trade.first-raid", 7),
  closed: defineEventType("trade.closed", 4),
  rich: defineEventType("trade.rich", 5),
};

const RAID = defineStream("space.trade.raid");

/** How often a new run is weighed (years), and how many open at once in all the world, and to a land. */
export const OPEN_EVERY = 5;
export const MOST_RUNS = 36;
export const MOST_TO_A_LAND = 4;
/** How many are kept, ended ones first to go. */
export const MOST_KEPT = 60;
/** A land away must have this many before anyone sends it anything for gain (est.). */
export const LEAST_PEOPLE = 200;
/** Holds a run has under way at most: it sails again when the crossing allows that (a save's bound). */
export const MOST_UNDER_WAY = 4;
/** A land keeps this many years of what it used before it sells any. */
const KEEP_YEARS = 3;
/** A people of the stars asks this much of its goods' usual worth (the market's own floor): what it makes it has long made. */
const FAR_FLOOR = 0.33;
/** The yearly chance a raider at war takes a hold, at full strength (est.), and one short of what goes by it (est.). */
export const RAID_YEAR = 0.012;
export const SHORT_RAID_YEAR = 0.02;
/** A lane's mouth is where a ship can be waited for; the dark is not: a way with none is found this much of the time (est.). */
const DARK_FOUND = 0.25;
/**
 * What those who send a run reckon on losing is what they have lost lately: each hold taken or come in moves it this far
 * toward all or nothing, so a lane that bleeds stops paying (est.).
 */
const HOLD_TEACHES = 0.25;
/** A short land is one whose price stands at this many times its usual worth (est.). */
const SHORT_AT = 2.5;
/** What a house's run has cleared, in grain, for it to be counted great. */
export const RICH_GRAIN = 20_000_000;
/** A run with no ship in this many years has stopped paying. */
const IDLE_YEARS = 40;

/** A land away from home with people on it. */
type Away = {
  readonly cell: number;
  readonly star: Ref;
  readonly planet: number;
  readonly market: Market;
  readonly people: number;
  readonly holder: Polity | undefined;
};

/** The lands away from home with someone there to send to. */
function landsAway(ctx: PopulationContext): Away[] {
  const { world, generated: g } = ctx;
  if (!isProvinceWorld(g)) return [];
  const sites = starSitesOf(world),
    markets = marketsOf(world),
    realms = politiesOf(world),
    out: Away[] = [];
  g.offworld.sites.forEach((site, i) => {
    const cell = g.offworld.base + i,
      land = ctx.provinces.get(cell);
    if (!land) return;
    const people = land.total();
    if (people < LEAST_PEOPLE) return;
    const ship = site.body < 0 ? sites?.get(cell) : undefined;
    if (site.body < 0 && !ship?.arrived) return;
    const m = markets.get(cell);
    if (!m) return;
    out.push({
      cell,
      star: ship ? ship.star : (g.star.ref as Ref),
      planet: ship ? ship.planet : -1,
      market: m,
      people,
      holder: realms.of(cell),
    });
  });
  return out;
}

/** How far apart two stars lie. */
function lightYears(world: World, a: string, b: string): number {
  if (a === b) return 0;
  const map = laneMapOf(world),
    p = map.stars[map.at.get(a) ?? 0]!,
    q = map.stars[map.at.get(b) ?? 0]!;
  const dx = p.x - q.x,
    dy = p.y - q.y,
    dz = p.z - q.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** What a realm can send a crossing by now. */
function crossingOf(
  ctx: PopulationContext,
  p: Polity,
  fromStar: string,
  toStar: string,
): Crossing | null {
  const k = (id: string) => knows(ctx, p.seat, id),
    ly = lightYears(ctx.world, fromStar, toStar);
  if (ly > 0 && !starDriveFor(k)) return null;
  const route =
    ly > 0 && laneLawOf(ctx.world).open && k(LANE_ROW)
      ? laneRoute(ctx.world, fromStar, toStar)
      : null;
  return cheapestCrossing(ly, k, route, longestCrossing(k));
}

/** The goods a people of the stars makes from its ground alone, as it reads its recipes: nothing eaten or off a beast's back. */
const GROUND_GOODS: readonly number[] = GOODS.map((_, g) => g).filter(
  (g) =>
    !GOODS[g]!.food &&
    RECIPES.some(
      (r) =>
        r.output[0] === g &&
        r.inputs.every(([i]) => i !== G.wool && i !== G.hides && i !== G.grain),
    ),
);
/** Those of them that are metal won from ore: not where its star gave its world too little. */
const WON_METALS: ReadonlySet<number> = new Set(SMELTING.map((s) => s.good));

/** What a people of the stars has to sell, from its own world's numbers. */
const FAR_GOODS = new Map<string, readonly number[]>();
function farGoods(world: World, civ: Ref): readonly number[] {
  const key = `${world.seed.text} ${civ}`;
  let list = FAR_GOODS.get(key);
  if (!list) {
    if (FAR_GOODS.size > 64) FAR_GOODS.clear();
    const poor = folkByRef(world, civ)?.chem.metals === "poor";
    FAR_GOODS.set(key, (list = GROUND_GOODS.filter((g) => !(poor && WON_METALS.has(g)))));
  }
  return list;
}

/** A people of the stars, in the terms of a crossing: the drive its years among them have brought it, lanes if it has found them. */
function farCrossing(
  world: World,
  civ: { ref: Ref; star: Ref; stars: number; pace: number },
  toStar: string,
  year: number,
): Crossing | null {
  const age = (year - civ.stars) / Math.max(0.2, civ.pace),
    k = (id: string) =>
      STAR_DRIVES.some((d) => d.needs.includes(id)) &&
      (id === "fusion-drive" || (id === "beamed-sails" && age > 100) || age > 300),
    route =
      laneLawOf(world).open && year >= laneYearOf(world, civ)
        ? laneRoute(world, civ.star, toStar)
        : null;
  if (!STAR_DRIVES.some((d) => needsMet(d, k))) return null;
  return cheapestCrossing(lightYears(world, civ.star, toStar), k, route, 300);
}

/** How a land stands, to set beside what it comes to. */
function beforeOf(from: Market | null, to: Market, people: number): StarRun["before"] {
  const r = (x: number) => Math.round(x * 100) / 100;
  return {
    people,
    tools: to.toolCover,
    clothing: to.clothingCover,
    pottery: to.potteryCover,
    machines: to.machineCover,
    prices: to.price.map(r),
    here: from ? from.price.map(r) : GOODS.map((x) => r(x.value * FAR_FLOOR)),
  };
}

/** What a market would sell another, by the rule of its own keep. */
function asksOf(from: Market, to: Market): Offer[] {
  const out: Offer[] = [];
  for (let g = 0; g < GOOD_COUNT; g++) {
    const keep = KEEP_YEARS * (from.line("used", g) + from.line("out", g));
    out.push({ good: g, here: from.price[g]!, there: to.price[g]!, spare: from.stock[g]! - keep });
  }
  return out;
}

/** What a people of the stars would sell a market: as much as a hold takes. */
const farAsks = (world: World, civ: Ref, to: Market): Offer[] =>
  farGoods(world, civ).map((g) => ({
    good: g,
    here: GOODS[g]!.value * FAR_FLOOR,
    there: to.price[g]!,
    spare: HOLD_TONNES / BULK_TONNES,
  }));

const worthOf = (load: readonly Load[]): number => load.reduce((n, l) => n + l.count * l.margin, 0);
const tonnesOf = (load: readonly Load[]): number =>
  load.reduce((n, l) => n + l.count * GOODS[l.good]!.bulk * BULK_TONNES, 0);

/** The open wars between the stars, and whether two sides are at it. */
const warBetween = (wars: readonly StarWar[], a: Ref, b: Ref): StarWar | undefined =>
  wars.find((w) => (w.realm === a && w.enemy === b) || (w.realm === b && w.enemy === a));

/** Whether two realms are at war on the home world's ground. */
function homeWar(world: World, a: Ref, b: Ref) {
  if (a === b) return undefined;
  return warsOf(world)
    .hot()
    .find(
      (w) =>
        w.ended === null &&
        ((w.attacker === a && w.defender === b) || (w.attacker === b && w.defender === a)),
    );
}

/** A run comes to its end, with why; what is under way comes to nothing, if it had nowhere to come to. */
function closeRun(
  world: World,
  r: StarRun,
  why: NonNullable<StarRun["closedWhy"]>,
  year: number,
  cause: Ref | null,
): void {
  r.closedWhy = why;
  r.closedYear = year;
  r.closed = world.events.emit({
    type: TRADE_EVENTS.closed.type,
    place: cellRef(0, r.to),
    subjects: [r.ref, r.realm],
    causes: [
      { ref: r.opened, role: "trigger", weight: 0.5 },
      ...(cause ? [{ ref: cause, role: "trigger" as const, weight: 1 }] : []),
    ],
    data: { why, realm: r.name, ships: r.ships, year },
  });
}

/** A hold comes to port. */
function comeIn(
  ctx: PopulationContext,
  store: TradeStore,
  r: StarRun,
  c: Convoy,
  to: Market,
  year: number,
): void {
  const { world } = ctx;
  let worth = 0;
  for (const [good, count, margin] of c.cargo) {
    const landed = Math.floor(count * survives(good, c.arrives - c.sailed));
    to.move("in", good, landed);
    r.landed[good] = r.landed[good]! + landed;
    worth += count * margin;
  }
  r.ships++;
  r.lastIn = year;
  r.risk *= 1 - HOLD_TEACHES;
  r.house.worth += worth;
  if (r.civ) {
    // (A people of the stars takes payment: what this land has most of, at what it fetches here.)
    let owed = c.cargo.reduce((n, [g, k]) => n + k * to.price[g]!, 0);
    const plenty = GOODS.map((_, g) => g).sort(
      (a, b) => to.price[a]! / GOODS[a]!.value - to.price[b]! / GOODS[b]!.value || a - b,
    );
    for (const g of plenty) {
      if (owed <= 0) break;
      if (c.cargo.some(([x]) => x === g)) continue;
      const keep = KEEP_YEARS * to.line("used", g),
        took = to.take(
          "out",
          g,
          Math.min(Math.max(0, to.stock[g]! - keep), Math.ceil(owed / to.price[g]!)),
        );
      owed -= took * to.price[g]!;
    }
  }
  if (!r.first) {
    r.firstYear = year;
    r.first = world.events.emit({
      type: TRADE_EVENTS.came.type,
      place: cellRef(0, r.to),
      subjects: [r.ref, r.realm, cellRef(0, r.to)],
      causes: [{ ref: r.opened, role: "trigger", weight: 1 }],
      data: {
        realm: r.name,
        goods: c.cargo.map(([g, n]) => [GOODS[g]!.name, n]),
        ly: Math.round(r.ly * 10) / 10,
        lanes: r.hops,
        year,
      },
    });
    // The first of all, and the first from another people: told to all.
    if (!store.first || (r.civ && !store.firstBetween)) {
      const first = world.events.emit({
        type: TRADE_EVENTS.first.type,
        place: cellRef(0, r.to),
        subjects: [r.ref, r.realm, cellRef(0, r.to)],
        causes: [{ ref: r.first, role: "trigger", weight: 1 }],
        data: {
          realm: r.name,
          between: !!r.civ,
          goods: c.cargo.map(([g, n]) => [GOODS[g]!.name, n]),
          ly: Math.round(r.ly * 10) / 10,
          lanes: r.hops,
          year,
        },
      });
      store.first ??= first;
      if (r.civ) store.firstBetween = first;
    }
  }
  if (!r.house.rich && r.house.worth >= RICH_GRAIN)
    r.house.rich = world.events.emit({
      type: TRADE_EVENTS.rich.type,
      place: r.house.cell >= 0 ? cellRef(0, r.house.cell) : cellRef(0, r.to),
      subjects: [r.ref, r.realm],
      causes: [{ ref: r.first ?? r.opened, role: "trigger", weight: 1 }],
      data: { house: r.house.name, worth: Math.round(r.house.worth), year },
    });
}

/** A hold is taken: its goods gone, to whoever took them if they have a market to bring them to. */
function taken(
  ctx: PopulationContext,
  store: TradeStore,
  r: StarRun,
  c: Convoy,
  by: {
    readonly name: string;
    readonly ref: Ref;
    readonly cause: Ref | null;
    readonly seat: number;
  },
  year: number,
): void {
  const { world } = ctx;
  for (const [good, count] of c.cargo) {
    r.lost[good] = r.lost[good]! + count;
    if (by.seat >= 0) marketsOf(world).of(by.seat).move("in", good, count);
  }
  r.raided++;
  r.raider = by.name;
  r.lastRaidYear = year;
  r.risk += (1 - r.risk) * HOLD_TEACHES;
  const causes: CauseRef[] = [{ ref: r.opened, role: "enabler", weight: 0.4 }];
  if (by.cause) causes.push({ ref: by.cause, role: "trigger", weight: 1 });
  const data = {
      realm: r.name,
      by: by.name,
      goods: c.cargo.map(([g, n]) => [GOODS[g]!.name, n]),
      lanes: r.hops,
      year,
    },
    first = !store.firstRaid;
  r.lastRaid = world.events.emit({
    type: first ? TRADE_EVENTS.firstRaid.type : TRADE_EVENTS.raided.type,
    place: cellRef(0, r.to),
    subjects: [r.ref, r.realm, by.ref],
    causes,
    data,
  });
  if (first) store.firstRaid = r.lastRaid;
}

/** The chance a hold is taken this year, by whom: those at war with either end first, then one short of it along its way. */
function raidOn(
  ctx: PopulationContext,
  r: StarRun,
  c: Convoy,
  n: number,
  wars: readonly StarWar[],
  away: readonly Away[],
  holder: Ref | undefined,
  t: SimTime,
): {
  readonly name: string;
  readonly ref: Ref;
  readonly cause: Ref | null;
  readonly seat: number;
} | null {
  const { world } = ctx,
    found = r.hops ? 1 + r.hops : DARK_FOUND,
    realms = politiesOf(world),
    key = hashString(r.ref) >>> 0,
    draw = world.rng.real(RAID, key, t, n);
  let reach = 0;
  for (const w of wars) {
    const side = w.realm === r.realm || w.realm === holder,
      other = w.enemy === r.realm || w.enemy === holder;
    if (!side && !other) continue;
    const foe = side ? w.enemy : w.realm;
    reach += RAID_YEAR * (w.strength / (w.strength + 4)) * found;
    if (draw < reach) {
      const p = realms.get(foe),
        civ = p ? null : civilizationsNear(world).find((x) => x.ref === foe);
      return {
        name: p?.town ?? (civ ? `the ${peopleWords(world, civ).name}` : "those at war with it"),
        ref: foe,
        cause: w.event,
        seat: p && p.ended === null ? p.seat : -1,
      };
    }
  }
  if (r.hops) {
    const way = laneRoute(world, r.fromStar, r.toStar);
    if (!way) return null;
    const map = laneMapOf(world),
      good = c.cargo[0]?.[0] ?? -1;
    for (const a of away) {
      if (a.cell === r.to || a.cell === r.from || !a.holder || a.holder.ref === r.realm) continue;
      if (a.holder.ref === holder) continue;
      const at = map.at.get(a.star);
      if (at === undefined || !way.stars.includes(at)) continue;
      if (good < 0 || a.market.price[good]! < SHORT_AT * GOODS[good]!.value) continue;
      reach += SHORT_RAID_YEAR;
      if (draw < reach)
        return { name: a.holder.town, ref: a.holder.ref, cause: null, seat: a.cell };
    }
  }
  return null;
}

/** Lade a run's next hold (false: nothing clears). */
function sail(ctx: PopulationContext, r: StarRun, to: Away | Market, year: number): boolean {
  const { world } = ctx,
    market = "market" in to ? to.market : to,
    people = ctx.provinces.get(r.to)?.total() ?? 0;
  let crossing: Crossing | null, load: Load[], realm: Polity | undefined, from: Market | undefined;
  const civ = r.civ ? civilizationsNear(world).find((x) => x.ref === r.civ) : null;
  if (r.civ) {
    if (!civ) return false;
    crossing = farCrossing(world, civ, r.toStar, year);
    if (!crossing) return false;
  } else {
    realm = politiesOf(world).of(r.from);
    from = marketsOf(world).get(r.from);
    if (!realm || !from) return false;
    crossing = crossingOf(ctx, realm, r.fromStar, r.toStar);
    if (!crossing) return false;
  }
  const gap = Math.max(1, Math.ceil(crossing.years / MOST_UNDER_WAY));
  if (year - r.lastOut < gap || r.under.length >= MOST_UNDER_WAY) return true;
  const machinePrice = from ? from.price[G.machines]! : GOODS[G.machines]!.value * FAR_FLOOR;
  load = holdOf(
    r.civ ? farAsks(world, r.civ, market) : asksOf(from!, market),
    crossing,
    machinePrice,
    people * PAY_HEAD * gap,
    r.risk,
  );
  if (!load.length) return false;
  const machines = Math.ceil(crossing.machines * tonnesOf(load));
  if (realm) {
    if (machinesOfRealm(ctx, realm) * 0.5 < machines) return false;
    spendMachines(ctx, realm, machines);
    for (const l of load) from!.take("out", l.good, l.count);
  }
  r.drive = crossing.drive;
  r.ly = crossing.ly;
  r.hops = crossing.hops;
  r.years = crossing.years;
  r.machinesTonne = crossing.machines;
  r.lastOut = year;
  r.under.push({
    sailed: year,
    arrives: year + Math.ceil(crossing.years),
    cargo: load
      .slice(0, HOLD_GOODS)
      .map((l) => [l.good, l.count, Math.round(l.margin * 100) / 100]),
    machines,
  });
  return true;
}

/** A run's year: whether it still can run, its holds in or taken, its next laded. */
function runYear(
  ctx: PopulationContext,
  store: TradeStore,
  r: StarRun,
  wars: readonly StarWar[],
  away: readonly Away[],
  t: SimTime,
  year: number,
): void {
  const { world } = ctx,
    markets = marketsOf(world),
    land = ctx.provinces.get(r.to),
    to = markets.get(r.to),
    realms = politiesOf(world),
    holder = realms.of(r.to)?.ref,
    fall = farOf(world) ? fireOf(world).unmade(r.toStar, r.planet) : null;
  if (fall) return closeRun(world, r, "gone", year, fall.event as Ref);
  if (!land?.total() || !to) return closeRun(world, r, "empty", year, null);
  const carrier = r.civ ? r.civ : (realms.of(r.from)?.ref ?? null);
  if (!carrier) return closeRun(world, r, "fallen", year, null);
  if (holder) {
    const war = warBetween(wars, carrier, holder);
    if (war) return closeRun(world, r, "war", year, war.event);
    const here = r.civ ? undefined : homeWar(world, carrier, holder);
    if (here) return closeRun(world, r, "war", year, here.event);
    if (r.civ) {
      const met = peoplesOf(world)?.meetingOf(r.civ, holder);
      if (met && met.regard < 0)
        return closeRun(world, r, "war", year, met.lastRaidEvent ?? met.event);
    }
  }
  for (let i = r.under.length - 1; i >= 0; i--) {
    const c = r.under[i]!,
      by = raidOn(ctx, r, c, i, wars, away, holder, t);
    if (by) {
      taken(ctx, store, r, c, by, year);
      r.under.splice(i, 1);
    } else if (year >= c.arrives) {
      comeIn(ctx, store, r, c, to, year);
      r.under.splice(i, 1);
    }
  }
  const sailing = sail(ctx, r, to, year);
  if (!sailing && !r.under.length && year - Math.max(r.lastIn, r.lastOut) > IDLE_YEARS)
    closeRun(world, r, "unpaid", year, r.lastRaid);
}

/** The new run a land would gain most by, weighed for every land away; the best of them opened. */
function opening(
  ctx: PopulationContext,
  store: TradeStore,
  away: readonly Away[],
  wars: readonly StarWar[],
  year: number,
): void {
  const { world } = ctx,
    open = store.open();
  if (open.length >= MOST_RUNS) return;
  const realms = politiesOf(world),
    markets = marketsOf(world),
    space = spaceOf(world);
  /** Who can send: a land of a realm in the sky. */
  const able = (p: Polity | undefined) => !!p && p.ended === null && !!space.of(p.ref)?.station;
  type Seller = { readonly cell: number; readonly star: Ref; readonly realm: Polity };
  const sellers = new Map<number, Seller>(),
    g = ctx.generated,
    home = g.star.ref as Ref;
  // For each good, the cheapest at home and the cheapest away: at most a few dozen to weigh.
  for (let good = 0; good < GOOD_COUNT; good++) {
    let best: Seller | null = null,
      least = Infinity;
    for (const p of realms.living()) {
      if (!able(p)) continue;
      const m = markets.get(p.seat);
      if (!m || m.stock[good]! <= 0 || m.price[good]! >= least) continue;
      if (m.stock[good]! - KEEP_YEARS * (m.line("used", good) + m.line("out", good)) <= 0) continue;
      least = m.price[good]!;
      best = { cell: p.seat, star: home, realm: p };
    }
    if (best) sellers.set(best.cell, best);
    best = null;
    least = Infinity;
    for (const a of away) {
      if (!able(a.holder)) continue;
      const m = a.market;
      if (m.stock[good]! <= 0 || m.price[good]! >= least) continue;
      if (m.stock[good]! - KEEP_YEARS * (m.line("used", good) + m.line("out", good)) <= 0) continue;
      least = m.price[good]!;
      best = { cell: a.cell, star: a.star, realm: a.holder! };
    }
    if (best) sellers.set(best.cell, best);
  }
  const running = new Set(open.map((r) => `${r.civ ?? r.from}>${r.to}`)),
    toLand = new Map<number, number>();
  for (const r of open) toLand.set(r.to, (toLand.get(r.to) ?? 0) + 1);
  const trying: {
    worth: number;
    make: () => void;
  }[] = [];
  const civs = civilizationsNear(world).filter((c) => c.stars <= year),
    peoples = peoplesOf(world);
  for (const to of away) {
    if ((toLand.get(to.cell) ?? 0) >= MOST_TO_A_LAND) continue;
    const budget = to.people * PAY_HEAD * OPEN_EVERY;
    for (const s of sellers.values()) {
      if (s.cell === to.cell || running.has(`${s.cell}>${to.cell}`)) continue;
      if (to.holder && s.realm.ref !== to.holder.ref) {
        if (
          warBetween(wars, s.realm.ref, to.holder.ref) ||
          homeWar(world, s.realm.ref, to.holder.ref)
        )
          continue;
      }
      const c = crossingOf(ctx, s.realm, s.star, to.star);
      if (!c) continue;
      const from = markets.get(s.cell)!,
        load = holdOf(asksOf(from, to.market), c, from.price[G.machines]!, budget, 0),
        worth = worthOf(load);
      if (worth <= 0 || machinesOfRealm(ctx, s.realm) * 0.5 < c.machines * tonnesOf(load)) continue;
      trying.push({
        worth,
        make: () => openRun(ctx, store, s.realm, s.cell, s.star, null, to, c, load, year),
      });
    }
    // Another people of the stars, met and speaking with the realm that holds this land; where none holds it, with any of its own.
    if (peoples)
      for (const civ of civs) {
        if (running.has(`${civ.ref}>${to.cell}`)) continue;
        const speaking = (m: { talking: boolean; regard: number } | undefined) =>
            !!m?.talking && m.regard > 0,
          met = to.holder
            ? speaking(peoples.meetingOf(civ.ref, to.holder.ref))
            : peoples.meetings.some((m) => m.civ === civ.ref && m.with === "realm" && speaking(m));
        if (!met || (to.holder && warBetween(wars, civ.ref, to.holder.ref))) continue;
        const c = farCrossing(world, civ, to.star, year);
        if (!c) continue;
        const load = holdOf(
            farAsks(world, civ.ref, to.market),
            c,
            GOODS[G.machines]!.value * FAR_FLOOR,
            budget,
            0,
          ),
          worth = worthOf(load);
        if (worth <= 0) continue;
        trying.push({
          worth,
          make: () => openRun(ctx, store, null, -1, civ.star, civ.ref, to, c, load, year),
        });
      }
  }
  trying.sort((a, b) => b.worth - a.worth);
  for (const t of trying.slice(0, 1)) t.make();
}

/** A run opens: why, from what it is short of there and has plenty of here and what the crossing costs. */
function openRun(
  ctx: PopulationContext,
  store: TradeStore,
  realm: Polity | null,
  fromCell: number,
  fromStar: Ref,
  civ: Ref | null,
  to: Away,
  c: Crossing,
  load: readonly Load[],
  year: number,
): void {
  const { world } = ctx,
    from = fromCell >= 0 ? marketsOf(world).get(fromCell)! : null,
    machinePrice = from ? from.price[G.machines]! : GOODS[G.machines]!.value * FAR_FLOOR,
    ref = makeRef(RUN, 0, store.count),
    far = civ ? civilizationsNear(world).find((x) => x.ref === civ) : null,
    farName = far ? peopleWords(world, far).name : null,
    key = hashString(`${world.seed.text} run ${ref}`) >>> 0,
    ways = fromCell >= 0 ? cultureOf(world).get(fromCell) : null,
    house = ways
      ? `the house of ${tonguePersonName(ways.tongue, key, 1)}`
      : `the ${farName ?? "far"} carriers`,
    name = realm?.town ?? `the ${farName ?? "far"}`,
    top = load[0]!,
    goodFactors: Factor[] = load.slice(0, 2).map((l, i) => ({
      name: `${GOODS[l.good]!.name}: fetching ${to.market.price[l.good]!.toFixed(1)} there, ${(from ? from.price[l.good]! : GOODS[l.good]!.value * FAR_FLOOR).toFixed(1)} here`,
      value: l.margin,
      contribution: i ? 0.5 : 1,
      source: { ref: cellRef(0, to.cell), role: "pressure", weight: 1 },
    })),
    decision = world.decisions.record({
      rule: "trade.opened",
      subject: realm?.ref ?? civ!,
      outcome: { to: to.cell, good: GOODS[top.good]!.id },
      score: worthOf(load),
      threshold: 0,
      factors: [
        ...goodFactors,
        {
          name: `the crossing: ${c.ly.toFixed(1)} light-years, ${Math.ceil(c.years)} years${c.hops ? ` by ${c.hops} lane${c.hops === 1 ? "" : "s"}` : ""}, ${perBulk(c, machinePrice).toFixed(1)} in grain a sack's weight`,
          value: c.machines,
          contribution: 0.6,
          source: null,
        },
      ],
    }),
    opened = world.events.emit({
      type: TRADE_EVENTS.opened.type,
      place: cellRef(0, to.cell),
      subjects: [ref, realm?.ref ?? civ!, cellRef(0, to.cell)],
      causes: [{ ref: decision, role: "trigger", weight: 1 }],
      data: {
        realm: name,
        house,
        good: GOODS[top.good]!.name,
        ly: Math.round(c.ly * 10) / 10,
        lanes: c.hops,
        years: Math.ceil(c.years),
        year,
      },
    }),
    r: StarRun = {
      ref,
      from: fromCell,
      to: to.cell,
      civ,
      fromStar,
      toStar: to.star,
      planet: to.planet,
      realm: realm?.ref ?? civ!,
      name,
      house: { name: house, cell: fromCell, worth: 0, rich: null },
      drive: c.drive,
      ly: c.ly,
      hops: c.hops,
      years: c.years,
      machinesTonne: c.machines,
      year,
      opened,
      first: null,
      firstYear: null,
      landed: new Array<number>(GOOD_COUNT).fill(0),
      lost: new Array<number>(GOOD_COUNT).fill(0),
      ships: 0,
      raided: 0,
      lastIn: year,
      lastOut: -Infinity,
      lastRaid: null,
      lastRaidYear: 0,
      raider: null,
      risk: 0,
      before: beforeOf(from, to.market, to.people),
      under: [],
      closed: null,
      closedYear: null,
      closedWhy: null,
    };
  // (JSON keeps no infinity: a run not yet sailed sailed long ago.)
  r.lastOut = year - 10_000;
  store.add(r);
  sail(ctx, r, to, year);
}

/** Why no ship comes to a land for gain, in its numbers: what it is shortest of, what that costs at the nearest it could come from. */
export function tradeWhyNot(ctx: PopulationContext, cell: number): string {
  const { world } = ctx,
    m = marketsOf(world).get(cell);
  if (!m) return "No ship comes here: it has no market to sell in.";
  let short = 0,
    most = 0;
  for (let g = 0; g < GOOD_COUNT; g++) {
    const k = m.price[g]! / GOODS[g]!.value;
    if (k > most) [short, most] = [g, k];
  }
  const senders = politiesOf(world)
    .living()
    .filter((p) => !!spaceOf(world).of(p.ref)?.station);
  if (!senders.length)
    return "No ship comes here for gain: no realm is yet in the sky to send one.";
  let best: { p: Polity; c: Crossing; here: number } | null = null;
  const home = ctx.generated.star.ref as string,
    ship = starSitesOf(world)?.get(cell);
  for (const p of senders) {
    const c = crossingOf(ctx, p, home, ship?.star ?? home),
      sells = marketsOf(world).get(p.seat);
    if (!c || !sells || sells.stock[short]! <= 0) continue;
    const here = sells.price[short]!;
    if (
      !best ||
      here + perBulk(c, sells.price[G.machines]!) * GOODS[short]!.bulk <
        best.here + perBulk(best.c, sells.price[G.machines]!) * GOODS[short]!.bulk
    )
      best = { p, c, here };
  }
  const name = GOODS[short]!.name;
  if (!best)
    return `No ship comes here for gain. It is shortest of ${name}, at ${m.price[short]!.toFixed(1)}, ${most.toFixed(1)} times its usual worth, but no realm in the sky has any to spare and a way to bring it.`;
  const cost =
      perBulk(best.c, marketsOf(world).get(best.p.seat)!.price[G.machines]!) * GOODS[short]!.bulk,
    wants = best.here + cost;
  return wants > m.price[short]! * survives(short, best.c.years)
    ? `No ship comes here for gain. It is shortest of ${name}, at ${m.price[short]!.toFixed(1)}, ${most.toFixed(1)} times its usual worth. The cheapest is ${best.here.toFixed(1)} at ${best.p.town}, and the crossing, ${best.c.ly.toFixed(1)} light-years in ${Math.ceil(best.c.years)} years${best.c.hops ? ` by ${best.c.hops} lanes` : ""}, adds ${cost.toFixed(1)}: it would have to fetch ${wants.toFixed(1)} here to pay.`
    : `No ship has come here yet. It is shortest of ${name}, at ${m.price[short]!.toFixed(1)}, which would pay for the crossing from ${best.p.town}: someone will come, when a hull is free.`;
}

/** The year of all runs. Nothing at all until someone has come to live away from home. */
export function tradeYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = tradeOf(world);
  if (!store || !isProvinceWorld(ctx.generated)) return;
  const away = landsAway(ctx);
  if (!away.length && store.dormant()) return;
  const year = yearOfMoment(t),
    wars = starWarsOf(world)
      .all()
      .filter((w) => !w.ended);
  for (const r of store.open()) runYear(ctx, store, r, wars, away, t, year);
  if (year % OPEN_EVERY === 0 && away.length) opening(ctx, store, away, wars, year);
  store.trim(MOST_KEPT);
}

export function installTrade(world: World, ctx: () => PopulationContext): TradeStore {
  const store = world.register(new TradeStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "203.space.trade", every: YEAR, run: (t) => tradeYear(ctx(), t) });
  return store;
}
