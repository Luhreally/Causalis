// A town managed (town mode, second slice): what one who has entered a town orders of it, and what the town then did
// that its land's own reckoning would not have. Orders are commands: how many of its hands are put to its fields, its
// crafts and its hauling; how many months of food its granary holds back; which goods its market will not sell. The town
// kept in detail beside the world (host/place.ts) reads its orders here and lives by them, and what comes of that is
// told back in a command of its own (`place.settle`, its numbers told by the host as the deed is taken: Universe.told):
// those who changed trade, and those who died of want. They are written to its land's counts, never more than the land
// has of a kind, so nothing is made from nothing and every hand is one of the land's own. What more or less the town
// then makes is the land's own reckoning of its trades, next it reckons: the made and the used are counted once, there.
// Nothing is kept for a town never given an order, and a world where no one orders anything runs exactly as it did.
//
// What it does against what threatens it (fourth slice). A town may be held by an order to one of the answers its world's
// peoples come to by loss (rules/lessons.ts: lanes a fire stops at, the sick kept apart, grain put by), or to stand to
// arms as a town that has put its arms first does (sim/town/asks.ts). The order adds no rule and no number: the town leans
// on that answer wholly, as one that had learned it would, and the world's own reckoning of a fire, a sickness, a lean
// year or a battle for its land reads it, for the town's share of its land's people where the reckoning is its land's.
// What it asks of them is taken from its fields as a town's own priority is: the answer's own asking (its `asks`) of the
// hands a priority gladly taken up pulls.
import {
  MONTH as MONTH_S,
  yearOfMoment,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  BANDS,
  GOODS,
  LESSONS_FOR,
  LESSON_RESPONSE,
  OCC,
  OCCUPATIONS,
  SEXES,
  lessenBy,
} from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import { townsOf } from "./fabric.ts";
import { ASK_PULL, askWorked, asksOf, handsFor, type Ask, type AskRaise } from "./asks.ts";

const ROWS = SEXES * BANDS,
  OCCS = OCCUPATIONS.length;

/** The trades hands can be put to by an order: its fields (farmers), its herds, its crafts, its hauling (traders). */
export const MANAGED_TRADES = [OCC.farmer, OCC.herder, OCC.crafter, OCC.trader] as const;

export type Managed = {
  readonly town: Ref;
  readonly cell: number;
  /** When it was first given an order. */
  readonly since: number;
  /**
   * Of its hands at the trades an order can move (MANAGED_TRADES' order), the thousandths put to each (null: as its land
   * has them).
   */
  work: number[] | null;
  /** Months of its people's food its granary holds back from its households (0: none). */
  hold: number;
  /** The goods its market will not let go (their places in GOODS). */
  forbidden: number[];
  /**
   * What it has moved of its land's counts so far, kind by kind (sex and band by trade): hands changed from one trade to
   * another (each row adding up to nothing), as they were written to its land.
   */
  own: number[];
  /** Those of it who died of want, by the year: [year, count], oldest first. */
  dead: [number, number][];
  /**
   * Its people given work by name, one after another: who (their number in the town kept, host/place.ts), the trade they
   * are put to (-1: none said), the building's lot they are put at (-9: none said).
   */
  assigned: number[];
  /** The lots of its buildings whose work is stopped. */
  shut: number[];
  /** Households given a home, one after another: the household (its key), the lot. */
  housed: number[];
  /**
   * The sites it has in hand, or had (things it was asked to raise, worked by its own people where it is kept in detail),
   * five numbers each: the asking (its number among its town's); whether it is in hand now (1, or 0: given back, kept
   * until its land's month has taken off what was told); the seconds of its own work told of months its land's month had
   * already reckoned (told late: its land's count runs ahead by its hands for so long); the seconds told of the month now
   * under way; and when its land's month last reckoned it.
   */
  sites: number[];
  /** What it is held to against what threatens it (HELD's names), in their order. */
  held: string[];
  /** The lot of the building opened to those of it who have lost their homes (-1: none). */
  shelter: number;
  /**
   * What its people are to work at, by name and in what order (place.prio), two numbers each: who (their number in the
   * town kept), and their five priorities packed two bits each (PRIO_KINDS' order; 0 never, 3 first). Absent: none set.
   */
  prio?: number[];
  /**
   * Its bills (N10): how much of a good its makers are to keep it holding, two numbers each, in the order they were
   * given: the good (GOODS' order), and the units the town is to hold of it (0: make none of it). A maker whose own
   * making's good the town holds as much of as its bill asks turns to the first good asked for that it holds less of.
   * Absent: none given, each maker at their own making.
   */
  bills?: number[];
  /**
   * What its stores will not take (N10): two numbers each, the store (STORES' order: its market, its granary) and the
   * good. What its makers make of a good its market will not take stays where it was made; food its granary will not
   * take goes to its market, and food neither will take stays at home. Absent: each takes all it is for.
   */
  refuse?: number[];
  /**
   * Its zones (O2): two numbers each, a lot and what it is zoned as (ZONES' order). A meeting place is where those near
   * it go for company and their games, in place of the square; a lot kept clear is gone to by no one, its household
   * sheltering at the nearest meeting place (else the square), its work stopped, but for a fire. Absent: none.
   */
  zones?: number[];
  /**
   * Where those standing to arms stand by its order (O7): a lot, the walls' site, or (absent) the square. Posted there in
   * the hours their work would have had, they watch the homes within a cry of it: a theft from one is caught in the act.
   */
  post?: number;
  /**
   * Its gate shut to newcomers by order (P2: 0; absent, open): those who come asking to live in it are turned away, and go
   * on to another of its land's towns.
   */
  gate?: 0;
  /** Those of it freed from bondage by your word (P6): their numbers. Absent: none. */
  freed?: number[];
};

