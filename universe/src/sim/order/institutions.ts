// Institutions (the rules are rules/institutions.ts; what is kept ./institutions-kept.ts). The groups (./groups.ts) are people
// who band together for a stake of their own; these are bodies kept to do something others want, by whoever pays for it. One
// rule forms them all. A realm is reckoned once in INST.every years, in its turn (its ref's number and the year, a year after
// its groups), and stepped as many years at once:
//   - land by land, what each thing done is wanted for and what each who could pay for it can pay (grain's worth a year), read
//     off the world's own rows: what its crafts sell (economy markets); how far its crafters and its workers have bound
//     themselves (money labour: the guild and union numbers become bodies here); what its treasury spends on its clerks (money
//     treasury: its watch and its courts are that spending, manned); what its faith's faithful give and the clergy that keeps
//     (belief temples); those who would pay to be taught, healed, told the news and covered against loss; what a great house
//     has to give (order houses);
//   - the payer who can pay most keeps it, and so decides whom it answers to; it is founded where that pay keeps the fewest
//     hands the work takes and its land has what the work needs at that age (writing, coin, deals kept, readers, a town);
//   - each reckoning its hands move toward what its pay keeps; those that do the same in one land share what is paid there by
//     their size and how well each is run, so the better grows and the lesser is taken over; its payer may change (a school a
//     faith kept comes to be kept by the seat); its realm charters, outlaws or seizes it; its head dies and another follows,
//     and a great one may part in two; its workers' body strikes where their wage has fallen behind; it fails when its pay no
//     longer keeps it; a land that passes to another realm takes its bodies with it.
// What flows back, each through a small additive hook read by an older system, exactly as before where nothing is kept: a
// works' roof lets its hands make a little more, and what its owners keep goes to the great house that owns it (economy,
// houses); a governed trade asks as one the more (economy prices); a strike costs a land part of a year's craft, and what is
// won raises its crafters' wage (economy); an honest, paid watch makes the seat's reach the surer and its roads the safer, a
// bought one the less (order capacity; groups' prey); honest courts and watch hold deals, bought judges lose them (society
// holdings); a house of teaching counts as a school and one of higher learning inquires (lore letters, lore); a house of
// healing carries what is known of healing further (health); alms and shared risk spare a few deaths (population, by the
// groups' reading); voices that answer to their readers tell a seat's lands' grievance, kept ones speak for it (order
// standing).
import {
  MAX_CAUSES,
  YEAR,
  defineEventType,
  defineStream,
  dmath,
  parseRef,
  yearOfMoment,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import { tongueName } from "../../gen/index.ts";
import {
  ANSWERS,
  DOES,
  DOES_ROWS,
  FUND,
  GOODS,
  G,
  HOLD,
  INST,
  INST_ANSWERS,
  INST_DOES,
  INST_FORMED,
  INST_FUNDS,
  OCC,
  answersTo,
  bodiesKept,
  canStand,
  diesWithin,
  honestyOf,
  instTitle,
  leaderLost,
  learnedFull,
  ofOneKept,
  staffKept,
  walkoutOf,
  walkoutWon,
  type InstDoes,
  type InstEnd,
  type InstFund,
  type InstGround,
} from "../../rules/index.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { beliefOf } from "../belief/belief.ts";
import { loreOf, inquiresMore } from "../lore/lore.ts";
import { readersOf, teachesAsSchool } from "../lore/letters.ts";
import { learnedOf } from "../lore/academy.ts";
import { healsMore } from "../health/health.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import {
  COVER_STORE,
  FISC,
  POOL,
  TREASURY_STORE,
  deficitOf,
  guildOf,
  moneyStore,
  refNumber,
  revenueOf,
  stepped,
  unionOf,
  RowStore,
} from "../money/kept.ts";
import { TEMPLE_ROW, TEMPLE_STORE, cultureRows } from "../culture/rows.ts";
import {
  HOLDINGS,
  HOLDINGS_STORE,
  LAW_ROW,
  LAW_STORE,
  provisionOf,
  societyStore,
} from "../society/kept.ts";
import { addsReach, addsStanding, capacityOf, orderOf } from "./order.ts";
import { holdOf } from "./holds.ts";
import { housesOf } from "./houses.ts";
import { collusionIn } from "./underworld-kept.ts";
import {
  BODY_LANDS_STORE,
  BODY_LANDS_WIDTH,
  BODY_ROW,
  BodiesStore,
  bodiesOf,
  bodyLandsStore,
  healedIn,
  higherIn,
  taughtIn,
  type Body,
  type RealmBodies,
} from "./institutions-kept.ts";

export const INST_EVENTS = {
  /** A body founded where what is paid for a thing wanted keeps the hands it takes. */
  founded: defineEventType("bodies.founded", 3),
  /** Its head gone, another in their place. */
  head: defineEventType("bodies.head", 1),
  /** Its realm chartered, outlawed, let be or seized it; another payer came to keep it; its land passed to another realm. */
  standing: defineEventType("bodies.standing", 2),
  /** Its workers struck: won or broken. */
  strike: defineEventType("bodies.strike", 3),
  /** It parted in two at a head's passing. */
  parted: defineEventType("bodies.parted", 2),
  /** Its hold ended: failed, withered, suppressed, taken over, merged. */
  ended: defineEventType("bodies.ended", 3),
  /** The god's hand laid on it. */
  hand: defineEventType("act.body", 4),
};

const DRAW = defineStream("order.bodies");
const per = (x: number) => Math.round(dmath.clamp(x, 0, 1) * 1000);
const keyOf = (r: Ref) => parseRef(r).b >>> 0;
const r2 = (x: number) => Math.round(x * 100) / 100;
const FUNDS = INST_FUNDS.length;
/** What is made for sale under a roof or dug by a company: every good but food and what flocks and hunters bring with it. */
const WORKED: readonly number[] = GOODS.map((g, i) =>
  g.food || i === G.wool || i === G.hides ? -1 : i,
).filter((i) => i >= 0);
/** Things done by a trade's own people, told by what they work. */
const OF_A_TRADE: ReadonlySet<number> = new Set([DOES.make, DOES.craft, DOES.bargain]);
/** Things done whose bodies vie for the same custom in one land. */
const RIVALS: ReadonlySet<number> = new Set([DOES.make, DOES.word]);

export const doesOf = (g: { readonly does: number }): InstDoes => INST_DOES[g.does] ?? "make";

const factor = (name: string, value: number, contribution: number): Factor => ({
  name,
  value: r2(value),
  contribution,
  source: null,
});

/**
 * Who heads a body, where the world keeps people of note (a later layer gives this; none is given here): asked at a founding
 * and at each succession with what the body is and where; a person given heads it (their id kept on the body, their name its
 * head's), null leaves the drawn name. The giver must be a pure reading of the world.
 */
export type HeadAsked = {
  readonly realm: Ref;
  readonly cell: number;
  readonly does: InstDoes;
  readonly year: number;
  readonly founding: boolean;
};
export type HeadGiven = { readonly id: string; readonly name: string; readonly born: number };
let headGiver: ((world: World, asked: HeadAsked) => HeadGiven | null) | null = null;
export function headsWith(
  f: (world: World, asked: HeadAsked) => HeadGiven | null,
  /** Whether one given is gone (dead, or let go by their people): their body then takes another head at its next reckoning. */
  gone?: (world: World, id: string) => boolean,
): void {
  headGiver = f;
  headGone = gone ?? null;
}
let headGone: ((world: World, id: string) => boolean) | null = null;

// —— What a realm's lands want done, and who could pay ————————————————————————————————————————————————————

/** One land of a realm as its bodies weigh it. */
type Land = {
  cell: number;
  people: number;
  town: number;
  townName: string | null;
  /** Whether any village stands in it: a body's home is a place (a land of people and no village has nowhere to stand one). */
  settled: boolean;
  weight: number;
  crafters: number;
  /** What its crafts sold of the good they sell most of (grain's worth a year), and that good. */
  made: number;
  of: number;
  ground: InstGround;
  engines: boolean;
  signal: boolean;
  /** Its guild and union as the labour's numbers have them (0 … 1). */
  guild: number;
  union: number;
  craftWage: number;
  tillWage: number;
  grievance: number;
  /** Its clergy (heads) and what its faithful give a year (grain), by its people's part of their faith's. */
  faith: Ref | null;
  clergy: number;
  given: number;
  learned: number;
  /** What each who could pay would pay for each thing done here (grain's worth a year): [does × FUNDS + fund]. */
  pay: Float64Array;
  /** Who would pay most for each thing done here, as readily as that payer gives for it (by INST_FUNDS; -1: no one), and what. */
  best: Int8Array;
  bestPays: Float64Array;
};

