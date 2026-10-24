// Sickness (Phase 20 M140, asked for 2026-10-23: "health and epidemiology — pathogens, immunity,
// epidemics, sanitation, medicine, public health, healthcare inequality"). A sickness is a thing
// of its own, with a name and a nature: how it passes (on the breath, in foul water, by vermin, by
// touch), how many of those it reaches take it, how many of those die, how long the survivors are
// spared it. It rises where life crowds — among herds, in great towns, in hot marshes — and is
// carried along the ways people go: to the lands next door, down the trade roads, over the sea,
// with armies. Where it comes it takes those who never had it, the old and the small the most, the
// hungry and the bound the more (crowded, ill-fed and untended); herb-lore and medicine spare
// some, drains and clean water stop a sickness of foul water. The survivors are spared it, for a
// while or for life, and their children are not; so it burns out, sleeps, and comes again on a
// generation that never knew it — and on a people who never met it, it comes as a great dying.
// Every rising and every coming is a decision whose factors say why, and every death is written
// in the land's ledger of deaths; a land's grief is laid on its realm, and its people turn to
// their gods, and from strangers. (M141: strangers from another star who come down bring the
// sicknesses of their own world, that no one here was ever spared; and ours go home with them.)
import {
  YEAR,
  defineEventType,
  defineKind,
  defineStream,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { cellRef, offworldSite, tongueLikeness } from "../../gen/index.ts";
import { BANDS } from "../../rules/index.ts";
import { COLS } from "../population/model.ts";
import { marketsOf, roundKeyed, type PopulationContext } from "../population/systems.ts";
import { handOf } from "../hand/hand.ts";
import { loreOf } from "../lore/lore.ts";
import { WAY, cultureOf, pushWays } from "../culture/culture.ts";
import { politiesOf } from "../polity/polity.ts";
import { warsOf } from "../war/war.ts";
import { grieve } from "../acts/disasters.ts";
import { orderOf, boundGone } from "../order/order.ts";
import { civilizationsNear } from "../space/contact.ts";
import { peoplesOf, peopleWords } from "../space/peoples.ts";

export const SICKNESS = defineKind("sick", "sickness", "minted");

/** How a sickness passes from one to another. */
export const ROUTES = ["breath", "water", "vermin", "touch"] as const;
export type Route = (typeof ROUTES)[number];
/** Where a sickness rose: among herds, in crowds, in hot marshes, by the god's hand — or it came
 * down from the stars with strangers. */
export const SOURCES = ["herds", "crowds", "marsh", "the god", "the stars"] as const;
export type Source = (typeof SOURCES)[number];
/** What carried a sickness to a land: its neighbours, a trade road, a sea route, an army, the
 * god's hand, strangers come down from the stars. */
export const VIAS = ["near", "road", "sea", "army", "god", "stars"] as const;
export type Via = (typeof VIAS)[number];

export const HEALTH_EVENTS = {
  rose: defineEventType("health.rose", 5),
  outbreak: defineEventType("health.outbreak", 4),
  /** A sickness of the home world gone home to the stars with strangers who came down. */
  went: defineEventType("health.went", 5),
};

/** How sickness rises, travels and kills (each a share or a chance a year). */
export const SICK = {
  /** A land's yearly chance of a new sickness rising: among its herds, its crowds, its marshes. */
  rise: { herds: 0.00005, crowds: 0.0001, marsh: 0.00006 },
  /** No new sickness within so many years of the last, nor while so many are about. */
  gap: 15,
  most: 8,
  /** The chance a carrier brings a sickness, before how many it reaches and who is spared. */
  carry: { near: 0.22, road: 0.35, sea: 0.45, army: 0.55, god: 1, stars: 0.6 } as Record<
    Via,
    number
  >,
  /** Unseen so long, a sickness sleeps where it rose, and wakes there now and then; longer, it is gone. */
  sleeps: 25,
  wake: 0.03,
  gone: 200,
  /** A coming that kills this share of a land's people is a great dying. */
  great: 0.15,
  /** The bound die so many times as often as the free (crowded, ill-fed, untended). */
  bound: 1.5,
  /** Where they know vaccination, the young are given each sickness the spared are spared for
   * life, so the spared rise toward this share, by this much of the gap a year. */
  vaccinated: 0.85,
  vaccinating: 0.25,
  /** Where they keep the sick apart, a sickness is brought this much less often. */
  quarantine: 0.5,
} as const;

/**
 * Strangers from the stars come down (M141): the chance a sickness of their world comes down with
 * them — after they came to talk and trade, only to look, or in war — and the chance, by how many
 * it reaches, that one of ours about the land they came down in goes home with them; and how far
 * their regard for the home world falls for it, at the deadliest.
 */
export const STAR_SICKNESS = {
  talked: 0.5,
  looked: 0.25,
  war: 0.35,
  home: 0.5,
  fear: 0.25,
} as const;

/** Of a land's people in each age band, how much likelier than the mean to die of a sickness. */
const FRAILTY = [2, 0.9, 0.5, 0.5, 0.6, 0.7, 0.9, 1.2, 1.7, 2.4];

/** A sickness: its nature, its rising, and what it has done. */
export type Sickness = {
  readonly ref: Ref;
  readonly name: string;
  /** Its kind in a word ("pox", "flux"), and how it passes. */
  readonly kind: string;
  readonly route: Route;
  readonly source: Source;
  /** Of those it reaches who are not spared, the share who take it; of those, the share who die. */
  readonly reach: number;
  readonly deadliness: number;
  /** Years the survivors are spared it (60: for life). */
  readonly lasting: number;
  /** Where and when it rose, and the event of its rising. */
  readonly cell: number;
  readonly year: number;
  readonly event: Ref;
  /** The people of the stars it came down with (null: it rose on the home world). */
  readonly people: Ref | null;
  /** Lands it has come to, its dead, the last year it struck anywhere, its dead decade by decade. */
  struck: number;
  dead: number;
  last: number;
  byDecade: number[];
  /** The year it was gone for good (unseen too long), or null. */
  ended: number | null;
};

/** A sickness come to a land. */
export type Outbreak = {
  readonly sickness: Ref;
  readonly year: number;
  readonly event: Ref;
  readonly dead: number;
  /** The share of the land's people it killed. */
  readonly share: number;
  /** The land it came from, and what carried it (none: it rose or woke here). */
  readonly from: number | null;
  readonly via: Via | null;
};

/** A land's health: who of its people are spared each sickness, and what came last. */
export type LandHealth = {
  readonly cell: number;
  /** Each sickness's share of its people spared it, by the sickness's ref (in ref order). */
  immune: [Ref, number][];
  last: Outbreak | null;
  /** Comings here, and the dead of them, ever. */
  struck: number;
  dead: number;
  /** The god's ward on it: the year and the act. */
  ward: { year: number; event: Ref } | null;
};

/** A sickness of the home world gone home to the stars with a people who came down. */
export type Went = {
  readonly sickness: Ref;
  readonly civ: Ref;
  readonly cell: number;
  readonly year: number;
  readonly event: Ref;
};

export class HealthStore implements StateStore {
  readonly name = "health.sickness";
  sicknesses: Sickness[] = [];
  lands = new Map<number, LandHealth>();
  /** The year the last sickness rose (null: none yet). */
  lastRose: number | null = null;
  /** The first great dying (a coming that killed a sixth of a land), and how many there have been. */
  great: { year: number; cell: number; event: Ref } | null = null;
  greats = 0;
  /** Sicknesses of ours gone home to the stars, each with a people once. */
  went: Went[] = [];

  get(ref: Ref | string): Sickness | undefined {
    return this.sicknesses.find((s) => s.ref === ref);
  }
  land(cell: number): LandHealth | undefined {
    return this.lands.get(cell);
  }
  /** The share of a land's people spared a sickness. */
  immune(cell: number, sickness: Ref): number {
    return this.lands.get(cell)?.immune.find(([r]) => r === sickness)?.[1] ?? 0;
  }
  /** The sicknesses not gone for good. */
  living(): Sickness[] {
    return this.sicknesses.filter((s) => s.ended === null);
  }
  pinned(): Ref[] {
    const out: Ref[] = this.sicknesses.map((s) => s.event);
    for (const l of this.lands.values()) {
      if (l.last) out.push(l.last.event);
      if (l.ward) out.push(l.ward.event);
    }
    for (const w of this.went) out.push(w.event);
    if (this.great) out.push(this.great.event);
    return out;
  }
  save(): unknown {
    return {
      sicknesses: this.sicknesses,
      lands: [...this.lands.values()].sort((a, b) => a.cell - b.cell),
      lastRose: this.lastRose,
      great: this.great,
      greats: this.greats,
      went: this.went,
    };
  }
  hashInto(h: Hasher): void {
    h.value(this.save());
  }
  load(state: unknown): void {
    const s = state as {
      sicknesses: Sickness[];
      lands: LandHealth[];
      lastRose: number | null;
      great: { year: number; cell: number; event: Ref } | null;
      greats: number;
      went?: Went[];
    };
    this.sicknesses = s.sicknesses.map((x) => ({
      ...x,
      people: x.people ?? null,
      byDecade: [...x.byDecade],
    }));
    this.lands = new Map(
      s.lands.map((l) => [
        l.cell,
        { ...l, immune: l.immune.map(([r, v]) => [r, v] as [Ref, number]) },
      ]),
    );
    this.lastRose = s.lastRose;
    this.great = s.great ? { ...s.great } : null;
    this.greats = s.greats;
    this.went = (s.went ?? []).map((w) => ({ ...w }));
  }
}

export function healthOf(world: World): HealthStore | null {
  return world.hasStore("health.sickness") ? world.store<HealthStore>("health.sickness") : null;
}

const RISE = defineStream("health.rise"),
  SPREAD = defineStream("health.spread"),
  TOLL = defineStream("health.toll"),
  NATURE = defineStream("health.nature"),
  WAKE = defineStream("health.wake"),
  FROM_STARS = defineStream("health.stars");

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));

