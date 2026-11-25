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
  AIM,
  DEED,
  againstOf,
  againstWeights,
  HOLD,
  OCC,
  ORG,
  ORG_AIMS,
  ORG_BASES,
  ORG_KINDS,
  INST,
  FULL_TIME,
  aidWorth,
  aimFit,
  cloisterWorth,
  hardToReach,
  inquireWorth,
  officeWorth,
  refugeWorth,
  HOUSE_ORIGINS,
  aimsToward,
  cohesionOf,
  conspireWorth,
  crewOf,
  diesWithin,
  enforceWorth,
  firstAim,
  keptFirstAim,
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
  MIND_GROUP,
  mindAims,
  mindReach,
} from "../../rules/index.ts";
import { mindsHeld, mindsOf, mindsPastOf, type MindsRow } from "../frontier/minds.ts";
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
import { addsReach, addsStanding, orderOf, reachOver } from "./order.ts";
import { holdsOf } from "./holds.ts";
import { LAW_OF } from "./laws.ts";
import { housesRead } from "./houses.ts";
import { killedOf, protectedOf, underworldOf } from "./underworld-kept.ts";
import { creditOf } from "../credit/credit.ts";
import { interestsOf } from "../polity/interests.ts";
import { namedBite, realmDecrees } from "./grouphand.ts";
import { menOf, setMen, wholeOver } from "./whole.ts";
import { reliefOf } from "../war/occupation.ts";
import { templeTeachingIn } from "../belief/temple.ts";
import { inquiresMore } from "../lore/lore.ts";
import { learnedOf } from "../lore/academy.ts";
import { chooses } from "./elections.ts";
import { housesOf } from "./houses.ts";
import { revolutionHolds } from "../strife/strife.ts";
import {
  ORG_LANDS_STORE,
  ORG_LANDS_WIDTH,
  ORG_ROW,
  OrgsStore,
  orgInquiryOf,
  orgLandsStore,
  orgsOf,
  type Org,
  type OrgFed,
  type RealmOrgs,
} from "./groups-kept.ts";
import { watchIn } from "./institutions-kept.ts";
import { actOn, bossRef, hazardBy, sparedBy, struckBy, whisperIn } from "../acts/person.ts";
import { deathNotesOf } from "../hand/deaths.ts";
import { sentence, strikes, type Striker } from "./deeds.ts";

export const ORG_EVENTS = {
  /** A group formed where a shared stake beat what holding together costs. */
  rose: defineEventType("groups.rose", 3),
  /** Its aims moved, and it is now of another kind. */
  turned: defineEventType("groups.turned", 3),
  /** A realm took it into its pay or licensed it; granted it its rights. */
  hired: defineEventType("groups.hired", 3),
  /** A company left the pay of a realm whose treasury had nothing by it. */
  unpaid: defineEventType("groups.unpaid", 3),
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
/** How far each aim is against anyone (rules AGAINST), by ORG_AIMS. */
const AGAINST_WILL: readonly number[] = againstWeights(ORG_AIMS);
/** The aims that take men under arms. */
const ARMED: ReadonlySet<OrgAim> = new Set([
  "prey",
  "guard",
  "enforce",
  "rule",
  "hire",
  "rebel",
  "refuge",
]);
/** First aims whose group holds one land and no more: a party at its seat, a refuge, an order's house. */
const ONE_LAND: ReadonlySet<OrgAim> = new Set(["office", "refuge"]);
/** A household, for a common stake: its working-years are what its members gain and spend. */
const HOUSEHOLD = 5;

export const kindName = (g: { readonly kind: number }): OrgKind =>
  ORG_KINDS[g.kind] ?? "brotherhood";
export const orgAimOf = (g: { readonly aim: number }): OrgAim => ORG_AIMS[g.aim] ?? "aid";
const KIND = (k: OrgKind) => ORG_KINDS.indexOf(k);
/** A realm's made minds gone their own way, as one of its groups (rules/beyond.ts mindAims). */
const MINDS_BASIS = ORG_BASES.indexOf("minds");
const isMinds = (g: { readonly basis: number }) => g.basis === MINDS_BASIS;
function mindAimArray(past: number, held: number): number[] {
  const a = mindAims(past, held),
    out = new Array<number>(AIMS).fill(0);
  out[AIM.inquire] = a.inquire;
  out[AIM.trade] = a.trade;
  out[AIM.conspire] = a.conspire;
  return out;
}

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
  /** How hard it is to reach from its seat (0 … 1); the share of its people bound; its learned; its faith's teaching. */
  hard: number;
  bound: number;
  learned: number;
  teaching: number;
  /** Its devout would keep its faith under a rule of their own here, more than as a sect against the seat; and would at all. */
  cloister: boolean;
  cloisterAny: boolean;
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
  /** Its bound and those its law hunts (shares of its people). */
  bound: number;
  hunted: number;
  /** Where its people choose who governs: each interest's stake in a party of its own (grain's worth a year), and who would
   * carry it (heads); the demagogue's house that would lead one. */
  chooses: boolean;
  office: Map<string, { worth: number; gather: number }>;
  demagogue: string | null;
  lands: Land[];
};