/** What a lot of a town can be zoned as (O2): a meeting place, or kept clear. */
export const ZONES = ["meet", "clear"] as const;

/** A town's stores an order can tell what to take (N10): its market, where all it makes is carried; its granary, its food. */
export const STORES = ["market", "granary"] as const;
/** The most of a good a bill can ask a town to hold (units). */
export const BILL_MOST = 1_000_000;

/**
 * The kinds of work a priority is set for: the four trades an order can move hands to, raising what the town builds, and
 * turning out to a fire (N6: who of those near it go, and who keep a watch where one is kept by order).
 */
export const PRIO_KINDS = ["fields", "herds", "crafts", "hauling", "building", "fire"] as const;
/** The kinds an order of before the fire's was given for (five), and what the fire's is for one of them: as of themselves. */
const PRIO_KINDS_BEFORE = 5;
export const PRIO_FIRE_OWN = 1;
/** A packed number that holds every kind of PRIO_KINDS (one packed before the fire's holds five). */
const PRIO_ALL = 1 << (2 * PRIO_KINDS.length);
/** One's priorities from their packed number (PRIO_KINDS' order, each 0 … 3), and back. */
export const prioOf = (packed: number): number[] =>
  PRIO_KINDS.map((_, k) =>
    k >= PRIO_KINDS_BEFORE && !(packed & PRIO_ALL) ? PRIO_FIRE_OWN : (packed >> (2 * k)) & 3,
  );
export const prioPacked = (kinds: readonly number[]): number =>
  kinds.reduce((n, x, k) => n | ((x & 3) << (2 * k)), 0) |
  (kinds.length >= PRIO_KINDS.length ? PRIO_ALL : 0);
/**
 * The trade one with these priorities is put to: of the four trades, the one set highest (their own where it is among
 * the highest; else the first of them); -1 where none is set above nothing.
 */
export function prioTrade(kinds: readonly number[], own: number): number {
  let best = -1,
    most = 0;
  MANAGED_TRADES.forEach((occ, k) => {
    const x = kinds[k] ?? 0;
    if (x > most || (x === most && x > 0 && occ === own)) {
      most = x;
      best = occ;
    }
  });
  return best;
}

/**
 * What a town can be held to by an order: an answer of its world's own to a cause of loss (rules/lessons.ts, by its id),
 * or `muster`, to stand to arms as a town that has put its arms first gladly does.
 */
export const HELD = ["firebreaks", "quarantine", "granaries", "muster"] as const;
export type HeldTo = (typeof HELD)[number];

/** A change of trade told back: so many of a sex and band, from one trade to another. */
export type SettleMove = readonly [row: number, from: number, to: number, n: number];
/** Deaths told back: so many of a sex and band and trade. */
export type SettleDead = readonly [row: number, occ: number, n: number];
/** Work on a site told back: the asking, the person-months its own people did on it, and over how long (seconds). */
export type SettleBuilt = readonly [ask: number, months: number, seconds: number];
export type SettleArgs = {
  town: Ref;
  moves?: readonly SettleMove[];
  dead?: readonly SettleDead[];
  built?: readonly SettleBuilt[];
};
/** Of their time, the share the world's year takes its people to be at work (a person-month of work is so much of a month). */
export const WORK_SHARE = 1 / 3;

export class ManagedStore implements StateStore {
  readonly name = "town.managed";
  private list: Managed[] = [];
  private readonly byTown = new Map<string, Managed>();