function landHealth(store: HealthStore, cell: number): LandHealth {
  let l = store.lands.get(cell);
  if (!l)
    store.lands.set(cell, (l = { cell, immune: [], last: null, struck: 0, dead: 0, ward: null }));
  return l;
}

function setImmune(l: LandHealth, sickness: Ref, v: number): void {
  const i = l.immune.findIndex(([r]) => r === sickness);
  if (v < 0.01) {
    if (i >= 0) l.immune.splice(i, 1);
    return;
  }
  if (i >= 0) l.immune[i]![1] = v;
  else {
    l.immune.push([sickness, v]);
    l.immune.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  }
}

/** A land's hunger, 0 (fed all year) … 1 (starving), by its leanest month. */
function hungerOf(ctx: PopulationContext, cell: number): number {
  const p = ctx.provinces.get(cell);
  return p ? clamp(0, 1, (950 - p.leanest) / 950) : 0;
}

/** The share of a land's people its healers spare (herb-lore, medicine, drains), up to 0.6. */
function healedOf(world: World, cell: number): number {
  return Math.min(0.6, 2 * loreOf(world).effect(cell, "health"));
}

/** The words for a sickness's kind, by how it passes. */
const KINDS: Record<Route, readonly string[]> = {
  breath: ["sweats", "cough", "pox", "fever"],
  water: ["flux", "purging", "bloody flux", "cramps"],
  vermin: ["plague", "spotted fever", "ague", "black fever"],
  touch: ["pox", "wasting", "sores", "rot"],
};

