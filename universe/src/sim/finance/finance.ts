// A realm's money and its fears (rules/finance.ts; asked 2026-11-14). Built on credit (sim/credit): a realm that knows banking at
// its seat sells debt, to its own people and to the peoples of realms it meets, at an interest read off its record; pays it from
// its seat's stores, the grain going home to its holders; and, unable to pay, refuses it, which its holders remember (the lessons
// of rule, rules/holds.ts) and every lender reads (credit's faithless years). The people of one realm come to hold shares of
// another's listed works, the more as both are open, at peace and think well of each other; a war between them, or a realm closing
// itself, takes what was held. How a realm's wealth is owned is two numbers moved every ten years by what it is and what it sees.
// And each realm reckons, of each realm it meets, how much it fears that realm's way: read by diplomacy (who draws together and
// apart), by how it is held (word watched, arms kept closer, or its people drawn the other's way), by its host, and here (who buys
// whose debt, who backs whose war). One reckoning a year over the realms and their meetings; nothing a person, no draws.
import {
  YEAR,
  defineEventType,
  dmath,
  yearOfMoment,
  type Factor,
  type Hasher,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  FINANCE,
  FOODS,
  G,
  GOODS,
  HOLD,
  LOSERS,
  OWN,
  OWN_KINDS,
  exposure,
  fearMoves,
  firstOwn,
  ownBand,
  seenToWork,
  threatOf,
  yieldOf,
  type Faring,
  type Own,
  type Threat,
  type YieldPart as Part,
  type Way,
} from "../../rules/index.ts";
import { marketsOf, mouths, type PopulationContext } from "../population/systems.ts";
import type { Market } from "../economy/market.ts";
import { loreOf } from "../lore/lore.ts";
import { cultureOf } from "../culture/culture.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { diplomacyOf, type Relation } from "../diplomacy/diplomacy.ts";
import { fieldedOf, warsOf } from "../war/war.ts";
import { orderOf } from "../order/order.ts";
import { holdsOf, waysRead } from "../order/holds.ts";
import { LAW_OF } from "../order/laws.ts";
import { CREDIT, creditOf } from "../credit/credit.ts";

export const FINANCE_EVENTS = {
  /** A realm sold debt: to its own people and to others'. */
  sold: defineEventType("finance.sold", 3),
  /** A realm refused the debt it had sold. */
  refused: defineEventType("finance.refused", 6),
  /** What a people held of a realm's debt was lost when it refused it (one for each people, for what it learns). */
  lost: defineEventType("finance.lost", 4),
  /** What a people held in another realm was taken: in a war between them, or as that realm closed itself. */
  taken: defineEventType("finance.taken", 5),
  /** How a realm's wealth is owned, told in other words. */
  owned: defineEventType("finance.owned", 5),
  /** A realm came to fear another's way. */
  feared: defineEventType("finance.feared", 5),
};

/** A fear as kept: of whom, and its level and parts in whole hundredths (rules/finance.ts Threat). */
export type Fear = {
  readonly of: Ref;
  readonly level: number;
  readonly unlike: number;
  readonly works: number;
  readonly exposed: number;
  readonly loss: number;
  readonly who: number;
  readonly drawn: number;
};

/** A realm's money. */
export type Money = {
  readonly realm: Ref;
  /** How its wealth is owned (rules/finance.ts: spread, common), in whole hundredths; the event that last told each in other words. */
  own: number[];
  ownEvents?: (Ref | null)[];
  /** What an overthrow left pulling on each (hundredths), fading; absent when nothing does. */
  lean?: number[];
  /** Its debt held by its own people (grain's worth), and by each people abroad. */
  home: number;
  held: [Ref, number][];
  /** The interest its debt bears, and what it would pay on new debt now (ten-thousandths a year). */
  coupon: number;
  rate: number;
  /** Years running it paid less than half the interest due abroad. */
  missed: number;
  /** What it paid its holders abroad in the year, and what came home to its people from abroad (grain's worth). */
  paid: number;
  income: number;
  /** Its listed works' worth as last read (grain's worth a year, twice over), and the year before. */
  worth: number;
  worthWas: number;
  /** Who abroad holds shares of them (ten-thousandths of that worth), by name; and all the rest together. */
  shares: [Ref, number][];
  rest: number;
  /** Whom it fears, the most feared first. */
  fears: Fear[];
  /** The realm it is told to fear, while it does, and the event. */
  told?: Ref;
  toldEvent?: Ref;
  /** The wars it sold debt for, each with the sale's event (its war chest, as credit's is). */
  chests?: [Ref, Ref][];
  /** Whom its people lost by, and when. */
  burnt?: [Ref, number][];
  /** Its last sale told, the year of it, and its last refusal. */
  sale?: Ref;
  soldIn?: number;
  refusal?: Ref;
};

export class FinanceStore implements StateStore {
  readonly name = "finance.realms";
  private readonly by = new Map<string, Money>();

  of(realm: Ref | string): Money | undefined {
    return this.by.get(realm);
  }
  all(): Money[] {
    return [...this.by.values()].sort((a, b) => (a.realm < b.realm ? -1 : 1));
  }
  put(m: Money): void {
    this.by.set(m.realm, m);
  }
  drop(realm: Ref): void {
    this.by.delete(realm);
  }
  /** Nothing kept yet: hashed as if it were not there (kernel StateStore). */
  dormant(): boolean {
    return this.by.size === 0;
  }
  pinned(): Ref[] {
    const out: Ref[] = [];
    for (const m of this.by.values()) {
      for (const e of m.ownEvents ?? []) if (e) out.push(e);
      if (m.toldEvent) out.push(m.toldEvent);
      for (const [, e] of m.chests ?? []) out.push(e);
      if (m.sale) out.push(m.sale);
      if (m.refusal) out.push(m.refusal);
    }
    return out;
  }
  save(): unknown {
    return { realms: this.all() };
  }
  hashInto(h: Hasher): void {
    h.value(this.save());
  }
  load(state: unknown): void {
    this.by.clear();
    for (const m of (state as { realms?: Money[] } | null)?.realms ?? [])
      this.by.set(m.realm, structuredClone(m));
  }
}

