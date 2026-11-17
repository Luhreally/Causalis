// Groups (the rules are rules/groups.ts; what is kept ./groups-kept.ts). The general layer under every organised group the world
// did not already name: people band together where a stake they share is worth more to each of them than holding together costs,
// and what the group comes to be is read off what it does. A realm is reckoned once in ORG.every years, in its turn (its ref's
// number and the year, two years after its underworld), and stepped as many years at once:
//   - the stakes, land by land, read off the world's own rows: the road and sea trade within reach of those who would prey on it
//     (the treasury's trade and its sea trade, money/cover; how far the seat reaches each land, polity reach and capacityOf; its
//     navy's tonnes against its merchantmen, war/navy); what preying, the underworld's killing and a war on its border take, that
//     its people would guard against; wrongs left unjudged where courts are absent (society law); a great town far from a seat that
//     reaches little; the risks of death, sickness and the street that kin and the seat's care leave unpooled (society care,
//     roofless); credit where no bank lends (credit houses); long trade among many towns; a faith pressed by its seat (belief, the
//     realm's law on faith); a rising's worth to the aggrieved under a doubted, voiceless seat, or a land held by a foreign hand
//     (war/occupation); a secret's worth to the educated few shut out; and the pay of realms at war short of men, for idle veterans;
//   - what binds each stake's people (kin, one faith or people, writing, deals kept, a focal leader) and so what organising costs;
//   - a group forms where the members a stake gathers reach a crew, its first aim and kind read off its stake and means; each
//     reckoning its aims move toward the stakes in its reach, so its kind may turn; its members move toward what its stake keeps;
//     its realm outlaws, lets be, charters or hires it, cracks down on what it outlaws; its leader dies or is taken; groups of one
//     first aim ally into a federation; a group withers when its stake no longer keeps it, is crushed, merged, or has what it rose
//     for (a revolution won).
// What flows back, each through a small additive hook read by an older system, exactly as before where nothing is kept: preying
// cuts the trade that passes a land (economy trade flows) and its holdings' safety, and kills; guarding, enforcing, communes,
// leagues and lending circles hold deals where the courts do not (society holdings); mutual aid spares deaths (population
// mortality) and takes in the roofless (society roofless); revolutionary groups add to the danger of a rising and lodges to a
// coup's (strife); sects keep their lands from their seat's faith (belief spread) and breed grievance where their faith is pressed;
// companies and privateers add to the strength of whoever pays them, from the payer's treasury (war); communes and brigands thin
// the seat's reach, and brigands and pirates on its roads and seas its standing. Deferred to their own systems, each a seam: the
// underworld (selling protection, smuggling cartels, street gangs, enforcers turned crew), houses, labour's guilds and unions,
// belief's temples.
import {
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
  AIM,
  HOLD,
  OCC,
  ORG,
  ORG_AIMS,
  ORG_BASES,
  ORG_KINDS,
  FULL_TIME,
  aidWorth,
  aimFit,
  aimsToward,
  cohesionOf,
  conspireWorth,
  crewOf,
  diesWithin,
  enforceWorth,
  firstAim,
  guardWorth,
  hirePay,
  joinedOf,
  leaderLost,
  lendWorth,
  meansBit,
  orgKind,
  outlawedAim,
  preyTake,
  rebelWorth,
  roadGuarded,
  ruleWorth,
  seaGuarded,
  suppressionOf,
  tradeWorth,
  violentIdle,
  worshipWorth,
  youngBand,
  type OrgAim,
  type OrgBasis,
  type OrgEnd,
  type OrgKind,
  BANDS,
  MALE,
} from "../../rules/index.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";
import { row } from "../population/model.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { beliefOf } from "../belief/belief.ts";
import { loreOf } from "../lore/lore.ts";
import { politiesOf, reach, realmName, type Polity } from "../polity/polity.ts";
import { diplomacyOf } from "../diplomacy/diplomacy.ts";
import { fieldedOf, warsOf } from "../war/war.ts";
import { coastal, navyOf } from "../war/navy.ts";
import { occupationOf } from "../war/occupation.ts";
import { grieve } from "../acts/disasters.ts";
import {
  COVER_STORE,
  FISC,
  POOL,
  SHARE,
  SHARES_STORE,
  TREASURY_STORE,
  moneyStore,
  refNumber,
  stepped,
  RowStore,
} from "../money/kept.ts";
import { idleOf } from "../trade/kept.ts";
import {
  LAW_ROW,
  LAW_STORE,
  careSparedOf,
  provisionOf,
  societyStore,
  streetOf,
} from "../society/kept.ts";
import { addsReach, addsStanding, capacityOf, orderOf } from "./order.ts";
import { holdsOf } from "./holds.ts";
import { LAW_OF } from "./laws.ts";
import { housesRead } from "./houses.ts";
import { killedOf, protectedOf, underworldOf } from "./underworld-kept.ts";
import { creditOf } from "../credit/credit.ts";
import { revolutionHolds } from "../strife/strife.ts";
import {
  ORG_LANDS_STORE,
  ORG_LANDS_WIDTH,
  ORG_ROW,
  OrgsStore,
  orgLandsStore,
  orgsOf,
  type Org,
  type OrgFed,
  type RealmOrgs,
} from "./groups-kept.ts";

export const ORG_EVENTS = {
  /** A group formed where a shared stake beat what holding together costs. */
  rose: defineEventType("groups.rose", 3),
  /** Its aims moved, and it is now of another kind. */
  turned: defineEventType("groups.turned", 3),
  /** A realm took it into its pay or licensed it; granted it its rights. */
  hired: defineEventType("groups.hired", 3),
  chartered: defineEventType("groups.chartered", 2),
  /** Its head gone, another in his place. */
  leader: defineEventType("groups.leader", 1),
  /** Groups of one first aim allied. */
  federation: defineEventType("groups.federation", 3),
  /** Its hold ended. */
  ended: defineEventType("groups.ended", 3),
};

const DRAW = defineStream("order.groups");
const per = (x: number) => Math.round(dmath.clamp(x, 0, 1) * 1000);
const keyOf = (r: Ref) => parseRef(r).b >>> 0;
const r2 = (x: number) => Math.round(x * 100) / 100;
const AIMS = ORG_AIMS.length;
/** The aims that take men under arms. */
const ARMED: ReadonlySet<OrgAim> = new Set(["prey", "guard", "enforce", "rule", "hire", "rebel"]);
/** A household, for a common stake: its working-years are what its members gain and spend. */
const HOUSEHOLD = 5;

export const kindName = (g: { readonly kind: number }): OrgKind =>
  ORG_KINDS[g.kind] ?? "brotherhood";
export const orgAimOf = (g: { readonly aim: number }): OrgAim => ORG_AIMS[g.aim] ?? "aid";
const KIND = (k: OrgKind) => ORG_KINDS.indexOf(k);

const factor = (name: string, value: number, contribution: number): Factor => ({
  name,
  value: r2(value),
  contribution,
  source: null,
});

// —— What a realm offers its people to band for ——————————————————————————————————————————————————————————