/** The name of a land, by its greatest town (for a sickness named where it rose). */
function townOf(ctx: PopulationContext, cell: number): string {
  const towns = ctx.settlements
    .inProvince(cell)
    .sort((a, b) => b.population - a.population || a.founded - b.founded);
  return towns[0]?.name ?? "the wild";
}

/** A new sickness's nature, drawn by where it rose. */
function natureOf(
  world: World,
  index: number,
  source: Source,
): Pick<Sickness, "route" | "kind" | "reach" | "deadliness" | "lasting"> {
  const r = (k: number) => world.rng.real(NATURE, index, 0, k),
    routes: Record<Source, readonly [Route, number][]> = {
      herds: [
        ["breath", 0.55],
        ["touch", 0.3],
        ["water", 0.15],
      ],
      crowds: [
        ["breath", 0.45],
        ["water", 0.4],
        ["touch", 0.15],
      ],
      marsh: [
        ["vermin", 0.75],
        ["water", 0.25],
      ],
      "the god": [
        ["breath", 0.4],
        ["vermin", 0.3],
        ["water", 0.2],
        ["touch", 0.1],
      ],
      "the stars": [
        ["breath", 0.45],
        ["touch", 0.3],
        ["water", 0.15],
        ["vermin", 0.1],
      ],
    };
  let u = r(0),
    route: Route = routes[source][0]![0];
  for (const [x, w] of routes[source]) {
    if (u < w) {
      route = x;
      break;
    }
    u -= w;
  }
  const kinds = KINDS[route],
    // (Survivors spared it for life, or for some years. Most sicknesses are mild; a few of those
    // whose survivors are spared for life are terrible — one that spares them only for a while,
    // coming back on them again and again, kills few, or it would have killed off its hosts.)
    lifelong = (route === "breath" || route === "touch") && r(4) < 0.6,
    lasting = lifelong ? 60 : Math.round(3 + 12 * r(5)),
    dread = r(2),
    deadliness = lifelong ? 0.03 + 0.32 * dread * dread : 0.005 + 0.045 * dread * dread,
    reach = 0.25 + 0.5 * r(3);
  return { route, kind: kinds[Math.floor(r(1) * kinds.length)]!, reach, deadliness, lasting };
}

/**
 * A share of a land's people dead of a sickness: the small and the old the most (never those
 * the hand holds as themselves), written into the ledger of deaths. How many died.
 */
function sicken(ctx: PopulationContext, cell: number, share: number, t: SimTime): number {
  const p = ctx.provinces.get(cell);
  if (!p || share <= 0) return 0;
  const year = yearOfMoment(t),
    held = handOf(ctx.world).composition(cell, year, ctx.life),
    free = (r: number, o: number) => p.counts.get(r, o) - (held ? held[r * COLS + o]! : 0);
  // (The frailty of each band, weighed so that the land's mean is one.)
  let all = 0,
    weighed = 0;
  for (let r = 0; r < 2 * BANDS; r++)
    for (let o = 0; o < COLS; o++) {
      const n = free(r, o);
      all += n;
      weighed += n * FRAILTY[r % BANDS]!;
    }
  if (all <= 0) return 0;
  const scale = (share * all) / weighed;
  let dead = 0;
  for (let r = 0; r < 2 * BANDS; r++)
    for (let o = 0; o < COLS; o++) {
      const n = free(r, o);
      if (n <= 0) continue;
      const k = Math.min(
        n,
        roundKeyed(
          Math.min(0.95, scale * FRAILTY[r % BANDS]!) * n,
          ctx.world.rng.real(TOLL, cell, t, r, o),
        ),
      );
      if (k <= 0) continue;
      p.counts.add(r, o, -k);
      ctx.history.addDeaths(cell, year, r % BANDS, k);
      dead += k;
    }
  return dead;
}

/** What a coming of a sickness to a land does: how many die, and who of the rest are spared. */
export function tollOf(
  ctx: PopulationContext,
  s: Sickness,
  cell: number,
): { share: number; bound: number; immuneAfter: number } {
  const store = healthOf(ctx.world)!,
    imm = store.immune(cell, s.ref),
    takers = s.reach * (1 - imm),
    bound = orderOf(ctx.world)?.bound(cell) ?? 0,
    share = clamp(
      0,
      0.6,
      takers *
        s.deadliness *
        (1 + 0.8 * hungerOf(ctx, cell)) *
        (1 - healedOf(ctx.world, cell)) *
        (1 + (SICK.bound - 1) * bound),
    );
  // (The survivors who took it are spared it: the spared among the living after.)
  const immuneAfter = share >= 1 ? 1 : clamp(0, 1, (imm + takers - share) / (1 - share));
  return { share, bound, immuneAfter };
}