type Read = {
  people: number;
  wage: number;
  capacity: number;
  legitimacy: number;
  corruption: number;
  force: number;
  voice: number;
  word: number;
  written: number;
  risk: number;
  short: number;
  bought: number;
  priest: boolean;
  /** Its richest great house: its name, what it takes a year, the land it is seated in, whether it holds the seat. */
  house: { name: string; income: number; seat: number; crown: boolean } | null;
  lands: Land[];
};

function readRealm(ctx: PopulationContext, p: Polity): Read {
  const { world } = ctx,
    realms = politiesOf(world),
    o = orderOf(world)?.of(p.ref),
    law = societyStore(world, LAW_STORE)?.get(p.ref),
    holdings = societyStore(world, HOLDINGS_STORE),
    fisc = moneyStore(world, TREASURY_STORE)?.get(p.ref),
    lore = loreOf(world),
    belief = world.hasStore("belief.faiths") ? beliefOf(world) : null,
    temples = cultureRows(world, TEMPLE_STORE),
    markets = marketsOf(world),
    revenue = revenueOf(world, p.ref),
    clerks = fisc ? fisc[FISC.clerks]! : 0,
    care = provisionOf(world, p.ref).publicCare,
    premiums = moneyStore(world, COVER_STORE)?.at(p.ref, POOL.premiums) ?? 0,
    clerked = !!lore.get(p.seat, "bureaucracy"),
    courts = law ? law[LAW_ROW.courts]! / 1000 : 0.3,
    priest = p.leadership === 3,
    kept = housesOf(world)?.of(p.ref)?.houses ?? [],
    lands: Land[] = [];
  let richest: (typeof kept)[number] | null = null;
  for (const h of kept)
    if (!richest || h.wealth > richest.wealth || (h.wealth === richest.wealth && h.id < richest.id))
      richest = h;
  const house = richest
    ? {
        name: richest.name,
        income: richest.income,
        seat: richest.seat,
        crown: richest.crown === 1,
      }
    : null;
  let people = 0,
    workers = 0,
    weightAll = 0,
    townAll = 0;
  for (const c of p.members) {
    const prov = ctx.provinces.get(c);
    if (!prov) continue;
    const n = prov.total();
    if (n <= 0) continue;
    people += n;
    workers += Math.max(0, n - prov.occupation(OCC.dependent));
    const m = markets.get(c),
      villages = ctx.settlements.inProvince(c),
      market = villages.find((s) => s.market),
      town = market?.population ?? 0,
      weight = n + 2 * town + (c === p.seat ? n : 0),
      crafters = prov.occupation(OCC.crafter),
      faith = belief?.of(c).faith ?? null,
      temple = faith ? temples?.get(refNumber(faith)) : undefined,
      part = temple && temple[TEMPLE_ROW.faithful]! > 0 ? n / temple[TEMPLE_ROW.faithful]! : 0;
    let made = 0,
      of = -1;
    if (m && crafters > 0)
      for (const g of WORKED) {
        const x = m.book("made", g) * m.price[g]!;
        if (x > made) {
          made = x;
          of = g;
        }
      }
    weightAll += weight;
    townAll += town;
    lands.push({
      cell: c,
      people: n,
      town,
      townName: market?.name ?? null,
      settled: villages.length > 0,
      weight,
      crafters,
      made,
      of,
      ground: {
        writing: lore.effect(c, "writing") > 0,
        coin: !!lore.get(c, "currency"),
        deals: (holdings?.at(c, HOLDINGS.deals) ?? (law ? law[LAW_ROW.deals]! : 500)) / 1000,
        readers: readersOf(world, c),
        town,
      },
      engines: !!lore.get(c, "factories"),
      signal: lore.effect(c, "signal") > 0,
      guild: guildOf(world, c),
      union: unionOf(world, c).union,
      craftWage: m ? m.wage[OCC.crafter]! : 0,
      tillWage: m ? Math.max(m.wage[OCC.farmer]!, m.wage[OCC.herder]!, m.wage[OCC.forager]!) : 0,
      grievance: dmath.clamp(realms.discontent(c).level, 0, 1),
      faith,
      clergy: temple ? temple[TEMPLE_ROW.clergy]! * part : 0,
      given: temple ? temple[TEMPLE_ROW.given]! * part : 0,
      learned: learnedFull(learnedOf(world, c)),
      pay: new Float64Array(INST_FORMED * FUNDS),
      best: new Int8Array(INST_FORMED),
      bestPays: new Float64Array(INST_FORMED),
    });
  }
  // (A working year: what a worker of its lands earns by the treasury's reckoning, a living at the least; the seat's wages
  // before the treasury has read its lands. As its groups read it: ./groups.ts readRealm.)
  const sm = markets.get(p.seat),
    wage = Math.max(
      1,
      fisc && workers > 0
        ? fisc[FISC.base + 3]! / workers
        : sm
          ? Math.max(sm.wage[OCC.crafter]!, sm.wage[OCC.farmer]!)
          : 1,
    ),
    medicine = !!lore.get(p.seat, "medicine");
  // What each who could pay would pay for each thing done, land by land.
  for (const l of lands) {
    const share = weightAll > 0 ? l.weight / weightAll : 0,
      set = (does: number, fund: number, x: number) => {
        l.pay[does * FUNDS + fund] = Math.max(0, x);
      },
      seat = l.cell === p.seat,
      houseHere = house && (house.seat === l.cell || (seat && house.crown)) ? house.income : 0,
      traders = ctx.provinces.get(l.cell)!.occupation(OCC.trader);
    // Make: what a works could win of what its land's crafts sell of their first good.
    set(DOES.make, FUND.customers, l.made * (l.engines ? INST.worksEngines : INST.worksMost));
    // Craft, bargain: the dues of those the labour's numbers already have bound (each a part of a working year).
    set(DOES.craft, FUND.dues, l.crafters * l.guild * wage * DOES_ROWS.craft.keep);
    set(DOES.bargain, FUND.dues, l.crafters * l.union * wage * DOES_ROWS.bargain.keep);
    // Order, judge: what the treasury spends on its clerks, by its lands' weight; a priest-king's temple judges too.
    set(DOES.order, FUND.treasury, clerks * INST.orderOf * share);
    set(DOES.judge, FUND.treasury, clerks * INST.judgeOf * courts * share * (seat ? 2 : 1));
    set(DOES.judge, FUND.tithes, priest ? l.given * 0.1 : 0);
    // Teach: a faith that teaches, a seat that needs clerks, a house's gift, those who pay for their young.
    set(DOES.teach, FUND.tithes, l.given * 0.3);
    set(DOES.teach, FUND.treasury, clerked ? clerks * 0.08 * share : 0);
    set(DOES.teach, FUND.patron, houseHere * 0.04);
    set(DOES.teach, FUND.customers, l.ground.coin ? (traders + 0.2 * l.crafters) * wage * 0.03 : 0);
    // Heal: once there is medicine to give.
    if (medicine) {
      set(DOES.heal, FUND.tithes, l.given * 0.15);
      set(DOES.heal, FUND.treasury, revenue * care * 0.03 * share);
      set(DOES.heal, FUND.customers, l.ground.coin ? l.town * wage * 0.002 : 0);
    }
    // Worship: the clergy its faithful's giving already keeps.
    set(DOES.worship, FUND.tithes, l.clergy * wage * DOES_ROWS.worship.keep);
    // Word: those who read and would pay for the news; a house that would be heard.
    set(DOES.word, FUND.customers, l.town * l.ground.readers * wage * 0.004);
    set(DOES.word, FUND.patron, houseHere * 0.02);
    // Insure: what its realm's traders already pay against loss, by its towns.
    set(DOES.insure, FUND.customers, townAll > 0 ? (premiums * 0.15 * l.town) / townAll : 0);
    // (Who would pay most for each: rules funderOf, read once a land.)
    for (let d = 0; d < INST_FORMED; d++) {
      let at = -1,
        most = 0;
      for (let k = 0; k < FUNDS; k++) {
        const x = l.pay[d * FUNDS + k]! * READILY[d * FUNDS + k]!;
        if (x > most) {
          most = x;
          at = k;
        }
      }
      l.best[d] = at;
      l.bestPays[d] = most;
    }
  }
  return {
    people,
    wage,
    capacity: capacityOf(ctx, p).value,
    legitimacy: o?.legitimacy ?? 0.5,
    corruption: o?.corruption ?? 0,
    force: holdOf(world, p.ref, HOLD.force),
    voice: holdOf(world, p.ref, HOLD.voice),
    word: holdOf(world, p.ref, HOLD.word),
    written: law ? law[LAW_ROW.written]! / 1000 : 0,
    risk: law ? law[LAW_ROW.risk]! / 1000 : 0,
    short: revenue > 0 ? Math.min(1, deficitOf(world, p.ref) / revenue) : 0,
    bought: collusionIn(world, p.ref),
    priest,
    house,
    lands,
  };
}

