// Bonds and freedoms (Phase 19 M137, asked for 2026-10-23: "slavery and forced labour —
// chattel, debt bondage, serfdom, indenture, corvée, prison labour … resistance, revolts,
// abolition … legitimacy, state capacity, corruption … class and caste … political memory").
// No realm is made to hold the bound: each kind of bondage comes of what happened and of what
// a people are. Captives are carried off from a land just taken, where the victors keep to
// rank, are closed to strangers and the taken speak another tongue or keep another faith. The
// hungry sell themselves for grain where the few hold it and kin do not feed kin, and work it
// off in good years. Farmers are bound to the land where rank is steep, trade thin and war
// near; a great dying, making hands scarce, loosens them. Those who come hungry from afar are
// bound for their passage, for seven years. A seat that rules by decree sends its condemned to
// labour; one that builds calls its people to its works. The bound chafe, flee to free lands
// and rise — winning their freedom and a realm of their own, or crushed and remembered.
// A realm's standing with its people (its legitimacy) comes of its age and its faith, its
// reach (its capacity), what is skimmed from it (its corruption), its famines, its wars and
// its massacres; its order hardens into rank (its caste). Movements rise among its people —
// to free the bound, to give the land to those who till it, to give the many a voice — and
// push its ways; where the movement to free the bound outweighs the court and those whose
// wealth rests on the bound, the realm outlaws bondage (all but the labour of the condemned).
// Every step is a decision whose factors cite what drove it.
import {
  YEAR,
  defineEventType,
  defineStream,
  drawWithoutReplacement,
  parseRef,
  yearOfMoment,
  type CauseRef,
  type Factor,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type Stream,
  type World,
} from "../../kernel/index.ts";
import { cellRef, tongueLikeness } from "../../gen/index.ts";
import { G, OCC } from "../../rules/index.ts";
import { COLS, ROWS } from "../population/model.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { WAY, cultureOf, pushWays, type Ways } from "../culture/culture.ts";
import { beliefOf } from "../belief/belief.ts";
import { loreOf } from "../lore/lore.ts";
import {
  GENERAL,
  cutOff,
  politiesOf,
  raiseRealm,
  realmName,
  type Polity,
} from "../polity/polity.ts";
import { interestsOf } from "../polity/interests.ts";
import { warsOf } from "../war/war.ts";
import { grieve, strike } from "../acts/disasters.ts";
import { handOf } from "../hand/hand.ts";
import { LAW_OF, firstLaws, lawGrievance, weighLaws } from "./laws.ts";
import { CREDIT, creditOf, debtBurden } from "../credit/credit.ts";
import { seizedFactor } from "../strife/strife.ts";

/** The kinds of bondage a people may be held in (corvée, a levy on the free, is the realm's). */
export const BONDS = ["chattel", "debt", "serf", "indenture", "convict"] as const;
export type Bond = (typeof BONDS)[number];
export const BOND: Readonly<Record<Bond, number>> = Object.fromEntries(
  BONDS.map((b, i) => [b, i]),
) as Record<Bond, number>;

export const ORDER_EVENTS = {
  captives: defineEventType("order.captives", 5),
  bondage: defineEventType("order.bondage", 4),
  serfdom: defineEventType("order.serfdom", 5),
  indenture: defineEventType("order.indenture", 3),
  convicts: defineEventType("order.convicts", 3),
  corvee: defineEventType("order.corvee", 3),
  flight: defineEventType("order.flight", 2),
  revolt: defineEventType("order.revolt", 6),
  crushed: defineEventType("order.crushed", 5),
  freed: defineEventType("order.freed", 7),
  movement: defineEventType("order.movement", 4),
  abolished: defineEventType("order.abolished", 7),
  crisis: defineEventType("order.crisis", 5),
};

const CAPTIVES = defineStream("order.captives");
const FLIGHT = defineStream("order.flight");
const RISING = defineStream("order.rising");

/** How hard a victor must be (its score) to carry off the taken; how many, at most. */
export const CAPTIVE_LINE = 0.45;
export const CAPTIVE_SHARE = 0.06;
export const MOST_CAPTIVES = 3000;
/** Debt bondage: the line, the most of a land it holds, how fast it is worked off in a good year. */
export const DEBT_LINE = 0.3;
export const DEBT_MOST = 0.35;
export const DEBT_WORKED_OFF = 0.08;
/** Serfdom: how fast farmers are bound toward their realm's measure a year, and loosed. */
export const SERF_BIND = 0.03;
export const SERF_LOOSE = 0.02;
/** Indenture runs this many years. */
export const INDENTURE_YEARS = 7;
/** A land rises when this share of its people or more are bound and its chance comes. */
export const RISING_SHARE = 0.12;
export const COWED_YEARS = 25;
/** What a realm remembers fades by this much a year (a lifetime or two). */
export const MEMORY_KEPT = 0.985;
/** Below this standing a realm is in crisis; above the second, out of it. */
export const CRISIS = 0.3;
export const RESTORED = 0.45;
/** A realm weighs freeing its bound once in this many years, once its movement is this strong; the line. */
export const ABOLITION_EVERY = 5;
export const ABOLITION_MOVEMENT = 0.35;
export const ABOLITION_LINE = 0.15;
/** A movement forms when what moves it reaches this; it grows toward it by this share a year. */
export const MOVEMENT_LINE = 0.3;
export const MOVEMENT_GROWS = 0.06;
/** How far a sign from the god moves a realm's standing at first, and the years it fades over. */
export const MANDATE_PUSH = 0.25;
export const MANDATE_YEARS = 40;

/** What of a land's people are held in bondage, and what bound the most of them. */
export type LandBonds = {
  readonly cell: number;
  /** The share of its people held in each kind of bondage (by BONDS). */
  shares: number[];
  cause: Ref | null;
  /** After a rising crushed, its bound are cowed: none rises there again before this year. */
  quiet?: number;
};

/** A movement among a realm's people: to free the bound, the land to those who till it, a voice. */
export type Movement = {
  readonly cause: "abolition" | "land" | "voice";
  strength: number;
  readonly since: number;
  readonly event: Ref;
};

/** What a realm remembers: a rising, a massacre, captives taken from it, a freedom won. */
export type Memory = {
  readonly what: "rising" | "massacre" | "captivity" | "freedom" | "abolition";
  readonly year: number;
  readonly cell: number;
  readonly event: Ref;
  weight: number;
};

/** A realm's order: its standing with its people, its rank, its levies, its law of bondage. */
export type RealmOrder = {
  readonly realm: Ref;
  /** How far its people hold its rule rightful (0 … 1). */
  legitimacy: number;
  /** What is skimmed between the lands and the seat (0 … 1). */
  corruption: number;
  /** How hard its rank has set: born to a station, kept in it (0 … 1). */
  caste: number;
  /** The share of its free people's days owed to the seat's works. */
  corvee: number;
  /** The year its law outlawed bondage, and the event; null while its law allows it. */
  abolished: number | null;
  abolition: Ref | null;
  /** Its crisis of standing, while it lasts. */
  crisis: Ref | null;
  /** When it first held each kind of bondage (by BONDS), and first levied labour: the events. */
  firsts: (Ref | null)[];
  corveeEvent: Ref | null;
  movements: Movement[];
  memory: Memory[];
  /** A sign from the god for its rule (1) or against it (-1), fading (M138); absent if none. */
  mandate?: { readonly sign: 1 | -1; readonly year: number; readonly event: Ref };
  /** Its laws (by LAWS: land, strangers, faith, justice), each a position 0 … 2, and the event of each's last change (M139). */
  laws: number[];
  lawEvents: (Ref | null)[];
  /** How far its laws are what its powerful want (-1 … 1), as last weighed. */
  approval: number;
};