function readRealm(ctx: PopulationContext, p: Polity, year: number, t: SimTime): Read {
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
    relief = reliefOf(ctx.generated),
    over = reachOver(ctx, p),
    seatWays = culture.get(p.seat),
    seatFaith = belief.of(p.seat).faith ?? null,
    m = markets.get(p.seat),
    // (A working man's year: what a worker of its lands earns, by the treasury's reckoning, a living at the least; the seat's
    // wages before the treasury has read its lands. As the underworld reads it: sim/order/underworld.ts readRealm.)
    workers = p.members.reduce((n, c) => {
      const prov = ctx.provinces.get(c);
      return n + (prov ? Math.max(0, prov.total() - prov.occupation(OCC.dependent)) : 0);
    }, 0),
    wage = Math.max(
      1,
      fisc && workers > 0
        ? fisc[FISC.base + 3]! / workers
        : m
          ? Math.max(m.wage[OCC.crafter]!, m.wage[OCC.farmer]!)
          : 1,
    ),
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
      landReach = over.lands.get(c) ?? over.value,
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
      occupied: ow && ow.holder === p.ref ? Math.max(0.2, ow.resistance) : 0,
      killed: killedOf(world, c),
      extorted: under.extortion,
      road: weight,
      sea: coast ? weight : 0,
      traders: prov.occupation(OCC.trader),
      street: st,
      credit: banks.has(c) ? 1 : 0,
      front,
      threat: front ? 1 : 0,
      hard: hardToReach(relief[c] ?? 0, far, landReach),
      bound: orderOf(world)?.bound(c) ?? 0,
      learned: learnedOf(world, c),
      teaching: templeTeachingIn(world, c),
      cloister: false,
      cloisterAny: false,
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
    seaGuard = seaGuarded(ships?.tons ?? 0, Math.max(1, (ships?.merchant ?? 0) / 6), over.value);
  // (Realms at war short of men, its own or its neighbours, that would pay for soldiers: the best payer.)
  let hire = 0,
    payer: Ref | null = null,
    foeSea = 0;
  const near = new Set<Ref>([p.ref]);
  for (const rel of diplomacyOf(world).of(p.ref)) {
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
        // (A hired man's year: his own food at the least.)
        qWage = Math.max(12, qm ? Math.max(qm.wage[OCC.crafter]!, qm.wage[OCC.farmer]!) : wage),
        reserve = moneyStore(world, TREASURY_STORE)?.at(q, FISC.reserve) ?? 0,
        pay = hirePay(short, qWage, reserve);
      if (pay > hire) {
        hire = pay;
        payer = q;
      }
      if (q === p.ref) foeSea += moneyStore(world, COVER_STORE)?.at(foe.ref, POOL.seaTrade) ?? 0;
    }
  }
  const houses = housesRead(world, p.ref),
    voice = held[HOLD.voice] ?? 0.3,
    // (Bound and hunted: its lands' bondage; those its crackdown and its hand against what it outlaws take.)
    boundAll = lands.reduce((s, l) => s + l.bound * l.people, 0),
    hunted =
      0.3 * ((underworldOf(world)?.of(p.ref)?.bites ?? 0) / 1000) +
      0.3 * ((orgsOf(world)?.of(p.ref)?.suppression ?? 0) / 1000),
    // (Where its people choose: each interest of many heads no great house of its own speaks for would carry a party.)
    choosing = chooses(world, p),
    office = new Map<string, { worth: number; gather: number }>(),
    kept = housesOf(world)?.of(p.ref)?.houses ?? [],
    spoken = new Set(kept.map((h) => HOUSE_ORIGINS[h.origin] ?? "")),
    demagogue = kept.find((h) => HOUSE_ORIGINS[h.origin] === "demagogue")?.name ?? null;
  if (choosing)
    for (const i of interestsOf(ctx, p, t)) {
      if (i.group === "the court" || i.people <= 0) continue;
      const perHead = officeWorth(voice, i.sway, spoken.has(i.group)),
        coh = cohesionOf({
          kin: seatWays?.traits[WAY.kinship] ?? 0.5,
          folk: people > 0 ? ofSeatFaith / people : 1,
          faith: 0.3 * (seatWays?.traits[WAY.piety] ?? 0.5),
          writing: lore.effect(p.seat, "writing") > 0 ? 1 : 0,
          trust: law ? law[LAW_ROW.deals]! / 1000 : 0.5,
          leader: demagogue ? 1 : (houses?.following ?? 0),
        }),
        n = joinedOf("office", perHead, i.people / HOUSEHOLD, coh);
      office.set(i.group, { worth: perHead * wage * Math.max(n, ORG.crew), gather: n });
    }
  return {
    people,
    wage,
    trade,
    sea,
    earned: fisc ? fisc[FISC.base + 3]! : 0,
    reserve: fisc ? fisc[FISC.reserve]! : 0,
    capacity: over.value,
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
    bound: people > 0 ? boundAll / people : 0,
    hunted,
    chooses: choosing,
    office,
    demagogue,
    lands,
  };
}

// —— Each aim's stake, land by land ————————————————————————————————————————————————————————————————————————

/** What binds a stake's people in a land. */
function bindingAt(ctx: PopulationContext, r: Read, l: Land, aim: OrgAim): number {
  const ways = cultureOf(ctx.world).get(l.cell);
  return bindingOf(
    r,
    l,
    aim,
    ways?.traits[WAY.kinship] ?? r.kin,
    ways?.traits[WAY.piety] ?? r.piety,
    loreOf(ctx.world).effect(l.cell, "writing") > 0,
  );
}

