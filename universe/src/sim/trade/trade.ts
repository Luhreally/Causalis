// Trade's last sweep, year by year (p87; the rules are rules/trade.ts, what is kept ./kept.ts).
//   189.trade.cycle, a realm a year: its exchange (what its listed works earn, what its holders hope and ask, the worth bid on them,
//     and a crash where a falling year meets hopes far past the long run); then its years of plenty and want (a harvest short of its
//     usual, debts called in as a house of lending fails, its shares fallen, passed on through every hand where money can be held idle,
//     the deeper for what is owed), which leaves its crafts idle and its people aggrieved (sim/economy, sim/polity read it).
//   189.trade.capital, a land every five years in its turn, stepped five years at once: the share of its craft tasks its machines can
//     do (its finest fit, its sums a head, its works' power) and do (where a machine's year costs less than a crafter's), what its
//     crafters make the more for it, and what the machines' holders take (sim/money's shares read it).
//   189.trade.plan, a realm every five years in its turn: the share of what its lands make its plan shares out by need (what it holds
//     in common), what the plan errs by and the effort lost (sim/economy and sim/money's shares read it).
//   189.trade.smoke, a realm every five years in its turn: its price on smoke, who asks it and who refuses it, the share its works cut
//     and what that costs them (sim/climate/air and sim/ecology/ground read the cut).
//   189.trade.cartel, the world every five years, good by good: whether the few realms that make most of it can sell it abroad as
//     one (its makers' Herfindahl, how cheaply they watch each other cheat, what bars outside makers, buyers' substitutes), and what
//     they ask above; sim/economy's trade asks it on what they sell abroad, their carriers keeping it.
//   189.trade.rent, a land every five years in its turn: what its greatest town's heart is worth, the kind of home it is built to (the
//     same rule sim/town/fabric builds by) and what its ground earns its holders (sim/money's shares read it).
// Nothing is drawn: each is a reckoning from numbers the world keeps. A realm's rows go with it.
import {
  YEAR,
  defineEventType,
  dmath,
  yearOfMoment,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import {
  AUTOMATE,
  CARTEL,
  CYCLE,
  ELASTICITY,
  EXCHANGE,
  FOODS,
  FUEL_UNIT_KWY,
  G,
  GOODS,
  GOOD_USE,
  HEART,
  HOLD,
  HOLDS,
  MONEY_FORMS,
  OCC,
  SMOKE_PRICE,
  abatedFor,
  adoptWanted,
  automatable,
  cartelMarkup,
  cartelMembers,
  fitOf,
  heartCan,
  heartLevel,
  heartRent,
  hhi,
  hopesNext,
  machineCost,
  planCost,
  planKnows,
  shareWorth,
  slackNext,
  slackWanted,
  smokePrice,
  spendShare,
  sumsOf,
  townRent,
  type LandFacts,
  type MoneyForm,
} from "../../rules/index.ts";
import type { Province } from "../population/model.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";
import { familySizeOf } from "../population/life.ts";
import type { Market } from "../economy/market.ts";
import { energyPerHead } from "../economy/energy.ts";
import { loreOf } from "../lore/lore.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { interestsOf, type Group } from "../polity/interests.ts";
import { capacityOf } from "../order/order.ts";
import { holdsOf } from "../order/holds.ts";
import { creditOf } from "../credit/credit.ts";
import { financeOf } from "../finance/finance.ts";
import { rawSmoke } from "../climate/air.ts";
import {
  COIN,
  COIN_STORE,
  FISC,
  SHARE,
  SHARES_STORE,
  TREASURY_STORE,
  RowStore,
  moneyStore,
  refNumber,
  lawTurn,
  stepped,
} from "../money/kept.ts";
import {
  CAP,
  CAPITAL_STORE,
  CARTEL_STORE,
  CT,
  CY,
  CYCLE_STORE,
  DEMAND_STORE,
  DM,
  EX,
  EXCHANGE_STORE,
  PL,
  PLAN_STORE,
  RENT_STORE,
  RT,
  SM,
  SMOKE_STORE,
  TRADE_STORES,
  cartelKey,
  machineIncome,
  tradeStore,
} from "./kept.ts";

export const COMMERCE_EVENTS = {
  /** A realm's crafts stood idle for want of buyers: a slump. */
  slump: defineEventType("trade.slump", 3),
  /** A realm's listed works' shares fell from hopes far past what the long run bears. */
  crash: defineEventType("trade.crash", 3),
  /** A land's machines first did a quarter of its crafts' tasks. */
  machines: defineEventType("trade.machines", 2),
  /** A realm first made its works cut a fifth of their smoke. */
  smoke: defineEventType("trade.smoke", 2),
  /** Realms holding most of a world's making of a good first sold it abroad as one, dearer by a tenth or more. */
  cartel: defineEventType("trade.cartel", 3),
};

/** A land or a realm is weighed by the slower reckonings once in this many years, in its turn, stepped so many years at once. */
export const TRADE_EVERY = 5;
/** A slump is told at most once in this many years. */
export const SLUMP_TOLD_EVERY = 10;

const tell = (
  ctx: PopulationContext,
  type: string,
  p: Polity,
  data: Record<string, unknown>,
  factors: Factor[],
  score: number,
): Ref => {
  const { world } = ctx,
    decision = world.decisions.record({
      rule: type,
      subject: p.ref,
      outcome: data as never,
      score,
      threshold: 0,
      factors,
    });
  return world.events.emit({
    type,
    subjects: [p.ref],
    place: ctx.provinces.get(p.seat)?.ref ?? null,
    causes: [{ ref: decision, role: "trigger", weight: 1 }],
    data: { realm: realmName(p), ...data },
  });
};
const factor = (name: string, value: number): Factor => ({
  name,
  value,
  contribution: value,
  source: null,
});

/** A realm gone takes its rows with it; a land gone, its own. */
function dropGone(ctx: PopulationContext, living: readonly Polity[]): void {
  const alive = new Set<string>(living.map((p) => p.ref));
  for (const [name] of TRADE_STORES) {
    const s = tradeStore(ctx.world, name);
    if (!s) continue;
    for (const k of s.keys())
      if (k.startsWith("g")) continue;
      else if (k.includes(":") ? !alive.has(k) : !(ctx.provinces.get(Number(k))?.total() ?? 0))
        s.drop(k);
  }
}

/** A realm's lands with people and a market. */
function landsOf(ctx: PopulationContext, p: Polity): { prov: Province; m: Market }[] {
  const markets = marketsOf(ctx.world),
    out: { prov: Province; m: Market }[] = [];
  for (const c of p.members) {
    const prov = ctx.provinces.get(c),
      m = markets.get(c);
    if (prov && m && prov.total() > 0) out.push({ prov, m });
  }
  return out;
}

/** What a land knows, as the ages' readings ask it (an id, or ids joined by "|"). */
function knowerOf(world: World, cell: number): (id: string) => boolean {
  const lore = loreOf(world);
  return (id: string) => id.split("|").some((x) => !!lore.get(cell, x));
}

/** A land's facts as rules/ages.ts reads them, for its fit and its sums. */
function factsOf(world: World, prov: Province, m: Market): LandFacts {
  return {
    cell: prov.cell,
    people: prov.total(),
    farmers: prov.occupation(OCC.farmer),
    herders: prov.occupation(OCC.herder),
    sown: prov.knowsCultivation,
    driven: m.burned,
    machines: m.stock[G.machines]!,
    knows: knowerOf(world, prov.cell),
  };
}

// —— 189.trade.cycle ——————————————————————————————————————————————————————————————————————————————————————

/** Each realm's exchange, then its year of plenty or want. */
export function cycleYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    cycles = tradeStore(world, CYCLE_STORE),
    exchanges = tradeStore(world, EXCHANGE_STORE),
    demand = tradeStore(world, DEMAND_STORE);
  if (!cycles || !exchanges) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world),
    finance = financeOf(world),
    credit = creditOf(world),
    coins = moneyStore(world, COIN_STORE),
    fisc = moneyStore(world, TREASURY_STORE),
    shares = moneyStore(world, SHARES_STORE),
    living = [...realms.living()].sort((a, b) => (a.ref < b.ref ? -1 : 1));
  dropGone(ctx, living);
  // What each land owes the houses of lending (food's units), once.
  const owed = new Map<number, number>();
  for (const l of credit?.loans ?? [])
    if (l.ended === null) owed.set(l.cell, (owed.get(l.cell) ?? 0) + Math.max(0, l.owed));
  const failed = !!credit?.crisis && year - credit.crisis.year <= 1;
  for (const p of living) {
    const lands = landsOf(ctx, p);
    if (!lands.length) {
      cycles.drop(p.ref);
      exchanges.drop(p.ref);
      continue;
    }
    let food = 0,
      debt = 0,
      made = 0,
      bought = 0,
      capital = 0,
      spent = 0;
    for (const { prov, m } of lands) {
      for (const g of FOODS) food += m.book("made", g);
      debt += owed.get(prov.cell) ?? 0;
      for (let g = 0; g < GOODS.length; g++) {
        made += m.book("made", g) * m.price[g]!;
        bought += m.book("in", g) * m.price[g]!;
      }
      capital += machineIncome(world, prov.cell);
      spent += demand?.at(prov.cell, DM.real) ?? 0;
    }

    // Its exchange: where its works are listed (sim/finance listedWorth: banking known, works standing).
    const fm = finance?.of(p.ref),
      ex = exchanges.get(p.ref);
    let crashed = 0;
    if (fm && fm.worth > 0) {
      const earnings = (fm.worth / 2) * EXCHANGE.margin + capital,
        was = ex ? ex[EX.was]! : earnings,
        g = was > 0 ? dmath.clamp(earnings / was - 1, -0.5, 1) : 0,
        asked = Math.max(0.01, (fm.rate || 400) / 10_000 + EXCHANGE.premium),
        hopes0 = ex ? ex[EX.hopes]! / 10_000 : 0,
        long0 = ex ? ex[EX.long]! / 10_000 : 0,
        long = long0 + EXCHANGE.long * (g - long0),
        bubble = shareWorth(asked, hopes0) / shareWorth(asked, long),
        next = hopesNext(hopes0, long, g, bubble),
        years = shareWorth(asked, next.hopes),
        worth = earnings * years,
        fell = next.crash ? Math.max(0, earnings * shareWorth(asked, hopes0) - worth) : 0;
      crashed = fell / Math.max(1, made);
      if (next.crash && fell > 0)
        tell(
          ctx,
          COMMERCE_EVENTS.crash.type,
          p,
          { fell: Math.round(fell), bubble: Math.round(bubble * 100) },
          [
            factor("worth bid past what the long run bears", bubble),
            factor("a year its works earned less", g),
          ],
          bubble,
        );
      exchanges.set(p.ref, [
        years * 100,
        earnings,
        next.hopes * 10_000,
        long * 10_000,
        asked * 10_000,
        bubble * 100,
        worth,
        next.crash && fell > 0 ? year : ex ? ex[EX.crash]! : 0,
        next.crash && fell > 0 ? fell : ex ? ex[EX.fell]! : 0,
        earnings,
      ]);
    } else exchanges.drop(p.ref);

    // Its year of plenty or want.
    const cy = cycles.get(p.ref),
      usual = cy && cy[CY.usual]! > 0 ? cy[CY.usual]! : food,
      usualSpent = cy && cy[CY.usualSpent]! > 0 ? cy[CY.usualSpent]! : spent,
      coin = coins?.get(p.ref),
      form = (coin ? MONEY_FORMS[coin[COIN.form]!] : "barter") as MoneyForm,
      seatShares = shares?.get(p.seat),
      poor = seatShares
        ? (seatShares[SHARE.fifths]! +
            seatShares[SHARE.fifths + 1]! +
            seatShares[SHARE.fifths + 2]!) /
          1000
        : 0.45,
      spend = spendShare(poor),
      want = slackWanted({
        spent,
        usual: usualSpent,
        leverage: debt / Math.max(1, usual),
        failed,
        crashed,
        form,
        spend,
        imported: bought / Math.max(1, bought + made),
      }),
      spends = (form === "paper" || form === "credit") && (fisc?.at(p.ref, FISC.reserve) ?? 0) > 0,
      was = cy ? cy[CY.slack]! / 1000 : 0,
      slack = slackNext(was, want.slack, spends);
    let told = cy ? cy[CY.told]! : 0;
    if (slack >= CYCLE.told && want.slack >= CYCLE.told && year - told >= SLUMP_TOLD_EVERY) {
      told = year;
      tell(
        ctx,
        COMMERCE_EVENTS.slump.type,
        p,
        { idle: Math.round(slack * 100) },
        want.parts.map(([n, v]) => factor(n, v)),
        slack,
      );
    }
    const parts = want.parts.map(([, v]) => v);
    cycles.set(p.ref, [
      slack * 1000,
      usual + CYCLE.usual * (food - usual),
      food,
      Math.min(10, debt / Math.max(1, usual)) * 1000,
      parts[0]! * 1000,
      parts[1]! * 1000,
      parts[2]! * 1000,
      parts[3]! * 100,
      parts[5]! * 1000,
      spend * 1000,
      told,
      spent,
      usualSpent + CYCLE.usual * (spent - usualSpent),
      // (The idle hands its people are used to.)
      cy
        ? (cy[CY.usualSlack] ?? cy[CY.slack]!) +
          CYCLE.usual * (slack * 1000 - (cy[CY.usualSlack] ?? cy[CY.slack]!))
        : slack * 1000,
    ]);
  }
}