export function financeOf(world: World): FinanceStore | null {
  return world.hasStore("finance.realms") ? world.store<FinanceStore>("finance.realms") : null;
}

const pct = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 100);

// —— What the other systems read ——————————————————————————————————————————————————————————————————————

/** A realm's way (rules/finance.ts): how it is held and how its wealth is owned. Only reads; the middle where nothing is kept. */
export function wayOf(world: World, realm: Ref): Way {
  const h = holdsOf(world, realm),
    own = financeOf(world)?.of(realm)?.own;
  return [
    h[HOLD.force]!,
    h[HOLD.voice]!,
    h[HOLD.word]!,
    (own?.[0] ?? 50) / 100,
    (own?.[1] ?? 20) / 100,
  ];
}

/** How much a realm fears another's way (0 … 1; 0 where it keeps no such fear). */
export function fearOf(world: World, realm: Ref, of: Ref): number {
  const fears = financeOf(world)?.of(realm)?.fears;
  if (!fears) return 0;
  for (const f of fears) if (f.of === of) return f.level / 100;
  return 0;
}

/** A realm's greatest fear, if it keeps one. */
export function topFear(world: World, realm: Ref): Fear | null {
  return financeOf(world)?.of(realm)?.fears[0] ?? null;
}

/** A kept fear as rules/finance.ts reads one. */
export const threatFrom = (f: Fear): Threat => ({
  level: f.level / 100,
  unlike: f.unlike / 100,
  works: f.works / 100,
  exposed: f.exposed / 100,
  loss: f.loss / 100,
  who: f.who,
  drawn: f.drawn / 100,
});

/**
 * What a realm's greatest fear presses on how it is held (force, voice, word: sim/order/holds.ts weighs it), with whom it is of and
 * the event that told it. Null where it fears no one enough to be moved.
 */
export function fearPress(
  world: World,
  realm: Ref,
): { moves: [number, number, number]; of: Ref; level: number; event: Ref | null } | null {
  const m = financeOf(world)?.of(realm),
    f = m?.fears[0];
  if (!m || !f || (f.level < 10 && f.drawn < 10)) return null;
  return {
    moves: fearMoves(wayOf(world, realm), wayOf(world, f.of), threatFrom(f)),
    of: f.of,
    level: f.level / 100,
    event: m.told === f.of ? (m.toldEvent ?? null) : null,
  };
}

/** How much more of its men a realm fields for its fear (sim/war fieldShare): 0 where it fears no one. */
export function fearFields(world: World, realm: Ref): number {
  const f = financeOf(world)?.of(realm)?.fears[0];
  return f ? FINANCE.fields * (f.level / 100) : 0;
}

/** The sale of debt a realm paid its host from in a war, if it made one (as credit's war chest). */
export function warBonds(world: World, realm: Ref, war: Ref): Ref | null {
  const chests = financeOf(world)?.of(realm)?.chests;
  if (!chests) return null;
  for (const [w, e] of chests) if (w === war) return e;
  return null;
}

/** What two realms' peoples hold of each other: shares of listed worth and of debt, added (0 … 2). */
export function stakesBetween(world: World, a: Ref, b: Ref): number {
  const store = financeOf(world);
  if (!store) return 0;
  const one = (m: Money | undefined, other: Ref) => {
    if (!m) return 0;
    let s = 0;
    for (const [r, n] of m.shares) if (r === other) s += n / 10_000;
    const debt = m.home + m.held.reduce((x, [, n]) => x + n, 0);
    if (debt > 0) for (const [r, n] of m.held) if (r === other) s += n / debt;
    return s;
  };
  return one(store.of(a), b) + one(store.of(b), a);
}

/** What a realm owes in all: to its own people and abroad. */
export const debtOf = (m: Money): number => m.home + m.held.reduce((s, [, n]) => s + n, 0);

// —— The year ————————————————————————————————————————————————————————————————————————————————————————

/** The food a land made in its last year closed. */
function foodMade(m: Market | undefined): number {
  const made = m?.years.at(-1)?.ledger[0];
  let n = 0;
  if (made) for (const g of FOODS) n += made[g] ?? 0;
  return n;
}

/** The goods a land's works can be companies of (host/inspect/exchange.ts WORKS_GOODS). */
const LISTED = [
  G.machines,
  G.iron,
  G.coal,
  G.oil,
  G.copper,
  G.tin,
  G.clothing,
  G.tools,
  G.pottery,
] as const;

/** What a realm is, read once in the year. */
type Read = {
  readonly p: Polity;
  readonly m: Money;
  readonly way: Way;
  readonly faring: Faring;
  /** What it takes in of its lands' food in a year. */
  readonly takings: number;
  readonly banking: boolean;
  readonly atWar: boolean;
  readonly trust: number;
};

const term = (r: Relation, name: string) => r.terms.find((t) => t.name === name)?.value ?? 0;