export class OrderStore implements StateStore {
  readonly name = "order.bonds";
  realms = new Map<string, RealmOrder>();
  lands = new Map<number, LandBonds>();

  of(realm: Ref): RealmOrder | undefined {
    return this.realms.get(realm);
  }
  land(cell: number): LandBonds | undefined {
    return this.lands.get(cell);
  }
  /** The share of a land's people held in any bondage. */
  bound(cell: number): number {
    const l = this.lands.get(cell);
    return l ? l.shares.reduce((a, b) => a + b, 0) : 0;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const l of this.lands.values()) if (l.cause) out.push(l.cause);
    for (const o of this.realms.values()) {
      if (o.abolition) out.push(o.abolition);
      if (o.crisis) out.push(o.crisis);
      if (o.corveeEvent) out.push(o.corveeEvent);
      if (o.mandate) out.push(o.mandate.event);
      for (const f of o.firsts) if (f) out.push(f);
      for (const e of o.lawEvents) if (e) out.push(e);
      for (const m of o.movements) out.push(m.event);
      for (const m of o.memory) out.push(m.event);
    }
    return out;
  }
  save(): unknown {
    return {
      realms: [...this.realms.values()].sort((a, b) => (a.realm < b.realm ? -1 : 1)),
      lands: [...this.lands.values()].sort((a, b) => a.cell - b.cell),
    };
  }
  hashInto(h: Hasher): void {
    h.value(this.save());
  }
  load(state: unknown): void {
    const s = state as { realms: RealmOrder[]; lands: LandBonds[] };
    this.realms = new Map(
      s.realms.map((o) => [
        o.realm,
        {
          ...o,
          firsts: [...o.firsts],
          laws: [...o.laws],
          lawEvents: [...o.lawEvents],
          movements: o.movements.map((m) => ({ ...m })),
          memory: o.memory.map((m) => ({ ...m })),
        },
      ]),
    );
    this.lands = new Map(s.lands.map((l) => [l.cell, { ...l, shares: [...l.shares] }]));
  }
}

export function orderOf(world: World): OrderStore | null {
  return world.hasStore("order.bonds") ? world.store<OrderStore>("order.bonds") : null;
}

const clamp = (lo: number, hi: number, x: number) => Math.max(lo, Math.min(hi, x));
const keyOf = (ref: Ref) => parseRef(ref).b >>> 0;
const trait = (w: Ways | undefined, k: number) => w?.traits[k] ?? 0.5;
/** The strongest push behind a people's way, as a factor's source. */
const nudged = (w: Ways | undefined, k: number): CauseRef | null => {
  const n = w?.nudges.find((x) => x.trait === k);
  return n ? { ref: n.event, role: "pressure", weight: 1 } : null;
};

export function landOf(store: OrderStore, cell: number): LandBonds {
  let l = store.lands.get(cell);
  if (!l) store.lands.set(cell, (l = { cell, shares: BONDS.map(() => 0), cause: null }));
  return l;
}

/** A realm's order, begun with its rule rightful enough and nothing skimmed yet. */
export function realmOrder(
  store: OrderStore,
  p: Polity,
  ways: Ways | undefined,
  faith = false,
): RealmOrder {
  let o = store.realms.get(p.ref);
  if (!o)
    store.realms.set(
      p.ref,
      (o = {
        realm: p.ref,
        legitimacy: 0.6,
        corruption: 0.02,
        caste: clamp(0, 1, 0.45 * trait(ways, WAY.hierarchy) + 0.25 * trait(ways, WAY.tradition)),
        corvee: 0,
        abolished: null,
        abolition: null,
        crisis: null,
        firsts: BONDS.map(() => null),
        corveeEvent: null,
        movements: [],
        memory: [],
        laws: firstLaws(p, ways, faith),
        lawEvents: [null, null, null, null],
        approval: 0,
      }),
    );
  return o;
}

/** The mean share of a realm's people held in bondage (of a kind, or of all), by its lands' people. */
export function boundShare(ctx: PopulationContext, p: Polity, bond: number | null = null): number {
  const store = orderOf(ctx.world);
  if (!store) return 0;
  let held = 0,
    all = 0;
  for (const c of p.members) {
    const n = ctx.provinces.get(c)?.total() ?? 0,
      l = store.lands.get(c);
    all += n;
    if (l) held += n * (bond === null ? l.shares.reduce((a, b) => a + b, 0) : l.shares[bond]!);
  }
  return all ? held / all : 0;
}

/** How many of a land's people are held, and in what. */
export function boundIn(
  ctx: PopulationContext,
  cell: number,
): { people: number; bonds: Record<Bond, number> } {
  const l = orderOf(ctx.world)?.lands.get(cell),
    n = ctx.provinces.get(cell)?.total() ?? 0,
    bonds = Object.fromEntries(
      BONDS.map((b, i) => [b, Math.round(n * (l?.shares[i] ?? 0))]),
    ) as Record<Bond, number>;
  return { people: BONDS.reduce((s, b) => s + bonds[b], 0), bonds };
}

/**
 * How far a realm's seat can make its will felt across its lands (0 … 1): writing, the reach
 * its roads and clerks give, its size (the more lands, the thinner), its age.
 */
export function capacityOf(ctx: PopulationContext, p: Polity): { value: number; parts: Factor[] } {
  const lore = loreOf(ctx.world),
    year = yearOfMoment(ctx.world.now),
    writing = lore.effect(p.seat, "writing") > 0 ? 1 : 0,
    reach = Math.min(1, lore.effect(p.seat, "reach") / 2),
    small = 1 / (1 + p.members.length / 10),
    old = Math.min(1, Math.max(0, year - p.founded) / 150),
    parts: Factor[] = [
      { name: "writing at its seat", value: writing, contribution: 0.3 * writing, source: null },
      { name: "roads and clerks", value: reach, contribution: 0.2 * reach, source: null },
      { name: "few lands to hold", value: small, contribution: 0.25 * small, source: null },
      { name: "an old seat", value: old, contribution: 0.1 * old, source: p.event },
    ].map((f) => ({
      ...f,
      source: f.source ? { ref: f.source, role: "enabler" as const, weight: 1 } : null,
    }));
  return {
    value: clamp(0.05, 0.95, 0.15 + parts.reduce((s, f) => s + f.contribution, 0)),
    parts,
  };
}

/**
 * What holds a realm's rule rightful in its people's eyes, or loosens it, now: each a factor
 * whose contribution is its pull on the standing (around a middle of 0.55).
 */
