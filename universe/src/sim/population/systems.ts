// The population's systems (docs/architecture §7, §15). Each runs on its own
// cadence in the order of its key, reads the state as it stood when it began and
// commits its changes after (compute-then-commit), draws every chance from a key
// (province, time, purpose), and writes what it did to the ledgers and the
// history, with causes recorded at the point of decision.
import { notableHeals } from "../notable/kept.ts";
import { intoxDeaths } from "../money/kept.ts";
import {
  careSparedOf,
  daysWorkedOf,
  forgoneOf,
  improvedOf,
  oldAgeWantOf,
  oldPressOf,
  tableKeptOf,
} from "../society/kept.ts";
import { workBySex } from "../society/work.ts";
import { rooflessColdOf } from "../society/kept.ts";
import { youngKilledOf } from "../order/underworld-kept.ts";
import { orgSparedOf, orgYoungKilledOf } from "../order/groups-kept.ts";
import { healthOf } from "../health/health.ts";
import {
  CountDeltas,
  MONTH,
  YEAR,
  apportion,
  defineEventType,
  drawWithoutReplacement,
  multinomial,
  defineStream,
  dmath,
  gaussian,
  hashString,
  periodIndex,
  purpose,
  refHash,
  seedName,
  weightedIndex,
  type CauseRef,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import {
  cellRef,
  type HomeWorld,
  isProvinceWorld,
  lives,
  offworldSite,
  placeName,
  refineRegion,
  type Region,
  tongueName,
  WATER,
  worldLife,
} from "../../gen/index.ts";
import { ACT_REACH, ACT_STRENGTH, actFactor, actsOf, blightRot, watered } from "../acts/acts.ts";
import { lineageNature, tameNow } from "../acts/natures.ts";
import {
  FLOCK_LOSS,
  ecologyOf,
  grainLost,
  living,
  waterYield,
  wildsOf,
} from "../ecology/ecology.ts";
import { standGame } from "../ecology/stands.ts";
import { tillageAt } from "../ecology/farmed.ts";
import { peopleAffords, peopleKin, peopleLife } from "./life.ts";
import {
  airOf,
  darkCause,
  darkFields,
  darkRain,
  heatYield,
  rainShift,
  smokeIn,
} from "../climate/air.ts";
import { energyPerHead } from "../economy/energy.ts";
import { readersOf } from "../lore/letters.ts";
import { longRain } from "../climate/long.ts";
import { lodesOf } from "../economy/lodes.ts";
import { lodePush } from "../economy/worked.ts";
import { herdLoss, pensLeft } from "../ecology/herds.ts";
import { partnersOf } from "../ecology/lineage.ts";
import { cropsGive } from "../ecology/crops.ts";
import { herdGives, pestsLeft } from "../ecology/exchange.ts";
import { veilYield } from "../planet/fires.ts";
import { floodBehind, floodYield } from "../planet/floods.ts";
import { dietDeaths } from "./diet.ts";
import {
  GONE_KEPT,
  HAND_VITAL,
  bandOfAge,
  drawTraits,
  handOf,
  newbornSex,
  pairUp,
  traitWeight,
  type Agent,
  workWeights,
} from "../hand/hand.ts";
import { cultureOf, cultureYear } from "../culture/culture.ts";
import { loreOf } from "../lore/lore.ts";
import { lessonAdds } from "../lore/lessons-store.ts";
import { asksMonth, asksOf } from "../town/asks.ts";
import { MarketStore, type Market } from "../economy/market.ts";
import {
  BANDS,
  bandWidth,
  deathWithin,
  diedInBirthYear,
  riskUnder,
  FEMALE,
  FOODS,
  G,
  GOODS,
  MACHINE_GAIN,
  MALE,
  OCC,
  PRODUCTIVITY,
  SEXES,
  TOOL_GAIN,
  VAT_PEOPLE_KM2,
  habitability,
  routeTo,
  thrift,
  type Affordances,
  type LifeHistory,
  type Medium,
  childCost,
  coatOf,
  childrenKept,
  youngBand,
  adaptedOf,
  coldFelt,
  girlsOf,
  heightsToll,
  heightsLost,
  heightsTollOf,
  longerLived,
  matedShare,
  MONSOON,
  monsoonOf,
} from "../../rules/index.ts";
import { homePlanet } from "../planet/store.ts";
import { lightSteps, starSitesOf } from "../space/stars.ts";
import { lateOf, remakeKey } from "../space/late-store.ts";
import { frontierFields, frontierRain, frontierSky } from "../frontier/hooks.ts";
import { writtenCut } from "../frontier/written.ts";
import { siteRegion } from "../space/ground.ts";
import { starHazard } from "../acts/great.ts";
import { homeSky, shiftNow, starEnded } from "../planet/motion.ts";
import { actOn, hazardBy, luckBy } from "../acts/person.ts";
import { KILLING, handDeath, type DeathPart } from "../hand/deaths.ts";
import { fledKind, noteFled } from "../war/held.ts";
import { seaOf, seaYield } from "../ecology/seas.ts";
import {
  FLIGHT,
  WAR_FLIGHT,
  flightYear,
  installBorders,
  throughGates,
  weighsWages,
} from "./flight.ts";
import { capacity, COLS, livable, Province, row, ROWS, type Capacity } from "./model.ts";
import {
  HistoryStore,
  PopulationStore,
  SETTLEMENT,
  SettlementStore,
  livingMemory,
  type Settlement,
} from "./stores.ts";

export const POPULATION_EVENTS = {
  origin: defineEventType("people.origin", 7),
  spread: defineEventType("people.spread", 6),
  drought: defineEventType("weather.drought", 3),
  famine: defineEventType("people.famine", 4),
  migration: defineEventType("people.migration", 2),
  peopled: defineEventType("province.peopled", 4),
  cultivation: defineEventType("knowledge.cultivation", 6),
  cultivationSpread: defineEventType("knowledge.cultivation-spread", 3),
  herding: defineEventType("knowledge.herding", 6),
  herdingSpread: defineEventType("knowledge.herding-spread", 3),
  founded: defineEventType("settlement.founded", 4),
  market: defineEventType("settlement.market", 5),
};

const BIRTHS = defineStream("pop.births");
const DEATHS = defineStream("pop.deaths");
const AGEING = defineStream("pop.ageing");
const WORK = defineStream("pop.work");
const RAIN = defineStream("pop.rain");
const MOVES = defineStream("pop.moves");
const KNOW = defineStream("pop.knowledge");
const SITES = defineStream("pop.sites");

/** A village holds about this many people before another is founded. */
export const VILLAGE_SIZE = 250;
/** How many times its trades and their kin a land's town holds (sim/population/urban.ts sets it; 1: its trades alone). */
let townDrawOf = (_world: World, _cell: number): number => 1;
export function readsTownDraw(f: (world: World, cell: number) => number): void {
  townDrawOf = f;
}

/** The most villages a land holds: beyond them its settled people live in larger ones. */
export const MOST_VILLAGES = 48;
/**
 * How many lands may found their first village in one year, world-wide, in the
 * order of the lands; the rest wait a year. Each first village surveys its land's
 * region, and this keeps a year's work even when farming sweeps a continent.
 */
export const FIRST_VILLAGES_A_YEAR = 50;
/** The fewest people who set out together. */
export const MIN_GROUP = 10;
// The draws' purposes, named once.
const HARVEST = purpose("harvest"),
  SPOIL = purpose("spoil"),
  SEX = purpose("sex");

/** x rounded down or up by a keyed coin, so the expectation is exact. */
export function roundKeyed(x: number, u: number): number {
  const whole = Math.floor(x);
  return whole + (u < x - whole ? 1 : 0);
}

/** The year a moment ending at t belongs to. */
function yearOfMoment(t: number): number {
  return Math.floor((t - 1) / YEAR);
}

/**
 * The share of a land's work that goes to keeping its halls alive: none on the home
 * world; on another body, by what its ground lacks against the people's body (rules/
 * habitat.ts: a yearly upkeep a settler, as hands taken from the fields).
 */
const HALLS = new Map<string, number>();
export function hallsShare(ctx: PopulationContext, cell: number): number {
  const site = offworldSite(ctx.generated, cell);
  if (!site) return 0;
  // (As far as its world has been remade, its halls keep less out: Phase 66.)
  const remade = 1 - (lateOf(ctx.world)?.share(remakeKey(site.body, cell)) ?? 0);
  // A ship's land: its share aboard while it sails, on the world it came to after.
  if (site.body < 0) {
    const s = starSitesOf(ctx.world)?.get(cell);
    // (Bodies written for the world they came to bear a share of what their halls keep out: frontier/written.ts.)
    return s ? (s.arrived ? s.there * remade * (1 - writtenCut(ctx.world, cell)) : s.aboard) : 0;
  }
  const key = `${homePlanet(ctx.world).surfaceKey}:${cell}`;
  let share = HALLS.get(key);
  if (share === undefined) {
    const g = ctx.generated,
      body = g.system.bodies[site.body]!,
      need = habitability(
        body,
        g.life.people?.body ?? null,
        g.system.bodies[0]!,
        worldLife(g),
      ).upkeep;
    HALLS.set(key, (share = Math.min(0.9, need / (need + 6))));
  }
  return share * remade * (1 - writtenCut(ctx.world, cell));
}

/** Lands of another body are farmed under roofs: as its world is remade, its fields come to lie open. */
function openFields(ctx: PopulationContext, cell: number): number {
  const site = offworldSite(ctx.generated, cell);
  if (!site) return 1;
  return 1 + (OPEN_FIELDS - 1) * (lateOf(ctx.world)?.share(remakeKey(site.body, cell)) ?? 0);
}
/** How many times what a hall's floor feeds, a remade world's open fields feed. */
const OPEN_FIELDS = 12;

/**
 * How far apart two lands on different bodies are to rule and to hear from, in steps as a
 * land's are reckoned (Phase 5 M53): a crossing of space counts by how long it takes —
 * the home world's moon about a step away, the red world some four, the giants' moons
 * six or more. Null for two lands of one body.
 */
const CROSSINGS = new Map<string, number | null>();
export function spaceSteps(ctx: PopulationContext, a: number, b: number): number | null {
  const g = ctx.generated,
    sa = offworldSite(g, a),
    sb = offworldSite(g, b);
  if (!sa && !sb) return null;
  // A ship's land, or another star's: its lag is the light-years to that star.
  if ((sa && sa.body < 0) || (sb && sb.body < 0)) {
    const stars = starSitesOf(ctx.world),
      far = (site: typeof sa, cell: number) =>
        site && site.body < 0 ? (stars?.get(cell)?.distance ?? 0) : 0;
    return lightSteps(Math.max(far(sa, a), far(sb, b)));
  }
  if (sa && sb && sa.body === sb.body) return null;
  const key = `${g.digest}:${sa?.body ?? 0}:${sb?.body ?? 0}`;
  if (CROSSINGS.has(key)) return CROSSINGS.get(key)!;
  const bodies = g.system.bodies,
    list = bodies.map((x) => ({
      around: bodies.findIndex((y) => y.ref === x.orbit.around),
      a: x.orbit.a,
      periodDays: x.orbit.periodDays,
      mass: x.mass,
      radius: x.radius,
      pressure: x.pressure,
    })),
    days = (site: typeof sa) =>
      site ? routeTo(list, site.body, g.star.mass, g.laws?.gravity).days : 0,
    far = Math.max(days(sa), days(sb)),
    steps = 1 + Math.round(dmath.log2(1 + far / 30));
  CROSSINGS.set(key, steps);
  return steps;
}

/** The food a land's people eat a month, in units: each by their body's appetite, the young by theirs. */
export function mouths(p: Province, life: LifeHistory): number {
  const young = p.counts.rowSum(row(FEMALE, 0)) + p.counts.rowSum(row(MALE, 0));
  return (p.total() - young * (1 - life.young)) * life.appetite;
}

/** A land's grown people, by its people's life table. */
export function adults(p: Province, life: LifeHistory): number {
  let n = 0;
  for (let s = 0; s < SEXES; s++)
    for (let b = 0; b < BANDS; b++)
      if (life.bands[b]! >= life.adulthood) n += p.counts.rowSum(row(s, b));
  return n;
}

/** How many times the hands that would win all a land's fields give, were each hand's work its first, its fields can use. */
export const FIELDS_FULL = 3;

/** The most of a land's grown its fields can use, its wild, and its pasture (shares; past 1 where they can use them all). */
export type LandUse = {
  readonly tilled: number;
  readonly gathered: number;
  readonly herded: number;
};
const ALL_USED: LandUse = { tilled: Infinity, gathered: Infinity, herded: Infinity };

/**
 * The most of a land's grown its fields can use, and the most its wild can (LandUse): FIELDS_FULL times the hands that would
 * win all its fields give (and its vats, where it grows food in them), or all its wild gives, were each hand's work its
 * first: past that a hand adds under a twentieth of its own (saturate). By a bare hand's work, whatever its tools: a bound,
 * not what its fields need (farmingShare is that).
 */
export function fieldsUse(ctx: PopulationContext, p: Province): LandUse {
  const grown = adults(p, ctx.life);
  if (!p.knowsCultivation || !(grown > 0)) return ALL_USED;
  const c = provinceCapacity(ctx, p.cell),
    room = c.farm + (loreOf(ctx.world).get(p.cell, "vat-food") ? c.areaKm2 * VAT_PEOPLE_KM2 : 0),
    work = ctx.life.appetite * (1 - hallsShare(ctx, p.cell)) * daysWorkedOf(ctx.world, p.cell);
  if (!(work > 0)) return ALL_USED;
  return {
    tilled: (FIELDS_FULL * room) / (PRODUCTIVITY[OCC.farmer]! * work * grown),
    gathered: (FIELDS_FULL * c.forage) / (PRODUCTIVITY[OCC.forager]! * work * grown),
    herded: (FIELDS_FULL * c.pasture) / (PRODUCTIVITY[OCC.herder]! * work * grown),
  };
}

/**
 * The shares of adults each occupation should have, as the society stands, leaning
 * toward the work that was worth most last year (docs/architecture §20: jobs).
 */
export function occupationTargets(
  p: Province,
  cap: Capacity,
  villages: number,
  wages: readonly number[] | null = null,
  farming = 1,
  use: LandUse = ALL_USED,
): number[] {
  const t = new Array<number>(COLS).fill(0);
  if (p.knowsCultivation) {
    // Herds only where beasts have been tamed (or the taming learned) and there is pasture;
    // else those hands farm.
    const herds = cap.pasture > 0 && p.herding ? 0.07 : 0,
      // (Of the hands the old ways set to the fields, those its fields need: the rest go to the crafts and to trade, as
      // much to each as the old ways set them, round "peoples": farmingShare. And of those it set to gather from the wild, the
      // same share: where its fields grow what its people eat and a sixth over, the wild is not what feeds them. Left at the
      // old tenth, the freed hands' glut in the crafts halved a crafter's wage, the wage lean's mean fell under a gatherer's,
      // and gatherers held at 9 in 100 where they had been held at 4: first light's small game was trapped in every land.)
      fields = 0.77 - herds,
      share = dmath.clamp(farming, 0, 1),
      // (Of the hands its fields need by the old ways, those past what its fields can use gather instead, as far as its
      // wild can use them (fieldsUse): the rest stay on the land, as before. The old ways sent 77 in 100 to the fields of any
      // land that had learned to sow, whatever it had of fields: on first light's cold shores, where nothing can be sown,
      // peoples of gatherers that learned sowing from their neighbours sent a third of their hands to fields they did not
      // have and ate a tenth of what they needed, year after year; nine famines in twenty years in one such land. A crowded
      // land of fields, whose wild its gatherers already take all of, is as it was: at 1,000 half of first light's lands
      // have more hands than their fields can use, and sent to the wild they would have stripped it.)
      wanted = fields * share,
      toWild = Math.min(Math.max(0, wanted - use.tilled), Math.max(0, use.gathered - 0.1 * share)),
      farm = wanted - toWild,
      gather = 0.1 * share + toWild,
      // (Written as it was, to the bit, where none go to the wild.)
      freed = fields - wanted + (0.1 - 0.1 * share),
      trades = villages >= 2;
    t[OCC.farmer] = farm;
    t[OCC.forager] = gather;
    t[OCC.herder] = herds;
    t[OCC.crafter] = 0.06 + freed * (trades ? 0.6 : 1);
    t[OCC.trader] = trades ? 0.04 + freed * 0.4 : 0;
    // (Where it has no ground at all that can be tilled, none are at fields: those the old ways sent to them and the wild
    // cannot use keep its herds, as far as its pasture can use them where it keeps herds, and the rest go to the crafts and
    // to trade. They stayed "farmers" there and grew nothing: tide 207's pasture land 3659 kept 7,360 of its
    // 21,000 grown at fields it did not have, a century long, its leanest month at three fifths of its bread in most years
    // and a famine told in 77 of 100. A land with any field is as it was.)
    if (use.tilled === 0 && farm > 0) {
      const herd = herds > 0 ? Math.min(farm, Math.max(0, use.herded - herds)) : 0,
        idle = farm - herd;
      t[OCC.farmer] = 0;
      t[OCC.herder] = herds + herd;
      t[OCC.crafter] = t[OCC.crafter]! + idle * (trades ? 0.6 : 1);
      t[OCC.trader] = t[OCC.trader]! + (trades ? idle * 0.4 : 0);
    }
    t[OCC.leader] = 0.03;
  } else {
    t[OCC.forager] = 0.94;
    t[OCC.crafter] = 0.03;
    t[OCC.leader] = 0.03;
  }
  if (!wages) return t;
  const flexible = [OCC.forager, OCC.farmer, OCC.herder, OCC.crafter, OCC.trader].filter(
      (o) => t[o]! > 0,
    ),
    share = flexible.reduce((s, o) => s + t[o]!, 0),
    mean = flexible.reduce((s, o) => s + t[o]! * wages[o]!, 0) / Math.max(1e-9, share),
    // (The hands its fields need, where they need fewer than the old ways sent: farmingShare has already sent the rest to
    // the crafts and to trade, so a better wage elsewhere draws from those, not from the fields' own. Led below this, harrow
    // 348's traders, paid eight times a farmer's in 860, took a fifth of the hands its fields needed and it went hungry,
    // its people a third in fifty years.)
    needed = p.knowsCultivation && farming < 1 ? t[OCC.farmer]! : 0;
  if (mean <= 0) return t;
  const farmBefore = t[OCC.farmer]!,
    gatherBefore = t[OCC.forager]!;
  for (const o of flexible) t[o] = t[o]! * dmath.clamp(wages[o]! / mean, 0.4, 2.5);
  const after = flexible.reduce((s, o) => s + t[o]!, 0);
  for (const o of flexible) t[o] = (t[o]! * share) / after;
  // (A better wage on the land draws hands to it only as far as its fields and its wild can use them (fieldsUse): the rest stay
  // at their craft and work fewer of their days. A crafter's wage is what was earned, for as much of the year as there was use
  // for the work, and where a land's crafts stand half idle the lean's mean falls under what a gatherer's last hour brings:
  // unbounded, the hands the fields had freed went back to a wild that was already taken whole. Nothing where no land is sown.)
  if (p.knowsCultivation) {
    let back = 0;
    for (const [o, before, most] of [
      [OCC.farmer, farmBefore, use.tilled],
      [OCC.forager, gatherBefore, use.gathered],
    ] as const) {
      const cap = Math.max(before, most);
      if (t[o]! > cap) {
        back += t[o]! - cap;
        t[o] = cap;
      }
    }
    t[OCC.crafter] = t[OCC.crafter]! + back;
  }
  if (t[OCC.farmer]! < needed) {
    const rest = share - t[OCC.farmer]!,
      left = share - needed;
    for (const o of flexible) if (o !== OCC.farmer) t[o] = rest > 0 ? (t[o]! * left) / rest : 0;
    t[OCC.farmer] = needed;
  }
  return t;
}

/**
 * Of the hands the old ways set to a land's fields, the share its fields need (0 … 1; 1 where they need them all): as many as
 * grow what its people eat and a sixth to spare, at what a farmer's work yields there now (its tools and machines, what it
 * knows of fields, its soil, its warmth), the land's fields giving the less to each the more of them are worked
 * (saturate). Where the land cannot feed them all, all the old share farm, as before; where each farmer grows for many,
 * the rest go to the crafts and to trade, and to the towns (round "peoples": labour from what the land asks).
 */
export function farmingShare(ctx: PopulationContext, p: Province): number {
  if (!p.knowsCultivation) return 1;
  const m = marketsOf(ctx.world).get(p.cell);
  if (!m) return 1;
  const c = provinceCapacity(ctx, p.cell),
    alive = wildsOf(ctx, p.cell),
    lore = loreOf(ctx.world),
    tools = (1 + (TOOL_GAIN * m.toolCover) / 1000) * (1 + (MACHINE_GAIN * m.machineCover) / 1000),
    gathers =
      ctx.life.appetite *
      (1 - hallsShare(ctx, p.cell)) *
      // (As many days as its people work against the reference year: the society sweep, rules/leisure.ts. 1 where none is kept.)
      daysWorkedOf(ctx.world, p.cell),
    till = tillageAt(ctx, p.cell),
    fields =
      // (What the ways of farming it knows lift of what holds its own fields back: ecology/farmed.ts, rules/tillage.ts.)
      till.yields *
      heatYield(ctx, p.cell) *
      darkFields(ctx.world, p.cell) *
      // (Its crop, as tame and as fitted to it as it is; the world's veil, and its own ash and flood: exactly 1 on a land
      // sowing its own, tamed, under a clear sky, its river in its banks.)
      cropsGive(ctx.world, p.cell) *
      // (Less what weeds and pests carried in take: exactly 1 where none came.)
      pestsLeft(ctx.world, p.cell) *
      veilYield(ctx, p.cell) *
      floodYield(ctx.world, p.cell) *
      alive.soil *
      // (What its holders have put into its fields: the society sweep, society/holding.ts. Exactly 1 where nothing is kept.)
      (1 + improvedOf(ctx.world, p.cell)),
    // (What all its fields give, worked to the full; and what its people eat, a sixth over.)
    most = c.farm * fields,
    need = mouths(p, ctx.life) * FARM_SPARE,
    // (The hands the old ways set to its fields: all but its herders of 0.77 of its grown, as occupationTargets has it.)
    old = adults(p, ctx.life) * (0.77 - (c.pasture > 0 && p.herding ? 0.07 : 0));
  if (!(most > 0) || need >= most * 0.95 || !(old > 0)) return 1;
  const per = PRODUCTIVITY[OCC.farmer]! * tools * gathers * till.work,
    farmers = (-c.farm / per) * dmath.log(1 - need / most);
  return dmath.clamp(farmers / old, FARM_FLOOR, 1);
}
/** What its fields grow past what its people eat, against hunger and a bad year; and the least of the old share that farms. */
const FARM_SPARE = 7 / 6,
  FARM_FLOOR = 0.03;

/** What a province can feed in a year (person-years) with the ways it knows (its pasture only if it keeps herds). */
export function support(cap: Capacity, knows: boolean, herds = true): number {
  return knows ? cap.forage * 0.3 + cap.farm + (herds ? cap.pasture * 0.5 : 0) : cap.forage;
}

export type PopulationContext = {
  readonly world: World;
  readonly generated: HomeWorld;
  /** The people's life table, from their body; the medium they live in; what their body can do. */
  readonly life: LifeHistory;
  readonly medium: Medium;
  readonly affords: Affordances;
  readonly provinces: PopulationStore;
  readonly settlements: SettlementStore;
  readonly history: HistoryStore;
  readonly culture: number;
};

export function populationContext(world: World): PopulationContext {
  return {
    world,
    generated: homePlanet(world).generated,
    life: peopleLife(homePlanet(world).generated),
    medium: homePlanet(world).generated.life.people?.body.medium ?? "land",
    affords: peopleAffords(homePlanet(world).generated),
    provinces: world.store<PopulationStore>("population.provinces"),
    settlements: world.store<SettlementStore>("population.settlements"),
    history: world.store<HistoryStore>("population.history"),
    culture: hashString(`culture ${seedName(world.seed.text)}`),
  };
}

// Capacities and regions are pure functions of the generated world: kept, never saved.
const CAPACITIES = new Map<string, Capacity>();
/**
 * What a land gives a year. Unasked, as its ground stands now (planet/motion.ts shiftNow: the god's warming and the
 * climate's, its seas and its ice); asked `warm`, as the god's warming alone would have it (0: as it was made).
 */
export function provinceCapacity(ctx: PopulationContext, cell: number, warm?: number): Capacity {
  const shift = warm === undefined ? shiftNow(ctx.world) : null,
    surface = homePlanet(ctx.world).surfaceKey,
    // (The ground as it stands now, asked of land after land: answered by the land's number while the ground, the people's
    // medium and the shift are the last asked of. Spelling a key for each asking was 1.7% of a year at 1,500.)
    now = shift ? CAPACITY_NOW : null;
  if (now && shift) {
    if (now.surface !== surface || now.medium !== ctx.medium || now.shift !== shift.key) {
      now.surface = surface;
      now.medium = ctx.medium;
      now.shift = shift.key;
      now.by = [];
    }
    const known = now.by[cell];
    if (known) return known;
  }
  // (As it was made, on every world whose ground has not moved: the key and the reckoning are then what they always were.)
  const made = `${surface}:${ctx.medium}:${cell}`,
    key = shift ? (shift.key ? `${made}:${shift.key}` : made) : warm ? `${made}:${warm}` : made;
  let c = CAPACITIES.get(key);
  if (!c) {
    if (CAPACITIES.size > 50_000) CAPACITIES.clear();
    CAPACITIES.set(
      key,
      (c = capacity(ctx.generated, cell, ctx.medium, warm ?? 0, shift?.key ? shift : null)),
    );
  }
  if (now) now.by[cell] = c;
  return c;
}
const CAPACITY_NOW: {
  surface: string;
  medium: string;
  shift: string;
  by: (Capacity | undefined)[];
} = { surface: "", medium: "", shift: "", by: [] };
const LIVABLE = new Map<string, boolean>();
/** Whether the people can live in a place: unasked, as its ground stands now; asked `warm`, under the god's warming alone. */
export function livableFor(ctx: PopulationContext, cell: number, warm?: number): boolean {
  const shift = warm === undefined ? shiftNow(ctx.world) : null,
    made = `${homePlanet(ctx.world).surfaceKey}:${ctx.medium}:${cell}`,
    key = shift ? (shift.key ? `${made}:${shift.key}` : made) : warm ? `${made}:${warm}` : made;
  let ok = LIVABLE.get(key);
  if (ok === undefined) {
    if (LIVABLE.size > 50_000) LIVABLE.clear();
    LIVABLE.set(
      key,
      (ok = livable(ctx.generated, cell, ctx.medium, warm ?? 0, shift?.key ? shift : null)),
    );
  }
  return ok;
}
const REGIONS = new Map<string, Region>();
/** A province's region: tiles to a side, and their size (it spans most of a province). */
export const REGION_SIZE = 128;
export const PROVINCE_TILE_KM = 2.4;

/** The province a region's tile lies in. */
export function provinceOfTile(ctx: PopulationContext, r: Region, tile: number): number {
  const g = ctx.generated,
    parent = r.parent[tile]!;
  return isProvinceWorld(g) ? g.provinceOf[parent]! : parent;
}
/** Whether a province's region is refined already (regions are pure: refining early changes nothing). */
export function regionReady(ctx: PopulationContext, cell: number): boolean {
  return REGIONS.has(`${homePlanet(ctx.world).surfaceKey}:${cell}`);
}

export function regionOf(ctx: PopulationContext, cell: number): Region {
  // (A land of another body: its own world's ground, Phase 64.)
  const there = offworldSite(ctx.generated, cell) ? siteRegion(ctx.world, cell) : null;
  if (there) return there;
  const key = `${homePlanet(ctx.world).surfaceKey}:${cell}`;
  let r = REGIONS.get(key);
  if (!r) {
    if (REGIONS.size >= 64) REGIONS.delete(REGIONS.keys().next().value!);
    // A province's region is drawn around its centre, on the fine world, wide enough to hold most of it.
    const g = ctx.generated;
    REGIONS.set(
      key,
      (r = isProvinceWorld(g)
        ? refineRegion(g.fine, g.centre[cell]!, REGION_SIZE, PROVINCE_TILE_KM)
        : refineRegion(g, cell)),
    );
  }
  return r;
}

export function saturate(capacityYear: number, workers: number, productivity: number): number {
  if (capacityYear <= 0 || workers <= 0) return 0;
  return capacityYear * (1 - dmath.exp((-workers * productivity) / capacityYear));
}

/** The markets that hold every province's goods (docs/architecture §20). */
export function marketsOf(world: World): MarketStore {
  return world.store<MarketStore>("economy.markets");
}

/**
 * Food, monthly: what the land gives goes into the province's stores; stores spoil
 * a little (less in pots); people eat what spoils soonest first; what is beyond
 * what can be kept is lost.
 */
export function foodMonth(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    month = periodIndex(t, MONTH),
    markets = marketsOf(world),
    acts = actsOf(world),
    asks = asksOf(world),
    offworldFrom = isProvinceWorld(ctx.generated) ? ctx.generated.offworld.base : Infinity;
  // (The month's work on what towns were asked to raise, H1: here, as an old save's agenda holds no new system.)
  asksMonth(ctx, t);
  for (const p of ctx.provinces.all()) {
    // A blessed harvest is richer, a blighted one poorer.
    const act = acts.at(p.cell, "harvest", t),
      // (And what its towns were asked to put first, and the hands on what they were asked to raise: H1. Exactly 1 on a land never asked.)
      gift =
        (act ? actFactor(act.sign > 0, ACT_STRENGTH.harvest, act.strength) : 1) *
        asks.gift(p.cell, t);
    const m = markets.of(p.cell),
      c = provinceCapacity(ctx, p.cell),
      // The land gives as its living world stands: less game where the wild is thin,
      // less grain from worn soil, for the same work.
      alive = wildsOf(ctx, p.cell),
      key = refHash(p.ref),
      rain = p.rain / 1000,
      tools = (1 + (TOOL_GAIN * m.toolCover) / 1000) * (1 + (MACHINE_GAIN * m.machineCover) / 1000),
      // A body gathers, sows and herds in proportion to what it eats (a giant's day's
      // grazing is a giant's meal), so a worker feeds as many as an upright ape's does —
      // less the share of every hand that keeps another world's halls alive.
      gathers =
        ctx.life.appetite *
        (1 - hallsShare(ctx, p.cell)) *
        // (As many days as its people work against the reference year, its rest days the fewer: the society sweep, rules/leisure.ts.
        // 1 where none is kept.)
        daysWorkedOf(world, p.cell),
      pots = m.potteryCover / 1000,
      // What the land's people know: better fields, flocks and hunting, stores that keep.
      lore = loreOf(world),
      // Hot fields yield less as the world warms; cold ones a little more.
      till = tillageAt(ctx, p.cell),
      fields =
        till.yields *
        heatYield(ctx, p.cell) *
        // (Under the soot of a great fire, W5: exactly 1 under a clear sky.)
        darkFields(world, p.cell) *
        // (Its crop, as tame and as fitted to it as it is; the world's veil, and its own ash and flood: exactly 1 on a land
        // sowing its own, tamed, under a clear sky, its river in its banks.)
        cropsGive(world, p.cell) *
        pestsLeft(world, p.cell) *
        veilYield(ctx, p.cell) *
        floodYield(world, p.cell) *
        // (And a great stone's dust, a burst's light: frontier/hooks.ts, exactly 1 under a clear sky.)
        frontierFields(world, p.cell) *
        (p.cell >= offworldFrom ? openFields(ctx, p.cell) : 1) *
        // (And what its holders have put into them, as far as it is safe and theirs: society/holding.ts. Exactly 1 where none is kept.)
        (1 + improvedOf(world, p.cell)),
      // (And its herd beast against the one it first kept: exactly 1 until it takes up another: ecology/exchange.ts.)
      flocks = (1 + lore.effect(p.cell, "herdYield")) * herdGives(world, p.cell),
      // (What war has driven off of its herds and a beast at large takes: Z1. Exactly 0 where neither has.)
      flocksLost = herdLoss(world, p.cell, t),
      // (What lives off its flocks and its wild, and what its seed carriers give: ecology/lineage.ts. Exactly 1 where none stand.)
      partners = partnersOf(world, p.cell),
      wilds = 1 + lore.effect(p.cell, "forageYield"),
      keeping = Math.min(0.8, lore.effect(p.cell, "keeping")),
      // (And what its own air, coast, woods and brewing keep: society/everyday.ts. Exactly 0 where none is kept.)
      keptByLand = tableKeptOf(world, p.cell),
      stored =
        lore.effect(p.cell, "storage") +
        asks.stored(p.cell, t) +
        // (Grain put by, where famine taught them to: rules/lessons.ts granaries. Exactly 0 where it has not.)
        lessonAdds(world, p.ref, "stores", yearOfMoment(t)),
      // (What they keep from their own use, as the ecology's year last set it: rules/lessons.ts kept-wild, kept-woods.)
      asideWild = alive.asideWild ?? 0,
      asideWoods = alive.asideWoods ?? 0,
      // Food grown in vats (Phase 66), whatever its ground, tended by machines more than hands.
      vats = lore.get(p.cell, "vat-food")
        ? saturate(
            c.areaKm2 * VAT_PEOPLE_KM2,
            p.occupation(OCC.farmer),
            PRODUCTIVITY[OCC.farmer]! * tools * gathers,
          )
        : 0;
    // Yearly food in person-years is this month's food in person-months.
    const harvest: [number, number][] = [
      [
        G.wild,
        saturate(
          // (Less what they have set aside from their own taking: rules/lessons.ts kept-wild. As before where none is.)
          asideWild > 0 ? c.forage * (1 - asideWild) : c.forage,
          p.occupation(OCC.forager),
          PRODUCTIVITY[OCC.forager]! * gathers,
        ) *
          rain *
          wilds *
          alive.wild *
          waterYield(alive) *
          // (And as the reach of sea its boats go out on stands, fished by all on it: sim/ecology/seas.ts. Exactly 1 where untouched.)
          seaYield(ctx, p.cell) *
          // (And young woods' browse: sim/ecology/stands.ts. Exactly 1 where its woods are untouched.)
          standGame(world, p.cell, ecologyOf(world).get(p.cell)?.forest ?? 1) *
          partners.wild,
      ],
      [
        G.grain,
        p.knowsCultivation
          ? saturate(
              // (Less the ground they keep as woods: rules/lessons.ts kept-woods. As before where none is.)
              asideWoods > 0 ? c.farm * (1 - asideWoods) : c.farm,
              p.occupation(OCC.farmer),
              // (The plough, the share and the mill let each farmer work more ground: rules/tillage.ts.)
              PRODUCTIVITY[OCC.farmer]! * tools * gathers * till.work,
            ) *
              rain *
              fields *
              alive.soil *
              (1 - grainLost(alive)) *
              pensLeft(ctx, flocksLost) +
            vats
          : 0,
      ],
      [
        G.meat,
        saturate(c.pasture, p.occupation(OCC.herder), PRODUCTIVITY[OCC.herder]! * tools * gathers) *
          (0.5 + 0.5 * rain) *
          flocks *
          // (Less what the land's hunters take of the flocks, and what war and a known beast have.)
          (1 - FLOCK_LOSS * alive.hunters) *
          (1 - flocksLost) *
          partners.flocks,
      ],
    ];
    for (const [g, x] of harvest)
      m.move("made", g, roundKeyed(x * gift, world.rng.real(BIRTHS, key, t, HARVEST, g)));
    // (Those at work on what its towns were asked to raise eat of it first: H1.)
    if (asks.open.length) asks.feed(p.cell, m);
    for (const g of FOODS)
      m.move(
        "spoiled",
        g,
        Math.min(
          m.stock[g]!,
          roundKeyed(
            m.stock[g]! * GOODS[g]!.spoil * (1 - 0.5 * pots) * (1 - keeping) * (1 - keptByLand),
            world.rng.real(BIRTHS, key, t, SPOIL, g),
          ),
        ),
      );
    // (A blight laid past the strength of old is in the granaries too: acts.ts ACT_REACH. Nothing under any other.)
    const rot = blightRot(act);
    if (rot > 0)
      for (const g of FOODS) m.move("spoiled", g, Math.floor(Math.max(0, m.stock[g]!) * rot));
    // What they eat: their people by the appetite of their body (an upright ape's, one unit a month).
    const need = Math.round(mouths(p, ctx.life));
    let eaten = 0;
    for (const g of FOODS) eaten += m.take("used", g, need - eaten);
    let over = m.food(FOODS) - need * (12 + 12 * pots + stored);
    for (const g of FOODS) if (over > 0) over -= m.take("spoiled", g, Math.ceil(over));
    const fed = need > 0 ? eaten / need : 1,
      // (Rain under the least a year brings of itself, which only the god's hand lays: the wells fail as the drought's
      // years go on, and bread carried in is not water. Thirst is counted as hunger is.)
      parched = p.rain < ACT_REACH.wells * 1000 ? acts.latest(p.cell, "rain", t) : null,
      thirst =
        parched && parched.sign < 0 && need > 0
          ? watered(p.rain / 1000, (t - parched.from) / YEAR)
          : 1000;
    p.fed = Math.min(Math.round(fed * 1000), thirst);
    p.leanest = Math.min(p.leanest, p.fed);
    // A famine is a month with less than seven-tenths of the food a land needs: a people
    // living at the edge of what their land gives (a lean month or two most years) is
    // hungry, and that is told as the grievance and the prices it brings, not as famine.
    if (p.fed < FAMINE && need >= 20 && month - p.famineMonth > 12) {
      const causes: CauseRef[] = [];
      const recentDrought = p.lastDrought ? world.events.get(p.lastDrought) : undefined,
        dry = recentDrought && t - recentDrought.t < 2 * YEAR;
      if (dry) causes.push({ ref: recentDrought.id, role: "trigger", weight: 0.6 });
      if (act && act.sign < 0) causes.push({ ref: act.event, role: "agent", weight: 0.8 });
      // (Its river risen over its fields this year: sim/planet/floods.ts.)
      const flooded = floodBehind(world, p.cell);
      if (flooded) causes.push({ ref: flooded, role: "trigger", weight: 0.5 });
      if (parched && thirst < 1000) causes.push({ ref: parched.event, role: "agent", weight: 0.8 });
      // What else pressed the land: its soil worn, its game thinned, its rain moved by the warming.
      const stocks = ecologyOf(world).get(p.cell),
        drier = airOf(world).shiftOf(p.cell);
      if (stocks?.worn) causes.push({ ref: stocks.worn, role: "pressure", weight: 0.2 });
      else if (stocks?.thinned) causes.push({ ref: stocks.thinned, role: "pressure", weight: 0.2 });
      // (Its sea fished down, where its boats bring in less for it: sim/ecology/seas.ts.)
      const sea = seaYield(ctx, p.cell) < 0.97 ? seaOf(ctx, p.cell).sea : undefined,
        fishedOut = sea ? (sea.gone ?? sea.few) : null;
      if (fishedOut) causes.push({ ref: fishedOut, role: "pressure", weight: 0.3 });
      if (drier && rainShift(ctx, p.cell) < 1)
        causes.push({ ref: drier, role: "pressure", weight: 0.2 });
      // Without a dry year, they had grown to more than their land gives: the fields that
      // let them grow so many, and the land itself.
      if (!dry && p.cultivation) causes.push({ ref: p.cultivation, role: "enabler", weight: 0.3 });
      // (No more than history takes: the land itself last, the lightest of the rest let go.)
      causes.splice(5);
      causes.push({ ref: p.ref, role: "constraint", weight: dry ? 0.4 : 0.5 });
      p.lastFamine = world.events.emit({
        type: POPULATION_EVENTS.famine.type,
        importance: p.fed < 600 ? 5 : 4,
        place: p.ref,
        causes,
        data: { fed: p.fed, people: need },
      });
      p.famineMonth = month;
    }
  }
}

/**
 * What a star's flare or calm (a great act) lays on a land under its light: a land of
 * another body of the home system is under the home star; a ship's or a colony's among
 * the stars, under the star it sailed for, and in the dark where that star has ended. The
 * home world's own lands are sheltered by its air and as much as its field keeps off
 * (planet/motion.ts homeSky: Earth's keeps nearly all).
 */
function underStar(ctx: PopulationContext, cell: number): number {
  const site = offworldSite(ctx.generated, cell);
  if (!site) return homeSky(ctx.world);
  const star =
    site.body >= 0 ? (ctx.generated.star.ref as Ref) : starSitesOf(ctx.world)?.get(cell)?.star;
  if (!star) return 1;
  // (Halls whose star has ended live on what their own works give, in the dark and the cold.)
  return starHazard(ctx.world, star).factor * (starEnded(ctx.world, star) ? STAR_DARK : 1);
}
/** How much likelier death is in halls whose star has ended. */
const STAR_DARK = 3;

/**
 * Births and deaths. Every month each land's hunger is counted; its people are reckoned for
 * the months since they last were, all at once, by how they ate in each (macro-history
 * paging: by the land's own state, never by where anyone looks) — every month under an act
 * or the hand, at a quarter's end if any of its months was lean, else at the year's end.
 * A death's chance compounds by the sum of the months' pressures, so a reckoning of many
 * months at their mean pressure is the months reckoned one by one.
 */
/** (adaptedOf by whole years settled, for one length of a generation: vitalMonth reads it of every land every month.) */
let ADAPTED_GENERATION = NaN,
  ADAPTED = new Float64Array(0);
function adaptedAt(years: number, generation: number): number {
  if (!(Number.isInteger(years) && years >= 0 && years < 4096)) return adaptedOf(years, generation);
  if (generation !== ADAPTED_GENERATION) {
    ADAPTED_GENERATION = generation;
    ADAPTED = new Float64Array(4096).fill(NaN);
  }
  let a = ADAPTED[years]!;
  if (Number.isNaN(a)) ADAPTED[years] = a = adaptedOf(years, generation);
  return a;
}
/**
 * (heightsToll, the share of its air lost read once a land for the height it stands at: read again only where its ground was
 * changed under it, sim/planet/surface.ts.)
 */
let HEIGHTS_OF: ArrayLike<number> | null = null,
  HEIGHTS_AT = new Float64Array(0),
  HEIGHTS_LOST = new Float64Array(0);
function heightsAt(elevation: ArrayLike<number>, cell: number, adapted: number): number {
  const e = elevation[cell]!;
  if (!(e > 0)) return 1;
  if (HEIGHTS_OF !== elevation) {
    HEIGHTS_OF = elevation;
    HEIGHTS_AT = new Float64Array(elevation.length).fill(NaN);
    HEIGHTS_LOST = new Float64Array(elevation.length);
  }
  if (HEIGHTS_AT[cell] !== e) {
    HEIGHTS_AT[cell] = e;
    HEIGHTS_LOST[cell] = heightsLost(e);
  }
  return heightsTollOf(HEIGHTS_LOST[cell]!, adapted);
}

export function vitalMonth(ctx: PopulationContext, t: SimTime): void {
  const { world, history } = ctx,
    year = yearOfMoment(t),
    life = ctx.life,
    // (How its kind pairs, and what its sexes and its old are by its body: rules/demography.ts, sim/population/life.ts.)
    kin = peopleKin(ctx.generated),
    girlsBorn = girlsOf(life),
    // (Read once a month: the sicknesses settled among each land's young, health/health.ts endemicOf.)
    health = healthOf(world),
    boyRisk = life.boyRisk ?? 1,
    lore = loreOf(world);
  const markets = marketsOf(world),
    acts = actsOf(world),
    month = periodIndex(t, MONTH),
    // The last month of the year, and of each quarter (the month at a year's turn closes it).
    yearEnd = month % 12 === 0,
    quarterEnd = month % 3 === 0;
  for (const p of ctx.provinces.all()) {
    // A plague sent makes deaths likelier; healing, rarer.
    const act = acts.at(p.cell, "plague", t),
      sickness = !act
        ? 1
        : act.sign < 0
          ? actFactor(true, ACT_STRENGTH.plague, act.strength)
          : actFactor(false, ACT_STRENGTH.healing, act.strength);
    // The month counted: its hunger and fertility, and the whole of what pressed on its
    // people this month (hunger, a plague or healing, a star's flare over halls under it) —
    // what changes from month to month is summed month by month, so a plague laid late in
    // a stretch presses on its own months alone.
    p.vitalMonths++;
    p.vitalShort += 1000 - p.fed;
    p.vitalFed2 += p.fed * p.fed;
    p.vitalPressure += Math.round(
      1000 *
        (1 + 2.5 * ((1000 - p.fed) / 1000)) *
        sickness *
        underStar(ctx, p.cell) *
        frontierSky(ctx, p.cell),
    );
    const held = !!act || !!handOf(world).over(p.cell);
    if (!held && !yearEnd && !(quarterEnd && p.vitalShort > 0)) continue;
    const months = p.vitalMonths,
      // The months' mean pressure (a stretch counted before its pressure was, from an older
      // save, as pressing no more than usual), and their fertility summed (by fed squared).
      pressure = (p.vitalPressure || months * 1000) / months / 1000,
      fedSquared = p.vitalFed2 / 1_000_000;
    p.vitalMonths = p.vitalShort = p.vitalFed2 = p.vitalPressure = 0;
    // A people grown wealthy with power have fewer children (the demographic transition).
    // And one that has not put by what will feed it to the reaping has fewer still (rules/seasons.ts):
    // by the months of eating in its land's store, against those it needs by the share of its food it reaps.
    const fertility = fedSquared * transition(ctx, p.cell) * putBy(ctx, p, markets.get(p.cell)),
      // In cold lands, those without warm clothing die more easily.
      cold = dmath.clamp((10 - ctx.generated.climate.temperature[p.cell]!) / 10, 0, 1),
      // (As far as their own coat leaves them to clothes: the society sweep, rules/dress.ts. A bare skin's, 1.)
      bare = (1 - (markets.get(p.cell)?.clothingCover ?? 1000) / 1000) * bodyCoat(ctx),
      // (As far as its people have taken to their land, by the generations they have lived in it, the cold and the heights
      // press the less: rules/demography.ts adaptedOf. A land of the sea's people has no thin air.)
      adapted = adaptedAt(year - p.settledYear, kin.generation),
      heights =
        ctx.medium === "land" ? heightsAt(ctx.generated.tectonics.elevation, p.cell, adapted) : 1,
      // Herb-lore and medicine: fewer die (as far as its healers reach them: society/care.ts).
      healed = healedIn(world, p.cell),
      // Where much is burned among few, smoke fouls the air.
      smoke = 1 + 0.3 * smokeIn(ctx, p.cell),
      // (What changes slowly — the cold, clothing, medicine, smoke — as it stands now.)
      // (And those who take too much of what calms, wakes or eases: its share of them a year against a crude death rate of four in a
      // hundred, Round B sim/money/intox.ts.)
      // (And the cold on those of its people on the street: the society sweep, society/roofless.ts. Exactly 1 where none is kept.)
      roofless = rooflessColdOf(world, p.cell),
      intox = 1 + 25 * intoxDeaths(world, p.cell),
      // (Less what its mutual-aid societies spare: sim/order/groups.ts. Exactly 1 where none is kept.)
      aided = 1 - orgSparedOf(world, p.cell),
      mortality =
        pressure *
        (1 + 0.25 * cold * bare * coldFelt(adapted)) *
        heights *
        healed *
        smoke *
        roofless *
        intox *
        aided,
      // (And its old wear the slower as far as it knows the body past what its care uses: rules/demography.ts longerLived.)
      long = longerLived(lore.effect(p.cell, "health")),
      // (Its frail die the more for those no one keeps: society/care.ts. Exactly as before where none is reckoned.)
      old = oldPressOf(world, p.cell),
      // A band's chance of dying within the months, the same for every one of it (reckoned once).
      dying: number[] = [],
      dyingBoys: number[] = [],
      // (And what its diet goes short of: its young die the more, rules/nutrition.ts. Exactly 1 where it goes short of nothing.)
      want = dietDeaths(world, p.cell),
      // (And its young killed by the underworld: sim/order/underworld.ts. Exactly 1 where none is kept.)
      // (And by its other groups, its brigands' and pirates' killing and its risings': sim/order/groups.ts. Nothing where none.)
      // (And the sicknesses settled among its young: health/health.ts settle. Nothing where none.)
      killed =
        youngKilledOf(world, p.cell) +
        orgYoungKilledOf(world, p.cell) +
        (health?.land(p.cell)?.endemic ?? 0),
      pressOn = (b: number, sex: number) =>
        mortality *
        (b < 2 ? want.young : want.grown) *
        (old && b >= old.band ? old.press : 1) *
        (b >= kin.oldBand ? long : 1) *
        // (The young of those who sire die the more as the sexes' bodies differ: rules/species.ts boyRiskOf.)
        (sex === MALE && life.bands[b]! < life.adulthood ? boyRisk : 1) *
        (killed > 0 && youngBand(life, b) ? 1 + killed / Math.max(1e-4, life.mortality[b]!) : 1),
      dyingIn = (b: number, sex = FEMALE) =>
        sex === MALE && life.bands[b]! < life.adulthood && boyRisk !== 1
          ? (dyingBoys[b] ??= deathWithin(riskUnder(life.mortality[b]!, pressOn(b, MALE)), months))
          : (dying[b] ??= deathWithin(riskUnder(life.mortality[b]!, pressOn(b, FEMALE)), months)),
      d = new CountDeltas(p.counts),
      key = refHash(p.ref),
      // Under the hand, a village's people are born and die one by one; the rest by rates.
      windowed = handOf(world).composition(p.cell, year, ctx.life),
      rest = (r: number, o: number) =>
        p.counts.get(r, o) - (windowed ? windowed[r * COLS + o]! : 0);
    let expected = 0,
      bearers = 0,
      sires = 0;
    for (let b = 0; b < BANDS; b++) {
      if (!(life.fertility[b]! > 0)) continue;
      let women = p.counts.rowSum(row(FEMALE, b));
      if (windowed) for (let o = 0; o < COLS; o++) women -= windowed[row(FEMALE, b) * COLS + o]!;
      expected += women * life.fertility[b]!;
      bearers += women;
      sires += p.counts.rowSum(row(MALE, b));
    }
    // (A land short of grown sires bears the less, as far as its births wait on a mate: rules/demography.ts matedShare.)
    const mated = matedShare(kin.pairing, sires, bearers, kin.even),
      births = roundKeyed((expected * fertility * mated) / 12, world.rng.real(BIRTHS, key, t));
    if (births) {
      const [girls, boys] = multinomial(births, [girlsBorn, 1 - girlsBorn], (i) =>
        world.rng.real(BIRTHS, key, t, SEX, i),
      );
      // The months' newborns were born through them: those of them who died within them, by
      // the first years' chance spread over the months (the sires' young the more).
      const lostGirls = Math.min(
          girls!,
          roundKeyed(girls! * diedInBirthYear(dyingIn(0)), world.rng.real(DEATHS, key, t, 1, 0)),
        ),
        lostBoys = Math.min(
          boys!,
          roundKeyed(
            boys! * diedInBirthYear(dyingIn(0, MALE)),
            world.rng.real(DEATHS, key, t, 2, 0),
          ),
        ),
        infants = lostGirls + lostBoys;
      d.add(row(FEMALE, 0), OCC.dependent, girls! - lostGirls);
      d.add(row(MALE, 0), OCC.dependent, boys! - lostBoys);
      history.addBirths(p.cell, year, births);
      if (infants) history.addDeaths(p.cell, year, 0, infants);
    }
    for (let s = 0; s < SEXES; s++)
      for (let b = 0; b < BANDS; b++)
        for (let o = 0; o < COLS; o++) {
          const n = rest(row(s, b), o);
          if (!n) continue;
          const dead = Math.min(
            n,
            roundKeyed(n * dyingIn(b, s), world.rng.real(DEATHS, key, t, 0, row(s, b) * COLS + o)),
          );
          if (!dead) continue;
          d.add(row(s, b), o, -dead);
          history.addDeaths(p.cell, year, b, dead);
        }
    const w = windowed ? handOf(world).over(p.cell) : null;
    if (w) {
      // (Those grown and alone are paired first, so a child born has a father: M118.)
      pairUp(w.agents, year, life.adulthood);
      const living: typeof w.agents = [],
        byId = new Map(w.agents.map((a) => [a.id, a])),
        // (The young in a kind mother's or father's care die the less.)
        careOf = (id: number | undefined) => {
          const parent = id === undefined ? undefined : byId.get(id);
          return parent ? traitWeight(parent, "care") : 1;
        };
      for (const a of w.agents) {
        const band = bandOfAge(year - a.birthYear, life),
          blessed = a.blessedUntil !== undefined && year < a.blessedUntil,
          care = year - a.birthYear < life.adulthood ? careOf(a.mother) * careOf(a.father) : 1,
          // (The god's blessing or curse on them, their striking down: exactly as ever where no act holds, sim/acts/person.ts.)
          me = `agent:${a.id}`,
          by = hazardBy(world, me, w.village, year),
          smite = actOn(world, me, w.village, year, "smite"),
          draw = world.rng.real(HAND_VITAL, a.id, t, 0),
          chance = Math.min(1, dyingIn(band) * traitWeight(a, "death") * care * by);
        // (Over the months reckoned: the first month under the hand closes a stretch. What
        // they are like weighs on it: the hardy die the less, the frail the more.)
        if (
          ((!blessed && draw < chance) || smite) &&
          handDeath(world, {
            village: w.village,
            id: a.id,
            place: p.ref,
            t,
            year,
            age: year - a.birthYear,
            band,
            base: life.mortality[band]!,
            months,
            draw,
            chance,
            smite,
            // (The parts of the hazard, each the factor it laid, as the rule above made them: told on their page.)
            hazard: [
              ...(months === 1
                ? ([
                    ["hunger", 1 + 2.5 * ((1000 - p.fed) / 1000), p.lastFamine ?? null],
                    ["sickness sent", sickness, act?.event ?? null],
                    [
                      "a star's light, the sky",
                      pressure / ((1 + 2.5 * ((1000 - p.fed) / 1000)) * sickness),
                      null,
                    ],
                  ] as DeathPart[])
                : ([
                    ["the months' hunger and sickness", pressure, p.lastFamine ?? null],
                  ] as DeathPart[])),
              ["cold, poorly clothed", 1 + 0.25 * cold * bare, null],
              ["the healers' reach", healed, null],
              ["smoke", smoke, null],
              ["cold on the street", roofless, null],
              ["too much taken", intox, null],
              ["the aid of its societies", aided, null],
              ["what its diet goes short of", band < 2 ? want.young : want.grown, null],
              ["the frail no one keeps", old && band >= old.band ? old.press : 1, null],
              [
                KILLING,
                killed > 0 && youngBand(life, band)
                  ? 1 + killed / Math.max(1e-4, life.mortality[band]!)
                  : 1,
                null,
              ],
            ],
            after: [
              ["what they are like", traitWeight(a, "death"), null],
              ["a parent's care", care, null],
              ["the god's hand", by, null],
            ],
          })
        ) {
          d.add(row(a.sex, band), a.occupation, -1);
          history.addDeaths(p.cell, year, band, 1);
          // (Remembered, for their families' trees.)
          (w.gone ??= []).push({
            id: a.id,
            sex: a.sex,
            birthYear: a.birthYear,
            died: year,
            ...(a.mother !== undefined ? { mother: a.mother } : {}),
            ...(a.father !== undefined ? { father: a.father } : {}),
            ...(a.partner !== undefined ? { partner: a.partner } : {}),
            ...(a.traits?.length ? { traits: a.traits } : {}),
            ...(a.name ? { name: a.name } : {}),
          });
          if (w.gone.length > GONE_KEPT) w.gone.splice(0, w.gone.length - GONE_KEPT);
          continue;
        }
        living.push(a);
        // (A child comes the more to a couple either of whom is fertile.)
        const father = a.partner !== undefined ? byId.get(a.partner) : undefined;
        if (
          a.sex === FEMALE &&
          world.rng.real(HAND_VITAL, a.id, t, 1) <
            ((life.fertility[band]! * fertility) / 12) *
              traitWeight(a, "birth") *
              (father ? traitWeight(father, "birth") : 1) *
              // (A blessing on her doubles the chance of a child, a curse halves it: exactly 1 where none holds.)
              luckBy(world, me, w.village, year)
        ) {
          const id = w.next++,
            sex = newbornSex(world.rng.real(HAND_VITAL, id, t, 2));
          living.push({
            id,
            sex,
            birthYear: year,
            occupation: OCC.dependent,
            mother: a.id,
            ...(father ? { father: father.id } : {}),
            // (Their parents' ways in them by half, and now and then one of their own.)
            traits: drawTraits(
              (k) => world.rng.real(HAND_VITAL, id, t, 10 + k),
              [a.traits ?? [], father?.traits ?? []],
            ),
          });
          d.add(row(sex, 0), OCC.dependent, 1);
          history.addBirths(p.cell, year, 1);
        }
      }
      w.agents = living;
    }
    d.commit(p.counts);
  }
}

/**
 * The chance one under the hand would die within a month if it were reckoned now, by the parts vitalMonth lays on it: the month's
 * hunger and sickness as they stand, and the slower parts as vitalMonth reads them. A reading for their page ("At risk now"):
 * it moves nothing, and a month reckoned later reads the month as it then is.
 */
export function handHazardNow(
  ctx: PopulationContext,
  cell: number,
  a: Agent,
  care: number,
): {
  readonly band: number;
  readonly base: number;
  readonly hazard: readonly DeathPart[];
  readonly after: readonly DeathPart[];
  readonly chance: number;
} | null {
  const { world } = ctx,
    p = ctx.provinces.get(cell);
  if (!p) return null;
  const t = world.now,
    life = ctx.life,
    year = yearOfMoment(t),
    markets = marketsOf(world),
    act = actsOf(world).at(cell, "plague", t),
    sickness = !act
      ? 1
      : act.sign < 0
        ? actFactor(true, ACT_STRENGTH.plague, act.strength)
        : actFactor(false, ACT_STRENGTH.healing, act.strength),
    hunger = 1 + 2.5 * ((1000 - p.fed) / 1000),
    sky = underStar(ctx, cell) * frontierSky(ctx, cell),
    cold = dmath.clamp((10 - ctx.generated.climate.temperature[cell]!) / 10, 0, 1),
    bare = (1 - (markets.get(cell)?.clothingCover ?? 1000) / 1000) * bodyCoat(ctx),
    band = bandOfAge(year - a.birthYear, life),
    want = dietDeaths(world, cell),
    old = oldPressOf(world, cell),
    killed = youngKilledOf(world, cell) + orgYoungKilledOf(world, cell),
    by = hazardBy(world, `agent:${a.id}`, handOf(world).over(cell)?.village ?? null, year),
    hazard: DeathPart[] = [
      ["hunger", hunger, p.lastFamine ?? null],
      ["sickness sent", sickness, act?.event ?? null],
      ["a star's light, the sky", sky, null],
      ["cold, poorly clothed", 1 + 0.25 * cold * bare, null],
      ["the healers' reach", healedIn(world, cell), null],
      ["smoke", 1 + 0.3 * smokeIn(ctx, cell), null],
      ["cold on the street", rooflessColdOf(world, cell), null],
      ["too much taken", 1 + 25 * intoxDeaths(world, cell), null],
      ["the aid of its societies", 1 - orgSparedOf(world, cell), null],
      ["what its diet goes short of", band < 2 ? want.young : want.grown, null],
      ["the frail no one keeps", old && band >= old.band ? old.press : 1, null],
      [
        KILLING,
        killed > 0 && youngBand(life, band)
          ? 1 + killed / Math.max(1e-4, life.mortality[band]!)
          : 1,
        null,
      ],
    ],
    after: DeathPart[] = [
      ["what they are like", traitWeight(a, "death"), null],
      ["a parent's care", care, null],
      ["the god's hand", by, null],
    ],
    m = hazard.reduce((x, q) => x * q[1], 1),
    chance = Math.min(
      1,
      deathWithin(riskUnder(life.mortality[band]!, m), 1) * after.reduce((x, q) => x * q[1], 1),
    );
  return { band, base: life.mortality[band]!, hazard, after, chance };
}

/**
 * How much of what its bodies could bear a people bears (rules/children.ts): as many as it wants living, the fewer the more
 * of its young live and the more each costs to raise, schooled before it works and its work not wanted where machines do it.
 */
/**
 * What a land's people keep of their fertility by what they have put by (rules/seasons.ts): the
 * months of eating in its store now, against what they need to reach the reaping, by the share of
 * the food its books say it made in the year that was reaped. (1: no market, no mouths, or a year
 * with nothing made to read.)
 */
export function putBy(ctx: PopulationContext, p: Province, m: Market | undefined): number {
  const need = mouths(p, ctx.life);
  if (!m || need <= 0) return 1;
  let made = 0;
  for (const g of FOODS) made += m.book("made", g);
  if (made <= 0) return 1;
  return thrift(m.food(FOODS) / need, m.book("made", G.grain) / made);
}

export function transition(ctx: PopulationContext, cell: number): number {
  // (And the children more its mothers want where only their children would keep them old: society/care.ts. 0 where none is kept.)
  const keeps = childrenKept(
      ctx.life,
      slowDeaths(ctx, cell),
      raisingCost(ctx, cell),
      oldAgeWantOf(ctx.world, cell),
    ),
    lore = loreOf(ctx.world);
  // Past our ages (Phase 66): nothing here runs short any more, and what a people then does is its choice.
  if (lore.get(cell, "made-bodies")) return Math.max(keeps, WRITTEN_KEEPS);
  return lore.get(cell, "fusion-power") ? Math.max(keeps, FLAME_KEEPS) : keeps;
}
/**
 * What a people with a held flame keeps of its fertility: a little more than replaces it. Fuel no longer
 * thins it out; nothing yet makes more of it than it would have of its own.
 */
const FLAME_KEEPS = 0.72;
/** What a people that writes and grows its children keeps: each one wanted is made, whatever it can bear. */
const WRITTEN_KEEPS = 0.95;

/**
 * What a land's young cost to raise (rules/children.ts childCost): those of its people who read, its machines' share of its work,
 * and the work its mothers give up for them away from home (the society sweep, society/roles.ts; 0 where none is kept).
 */
export function raisingCost(ctx: PopulationContext, cell: number): number {
  return childCost(readersOf(ctx.world, cell), machineShare(ctx, cell), forgoneOf(ctx.world, cell));
}

/** What a land's care spares of its deaths (society/care.ts), or, where none is reckoned, all its healing lore as before. */
function healedIn(world: World, cell: number): number {
  // (And what its healers of name spare besides: sim/notable. Exactly as before where no one is kept.)
  return (
    (1 - (careSparedOf(world, cell) ?? Math.min(0.3, loreOf(world).effect(cell, "health")))) *
    notableHeals(world, cell)
  );
}

/** How much of the cold a people's own coat leaves to clothes (rules/dress.ts; a bare skin's, 1). */
function bodyCoat(ctx: PopulationContext): number {
  return coatOf(ctx.generated.life.people?.body?.skin);
}

/**
 * Of the work a land turned last year, the share done by engines and the current: not by its bodies or its beasts, nor by its
 * mills. A wheel in a stream or a sail on a hill grinds, fulls and saws where it stands, grown men's work; a child's is in the
 * fields, with the herds, at the wheel and the loom, and goes only when engines take those. (Counted with the mills, first
 * light's work was half machines' by 600, before its first steam engine, and its people wanted no more children than replace
 * them while most of their young still died: 49 million at 600 against 134 million released.)
 */
export function machineShare(ctx: PopulationContext, cell: number): number {
  const e = energyPerHead(ctx.world, cell);
  return e && e.work > 0 ? dmath.clamp(1 - (e.sources.none + e.sources.mills) / e.work, 0, 1) : 0;
}

/** How pressing a land's deaths are, of what changes slowly: the cold on the ill-clothed, medicine, smoke (as vitalMonth reads them). */
export function slowDeaths(ctx: PopulationContext, cell: number): number {
  const cold = dmath.clamp((10 - ctx.generated.climate.temperature[cell]!) / 10, 0, 1),
    bare = (1 - (marketsOf(ctx.world).get(cell)?.clothingCover ?? 1000) / 1000) * bodyCoat(ctx),
    healed = healedIn(ctx.world, cell),
    smoke = 1 + 0.3 * smokeIn(ctx, cell),
    p = ctx.provinces.get(cell),
    adapted = p
      ? adaptedOf(yearOfMoment(ctx.world.now) - p.settledYear, peopleKin(ctx.generated).generation)
      : 1,
    heights =
      ctx.medium === "land" ? heightsToll(ctx.generated.tectonics.elevation[cell]!, adapted) : 1;
  return (1 + 0.25 * cold * bare * coldFelt(adapted)) * heights * healed * smoke;
}

/**
 * A land's numbers by its people's body, as vitalMonth reads them (rules/demography.ts): its grown sires to a bearer of bearing
 * age and the share of its births that leaves, how far it has taken to its land and what the heights and the cold still cost it,
 * and what knowing the body spares its old.
 */
export function landDemography(
  ctx: PopulationContext,
  cell: number,
): {
  sires: number;
  mated: number;
  adapted: number;
  heights: number;
  cold: number;
  long: number;
} | null {
  const p = ctx.provinces.get(cell);
  if (!p) return null;
  const life = ctx.life,
    kin = peopleKin(ctx.generated);
  let bearers = 0,
    sires = 0;
  for (let b = 0; b < BANDS; b++)
    if (life.fertility[b]! > 0) {
      bearers += p.counts.rowSum(row(FEMALE, b));
      sires += p.counts.rowSum(row(MALE, b));
    }
  const adapted = adaptedOf(yearOfMoment(ctx.world.now) - p.settledYear, kin.generation);
  return {
    sires: bearers > 0 ? sires / bearers : 1,
    mated: matedShare(kin.pairing, sires, bearers, kin.even),
    adapted,
    heights:
      ctx.medium === "land" ? heightsToll(ctx.generated.tectonics.elevation[cell]!, adapted) : 1,
    cold: coldFelt(adapted),
    long: longerLived(loreOf(ctx.world).effect(cell, "health")),
  };
}

/** Below this share of the food it needs (in thousandths), a land's month is a famine. */
export const FAMINE = 700;

/** Weather, yearly: each province's rain for the coming year; a dry one is a drought. */
export function weatherYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    acts = actsOf(world);
  for (const p of ctx.provinces.all()) {
    // Sealed halls on another world have no rain to fail.
    if (offworldSite(ctx.generated, p.cell)) {
      p.rain = 1000;
      continue;
    }
    // Rain withheld or sent by the god's hand moves the year's rain.
    const act = acts.at(p.cell, "rain", t),
      key = refHash(p.ref),
      g = gaussian(world.rng.real(RAIN, key, t, 0), world.rng.real(RAIN, key, t, 1)),
      // The warming moves a land's rain (drier or wetter), and the year's weather about it.
      // (And the soot of a great fire, W5: exactly 1 under a clear sky.)
      moved =
        rainShift(ctx, p.cell) *
        darkRain(world) *
        frontierRain(world) *
        longRain(ctx, p.cell, yearOfMoment(t)),
      // (A land its monsoon waters gets its year's rain in one season, and the season fails some years: rules/storms.ts.)
      monsoon = monsoonOf(
        ctx.generated.climate.seasonality[p.cell]!,
        (ctx.generated.grid.lat[p.cell]! * 180) / Math.PI,
        ctx.generated.climate.inland[p.cell]!,
      ),
      natural = dmath.clamp(moved * (1 + 0.22 * (1 + MONSOON.swings * monsoon) * g), 0.35, 1.6),
      rain = act ? natural * actFactor(act.sign > 0, ACT_STRENGTH.rain, act.strength) : natural;
    p.rain = Math.round(rain * 1000);
    if (rain < 0.72) {
      const causes: CauseRef[] = [];
      if (act && act.sign < 0) causes.push({ ref: act.event, role: "agent", weight: 0.8 });
      // A land the warming has dried has its droughts the oftener.
      const drier = rainShift(ctx, p.cell) < 1 ? airOf(world).shiftOf(p.cell) : null;
      if (drier) causes.push({ ref: drier, role: "pressure", weight: 0.3 });
      // (A dry year under the dark: the fire behind it.)
      const dark = darkCause(world);
      if (dark) causes.push({ ref: dark, role: "pressure", weight: 0.6 });
      causes.push({ ref: p.ref, role: "constraint", weight: act && act.sign < 0 ? 0.2 : 1 });
      p.lastDrought = world.events.emit({
        type: POPULATION_EVENTS.drought.type,
        importance: rain < 0.55 ? 4 : 3,
        place: p.ref,
        causes,
        data:
          monsoon >= 0.3 ? { rain: p.rain, monsoon: Math.round(monsoon * 100) } : { rain: p.rain },
      });
    }
  }
}