/** What `fund` would pay for `does` in a land. */
const payAt = (l: Land, does: number, fund: number): number => l.pay[does * FUNDS + fund]!;
/** How readily each payer gives for each thing done (rules DOES_ROWS funds), laid flat: [does × FUNDS + fund]. */
const READILY: readonly number[] = INST_DOES.slice(0, INST_FORMED).flatMap((d) =>
  INST_FUNDS.map((f) => DOES_ROWS[d].funds[f] ?? 0),
);

/** The most hands a land's works can hold: a part of its crafters, less as its governed trade keeps works out. */
const worksRoom = (l: Land, craft: number): number =>
  l.crafters * (l.engines ? INST.worksEngines : INST.worksMost) * (1 - INST.resists * craft);

// —— Naming, telling ———————————————————————————————————————————————————————————————————————————————————————

type Facts = {
  readonly ctx: PopulationContext;
  readonly p: Polity;
  readonly v: RealmBodies;
  readonly r: Read;
  readonly lands: ReadonlyMap<number, Land>;
  readonly t: SimTime;
  readonly year: number;
  readonly key: number;
  readonly u: (k: number) => number;
};

function tongueWord(f: Facts, cell: number, salt: number, seed: number): string | null {
  const ways = cultureOf(f.ctx.world).get(cell) ?? cultureOf(f.ctx.world).get(f.p.seat);
  if (!ways) return null;
  const u = f.ctx.world.rng.real(DRAW, f.key, f.t, 7000 + salt);
  return tongueName({ ...ways.tongue, seed: ways.tongue.seed ^ seed }, Math.floor(u * 1e6));
}

function newHead(f: Facts, g: { does: number }, cell: number, salt: number, founding: boolean) {
  const given = tongueWord(f, cell, salt, 0x2b7d) ?? "One",
    family = tongueWord(f, cell, salt + 1, 0x41c3),
    drawn = {
      name: family ? `${given} ${family}` : given,
      // (Of an age to head such a thing: a generation and more past coming of age.)
      born: f.year - Math.round(f.ctx.life.adulthood * (1.8 + 1.2 * f.u(salt * 7 + 3))),
      since: f.year,
    },
    one = headGiver?.(f.ctx.world, {
      realm: f.p.ref,
      cell,
      does: doesOf(g),
      year: f.year,
      founding,
    });
  return one
    ? { leader: { name: one.name, born: one.born, since: f.year }, id: one.id }
    : { leader: drawn, id: "" };
}

/** A body's title as its land stands now (rules instTitle: display only; told in its events so the years can say it). */
export function titleOf(g: Body, l: Land | TitleLand | undefined): string {
  return instTitle(
    {
      does: doesOf(g),
      fund: INST_FUNDS[g.fund] ?? "dues",
      answers: INST_ANSWERS[g.answers] ?? "members",
      standing: g.standing,
    },
    {
      staff: g.staff,
      writing: l?.ground.writing ?? false,
      engines: l?.engines ?? false,
      signal: l?.signal ?? false,
      readers: l?.ground.readers ?? 0,
      of: g.of >= 0 ? workedName(g.of) : "",
      higher: g.higher === 1,
    },
  );
}
type TitleLand = {
  ground: { writing: boolean; readers: number };
  engines: boolean;
  signal: boolean;
};

/** What a body of a trade works, as its title says it: iron, cloth, pots. */
export function workedName(good: number): string {
  const id = GOODS[good]?.id;
  return id === "clothing"
    ? "cloth"
    : id === "pottery"
      ? "pottery"
      : id === "tools"
        ? "tool"
        : id === "machines"
          ? "engine"
          : (id ?? "");
}

/** A body's title read off the world as it stands (for the pages: the same reading its events were told by). */
export function bodyTitle(ctx: PopulationContext, g: Body): string {
  const lore = loreOf(ctx.world),
    c = g.home;
  return titleOf(g, {
    ground: { writing: lore.effect(c, "writing") > 0, readers: readersOf(ctx.world, c) },
    engines: !!lore.get(c, "factories"),
    signal: lore.effect(c, "signal") > 0,
  });
}

function tell(
  f: Facts,
  type: string,
  cell: number | null,
  data: Record<string, unknown>,
  causes: { ref: Ref; role: "trigger" | "enabler" | "pressure"; weight: number }[],
  factors?: Factor[],
  also?: Ref,
): Ref {
  const world = f.ctx.world,
    decision = factors
      ? world.decisions.record({
          rule: type,
          subject: f.p.ref,
          // (What it is of, and no more: the event beside it tells the rest.)
          outcome: { body: data.body },
          score: factors.reduce((s, x) => s + x.contribution, 0),
          threshold: 0,
          factors,
        })
      : null;
  return world.events.emit({
    type,
    subjects: also ? [f.p.ref, also] : [f.p.ref],
    place: cell !== null ? (f.ctx.provinces.get(cell)?.ref ?? null) : null,
    causes: [
      ...(decision ? [{ ref: decision, role: "trigger" as const, weight: 1 }] : []),
      ...causes.slice(0, MAX_CAUSES - (decision ? 1 : 0)),
    ],
    data,
  });
}

/** Who keeps a body paid by `fund` in a land: the house that gives, the faith whose tithes they are; "" otherwise. */
function keeperOf(r: Read, l: Land, does: number, fund: number): string {
  if (fund === FUND.patron) return r.house?.name ?? "";
  if (fund === FUND.tithes) return l.faith ?? "";
  // (A works is owned: by the realm's richest house where it is seated in that land or holds the seat there, else by its
  // own partners.)
  if (does === DOES.make && r.house && (r.house.seat === l.cell || r.house.crown))
    return r.house.name;
  return "";
}

function found(f: Facts, does: number, l: Land, fund: InstFund, staff: number, pays: number) {
  const { v, r, year } = f,
    salt = v.next * 19 + does,
    own = does === DOES.make || does === DOES.word,
    name = own
      ? tongueWord(f, l.cell, salt, 0x0c5e)
      : (l.townName ?? tongueWord(f, l.cell, salt, 0x0c5e));
  if (!name) return null;
  const of = OF_A_TRADE.has(does) ? l.of : -1;
  if (v.bodies.some((g) => g.name === name && g.does === does && g.of === of)) return null;
  const head = newHead(f, { does }, l.cell, salt, true),
    k = FUND[fund],
    gid = v.next++,
    g: Body = {
      id: gid,
      name,
      does,
      fund: k,
      // (A priest-king's clergy answer to him: the seat holds its temple.)
      answers: does === DOES.worship && r.priest ? ANSWERS.seat : ANSWERS[answersTo(fund)],
      // (What the seat pays for is its own from the first: no charter is told of it.)
      standing: fund === "treasury" || (does === DOES.worship && r.priest) ? 2 : 1,
      of,
      since: year,
      event: "" as Ref,
      home: l.cell,
      lands: [l.cell],
      // (A house owns one works of a good in a land: a second there is its own partners'.)
      keeper: v.bodies.some(
        (x) =>
          does === DOES.make &&
          x.does === does &&
          x.of === of &&
          x.keeper !== "" &&
          x.keeper === keeperOf(r, l, does, k) &&
          x.lands.includes(l.cell),
      )
        ? ""
        : keeperOf(r, l, does, k),
      leader: head.leader,
      leaders: 1,
      ...(head.id ? { founderId: head.id, headId: head.id } : {}),
      staff: Math.max(
        DOES_ROWS[doesOf({ does })].least,
        Math.round(staff * stepped(INST.grow, INST.every)),
      ),
      wealth: 0,
      income: Math.round(pays),
      quality: 550 + Math.round(400 * f.u(salt * 5 + 1)),
      share: 1000,
    };
  const title = titleOf(g, l),
    event = tell(
      f,
      INST_EVENTS.founded.type,
      l.cell,
      {
        body: name,
        title,
        does: doesOf(g),
        fund,
        leader: g.leader.name,
        ...(g.keeper ? { keeper: g.keeper } : {}),
        ...(of >= 0 ? { of: workedName(of) } : {}),
        ...(head.id ? { head: head.id } : {}),
        // (Why it stands, in its own two numbers: what is paid for it a year, and the hands that keeps. No reckoning is
        // set down beside it: every body a world keeps holds its founding for as long as it stands, and a reckoning of
        // five lines for each was a quarter of what they added to a save.)
        pays: Math.round(pays),
        hands: g.staff,
      },
      [],
    );
  (g as { event: Ref }).event = event;
  v.bodies.push(g);
  return g;
}