export function legitimacyFactors(ctx: PopulationContext, p: Polity): Factor[] {
  const { world } = ctx,
    realms = politiesOf(world),
    store = orderOf(world),
    o = store?.realms.get(p.ref),
    culture = cultureOf(world),
    seat = culture.get(p.seat),
    t = world.now,
    year = yearOfMoment(t),
    faiths = beliefOf(world),
    faith = faiths.of(p.seat).faith;
  let people = 0,
    believers = 0,
    hungry = 0,
    grievance = 0,
    lastFamine: Ref | null = null;
  for (const c of p.members) {
    const prov = ctx.provinces.get(c),
      n = prov?.total() ?? 0;
    people += n;
    if (faith && faiths.of(c).faith === faith) believers += n;
    const f = prov?.lastFamine ? world.events.get(prov.lastFamine) : undefined;
    if (f && t - f.t <= 2 * YEAR) {
      hungry += n;
      lastFamine = prov!.lastFamine;
    }
    grievance += n * Math.min(1, realms.discontent(c).level);
  }
  const all = Math.max(1, people),
    age = Math.min(1, Math.max(0, year - p.founded) / 120) * (0.5 + trait(seat, WAY.tradition)),
    shared = faith ? believers / all : 0,
    famished = (hungry / all) * (0.5 + 2 * p.tribute),
    cap = capacityOf(ctx, p).value;
  let won = 0,
    lost = 0;
  for (const w of warsOf(world).all()) {
    const side = w.attacker === p.ref ? 0 : w.defender === p.ref ? 1 : -1;
    if (side < 0) continue;
    for (const b of w.battles) if (b.year >= year - 5) b.won === (side === 0) ? won++ : lost++;
  }
  const fought = Math.max(1, won + lost),
    massacres = Math.min(
      1,
      (o?.memory ?? []).filter((m) => m.what === "massacre").reduce((s, m) => s + m.weight, 0),
    ),
    massacre = (o?.memory ?? []).find((m) => m.what === "massacre"),
    bound = boundShare(ctx, p) * trait(seat, WAY.openness),
    faithless = creditOf(world)?.faithless(p.ref, year) ?? null,
    seized = seizedFactor(world, p);
  return [
    {
      name: "an old rule, kept by custom",
      value: age,
      contribution: 0.15 * age,
      source: { ref: p.event, role: "enabler", weight: 1 },
    },
    {
      name: "a faith shared with the seat",
      value: shared,
      contribution: 0.12 * shared,
      source: null,
    },
    {
      name: "a seat that reaches its lands",
      value: cap,
      contribution: 0.12 * cap - 0.06,
      source: null,
    },
    {
      name: "grain taken in hungry years",
      value: famished,
      contribution: -0.3 * Math.min(1, famished),
      source: lastFamine ? { ref: lastFamine, role: "pressure", weight: 1 } : null,
    },
    {
      name: "what is skimmed",
      value: o?.corruption ?? 0,
      contribution: -0.25 * (o?.corruption ?? 0),
      source: null,
    },
    {
      name: "battles won and lost",
      value: (won - lost) / fought,
      contribution: (0.08 * won - 0.12 * lost) / fought,
      source: null,
    },
    {
      name: "its lands' grievance",
      value: grievance / all,
      contribution: -0.25 * (grievance / all),
      source: null,
    },
    {
      name: "massacres remembered",
      value: massacres,
      contribution: -0.15 * massacres,
      source: massacre ? { ref: massacre.event, role: "pressure", weight: 1 } : null,
    },
    {
      name: "the bound, among a people open to strangers",
      value: bound,
      contribution: -0.3 * bound,
      source: null,
    },
    // (Faith broken with its lenders: a debt repudiated these twenty years — M144.)
    ...(faithless
      ? [
          {
            name: "debts repudiated",
            value: 1,
            contribution: -0.1,
            source: { ref: faithless.event, role: "pressure" as const, weight: 1 },
          },
        ]
      : []),
    // (A rule seized by the sword, while remembered — M145.)
    ...(seized ? [seized] : []),
    // (Its laws: how far they are what its powerful want, and its justice — M139.)
    {
      name: "laws its powerful want",
      value: o?.approval ?? 0,
      contribution: 0.12 * (o?.approval ?? 0),
      source: o?.lawEvents.find((e) => e)
        ? { ref: o.lawEvents.find((e) => e)!, role: "enabler" as const, weight: 1 }
        : null,
    },
    {
      name: "its justice",
      value: o?.laws[LAW_OF.justice] ?? 1,
      contribution: [-0.02, 0, 0.05][o?.laws[LAW_OF.justice] ?? 1]!,
      source: o?.lawEvents[LAW_OF.justice]
        ? { ref: o.lawEvents[LAW_OF.justice]!, role: "enabler" as const, weight: 1 }
        : null,
    },
    // (The god's sign for or against its rule, fading: M138.)
    ...(() => {
      const m = o?.mandate,
        fade = m ? Math.max(0, 1 - (year - m.year) / MANDATE_YEARS) : 0;
      return m && fade > 0
        ? [
            {
              name: `a sign from the heavens ${m.sign > 0 ? "for" : "against"} its rule`,
              value: fade,
              contribution: m.sign * MANDATE_PUSH * fade,
              source: { ref: m.event, role: "agent" as const, weight: 1 },
            },
          ]
        : [];
    })(),
  ];
}

/** Draw `count` people from a land, in proportion to every sex, age and occupation (those under the hand stay). */
function draw(
  ctx: PopulationContext,
  from: number,
  count: number,
  stream: Stream,
  key: number,
  t: SimTime,
): { moved: number[]; n: number } | null {
  const prov = ctx.provinces.get(from);
  if (!prov || count <= 0) return null;
  const held = handOf(ctx.world).composition(from, yearOfMoment(t), ctx.life),
    pools = new Array<number>(ROWS * COLS);
  for (let r = 0; r < ROWS; r++)
    for (let o = 0; o < COLS; o++)
      pools[r * COLS + o] = prov.counts.get(r, o) - (held ? held[r * COLS + o]! : 0);
  const free = pools.reduce((a, b) => a + b, 0),
    n = Math.min(count, free);
  if (n <= 0) return null;
  const moved = drawWithoutReplacement(n, pools, (i) => ctx.world.rng.real(stream, key, t, 1, i));
  return { moved, n };
}

/** Make a move drawn: out of one land, into another, and into its history as a move. */
function carry(
  ctx: PopulationContext,
  from: number,
  to: number,
  moved: readonly number[],
  n: number,
  decision: Ref,
  event: Ref,
  t: SimTime,
): void {
  const src = ctx.provinces.get(from)!,
    dest = ctx.provinces.get(to)!,
    byOccupation = new Array<number>(COLS).fill(0);
  moved.forEach((m, i) => {
    if (!m) return;
    const r = Math.floor(i / COLS),
      o = i % COLS;
    src.counts.add(r, o, -m);
    dest.counts.add(r, o, m);
    byOccupation[o] = byOccupation[o]! + m;
  });
  ctx.history.addFlow({ from, to, year: yearOfMoment(t), count: n, byOccupation, decision, event });
}

/** Bind `count` newcomers to a land of `before` people in a kind of bondage. */
function bindNew(
  store: OrderStore,
  cell: number,
  bond: number,
  count: number,
  before: number,
): void {
  const l = landOf(store, cell),
    total = Math.max(1, before + count);
  for (let k = 0; k < BONDS.length; k++)
    l.shares[k] = (l.shares[k]! * before + (k === bond ? count : 0)) / total;
}

/** `count` of a land's bound gone from it (fled, fallen, dead of sickness): every kind in its measure. */
export function boundGone(store: OrderStore, cell: number, count: number, before: number): void {
  const l = store.lands.get(cell);
  if (!l || before <= count) return;
  const held = l.shares.reduce((a, b) => a + b, 0) * before;
  if (held <= 0) return;
  const left = Math.max(0, held - count) / held;
  for (let k = 0; k < BONDS.length; k++)
    l.shares[k] = (l.shares[k]! * before * left) / (before - count);
}

export function remember(o: RealmOrder, m: Omit<Memory, "weight">): void {
  o.memory.push({ ...m, weight: 1 });
  o.memory.sort((a, b) => b.weight - a.weight || b.year - a.year);
  if (o.memory.length > 8) o.memory.length = 8;
}