  dormant(): boolean {
    return !this.list.length;
  }
  hashInto(h: Hasher): void {
    h.value(this.list);
  }
  save(): unknown {
    return this.list.length ? { list: this.list } : {};
  }
  load(state: unknown): void {
    this.list = [];
    this.byTown.clear();
    for (const m of (state as { list?: Managed[] }).list ?? [])
      this.add({
        ...m,
        work: m.work ? [...m.work] : null,
        forbidden: [...m.forbidden],
        own: [...m.own],
        dead: m.dead.map((d) => [d[0], d[1]]),
        // (A save from before they were kept: none.)
        assigned: [...(m.assigned ?? [])],
        shut: [...(m.shut ?? [])],
        housed: [...(m.housed ?? [])],
        sites: [...(m.sites ?? [])],
        held: [...(m.held ?? [])],
        shelter: m.shelter ?? -1,
        ...(m.bills ? { bills: [...m.bills] } : {}),
        ...(m.refuse ? { refuse: [...m.refuse] } : {}),
        ...(m.zones ? { zones: [...m.zones] } : {}),
        ...(m.post !== undefined ? { post: m.post } : {}),
        ...(m.gate !== undefined ? { gate: m.gate } : {}),
        ...(m.freed ? { freed: [...m.freed] } : {}),
      });
  }
  private add(m: Managed): Managed {
    this.list.push(m);
    this.byTown.set(m.town, m);
    return m;
  }
  get(town: string): Managed | undefined {
    return this.byTown.get(town);
  }
  all(): readonly Managed[] {
    return this.list;
  }
  /** A town's orders, begun where it has none. */
  of(town: Ref, cell: number, t: number): Managed {
    return (
      this.byTown.get(town) ??
      this.add({
        town,
        cell,
        since: t,
        work: null,
        hold: 0,
        forbidden: [],
        own: new Array<number>(ROWS * OCCS).fill(0),
        dead: [],
        assigned: [],
        shut: [],
        housed: [],
        sites: [],
        held: [],
        shelter: -1,
      })
    );
  }
}

/** A world's managed towns (null: it keeps none, a world of no towns). */
export function managedOf(world: World): ManagedStore | null {
  return world.peek<ManagedStore>("town.managed") ?? null;
}

/** A land's towns held to anything, each with its share of its land's people (0 … 1). None where no town is managed. */
function heldIn(ctx: PopulationContext, cell: number): (readonly [Managed, number])[] {
  const store = managedOf(ctx.world);
  if (!store || store.dormant()) return [];
  const out: (readonly [Managed, number])[] = [],
    total = ctx.provinces.get(cell)?.total() ?? 0;
  for (const m of store.all()) {
    if (m.cell !== cell || !m.held.length) continue;
    const s = ctx.settlements.get(m.town);
    if (s && s.population > 0 && total > 0)
      out.push([m, Math.min(1, s.population / total)] as const);
  }
  return out;
}

/** What is left of a strike of a cause on a town held to an answer that lessens it: exactly 1 where it is held to none. */
function leftOf(m: Managed, cause: string): number {
  let left = 1;
  for (const r of LESSONS_FOR.get(cause) ?? [])
    if (r.how === "lessen" && m.held.includes(r.id)) left *= 1 - lessenBy(r, 1);
  return left;
}

/**
 * What is left of a strike of a cause on one town, by what it is held to (a fire on it): exactly 1 where it is held to
 * nothing against that cause. Read beside what its land has learned (sim/lore/lessons-store.ts lessened), the lesser of
 * the two: an order makes a town lean wholly on an answer, it does not stack on the same answer learned.
 */
export function orderedLeft(world: World, town: string, cause: string): number {
  const m = managedOf(world)?.get(town);
  return m && m.held.length ? leftOf(m, cause) : 1;
}

/** The same for a reckoning that is its land's (a sickness): each town's part, by its share of its land's people. */
export function orderedLeftLand(ctx: PopulationContext, cell: number, cause: string): number {
  let left = 1;
  for (const [m, share] of heldIn(ctx, cell)) left -= share * (1 - leftOf(m, cause));
  return Math.max(0, left);
}

/** What its towns' orders add to a land by answers that work by `how` (grain put by: `stores`), by their shares. Exactly 0 where none. */
export function orderedAdds(ctx: PopulationContext, cell: number, how: string): number {
  let add = 0;
  for (const [m, share] of heldIn(ctx, cell))
    for (const id of m.held) {
      const r = LESSON_RESPONSE.get(id);
      if (r?.how === how) add += share * r.most;
    }
  return add;
}

/** How much more a land's defenders count for its towns standing to arms by order: as a town that put its arms first gladly. Exactly 1 where none. */
export function orderedGuard(ctx: PopulationContext, cell: number): number {
  let k = 1;
  for (const [m, share] of heldIn(ctx, cell))
    if (m.held.includes("muster")) k *= 1 + ASK_PULL.glad * share;
  return k;
}

/** The share of a town's hands what it is held to takes from its fields: each answer's own asking of what a priority gladly taken pulls; all of that for standing to arms. */
export function heldPull(m: Pick<Managed, "held">): number {
  let asks = 0;
  for (const id of m.held) asks += id === "muster" ? 1 : (LESSON_RESPONSE.get(id)?.asks ?? 0);
  return Math.min(1, asks * ASK_PULL.glad);
}

/** What its towns' orders leave of a land's harvest: the hands they take from its fields. Exactly 1 where none. */
export function orderedGift(ctx: PopulationContext, cell: number): number {
  let k = 1;
  for (const [m, share] of heldIn(ctx, cell)) k *= 1 - heldPull(m) * share;
  return k;
}

