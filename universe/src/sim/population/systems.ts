// The population's systems (docs/architecture §7, §15). Each runs on its own
// cadence in the order of its key, reads the state as it stood when it began and
// commits its changes after (compute-then-commit), draws every chance from a key
// (province, time, purpose), and writes what it did to the ledgers and the
// history, with causes recorded at the point of decision.
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
  weightedIndex,
  type CauseRef,
  type Factor,
  type Ref,
  type SimTime,
  type World,
} from "../../kernel/index.ts";
import {
  WATER,
  cellRef,
  placeName,
  tongueName,
  refineRegion,
  type HomeWorld,
  type Region,
} from "../../gen/index.ts";
import { ACT_STRENGTH, actsOf } from "../acts/acts.ts";
import { HAND_VITAL, bandOfAge, handOf, newbornSex } from "../hand/hand.ts";
import { cultureOf, cultureYear } from "../culture/culture.ts";
import { MarketStore } from "../economy/market.ts";
import {
  BANDS,
  FEMALE,
  FOODS,
  G,
  GOODS,
  HUMANLIKE,
  MALE,
  OCC,
  TOOL_GAIN,
  PRODUCTIVITY,
  SEXES,
  bandWidth,
} from "../../rules/index.ts";
import { homePlanet } from "../planet/store.ts";
import { COLS, Province, ROWS, capacity, row, type Capacity } from "./model.ts";
import {
  HistoryStore,
  PopulationStore,
  SETTLEMENT,
  SettlementStore,
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
/**
 * How many lands may found their first village in one year, world-wide, in the
 * order of the lands; the rest wait a year. Each first village surveys its land's
 * region, and this keeps a year's work even when farming sweeps a continent.
 */
export const FIRST_VILLAGES_A_YEAR = 3;
/** The fewest people who set out together. */
export const MIN_GROUP = 10;

/** x rounded down or up by a keyed coin, so the expectation is exact. */
export function roundKeyed(x: number, u: number): number {
  const whole = Math.floor(x);
  return whole + (u < x - whole ? 1 : 0);
}

/** The year a moment ending at t belongs to. */
function yearOfMoment(t: number): number {
  return Math.floor((t - 1) / YEAR);
}

export function adults(p: Province): number {
  let n = 0;
  for (let s = 0; s < SEXES; s++)
    for (let b = 0; b < BANDS; b++)
      if (HUMANLIKE.bands[b]! >= HUMANLIKE.adulthood) n += p.counts.rowSum(row(s, b));
  return n;
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
): number[] {
  const t = new Array<number>(COLS).fill(0);
  if (p.knowsCultivation) {
    t[OCC.farmer] = 0.7;
    t[OCC.forager] = 0.1;
    t[OCC.herder] = cap.pasture > 0 ? 0.07 : 0;
    t[OCC.crafter] = 0.06;
    t[OCC.trader] = villages >= 2 ? 0.04 : 0;
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
    mean = flexible.reduce((s, o) => s + t[o]! * wages[o]!, 0) / Math.max(1e-9, share);
  if (mean <= 0) return t;
  for (const o of flexible) t[o] = t[o]! * dmath.clamp(wages[o]! / mean, 0.4, 2.5);
  const after = flexible.reduce((s, o) => s + t[o]!, 0);
  for (const o of flexible) t[o] = (t[o]! * share) / after;
  return t;
}

/** What a province can feed in a year (person-years) with the ways it knows. */
export function support(cap: Capacity, knows: boolean): number {
  return knows ? cap.forage * 0.3 + cap.farm + cap.pasture * 0.5 : cap.forage;
}

export type PopulationContext = {
  readonly world: World;
  readonly generated: HomeWorld;
  readonly provinces: PopulationStore;
  readonly settlements: SettlementStore;
  readonly history: HistoryStore;
  readonly culture: number;
};

export function populationContext(world: World): PopulationContext {
  return {
    world,
    generated: homePlanet(world).generated,
    provinces: world.store<PopulationStore>("population.provinces"),
    settlements: world.store<SettlementStore>("population.settlements"),
    history: world.store<HistoryStore>("population.history"),
    culture: hashString(`culture ${world.seed.text}`),
  };
}

// Capacities and regions are pure functions of the generated world: kept, never saved.
const CAPACITIES = new Map<string, Capacity>();
export function provinceCapacity(ctx: PopulationContext, cell: number): Capacity {
  const key = `${ctx.generated.digest}:${cell}`;
  let c = CAPACITIES.get(key);
  if (!c) {
    if (CAPACITIES.size > 50_000) CAPACITIES.clear();
    CAPACITIES.set(key, (c = capacity(ctx.generated, cell)));
  }
  return c;
}
const REGIONS = new Map<string, Region>();
/** Whether a province's region is refined already (regions are pure: refining early changes nothing). */
export function regionReady(ctx: PopulationContext, cell: number): boolean {
  return REGIONS.has(`${ctx.generated.digest}:${cell}`);
}

export function regionOf(ctx: PopulationContext, cell: number): Region {
  const key = `${ctx.generated.digest}:${cell}`;
  let r = REGIONS.get(key);
  if (!r) {
    if (REGIONS.size >= 64) REGIONS.delete(REGIONS.keys().next().value!);
    REGIONS.set(key, (r = refineRegion(ctx.generated, cell)));
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
    acts = actsOf(world);
  for (const p of ctx.provinces.all()) {
    // A blessed harvest is richer, a blighted one poorer.
    const act = acts.at(p.cell, "harvest", t),
      gift = act ? 1 + act.sign * ACT_STRENGTH.harvest : 1;
    const m = markets.of(p.cell),
      c = provinceCapacity(ctx, p.cell),
      key = refHash(p.ref),
      rain = p.rain / 1000,
      tools = 1 + (TOOL_GAIN * m.toolCover) / 1000,
      pots = m.potteryCover / 1000;
    // Yearly food in person-years is this month's food in person-months.
    const harvest: [number, number][] = [
      [G.wild, saturate(c.forage, p.occupation(OCC.forager), PRODUCTIVITY[OCC.forager]!) * rain],
      [
        G.grain,
        p.knowsCultivation
          ? saturate(c.farm, p.occupation(OCC.farmer), PRODUCTIVITY[OCC.farmer]! * tools) * rain
          : 0,
      ],
      [
        G.meat,
        saturate(c.pasture, p.occupation(OCC.herder), PRODUCTIVITY[OCC.herder]! * tools) *
          (0.5 + 0.5 * rain),
      ],
    ];
    for (const [g, x] of harvest)
      m.move(
        "made",
        g,
        roundKeyed(x * gift, world.rng.real(BIRTHS, key, t, purpose("harvest"), g)),
      );
    for (const g of FOODS)
      m.move(
        "spoiled",
        g,
        Math.min(
          m.stock[g]!,
          roundKeyed(
            m.stock[g]! * GOODS[g]!.spoil * (1 - 0.5 * pots),
            world.rng.real(BIRTHS, key, t, purpose("spoil"), g),
          ),
        ),
      );
    const need = p.total();
    let eaten = 0;
    for (const g of FOODS) eaten += m.take("used", g, need - eaten);
    let over = m.food(FOODS) - need * (12 + 12 * pots);
    for (const g of FOODS) if (over > 0) over -= m.take("spoiled", g, Math.ceil(over));
    const fed = need > 0 ? eaten / need : 1;
    p.fed = Math.round(fed * 1000);
    p.leanest = Math.min(p.leanest, p.fed);
    if (p.fed < 800 && need >= 20 && month - p.famineMonth > 12) {
      const causes: CauseRef[] = [];
      const recentDrought = p.lastDrought ? world.events.get(p.lastDrought) : undefined;
      if (recentDrought && t - recentDrought.t < 2 * YEAR)
        causes.push({ ref: recentDrought.id, role: "trigger", weight: 0.6 });
      if (act && act.sign < 0) causes.push({ ref: act.event, role: "agent", weight: 0.8 });
      causes.push({ ref: p.ref, role: "constraint", weight: recentDrought ? 0.4 : 1 });
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

/** Births and deaths, monthly. */
export function vitalMonth(ctx: PopulationContext, t: SimTime): void {
  const { world, history } = ctx,
    year = yearOfMoment(t),
    life = HUMANLIKE;
  const markets = marketsOf(world),
    acts = actsOf(world);
  for (const p of ctx.provinces.all()) {
    // A plague sent makes deaths likelier; healing, rarer.
    const act = acts.at(p.cell, "plague", t),
      sickness = !act ? 1 : act.sign < 0 ? 1 + ACT_STRENGTH.plague : 1 - ACT_STRENGTH.healing;
    const fed = p.fed / 1000,
      fertility = fed * fed,
      // In cold lands, those without warm clothing die more easily.
      cold = dmath.clamp((10 - ctx.generated.climate.temperature[p.cell]!) / 10, 0, 1),
      bare = 1 - (markets.get(p.cell)?.clothingCover ?? 1000) / 1000,
      mortality = (1 + 2.5 * (1 - fed)) * (1 + 0.25 * cold * bare) * sickness,
      d = new CountDeltas(p.counts),
      key = refHash(p.ref),
      // Under the hand, a village's people are born and die one by one; the rest by rates.
      windowed = handOf(world).composition(p.cell, year),
      rest = (r: number, o: number) =>
        p.counts.get(r, o) - (windowed ? windowed[r * COLS + o]! : 0);
    let expected = 0;
    for (let b = 0; b < BANDS; b++) {
      let women = p.counts.rowSum(row(FEMALE, b));
      if (windowed) for (let o = 0; o < COLS; o++) women -= windowed[row(FEMALE, b) * COLS + o]!;
      expected += women * life.fertility[b]!;
    }
    const births = roundKeyed((expected * fertility) / 12, world.rng.real(BIRTHS, key, t));
    if (births) {
      const [girls, boys] = multinomial(births, [0.488, 0.512], (i) =>
        world.rng.real(BIRTHS, key, t, purpose("sex"), i),
      );
      d.add(row(FEMALE, 0), OCC.dependent, girls!);
      d.add(row(MALE, 0), OCC.dependent, boys!);
      history.addBirths(p.cell, year, births);
    }
    for (let s = 0; s < SEXES; s++)
      for (let b = 0; b < BANDS; b++)
        for (let o = 0; o < COLS; o++) {
          const n = rest(row(s, b), o);
          if (!n) continue;
          const dead = Math.min(
            n,
            roundKeyed(
              (n * life.mortality[b]! * mortality) / 12,
              world.rng.real(DEATHS, key, t, 0, row(s, b) * COLS + o),
            ),
          );
          if (!dead) continue;
          d.add(row(s, b), o, -dead);
          history.addDeaths(p.cell, year, b, dead);
        }
    const w = windowed ? handOf(world).over(p.cell) : null;
    if (w) {
      const living: typeof w.agents = [];
      for (const a of w.agents) {
        const band = bandOfAge(year - a.birthYear);
        if (world.rng.real(HAND_VITAL, a.id, t, 0) < (life.mortality[band]! * mortality) / 12) {
          d.add(row(a.sex, band), a.occupation, -1);
          history.addDeaths(p.cell, year, band, 1);
          continue;
        }
        living.push(a);
        if (
          a.sex === FEMALE &&
          world.rng.real(HAND_VITAL, a.id, t, 1) < (life.fertility[band]! * fertility) / 12
        ) {
          const id = w.next++,
            sex = newbornSex(world.rng.real(HAND_VITAL, id, t, 2));
          living.push({ id, sex, birthYear: year, occupation: OCC.dependent });
          d.add(row(sex, 0), OCC.dependent, 1);
          history.addBirths(p.cell, year, 1);
        }
      }
      w.agents = living;
    }
    d.commit(p.counts);
  }
}

/** Weather, yearly: each province's rain for the coming year; a dry one is a drought. */
export function weatherYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    acts = actsOf(world);
  for (const p of ctx.provinces.all()) {
    // Rain withheld or sent by the god's hand moves the year's rain.
    const act = acts.at(p.cell, "rain", t),
      key = refHash(p.ref),
      g = gaussian(world.rng.real(RAIN, key, t, 0), world.rng.real(RAIN, key, t, 1)),
      natural = dmath.clamp(1 + 0.22 * g, 0.35, 1.6),
      rain = act ? natural * (1 + act.sign * ACT_STRENGTH.rain) : natural;
    p.rain = Math.round(rain * 1000);
    if (rain < 0.72) {
      const causes: CauseRef[] = [];
      if (act && act.sign < 0) causes.push({ ref: act.event, role: "agent", weight: 0.8 });
      causes.push({ ref: p.ref, role: "constraint", weight: act && act.sign < 0 ? 0.2 : 1 });
      p.lastDrought = world.events.emit({
        type: POPULATION_EVENTS.drought.type,
        importance: rain < 0.55 ? 4 : 3,
        place: p.ref,
        causes,
        data: { rain: p.rain },
      });
    }
  }
}

/** Ageing and coming of age, yearly. */
export function ageYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    life = HUMANLIKE;
  for (const p of ctx.provinces.all()) {
    const d = new CountDeltas(p.counts),
      key = refHash(p.ref),
      targets = occupationTargets(
        p,
        provinceCapacity(ctx, p.cell),
        ctx.settlements.inProvince(p.cell).length,
        marketsOf(world).wagesOf(p.cell),
      ),
      year = yearOfMoment(t),
      windowed = handOf(world).composition(p.cell, year);
    for (let s = 0; s < SEXES; s++)
      for (let b = 0; b < BANDS - 1; b++) {
        const comingOfAge = life.bands[b + 1]! === life.adulthood;
        for (let o = 0; o < COLS; o++) {
          const n = p.counts.get(row(s, b), o) - (windowed ? windowed[row(s, b) * COLS + o]! : 0);
          if (!n) continue;
          const movers = Math.min(
            n,
            roundKeyed(n / bandWidth(b), world.rng.real(AGEING, key, t, 0, row(s, b) * COLS + o)),
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
        const was = bandOfAge(year - a.birthYear),
          now = bandOfAge(year + 1 - a.birthYear);
        if (now === was) continue;
        d.add(row(a.sex, was), a.occupation, -1);
        if (a.occupation === OCC.dependent && life.bands[now]! >= life.adulthood)
          a.occupation = weightedIndex(targets, world.rng.real(HAND_VITAL, a.id, t, 3));
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
    const windowed = handOf(world).composition(p.cell, Math.floor(t / YEAR)),
      rest = (r: number, o: number) =>
        p.counts.get(r, o) - (windowed ? windowed[r * COLS + o]! : 0);
    let grown = adults(p);
    if (windowed)
      for (let r = 0; r < ROWS; r++)
        if (HUMANLIKE.bands[r % BANDS]! >= HUMANLIKE.adulthood)
          for (let o = 0; o < COLS; o++) grown -= windowed[r * COLS + o]!;
    if (!grown) continue;
    const key = refHash(p.ref),
      targets = occupationTargets(
        p,
        provinceCapacity(ctx, p.cell),
        ctx.settlements.inProvince(p.cell).length,
        marketsOf(world).wagesOf(p.cell),
      );
    const desired = apportion(
      grown,
      targets,
      targets.map((_, k) => world.rng.u32(WORK, key, t, 0, k)),
    );
    const current = new Array<number>(COLS).fill(0);
    const adultRows: number[] = [];
    for (let s = 0; s < SEXES; s++)
      for (let b = 0; b < BANDS; b++)
        if (HUMANLIKE.bands[b]! >= HUMANLIKE.adulthood) {
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
      out = apportion(
        moving,
        surplus,
        surplus.map((_, o) => world.rng.u32(WORK, key, t, 1, o)),
      ),
      into = apportion(
        moving,
        deficit,
        deficit.map((_, o) => world.rng.u32(WORK, key, t, 2, o)),
      );
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
      const share = apportion(
        n,
        intoRemaining,
        intoRemaining.map((_, o) => world.rng.u32(WORK, key, t, 4, i * 16 + o)),
      );
      share.forEach((m, o) => {
        d.add(adultRows[i]!, o, m);
        intoRemaining[o] = Math.max(0, intoRemaining[o]! - m);
      });
    });
    d.commit(p.counts);
  }
}

type PlannedFlow = {
  from: Province;
  to: number;
  count: number;
  moved: number[];
  factors: Factor[];
  pressure: number;
};

/** Migration, yearly: every move is planned from the year's opening state, then made. */
export function migrateYear(ctx: PopulationContext, t: SimTime): void {
  const { world, generated: g, history } = ctx,
    year = yearOfMoment(t),
    planned: PlannedFlow[] = [];
  const peopled = (cell: number) => ctx.provinces.get(cell);
  for (const p of ctx.provinces.all()) {
    const pop = p.total();
    if (pop < 20) continue;
    const c = provinceCapacity(ctx, p.cell),
      here = support(c, p.knowsCultivation),
      hunger = 1 - p.leanest / 1000,
      crowd = Math.max(0, pop / Math.max(1, here) - 0.85),
      pressure = 0.6 * hunger + crowd;
    if (pressure < 0.05) continue;
    const perHere = here / pop;
    const options: { cell: number; attraction: number }[] = [];
    for (let k = g.grid.offsets[p.cell]!; k < g.grid.offsets[p.cell + 1]!; k++) {
      const m = g.grid.neighbours[k]!;
      if (g.tectonics.elevation[m]! <= 0) continue;
      const there = support(provinceCapacity(ctx, m), p.knowsCultivation),
        others = peopled(m)?.total() ?? 0,
        attraction = there / (others + 1) - perHere;
      if (attraction > 0.05 && there > 20) options.push({ cell: m, attraction });
    }
    if (!options.length) continue;
    options.sort((a, b) =>
      b.attraction !== a.attraction ? b.attraction - a.attraction : a.cell - b.cell,
    );
    // Those under the hand stay: movers come from the rest.
    const windowed = handOf(world).composition(p.cell, Math.floor(t / YEAR)),
      held = windowed ? windowed.reduce((a, b) => a + b, 0) : 0;
    const key = refHash(p.ref),
      movers = Math.min(pop - held, Math.floor(pop * Math.min(0.06, pressure * 0.08)));
    if (movers < MIN_GROUP) continue;
    // A band that sets out is at least MIN_GROUP strong: a small exodus goes one way.
    const best = options.slice(0, Math.max(1, Math.min(3, Math.floor(movers / MIN_GROUP))));
    const split = apportion(
      movers,
      best.map((o) => o.attraction),
      best.map((o) => world.rng.u32(MOVES, key, t, 0, o.cell)),
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
      planned.push({
        from: p,
        to: o.cell,
        count,
        moved,
        pressure,
        factors: [
          {
            name: "hunger",
            value: hunger,
            contribution: 0.6 * hunger,
            source:
              famine && t - famine.t < 2 * YEAR
                ? { ref: famine.id, role: "pressure", weight: 1 }
                : null,
          },
          { name: "crowding", value: crowd, contribution: crowd, source: null },
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
            name: "better land",
            value: o.attraction,
            contribution: 0.2 * o.attraction,
            source: { ref: cellRef(0, o.cell), role: "enabler", weight: 1 },
          },
        ],
      });
    });
  }
  // Make the moves.
  for (const f of planned) {
    const decision = world.decisions.record({
      rule: "population.migrate",
      subject: f.from.ref,
      outcome: { to: cellRef(0, f.to), count: f.count },
      score: f.pressure,
      threshold: 0.05,
      factors: f.factors,
    });
    const event = world.events.emit({
      type: POPULATION_EVENTS.migration.type,
      importance: f.count >= 200 ? 3 : 2,
      subjects: [f.from.ref, cellRef(0, f.to)],
      place: f.from.ref,
      causes: [{ ref: decision, role: "trigger", weight: 1 }],
      data: { count: f.count },
    });
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
      decision,
      event,
    });
  }
}

/** Cultivation, yearly: found under pressure on good land, or learned from neighbours. */
export function knowledgeYear(ctx: PopulationContext, t: SimTime): void {
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
    if (teachers.length) {
      if (world.rng.chance(Math.min(0.6, 0.12 * teachers.length), KNOW, key, t, 1))
        learned.push({ p, from: teachers[0]!, chance: 0, crowd: 0, soil: 0 });
      continue;
    }
    if (year - p.settledYear < 15) continue;
    const c = provinceCapacity(ctx, p.cell),
      soil = dmath.clamp(c.farm / Math.max(1, c.areaKm2 * 12), 0, 1),
      crowd = p.total() / Math.max(1, c.forage),
      chance = 0.004 * soil * (1 + 6 * Math.max(0, crowd - 0.6)) * (p.lastFamine ? 1.5 : 1);
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

// Each region's site scores, once: a pure function of the generated region.
const SITE_SCORES = new Map<string, Float32Array>();
function siteScores(ctx: PopulationContext, r: Region, cell: number): Float32Array {
  const key = `${ctx.generated.digest}:${cell}`;
  let scores = SITE_SCORES.get(key);
  if (!scores) {
    if (SITE_SCORES.size >= 64) SITE_SCORES.delete(SITE_SCORES.keys().next().value!);
    scores = new Float32Array(r.size * r.size).fill(-1);
    for (let tile = 0; tile < scores.length; tile++)
      if (r.water[tile] === WATER.land && r.parent[tile] === cell && r.fertility[tile]! >= 0.2)
        scores[tile] = siteScore(r, tile);
    SITE_SCORES.set(key, scores);
  }
  return scores;
}

function chooseSite(
  ctx: PopulationContext,
  cell: number,
  taken: readonly Settlement[],
  t: SimTime,
): { tile: number; score: number } | null {
  const r = regionOf(ctx, cell),
    size = r.size,
    scores = siteScores(ctx, r, cell);
  let best = -1,
    bestScore = -Infinity;
  for (let tile = 0; tile < size * size; tile++) {
    const base = scores[tile]!;
    // The keyed nudge adds at most 0.02: a site that cannot win needs no draw.
    if (base < 0 || base + 0.02 <= bestScore) continue;
    const score = base + 0.02 * ctx.world.rng.real(SITES, tile, t, cell);
    // Only a site that would be the best so far needs its neighbours checked.
    if (score <= bestScore) continue;
    const i = tile % size,
      j = Math.floor(tile / size);
    // Keep six kilometres from every other village.
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
  return best < 0 ? null : { tile: best, score: bestScore };
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
      grown = Math.max(1, adults(p)),
      settled = Math.round(pop * (1 - foragers / grown)),
      trades = p.occupation(OCC.crafter) + p.occupation(OCC.trader) + p.occupation(OCC.leader),
      villages = ctx.settlements.inProvince(p.cell),
      town = villages.find((v) => v.market),
      townsfolk = town
        ? Math.min(settled, Math.round((settled * trades) / Math.max(1, grown - foragers)))
        : 0,
      needed = Math.ceil((settled - townsfolk) / VILLAGE_SIZE);
    // A land's first village waits its turn: only so many a year across the world.
    if (!villages.length && needed > 0 && firsts++ >= FIRST_VILLAGES_A_YEAR) continue;
    for (let n = 0; villages.length < needed && n < 3; n++) {
      const site = chooseSite(ctx, p.cell, villages, t);
      if (!site) break;
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
        r = regionOf(ctx, p.cell),
        market = free.find((v) => v.market),
        inHand = held ? Math.min(settled, hand!.agents.length) : 0,
        inTown = market ? Math.min(townsfolk, settled - inHand) : 0;
      const share = free.length
        ? apportion(
            settled - inHand - inTown,
            free.map((v) => 0.2 + siteScore(r, v.tile)),
            free.map((v) => world.rng.u32(SITES, refHash(v.ref), t, 9)),
          )
        : [];
      free.forEach((v, i) => (v.population = share[i]! + (v === market ? inTown : 0)));
      if (held) held.population = hand!.agents.length;
    }
  }
}

/** A province's market town: the village best placed for its people to come to. */
function chooseMarketTown(
  ctx: PopulationContext,
  p: Province,
  villages: readonly Settlement[],
  t: SimTime,
): void {
  const { world } = ctx,
    r = regionOf(ctx, p.cell),
    g = ctx.generated,
    // The middle of the province is easiest to reach from all of it.
    reach = (v: Settlement) => {
      const i = v.tile % r.size,
        j = Math.floor(v.tile / r.size),
        dx = (i - r.size / 2) / r.size,
        dy = (j - r.size / 2) / r.size;
      return 1 - dmath.sqrt(dx * dx + dy * dy);
    },
    score = (v: Settlement) => siteScore(r, v.tile) + 0.5 * reach(v);
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
        value: siteScore(r, town.tile),
        contribution: siteScore(r, town.tile),
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
  ctx.history.seal(year);
}

/** Register the population's systems on a world, in their order. */
export function installPopulation(world: World): void {
  const ctx = () => populationContext(world);
  world.system({ key: "095.population.food", every: MONTH, run: (t) => foodMonth(ctx(), t) });
  world.system({ key: "100.population.vital", every: MONTH, run: (t) => vitalMonth(ctx(), t) });
  world.system({ key: "105.weather.rain", every: YEAR, run: (t) => weatherYear(ctx(), t) });
  world.system({ key: "110.population.age", every: YEAR, run: (t) => ageYear(ctx(), t) });
  world.system({ key: "120.population.work", every: YEAR, run: (t) => workYear(ctx(), t) });
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
