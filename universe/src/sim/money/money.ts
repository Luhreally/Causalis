// Money and the state, year by year (Round B; the rules are rules/money.ts and rules/labour.ts, what is kept is ./kept.ts).
//   186.money.labour, a land every five years in its turn (by its cell and the year), stepped five years at once: how far its
//     crafters and workers have bound themselves (guilds, unions) and what they ask; its rent and how its income is shared out (five
//     fifths); whom its holders would bind (Domar), which the order's year steps its serfs toward.
//   188.money.coin, a realm a year: what serves it as money, how much there is, how fast it turns over, the price level; a strained
//     treasury debases its coin or prints.
//   188.money.trade: its tariff and its sanctions, from those who gain and lose by trade and from its fears; what slips past them.
//   188.money.treasury: its taxes by base, its spending, its reserve and deficit (which sim/finance borrows against).
//   188.money.cover: its underwriters at sea and its pooled harvests, paid in and out of its seat's granary.
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
  COVER,
  FOODS,
  G,
  GOODS,
  GOOD_USE,
  HOLD,
  MONEY,
  OCC,
  ORGANISE,
  SHOP,
  TAX_BASES,
  TREASURY,
  WIND_MS,
  bindPull,
  canPool,
  canUnderwrite,
  holdersShare,
  lerner,
  lorenz,
  measurable,
  moneyForm,
  moneyGood,
  organised,
  priceLevel,
  rentOf,
  sanctionWanted,
  shipLoss,
  smuggled,
  tariffWanted,
  taxRates,
  taxResisted,
  velocityOf,
  MONEY_FORMS,
  type Earners,
  type MoneyForm,
  type TaxBase,
} from "../../rules/index.ts";
import type { Province } from "../population/model.ts";
import {
  marketsOf,
  mouths,
  provinceCapacity,
  type PopulationContext,
} from "../population/systems.ts";
import type { Market } from "../economy/market.ts";
import { loreOf } from "../lore/lore.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { interestsOf, type Group } from "../polity/interests.ts";
import { capacityOf, orderOf } from "../order/order.ts";
import { holdsOf } from "../order/holds.ts";
import { LAW_OF } from "../order/laws.ts";
import { creditOf } from "../credit/credit.ts";
import { debtOf, financeOf, stakesBetween } from "../finance/finance.ts";
import { fieldedOf } from "../war/war.ts";
import {
  BIND,
  BIND_STORE,
  COIN,
  COIN_STORE,
  COVER_STORE,
  DUTY,
  FISC,
  GUILD,
  LABOUR_STORE,
  MONEY_STORES,
  POOL,
  SHARE,
  SHARES_STORE,
  SMUGGLE,
  SMUGGLE_STORE,
  TARIFF_STORE,
  TREASURY_STORE,
  RowStore,
  barredOf,
  cartelOf,
  exciseOf,
  moneyStore,
  refNumber,
} from "./kept.ts";
import { intoxYear, prohibitionYear } from "./intox.ts";

export const MONEY_EVENTS = {
  /** What serves a realm as money changed: coin first struck, notes first issued, the lenders' claims passing as money. */
  coin: defineEventType("money.coin", 3),
  /** A strained treasury debased its coin or printed its notes by a fifth or more since last told. */
  debased: defineEventType("money.debased", 3),
  /** Prices rose a tenth or more in a year. */
  dearer: defineEventType("money.dearer", 2),
  /** A realm first laid a tax on a base. */
  taxed: defineEventType("money.taxed", 2),
  /** A realm first laid a tariff of a tenth or more; first shut its trade with a realm it fears. */
  tariff: defineEventType("money.tariff", 2),
  sanction: defineEventType("money.sanction", 3),
  /** Goods first slipped past a realm's borders in worth. */
  smuggling: defineEventType("money.smuggling", 2),
  /** A land's crafters first bound themselves in a guild; its workers in a union. */
  guild: defineEventType("money.guild", 2),
  union: defineEventType("money.union", 3),
  /** A realm's underwriters first wrote cover at sea; its lands first pooled their harvests. */
  underwriters: defineEventType("money.underwriters", 2),
  pool: defineEventType("money.pool", 2),
};

/** A land is weighed by the labour reckoning once in this many years, in its turn. */
export const LABOUR_EVERY = 5;

const at = (store: RowStore | null, key: string | number): number[] | null => {
  const r = store?.get(key);
  return r ? [...r] : null;
};
/** How much of the way toward a target a pace a year goes in `span` years. */
const stepped = (pace: number, span: number) => 1 - dmath.pow(1 - pace, span);

/** Workers in a land: all but those who depend on them. */
function workersOf(p: Province): number {
  return Math.max(1, p.total() - p.occupation(OCC.dependent));
}

/** The best a land's worker earns at the land's own work, at least a living. */
function outsideWage(ctx: PopulationContext, p: Province, m: Market): number {
  const living = (12 * mouths(p, ctx.life)) / workersOf(p);
  return Math.max(living, m.wage[OCC.farmer]!, m.wage[OCC.forager]!, m.wage[OCC.herder]!);
}

/** What a land made this year, at its own prices (grain's worth). */
function madeWorth(m: Market): number {
  let n = 0;
  for (let g = 0; g < GOODS.length; g++) n += m.book("made", g) * m.price[g]!;
  return n;
}