// —— 189.trade.capital ————————————————————————————————————————————————————————————————————————————————————

/** Each land's machines at the work, every TRADE_EVERY years in its turn, stepped that many years at once. */
export function capitalYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = tradeStore(world, CAPITAL_STORE);
  if (!store) return;
  const year = yearOfMoment(t),
    markets = marketsOf(world),
    realms = politiesOf(world),
    span = TRADE_EVERY;
  for (const prov of ctx.provinces.all()) {
    const c = prov.cell;
    if ((c + year) % span !== 0) continue;
    const m = markets.get(c),
      crafters = prov.occupation(OCC.crafter);
    if (!m || prov.total() <= 0) {
      store.drop(c);
      continue;
    }
    const was = store.get(c),
      f = factsOf(world, prov, m),
      e = energyPerHead(world, c),
      // (Driven as far as its works had the machines its engines wanted, and the power to turn them.)
      can = automatable(
        fitOf(f).mm,
        sumsOf(f).sums,
        (m.machineCover / 1000) * (e ? e.workCover : 0),
      );
    if (can <= 0 && !was) continue;
    const wage = Math.max(0, m.wage[OCC.crafter]!),
      kwYear = m.price[G.coal]! / FUEL_UNIT_KWY,
      cost = machineCost(m.price[G.machines]!, kwYear),
      wanted = adoptWanted(can, wage, cost),
      from = was ? was[CAP.share]! / 1000 : 0,
      share = from + stepped(AUTOMATE.pace, span) * (wanted - from),
      hands = share * crafters,
      // (What its holders take: what each hand's year done by machines saves, never more than the wage it stands in for.)
      income = hands * dmath.clamp(wage - cost, 0, wage);
    if (share < 1e-3 && can <= 0) {
      store.drop(c);
      continue;
    }
    let told = was ? was[CAP.told]! : 0;
    const realm = realms.of(c);
    if (!told && share >= AUTOMATE.told && crafters >= 50 && realm) {
      told = 1;
      tell(
        ctx,
        COMMERCE_EVENTS.machines.type,
        realm,
        { land: c, share: Math.round(share * 100), hands: Math.round(hands) },
        [
          factor("the tasks its machines can do", can),
          factor("what a crafter earns", wage),
          factor("what a hand's year by machines costs", cost),
        ],
        share,
      );
    }
    store.set(c, [can * 1000, share * 1000, cost * 1000, wage * 1000, income, hands, told]);
  }
}

