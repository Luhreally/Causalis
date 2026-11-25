import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, yearOfMoment, type Ref, type SimTime, type World } from "../../src/kernel/index.ts";
import { BOUND_TRADE } from "../../src/rules/index.ts";
import {
  BOND,
  BOUND_TRADE_EVENTS,
  landOf,
  orderOf,
  politiesOf,
  populationContext,
  type MarketStore,
} from "../../src/sim/index.ts";
import { boundTradeYear } from "../../src/sim/order/boundtrade.ts";
import { realmOrder } from "../../src/sim/order/order.ts";
import { BIND, BIND_STORE, moneyStore, refNumber } from "../../src/sim/money/kept.ts";
import { cultureOf } from "../../src/sim/culture/culture.ts";
import { why } from "../../src/causal/index.ts";
import { peopledWorld } from "../worlds.ts";

// The trade in bound people between realms (sim/order/boundtrade.ts; rules/boundtrade.ts). No land of first light, harrow or
// tide keeps enough of a bound hand's work for a sale to pay (the most, 0.2 of it at first light's year 1,000, where two
// realms hold the bound), so no run reaches it: the path is set up here. Two lands of two realms that trade; in the buyer's a
// bound hand is made to keep his holder much (hands scarce and held), the seller's holds many bound who keep theirs nothing.

function setUp(world: World) {
  const ctx = populationContext(world),
    realms = politiesOf(world),
    markets = world.store<MarketStore>("economy.markets"),
    store = orderOf(world)!,
    // (Of the roads between two realms' lands, the one whose sending land holds the most people: enough bound to sell.)
    flow = markets.flows
      .filter((f) => {
        const a = realms.of(f.from),
          b = realms.of(f.to);
        return !!a && !!b && a !== b && a.ended === null && b.ended === null;
      })
      .sort(
        (x, y) =>
          (ctx.provinces.get(y.from)?.total() ?? 0) - (ctx.provinces.get(x.from)?.total() ?? 0),
      )[0];
  assert.ok(flow, "two realms' lands trade");
  const buyer = realms.of(flow.to)!,
    seller = realms.of(flow.from)!,
    culture = cultureOf(world),
    o = realmOrder(store, buyer, culture.get(buyer.seat)),
    theirs = realmOrder(store, seller, culture.get(seller.seat)),
    binds = moneyStore(world, BIND_STORE)!,
    row: number[] = [];
  row[BIND.gain] = 800;
  row[BIND.hold] = 800;
  binds.set(flow.to, row);
  binds.set(flow.from, [0, 0, 0, 0, 0, 0]);
  landOf(store, flow.from).shares[BOND.chattel] = 0.5;
  o.abolished = null;
  theirs.abolished = null;
  o.firsts[BOND.chattel] ??= buyer.event;
  o.laws[1] = 0;
  // (Its turn: the year of five its own number falls in.)
  let t = world.now;
  while ((yearOfMoment(t) + refNumber(buyer.ref)) % BOUND_TRADE.every !== 0)
    t = (t + YEAR) as SimTime;
  return { ctx, store, buyer, seller, o, flow, t };
}

test("a realm whose bound hands keep their holders much buys the bound of a land its trade reaches, and both lands' bonds follow", () => {
  const world = peopledWorld("juniper", 60, { start: "spread" }),
    { ctx, store, buyer, seller, o, flow, t } = setUp(world),
    src = ctx.provinces.get(flow.from)!,
    before = src.total(),
    boundBefore = landOf(store, flow.from).shares[BOND.chattel]! * before,
    events = world.events.count;
  boundTradeYear(ctx, store, buyer, o, t);
  let sold: { id: Ref; data: unknown; subjects: readonly Ref[] } | null = null;
  for (let i = events; i < world.events.count; i++)
    if (world.events.at(i).type === BOUND_TRADE_EVENTS.sold.type) sold = world.events.at(i);
  assert.ok(sold, "a sale is told");
  const d = sold.data as { count: number; price: number; from: string; to: number };
  assert.ok(d.count >= BOUND_TRADE.least && d.count <= boundBefore, `sold ${d.count}`);
  assert.ok(d.price > 0);
  assert.deepEqual(sold.subjects.slice(0, 2), [buyer.ref, seller.ref]);
  // (They are moved: out of the seller's land, and its bound are the fewer by them.)
  assert.equal(src.total(), before - d.count);
  const boundAfter = landOf(store, flow.from).shares[BOND.chattel]! * src.total();
  assert.ok(boundAfter < boundBefore, `${boundBefore} -> ${boundAfter}`);
  assert.ok(landOf(store, d.to).shares[BOND.chattel]! > 0, "bound where they were bought");
  assert.match(why(world, sold.id).claim, /bought .* of the bound of/);
});

test("no one buys where the law has freed the bound, or where a bound hand keeps his holder nothing", () => {
  const world = peopledWorld("juniper", 60, { start: "spread" }),
    a = setUp(world),
    count = () => {
      let n = 0;
      for (let i = 0; i < world.events.count; i++)
        if (world.events.at(i).type === BOUND_TRADE_EVENTS.sold.type) n++;
      return n;
    };
  a.o.abolished = 50;
  boundTradeYear(a.ctx, a.store, a.buyer, a.o, a.t);
  assert.equal(count(), 0, "its law has freed the bound");
  a.o.abolished = null;
  for (const c of a.buyer.members) moneyStore(world, BIND_STORE)!.set(c, [0, 0, 0, 0, 0, 0]);
  boundTradeYear(a.ctx, a.store, a.buyer, a.o, a.t);
  assert.equal(count(), 0, "a bound hand keeps his holder nothing there");
});