/** The goods its crafters make from others or win from the ground, which goods from abroad can undersell. */
const CRAFTED = GOODS.map((g, i) => [i, GOOD_USE[g.id]] as const)
  .filter(
    ([, u]) => u === "tools" || u === "clothes" || u === "holds" || u === "drives" || u === "metal",
  )
  .map(([i]) => i);

/** Each group's sway in a realm, read once a year (the few are the court, the army and the temple; the many all who work). */
type Sway = { farmers: number; crafters: number; traders: number; few: number; many: number };
/** The sways read this moment, kept for the moment's other systems (a pure reading: the same read twice). */
let SWAYS: { world: World; t: number; by: Map<string, Sway> } | null = null;
function swayOf(ctx: PopulationContext, p: Polity, t: SimTime): Sway {
  if (!SWAYS || SWAYS.world !== ctx.world || SWAYS.t !== t)
    SWAYS = { world: ctx.world, t, by: new Map() };
  const kept = SWAYS.by.get(p.ref);
  if (kept) return kept;
  const sway = new Map<Group, number>();
  for (const i of interestsOf(ctx, p, t)) sway.set(i.group, i.sway);
  const g = (x: Group) => sway.get(x) ?? 0;
  const read = {
    farmers: g("farmers") + g("herders"),
    crafters: g("crafters"),
    traders: g("traders"),
    few: g("the court") + g("the army") + g("the temple"),
    many: g("farmers") + g("herders") + g("crafters"),
  };
  SWAYS.by.set(p.ref, read);
  return read;
}

/** A realm's lands as its money sees them. */
type RealmRead = {
  readonly p: Polity;
  readonly lands: { readonly prov: Province; readonly m: Market }[];
  readonly seat: Market | undefined;
  readonly people: number;
  readonly workers: number;
  readonly made: number;
  /** What passes through its markets as money would (grain's worth a year): goods in and out of its lands, and a tenth of all made. */
  readonly dealt: number;
  readonly capacity: number;
};

function readRealm(ctx: PopulationContext, p: Polity): RealmRead {
  const markets = marketsOf(ctx.world),
    lands: { prov: Province; m: Market }[] = [];
  let people = 0,
    workers = 0,
    made = 0,
    dealt = 0;
  for (const c of p.members) {
    const prov = ctx.provinces.get(c),
      m = markets.get(c);
    if (!prov || !m || prov.total() <= 0) continue;
    lands.push({ prov, m });
    people += prov.total();
    workers += workersOf(prov);
    const mw = madeWorth(m);
    made += mw;
    dealt += 0.1 * mw;
    for (let g = 0; g < GOODS.length; g++)
      dealt += (m.book("in", g) + m.book("out", g)) * m.price[g]!;
  }
  return {
    p,
    lands,
    seat: markets.get(p.seat),
    people,
    workers,
    made,
    dealt,
    capacity: capacityOf(ctx, p).value,
  };
}

const tell = (
  ctx: PopulationContext,
  type: string,
  p: Polity,
  data: Record<string, unknown>,
  factors?: Factor[],
  score = 1,
): Ref => {
  const { world } = ctx,
    decision = factors
      ? world.decisions.record({
          rule: type,
          subject: p.ref,
          outcome: data as never,
          score,
          threshold: 0,
          factors,
        })
      : null;
  return world.events.emit({
    type,
    subjects: [p.ref],
    place: ctx.provinces.get(p.seat)?.ref ?? null,
    causes: decision ? [{ ref: decision, role: "trigger", weight: 1 }] : [],
    data: { realm: realmName(p), ...data },
  });
};

// —— 186.money.labour ————————————————————————————————————————————————————————————————————————————————————