/** A sickness comes to a land: its dead, its spared, its grief; the event, already emitted. */
function strike(
  ctx: PopulationContext,
  s: Sickness,
  cell: number,
  t: SimTime,
  why: { causes: CauseRef[]; from: number | null; via: Via | null; strangers?: string },
): Outbreak | null {
  const { world } = ctx,
    store = healthOf(world)!,
    prov = ctx.provinces.get(cell);
  if (!prov || prov.total() <= 0) return null;
  const year = yearOfMoment(t),
    before = prov.total(),
    toll = tollOf(ctx, s, cell),
    // (What it will cost, reckoned before it is told, so the telling never changes after.)
    expected = Math.round(before * toll.share),
    share = before ? expected / before : 0,
    event = world.events.emit({
      type: HEALTH_EVENTS.outbreak.type,
      importance: share >= SICK.great ? 6 : share >= 0.05 ? 5 : share >= 0.01 ? 4 : 3,
      subjects: [s.ref],
      place: prov.ref,
      causes: why.causes,
      data: {
        sickness: s.name,
        from: why.from,
        via: why.via,
        people: before,
        dead: expected,
        bound: Math.round(toll.bound * 100),
        ...(why.strangers ? { strangers: why.strangers } : {}),
      },
    });
  const dead = sicken(ctx, cell, toll.share, t);
  // (The bound among the dead, by how much the more they die.)
  const order = orderOf(world);
  if (order && toll.bound > 0 && dead > 0) {
    const b = toll.bound,
      boundDead = Math.round((dead * SICK.bound * b) / (1 + (SICK.bound - 1) * b));
    boundGone(order, cell, Math.min(boundDead, dead), before);
  }
  const l = landHealth(store, cell),
    outbreak: Outbreak = {
      sickness: s.ref,
      year,
      event,
      dead,
      share,
      from: why.from,
      via: why.via,
    };
  setImmune(l, s.ref, toll.immuneAfter);
  l.last = outbreak;
  l.struck++;
  l.dead += dead;
  s.struck++;
  s.dead += dead;
  s.last = year;
  if (share >= SICK.great) {
    store.greats++;
    if (!store.great) store.great = { year, cell, event };
  }
  const decade = Math.floor((year - s.year) / 10);
  while (s.byDecade.length <= decade) s.byDecade.push(0);
  s.byDecade[decade]! += dead;
  // Its grief laid on the realm; its people turn to their gods, and — from a strange land —
  // from strangers.
  if (share >= 0.01) grieve(world, cell, Math.min(0.4, 1.5 * share), event);
  const ways = cultureOf(world).get(cell);
  if (ways && share >= 0.03) {
    pushWays(ways, { event, year, trait: WAY.piety, amount: Math.min(0.05, 0.4 * share) });
    const them = why.from !== null ? cultureOf(world).get(why.from) : undefined;
    if (them && 1 - tongueLikeness(ways.tongue, them.tongue) > 0.5)
      pushWays(ways, { event, year, trait: WAY.openness, amount: -Math.min(0.04, 0.3 * share) });
    // (Come down from the stars with strangers, they turn from strangers the more.)
    if (why.via === "stars")
      pushWays(ways, { event, year, trait: WAY.openness, amount: -Math.min(0.06, 0.5 * share) });
  }
  return outbreak;
}

/** What carries a sickness out of a land this year: each way to another land, by what carries it. */
export type Carrier = { from: number; to: number; via: Via; by: Ref | null };

/** The year's ways between lands: its trade roads (each by land or sea) and its fields of battle. */
type Ways = {
  roads: readonly { a: number; b: number; via: Via; opened: Ref }[];
  battles: readonly { sides: readonly Ref[]; land: number; event: Ref }[];
};

function waysOf(ctx: PopulationContext, year: number): Ways {
  const markets = marketsOf(ctx.world);
  return {
    roads: markets.allRoutes().map(([key, opened]) => {
      const [a, b] = key.split(":").map(Number) as [number, number];
      return { a, b, via: markets.bySea(a, b) ? ("sea" as const) : ("road" as const), opened };
    }),
    battles: warsOf(ctx.world)
      .all()
      .flatMap((w) =>
        w.battles
          .filter((b) => b.year === year || b.year === year - 1)
          .map((b) => ({ sides: [w.attacker, w.defender], land: b.land, event: b.event })),
      ),
  };
}

function carriersFrom(ctx: PopulationContext, burning: ReadonlySet<number>, ways: Ways): Carrier[] {
  const { world, generated: g } = ctx,
    out: Carrier[] = [],
    peopled = (c: number) => (ctx.provinces.get(c)?.total() ?? 0) > 0;
  // Next door.
  for (const c of [...burning].sort((a, b) => a - b)) {
    const l = healthOf(world)!.land(c)!;
    for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
      const n = g.grid.neighbours[k]!;
      if (peopled(n)) out.push({ from: c, to: n, via: "near", by: l.last!.event });
    }
  }
  // Down the trade roads, and over the sea.
  for (const { a, b, via, opened } of ways.roads) {
    if (burning.has(a) && peopled(b)) out.push({ from: a, to: b, via, by: opened });
    if (burning.has(b) && peopled(a)) out.push({ from: b, to: a, via, by: opened });
  }
  // With armies: from a realm's sick lands to where it fights, and from a sick field home.
  const realms = politiesOf(world);
  for (const battle of ways.battles)
    for (const side of battle.sides) {
      const r = realms.get(side);
      if (!r) continue;
      const sick = r.members.filter((c) => burning.has(c)).sort((a, b) => a - b)[0];
      if (sick !== undefined && sick !== battle.land && peopled(battle.land))
        out.push({ from: sick, to: battle.land, via: "army", by: battle.event });
      if (burning.has(battle.land) && r.ended === null && peopled(r.seat))
        out.push({ from: battle.land, to: r.seat, via: "army", by: battle.event });
    }
  return out;
}