/** Captives carried off from a land a realm has just taken, if its people are such as do it. */
function takeCaptives(
  ctx: PopulationContext,
  store: OrderStore,
  a: Polity,
  land: number,
  battle: Ref,
  t: SimTime,
): void {
  const { world } = ctx,
    culture = cultureOf(world),
    mine = culture.get(a.seat),
    theirs = culture.get(land),
    prov = ctx.provinces.get(land),
    seat = ctx.provinces.get(a.seat),
    o = realmOrder(store, a, mine);
  if (!mine || !theirs || !prov || !seat || land === a.seat) return;
  // A realm whose law has freed its bound frees those it takes.
  if (o.abolished !== null) {
    const l = store.lands.get(land);
    if (l) {
      for (let k = 0; k < BONDS.length; k++) if (k !== BOND.convict) l.shares[k] = 0;
      l.cause = battle;
    }
    return;
  }
  const hier = trait(mine, WAY.hierarchy),
    open = trait(mine, WAY.openness),
    valour = trait(mine, WAY.valour),
    foreign = 1 - tongueLikeness(mine.tongue, theirs.tongue),
    faiths = beliefOf(world),
    ours = faiths.of(a.seat).faith,
    other = faiths.of(land).faith,
    unbelievers = ours !== null && other !== null && other !== ours ? 1 : 0,
    citizens = o.laws[LAW_OF.strangers] === 2,
    score =
      0.35 * hier +
      0.25 * (1 - open) +
      0.25 * foreign +
      0.15 * unbelievers +
      0.1 * valour -
      (citizens ? 0.4 : 0);
  const decision = world.decisions.record({
    rule: "order.captives",
    subject: a.ref,
    outcome: { land: cellRef(0, land), take: score >= CAPTIVE_LINE },
    score,
    threshold: CAPTIVE_LINE,
    factors: [
      {
        name: "a people who keep to rank",
        value: hier,
        contribution: 0.35 * hier,
        source: nudged(mine, WAY.hierarchy),
      },
      // (A law that makes strangers citizens forbids it: M139.)
      citizens
        ? {
            name: "closed to strangers, though its law makes them citizens",
            value: 1 - open,
            contribution: 0.25 * (1 - open) - 0.4,
            source: {
              ref: o.lawEvents[LAW_OF.strangers] ?? a.event,
              role: "constraint",
              weight: 1,
            },
          }
        : {
            name: "closed to strangers",
            value: 1 - open,
            contribution: 0.25 * (1 - open),
            source: nudged(mine, WAY.openness),
          },
      {
        name: "the taken speak another tongue",
        value: foreign,
        contribution: 0.25 * foreign,
        source: null,
      },
      {
        name: "the taken keep another faith",
        value: unbelievers,
        contribution: 0.15 * unbelievers,
        source: unbelievers && other ? { ref: other, role: "enabler", weight: 1 } : null,
      },
      {
        name: "a people given to war",
        value: valour,
        contribution: 0.1 * valour,
        source: nudged(mine, WAY.valour),
      },
      {
        name: "the land taken",
        value: 1,
        contribution: 0,
        source: { ref: battle, role: "trigger", weight: 1 },
      },
    ],
  });
  if (score < CAPTIVE_LINE) return;
  const want = Math.min(MOST_CAPTIVES, Math.floor(prov.total() * CAPTIVE_SHARE * score)),
    drawn = want >= 10 ? draw(ctx, land, want, CAPTIVES, land, t) : null;
  if (!drawn) return;
  const before = seat.total(),
    event = world.events.emit({
      type: ORDER_EVENTS.captives.type,
      subjects: [a.ref, prov.ref],
      place: prov.ref,
      causes: [
        { ref: decision, role: "trigger", weight: 1 },
        { ref: battle, role: "enabler", weight: 1 },
      ],
      data: { realm: realmName(a), count: drawn.n },
    });
  carry(ctx, land, a.seat, drawn.moved, drawn.n, decision, event, t);
  bindNew(store, a.seat, BOND.chattel, drawn.n, before);
  landOf(store, a.seat).cause = event;
  o.firsts[BOND.chattel] ??= event;
  grieve(world, land, 0.3, event);
  // The realm the land was taken from remembers.
  const from = politiesOf(world).formerly(land),
    loser = from ? store.realms.get(from) : undefined;
  if (loser) remember(loser, { what: "captivity", year: yearOfMoment(t), cell: land, event });
}

/**
 * The hungry selling themselves for grain, and the crushed by debt to pay it (Phase 21 M143):
 * debt bondage in a land of a realm, if it comes to that.
 */
function sellThemselves(
  ctx: PopulationContext,
  store: OrderStore,
  p: Polity,
  c: number,
  t: SimTime,
): void {
  const { world } = ctx,
    prov = ctx.provinces.get(c),
    ways = cultureOf(world).get(c),
    found = prov?.lastFamine ? world.events.get(prov.lastFamine) : undefined,
    famine = found && t - found.t <= 2 * YEAR ? found : undefined,
    // (A debt to the houses of lending above half a year's grain: crushing, famine or none.)
    burden = prov ? debtBurden(ctx, c) : 0,
    owing = burden >= CREDIT.crushing ? creditOf(world)?.owedBy(c).loan : null;
  if (!prov || !ways || (!famine && !owing)) return;
  const hunger = famine ? 1 - prov.leanest / 1000 : 0,
    crushed = owing ? Math.min(1, burden) : 0,
    hier = trait(ways, WAY.hierarchy),
    kin = trait(ways, WAY.kinship),
    open = trait(ways, WAY.openness),
    score = 0.6 * hunger + 0.5 * crushed + 0.4 * hier - 0.35 * kin - 0.2 * open;
  if (score < DEBT_LINE) return;
  const l = landOf(store, c),
    free = Math.max(0, 1 - l.shares.reduce((a, b) => a + b, 0)),
    add = Math.min(
      DEBT_MOST - l.shares[BOND.debt]!,
      free * 0.06 * Math.max(hunger, crushed) * (0.5 + hier),
    );
  if (add <= 0) return;
  l.shares[BOND.debt] = l.shares[BOND.debt]! + add;
  // A great binding is told; the rest goes on as the famine's (or the debt's).
  if (add * prov.total() < 20) {
    l.cause ??= famine ? famine.id : owing!.event;
    return;
  }
  const decision = world.decisions.record({
    rule: "order.bondage",
    subject: prov.ref,
    outcome: { share: Math.round(add * 1000) / 1000 },
    score,
    threshold: DEBT_LINE,
    factors: [
      ...(famine
        ? [
            {
              name: "hunger",
              value: hunger,
              contribution: 0.6 * hunger,
              source: { ref: famine.id, role: "trigger" as const, weight: 1 },
            },
          ]
        : []),
      ...(owing
        ? [
            {
              name: "debts they cannot pay",
              value: Math.round(burden * 100) / 100,
              contribution: 0.5 * crushed,
              source: {
                ref: owing.event,
                role: (famine ? "pressure" : "trigger") as CauseRef["role"],
                weight: 1,
              },
            },
          ]
        : []),
      {
        name: "a people who keep to rank",
        value: hier,
        contribution: 0.4 * hier,
        source: nudged(ways, WAY.hierarchy),
      },
      {
        name: "kin who feed kin",
        value: kin,
        contribution: -0.35 * kin,
        source: nudged(ways, WAY.kinship),
      },
      { name: "open hands", value: open, contribution: -0.2 * open, source: null },
    ],
  });
  l.cause = world.events.emit({
    type: ORDER_EVENTS.bondage.type,
    subjects: [p.ref, prov.ref],
    place: prov.ref,
    causes: [{ ref: decision, role: "trigger", weight: 1 }],
    data: { realm: realmName(p), count: Math.round(add * prov.total()) },
  });
  realmOrder(store, p, cultureOf(world).get(p.seat)).firsts[BOND.debt] ??= l.cause;
}