// —— 189.trade.plan ———————————————————————————————————————————————————————————————————————————————————————

/** Each realm's plan, every TRADE_EVERY years in its turn. */
export function planYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = tradeStore(world, PLAN_STORE);
  if (!store) return;
  const year = yearOfMoment(t),
    finance = financeOf(world),
    lore = loreOf(world),
    markets = marketsOf(world),
    social = ctx.generated.life.people?.body.social ?? 0.8;
  for (const p of politiesOf(world).living()) {
    if (store.get(p.ref) && !lawTurn(p, year)) continue;
    const own = finance?.of(p.ref)?.own,
      planned = (own?.[1] ?? 0) / 100;
    if (planned < 0.02) {
      store.drop(p.ref);
      continue;
    }
    const lands = landsOf(ctx, p),
      seat = markets.get(p.seat),
      sm = seat ? factsOf(world, ctx.provinces.get(p.seat)!, seat) : null,
      sums = sm ? sumsOf(sm).sums : 0.02;
    let goods = 0;
    for (let g = 0; g < GOODS.length; g++)
      if (lands.some(({ m }) => m.book("made", g) > 0)) goods++;
    const knows = planKnows(
        capacityOf(ctx, p).value,
        !!lore.get(p.seat, "bureaucracy"),
        sums,
        lore.effect(p.seat, "signal"),
      ),
      cost = planCost(planned, lands.length, goods, knows, social);
    store.set(p.ref, [
      planned * 1000,
      knows * 1000,
      cost.errs * 1000,
      cost.shirk * 1000,
      cost.loss * 1000,
      lands.length,
      goods,
      social * 1000,
    ]);
  }
}