function ended(f: Facts, g: Body, how: InstEnd, factors: Factor[], into?: Body): void {
  const { v, year } = f,
    l = f.lands.get(g.home),
    title = titleOf(g, l),
    event = tell(
      f,
      INST_EVENTS.ended.type,
      g.home,
      {
        body: g.name,
        title,
        does: doesOf(g),
        how,
        since: g.since,
        ...(into ? { into: into.name, intoTitle: titleOf(into, l) } : {}),
      },
      [
        { ref: g.event, role: "enabler", weight: 1 },
        ...(into ? [{ ref: into.event, role: "trigger" as const, weight: 1 }] : []),
      ],
      factors,
    );
  v.bodies = v.bodies.filter((x) => x !== g);
  v.gone = [
    ...v.gone,
    {
      name: g.name,
      title,
      does: g.does,
      since: g.since,
      year,
      how,
      ...(into ? { into: into.name } : {}),
      rose: g.event,
      event,
    },
  ].slice(-INST.gone);
}

// —— One realm's bodies, stepped `span` years ————————————————————————————————————————————————————————————

function fresh(year: number): RealmBodies {
  return {
    last: year,
    next: 1,
    need: new Array<number>(INST_FORMED).fill(0),
    paid: new Array<number>(INST_FORMED).fill(0),
    profit: [],
    reach: 0,
    told: 0,
    bodies: [],
    gone: [],
  };
}

function copyOf(v: Readonly<RealmBodies>): RealmBodies {
  return {
    ...v,
    need: [...v.need],
    paid: [...v.paid],
    profit: v.profit.map(([a, b]) => [a, b]),
    bodies: v.bodies.map((g) => ({ ...g, lands: [...g.lands], leader: { ...g.leader } })),
    gone: [...v.gone],
  };
}

/** Whether two bodies do the same thing for the same custom: the same work, and for a trade's body the same good. */
const alike = (a: Body, b: Body): boolean =>
  a.does === b.does && (!OF_A_TRADE.has(a.does) || a.of === b.of);