/** A land's guilds, unions, shares and bondage, every LABOUR_EVERY years in its turn, stepped that many years at once. */
export function labourYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    guilds = moneyStore(world, LABOUR_STORE),
    shares = moneyStore(world, SHARES_STORE),
    binds = moneyStore(world, BIND_STORE);
  if (!guilds || !shares || !binds) return;
  const year = yearOfMoment(t),
    markets = marketsOf(world),
    realms = politiesOf(world),
    lore = loreOf(world),
    order = orderOf(world),
    finance = financeOf(world),
    g = ctx.generated,
    span = LABOUR_EVERY,
    caps = new Map<string, number>(),
    appetite = Math.max(1e-6, ctx.life.appetite);
  const peopleRoom = (c: number) => {
    const k = provinceCapacity(ctx, c);
    return (k.farm + k.forage) / appetite - (ctx.provinces.get(c)?.total() ?? 0);
  };
  for (const prov of ctx.provinces.all()) {
    const c = prov.cell;
    if ((c + year) % span !== 0) continue;
    const m = markets.get(c),
      pop = prov.total();
    if (!m || pop <= 0) {
      guilds.drop(c);
      shares.drop(c);
      binds.drop(c);
      continue;
    }
    const realm = realms.of(c),
      held = holdsOf(world, realm?.ref),
      o = realm ? order?.of(realm.ref) : undefined,
      workers = workersOf(prov),
      ratio = pop / workers,
      w = m.wage,
      outside = outsideWage(ctx, prov, m),
      livingWorker = (12 * mouths(prov, ctx.life)) / workers;

    // 5. Guilds and unions: crafters in shops bind themselves into a guild; in works, into a union.
    const works = !!lore.get(c, "factories"),
      perShop = works ? SHOP.works : SHOP.hands,
      crafters = prov.occupation(OCC.crafter),
      shops = crafters / perShop;
    let cIn = 0,
      cMade = 0;
    for (const x of CRAFTED) {
      cIn += m.book("in", x) * m.price[x]!;
      cMade += m.book("made", x) * m.price[x]!;
    }
    const imported = cIn / Math.max(1e-9, cIn + cMade),
      letters = dmath.clamp(
        0.6 * lore.effect(c, "writing") + 0.4 * lore.effect(c, "learning"),
        0,
        1,
      ),
      alone = lerner(shops, 0.9, 0, imported),
      asOne = lerner(shops, 0.9, 1, imported),
      gr = at(guilds, c) ?? [0, 0, 0, 0, 0, 0],
      wasGuild = gr[GUILD.guild]! / 1000,
      wasUnion = gr[GUILD.union]! / 1000,
      reach = {
        workers: crafters,
        perShop,
        letters,
        force: held[HOLD.force]!,
        voice: held[HOLD.voice]!,
      },
      guildTo = works ? 0 : organised({ ...reach, gain: asOne - alone }),
      unionTo = works ? organised({ ...reach, gain: alone + 0.05 }) : 0,
      guild = wasGuild + stepped(ORGANISE.pace, span) * (guildTo - wasGuild),
      union = wasUnion + stepped(ORGANISE.pace, span) * (unionTo - wasUnion),
      markup = lerner(shops, 0.9, guild, imported),
      unionWage = union * ORGANISE.share * Math.max(alone, 0.1);
    let told = gr[GUILD.told]!;
    if (realm && guild >= 0.3 && crafters >= 50 && !(told & 1)) {
      told |= 1;
      tell(ctx, MONEY_EVENTS.guild.type, realm, {
        land: c,
        crafters,
        strength: Math.round(guild * 100),
      });
    }
    if (realm && union >= 0.3 && crafters >= 50 && !(told & 2)) {
      told |= 2;
      tell(ctx, MONEY_EVENTS.union.type, realm, {
        land: c,
        crafters,
        strength: Math.round(union * 100),
      });
    }
    guilds.set(c, [guild * 1000, union * 1000, shops, markup * 1000, unionWage * 1000, told]);

    // 8. Rent, and how its income is shared out.
    const own = realm ? finance?.of(realm.ref)?.own : undefined,
      spread = (own?.[0] ?? 50) / 100,
      common = realm ? (own?.[1] ?? 20) / 100 : 0,
      grain = m.book("made", G.grain) * m.price[G.grain]!,
      herd =
        m.book("made", G.meat) * m.price[G.meat]! +
        m.book("made", G.wool) * m.price[G.wool]! +
        m.book("made", G.hides) * m.price[G.hides]!,
      rent =
        rentOf(grain, prov.occupation(OCC.farmer), w[OCC.farmer]!) +
        rentOf(herd, prov.occupation(OCC.herder), w[OCC.herder]!),
      bonds = order?.lands.get(c),
      bound = bonds
        ? Math.min(
            0.95,
            bonds.shares.reduce((a, b) => a + b, 0),
          )
        : 0,
      surplus = bound * workers * Math.max(0, w[OCC.farmer]! - livingWorker),
      landed = holdersShare(spread) * (1 - common),
      toAll = ((rent + surplus) * common) / pop,
      groups: Earners[] = [];
    for (const occ of [OCC.forager, OCC.farmer, OCC.herder, OCC.crafter, OCC.trader, OCC.leader]) {
      const n = prov.occupation(occ) * (1 - bound) * ratio * (1 - landed),
        wage =
          occ === OCC.leader
            ? Math.max(w[occ]!, TREASURY.clerks * outside)
            : occ === OCC.crafter
              ? w[occ]! * (1 + unionWage)
              : w[occ]!;
      groups.push({ people: n, each: wage / ratio + toAll });
    }
    groups.push({ people: bound * pop, each: (12 * mouths(prov, ctx.life)) / pop });
    if (landed > 0)
      groups.push({
        people: landed * pop,
        each: ((rent + surplus) * (1 - common)) / Math.max(1, landed * pop) + toAll,
      });
    const lz = lorenz(groups);
    shares.set(c, [
      ...lz.fifths.map((x) => x * 1000),
      lz.gini * 1000,
      lz.top * 1000,
      rent,
      (1000 * rent) / Math.max(1, grain + herd),
      landed * 1000,
    ]);

    // 9. Bondage, as Domar weighs it.
    if (!realm || !o) {
      binds.drop(c);
      continue;
    }
    let cap = caps.get(realm.ref);
    if (cap === undefined) caps.set(realm.ref, (cap = capacityOf(ctx, realm).value));
    // (Open land the bound could walk to: its own room, and half its neighbours', in this realm or out of it.)
    let room = Math.max(0, peopleRoom(c));
    for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
      const n = g.grid.neighbours[k]!;
      room += 0.5 * Math.max(0, peopleRoom(n));
    }
    const law = o.abolished !== null ? 0 : ([1, 0.5, 0][o.laws[LAW_OF.land] ?? 0] ?? 0),
      power = held[HOLD.force]! * cap * (0.6 + 0.4 * o.caste),
      open = room / pop,
      pull = bindPull({ wage: w[OCC.farmer]!, living: livingWorker, open, power, law }),
      tillers = (prov.occupation(OCC.farmer) + prov.occupation(OCC.herder)) / workers;
    binds.set(c, [
      pull.share * tillers * 1000,
      pull.gain * 1000,
      pull.hold * 1000,
      Math.min(10, open) * 1000,
      law * 1000,
      power * 1000,
    ]);
  }
}