/** One land of a realm as its groups weigh it. */
type Land = {
  cell: number;
  people: number;
  /** How far its seat's hand reaches it (0 … 1). */
  reach: number;
  town: number;
  coast: boolean;
  grievance: number;
  faith: Ref | null;
  /** How far its faith is pressed by its seat (0 … 1). */
  pressed: number;
  /** A foreign hand's hold on it (its resistance, 0 … 1; 0 where none holds it). */
  occupied: number;
  /** Of its people, killed a year by the underworld and by the realm's groups as last reckoned. */
  killed: number;
  extorted: number;
  /** Its road trade and its sea trade (grain's worth a year). */
  road: number;
  sea: number;
  traders: number;
  street: number;
  credit: number;
  /** On a border with a foe in an open war. */
  front: boolean;
  /** How far it is threatened (preyed on, killed in, a war on its border), as last reckoned (0 … 1). */
  threat: number;
  /** Its stakes this reckoning: what each aim is worth here (grain's worth a year), and the members it would gather. */
  worth: number[];
  gather: number[];
};

type Read = {
  people: number;
  wage: number;
  trade: number;
  sea: number;
  earned: number;
  reserve: number;
  capacity: number;
  corruption: number;
  legitimacy: number;
  doubt: number;
  force: number;
  voice: number;
  word: number;
  deals: number;
  byCourts: number;
  courts: number;
  writing: number;
  ideas: number;
  kin: number;
  piety: number;
  care: number;
  poor: number;
  seatFaith: Ref | null;
  oneFaith: number;
  veterans: number;
  pool: number;
  supply: number;
  /** Its sea trade's guard (0 … 1). */
  seaGuard: number;
  atWar: boolean;
  /** What realms at war would pay its idle veterans (grain's worth a year), and the best payer. */
  hire: number;
  payer: Ref | null;
  /** What its foes' sea trade is worth to licensed raiders (grain's worth a year). */
  foeSea: number;
  rival: number;
  following: number;
  lands: Land[];
};

function readRealm(ctx: PopulationContext, p: Polity, year: number): Read {
  const { world } = ctx,
    realms = politiesOf(world),
    o = orderOf(world)?.of(p.ref),
    held = holdsOf(world, p.ref),
    law = societyStore(world, LAW_STORE)?.get(p.ref),
    fisc = moneyStore(world, TREASURY_STORE)?.get(p.ref),
    lore = loreOf(world),
    belief = beliefOf(world),
    culture = cultureOf(world),
    markets = marketsOf(world),
    occ = occupationOf(world),
    credit = creditOf(world),
    steps = reach(ctx, p),
    cap = capacityOf(ctx, p).value,
    seatWays = culture.get(p.seat),
    seatFaith = belief.of(p.seat).faith ?? null,
    m = markets.get(p.seat),
    wage = Math.max(1, m ? Math.max(m.wage[OCC.crafter]!, m.wage[OCC.farmer]!) : 1),
    legitimacy = o?.legitimacy ?? 0.5,
    lawFaith = o?.laws[LAW_OF.faith] ?? 1,
    // (The seat holds its temple where its ruler is its priest, or its law knows one faith.)
    holdsTemple = p.leadership === 3 || lawFaith === 0 ? 1 : 0,
    banks = new Set((credit?.standing() ?? []).map((h) => h.cell)),
    wars = warsOf(world).fighting(p.ref),
    foes = new Set(wars.map((w) => (w.attacker === p.ref ? w.defender : w.attacker))),
    trade = fisc ? fisc[FISC.base + 1]! / 2 : 0,
    sea = Math.min(trade, moneyStore(world, COVER_STORE)?.at(p.ref, POOL.seaTrade) ?? 0),
    lands: Land[] = [];
  let people = 0,
    young = 0,
    street = 0,
    ofSeatFaith = 0,
    weightAll = 0,
    coastAll = 0;
  for (const c of p.members) {
    const prov = ctx.provinces.get(c);
    if (!prov) continue;
    const n = prov.total();
    if (n <= 0) continue;
    people += n;
    for (let b = 0; b < BANDS; b++)
      if (youngBand(ctx.life, b)) young += prov.counts.rowSum(row(MALE, b));
    const st = streetOf(world, c);
    street += n * st;
    const faith = belief.of(c).faith ?? null;
    if (faith === seatFaith) ofSeatFaith += n;
    const town = ctx.settlements.inProvince(c).find((s) => s.market)?.population ?? 0,
      coast = coastal(ctx, c),
      far = steps.get(c) ?? 6,
      landReach = dmath.clamp(cap / (1 + far / 4), 0, 1),
      pressed =
        faith && seatFaith && faith !== seatFaith
          ? lawFaith === 0
            ? 1
            : lawFaith === 1
              ? 0.4
              : 0.1
          : faith && faith === seatFaith && holdsTemple
            ? 0.25 * (1 - legitimacy)
            : 0,
      ow = occ?.of(c),
      under = protectedOf(world, c);
    let front = false;
    if (foes.size)
      for (let k = ctx.generated.grid.offsets[c]!; k < ctx.generated.grid.offsets[c + 1]!; k++) {
        const q = realms.of(ctx.generated.grid.neighbours[k]!)?.ref;
        if (q && foes.has(q)) {
          front = true;
          break;
        }
      }
    const weight = n + 2 * town;
    weightAll += weight;
    if (coast) coastAll += weight;
    lands.push({
      cell: c,
      people: n,
      reach: landReach,
      town,
      coast,
      grievance: dmath.clamp(realms.discontent(c).level, 0, 1),
      faith,
      pressed,
      occupied: ow && ow.holder !== p.ref ? Math.max(0.2, ow.resistance) : 0,
      killed: killedOf(world, c),
      extorted: under.extortion,
      road: weight,
      sea: coast ? weight : 0,
      traders: prov.occupation(OCC.trader),
      street: st,
      credit: banks.has(c) ? 1 : 0,
      front,
      threat: front ? 1 : 0,
      worth: new Array<number>(AIMS).fill(0),
      gather: new Array<number>(AIMS).fill(0),
    });
  }
  // (Its trade shared among its lands by their weight, its sea trade among its coasts.)
  for (const l of lands) {
    const w = l.road;
    l.road = weightAll > 0 ? ((trade - sea) * w) / weightAll : 0;
    l.sea = coastAll > 0 ? (sea * l.sea) / coastAll : 0;
  }
  // (Those come home from a war it ended in the last ten years: the most it fielded in one battle, less its fallen.)
  let veterans = 0;
  for (const w of warsOf(world).of(p.ref)) {
    if (w.ended === null || w.ended < year - 10) continue;
    const side = w.attacker === p.ref ? 0 : 1;
    let most = 0;
    for (const b of w.battles) most = Math.max(most, b.fielded?.[side] ?? 0);
    veterans += Math.max(0, most - w.fallen[side]);
  }
  const fifth = moneyStore(world, SHARES_STORE)?.get(p.seat)?.[SHARE.fifths],
    poor = fifth !== undefined ? dmath.clamp(1 - fifth / 1000 / 0.2, 0, 1) : 0.5,
    idle = idleOf(world, p.ref),
    v = violentIdle({
      veterans: people > 0 ? veterans / people : 0,
      young: people > 0 ? young / people : 0,
      idle,
      poor,
      street: people > 0 ? street / people : 0,
    }),
    ships = navyOf(world)?.of(p.ref),
    // (A navy covers its merchantmen with a tonne of warships for some six of theirs; without a navy, its havens' reach alone.)
    seaGuard = seaGuarded(ships?.tons ?? 0, Math.max(1, (ships?.merchant ?? 0) / 6), cap);
  // (Realms at war short of men, its own or its neighbours, that would pay for soldiers: the best payer.)
  let hire = 0,
    payer: Ref | null = null,
    foeSea = 0;
  const near = new Set<Ref>([p.ref]);
  for (const rel of diplomacyOf(world).all()) {
    if (rel.a === p.ref) near.add(rel.b);
    else if (rel.b === p.ref) near.add(rel.a);
  }
  for (const q of [...near].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const qp = realms.get(q);
    if (!qp || qp.ended !== null) continue;
    for (const w of warsOf(world).fighting(q)) {
      const foe = realms.get(w.attacker === q ? w.defender : w.attacker);
      if (!foe || foe.ended !== null || foe.ref === p.ref) continue;
      const short = fieldedOf(ctx, foe) - fieldedOf(ctx, qp),
        qm = markets.get(qp.seat),
        qWage = Math.max(1, qm ? Math.max(qm.wage[OCC.crafter]!, qm.wage[OCC.farmer]!) : wage),
        reserve = moneyStore(world, TREASURY_STORE)?.at(q, FISC.reserve) ?? 0,
        pay = hirePay(short, qWage, reserve);
      if (pay > hire) {
        hire = pay;
        payer = q;
      }
      if (q === p.ref) foeSea += moneyStore(world, COVER_STORE)?.at(foe.ref, POOL.seaTrade) ?? 0;
    }
  }
  const houses = housesRead(world, p.ref);
  return {
    people,
    wage,
    trade,
    sea,
    earned: fisc ? fisc[FISC.base + 3]! : 0,
    reserve: fisc ? fisc[FISC.reserve]! : 0,
    capacity: cap,
    corruption: o?.corruption ?? 0,
    legitimacy,
    doubt: dmath.clamp((0.62 - legitimacy) * 2, 0, 1),
    force: held[HOLD.force] ?? 0.5,
    voice: held[HOLD.voice] ?? 0.3,
    word: held[HOLD.word] ?? 0.5,
    deals: law ? law[LAW_ROW.deals]! / 1000 : 0.5,
    byCourts: law ? law[LAW_ROW.byCourts]! / 1000 : 0,
    courts: law ? law[LAW_ROW.courts]! / 1000 : 0.3,
    writing: lore.effect(p.seat, "writing") > 0 ? 1 : 0,
    ideas: lore.get(p.seat, "philosophy") ? 1 : 0,
    kin: seatWays?.traits[WAY.kinship] ?? 0.5,
    piety: seatWays?.traits[WAY.piety] ?? 0.5,
    care: Math.max(provisionOf(world, p.ref).publicCare, careSparedOf(world, p.seat) ?? 0),
    poor,
    seatFaith,
    oneFaith: people > 0 ? ofSeatFaith / people : 1,
    veterans,
    pool: v.pool * people,
    supply: v.supply,
    seaGuard,
    atWar: wars.length > 0,
    hire,
    payer,
    foeSea,
    rival: houses?.rival ?? 0,
    following: houses?.following ?? 0,
    lands,
  };
}

