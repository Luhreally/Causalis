// The underworld (the rules are rules/underworld.ts; what is kept ./underworld-kept.ts). Asked 2026-11-16: "do like modern day
// violent mexican cartels ever emerge or have the first principles to emerge? italian mob type things?", and then street gangs and
// police gangs. A realm is reckoned once in UNDER.every years, in its turn (by its ref's number and the year), and stepped as many
// years at once:
//   - who wants protection and who can sell it: how safe its holdings are and how far its deals are held to (sim/society law), the
//     trade worth guarding (sim/money treasury's trade), against the men skilled in violence and idle: a levy home from a war ended
//     in the last ten years (sim/war: fielded less fallen), its young men without openings (idle crafts, sim/trade; its poorest fifth,
//     sim/money shares), those on the street (sim/society roofless);
//   - the rents of what it forbids or taxes: the ban's (its users' spending times the risk's part of the price, sim/money/intox.ts),
//     its tariffs' and sanctions' (sim/money smuggling), and a border with a realm it meets that bans and is a rich market; the share
//     of them outside hands can take, where its reach is weak and its officers can be bought;
//   - its groups, each a small record with a boss of a birth year: a protection family where the pull of protection is great enough,
//     a smuggling cartel where the rent taken is, each new one entering while the rent is worth sharing and no one group dominates.
//     Shares of a road's rent move toward strength; a road's groups close in strength fight over it (a turf war), one dominant or a
//     pact with the state keeps the peace; each group's men are what its income keeps, of the idle men there are;
//   - the street: a land's town large enough to have poor quarters, its young men, its idle crafts and its poor, its kin and temple's
//     hold and those on the street or come from elsewhere, its quarters set apart by faith or folk, its police's reach and the
//     forbidden trade's addicted demand make a count of small gangs and their pull; a realm's gangs of one identity ally into a
//     federation (at most UNDER.feds), and where many, into two rival blocs; a court that jails knits them across towns;
//   - the state's answer: a crackdown by its reach, its standing and the voice of the harmed, paid from its treasury, taking men,
//     wealth (seized for its treasury) and bosses (a boss taken leaves rival successors); or collusion where its officers are bought,
//     a great house sheltering a group; a ban ended collapses the ban's rent, and a cartel turns to extortion or withers;
//   - the badge: a crackdown under weak oversight with a rent in reach turns its enforcers into a crew of their own, a shakedown
//     crew or a death squad, ended by exposure (free word, its courts, a rival house, the killings it leaves) or kept by impunity.
// What flows back, read by the older systems (each exactly as before where nothing is kept): the killings in a land's young people's
// deaths (sim/population mortality); grievance in its lands a year for its killings and what is extorted (here, yearly); its
// holdings less safe for extortion and its deals held a little better where a protector holds them and courts do not, worse where
// the enforcers are a crew of their own (sim/society holdings); its town drawing fewer newcomers for its killing (sim/population
// urban); its officers bought (sim/order corruption) and its reach thinned (capacityOf); its standing lowered by open killing and a
// crew found out (legitimacy); the forbidden trade's organisation (sim/money/intox.ts BAR.cartel), and with it its smuggling.
// One record a realm, one row a land; a realm's record goes with it.
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
  BANDS,
  INST,
  policedReach,
  CRIME_AGAINST,
  DEED,
  COURTS,
  GEAR,
  GEAR_PARTS,
  POTENCY,
  madeTarget,
  potencyAfter,
  potencyCap,
  potencyTarget,
  riskPremium,
  type MeansPart,
  meansBought,
  CONTRA_CAUSES,
  GROUP_KINDS,
  HOLD,
  MALE,
  OCC,
  UNDER,
  badgePull,
  banRent,
  bossTaken,
  collusionOf,
  escalation,
  fightOdds,
  ESCALATE,
  crackdownOf,
  deathSquad,
  diesWithin,
  exposedWithin,
  killingsOf,
  tiringOver,
  balanceMoved,
  peaceWorn,
  takeoverMen,
  protectionWantedIn,
  racketBit,
  rentCaptured,
  streetFight,
  streetPull,
  successorsOf,
  turfWar,
  huntedFor,
  newcomersOf,
  violentIdle,
  youngBand,
  type GroupEnd,
  type GroupKind,
} from "../../rules/index.ts";
import { marketsOf, type PopulationContext } from "../population/systems.ts";
import { row } from "../population/model.ts";
import { urbanOf } from "../population/urban.ts";
import { WAY, cultureOf } from "../culture/culture.ts";
import { FOLK_ROW, FOLK_STORE, cultureRows } from "../culture/rows.ts";
import { beliefOf } from "../belief/belief.ts";
import { loreOf } from "../lore/lore.ts";
import { politiesOf, realmName, type Polity } from "../polity/polity.ts";
import { occupationOf } from "../war/occupation.ts";
import { diplomacyOf } from "../diplomacy/diplomacy.ts";
import { fieldedOf, warsOf } from "../war/war.ts";
import { armsOf } from "../war/arms.ts";
import { blockadeOn, coastal } from "../war/navy.ts";
import { materialsOf } from "../lore/materials.ts";
import { grieve } from "../acts/disasters.ts";
import {
  BAR,
  BAR_STORE,
  FISC,
  SHARE,
  SHARES_STORE,
  SMUGGLE,
  SMUGGLE_STORE,
  TREASURY_STORE,
  contrabandOf,
  intoxDependent,
  moneyStore,
  refNumber,
  stepped,
} from "../money/kept.ts";
import { RISK } from "../money/intox.ts";
import { idleOf } from "../trade/kept.ts";
import { takingsOf } from "../trade/demand.ts";
import {
  LAW_ROW,
  LAW_STORE,
  ROOFLESS_STORE,
  ROOF_ROW,
  societyStore,
  streetOf,
} from "../society/kept.ts";
import { addsReach, addsStanding, capacityValue, orderOf, reachOver } from "./order.ts";
import { holdsOf } from "./holds.ts";
import { LAW_OF } from "./laws.ts";
import { housesOf, housesRead, originOf } from "./houses.ts";
import {
  GANGS_STORE,
  GANGS_WIDTH,
  POTENCY_STORE,
  POTENCY_WIDTH,
  POT_ROW,
  bitesOf,
  potencyStore,
  GANG_ROW,
  UnderworldStore,
  gangsStore,
  underworldOf,
  type CrimeGroup,
  type Federation,
  type Operation,
  type GangWar,
  type RealmUnderworld,
} from "./underworld-kept.ts";
import { RowStore } from "../money/kept.ts";
import { actOn, bossRef, hazardBy, sparedBy, struckBy } from "../acts/person.ts";
import { sentence, strikes } from "./deeds.ts";
import { BODY_ROW, bodyLandsStore, courtJailsIn, watchOf } from "./institutions-kept.ts";
import { KILLINGS_KEPT, deathNotesOf } from "../hand/deaths.ts";

/** The causes of contraband whose rent the underworld's groups carry beside the tariff's and the ban's (money/contraband.ts). */
const WARE_RENT_CAUSES: ReadonlySet<string> = new Set(["war", "licence", "harm"]);

export const UNDERWORLD_EVENTS = {
  /** A group rose: a protection family, a smuggling cartel, a crew of the realm's own enforcers. */
  rose: defineEventType("underworld.rose", 3),
  badge: defineEventType("underworld.badge", 3),
  /** A group split from another whose boss was taken. */
  split: defineEventType("underworld.split", 3),
  /** Two groups went to war over a rent; one came to hold it, or a pact with the state cooled it. */
  war: defineEventType("underworld.war", 4),
  pax: defineEventType("underworld.pax", 3),
  /** A boss taken by the realm's crackdown; a boss dead and another in his place. */
  decapitated: defineEventType("underworld.decapitated", 3),
  boss: defineEventType("underworld.boss", 1),
  /** The realm turned on its groups; its officers bought by them. */
  crackdown: defineEventType("underworld.crackdown", 3),
  pact: defineEventType("underworld.pact", 3),
  /** A ban ended and a cartel turned to other rackets. */
  turned: defineEventType("underworld.turned", 3),
  /** A group's hold ended. */
  ended: defineEventType("underworld.ended", 3),
  /** A federation of street gangs formed; two came to stand against each other. */
  federation: defineEventType("underworld.federation", 3),
  feud: defineEventType("underworld.feud", 3),
  /** A crew of the realm's own found out, purged and reformed. */
  exposed: defineEventType("underworld.exposed", 3),
  /** Escalation: soldiers sent against a group, a clash, its boss taken by them, a truce, its fighters laid down arms, the army withdrawn. */
  operation: defineEventType("underworld.operation", 3),
  clash: defineEventType("underworld.clash", 3),
  armyTook: defineEventType("underworld.army-took", 3),
  truce: defineEventType("underworld.truce", 3),
  disarmed: defineEventType("underworld.disarmed", 3),
  withdrew: defineEventType("underworld.withdrew", 3),
};

/** The importance of a named group's end that the chronicle carries: one taken over in a war it lost, one put down by its seat. */
const TOLD = 4;

const DRAW = defineStream("order.underworld");
const KIND = (k: GroupKind): number => GROUP_KINDS.indexOf(k);
export const kindOfGroup = (g: { readonly kind: number }): GroupKind =>
  GROUP_KINDS[g.kind] ?? "protection";
const per = (x: number) => Math.round(dmath.clamp(x, 0, 1) * 1000);
const keyOf = (r: Ref) => parseRef(r).b >>> 0;
const r2 = (x: number) => Math.round(x * 100) / 100;

/** A seat's reach in a land against those outside the law: as the watch there makes it, where one is kept. */
function policedIn(rows: RowStore | null, cell: number, reach: number): number {
  const row = rows?.get(cell);
  return row && row[BODY_ROW.watch]! > 0
    ? policedReach(reach, row[BODY_ROW.watch]! / 1000, row[BODY_ROW.honest]! / 1000)
    : reach;
}

/** The facts of a realm's reckoning. */
type Facts = {
  readonly ctx: PopulationContext;
  readonly p: Polity;
  readonly v: RealmUnderworld;
  readonly t: SimTime;
  readonly year: number;
  readonly key: number;
  readonly u: (k: number) => number;
  /**
   * The wars opened in this reckoning, not yet told: one is told as opened only once both its groups still stand at the
   * reckoning's end (stepRealm, before step 10). A group put down, disarmed or broken in the reckoning its war opened was told
   * as a war opened and, in the same year, a group ended "its war ended with it": 18 of 126 wars in a century of first light,
   * none of them ever fought past the clash it opened with. Such a one is told once, by the group's end, as what it was.
   */
  readonly opening: Set<GangWar>;
};

/** A realm's record as first reckoned. */
function fresh(year: number): RealmUnderworld {
  return {
    last: year,
    next: 1,
    want: 0,
    supply: 0,
    pool: 0,
    veterans: 0,
    protectRent: 0,
    banRent: 0,
    tariffRent: 0,
    borderRent: 0,
    captured: 0,
    smuggleRent: 0,
    crackdown: 0,
    bites: 0,
    collusion: 0,
    cost: 0,
    seized: 0,
    killings: 0,
    street: 0,
    badge: 0,
    extortion: 0,
    badgePull: 0,
    crackEvent: null,
    pactEvent: null,
    told: 0,
    groups: [],
    feds: [],
    wars: [],
    gone: [],
  };
}

function copyOf(v: Readonly<RealmUnderworld>): RealmUnderworld {
  return {
    ...v,
    groups: v.groups.map((g) => ({ ...g, lands: [...g.lands], boss: { ...g.boss } })),
    feds: v.feds.map((f) => ({ ...f, towns: [...f.towns] })),
    wars: v.wars.map((w) => ({ ...w })),
    gone: [...v.gone],
    ...(v.ops ? { ops: v.ops.map((o) => ({ ...o })) } : {}),
    ...(v.truce ? { truce: { ...v.truce } } : {}),
  };
}

/** A name in the realm's tongue, drawn for a purpose (`salt`). */
function tongueWord(f: Facts, cell: number, salt: number, seed: number): string | null {
  const ways = cultureOf(f.ctx.world).get(cell) ?? cultureOf(f.ctx.world).get(f.p.seat);
  if (!ways) return null;
  const u = f.ctx.world.rng.real(DRAW, f.key, f.t, 5000 + salt);
  return tongueName({ ...ways.tongue, seed: ways.tongue.seed ^ seed }, Math.floor(u * 1e6));
}

/** A land's market town's name, where it has one. */
function townName(ctx: PopulationContext, cell: number): string | null {
  const town = ctx.settlements.inProvince(cell).find((s) => s.market);
  return town?.name ?? null;
}

/** A new boss, grown and in his prime. */
function newBoss(f: Facts, cell: number, surname: string | null, salt: number): CrimeGroup["boss"] {
  const given = tongueWord(f, cell, salt, 0x6b1d) ?? "One",
    // (A family's boss bears its name; another's, his own family's.)
    family = surname ?? tongueWord(f, cell, salt + 1, 0x51f7),
    grown = f.ctx.life.adulthood;
  return {
    name: family ? `${given} ${family}` : given,
    born: f.year - Math.round(grown * (1.6 + f.u(salt * 7 + 3))),
    since: f.year,
  };
}

/** An event of the underworld, with its decision where a reckoning chose it. */
function tell(
  f: Facts,
  type: string,
  cell: number | null,
  data: Record<string, unknown>,
  causes: { ref: Ref; role: "trigger" | "enabler" | "pressure"; weight: number }[],
  factors?: Factor[],
  importance?: number,
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
    ...(importance !== undefined ? { importance } : {}),
    subjects: [f.p.ref],
    place: cell !== null ? (f.ctx.provinces.get(cell)?.ref ?? null) : null,
    // (At most MAX_CAUSES: a federation of many groups cites the first of them.)
    causes: [
      ...(decision ? [{ ref: decision, role: "trigger" as const, weight: 1 }] : []),
      ...causes,
    ].slice(0, MAX_CAUSES),
    data: { realm: realmName(f.p), ...data },
  });
}

const factor = (name: string, value: number, contribution: number): Factor => ({
  name,
  value: r2(value),
  contribution,
  source: null,
});