/** A site's five numbers in a town's orders (Managed.sites). */
const SITE = { ask: 0, held: 1, late: 2, ahead: 3, last: 4, wide: 5 } as const;
const siteAt = (m: Managed | undefined, ask: number): number => {
  if (m) for (let k = 0; k < m.sites.length; k += SITE.wide) if (m.sites[k] === ask) return k;
  return -1;
};

/** Whether a managed town has a site in hand (the asking's number among its town's). */
export function siteInHand(m: Managed | undefined, ask: number): boolean {
  const k = siteAt(m, ask);
  return k >= 0 && m!.sites[k + SITE.held] === 1;
}

/**
 * The seconds of the month gone a site's own town worked it by its own people (told already, place.settle): so much of the
 * month its land's reckoning puts no hands to it. What was told beyond a month is kept, late, for the next. Exactly 0, and
 * nothing kept, where no town has had it in hand.
 */
export function siteCovered(world: World, a: Ask, month: number, t: SimTime): number {
  const m = managedOf(world)?.get(a.town),
    k = siteAt(m, a.n);
  if (!m || k < 0) return 0;
  const told = m.sites[k + SITE.late]! + m.sites[k + SITE.ahead]!,
    use = Math.min(told, month);
  m.sites[k + SITE.late] = told - use;
  m.sites[k + SITE.ahead] = 0;
  m.sites[k + SITE.last] = t;
  // (Given back, and all of its own work taken off: its land's alone again.)
  if (!m.sites[k + SITE.held] && told - use <= 0) m.sites.splice(k, SITE.wide);
  return use;
}

/**
 * The person-months a site's count runs ahead of what was truly done on it: its land's month reckoned its hands for time
 * its own town's people were working it, told only after. It is done when it has had those too. Exactly 0 where no town
 * has had it in hand.
 */
export function siteOwed(world: World, a: Ask): number {
  const m = managedOf(world)?.get(a.town),
    k = siteAt(m, a.n);
  return m && k >= 0 && a.work ? Math.ceil((a.work.hands * m.sites[k + SITE.late]!) / MONTH_S) : 0;
}

/**
 * A site finished or given up, let go of its town's orders at once: at the month that finished it as at the telling that
 * did, so no stale numbers stand in its orders until the next telling (its land's count has taken all of them then).
 */
export function siteDone(world: World, a: Ask): void {
  const m = managedOf(world)?.get(a.town),
    k = siteAt(m, a.n);
  if (m && k >= 0) m.sites.splice(k, SITE.wide);
}

/**
 * The person-months truly done on what a town was asked to raise: its count, less what it runs ahead by where its own town
 * worked it (siteOwed). Its count itself where no town has had it in hand.
 */
export function askDone(world: World, a: Ask): number {
  return a.work ? Math.max(0, a.work.worked - (a.work.done === null ? siteOwed(world, a) : 0)) : 0;
}

/** The asking behind a site a town may take in hand: one of its own, a building or its walls, still going up (null: none such). */
function siteAsk(world: World, town: string, n: unknown): Ask | null {
  const a = typeof n === "number" ? asksOf(world).ofTown(town)[n] : undefined;
  return a &&
    a.work &&
    (a.work.at >= 0 || a.what === "walls") &&
    a.work.done === null &&
    !a.work.left
    ? a
    : null;
}

/**
 * The most hands a town can put to a site: what its own answer to the asking spares (sim/town/asks.ts handsFor: all it can
 * where it took the asking up gladly, seven in ten where it grudged it, half where it took up half). An order puts its own
 * people to the work; it does not make a town that grudged a thing glad of it.
 */
export function siteMostHands(ctx: PopulationContext, a: Ask): number {
  const s = ctx.settlements.get(a.town),
    f = townsOf(ctx.world).get(a.town);
  return handsFor(
    s?.population ?? 0,
    a.what as AskRaise,
    a.work?.lots ?? 0,
    f?.next ?? 0,
    a.answer === "refused" ? "half" : a.answer,
  );
}

/** Those of a managed town who died of want in a year. */
export function managedDead(m: Managed | undefined, year: number): number {
  let n = 0;
  if (m) for (const [y, count] of m.dead) if (y === year) n += count;
  return n;
}

const whole = (x: unknown, least: number, most: number): x is number =>
  typeof x === "number" && Number.isInteger(x) && x >= least && x <= most;