/** Those who came hungry into a realm's land, bound for their passage. */
function bindNewcomers(ctx: PopulationContext, store: OrderStore, t: SimTime): void {
  const { world } = ctx,
    realms = politiesOf(world),
    culture = cultureOf(world),
    year = yearOfMoment(t),
    flows = ctx.history.flows();
  for (let i = flows.length - 1; i >= 0; i--) {
    const f = flows[i]!;
    if (f.year !== year) break;
    const p = realms.of(f.to),
      o = p ? store.realms.get(p.ref) : undefined,
      src = ctx.provinces.get(f.from),
      dest = ctx.provinces.get(f.to);
    if (!p || !o || o.abolished !== null || !src || !dest || f.count < 40) continue;
    // (Captives and the fleeing are moved by this order itself: their moves are not passages.)
    const e = world.events.get(f.event);
    if (!e || e.type.startsWith("order.")) continue;
    const hunger = 1 - src.leanest / 1000,
      hier = trait(culture.get(p.seat), WAY.hierarchy),
      trade = trait(culture.get(p.seat), WAY.trade);
    if (hunger < 0.15 || hier < 0.45) continue;
    const n = Math.round(f.count * 0.35 * Math.min(1, hunger * 2) * (0.5 + trade));
    if (n < 15) continue;
    const decision = world.decisions.record({
      rule: "order.indenture",
      subject: dest.ref,
      outcome: { count: n },
      score: hunger,
      threshold: 0.15,
      factors: [
        {
          name: "they came hungry",
          value: hunger,
          contribution: hunger,
          source: { ref: f.event, role: "trigger", weight: 1 },
        },
        { name: "a realm that keeps to rank", value: hier, contribution: 0.5 * hier, source: null },
        {
          name: "a trading people, who pay passage",
          value: trade,
          contribution: 0.5 * trade,
          source: null,
        },
      ],
    });
    const event = world.events.emit({
      type: ORDER_EVENTS.indenture.type,
      subjects: [p.ref, dest.ref],
      place: dest.ref,
      causes: [{ ref: decision, role: "trigger", weight: 1 }],
      data: { realm: realmName(p), count: n },
    });
    const l = landOf(store, f.to),
      pop = Math.max(1, dest.total());
    l.shares[BOND.indenture] = Math.min(0.5, l.shares[BOND.indenture]! + Math.min(n, pop) / pop);
    l.cause = event;
    o.firsts[BOND.indenture] ??= event;
  }
}

/** The bound fleeing to a free land beside their own, if one lies near. */
function flee(
  ctx: PopulationContext,
  store: OrderStore,
  p: Polity,
  c: number,
  bound: number,
  t: SimTime,
): void {
  const { world, generated: g } = ctx,
    realms = politiesOf(world),
    prov = ctx.provinces.get(c)!,
    ways = cultureOf(world).get(c),
    valour = trait(ways, WAY.valour);
  // The freest land beside it: a realm that freed its bound, else one with none, else no realm.
  let best: { cell: number; free: number; why: Ref | null } | null = null;
  for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
    const n = g.grid.neighbours[k]!,
      there = ctx.provinces.get(n);
    if (!there || there.total() < 20) continue;
    const q = realms.of(n);
    if (q?.ref === p.ref) continue;
    const qo = q ? store.realms.get(q.ref) : undefined,
      free =
        qo?.abolished !== undefined && qo.abolished !== null
          ? 3
          : !q
            ? 2
            : store.bound(n) < 0.01
              ? 1
              : 0;
    if (!free) continue;
    if (!best || free > best.free || (free === best.free && n < best.cell))
      best = { cell: n, free, why: qo?.abolition ?? null };
  }
  if (!best || !(world.rng.real(FLIGHT, c, t, 0) < 0.2)) return;
  const pop = prov.total(),
    count = Math.min(500, Math.floor(pop * bound * 0.01 * (0.6 + valour)));
  if (count < 60) return;
  const drawn = draw(ctx, c, count, FLIGHT, c, t);
  if (!drawn) return;
  const l = store.lands.get(c)!,
    decision = world.decisions.record({
      rule: "order.flight",
      subject: prov.ref,
      outcome: { to: cellRef(0, best.cell), count: drawn.n },
      score: bound,
      threshold: 0.04,
      factors: [
        {
          name: "the bound among them",
          value: bound,
          contribution: bound,
          source: l.cause ? { ref: l.cause, role: "pressure", weight: 1 } : null,
        },
        { name: "daring", value: valour, contribution: 0.4 * valour, source: null },
        {
          name: "a free land beside them",
          value: best.free,
          contribution: 0.2 * best.free,
          source: best.why ? { ref: best.why, role: "enabler", weight: 1 } : null,
        },
      ],
    }),
    event = world.events.emit({
      type: ORDER_EVENTS.flight.type,
      subjects: [p.ref, prov.ref, cellRef(0, best.cell)],
      place: prov.ref,
      causes: [{ ref: decision, role: "trigger", weight: 1 }],
      data: { realm: realmName(p), count: drawn.n },
    });
  boundGone(store, c, drawn.n, pop);
  carry(ctx, c, best.cell, drawn.moved, drawn.n, decision, event, t);
}

/** A land of the bound rising against its realm: freedom and a realm of their own, or the sword. */
export function rise(
  ctx: PopulationContext,
  store: OrderStore,
  p: Polity,
  o: RealmOrder,
  c: number,
  bound: number,
  factors: Factor[],
  score: number,
  t: SimTime,
): void {
  const { world } = ctx,
    realms = politiesOf(world),
    culture = cultureOf(world),
    year = yearOfMoment(t),
    prov = ctx.provinces.get(c)!,
    l = store.lands.get(c)!,
    pop = prov.total(),
    decision = world.decisions.record({
      rule: "order.revolt",
      subject: prov.ref,
      outcome: { against: p.ref },
      score,
      threshold: 0.75,
      factors,
    }),
    revolt = world.events.emit({
      type: ORDER_EVENTS.revolt.type,
      subjects: [p.ref, prov.ref],
      place: prov.ref,
      causes: [
        { ref: decision, role: "trigger", weight: 1 },
        ...(l.cause ? [{ ref: l.cause, role: "pressure" as const, weight: 0.6 }] : []),
      ],
      data: { realm: realmName(p), count: Math.round(bound * pop) },
    });
  // The rebels against what the realm can bring against them.
  const people = p.members.reduce((s, m) => s + (ctx.provinces.get(m)?.total() ?? 0), 0),
    atWar = warsOf(world).fighting(p.ref).length > 0,
    // (The able of the bound take up arms; the realm's whole people stand behind its order,
    // the more so as its seat reaches them.)
    rebels = 0.3 * bound * pop,
    held = people * (0.05 + 0.15 * capacityOf(ctx, p).value) * (atWar ? 0.6 : 1),
    odds = rebels / Math.max(1, rebels + held),
    won = world.rng.real(RISING, c, t, 1) < odds;
  if (won) {
    for (let k = 0; k < BONDS.length; k++) if (k !== BOND.convict) l.shares[k] = 0;
    const freed = world.events.emit({
      type: ORDER_EVENTS.freed.type,
      subjects: [p.ref, prov.ref],
      place: prov.ref,
      causes: [{ ref: revolt, role: "trigger", weight: 1 }],
      data: { realm: realmName(p), count: Math.round(rebels), seat: c === p.seat },
    });
    l.cause = freed;
    remember(o, { what: "rising", year, cell: c, event: freed });
    const ways = culture.get(c);
    if (ways) {
      pushWays(ways, { event: freed, year, trait: WAY.openness, amount: 0.08 });
      pushWays(ways, { event: freed, year, trait: WAY.valour, amount: 0.06 });
    }
    if (c === p.seat) {
      // The seat itself: the court overthrown, the realm's bound all freed.
      abolish(ctx, store, p, o, freed, t);
      return;
    }
    realms.leave(p, c);
    realms.setDiscontent(c, { level: 0, cause: freed });
    cutOff(ctx, p, freed);
    const town = ctx.settlements
      .inProvince(c)
      .filter((s) => s.market)
      .sort((x, y) => y.population - x.population || (x.ref < y.ref ? -1 : 1))[0];
    const raised = town ? raiseRealm(ctx, town, [c], freed, t) : null;
    if (raised) {
      const ro = realmOrder(store, raised, ways);
      ro.abolished = year;
      ro.abolition = freed;
      remember(ro, { what: "freedom", year, cell: c, event: freed });
    }
    return;
  }
  // Crushed: the risen fall, the rest are held the harder, and the realm remembers.
  const dead = strike(ctx, c, Math.min(0.5, 0.35 * bound), t),
    crushed = world.events.emit({
      type: ORDER_EVENTS.crushed.type,
      subjects: [p.ref, prov.ref],
      place: prov.ref,
      causes: [{ ref: revolt, role: "trigger", weight: 1 }],
      data: { realm: realmName(p), dead },
    });
  boundGone(store, c, Math.round(dead * 0.8), pop);
  l.cause = crushed;
  l.quiet = year + COWED_YEARS;
  realms.setDiscontent(c, { level: Math.max(1, realms.discontent(c).level), cause: crushed });
  remember(o, { what: "massacre", year, cell: c, event: crushed });
}