/** A group rises: its record and its event. */
function rise(
  f: Facts,
  kind: GroupKind,
  home: number,
  share: number,
  factors: Factor[],
  of?: CrimeGroup,
  cause?: Ref,
): CrimeGroup | null {
  const { ctx, v, year } = f,
    salt = v.next * 13 + KIND(kind),
    // (A family takes its boss's name; a cartel its home town's; a crew its seat's; each in its tongue where no town names it.)
    name =
      kind === "protection"
        ? of
          ? (tongueWord(f, home, salt, 0x51f7) ?? of.name)
          : tongueWord(f, home, salt, 0x51f7)
        : kind === "cartel"
          ? (townName(ctx, home) ?? tongueWord(f, home, salt, 0x2c9e))
          : (townName(ctx, f.p.seat) ?? tongueWord(f, home, salt, 0x2c9e));
  if (!name || v.groups.some((g) => g.name === name && g.kind === KIND(kind))) return null;
  const boss = newBoss(f, home, kind === "protection" ? name : null, salt),
    gid = v.next++,
    type = of
      ? UNDERWORLD_EVENTS.split.type
      : kind === "badge"
        ? UNDERWORLD_EVENTS.badge.type
        : UNDERWORLD_EVENTS.rose.type,
    event = tell(
      f,
      type,
      home,
      { group: name, kind, gids: [gid], boss: boss.name, ...(of ? { of: of.name } : {}) },
      [
        ...(of ? [{ ref: of.event, role: "enabler" as const, weight: 1 }] : []),
        ...(cause ? [{ ref: cause, role: "trigger" as const, weight: 1 }] : []),
      ],
      factors,
    ),
    g: CrimeGroup = {
      id: gid,
      name,
      kind: KIND(kind),
      since: year,
      event,
      home,
      lands: kind === "badge" ? [] : [home],
      boss,
      bosses: 1,
      members: 0,
      wealth: 0,
      income: 0,
      share: per(share),
      power: 0,
      rackets:
        kind === "protection"
          ? racketBit("protection") | racketBit("extortion")
          : kind === "cartel"
            ? racketBit("smuggling")
            : racketBit("shakedown"),
      violence: 0,
      bribes: 0,
      ...(of ? { of: of.id } : {}),
    };
  v.groups.push(g);
  return g;
}

/** A group's hold ends: told, and its record let go. */
function ended(
  f: Facts,
  g: CrimeGroup,
  how: GroupEnd,
  factors: Factor[],
  into?: CrimeGroup,
  type: string = UNDERWORLD_EVENTS.ended.type,
  more: Record<string, unknown> = {},
  importance?: number,
  why: { ref: Ref; role: "trigger"; weight: number }[] = [],
): Ref {
  const { v, year } = f,
    // (A group that ends at war ends its war: the chronicle carried the war's opening, so it carries this, with whom it fought.
    // Of 132 wars opened in a century of first light 53 ended so, by soldiers, a crackdown or a rent gone, and nothing said
    // their war was over.)
    war = v.wars.find((w) => w.ended === null && (w.a === g.id || w.b === g.id)),
    // (One opened in this very reckoning was never told: this end tells it, and is what its record opens.)
    untold = !!war && f.opening.has(war),
    cited = war && !untold && !why.some((x) => x.ref === war.event),
    event = tell(
      f,
      type,
      g.home,
      {
        group: g.name,
        kind: kindOfGroup(g),
        gids: [g.id, ...(into ? [into.id] : [])],
        how,
        since: g.since,
        ...(into ? { into: into.name } : {}),
        ...(war && how !== "taken over" ? { foe: war.names[war.a === g.id ? 1 : 0] } : {}),
        ...(untold ? { opened: 1 } : {}),
        ...more,
      },
      [
        { ref: g.event, role: "enabler", weight: 1 },
        ...why,
        ...(war && cited ? [{ ref: war.event, role: "enabler" as const, weight: 1 }] : []),
      ],
      factors,
      war ? TOLD : importance,
    );
  v.groups = v.groups.filter((x) => x !== g);
  for (const w of v.wars)
    if (w.ended === null && (w.a === g.id || w.b === g.id)) {
      w.ended = year;
      w.how = how;
      w.lost = w.a === g.id ? 0 : 1;
      if (f.opening.delete(w)) w.event = event;
    }
  for (const fed of v.feds) if (fed.supplier === g.id) delete fed.supplier;
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
  ].slice(-UNDER.gone);
  return event;
}

// —— What a realm offers its underworld ———————————————————————————————————————————————————————————————————

type Read = {
  people: number;
  young: number;
  veterans: number;
  wage: number;
  trade: number;
  earned: number;
  revenue: number;
  capacity: number;
  /** Its watch, where it keeps one (sim/order/institutions.ts watchOf): how far it is manned (0 … 1), how honest, its hands. */
  watch: { manned: number; honest: number; staff: number } | null;
  /** Its reach against those outside the law, as that watch makes it (its reach itself where it keeps none). */
  policed: number;
  /** How far its seat reaches each of its peopled lands (sim/order reachOver). */
  reachIn: ReadonlyMap<number, number>;
  corruption: number;
  legitimacy: number;
  force: number;
  voice: number;
  word: number;
  secure: number;
  deals: number;
  byCourts: number;
  courts: number;
  writing: boolean;
  justice: number;
  idle: number;
  poor: number;
  street: number;
  barred: number;
  banWorth: number;
  edge: Set<number>;
};

function readRealm(ctx: PopulationContext, p: Polity, year: number): Read {
  const { world } = ctx,
    g = ctx.generated,
    realms = politiesOf(world),
    o = orderOf(world)?.of(p.ref),
    held = holdsOf(world, p.ref),
    law = societyStore(world, LAW_STORE)?.get(p.ref),
    fisc = moneyStore(world, TREASURY_STORE)?.get(p.ref),
    bar = moneyStore(world, BAR_STORE)?.get(p.ref),
    lore = loreOf(world),
    over = reachOver(ctx, p),
    markets = marketsOf(world),
    m = markets.get(p.seat),
    life = ctx.life,
    edge = new Set<number>();
  let people = 0,
    young = 0,
    street = 0,
    sold = 0,
    workers = 0,
    handsIdle = 0;
  for (const c of p.members) {
    const prov = ctx.provinces.get(c);
    if (!prov) continue;
    const n = prov.total();
    people += n;
    // (What passes this land's shops and stalls, by its last books: sim/trade/demand.ts takingsOf.)
    const lm = n > 0 ? markets.get(c) : undefined;
    workers += Math.max(0, n - prov.occupation(OCC.dependent));
    if (lm) {
      // (Its crafters' hands for the part of the year no one had use for their work: Market.craftsWorked.)
      handsIdle += prov.occupation(OCC.crafter) * (1 - lm.craftsWorked / 1000);
      sold += takingsOf(prov, lm);
    }
    for (let b = 0; b < BANDS; b++)
      if (youngBand(life, b)) young += prov.counts.rowSum(row(MALE, b));
    street += n * streetOf(world, c);
    for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++)
      if (realms.of(g.grid.neighbours[k]!)?.ref !== p.ref) {
        edge.add(c);
        break;
      }
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
  // (Its watch, where it keeps one: how far manned for its people, how honest.)
  const kept = watchOf(world, p.ref),
    watch = kept
      ? {
          manned: Math.min(1, kept.staff / Math.max(1, (people * INST.watchFull) / 1000)),
          honest: kept.honest,
          staff: kept.staff,
        }
      : null;
  const fifth = moneyStore(world, SHARES_STORE)?.get(p.seat)?.[SHARE.fifths],
    revenue = fisc
      ? fisc[FISC.tariffs]! +
        fisc[FISC.seigniorage]! +
        fisc[FISC.take]! +
        fisc[FISC.take + 1]! +
        fisc[FISC.take + 2]! +
        fisc[FISC.take + 3]!
      : 0;
  return {
    people,
    young,
    veterans,
    // (A working man's year: what a worker of its lands earns, the treasury's own reckoning of it, a living at the least. It
    // was the worth of a full year at the seat's best craft, which is what a crafter earns only where all his year's work is
    // wanted. Before the treasury has read its lands, the seat's wages.)
    wage: Math.max(
      1,
      fisc && workers > 0
        ? fisc[FISC.base + 3]! / workers
        : m
          ? Math.max(m.wage[OCC.crafter]!, m.wage[OCC.farmer]!)
          : 1,
    ),
    trade: sold,
    earned: fisc ? fisc[FISC.base + 3]! : 0,
    revenue,
    capacity: over.value,
    watch,
    policed: watch ? policedReach(over.value, watch.manned, watch.honest) : over.value,
    reachIn: over.lands,
    corruption: o?.corruption ?? 0,
    legitimacy: o?.legitimacy ?? 0.5,
    force: held[HOLD.force] ?? 0.5,
    voice: held[HOLD.voice] ?? 0.3,
    word: held[HOLD.word] ?? 0.5,
    secure: law ? law[LAW_ROW.secure]! / 1000 : 0.5,
    deals: law ? law[LAW_ROW.deals]! / 1000 : 0.5,
    byCourts: law ? law[LAW_ROW.byCourts]! / 1000 : 0,
    courts: law ? law[LAW_ROW.courts]! / 1000 : 0.3,
    writing: lore.effect(p.seat, "writing") > 0,
    justice: o?.laws[LAW_OF.justice] ?? 0,
    // (Its hands with nothing to do: its crafts stood idle in a slump (sim/trade), and the hands of its crafts for whose work
    // there was no use, of all who work. While every hand without work made tools no one wanted, none were idle but in a slump.)
    idle: dmath.clamp(idleOf(world, p.ref) + (workers > 0 ? handsIdle / workers : 0), 0, 1),
    poor: fifth !== undefined ? dmath.clamp(1 - fifth / 1000 / 0.2, 0, 1) : 0.5,
    street: people > 0 ? street / people : 0,
    barred: (bar?.[BAR.barred] ?? 0) / 1000,
    banWorth: bar ? bar[BAR.demand]! * (bar[BAR.price]! / 1000) : 0,
    edge,
  };
}

// —— The street ———————————————————————————————————————————————————————————————————————————————————————————

type Town = {
  cell: number;
  people: number;
  members: number;
  gangs: number;
  pull: number;
  identity: string;
  other: string | null;
  informal: number;
  killed: number;
  jailed: number;
  young: number;
  /** Its town's people. */
  town: number;
};

/** A realm's towns with poor quarters, and their gangs. */
function streetTowns(ctx: PopulationContext, p: Polity, r: Read): Town[] {
  const { world } = ctx,
    culture = cultureOf(world),
    belief = beliefOf(world),
    folk = cultureRows(world, FOLK_STORE),
    o = orderOf(world)?.of(p.ref),
    reachLaw = COURTS[r.justice] ?? COURTS[0],
    faiths = new Map<string, number>(),
    out: Town[] = [];
  for (const c of p.members) {
    const n = ctx.provinces.get(c)?.total() ?? 0,
      f = belief.of(c).faith ?? "none";
    faiths.set(f, (faiths.get(f) ?? 0) + n);
  }
  const seatFaith = belief.of(p.seat).faith ?? "none";
  for (const c of p.members) {
    const prov = ctx.provinces.get(c),
      town = prov ? ctx.settlements.inProvince(c).find((s) => s.market) : undefined;
    if (!prov || !town || town.population < UNDER.town) continue;
    const n = prov.total();
    if (n <= 0) continue;
    let young = 0;
    for (let b = 0; b < BANDS; b++)
      if (youngBand(ctx.life, b)) young += prov.counts.rowSum(row(MALE, b));
    const ways = culture.get(c),
      faith = belief.of(c).faith ?? "none",
      urban = urbanOf(world, c),
      newcomers = urban ? newcomersOf(urban.draw, urban.target) : 0,
      kin = (folk?.get(c)?.[FOLK_ROW.kin] ?? 1000) / 1000,
      otherFaith = r.people > 0 ? 1 - (faiths.get(faith) ?? 0) / r.people : 0,
      apart = dmath.clamp(newcomers * otherFaith + 0.5 * (1 - kin), 0, 1),
      informal = dmath.clamp(
        0.5 * (ways?.traits[WAY.kinship] ?? 0.5) + 0.35 * (ways?.traits[WAY.piety] ?? 0.5),
        0,
        1,
      ),
      fifth = moneyStore(world, SHARES_STORE)?.get(c)?.[SHARE.fifths],
      pull = streetPull({
        young: young / n,
        idle: r.idle,
        poor: fifth !== undefined ? dmath.clamp(1 - fifth / 1000 / 0.2, 0, 1) : r.poor,
        street: streetOf(world, c),
        newcomers,
        apart,
        reach: r.capacity * reachLaw * (1 - (o?.corruption ?? 0)),
        informal,
        dependent: intoxDependent(world, c),
      }),
      // (Of the town's young men, a share as great as the pull at most a third run with its gangs: some forty to a gang.)
      townYoung = (young * town.population) / n,
      members = Math.round(townYoung * pull * 0.3),
      gangs = Math.floor(members / 40);
    if (gangs <= 0) continue;
    // (Who its gangs are: its own faith's, or where its quarters are set apart, the others' too.)
    const other =
      apart >= 0.3
        ? faith !== seatFaith
          ? seatFaith
          : ([...faiths.entries()]
              .filter(([x]) => x !== faith)
              .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? "strangers")
        : null;
    out.push({
      cell: c,
      people: n,
      members,
      gangs,
      pull,
      identity: faith,
      other,
      informal,
      killed: 0,
      jailed: 0,
      young,
      town: town.population,
    });
  }
  return out;
}