function stepRealm(
  ctx: PopulationContext,
  p: Polity,
  v: RealmBodies,
  span: number,
  t: SimTime,
  moved: [Body, Ref][],
): void {
  const { world } = ctx,
    year = yearOfMoment(t),
    key = keyOf(p.ref),
    r = readRealm(ctx, p);
  if (r.people <= 0) return;
  const lands = new Map(r.lands.map((l) => [l.cell, l])),
    f: Facts = {
      ctx,
      p,
      v,
      r,
      lands,
      t,
      year,
      key,
      u: (k: number) => world.rng.real(DRAW, key, t, k),
    },
    fade = 1 - dmath.pow(1 - INST.spends, span),
    stays = 1 - fade,
    rows = bodyLandsStore(world),
    realms = politiesOf(world),
    w = r.wage,
    oversight = (r.written + r.voice + r.word) / 3,
    gone: [Body, InstEnd, Factor[], Body?][] = [],
    slumped = new Map<Body, number>(),
    ending = new Set<Body>();

  // 0. A body whose land has passed to another realm goes with it.
  let strayed = false;
  for (const g of v.bodies) {
    if (!lands.has(g.home)) strayed = true;
    else
      for (const c of g.lands)
        if (!lands.has(c)) {
          g.lands = g.lands.filter((x) => lands.has(x));
          break;
        }
  }
  for (const g of strayed ? [...v.bodies] : []) {
    if (lands.has(g.home)) continue;
    const now = realms.of(g.home);
    if (now && now.ended === null && now.ref !== p.ref) {
      v.bodies = v.bodies.filter((x) => x !== g);
      moved.push([g, now.ref]);
    } else
      // (A land no realm holds keeps no body: no one is left to pay for it, or to answer to.)
      ended(f, g, "lost with its land", [factor("a realm that holds its land", 0, -1)]);
  }

  // 1. Each body: who pays it now, what that keeps, how its realm holds it.
  // (What is paid for a thing done in a land is shared among those that do it there, by their hands and how well each is run.)
  const weightOf = (g: Body) => (Math.max(1, g.staff) * g.quality * g.quality) / 1e6,
    sharers = new Map<number, number>(),
    slot = (g: Body, c: number) => (c * 32 + g.does) * 32 + (OF_A_TRADE.has(g.does) ? g.of + 1 : 0);
  for (const g of v.bodies)
    for (const c of g.lands) sharers.set(slot(g, c), (sharers.get(slot(g, c)) ?? 0) + weightOf(g));
  for (const g of v.bodies) {
    const does = doesOf(g),
      rowOf = DOES_ROWS[does],
      home = lands.get(g.home)!,
      // (As it stood, for what it was called before any change this reckoning: read only where one is told.)
      fundWas = g.fund,
      answersWas = g.answers,
      standingWas = g.standing,
      staffWas = g.staff,
      higherWas = g.higher;
    // (Another payer comes to keep it where it would pay twice what the one that does can.)
    const best = home.best[g.does]!,
      bestPays = home.bestPays[g.does]!,
      mine = payAt(home, g.does, g.fund) * READILY[g.does * FUNDS + g.fund]!;
    let how: string | null = null;
    if (
      best >= 0 &&
      best !== g.fund &&
      bestPays > 2 * mine &&
      g.since < year &&
      // (Not to the payer who already keeps another that does the same from its home.)
      !v.bodies.some((x) => x !== g && x.does === g.does && x.home === g.home && x.fund === best)
    ) {
      g.fund = best;
      if (g.answers !== ANSWERS.seat || best === FUND.treasury)
        g.answers = ANSWERS[answersTo(INST_FUNDS[best]!)];
      g.keeper = keeperOf(r, home, g.does, g.fund);
      how = "kept anew";
    }
    let pays = 0;
    for (const c of g.lands) {
      const l = lands.get(c);
      if (!l) continue;
      const all = sharers.get(slot(g, c)) ?? weightOf(g),
        part = all > 0 ? weightOf(g) / all : 1;
      pays += payAt(l, g.does, g.fund) * READILY[g.does * FUNDS + g.fund]! * part;
      if (c === g.home) g.share = per(part);
    }
    // (A god's blessing on it draws a fifth more to it; a curse, a fifth less.)
    const hand = g.handUntil !== undefined && g.handUntil >= year ? (g.hand ?? 0) : 0;
    if (g.handUntil !== undefined && g.handUntil < year) {
      delete g.hand;
      delete g.handUntil;
    }
    if (hand === 1) pays *= 1.2;
    else if (hand === -1) pays *= 0.8;
    let target = staffKept(does, pays, w);
    if (g.does === DOES.make) {
      let room = 0;
      for (const c of g.lands) {
        const l = lands.get(c);
        if (l) room += worksRoom(l, (rows?.at(c, BODY_ROW.craft) ?? 0) / 1000);
      }
      target = Math.min(target, room * (g.share / 1000 || 1));
    } else if (g.does === DOES.order || g.does === DOES.judge) {
      // (No more than half again of a full watch or court for the people of its lands: the rest of what the treasury
      // spends on its clerks keeps other clerks.)
      let served = 0;
      for (const c of g.lands) served += lands.get(c)?.people ?? 0;
      target = Math.min(
        target,
        1.5 *
          Math.max(
            rowOf.least,
            g.does === DOES.order
              ? (served * INST.watchFull) / 1000
              : (served * INST.courtFull) / 1e5,
          ),
      );
    }
    // How its realm holds it.
    // (A charter once given stands while its grounds nearly do: told once, not each time they are crossed.)
    const guarded = hand === 2,
      slack = g.standing === 2 ? 0.12 : 0,
      outlaw =
        !guarded &&
        ((g.does === DOES.bargain && r.force >= 0.7 && r.voice < 0.3) ||
          (g.does === DOES.word && g.answers === ANSWERS.owners && r.word < INST.shuts)),
      charter =
        !outlaw &&
        ((g.does === DOES.craft && r.legitimacy >= 0.45 - slack && r.capacity < 0.6 + slack) ||
          (g.does === DOES.teach &&
            g.higher === 1 &&
            r.word >= 0.5 - slack &&
            r.legitimacy >= 0.5 - slack) ||
          (g.does === DOES.make && !!r.house?.crown && g.keeper === r.house.name) ||
          g.answers === ANSWERS.seat),
      standing = outlaw ? 0 : charter ? 2 : 1;
    // (A charter lapsed is not news: told are a charter given and an outlawing.)
    if (standing !== g.standing && g.since < year && standing !== 1)
      how = standing === 0 ? "outlawed" : "chartered";
    g.standing = standing;
    // (A seat that takes what it will takes a works for itself; one that no longer does sells it back.)
    if (g.does === DOES.make && !guarded && g.since < year) {
      if (g.answers === ANSWERS.owners && r.risk >= INST.seizes && r.force >= 0.6) {
        g.answers = ANSWERS.seat;
        g.keeper = "";
        g.standing = 2;
        how = "seized";
      } else if (g.answers === ANSWERS.seat && r.risk < INST.seizes / 2) {
        g.answers = ANSWERS.owners;
        g.keeper = keeperOf(r, home, g.does, g.fund);
        g.standing = 1;
        how = "sold back";
      }
    }
    if (g.does === DOES.worship)
      g.answers = r.priest ? ANSWERS.seat : ANSWERS[answersTo(INST_FUNDS[g.fund]!)];
    // (Outlawed, the seat's hand takes of its people each year as far as it reaches.)
    if (g.standing === 0) g.staff = Math.round(g.staff * dmath.pow(1 - 0.15 * r.capacity, span));
    else g.staff = Math.max(0, Math.round(g.staff + (target - g.staff) * stepped(INST.grow, span)));
    // (A slump: what its customers pay it fallen under half of what it was a reckoning ago.)
    if (g.fund === FUND.customers && g.since < year - INST.every && pays < INST.slump * g.income)
      slumped.set(g, g.income > 0 ? pays / g.income : 0);
    g.income = Math.round(pays);
    g.wealth = Math.round(g.wealth * stays + (Math.max(0, g.income) * 0.1 * fade) / INST.spends);
    // What it is besides: a watch and a court as honest as they are paid and watched; a house of teaching that inquires.
    if (g.does === DOES.order || g.does === DOES.judge)
      g.quality = per(
        honestyOf({
          paid: 1 - r.short,
          corruption: r.corruption,
          oversight,
          bought: r.bought,
        }) + (hand === 1 ? 0.15 : hand === -1 ? -0.15 : 0),
      );
    if (g.does === DOES.teach) {
      if (home.learned >= 0.5 && g.staff >= 2 * rowOf.least) g.higher = 1;
      else if (home.learned < 0.25) delete g.higher;
    }
    if (g.does === DOES.judge)
      // (Those it holds: as its law keeps them and does not fine or kill, for the people its reach covers.)
      g.held = Math.round(
        g.lands.reduce((s, c) => s + (lands.get(c)?.people ?? 0), 0) *
          INST.held *
          1e-5 *
          Math.min(1, g.staff / Math.max(1, (home.people * INST.courtFull) / 1e5)),
      );
    if (g.won) {
      g.won = Math.round(g.won * dmath.pow(1 - INST.wonFades, span));
      if (g.won <= 0) delete g.won;
    }
    if (how && g.since < year)
      tell(
        f,
        INST_EVENTS.standing.type,
        g.home,
        {
          body: g.name,
          title: titleOf(g, home),
          was: titleOf(
            {
              ...g,
              fund: fundWas,
              answers: answersWas,
              standing: standingWas,
              staff: staffWas,
              ...(higherWas ? { higher: higherWas } : { higher: 0 }),
            },
            home,
          ),
          how,
          fund: INST_FUNDS[g.fund],
          answers: INST_ANSWERS[g.answers],
          ...(g.keeper ? { keeper: g.keeper } : {}),
        },
        [{ ref: g.event, role: "enabler", weight: 1 }],
        how === "seized"
          ? [
              factor("a seat that takes what it will", r.risk, r.risk),
              factor("its arms", r.force, 0.3),
            ]
          : how === "outlawed"
            ? [
                factor("a seat that holds by arms", r.force, r.force),
                factor("word unfree", 1 - r.word, 0.3),
              ]
            : // (A charter given, another payer come: told in their own words, with no reckoning set down beside.)
              undefined,
      );
  }

  // 2. A workers' body strikes where its wage has fallen behind, and is many enough to stop the works.
  const strikes = new Map<number, number>();
  for (const g of v.bodies) {
    if (g.does !== DOES.bargain || g.since >= year) continue;
    const l = lands.get(g.home)!;
    if (l.crafters <= 0) continue;
    // (Behind what it was as they have known it: the wage a year of their craft has come to, against the years before.)
    const was = (g.mark ?? 0) / 100,
      lag = was > 0 ? dmath.clamp(1 - l.craftWage / was, 0, 1) : 0;
    g.mark = Math.round(100 * (was > 0 ? 0.5 * was + 0.5 * l.craftWage : l.craftWage));
    const organised = g.staff / l.crafters,
      fund = g.wealth / Math.max(1, g.staff * w * 0.1),
      lost = walkoutOf({ lag, organised, fund });
    // (No oftener than once in a generation's working years, and by half in a reckoning's ten where all else holds.)
    if (g.standing === 0 || (g.struck !== undefined && year - g.struck < INST.strikeGap)) continue;
    if (lost <= 0 || f.u(300 + g.id * 4) >= 1 - dmath.pow(0.5, span / 10)) continue;
    const chance = walkoutWon(r.force, r.voice, fund),
      won = f.u(301 + g.id * 4) < chance;
    g.struck = year;
    if (won) g.won = Math.min(INST.wonMost * 1000, (g.won ?? 0) + INST.strikeWins * 1000);
    else g.staff = Math.round(g.staff * 0.7);
    g.wealth = Math.round(g.wealth * 0.3);
    strikes.set(g.home, lost);
    tell(
      f,
      INST_EVENTS.strike.type,
      g.home,
      {
        body: g.name,
        title: titleOf(g, l),
        lost: Math.round(lost * 100),
        outcome: won ? "won" : "broken",
        out: Math.round(g.staff),
        leader: g.leader.name,
      },
      [{ ref: g.event, role: "enabler", weight: 1 }],
      [
        factor("its wage behind what it was", lag, lag),
        factor("of its land's crafters, organised", organised, organised),
        factor("a fund to keep them out", fund, 0.2 * Math.min(1, fund)),
        factor(
          won ? "a seat that hears them" : "a seat's arms against them",
          won ? r.voice : r.force,
          0.2,
        ),
      ],
    );
  }

  // 3. New bodies: where what is paid for a thing wanted would keep the most hands for the fewest the work takes.
  type Cand = { does: number; l: Land; fund: InstFund; pays: number; staff: number; rel: number };
  const cands: Cand[] = [],
    count = new Array<number>(INST_FORMED).fill(0);
  for (const g of v.bodies) count[g.does] = (count[g.does] ?? 0) + 1;
  for (let d = 0; d < INST_FORMED; d++) {
    v.need[d] = 0;
    v.paid[d] = 0;
  }
  // (How many do each thing in each land, and of a trade's bodies how many work each good there.)
  const doing = new Map<number, number>();
  for (const g of v.bodies) {
    v.paid[g.does] = (v.paid[g.does] ?? 0) + g.income;
    for (const c of g.lands) {
      const k = c * 32 + g.does;
      doing.set(k, (doing.get(k) ?? 0) + 1);
      if (OF_A_TRADE.has(g.does))
        doing.set(k * 32 + g.of + 1, (doing.get(k * 32 + g.of + 1) ?? 0) + 1);
    }
  }
  for (const l of r.lands)
    for (let d = 0; d < INST_FORMED; d++) {
      if (l.best[d]! < 0) continue;
      const does = INST_DOES[d]!,
        rowOf = DOES_ROWS[does],
        best = { fund: INST_FUNDS[l.best[d]!]!, pays: l.bestPays[d]! };
      v.need[d] = v.need[d]! + best.pays;
      // (It rises where there is a place to keep its house: the want of a land with no village is counted and waits.)
      if (!l.settled) continue;
      if (!canStand(does, l.ground) || count[d]! >= ofOneKept(does, r.lands.length, RIVALS.has(d)))
        continue;
      const here = doing.get(l.cell * 32 + d) ?? 0,
        same = OF_A_TRADE.has(d) ? (doing.get((l.cell * 32 + d) * 32 + l.of + 1) ?? 0) : here;
      if (here >= rowOf.aLand) continue;
      // (A rival enters only a custom great enough for both: four times the fewest hands each.)
      if (here > 0 && !RIVALS.has(d)) continue;
      if (OF_A_TRADE.has(d) && l.of < 0) continue;
      // (A second voice in a land is another payer's: a house keeps one, and those who read keep theirs.)
      if (d === DOES.word && here > 0) {
        let at = -1,
          most = 0;
        for (let k = 0; k < FUNDS; k++) {
          const x = l.pay[d * FUNDS + k]! * READILY[d * FUNDS + k]!;
          if (x <= most) continue;
          if (v.bodies.some((g) => g.does === d && g.fund === k && g.lands.includes(l.cell)))
            continue;
          most = x;
          at = k;
        }
        if (at < 0) continue;
        best.fund = INST_FUNDS[at]!;
        best.pays = most;
      }
      let staff = staffKept(does, best.pays, w);
      if (d === DOES.make)
        staff = Math.min(staff, worksRoom(l, (rows?.at(l.cell, BODY_ROW.craft) ?? 0) / 1000));
      const least = rowOf.least * (same > 0 ? 4 * (same + 1) : 1);
      if (staff < least) continue;
      cands.push({ does: d, l, fund: best.fund, pays: best.pays, staff, rel: staff / least });
    }
  for (let d = 0; d < INST_FORMED; d++) {
    v.need[d] = Math.round(v.need[d]!);
    v.paid[d] = Math.round(v.paid[d]!);
  }
  cands.sort((a, b) => b.rel - a.rel || a.l.cell - b.l.cell || a.does - b.does);
  const kept = bodiesKept(r.lands.length);
  let risen = 0;
  const turns = Math.max(1, Math.round(span / INST.riseYears));
  let madeRoom = false;
  for (const c of cands) {
    if (risen >= INST.rise * turns) break;
    if (count[c.does]! >= ofOneKept(INST_DOES[c.does]!, r.lands.length, RIVALS.has(c.does)))
      continue;
    if (risen > 0 && f.u(50 + risen) >= 0.6) continue;
    if (v.bodies.length >= kept) {
      // (It keeps all it can: a thing none of its bodies does takes the place of the least of what it keeps two and more of,
      // which is taken into the greatest of its kind. Once a reckoning.)
      if (madeRoom || count[c.does]! > 0) continue;
      let many = -1;
      for (let d = 0; d < INST_FORMED; d++)
        if (count[d]! >= 2 && (many < 0 || count[d]! > count[many]!)) many = d;
      if (many < 0) continue;
      let least: Body | undefined, most: Body | undefined;
      for (const g of v.bodies) {
        if (g.does !== many) continue;
        if (!most || g.staff > most.staff || (g.staff === most.staff && g.id < most.id)) most = g;
        if (
          g.since < year &&
          (!least || g.staff < least.staff || (g.staff === least.staff && g.id > least.id))
        )
          least = g;
      }
      if (!least || !most || least === most) continue;
      most.staff += least.staff;
      most.wealth += least.wealth;
      ended(
        f,
        least,
        "merged",
        [
          factor("of its kind in its realm", count[many]!, 1),
          factor("its hands", least.staff, -0.2),
        ],
        most,
      );
      count[many] = count[many]! - 1;
      madeRoom = true;
    }
    const g = found(f, c.does, c.l, c.fund, c.staff, c.pays);
    if (!g) continue;
    count[c.does] = count[c.does]! + 1;
    v.paid[c.does] = v.paid[c.does]! + g.income;
    risen++;
  }

  // 4. Heads gone; a great body parted in two; holds ended.
  let greatest: Body | undefined;
  for (const g of v.bodies) if (!greatest || g.income > greatest.income) greatest = g;
  for (const g of [...v.bodies]) {
    if (g.since >= year) continue;
    const does = doesOf(g),
      rowOf = DOES_ROWS[does],
      age = year - g.leader.born,
      lost = leaderLost(diesWithin(ctx.life, age, 1), 0, span);
    if ((g.headId && headGone?.(ctx.world, g.headId)) || f.u(100 + g.id * 8) < lost) {
      const before = g.leader.name,
        head = newHead(f, g, g.home, g.id * 37 + g.leaders, false);
      g.leader = head.leader;
      if (head.id) g.headId = head.id;
      else delete g.headId;
      g.leaders++;
      // (How well it is run turns with who runs it: half what it was, half the new head's own.)
      if (g.does !== DOES.order && g.does !== DOES.judge)
        g.quality = Math.round(0.5 * g.quality + 0.5 * (550 + 400 * f.u(101 + g.id * 8)));
      // (Told of its realm's greatest body, or where one the world keeps by name takes it; another's head changes untold, its
      // page saying whose it is now: a head each some twenty years for every body of a world is no news.)
      const l = lands.get(g.home),
        told =
          head.id || g === greatest
            ? tell(
                f,
                INST_EVENTS.head.type,
                g.home,
                {
                  body: g.name,
                  title: titleOf(g, l),
                  leader: g.leader.name,
                  before,
                  ...(head.id ? { head: head.id } : {}),
                },
                [{ ref: g.event, role: "enabler", weight: 1 }],
              )
            : g.event;
      // (Parted: a great body kept by its members or its customers, at a passing its people do not agree on.)
      if (
        g.staff >= INST.partsAt * rowOf.least &&
        (g.fund === FUND.dues || g.fund === FUND.customers) &&
        v.bodies.length < kept &&
        v.bodies.filter((x) => x.does === g.does).length <
          ofOneKept(does, r.lands.length, RIVALS.has(g.does)) &&
        f.u(102 + g.id * 8) < INST.parts &&
        l
      ) {
        // (In its own land where the custom there bears two; else in another land it holds.)
        const to =
          RIVALS.has(g.does) &&
          v.bodies.filter((x) => alike(x, g) && x.home === g.home).length < rowOf.aLand
            ? l
            : lands.get(
                g.lands.find(
                  (c) =>
                    c !== g.home &&
                    lands.get(c)?.settled &&
                    !v.bodies.some((x) => alike(x, g) && x.home === c),
                ) ?? -1,
              );
        const name = to ? tongueWord(f, to.cell, v.next * 19 + g.does + 5, 0x0c5e) : null;
        if (to && name && !v.bodies.some((x) => x.name === name && x.does === g.does)) {
          const h2 = newHead(f, g, to.cell, g.id * 41 + g.leaders, true),
            part = Math.round(g.staff * 0.35),
            nid = v.next++,
            n: Body = {
              ...g,
              id: nid,
              name,
              since: year,
              home: to.cell,
              lands: [to.cell],
              leader: h2.leader,
              leaders: 1,
              staff: part,
              wealth: Math.round(g.wealth * 0.35),
              quality: 550 + Math.round(400 * f.u(103 + g.id * 8)),
              event: "" as Ref,
            };
          delete n.struck;
          delete n.won;
          delete n.hand;
          delete n.handUntil;
          delete n.founderId;
          delete n.headId;
          if (h2.id) {
            n.founderId = h2.id;
            n.headId = h2.id;
          }
          g.staff -= part;
          g.wealth -= n.wealth;
          g.lands = g.lands.filter((c) => c !== to.cell || c === g.home);
          (n as { event: Ref }).event = tell(
            f,
            INST_EVENTS.parted.type,
            to.cell,
            {
              body: name,
              title: titleOf(n, to),
              from: g.name,
              fromTitle: titleOf(g, l),
              leader: n.leader.name,
              does,
            },
            [
              { ref: told, role: "trigger", weight: 1 },
              { ref: g.event, role: "enabler", weight: 1 },
            ],
            [factor("its hands, for the fewest its work takes", g.staff / rowOf.least, 1)],
          );
          v.bodies.push(n);
        }
      }
    }
    const fell = slumped.get(g);
    if (
      fell !== undefined &&
      !(g.hand === 2 && (g.handUntil ?? 0) >= year) &&
      f.u(104 + g.id * 8) < INST.fails
    ) {
      gone.push([
        g,
        "failed",
        [
          factor("what its customers pay, of what they paid a reckoning ago", fell, -1),
          factor("its purse, in years of its pay", g.wealth / Math.max(1, g.income), 0.2),
        ],
      ]);
      ending.add(g);
      continue;
    }
    if (g.staff < INST.withers * rowOf.least) {
      const slump = g.fund === FUND.customers;
      gone.push([
        g,
        g.standing === 0 ? "suppressed" : slump ? "failed" : "withered",
        [
          factor("the hands its pay keeps", g.staff, -1),
          factor("the fewest its work takes", rowOf.least, 0.5),
          ...(g.standing === 0
            ? [factor("its seat's hand against it", r.capacity, r.capacity)]
            : []),
        ],
      ]);
      ending.add(g);
    }
  }
  // (Two that do the same from one home: the lesser, fallen under a part of the greater, is taken over.)
  for (const g of [...v.bodies].sort((a, b) => a.staff - b.staff || b.id - a.id)) {
    if (ending.has(g) || g.since >= year) continue;
    const gw = weightOf(g),
      twin = v.bodies.find(
        (x) =>
          x !== g &&
          !ending.has(x) &&
          alike(x, g) &&
          x.home === g.home &&
          x.since < year &&
          gw < INST.takenUnder * weightOf(x),
      );
    if (!twin) continue;
    ending.add(g);
    gone.push([
      g,
      g.fund === FUND.customers ? "taken over" : "merged",
      [
        factor("its part of what is paid there", g.share / 1000, -1),
        factor("the greater's", twin.share / 1000, 1),
        factor("how well each is run", twin.quality / 1000 - g.quality / 1000, 0.3),
      ],
      twin,
    ]);
  }
  for (const [g, how, factors, into] of gone) {
    if (!v.bodies.includes(g)) continue;
    if (into && v.bodies.includes(into)) {
      into.staff += g.staff;
      into.wealth += g.wealth;
    }
    ended(f, g, how, factors, into);
  }

  // 5. Its lands: its home, and as it grows the lands where its payer pays most for what it does.
  const ranked = new Map<number, number[]>();
  for (const g of v.bodies) {
    const rowOf = DOES_ROWS[doesOf(g)],
      n = Math.max(1, Math.min(INST.lands, 1 + Math.floor(g.staff / (10 * rowOf.least)))),
      k = g.does * FUNDS + g.fund;
    // (Chosen again only as it grows or shrinks past a land's worth, or loses one: a body stays where it is.)
    if (g.lands.length === n && g.lands[0] === g.home) continue;
    let list = ranked.get(k);
    if (!list)
      ranked.set(
        k,
        (list = r.lands
          .filter((l) => l.pay[k]! > 0 && canStand(doesOf(g), l.ground))
          .sort((a, b) => b.pay[k]! - a.pay[k]! || a.cell - b.cell)
          .map((l) => l.cell)),
      );
    const held = [g.home];
    for (let i = 0; i < list.length && held.length < n; i++) {
      const c = list[i]!;
      if (c === g.home) continue;
      // (Not where another that does the same has its home, nor past what a land holds of its kind.)
      let there = 0,
        homed = false;
      for (const x of v.bodies)
        if (x !== g && x.does === g.does && x.lands.includes(c)) {
          there++;
          if (x.home === c) homed = true;
        }
      if (homed || there >= rowOf.aLand) continue;
      held.push(c);
    }
    g.lands = held;
  }

  // 6. What its works' owners take; what its voices and its watch do for its seat; each land's row.
  const profit = new Map<string, number>();
  for (const g of v.bodies)
    if (g.does === DOES.make && g.answers === ANSWERS.owners)
      profit.set(
        g.keeper,
        (profit.get(g.keeper) ?? 0) + g.income * INST.margin * (g.quality / 1000),
      );
  v.profit = [...profit]
    .map(([a, b]) => [a, Math.round(b)] as [string, number])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  writeLands(v, r, lands, strikes, year, rows);
  v.last = year;
}

