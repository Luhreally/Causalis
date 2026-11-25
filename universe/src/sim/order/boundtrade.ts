// The trade in bound people between realms (rules/boundtrade.ts): once in five years, in its turn, a realm whose law allows
// bondage, and whose people hold the bound or would bind those it buys had they taken them, looks over the lands its trade reaches for bound hands worth more in the land of its own where a bound hand keeps
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
import { cultureOf } from "../culture/culture.ts";
import {
  BOND,
  CAPTIVE_LINE,
  bindingWays,
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
  // (Its law has not freed the bound, and it does not make strangers citizens. And its people are such as hold others: it has
  // held the bound, or it would bind those it buys had it taken them in war (the captives rule's own weighing of its ways and
  // theirs, and what a bound hand keeps where it would hold him). Until 2026-11-25 it had to have held them before, by a land
  // it took: of first light's 394 realms at year 1,500 three had, with the bound held in five lands of the world, so a buyer
  // and a seller's land on one road never met and nothing was ever sold, there or on any world probed; but to buy them is
  // one of the ways a realm comes to hold the bound.)
  if (o.abolished !== null || o.laws[LAW_OF.strangers] === 2) return;
  const held = o.firsts[BOND.chattel] ?? null,
    culture = held ? null : cultureOf(world),
    mine = culture?.get(p.seat);
  if (!held && !mine) return;
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
    ways: number | null;
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
      if (!(sale.count > 0) || (best && !(sale.gap > best.sale.gap))) continue;
      let ways: number | null = null;
      if (!held) {
        const theirWays = culture!.get(c);
        if (!theirWays) continue;
        ways = bindingWays(world, o, p, mine!, theirWays, c, there).score;
        if (ways < CAPTIVE_LINE) continue;
      }
      best = { cell: c, realm: q, here, bound: share * people, sale, ways };
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
      ...(best.ways === null
        ? []
        : [
            {
              name: "a people such as hold strangers bound",
              value: Math.round(best.ways * 100) / 100,
              contribution: 0,
              source: null,
            },
          ]),
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
        ...(held ? {} : { first: true }),
      },
    }),
    beforeSrc = src.total(),
    beforeSeat = seat.total();
  carry(ctx, best.cell, to, drawn.moved, drawn.n, decision, event, t);
  boundGone(store, best.cell, drawn.n, beforeSrc);
  bindNew(store, to, BOND.chattel, drawn.n, beforeSeat);
  landOf(store, to).cause = event;
  o.firsts[BOND.chattel] ??= event;
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