// —— 189.trade.smoke ——————————————————————————————————————————————————————————————————————————————————————

/** Each realm's price on its works' smoke, every TRADE_EVERY years in its turn, stepped that many years at once. */
export function smokeYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = tradeStore(world, SMOKE_STORE);
  if (!store) return;
  const year = yearOfMoment(t),
    finance = financeOf(world),
    lore = loreOf(world);
  for (const p of politiesOf(world).living()) {
    const was = store.get(p.ref);
    if (was && !lawTurn(p, year)) continue;
    const lands = landsOf(ctx, p);
    let harm = 0,
      people = 0;
    for (const { prov } of lands) {
      harm += rawSmoke(ctx, prov.cell) * prov.total();
      people += prov.total();
    }
    harm = people > 0 ? harm / people : 0;
    if (harm < 0.01 && !was) continue;
    const sway = new Map<Group, number>();
    for (const i of interestsOf(ctx, p, t)) sway.set(i.group, i.sway);
    const s = (g: Group) => sway.get(g) ?? 0,
      held = holdsOf(world, p.ref),
      common = (finance?.of(p.ref)?.own?.[1] ?? 0) / 100,
      works = !!lore.get(p.seat, "factories"),
      cap = capacityOf(ctx, p).value,
      sides = {
        harm,
        breathers: dmath.clamp(
          2 * (s("farmers") + s("herders") + s("crafters")) * (0.3 + 0.7 * held[HOLD.voice]!),
          0,
          1,
        ),
        holders: dmath.clamp(
          1.5 * (s("the court") + s("traders") + (works ? s("crafters") * 0.5 : 0)) * (1 - common),
          0,
          1,
        ),
        measured: dmath.clamp(
          cap *
            (0.3 +
              (lore.effect(p.seat, "writing") > 0 ? 0.35 : 0) +
              (lore.get(p.seat, "mathematics") ? 0.35 : 0)),
          0,
          1,
        ),
        knows: !!lore.get(p.seat, "medicine") || !!lore.get(p.seat, "germs"),
      },
      priced = smokePrice(sides),
      from = was ? was[SM.abated]! / 1000 : 0,
      abated = from + stepped(0.2, TRADE_EVERY) * (abatedFor(priced.price) - from);
    let told = was ? was[SM.told]! : 0;
    if (!told && abated >= SMOKE_PRICE.told) {
      told = 1;
      tell(
        ctx,
        COMMERCE_EVENTS.smoke.type,
        p,
        { cut: Math.round(abated * 100) },
        priced.parts.map(([n, v]) => factor(n, v)),
        priced.price,
      );
    }
    store.set(p.ref, [
      priced.price * 1000,
      abated * 1000,
      SMOKE_PRICE.cost * abated * abated * 1000,
      harm * 1000,
      sides.breathers * 1000,
      sides.holders * 1000,
      sides.measured * 1000,
      sides.knows ? 1000 : 0,
      told,
    ]);
  }
}

