// The air and a changing climate (docs/architecture §18, Phase 3 M33). Burning puts
// carbon in the air — the coal and oil every land burned last year — and so does
// clearing forest; the land and sea take a little of what is over the old measure
// back each year. The world warms toward what its carbon would hold (three degrees for
// each doubling), slowly, as the seas take up the heat. As it warms, rain moves: dry
// lands and the subtropics grow drier, wet lands and the high latitudes wetter; hot
// fields yield less, cold ones a little more. Where much is burned among few, smoke
// fouls the air and more die. Each turn is history, with its causes: the warming cites
// the lands that burned most and cleared most; a land grown drier cites the warming.
import {
  YEAR,
  Hasher,
  defineEventType,
  dmath,
  yearOfMoment,
  type CauseRef,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import {
  CARBON_CYCLE,
  G,
  fieldsUnder,
  rainUnder,
  restingCarbon,
  seasSoured,
  shellsLeft,
  tailShare,
  wornShare,
  type CarbonWorld,
} from "../../rules/index.ts";
import {
  isProvinceWorld,
  meansNumbers,
  planetRef,
  starAgeGyr,
  worldKindOf,
  type HomeWorld,
} from "../../gen/index.ts";
import { divineWarming } from "../acts/great.ts";
import { provinceCapacity, type PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { ecologyOf } from "../ecology/ecology.ts";
import { energyBooks, fuelTonnes } from "../economy/energy.ts";
import { groundPoison } from "../ecology/ground.ts";
import { smokeCut } from "../trade/kept.ts";

export const AIR_EVENTS = {
  warmer: defineEventType("climate.warmer", 5),
  drier: defineEventType("climate.drier", 4),
  wetter: defineEventType("climate.wetter", 4),
  smoke: defineEventType("people.smoke", 3),
  /** The seas grown another tenth of a pH more acid with the carbon they took up. */
  soured: defineEventType("climate.seas-soured", 4),
  /** The frozen ground thawing: another ten parts in a million of its carbon rotted into the air. */
  thawing: defineEventType("climate.ground-thawing", 4),
};

/** Carbon in the air before anyone burned or cleared, in parts per million. */
export const FIRST_CARBON = 280;
/** The carbon that makes a part in a million of Earth's air (tonnes): 2.13 billion. */
export const TONNES_A_PPM = 2.13e9;
/**
 * Carbon a unit of a fuel burned puts in a world's air (ppm): the carbon its make-up holds (economy/energy.ts: a unit of
 * coal some 3.8 tonnes, of oil 2.4, of gas 2.3), over the carbon a part in a million of that air is — Earth's, by its air's
 * weight against Earth's (its pressure, over its pull, on its surface). On Earth a unit of coal puts in 1.8e-9, of oil 1.1e-9:
 * some sixteen terawatts of coal and oil, four parts and more a year, as Earth's burned.
 */
export function carbonPerFuel(g: HomeWorld, fuel: "coal" | "oil" | "gas"): number {
  const n = meansNumbers(g),
    air = (n.airBar * n.radius * n.radius) / Math.max(0.01, n.pull);
  return fuelTonnes(fuel).carbon / TONNES_A_PPM / Math.max(1e-6, air);
}
/** Carbon a unit of coal burned puts in Earth's air (ppm). */
export const CARBON_PER_FUEL = 1.8e-9;
/** Carbon a square kilometre of forest cleared puts in the air (ppm); regrowing takes it back. */
export const CARBON_PER_FOREST_KM2 = 5e-6;
/**
 * The share of the carbon over the old measure the land and sea take back each year: the
 * seas' upper waters take up a slow release within decades (a pulse fades by half in
 * some thirty-five years).
 */
const SINK = 0.02;
/** Degrees the world would warm, in the end, for each doubling of its carbon. */
export const SENSITIVITY = 3;
/** The share of the way to that warming the world goes in a year (the seas are slow to warm). */
const WARMING_PACE = 0.04;
/** A warming is told at each half degree. */
const TOLD_EVERY = 0.5;
/** Rain moves this share per degree of warming (dry lands drier, wet lands wetter). */
const RAIN_PER_DEGREE = 0.06;
/** Of fuel burned a year for each person, the smoke that fouls a land's air (1 = the worst). */
const SMOKE_PER_FUEL = 0.6;
/** Smoke this thick is told: the air of the land grew foul. */
const FOUL = 0.4;

export type Air = {
  carbon: number;
  warming: number;
  /** The half degrees of warming told so far, and the event of the latest. */
  told: number;
  lastWarmer: Ref | null;
  /** Last year's carbon from fuel and from clearing (ppm). */
  burned: number;
  cleared: number;
  /**
   * Where its air rests (ppm: its weathering against its fire below, rules/carbon.ts), what has been put in it that its rock has
   * not yet worn away (ppm), how much of its frozen ground's carbon has thawed and how much of that has rotted into the air (ppm),
   * and the tenths of a pH its seas' souring and the tens of ppm its thaw have been told at. Absent on a save from before: it
   * rests where it is first read and none of these has begun.
   */
  rest?: number;
  added?: number;
  thawed?: number;
  rotted?: number;
  sourTold?: number;
  thawTold?: number;
  lastSoured?: Ref | null;
};

export class AirStore implements StateStore {
  readonly name = "climate.air";
  air: Air = {
    carbon: FIRST_CARBON,
    warming: 0,
    told: 0,
    lastWarmer: null,
    burned: 0,
    cleared: 0,
  };
  /** Each land's forest as last seen (its share of what it had), for what clearing and regrowth move. */
  private readonly forests = new Map<number, number>();
  /** The events of each land's smoke and each land's rain turned (null: not yet). */
  private readonly smoke = new Map<number, Ref>();
  private readonly shifted = new Map<number, Ref>();

  forestOf(cell: number): number | undefined {
    return this.forests.get(cell);
  }
  setForest(cell: number, share: number): void {
    this.forests.set(cell, share);
  }
  smokeOf(cell: number): Ref | null {
    return this.smoke.get(cell) ?? null;
  }
  setSmoke(cell: number, event: Ref): void {
    this.smoke.set(cell, event);
  }
  shiftOf(cell: number): Ref | null {
    return this.shifted.get(cell) ?? null;
  }
  setShift(cell: number, event: Ref): void {
    this.shifted.set(cell, event);
  }

  pinned(): Ref[] {
    const refs = [...this.smoke.values(), ...this.shifted.values()];
    if (this.air.lastWarmer) refs.push(this.air.lastWarmer);
    return refs;
  }
  hashInto(h: Hasher): void {
    h.value(this.air);
    const sorted = <T>(m: Map<number, T>) => [...m.entries()].sort((a, b) => a[0] - b[0]);
    h.value(sorted(this.forests)).value(sorted(this.smoke)).value(sorted(this.shifted));
  }
  save(): unknown {
    const sorted = <T>(m: Map<number, T>) => [...m.entries()].sort((a, b) => a[0] - b[0]);
    return {
      air: this.air,
      forests: sorted(this.forests),
      smoke: sorted(this.smoke),
      shifted: sorted(this.shifted),
    };
  }
  load(state: unknown): void {
    const s = state as {
      air: Air;
      forests: [number, number][];
      smoke: [number, Ref][];
      shifted: [number, Ref][];
    };
    this.air = { ...s.air };
    for (const [m, list] of [
      [this.forests, s.forests],
      [this.smoke, s.smoke],
      [this.shifted, s.shifted],
    ] as const) {
      m.clear();
      for (const [k, v] of list) (m as Map<number, unknown>).set(k, v);
    }
  }
}

export function airOf(world: World): AirStore {
  return world.store<AirStore>("climate.air");
}

/** How much warmer the world is than before the engines, in degrees. */
export function warmingOf(world: World): number {
  // The engines' warming, and the god's if a great act warms (or cools) the world.
  return (
    (world.hasStore("climate.air") ? airOf(world).air.warming : 0) +
    divineWarming(world, planetRef(0))
  );
}

/**
 * How a land's rain has moved with the warming, as a share of what it was (1: unmoved):
 * the dry lands and the subtropics lose rain, the wet lands and the high latitudes gain.
 */
export function rainShift(ctx: PopulationContext, cell: number): number {
  const warm = warmingOf(ctx.world);
  if (!warm) return 1;
  const g = ctx.generated,
    // Latitudes in radians: the subtropics 15–35°, the high latitudes beyond 50°.
    lat = Math.abs(g.grid.lat[cell]!),
    rain = g.climate.precipitation[cell]!,
    drying = (lat >= 0.2618 && lat <= 0.6109 ? 1 : 0) + (rain < 500 ? 1 : 0),
    wetting = (lat >= 0.8727 ? 1 : 0) + (rain > 1500 ? 1 : 0),
    sign = Math.max(-1, Math.min(1, wetting - drying));
  return Math.max(0.5, 1 + sign * RAIN_PER_DEGREE * warm);
}

/** What the warmth does to a land's fields: hot lands yield less, cold lands a little more. */
export function heatYield(ctx: PopulationContext, cell: number): number {
  const warm = warmingOf(ctx.world);
  if (!warm) return 1;
  const t = ctx.generated.climate.temperature[cell]!;
  if (t > 22) return Math.max(0.5, 1 - 0.05 * warm);
  if (t < 6) return 1 + 0.03 * warm;
  return 1;
}

/** What the greatest fire's store holds of the sky (W5), read by name: a world's climate does not lean on its wars. */
type FireSky = {
  readonly state: { soot: number; sick: [number, number, number][]; dark: Ref | null };
};
const fireSky = (world: World) =>
  world.hasStore("war.fire") ? world.store<FireSky & StateStore>("war.fire").state : null;

/** What the soot of what burned leaves of a year's rain (W5): exactly 1 under a clear sky. */
export function darkRain(world: World): number {
  const soot = fireSky(world)?.soot ?? 0;
  return soot > 0 ? rainUnder(soot) : 1;
}

/** What the soot leaves of a land's fields, and what the wind's sickness does (W5): exactly 1 under a clear sky. */
export function darkFields(world: World, cell: number): number {
  const s = fireSky(world);
  if (!s || (!s.soot && !s.sick.length)) return 1;
  let k = s.soot > 0 ? fieldsUnder(s.soot) : 1;
  for (const [land, , yields] of s.sick) if (land === cell) k *= yields;
  return k;
}

/** The event behind the dark years, while they last (null: a clear sky). */
export function darkCause(world: World): Ref | null {
  return fireSky(world)?.dark ?? null;
}

/** How foul a land's air and water are, 0..1, as its people's health reads it: the smoke of the fuel it burned for each person, coal's the thickest (its energy account; older worlds, its last three years' coal and oil). */
export function smokeIn(ctx: PopulationContext, cell: number): number {
  // (And the metals its water carries, from its own and its uplands' smelters: rules/ground.ts.)
  return Math.min(1, airSmoke(ctx, cell) + groundPoison(ctx.world, cell));
}

/** How foul a land's air alone is with smoke, 0..1: what its works send up, less what its realm's price on smoke has them cut (p87). */
export function airSmoke(ctx: PopulationContext, cell: number): number {
  return rawSmoke(ctx, cell) * (1 - smokeCut(ctx.world, cell));
}

/** How foul a land's air would be with the smoke its works send up, uncut, 0..1: what a price on smoke weighs (sim/trade). */
export function rawSmoke(ctx: PopulationContext, cell: number): number {
  // (Where its energy is reckoned: the smoke of what it burned, by how each fuel smokes, faded by half a year.)
  const e = energyBooks(ctx.world)?.get(cell);
  if (e) {
    const people = Math.max(1, ctx.provinces.get(cell)?.total() ?? 0);
    return Math.min(1, (SMOKE_PER_FUEL * e.fume) / 4 / people);
  }
  const years = ctx.world.store<MarketStore>("economy.markets").get(cell)?.years;
  if (!years?.length) return 0;
  let fuel = 0,
    n = 0;
  for (let i = Math.max(0, years.length - 3); i < years.length; i++) {
    const used = years[i]!.ledger[1]!;
    fuel += (used[G.coal] ?? 0) + (used[G.oil] ?? 0);
    n++;
  }
  const people = Math.max(1, ctx.provinces.get(cell)?.total() ?? 0);
  return Math.min(1, (SMOKE_PER_FUEL * fuel) / n / people);
}

/** What a world's weathering and frozen ground are, read once off its ground as made (kept by its digest: a pure reading). */
export type CarbonRead = {
  readonly facts: CarbonWorld;
  /** Its frozen ground's lands' warmth, warmest first, and the carbon of the frozen ground as warm as each or warmer (ppm). */
  readonly frozenWarmth: Float32Array;
  readonly frozenPpm: Float64Array;
};
const CARBON_READ = new Map<string, CarbonRead>();
export function carbonWorld(g0: HomeWorld): CarbonRead {
  let r = CARBON_READ.get(g0.digest);
  if (r) return r;
  const g = isProvinceWorld(g0) ? g0.fine : g0,
    radius = 6371 * g.planet.radius,
    frozen: [number, number][] = [];
  let face = 0,
    land = 0,
    warmth = 0,
    rain = 0;
  for (let c = 0; c < g.grid.count; c++) {
    const a = g.grid.areas[c]!;
    face += a;
    if (g.tectonics.elevation[c]! <= 0) continue;
    const t = g.climate.temperature[c]!;
    land += a;
    warmth += a * t;
    rain += a * g.climate.precipitation[c]!;
    if (t < CARBON_CYCLE.frozen && t > CARBON_CYCLE.frozenCold)
      frozen.push([t, a * radius * radius * CARBON_CYCLE.frozenPpmKm2]);
  }
  frozen.sort((x, y) => y[0] - x[0]);
  const frozenWarmth = new Float32Array(frozen.length),
    frozenPpm = new Float64Array(frozen.length);
  let sum = 0;
  frozen.forEach(([t, ppm], i) => {
    sum += ppm;
    frozenWarmth[i] = t;
    frozenPpm[i] = sum;
  });
  // (Its fire below: as its plates carry its mantle's heat up, waning with its age as its interior cools.)
  const plates = g.tectonics.plates.length > 1 ? 1 : 0.3,
    age = Math.max(0.5, starAgeGyr(g.star));
  r = {
    facts: {
      land: land / Math.max(1e-9, face),
      warmth: land > 0 ? warmth / land : 0,
      rain: land > 0 ? rain / land : 0,
      outgas: plates * dmath.clamp(dmath.pow(4.6 / age, 0.5), 0.5, 2),
      // (Only water weathers rock to stone: the rocky world's liquid, rules/kinds.ts.)
      weathers: worldKindOf(g) === "rocky",
    },
    frozenWarmth,
    frozenPpm,
  };
  CARBON_READ.set(g0.digest, r);
  if (CARBON_READ.size > 8) CARBON_READ.delete(CARBON_READ.keys().next().value!);
  return r;
}

/** The carbon of a world's frozen ground a warming has thawed (ppm): its high latitudes warm the faster (CARBON_CYCLE.polar). */
export function thawedPpm(r: CarbonRead, warming: number): number {
  if (!(warming > 0) || !r.frozenWarmth.length) return 0;
  const line = CARBON_CYCLE.frozen - CARBON_CYCLE.polar * warming;
  let lo = 0,
    hi = r.frozenWarmth.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (r.frozenWarmth[mid]! >= line) lo = mid + 1;
    else hi = mid;
  }
  return lo ? r.frozenPpm[lo - 1]! : 0;
}

/** What its seas' souring leaves of a sea's food (1 at rest, and on a world whose liquid weathers no rock). */
export function seaShells(world: World): number {
  if (!world.hasStore("climate.air")) return 1;
  const air = airOf(world).air;
  if (air.rest === undefined || air.carbon <= air.rest * 1.07) return 1;
  return shellsLeft(seasSoured(air.carbon, air.rest));
}

/** The air's year: what was burned and cleared, what was taken back, how far the world warmed, and what that did. */
export function airYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = airOf(world),
    air = store.air,
    markets = world.store<MarketStore>("economy.markets"),
    ecology = ecologyOf(world),
    year = yearOfMoment(t);

  // Carbon from last year's fuel, land by land (the most first, for the causes): the carbon each fuel holds.
  const energy = energyBooks(world),
    perCoal = carbonPerFuel(ctx.generated, "coal"),
    perOil = carbonPerFuel(ctx.generated, "oil");
  const burners: { cell: number; carbon: number }[] = [];
  let burned = 0;
  for (const m of markets.all()) {
    const used = m.years.at(-1)?.ledger[1];
    if (!used) continue;
    const gas = (energy?.get(m.cell)?.gas ?? 0) / 4,
      carbon =
        used[G.coal]! * perCoal + used[G.oil]! * perOil + gas * carbonPerFuel(ctx.generated, "gas");
    if (carbon <= 0) continue;
    burned += carbon;
    burners.push({ cell: m.cell, carbon });
  }
  // And from forest cleared (regrowth takes some back).
  const clearers: { cell: number; carbon: number }[] = [];
  let cleared = 0;
  for (const w of ecology.all()) {
    const before = store.forestOf(w.cell) ?? 1,
      area = w.firstForest * provinceCapacity(ctx, w.cell).areaKm2,
      carbon = (before - w.forest) * area * CARBON_PER_FOREST_KM2;
    store.setForest(w.cell, w.forest);
    if (!carbon) continue;
    cleared += carbon;
    if (carbon > 0) clearers.push({ cell: w.cell, carbon });
  }
  air.burned = burned;
  air.cleared = cleared;
  // (Where its air rests, read once, and its carbon moved with it: rules/carbon.ts.)
  const cw = carbonWorld(ctx.generated);
  if (air.rest === undefined) {
    air.rest = restingCarbon(cw.facts);
    air.carbon += air.rest - FIRST_CARBON;
  }
  const rest = air.rest,
    // What its frozen ground gives up: the carbon of the ground a warming has thawed rots a little each year.
    thawed = Math.max(air.thawed ?? 0, thawedPpm(cw, air.warming)),
    rotting = CARBON_CYCLE.rots * (thawed - (air.rotted ?? 0)),
    rotted = (air.rotted ?? 0) + rotting;
  air.thawed = thawed;
  air.rotted = rotted;
  // What has been put in and not yet worn away by its rock; its seas take all but a share of that back within decades.
  const put = burned + cleared + rotting,
    added = Math.max(0, (air.added ?? 0) + put - wornShare(cw.facts) * (air.added ?? 0)),
    floor = rest + tailShare(added, rest) * added;
  air.added = added;
  air.carbon = Math.max(rest, air.carbon + put - SINK * (air.carbon - floor));
  const toward = SENSITIVITY * dmath.log2(air.carbon / rest);
  air.warming += WARMING_PACE * (toward - air.warming);

  // Each half degree is told, with the lands that burned (three) and cleared (two) most
  // behind it, and the warming before (six causes, the most an event holds).
  const most = (list: { cell: number; carbon: number }[], n: number) =>
    [...list].sort((a, b) => b.carbon - a.carbon || a.cell - b.cell).slice(0, n);
  if (air.warming >= (air.told + 1) * TOLD_EVERY) {
    air.told = Math.floor(air.warming / TOLD_EVERY);
    const causes: CauseRef[] = [];
    for (const b of most(burners, 3)) {
      const m = markets.get(b.cell)!,
        cause = m.works ?? m.mine ?? m.well;
      if (cause) causes.push({ ref: cause, role: "pressure", weight: 0.25 });
    }
    for (const c of most(clearers, 2)) {
      const cause = ecology.get(c.cell)?.cleared;
      if (cause) causes.push({ ref: cause, role: "pressure", weight: 0.1 });
    }
    if (air.lastWarmer) causes.push({ ref: air.lastWarmer, role: "enabler", weight: 0.2 });
    air.lastWarmer = world.events.emit({
      type: AIR_EVENTS.warmer.type,
      causes,
      data: {
        warming: Math.round(air.warming * 10) / 10,
        carbon: Math.round(air.carbon),
      },
    });
  }

  // Its seas soured by each tenth of a pH, and its frozen ground's carbon told by each ten parts in a million rotted.
  if (cw.facts.weathers && air.lastWarmer) {
    const sour = seasSoured(air.carbon, rest);
    if (sour >= ((air.sourTold ?? 0) + 1) * 0.1) {
      air.sourTold = Math.floor(sour * 10);
      const causes: CauseRef[] = [{ ref: air.lastWarmer, role: "trigger", weight: 0.7 }];
      if (air.lastSoured) causes.push({ ref: air.lastSoured, role: "enabler", weight: 0.3 });
      air.lastSoured = world.events.emit({
        type: AIR_EVENTS.soured.type,
        causes,
        data: {
          ph: Math.round(sour * 100) / 100,
          carbon: Math.round(air.carbon),
          shells: Math.round(100 * shellsLeft(sour)),
        },
      });
    }
  }
  if (rotted >= ((air.thawTold ?? 0) + 1) * 10 && air.lastWarmer) {
    air.thawTold = Math.floor(rotted / 10);
    world.events.emit({
      type: AIR_EVENTS.thawing.type,
      causes: [{ ref: air.lastWarmer, role: "trigger", weight: 1 }],
      data: {
        rotted: Math.round(rotted),
        thawed: Math.round(thawed),
        warming: Math.round(air.warming * 10) / 10,
      },
    });
  }

  // Lands whose rain the warming has moved a tenth, and lands fouled with smoke.
  for (const p of ctx.provinces.all()) {
    if (!p.total()) continue;
    const shift = rainShift(ctx, p.cell);
    if (!store.shiftOf(p.cell) && Math.abs(shift - 1) >= 0.1 && air.lastWarmer)
      store.setShift(
        p.cell,
        world.events.emit({
          type: shift < 1 ? AIR_EVENTS.drier.type : AIR_EVENTS.wetter.type,
          place: p.ref,
          causes: [
            { ref: air.lastWarmer, role: "trigger", weight: 0.7 },
            { ref: p.ref, role: "constraint", weight: 0.3 },
          ],
          data: { rain: Math.round(shift * 100) },
        }),
      );
    const smoke = airSmoke(ctx, p.cell);
    if (!store.smokeOf(p.cell) && smoke >= FOUL) {
      const m = markets.get(p.cell)!,
        cause = m.works ?? m.mine ?? m.well;
      store.setSmoke(
        p.cell,
        world.events.emit({
          type: AIR_EVENTS.smoke.type,
          place: p.ref,
          causes: cause ? [{ ref: cause, role: "trigger", weight: 1 }] : [],
          data: { smoke: Math.round(smoke * 100), year },
        }),
      );
    }
  }
}

/** Teach a peopled world its air. */
export function installAir(world: World, ctx: () => PopulationContext): AirStore {
  const store = world.register(new AirStore());
  world.addPinner(() => store.pinned());
  world.system({ key: "126.climate.air", every: YEAR, run: (t) => airYear(ctx(), t) });
  return store;
}