/** The same, its land's ways and whether it writes read already (a land's stakes ask it of every aim). */
function bindingOf(
  r: Read,
  l: Land,
  aim: OrgAim,
  kin: number,
  piety: number,
  writes: boolean,
): number {
  const leader =
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
    writing: writes ? 1 : r.writing * 0.5,
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
    culture = cultureOf(world),
    lore = loreOf(world),
    deaths = 0.012,
    coasts = r.lands.filter((l) => l.coast).length || 1,
    towns = r.lands.filter((l) => l.town >= 2000).length,
    pool = r.pool * ORG.recruit;
  for (const l of r.lands) {
    const households = l.people / HOUSEHOLD,
      men = l.people / 4,
      w = r.wage,
      had = rows?.get(l.cell),
      // (And what a paid, honest watch guards of its roads: ./institutions.ts. Nothing where none is kept.)
      kept = watchIn(world, l.cell),
      guardedBefore = Math.min(
        1,
        (had ? had[ORG_ROW.guard]! / 1000 : 0) + INST.guards * kept.watch * kept.honest,
      ),
      preyedBefore = had ? (had[ORG_ROW.prey]! + had[ORG_ROW.seaPrey]!) / 1000 : 0,
      killedBefore = (had ? had[ORG_ROW.killings]! / 1e6 : 0) + l.killed,
      ways = culture.get(l.cell),
      kin = ways?.traits[WAY.kinship] ?? r.kin,
      piety = ways?.traits[WAY.piety] ?? r.piety,
      writes = lore.effect(l.cell, "writing") > 0,
      coh = (aim: OrgAim) => bindingOf(r, l, aim, kin, piety, writes),
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
        kin,
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
    // Worship: a faith pressed by its seat; or the seat's own faith's devout, withdrawn to keep it under a rule of their own
    // where land lies open or far and its temple teaches (a monastic order).
    const sect = worshipWorth(l.grievance + 0.3 * l.pressed, l.pressed, piety),
      cloister =
        l.faith && l.faith === r.seatFaith && l.pressed < 0.1 && l.teaching > 0
          ? cloisterWorth(piety, l.teaching, 0.3 + 0.7 * (1 - l.reach))
          : 0;
    l.cloister = cloister > sect;
    l.cloisterAny = cloister > 0;
    common("worship", Math.max(sect, cloister), l.pressed > 0 || cloister > 0 ? households : 0);
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
      // (Less what a plotter risks: a seat that reaches finds him. So a plot is worth its few only against a seat doubted or
      // shut hard; a lodge had stood in 236 of 256 realms, wherever a town was great enough to hide a dozen.)
      r.writing > 0
        ? Math.max(
            0,
            conspireWorth({
              shut: (1 - r.voice) * (0.4 + 0.6 * (1 - r.legitimacy)),
              word: r.word,
              ideas: r.ideas,
              doubt: r.doubt,
            }) -
              ORG.hunted * r.capacity,
          )
        : 0,
      l.town >= 2000 ? l.town * 0.05 : 0,
    );
    // Refuge: the realm's bound and those its law hunts, for a land hard to reach and holding no war.
    common(
      "refuge",
      l.hard >= 0.45 ? refugeWorth(r.bound, r.hunted, l.hard, l.front) : 0,
      l.hard >= 0.45 ? (r.bound + 0.2 * r.hunted) * r.people * share * 3 : 0,
    );
    // Inquire: its learned, where the word is free enough and writing at hand.
    common("inquire", inquireWorth(r.word, writes ? 1 : 0, r.ideas), l.learned * l.people);
  }
  for (let k = 0; k < AIMS; k++) {
    v.stakes[k] = Math.round(r.lands.reduce((s, l) => s + l.worth[k]!, 0));
    v.gather[k] = Math.round(r.lands.reduce((s, l) => s + l.gather[k]!, 0));
  }
  v.stakes[AIM.office] = Math.round([...r.office.values()].reduce((s, o) => s + o.worth, 0));
  v.gather[AIM.office] = Math.round([...r.office.values()].reduce((s, o) => s + o.gather, 0));
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
      // (As many as an event holds: the decision first, then the causes in the order given, greatest first.)
      ...causes.slice(0, MAX_CAUSES - (decision ? 1 : 0)),
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
    secondAt = (least: number) =>
      ranked[1] && ranked[1][1] >= least && ranked[1][0] !== aim ? ranked[1][0] : null,
    kindAt = (second: OrgAim | null) => readKindWith(g, lands, patron, aim, second),
    strict = kindAt(secondAt(ORG.second));
  // (A kind it is already is kept while its second aim holds the lesser share: told once, not each time it crosses.)
  if (
    g.since >= 0 &&
    ORG_KINDS[g.kind] !== strict &&
    ORG_KINDS[g.kind] === kindAt(secondAt(ORG.secondKept))
  )
    return ORG_KINDS[g.kind]!;
  return strict;
}

function readKindWith(
  g: Org,
  lands: readonly Land[],
  patron: boolean,
  aim: OrgAim,
  second: OrgAim | null,
): OrgKind {
  return orgKind({
    aim,
    second,
    sea: !!(g.means & meansBit("ships")),
    armed: !!(g.means & meansBit("arms")),
    standing: g.standing,
    basis: ORG_BASES[g.basis] ?? "poor",
    patron,
    occupied: g.lands.some((c) => (lands.find((l) => l.cell === c)?.occupied ?? 0) > 0),
    cloister: cloistered(g, lands),
  });
}

/** Whether a group keeps its seat's own faith under a rule of its own on the land it holds: a monastic order. */
function cloistered(g: Org, lands: readonly Land[]): boolean {
  const home = lands.find((l) => l.cell === g.home);
  // (An order once withdrawn to its land keeps it while its devout would keep it there at all, not only while that is worth more
  // than a sect's stand against the seat.)
  const was = ORG_KINDS[g.kind] === "monastic order";
  return (
    orgAimOf(g) === "worship" &&
    ORG_BASES[g.basis] === "faith" &&
    !!(was ? home?.cloisterAny : home?.cloister)
  );
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
    case "refuge":
      return "fled";
    case "office":
      return "interest";
    case "inquire":
      return "learned";
    default:
      return "poor";
  }
}

/**
 * A group as one who may strike (sim/order/deeds.ts): how far what it does is against anyone, its faith's aim only where its
 * faith is pressed. Its page reads the same.
 */
export function strikerOf(g: Readonly<Org>, pressed: boolean): Striker {
  return {
    crime: false,
    id: g.id,
    name: g.name,
    kind: kindName(g),
    event: g.event,
    lands: g.lands,
    members: g.members,
    armed: !!(g.means & meansBit("arms")),
    hidden: g.standing === 0,
    identity: ORG_BASES[g.basis] === "faith" ? g.identity : "",
    against: againstOf(g.aims, AIM, pressed),
  };
}