/** Each of a realm's lands: what its bodies do there; and what they come to for its seat. */
function writeLands(
  v: RealmBodies,
  r: Read,
  lands: ReadonlyMap<number, Land>,
  strikes: ReadonlyMap<number, number>,
  year: number,
  rows: RowStore | null,
): void {
  if (!rows) return;
  // (A body's hands lie in its lands as what is paid for it does.)
  const spread = new Map<Body, number>(),
    hereOf = new Map<number, Body[]>();
  for (const g of v.bodies) {
    let all = 0;
    for (const c of g.lands) {
      const l = lands.get(c);
      if (l) all += l.pay[g.does * FUNDS + g.fund]! || 1;
      const list = hereOf.get(c);
      if (list) list.push(g);
      else hereOf.set(c, [g]);
    }
    spread.set(g, all);
  }
  let reach = 0,
    told = 0;
  for (const l of r.lands) {
    const was = rows.get(l.cell),
      here = hereOf.get(l.cell);
    if (!here) {
      if (was) rows.drop(l.cell);
      continue;
    }
    const out = new Array<number>(BODY_LANDS_WIDTH).fill(0);
    // (A strike told this reckoning is lost in the year to come; one told before stands until its year has passed.)
    const strike = strikes.get(l.cell);
    if (strike !== undefined) {
      out[BODY_ROW.strike] = strike * 1000;
      out[BODY_ROW.strikeYear] = year + 1;
    } else if (was && was[BODY_ROW.strikeYear]! > year) {
      out[BODY_ROW.strike] = was[BODY_ROW.strike]!;
      out[BODY_ROW.strikeYear] = was[BODY_ROW.strikeYear]!;
    }
    let works = 0,
      craft = 0,
      union = 0,
      free = 0,
      kept = 0;
    for (const g of here) {
      const part = (l.pay[g.does * FUNDS + g.fund]! || 1) / Math.max(1, spread.get(g) ?? 1),
        n = g.staff * part,
        q = g.quality / 1000;
      switch (g.does) {
        case DOES.make:
          works += l.crafters > 0 ? n / l.crafters : 0;
          out[BODY_ROW.firms] = out[BODY_ROW.firms]! + 1;
          break;
        case DOES.craft:
          craft += l.crafters > 0 ? (n / l.crafters) * q : 0;
          break;
        case DOES.bargain:
          union += l.crafters > 0 ? n / l.crafters : 0;
          out[BODY_ROW.won] = Math.max(out[BODY_ROW.won]!, g.won ?? 0);
          break;
        case DOES.order: {
          const full = Math.min(1, n / Math.max(1, (l.people * INST.watchFull) / 1000));
          if (g.answers === ANSWERS.seat && full * 1000 > out[BODY_ROW.watch]!) {
            out[BODY_ROW.watch] = full * 1000;
            out[BODY_ROW.honest] = g.quality;
          }
          break;
        }
        case DOES.judge: {
          const full = Math.min(1, n / Math.max(1, (l.people * INST.courtFull) / 1e5));
          if (full * 1000 > out[BODY_ROW.court]!) {
            out[BODY_ROW.court] = full * 1000;
            out[BODY_ROW.bought] = full * (1 - q) * 1000;
            out[BODY_ROW.held] = (g.held ?? 0) * part;
          }
          break;
        }
        case DOES.worship:
          out[BODY_ROW.clergy] = Math.max(
            out[BODY_ROW.clergy]!,
            Math.min(1, n / Math.max(1, l.people * 0.002)) * 1000,
          );
          break;
        case DOES.teach:
          out[BODY_ROW.teach] = 1000;
          if (g.higher === 1)
            out[BODY_ROW.higher] = Math.max(
              out[BODY_ROW.higher]!,
              Math.min(1, n / Math.max(1, l.people * 0.0005)) * q * 1000,
            );
          break;
        case DOES.heal:
          out[BODY_ROW.heal] = Math.max(
            out[BODY_ROW.heal]!,
            Math.min(1, n / Math.max(1, l.people * 0.0005)) * q * 1000,
          );
          break;
        case DOES.word: {
          // (Each hand of a voice reaches some three hundred who read.)
          const reaches = Math.min(1, (n * 300) / Math.max(1, l.people * l.ground.readers)) * q;
          if (g.answers === ANSWERS.owners && g.standing > 0) free = Math.max(free, reaches);
          else if (g.answers === ANSWERS.house) kept = Math.max(kept, reaches);
          break;
        }
        case DOES.insure:
          out[BODY_ROW.insure] = Math.max(out[BODY_ROW.insure]!, q * 1000);
          break;
      }
    }
    out[BODY_ROW.works] = dmath.clamp(works, 0, INST.worksEngines) * 1000;
    out[BODY_ROW.craft] = dmath.clamp(craft, 0, 1) * 1000;
    out[BODY_ROW.union] = dmath.clamp(union, 0, 1) * 1000;
    out[BODY_ROW.word] = free * 1000;
    out[BODY_ROW.kept] = kept * 1000;
    out[BODY_ROW.bodies] = here.length;
    rows.set(l.cell, out);
    // (For its seat: an honest watch where its people are, less a bought one; what its free voices tell of its lands'
    // grievance to those who read, and what its kept ones say for it.)
    const share = r.people > 0 ? l.people / r.people : 0,
      watch = out[BODY_ROW.watch]! / 1000,
      honest = out[BODY_ROW.honest]! / 1000;
    reach += share * watch * (2 * honest - 1);
    told +=
      share *
      l.ground.readers *
      (INST.praises * kept * r.legitimacy - INST.tells * free * l.grievance * r.word);
  }
  v.reach = Math.round(dmath.clamp(reach, -1, 1) * INST.reach * 10000);
  v.told = Math.round(told * 10000);
}