/** Ageing and coming of age, yearly. */
export function ageYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    life = ctx.life;
  for (const p of ctx.provinces.all()) {
    const d = new CountDeltas(p.counts),
      key = refHash(p.ref),
      targets = occupationTargets(
        p,
        provinceCapacity(ctx, p.cell),
        ctx.settlements.inProvince(p.cell).length,
        marketsOf(world).wagesOf(p.cell),
        farmingShare(ctx, p),
        fieldsUse(ctx, p),
      ),
      year = yearOfMoment(t),
      windowed = handOf(world).composition(p.cell, year, ctx.life);
    for (let s = 0; s < SEXES; s++)
      for (let b = 0; b < BANDS - 1; b++) {
        const comingOfAge = life.bands[b + 1]! === life.adulthood;
        for (let o = 0; o < COLS; o++) {
          const n = p.counts.get(row(s, b), o) - (windowed ? windowed[row(s, b) * COLS + o]! : 0);
          if (!n) continue;
          const movers = Math.min(
            n,
            roundKeyed(
              n / bandWidth(b, life),
              world.rng.real(AGEING, key, t, 0, row(s, b) * COLS + o),
            ),
          );
          if (!movers) continue;
          d.add(row(s, b), o, -movers);
          if (comingOfAge && o === OCC.dependent) {
            multinomial(movers, targets, (i) =>
              world.rng.real(AGEING, key, t, row(s, b), i),
            ).forEach((m, k) => d.add(row(s, b + 1), k, m));
          } else d.add(row(s, b + 1), o, movers);
        }
      }
    // Under the hand, each ages by their own years, and takes up work as they come of age.
    const w = windowed ? handOf(world).over(p.cell) : null;
    if (w)
      for (const a of w.agents) {
        const was = bandOfAge(year - a.birthYear, life),
          now = bandOfAge(year + 1 - a.birthYear, life);
        if (now === was) continue;
        d.add(row(a.sex, was), a.occupation, -1);
        if (a.occupation === OCC.dependent && life.bands[now]! >= life.adulthood)
          // (What they are like draws them to their work: the clever to a craft.)
          a.occupation = weightedIndex(
            workWeights(targets, a),
            world.rng.real(HAND_VITAL, a.id, t, 3),
          );
        d.add(row(a.sex, now), a.occupation, 1);
      }
    d.commit(p.counts);
  }
}