/** The federations of a realm's street gangs: who allies with whom, across which towns; the rival blocs. */
function stepFederations(f: Facts, towns: Town[], jails: boolean): void {
  const { v } = f,
    blocs = new Map<string, Town[]>();
  for (const t of towns) {
    for (const id of t.other ? [t.identity, t.other] : [t.identity]) {
      const l = blocs.get(id) ?? [];
      l.push(t);
      blocs.set(id, l);
    }
  }
  const sum = (ts: readonly Town[]) => ts.reduce((s, t) => s + t.gangs, 0),
    reach = jails ? 1 : UNDER.fedTown,
    // (What binds the gangs of several towns into one: the cells where their men meet, or a cartel that supplies them all. And
    // several towns to bind: one town's gangs, however many, are that town's gangs.)
    binds = jails || v.groups.some((g) => kindOfGroup(g) === "cartel"),
    spans = (ts: readonly Town[]) =>
      binds && ts.filter((t) => t.gangs >= UNDER.fedTown).length >= UNDER.fedTowns;
  // (A federation reaches the towns of its identity whose gangs are enough; through the cells, those with any.)
  for (const fed of [...v.feds]) {
    const own = (blocs.get(fed.identity) ?? []).filter((t) => t.gangs >= reach);
    if (!own.length || sum(own) < UNDER.fedForm / 2 || !spans(blocs.get(fed.identity) ?? [])) {
      v.feds = v.feds.filter((x) => x !== fed);
      for (const x of v.feds) if (x.rival === fed.id) delete x.rival;
      continue;
    }
    // (A second bloc of one identity keeps the towns it took.)
    const twin = v.feds.find((x) => x !== fed && x.identity === fed.identity);
    fed.towns = twin
      ? own
          .filter((t) => fed.towns.includes(t.cell) || !twin.towns.includes(t.cell))
          .map((t) => t.cell)
      : own.map((t) => t.cell);
  }
  const ranked = [...blocs.entries()]
    .map(([id, ts]) => [id, ts, sum(ts)] as const)
    .sort((a, b) => b[2] - a[2] || (a[0] < b[0] ? -1 : 1));
  for (const [id, ts, n] of ranked) {
    if (v.feds.length >= UNDER.feds) break;
    const has = v.feds.filter((x) => x.identity === id);
    // (Where one identity's gangs are many, they come to stand in two blocs, each against the other: the second takes the
    // towns where the first is weakest, and the greatest town is fought over by both.)
    const want = n >= 2 * UNDER.fedForm * 1.5 ? 2 : n >= UNDER.fedForm ? 1 : 0;
    if (has.length >= want || !spans(ts)) continue;
    const own = ts
      .filter((t) => t.gangs >= reach)
      .sort((a, b) => b.gangs - a.gangs || a.cell - b.cell);
    if (!own.length) continue;
    const first = has[0],
      towns = first
        ? [own[0]!.cell, ...own.filter((t, i) => i > 0 && i % 2 === 1).map((t) => t.cell)]
        : own.map((t) => t.cell),
      name = tongueWord(f, own[0]!.cell, 900 + v.next, 0x3c2a);
    if (!name || v.feds.some((x) => x.name === name)) continue;
    if (first) first.towns = first.towns.filter((c) => c === own[0]!.cell || !towns.includes(c));
    const fid = v.next++,
      event = tell(
        f,
        UNDERWORLD_EVENTS.federation.type,
        own[0]!.cell,
        {
          federation: name,
          fids: [fid],
          towns: towns.length,
          ...(first ? { against: first.name } : {}),
        },
        first ? [{ ref: first.event, role: "pressure", weight: 1 }] : [],
        [
          factor("small gangs of one people in its towns", n, n / UNDER.fedForm),
          ...(first ? [factor("a bloc already standing", 1, 1)] : []),
        ],
      ),
      fed: Federation = {
        id: fid,
        name,
        since: f.year,
        event,
        identity: id,
        towns,
        gangs: 0,
        members: 0,
        strength: 0,
        jailed: 0,
        ...(first ? { rival: first.id } : {}),
      };
    v.feds.push(fed);
    if (first) first.rival = fid;
  }
  // (Rivals: two federations in one town stand against each other.)
  for (const a of v.feds)
    for (const b of v.feds) {
      if (a.id >= b.id || a.rival === b.id) continue;
      if (!a.towns.some((c) => b.towns.includes(c))) continue;
      if (a.rival === undefined && b.rival === undefined) {
        a.rival = b.id;
        b.rival = a.id;
        tell(
          f,
          UNDERWORLD_EVENTS.feud.type,
          a.towns.find((c) => b.towns.includes(c)) ?? null,
          { federation: a.name, against: b.name, fids: [a.id, b.id] },
          [
            { ref: a.event, role: "enabler", weight: 1 },
            { ref: b.event, role: "enabler", weight: 1 },
          ],
        );
      }
    }
  // (Each federation's gangs, men and strength; a cartel that supplies it.)
  const cartel = [...v.groups]
    .filter((g) => kindOfGroup(g) === "cartel")
    .sort((a, b) => b.power - a.power || a.id - b.id)[0];
  for (const fed of v.feds) {
    let gangs = 0,
      members = 0,
      pull = 0,
      jailed = 0;
    for (const t of towns) {
      if (!fed.towns.includes(t.cell)) continue;
      const shared = v.feds.filter((x) => x.towns.includes(t.cell)).length || 1;
      gangs += t.gangs / shared;
      members += t.members / shared;
      pull += t.pull * (t.gangs / shared);
      jailed += t.jailed / shared;
    }
    fed.gangs = Math.round(gangs);
    fed.members = Math.round(members);
    fed.strength = per(gangs > 0 ? (pull / gangs) * (1 + (cartel ? 0.2 : 0)) : 0);
    fed.jailed = Math.round(jailed);
    if (cartel) fed.supplier = cartel.id;
    else delete fed.supplier;
  }
}

// —— One realm's underworld, stepped `span` years ————————————————————————————————————————————————————————