/** How likely a carrier is to bring a sickness to a land, and why (the factors of its coming). */
export function spreadChance(
  ctx: PopulationContext,
  s: Sickness,
  c: Carrier,
): { chance: number; factors: Factor[] } {
  const { world, generated: g } = ctx,
    store = healthOf(world)!,
    imm = store.immune(c.to, s.ref),
    people = ctx.provinces.get(c.to)?.total() ?? 0,
    crowd = 0.6 + 0.4 * Math.min(1, people / 20000),
    hunger = hungerOf(ctx, c.to),
    drains = loreOf(world).get(c.to, "sanitation"),
    vaccines = loreOf(world).get(c.to, "vaccines"),
    apart = loreOf(world).get(c.to, "quarantine"),
    cold = g.climate.temperature[c.to]! < 8,
    routeBy =
      s.route === "water" && drains
        ? 0.4
        : s.route === "vermin" && cold
          ? 0.4
          : s.route === "touch"
            ? 0.8
            : 1,
    carry = SICK.carry[c.via],
    kept = apart && c.via !== "god" ? SICK.quarantine : 1,
    chance = carry * s.reach * (1 - imm) * crowd * (1 + 0.5 * hunger) * routeBy * kept;
  const famine = ctx.provinces.get(c.to)?.lastFamine ?? null,
    words: Record<Via, string> = {
      near: "carried from the land next door",
      road: "carried down a trade road",
      sea: "carried over the sea",
      army: "carried by an army",
      god: "loosed by the god",
      stars: "carried down from the stars",
    };
  const factors: Factor[] = [
    {
      name: words[c.via],
      value: carry,
      contribution: carry * s.reach,
      source: c.by ? { ref: c.by, role: c.via === "god" ? "agent" : "enabler", weight: 1 } : null,
    },
    {
      name: imm > 0 ? "few of them spared it" : "none of them ever had it",
      value: 1 - imm,
      contribution: s.reach * (1 - imm) - s.reach,
      // (Spared by vaccination, where they know it and the sickness is one spared for life.)
      source:
        vaccines && s.lasting >= 60 && imm > 0
          ? { ref: vaccines.event, role: "constraint", weight: 1 }
          : null,
    },
    ...(kept < 1
      ? [
          {
            name: "they keep the sick apart",
            value: kept,
            contribution: kept - 1,
            source: { ref: apart!.event, role: "constraint" as const, weight: 1 },
          },
        ]
      : []),
    { name: "how crowded they are", value: people, contribution: crowd - 1, source: null },
    ...(hunger > 0.05
      ? [
          {
            name: "hunger",
            value: hunger,
            contribution: 0.5 * hunger,
            source: famine ? { ref: famine, role: "pressure" as const, weight: 1 } : null,
          },
        ]
      : []),
    ...(routeBy < 1
      ? [
          {
            name:
              s.route === "water" && drains
                ? "drains and clean water"
                : s.route === "vermin"
                  ? "a cold land, where its vermin thrive the less"
                  : "it passes only by touch",
            value: routeBy,
            contribution: routeBy - 1,
            source:
              s.route === "water" && drains
                ? { ref: drains.event, role: "constraint" as const, weight: 1 }
                : null,
          },
        ]
      : []),
  ];
  return { chance: Math.min(1, chance), factors: factors.slice(0, 6) };
}

/** A sickness brought to a land by a carrier (or the god): its decision and its coming. */
function bring(
  ctx: PopulationContext,
  s: Sickness,
  c: Carrier,
  chance: number,
  factors: Factor[],
  t: SimTime,
  strangers?: string,
): Outbreak | null {
  const { world } = ctx,
    decision = world.decisions.record({
      rule: "health.spread",
      subject: s.ref,
      outcome: { land: cellRef(0, c.to), from: cellRef(0, c.from), via: c.via },
      score: chance,
      threshold: 0,
      factors,
    }),
    source = healthOf(world)!.land(c.from)?.last;
  return strike(ctx, s, c.to, t, {
    causes: [
      { ref: decision, role: "trigger", weight: 1 },
      ...(source && source.sickness === s.ref && source.event !== c.by
        ? [{ ref: source.event, role: "pressure" as const, weight: 1 }]
        : []),
    ],
    from: c.from === c.to ? null : c.from,
    via: c.via,
    ...(strangers ? { strangers } : {}),
  });
}

/**
 * A new sickness rises in a land: its nature drawn, its name given, its first coming. (Come down
 * from the stars, it is named for the strangers who brought it.)
 */
export function riseSickness(
  ctx: PopulationContext,
  cell: number,
  source: Source,
  factors: Factor[],
  t: SimTime,
  agent: Ref | null = null,
  stars: { civ: Ref; name: string; event: Ref } | null = null,
): Sickness {
  const { world } = ctx,
    store = healthOf(world)!,
    year = yearOfMoment(t),
    index = store.sicknesses.length,
    nature = natureOf(world, index, source),
    ref = world.minter.mint(SICKNESS),
    name = `the ${stars ? stars.name : townOf(ctx, cell)} ${nature.kind}`,
    decision = world.decisions.record({
      rule: "health.rise",
      subject: cellRef(0, cell),
      outcome: { sickness: name, source },
      score: factors.reduce((a, f) => a + f.contribution, 0),
      threshold: 0,
      factors: factors.slice(0, 6),
    }),
    event = world.events.emit({
      type: HEALTH_EVENTS.rose.type,
      subjects: stars ? [ref, stars.civ] : [ref],
      place: ctx.provinces.get(cell)?.ref ?? cellRef(0, cell),
      causes: [
        { ref: decision, role: "trigger", weight: 1 },
        ...(agent ? [{ ref: agent, role: "agent" as const, weight: 1 }] : []),
        ...(stars ? [{ ref: stars.event, role: "enabler" as const, weight: 1 }] : []),
      ],
      data: {
        sickness: name,
        source,
        route: nature.route,
        ...(stars ? { strangers: stars.name } : {}),
      },
    });
  const s: Sickness = {
    ref,
    name,
    ...nature,
    source,
    cell,
    year,
    event,
    people: stars?.civ ?? null,
    struck: 0,
    dead: 0,
    last: year,
    byDecade: [],
    ended: null,
  };
  store.sicknesses.push(s);
  // (One come down from the stars keeps no pace with those that rise here.)
  if (!stars) store.lastRose = year;
  strike(ctx, s, cell, t, {
    causes: [{ ref: event, role: "trigger", weight: 1 }],
    from: null,
    via: agent ? "god" : stars ? "stars" : null,
    ...(stars ? { strangers: stars.name } : {}),
  });
  return s;
}