export function installManaged(world: World, ctx: () => PopulationContext): ManagedStore {
  const store = world.register(new ManagedStore()),
    townOf = (args: unknown) => {
      const town = (args as { town?: unknown } | null)?.town;
      return typeof town === "string" ? ctx().settlements.get(town as Ref) : undefined;
    },
    held = (args: unknown): string | null => {
      const s = townOf(args);
      if (!s) return "town must be a town's ref";
      return s.population > 0 ? null : "no one lives there";
    };
  // How many of its hands are put to its fields, its herds, its crafts and its hauling.
  world.defineCommand({
    type: "place.work",
    validate: (args) => {
      const bad = held(args);
      if (bad) return bad;
      const shares = (args as { shares?: unknown }).shares;
      if (shares === null) return null;
      if (!Array.isArray(shares) || shares.length !== MANAGED_TRADES.length)
        return "shares must be a number for each of fields, herds, crafts and hauling, or null";
      if (!shares.every((x) => whole(x, 0, 1000))) return "each share is 0 to 1000";
      return shares.reduce((a: number, b: number) => a + b, 0) === 1000
        ? null
        : "the shares must add up to 1000";
    },
    apply: (command, t) => {
      const a = command.args as { town: Ref; shares: number[] | null },
        s = ctx().settlements.get(a.town);
      if (s) store.of(s.ref, s.cell, t).work = a.shares ? [...a.shares] : null;
    },
  });
  // How many months of its people's food its granary holds back.
  world.defineCommand({
    type: "place.hold",
    validate: (args) =>
      held(args) ??
      (whole((args as { months?: unknown }).months, 0, 24) ? null : "months is 0 to 24"),
    apply: (command, t) => {
      const a = command.args as { town: Ref; months: number },
        s = ctx().settlements.get(a.town);
      if (s) store.of(s.ref, s.cell, t).hold = a.months;
    },
  });
  // A good its market will not let go, or will again.
  world.defineCommand({
    type: "place.forbid",
    validate: (args) => {
      const a = args as { good?: unknown; on?: unknown };
      return (
        held(args) ??
        (!whole(a.good, 0, GOODS.length - 1)
          ? "good must be a good's place"
          : typeof a.on === "boolean"
            ? null
            : "on must be true or false")
      );
    },
    apply: (command, t) => {
      const a = command.args as { town: Ref; good: number; on: boolean },
        s = ctx().settlements.get(a.town);
      if (!s) return;
      const m = store.of(s.ref, s.cell, t),
        at = m.forbidden.indexOf(a.good);
      if (a.on && at < 0) m.forbidden = [...m.forbidden, a.good].sort((x, y) => x - y);
      if (!a.on && at >= 0) m.forbidden = m.forbidden.filter((g) => g !== a.good);
    },
  });
  // One of its people, by name, put to a trade or at a building (both null: let be).
  world.defineCommand({
    type: "place.assign",
    validate: (args) => {
      const a = args as { person?: unknown; trade?: unknown; post?: unknown };
      return (
        held(args) ??
        (!whole(a.person, 1, 4294967295)
          ? "person must be one's number in the town kept"
          : a.trade !== null && !(MANAGED_TRADES as readonly unknown[]).includes(a.trade)
            ? "trade must be one an order can put hands to, or null"
            : a.post !== null && !whole(a.post, 0, 1e9)
              ? "post must be a building's lot, or null"
              : null)
      );
    },
    apply: (command, t) => {
      const a = command.args as {
          town: Ref;
          person: number;
          trade: number | null;
          post: number | null;
        },
        s = ctx().settlements.get(a.town);
      if (!s) return;
      const m = store.of(s.ref, s.cell, t),
        next: number[] = [];
      for (let k = 0; k < m.assigned.length; k += 3)
        if (m.assigned[k] !== a.person)
          next.push(m.assigned[k]!, m.assigned[k + 1]!, m.assigned[k + 2]!);
      if (a.trade !== null || a.post !== null) next.push(a.person, a.trade ?? -1, a.post ?? -9);
      m.assigned = next;
    },
  });
  // What one of its people is to work at, and in what order (null: as they would of themselves).
  world.defineCommand({
    type: "place.prio",
    validate: (args) => {
      const a = args as { person?: unknown; kinds?: unknown };
      if (held(args)) return held(args);
      if (!whole(a.person, 1, 4294967295)) return "person must be one's number in the town kept";
      if (a.kinds === null) return null;
      if (
        !Array.isArray(a.kinds) ||
        (a.kinds.length !== PRIO_KINDS.length && a.kinds.length !== PRIO_KINDS_BEFORE) ||
        !a.kinds.every((x) => whole(x, 0, 3))
      )
        return "kinds must be a priority, 0 to 3, for each of fields, herds, crafts, hauling, building and fire (or the first five), or null";
      return a.kinds.slice(0, MANAGED_TRADES.length).some((x: number) => x > 0)
        ? null
        : "one of the four trades must be set above nothing: the town does not keep idle hands";
    },
    apply: (command, t) => {
      const a = command.args as { town: Ref; person: number; kinds: number[] | null },
        s = ctx().settlements.get(a.town);
      if (!s) return;
      const m = store.of(s.ref, s.cell, t),
        next: number[] = [];
      for (let k = 0; k < (m.prio?.length ?? 0); k += 2)
        if (m.prio![k] !== a.person) next.push(m.prio![k]!, m.prio![k + 1]!);
      if (a.kinds) next.push(a.person, prioPacked(a.kinds));
      if (next.length) m.prio = next;
      else delete m.prio;
    },
  });
  // A bill (N10): how much of a good its makers keep it holding (until: units, 0 none; null: no bill), put first or not.
  world.defineCommand({
    type: "place.bill",
    validate: (args) => {
      const a = args as { good?: unknown; until?: unknown; first?: unknown };
      return (
        held(args) ??
        (!whole(a.good, 0, GOODS.length - 1)
          ? "good must be a good's number"
          : a.until !== null && !whole(a.until, 0, BILL_MOST)
            ? `until is 0 to ${BILL_MOST} units, or null for no bill`
            : a.first !== undefined && typeof a.first !== "boolean"
              ? "first must be true or false"
              : null)
      );
    },
    apply: (command, t) => {
      const a = command.args as { town: Ref; good: number; until: number | null; first?: boolean },
        s = ctx().settlements.get(a.town);
      if (!s) return;
      const m = store.of(s.ref, s.cell, t),
        was = m.bills ?? [],
        at = was.findIndex((x, k) => k % 2 === 0 && x === a.good),
        next: number[] = [];
      for (let k = 0; k < was.length; k += 2)
        if (was[k] !== a.good) next.push(was[k]!, was[k + 1]!);
      if (a.until !== null) {
        // (Kept where it stood among them, unless put first.)
        const into = a.first ? 0 : at >= 0 ? at : next.length;
        next.splice(into, 0, a.good, a.until);
      }
      if (next.length) m.bills = next;
      else delete m.bills;
    },
  });
  // What one of its stores will take (N10): a good taken there, or not.
  world.defineCommand({
    type: "place.refuse",
    validate: (args) => {
      const a = args as { store?: unknown; good?: unknown; on?: unknown };
      return (
        held(args) ??
        (!whole(a.store, 0, STORES.length - 1)
          ? `store is ${STORES.map((x, k) => `${k} (${x})`).join(" or ")}`
          : !whole(a.good, 0, GOODS.length - 1)
            ? "good must be a good's number"
            : typeof a.on === "boolean"
              ? null
              : "on must be true (it will not take it) or false")
      );
    },
    apply: (command, t) => {
      const a = command.args as { town: Ref; store: number; good: number; on: boolean },
        s = ctx().settlements.get(a.town);
      if (!s) return;
      const m = store.of(s.ref, s.cell, t),
        next: number[] = [];
      for (let k = 0; k < (m.refuse?.length ?? 0); k += 2)
        if (m.refuse![k] !== a.store || m.refuse![k + 1] !== a.good)
          next.push(m.refuse![k]!, m.refuse![k + 1]!);
      if (a.on) next.push(a.store, a.good);
      if (next.length) m.refuse = next;
      else delete m.refuse;
    },
  });
  // A building's work stopped, or let go on.
  world.defineCommand({
    type: "place.shut",
    validate: (args) => {
      const a = args as { lot?: unknown; on?: unknown };
      return (
        held(args) ??
        (!whole(a.lot, 0, 1e9)
          ? "lot must be a building's lot"
          : typeof a.on === "boolean"
            ? null
            : "on must be true or false")
      );
    },
    apply: (command, t) => {
      const a = command.args as { town: Ref; lot: number; on: boolean },
        s = ctx().settlements.get(a.town);
      if (!s) return;
      const m = store.of(s.ref, s.cell, t),
        rest = m.shut.filter((lot) => lot !== a.lot);
      m.shut = a.on ? [...rest, a.lot].sort((x, y) => x - y) : rest;
    },
  });
  // A household given a home.
  world.defineCommand({
    type: "place.house",
    validate: (args) => {
      const a = args as { house?: unknown; lot?: unknown };
      return (
        held(args) ??
        (!whole(a.house, 0, 4294967295)
          ? "house must be a household's key"
          : whole(a.lot, 0, 1e9)
            ? null
            : "lot must be a home's lot")
      );
    },
    apply: (command, t) => {
      const a = command.args as { town: Ref; house: number; lot: number },
        s = ctx().settlements.get(a.town);
      if (!s) return;
      const m = store.of(s.ref, s.cell, t),
        next: number[] = [];
      for (let k = 0; k < m.housed.length; k += 2)
        if (m.housed[k] !== a.house) next.push(m.housed[k]!, m.housed[k + 1]!);
      next.push(a.house, a.lot);
      m.housed = next;
    },
  });
  // Held to an answer against what threatens it, or let go of it.
  world.defineCommand({
    type: "place.respond",
    validate: (args) => {
      const a = args as { what?: unknown; on?: unknown };
      return (
        held(args) ??
        (!(HELD as readonly unknown[]).includes(a.what)
          ? `what is one of ${HELD.join(", ")}`
          : typeof a.on === "boolean"
            ? null
            : "on must be true or false")
      );
    },
    apply: (command, t) => {
      const a = command.args as { town: Ref; what: HeldTo; on: boolean },
        s = ctx().settlements.get(a.town);
      if (!s) return;
      const m = store.of(s.ref, s.cell, t),
        rest = m.held.filter((x) => x !== a.what);
      m.held = a.on ? HELD.filter((x) => x === a.what || rest.includes(x)) : rest;
    },
  });
  // A lot zoned (O2): a meeting place, kept clear, or neither (null).
  world.defineCommand({
    type: "place.zone",
    validate: (args) => {
      const a = args as { lot?: unknown; zone?: unknown };
      return (
        held(args) ??
        (!whole(a.lot, 0, 1e9)
          ? "lot must be one of its lots"
          : a.zone === null || (ZONES as readonly unknown[]).includes(a.zone)
            ? null
            : `zone is one of ${ZONES.join(", ")}, or null`)
      );
    },
    apply: (command, t) => {
      const a = command.args as { town: Ref; lot: number; zone: (typeof ZONES)[number] | null },
        s = ctx().settlements.get(a.town);
      if (!s) return;
      const m = store.of(s.ref, s.cell, t),
        next: number[] = [];
      for (let k = 0; k < (m.zones?.length ?? 0); k += 2)
        if (m.zones![k] !== a.lot) next.push(m.zones![k]!, m.zones![k + 1]!);
      if (a.zone !== null) next.push(a.lot, ZONES.indexOf(a.zone));
      if (next.length) m.zones = next;
      else delete m.zones;
    },
  });
  // Where those standing to arms stand (O7): a lot, the walls' site (-4), or the square (null).
  world.defineCommand({
    type: "place.post",
    validate: (args) => {
      const a = args as { lot?: unknown };
      return (
        held(args) ??
        (a.lot === null || a.lot === -4 || whole(a.lot, 0, 1e9)
          ? null
          : "lot must be one of its lots, the walls (-4), or null for the square")
      );
    },
    apply: (command, t) => {
      const a = command.args as { town: Ref; lot: number | null },
        s = ctx().settlements.get(a.town);
      if (!s) return;
      const m = store.of(s.ref, s.cell, t);
      if (a.lot === null) delete m.post;
      else m.post = a.lot;
    },
  });
  // One of it freed from bondage by your word (P6): their number.
  world.defineCommand({
    type: "place.free",
    validate: (args) => {
      const a = args as { person?: unknown };
      return (
        held(args) ??
        (whole(a.person, 1, 0xfffffffe) ? null : "person must be one of its people's numbers")
      );
    },
    apply: (command, t) => {
      const a = command.args as { town: Ref; person: number },
        s = ctx().settlements.get(a.town);
      if (!s) return;
      const m = store.of(s.ref, s.cell, t);
      if (!(m.freed ??= []).includes(a.person)) m.freed.push(a.person);
    },
  });
  // Its gate shut to newcomers (P2), or opened (null).
  world.defineCommand({
    type: "place.gate",
    validate: (args) => {
      const a = args as { shut?: unknown };
      return (
        held(args) ??
        (a.shut === true || a.shut === null ? null : "shut is true, or null to open it")
      );
    },
    apply: (command, t) => {
      const a = command.args as { town: Ref; shut: true | null },
        s = ctx().settlements.get(a.town);
      if (!s) return;
      const m = store.of(s.ref, s.cell, t);
      if (a.shut === null) delete m.gate;
      else m.gate = 0;
    },
  });
  // A building opened to those who have lost their homes (null: none).
  world.defineCommand({
    type: "place.shelter",
    validate: (args) => {
      const a = args as { lot?: unknown };
      return (
        held(args) ??
        (a.lot === null || whole(a.lot, 0, 1e9) ? null : "lot must be a building's lot, or null")
      );
    },
    apply: (command, t) => {
      const a = command.args as { town: Ref; lot: number | null },
        s = ctx().settlements.get(a.town);
      if (s) store.of(s.ref, s.cell, t).shelter = a.lot ?? -1;
    },
  });
  // A site (a building it was asked to raise) taken in hand with so many of its people, or given back to its land's month.
  world.defineCommand({
    type: "place.site",
    validate: (args) => {
      const bad = held(args);
      if (bad) return bad;
      const a = args as { town: Ref; ask?: unknown; hands?: unknown },
        ask = siteAsk(world, a.town, a.ask);
      if (!ask) return "ask must be the number of a building of its own still going up";
      if (a.hands === null) return null;
      const most = siteMostHands(ctx(), ask);
      return whole(a.hands, 1, most) ? null : `hands is 1 to ${most}, or null to give it back`;
    },
    apply: (command, t) => {
      const a = command.args as { town: Ref; ask: number; hands: number | null },
        s = ctx().settlements.get(a.town),
        ask = siteAsk(world, a.town, a.ask);
      if (!s || !ask) return;
      const m = store.of(s.ref, s.cell, t),
        k = siteAt(m, a.ask);
      if (a.hands === null) {
        // (Given back: what its own work had covered is still its land's month's to take off; kept until it has.)
        if (k < 0) return;
        if (m.sites[k + SITE.late]! + m.sites[k + SITE.ahead]! > 0) m.sites[k + SITE.held] = 0;
        else m.sites.splice(k, SITE.wide);
        return;
      }
      if (k >= 0) m.sites[k + SITE.held] = 1;
      // (In hand from now: its land's month last reckoned it at the month's turn before.)
      else m.sites.push(a.ask, 1, 0, 0, Math.floor(t / MONTH_S) * MONTH_S);
      // (Its hands are the land's own: so many, and what they would have brought in from its fields.)
      const total = ctx().provinces.get(s.cell)?.total() ?? 0;
      ask.work!.hands = a.hands;
      ask.work!.drain = total > 0 ? Math.min(250, Math.round((1000 * a.hands) / total)) : 0;
    },
  });
  // What a managed town did that its land's reckoning would not have: written to its land's counts.
  world.defineCommand({
    type: "place.settle",
    validate: (args) => {
      const bad = held(args);
      if (bad) return bad;
      const a = args as Partial<SettleArgs>;
      if (!store.get(a.town!)) return "the town has been given no order";
      const cell = (x: unknown, n: number) =>
        Array.isArray(x) && x.length === n && x.every((v) => whole(v, 0, 1e9));
      for (const m of a.moves ?? [])
        if (!cell(m, 4) || m[0] >= ROWS || m[1] >= OCCS || m[2] >= OCCS)
          return "a move is [row, from, to, count]";
      for (const d of a.dead ?? [])
        if (!cell(d, 3) || d[0] >= ROWS || d[1] >= OCCS) return "a death is [row, trade, count]";
      for (const b of a.built ?? [])
        if (!cell(b, 3)) return "work on a site is [asking, person-months, seconds]";
      return null;
    },
    apply: (command, t) => {
      applySettle(ctx(), store, command.args as SettleArgs, t);
      applyBuilt(ctx(), store, command.args as SettleArgs, t);
    },
  });
  return store;
}