// —— Each aim's stake, land by land ————————————————————————————————————————————————————————————————————————

/** What binds a stake's people in a land. */
function bindingAt(ctx: PopulationContext, r: Read, l: Land, aim: OrgAim): number {
  const ways = cultureOf(ctx.world).get(l.cell),
    kin = ways?.traits[WAY.kinship] ?? r.kin,
    piety = ways?.traits[WAY.piety] ?? r.piety,
    lore = loreOf(ctx.world),
    leader =
      aim === "hire"
        ? r.veterans > 0
          ? 0.8
          : 0.3
        : aim === "worship"
          ? 0.3 + 0.5 * piety
          : aim === "rebel"
            ? r.following
            : aim === "conspire"
              ? r.rival
              : l.town >= 5000
                ? 0.4
                : 0.2;
  return cohesionOf({
    kin,
    folk: aim === "worship" ? 1 : r.oneFaith,
    faith: aim === "worship" || aim === "aid" ? piety : 0.3 * piety,
    writing: lore.effect(l.cell, "writing") > 0 ? 1 : r.writing * 0.5,
    trust: r.deals,
    leader,
  });
}

/**
 * Each land's stakes this reckoning: what each aim is worth there (grain's worth a year) and the members it would gather. Rents
 * (prey, hire, smuggle) keep full-timers; the rest gather those who share the stake as far as each one's felt gain beats what
 * organising costs him.
 */