/** Strangers come down in a land: to talk and trade, only to look, or in war. */
type Came = { civ: Ref; cell: number; event: Ref; how: "talked" | "looked" | "war" };

/**
 * Strangers from the stars who came down last year: a sickness of their world may come down with
 * them, one no one here was ever spared (or, theirs known here already, come again); and one of
 * ours about the land they came down in may go home with them — and they fear the home world the
 * more for it, the more as it kills.
 */
function fromTheStars(
  ctx: PopulationContext,
  store: HealthStore,
  struck: Set<number>,
  t: SimTime,
): void {
  const { world } = ctx,
    peoples = peoplesOf(world),
    year = yearOfMoment(t),
    home = ctx.generated.star.ref as Ref;
  if (!peoples) return;
  const came: Came[] = [
    ...peoples.landings
      .filter((l) => l.year === year - 1)
      .map((l): Came => ({
        civ: l.civ,
        cell: l.cell,
        event: l.event,
        how: l.omen ? "looked" : "talked",
      })),
    ...peoples.raids
      .filter((r) => r.year === year - 1 && r.cell >= 0 && r.star === home)
      .map((r): Came => ({ civ: r.civ, cell: r.cell, event: r.event, how: "war" })),
  ];
  if (!came.length) return;
  const civs = new Map(civilizationsNear(world).map((c) => [c.ref as string, c])),
    lore = loreOf(world);
  for (const [i, c] of came.entries()) {
    const civ = civs.get(c.civ),
      people = ctx.provinces.get(c.cell)?.total() ?? 0;
    if (!civ || people <= 0) continue;
    const strangers = peopleWords(world, civ).name,
      ours = store.land(c.cell)?.last ?? null;
    // Ours, gone home with them (each of ours once with each people).
    if (ours && year - ours.year <= 2) {
      const s = store.get(ours.sickness);
      if (
        s &&
        s.people !== c.civ &&
        !store.went.some((w) => w.civ === c.civ && w.sickness === s.ref) &&
        world.rng.real(FROM_STARS, c.cell, t, 2 * i + 1) < STAR_SICKNESS.home * s.reach
      )
        goHome(ctx, store, s, c, strangers, ours.event, year);
    }
    if (struck.has(c.cell)) continue;
    const theirs = store.sicknesses.find((s) => s.people === c.civ);
    if (theirs) {
      // Theirs, known here already, come down again with them.
      const carrier: Carrier = { from: c.cell, to: c.cell, via: "stars", by: c.event },
        { chance, factors } = spreadChance(ctx, theirs, carrier);
      if (world.rng.real(FROM_STARS, c.cell, t, 2 * i) >= chance) continue;
      if (theirs.ended !== null) theirs.ended = null;
      if (bring(ctx, theirs, carrier, chance, factors, t, strangers)) struck.add(c.cell);
      continue;
    }
    // A sickness of their world, come down with them: one no one here was ever spared.
    const apart = lore.get(c.cell, "quarantine"),
      base = STAR_SICKNESS[c.how],
      chance = base * (apart ? SICK.quarantine : 1);
    if (world.rng.real(FROM_STARS, c.cell, t, 2 * i) >= chance) continue;
    riseSickness(
      ctx,
      c.cell,
      "the stars",
      [
        {
          name:
            c.how === "talked"
              ? "strangers from the stars came down to talk and trade"
              : c.how === "looked"
                ? "strangers from the stars came down, looked, and went"
                : "strangers from the stars came down in war",
          value: base,
          contribution: base,
          source: { ref: c.event, role: "trigger", weight: 1 },
        },
        {
          name: "a sickness of another world, that no one here was ever spared",
          value: 1,
          contribution: 0,
          source: null,
        },
        ...(apart
          ? [
              {
                name: "they keep the sick apart",
                value: SICK.quarantine,
                contribution: chance - base,
                source: { ref: apart.event, role: "constraint" as const, weight: 1 },
              },
            ]
          : []),
        { name: "many people where they came down", value: people, contribution: 0, source: null },
      ],
      t,
      null,
      { civ: c.civ, name: strangers, event: c.event },
    );
    struck.add(c.cell);
  }
}