/** The rise of a group: its record and its event. */
function rise(
  f: Facts,
  aim: OrgAim,
  home: Land,
  sea: boolean,
  factors: Factor[],
  identity?: string,
): Org | null {
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
      (aim === "aid" ||
      aim === "lend" ||
      aim === "trade" ||
      aim === "conspire" ||
      aim === "office" ||
      aim === "inquire"
        ? meansBit("purse")
        : 0) |
      (standing === 0 ? meansBit("secret") : 0),
    leaves = basis === "poor" || basis === "veterans" ? 0.2 : 0.9,
    own = (k: number) =>
      (k !== AIM.refuge || basis === "fled") && (k !== AIM.worship || basis === "faith"),
    fits = home.worth.map(
      (w, k) =>
        (own(k) ? 1 : 0) *
        w *
        aimFit(ORG_AIMS[k]!, means) *
        (FULL_TIME.has(ORG_AIMS[k]!) && k !== AIM[aim] ? 1 - leaves : 1),
    ),
    all = fits.reduce((s, x) => s + x, 0) || 1;
  // (A party is its interest's alone: it begins doing nothing else.)
  if (!identity) for (let k = 0; k < AIMS; k++) aims[k] = Math.round((300 * fits[k]!) / all);
  aims[AIM[aim]] = (aims[AIM[aim]] ?? 0) + 700;
  const sum = aims.reduce((s, x) => s + x, 0) || 1;
  for (let k = 0; k < AIMS; k++) aims[k] = Math.round((aims[k]! * 1000) / sum);
  // (A party an interest's demagogue leads bears his house's name at its head.)
  const led = aim === "office" && r.demagogue ? r.demagogue : null,
    drawn = newLeader(f, home.cell, salt),
    leader = led ? { ...drawn, name: `${drawn.name.split(" ")[0]} ${led}` } : drawn,
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
      identity: identity ?? (basis === "faith" ? (home.faith ?? "") : ""),
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
  if (led) g.house = led;
  g.kind = KIND(readKind(g, r.lands, !!patron));
  const event = tell(
    f,
    ORG_EVENTS.rose.type,
    home.cell,
    {
      group: name,
      kind: kindName(g),
      aim,
      gids: [gid],
      leader: leader.name,
      ...(identity ? { interest: identity } : {}),
      ...(led ? { house: led } : {}),
    },
    [],
    factors,
  );
  (g as { event: Ref }).event = event;
  v.orgs.push(g);
  return g;
}