/** How many a law freeing the bound would free in a realm's lands (all but the condemned). */
function freeable(ctx: PopulationContext, store: OrderStore, p: Polity): number {
  let n = 0;
  for (const c of p.members) {
    const l = store.lands.get(c),
      people = ctx.provinces.get(c)?.total() ?? 0;
    if (l)
      for (let k = 0; k < BONDS.length; k++)
        if (k !== BOND.convict) n += Math.round(people * l.shares[k]!);
  }
  return n;
}

/** A realm outlaws bondage: every bound in its lands freed, but the condemned. */
export function abolish(
  ctx: PopulationContext,
  store: OrderStore,
  p: Polity,
  o: RealmOrder,
  event: Ref,
  t: SimTime,
): number {
  const year = yearOfMoment(t);
  let freed = 0;
  for (const c of p.members) {
    const l = store.lands.get(c);
    if (!l) continue;
    const n = ctx.provinces.get(c)?.total() ?? 0;
    for (let k = 0; k < BONDS.length; k++) {
      if (k === BOND.convict) continue;
      freed += Math.round(n * l.shares[k]!);
      l.shares[k] = 0;
    }
    l.cause = event;
  }
  o.abolished = year;
  o.abolition = event;
  remember(o, { what: "abolition", year, cell: p.seat, event });
  return freed;
}

/** Every five years, a realm that holds the bound weighs freeing them. */
function weighAbolition(
  ctx: PopulationContext,
  store: OrderStore,
  p: Polity,
  o: RealmOrder,
  t: SimTime,
): void {
  const { world } = ctx,
    culture = cultureOf(world),
    seat = culture.get(p.seat),
    movement = o.movements.find((m) => m.cause === "abolition"),
    bound = boundShare(ctx, p);
  if (!movement || movement.strength < ABOLITION_MOVEMENT || bound < 0.01) return;
  // (A law that frees every bound in a realm is a written one.)
  if (!(loreOf(world).effect(p.seat, "writing") > 0)) return;
  const risings = o.memory.filter((m) => m.what === "rising" || m.what === "massacre"),
    fear = Math.min(
      1,
      risings.reduce((s, m) => s + m.weight, 0),
    ),
    free = [...store.realms.values()]
      .filter((x) => x.abolished !== null && politiesOf(world).get(x.realm)?.ended === null)
      .sort((a, b) => a.abolished! - b.abolished! || (a.realm < b.realm ? -1 : 1)),
    neighbours = Math.min(1, free.length / 3),
    open = trait(seat, WAY.openness),
    cap = capacityOf(ctx, p).value,
    court = interestsOf(ctx, p, t).find((i) => i.group === "the court")?.sway ?? 0,
    dependence = Math.min(1, 3 * bound),
    tradition = trait(seat, WAY.tradition),
    hier = trait(seat, WAY.hierarchy),
    pro = movement.strength + 0.3 * fear + 0.2 * open + 0.1 * cap + 0.15 * neighbours,
    con = court + 0.8 * dependence + 0.3 * tradition + 0.25 * hier,
    score = pro - con;
  const decision = world.decisions.record({
    rule: "order.abolish",
    subject: p.ref,
    outcome: { abolish: score >= ABOLITION_LINE },
    score,
    threshold: ABOLITION_LINE,
    factors: [
      {
        name: "the movement to free them",
        value: movement.strength,
        contribution: movement.strength,
        source: { ref: movement.event, role: "pressure", weight: 1 },
      },
      {
        name: "risings remembered",
        value: fear,
        contribution: 0.3 * fear,
        source: risings[0] ? { ref: risings[0].event, role: "pressure", weight: 1 } : null,
      },
      {
        name: "realms that freed theirs",
        value: free.length,
        contribution: 0.15 * neighbours,
        source: free[0]?.abolition ? { ref: free[0].abolition, role: "enabler", weight: 1 } : null,
      },
      {
        name: "an open people, a seat that reaches",
        value: open,
        contribution: 0.2 * open + 0.1 * cap,
        source: nudged(seat, WAY.openness),
      },
      {
        name: "the court, and wealth that rests on the bound",
        value: court,
        contribution: -(court + 0.8 * dependence),
        source: null,
      },
      {
        name: "old ways and rank",
        value: tradition,
        contribution: -(0.3 * tradition + 0.25 * hier),
        source: nudged(seat, WAY.tradition),
      },
    ],
  });
  if (score < ABOLITION_LINE) return;
  const event = world.events.emit({
    type: ORDER_EVENTS.abolished.type,
    subjects: [p.ref],
    place: ctx.provinces.get(p.seat)?.ref ?? null,
    causes: [
      { ref: decision, role: "trigger", weight: 1 },
      { ref: movement.event, role: "pressure", weight: 0.6 },
    ],
    data: { realm: realmName(p), count: freeable(ctx, store, p) },
  });
  abolish(ctx, store, p, o, event, t);
  if (seat) pushWays(seat, { event, year: yearOfMoment(t), trait: WAY.openness, amount: 0.06 });
  // The court does not forgive it at once.
  o.legitimacy = clamp(0.02, 0.98, o.legitimacy - 0.1 * court);
  o.movements = o.movements.filter((m) => m !== movement);
}