// —— 189.trade.rent ———————————————————————————————————————————————————————————————————————————————————————

/** Each land's heart and its ground's rent, every TRADE_EVERY years in its turn. */
export function rentYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = tradeStore(world, RENT_STORE);
  if (!store) return;
  const year = yearOfMoment(t),
    markets = marketsOf(world);
  for (const prov of ctx.provinces.all()) {
    const c = prov.cell;
    if ((c + year) % TRADE_EVERY !== 0) continue;
    const m = markets.get(c);
    let people = 0;
    for (const s of ctx.settlements.kept(c)) people = Math.max(people, s.population);
    if (!m || people < 200) {
      store.drop(c);
      continue;
    }
    const level = heartLevel(people, HOLDS, heartCan(knowerOf(world, c))),
      heart = heartRent(people, HOLDS[level]!),
      // (A worker-year is what the land's work fetches at its best: its crafters' or its tillers'.)
      wage = Math.max(m.wage[OCC.crafter]!, m.wage[OCC.farmer]!, m.wage[OCC.forager]!),
      rent = townRent(people, HOLDS[level]!, familySizeOf(world)) * wage;
    store.set(c, [heart * 10_000, level, people, rent, rent / HEART.carry]);
  }
}

// —— 189.trade.cartel ——————————————————————————————————————————————————————————————————————————————————————