function weighStakes(ctx: PopulationContext, p: Polity, r: Read, v: RealmOrgs): void {
  const { world } = ctx,
    under = underworldOf(world)?.of(p.ref),
    // (What the underworld's cartels leave of the smuggling rent: only ever a second aim here.)
    smuggleLeft = under
      ? under.smuggleRent *
        Math.max(
          0,
          1 - under.groups.filter((g) => g.kind === 1).reduce((s, g) => s + g.share, 0) / 1000,
        )
      : 0,
    rows = orgLandsStore(world),
    deaths = 0.012,
    coasts = r.lands.filter((l) => l.coast).length || 1,
    towns = r.lands.filter((l) => l.town >= 2000).length,
    pool = r.pool * ORG.recruit;
  for (const l of r.lands) {
    const households = l.people / HOUSEHOLD,
      men = l.people / 4,
      w = r.wage,
      had = rows?.get(l.cell),
      guardedBefore = had ? had[ORG_ROW.guard]! / 1000 : 0,
      preyedBefore = had ? (had[ORG_ROW.prey]! + had[ORG_ROW.seaPrey]!) / 1000 : 0,
      killedBefore = (had ? had[ORG_ROW.killings]! / 1e6 : 0) + l.killed,
      coh = (aim: OrgAim) => bindingAt(ctx, r, l, aim),
      threat = Math.min(1, (l.front ? 1 : 0) + 20 * preyedBefore + 2000 * killedBefore),
      share = r.people > 0 ? l.people / r.people : 0,
      set = (aim: OrgAim, worth: number, gather: number) => {
        l.worth[AIM[aim]] = Math.max(0, worth);
        l.gather[AIM[aim]] = Math.max(0, gather);
      },
      common = (aim: OrgAim, perHead: number, eligible: number) => {
        const n = joinedOf(aim, perHead, eligible, coh(aim));
        set(aim, perHead * w * Math.max(n, ORG.crew), n);
      };
    l.threat = threat;
    // Prey: the road trade the seat cannot keep, and the sea trade its navy cannot; licensed against a foe's ships at war.
    const road = preyTake(l.road, roadGuarded(l.reach, guardedBefore)),
      seaTake =
        preyTake(l.sea, r.seaGuard) +
        (l.coast && r.atWar ? (preyTake(r.foeSea, 0.3) * 0.5) / coasts : 0),
      preyWorth = Math.max(road, seaTake);
    set("prey", preyWorth, crewOf(preyWorth, w, coh("prey"), pool * share * 2) * r.supply);
    // Smuggle: what the cartels leave (a second aim only).
    set("smuggle", smuggleLeft * share * 0.5, 0);
    // Guard: what preying, killing and a war on the border take.
    // (What is preyed of its trade comes to each household as its share of what passes, in working years.)
    const tradeHere = (l.road + l.sea) / households / w;
    common(
      "guard",
      guardWorth(preyedBefore * tradeHere + (l.front ? 0.08 : 0), killedBefore, l.reach),
      men,
    );
    // Enforce: wrongs left unjudged where courts are absent.
    common("enforce", enforceWorth(killedBefore, l.extorted * 4, r.byCourts, r.deals), men);
    // Rule: a great town its seat's hand barely reaches.
    common("rule", ruleWorth(l.reach, l.town, r.corruption + 0.2), l.town / HOUSEHOLD);
    // Aid: the risks of death, sickness and the street, for a town's households.
    common(
      "aid",
      aidWorth({
        deaths: deaths + l.killed,
        sick: 0.05,
        roofless: l.street,
        care: r.care,
        kin: cultureOf(world).get(l.cell)?.traits[WAY.kinship] ?? r.kin,
      }),
      l.town >= 2000 ? l.town / HOUSEHOLD : 0,
    );
    // Lend: credit where no bank lends, among a town's poorer households.
    common(
      "lend",
      lendWorth(l.credit, r.poor, r.deals),
      l.town >= 2000 ? (l.town / HOUSEHOLD) * 0.6 : 0,
    );
    // Trade: a league's safe passage and rights, for its traders, where many towns trade.
    common("trade", tradeWorth(r.trade, r.earned, r.capacity, towns), l.traders);
    // Worship: a faith pressed by its seat.
    common(
      "worship",
      worshipWorth(
        l.grievance + 0.3 * l.pressed,
        l.pressed,
        cultureOf(world).get(l.cell)?.traits[WAY.piety] ?? r.piety,
      ),
      l.pressed > 0 ? households : 0,
    );
    // Hire: veterans sold to a realm at war short of men.
    const hireWorth = r.hire * share;
    set("hire", hireWorth, crewOf(hireWorth, w, coh("hire"), (r.veterans + 0.2 * r.pool) * share));
    // Rebel: the aggrieved under a doubted, voiceless, hard-held seat; or a foreign hand.
    common(
      "rebel",
      rebelWorth({
        grievance: l.grievance,
        doubt: r.doubt,
        voice: r.voice,
        force: r.force,
        occupied: l.occupied,
      }),
      men,
    );
    // Conspire: the educated few shut out, word unfree.
    common(
      "conspire",
      r.writing > 0
        ? conspireWorth({
            shut: (1 - r.voice) * (0.4 + 0.6 * (1 - r.legitimacy)),
            word: r.word,
            ideas: r.ideas,
            doubt: r.doubt,
          })
        : 0,
      l.town >= 2000 ? l.town * 0.05 : 0,
    );
  }
  for (let k = 0; k < AIMS; k++) {
    v.stakes[k] = Math.round(r.lands.reduce((s, l) => s + l.worth[k]!, 0));
    v.gather[k] = Math.round(r.lands.reduce((s, l) => s + l.gather[k]!, 0));
  }
}

// —— Naming, telling ———————————————————————————————————————————————————————————————————————————————————————