function stepRealm(
  ctx: PopulationContext,
  p: Polity,
  v: RealmUnderworld,
  span: number,
  t: SimTime,
): boolean {
  const { world } = ctx,
    year = yearOfMoment(t),
    key = keyOf(p.ref),
    f: Facts = {
      ctx,
      p,
      v,
      t,
      year,
      key,
      u: (k: number) => world.rng.real(DRAW, key, t, k),
      opening: new Set(),
    },
    r = readRealm(ctx, p, year),
    life = ctx.life,
    fade = 1 - dmath.pow(1 - UNDER.spends, span),
    stays = 1 - fade,
    move = stepped(UNDER.pace, span);
  if (r.people <= 0) return false;

  // 1. Who can sell protection.
  const idle = violentIdle({
      veterans: r.veterans / r.people,
      young: r.young / r.people,
      idle: r.idle,
      poor: r.poor,
      street: r.street,
    }),
    pool = idle.pool * r.people;
  v.supply = per(idle.supply);
  v.pool = Math.round(pool);
  v.veterans = Math.round(r.veterans);
  // 2. The rents of what it forbids and taxes, and of a border with one that bans.
  const sm = moneyStore(world, SMUGGLE_STORE)?.get(p.ref),
    bars = moneyStore(world, BAR_STORE);
  let border = 0;
  for (const rel of diplomacyOf(world).of(p.ref)) {
    const q = rel.a === p.ref ? rel.b : rel.b === p.ref ? rel.a : null;
    if (!q) continue;
    const qb = bars?.get(q);
    if (!qb) continue;
    const qBarred = qb[BAR.barred]! / 1000,
      qWorth = qb[BAR.demand]! * (qb[BAR.price]! / 1000);
    // (A rich market that bans, carried across this border: a share of its rent, more as it is richer than this realm's own.)
    if (qBarred >= 0.5 && qWorth > r.banWorth) border += 0.25 * banRent(qWorth, qBarred, RISK);
  }
  // (And the wares the tariff and the law on intoxicants do not count: those war forbids, a house's licence holds, or arms barred to
  // its people. Each ware's wedge times what crossed unseen: money/contraband.ts. Nothing where none is kept.)
  let ware = 0,
    wareWorth = 0;
  for (const w of contrabandOf(world, p.ref))
    if (WARE_RENT_CAUSES.has(CONTRA_CAUSES[w.cause]!)) {
      ware += w.worth * w.wedge;
      // (Forbidden outright for its harm: a trade no court holds a deal in. What war or a licence keeps out is run past a border
      // or a holder, and sold in the open.)
      if (CONTRA_CAUSES[w.cause] === "harm") wareWorth += w.worth;
    }
  const ban = banRent(r.banWorth, r.barred, RISK),
    tariff = sm ? sm[SMUGGLE.worth]! * (sm[SMUGGLE.wedge]! / 1000) : 0,
    captured = rentCaptured(r.capacity, r.corruption * (1 + v.collusion / 1000)),
    smuggleRent = (ban + tariff + border + ware) * captured;
  // 2b. Who wants protection: land by land, by that land's own reach, how far its courts are trusted there, and what is traded
  // there that the law forbids. The realm's want is its lands', by their people; a group rises where its neediest land's pull does.
  const spent = Math.min(r.trade, r.earned),
    illegal = dmath.clamp((r.banWorth * r.barred + wareWorth) / Math.max(1, spent), 0, 1),
    occ = occupationOf(world),
    folk = cultureRows(world, FOLK_STORE);
  let want = 0,
    wantMost = 0,
    wantHome = p.seat;
  // (Each peopled land's people, and its want of protection by them: what a road's rent is of, land by land, in step 4.)
  const peopleIn = new Map<number, number>(),
    wantIn = new Map<number, number>(),
    bodyRows = bodyLandsStore(world);
  for (const c of [...p.members].sort((a, b) => a - b)) {
    const n = ctx.provinces.get(c)?.total() ?? 0;
    if (n <= 0) continue;
    const ow = occ?.of(c),
      here = protectionWantedIn({
        secure: r.secure,
        deals: r.deals,
        trade: r.trade,
        earned: r.earned,
        capacity: r.capacity,
        // (As its land's watch makes it, where one is kept there.)
        reach: policedIn(bodyRows, c, r.reachIn.get(c) ?? r.capacity),
        corruption: r.corruption,
        legitimacy: r.legitimacy,
        kin: (folk?.get(c)?.[FOLK_ROW.kin] ?? 1000) / 1000,
        occupied: ow && ow.holder === p.ref ? Math.max(0.2, ow.resistance) : 0,
        illegal,
      });
    want += (here * n) / r.people;
    peopleIn.set(c, n);
    wantIn.set(c, here * n);
    // (A land of some weight: a fiftieth of its people at the least.)
    if (here > wantMost && n >= r.people / 50) {
      wantMost = here;
      wantHome = c;
    }
  }
  v.want = per(want);
  // (A cut of the takings of those who pay: what passes its shops and stalls, no more than what its people earn.)
  v.protectRent = Math.round(spent * UNDER.cut * want);
  v.banRent = Math.round(ban);
  v.tariffRent = Math.round(tariff);
  v.borderRent = Math.round(border);
  if (ware > 0 || v.wareRent) v.wareRent = Math.round(ware);
  v.captured = per(captured);
  v.smuggleRent = Math.round(smuggleRent);

  // 3. The street: its towns' gangs, and its federations.
  const jails = r.writing && r.justice >= 1,
    towns = streetTowns(ctx, p, r),
    arms = dmath.clamp(
      (loreOf(world).get(p.seat, "gunpowder") ? 0.5 : 0.1) + 15 * (r.veterans / r.people),
      0,
      1,
    );
  // (Where soldiers hold its towns, many more of the young are jailed: escalation.)
  const opTowns = new Set((v.ops ?? []).filter((o) => o.ended === null).flatMap((o) => o.lands));
  for (const tw of towns)
    tw.jailed = jails
      ? Math.round(
          // (By the court of its land, as far as it reaches and is not bought, where one is kept: sim/order/institutions.ts.)
          tw.members *
            UNDER.jailed *
            (courtJailsIn(world, tw.cell) ?? r.capacity) *
            (opTowns.has(tw.cell) ? ESCALATE.jails : 1),
        )
      : 0;
  // (Ties made inside: those jailed come out bound to their gangs the more.)
  for (const tw of towns)
    if (tw.jailed > 0) tw.pull = Math.min(1, tw.pull * (1 + tw.jailed / Math.max(1, tw.members)));
  stepFederations(f, towns, jails);
  let streetKilled = 0;
  for (const tw of towns) {
    const feds = v.feds.filter((x) => x.towns.includes(tw.cell)),
      rival = feds.length >= 2 && feds.some((a) => feds.some((b) => a.rival === b.id)),
      // (How thick its gangs lie: so many to UNDER.fightTown of its people. A great town has many gangs by its size alone; it is
      // where they crowd each other that they fight.)
      fight = streetFight(
        (tw.gangs * UNDER.fightTown) / Math.max(UNDER.fightTown, tw.town),
        rival,
        arms,
        tw.informal,
        r.idle,
      );
    tw.killed = tw.members * UNDER.streetKill * fight * 1.3;
    streetKilled += tw.killed;
  }
  v.street = Math.round(streetKilled);

  // 4. The groups of each road: who rises, their shares, their men and their income.
  const roads: [GroupKind, number, number][] = [
    ["protection", v.protectRent, Math.max(want, wantMost) * idle.supply],
    ["cartel", smuggleRent, r.earned > 0 ? smuggleRent / r.earned : 0],
  ];
  // (A ban ended: a cartel whose rent no longer keeps it turns to other rackets where protection is wanted, or withers.)
  if (smuggleRent < (r.earned > 0 ? r.earned : 1) * UNDER.riseRent * 0.5)
    for (const g of v.groups)
      if (
        kindOfGroup(g) === "cartel" &&
        want >= 0.1 &&
        v.groups.filter((x) => x.kind === KIND("protection")).length < UNDER.ofRoad
      ) {
        g.kind = KIND("protection");
        g.rackets = racketBit("extortion") | racketBit("kidnapping") | racketBit("protection");
        tell(
          f,
          UNDERWORLD_EVENTS.turned.type,
          g.home,
          { group: g.name, gids: [g.id], barred: Math.round(r.barred * 100) },
          [{ ref: g.event, role: "enabler", weight: 1 }],
          [
            factor(
              "what it carried, no longer forbidden or no longer worth it",
              r.barred,
              1 - r.barred,
            ),
            factor("the want of protection", want, want),
          ],
        );
      }
  // (Each road's groups by their share of its strength, as this reckoning finds them: what a peace is worn against, step 7.)
  const stood = new Map<GroupKind, (readonly [number, number])[]>(),
    // (A group's strength in a fight for a rent: its men, its wealth against the rent, its arms and armour as last reckoned.)
    strengthOf = (g: CrimeGroup, rent: number): number =>
      dmath.pow(Math.max(1, g.members), 0.7) *
      (1 + g.wealth / Math.max(1, rent)) *
      (1 +
        (GEAR.armsFight * (g.means?.arms ?? 0)) / 1000 +
        (GEAR.armourFight * (g.means?.armour ?? 0)) / 1000);
  for (const [kind, rent, pull] of roads) {
    const own = v.groups.filter((g) => kindOfGroup(g) === kind),
      line = kind === "protection" ? UNDER.riseProtect : UNDER.riseRent,
      perGroup = rent / Math.max(1, own.length + 1),
      // (Room for another: the men the road's groups hold fall well short of what its rent would keep, or lands with towns lie
      // outside every one of them. A rent no one can hold all of draws rivals to it.)
      held = own.reduce((s, g) => s + g.members, 0),
      // (A man's keep, the dearer as the crackdown hunts him.)
      manKeep = r.wage * UNDER.keep * (1 + UNDER.hunted * (v.bites / 1000)),
      keepAll = rent / manKeep,
      taken = new Set(own.flatMap((g) => g.lands)),
      open = [...p.members].filter(
        (c) => !taken.has(c) && ctx.settlements.inProvince(c).some((s) => s.market),
      ).length,
      room = held < 0.6 * keepAll || open >= 2;
    if (
      pull >= line &&
      idle.supply > 0.05 &&
      own.length < UNDER.ofRoad &&
      v.groups.length < UNDER.most &&
      // (A rent that keeps a crew at all, and, for a second or third, room the groups already there cannot hold.)
      perGroup >= manKeep * UNDER.crew &&
      (own.length === 0 || (room && f.u(40 + KIND(kind)) < 0.5))
    ) {
      // (Its home: the weightiest land none of its road holds; a cartel's on the border where it can.)
      const free = (cs: Iterable<number>) =>
          [...cs]
            .filter((c) => !taken.has(c))
            .sort((a, b) => landWeight(ctx, b) - landWeight(ctx, a) || a - b)[0],
        home =
          (kind === "cartel"
            ? free(r.edge)
            : taken.has(wantHome) || wantMost <= want
              ? undefined
              : wantHome) ??
          free(p.members) ??
          p.seat;
      rise(
        f,
        kind,
        home,
        own.length ? 0.15 : 1,
        kind === "protection"
          ? [
              factor(
                "holdings unsafe and deals not held",
                1 - 0.5 * r.secure - 0.5 * r.deals,
                want,
              ),
              factor("men skilled in violence and idle", idle.supply, idle.supply),
              ...(r.veterans > 0
                ? [factor("a levy come home from war", r.veterans, r.veterans / r.people)]
                : []),
              factor("a seat that reaches little", r.capacity, 1 - r.capacity),
            ]
          : [
              factor("the rent of what is forbidden or taxed", ban + tariff + border, pull),
              ...(border > 0
                ? [
                    factor(
                      "a border with a rich market that bans",
                      border,
                      border / Math.max(1, ban + tariff + border),
                    ),
                  ]
                : []),
              factor("a reach too weak to hold its borders", r.capacity, 1 - r.capacity),
              factor("officers who can be bought", r.corruption, r.corruption),
            ],
      );
    }
    // (Shares move toward strength; at war they swing by the fortunes of the fight.)
    const now = v.groups.filter((g) => kindOfGroup(g) === kind);
    if (!now.length) continue;
    const strength = now.map((g) => strengthOf(g, rent)),
      sumS = strength.reduce((a, x) => a + x, 0),
      openWar = v.wars.find((w) => w.ended === null && w.kind === KIND(kind));
    stood.set(
      kind,
      now.map((g, i) => [g.id, per(strength[i]! / sumS)] as const),
    );
    let sumShare = 0;
    for (const [i, g] of now.entries()) {
      const target = strength[i]! / sumS,
        swing =
          openWar && (openWar.a === g.id || openWar.b === g.id) ? 0.3 * (f.u(60 + g.id) - 0.5) : 0;
      g.share = per(g.share / 1000 + (target - g.share / 1000) * move + swing);
      sumShare += g.share;
    }
    for (const g of now) g.share = Math.round((g.share * 1000) / Math.max(1, sumShare));
    // (What a group takes is the rent of the lands it holds: a protector's cut is paid where his men stand, a ban's rent made
    // where its wares are sold. Each land's part of the road's rent: of protection's as its want of it by its people, of a
    // cartel's as its people; where two of a road hold a land (a lesser's home beside the greater), parted as their shares are.
    // The rent of lands none of the road holds is taken by no one. Before, a group took its share of the WHOLE realm's rent
    // whatever it held, and a lesser group's men, kept by a great realm's rent, stood in the one or two lands the greater left
    // it: at UNDER.thick of their people, where its peace alone kills 12.8 in 100,000 a year.)
    const part = kind === "protection" ? wantIn : peopleIn;
    let parts = 0;
    for (const x of part.values()) parts += x;
    const holders = new Map<number, { n: number; share: number }>();
    for (const g of now)
      for (const c of g.lands) {
        const h = holders.get(c) ?? { n: 0, share: 0 };
        h.n++;
        h.share += g.share;
        holders.set(c, h);
      }
    for (const g of now) {
      let mine = 0;
      for (const c of g.lands) {
        const h = holders.get(c)!;
        mine += (part.get(c) ?? 0) * (h.share > 0 ? g.share / h.share : 1 / h.n);
      }
      const income = parts > 0 ? (rent * mine) / parts : 0,
        keepMen = income / manKeep,
        canMen = pool * UNDER.recruit * (g.share / 1000),
        // (No more than UNDER.thick of the people of the lands it holds: a lesser group's lands are what the greater left it,
        // and its men, come of its share of the whole realm's rent, were a sixth of such a land's people at the median, 38 times
        // as thick as its realm's groups among its people, and all their killing there.)
        room = UNDER.thick * g.lands.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
        // (A road no longer worth a group: its want or its rent fallen well below what one would rise for, its men drift away.)
        aim = pull < line * UNDER.withers ? 0 : Math.min(keepMen, canMen, room);
      g.members = Math.max(0, Math.round(g.members + (aim - g.members) * stepped(0.4, span)));
      g.income = Math.round(income);
    }
  }
  // (4b. What each buys of arms, armour, hidden carriage and guarded word, and what it costs it.)
  for (const g of v.groups) if (kindOfGroup(g) !== "badge") buyMeans(ctx, p, g, r, span);

  // 5. The state's answer: its crackdown and its officers bought.
  const killedBefore = (v.killings + v.street + v.badge) / r.people,
    groupIncome = v.groups.reduce((s, g) => s + g.income, 0),
    sheltering = housesShelter(world, p.ref),
    // (A watch that is not honest is bought the more readily.)
    collusionAim = Math.min(
      1,
      collusionOf(r.corruption, groupIncome / Math.max(1, r.revenue), r.word, !!sheltering) *
        (r.watch ? 1 - UNDER.crookedBuys / 2 + UNDER.crookedBuys * (1 - r.watch.honest) : 1),
    ),
    collusion = v.collusion / 1000 + (collusionAim - v.collusion / 1000) * stepped(0.3, span),
    // (What a full crackdown on the men it faces would cost, against what its treasury can spend on it.)
    facedMen = v.groups.reduce((s, g) => s + (kindOfGroup(g) === "badge" ? 0 : g.members), 0),
    afford = dmath.clamp(
      (UNDER.afford * Math.max(0, r.revenue)) / Math.max(1, facedMen * r.wage * UNDER.crackCost),
      0,
      1,
    ),
    crackAim =
      v.groups.length || v.feds.length
        ? afford *
          crackdownOf({
            // (A crackdown is its watch's to carry out: as far as that is manned and honest.)
            capacity: r.policed,
            legitimacy: r.legitimacy,
            voice: r.voice,
            word: r.word,
            killings: killedBefore * 1000,
            extortion: v.extortion / 1000,
            collusion,
          })
        : 0,
    crackdown = v.crackdown / 1000 + (crackAim - v.crackdown / 1000) * stepped(0.4, span);
  v.collusion = per(collusion);
  v.crackdown = per(crackdown);
  if (crackdown >= 0.3 && !v.crackEvent)
    v.crackEvent = tell(
      f,
      UNDERWORLD_EVENTS.crackdown.type,
      p.seat,
      { strength: Math.round(crackdown * 100), gids: v.groups.map((g) => g.id) },
      [],
      [
        factor("the seat's reach", r.capacity, r.capacity),
        ...(r.watch
          ? [
              factor(
                "its watch, manned and honest",
                r.watch.manned * r.watch.honest,
                r.policed - r.capacity,
              ),
            ]
          : []),
        factor("its rule held rightful", r.legitimacy, r.legitimacy),
        factor(
          "the killing, as far as the harmed are heard",
          killedBefore * 1000,
          2 * killedBefore * 1000 * (0.25 + r.voice + 0.5 * r.word),
        ),
        factor("officers bought", collusion, -0.8 * collusion),
      ],
    );
  // (Told once: a crackdown that slackens and returns is not news again.)
  if (collusion >= 0.4 && !v.pactEvent && v.groups.length)
    v.pactEvent = tell(
      f,
      UNDERWORLD_EVENTS.pact.type,
      p.seat,
      {
        share: Math.round(collusion * 100),
        gids: v.groups.map((g) => g.id),
        ...(sheltering ? { house: sheltering } : {}),
      },
      [],
      [
        factor("what is skimmed already", r.corruption, r.corruption),
        factor(
          "what the groups can pay",
          groupIncome / Math.max(1, r.revenue),
          groupIncome / Math.max(1, r.revenue),
        ),
        factor("word that would tell of it", r.word, -0.5 * r.word),
      ],
    );
  else if (collusion < 0.2 && v.pactEvent) v.pactEvent = null;
  // (A great house shelters the greatest group where its officers are bought.)
  const greatest = [...v.groups]
    .filter((g) => kindOfGroup(g) !== "badge")
    .sort((a, b) => b.power - a.power || a.id - b.id)[0];
  for (const g of v.groups) if (g !== greatest || collusion < 0.3 || !sheltering) delete g.house;
  if (greatest && collusion >= 0.3 && sheltering) greatest.house = sheltering;

  // 6. The badge: a crackdown under weak oversight, with a rent in reach.
  const streetMarket = towns.reduce((s, tw) => s + tw.members, 0) * r.wage * 0.5,
    within = r.earned > 0 ? (streetMarket + smuggleRent * 0.3 + v.seized) / r.earned : 0,
    // (And as its watch is honest: one paid a living and watched turns less, one bought the more.)
    bp = Math.min(
      1,
      badgePull({
        // (Soldiers sent against a group are a crackdown given licence too: under weak oversight, they abuse and turn.)
        crackdown: Math.max(crackdown, opTowns.size ? ESCALATE.bite : 0),
        voice: r.voice,
        word: r.word,
        courts: r.byCourts,
        force: r.force,
        within,
      }) * (r.watch ? 1 - UNDER.crookedTurns / 2 + UNDER.crookedTurns * (1 - r.watch.honest) : 1),
    );
  v.badgePull = per(bp);
  let badge = v.groups.find((g) => kindOfGroup(g) === "badge");
  // (A crew found out leaves its realm watching its enforcers for a while: none rises again until its scandal has faded.)
  const watched = !!v.scandal && year - v.scandal.year < UNDER.scandalYears;
  if (!badge && !watched && bp >= 0.2 && crackdown >= 0.25 && v.groups.length < UNDER.most) {
    badge =
      rise(f, "badge", p.seat, 0, [
        factor("a crackdown given licence", crackdown, crackdown),
        factor("little voice to answer to", r.voice, 1 - r.voice),
        factor("word that does not move freely", r.word, 1 - r.word),
        factor("courts that are the seat's", r.byCourts, 1 - r.byCourts),
        factor("what is seized and the street's market", within, within * 20),
        ...(r.watch
          ? [factor("a watch that is not honest", 1 - r.watch.honest, 1 - r.watch.honest)]
          : []),
      ]) ?? undefined;
  }
  // (Its enforcers: its watch's own hands where it keeps one.)
  const enforcers = r.watch ? r.watch.staff : r.people * 0.004 * r.capacity;
  if (badge) {
    badge.members = Math.round(enforcers * bp * 0.3);
    badge.income = Math.round(within * r.earned * 0.3 * bp);
    badge.share = per(bp);
    const squad = deathSquad(r.force, r.voice, crackdown);
    if (squad) {
      badge.squad = 1;
      badge.rackets = racketBit("shakedown") | racketBit("killing");
    } else {
      delete badge.squad;
      badge.rackets = racketBit("shakedown") | racketBit("protection");
    }
  }
  // (What the crackdown bites: less what its own crew sells protection from.)
  const bites = crackdown * (1 - 0.6 * (badge && !badge.squad ? bp : 0));
  v.bites = per(bites);

  // 7. Violence from structure: each road's war, or its peace.
  // (Of each group's killing, the part that is its road's war and not its peace: laid where its turf meets a rival's, writeLands.)
  let killings = 0;
  const warring = new Map<number, number>(),
    openings: [GangWar, () => Ref][] = [];
  for (const kind of ["protection", "cartel"] as const) {
    const own = v.groups.filter((g) => kindOfGroup(g) === kind);
    const hunted = huntedFor(
        bites,
        r.capacity * (COURTS[r.justice] ?? COURTS[0]) * (1 - r.corruption),
      ),
      fight = turfWar(
        own.map((g) => g.share),
        collusion,
        hunted,
      ),
      open = v.wars.find((w) => w.ended === null && w.kind === KIND(kind));
    // (A war tires: fought for years with neither winning, its groups fight less by half every UNDER.warHalf years, until it
    // is a peace; and a peace made holds, wearing off over a generation (UNDER.paxHalf) AS FAR AS THE STRENGTH IT WAS MADE ON
    // HAS MOVED SINCE (peaceWorn), before the same road is fought for again. Worn by its years alone, the five groups of a
    // great realm, each holding the eight lands a group can and none able to take another's, their shares of the road's
    // strength the same to a hundredth for sixty years, fought the same war every thirty years for nothing any could win:
    // first light's realm of forty lands in 1,519 and 1,549, its realm of thirty in 1,515, 1,545 and 1,590.)
    const last = v.wars.filter((w) => w.ended !== null && w.kind === KIND(kind)).at(-1),
      standing = stood.get(kind) ?? [],
      moved = last?.at ? balanceMoved(last.at, standing) : 1,
      // (Sooner where its seat hunts them: an open war draws all a state that reaches has. In realms with one open, a
      // fifth of the world's people at 1,500, it was eleven in 100,000 of the whole world's killed a year.)
      half = UNDER.warHalf * (1 - UNDER.cutShort * hunted),
      tired = open
        ? dmath.pow(0.5, (year - open.since) / half)
        : last
          ? peaceWorn(year - last.ended!, moved)
          : 1,
      // (And they fight over a road as hard as the part of its rent that lies where they meet: each takes the rent of the
      // lands it holds (step 4), so what a war can win is what lies in the lands two of them hold, or, where they hold none
      // in common, in their lands on each other's border: the lands its dead are laid in, writeLands. Groups whose lands
      // nowhere meet have nothing of each other's to take.)
      stake = metShare(ctx, own, kind === "protection" ? wantIn : peopleIn),
      warNow = fight.war * tired * stake,
      // (Short of a war its groups feud: a road kills as a war does only once it is fought for. Before, a strain that never came
      // to a war killed as one for good, and was most of the killing of a world at 1,500: 87% of its roads' war dead.)
      // (And a war is reckoned as it will be fought over the years this reckoning stands for, tiring through them, not as it is
      // on their first day: its realm's turn comes once in UNDER.every years, and a war told at its opening's heat for all five
      // was told half as hot again as it was fought, where its seat hunts it by half.)
      level =
        open || warNow >= UNDER.warAt
          ? warNow * tiringOver(half, UNDER.every)
          : UNDER.feud * warNow;
    // (A war's dead are its fighters': each group loses men as its rivals are many (the lesser the greater part of itself), and
    // of its purse as of its men. So a war wears both down, the weaker faster, until one holds the road or neither can fight on:
    // before, no loss came off its men and a war between two alike never ended.)
    // (And each fights the rivals it meets, not all its road's: in a realm of one land or three every group meets every other;
    // of a great realm's five, each on its own eight lands, one meets the two or three beside it, and fought the men of all.)
    const fighting = level > 0 && own.length >= 2;
    for (const g of own) {
      let met = 0;
      if (fighting)
        for (const x of own)
          if (x !== g && meetingLands(ctx.generated.grid, g, x).length) met += x.members;
      const calm = v.truce?.gid === g.id ? 1 - ESCALATE.calms : 1,
        rivals = Math.min(met, g.members * UNDER.warMost),
        peace = killingsOf(g.members, 0) * calm,
        war = (killingsOf(rivals, level) - killingsOf(rivals, 0)) * calm,
        dead = Math.min(g.members, Math.round((war / (1 + UNDER.bystanders)) * span));
      g.violence = Math.round(peace + war);
      killings += g.violence;
      warring.set(g.id, g.violence - Math.min(g.violence, Math.round(peace)));
      if (dead > 0) {
        g.wealth = Math.round(g.wealth * (1 - dead / g.members));
        g.members -= dead;
      }
    }
    const ranked = [...own].sort((a, b) => b.share - a.share || a.id - b.id),
      // (What a war has killed: its two groups' killing through the years this reckoning stands for, its last years too. A
      // peace told the dead of all its reckonings but the one it was made in.)
      deadNow = (w: GangWar): number =>
        own.filter((g) => g.id === w.a || g.id === w.b).reduce((s, g) => s + g.violence, 0) * span;
    if (open) open.fallen += deadNow(open);
    // (A war lost: of the two that went to war, the one whose men, or whose weight on the road as the fortunes of the fight
    // have swung it, have fallen under UNDER.beaten of the other's is taken over: its lands, its wealth and the men it has
    // left are the victor's, and the war is over. Weighed at every reckoning of a war, ITS LAST TOO: weighed only where the
    // war went on, it was never asked of the wars that tired at their first reckoning, and of 132 opened in a century of
    // first light 56 ended in a peace told as nothing changed, the lesser of the two at 0.40 of the greater's weight and 0.39
    // of its men at the median (uww.mts), 15 in a takeover.)
    const wa = open && own.find((g) => g.id === open.a),
      wb = open && own.find((g) => g.id === open.b),
      [won, lost] =
        wa && wb
          ? wa.share > wb.share || (wa.share === wb.share && wa.members >= wb.members)
            ? [wa, wb]
            : [wb, wa]
          : [undefined, undefined],
      beaten =
        !!won &&
        !!lost &&
        won.since < year &&
        lost.since < year &&
        (lost.share < UNDER.beaten * won.share || lost.members < UNDER.beaten * won.members);
    if (!open && warNow >= UNDER.warAt && ranked.length >= 2) {
      const [a, b] = ranked as [CrimeGroup, CrimeGroup];
      // (Told at the reckoning's end, if both still stand then: Facts.opening.)
      const say = (): Ref =>
        tell(
          f,
          UNDERWORLD_EVENTS.war.type,
          a.home,
          { group: a.name, against: b.name, kind, gids: [a.id, b.id] },
          [
            { ref: a.event, role: "enabler", weight: 1 },
            { ref: b.event, role: "enabler", weight: 1 },
          ],
          [
            factor("two close in strength over one rent", b.share / Math.max(1, a.share), warNow),
            factor("the rent that lies where they meet", stake, stake),
            factor("a market no one group holds", 1 - fight.herfindahl, 1 - fight.herfindahl),
            factor("a pact with the state", collusion, -UNDER.pax * collusion),
            ...(last?.at
              ? [factor("strength changed hands since their last peace", moved, tired)]
              : []),
          ],
        );
      v.wars = [
        ...v.wars,
        {
          a: a.id,
          b: b.id,
          names: [a.name, b.name] as const,
          kind: KIND(kind),
          since: year,
          // (Until it is told, the rise of the one that opened it.)
          event: a.event,
          ended: null,
          fallen: 0,
        },
      ].slice(-UNDER.wars);
      const made = v.wars.at(-1)!;
      made.fallen += deadNow(made);
      f.opening.add(made);
      openings.push([made, say]);
    } else if (open && beaten && won && lost) {
      // (The victor takes of the beaten what it can hold: of its lands, as many as a group holds (UNDER.lands), and with them
      // the men who stand there (a group's men are of the people where it holds: by the people of each land); and of those
      // men as many as its own lands with the lands taken can keep (UNDER.thick of their people, the most a group's men come
      // to be of the people where it stands). The men past that are not the victor's: a crew's worth and more of them follow
      // one of their own, a splinter of the beaten in a land of its that the victor did not take, or its home; fewer
      // scatter. The beaten went whole to the victor, lands to keep its men on or none. Measured (us.mts, usx.mts, a century
      // of first light from 1,500 and of tide 207 from 1,000): the victor CAN hold nearly always: its men are 4 in 100 of
      // what its lands could keep at the median and 18 at the ninth tenth, 6 and 20 with the beaten's; the beaten holds one
      // land, the victor's own, in nine takeovers of ten (most are in realms of one land); a land is left untaken in 4 of
      // 72. So the density cap parted none of 40 and none of 18, and the lands part the few.)
      const had = lost.members,
        weight = lost.share / Math.max(1, won.share),
        wonMen = won.members,
        lands = [...won.lands];
      for (const c of lost.lands)
        if (!lands.includes(c) && lands.length < UNDER.lands) lands.push(c);
      const peopleOf = (cs: readonly number[]) =>
          cs.reduce((n, c) => n + (ctx.provinces.get(c)?.total() ?? 0), 0),
        untaken = lost.lands.filter((c) => !lands.includes(c)),
        theirs = peopleOf(lost.lands),
        // (Those who stand in the lands not taken.)
        stay = untaken.length && theirs > 0 ? Math.round((had * peopleOf(untaken)) / theirs) : 0,
        room = UNDER.thick * peopleOf(lands),
        split = takeoverMen(wonMen, had - stay, room),
        men = split.taken,
        rest = stay + split.rest,
        part = had > 0 ? men / had : 1,
        // (The beaten's own place among the realm's groups is freed by its end.)
        splinter =
          rest >= UNDER.crew && v.groups.length - 1 < UNDER.most
            ? rise(
                f,
                kind,
                untaken[0] ?? lost.home,
                ((1 - part) * lost.share) / 1000,
                [
                  factor("men of the beaten past what the victor's lands could keep", rest, 1),
                  factor("lands of the beaten the victor did not take", untaken.length, 1),
                ],
                lost,
                open.event,
              )
            : null;
      if (splinter) {
        splinter.members = rest;
        splinter.wealth = Math.round(lost.wealth * (1 - part));
        splinter.lands = [...untaken];
        if (!splinter.lands.length) splinter.lands = [splinter.home];
      }
      won.share = Math.min(1000, won.share + lost.share - (splinter?.share ?? 0));
      won.members += men;
      won.wealth += splinter ? lost.wealth - splinter.wealth : lost.wealth;
      won.lands = lands;
      ended(
        f,
        lost,
        "taken over",
        [
          factor("its men against the victor's", had / Math.max(1, wonMen), 1),
          factor("its weight on their road against the victor's", weight, 1),
          factor("the years of their war", year - open.since, 1),
        ],
        won,
        UNDERWORLD_EVENTS.ended.type,
        {
          fallen: Math.round(open.fallen),
          warSince: open.since,
          men,
          ...(rest > 0 ? { rest } : {}),
          ...(splinter ? { splinter: splinter.name } : {}),
        },
        TOLD,
        [{ ref: open.event, role: "trigger", weight: 1 }],
      );
      // (And the road's strength as the takeover left it is what its peace rests on, as a peace made is: it wore by its years
      // alone, whoever stood as the war had left them.)
      const rent = roads.find((x) => x[0] === kind)![1],
        after = [...own.filter((g) => g !== lost), ...(splinter ? [splinter] : [])],
        left = after.map((g) => strengthOf(g, rent)),
        all = left.reduce((s, x) => s + x, 0);
      if (all > 0) open.at = after.map((g, i) => [g.id, per(left[i]! / all)] as const);
    } else if (open && warNow < UNDER.warEnds) {
      // (A war tired out with neither beaten ends in a peace: the rent they fought over parted at the strength each has LEFT,
      // its dead and what they cost it off. The peace was kept as made on the strength this reckoning found them at, before
      // its dead, so a peace was born part worn by its own war's last losses, balanceMoved reading them as strength changed
      // hands since. Their lands are parted again by the men each has left at every reckoning, step 10: the side that lost
      // the more holds the fewer. Measured against the peace kept as before (uwc-u14-*.log, uwc-u15-*.log: land-years at ten
      // killed in 100,000 on the four windows 10.7, 7.6, 6.6, 5.1% and 10.5, 8.3, 6.8, 5.1%): no more killing either way.)
      const rent = roads.find((x) => x[0] === kind)![1],
        left = own.map((g) => strengthOf(g, rent)),
        all = left.reduce((s, x) => s + x, 0);
      open.ended = year;
      open.how = "peace";
      open.at = all > 0 ? own.map((g, i) => [g.id, per(left[i]! / all)] as const) : standing;
      // (Of what the two could bring to a fight now, the greater's part: what the peace is told by.)
      const sa = wa ? strengthOf(wa, rent) : 0,
        sb = wb ? strengthOf(wb, rent) : 0,
        [first, second] = sa >= sb ? [wa, wb] : [wb, wa],
        holder = first || ranked[0];
      tell(
        f,
        UNDERWORLD_EVENTS.pax.type,
        holder?.home ?? p.seat,
        {
          group: holder?.name ?? open.names[0],
          kind,
          gids: [open.a, open.b],
          fallen: Math.round(open.fallen),
          ...(first && second
            ? {
                against: second.name,
                holds: Math.round((100 * Math.max(sa, sb)) / Math.max(1e-9, sa + sb)),
                men: [first.members, second.members],
              }
            : {}),
          warSince: open.since,
          ...(collusion >= 0.4 ? { pact: 1 } : {}),
        },
        [{ ref: open.event, role: "trigger", weight: 1 }],
        [
          factor("a war fought to a stand, neither beaten", warNow, 1 - warNow),
          factor("one group holding the rent", fight.herfindahl, fight.herfindahl),
          factor("a pact with the state", collusion, UNDER.pax * collusion),
        ],
        // (The chronicle carried its opening: it carries its end.)
        TOLD,
      );
    }
  }
  v.badge = badge ? Math.round(badge.members * (badge.squad ? 0.25 * crackdown : 0.01)) : 0;
  if (badge) badge.violence = v.badge;
  // 7b. Escalation: soldiers sent against the strongest group, a pact, or leaving it be; and what each operation does.
  const opBite = stepOps(f, r, span, killings + v.street + v.badge, collusion);
  for (const g of v.groups) if (opBite.has(g.id)) killings += opBite.get(g.id)!.dead;
  v.killings = Math.round(killings);

  // 8. What the crackdown takes, and costs; bosses taken and dead.
  const bitesAll = bites;
  let seized = 0;
  const gone: [CrimeGroup, GroupEnd, Factor[], CrimeGroup?][] = [];
  for (const g of [...v.groups]) {
    if (!v.groups.includes(g)) continue;
    const kind = kindOfGroup(g),
      // (Soldiers sent against it bite the harder.)
      op = opBite.get(g.id),
      bites = Math.max(bitesAll, op ? ESCALATE.bite : 0),
      // (Officers bought, a house's shelter, and its guarded word keep its boss from being taken.)
      shelter =
        1 -
        (1 - Math.max(collusion, g.house ? 0.6 : 0)) *
          (1 - (GEAR.guards * (g.means?.word ?? 0)) / 1000),
      armed = ((g.means?.arms ?? 0) + (g.means?.armour ?? 0)) / 2000;
    if (kind !== "badge") {
      const taken =
        (1 - dmath.pow(1 - UNDER.arrests * bites * (1 - 0.7 * shelter), span)) *
        (1 - GEAR.againstCrackdown * armed);
      // (Its boss blessed, the crackdown takes half as much of it; cursed, twice. Exactly as ever where none holds.)
      const by = hazardBy(world, bossRef(p.ref, g.event), g.boss.name, year),
        bit = by === 1 ? taken : Math.min(1, taken * by);
      g.members = Math.round(g.members * (1 - bit));
      const lost = g.wealth * 0.4 * bit;
      seized += lost;
      g.wealth = Math.round(g.wealth - lost);
      g.bribes = Math.round(g.income * UNDER.bribes * collusion);
      g.wealth = Math.round(
        g.wealth * stays + (Math.max(0, g.income - g.bribes) * fade) / UNDER.spends,
      );
    } else g.wealth = Math.round(g.wealth * stays + (g.income * fade) / UNDER.spends);
    // (A boss taken by the crackdown: his lieutenants split what he held, each a boss of his own.)
    // (A boss blessed is taken half as often, cursed twice; one the god protects is not taken. Exactly as ever where none holds.)
    const head = bossRef(p.ref, g.event),
      byTaken = hazardBy(world, head, g.boss.name, year),
      takenChance =
        byTaken === 1 ? bossTaken(bites, shelter, span) : bossTaken(bites, shelter, span) * byTaken,
      guard =
        kind !== "badge" && f.u(100 + g.id * 8) < takenChance
          ? actOn(world, head, g.boss.name, year, "protect")
          : null;
    if (guard)
      sparedBy(world, guard, p.ref, f.ctx.provinces.get(g.home)?.ref ?? null, { group: g.name });
    if (kind !== "badge" && !guard && f.u(100 + g.id * 8) < takenChance) {
      const n = successorsOf(g.members, f.u(101 + g.id * 8)),
        event = tell(
          f,
          op ? UNDERWORLD_EVENTS.armyTook.type : UNDERWORLD_EVENTS.decapitated.type,
          g.home,
          {
            group: g.name,
            kind,
            gids: [g.id],
            boss: g.boss.name,
            successors: n,
            ...(op ? { oids: [op.op.id] } : {}),
          },
          [
            { ref: g.event, role: "enabler", weight: 1 },
            ...(op
              ? [{ ref: op.op.event, role: "trigger" as const, weight: 1 }]
              : v.crackEvent
                ? [{ ref: v.crackEvent, role: "trigger" as const, weight: 1 }]
                : []),
          ],
          [
            factor("the crackdown, as it bites", bites, bites),
            factor("shelter from officers and houses", shelter, -0.7 * shelter),
          ],
          // (A great organisation's boss taken is told as the chronicle tells; a small crew's goes with the ordinary years unless
          // something cites it: kept whole, bosses taken were 59,000 of first light's events at 1500, 148 a year.)
          g.share >= UNDER.great ? undefined : 3,
        );
      // (How he went, for his page: a reading beside the world, sim/hand/deaths.ts.)
      deathNotesOf(world)?.addHead({
        ref: head,
        name: g.boss.name,
        year,
        age: year - g.boss.born,
        how: "taken",
        chance: takenChance,
        draw: f.u(100 + g.id * 8),
        event,
      });
      // (Taken by the realm's hand: brought before the court of his land, where it keeps one. sim/order/deeds.ts.)
      sentence(
        ctx,
        p,
        g.home,
        {
          name: g.boss.name,
          what: `boss of the ${g.name} ${kind === "cartel" ? "cartel" : "family"}`,
          ref: head,
          charge:
            kind === "cartel" ? "carrying what is forbidden" : "what was taken for protection",
          grave: 0.6,
          purse: true,
        },
        event,
        t,
        20_000 + g.id,
      );
      g.boss = newBoss(f, g.home, kind === "protection" ? g.name : null, g.id * 31 + g.bosses);
      g.bosses++;
      if (op) op.op.bosses++;
      for (let k = 1; k < n && v.groups.length < UNDER.most; k++) {
        const part = 1 / n,
          home = g.lands[k] ?? g.home,
          s = rise(
            f,
            kind,
            home,
            (g.share / 1000) * part,
            [factor("a boss taken, his lieutenants each for himself", n, 1)],
            g,
            event,
          );
        if (!s) continue;
        s.members = Math.round(g.members * part);
        s.wealth = Math.round(g.wealth * part);
        s.lands = g.lands.filter((_, i) => i % n === k);
        if (!s.lands.length) s.lands = [home];
        g.members = Math.round(g.members - s.members);
        g.wealth = Math.round(g.wealth - s.wealth);
        g.share = Math.round(g.share - s.share);
        g.lands = g.lands.filter((_, i) => i % n !== k);
        if (!g.lands.length) g.lands = [g.home];
      }
      continue;
    }
    // (A boss dead of his years: another in his place.)
    const age = year - g.boss.born,
      bossBy = hazardBy(world, head, g.boss.name, year),
      bossYears = diesWithin(life, age, span),
      bossChance = bossBy === 1 ? bossYears : Math.min(1, bossYears * bossBy),
      bossSmite = actOn(world, head, g.boss.name, year, "smite");
    if (f.u(102 + g.id * 8) < bossChance || bossSmite) {
      // (Kept, not told: a boss dead of his years is no news. Kept beside the world for his page, sim/hand/deaths.ts.)
      const struck = bossSmite
        ? struckBy(world, bossSmite, p.ref, f.ctx.provinces.get(g.home)?.ref ?? null, {
            group: g.name,
          })
        : null;
      deathNotesOf(world)?.addHead({
        ref: head,
        name: g.boss.name,
        year,
        age,
        how: struck ? "struck" : "years",
        years: bossYears,
        chance: bossChance,
        draw: f.u(102 + g.id * 8),
        ...(struck ? { event: struck } : {}),
      });
      g.boss = newBoss(f, g.home, kind === "protection" ? g.name : null, g.id * 37 + g.bosses);
      g.bosses++;
    }
    // (A group falls from the named: crushed by the crackdown, outgrown by its rival, or withered with its rent.)
    if (kind === "badge") continue;
    const rivals = v.groups
      .filter((x) => x !== g && x.kind === g.kind)
      .sort((a, b) => b.share - a.share || a.id - b.id);
    if (g.since < year && (g.share / 1000 < UNDER.least || g.members < UNDER.crew / 2)) {
      const how: GroupEnd =
        bites >= 0.3
          ? "crushed"
          : rivals[0] && g.share / 1000 < UNDER.least
            ? "absorbed"
            : "withered";
      gone.push([
        g,
        how,
        [
          factor("its share of the rent", g.share / 1000, -(g.share / 1000)),
          factor("its men", g.members, -1),
          ...(how === "crushed" ? [factor("the crackdown, as it bites", bites, bites)] : []),
        ],
        how === "absorbed" ? rivals[0] : undefined,
      ]);
    }
  }
  for (const [g, how, factors, into] of gone) {
    if (!v.groups.includes(g)) continue;
    if (into) {
      into.share = Math.min(1000, into.share + g.share);
      into.members += g.members;
      into.wealth += g.wealth;
      for (const c of g.lands)
        if (!into.lands.includes(c) && into.lands.length < UNDER.lands) into.lands.push(c);
    }
    ended(f, g, how, factors, into);
  }
  settleOps(f);
  const groupMen =
      v.groups.reduce((s, g) => s + (kindOfGroup(g) === "badge" ? 0 : g.members), 0) +
      towns.reduce((s, tw) => s + tw.members, 0) * 0.2,
    // (The better its groups are armed, the more a crackdown costs: the security dilemma.)
    armedMost = Math.max(0, ...v.groups.map((g) => (g.means?.arms ?? 0) / 1000)),
    cost = crackdown * groupMen * r.wage * UNDER.crackCost * (1 + GEAR.dilemma * armedMost);
  v.cost = Math.round(cost);
  v.seized = Math.round(seized / span);
  treasuryPays(world, p.ref, cost * span - seized);

  // 9. A badge crew found out: purged and reformed, or kept by impunity.
  if (badge && badge.since < year) {
    const chance = exposedWithin(
      {
        word: r.word,
        courts: r.byCourts,
        rival: housesRead(world, p.ref)?.rival ?? 0,
        killings: (v.badge / r.people) * 1000,
      },
      span,
    );
    if (f.u(200) < chance) {
      const ev = ended(
        f,
        badge,
        "exposed",
        [
          factor("word that moves freely", r.word, r.word),
          factor("courts that stand apart", r.byCourts, r.byCourts),
          factor(
            "a rival house to use it",
            housesRead(world, p.ref)?.rival ?? 0,
            housesRead(world, p.ref)?.rival ?? 0,
          ),
          factor("the killing it left", v.badge, (v.badge / r.people) * 2000),
        ],
        undefined,
        UNDERWORLD_EVENTS.exposed.type,
        { squad: badge.squad ?? 0, killed: v.badge },
      );
      v.scandal = { year, event: ev };
      v.badge = 0;
      badge = undefined;
    }
  }

  // (The wars opened in this reckoning whose two groups both stand: told now. Facts.opening.)
  for (const [w, say] of openings) if (f.opening.delete(w) && w.ended === null) w.event = say();

  // 10. Territory, power, and the lands' rows.
  const allMen = Math.max(
      1,
      v.groups.reduce((s, g) => s + g.members, 0),
    ),
    allWealth = Math.max(
      1,
      v.groups.reduce((s, g) => s + g.wealth, 0),
    );
  for (const g of v.groups)
    g.power = per(0.6 * (g.members / allMen) + 0.4 * (g.wealth / allWealth));
  // (Turf is parted: the strongest of a road takes its lands first, and a lesser holds what no greater of its road does, and its
  // home. Where there is no land free it holds its home beside the greater, and that land is the one they fight over.)
  // (And a group's lands are its home and what its men take going out from it: of the free lands that lie beside those it
  // holds, the weightiest, one after another; where none lies beside (a sea between), the free land nearest its home. It took
  // the weightiest free lands of the whole realm, wherever they lay, and kept them: the five groups of a great realm, eight
  // lands each, lay through one another from end to end of it, three quarters of all they held on a rival's border
  // (metShare), each meeting every other, and its roads stood at the line of a war for good. About their homes, they meet
  // along a few lands.)
  const grid = ctx.generated.grid,
    where = grid.positions,
    // (A land on another world lies past every land of this one, and beside none.)
    onGlobe = (c: number) => 3 * c + 2 < where.length,
    turf = new Map<number, Set<number>>();
  for (const g of [...v.groups].sort((a, b) => b.power - a.power || a.id - b.id)) {
    if (kindOfGroup(g) === "badge") continue;
    const held = turf.get(g.kind) ?? turf.set(g.kind, new Set()).get(g.kind)!,
      n = Math.max(1, Math.min(UNDER.lands, 1 + Math.floor(g.members / 150))),
      free = new Set(p.members.filter((c) => c !== g.home && !held.has(c))),
      mine = p.members.includes(g.home) ? [g.home] : [],
      near = (c: number) =>
        onGlobe(c) && onGlobe(g.home)
          ? where[3 * c]! * where[3 * g.home]! +
            where[3 * c + 1]! * where[3 * g.home + 1]! +
            where[3 * c + 2]! * where[3 * g.home + 2]!
          : -2;
    while (mine.length < n && free.size) {
      let next = -1,
        most = -Infinity;
      for (const c of mine) {
        if (!onGlobe(c)) continue;
        for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++) {
          const q = grid.neighbours[k]!;
          if (!free.has(q)) continue;
          const w = landWeight(ctx, q);
          if (w > most || (w === most && q < next)) {
            next = q;
            most = w;
          }
        }
      }
      if (next < 0)
        for (const c of free) {
          const d = near(c);
          if (d > most || (d === most && c < next)) {
            next = c;
            most = d;
          }
        }
      mine.push(next);
      free.delete(next);
    }
    g.lands = mine;
    if (!g.lands.length) g.lands = [p.members.includes(g.home) ? g.home : p.seat];
    for (const c of g.lands) held.add(c);
  }
  writeLands(ctx, p, v, towns, r, badge, bites, warring, year);
  // 11. Those who hunt and tell of them, struck at (sim/order/deeds.ts): as far as its groups are hunted and its officers are
  // not bought, and a free voice tells of them where they live.
  const huntedBy = DEED.hunted * dmath.clamp(bites * (1 - collusion), 0, 1);
  for (const g of v.groups) {
    if (kindOfGroup(g) === "badge" || g.since >= year || g.members < UNDER.crew) continue;
    const toldBy = Math.min(
      1,
      (2 * (bodyLandsStore(world)?.at(g.home, BODY_ROW.word) ?? 0)) / 1000,
    );
    if (huntedBy <= 0 && toldBy <= 0) continue;
    const will = 0.75 * huntedBy + 0.25 * toldBy;
    if (will < DEED.willLeast) continue;
    const hit = strikes(
      ctx,
      p,
      {
        crime: true,
        id: g.id,
        will,
        members: g.members,
        striker: () => ({
          crime: true,
          id: g.id,
          name: g.name,
          kind: kindOfGroup(g),
          event: g.event,
          lands: g.lands,
          members: g.members,
          armed: true,
          hidden: true,
          identity: "",
          against: CRIME_AGAINST.map(([at, share]) => ({
            at,
            weight: share * (at.who === "head" && at.does === "word" ? toldBy : huntedBy),
          })),
        }),
      },
      { pressed: bites, capacity: r.capacity, crew: UNDER.crew, span },
      t,
    );
    if (hit) g.members = Math.max(0, g.members - hit.lost);
  }
  v.last = year;
  return towns.length > 0 || crackdown > 0.01;
}