/** Work, yearly: adults drift toward the occupations their society needs. */
export function workYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx;
  for (const p of ctx.provinces.all()) {
    // The hand's people keep the work they took up: only the rest change theirs.
    const windowed = handOf(world).composition(p.cell, Math.floor(t / YEAR), ctx.life),
      rest = (r: number, o: number) =>
        p.counts.get(r, o) - (windowed ? windowed[r * COLS + o]! : 0);
    let grown = adults(p, ctx.life);
    if (windowed)
      for (let r = 0; r < ROWS; r++)
        if (ctx.life.bands[r % BANDS]! >= ctx.life.adulthood)
          for (let o = 0; o < COLS; o++) grown -= windowed[r * COLS + o]!;
    if (!grown) continue;
    const key = refHash(p.ref),
      targets = occupationTargets(
        p,
        provinceCapacity(ctx, p.cell),
        ctx.settlements.inProvince(p.cell).length,
        marketsOf(world).wagesOf(p.cell),
        farmingShare(ctx, p),
        fieldsUse(ctx, p),
      );
    // (Each sex toward its own shares of the work, where the land's roles are kept: the society sweep, society/work.ts.)
    if (workBySex(ctx, p, targets, windowed, key, t)) continue;
    const desired = apportion(grown, targets, (k) => world.rng.u32(WORK, key, t, 0, k));
    const current = new Array<number>(COLS).fill(0);
    const adultRows: number[] = [];
    for (let s = 0; s < SEXES; s++)
      for (let b = 0; b < BANDS; b++)
        if (ctx.life.bands[b]! >= ctx.life.adulthood) {
          adultRows.push(row(s, b));
          for (let o = 1; o < COLS; o++) current[o] = current[o]! + rest(row(s, b), o);
        }
    const surplus = current.map((c, o) => (o === 0 ? 0 : Math.max(0, c - desired[o]!))),
      deficit = current.map((c, o) => (o === 0 ? 0 : Math.max(0, desired[o]! - c))),
      totalSurplus = surplus.reduce((a, b) => a + b, 0),
      totalDeficit = deficit.reduce((a, b) => a + b, 0),
      moving = Math.min(totalSurplus, totalDeficit, Math.ceil(grown * 0.1));
    if (moving <= 0) continue;
    const d = new CountDeltas(p.counts),
      out = apportion(moving, surplus, (o) => world.rng.u32(WORK, key, t, 1, o)),
      into = apportion(moving, deficit, (o) => world.rng.u32(WORK, key, t, 2, o));
    // Take each occupation's leavers from its rows, then hand them to the others in
    // proportion to the need, row by row.
    const leavers = new Array<number>(adultRows.length).fill(0);
    out.forEach((n, o) => {
      if (!n) return;
      const byRow = drawWithoutReplacement(
        n,
        adultRows.map((r) => rest(r, o)),
        (i) => world.rng.real(WORK, key, t, 3 + o, i),
      );
      byRow.forEach((m, i) => {
        d.add(adultRows[i]!, o, -m);
        leavers[i] = leavers[i]! + m;
      });
    });
    const intoRemaining = [...into];
    leavers.forEach((n, i) => {
      if (!n) return;
      const share = apportion(n, intoRemaining, (o) => world.rng.u32(WORK, key, t, 4, i * 16 + o));
      share.forEach((m, o) => {
        d.add(adultRows[i]!, o, m);
        intoRemaining[o] = Math.max(0, intoRemaining[o]! - m);
      });
    });
    d.commit(p.counts);
  }
}