type Facts = {
  readonly ctx: PopulationContext;
  readonly p: Polity;
  readonly v: RealmOrgs;
  readonly r: Read;
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

function newLeader(f: Facts, cell: number, salt: number): Org["leader"] {
  const given = tongueWord(f, cell, salt, 0x6b1d) ?? "One",
    family = tongueWord(f, cell, salt + 1, 0x51f7);
  return {
    name: family ? `${given} ${family}` : given,
    born: f.year - Math.round(f.ctx.life.adulthood * (1.3 + f.u(salt * 7 + 3))),
    since: f.year,
  };
}

function tell(
  f: Facts,
  type: string,
  cell: number | null,
  data: Record<string, unknown>,
  causes: { ref: Ref; role: "trigger" | "enabler" | "pressure"; weight: number }[],
  factors?: Factor[],
): Ref {
  const world = f.ctx.world,
    decision = factors
      ? world.decisions.record({
          rule: type,
          subject: f.p.ref,
          outcome: { ...data },
          score: factors.reduce((s, x) => s + x.contribution, 0),
          threshold: 0,
          factors,
        })
      : null;
  return world.events.emit({
    type,
    subjects: [f.p.ref],
    place: cell !== null ? (f.ctx.provinces.get(cell)?.ref ?? null) : null,
    causes: [
      ...(decision ? [{ ref: decision, role: "trigger" as const, weight: 1 }] : []),
      ...causes,
    ],
    data: { realm: realmName(f.p), ...data },
  });
}

/** What a group holds now (bits by MEANS). */
function meansOf(g: Org, lands: readonly Land[]): number {
  let m = 0;
  const armed = ORG_AIMS.reduce((s, a, i) => s + (ARMED.has(a) ? (g.aims[i] ?? 0) : 0), 0);
  // (Under arms: where what it does takes arms, or where its lands are threatened and it is many enough to arm its own.)
  if (
    armed >= 350 ||
    (g.members >= 4 * ORG.crew &&
      g.lands.some((c) => (lands.find((l) => l.cell === c)?.threat ?? 0) >= 0.3))
  )
    m |= meansBit("arms");
  // (Ships it had, kept while it holds a coast.)
  if (g.means & meansBit("ships") && g.lands.some((c) => lands.find((l) => l.cell === c)?.coast))
    m |= meansBit("ships");
  if (g.wealth >= 0.5 * Math.max(1, g.income) && g.income > 0) m |= meansBit("purse");
  if (ORG_BASES[g.basis] === "faith") m |= meansBit("faith");
  if (g.standing === 0) m |= meansBit("secret");
  return m;
}

/** A group's kind, read off its aims and means. */
function readKind(g: Org, lands: readonly Land[], patron: boolean): OrgKind {
  const aim = orgAimOf(g),
    ranked = ORG_AIMS.map((a, i) => [a, g.aims[i] ?? 0] as const).sort((a, b) => b[1] - a[1]),
    second = ranked[1] && ranked[1][1] >= 250 && ranked[1][0] !== aim ? ranked[1][0] : null;
  return orgKind({
    aim,
    second,
    sea: !!(g.means & meansBit("ships")),
    armed: !!(g.means & meansBit("arms")),
    standing: g.standing,
    basis: ORG_BASES[g.basis] ?? "poor",
    patron,
    occupied: g.lands.some((c) => (lands.find((l) => l.cell === c)?.occupied ?? 0) > 0),
  });
}

function basisFor(aim: OrgAim, r: Read, l: Land): OrgBasis {
  switch (aim) {
    case "hire":
      return "veterans";
    case "worship":
      return "faith";
    case "aid":
      return r.piety >= 0.6 ? "faith" : "trade";
    case "trade":
    case "lend":
      return "trade";
    case "conspire":
      return "learned";
    case "rebel":
      return l.occupied > 0 ? "folk" : "poor";
    case "prey":
      return r.veterans > 0 ? "veterans" : "poor";
    case "guard":
    case "rule":
      return r.kin >= 0.6 ? "kin" : "folk";
    default:
      return "poor";
  }
}

/** The rise of a group: its record and its event. */
function rise(f: Facts, aim: OrgAim, home: Land, sea: boolean, factors: Factor[]): Org | null {
  const { v, r, year } = f,
    salt = v.next * 17 + AIM[aim],
    name =
      (aim === "rule" || aim === "trade" || aim === "aid") && home.town >= 2000
        ? (f.ctx.settlements.inProvince(home.cell).find((s) => s.market)?.name ?? null)
        : tongueWord(f, home.cell, salt, 0x0a9c);
  if (!name || v.orgs.some((g) => g.name === name && g.aim === AIM[aim])) return null;
  const basis = basisFor(aim, r, home),
    aims = new Array<number>(AIMS).fill(0);
  // (What it does at first: its founding aim mostly, the rest as its land's stakes would have it, as far as the means it
  // gathers with reach them.)
  const pressed = home.pressed >= 0.5,
    standing = outlawedAim(aim, pressed) ? 0 : 1,
    means =
      (ARMED.has(aim) ? meansBit("arms") : 0) |
      (sea ? meansBit("ships") : 0) |
      (basis === "faith" ? meansBit("faith") : 0) |
      (aim === "aid" || aim === "lend" || aim === "trade" || aim === "conspire"
        ? meansBit("purse")
        : 0) |
      (standing === 0 ? meansBit("secret") : 0),
    leaves = basis === "poor" || basis === "veterans" ? 0.2 : 0.9,
    fits = home.worth.map(
      (w, k) =>
        w *
        aimFit(ORG_AIMS[k]!, means) *
        (FULL_TIME.has(ORG_AIMS[k]!) && k !== AIM[aim] ? 1 - leaves : 1),
    ),
    all = fits.reduce((s, x) => s + x, 0) || 1;
  for (let k = 0; k < AIMS; k++) aims[k] = Math.round((300 * fits[k]!) / all);
  aims[AIM[aim]] = (aims[AIM[aim]] ?? 0) + 700;
  const sum = aims.reduce((s, x) => s + x, 0) || 1;
  for (let k = 0; k < AIMS; k++) aims[k] = Math.round((aims[k]! * 1000) / sum);
  const leader = newLeader(f, home.cell, salt),
    gid = v.next++,
    g: Org = {
      id: gid,
      name,
      kind: 0,
      aim: AIM[aim],
      aims,
      since: year,
      event: "" as Ref,
      home: home.cell,
      lands: [home.cell],
      basis: ORG_BASES.indexOf(basis),
      identity: basis === "faith" ? (home.faith ?? "") : "",
      means,
      standing,
      leader,
      leaders: 1,
      members: 0,
      wealth: 0,
      income: 0,
      takes: 0,
      gives: 0,
      violence: 0,
      power: 0,
    };
  const patron = aim === "hire" ? r.payer : aim === "prey" && r.atWar && sea ? f.p.ref : null;
  if (patron) g.patron = patron;
  g.kind = KIND(readKind(g, r.lands, !!patron));
  const event = tell(
    f,
    ORG_EVENTS.rose.type,
    home.cell,
    { group: name, kind: kindName(g), aim, gids: [gid], leader: leader.name },
    [],
    factors,
  );
  (g as { event: Ref }).event = event;
  v.orgs.push(g);
  return g;
}

function ended(f: Facts, g: Org, how: OrgEnd, factors: Factor[], into?: Org): void {
  const { v, year } = f,
    event = tell(
      f,
      ORG_EVENTS.ended.type,
      g.home,
      {
        group: g.name,
        kind: kindName(g),
        gids: [g.id, ...(into ? [into.id] : [])],
        how,
        since: g.since,
        ...(into ? { into: into.name, intoKind: kindName(into) } : {}),
      },
      [{ ref: g.event, role: "enabler", weight: 1 }],
      factors,
    );
  v.orgs = v.orgs.filter((x) => x !== g);
  for (const fed of v.feds) fed.members = fed.members.filter((id) => id !== g.id);
  v.gone = [
    ...v.gone,
    {
      name: g.name,
      kind: g.kind,
      since: g.since,
      year,
      how,
      ...(into ? { into: into.name } : {}),
      rose: g.event,
      event,
    },
  ].slice(-ORG.gone);
}

// —— One realm's groups, stepped `span` years ————————————————————————————————————————————————————————————

function fresh(year: number): RealmOrgs {
  return {
    last: year,
    next: 1,
    stakes: new Array<number>(AIMS).fill(0),
    gather: new Array<number>(AIMS).fill(0),
    suppression: 0,
    killings: 0,
    taken: 0,
    pays: 0,
    rising: 0,
    plot: 0,
    orgs: [],
    feds: [],
    gone: [],
  };
}

function copyOf(v: Readonly<RealmOrgs>): RealmOrgs {
  return {
    ...v,
    stakes: [...v.stakes],
    gather: [...v.gather],
    orgs: v.orgs.map((g) => ({
      ...g,
      aims: [...g.aims],
      lands: [...g.lands],
      leader: { ...g.leader },
    })),
    feds: v.feds.map((x) => ({ ...x, members: [...x.members] })),
    gone: [...v.gone],
  };
}

/** The stake of an aim where a group holds (its lands), shared among the groups of that aim there. */
function stakeIn(
  v: RealmOrgs,
  g: Org,
  lands: Map<number, Land>,
  k: number,
): { worth: number; gather: number } {
  let worth = 0,
    gather = 0;
  for (const c of g.lands) {
    const l = lands.get(c);
    if (!l) continue;
    const sharing =
      v.orgs.filter((x) => x.lands.includes(c) && (x.aims[k] ?? 0) >= 200).length || 1;
    worth += l.worth[k]! / sharing;
    gather += l.gather[k]! / sharing;
  }
  return { worth, gather };
}

function stepRealm(
  ctx: PopulationContext,
  p: Polity,
  v: RealmOrgs,
  span: number,
  t: SimTime,
): boolean {
  const { world } = ctx,
    year = yearOfMoment(t),
    key = keyOf(p.ref),
    r = readRealm(ctx, p, year);
  if (r.people <= 0) return false;
  const f: Facts = {
      ctx,
      p,
      v,
      r,
      t,
      year,
      key,
      u: (k: number) => world.rng.real(DRAW, key, t, k),
    },
    fade = 1 - dmath.pow(1 - ORG.spends, span),
    stays = 1 - fade,
    lands = new Map(r.lands.map((l) => [l.cell, l]));
  weighStakes(ctx, p, r, v);

  // 1. Each group's aims move toward the stakes in its reach; its kind is read again; its men move toward what its stake keeps.
  const harmBefore =
      r.people > 0 ? (v.killings / r.people) * 1000 + v.taken / Math.max(1, r.earned) : 0,
    suppression = suppressionOf(r.capacity, r.legitimacy, harmBefore);
  v.suppression = per(suppression);
  for (const g of v.orgs) {
    // (A rent kept full-time is worth to members who have work of their own only what it pays over the work they would leave:
    // to the idle and the veterans nearly all of it, to householders little.)
    const idleBasis = ORG_BASES[g.basis] === "poor" || ORG_BASES[g.basis] === "veterans",
      leaves = idleBasis ? 0.2 : 0.9,
      worth = ORG_AIMS.map(
        (a, k) => stakeIn(v, g, lands, k).worth * (FULL_TIME.has(a) ? 1 - leaves : 1),
      );
    g.means = meansOf(g, r.lands);
    g.aims = aimsToward(g.aims, worth, g.means, stepped(ORG.turn, span));
    const was = kindName(g),
      aim = firstAim(g.aims);
    g.aim = AIM[aim];
    // (A company follows its pay; privateers and raiders their realm's war; without either, none.)
    const patron =
      aim === "hire"
        ? r.payer
        : aim === "prey" && r.atWar && g.means & meansBit("ships")
          ? p.ref
          : null;
    if (patron && patron !== g.patron) {
      g.patron = patron;
      const payer = politiesOf(world).get(patron);
      tell(
        f,
        ORG_EVENTS.hired.type,
        g.home,
        {
          group: g.name,
          kind: kindName(g),
          gids: [g.id],
          patron: payer ? realmName(payer) : "a realm",
          members: g.members,
        },
        [{ ref: g.event, role: "enabler", weight: 1 }],
        [factor("what a realm at war will pay", r.hire, 1)],
      );
    } else if (!patron) delete g.patron;
    // (How its realm holds it: what preys, rises or plots is outlawed; a league or a guard its seat cannot itself give is
    // chartered where the seat reaches little and its rule stands; the rest let be.)
    const outlaw = outlawedAim(
        aim,
        g.lands.some((c) => (lands.get(c)?.pressed ?? 0) >= 0.5),
      ),
      charter =
        !outlaw && (aim === "trade" || aim === "guard") && r.capacity < 0.5 && r.legitimacy >= 0.45;
    const standing = outlaw ? (g.patron === p.ref ? 2 : 0) : charter || g.patron ? 2 : 1;
    const granted = standing === 2 && g.standing !== 2 && !g.patron;
    g.standing = standing;
    g.means = meansOf(g, r.lands);
    g.kind = KIND(readKind(g, r.lands, !!g.patron));
    if (kindName(g) !== was)
      tell(
        f,
        ORG_EVENTS.turned.type,
        g.home,
        { group: g.name, kind: kindName(g), was, aim, gids: [g.id] },
        [{ ref: g.event, role: "enabler", weight: 1 }],
        ORG_AIMS.map((a, k) => factor(a, g.aims[k]! / 1000, g.aims[k]! / 1000)).filter(
          (x) => x.contribution >= 0.1,
        ),
      );
    if (granted)
      tell(
        f,
        ORG_EVENTS.chartered.type,
        g.home,
        { group: g.name, kind: kindName(g), gids: [g.id] },
        [{ ref: g.event, role: "enabler", weight: 1 }],
        [factor("a seat that reaches little", r.capacity, 1 - r.capacity)],
      );
    // (Its men: what its aims, as it holds them, gather of its lands' stakes.)
    let aimMen = 0,
      income = 0;
    for (let k = 0; k < AIMS; k++) {
      const a = g.aims[k]! / 1000;
      if (a <= 0) continue;
      const s = stakeIn(v, g, lands, k);
      aimMen += a * s.gather;
      // (A rent kept full-time is its income; a common aim's, what its members pay in.)
      income += FULL_TIME.has(ORG_AIMS[k]!) ? a * s.worth : a * g.members * r.wage * ORG.cost;
    }
    g.members = Math.max(0, Math.round(g.members + (aimMen - g.members) * stepped(ORG.grow, span)));
    g.income = Math.round(income);
    g.takes = Math.round(
      ((g.aims[AIM.prey]! + g.aims[AIM.smuggle]!) / 1000) * stakeIn(v, g, lands, AIM.prey).worth,
    );
    g.gives = Math.round(
      ((g.aims[AIM.aid]! + g.aims[AIM.lend]!) / 1000) * g.members * r.wage * ORG.cost * 4,
    );
    g.wealth = Math.round(g.wealth * stays + (Math.max(0, g.income) * fade) / ORG.spends);
  }

  // 2. New groups: the strongest stakes no group of that aim holds yet.
  type Cand = { aim: OrgAim; land: Land; men: number; sea: boolean };
  const cands: Cand[] = [];
  for (const l of r.lands)
    for (const [k, a] of ORG_AIMS.entries()) {
      if (a === "smuggle") continue;
      const men = l.gather[k]!;
      if (men < ORG.crew) continue;
      if (v.orgs.some((g) => g.aim === k && g.lands.includes(l.cell))) continue;
      const sea =
        a === "prey"
          ? l.coast && preyTake(l.sea, r.seaGuard) > preyTake(l.road, roadGuarded(l.reach, 0))
          : a === "hire" || a === "trade"
            ? l.coast && l.sea > l.road
            : false;
      cands.push({ aim: a, land: l, men, sea });
    }
  cands.sort((a, b) => b.men - a.men || a.land.cell - b.land.cell || AIM[a.aim] - AIM[b.aim]);
  let risen = 0;
  for (const c of cands) {
    if (risen >= 2 || v.orgs.length >= ORG.most) break;
    if (v.orgs.filter((g) => g.aim === AIM[c.aim]).length >= ORG.ofAim) continue;
    if (risen > 0 && f.u(50 + risen) >= 0.5) continue;
    const g = rise(f, c.aim, c.land, c.sea, [
      factor(`a stake its people share (${c.aim})`, c.land.worth[AIM[c.aim]]!, 1),
      factor("those it would gather", c.men, c.men / ORG.small),
      factor("what binds them", bindingAt(ctx, r, c.land, c.aim), 0.2),
    ]);
    if (!g) continue;
    g.members = Math.round(c.men * stepped(ORG.grow, span));
    risen++;
  }

  // 3. Its realm's answer, leaders gone, holds ended.
  const gone: [Org, OrgEnd, Factor[], Org?][] = [];
  const revolution = revolutionHolds(world, p.ref, year);
  for (const g of [...v.orgs]) {
    const coh = bindingAt(ctx, r, lands.get(g.home) ?? r.lands[0]!, orgAimOf(g));
    if (g.standing === 0) {
      const taken =
        1 - dmath.pow(1 - ORG.taken * suppression * (1 - Math.min(0.7, (coh - 1) / 4)), span);
      g.members = Math.round(g.members * (1 - taken));
    }
    if (g.since >= year) continue;
    // (Its head gone: dead of his years, or taken where it is outlawed.)
    const age = year - g.leader.born;
    if (
      f.u(100 + g.id * 8) <
      leaderLost(diesWithin(ctx.life, age, 1), g.standing === 0 ? suppression : 0, span)
    ) {
      const before = g.leader.name;
      g.leader = newLeader(f, g.home, g.id * 37 + g.leaders);
      g.leaders++;
      tell(
        f,
        ORG_EVENTS.leader.type,
        g.home,
        { group: g.name, kind: kindName(g), gids: [g.id], leader: g.leader.name, before },
        [{ ref: g.event, role: "enabler", weight: 1 }],
      );
    }
    if (orgAimOf(g) === "rebel" && revolution) {
      gone.push([g, "won", [factor("a revolution won at its seat", 1, 1)]]);
      continue;
    }
    if (g.members < ORG.crew / 2) {
      gone.push([
        g,
        g.standing === 0 && suppression >= 0.3 ? "crushed" : "withered",
        [
          factor("its members", g.members, -1),
          ...(g.standing === 0
            ? [factor("its realm's hand against it", suppression, suppression)]
            : []),
        ],
      ]);
      continue;
    }
  }
  // (Two of one aim at one home: the lesser taken into the greater, once their men are reckoned; one taken in takes in no other.)
  const ending = new Set(gone.map(([g]) => g));
  for (const g of [...v.orgs].sort((a, b) => a.members - b.members || b.id - a.id)) {
    if (ending.has(g) || g.since >= year) continue;
    const twin = v.orgs.find(
      (x) =>
        x !== g &&
        !ending.has(x) &&
        x.aim === g.aim &&
        x.home === g.home &&
        (x.members > g.members || (x.members === g.members && x.id < g.id)),
    );
    if (!twin) continue;
    ending.add(g);
    gone.push([g, "merged", [factor("a greater of its aim at its home", twin.members, 1)], twin]);
  }
  for (const [g, how, factors, into] of gone) {
    if (!v.orgs.includes(g)) continue;
    if (into && v.orgs.includes(into)) {
      into.members += g.members;
      into.wealth += g.wealth;
    }
    ended(f, g, how, factors, into);
  }

  // 4. Lands, power, federations.
  const allMen = Math.max(
      1,
      v.orgs.reduce((s, g) => s + g.members, 0),
    ),
    allWealth = Math.max(
      1,
      v.orgs.reduce((s, g) => s + g.wealth, 0),
    );
  for (const g of v.orgs) {
    g.power = per(0.6 * (g.members / allMen) + 0.4 * (g.wealth / allWealth));
    // (It reaches the lands where its first aim's stake is greatest, its home first, more as it grows.)
    const n = Math.max(1, Math.min(ORG.lands, 1 + Math.floor(g.members / 300))),
      k = g.aim,
      near = r.lands
        .filter((l) => l.cell !== g.home && l.worth[k]! > 0)
        .sort((a, b) => b.worth[k]! - a.worth[k]! || a.cell - b.cell)
        .map((l) => l.cell);
    g.lands = [g.home, ...near].filter((c) => lands.has(c)).slice(0, n);
    if (!g.lands.length) g.lands = [p.seat];
  }
  stepFeds(f);

  // 5. What it costs and kills; the realm pays its hired.
  let killings = 0,
    taken = 0;
  for (const g of v.orgs) {
    const a = (k: number) => (g.aims[k] ?? 0) / 1000;
    g.violence = Math.round(
      g.members *
        (ORG.preyKills * a(AIM.prey) +
          ORG.fightKills *
            (a(AIM.rebel) * (g.means & meansBit("arms") ? 1 : 0.1) * (0.3 + suppression) +
              a(AIM.enforce) * 0.5 +
              a(AIM.guard) * 0.2 * (r.atWar ? 1 : 0.3))),
    );
    killings += g.violence;
    taken += g.takes;
  }
  v.killings = Math.round(killings);
  v.taken = Math.round(taken);
  let pays = 0;
  for (const g of v.orgs)
    if (g.patron === p.ref)
      pays += g.members * r.wage * ORG.keep * ((g.aims[AIM.hire]! + 300) / 1300);
  v.pays = Math.round(pays);
  // (How organised its risers and plotters are: a circle's part of what it does, as its members are many for its people; a
  // federation of them the more. A lodge needs few.)
  let rising = 0,
    plot = 0;
  for (const g of v.orgs) {
    const a = (k: number) => (g.aims[k] ?? 0) / 1000;
    rising = Math.max(
      rising,
      a(AIM.rebel) * Math.min(1, g.members / (r.people * 0.003)) * (g.fed !== undefined ? 1.3 : 1),
    );
    plot = Math.max(plot, a(AIM.conspire) * Math.min(1, g.members / (r.people * 0.0005)));
  }
  v.rising = per(rising);
  v.plot = per(plot);
  treasuryPays(world, p.ref, pays * span);
  writeLands(ctx, p, v, r, suppression);
  v.last = year;
  return v.orgs.length > 0 || v.stakes.some((x, k) => x > 0 && v.gather[k]! >= ORG.crew);
}

/** Groups of one first aim allied, at most ORG.feds a realm. */
function stepFeds(f: Facts): void {
  const { v } = f;
  for (const fed of [...v.feds]) {
    fed.members = fed.members.filter((id) => v.orgs.some((g) => g.id === id && g.aim === fed.aim));
    if (fed.members.length < ORG.fedOf) {
      v.feds = v.feds.filter((x) => x !== fed);
      for (const g of v.orgs) if (g.fed === fed.id) delete g.fed;
    }
  }
  for (const [k] of ORG_AIMS.entries()) {
    if (v.feds.length >= ORG.feds) break;
    const of = v.orgs.filter((g) => g.aim === k && g.fed === undefined);
    if (of.length < ORG.fedOf || v.feds.some((x) => x.aim === k)) continue;
    // (Allied where they can reach each other: by writing, or by a basis they share.)
    if (f.r.writing <= 0 && new Set(of.map((g) => g.basis)).size > 1) continue;
    const name = tongueWord(f, of[0]!.home, 1300 + v.next, 0x3c2a);
    if (!name) continue;
    const id = v.next++,
      event = tell(
        f,
        ORG_EVENTS.federation.type,
        of[0]!.home,
        {
          federation: name,
          fids: [id],
          gids: of.map((g) => g.id),
          groups: of.length,
          kind: kindName(of[0]!),
          aim: ORG_AIMS[k],
        },
        of.map((g) => ({ ref: g.event, role: "enabler" as const, weight: 1 })),
        [factor("groups of one aim in its lands", of.length, of.length / ORG.fedOf)],
      ),
      fed: OrgFed = {
        id,
        name,
        since: f.year,
        event,
        aim: k,
        members: of.map((g) => g.id),
        strength: 0,
      };
    v.feds.push(fed);
    for (const g of of) g.fed = id;
  }
  for (const fed of v.feds)
    fed.strength = Math.min(
      1000,
      v.orgs.filter((g) => fed.members.includes(g.id)).reduce((s, g) => s + g.power, 0),
    );
}

/** A realm's treasury pays (its hired companies and licensed ships): from its reserve, never below nothing. */
function treasuryPays(world: World, realm: Ref, grain: number): void {
  const s = moneyStore(world, TREASURY_STORE),
    row = s?.get(realm);
  if (!s || !row || !Number.isFinite(grain) || grain <= 0) return;
  const next = [...row];
  next[FISC.reserve] = Math.max(0, row[FISC.reserve]! - grain);
  s.set(realm, next);
}

/** Each of a realm's lands: who holds it and what its groups do there. */
function writeLands(
  ctx: PopulationContext,
  p: Polity,
  v: RealmOrgs,
  r: Read,
  suppression: number,
): void {
  const rows = orgLandsStore(ctx.world);
  if (!rows) return;
  for (const l of r.lands) {
    const here = v.orgs.filter((g) => g.lands.includes(l.cell));
    if (!here.length) {
      if (rows.get(l.cell)) rows.drop(l.cell);
      continue;
    }
    const men = Math.max(1, l.people / 4),
      households = Math.max(1, l.people / HOUSEHOLD);
    let best: Org | null = null,
      bestW = 0,
      roadTake = 0,
      seaTake = 0,
      guard = 0,
      fills = 0,
      aided = 0,
      killed = 0,
      rising = 0,
      plot = 0,
      sect = 0,
      sectOf = 0,
      thins = 0;
    for (const g of here) {
      const w = g.members / g.lands.length,
        a = (k: number) => (g.aims[k] ?? 0) / 1000,
        s = Math.min(1, w / men);
      if (w > bestW) {
        bestW = w;
        best = g;
      }
      const prey = a(AIM.prey) * (w / Math.max(1, g.members)) * g.takes;
      if (g.means & meansBit("ships")) seaTake += prey;
      else roadTake += prey;
      guard += (a(AIM.guard) + 0.5 * a(AIM.trade) + 0.5 * a(AIM.rule)) * Math.min(1, s * 8);
      fills +=
        (a(AIM.guard) + a(AIM.enforce) + a(AIM.rule) + 0.5 * a(AIM.trade) + 0.5 * a(AIM.lend)) *
        Math.min(1, s * 8);
      aided += a(AIM.aid) * Math.min(1, (w * HOUSEHOLD) / households);
      killed += g.violence / g.lands.length;
      rising = Math.max(
        rising,
        a(AIM.rebel) * Math.min(1, s * 20) * (g.fed !== undefined ? 1.3 : 1),
      );
      plot = Math.max(plot, a(AIM.conspire) * Math.min(1, g.power / 500));
      const sw =
        a(AIM.worship) * Math.min(1, (w * HOUSEHOLD) / households) * (l.pressed > 0 ? 1 : 0);
      if (sw > sect) {
        sect = sw;
        sectOf = g.id + 1;
      }
      thins += (a(AIM.rule) + 0.5 * a(AIM.prey)) * Math.min(1, s * 6);
    }
    let young = 0;
    const prov = ctx.provinces.get(l.cell);
    if (prov)
      for (let b = 0; b < BANDS; b++)
        if (youngBand(ctx.life, b)) young += prov.counts.rowSum(row(MALE, b)) * 2;
    const killedShare = l.people > 0 ? killed / l.people : 0;
    rows.set(l.cell, [
      best ? best.id + 1 : 0,
      best ? best.kind + 1 : 0,
      best ? per(bestW / (bestW + men * 0.05 * (1 + suppression))) : 0,
      dmath.clamp(l.road > 0 ? roadTake / l.road : 0, 0, ORG.takeMost) * 1000,
      dmath.clamp(guard, 0, 1) * 1000,
      dmath.clamp(fills * ORG.fills, 0, ORG.fills) * 1000,
      dmath.clamp(aided * ORG.spares, 0, ORG.spares) * 1000,
      dmath.clamp(aided * ORG.shelters, 0, ORG.shelters) * 1000,
      killedShare * 1e6,
      young > 0 ? ((0.8 * killed) / young) * 1e6 : 0,
      dmath.clamp(rising, 0, 1) * 1000,
      dmath.clamp(plot, 0, 1) * 1000,
      dmath.clamp(sect, 0, 1) * 1000,
      sectOf,
      dmath.clamp(thins * ORG.thins, 0, ORG.thins) * 1000,
      here.length,
      dmath.clamp(l.sea > 0 ? seaTake / l.sea : 0, 0, ORG.takeMost) * 1000,
    ]);
  }
}

/**
 * 188.order.zgroups, a year: each realm in its turn (its ref's number and the year, two after its underworld, ORG.every), stepped as
 * many years as since it was last; and each year, a pressed sect and the killing of its groups breed grievance in its lands. A realm
 * whose stakes gather no crew keeps no record, and the store stays dormant.
 */
export function groupsYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = orgsOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    living = politiesOf(world).living();
  if (year % 10 === 0) {
    const alive = new Set(living.map((p) => p.ref));
    for (const r of store.realmsKept()) if (!alive.has(r)) store.forget(r);
    const rows = orgLandsStore(world),
      realms = politiesOf(world);
    if (rows)
      for (const k of rows.keys()) {
        const r = realms.of(Number(k));
        if (!r || !store.of(r.ref)) rows.drop(k);
      }
  }
  const rows = orgLandsStore(world);
  for (const p of living) {
    if ((refNumber(p.ref) + year + 2) % ORG.every === 0) {
      const was = store.of(p.ref),
        v: RealmOrgs = was ? copyOf(was) : fresh(year),
        span = was ? Math.max(1, Math.min(50, year - was.last)) : ORG.every;
      const any = stepRealm(ctx, p, v, span, t);
      if (was || v.orgs.length || v.next > 1) store.put(p.ref, v);
      else if (!any && rows) for (const c of p.members) if (rows.get(c)) rows.drop(c);
    }
    const now = store.of(p.ref);
    if (!now || !rows || !now.orgs.length) continue;
    for (const c of p.members) {
      const row = rows.get(c);
      if (!row) continue;
      const sect = row[ORG_ROW.sect]! / 1000,
        killed = row[ORG_ROW.killings]! / 1e6,
        amount = ORG.grievesSect * sect + 40 * killed;
      if (amount <= 0) continue;
      const by = now.orgs.find(
        (g) => g.id + 1 === (sect > 0 ? row[ORG_ROW.sectOf] : row[ORG_ROW.group]),
      );
      if (by) grieve(world, c, amount, by.event);
    }
  }
}