/**
 * The lands a group meets a rival of its road in: those both hold; where they hold none in common, its own lands that lie on
 * one of the rival's. None where their lands nowhere touch: such groups have nothing of each other's to take.
 */
function meetingLands(
  grid: PopulationContext["generated"]["grid"],
  g: CrimeGroup,
  x: CrimeGroup,
): number[] {
  const shared = g.lands.filter((c) => x.lands.includes(c));
  if (shared.length) return shared;
  return g.lands.filter((c) => {
    for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++)
      if (x.lands.includes(grid.neighbours[k]!)) return true;
    return false;
  });
}

/**
 * Of the rent of the lands a road's groups hold, the part that lies where they meet (0 … 1): in the lands two of them hold; for a
 * group that holds none in common with a rival, in its lands beside a rival's. `part`: each land's part of the road's rent.
 */
function metShare(
  ctx: PopulationContext,
  own: readonly CrimeGroup[],
  part: ReadonlyMap<number, number>,
): number {
  if (own.length < 2) return 0;
  const grid = ctx.generated.grid,
    holders = new Map<number, number>();
  for (const g of own) for (const c of g.lands) holders.set(c, (holders.get(c) ?? 0) + 1);
  const met = new Set<number>();
  for (const g of own) {
    const shared = g.lands.filter((c) => holders.get(c)! > 1);
    if (shared.length) for (const c of shared) met.add(c);
    else
      for (const c of g.lands)
        for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++) {
          const q = grid.neighbours[k]!;
          if (holders.has(q) && !g.lands.includes(q)) {
            met.add(c);
            break;
          }
        }
  }
  let all = 0,
    theirs = 0;
  for (const c of holders.keys()) {
    const x = part.get(c) ?? 0;
    all += x;
    if (met.has(c)) theirs += x;
  }
  return all > 0 ? theirs / all : 0;
}