/** What drives a land's people from it, past hunger: a battle fought there, a siege, a raid on the posted, a sack, a quake, an
 * eruption, a fire, a stone from the sky (the rest of flight's causes: ./flight.ts). Not a flood: its people go back as the
 * waters fall. (Taken as a land's ruin, floods sent first light's cradle into its empty lands at ten times the pace: 205 moves
 * in its first sixty years where there had been 22, and 36 lands peopled where there had been 15.) */
const FLED_FROM: ReadonlySet<string> = new Set([
  "war.battle",
  "war.strike",
  "war.siege",
  "war.raid",
  "act.quake",
  "act.fire",
  "act.meteor",
  "wild.fire",
  "planet.eruption",
]);
/** How hard what struck a land pushes its people to leave it (hunger at its worst pushes 0.6; six in a hundred go a year at most). */
const FLEE = 0.5;
/** The land a place's ref names (cell:0:<n>). */
const placeCell = (place: string): number => Number(place.slice(place.lastIndexOf(":") + 1));

type PlannedFlow = {
  from: Province;
  to: number;
  count: number;
  moved: number[];
  factors: Factor[];
  pressure: number;
  why?: "war" | "faith" | "wages" | undefined;
  /** How strongly the wages drew them (0 … 1), told on the event where no decision is kept. */
  pull?: number;
};
/**
 * A move's factors, at most six (the kernel's limit): as they always were where neither a law against their faith nor wages
 * moved them; else those that moved them, the land they went to last, the least let go first.
 */