/**
 * Bodies whose land passed to another realm, taken into its record (a new number there; the same founding, so the same page).
 * One whose land has no village is taken into the new realm's greatest of its kind, which has a house, where there is one.
 */
function rehome(
  lands: (realm: Ref) => number,
  settled: (land: number) => boolean,
  store: BodiesStore,
  moved: [Body, Ref][],
  year: number,
): void {
  const by = new Map<Ref, Body[]>();
  for (const [g, to] of moved) by.set(to, [...(by.get(to) ?? []), g]);
  for (const to of [...by.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const was = store.of(to),
      v = was ? copyOf(was) : fresh(year);
    for (const g of by.get(to)!) {
      // (Not past what a realm keeps account of; nor a second of what one land holds one of. One more of its kind than its
      // new realm keeps is taken into that realm's greatest of the kind.)
      const rowOf = DOES_ROWS[doesOf(g)],
        kin = v.bodies.filter((x) => x.does === g.does);
      if (
        kin.length > ofOneKept(doesOf(g), lands(to), RIVALS.has(g.does)) ||
        (kin.length > 0 && !settled(g.home))
      ) {
        const into = kin.sort((a, b) => b.staff - a.staff || a.id - b.id)[0]!;
        into.staff += g.staff;
        into.wealth += g.wealth;
        continue;
      }
      if (v.bodies.length >= bodiesKept(lands(to)) + 2) continue;
      if (
        v.bodies.filter((x) => x.does === g.does && x.lands.includes(g.home)).length >= rowOf.aLand
      )
        continue;
      if (v.bodies.some((x) => x.event === g.event)) continue;
      const n: Body = {
        ...g,
        id: v.next++,
        lands: [g.home],
        // (A new seat's own: what answered to the old seat answers to the new; a works it had seized is its owners' again.)
        keeper: g.fund === FUND.tithes ? g.keeper : "",
        standing: 1,
        leader: { ...g.leader },
      };
      // (Untold: the land's passing is the news, and its bodies go with it.)
      v.bodies.push(n);
    }
    store.put(to, v);
  }
}

/**
 * 188.order.zzbodies, a year: each realm in its turn (its ref's number and the year, a year after its groups, INST.every),
 * stepped as many years as since it was last. A realm where nothing is paid for keeps no record, and the store stays dormant.
 */
export function bodiesYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = bodiesOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    realms = politiesOf(world),
    living = realms.living(),
    rows = bodyLandsStore(world),
    moved: [Body, Ref][] = [];
  if (year % 10 === 0) {
    // (A realm ended: its bodies go with their lands to whoever holds them now.)
    const alive = new Set(living.map((p) => p.ref));
    for (const r of store.realmsKept()) {
      if (alive.has(r)) continue;
      for (const g of store.of(r)!.bodies) {
        const now = realms.of(g.home);
        if (now && now.ended === null) moved.push([g, now.ref]);
      }
      store.forget(r);
    }
    // (A land no realm holds keeps no row; a land that changed hands is written again at its new realm's turn.)
    if (rows && year % 50 === 0)
      for (const k of rows.keys()) if (!realms.of(Number(k))) rows.drop(k);
  }
  for (const p of living) {
    if ((refNumber(p.ref) + year + 1) % INST.every !== 0) continue;
    const was = store.of(p.ref),
      // (Stepped in place: the record is folded into the store's digest again when it is put.)
      v: RealmBodies = was ? (was as RealmBodies) : fresh(year),
      span = was ? Math.max(1, Math.min(50, year - was.last)) : INST.every;
    stepRealm(ctx, p, v, span, t, moved);
    if (was || v.bodies.length || v.next > 1) store.put(p.ref, v);
  }
  if (moved.length)
    rehome(
      (r) => realms.get(r)?.members.length ?? 1,
      (c) => ctx.settlements.inProvince(c).length > 0,
      store,
      moved,
      year,
    );
}