// —— Escalation ——————————————————————————————————————————————————————————————————————————————————————————

type OpBite = Map<number, { op: Operation; dead: number }>;

/** An operation's end: told (or told by the event given), kept among the few remembered. */
function endOp(f: Facts, o: Operation, how: string, data: Record<string, unknown>, by?: Ref): void {
  o.ended = f.year;
  o.how = how;
  o.endEvent =
    by ??
    tell(
      f,
      how === "truce"
        ? UNDERWORLD_EVENTS.truce.type
        : how === "terms"
          ? UNDERWORLD_EVENTS.disarmed.type
          : UNDERWORLD_EVENTS.withdrew.type,
      o.lands[0] ?? f.p.seat,
      {
        group: o.name,
        kind: GROUP_KINDS[o.kind] ?? "protection",
        gids: [o.target],
        oids: [o.id],
        how,
        fallen: Math.round(o.fallen),
        taken: Math.round(o.taken),
        ...data,
      },
      [{ ref: o.event, role: "trigger", weight: 1 }],
    );
}

/**
 * Each operation under way, stepped `span` years: its soldiers fight the group's men by their arms, its dead and the others killed,
 * the people driven from their homes, its cost; it ends in withdrawal (a war abroad, a treasury spent), bought off (a group richer
 * than the state), terms (a group too weak to go on), or a truce (a war of attrition that has not broken it). Where none is under
 * way and no truce holds, the seat weighs sending soldiers against its strongest group, a pact, or leaving it be. Returns, for
 * each group fought, the operation and those killed a year in its fighting.
 */