function sixOf(fs: Factor[]): Factor[] {
  const NEW = 2,
    last = fs.length - 1,
    old = fs.filter((x, i) => i < last - NEW || i === last);
  if (fs.slice(last - NEW, last).every((x) => !(x.contribution > 0))) return old;
  const kept = fs.filter((x, i) => x.contribution > 0 || i === last);
  while (kept.length > 6) {
    let k = 0;
    for (let i = 1; i < kept.length - 1; i++)
      if (kept[i]!.contribution < kept[k]!.contribution) k = i;
    kept.splice(k, 1);
  }
  return kept;
}
/** A land a land's people may go to: how much better it feeds them, what it is worth to them all told, its wage's draw. */
type Option = {
  cell: number;
  attraction: number;
  score: number;
  wage: number;
  refuge: boolean;
  /** How far its gates let them through (./flight.ts throughGates; 1 within the realm). */
  open: number;
};

/** Migration, yearly: every move is planned from the year's opening state, then made. */
export function migrateYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g, history } = ctx,
    year = yearOfMoment(t),
    planned: PlannedFlow[] = [],
    // (War, ruin, a law against their faith, the hope of wages: ./flight.ts.)
    flight = flightYear(ctx);
  const peopled = (cell: number) => ctx.provinces.get(cell);
  // What the land feeds is in food; a people's mouths are their numbers by their appetite.
  const appetite = ctx.life.appetite;
  // The lands a battle, a sack, a quake, a fire or a stone from the sky struck in the year gone: their people flee it, as
  // well as hunger (round "peoples": refugees). The year's events, read back from the latest.
  const struck = new Map<number, Ref>(),
    // (Of them, the lands fought over: a battle, a siege, a raid on the posted. Those who flee war take what land is safe.)
    fought = new Set<number>();
  for (let i = world.events.count - 1; i >= 0; i--) {
    const e = world.events.at(i);
    if (e.t < t - YEAR) break;
    if (!e.place || !FLED_FROM.has(e.type)) continue;
    const c = placeCell(e.place);
    if (WAR_FLIGHT.has(e.type)) fought.add(c);
    if (!struck.has(c)) struck.set(c, e.id);
  }
  for (const p of ctx.provinces.all()) {
    // (A stream that went last year can go on this one; one that did not has ended.)
    if (p.going.length && p.going.some((s) => s.year < year - 1))
      p.going = p.going.filter((s) => s.year >= year - 1);
    const pop = p.total();
    if (pop < 20) continue;
    const eating = mouths(p, ctx.life),
      c = living(provinceCapacity(ctx, p.cell), wildsOf(ctx, p.cell)),
      here = support(c, p.knowsCultivation, p.herding !== null),
      hunger = 1 - p.leanest / 1000,
      crowd = Math.max(0, eating / Math.max(1, here) - 0.85),
      // Young foraging bands bud off into empty land long before hunger drives them, once
      // their land holds a quarter of what the wild can feed. (Farmers spreading across
      // continents waits on the whole planet peopled and paged: milestones 29–30.)
      budding = p.knowsCultivation
        ? 0
        : Math.min(0.3, Math.max(0, eating / Math.max(1, c.forage) - 0.25)),
      // (And a mine's end, for those who worked it: E1.)
      leaving = lodePush(world, p.cell, year),
      // (And what struck it: war, a sack, the ground's shaking, fire.)
      ruin = struck.get(p.cell) ?? null,
      fleeing = ruin ? FLEE : 0,
      // (And in its own year of FLIGHT.every, a law against their faith and the hope of a neighbour's wages, the years' at
      // once: ./flight.ts.)
      season = weighsWages(p.cell, year),
      faith = season ? flight.persecuted(p.cell) : null,
      // (Those a law against their faith drives go only to a haven: their push is their own, not the land's.)
      persecuted = faith ? faith.push * FLIGHT.every : 0,
      pushed = 0.6 * hunger + crowd + leaving + fleeing,
      pressure = pushed + budding,
      own = season ? flight.wageOf(p.cell) : 0,
      war = fought.has(p.cell);
    if (pressure < 0.05 && !(own > 0) && !(persecuted > 0)) continue;
    const driven = pressure >= 0.05;
    // Budding goes only to empty land; those pushed by hunger or crowding go anywhere better.
    const buddingOnly = pushed < 0.05;
    const perHere = here / eating;
    const options: Option[] = [];
    // Their neighbours — and, for a people of the water, the shelves a reach of barren
    // deep sea away (as far as a people of the land crosses a strait).
    const reach: number[] = [];
    for (let k = g.grid.offsets[p.cell]!; k < g.grid.offsets[p.cell + 1]!; k++) {
      const m = g.grid.neighbours[k]!;
      if (livableFor(ctx, m)) reach.push(m);
      else if (ctx.medium === "water")
        for (let j = g.grid.offsets[m]!; j < g.grid.offsets[m + 1]!; j++) {
          const far = g.grid.neighbours[j]!;
          if (far !== p.cell && !reach.includes(far) && livableFor(ctx, far)) reach.push(far);
        }
    }
    for (const m of reach) {
      const there = support(
          living(provinceCapacity(ctx, m), wildsOf(ctx, m)),
          p.knowsCultivation,
          p.herding !== null,
        ),
        others = (peopled(m)?.total() ?? 0) * appetite,
        attraction = there / (others + appetite) - perHere;
      if (!(there > 20)) continue;
      // (Fleeing ruin or a law against their faith, safety first: a land not struck, a haven for their faith, even one that
      // feeds them worse. Hoping for wages, a peopled land that pays well past their own and feeds them no worse.)
      const refuge =
          (war || persecuted > 0) &&
          attraction > -FLIGHT.refuge &&
          !struck.has(m) &&
          (persecuted <= 0 || (faith?.faith != null && flight.haven(p.cell, m, faith.faith))),
        wage =
          own > 0 && attraction > -FLIGHT.hungrier && peopled(m) ? flight.drawn(p.cell, m, own) : 0,
        better = driven && attraction > 0.05 - leaving && (!buddingOnly || !peopled(m));
      if (!(better || refuge || wage > 0)) continue;
      // (Over a border, as far as the gates of the realm they leave and the realm they come to let them: ./flight.ts.)
      const open = throughGates(world, p.cell, m, refuge && war);
      if (open < 0.05) continue;
      options.push({
        cell: m,
        attraction,
        // (As before where only food draws them, and no gate bars them.)
        score: (attraction + (refuge && !better ? FLIGHT.refuge : 0) + wage) * open,
        wage,
        refuge,
        open,
      });
    }
    if (!options.length) continue;
    options.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.cell - b.cell));
    // Those under the hand stay: movers come from the rest.
    const windowed = handOf(world).composition(p.cell, Math.floor(t / YEAR), ctx.life),
      held = windowed ? windowed.reduce((a, b) => a + b, 0) : 0;
    // (Those the hope of wages draws: of the land's people, FLIGHT.wage a year as the best of them pays, the years' at once,
    // to the one land that pays best where nothing else drives them.)
    const drawn = options.reduce((m, o) => Math.max(m, o.wage), 0),
      hope = FLIGHT.wage * FLIGHT.every * drawn,
      // (And those a law against their faith drives, where a haven is near.)
      fled = persecuted > 0 && options.some((o) => o.refuge) ? persecuted * 0.08 : 0,
      drive = (driven ? pressure : 0) + (hope + fled) / 0.08,
      key = refHash(p.ref),
      // (As many as the gates let through the most open way they have: all of them where one is within their realm.)
      opened = options.reduce((m, o) => Math.max(m, o.open), 0),
      movers = Math.min(
        pop - held,
        Math.floor(pop * Math.min(0.06, (driven ? pressure * 0.08 : 0) + hope + fled) * opened),
      );
    if (movers < MIN_GROUP) continue;
    if (leaving > 0) lodesOf(world)!.tally.left += Math.round((movers * leaving) / pressure);
    // A band that sets out is at least MIN_GROUP strong: a small exodus goes one way.
    // (Those the hope of wages takes, more than all else, go together to the one land that pays best.)
    const best = options.slice(
      0,
      driven && hope + fled < pressure * 0.08
        ? Math.max(1, Math.min(3, Math.floor(movers / MIN_GROUP)))
        : 1,
    );
    const split = apportion(
      movers,
      // (Those leaving a worked-out land take a land no better than their own: E1.)
      best.map((o) => Math.max(0.001, o.score)),
      (k) => world.rng.u32(MOVES, key, t, 0, best[k]!.cell),
    );
    // Who goes: in proportion to every sex, age and occupation.
    const cells = ROWS * COLS,
      counts = new Array<number>(cells);
    for (let r = 0; r < ROWS; r++)
      for (let o = 0; o < COLS; o++)
        counts[r * COLS + o] = p.counts.get(r, o) - (windowed ? windowed[r * COLS + o]! : 0);
    const everyone = drawWithoutReplacement(movers, counts, (i) =>
      world.rng.real(MOVES, key, t, 1, i),
    );
    const remaining = [...everyone];
    best.forEach((o, i) => {
      const count = split[i]!;
      if (!count) return;
      const moved = drawWithoutReplacement(count, remaining, (j) =>
        world.rng.real(MOVES, key, t, 2 + i, j),
      );
      moved.forEach((m, j) => (remaining[j] = remaining[j]! - m));
      const drought = p.lastDrought ? world.events.get(p.lastDrought) : undefined,
        famine = p.lastFamine ? world.events.get(p.lastFamine) : undefined;
      // (Of them, those who fled what struck the land, or its hunger in a famine's years: kept by where they came to, sim/war/held.ts.)
      if (ruin)
        noteFled(
          world,
          p.cell,
          o.cell,
          (count * fleeing) / drive,
          fledKind(world, ruin),
          ruin,
          year,
        );
      else if (famine && t - famine.t < 2 * YEAR && hunger > 0.3)
        noteFled(world, p.cell, o.cell, (count * 0.6 * hunger) / drive, "hunger", famine.id, year);
      // (And those who fled a law against their faith, where they found a haven.)
      if (persecuted > 0 && o.refuge && faith?.cause)
        noteFled(world, p.cell, o.cell, (count * persecuted) / drive, "faith", faith.cause, year);
      planned.push({
        from: p,
        to: o.cell,
        count,
        moved,
        pressure: drive,
        // (What a page tells them by, where it is not hunger or better land: war, a law against their faith, wages.)
        why:
          o.refuge && war
            ? "war"
            : o.refuge && persecuted > 0
              ? "faith"
              : o.wage > 0
                ? "wages"
                : undefined,
        ...(o.wage > 0 ? { pull: o.wage } : {}),
        factors: sixOf([
          {
            name: "hunger",
            value: hunger,
            contribution: 0.6 * hunger,
            source:
              famine && t - famine.t < 2 * YEAR
                ? { ref: famine.id, role: "pressure", weight: 1 }
                : null,
          },
          // (Crowded, for what let them grow so many: their sowing, or else their coming here.)
          {
            name: "crowding",
            value: crowd,
            contribution: crowd,
            source:
              crowd > 0 && (p.cultivation ?? p.arrival)
                ? { ref: (p.cultivation ?? p.arrival)!, role: "enabler", weight: 1 }
                : null,
          },
          {
            name: "young bands seeking their own grounds",
            value: budding,
            contribution: budding,
            source: null,
          },
          {
            name: "a dry year",
            value: 1 - p.rain / 1000,
            contribution: Math.max(0, 0.3 * (1 - p.rain / 1000)),
            source:
              drought && t - drought.t < YEAR + MONTH
                ? { ref: drought.id, role: "trigger", weight: 1 }
                : null,
          },
          {
            name: "fleeing war or ruin",
            value: fleeing,
            contribution: fleeing,
            source: ruin ? { ref: ruin, role: "trigger", weight: 1 } : null,
          },
          {
            name: "a law against their faith",
            value: persecuted,
            contribution: persecuted,
            source:
              persecuted > 0 && faith?.cause
                ? { ref: faith.cause, role: "pressure", weight: 1 }
                : null,
          },
          {
            name: "wages that draw them",
            value: o.wage,
            contribution: o.wage > 0 ? hope / 0.08 : 0,
            source: o.wage > 0 ? { ref: cellRef(0, o.cell), role: "enabler", weight: 1 } : null,
          },
          {
            name: "better land",
            value: o.attraction,
            contribution: 0.2 * o.attraction,
            source: { ref: cellRef(0, o.cell), role: "enabler", weight: 1 },
          },
        ]),
      });
    });
  }
  // Make the moves. A stream that goes on as it set out (as many, within half and twice, to the same land, the year after
  // last) is told once, when it set out: the year's move goes under that event (Province.going).
  for (const f of planned) {
    const stream = f.from.going.find((s) => s.to === f.to),
      goesOn =
        !!stream &&
        stream.year === year - 1 &&
        2 * f.count >= stream.count &&
        f.count <= 2 * stream.count;
    let decision: Ref | undefined, event: Ref;
    if (goesOn) {
      stream.year = year;
      event = stream.event;
      decision = stream.decision;
    } else {
      // (A move the hope of wages made (a land weighs its neighbours' wages once in a generation, and sends one band to the land
      // that pays best) is told by its event alone, how strongly the wages drew them folded into it: a decision for each, at
      // 1,500 half of the moves the ledger holds for living memory, was some megabytes of the world. Those that war, a law
      // against their faith, hunger or crowding drove keep their decision and its factors.)
      decision =
        f.why === "wages"
          ? undefined
          : world.decisions.record({
              rule: "population.migrate",
              subject: f.from.ref,
              outcome: { to: cellRef(0, f.to), count: f.count },
              score: f.pressure,
              threshold: 0.05,
              factors: f.factors,
            });
      event = world.events.emit({
        type: POPULATION_EVENTS.migration.type,
        importance: f.count >= 200 ? 3 : 2,
        subjects: [f.from.ref, cellRef(0, f.to)],
        place: f.from.ref,
        causes: decision ? [{ ref: decision, role: "trigger", weight: 1 }] : [],
        data: {
          count: f.count,
          ...(f.why ? { why: f.why } : {}),
          ...(!decision && f.pull ? { pull: Math.round(f.pull * 100) } : {}),
        },
      });
      f.from.going = [
        ...f.from.going.filter((s) => s.to !== f.to && s.year >= year - 1),
        { to: f.to, event, ...(decision ? { decision } : {}), year, count: f.count },
      ];
    }
    let dest = ctx.provinces.get(f.to);
    if (!dest) {
      dest = ctx.provinces.add(new Province(f.to, year, event));
      world.events.emit({
        type: POPULATION_EVENTS.peopled.type,
        place: dest.ref,
        causes: [{ ref: event, role: "trigger", weight: 1 }],
        data: { people: f.count },
      });
    }
    // Migrants carry what they know, and their share of what their people have.
    if (f.from.knowsCultivation && !dest.knowsCultivation) {
      dest.knowsCultivation = true;
      dest.cultivation = f.from.cultivation;
    }
    if (f.from.herding && !dest.herding) dest.herding = f.from.herding;
    const markets = marketsOf(world),
      from = markets.of(f.from.cell),
      to = markets.of(f.to),
      people = Math.max(1, f.from.total());
    for (let g = 0; g < GOODS.length; g++)
      to.move(
        "carriedIn",
        g,
        from.move("carriedOut", g, Math.floor((from.stock[g]! * f.count) / people)),
      );
    if (from.metalworking && !to.metalworking) to.metalworking = from.metalworking;
    const byOccupation = new Array<number>(COLS).fill(0);
    f.moved.forEach((m, i) => {
      if (!m) return;
      const r = Math.floor(i / COLS),
        o = i % COLS;
      f.from.counts.add(r, o, -m);
      dest.counts.add(r, o, m);
      byOccupation[o] = byOccupation[o]! + m;
    });
    history.addFlow({
      from: f.from.cell,
      to: f.to,
      year,
      count: f.count,
      byOccupation,
      ...(decision ? { decision } : {}),
      event,
      ...(f.why ? { brief: 1 as const } : {}),
    });
  }
}