/**
 * A settling applied: each change of trade as far as its land has those to change (never more), each death as far as its
 * land has those to die. What was done is kept with the town; what could not be is let go.
 */
function applySettle(ctx: PopulationContext, store: ManagedStore, a: SettleArgs, t: SimTime): void {
  const m = store.get(a.town),
    p = m ? ctx.provinces.get(m.cell) : undefined;
  if (!m || !p) return;
  const year = yearOfMoment(t);
  for (const [row, from, to, n] of a.moves ?? []) {
    const can = Math.min(n, p.counts.get(row, from));
    if (can <= 0 || from === to) continue;
    p.counts.move(row, from, row, to, can);
    m.own[row * OCCS + from]! -= can;
    m.own[row * OCCS + to]! += can;
  }
  let dead = 0;
  for (const [row, occ, n] of a.dead ?? []) {
    const can = Math.min(n, p.counts.get(row, occ));
    if (can <= 0) continue;
    p.counts.add(row, occ, -can);
    ctx.history.addDeaths(m.cell, year, row % BANDS, can);
    dead += can;
  }
  if (dead) {
    const last = m.dead.at(-1);
    if (last && last[0] === year) last[1] += dead;
    else m.dead.push([year, dead]);
    // (A few years of them are enough: a town's count is reckoned anew each year.)
    if (m.dead.length > 4) m.dead.splice(0, m.dead.length - 4);
  }
}