function stepOps(f: Facts, r: Read, span: number, killedNow: number, collusion: number): OpBite {
  const { ctx, p, v, year } = f,
    world = ctx.world,
    out: OpBite = new Map(),
    ops = v.ops ?? [],
    reserve = moneyStore(world, TREASURY_STORE)?.at(p.ref, FISC.reserve) ?? 0,
    atWar = warsOf(world).fighting(p.ref).length > 0,
    held = (g: CrimeGroup) => ((g.means?.arms ?? 0) + (g.means?.armour ?? 0)) / 2000,
    // (A group's armed men, by their arms; the police its seat can send against them.)
    armedOf = (g: CrimeGroup) => g.members * (1 + 2 * held(g)),
    policeOf = (x: Read) => (x.people * ESCALATE.police * x.capacity) / 1000;
  if (v.truce && year >= v.truce.until) delete v.truce;
  // (A truce made known: by free word, in the years it holds.)
  if (v.truce && v.truce.known === undefined && f.u(300) < 1 - dmath.pow(1 - 0.3 * r.word, span))
    v.truce.known = year;
  const best = ops.some((o) => o.ended === null) ? bestMeans(ctx, p, p.seat).arms : 0;
  for (const o of ops) {
    if (o.ended !== null) continue;
    const g = v.groups.find((x) => x.id === o.target);
    if (!g) continue;
    const yearCost = o.soldiers * r.wage * ESCALATE.cost;
    if (atWar || reserve < yearCost * span) {
      endOp(f, o, "withdrew", { why: atWar ? "a war abroad" : "a treasury spent" });
      continue;
    }
    // (A group richer than the state's purse, its revenue and what its treasury keeps, buys the operation off.)
    if (g.wealth >= r.revenue * ESCALATE.buys + 0.5 * reserve) {
      endOp(f, o, "bought", {});
      v.collusion = per(collusion + 0.2);
      continue;
    }
    if (g.members < o.soldiers * ESCALATE.terms) {
      const ev = ended(
        f,
        g,
        "disarmed",
        [
          factor("its men against the soldiers sent", g.members / Math.max(1, o.soldiers), 1),
          factor("the soldiers sent", o.soldiers, 1),
        ],
        undefined,
        UNDERWORLD_EVENTS.disarmed.type,
        { oids: [o.id] },
        // (A group that ruled its trade laying down its arms is told as the chronicle tells; a lesser one's with the ordinary years.)
        g.share >= UNDER.great ? TOLD : undefined,
      );
      endOp(f, o, "terms", {}, ev);
      continue;
    }
    if (year - o.since >= ESCALATE.attrition && g.members >= o.soldiers * 0.5) {
      endOp(f, o, "truce", {});
      v.truce = {
        gid: g.id,
        name: g.name,
        since: year,
        until: year + ESCALATE.truce,
        event: o.endEvent!,
      };
      continue;
    }
    // (The fighting: raids and clashes, the group's men taken or killed, the soldiers' dead, those caught between.)
    const odds = fightOdds(o.soldiers, best, g.members, held(g)),
      taken = g.members * (1 - dmath.pow(1 - odds.taken, span)),
      lost = o.soldiers * (1 - dmath.pow(1 - odds.lost, span)),
      by = taken * ESCALATE.killed * ESCALATE.bystanders,
      dead = taken * ESCALATE.killed + lost + by;
    g.members = Math.max(0, Math.round(g.members - taken));
    o.taken += taken;
    o.fallen += lost;
    o.bystanders += by;
    o.spent += yearCost * span;
    treasuryPays(world, p.ref, yearCost * span);
    // (Those driven from their homes in its lands: on its towns' streets, sim/society roofless.)
    let displaced = 0;
    const roof = societyStore(world, ROOFLESS_STORE);
    for (const c of o.lands) {
      const n = ctx.provinces.get(c)?.total() ?? 0,
        d = n * ESCALATE.displaced * Math.min(1, span / UNDER.every);
      displaced += d;
      const row = roof?.get(c);
      if (roof && row && row[ROOF_ROW.town]! > 0) {
        const next = [...row];
        next[ROOF_ROW.displaced] = row[ROOF_ROW.displaced]! + (1000 * d) / row[ROOF_ROW.town]!;
        roof.set(c, next);
      }
    }
    o.displaced += displaced;
    g.violence += Math.round(dead / span);
    out.set(g.id, { op: o, dead: dead / span });
    // (A group broken to what its police can meet is no longer the soldiers' to fight: they go home.)
    const broken = armedOf(g) <= policeOf(r);
    if (dead >= 1) {
      o.clashes++;
      tell(
        f,
        UNDERWORLD_EVENTS.clash.type,
        g.lands[0] ?? g.home,
        {
          group: g.name,
          kind: kindOfGroup(g),
          gids: [g.id],
          oids: [o.id],
          dead: Math.round(dead),
          soldiers: Math.round(lost),
        },
        [{ ref: o.event, role: "trigger", weight: 1 }],
      );
    }
    // (And one broken whose boss they have taken is put down: no head, and no men its police cannot meet. Its lands are free
    // of it; the operation ends with it (settleOps). Broken with its boss at large, it stands, and the soldiers go home.)
    if (broken && o.bosses > 0)
      ended(
        f,
        g,
        "put down",
        [
          factor(
            "its armed men against the seat's police",
            armedOf(g) / Math.max(1, policeOf(r)),
            1,
          ),
          factor("its bosses taken by the soldiers", o.bosses, 1),
        ],
        undefined,
        UNDERWORLD_EVENTS.ended.type,
        { oids: [o.id], taken: Math.round(o.taken) },
        g.share >= UNDER.great ? TOLD : undefined,
        [{ ref: o.event, role: "trigger", weight: 1 }],
      );
    else if (broken) endOp(f, o, "withdrew", { why: "a group broken to what its police can meet" });
  }
  // (A new weighing, where no operation is under way and no truce holds.)
  // (Not again for a while after one has ended: a seat does not send its soldiers back at once.)
  if (!ops.some((o) => o.ended === null || year - o.ended < ESCALATE.rest) && !v.truce) {
    const target = [...v.groups]
      .filter((g) => kindOfGroup(g) !== "badge" && g.members >= UNDER.crew)
      .sort((a, b) => b.members * (1 + held(b)) - a.members * (1 + held(a)) || a.id - b.id)[0];
    if (target) {
      const police = policeOf(r),
        armed = armedOf(target),
        host = fieldedOf(ctx, p),
        soldiers = Math.round(
          Math.min(host * ESCALATE.hostShare, target.members * ESCALATE.perMan),
        ),
        yearCost = soldiers * r.wage * ESCALATE.cost,
        arms = bestMeans(ctx, p, p.seat).arms,
        w = escalation({
          outmatch: armed / Math.max(1, police),
          match: (soldiers * (0.5 + arms)) / Math.max(1, target.members * (0.5 + held(target))),
          killings: (killedNow / r.people) * 1000,
          defies: target.lands.includes(p.seat),
          afford: yearCost > 0 ? reserve / (yearCost * UNDER.every) : 0,
          atWar,
          legitimacy: r.legitimacy,
          force: r.force,
          corruption: r.corruption,
          paying: target.income / Math.max(1, r.revenue),
        });
      // (Only with the treasury to keep them there a while.)
      if (
        w.army > w.pact &&
        w.army > w.leave &&
        soldiers >= UNDER.crew &&
        reserve >= yearCost * UNDER.every
      ) {
        const id = v.next++,
          event = tell(
            f,
            UNDERWORLD_EVENTS.operation.type,
            target.lands[0] ?? target.home,
            {
              group: target.name,
              kind: kindOfGroup(target),
              gids: [target.id],
              oids: [id],
              soldiers,
            },
            [{ ref: target.event, role: "pressure", weight: 1 }],
            w.parts.map(([name, x]) => factor(name, x, x)),
          ),
          o: Operation = {
            id,
            target: target.id,
            name: target.name,
            kind: target.kind,
            lands: [...target.lands],
            since: year,
            event,
            soldiers,
            fallen: 0,
            taken: 0,
            bystanders: 0,
            displaced: 0,
            spent: 0,
            bosses: 0,
            clashes: 0,
            ended: null,
          };
        ops.push(o);
        out.set(target.id, { op: o, dead: 0 });
      } else if (w.pact > w.army && w.pact > w.leave)
        // (A pact chosen: its officers the more bought.)
        v.collusion = per(collusion + 0.1);
    }
  }
  const live = ops.filter((o) => o.ended === null),
    done = ops.filter((o) => o.ended !== null).slice(-ESCALATE.gone);
  if (live.length || done.length) v.ops = [...done, ...live.slice(0, ESCALATE.most)];
  return out;
}

/** An operation whose group is gone (crushed, absorbed, withered): ended by that, its lands to its rivals. */
function settleOps(f: Facts): void {
  const { v } = f;
  for (const o of v.ops ?? []) {
    if (o.ended !== null || v.groups.some((g) => g.id === o.target)) continue;
    const gone = [...v.gone].reverse().find((g) => g.name === o.name && g.kind === o.kind),
      heir =
        v.groups
          .filter((g) => g.kind === o.kind)
          .sort((a, b) => b.share - a.share || a.id - b.id)[0] ??
        v.groups.find((g) => kindOfGroup(g) === "badge");
    if (heir && kindOfGroup(heir) !== "badge")
      for (const c of o.lands)
        if (!heir.lands.includes(c) && heir.lands.length < UNDER.lands) heir.lands.push(c);
    endOp(f, o, "crushed", heir ? { to: heir.name } : {}, gone?.event);
  }
}

// —— A group's means ——————————————————————————————————————————————————————————————————————————————————————

/** The best its realm's lands can make of each part of a group's means (0 … 1): read off what is known and made at its home and seat. */
export function bestMeans(
  ctx: PopulationContext,
  p: Polity,
  home: number,
): Record<MeansPart, number> {
  const { world } = ctx,
    lore = loreOf(world),
    made = materialsOf(world),
    knows = (id: string) => !!lore.get(home, id) || !!lore.get(p.seat, id),
    hasMade = (way: string) => !!made?.made(home, way) || !!made?.made(p.seat, way),
    a = armsOf(ctx, p),
    coast = p.members.some((c) => coastal(ctx, c));
  const arms = Math.max(dmath.clamp((a.full - 1) / 4, 0, 1), knows("gunpowder") ? 0.25 : 0),
    armour =
      (knows("armoured-vehicles") ? 0.35 : 0) +
      (hasMade("alloy-steel") ? 0.2 : 0) +
      (hasMade("light-alloy") ? 0.15 : 0) +
      (hasMade("glass-fibre") || hasMade("made-polymer") ? 0.15 : 0) +
      (hasMade("reinforced-concrete") ? 0.05 : 0) +
      (knows("factories") || knows("engines") ? 0.1 : 0),
    // (Hidden boats where it holds a coast and builds ships; tunnels under the border where it works under ground and pours concrete.)
    sea = coast
      ? (knows("shipbuilding") ? 0.25 : knows("sailing") ? 0.1 : 0) +
        (knows("steamships") ? 0.2 : 0)
      : 0,
    under =
      knows("coal-mining") && (hasMade("concrete") || hasMade("reinforced-concrete"))
        ? 0.35 + (knows("factories") ? 0.1 : 0)
        : 0,
    word =
      (knows("writing") ? 0.15 : 0) +
      (knows("telegraph") ? 0.15 : 0) +
      (knows("radio") ? 0.15 : 0) +
      (knows("computing") ? 0.2 : 0) +
      (knows("networks") ? 0.15 : 0) +
      (knows("machine-minds") ? 0.2 : 0);
  return {
    arms,
    armour: dmath.clamp(armour, 0, 1),
    hidden: dmath.clamp(sea + under, 0, 1),
    word: dmath.clamp(word, 0, 1),
  };
}

/** What a group buys of its means toward its realm's best, and pays for them out of what it holds. */
function buyMeans(ctx: PopulationContext, p: Polity, g: CrimeGroup, r: Read, span: number): void {
  const best = bestMeans(ctx, p, g.home),
    perPart = Math.max(1, g.members) * r.wage * GEAR.cost,
    want = kindOfGroup(g) === "cartel" ? best : { ...best, hidden: 0 },
    got = meansBought(want, g.wealth, perPart * GEAR_PARTS.length, r.revenue),
    cost = GEAR_PARTS.reduce((s, k) => s + got[k] * perPart, 0);
  g.wealth = Math.max(0, Math.round(g.wealth - cost * span));
  g.means = {
    arms: per(got.arms),
    armour: per(got.armour),
    hidden: per(got.hidden),
    word: per(got.word),
    cost: Math.round(cost),
  };
}

/** How much a land weighs to a group that would hold it: its people, and its town's. */
function landWeight(ctx: PopulationContext, cell: number): number {
  const town = ctx.settlements.inProvince(cell).find((s) => s.market);
  return (ctx.provinces.get(cell)?.total() ?? 0) + 2 * (town?.population ?? 0);
}

/** The great house that would shelter a group: a grifter bought into the offices, else the greatest outside the crown (null: none). */
function housesShelter(world: World, realm: Ref): string | null {
  const v = housesOf(world)?.of(realm);
  if (!v) return null;
  const grifter = v.houses.find((h) => originOf(h) === "grifter");
  if (grifter) return grifter.name;
  const great = [...v.houses]
    .filter((h) => !h.crown)
    .sort((a, b) => b.power - a.power || a.id - b.id)[0];
  return great && great.power >= 250 ? great.name : null;
}

/** A realm's treasury pays (a crackdown's cost, less what it seized): from its reserve, never below nothing. */
function treasuryPays(world: World, realm: Ref, grain: number): void {
  const s = moneyStore(world, TREASURY_STORE),
    row = s?.get(realm);
  if (!s || !row || !Number.isFinite(grain) || grain === 0) return;
  const next = [...row];
  next[FISC.reserve] = Math.max(0, row[FISC.reserve]! - grain);
  s.set(realm, next);
}

/** Each of a realm's lands: who holds it, the killing there, what is protected and extorted, its street's gangs. */
function writeLands(
  ctx: PopulationContext,
  p: Polity,
  v: RealmUnderworld,
  towns: readonly Town[],
  r: Read,
  badge: CrimeGroup | undefined,
  bites: number,
  warring: ReadonlyMap<number, number>,
  year: number,
): void {
  const rows = gangsStore(ctx.world);
  if (!rows) return;
  // (What each land's killing was of, kept beside the world as it is reckoned: a reading, no part of its hash. sim/hand/deaths.ts)
  const notes = deathNotesOf(ctx.world),
    named = (g: CrimeGroup) => `${g.event}|${g.name}|${g.kind}`;
  if (notes && year % UNDER.every === 0) notes.forgetKillings(year - KILLINGS_KEPT);
  const byTown = new Map(towns.map((t) => [t.cell, t])),
    badgeTowns = badge ? new Set(towns.map((t) => t.cell)) : new Set<number>();
  if (badge)
    for (const g of v.groups)
      if (kindOfGroup(g) === "cartel") for (const c of g.lands) badgeTowns.add(c);
  let extorted = 0,
    trade = 0;
  // (A group's men and its killing lie in its lands as their people do: none in an empty land, nor half of it in a hamlet.)
  const peopleOf = (c: number) => ctx.provinces.get(c)?.total() ?? 0,
    spread = new Map(v.groups.map((g) => [g, g.lands.reduce((s, c) => s + peopleOf(c), 0)]));
  // (A road's war is fought where two of its groups meet: in the lands both hold; where they hold none in common, in a group's
  // lands on a rival's border; where they nowhere meet, at each one's home. Its peace's killing lies in all its lands, as its
  // men do. Laid over the shared lands and every land on the border besides, a war's dead lay thin over most of a great realm.)
  const grid = ctx.generated.grid,
    fronts = new Map<CrimeGroup, { lands: readonly number[]; people: number; war: number }>();
  for (const g of v.groups) {
    const war = warring.get(g.id) ?? 0;
    if (war <= 0) continue;
    const theirs = new Set<number>();
    for (const x of v.groups)
      if (x !== g && x.kind === g.kind) for (const c of x.lands) theirs.add(c);
    let lands = g.lands.filter((c) => theirs.has(c) && peopleOf(c) > 0);
    if (!lands.length)
      lands = g.lands.filter((c) => {
        for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++)
          if (theirs.has(grid.neighbours[k]!)) return true;
        return false;
      });
    if (!lands.some((c) => peopleOf(c) > 0))
      lands = [g.lands.includes(g.home) ? g.home : g.lands[0]!];
    fronts.set(g, { lands, people: lands.reduce((s, c) => s + peopleOf(c), 0), war });
  }
  let badgePeople = 0;
  for (const c of badgeTowns) badgePeople += peopleOf(c);
  for (const c of p.members) {
    const prov = ctx.provinces.get(c),
      n = prov?.total() ?? 0;
    if (!prov || n <= 0) {
      rows.drop(c);
      continue;
    }
    let best: CrimeGroup | null = null,
      bestW = 0,
      killed = 0,
      protection = 0;
    const police = 0.004 * n * r.capacity * (1 + 3 * bites) + 1;
    for (const g of v.groups) {
      if (!g.lands.includes(c)) continue;
      const part = n / Math.max(1, spread.get(g) ?? n),
        w = g.members * part;
      const front = fronts.get(g);
      killed +=
        (g.violence - (front?.war ?? 0)) * part +
        (front && front.lands.includes(c) ? (front.war * n) / Math.max(1, front.people) : 0);
      if (w > bestW) {
        bestW = w;
        best = g;
      }
      if (kindOfGroup(g) === "protection") protection += w / (w + police);
    }
    const tw = byTown.get(c),
      fedsHere = v.feds.filter((x) => x.towns.includes(c)),
      bw = badge && badgeTowns.has(c) ? Math.min(1, v.badgePull / 1000) : 0;
    if (tw) killed += tw.killed;
    // (Its crew's killing among the lands it works as their people are: a hamlet is not given a city's share.)
    if (bw > 0 && badgePeople > 0) killed += (v.badge * n) / badgePeople;
    // (No land's underworld takes more of it in a year than the worst the world has known: UNDER.killMost.)
    killed = Math.min(killed, UNDER.killMost * n);
    if (!best && !tw && bw <= 0) {
      if (rows.get(c)) rows.drop(c);
      continue;
    }
    let young = 0;
    for (let b = 0; b < BANDS; b++)
      if (youngBand(ctx.life, b)) young += prov.counts.rowSum(row(MALE, b)) * 2;
    const open = v.wars.some(
        (w) => w.ended === null && best && (w.a === best.id || w.b === best.id),
      ),
      prot = dmath.clamp(protection * (v.want / 1000) * 2, 0, 1),
      ext = dmath.clamp(
        prot * UNDER.cut * (open ? 2 : 1) * 4 + (tw ? 0.02 * tw.pull : 0) + 0.1 * bw,
        0,
        0.6,
      ),
      killedShare = killed / n,
      // (Most of those killed are its young men, and the young who stand near them.)
      youngShare = young > 0 ? (0.8 * killed) / young : 0;
    extorted += ext * n;
    trade += n;
    if (notes && killedShare > 0) {
      const here = v.groups.filter((g) => g.lands.includes(c)),
        war = v.wars.find(
          (w) =>
            w.ended === null && here.some((g) => g.id === w.a) && here.some((g) => g.id === w.b),
        ),
        a = war ? here.find((g) => g.id === war.a) : undefined,
        b = war ? here.find((g) => g.id === war.b) : undefined;
      notes.addKilling({
        year,
        years: UNDER.every,
        cell: c,
        per: killedShare * 1e6,
        control: best ? per(bestW / (bestW + police)) : 0,
        gangs: tw?.gangs ?? 0,
        street: tw ? tw.pull * 1000 : 0,
        badge: bw * 1000,
        racket:
          !!best &&
          (best.rackets &
            (racketBit("protection") | racketBit("extortion") | racketBit("killing"))) !==
            0,
        squad: bw > 0 && !!badge?.squad,
        war: war && a && b ? `${war.event}|${named(a)}|${named(b)}` : null,
        holder: best ? named(best) : null,
        crew: bw > 0 && badge ? named(badge) : null,
        feds: [
          fedsHere[0] ? `${fedsHere[0].event}|${fedsHere[0].name}` : null,
          fedsHere[1] ? `${fedsHere[1].event}|${fedsHere[1].name}` : null,
        ],
      });
    }
    rows.set(c, [
      best ? per(bestW / (bestW + police)) : 0,
      best ? best.id + 1 : 0,
      best ? best.kind + 1 : 0,
      killedShare * 1e6,
      youngShare * 1e6,
      prot * 1000,
      ext * 1000,
      tw?.gangs ?? 0,
      tw ? tw.pull * 1000 : 0,
      fedsHere[0] ? fedsHere[0].id + 1 : 0,
      fedsHere[1] ? fedsHere[1].id + 1 : 0,
      bw * 1000,
      dmath.clamp(UNDER.deters * killedShare * 100, 0, 0.5) * 1000,
      tw?.jailed ?? 0,
      dmath.clamp(0.3 * bw, 0, 0.3) * 1000,
    ]);
  }
  v.extortion = trade > 0 ? per(extorted / trade) : 0;
}