/** A realm's money, begun where it keeps none. */
function moneyOf(ctx: PopulationContext, store: FinanceStore, p: Polity): Money {
  let m = store.of(p.ref);
  if (!m) {
    const o = orderOf(ctx.world)?.of(p.ref),
      own = firstOwn(
        o?.laws[LAW_OF.land] ?? 0,
        waysRead(cultureOf(ctx.world).get(p.seat)),
        ctx.generated.life.people?.body,
      );
    m = {
      realm: p.ref,
      own: own.map((x) => Math.round(x * 100)),
      home: 0,
      held: [],
      coupon: 0,
      rate: 0,
      missed: 0,
      paid: 0,
      income: 0,
      worth: 0,
      worthWas: 0,
      shares: [],
      rest: 0,
      fears: [],
    };
    store.put(m);
  }
  return m;
}

/** A realm's listed works' worth: what its lands' works made in their last year, at their markets' prices, twice over. */
function listedWorth(ctx: PopulationContext, p: Polity): number {
  const { world } = ctx,
    markets = marketsOf(world),
    lore = loreOf(world),
    credit = creditOf(world);
  let n = 0;
  for (const c of p.members) {
    const m = markets.get(c);
    if (!m?.works || !lore.get(c, "currency")) continue;
    if (!lore.get(c, "banking") && !credit?.standing().some((h) => h.cell === c)) continue;
    for (const g of LISTED) n += m.book("made", g) * m.price[g]!;
  }
  return Math.round(2 * n);
}

function readRealm(ctx: PopulationContext, store: FinanceStore, p: Polity): Read {
  const { world } = ctx,
    markets = marketsOf(world),
    realms = politiesOf(world),
    m = moneyOf(ctx, store, p);
  let people = 0,
    food = 0,
    eats = 0,
    grief = 0,
    worth = 0,
    takings = 0;
  for (const c of p.members) {
    const prov = ctx.provinces.get(c),
      mk = markets.get(c),
      n = prov?.total() ?? 0;
    if (!prov || !mk || n <= 0) continue;
    people += n;
    food += mk.food(FOODS);
    eats += mouths(prov, ctx.life);
    grief += n * Math.min(1, realms.discontent(c).level);
    for (let g = 0; g < GOODS.length; g++) worth += Math.max(0, mk.stock[g]!) * GOODS[g]!.value;
    takings += foodMade(mk) * p.tribute;
  }
  const h = holdsOf(world, p.ref);
  return {
    p,
    m,
    way: [h[HOLD.force]!, h[HOLD.voice]!, h[HOLD.word]!, m.own[0]! / 100, m.own[1]! / 100],
    faring: {
      fed: eats > 0 ? Math.min(1, food / eats / 12) : 0,
      calm: people > 0 ? 1 - grief / people : 1,
      rich: people > 0 ? worth / people : 0,
      people,
    },
    takings: Math.max(1, Math.round(takings)),
    banking: !!loreOf(world).get(p.seat, "banking"),
    atWar: warsOf(world).fighting(p.ref).length > 0,
    trust: h[HOLD.trust]!,
  };
}

/** What a realm would pay on new debt now, and each part of it (rules/finance.ts yieldOf): for the year, and for a page. */
export function yieldNow(
  ctx: PopulationContext,
  p: Polity,
): { rate: number; parts: Part[]; burden: number; takings: number } | null {
  const store = financeOf(ctx.world);
  if (!store) return null;
  const m = store.of(p.ref);
  if (!m) return null;
  return yieldRead(ctx, readRealm(ctx, store, p), yearOfMoment(ctx.world.now));
}

function yieldRead(ctx: PopulationContext, r: Read, year: number) {
  const credit = creditOf(ctx.world),
    burden = debtOf(r.m) / r.takings,
    y = yieldOf({
      refused: (credit?.defaults ?? [])
        .filter((d) => d.realm === r.p.ref)
        .map((d) => year - d.year),
      burden,
      atWar: r.atWar,
      voice: r.way[1],
      word: r.way[2],
      trust: r.trust,
      crisis: !!credit?.crisis && year - credit.crisis.year < CREDIT.crisis,
    });
  return { ...y, burden, takings: r.takings };
}

const burntBy = (m: Money, by: Ref, year: number) =>
  !!m.burnt?.some(([r, y]) => r === by && year - y < FINANCE.burnt);
function burn(m: Money, by: Ref, year: number): void {
  m.burnt = [[by, year] as [Ref, number], ...(m.burnt ?? []).filter(([r]) => r !== by)].slice(0, 4);
}