/**
 * Work on its sites applied: the person-months its own people did on each it has in hand, never more than its hands could
 * have done in the time told (all of it at work, where its land's month takes a third). The time is kept: of the month now
 * under way, its land's month will put no hands of its own to the site for so long; of a month its land had reckoned
 * already (told late), its land's count runs ahead by its hands for so long, taken off the next month's or, if the site
 * is finished first, worked off before it stands (siteOwed). So what is done on a site is done once.
 */
function applyBuilt(ctx: PopulationContext, store: ManagedStore, a: SettleArgs, t: SimTime): void {
  const m = store.get(a.town);
  if (!m) return;
  for (const [n, months, seconds] of a.built ?? []) {
    const ask = asksOf(ctx.world).ofTown(a.town)[n],
      w = ask?.work,
      k = siteAt(m, n);
    if (!ask || !w || k < 0 || !m.sites[k + SITE.held] || w.done !== null || w.left) continue;
    const late = Math.max(0, Math.min(seconds, m.sites[k + SITE.last]! - (t - seconds)));
    m.sites[k + SITE.late]! += late;
    m.sites[k + SITE.ahead]! += seconds - late;
    askWorked(
      ctx,
      ask,
      Math.min(months, Math.ceil((w.hands * seconds) / (MONTH_S * WORK_SHARE))),
      t,
      siteOwed(ctx.world, ask),
    );
  }
  // (A site done, or given up, is in hand no longer.)
  for (let k = m.sites.length - SITE.wide; k >= 0; k -= SITE.wide) {
    const w = asksOf(ctx.world).ofTown(a.town)[m.sites[k]!]?.work;
    if (!w || w.done !== null || w.left) m.sites.splice(k, SITE.wide);
  }
}