/** Movements among a realm's people, rising and fading with what moves them. */
function stirMovements(
  ctx: PopulationContext,
  store: OrderStore,
  p: Polity,
  o: RealmOrder,
  t: SimTime,
): void {
  const { world } = ctx,
    culture = cultureOf(world),
    seat = culture.get(p.seat),
    year = yearOfMoment(t),
    open = trait(seat, WAY.openness),
    hier = trait(seat, WAY.hierarchy),
    tradition = trait(seat, WAY.tradition),
    risings = o.memory.filter((m) => m.what === "rising" || m.what === "massacre"),
    remembered = Math.min(
      1,
      risings.reduce((s, m) => s + m.weight, 0),
    ),
    free = [...store.realms.values()].filter(
      (x) => x !== o && x.abolished !== null && politiesOf(world).get(x.realm)?.ended === null,
    ).length,
    interests = interestsOf(ctx, p, t),
    traders = interests.find((i) => i.group === "traders")?.sway ?? 0,
    makers = interests.reduce(
      (s, i) => s + (i.group === "traders" || i.group === "crafters" ? i.sway : 0),
      0,
    );
  let hungry = 0,
    people = 0;
  for (const c of p.members) {
    const prov = ctx.provinces.get(c);
    if (!prov) continue;
    people += prov.total();
    hungry += prov.total() * (1 - prov.leanest / 1000);
  }
  const want: Record<Movement["cause"], { target: number; source: Ref | null }> = {
    abolition: {
      target:
        o.abolished !== null || boundShare(ctx, p) < 0.03
          ? 0
          : 0.6 * (open - 0.4) +
            0.35 * remembered +
            0.15 * Math.min(1, free / 3) +
            0.25 * Math.min(1, 3 * traders) -
            0.35 * (hier - 0.4) -
            0.25 * (tradition - 0.4),
      source: risings[0]?.event ?? nudged(seat, WAY.openness)?.ref ?? null,
    },
    land: {
      target:
        1.5 * boundShare(ctx, p, BOND.serf) +
        0.4 * (people ? hungry / people : 0) -
        0.4 * (hier - 0.4),
      source: store.lands.get(p.seat)?.cause ?? null,
    },
    // (A voice is wanted against a chief, a priest-king, or a general: M145.)
    voice: {
      target:
        p.leadership === 0 || p.leadership === 3 || p.leadership === GENERAL
          ? 1.5 * (makers - 0.15) + 0.4 * (open - 0.5) - 0.5 * (hier - 0.5)
          : 0,
      source: null,
    },
  };
  for (const cause of ["abolition", "land", "voice"] as const) {
    const w = want[cause],
      m = o.movements.find((x) => x.cause === cause);
    if (m) {
      m.strength = clamp(0, 1, m.strength + MOVEMENT_GROWS * (w.target - m.strength));
      if (m.strength < 0.05) o.movements = o.movements.filter((x) => x !== m);
      // A movement pushes its people's ways a little each year it stands.
      else if (seat) {
        const k = cause === "voice" ? WAY.hierarchy : WAY.openness,
          by = cause === "voice" ? -0.004 * m.strength : 0.003 * m.strength;
        seat.traits[k] = clamp(0.02, 0.98, seat.traits[k]! + by);
      }
      continue;
    }
    if (w.target < MOVEMENT_LINE) continue;
    const event = world.events.emit({
      type: ORDER_EVENTS.movement.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes: w.source
        ? [{ ref: w.source, role: "pressure", weight: 1 }]
        : [{ ref: p.event, role: "enabler", weight: 1 }],
      data: { realm: realmName(p), cause },
    });
    o.movements.push({ cause, strength: 0.1, since: year, event });
    if (seat)
      pushWays(seat, {
        event,
        year,
        trait: cause === "voice" ? WAY.hierarchy : WAY.openness,
        amount: cause === "voice" ? -0.04 : 0.04,
      });
  }
}