/** The year's reckoning. */
export function financeYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = financeOf(world)!,
    realms = politiesOf(world),
    living = [...realms.living()].sort((a, b) => (a.ref < b.ref ? -1 : 1));
  if (!living.length && store.dormant()) return;
  const year = yearOfMoment(t),
    diplomacy = diplomacyOf(world),
    wars = warsOf(world),
    credit = creditOf(world),
    markets = marketsOf(world),
    reads = new Map<string, Read>();
  for (const p of living) reads.set(p.ref, readRealm(ctx, store, p));

  // 1. Realms gone: what they owed is lost to its holders, what was held in them and by them is gone.
  for (const m of store.all()) {
    if (reads.has(m.realm)) continue;
    const gone = realms.get(m.realm);
    for (const [q, n] of m.held) {
      const holder = reads.get(q);
      if (!holder || n <= 0) continue;
      burn(holder.m, m.realm, year);
      world.events.emit({
        type: FINANCE_EVENTS.lost.type,
        subjects: [q, m.realm],
        place: ctx.provinces.get(holder.p.seat)?.ref ?? null,
        causes: [],
        data: {
          realm: realmName(holder.p),
          of: gone ? realmName(gone) : "a fallen realm",
          owed: Math.round(n),
          fallen: true,
        },
      });
    }
    store.drop(m.realm);
  }
  for (const r of reads.values()) {
    r.m.held = r.m.held.filter(([q]) => reads.has(q));
    const kept = r.m.shares.filter(([q]) => reads.has(q));
    if (kept.length !== r.m.shares.length) r.m.shares = kept;
    if (r.m.burnt) r.m.burnt = r.m.burnt.filter(([, y]) => year - y < FINANCE.burnt);
    if (r.m.burnt && !r.m.burnt.length) delete r.m.burnt;
    if (r.m.chests) {
      r.m.chests = r.m.chests.filter(([w]) => wars.get(w)?.ended === null);
      if (!r.m.chests.length) delete r.m.chests;
    }
    r.m.paid = 0;
    r.m.income = 0;
  }

  // 2. Whom each fears: of each two that meet, each one's fear of the other's way.
  const relations = diplomacy.all(),
    fears = new Map<string, Fear[]>();
  for (const rel of relations) {
    const a = reads.get(rel.a),
      b = reads.get(rel.b);
    if (!a || !b) continue;
    const near = Math.min(1, -term(rel, "the land along their border") / 0.2),
      trade = Math.min(1, term(rel, "trade between them") / 0.35),
      like = rel.terms.find((x) => x.name === "alike speech" || x.name === "strange speech"),
      tongue = Math.max(0, Math.min(1, (like?.value ?? 0) / 1.2 + 0.75)),
      stakes = Math.min(1, stakesBetween(world, rel.a, rel.b) / 0.16),
      meeting = { near, trade, tongue, stakes };
    for (const [x, y] of [
      [a, b],
      [b, a],
    ] as const) {
      const th = threatOf(
        x.way,
        y.way,
        seenToWork(x.faring, y.faring),
        exposure(meeting, x.way[2]),
      );
      if (th.level < 0.05 && th.drawn < 0.1) continue;
      const list = fears.get(x.p.ref) ?? [];
      list.push({
        of: y.p.ref,
        level: pct(th.level),
        unlike: pct(th.unlike),
        works: pct(th.works),
        exposed: pct(th.exposed),
        loss: pct(th.loss),
        who: th.who,
        drawn: pct(th.drawn),
      });
      fears.set(x.p.ref, list);
    }
  }
  for (const r of reads.values()) {
    const list = (fears.get(r.p.ref) ?? [])
      .sort((x, y) => y.level - x.level || y.drawn - x.drawn || (x.of < y.of ? -1 : 1))
      .slice(0, FINANCE.fears);
    r.m.fears = list;
    const top = list[0],
      told = r.m.told ? list.find((f) => f.of === r.m.told) : undefined;
    // (A fear let go: the one told of is feared no more, or gone.)
    if (r.m.told && (!told || told.level < FINANCE.fearGone * 100)) {
      delete r.m.told;
      delete r.m.toldEvent;
    }
    if (top && top.level >= FINANCE.feared * 100 && r.m.told !== top.of && !r.m.told) {
      const other = reads.get(top.of)!,
        decision = world.decisions.record({
          rule: "finance.fear",
          subject: r.p.ref,
          outcome: { of: top.of, level: top.level },
          score: top.level / 100,
          threshold: FINANCE.feared,
          factors: [
            {
              name: "how unlike their ways are",
              value: top.unlike / 100,
              contribution: top.unlike / 100,
              source: null,
            },
            {
              name: "how well the other's is seen to work",
              value: top.works / 100,
              contribution: top.works / 100,
              source: null,
            },
            {
              name: "how far its people are exposed to it",
              value: top.exposed / 100,
              contribution: top.exposed / 100,
              source: null,
            },
            {
              name: `what ${LOSERS[top.who]} would lose`,
              value: top.loss / 100,
              contribution: top.loss / 100,
              source: null,
            },
          ],
        });
      r.m.told = top.of;
      r.m.toldEvent = world.events.emit({
        type: FINANCE_EVENTS.feared.type,
        subjects: [r.p.ref, top.of],
        place: ctx.provinces.get(r.p.seat)?.ref ?? null,
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: {
          realm: realmName(r.p),
          of: realmName(other.p),
          level: top.level,
          who: top.who,
          mine: r.way.map(pct),
          theirs: other.way.map(pct),
        },
      });
    }
  }

  // 3. How each realm's wealth is owned, weighed every ten years (each in its own year of ten).
  for (const r of reads.values()) weighOwn(ctx, r, reads, year);

  // 4. What is taken: holdings between two realms at war, and in a realm closed to strangers.
  for (const r of reads.values()) {
    const m = r.m,
      shut = openTo(world, r) < FINANCE.closed,
      takers = new Set<Ref>();
    for (const [q] of [...m.shares, ...m.held]) if (shut || wars.between(r.p.ref, q)) takers.add(q);
    for (const q of [...takers].sort((x, y) => (x < y ? -1 : 1))) {
      const holder = reads.get(q);
      if (!holder) continue;
      const share = m.shares.find(([x]) => x === q)?.[1] ?? 0,
        owed = m.held.find(([x]) => x === q)?.[1] ?? 0,
        war = wars.between(r.p.ref, q);
      m.shares = m.shares.filter(([x]) => x !== q);
      m.held = m.held.filter(([x]) => x !== q);
      if (share < 50 && owed < 20) continue;
      burn(holder.m, r.p.ref, year);
      const event = world.events.emit({
        type: FINANCE_EVENTS.taken.type,
        subjects: [r.p.ref, q],
        place: ctx.provinces.get(r.p.seat)?.ref ?? null,
        causes: war ? [{ ref: war.event, role: "trigger", weight: 1 }] : [],
        data: {
          realm: realmName(r.p),
          of: realmName(holder.p),
          share: Math.round(share / 100),
          owed: Math.round(owed),
          war: !!war,
        },
      });
      diplomacy.remember(r.p.ref, q, {
        name: "what their people held, taken",
        value: -0.25,
        year,
        source: event,
      });
    }
  }

  // 5. Debt served: interest and a part of the principal to each people abroad, in grain from the seat; refused where it cannot be.
  for (const r of reads.values()) {
    const m = r.m,
      p = r.p;
    if (m.home > 0) m.home = Math.max(0, m.home - Math.ceil(m.home / FINANCE.term));
    const abroad = m.held.reduce((s, [, n]) => s + n, 0),
      sm = markets.get(p.seat),
      seat = ctx.provinces.get(p.seat);
    if (abroad > 0 && sm && seat) {
      const due = Math.floor((abroad * m.coupon) / 10_000),
        back = Math.floor(abroad / FINANCE.term),
        spare = Math.floor(sm.food(FOODS) - CREDIT.keep * mouths(seat, ctx.life)),
        budget = Math.max(0, Math.floor(spare / 2)),
        pays = Math.min(due + back, budget);
      m.missed = due > 0 && pays < due / 2 ? m.missed + 1 : 0;
      let left = pays;
      const next: [Ref, number][] = [];
      for (const [q, n] of m.held) {
        const holder = reads.get(q),
          hm = holder ? markets.get(holder.p.seat) : undefined,
          mine = Math.min(left, Math.floor((pays * n) / abroad));
        let sent = 0;
        if (hm && mine > 0)
          for (const g of [G.grain, G.wild, G.meat]) {
            const k = Math.min(mine - sent, sm.stock[g]!);
            if (k > 0) sent += hm.move("in", g, sm.move("out", g, k));
          }
        left -= sent;
        m.paid += sent;
        if (holder) holder.m.income += sent;
        // (Interest first; what is left of it pays the debt down; interest unpaid is owed besides.)
        const interest = Math.floor((n * m.coupon) / 10_000),
          owes = Math.round(n + interest - sent);
        if (owes >= 1) next.push([q, owes]);
      }
      m.held = next;
    } else m.missed = 0;
    const y = yieldRead(ctx, r, year);
    m.rate = Math.round(y.rate * 10_000);
    // Refused: unpaid too long; or crushed by it; or beaten in a war with years of takings owed.
    const owed = debtOf(m),
      beaten = wars.hotOf(p.ref).some((w) => w.ended === year && lost(world, w, p.ref)),
      refuse =
        m.held.length > 0 &&
        (m.missed >= FINANCE.missed ||
          (m.missed >= 1 && y.burden >= FINANCE.crushed) ||
          (beaten && y.burden >= FINANCE.full));
    if (refuse) refuseDebt(ctx, store, r, reads, year, owed, beaten);
  }

  // 6. Debt sold: for a war, for a hungry seat, to arm against a way it fears.
  for (const r of reads.values()) {
    if (!r.banking) continue;
    const p = r.p,
      m = r.m,
      seat = ctx.provinces.get(p.seat),
      sm = markets.get(p.seat);
    if (!seat || !sm || credit?.faithless(p.ref, year)) continue;
    const men = fieldedOf(ctx, p),
      keep = CREDIT.season * men * ctx.life.appetite,
      fighting = wars.fighting(p.ref);
    for (const w of fighting) {
      if (credit?.chest(p.ref, w.ref) || m.chests?.some(([x]) => x === w.ref)) continue;
      const want = Math.ceil(keep * (0.5 + r.trust));
      if (want < 50) continue;
      const foe = w.attacker === p.ref ? w.defender : w.attacker,
        sale = sell(ctx, r, reads, relations, want, "war", year, { war: w.event, foe });
      if (sale) m.chests = [...(m.chests ?? []), [w.ref, sale] as [Ref, Ref]].slice(-3);
    }
    const hunger = Math.ceil(CREDIT.months * mouths(seat, ctx.life) - sm.food(FOODS));
    if (hunger >= 50 && seat.lastFamine) sell(ctx, r, reads, relations, hunger, "hunger", year, {});
    const fear = m.fears[0];
    if (fear && fear.level >= FINANCE.armAt * 100 && !fighting.length) {
      const want = Math.ceil(FINANCE.arm * keep * (fear.level / 100));
      if (want >= 50) sell(ctx, r, reads, relations, want, "arms", year, { feared: fear.of });
    }
  }

  // 7. Shares held abroad: each people's holding of each realm it meets moves toward what is wanted of it.
  for (const r of reads.values()) {
    r.m.worthWas = r.m.worth;
    r.m.worth = r.banking ? listedWorth(ctx, r.p) : 0;
  }
  const wants = new Map<string, Map<Ref, number>>();
  for (const rel of relations) {
    const a = reads.get(rel.a),
      b = reads.get(rel.b);
    if (!a || !b || wars.between(rel.a, rel.b)) continue;
    for (const [holder, issuer] of [
      [a, b],
      [b, a],
    ] as const) {
      if (issuer.m.worth <= 0 || !holder.banking) continue;
      if (rel.opinion < 0 || burntBy(holder.m, issuer.p.ref, year)) continue;
      const fear = Math.max(
          fearOf(world, holder.p.ref, issuer.p.ref),
          fearOf(world, issuer.p.ref, holder.p.ref),
        ),
        gain = dmath.clamp(
          issuer.m.worth / Math.max(1, issuer.m.worthWas || issuer.m.worth),
          0.5,
          1.5,
        ),
        mine = holder.faring.rich * holder.faring.people,
        theirs = issuer.faring.rich * issuer.faring.people,
        size = Math.min(1, (2 * mine) / Math.max(1, mine + theirs)),
        want =
          FINANCE.stake *
          openTo(world, issuer) *
          openTo(world, holder) *
          Math.min(1, 0.5 + rel.opinion) *
          gain *
          (1 - fear) *
          (1 - fear) *
          size;
      (wants.get(issuer.p.ref) ?? wants.set(issuer.p.ref, new Map()).get(issuer.p.ref)!).set(
        holder.p.ref,
        want,
      );
    }
  }
  for (const r of reads.values()) {
    const m = r.m,
      want = wants.get(r.p.ref),
      now = new Map<Ref, number>(m.shares);
    if (!want && !m.shares.length && !m.rest) continue;
    for (const q of new Set([...now.keys(), ...(want?.keys() ?? [])])) {
      const to = (want?.get(q) ?? 0) * 10_000,
        was = now.get(q) ?? 0;
      now.set(q, Math.round(was + FINANCE.stakePace * (to - was)));
    }
    let list = [...now]
      .filter(([, n]) => n >= 20)
      .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
    // (Those past the few kept by name are counted together.)
    m.rest = Math.round(0.8 * m.rest) + list.slice(FINANCE.kept).reduce((s, [, n]) => s + n, 0);
    if (m.worth <= 0) m.rest = 0;
    list = list.slice(0, FINANCE.kept);
    const sum = list.reduce((s, [, n]) => s + n, 0) + m.rest,
      most = FINANCE.abroad * 10_000;
    if (sum > most) {
      list = list.map(([q, n]) => [q, Math.round((n * most) / sum)] as [Ref, number]);
      m.rest = Math.round((m.rest * most) / sum);
    }
    m.shares = list;
    // What its works pay those who hold them abroad comes home to them (reckoned, in grain's worth: no grain moves for it).
    for (const [q, n] of list) {
      const holder = reads.get(q);
      if (holder) holder.m.income += Math.round((n / 10_000) * m.worth * FINANCE.payout);
    }
  }
}

