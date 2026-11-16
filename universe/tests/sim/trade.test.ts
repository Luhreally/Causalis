// Trade's last sweep, year by year (p87, sim/trade): its stores stand on a peopled world, a slump idles a realm's crafts only once
// money can be held and its harvest falls short, what the economy reads off machines, plans and smoke, and a town's heart read by
// the same rule the town is built by. Juniper's realms forty years on, worked by these systems alone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, type SimTime, type World } from "../../src/kernel/index.ts";
import { CYCLE, MONEY_FORMS } from "../../src/rules/index.ts";
import {
  CAPITAL_STORE,
  COIN,
  COIN_STORE,
  CY,
  CYCLE_STORE,
  PLAN_STORE,
  RENT_STORE,
  RT,
  TRADE_STORES,
  craftsKept,
  cycleYear,
  idleOf,
  loreOf,
  machinesAtWork,
  moneyStore,
  politiesOf,
  populationContext,
  rentYear,
  topLevel,
  tradeStore,
  type Polity,
} from "../../src/sim/index.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("juniper", 40, { start: "spread" });
const at = (y: number) => (y * YEAR) as SimTime;
const greatest = (w: World): Polity => {
  const ctx = populationContext(w),
    people = (p: Polity) => p.members.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0);
  return [...politiesOf(w).living()].sort(
    (a, b) => people(b) - people(a) || (a.ref < b.ref ? -1 : 1),
  )[0]!;
};

test("trade's stores stand on a world, a row a land or a realm at most", () => {
  for (const [name] of TRADE_STORES) assert.ok(tradeStore(world, name), name);
  const ctx = populationContext(world),
    lands = ctx.provinces.all().length,
    realms = politiesOf(world).living().length;
  for (const [name] of TRADE_STORES)
    assert.ok(
      tradeStore(world, name)!.size <= lands + realms,
      `${name} holds no more than one row each`,
    );
});

test("a short harvest idles a realm's crafts once its money can be held, and the economy and its people read it", () => {
  const ctx = populationContext(world),
    p = greatest(world),
    cycles = tradeStore(world, CYCLE_STORE)!,
    coins = moneyStore(world, COIN_STORE)!;
  // As it stands: a usual year, whatever its money.
  cycleYear(ctx, at(40));
  const row = cycles.get(p.ref)!;
  assert.ok(row, "the realm's year is kept");
  // Its usual harvest twice what it reaped, under barter: hunger, never idle hands.
  const usualTwice = [...row];
  usualTwice[CY.usual] = 2 * Math.max(1, row[CY.food]!);
  usualTwice[CY.slack] = 0;
  cycles.set(p.ref, usualTwice);
  const coin = coins.get(p.ref),
    asBarter = [...(coin ?? new Array(14).fill(0))];
  asBarter[COIN.form] = MONEY_FORMS.indexOf("barter");
  coins.set(p.ref, asBarter);
  cycleYear(ctx, at(40));
  assert.equal(idleOf(world, p.ref), 0);
  // Under notes: idle hands, no more than the most, and its lands' crafts make the less.
  cycles.set(p.ref, usualTwice);
  const asPaper = [...asBarter];
  asPaper[COIN.form] = MONEY_FORMS.indexOf("paper");
  coins.set(p.ref, asPaper);
  cycleYear(ctx, at(40));
  const idle = idleOf(world, p.ref);
  assert.ok(idle > 0 && idle <= CYCLE.most, `${idle}`);
  assert.ok(craftsKept(world, p.members[0]!) < 1);
  if (coin) coins.set(p.ref, coin);
});

test("machines at a land's tasks make its crafters more; a plan's cost makes them less", () => {
  const p = greatest(world),
    c = p.members[0]!,
    plans = tradeStore(world, PLAN_STORE)!;
  plans.set(p.ref, [500, 500, 0, 0, 0, 1, 1, 800]);
  const kept = craftsKept(world, c);
  tradeStore(world, CAPITAL_STORE)!.set(c, [800, 500, 0, 0, 0, 0, 0]);
  assert.ok(Math.abs(machinesAtWork(world, c) - 2) < 1e-9);
  plans.set(p.ref, [500, 500, 100, 100, 200, 1, 1, 800]);
  assert.ok(Math.abs(craftsKept(world, c) - kept * 0.8) < 1e-9);
  tradeStore(world, CAPITAL_STORE)!.drop(c);
  tradeStore(world, PLAN_STORE)!.drop(p.ref);
});

test("a town's heart is read by the same rule its town is built by", () => {
  const ctx = populationContext(world),
    lore = loreOf(world);
  for (let y = 40; y < 45; y++) rentYear(ctx, at(y));
  const rents = tradeStore(world, RENT_STORE)!;
  let read = 0;
  for (const key of rents.keys()) {
    const c = Number(key),
      row = rents.get(c)!,
      k = (id: string) => id.split("|").some((x) => !!lore.get(c, x));
    assert.equal(row[RT.level], topLevel(k, row[RT.people]!, false));
    assert.ok(row[RT.rent]! >= 0);
    read++;
  }
  assert.ok(read > 0, "some land's town is read");
});