// —— 188.money.coin ——————————————————————————————————————————————————————————————————————————————————————

/** What serves each realm as money, how much and what it buys. */
export function coinYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = moneyStore(world, COIN_STORE),
    fisc = moneyStore(world, TREASURY_STORE);
  if (!store) return;
  const year = yearOfMoment(t),
    lore = loreOf(world),
    credit = creditOf(world),
    living = politiesOf(world).living();
  dropGone(world, living);
  for (const p of living) {
    const r = readRealm(ctx, p),
      sm = r.seat;
    if (!sm || !r.lands.length) continue;
    const held = new Array<number>(GOODS.length).fill(0);
    let traders = 0;
    for (const { prov, m } of r.lands) {
      for (let g = 0; g < GOODS.length; g++) held[g] = held[g]! + m.stock[g]!;
      traders += prov.occupation(OCC.trader);
    }
    const was = at(store, p.ref),
      wasForm = was ? MONEY_FORMS[was[COIN.form]!]! : "barter",
      houses = credit ? credit.standing().filter((h) => p.members.includes(h.cell)).length : 0,
      found = moneyGood(sm.price, held),
      // (A realm that has struck coin keeps its metal as money while its markets run short of it.)
      metal = found >= 0 ? found : was && wasForm !== "barter" ? was[COIN.good]! : -1,
      form = moneyForm({
        currency: !!lore.get(p.seat, "currency"),
        writing: lore.effect(p.seat, "writing") > 0,
        banking: !!lore.get(p.seat, "banking"),
        clerks: !!lore.get(p.seat, "bureaucracy"),
        houses,
        metal,
      }),
      velocity = velocityOf(traders / Math.max(1, r.workers), lore.effect(p.seat, "signal")),
      made = Math.max(1, r.dealt),
      fr = fisc?.get(p.ref),
      // (What its treasury went short last year and did not borrow.)
      unmet = fr ? Math.max(0, fr[FISC.deficit]! - fr[FISC.borrowed]!) : 0,
      strained =
        !!fr && fr[FISC.reserve]! <= 0 && unmet > TREASURY.strained * Math.max(1, revenueOfRow(fr));
    let fine = was && wasForm === "metal" ? was[COIN.fine]! / 1e6 : 1,
      stock = was ? was[COIN.stock]! / 1000 : 0,
      level = was ? was[COIN.level]! / 1e6 : 1,
      seigniorage = 0,
      good = was ? was[COIN.good]! : -1,
      since = was && wasForm === form ? was[COIN.since]! : year;
    const before = level;
    if (form === "barter") {
      stock = 0;
      level = 1;
    } else if (form === "metal") {
      // Its coin's metal: what was struck, worn a hundredth a year, and a share of what its lands smelted of it this year (and, the
      // first year, of what they held).
      const fresh = wasForm !== "metal" || good !== metal;
      if (fresh) fine = 1;
      let smelted = 0;
      for (const { m } of r.lands) smelted += m.book("made", metal);
      let inCoin =
        (fresh ? MONEY.coined * held[metal]! : stock * fine * 0.99) + MONEY.coined * smelted;
      good = metal;
      const worth = Math.max(1e-6, sm.price[metal]!),
        coinWorth = inCoin * worth;
      if (strained && unmet > 0 && coinWorth > 0) {
        const d = Math.min(MONEY.debase, unmet / coinWorth);
        fine *= 1 - d;
        seigniorage = d * coinWorth;
      }
      inCoin = Math.max(0, inCoin);
      stock = inCoin / Math.max(1e-6, fine);
      const target = Math.min(
        priceLevel("metal", { fine, metalWorth: worth, stock, velocity, made }),
        Math.max(1e-6, (stock * velocity) / made),
      );
      level = wasForm === "metal" ? level + MONEY.pace * (target - level) : target;
    } else {
      // Notes and the lenders' claims: issued as trade wants them, so prices hold; more where a strained treasury prints.
      const broad = form === "credit" ? 1 + MONEY.multiplier * Math.min(1, houses / 4) : 1;
      if (wasForm === "barter" || wasForm === "metal") stock = (level * made) / velocity / broad;
      const wanted = (level * made) / velocity / broad;
      if (wanted > stock) {
        seigniorage += (wanted - stock) / Math.max(1e-6, level);
        stock = wanted;
      }
      if (strained && unmet > 0) {
        const more = Math.min(MONEY.print * stock, (unmet * level) / broad);
        stock += more;
        seigniorage += more / Math.max(1e-6, level);
      }
      const target = priceLevel(form, {
        fine: 1,
        metalWorth: 1,
        stock: stock * broad,
        velocity,
        made,
      });
      level = level + MONEY.pace * (target - level);
    }
    level = dmath.clamp(level, 1e-6, 1e9);
    const inflation = wasForm === form && before > 0 ? dmath.clamp(level / before - 1, -0.9, 9) : 0;
    let toldFine = was ? was[COIN.toldFine]! : 1e6;
    // Told: a new money; a coin debased (or notes printed) by a fifth since last told; prices risen a tenth in a year.
    let forms = was ? was[COIN.forms]! : 0;
    const bit = 1 << MONEY_FORMS.indexOf(form);
    if (form !== wasForm && form !== "barter" && !(forms & bit))
      tell(ctx, MONEY_EVENTS.coin.type, p, {
        form,
        from: wasForm,
        good: form === "metal" && good >= 0 ? GOODS[good]!.name : null,
      });
    if (form === "metal" && wasForm === "metal" && fine * 1e6 < 0.8 * toldFine) {
      tell(
        ctx,
        MONEY_EVENTS.debased.type,
        p,
        { fine: Math.round(fine * 100), good: GOODS[good]?.name ?? null, unmet: Math.round(unmet) },
        [
          {
            name: "what its treasury went short",
            value: Math.round(unmet),
            contribution: 1,
            source: null,
          },
          {
            name: "what it had by it",
            value: fr ? fr[FISC.reserve]! : 0,
            contribution: 0,
            source: null,
          },
        ],
      );
      toldFine = fine * 1e6;
    }
    // (Prices rising fast are told once a generation at most: a coin's worth swings with what its lands smelt.)
    let dearerYear = was ? was[COIN.dearer]! : 0;
    if (
      inflation >= MONEY.told &&
      (was ? was[COIN.inflation]! : 0) < MONEY.told * 10_000 &&
      (!dearerYear || year - dearerYear >= 25)
    ) {
      tell(ctx, MONEY_EVENTS.dearer.type, p, { rise: Math.round(inflation * 100), form });
      dearerYear = year;
    }
    store.set(p.ref, [
      MONEY_FORMS.indexOf(form),
      good,
      fine * 1e6,
      stock * 1000,
      level * 1e6,
      velocity * 100,
      inflation * 10_000,
      made,
      seigniorage,
      toldFine,
      since,
      unmet,
      forms | bit,
      dearerYear,
    ]);
  }
}

