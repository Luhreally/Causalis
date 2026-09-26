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
import { G } from "../../rules/index.ts";
import { provinceCapacity, type PopulationContext } from "../population/systems.ts";
import type { MarketStore } from "../economy/market.ts";
import { ecologyOf } from "../ecology/ecology.ts";

export const AIR_EVENTS = {
  warmer: defineEventType("climate.warmer", 5),
  drier: defineEventType("climate.drier", 4),
  wetter: defineEventType("climate.wetter", 4),
  smoke: defineEventType("people.smoke", 3),
};

/** Carbon in the air before anyone burned or cleared, in parts per million. */
export const FIRST_CARBON = 280;
/**
 * Carbon a unit of coal or oil burned puts in the air (ppm). A unit drives four
 * kilowatts for a year; Earth's some sixteen terawatts put five parts a year into its
 * air before land and sea take half back, about 3e-10 a kilowatt-year.
 */
export const CARBON_PER_FUEL = 2.4e-9;
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
  return world.hasStore("climate.air") ? airOf(world).air.warming : 0;
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

/** How foul a land's air is with smoke, 0..1, from the fuel it burned in the last three years for each person. */
export function smokeIn(ctx: PopulationContext, cell: number): number {
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

/** The air's year: what was burned and cleared, what was taken back, how far the world warmed, and what that did. */
export function airYear(ctx: PopulationContext, t: SimTime): void {
  const { world } = ctx,
    store = airOf(world),
    air = store.air,
    markets = world.store<MarketStore>("economy.markets"),
    ecology = ecologyOf(world),
    year = yearOfMoment(t);

  // Carbon from last year's fuel, land by land (the most first, for the causes).
  const burners: { cell: number; carbon: number }[] = [];
  let burned = 0;
  for (const m of markets.all()) {
    const used = m.years.at(-1)?.ledger[1];
    if (!used) continue;
    const carbon = (used[G.coal]! + used[G.oil]!) * CARBON_PER_FUEL;
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
  air.carbon = Math.max(
    FIRST_CARBON,
    air.carbon + burned + cleared - SINK * (air.carbon - FIRST_CARBON),
  );
  const toward = SENSITIVITY * dmath.log2(air.carbon / FIRST_CARBON);
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
    const smoke = smokeIn(ctx, p.cell);
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