/** How open a realm is to strangers' holdings: how far it binds itself, its law on strangers, and how little it holds in common. */
function openTo(world: World, r: Read): number {
  const strangers = orderOf(world)?.of(r.p.ref)?.laws[LAW_OF.strangers] ?? 1;
  return dmath.clamp(r.trust + 0.15 * (strangers - 1), 0, 1) * (1 - r.way[4]);
}

/** Whether a realm lost a war now ended: the attacker that did not win its prize, the defender that lost it. */
function lost(world: World, w: { peace: Ref | null; attacker: Ref; defender: Ref }, realm: Ref) {
  const won = w.peace ? (world.events.get(w.peace)?.data as { won?: boolean } | null)?.won : false;
  return w.attacker === realm ? !won : w.defender === realm ? !!won : false;
}

/** A realm sells debt: its own people take a share, peoples abroad the rest as each is willing and able. The sale's event, if any sold. */
function sell(
  ctx: PopulationContext,
  r: Read,
  reads: ReadonlyMap<string, Read>,
  relations: readonly Relation[],
  want: number,
  why: "war" | "hunger" | "arms",
  year: number,
  by: { war?: Ref; foe?: Ref; feared?: Ref },
): Ref | null {
  const { world } = ctx,
    m = r.m,
    p = r.p,
    y = yieldRead(ctx, r, year),
    markets = marketsOf(world),
    wars = warsOf(world);
  if (y.rate > FINANCE.shut || y.burden >= FINANCE.full) return null;
  const ways = waysRead(cultureOf(world).get(p.seat)),
    // (A hungry seat's own people have no grain to lend it.)
    homeShare =
      why === "hunger"
        ? 0
        : dmath.clamp(
            FINANCE.home + FINANCE.homeSpread * r.way[3] + FINANCE.homeThrift * (ways.thrift - 0.5),
            0.1,
            0.9,
          ),
    home = Math.floor(want * homeShare),
    sm = markets.get(p.seat)!;
  // Peoples abroad: of realms it meets that think no ill of it, are at peace with it, know banking, bind themselves, were not cost
  // by it, and do not fear its way; the readier where it fights a realm whose way they fear.
  const buyers: { q: Read; weight: number; spare: number; backs: number }[] = [];
  if (r.trust >= 0.3)
    for (const rel of relations) {
      if (rel.a !== p.ref && rel.b !== p.ref) continue;
      const q = reads.get(rel.a === p.ref ? rel.b : rel.a);
      if (!q || !q.banking || q.trust < 0.3 || rel.opinion < 0) continue;
      if (q.p.ref === by.foe || wars.between(q.p.ref, p.ref) || burntBy(q.m, p.ref, year)) continue;
      const fear = Math.max(fearOf(world, q.p.ref, p.ref), fearOf(world, p.ref, q.p.ref));
      if (fear >= FINANCE.feared) continue;
      if (!m.held.some(([x]) => x === q.p.ref) && m.held.length >= FINANCE.holders) continue;
      const qm = markets.get(q.p.seat),
        qs = ctx.provinces.get(q.p.seat);
      if (!qm || !qs) continue;
      const spare = Math.floor(
          FINANCE.lend * (qm.stock[G.grain]! - Math.ceil(CREDIT.reserve * mouths(qs, ctx.life))),
        ),
        backs = by.foe ? fearOf(world, q.p.ref, by.foe) : 0;
      if (spare < 20) continue;
      buyers.push({
        q,
        spare,
        backs,
        weight:
          spare *
          (0.5 + q.trust) *
          (0.5 + Math.min(0.5, rel.opinion)) *
          (1 + FINANCE.backs * backs),
      });
    }
  buyers.sort((a, b) => b.weight - a.weight || (a.q.p.ref < b.q.p.ref ? -1 : 1));
  let left = want - home,
    slots = FINANCE.holders - m.held.length;
  const bought: { q: Read; n: number; backs: number }[] = [];
  for (const b of buyers) {
    if (left < 20) break;
    const has = m.held.find(([x]) => x === b.q.p.ref);
    if (!has && slots <= 0) continue;
    const n = Math.min(left, b.spare),
      qm = markets.get(b.q.p.seat)!;
    sm.move("in", G.grain, qm.move("out", G.grain, n));
    if (has) has[1] += n;
    else {
      m.held.push([b.q.p.ref, n]);
      slots--;
    }
    left -= n;
    bought.push({ q: b.q, n, backs: b.backs });
  }
  const abroad = bought.reduce((s, b) => s + b.n, 0),
    sold = home + abroad;
  if (sold <= 0) return null;
  const before = debtOf(m) - abroad;
  m.coupon = Math.round((before * m.coupon + sold * y.rate * 10_000) / Math.max(1, before + sold));
  m.home += home;
  // (Too little to tell: it stands, without a telling. And a realm arming year on year tells of it once in ten.)
  if (sold < 50) return null;
  if (why === "arms" && m.soldIn !== undefined && year - m.soldIn < 10) return null;
  m.soldIn = year;
  const backer = bought
      .filter((b) => b.backs >= FINANCE.fearGone)
      .sort((a, b) => b.backs - a.backs)[0],
    factors: Factor[] = [
      {
        name:
          why === "war"
            ? "a war to fight"
            : why === "hunger"
              ? "a hungry seat"
              : "a way it fears, to arm against",
        value: want,
        contribution: 1,
        source: by.war ? { ref: by.war, role: "trigger", weight: 1 } : null,
      },
      ...y.parts.map((x) => ({
        name: x.name,
        value: x.value,
        contribution: -x.value,
        source: null,
      })),
    ],
    decision = world.decisions.record({
      rule: "finance.sell",
      subject: p.ref,
      outcome: { sold, home, abroad, rate: y.rate },
      score: 1 - y.rate / FINANCE.shut,
      threshold: 0,
      factors,
    }),
    event = world.events.emit({
      type: FINANCE_EVENTS.sold.type,
      subjects: [p.ref, ...bought.slice(0, 3).map((b) => b.q.p.ref)],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes: [{ ref: decision, role: "trigger", weight: 1 }],
      data: {
        realm: realmName(p),
        grain: sold,
        home,
        rate: Math.round(y.rate * 1000) / 10,
        why,
        abroad: bought.slice(0, 3).map((b) => realmName(b.q.p)),
        ...(by.foe && reads.get(by.foe) ? { foe: realmName(reads.get(by.foe)!.p) } : {}),
        ...(by.feared && reads.get(by.feared)
          ? { feared: realmName(reads.get(by.feared)!.p) }
          : {}),
        ...(backer ? { backer: realmName(backer.q.p) } : {}),
      },
    });
  m.sale = event;
  // (Whose people lent it in its war against a realm they fear: remembered kindly by the one, ill by the other.)
  if (backer && by.foe) {
    diplomacyOf(world).remember(p.ref, backer.q.p.ref, {
      name: "its war paid for by their people",
      value: 0.15,
      year,
      source: event,
    });
    diplomacyOf(world).remember(by.foe, backer.q.p.ref, {
      name: "an enemy's war paid for by their people",
      value: -0.2,
      year,
      source: event,
    });
  }
  return event;
}