/** A sickness of ours gone home to the stars with strangers: told, and their regard for us soured. */
function goHome(
  ctx: PopulationContext,
  store: HealthStore,
  s: Sickness,
  c: Came,
  strangers: string,
  ours: Ref,
  year: number,
): void {
  const { world } = ctx,
    home = ctx.generated.star.ref as Ref,
    fear = STAR_SICKNESS.fear * Math.min(1, s.deadliness / 0.1),
    event = world.events.emit({
      type: HEALTH_EVENTS.went.type,
      subjects: [s.ref, c.civ],
      place: ctx.provinces.get(c.cell)?.ref ?? cellRef(0, c.cell),
      causes: [
        { ref: c.event, role: "trigger", weight: 1 },
        { ref: ours, role: "pressure", weight: 1 },
      ],
      data: { sickness: s.name, strangers, fear: Math.round(fear * 100) },
    });
  store.went.push({ sickness: s.ref, civ: c.civ, cell: c.cell, year, event });
  // (In every meeting of theirs with the home world, they fear it the more.)
  for (const m of peoplesOf(world)!.meetings)
    if (m.civ === c.civ && m.star === home) m.regard = Math.max(-1, m.regard - fear);
}

/** The yearly work of sickness: the spared forget, it spreads, sleeps and wakes, and new ones rise. */
export function healthYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    store = healthOf(world)!,
    year = yearOfMoment(t),
    living = store.living();
  // 1. The spared forget, as their children are born never having had it — but where they know
  // vaccination, the young are given the sicknesses the spared are spared for life.
  for (const l of [...store.lands.values()].sort((a, b) => a.cell - b.cell)) {
    for (const [ref, v] of [...l.immune]) {
      const s = store.get(ref);
      setImmune(l, ref, s ? v * (1 - 1 / s.lasting) * 0.975 : 0);
    }
  }
  const lore = loreOf(world),
    lifelong = living.filter((s) => s.lasting >= 60);
  if (lifelong.length)
    for (const p of ctx.provinces.all()) {
      if (!p.total() || !lore.get(p.cell, "vaccines")) continue;
      const l = landHealth(store, p.cell);
      for (const s of lifelong) {
        const v = store.immune(p.cell, s.ref);
        if (v < SICK.vaccinated) setImmune(l, s.ref, v + SICK.vaccinating * (SICK.vaccinated - v));
      }
    }
  // 2. It spreads: from every land it came to last year, by what carries it, one coming a land.
  const burning = new Map<Ref, Set<number>>();
  for (const l of store.lands.values())
    if (l.last && l.last.year === year - 1) {
      const set = burning.get(l.last.sickness) ?? new Set<number>();
      set.add(l.cell);
      burning.set(l.last.sickness, set);
    }
  const struck = new Set<number>(),
    ways = burning.size ? waysOf(ctx, year) : null;
  for (const s of living) {
    const from = burning.get(s.ref);
    if (!from || !ways) continue;
    // (Each land reached once: by the carrier likeliest to bring it, in a fixed order.)
    const best = new Map<number, { c: Carrier; chance: number; factors: Factor[] }>();
    for (const c of carriersFrom(ctx, from, ways)) {
      if (from.has(c.to) || struck.has(c.to)) continue;
      const last = store.land(c.to)?.last;
      if (last && last.sickness === s.ref && year - last.year < 3) continue;
      const weighed = spreadChance(ctx, s, c),
        was = best.get(c.to);
      if (!was || weighed.chance > was.chance + 1e-12) best.set(c.to, { c, ...weighed });
    }
    const index = store.sicknesses.indexOf(s);
    for (const [cell, b] of [...best].sort((x, y) => x[0] - y[0])) {
      if (struck.has(cell)) continue;
      if (world.rng.real(SPREAD, cell, t, index) >= b.chance) continue;
      if (bring(ctx, s, b.c, b.chance, b.factors, t)) struck.add(cell);
    }
  }
  // 3. Sleeping and waking: a sickness unseen a while wakes now and then where it rose; unseen
  // long, it is gone.
  for (const s of living) {
    const unseen = year - s.last;
    if (unseen >= SICK.gone) {
      s.ended = year;
      continue;
    }
    if (unseen < SICK.sleeps || struck.has(s.cell)) continue;
    const imm = store.immune(s.cell, s.ref),
      chance = SICK.wake * (1 - imm),
      index = store.sicknesses.indexOf(s);
    if (!((ctx.provinces.get(s.cell)?.total() ?? 0) > 0)) continue;
    if (world.rng.real(WAKE, s.cell, t, index) >= chance) continue;
    const decision = world.decisions.record({
      rule: "health.wake",
      subject: s.ref,
      outcome: { land: cellRef(0, s.cell) },
      score: chance,
      threshold: 0,
      factors: [
        {
          name: "it slept where it rose",
          value: unseen,
          contribution: SICK.wake,
          source: { ref: s.event, role: "enabler", weight: 1 },
        },
        {
          name: "a generation that never had it",
          value: 1 - imm,
          contribution: chance - SICK.wake,
          source: null,
        },
      ],
    });
    if (
      strike(ctx, s, s.cell, t, {
        causes: [
          { ref: decision, role: "trigger", weight: 1 },
          { ref: s.event, role: "enabler", weight: 1 },
        ],
        from: null,
        via: null,
      })
    )
      struck.add(s.cell);
  }
  // 4. Strangers from the stars, come down last year: a sickness of theirs may come with them, and
  // one of ours go home with them.
  fromTheStars(ctx, store, struck, t);
  // 5. A new sickness rises where life crowds: among herds, in great towns, in hot marshes.
  if (
    (store.lastRose !== null && year - store.lastRose < SICK.gap) ||
    store.living().length >= SICK.most
  )
    return;
  const weights: { cell: number; source: Source; w: number; parts: [number, number, number] }[] =
    [];
  let total = 0;
  for (const p of ctx.provinces.all()) {
    const people = p.total();
    if (people < 1500 || offworldSite(g, p.cell) || struck.has(p.cell)) continue;
    const town = Math.max(0, ...ctx.settlements.inProvince(p.cell).map((v) => v.population)),
      herds = p.herding ? SICK.rise.herds * Math.min(3, people / 5000) : 0,
      crowds = town >= 6000 ? SICK.rise.crowds * Math.min(3, town / 12000) : 0,
      marsh =
        g.climate.temperature[p.cell]! >= 22 && g.climate.precipitation[p.cell]! >= 1600
          ? SICK.rise.marsh * Math.min(2, people / 4000)
          : 0,
      w = herds + crowds + marsh;
    if (w <= 0) continue;
    const source: Source =
      herds >= crowds && herds >= marsh ? "herds" : crowds >= marsh ? "crowds" : "marsh";
    weights.push({ cell: p.cell, source, w, parts: [herds, crowds, marsh] });
    total += w;
  }
  if (!weights.length || world.rng.real(RISE, 0, t, 0) >= total) return;
  let pick = world.rng.real(RISE, 0, t, 1) * total,
    chosen = weights[weights.length - 1]!;
  for (const x of weights) {
    if (pick < x.w) {
      chosen = x;
      break;
    }
    pick -= x.w;
  }
  const p = ctx.provinces.get(chosen.cell)!,
    [herds, crowds, marsh] = chosen.parts,
    biggest = ctx.settlements
      .inProvince(chosen.cell)
      .sort((a, b) => b.population - a.population || a.founded - b.founded)[0];
  riseSickness(
    ctx,
    chosen.cell,
    chosen.source,
    [
      ...(herds > 0
        ? [
            {
              name: "herds kept close",
              value: herds,
              contribution: herds,
              source: p.herding ? { ref: p.herding, role: "enabler" as const, weight: 1 } : null,
            },
          ]
        : []),
      ...(crowds > 0
        ? [
            {
              name: "a great town crowded",
              value: biggest?.population ?? 0,
              contribution: crowds,
              source: biggest ? { ref: biggest.event, role: "enabler" as const, weight: 1 } : null,
            },
          ]
        : []),
      ...(marsh > 0
        ? [
            {
              name: "hot, wet land",
              value: g.climate.precipitation[chosen.cell]!,
              contribution: marsh,
              source: { ref: cellRef(0, chosen.cell), role: "enabler" as const, weight: 1 },
            },
          ]
        : []),
      {
        name: "many people",
        value: p.total(),
        contribution: 0,
        source: p.arrival ? { ref: p.arrival, role: "enabler", weight: 1 } : null,
      },
    ],
    t,
  );
}