function revenueOfRow(row: readonly number[]): number {
  let n = row[FISC.tariffs]! + row[FISC.seigniorage]! + (row[FISC.excise] ?? 0);
  for (let k = 0; k < 4; k++) n += row[FISC.take + k]!;
  return n;
}

/** A realm gone takes its rows with it. */
function dropGone(world: World, living: readonly Polity[]): void {
  const alive = new Set<string>(living.map((p) => p.ref));
  for (const [name] of MONEY_STORES) {
    const s = moneyStore(world, name);
    if (!s) continue;
    for (const k of s.keys()) if (k.includes(":") && !alive.has(k)) s.drop(k);
  }
}

// —— 188.money.trade ————————————————————————————————————————————————————————————————————————————————————

/** Each realm's tariff and sanctions, and what slips past them, from this year's trade. */
export function dutyYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    duties = moneyStore(world, TARIFF_STORE),
    smuggle = moneyStore(world, SMUGGLE_STORE),
    fisc = moneyStore(world, TREASURY_STORE);
  if (!duties || !smuggle) return;
  const realms = politiesOf(world),
    markets = marketsOf(world),
    finance = financeOf(world),
    order = orderOf(world),
    living = realms.living();
  if (!living.length) return;
  // This year's trade by realm: in from others, out to others, all its lands' dealings, its goods' from others, with each other.
  const imports = new Map<string, number>(),
    exports = new Map<string, number>(),
    crafted = new Map<string, number>(),
    dealings = new Map<string, number>(),
    between = new Map<string, number>();
  let world_ = 0;
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  for (const f of markets.flows) {
    const ra = realms.of(f.from)?.ref,
      rb = realms.of(f.to)?.ref,
      v = f.count * (markets.get(f.to)?.price[f.good] ?? 0);
    if (ra) add(dealings, ra, v);
    if (rb && rb !== ra) add(dealings, rb, v);
    if (!ra || !rb || ra === rb) continue;
    add(imports, rb, v);
    add(exports, ra, v);
    world_ += v;
    if (CRAFTED.includes(f.good)) add(crafted, rb, v);
    add(between, `${ra}|${rb}`, v);
    add(between, `${rb}|${ra}`, v);
  }
  for (const p of living) {
    const r = readRealm(ctx, p),
      sway = swayOf(ctx, p, t),
      held = holdsOf(world, p.ref),
      o = order?.of(p.ref),
      inn = imports.get(p.ref) ?? 0,
      out = exports.get(p.ref) ?? 0;
    let made = 0;
    for (const { m } of r.lands) for (const x of CRAFTED) made += m.book("made", x) * m.price[x]!;
    const fr = fisc?.get(p.ref),
      revenue = fr ? revenueOfRow(fr) : 0,
      short = fr ? fr[FISC.deficit]! / Math.max(1, revenue) : 0,
      want = tariffWanted({
        crafters: sway.crafters,
        undersold: (crafted.get(p.ref) ?? 0) / Math.max(1, (crafted.get(p.ref) ?? 0) + made),
        traders: sway.traders,
        crossing: (inn + out) / Math.max(1, dealings.get(p.ref) ?? 0),
        buyers: sway.many,
        short,
        weight: inn / Math.max(1, world_),
      }),
      // (A tariff needs a customs house that can see what crosses: a market's coin.)
      seen = loreOf(world).get(p.seat, "currency") ? 1 : 0.4,
      was = at(duties, p.ref) ?? new Array<number>(15).fill(0),
      rate = was[DUTY.rate]! / 1000 + 0.25 * (want.rate * seen - was[DUTY.rate]! / 1000);
    // Sanctions: of each realm it fears, what it would shut of its trade with them, against what that trade is worth to its own.
    const sanctions: [number, number][] = [];
    for (const f of finance?.of(p.ref)?.fears ?? []) {
      const trade = between.get(`${p.ref}|${f.of}`) ?? 0,
        shut = sanctionWanted(
          f.level / 100,
          trade / Math.max(1, inn + out),
          sway.traders,
          Math.min(1, stakesBetween(world, p.ref, f.of)),
        );
      let prev = 0;
      for (let k = 0; k < 3; k++)
        if (was[DUTY.sanctions + 2 * k] === refNumber(f.of) + 1)
          prev = was[DUTY.sanctions + 2 * k + 1]! / 1000;
      const now = prev + 0.3 * (shut - prev);
      if (now >= 0.02) sanctions.push([refNumber(f.of) + 1, now]);
      if (now >= 0.3 && prev < 0.3) {
        const other = realms.get(f.of);
        tell(
          ctx,
          MONEY_EVENTS.sanction.type,
          p,
          { of: other ? realmName(other) : "a realm", shut: Math.round(now * 100) },
          [
            {
              name: "its fear of their way",
              value: f.level / 100,
              contribution: f.level / 100,
              source: null,
            },
            {
              name: "what the trade with them is worth",
              value: Math.round(trade),
              contribution: -0.5,
              source: null,
            },
          ],
          now,
        );
      }
    }
    sanctions.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    // Smuggling: the wedge against what being caught costs, along its borders with others.
    let edge = 0;
    const g = ctx.generated;
    for (const { prov } of r.lands) {
      const c = prov.cell;
      for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++)
        if (realms.of(g.grid.neighbours[k]!)?.ref !== p.ref) {
          edge++;
          break;
        }
    }
    // (What it forbids is a wedge too, and those organised to carry it past its borders carry other goods with it.)
    const border = (4 * edge) / Math.max(1, r.lands.length) + 2 * cartelOf(world, p.ref),
      wedge = Math.max(rate, sanctions[0]?.[1] ?? 0, barredOf(world, p.ref)),
      sm = smuggled(
        wedge,
        { force: held[HOLD.force]!, capacity: r.capacity, corruption: o?.corruption ?? 0 },
        border,
      ),
      sw = at(smuggle, p.ref) ?? [0, 0, 0, 0, 0, 0],
      revenueNow = inn * rate * (1 - sm),
      lost = inn * rate * sm;
    let told = was[DUTY.told]!,
      stold = sw[SMUGGLE.told]!;
    if (rate >= 0.1 && !(told & 1)) {
      told |= 1;
      tell(
        ctx,
        MONEY_EVENTS.tariff.type,
        p,
        { rate: Math.round(rate * 100) },
        want.parts.map(([name, v]) => ({
          name,
          value: Math.round(v * 100) / 100,
          contribution: v,
          source: null,
        })),
        rate,
      );
    }
    if (sm * wedge >= 0.05 && !stold) {
      stold = 1;
      tell(ctx, MONEY_EVENTS.smuggling.type, p, {
        share: Math.round(sm * 100),
        wedge: Math.round(wedge * 100),
      });
    }
    const row = [rate * 1000, ...want.parts.map(([, v]) => v * 1000), inn, revenueNow];
    for (let k = 0; k < 3; k++) row.push(sanctions[k]?.[0] ?? 0, (sanctions[k]?.[1] ?? 0) * 1000);
    row.push(told);
    duties.set(p.ref, row);
    smuggle.set(p.ref, [
      sm * 1000,
      wedge * 1000,
      (inn * rate + (sanctions[0]?.[1] ?? 0) * (inn + out)) * sm,
      lost,
      border * 1000,
      stold,
    ]);
  }
}