/** A realm's made minds, gone their own way, as one of its groups: by their own name, at its seat, their own head. */
function riseMinds(
  f: Facts,
  row: Readonly<MindsRow>,
  past: number,
  held: number,
  hands: number,
): Org | null {
  const { v, r, year, p } = f,
    name = row.name!;
  if (v.orgs.some((g) => g.name === name)) return null;
  const aims = mindAimArray(past, held),
    aim = firstAim(aims),
    standing = outlawedAim(aim, false) ? 0 : 1,
    g: Org = {
      id: v.next++,
      name,
      kind: 0,
      aim: AIM[aim],
      aims,
      since: year,
      event: "" as Ref,
      home: p.seat,
      lands: [p.seat],
      basis: MINDS_BASIS,
      identity: "",
      means: meansBit("purse") | (standing === 0 ? meansBit("secret") : 0),
      standing,
      leader: { name, born: row.begun, since: year },
      leaders: 1,
      members: hands,
      wealth: 0,
      income: 0,
      takes: 0,
      gives: 0,
      violence: 0,
      power: 0,
    };
  g.kind = KIND(readKind(g, r.lands, false));
  (g as { event: Ref }).event = tell(
    f,
    ORG_EVENTS.rose.type,
    p.seat,
    { group: name, kind: kindName(g), aim, gids: [g.id], leader: name, minds: 1 },
    row.free ? [{ ref: row.free, role: "trigger", weight: 1 }] : [],
    [
      factor("how far past their makers they think", past, mindReach(past)),
      factor("how tightly their makers would hold them", held, held),
      factor("those of its people in their pay", hands, hands / ORG.small),
    ],
  );
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

/**
 * The stake of an aim where a group holds (its lands), shared among the groups of that aim there (`sharing`: each land's count of
 * the groups holding it that do each aim, sharingOf).
 */
function stakeIn(
  sharing: ReadonlyMap<number, number[]>,
  g: Org,
  lands: Map<number, Land>,
  k: number,
): { worth: number; gather: number } {
  let worth = 0,
    gather = 0;
  for (const c of g.lands) {
    const l = lands.get(c);
    if (!l) continue;
    const n = sharing.get(c)?.[k] || 1;
    worth += l.worth[k]! / n;
    gather += l.gather[k]! / n;
  }
  return { worth, gather };
}

/** A group counted into (`by` 1) or out of (-1) each of its lands' groups that do each aim (a fifth and more of what it does). */
function sharingOf(sharing: Map<number, number[]>, g: Org, by: number): void {
  for (const c of g.lands) {
    let row = sharing.get(c);
    if (!row) sharing.set(c, (row = new Array<number>(AIMS).fill(0)));
    for (let k = 0; k < AIMS; k++) if ((g.aims[k] ?? 0) >= 200) row[k] = row[k]! + by;
  }
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
    r = readRealm(ctx, p, year, t);
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
  // (Its made minds, where they went their own way: how far past their makers they think, and those of its people in their pay.)
  const mindRow = mindsOf(world)?.rows.get(p.ref),
    freeMinds = mindRow?.free && mindRow.name ? mindRow : null,
    mindPast = freeMinds ? mindsPastOf(world, p.ref) : 0,
    mindHold = freeMinds ? mindsHeld(world, p.ref) : 0,
    mindHands = freeMinds ? Math.round(r.people * MIND_GROUP.hands * mindReach(mindPast)) : 0;
  // (Its own word on a group by name, from what its interests want of it: ./grouphand.ts. Read below as any decree is.)
  // (Every other reckoning: once in ten years, as its laws are weighed.)
  if ((year + refNumber(p.ref)) % (2 * ORG.every) < ORG.every) realmDecrees(ctx, p, v.orgs, r, t);
  // (How far its hand bites on a group outlawed by name: how far its will is done in the group's lands.)
  const biteOf = (g: Org) =>
    g.decree === 0 ? namedBite(g.lands.map((c) => lands.get(c)?.reach ?? 0)) : 0;

  // 1. Each group's aims move toward the stakes in its reach; its kind is read again; its men move toward what its stake keeps.
  const harmBefore =
      r.people > 0 ? (v.killings / r.people) * 1000 + v.taken / Math.max(1, r.earned) : 0,
    suppression = suppressionOf(r.capacity, r.legitimacy, harmBefore);
  v.suppression = per(suppression);
  // (A party's stake is its own interest's at the seat; every other aim's, its lands'.)
  // (Some stakes are only their own people's: a refuge the fled's, a faith kept its faithful's. A lending circle of free
  // townsfolk does not take up the bound's flight, however much it is worth to them.)
  const none = { worth: 0, gather: 0 },
    sharing = new Map<number, number[]>(),
    stake = (g: Org, k: number) =>
      k === AIM.office
        ? ORG_BASES[g.basis] === "interest"
          ? (r.office.get(g.identity) ?? none)
          : none
        : k === AIM.refuge && ORG_BASES[g.basis] !== "fled"
          ? none
          : k === AIM.worship && ORG_BASES[g.basis] !== "faith"
            ? none
            : stakeIn(sharing, g, lands, k);
  for (const g of v.orgs) sharingOf(sharing, g, 1);
  for (const g of v.orgs) {
    // (A rent kept full-time is worth to members who have work of their own only what it pays over the work they would leave:
    // to the idle and the veterans nearly all of it, to householders little.)
    const idleBasis = ORG_BASES[g.basis] === "poor" || ORG_BASES[g.basis] === "veterans",
      leaves = idleBasis ? 0.2 : 0.9,
      // (Another's stake is no pull where a group of that first aim already holds its home: turned to it, it would only be the
      // lesser of two there, taken into the greater, and its own stake left to be gathered again.)
      minds = isMinds(g),
      atHome = minds ? [] : v.orgs.filter((x) => x !== g && x.lands.includes(g.home)),
      taken = (k: number) => k !== g.aim && atHome.some((x) => x.aim === k),
      // (Made minds weigh no land's stakes: what they do is their own.)
      worth = minds
        ? []
        : ORG_AIMS.map((a, k) =>
            taken(k) ? 0 : stake(g, k).worth * (FULL_TIME.has(a) ? 1 - leaves : 1),
          ),
      // (A god's whisper to its leader: the aim whispered weighs twice what it would. Nothing where none: sim/acts/person.ts.)
      whispered = minds
        ? null
        : whisperIn(world, bossRef(p.ref, g.event), g.leader.name, year, "aim");
    if (whispered) {
      const k = ORG_AIMS.indexOf(whispered.aim!.slice(4) as (typeof ORG_AIMS)[number]);
      if (k >= 0) worth[k] = 2 * Math.max(worth[k]!, 1);
    }
    g.means = meansOf(g, r.lands);
    sharingOf(sharing, g, -1);
    // (Made minds do what they would, as far past their makers as they think, not what a land's stakes draw them to.)
    g.aims = minds
      ? mindAimArray(mindPast, mindHold)
      : aimsToward(g.aims, worth, g.means, stepped(ORG.turn, span));
    sharingOf(sharing, g, 1);
    const was = kindName(g),
      aim = keptFirstAim(g.aims, g.aim);
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
    // (A party where its people no longer choose, a society where the word is shut, are outlawed; an order is granted its
    // land where the seat holds its faith and its rule stands; a society chartered where the seat writes and its word is free.)
    const outlaw =
        outlawedAim(
          aim,
          g.lands.some((c) => (lands.get(c)?.pressed ?? 0) >= 0.5),
        ) ||
        (aim === "office" && !r.chooses) ||
        (aim === "inquire" && r.word < 0.2),
      charter =
        !outlaw &&
        (((aim === "trade" || aim === "guard") && r.capacity < 0.5 && r.legitimacy >= 0.45) ||
          (aim === "worship" && cloistered(g, r.lands) && r.legitimacy >= 0.4) ||
          (aim === "inquire" && r.writing > 0 && r.word >= 0.5 && r.legitimacy >= 0.5));
    // (A decree on it, the god's or its ruler's, holds whatever its realm would do, while it lasts: sim/order/grouphand.ts.)
    if (g.decreeUntil !== undefined && g.decreeUntil < year) {
      delete g.decree;
      delete g.decreeUntil;
    }
    if (g.handUntil !== undefined && g.handUntil < year) {
      delete g.hand;
      delete g.handUntil;
    }
    const decreed = g.decree,
      standing = decreed ?? (outlaw ? (g.patron === p.ref ? 2 : 0) : charter || g.patron ? 2 : 1);
    const granted = decreed === undefined && standing === 2 && g.standing !== 2 && !g.patron;
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
      const s = stake(g, k);
      aimMen += a * s.gather;
      // (A rent kept full-time is its income; a common aim's, what its members pay in.)
      income += FULL_TIME.has(ORG_AIMS[k]!) ? a * s.worth : a * g.members * r.wage * ORG.cost;
    }
    // (Made minds: those of its people in their pay, whatever its lands' stakes would gather.)
    if (isMinds(g)) aimMen = mindHands;
    // (Blessed, a fifth more come to it; cursed, a fifth fewer.)
    if (g.hand === 1) aimMen *= 1.2;
    else if (g.hand === -1) aimMen *= 0.8;
    // (Outlawed by name, those its realm's hand reaches stay away for fear.)
    if (g.standing === 0 && g.decree === 0) aimMen *= 1 - ORG.fears * biteOf(g);
    setMen(g, menOf(g) + (aimMen - menOf(g)) * stepped(ORG.grow, span));
    g.income = Math.round(income);
    g.takes = Math.round(
      ((g.aims[AIM.prey]! + g.aims[AIM.smuggle]!) / 1000) *
        stakeIn(sharing, g, lands, AIM.prey).worth,
    );
    g.gives = Math.round(
      ((g.aims[AIM.aid]! + g.aims[AIM.lend]!) / 1000) * g.members * r.wage * ORG.cost * 4,
    );
    g.wealth = Math.round(g.wealth * stays + (Math.max(0, g.income) * fade) / ORG.spends);
    // (A party's hold on its interest's votes: its part of what it does, as many as its interest would gather, as wide as voice.)
    if (ORG_BASES[g.basis] === "interest") {
      const o = r.office.get(g.identity);
      g.organised = per(
        (g.aims[AIM.office]! / 1000) *
          Math.min(1, g.members / Math.max(ORG.crew, o?.gather ?? 0)) *
          (0.5 + 0.5 * r.voice),
      );
    }
  }

  // 2. New groups: the strongest stakes no group of that aim holds yet.
  type Cand = { aim: OrgAim; land: Land; men: number; sea: boolean; identity?: string };
  const cands: Cand[] = [];
  // (Each aim's groups' lands and their members, read once for all the realm's lands: they do not move while the candidates
  // are found.)
  const aimLands: number[][] = [],
    aimHolding = new Array<number>(AIMS).fill(0);
  for (let k = 0; k < AIMS; k++) aimLands.push([]);
  for (const g of v.orgs)
    if (g.aim >= 0 && g.aim < AIMS) {
      for (const c of g.lands) aimLands[g.aim]!.push(c);
      aimHolding[g.aim] = aimHolding[g.aim]! + g.members;
    }
  for (const l of r.lands)
    for (let k = 0; k < AIMS; k++) {
      const a = ORG_AIMS[k]!;
      if (a === "smuggle") continue;
      const men = l.gather[k]!;
      if (men < ORG.crew) continue;
      if (a === "office") continue;
      if (aimLands[k]!.includes(l.cell)) continue;
      // (Room for another: the groups of its aim hold well short of all the realm's stake would gather.)
      const holding = aimHolding[k]!;
      if (holding > 0 && holding >= 0.6 * v.gather[k]!) continue;
      const sea =
        a === "prey"
          ? l.coast && preyTake(l.sea, r.seaGuard) > preyTake(l.road, roadGuarded(l.reach, 0))
          : a === "hire" || a === "trade"
            ? l.coast && l.sea > l.road
            : false;
      cands.push({ aim: a, land: l, men, sea });
    }
  // (A party for each interest that would carry one and has none, at the seat.)
  const seatLand = lands.get(p.seat);
  if (seatLand)
    for (const [interest, o] of [...r.office].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      if (o.gather < ORG.crew) continue;
      if (v.orgs.some((g) => ORG_BASES[g.basis] === "interest" && g.identity === interest))
        continue;
      cands.push({ aim: "office", land: seatLand, men: o.gather, sea: false, identity: interest });
    }
  cands.sort((a, b) => b.men - a.men || a.land.cell - b.land.cell || AIM[a.aim] - AIM[b.aim]);
  let risen = 0,
    parties = 0;
  // (As many as the years stepped allow: two of the lands' and one party in each ORG.riseYears.)
  const turns = Math.max(1, Math.round(span / ORG.riseYears));
  for (const c of cands) {
    if (v.orgs.length >= ORG.most) break;
    // (A party is the seat's, not a land's: one may form beside the two that lands make.)
    if (c.identity) {
      if (parties >= turns) continue;
    } else if (risen >= 2 * turns) continue;
    if (v.orgs.filter((g) => g.aim === AIM[c.aim]).length >= ORG.ofAim) continue;
    if (risen > 0 && f.u(50 + risen) >= 0.5) continue;
    const g = rise(
      f,
      c.aim,
      c.land,
      c.sea,
      [
        factor(
          `a stake its people share (${c.identity ?? c.aim})`,
          c.identity ? (r.office.get(c.identity)?.worth ?? 0) : c.land.worth[AIM[c.aim]]!,
          1,
        ),
        factor("those it would gather", c.men, c.men / ORG.small),
        ...(c.identity && r.demagogue
          ? [factor("a demagogue to lead it", 1, 0.3)]
          : [factor("what binds them", bindingAt(ctx, r, c.land, c.aim), 0.2)]),
      ],
      c.identity,
    );

    if (!g) continue;
    g.members = Math.round(c.men * stepped(ORG.grow, span));
    if (c.identity) parties++;
    else risen++;
  }

  // (Its made minds, gone their own way, one of its groups once enough of its people are in their pay: by their own name, at
  // its seat. Not again within twenty years of their last ending.)
  if (
    freeMinds &&
    mindHands >= ORG.crew &&
    seatLand &&
    !v.orgs.some(isMinds) &&
    !v.gone.some((x) => ORG_KINDS[x.kind] === "made minds" && year - x.year < 4 * ORG.every)
  )
    riseMinds(f, freeMinds, mindPast, mindHold, mindHands);

  // 3. Its realm's answer, leaders gone, holds ended.
  const gone: [Org, OrgEnd, Factor[], Org?][] = [];
  const revolution = revolutionHolds(world, p.ref, year);
  for (const g of [...v.orgs]) {
    const coh = bindingAt(ctx, r, lands.get(g.home) ?? r.lands[0]!, orgAimOf(g));
    if (g.standing === 0) {
      // (Broken, far ground keeps the realm's hand off a refuge: ORG.hides.)
      const hidden = orgAimOf(g) === "refuge" ? ORG.hides * (lands.get(g.home)?.hard ?? 0) : 0,
        taken =
          1 -
          dmath.pow(
            1 -
              ORG.taken *
                Math.max(suppression, biteOf(g)) *
                (1 - Math.min(0.7, (coh - 1) / 4)) *
                (1 - hidden),
            span,
          );
      // (Its leader blessed, the realm's hand takes half as many of it; cursed, twice. Exactly as ever where none holds.)
      const by = hazardBy(world, bossRef(p.ref, g.event), g.leader.name, year);
      // (Kept from its realm's hand, none of it are taken.)
      if (g.hand !== 2) setMen(g, menOf(g) * (1 - (by === 1 ? taken : Math.min(1, taken * by))));
    }
    if (g.since >= year) continue;
    // (Made minds have no head to lose: they are their own.)
    if (!isMinds(g)) {
      // (Its head gone: dead of his years, or taken where it is outlawed. The god's acts on them as sim/acts/person.ts lays them.)
      const age = year - g.leader.born,
        head = bossRef(p.ref, g.event),
        by = hazardBy(world, head, g.leader.name, year),
        smite = actOn(world, head, g.leader.name, year, "smite"),
        years = diesWithin(ctx.life, age, 1),
        lost = leaderLost(years, g.standing === 0 ? suppression : 0, span),
        chance = by === 1 ? lost : Math.min(1, lost * by),
        drawn = f.u(100 + g.id * 8),
        // (Protected, a draw that fell past their years' own chance, in the realm's taking, spares them.)
        guard =
          !smite && drawn < chance ? actOn(world, head, g.leader.name, year, "protect") : null,
        spared = !!guard && drawn >= leaderLost(years, 0, span);
      if (guard && spared)
        sparedBy(world, guard, p.ref, f.ctx.provinces.get(g.home)?.ref ?? null, { group: g.name });
      if ((drawn < chance && !spared) || smite) {
        const before = g.leader.name,
          bornWas = g.leader.born,
          struck = smite
            ? struckBy(world, smite, p.ref, f.ctx.provinces.get(g.home)?.ref ?? null, {
                group: g.name,
              })
            : null;
        g.leader = newLeader(f, g.home, g.id * 37 + g.leaders);
        g.leaders++;
        // (How they went, for their page: a reading beside the world, sim/hand/deaths.ts.)
        const told = tell(
          f,
          ORG_EVENTS.leader.type,
          g.home,
          { group: g.name, kind: kindName(g), gids: [g.id], leader: g.leader.name, before },
          [
            { ref: g.event, role: "enabler", weight: 1 },
            ...(struck ? [{ ref: struck, role: "trigger" as const, weight: 1 }] : []),
          ],
        );
        deathNotesOf(world)?.addHead({
          ref: head,
          name: before,
          year,
          age: year - bornWas,
          how: struck ? "struck" : drawn < leaderLost(years, 0, span) ? "years" : "taken",
          years: leaderLost(years, 0, span),
          chance,
          draw: drawn,
          event: struck ?? told,
        });
        // (Taken by the realm's hand: brought before the court of their land, where it keeps one. sim/order/deeds.ts.)
        if (!struck && drawn >= leaderLost(years, 0, span)) {
          const aim = orgAimOf(g);
          sentence(
            ctx,
            p,
            g.home,
            {
              name: before,
              what: `head of the ${g.name} ${kindName(g)}`,
              ref: head,
              charge:
                aim === "rebel" || aim === "conspire"
                  ? "rising against the seat"
                  : aim === "prey" || aim === "smuggle"
                    ? "what was taken on its roads and seas"
                    : aim === "worship"
                      ? "keeping a faith the seat forbids"
                      : "holding to what the seat outlaws",
              grave: aim === "rebel" || aim === "conspire" ? 0.8 : aim === "prey" ? 0.6 : 0.3,
              purse: g.wealth > 20 * r.wage,
            },
            told,
            t,
            g.id,
          );
        }
      }
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
    if (ending.has(g) || g.since >= year || isMinds(g)) continue;
    const twin = v.orgs.find(
      (x) =>
        x !== g &&
        !ending.has(x) &&
        !isMinds(x) &&
        x.aim === g.aim &&
        x.home === g.home &&
        // (Parties of two interests at one seat are two parties, not one.)
        (g.aim !== AIM.office || x.identity === g.identity) &&
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
  const rankedBy = new Map<number, number[]>();
  for (const g of v.orgs) {
    g.power = per(0.6 * (g.members / allMen) + 0.4 * (g.wealth / allWealth));
    // (It reaches the lands where its first aim's stake is greatest, its home first, more as it grows.)
    // (A party, a refuge and an order's house hold one land and no more: the seat, the hard land, the land granted.)
    // (Made minds hold their seat: their crystal and the power they burn are there.)
    const one = ONE_LAND.has(orgAimOf(g)) || cloistered(g, r.lands) || isMinds(g),
      n = one ? 1 : Math.max(1, Math.min(ORG.lands, 1 + Math.floor(g.members / 300))),
      k = g.aim;
    // (The lands worth most to an aim, greatest first: ranked once for all its groups of that aim.)
    let ranked = rankedBy.get(k);
    if (!ranked)
      rankedBy.set(
        k,
        (ranked = r.lands
          .filter((l) => l.worth[k]! > 0)
          .sort((a, b) => b.worth[k]! - a.worth[k]! || a.cell - b.cell)
          .map((l) => l.cell)),
      );
    const held = lands.has(g.home) ? [g.home] : [];
    for (let i = 0; i < ranked.length && held.length < n; i++)
      if (ranked[i] !== g.home) held.push(ranked[i]!);
    g.lands = held;
    if (!g.lands.length) g.lands = [p.seat];
  }
  stepFeds(f);

  // 5. What it costs and kills; the realm pays its hired.
  let killings = 0,
    taken = 0;
  for (const g of v.orgs) {
    const a = (k: number) => (g.aims[k] ?? 0) / 1000;
    // (In whole people through the span, the part of one carried on: ./whole.ts.)
    const made = wholeOver(
      g.members *
        (ORG.preyKills * a(AIM.prey) +
          ORG.fightKills *
            (a(AIM.rebel) * (g.means & meansBit("arms") ? 1 : 0.1) * (0.3 + suppression) +
              a(AIM.enforce) * 0.5 +
              a(AIM.guard) * 0.2 * (r.atWar ? 1 : 0.3))),
      span,
      g.owed,
    );
    g.owed = made.owed;
    g.violence = made.whole / span;
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
  // 6. Whom its violence falls on (sim/order/deeds.ts): a group whose aim is against someone strikes at whoever heads what it
  // is against, the likelier the harder it is pressed; the answer takes of its men.
  for (const g of v.orgs) {
    if (g.since >= year || g.members < ORG.crew) continue;
    let will = 0;
    for (let k = 0; k < AIMS; k++)
      if (g.aims[k]! >= DEED.aimLeast) will += AGAINST_WILL[k]! * g.aims[k]!;
    // (Its faith's aim is against no one where its faith is not pressed.)
    const pressedFaith =
      g.aims[AIM.worship]! >= DEED.aimLeast &&
      g.lands.some((c) => (lands.get(c)?.pressed ?? 0) >= 0.5);
    if (!pressedFaith && g.aims[AIM.worship]! >= DEED.aimLeast)
      will -= AGAINST_WILL[AIM.worship]! * g.aims[AIM.worship]!;
    will /= 1000;
    if (will < DEED.willLeast) continue;
    const hit = strikes(
      ctx,
      p,
      {
        crime: false,
        id: g.id,
        will,
        members: g.members,
        striker: () => strikerOf(g, pressedFaith),
      },
      {
        pressed: Math.max(g.standing === 0 ? suppression : 0, lands.get(g.home)?.grievance ?? 0),
        capacity: r.capacity,
        crew: ORG.crew,
        span,
        key,
      },
      t,
    );
    if (hit) g.members = Math.max(0, g.members - hit.lost);
  }
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
        // (Its causes: the greatest of the groups allied, as many as an event holds.)
        [...of]
          .sort((a, b) => b.members - a.members || a.id - b.id)
          .map((g) => ({ ref: g.event, role: "enabler" as const, weight: 1 })),
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
  // (A group's men and its killing lie in its lands as their people do: none in an empty land, nor half of it in a hamlet.)
  const peopleIn = new Map(r.lands.map((l) => [l.cell, l.people])),
    spread = new Map(
      v.orgs.map((g) => [g, g.lands.reduce((s, c) => s + (peopleIn.get(c) ?? 0), 0)]),
    );
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
      thins = 0,
      refuge = 0,
      inquire = 0,
      cloister = 0,
      keeps = 0;
    for (const g of here) {
      const part = l.people / Math.max(1, spread.get(g) ?? l.people),
        w = g.members * part,
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
      killed += g.violence * part;
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
      // (A refuge holds its one land apart, as far as what it does is to hold it; an order its house the less.)
      const cl = cloistered(g, r.lands)
        ? a(AIM.worship) * Math.min(1, ((w * HOUSEHOLD) / households) * 4)
        : 0;
      refuge = Math.max(refuge, a(AIM.refuge) * Math.min(1, s * 10));
      inquire = Math.max(
        inquire,
        a(AIM.inquire) * Math.min(1, w / Math.max(1, l.learned * l.people)),
      );
      cloister = Math.max(cloister, cl);
      // (What an order keeps a year of its purse, for its learning and its stores.)
      if (cl > 0) keeps += g.wealth * ORG.spends * a(AIM.worship);
      thins += (a(AIM.rule) + 0.5 * a(AIM.prey) + a(AIM.refuge) + 0.5 * cl) * Math.min(1, s * 6);
    }
    // (An order's stores spare its land's hungry and sick, as mutual aid would, half as far.)
    aided += ORG.cloisterSpares * cloister;
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
      dmath.clamp(refuge, 0, 1) * 1000,
      dmath.clamp(inquire, 0, 1) * 1000,
      dmath.clamp(cloister, 0, 1) * 1000,
      Math.max(0, Math.round(keeps)),
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
  unpaidLeave(ctx, store, living, year);
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
  // (Its strongest, the lower number of two alike: asked with every reading of a realm's reach, so found without a sort.)
  let g = v.orgs[0];
  for (const x of v.orgs)
    if (g && (x.power > g.power || (x.power === g.power && x.id < g.id))) g = x;
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

/** How much more readily a land inquires for a learned society holding there (1: none). */
const societyInquires = (world: World, cell: number): number => {
  const k = orgInquiryOf(world, cell);
  return k > 0 ? 1 + ORG.inquiry * k : 1;
};

/**
 * A company whose payer's treasury has nothing by it leaves its pay, the year it is so (2026-11-19): between a realm's
 * reckonings (ORG.every years) it would else stay hired and leave the field at every battle (sim/war/companies.ts). No
 * draw: the treasury's own row. A realm that keeps no treasury pays in kind, and is not left. Whom it follows next is its
 * realm's next reckoning of who pays. One pass over the realms that keep groups; a record is set only where one leaves.
 */
export function unpaidLeave(
  ctx: PopulationContext,
  store: OrgsStore,
  living: readonly Polity[],
  year: number,
): void {
  const { world } = ctx,
    purse = moneyStore(world, TREASURY_STORE);
  if (!purse) return;
  const realms = politiesOf(world);
  for (const p of living) {
    const was = store.of(p.ref);
    if (!was || !was.orgs.length) continue;
    let v: RealmOrgs | null = null;
    for (let i = 0; i < was.orgs.length; i++) {
      const g = was.orgs[i]!;
      // (Those in a realm's pay for the field: a privateer's licence costs its realm nothing.)
      if (!g.patron || ORG_AIMS[g.aim] !== "hire") continue;
      const row = purse.get(g.patron);
      if (!row || (row[FISC.reserve] ?? 0) > 0) continue;
      const payer = realms.get(g.patron);
      v ??= copyOf(was);
      const mine = v.orgs[i]!;
      delete mine.patron;
      world.events.emit({
        type: ORG_EVENTS.unpaid.type,
        subjects: payer ? [p.ref, payer.ref] : [p.ref],
        place: ctx.provinces.get(g.home)?.ref ?? null,
        causes: [
          { ref: g.event, role: "enabler", weight: 1 },
          ...(payer
            ? warsOf(world)
                .fighting(payer.ref)
                .slice(0, 1)
                .map((w) => ({ ref: w.event, role: "pressure" as const, weight: 1 }))
            : []),
        ],
        data: {
          realm: realmName(p),
          group: g.name,
          kind: kindName(g),
          gids: [g.id],
          patron: payer ? realmName(payer) : "a realm",
          members: g.members,
          year,
        },
      });
    }
    if (v) store.put(p.ref, v);
  }
}

/** Register the groups on a peopled world. */
export function installGroups(world: World, ctx: () => PopulationContext): OrgsStore {
  const store = world.register(new OrgsStore());
  world.register(new RowStore(ORG_LANDS_STORE, ORG_LANDS_WIDTH));
  world.addPinner(() => store.pinned());
  world.system({ key: "188.order.zgroups", every: YEAR, run: (t) => groupsYear(ctx(), t) });
  // (A land where a learned society holds inquires the more readily: exactly 1 where none is kept.)
  inquiresMore(societyInquires);
  return store;
}