/** How much less readily gardens of roots and fruit are found than a wild grain is sown. */
export const GARDENS = 0.25;

/**
 * Cultivation, yearly: found under pressure on good land where a grass with seed
 * heavy enough to sow grows wild, or learned from neighbours. Herding likewise: found
 * where a beast that can be tamed lives, or learned.
 */
export function knowledgeYear(ctx: PopulationContext, t: SimTime): void {
  herdingYear(ctx, t);
  const { world, generated: g } = ctx,
    year = yearOfMoment(t),
    learned: { p: Province; from: Province | null; chance: number; crowd: number; soil: number }[] =
      [];
  for (const p of ctx.provinces.all()) {
    if (p.knowsCultivation || p.total() < 10) continue;
    const key = refHash(p.ref);
    const teachers: Province[] = [];
    for (let k = g.grid.offsets[p.cell]!; k < g.grid.offsets[p.cell + 1]!; k++) {
      const n = ctx.provinces.get(g.grid.neighbours[k]!);
      if (n?.knowsCultivation && n.cultivation) teachers.push(n);
    }
    // (And across the sea, from those its ships trade with: War past the line, W2.)
    for (const c of marketsOf(world).seaPartners(p.cell)) {
      const n = ctx.provinces.get(c);
      if (n?.knowsCultivation && n.cultivation) teachers.push(n);
    }
    if (teachers.length) {
      if (world.rng.chance(Math.min(0.6, 0.12 * teachers.length), KNOW, key, t, 1))
        learned.push({ p, from: teachers[0]!, chance: 0, crowd: 0, soil: 0 });
      continue;
    }
    if (year - p.settledYear < 15) continue;
    // Sowing is found where a grass with seed heavy enough to sow grows wild; for a people
    // of the water, where the shelf holds beds of weed and shell to tend; and where
    // neither, in gardens of the land's own roots and fruit (as taro, yam and manioc were
    // first tended), less readily.
    const grass = g.life.seedGrass[p.cell]!,
      beds = ctx.medium !== "land" && g.tectonics.elevation[p.cell]! <= 0,
      garden = grass < 0 && !beds;
    const c = provinceCapacity(ctx, p.cell),
      soil = dmath.clamp(c.farm / Math.max(1, c.areaKm2 * 12), 0, 1),
      crowd = mouths(p, ctx.life) / Math.max(1, c.forage),
      chance =
        0.004 *
        soil *
        (1 + 6 * Math.max(0, crowd - 0.6)) *
        (p.lastFamine ? 1.5 : 1) *
        (garden ? GARDENS : 1);
    if (world.rng.chance(chance, KNOW, key, t, 0))
      learned.push({ p, from: null, chance, crowd, soil });
  }
  for (const { p, from, crowd, soil, chance } of learned) {
    if (from) {
      p.cultivation = world.events.emit({
        type: POPULATION_EVENTS.cultivationSpread.type,
        subjects: [p.ref, from.ref],
        place: p.ref,
        causes: [{ ref: from.cultivation!, role: "enabler", weight: 1 }],
      });
    } else {
      const famine = p.lastFamine;
      const decision = world.decisions.record({
        rule: "knowledge.cultivation",
        subject: p.ref,
        outcome: true,
        score: chance,
        threshold: 0,
        factors: [
          {
            name: "crowding",
            value: crowd,
            contribution: crowd,
            source: famine ? { ref: famine, role: "pressure", weight: 1 } : null,
          },
          {
            name: "good soil",
            value: soil,
            contribution: soil,
            source: { ref: p.ref, role: "enabler", weight: 1 },
          },
          {
            name: "years settled",
            value: year - p.settledYear,
            contribution: 0.1,
            source: p.arrival ? { ref: p.arrival, role: "enabler", weight: 1 } : null,
          },
          g.life.seedGrass[p.cell]! < 0 && g.tectonics.elevation[p.cell]! > 0
            ? {
                name: "roots and fruit to tend",
                value: soil,
                contribution: 0.5 * GARDENS,
                source: { ref: cellRef(0, p.cell), role: "enabler", weight: 1 },
              }
            : g.life.seedGrass[p.cell]! >= 0
              ? {
                  name: "a wild grain to sow",
                  value: g.life.species[g.life.seedGrass[p.cell]!]!.seed,
                  contribution: 0.5,
                  source: {
                    ref: g.life.species[g.life.seedGrass[p.cell]!]!.ref as Ref,
                    role: "enabler",
                    weight: 1,
                  },
                }
              : {
                  name: "beds of weed and shell to tend",
                  value: 1,
                  contribution: 0.5,
                  source: { ref: cellRef(0, p.cell), role: "enabler", weight: 1 },
                },
        ],
      });
      p.cultivation = world.events.emit({
        type: POPULATION_EVENTS.cultivation.type,
        place: p.ref,
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
      });
    }
    p.knowsCultivation = true;
  }
}

