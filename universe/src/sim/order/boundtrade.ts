// The trade in bound people between realms (rules/boundtrade.ts): once in five years, in its turn, a realm whose law allows
// bondage looks over the lands its trade reaches for bound hands worth more in the land of its own where a bound hand keeps
// his holder the most than where they are held, and buys them: they are moved (a passage in the lands' histories), the seller
// land's bound are the fewer and the buying land's the more, and
// the buyer's treasury pays the seller's. Nothing kept: the lands' bonds and the passage are the record.
import {
  defineEventType,
  defineStream,
  yearOfMoment,
  type Factor,
  type SimTime,
} from "../../kernel/index.ts";
import { BOUND_TRADE, boundPrice, boundSale } from "../../rules/index.ts";
import type { PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { FISC, TREASURY_STORE, moneyStore, refNumber } from "../money/kept.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { captiveWorthOf } from "../society/kept.ts";
import { warsOf } from "../war/war.ts";
import { LAW_OF } from "./laws.ts";
import {
  BOND,
  bindNew,
  boundGone,
  carry,
  draw,
  landOf,
  type OrderStore,
  type RealmOrder,
} from "./order.ts";

export const BOUND_TRADE_EVENTS = {
  /** Bound people of one realm's land sold to another realm's holders. */
  sold: defineEventType("order.bound-sold", 4),
};

const SOLD = defineStream("order.boundsold");

export function boundTradeYear(
  ctx: PopulationContext,
  store: OrderStore,
  p: Polity,
  o: RealmOrder,
  t: SimTime,
): void {
  const { world } = ctx,
    year = yearOfMoment(t);
  if ((year + refNumber(p.ref)) % BOUND_TRADE.every !== 0) return;
  // (Its law allows bondage, it has held the bound before, and it does not make strangers citizens.)
  if (o.abolished !== null || !o.firsts[BOND.chattel] || o.laws[LAW_OF.strangers] === 2) return;
  // (Where among its lands a bound hand keeps his holder the most: hands scarce and held. Of equals, the lesser land.)
  let there = 0,
    to = -1;
  for (const c of p.members) {
    const v = captiveWorthOf(world, c);
    if (v !== null && (v > there || (v === there && to >= 0 && c < to))) {
      there = v;
      to = c;
    }
  }
  if (to < 0 || there <= BOUND_TRADE.keep + BOUND_TRADE.road) return;
  const seat = ctx.provinces.get(to);
  if (!seat) return;
  const markets = world.store<MarketStore>("economy.markets"),
    realms = politiesOf(world),
    wars = warsOf(world),
    seen = new Set<number>();
  let best: {
    cell: number;
    realm: Polity;
    here: number;
    bound: number;
    sale: ReturnType<typeof boundSale>;
  } | null = null;
  for (const i of markets.flowsAt(p.members)) {
    const f = markets.flows[i]!;
    for (const c of [f.from, f.to]) {
      if (seen.has(c)) continue;
      seen.add(c);
      const q = realms.of(c);
      if (!q || q === p || q.ended !== null) continue;
      const share = store.lands.get(c)?.shares[BOND.chattel] ?? 0;
      if (!(share > 0)) continue;
      const theirs = store.realms.get(q.ref);
      if (!theirs || theirs.abolished !== null || wars.between(p.ref, q.ref)) continue;
      const people = ctx.provinces.get(c)?.total() ?? 0,
        here = captiveWorthOf(world, c) ?? 0,
        sale = boundSale(here, there, share * people);
      if (sale.count > 0 && (!best || sale.gap > best.sale.gap))
        best = { cell: c, realm: q, here, bound: share * people, sale };
    }
  }
  if (!best) return;
  const span = ctx.generated.life.people?.body.span ?? 70,
    price = boundPrice(there, span),
    src = ctx.provinces.get(best.cell)!,
    drawn = draw(ctx, best.cell, best.sale.count, SOLD, best.cell, t);
  if (!drawn) return;
  const standing = store.lands.get(best.cell)?.cause ?? null,
    factors: Factor[] = [
      {
        name: "what a bound hand's work keeps his holder in its land where hands are scarcest",
        value: Math.round(there * 100) / 100,
        contribution: there,
        source: null,
      },
      {
        name: "what it keeps where they are held",
        value: Math.round(best.here * 100) / 100,
        contribution: -Math.max(best.here, BOUND_TRADE.keep),
        source: standing ? { ref: standing, role: "enabler", weight: 1 } : null,
      },
      {
        name: "the road and the guard",
        value: BOUND_TRADE.road,
        contribution: -BOUND_TRADE.road,
        source: null,
      },
    ],
    decision = world.decisions.record({
      rule: "order.bound-trade",
      subject: p.ref,
      outcome: { from: best.cell, count: drawn.n },
      score: best.sale.gap,
      threshold: 0,
      factors,
    }),
    // (The price, in grain: so many years of a worker's living a head, a year's living twelve months' grain.)
    owed = Math.round(drawn.n * price * 12),
    fisc = moneyStore(world, TREASURY_STORE),
    buyer = fisc?.get(p.ref),
    paid = buyer ? Math.min(owed, Math.max(0, buyer[FISC.reserve]!)) : 0,
    event = world.events.emit({
      type: BOUND_TRADE_EVENTS.sold.type,
      subjects: [p.ref, best.realm.ref, src.ref],
      place: src.ref,
      causes: [
        { ref: decision, role: "trigger", weight: 1 },
        ...(standing ? [{ ref: standing, role: "enabler" as const, weight: 0.5 }] : []),
      ],
      data: {
        realm: realmName(p),
        to,
        from: realmName(best.realm),
        count: drawn.n,
        price: Math.round(price * 10) / 10,
        paid,
      },
    }),
    beforeSrc = src.total(),
    beforeSeat = seat.total();
  carry(ctx, best.cell, to, drawn.moved, drawn.n, decision, event, t);
  boundGone(store, best.cell, drawn.n, beforeSrc);
  bindNew(store, to, BOND.chattel, drawn.n, beforeSeat);
  landOf(store, to).cause = event;
  if (fisc && buyer && paid > 0) {
    const mine = [...buyer];
    mine[FISC.reserve] = buyer[FISC.reserve]! - paid;
    fisc.set(p.ref, mine);
    const seller = fisc.get(best.realm.ref);
    if (seller) {
      const theirs = [...seller];
      theirs[FISC.reserve] = seller[FISC.reserve]! + paid;
      fisc.set(best.realm.ref, theirs);
    }
  }
}