/** A world's cartels among realms, good by good, every TRADE_EVERY years (a cartel's terms are argued over years, not each one). */
export function cartelYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = tradeStore(world, CARTEL_STORE);
  if (!store) return;
  const year = yearOfMoment(t);
  if (year % TRADE_EVERY !== 0) return;
  const realms = politiesOf(world),
    markets = marketsOf(world),
    lore = loreOf(world),
    living = [...realms.living()].sort((a, b) => (a.ref < b.ref ? -1 : 1)),
    at = new Map<string, number>(living.map((p, i) => [p.ref, i])),
    made = GOODS.map(() => new Array<number>(living.length).fill(0)),
    makers = new Array<number>(GOODS.length).fill(0);
  let lands = 0;
  for (const prov of ctx.provinces.all()) {
    if (prov.total() <= 0) continue;
    lands++;
    const m = markets.get(prov.cell),
      i = at.get(realms.of(prov.cell)?.ref ?? "");
    if (!m) continue;
    for (let g = 0; g < GOODS.length; g++) {
      const n = m.book("made", g);
      if (n <= 0) continue;
      makers[g]!++;
      if (i !== undefined) made[g]![i]! += n;
    }
  }
  for (let g = 0; g < GOODS.length; g++) {
    const key = cartelKey(g),
      was = store.get(key),
      all = made[g]!.reduce((a, b) => a + b, 0),
      // (Its whole making, the lands of no realm with it: they are outside makers too.)
      world_ = Math.max(all, 1),
      shares = made[g]!.map((n) => n / world_),
      { members, share } = cartelMembers(shares);
    if (!members.length || lands <= 0) {
      if (was) store.drop(key);
      continue;
    }
    const ps = members.map((i) => living[i]!),
      read = {
        share,
        within: hhi(members.map((i) => shares[i]!)),
        signal: ps.reduce((a, p) => a + lore.effect(p.seat, "signal"), 0) / ps.length,
        word: ps.reduce((a, p) => a + holdsOf(world, p.ref)[HOLD.word]!, 0) / ps.length,
        barred: dmath.clamp(1 - makers[g]! / lands, 0, 1),
        elasticity: ELASTICITY[GOOD_USE[GOODS[g]!.id]!],
      },
      c = cartelMarkup(read);
    if (c.markup <= 0) {
      if (was) store.drop(key);
      continue;
    }
    let told = was ? was[CT.told]! : 0;
    const since = was ? was[CT.since]! : year;
    if (!told && c.markup >= CARTEL.told) {
      told = 1;
      const decision = world.decisions.record({
        rule: COMMERCE_EVENTS.cartel.type,
        subject: ps[0]!.ref,
        outcome: { good: GOODS[g]!.name, markup: Math.round(c.markup * 100) } as never,
        score: c.markup,
        threshold: 0,
        factors: c.parts.map(([n, v]) => factor(n, v)),
      });
      world.events.emit({
        type: COMMERCE_EVENTS.cartel.type,
        // (An event names four at the most: the greatest of the cartel; its data names them all.)
        subjects: ps.slice(0, 4).map((p) => p.ref),
        place: ctx.provinces.get(ps[0]!.seat)?.ref ?? null,
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: {
          good: GOODS[g]!.name,
          realms: ps.map((p) => realmName(p)),
          share: Math.round(share * 100),
          markup: Math.round(c.markup * 100),
        },
      });
    }
    const serials = [0, 0, 0, 0, 0];
    members.forEach((i, k) => (serials[k] = refNumber(living[i]!.ref) + 1));
    store.set(key, [
      share * 1000,
      read.within * 1000,
      c.cohesion * 1000,
      read.barred * 1000,
      c.markup * 1000,
      ...serials,
      since,
      told,
    ]);
  }
}

export function installCommerce(world: World, ctx: () => PopulationContext): void {
  for (const [name, width] of TRADE_STORES) world.register(new RowStore(name, width));
  world.system({ key: "189.trade.cycle", every: YEAR, run: (t) => cycleYear(ctx(), t) });
  world.system({ key: "189.trade.capital", every: YEAR, run: (t) => capitalYear(ctx(), t) });
  world.system({ key: "189.trade.plan", every: YEAR, run: (t) => planYear(ctx(), t) });
  world.system({ key: "189.trade.smoke", every: YEAR, run: (t) => smokeYear(ctx(), t) });
  world.system({ key: "189.trade.rent", every: YEAR, run: (t) => rentYear(ctx(), t) });
  world.system({ key: "189.trade.cartel", every: YEAR, run: (t) => cartelYear(ctx(), t) });
}