// —— The god's hand on a body ————————————————————————————————————————————————————————————————————————————

/** What the hand may do to a body: bless it (it draws more, runs better), curse it, keep its seat's hand off it. */
export const BODY_ACTS = ["bless", "curse", "protect"] as const;
export type BodyAct = (typeof BODY_ACTS)[number];
/** How long the hand's mark on a body lasts (years). */
export const BODY_ACT_YEARS = 20;

/**
 * Lay the hand on a body (found by the event it was founded by): its mark kept on the body until it fades, read where its pay
 * and its realm's hold on it are reckoned. Tells the act; null where no such body stands. Only a player sets this off.
 */
export function actOnBody(
  ctx: PopulationContext,
  founded: Ref,
  act: BodyAct,
  command: Ref | null = null,
): Ref | null {
  const { world } = ctx,
    store = bodiesOf(world);
  if (!store) return null;
  const year = yearOfMoment(world.now);
  for (const realm of store.realmsKept()) {
    const was = store.of(realm)!;
    if (!was.bodies.some((g) => g.event === founded)) continue;
    const v = copyOf(was),
      g = v.bodies.find((x) => x.event === founded)!,
      p = politiesOf(world).get(realm);
    g.hand = act === "bless" ? 1 : act === "curse" ? -1 : 2;
    g.handUntil = year + BODY_ACT_YEARS;
    if (act !== "protect" && g.does !== DOES.order && g.does !== DOES.judge)
      g.quality = Math.round(dmath.clamp(g.quality + (act === "bless" ? 150 : -150), 100, 1000));
    store.put(realm, v);
    return world.events.emit({
      type: INST_EVENTS.hand.type,
      subjects: [realm],
      place: ctx.provinces.get(g.home)?.ref ?? null,
      causes: [
        ...(command ? [{ ref: command, role: "agent" as const, weight: 1 }] : []),
        { ref: g.event, role: "enabler" as const, weight: 1 },
      ],
      data: {
        body: g.name,
        title: bodyTitle(ctx, g),
        act,
        until: g.handUntil,
      },
    });
  }
  return null;
}

// —— What the realm's reach and standing gain and lose ————————————————————————————————————————————————————

addsReach((ctx, p) => {
  const v = bodiesOf(ctx.world)?.of(p.ref);
  if (!v || !v.reach) return [];
  const k = v.reach / 10000,
    g = v.bodies.find((x) => x.does === DOES.order && x.answers === ANSWERS.seat);
  return [
    {
      name: k >= 0 ? "a watch kept and paid" : "a watch that is bought",
      value: r2(k),
      contribution: k,
      source: g ? g.event : null,
    },
  ];
});

addsStanding((ctx, p) => {
  const v = bodiesOf(ctx.world)?.of(p.ref);
  if (!v || !v.told) return [];
  const k = v.told / 10000;
  if (Math.abs(k) < 0.001) return [];
  const g = v.bodies.find(
    (x) =>
      x.does === DOES.word && (k < 0 ? x.answers === ANSWERS.owners : x.answers === ANSWERS.house),
  );
  return [
    {
      name: k < 0 ? "what its papers tell of its lands' grievance" : "voices kept to speak for it",
      value: r2(k),
      contribution: k,
      source: g ? { ref: g.event, role: "pressure", weight: 1 } : null,
    },
  ];
});

const taught = (world: World, cell: number): boolean => taughtIn(world, cell);
const inquires = (world: World, cell: number): number => {
  const k = higherIn(world, cell);
  return k > 0 ? 1 + INST.inquiry * k : 1;
};
const heals = (world: World, cell: number): number => {
  const k = healedIn(world, cell);
  return k > 0 ? 1 + INST.heals * k : 1;
};

/** Register the institutions on a peopled world. */
export function installInstitutions(world: World, ctx: () => PopulationContext): BodiesStore {
  const store = world.register(new BodiesStore());
  world.register(new RowStore(BODY_LANDS_STORE, BODY_LANDS_WIDTH));
  world.addPinner(() => store.pinned());
  world.system({ key: "188.order.zzbodies", every: YEAR, run: (t) => bodiesYear(ctx(), t) });
  // The god's hand on a body: blessed, cursed, or kept from its seat's hand, for BODY_ACT_YEARS.
  world.defineCommand({
    type: "act.body",
    validate: (args) => {
      const a = args as { body?: string; act?: string };
      if (!a.act || !(BODY_ACTS as readonly string[]).includes(a.act)) return "no such act";
      const found = store
        .realmsKept()
        .some((r) => store.of(r)!.bodies.some((g) => g.event === a.body));
      return found ? null : "it no longer stands";
    },
    apply: (command) => {
      const a = command.args as { body: Ref; act: BodyAct };
      actOnBody(ctx(), a.body, a.act, command.id);
    },
  });
  // (Exactly as before where none is kept: a house of teaching is a school, higher learning inquires, healing reaches further.)
  teachesAsSchool(taught);
  inquiresMore(inquires);
  healsMore(heals);
  return store;
}