/**
 * A boss brought down by another's deed (sim/order/deeds.ts: those who hold wrongdoers to account where the courts do not;
 * `by`: its event): another takes his place at once, and a fifth of his men scatter. False where no such group stands.
 */
export function bossFalls(
  ctx: PopulationContext,
  p: Polity,
  founded: Ref,
  by: Ref,
  t: SimTime,
): boolean {
  const { world } = ctx,
    store = underworldOf(world),
    was = store?.of(p.ref);
  if (!store || !was || !was.groups.some((g) => g.event === founded)) return false;
  const v = copyOf(was),
    g = v.groups.find((x) => x.event === founded)!,
    year = yearOfMoment(t),
    key = keyOf(p.ref),
    f: Facts = {
      ctx,
      p,
      v,
      t,
      year,
      key,
      u: (k: number) => world.rng.real(DRAW, key, t, k),
      opening: new Set(),
    };
  deathNotesOf(world)?.addHead({
    ref: bossRef(p.ref, g.event),
    name: g.boss.name,
    year,
    age: year - g.boss.born,
    how: "killed",
    event: by,
  });
  g.boss = newBoss(
    f,
    g.home,
    kindOfGroup(g) === "protection" ? g.name : null,
    g.id * 41 + g.bosses,
  );
  g.bosses++;
  g.members = Math.round(g.members * 0.8);
  store.put(p.ref, v);
  return true;
}

/**
 * 188.order.underworld, a year: each realm in its turn (its ref's number and the year, UNDER.every), stepped as many years as since
 * it was last; and each year, its killing and what is extorted breed grievance in its lands. A realm none of whose numbers come to a
 * group, a gang or a crackdown keeps no record, and the store stays dormant.
 */
export function underworldYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = underworldOf(world);
  if (!store) return;
  const year = yearOfMoment(t),
    living = politiesOf(world).living();
  if (year % 10 === 0) {
    const alive = new Set(living.map((p) => p.ref));
    for (const r of store.realmsKept()) if (!alive.has(r)) store.forget(r);
    // (A land no realm reckons now keeps no row.)
    const rows = gangsStore(world),
      realms = politiesOf(world);
    if (rows)
      for (const k of rows.keys()) {
        const r = realms.of(Number(k));
        if (!r || !store.of(r.ref)) rows.drop(k);
      }
  }
  const rows = gangsStore(world);
  for (const p of living) {
    if ((refNumber(p.ref) + year) % UNDER.every === 0) {
      const was = store.of(p.ref),
        v: RealmUnderworld = was ? copyOf(was) : fresh(year),
        span = was ? Math.max(1, Math.min(50, year - was.last)) : UNDER.every;
      const any = stepRealm(ctx, p, v, span, t);
      if (was || any || v.groups.length || v.feds.length || v.next > 1) store.put(p.ref, v);
      else if (rows) for (const c of p.members) if (rows.get(c)) rows.drop(c);
    }
    // (The killing and the extortion, as last reckoned, breed grievance in its lands year by year.)
    const now = store.of(p.ref);
    if (!now || !rows) continue;
    const cause =
      [...now.groups].sort((a, b) => b.violence - a.violence || a.id - b.id)[0]?.event ??
      now.feds[0]?.event;
    if (!cause) continue;
    for (const c of p.members) {
      const row = rows.get(c);
      if (!row) continue;
      const amount =
        (UNDER.grievesKilling * row[GANG_ROW.killings]!) / 1e3 / 1000 +
        (UNDER.grievesExtortion * row[GANG_ROW.extortion]!) / 1000;
      if (amount > 0) grieve(world, c, amount, cause);
    }
  }
}

// —— How strong what is forbidden grows (the iron law of prohibition) ————————————————————————————————————————

export const POTENCY_EVENTS = {
  /** A stronger form of what a realm forbids reached its streets; made forms took the place of grown ones. */
  stronger: defineEventType("money.stronger", 3),
  made: defineEventType("money.made-forms", 4),
};

/**
 * 188.money.strength, a year: each realm whose trade in what calms, wakes and eases is forbidden, or has grown strong, in its turn
 * (UNDER.every), stepped as many years at once. Under a ban that is hunted (its crackdown as it bites, a blockade, its seat's reach)
 * the risk and cost of carrying go by bulk, not dose, and the trade moves toward the strongest form it can get: grown forms refined
 * as far as its people's healing and chemistry go, and made forms where chemistry allows and a cartel is rich enough to make them.
 * Where the ban ends, it drifts back over a generation. Nothing is drawn.
 */
export function potencyYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    rows = potencyStore(world),
    bars = moneyStore(world, BAR_STORE);
  if (!rows || !bars) return;
  const year = yearOfMoment(t),
    lore = loreOf(world),
    under = underworldOf(world),
    living = politiesOf(world).living(),
    alive = new Set<string>(living.map((p) => p.ref));
  if (year % 10 === 0) for (const k of rows.keys()) if (!alive.has(k)) rows.drop(k);
  for (const p of living) {
    if ((refNumber(p.ref) + year) % UNDER.every !== 0) continue;
    const was = rows.get(p.ref),
      barred = (bars.at(p.ref, BAR.barred) ?? 0) / 1000;
    if (!was && barred < 0.1) continue;
    const span = was ? Math.max(1, Math.min(50, year - was[POT_ROW.year]!)) : UNDER.every,
      cartel = [...(under?.of(p.ref)?.groups ?? [])]
        .filter((g) => kindOfGroup(g) === "cartel")
        .sort((a, b) => b.power - a.power || a.id - b.id)[0],
      // (What the cartel's lands can reach, or the seat's where none carries it.)
      at = cartel?.home ?? p.seat,
      knows = (id: string) => !!lore.get(at, id) || !!lore.get(p.seat, id),
      // (A man's own year of food at the least: a crafter's wage is what was earned of a year only part of which was wanted.)
      wage = Math.max(12, marketsOf(world).get(p.seat)?.wage[OCC.crafter] ?? 1),
      canMake =
        (knows("cold-chemistry") || (knows("electrochemistry") && knows("medicine"))) &&
        !!cartel &&
        cartel.wealth >= wage * UNDER.keep * UNDER.crew * 10,
      cap = potencyCap({
        herbs: knows("herbalism"),
        medicine: knows("medicine"),
        chemistry: knows("electrochemistry") || knows("cold-chemistry"),
        canMake,
      }),
      hunted = dmath.clamp(
        0.4 * capacityValue(ctx, p) + bitesOf(world, p.ref) + 0.5 * blockadeOn(world, p.ref),
        0,
        1,
      ),
      premium = riskPremium(barred, hunted),
      legal = barred < 0.25,
      madeWas = (was?.[POT_ROW.made] ?? 0) / 1000,
      madeAim = legal ? 0 : madeTarget(premium, canMake),
      made =
        madeWas + (madeAim - madeWas) * stepped(legal ? POTENCY.legal : POTENCY.madePace, span),
      most = cap.grown * (1 - made) + cap.made * made,
      potencyWas = Math.max(1, (was?.[POT_ROW.potency] ?? 100) / 100),
      potency = Math.min(most, potencyAfter(potencyWas, potencyTarget(premium, most), span, legal));
    let told = was?.[POT_ROW.told] ?? 0;
    const tell = (type: string, data: Record<string, unknown>, factors: Factor[]) => {
      const decision = world.decisions.record({
        rule: type,
        subject: p.ref,
        outcome: { ...data },
        score: premium,
        threshold: 0,
        factors,
      });
      world.events.emit({
        type,
        subjects: [p.ref],
        place: ctx.provinces.get(at)?.ref ?? null,
        causes: [
          { ref: decision, role: "trigger", weight: 1 },
          ...(cartel ? [{ ref: cartel.event, role: "enabler" as const, weight: 1 }] : []),
        ],
        data: {
          realm: realmName(p),
          ...(cartel ? { group: cartel.name, kind: "cartel", gids: [cartel.id] } : {}),
          ...data,
        },
      });
    };
    const why = [
      { name: "forbidden", value: r2(barred), contribution: barred, source: null },
      { name: "hunted", value: r2(hunted), contribution: hunted, source: null },
    ];
    // (Told as it doubles, twice, four times, eight times the grown: on the streets, while it is forbidden.)
    for (let k = 0; k < 4; k++)
      if (!legal && potency >= dmath.pow2(k + 1) && !(told & (1 << k))) {
        told |= 1 << k;
        tell(POTENCY_EVENTS.stronger.type, { strength: Math.round(potency * 10) / 10 }, why);
      }
    if (!legal && made >= 0.5 && !(told & 16)) {
      told |= 16;
      tell(POTENCY_EVENTS.made.type, { made: Math.round(made * 100) }, [
        ...why,
        { name: "chemistry that allows it", value: 1, contribution: 1, source: null },
      ]);
    }
    rows.set(p.ref, [
      potency * 100,
      made * 1000,
      cap.grown * 100,
      most * 100,
      premium * 1000,
      year,
      told,
    ]);
  }
}

// —— What the realm's reach and standing lose ————————————————————————————————————————————————————————————

addsReach((ctx, p) => {
  const v = underworldOf(ctx.world)?.of(p.ref);
  if (!v || v.collusion <= 0) return [];
  const k = v.collusion / 1000;
  return [
    {
      name: "officers and judges bought by the underworld",
      value: r2(k),
      contribution: -0.12 * k,
      source: v.pactEvent,
    },
  ];
});

addsStanding((ctx, p) => {
  const v = underworldOf(ctx.world)?.of(p.ref);
  if (!v) return [];
  const out: Factor[] = [];
  let people = 0;
  for (const c of p.members) people += ctx.provinces.get(c)?.total() ?? 0;
  const killed = people > 0 ? ((v.killings + v.street + v.badge) / people) * 1000 : 0;
  if (killed > 0.01)
    out.push({
      name: "open killing in its lands",
      value: r2(killed),
      contribution: -Math.min(UNDER.standingMost, UNDER.standingKilling * killed * 0.01),
      source: v.wars.find((w) => w.ended === null)
        ? { ref: v.wars.find((w) => w.ended === null)!.event, role: "pressure", weight: 1 }
        : null,
    });
  // (A truce with a group made known: the seat seen to bargain with those it was sent to break.)
  if (v.truce?.known !== undefined) {
    const since = yearOfMoment(ctx.world.now) - v.truce.known;
    if (since < UNDER.scandalYears)
      out.push({
        name: "a truce with the underworld made known",
        value: since,
        contribution: -ESCALATE.known * (1 - since / UNDER.scandalYears),
        source: { ref: v.truce.event, role: "trigger", weight: 1 },
      });
  }
  if (v.scandal) {
    const since = yearOfMoment(ctx.world.now) - v.scandal.year;
    if (since < UNDER.scandalYears)
      out.push({
        name: "its own enforcers found to be a crew",
        value: since,
        contribution: -UNDER.scandal * (1 - since / UNDER.scandalYears),
        source: { ref: v.scandal.event, role: "trigger", weight: 1 },
      });
  }
  return out;
});

/** Register the underworld on a peopled world. */
export function installUnderworld(world: World, ctx: () => PopulationContext): UnderworldStore {
  const store = world.register(new UnderworldStore());
  world.register(new RowStore(GANGS_STORE, GANGS_WIDTH));
  world.addPinner(() => store.pinned());
  world.system({ key: "188.order.underworld", every: YEAR, run: (t) => underworldYear(ctx(), t) });
  // (How strong what is forbidden grows: after the ban is weighed, before the underworld reads it.)
  world.register(new RowStore(POTENCY_STORE, POTENCY_WIDTH));
  world.system({ key: "188.money.strength", every: YEAR, run: (t) => potencyYear(ctx(), t) });
  return store;
}