/** A realm refuses its debt: its people's holdings and every people's abroad lost; remembered by all who lend. */
function refuseDebt(
  ctx: PopulationContext,
  _store: FinanceStore,
  r: Read,
  reads: ReadonlyMap<string, Read>,
  year: number,
  owed: number,
  beaten: boolean,
): void {
  const { world } = ctx,
    m = r.m,
    p = r.p,
    holders = m.held.filter(([q]) => reads.has(q)),
    event = world.events.emit({
      type: FINANCE_EVENTS.refused.type,
      subjects: [p.ref, ...holders.slice(0, 3).map(([q]) => q)],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes: m.sale ? [{ ref: m.sale, role: "enabler", weight: 1 }] : [],
      data: {
        realm: realmName(p),
        owed: Math.round(owed),
        home: Math.round(m.home),
        abroad: holders.slice(0, 3).map(([q]) => realmName(reads.get(q)!.p)),
        beaten,
        missed: m.missed,
      },
    });
  for (const [q, n] of holders) {
    const holder = reads.get(q)!;
    burn(holder.m, p.ref, year);
    const lostEvent = world.events.emit({
      type: FINANCE_EVENTS.lost.type,
      subjects: [q, p.ref],
      place: ctx.provinces.get(holder.p.seat)?.ref ?? null,
      causes: [{ ref: event, role: "trigger", weight: 1 }],
      data: { realm: realmName(holder.p), of: realmName(p), owed: Math.round(n) },
    });
    diplomacyOf(world).remember(p.ref, q, {
      name: "debts repudiated",
      value: -0.3,
      year,
      source: lostEvent,
    });
  }
  // (Its own savers ruined: their grievance against their realm, as when a house of lending fails.)
  if (m.home > 0) {
    const realms = politiesOf(world),
      before = realms.discontent(p.seat);
    realms.setDiscontent(p.seat, { level: Math.max(before.level, 0.4), cause: event });
  }
  creditOf(world)?.defaults.push({ realm: p.ref, year, event });
  m.home = 0;
  m.held = [];
  m.coupon = 0;
  m.missed = 0;
  m.refusal = event;
}