// —— 188.money.treasury ——————————————————————————————————————————————————————————————————————————————————

/** Each realm's taxes, spending, reserve and deficit. */
export function treasuryYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    fisc = moneyStore(world, TREASURY_STORE);
  if (!fisc) return;
  const lore = loreOf(world),
    order = orderOf(world),
    finance = financeOf(world),
    coin = moneyStore(world, COIN_STORE),
    duties = moneyStore(world, TARIFF_STORE),
    shares = moneyStore(world, SHARES_STORE),
    appetite = ctx.life.appetite;
  for (const p of politiesOf(world).living()) {
    const r = readRealm(ctx, p);
    if (!r.lands.length) continue;
    let harvest = 0,
      tithe = 0,
      traded = 0,
      heads = 0,
      income = 0,
      clerks = 0,
      relief = 0;
    for (const { prov, m } of r.lands) {
      for (const g of FOODS) harvest += m.book("made", g) * m.price[g]!;
      tithe += m.book("made", G.grain) * p.tribute * m.price[G.grain]!;
      for (let g = 0; g < GOODS.length; g++)
        traded += (m.book("in", g) + m.book("out", g)) * m.price[g]!;
      const eats = mouths(prov, ctx.life),
        wage = outsideWage(ctx, prov, m);
      heads += 12 * eats * m.price[G.grain]!;
      income += workersOf(prov) * wage;
      clerks += prov.occupation(OCC.leader) * wage * TREASURY.clerks;
      if (prov.lastFamine) {
        const e = world.events.get(prov.lastFamine);
        if (e && world.now - e.t <= YEAR) relief += TREASURY.relief * eats;
      }
    }
    const o = order?.of(p.ref),
      money = finance?.of(p.ref),
      seat = p.seat,
      measured = measurable({
        writing: lore.effect(seat, "writing") > 0,
        reckoning: !!lore.get(seat, "mathematics"),
        clerks: !!lore.get(seat, "bureaucracy"),
        currency: !!lore.get(seat, "currency"),
        banking: !!lore.get(seat, "banking"),
        capacity: r.capacity,
      }),
      sway = swayOf(ctx, p, t),
      top = (shares?.get(seat)?.[SHARE.fifths + 4] ?? 400) / 1000,
      resisted = taxResisted(sway, (money?.own[0] ?? 50) / 100, top),
      base: Record<TaxBase, number> = { land: harvest, trade: traded, heads, income },
      arms = fieldedOf(ctx, p) * 12 * appetite * TREASURY.armed,
      interest = money ? (debtOf(money) * money.coupon) / 10_000 : 0,
      tariffs = duties?.get(p.ref)?.[DUTY.revenue] ?? 0,
      seigniorage = coin?.get(p.ref)?.[COIN.seigniorage] ?? 0,
      // (What it took of intoxicants, by excise or its own trade: ./intox.ts, reckoned earlier this moment.)
      excise = exciseOf(world, p.ref),
      was = at(fisc, p.ref),
      reserve = was ? was[FISC.reserve]! : 0,
      spend = arms + clerks + relief + interest,
      need = Math.max(0, spend - tithe - tariffs - seigniorage - excise - 0.3 * reserve),
      laid = taxRates(need, base, measured, resisted, o?.corruption ?? 0),
      rate = {} as Record<TaxBase, number>,
      take = {} as Record<TaxBase, number>,
      kept = 1 - dmath.clamp(o?.corruption ?? 0, 0, 0.9);
    // (Rates move a third of the way to what this year's need would lay: a treasury changes its taxes over years, not at once.)
    for (const [k, b] of TAX_BASES.entries()) {
      const prev = was ? was[FISC.rate + k]! / 1000 : 0;
      rate[b] = b === "land" ? p.tribute : prev + (laid.rate[b] - prev) / 3;
      take[b] = b === "land" ? tithe : rate[b] * base[b] * measured[b] * kept;
    }
    const revenue =
        take.land + take.trade + take.heads + take.income + tariffs + seigniorage + excise,
      balance = revenue - spend,
      left = reserve + balance,
      deficit = Math.max(0, -left),
      nextReserve = Math.max(
        0,
        left > 0 ? Math.min(left, reserve * TREASURY.keeps + Math.max(0, balance)) : 0,
      ),
      burden = (take.trade + take.heads + take.income) / Math.max(1, r.made);
    let bits = was ? was[FISC.laid]! : 0;
    for (const [k, b] of TAX_BASES.entries()) {
      if (b === "land" || bits & (1 << k) || rate[b] < 0.01) continue;
      bits |= 1 << k;
      tell(
        ctx,
        MONEY_EVENTS.taxed.type,
        p,
        { base: b, rate: Math.round(rate[b] * 1000) / 10 },
        [
          {
            name: "what it spends beyond what it takes in",
            value: Math.round(need),
            contribution: 1,
            source: null,
          },
          {
            name: "how far it can measure it",
            value: Math.round(measured[b] * 100) / 100,
            contribution: measured[b],
            source: null,
          },
          {
            name: "how far those who bear it refuse it",
            value: Math.round(resisted[b] * 100) / 100,
            contribution: -resisted[b],
            source: null,
          },
        ],
        rate[b],
      );
    }
    fisc.set(p.ref, [
      ...TAX_BASES.map((b) => base[b]),
      ...TAX_BASES.map((b) => rate[b] * 1000),
      ...TAX_BASES.map((b) => take[b]),
      arms,
      clerks,
      relief,
      interest,
      tariffs,
      seigniorage,
      nextReserve,
      deficit,
      0,
      burden * 1000,
      ...TAX_BASES.map((b) => measured[b] * 1000),
      ...TAX_BASES.map((b) => resisted[b] * 1000),
      bits,
      excise,
    ]);
  }
}