/** The year of a realm's order, and of the bound in its lands. */
export function orderYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = orderOf(world);
  if (!store) return;
  const realms = politiesOf(world),
    culture = cultureOf(world),
    markets = world.store<MarketStore>("economy.markets"),
    year = yearOfMoment(t),
    living = realms.living();
  for (const p of living)
    realmOrder(store, p, culture.get(p.seat), beliefOf(world).of(p.seat).faith !== null);

  // 1. Captives from the lands taken this year.
  for (const w of warsOf(world).all()) {
    if (w.ended !== null && w.ended < year) continue;
    for (const b of w.battles) {
      if (b.year !== year || !b.won) continue;
      const a = realms.get(w.attacker);
      if (a && a.ended === null && realms.of(b.land)?.ref === a.ref)
        takeCaptives(ctx, store, a, b.land, b.event, t);
    }
  }

  // 2. Those who came hungry, bound for their passage.
  bindNewcomers(ctx, store, t);

  for (const p of living) {
    const o = store.realms.get(p.ref)!,
      seatWays = culture.get(p.seat),
      hier = trait(seatWays, WAY.hierarchy),
      trade = trait(seatWays, WAY.trade),
      open = trait(seatWays, WAY.openness),
      cap = capacityOf(ctx, p),
      atWar = warsOf(world).fighting(p.ref).length > 0,
      free = o.abolished !== null;

    // 3. The hungry selling themselves; serfs bound to the land; the condemned set to labour.
    // (Under the lord's land its farmers are bound the more; leased, the less; the tiller's own, not at all.)
    const serfMeasure = free
        ? 0
        : clamp(
            0,
            0.6,
            1.4 * (hier - 0.55) + (atWar ? 0.25 : 0) + 0.3 * (0.5 - trade) - 0.3 * (open - 0.5),
          ) * [1, 0.5, 0][o.laws[LAW_OF.land]!]!,
      decree = p.law === 1 && loreOf(world).effect(p.seat, "writing") > 0;
    for (const c of p.members) {
      if (!free) sellThemselves(ctx, store, p, c, t);
      const prov = ctx.provinces.get(c);
      if (!prov) continue;
      const workers = Math.max(1, prov.total() - prov.occupation(OCC.dependent)),
        farming = prov.occupation(OCC.farmer) / workers >= 0.5,
        l = store.lands.get(c) ?? (serfMeasure > 0 && farming ? landOf(store, c) : undefined);
      if (!l) continue;
      // Serfs: toward the realm's measure where most work the fields; a great dying loosens them.
      let s = l.shares[BOND.serf]!;
      const target = farming ? serfMeasure : 0;
      s = s < target ? s + Math.min(SERF_BIND, target - s) : s - Math.min(SERF_LOOSE, s - target);
      const years = ctx.history.yearsOf(c),
        last = years.at(-1),
        before = years.at(-2);
      if (last && before && last.population < before.population * 0.9) s *= 0.7;
      const others = l.shares.reduce((a, b, k) => a + (k === BOND.serf ? 0 : b), 0);
      l.shares[BOND.serf] = clamp(0, Math.max(0, 1 - others), s);
      // Debts are worked off, faster in a fed year; the indentured serve their term.
      l.shares[BOND.debt] =
        l.shares[BOND.debt]! * (1 - (prov.leanest >= 950 ? DEBT_WORKED_OFF : 0.02));
      l.shares[BOND.indenture] = l.shares[BOND.indenture]! * (1 - 1 / INDENTURE_YEARS);
      // The condemned at labour, under a seat that rules by decree.
      const condemned = decree ? 0.003 + 0.01 * Math.min(1, realms.discontent(c).level) : 0;
      l.shares[BOND.convict] =
        l.shares[BOND.convict]! + 0.2 * (condemned - l.shares[BOND.convict]!);
      if (l.shares.every((x) => x < 0.0005) && !l.cause) store.lands.delete(c);
    }
    // The first serfs, and the first condemned at labour, told once.
    const serfs = boundShare(ctx, p, BOND.serf);
    if (serfs >= 0.1 && !o.firsts[BOND.serf]) {
      const decision = world.decisions.record({
        rule: "order.serfdom",
        subject: p.ref,
        outcome: { share: Math.round(serfs * 100) / 100 },
        score: serfMeasure,
        threshold: 0.1,
        factors: [
          {
            name: "a people who keep to rank",
            value: hier,
            contribution: 1.4 * (hier - 0.55),
            source: nudged(seatWays, WAY.hierarchy),
          },
          { name: "war near", value: atWar ? 1 : 0, contribution: atWar ? 0.25 : 0, source: null },
          {
            name: "little trade",
            value: 1 - trade,
            contribution: 0.3 * (0.5 - trade),
            source: nudged(seatWays, WAY.trade),
          },
          {
            name: "closed to strangers",
            value: 1 - open,
            contribution: -0.3 * (open - 0.5),
            source: null,
          },
        ],
      });
      o.firsts[BOND.serf] = world.events.emit({
        type: ORDER_EVENTS.serfdom.type,
        subjects: [p.ref],
        place: ctx.provinces.get(p.seat)?.ref ?? null,
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: { realm: realmName(p), share: Math.round(serfs * 100) },
      });
      for (const c of p.members) {
        const l = store.lands.get(c);
        if (l && l.shares[BOND.serf]! > 0.05) l.cause ??= o.firsts[BOND.serf] ?? null;
      }
    }
    if (decree && !o.firsts[BOND.convict] && boundShare(ctx, p, BOND.convict) >= 0.002)
      o.firsts[BOND.convict] = world.events.emit({
        type: ORDER_EVENTS.convicts.type,
        subjects: [p.ref],
        place: ctx.provinces.get(p.seat)?.ref ?? null,
        causes: [{ ref: p.tithed ?? p.event, role: "enabler", weight: 1 }],
        data: { realm: realmName(p) },
      });

    // 4. Corvée: a seat that builds, or fights, calls its free people to its works.
    const seatYears = ctx.history.yearsOf(p.seat),
      growing =
        (seatYears.at(-1)?.population ?? 0) > (seatYears.at(-6)?.population ?? Infinity) * 1.01,
      levy = clamp(
        0,
        0.3,
        0.6 * (hier - 0.45) +
          (growing ? 0.1 : 0) +
          (atWar ? 0.08 : 0) -
          (p.leadership === 2 ? 0.1 : 0),
      );
    o.corvee = clamp(0, 0.3, o.corvee + 0.2 * (levy - o.corvee));
    if (o.corvee > 0.1 && !o.corveeEvent)
      o.corveeEvent = world.events.emit({
        type: ORDER_EVENTS.corvee.type,
        subjects: [p.ref],
        place: ctx.provinces.get(p.seat)?.ref ?? null,
        causes: [{ ref: p.event, role: "enabler", weight: 1 }],
        data: { realm: realmName(p), share: Math.round(o.corvee * 100) },
      });

    // 5. What is skimmed between the lands and the seat, and how hard rank has set.
    o.corruption = clamp(
      0,
      0.8,
      o.corruption * 0.95 +
        0.02 * (1 - cap.value) * Math.min(1, p.members.length / 8) +
        0.015 * Math.min(1, Math.max(0, year - p.ruler.since) / 25) -
        (p.leadership === 2 ? 0.01 : 0) -
        (decree ? 0.01 : 0) -
        0.004 * o.laws[LAW_OF.justice]!,
    );
    const seatMarket = markets.get(p.seat);
    if (seatMarket) {
      const skim = Math.floor(seatMarket.stock[G.grain]! * o.corruption * 0.04);
      if (skim > 0) seatMarket.move("used", G.grain, skim);
    }
    const casteTarget = clamp(
      0,
      1,
      (0.45 * hier +
        0.25 * trait(seatWays, WAY.tradition) +
        (p.law === 2 ? 0.2 : 0) +
        0.3 * boundShare(ctx, p)) *
        (free ? 0.85 : 1),
    );
    o.caste = clamp(0, 1, o.caste + 0.08 * (casteTarget - o.caste));

    // 6. The realm's standing with its people.
    const factors = legitimacyFactors(ctx, p),
      target = clamp(0.02, 0.98, 0.55 + factors.reduce((s, f) => s + f.contribution, 0));
    o.legitimacy = clamp(0.02, 0.98, o.legitimacy + 0.2 * (target - o.legitimacy));
    if (o.legitimacy < CRISIS && !o.crisis) {
      const worst = [...factors].sort((a, b) => a.contribution - b.contribution).slice(0, 6),
        decision = world.decisions.record({
          rule: "order.legitimacy",
          subject: p.ref,
          outcome: { standing: Math.round(o.legitimacy * 100) / 100 },
          score: o.legitimacy,
          threshold: CRISIS,
          factors: worst,
        });
      o.crisis = world.events.emit({
        type: ORDER_EVENTS.crisis.type,
        subjects: [p.ref],
        place: ctx.provinces.get(p.seat)?.ref ?? null,
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: { realm: realmName(p) },
      });
    } else if (o.legitimacy > RESTORED) o.crisis = null;

    // 7. Grievance: a rule held wrongful, a levy of labour, the bound chafing; flight and rising.
    for (const c of [...p.members]) {
      if (realms.of(c)?.ref !== p.ref) continue;
      const prov = ctx.provinces.get(c);
      if (!prov) continue;
      const l = store.lands.get(c),
        bound = l ? l.shares.reduce((a, b, k) => a + (k === BOND.convict ? 0.5 * b : b), 0) : 0,
        wrongful = o.legitimacy < 0.4 ? 0.2 * (0.4 - o.legitimacy) : 0,
        add = wrongful + 0.12 * o.corvee + 0.3 * bound * (1 - 0.5 * o.caste);
      if (add > 0.002)
        grieve(
          world,
          c,
          add,
          (bound > 0.05 ? l?.cause : null) ?? o.crisis ?? o.corveeEvent ?? p.event,
        );
      // What its laws ask of a land strange to its seat: strangers held as subjects, unbelievers (M139).
      if (c !== p.seat) {
        const ways = culture.get(c),
          foreign = seatWays && ways ? 1 - tongueLikeness(seatWays.tongue, ways.tongue) : 0,
          theirs = beliefOf(world).of(c).faith,
          seatFaith = beliefOf(world).of(p.seat).faith,
          law = lawGrievance(
            o,
            foreign,
            seatFaith !== null && theirs !== null && theirs !== seatFaith,
          );
        if (law.add > 0.002) grieve(world, c, law.add, law.cause ?? p.event);
      }
      if (bound < 0.04) continue;
      flee(ctx, store, p, c, bound, t);
      if (bound < RISING_SHARE || (l?.quiet ?? 0) > year) continue;
      const ways = culture.get(c),
        valour = trait(ways, WAY.valour),
        grievance = Math.min(1, realms.discontent(c).level),
        remembered = Math.min(
          1,
          o.memory
            .filter((m) => m.what === "rising" || m.what === "massacre")
            .reduce((s, m) => s + m.weight, 0),
        ),
        score =
          1.4 * bound +
          0.5 * grievance +
          (atWar ? 0.25 : 0) +
          0.3 * (1 - cap.value) +
          0.15 * remembered +
          0.2 * valour -
          0.4 * o.caste -
          0.2 * o.legitimacy;
      if (!(world.rng.real(RISING, c, t, 0) < 0.03 * Math.max(0, score - 0.75))) continue;
      const memory = o.memory.find((m) => m.what === "rising" || m.what === "massacre");
      rise(
        ctx,
        store,
        p,
        o,
        c,
        bound,
        [
          {
            name: "the bound among them",
            value: bound,
            contribution: 1.4 * bound,
            source: l?.cause ? { ref: l.cause, role: "pressure", weight: 1 } : null,
          },
          {
            name: "grievance",
            value: grievance,
            contribution: 0.5 * grievance,
            source: realms.discontent(c).cause
              ? { ref: realms.discontent(c).cause!, role: "pressure", weight: 1 }
              : null,
          },
          {
            name: "the realm at war, its reach thin",
            value: atWar ? 1 : 0,
            contribution: (atWar ? 0.25 : 0) + 0.3 * (1 - cap.value),
            source: null,
          },
          {
            name: "risings remembered",
            value: remembered,
            contribution: 0.15 * remembered,
            source: memory ? { ref: memory.event, role: "pressure", weight: 1 } : null,
          },
          { name: "daring", value: valour, contribution: 0.2 * valour, source: null },
          {
            name: "rank set hard, a rule held rightful",
            value: o.caste,
            contribution: -0.4 * o.caste - 0.2 * o.legitimacy,
            source: null,
          },
        ],
        score,
        t,
      );
      if (o.abolished !== null) break;
    }

    // 8. Movements, and (every five years, in its turn) the weighing of freedom.
    stirMovements(ctx, store, p, o, t);
    if (o.abolished === null && (year + keyOf(p.ref)) % ABOLITION_EVERY === 0)
      weighAbolition(ctx, store, p, o, t);
    // (And every ten years, in its turn, its laws: M139.)
    weighLaws(ctx, p, o, t);

    // 9. What it remembers fades.
    for (const m of o.memory) m.weight *= MEMORY_KEPT;
    o.memory = o.memory.filter((m) => m.weight >= 0.05);
  }
}

export function installOrder(world: World, ctx: () => PopulationContext): OrderStore {
  const store = world.register(new OrderStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "187.order.year", every: YEAR, run: (t) => orderYear(ctx(), t) });
  return store;
}