/** Every ten years a realm's ownership moves partway toward what its law, its ways, how it is held and what it sees ask of it. */
function weighOwn(
  ctx: PopulationContext,
  r: Read,
  reads: ReadonlyMap<string, Read>,
  year: number,
): void {
  const { world } = ctx,
    p = r.p,
    m = r.m;
  if ((year + (Number(p.ref.split(":")[2]) % 10)) % 10 !== 0) return;
  const o = orderOf(world)?.of(p.ref),
    ways = waysRead(cultureOf(world).get(p.seat)),
    anchor = firstOwn(o?.laws[LAW_OF.land] ?? 0, ways, ctx.generated.life.people?.body),
    voice = r.way[1],
    top = m.fears[0],
    other = top ? reads.get(top.of) : undefined,
    overthrown = o?.taught?.find((x) => !x.of && x.what === "overthrown" && year - x.year < 10),
    ruined =
      m.refusal &&
      creditOf(world)?.defaults.some((d) => d.event === m.refusal && year - d.year < 20);
  // Rulers overthrown: what was theirs is shared out, and where it lay with a few, taken for all, the more as its people do not
  // live by trade. It lasts: a lean on both numbers that fades over generations.
  if (overthrown) {
    const few = 1 - m.own[0]! / 100,
      lean = (m.lean ??= [0, 0]);
    lean[0] = Math.max(lean[0]!, FINANCE.shared0);
    lean[1] = Math.max(lean[1]!, Math.round(FINANCE.taken0 * few * (1 - ways.trade)));
  }
  for (const k of OWN_KINDS) {
    const i = OWN[k],
      now = m.own[i]! / 100,
      // (Where many decide, many come to hold; where works are listed and few decide, they gather to the few.)
      held = k === "spread" ? 0.35 * (voice - 0.4) - (m.worth > 0 && voice < 0.45 ? 0.1 : 0) : 0,
      // (A people drawn to a way seen to work better moves toward it; those who would lose by it pull the other way.)
      drawn = top && other ? FINANCE.follows * (top.drawn / 100) * (other.way[3 + i]! - now) : 0,
      guard =
        top && k === "common"
          ? top.who === 2 || top.who === 3
            ? -0.1 * (top.level / 100)
            : top.who === 4
              ? 0.1 * (top.level / 100)
              : 0
          : 0,
      // (Rulers overthrown: what was theirs shared out. Savers ruined by a debt refused: more looked for from the realm.)
      shaken = (m.lean?.[i] ?? 0) / 100 + (ruined && k === "common" ? 0.08 : 0),
      target = dmath.clamp(anchor[i]! + held + drawn + guard + shaken, 0, 1),
      gap = target - now;
    if (Math.abs(gap) < FINANCE.ownLeast) continue;
    const to = Math.round(
      dmath.clamp(now + FINANCE.ownPace * (1 - 0.5 * ways.tradition) * gap, 0, 1) * 100,
    );
    if (to === m.own[i]) continue;
    m.own[i] = to;
    if (ownBand(k as Own, to / 100) === ownBand(k as Own, now)) continue;
    const factors: Factor[] = [
        {
          name: "what its law on land and its people's ways ask",
          value: anchor[i]!,
          contribution: anchor[i]! - now,
          source: null,
        },
        ...(held
          ? [
              {
                name: "how widely its choices are carried",
                value: voice,
                contribution: held,
                source: o?.heldEvents?.[HOLD.voice]
                  ? { ref: o.heldEvents[HOLD.voice]!, role: "enabler" as const, weight: 1 }
                  : null,
              },
            ]
          : []),
        ...(drawn && other
          ? [
              {
                name: `how ${realmName(other.p)} is seen to fare`,
                value: top!.works / 100,
                contribution: drawn,
                source: null,
              },
            ]
          : []),
        ...(guard
          ? [
              {
                name: `what ${LOSERS[top!.who]} would lose`,
                value: top!.loss / 100,
                contribution: guard,
                source: m.toldEvent
                  ? { ref: m.toldEvent, role: "pressure" as const, weight: 1 }
                  : null,
              },
            ]
          : []),
        ...(shaken
          ? [
              {
                name: m.lean?.[i] ? "its rulers overthrown" : "its savers ruined by a debt refused",
                value: 1,
                contribution: shaken,
                source: overthrown?.event
                  ? { ref: overthrown.event, role: "trigger" as const, weight: 1 }
                  : m.refusal
                    ? { ref: m.refusal, role: "trigger" as const, weight: 1 }
                    : null,
              },
            ]
          : []),
      ],
      decision = world.decisions.record({
        rule: "finance.owned",
        subject: p.ref,
        outcome: { own: k, from: Math.round(now * 100), to },
        score: Math.abs(gap),
        threshold: FINANCE.ownLeast,
        factors,
      });
    (m.ownEvents ??= [null, null])[i] = world.events.emit({
      type: FINANCE_EVENTS.owned.type,
      subjects: [p.ref],
      place: ctx.provinces.get(p.seat)?.ref ?? null,
      causes: [{ ref: decision, role: "trigger", weight: 1 }],
      data: { realm: realmName(p), own: k, from: Math.round(now * 100), to, now: [...m.own] },
    });
  }
  if (m.lean) {
    m.lean = m.lean.map((x) => Math.trunc(x * FINANCE.leanKept));
    if (m.lean.every((x) => x === 0)) delete m.lean;
  }
}

/** Teach a peopled world its realms' money and their fears. */
export function installFinance(world: World, ctx: () => PopulationContext): FinanceStore {
  const store = world.register(new FinanceStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "189.finance.year", every: YEAR, run: (t) => financeYear(ctx(), t) });
  return store;
}