/** Teach a peopled world sickness. */
export function installHealth(world: World, ctx: () => PopulationContext): HealthStore {
  const store = world.register(new HealthStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "188.health.year", every: YEAR, run: (t) => healthYear(ctx(), t) });
  return store;
}

/** A sickness's last coming to a land, if it struck within so many years. */
export function lastComing(
  world: World,
  cell: number,
  years: number,
  now: number,
): Outbreak | null {
  const l = healthOf(world)?.land(cell)?.last;
  return l && now - l.year < years ? l : null;
}

/** The god's hand on sickness (each a logged command, cited by what follows). */
export const HEALTH_ACTS = {
  ward: defineEventType("act.ward", 5),
  loose: defineEventType("act.loose", 6),
};

/** Teach a peopled world the god's hand on sickness: a land warded, a sickness loosed. */
export function installHealthActs(world: World, ctx: () => PopulationContext): void {
  const land = (args: unknown): string | null => {
    const cell = (args as { cell?: unknown } | null)?.cell;
    if (!Number.isInteger(cell)) return "a land is wanted";
    const c = ctx();
    return (c.provinces.get(cell as number)?.total() ?? 0) > 0 ? null : "no one lives there";
  };
  // A land warded: its people spared every sickness there is, until they forget.
  world.defineCommand({
    type: "act.ward",
    validate: (args) => {
      if (!healthOf(world)) return "this world knows no sickness";
      return land(args);
    },
    apply: (command, t) => {
      const c = ctx(),
        cell = (command.args as { cell: number }).cell,
        store = healthOf(world)!,
        event = world.events.emit({
          type: HEALTH_ACTS.ward.type,
          place: c.provinces.get(cell)?.ref ?? cellRef(0, cell),
          causes: [{ ref: command.id, role: "agent", weight: 1 }],
          data: { sicknesses: store.living().length },
        }),
        l = landHealth(store, cell);
      for (const s of store.living()) setImmune(l, s.ref, 1);
      l.ward = { year: yearOfMoment(t), event };
    },
  });
  // A sickness loosed on a land (or a new one made there, if none is named).
  world.defineCommand({
    type: "act.loose",
    validate: (args) => {
      const store = healthOf(world);
      if (!store) return "this world knows no sickness";
      const a = args as { sickness?: unknown } | null,
        named = a?.sickness;
      if (named !== undefined && named !== null && !store.get(String(named)))
        return "no such sickness";
      return land(args);
    },
    apply: (command, t) => {
      const c = ctx(),
        store = healthOf(world)!,
        { cell, sickness } = command.args as { cell: number; sickness?: string | null },
        named = sickness ? store.get(sickness) : undefined;
      if (!named) {
        riseSickness(
          c,
          cell,
          "the god",
          [
            {
              name: "the god's hand",
              value: 1,
              contribution: 1,
              source: { ref: command.id, role: "agent", weight: 1 },
            },
          ],
          t,
          command.id,
        );
        return;
      }
      if (named.ended !== null) named.ended = null;
      const carrier: Carrier = { from: cell, to: cell, via: "god", by: command.id },
        { chance, factors } = spreadChance(c, named, carrier);
      bring(c, named, carrier, chance, factors, t);
    },
  });
}