// —— 188.money.cover ——————————————————————————————————————————————————————————————————————————————————————

/** A land's usual harvest, kept in the cover store under its own key. */
const landKey = (c: number) => `c${c}`;

/** Each realm's underwriters and its pooled harvests: premiums in, losses paid out, through its seat's granary. */
export function coverYear(ctx: PopulationContext, _t: SimTime): void {
  const { world } = ctx,
    store = moneyStore(world, COVER_STORE);
  if (!store) return;
  const lore = loreOf(world),
    markets = marketsOf(world),
    realms = politiesOf(world);
  // What crossed the sea this year, by realm.
  const sea = new Map<string, number>();
  for (const f of markets.flows) {
    if (!markets.seaPartners(f.from).includes(f.to)) continue;
    const v = f.count * (markets.get(f.to)?.price[f.good] ?? 0);
    for (const c of [f.from, f.to]) {
      const r = realms.of(c)?.ref;
      if (r) sea.set(r, (sea.get(r) ?? 0) + v);
    }
  }
  for (const p of realms.living()) {
    const r = readRealm(ctx, p),
      sm = r.seat,
      seatProv = ctx.provinces.get(p.seat);
    if (!sm || !seatProv || !r.lands.length) continue;
    const seat = p.seat,
      writing = lore.effect(seat, "writing") > 0,
      reckoning = !!lore.get(seat, "mathematics"),
      seaTrade = sea.get(p.ref) ?? 0,
      ships =
        (lore.get(seat, "sailing") ? 1 : 0) +
        (lore.get(seat, "shipbuilding") ? 1 : 0) +
        (lore.get(seat, "steamships") ? 1.5 : 0),
      loss = shipLoss(WIND_MS, ships),
      was = at(store, p.ref) ?? new Array<number>(9).fill(0),
      insured =
        was[POOL.insured]! / 1000 +
        COVER.pace *
          (canUnderwrite(writing, reckoning, !!lore.get(seat, "currency"), seaTrade) -
            was[POOL.insured]! / 1000);
    // Harvests: each land's usual, and how far they swing.
    let usual = 0,
      dev = 0;
    const lands: { m: Market; prov: Province; u: number; h: number }[] = [];
    for (const { prov, m } of r.lands) {
      const h = m.book("made", G.grain),
        lr = store.get(landKey(prov.cell)),
        u0 = lr ? lr[0]! : h,
        d0 = lr ? lr[1]! : 0,
        u = 0.8 * u0 + 0.2 * h,
        d = 0.8 * d0 + 0.2 * Math.abs(h - u0);
      store.set(landKey(prov.cell), [u, d]);
      usual += u;
      dev += d;
      lands.push({ m, prov, u: u0, h });
    }
    const pooled =
      was[POOL.pooled]! / 1000 +
      COVER.pace *
        (canPool(!!lore.get(seat, "granaries"), writing, dev / Math.max(1, usual), r.lands.length) -
          was[POOL.pooled]! / 1000);
    let reserve = was[POOL.reserve]!,
      paid = 0,
      premiums = 0;
    if (pooled > 0.01) {
      // Losses paid: a land whose harvest fell short of its usual past what it bears itself, from the pool, as far as the seat's
      // granary holds more than its own three months.
      const spareAt = () => Math.max(0, sm.stock[G.grain]! - 3 * mouths(seatProv, ctx.life));
      for (const l of lands) {
        if (l.prov.cell === seat || l.u <= 0) continue;
        const short = l.u * (1 - COVER.deductible) - l.h;
        if (short <= 0) continue;
        const owed = Math.floor(Math.min(pooled * short, reserve - paid, spareAt()));
        if (owed <= 0) continue;
        const k = sm.take("out", G.grain, owed);
        l.m.move("in", G.grain, k);
        paid += k;
      }
      reserve -= paid;
      // Premiums: what the pool expects to pay, and its keep, from each land by its usual harvest, never below three months' food.
      const expected = Math.max(was[POOL.paid]!, 0.01 * pooled * usual),
        room = Math.max(0, COVER.reserve * expected - reserve),
        due = Math.min(room, (1 + COVER.load) * expected);
      for (const l of lands) {
        if (l.prov.cell === seat || usual <= 0) continue;
        const spare = Math.max(0, l.m.stock[G.grain]! - 3 * mouths(l.prov, ctx.life)),
          k = l.m.take("out", G.grain, Math.floor(Math.min(spare, (due * l.u) / usual)));
        sm.move("in", G.grain, k);
        premiums += k;
      }
      reserve += premiums;
    }
    let told = was[POOL.told]!;
    if (insured >= 0.2 && !(told & 1)) {
      told |= 1;
      tell(ctx, MONEY_EVENTS.underwriters.type, p, {
        insured: Math.round(insured * 100),
        loss: Math.round(loss * 1000) / 10,
      });
    }
    if (pooled >= 0.2 && !(told & 2)) {
      told |= 2;
      tell(ctx, MONEY_EVENTS.pool.type, p, {
        pooled: Math.round(pooled * 100),
        lands: r.lands.length,
      });
    }
    store.set(p.ref, [
      insured * 1000,
      loss * 10_000,
      pooled * 1000,
      Math.max(0, reserve),
      0.8 * was[POOL.paid]! + 0.2 * paid,
      premiums,
      seaTrade,
      (1000 * dev) / Math.max(1, usual),
      told,
    ]);
  }
  // (A land's usual harvest is let go where it is no longer peopled in a realm.)
  for (const k of store.keys())
    if (k.startsWith("c") && !realms.of(Number(k.slice(1)))) store.drop(k);
}

// —— Installed ——————————————————————————————————————————————————————————————————————————————————————————

/** Register Round B's stores and systems on a peopled world. */
export function installMoney(world: World, ctx: () => PopulationContext): void {
  for (const [name, width] of MONEY_STORES) world.register(new RowStore(name, width));
  world.system({ key: "186.money.labour", every: YEAR, run: (t) => labourYear(ctx(), t) });
  world.system({ key: "186.money.intox", every: YEAR, run: (t) => intoxYear(ctx(), t) });
  world.system({ key: "188.money.coin", every: YEAR, run: (t) => coinYear(ctx(), t) });
  world.system({ key: "188.money.trade", every: YEAR, run: (t) => dutyYear(ctx(), t) });
  world.system({ key: "188.money.treasury", every: YEAR, run: (t) => treasuryYear(ctx(), t) });
  world.system({ key: "188.money.cover", every: YEAR, run: (t) => coverYear(ctx(), t) });
  world.system({
    key: "188.money.prohibition",
    every: YEAR,
    run: (t) => prohibitionYear(ctx(), t),
  });
}

export type { MoneyForm };