/** Herding, yearly: found by a settled people where a beast that can be tamed lives, or learned from neighbours. */
function herdingYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g } = ctx,
    year = yearOfMoment(t),
    made: { p: Province; from: Province | null; beast: number; chance: number }[] = [],
    // The beasts whose nature the god has changed and that are tame now (none, in a world the
    // god has not touched).
    tamed = g.life.species.filter(
      (s) =>
        s.died === null &&
        s.niche !== "seed grass" &&
        s.niche !== "upright ape" &&
        actsOf(world).nature(s.ref)?.docility !== undefined &&
        tameNow(world, s),
    ),
    tamedHere = (cell: number) => tamed.find((s) => lives(g.life, cell, s.index))?.index ?? -1;
  for (const p of ctx.provinces.all()) {
    if (p.herding || !p.knowsCultivation || p.total() < 10) continue;
    const key = refHash(p.ref);
    const teachers: Province[] = [];
    for (let k = g.grid.offsets[p.cell]!; k < g.grid.offsets[p.cell + 1]!; k++) {
      const n = ctx.provinces.get(g.grid.neighbours[k]!);
      if (n?.herding) teachers.push(n);
    }
    if (teachers.length) {
      if (world.rng.chance(Math.min(0.5, 0.1 * teachers.length), KNOW, key, t, 3))
        made.push({ p, from: teachers[0]!, beast: -1, chance: 0 });
      continue;
    }
    // (A beast the god has tamed may be herded where none could be, and one the god has made
    // wild is taken to by none: Phase 16.)
    const bred = g.life.herdBeast[p.cell]!,
      beast = bred >= 0 && tameNow(world, g.life.species[bred]!) ? bred : tamedHere(p.cell);
    if (beast < 0) continue;
    const s = g.life.species[beast]!,
      nature = lineageNature(world, s),
      chance = 0.006 * (0.5 + nature.docility) * (0.5 + nature.growth);
    if (world.rng.chance(chance, KNOW, key, t, 2)) made.push({ p, from: null, beast, chance });
  }
  for (const { p, from, beast, chance } of made) {
    if (from) {
      p.herding = world.events.emit({
        type: POPULATION_EVENTS.herdingSpread.type,
        subjects: [p.ref, from.ref],
        place: p.ref,
        causes: [{ ref: from.herding!, role: "enabler", weight: 1 }],
      });
      continue;
    }
    const s = g.life.species[beast]!;
    const decision = world.decisions.record({
      rule: "knowledge.herding",
      subject: p.ref,
      outcome: { beast: s.name },
      score: chance,
      threshold: 0,
      factors: [
        {
          name: "a beast that can be tamed",
          value: lineageNature(world, s).docility,
          contribution: 1,
          source: { ref: s.ref as Ref, role: "enabler", weight: 1 },
        },
        {
          name: "a settled people",
          value: year - p.settledYear,
          contribution: 0.3,
          source: p.cultivation ? { ref: p.cultivation, role: "enabler", weight: 1 } : null,
        },
      ],
    });
    p.herding = world.events.emit({
      type: POPULATION_EVENTS.herding.type,
      place: p.ref,
      causes: [{ ref: decision, role: "trigger", weight: 1 }],
      data: { beast: s.name },
    });
  }
}

/** Where a people of a medium can raise a village: good land; the shallows; the tide's edge. */
function buildable(medium: Medium, r: Region, t: number): boolean {
  if (medium === "water") return r.water[t] === WATER.sea && r.elevation[t]! >= -SHALLOWS;
  if (r.water[t] !== WATER.land || r.fertility[t]! < 0.2) return false;
  return medium === "land" || near(r, t, (u) => r.water[u] === WATER.sea);
}
/**
 * Ground of a people's own medium at all, good or not: where they build when their land has none of the kind they would
 * choose. People who live in a land build in it: a desert's or a cold shore's millions are not without a village for
 * want of soil that passes a line (first light, year 1,500: 93 of 602 peopled lands had no site, some of four million).
 */
function standable(medium: Medium, r: Region, t: number): boolean {
  return medium === "water" ? r.water[t] === WATER.sea : r.water[t] === WATER.land;
}
/** The deepest water a people of the water raise their villages in, metres. */
const SHALLOWS = 120;

/** Whether any tile within two of `t` is as asked. */
function near(r: Region, t: number, is: (u: number) => boolean): boolean {
  const size = r.size,
    i = t % size,
    j = Math.floor(t / size);
  for (let dj = -2; dj <= 2; dj++)
    for (let di = -2; di <= 2; di++) {
      const a = i + di,
        b = j + dj;
      if (a >= 0 && b >= 0 && a < size && b < size && is(b * size + a)) return true;
    }
  return false;
}

/** A village site in the shallows: the shallower and the nearer the shore, the better (the reefs are there). */
function reefScore(r: Region, t: number): number {
  const shallow = 1 - Math.min(1, -r.elevation[t]! / SHALLOWS);
  return 0.6 * shallow + (near(r, t, (u) => r.water[u] === WATER.land) ? 0.4 : 0);
}

function siteScore(r: Region, t: number): number {
  const size = r.size,
    i = t % size,
    j = Math.floor(t / size);
  let soil = 0,
    n = 0,
    water = 0;
  for (let dj = -2; dj <= 2; dj++)
    for (let di = -2; di <= 2; di++) {
      const a = i + di,
        b = j + dj;
      if (a < 0 || b < 0 || a >= size || b >= size) continue;
      const u = b * size + a;
      if (r.water[u] === WATER.land) {
        soil += r.fertility[u]!;
        n++;
      } else if (r.water[u] === WATER.river || r.water[u] === WATER.lake)
        water = Math.max(water, 0.35);
      else if (r.water[u] === WATER.sea) water = Math.max(water, 0.2);
    }
  return n ? soil / n + water : 0;
}

// Where villages can stand, per land, once: a small region of 16×16 blocks (each the
// size of 8×8 tiles of the land's full region, about 19 km across), each block's site
// score read from it; a village stands at its block's middle tile. A pure function of
// the generated world, kept for good: the simulation never needs a land's full region
// (that is drawn only for the observer).
const BLOCK = 8,
  SITE_SIDE = REGION_SIZE / BLOCK;