// —— What the realm's reach and standing lose ————————————————————————————————————————————————————————————

addsReach((ctx, p) => {
  const v = orgsOf(ctx.world)?.of(p.ref),
    rows = orgLandsStore(ctx.world);
  if (!v || !rows || !v.orgs.length) return [];
  let thins = 0;
  for (const c of p.members) thins += rows.at(c, ORG_ROW.thins);
  const k = p.members.length ? thins / p.members.length / 1000 : 0;
  if (k <= 0) return [];
  const g = [...v.orgs].sort((a, b) => b.power - a.power || a.id - b.id)[0];
  return [
    {
      name: "towns and roads held by their own",
      value: r2(k),
      contribution: -k,
      source: g ? g.event : null,
    },
  ];
});

addsStanding((ctx, p) => {
  const v = orgsOf(ctx.world)?.of(p.ref);
  if (!v || !v.taken) return [];
  const fisc = moneyStore(ctx.world, TREASURY_STORE)?.get(p.ref),
    trade = fisc ? fisc[FISC.base + 1]! / 2 : 0,
    k = trade > 0 ? Math.min(1, v.taken / trade) : 0;
  if (k <= 0.002) return [];
  const g = [...v.orgs].sort((a, b) => b.takes - a.takes || a.id - b.id)[0];
  return [
    {
      name: "its roads and seas preyed on",
      value: r2(k),
      contribution: -Math.min(0.08, 2 * k),
      source: g ? { ref: g.event, role: "pressure", weight: 1 } : null,
    },
  ];
});

/** Register the groups on a peopled world. */
export function installGroups(world: World, ctx: () => PopulationContext): OrgsStore {
  const store = world.register(new OrgsStore());
  world.register(new RowStore(ORG_LANDS_STORE, ORG_LANDS_WIDTH));
  world.addPinner(() => store.pinned());
  world.system({ key: "188.order.zgroups", every: YEAR, run: (t) => groupsYear(ctx(), t) });
  return store;
}