type SiteBlocks = {
  /** Each block's best buildable tile (0xffff: none), and its score. */
  readonly tiles: Uint16Array;
  readonly scores: Float32Array;
  /** The blocks with a tile, best first (ties by tile). */
  readonly order: Uint16Array;
  /** How many villages the land had when no block had room for another (-1: never found so; see chooseSite). */
  fullAt: number;
};
/** A land's sites and the fine cells its small region read: each tile's nearest cell and that cell's neighbours (gen/region.ts). */
function readSites(
  ctx: PopulationContext,
  cell: number,
): { value: SiteBlocks; cells: ReadonlySet<number> } {
  const g = ctx.generated,
    cells = new Set<number>();
  // Halls on another world have no ground of villages to choose among.
  if (offworldSite(g, cell))
    return {
      value: {
        tiles: new Uint16Array(0),
        scores: new Float32Array(0),
        order: new Uint16Array(0),
        fullAt: -1,
      },
      cells,
    };
  const r = isProvinceWorld(g)
      ? refineRegion(g.fine, g.centre[cell]!, SITE_SIDE, PROVINCE_TILE_KM * BLOCK)
      : refineRegion(g, cell, SITE_SIDE, 0.8 * BLOCK),
    grid = (isProvinceWorld(g) ? g.fine : g).grid,
    side = SITE_SIDE,
    tiles = new Uint16Array(side * side).fill(0xffff),
    scores = new Float32Array(side * side).fill(-1);
  // (Every tile's nearest cell, and every neighbour of each: a nearest cell first met as another's neighbour has its own too.)
  for (const c of new Set(r.parent)) {
    cells.add(c);
    for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++) cells.add(grid.neighbours[k]!);
  }
  // Its blocks of ground fit to build on; where it has none, its blocks of any ground of its people's medium, the best
  // of them first as ever (a land of no such ground at all has no site).
  let fit = false;
  for (let b = 0; b < side * side && !fit; b++)
    fit = provinceOfTile(ctx, r, b) === cell && buildable(ctx.medium, r, b);
  for (let b = 0; b < side * side; b++) {
    if (provinceOfTile(ctx, r, b) !== cell) continue;
    if (!(fit ? buildable(ctx.medium, r, b) : standable(ctx.medium, r, b))) continue;
    scores[b] = Math.fround(ctx.medium === "water" ? reefScore(r, b) : siteScore(r, b));
    // The village stands at its block's middle tile of the land's full region.
    const i = (b % side) * BLOCK + BLOCK / 2,
      j = Math.floor(b / side) * BLOCK + BLOCK / 2;
    tiles[b] = j * REGION_SIZE + i;
  }
  const order = Uint16Array.from(
    [...tiles.keys()]
      .filter((b) => tiles[b] !== 0xffff)
      .sort((a, b) => scores[b]! - scores[a]! || tiles[a]! - tiles[b]!),
  );
  return { value: { tiles, scores, order, fullAt: -1 }, cells };
}
/**
 * A land's village sites: kept by its planet while the ground they were read from stands (sim/planet/store.ts landReading), so
 * a rise of one cell of the ground reads again only the lands about it.
 */
function siteBlocks(ctx: PopulationContext, cell: number): SiteBlocks {
  return homePlanet(ctx.world).landReading(`sites:${ctx.medium}`, cell, () => readSites(ctx, cell));
}

/** A village's site score: its block's, among its land's sites. */
function siteIn(sites: SiteBlocks, v: Settlement): number {
  const size = REGION_SIZE,
    b =
      Math.floor(Math.floor(v.tile / size) / BLOCK) * SITE_SIDE +
      Math.floor((v.tile % size) / BLOCK);
  return Math.max(0, sites.scores[b]!);
}
function siteOf(ctx: PopulationContext, v: Settlement): number {
  return siteIn(siteBlocks(ctx, v.cell), v);
}

/** Whether a land's village sites are known already (they are pure: knowing them early changes nothing). */
export function sitesReady(ctx: PopulationContext, cell: number): boolean {
  return homePlanet(ctx.world).landRead(`sites:${ctx.medium}`, cell);
}
/** Work out a land's village sites ahead of need. */
export function prepareSites(ctx: PopulationContext, cell: number): void {
  siteBlocks(ctx, cell);
}
/** A land's village sites, best first (tiles of its full region): where its bands range too (Phase 28 M159). */
export function landSites(ctx: PopulationContext, cell: number): readonly number[] {
  const { tiles, order } = siteBlocks(ctx, cell);
  return Array.from(order, (b) => tiles[b]!);
}

function chooseSite(
  ctx: PopulationContext,
  cell: number,
  taken: readonly Settlement[],
  t: SimTime,
): { tile: number; score: number } | null {
  // A land whose region had no room for another village has none while its villages are as many and its ground the same
  // (kept with its sites, which are read again when their ground moves).
  const sites = siteBlocks(ctx, cell);
  if (sites.fullAt === taken.length) return null;
  const { tiles, scores, order } = sites,
    size = REGION_SIZE;
  // The best-scoring block's site far enough from every village, its score nudged by a
  // keyed draw (ties to the lower tile). Blocks are visited best first, so once none
  // left could beat the best even with the whole nudge, none need be drawn.
  let best = -1,
    bestScore = -Infinity;
  for (const b of order) {
    const tile = tiles[b]!,
      base = scores[b]!;
    // The keyed nudge adds less than 0.02: a site that cannot win needs no draw.
    if (base + 0.02 <= bestScore) break;
    const score = base + 0.02 * ctx.world.rng.real(SITES, tile, t, cell);
    // Only a site that would be the best so far needs its neighbours checked.
    if (score < bestScore || (score === bestScore && tile > best)) continue;
    const i = tile % size,
      j = Math.floor(tile / size);
    // Keep eighteen kilometres from every other village.
    if (
      taken.some((s) => {
        const di = (s.tile % size) - i,
          dj = Math.floor(s.tile / size) - j;
        return di * di + dj * dj < 7.5 * 7.5;
      })
    )
      continue;
    bestScore = score;
    best = tile;
  }
  if (best < 0) {
    sites.fullAt = taken.length;
    return null;
  }
  return { tile: best, score: bestScore };
}

/**
 * Villages, yearly: farmers found new ones as they outgrow the old; people are
 * shared among them. Once a province has crafts and trade, its best-placed village
 * becomes its market town, where the crafters, traders and leaders live with their
 * families — so it grows with the work there is, past the size of a village.
 */
export function settleYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    year = yearOfMoment(t);
  let firsts = 0;
  for (const p of ctx.provinces.all()) {
    if (!p.knowsCultivation) continue;
    const pop = p.total(),
      foragers = p.occupation(OCC.forager),
      grown = Math.max(1, adults(p, ctx.life)),
      settled = Math.round(pop * (1 - foragers / grown)),
      trades = p.occupation(OCC.crafter) + p.occupation(OCC.trader) + p.occupation(OCC.leader),
      villages = ctx.settlements.inProvince(p.cell),
      town = villages.find((v) => v.market),
      // (Its trades and their kin, times what its town draws besides: sim/population/urban.ts; 1 before it is weighed.)
      townsfolk = town
        ? Math.min(
            settled,
            Math.round(
              ((settled * trades) / Math.max(1, grown - foragers)) * townDrawOf(world, p.cell),
            ),
          )
        : 0,
      needed = Math.min(MOST_VILLAGES, Math.ceil((settled - townsfolk) / VILLAGE_SIZE));
    // A land's first village waits its turn: only so many a year across the world. The turn is spent by a village
    // founded, not by a land asking: lands with nowhere to build came first in the world's order every year and took
    // all fifty turns for good (harrow 348, year 1,000: 38 lands with sites and up to 3.5 million people, never a village).
    if (!villages.length && needed > 0 && firsts >= FIRST_VILLAGES_A_YEAR) continue;
    for (let n = 0; villages.length < needed && n < 3; n++) {
      const site = chooseSite(ctx, p.cell, villages, t);
      if (!site) break;
      if (!villages.length) firsts++;
      const crowding = settled / Math.max(1, villages.length * VILLAGE_SIZE);
      const decision = world.decisions.record({
        rule: "settlement.found",
        subject: p.ref,
        outcome: { tile: site.tile },
        score: site.score,
        threshold: 0,
        factors: [
          {
            name: "good ground and water",
            value: site.score,
            contribution: site.score,
            source: { ref: p.ref, role: "enabler", weight: 1 },
          },
          { name: "crowding", value: crowding, contribution: Math.min(2, crowding), source: null },
          {
            name: "farming",
            value: 1,
            contribution: 0.5,
            source: p.cultivation ? { ref: p.cultivation, role: "enabler", weight: 1 } : null,
          },
        ],
      });
      const ref = world.minter.mint(SETTLEMENT),
        // Named in the tongue of the land.
        tongue = cultureOf(world).get(p.cell)?.tongue,
        index = ctx.settlements.all().length + 1,
        name = tongue ? tongueName(tongue, index) : placeName(ctx.culture, index);
      const event = world.events.emit({
        type: POPULATION_EVENTS.founded.type,
        // A province's first village is part of the chronicle; the rest of history.
        importance: villages.length === 0 ? 4 : 3,
        subjects: [ref],
        place: p.ref,
        causes: [{ ref: decision, role: "trigger", weight: 1 }],
        data: { name },
      });
      const s = ctx.settlements.add({
        ref,
        name,
        cell: p.cell,
        tile: site.tile,
        founded: year,
        decision,
        event,
        population: 0,
        market: null,
      });
      villages.push(s);
    }
    if (!town && villages.length >= 2 && trades >= 12) chooseMarketTown(ctx, p, villages, t);
    // The settled people live in the villages, the better sites drawing more; the
    // market town's trades live there.
    if (villages.length) {
      // A village under the hand holds exactly its people; the others share the rest.
      const hand = handOf(world).over(p.cell),
        held = hand ? villages.find((v) => v.ref === hand.village) : undefined,
        free = held ? villages.filter((v) => v !== held) : villages,
        market = free.find((v) => v.market),
        inHand = held ? Math.min(settled, hand!.agents.length + (hand!.beyond ?? 0)) : 0,
        inTown = market ? Math.min(townsfolk, settled - inHand) : 0;
      // (Its land's sites asked for once, not once a village: they are all of this land, and tens of thousands a year.)
      const sites = free.length ? siteBlocks(ctx, p.cell) : null,
        share = sites
          ? apportion(
              settled - inHand - inTown,
              // A spring the god opened draws people to its village.
              free.map((v) => 0.2 + siteIn(sites, v) + (v.spring ? 0.6 : 0)),
              (k) => world.rng.u32(SITES, refHash(free[k]!.ref), t, 9),
            )
          : [];
      free.forEach((v, i) => (v.population = share[i]! + (v === market ? inTown : 0)));
      // (Of a great town, the ward it holds and the rest of the town about it: its people still all there.)
      if (held) held.population = hand!.beyond ? inHand : hand!.agents.length;
    }
  }
}

/**
 * A town stood up on a land at a word (the god's hand through a ruler: order/godhand.ts), on its best ground, as its
 * market town from its first day and holding the people it was given; where the land has a place already (one its
 * people left), that place is the town. Null: the land's region has no ground to build on. Never called by the world's
 * own years.
 */
export function standTown(
  ctx: PopulationContext,
  p: Province,
  people: number,
  cause: Ref,
  t: SimTime,
): Settlement | null {
  const { world } = ctx,
    here = ctx.settlements.inProvince(p.cell);
  let town = here.find((v) => v.market) ?? here[0] ?? null;
  if (!town) {
    const site = chooseSite(ctx, p.cell, here, t);
    if (!site) return null;
    const ref = world.minter.mint(SETTLEMENT),
      tongue = cultureOf(world).get(p.cell)?.tongue,
      index = ctx.settlements.all().length + 1,
      name = tongue ? tongueName(tongue, index) : placeName(ctx.culture, index),
      event = world.events.emit({
        type: POPULATION_EVENTS.founded.type,
        importance: 4,
        subjects: [ref],
        place: p.ref,
        causes: [{ ref: cause, role: "agent", weight: 1 }],
        data: { name },
      });
    town = ctx.settlements.add({
      ref,
      name,
      cell: p.cell,
      tile: site.tile,
      founded: yearOfMoment(t),
      decision: cause,
      event,
      population: 0,
      market: null,
    });
  }
  town.market ??= world.events.emit({
    type: POPULATION_EVENTS.market.type,
    subjects: [town.ref],
    place: p.ref,
    causes: [{ ref: cause, role: "agent", weight: 1 }],
    data: { name: town.name },
  });
  town.population += people;
  return town;
}

/** A province's market town: the village best placed for its people to come to. */
function chooseMarketTown(
  ctx: PopulationContext,
  p: Province,
  villages: readonly Settlement[],
  t: SimTime,
): void {
  const { world } = ctx,
    size = REGION_SIZE,
    g = ctx.generated,
    // The middle of the province is easiest to reach from all of it.
    reach = (v: Settlement) => {
      const i = v.tile % size,
        j = Math.floor(v.tile / size),
        dx = (i - size / 2) / size,
        dy = (j - size / 2) / size;
      return 1 - dmath.sqrt(dx * dx + dy * dy);
    },
    score = (v: Settlement) => siteOf(ctx, v) + 0.5 * reach(v);
  const town = [...villages].sort(
    (a, b) => score(b) - score(a) || a.founded - b.founded || (a.ref < b.ref ? -1 : 1),
  )[0]!;
  const trades = p.occupation(OCC.crafter) + p.occupation(OCC.trader);
  const decision = world.decisions.record({
    rule: "settlement.market",
    subject: p.ref,
    outcome: { town: town.ref },
    score: score(town),
    threshold: 0,
    factors: [
      {
        name: "good ground and water",
        value: siteOf(ctx, town),
        contribution: siteOf(ctx, town),
        source: { ref: town.event, role: "enabler", weight: 1 },
      },
      { name: "easy to reach", value: reach(town), contribution: 0.5 * reach(town), source: null },
      {
        name: "crafts and trade",
        value: trades,
        contribution: 0.2,
        source: p.cultivation ? { ref: p.cultivation, role: "enabler", weight: 1 } : null,
      },
      {
        name: "a river",
        value: g.water.river[p.cell] ?? 0,
        contribution: g.water.river[p.cell] ? 0.1 : 0,
        source: null,
      },
    ],
  });
  town.market = world.events.emit({
    type: POPULATION_EVENTS.market.type,
    subjects: [town.ref],
    place: p.ref,
    causes: [{ ref: decision, role: "trigger", weight: 1 }],
    data: { name: town.name },
  });
}

/** The ledger's yearly line for each province; the lean-month memory starts again. */
export function ledgerYear(ctx: PopulationContext, t: SimTime): void {
  const year = yearOfMoment(t);
  for (const p of ctx.provinces.all()) {
    const byOccupation = new Array<number>(COLS).fill(0).map((_, o) => p.occupation(o));
    ctx.history.addYear(p.cell, {
      year,
      population: p.total(),
      byOccupation,
      fed: p.leanest,
      settlements: ctx.settlements.inProvince(p.cell).length,
    });
    p.leanest = 1000;
  }
  ctx.history.seal(year, livingMemory(ctx.life));
}

/** Register the population's systems on a world, in their order. */
export function installPopulation(world: World): void {
  const ctx = () => populationContext(world);
  world.system({ key: "095.population.food", every: MONTH, run: (t) => foodMonth(ctx(), t) });
  world.system({ key: "100.population.vital", every: MONTH, run: (t) => vitalMonth(ctx(), t) });
  world.system({ key: "105.weather.rain", every: YEAR, run: (t) => weatherYear(ctx(), t) });
  world.system({ key: "110.population.age", every: YEAR, run: (t) => ageYear(ctx(), t) });
  world.system({ key: "120.population.work", every: YEAR, run: (t) => workYear(ctx(), t) });
  // (Who may leave a realm and who may come in, weighed before the year's moves: ./flight.ts.)
  installBorders(world, ctx);
  world.system({ key: "130.population.migrate", every: YEAR, run: (t) => migrateYear(ctx(), t) });
  world.system({ key: "140.population.settle", every: YEAR, run: (t) => settleYear(ctx(), t) });
  world.system({
    key: "150.knowledge.cultivation",
    every: YEAR,
    run: (t) => knowledgeYear(ctx(), t),
  });
  world.system({ key: "160.culture.ways", every: YEAR, run: (t) => cultureYear(ctx(), t) });
  world.system({ key: "900.population.ledger", every: YEAR, run: (t) => ledgerYear(ctx(), t) });
}
