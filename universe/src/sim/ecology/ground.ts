// Each land's ground as stocks (Round A; the rule is rules/ground.ts). Once a year, as the ecology's year draws on its land: what
// its harvests took of each nutrient and what rest, beans, dung and made fertiliser gave back; its topsoil washed off by its rain
// and laid down from the lands above; the water its fields drew from its river and its groundwater, and the salt it left; the sour
// rain its own and its neighbours' burning let fall, and the metals its smelters lost and its river brought down. From them, its
// soil's strength (ecology.ts `soil`, what its fields yield by): its scarcest nutrient, by its topsoil, less what salt, sour rain
// and metals take, and less what its watered fields went without. One row of whole numbers a land; nothing grows with history.
import {
  Hasher,
  defineEventType,
  type CauseRef,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { meansNumbers, offworldSite } from "../../gen/index.ts";
import {
  ACID_TAKEN,
  AQUIFER_YEARS,
  DRAWN_OFF,
  FALLS_HOME,
  FIXING_NEEDS,
  FIX_KWY,
  FLAT,
  FORMED,
  G,
  HEAT_ENGINES,
  IRRIGATION_GAIN,
  LAID_DOWN,
  METAL_BOUND,
  METAL_CARRIED,
  METAL_FIFTH,
  METAL_LOST_KG,
  METAL_POISON,
  MINE_ACID_KG,
  NUTRIENTS,
  N_T_KM2,
  OCC,
  RUNOFF,
  SALT_RAIN,
  SALT_T_M3,
  SALT_WASHED,
  SINKS,
  SUBSOIL,
  WATERED,
  acidHarm,
  limiting,
  metalHarm,
  nutrientYear,
  saltHarm,
  supplyOf,
  thirstMm,
  washedOff,
  type Nutrient,
} from "../../rules/index.ts";
import { FARM_YIELD } from "../population/model.ts";
import { provinceCapacity, type PopulationContext } from "../population/systems.ts";
import { homePlanet } from "../planet/store.ts";
import { loreOf } from "../lore/lore.ts";
import type { MarketStore } from "../economy/market.ts";
import type { EnergyStore } from "../economy/energy.ts";
import type { Wilds } from "./ecology.ts";

export const GROUND_EVENTS = {
  fouled: defineEventType("ecology.ground-fouled", 3),
  salted: defineEventType("ecology.ground-salted", 3),
  washed: defineEventType("ecology.topsoil-washed", 3),
  drawnDown: defineEventType("ecology.water-drawn-down", 3),
};

/** A land's ground, as kept: shares in thousandths of the virgin ground's, loads whole. */
export type Ground = {
  readonly cell: number;
  /** Each nutrient by NUTRIENTS (thousandths of the virgin store), and its topsoil (thousandths). */
  nut: number[];
  top: number;
  /** Sour rain held (kg of sulphur a hectare) and metals (tenths of a kg a hectare); salt on its fields (t/km²). */
  acid: number;
  metal: number;
  salt: number;
  /** Its groundwater (thousandths of what it held at first), and what its watered fields went without (thousandths). */
  water: number;
  short: number;
  /** Nitrogen fixed for its fields this year (tonnes), and what its works must drive to fix it (kW). */
  fixed: number;
  fixKw: number;
  /** What its river brings it this year from the lands above: topsoil (millionths of its own) and metals (tenths of a kg a hectare). */
  silt: number;
  metalIn: number;
  /** The events of its ground's turns for the worse (null once eased). */
  fouled: Ref | null;
  salted: Ref | null;
  washed: Ref | null;
  drawnDown: Ref | null;
};

export class GroundStore implements StateStore {
  readonly name = "ecology.ground";
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  private readonly map = new Map<number, Ground>();

  get(cell: number): Ground | undefined {
    return this.map.get(cell);
  }
  set(g: Ground): void {
    this.map.set(g.cell, g);
  }
  all(): Ground[] {
    return [...this.map.values()].sort((a, b) => a.cell - b.cell);
  }
  pinned(): Ref[] {
    const refs: Ref[] = [];
    for (const g of this.map.values())
      for (const r of [g.fouled, g.salted, g.washed, g.drawnDown]) if (r) refs.push(r);
    return refs;
  }
  hashInto(h: Hasher): void {
    const all = this.all();
    h.int(all.length);
    for (const g of all) {
      h.int(g.cell);
      for (const x of g.nut) h.int(x);
      h.int(g.top)
        .int(g.acid)
        .int(g.metal)
        .int(g.salt)
        .int(g.water)
        .int(g.short)
        .int(g.fixed)
        .int(g.fixKw)
        .int(g.silt)
        .int(g.metalIn)
        .string(g.fouled ?? "")
        .string(g.salted ?? "")
        .string(g.washed ?? "")
        .string(g.drawnDown ?? "");
    }
  }
  save(): unknown {
    return { lands: this.all() };
  }
  load(state: unknown): void {
    this.map.clear();
    for (const g of (state as { lands?: Ground[] } | null)?.lands ?? [])
      this.set({ ...g, nut: [...g.nut] });
  }
}

/** A world's ground store (null on a world that keeps none). */
export function groundOf(world: World): GroundStore | null {
  return world.hasStore("ecology.ground") ? world.store<GroundStore>("ecology.ground") : null;
}

/** A land's ground as it was first farmed (its nutrients as worn as its soil already was, on a world from before them). */
function firstGround(cell: number, soil: number): Ground {
  const s = Math.round(1000 * Math.min(1, Math.max(0, soil)));
  return {
    cell,
    nut: NUTRIENTS.map(() => s),
    top: 1000,
    acid: 0,
    metal: 0,
    salt: 0,
    water: 1000,
    short: 0,
    fixed: 0,
    fixKw: 0,
    silt: 0,
    metalIn: 0,
    fouled: null,
    salted: null,
    washed: null,
    drawnDown: null,
  };
}

// —— A land's ground as the rule reads it, once ——————————————————————————————————————————————————————

type Lie = {
  /** Its steepest slope to a neighbour (rise over run), and whether it is flat enough to lay down silt. */
  readonly slope: number;
  /** Its river's water past its foot (m³ a year), and what sinks into its ground (m³ a year). */
  readonly riverM3: number;
  readonly rechargeM3: number;
  /** Its neighbours on land, for the sour rain it lets fall on them. */
  readonly near: readonly number[];
};
const LIES = new Map<string, Map<number, Lie>>();

function lieOf(ctx: PopulationContext, cell: number, areaKm2: number): Lie {
  const key = `${homePlanet(ctx.world).surfaceKey}:${ctx.medium}`;
  let lies = LIES.get(key);
  if (!lies) {
    if (LIES.size >= 8) LIES.delete(LIES.keys().next().value!);
    LIES.set(key, (lies = new Map()));
  }
  const kept = lies.get(cell);
  if (kept) return kept;
  const g = ctx.generated,
    e = g.tectonics.elevation,
    pos = g.grid.positions,
    radiusM = 6.371e6 * g.planet.radius,
    near: number[] = [];
  let slope = 0;
  for (let k = g.grid.offsets[cell]!; k < g.grid.offsets[cell + 1]!; k++) {
    const b = g.grid.neighbours[k]!;
    if (e[b]! > 0) near.push(b);
    const dx = pos[3 * cell]! - pos[3 * b]!,
      dy = pos[3 * cell + 1]! - pos[3 * b + 1]!,
      dz = pos[3 * cell + 2]! - pos[3 * b + 2]!,
      run = Math.sqrt(dx * dx + dy * dy + dz * dz) * radiusM;
    if (run > 0) slope = Math.max(slope, Math.abs(e[cell]! - Math.max(0, e[b]!)) / run);
  }
  const rain = g.climate.precipitation[cell]!,
    r = radiusM,
    lie: Lie = {
      // (A province's lands rise and fall within it more than between its middles: the steepest step, read as its slopes.)
      slope,
      riverM3: (((g.water.discharge[cell] ?? 0) * r * r) / 1e6) * RUNOFF,
      rechargeM3: rain * areaKm2 * 1e3 * SINKS,
      near,
    };
  lies.set(cell, lie);
  return lie;
}

// —— The year ———————————————————————————————————————————————————————————————————————————————————————

/** What a land's ground does to its people's health: the metals in its water (0 … METAL_POISON). */
export function groundPoison(world: World, cell: number): number {
  const g = groundOf(world)?.get(cell);
  return g ? METAL_POISON * Math.min(1, g.metal / 10 / (2 * METAL_FIFTH)) : 0;
}

/** How fouled a land's ground is, 0 … 1: what sour rain, metals and salt take of its yield together (the lens's number). */
export function fouledOf(world: World, cell: number): number {
  const g = groundOf(world)?.get(cell);
  if (!g) return 0;
  return Math.min(1, acidHarm(g.acid) + metalHarm(g.metal / 10) + WATERED * saltHarm(g.salt));
}

/** What a land's ground reads as, for its pages (shares 0 … 1; loads as kept). */
export function groundReading(world: World, cell: number) {
  const g = groundOf(world)?.get(cell);
  if (!g) return null;
  const nut = Object.fromEntries(NUTRIENTS.map((n, i) => [n, (g.nut[i] ?? 1000) / 1000])) as Record<
    Nutrient,
    number
  >;
  return {
    nut,
    least: limiting(nut),
    top: g.top / 1000,
    acidKgHa: g.acid,
    metalKgHa: g.metal / 10,
    saltTKm2: g.salt,
    water: g.water / 1000,
    short: g.short / 1000,
    fixedT: g.fixed,
    fixKw: g.fixKw,
    fouled: fouledOf(world, cell),
    poison: groundPoison(world, cell),
  };
}

/** The year's sour rain on each land (kg of sulphur a hectare), from the sulphur each land burned last year. */
function sourRain(ctx: PopulationContext, store: GroundStore): Map<number, number> {
  const out = new Map<number, number>(),
    energy = ctx.world.hasStore("economy.energy")
      ? ctx.world.store<EnergyStore>("economy.energy")
      : null;
  if (!energy) return out;
  const add = (cell: number, t: number) => {
    const ha = provinceCapacity(ctx, cell, 0).areaKm2 * 100;
    if (ha > 0) out.set(cell, (out.get(cell) ?? 0) + (1000 * t) / ha);
  };
  for (const e of energy.all()) {
    if (e.sulphur <= 0) continue;
    const lie = lieOf(ctx, e.cell, provinceCapacity(ctx, e.cell, 0).areaKm2);
    add(e.cell, e.sulphur * (lie.near.length ? FALLS_HOME : 1));
    for (const b of lie.near) add(b, (e.sulphur * (1 - FALLS_HOME)) / lie.near.length);
  }
  void store;
  return out;
}

/**
 * A land's ground through the year (ecology.ts ecologyYear, once its wilds have stepped), and its soil's strength from it.
 * `farmed`: the share of its farmland its fields use; `rain` (sour, kg S/ha) from sourRain; `below` gathers what its river
 * carries to the land below for next year.
 */
function stepGround(
  ctx: PopulationContext,
  cell: number,
  w: Wilds,
  farmed: number,
  sour: number,
  below: Map<number, { silt: number; metal: number }>,
): Ground {
  const store = groundOf(ctx.world)!,
    g = store.get(cell) ?? firstGround(cell, w.soil),
    gen = ctx.generated,
    n = meansNumbers(gen),
    lore = loreOf(ctx.world),
    knows = (id: string) => !!lore.get(cell, id),
    p = ctx.provinces.get(cell)!,
    c = provinceCapacity(ctx, cell),
    lie = lieOf(ctx, cell, c.areaKm2),
    fieldsKm2 = (farmed * c.farm) / FARM_YIELD,
    rain = gen.climate.precipitation[cell]!,
    thirst = thirstMm(gen.climate.temperature[cell]!),
    m = ctx.world.store<MarketStore>("economy.markets").get(cell),
    made = m?.years.at(-1)?.ledger[0],
    supply = supplyOf(n.ppm, n.airHolds),
    farmers = p.occupation(OCC.farmer),
    manure = farmers > 0 ? Math.min(1, (3 * p.occupation(OCC.herder)) / farmers) : 0,
    rotation = knows("rotation");
  // Nitrogen fixed from the air where a current and strong vessels allow it: what its fields lack of their virgin store, as far
  // as its works drove the fixing last year.
  const fixing = FIXING_NEEDS.every((ids) => ids.some(knows)) && n.airHolds.includes("nitrogen"),
    nIndex = NUTRIENTS.indexOf("N"),
    lackN = Math.max(0, 1 - (g.nut[nIndex] ?? 1000) / 1000),
    energy = ctx.world.hasStore("economy.energy")
      ? ctx.world.store<EnergyStore>("economy.energy").get(cell)
      : undefined,
    cover = energy && energy.workWanted > 0 ? Math.min(1, energy.workHad / energy.workWanted) : 1,
    fert = fixing && fieldsKm2 > 0 ? Math.min(lackN + 0.012 * farmed, 0.05) * cover : 0;
  g.fixed = Math.round(fert * N_T_KM2 * fieldsKm2);
  g.fixKw = Math.round(
    fixing && fieldsKm2 > 0
      ? Math.min(lackN + 0.012 * farmed, 0.05) * N_T_KM2 * fieldsKm2 * FIX_KWY
      : 0,
  );
  // The nutrients: what the harvest took, what came back.
  NUTRIENTS.forEach((nu, i) => {
    let s = (g.nut[i] ?? 1000) / 1000;
    s = nutrientYear(s, nu, {
      farmed,
      supply: supply[nu],
      rotation,
      manure: knows("manuring") ? manure : 0,
      fertiliser: nu === "N" ? fert : 0,
    });
    g.nut[i] = Math.round(1000 * s);
  });
  // The topsoil: washed off by the rain, formed from the rock below, laid down from the lands above.
  const top = g.top / 1000,
    // (Under the sea no rain washes a shelf's fields, and none is watered.)
    undersea = ctx.medium === "water",
    lost = undersea
      ? 0
      : top *
        washedOff({
          rainMm: rain,
          slope: lie.slope,
          farmed,
          forest: w.forest,
          terraced: knows("terracing"),
        }),
    silt = g.silt / 1e6;
  let next = Math.min(1.3, Math.max(0, top - lost + FORMED * (1 - Math.min(1, top)) + silt));
  if (lost > 0) {
    // (Its nutrients go with its topsoil, and the silt brings the uplands' with it.)
    for (let i = 0; i < g.nut.length; i++) g.nut[i] = Math.round(g.nut[i]! * (1 - 0.5 * lost));
  }
  if (silt > 0)
    for (let i = 0; i < g.nut.length; i++)
      g.nut[i] = Math.min(1300, Math.round(g.nut[i]! + 500 * silt));
  g.top = Math.round(1000 * next);
  g.silt = 0;
  const down = gen.water.flowTo[cell] ?? -1;
  if (down >= 0 && lost > 0) {
    const cd = provinceCapacity(ctx, down, 0);
    if (cd.areaKm2 > 0 && lieOf(ctx, down, cd.areaKm2).slope <= FLAT) {
      const b = below.get(down) ?? { silt: 0, metal: 0 };
      b.silt += (lost * LAID_DOWN * c.areaKm2) / cd.areaKm2;
      below.set(down, b);
    }
  }
  // The water its fields are given, from its river first, then from under its ground.
  let short = 0;
  const watering = !undersea && knows("irrigation") && fieldsKm2 > 0 && thirst > rain;
  if (watering) {
    const need = fieldsKm2 * WATERED * (thirst - rain) * 1e3,
      fromRiver = Math.min(need, lie.riverM3 * DRAWN_OFF),
      held = (g.water / 1000) * lie.rechargeM3 * AQUIFER_YEARS,
      // (Wells by hand and beast take what sinks in each year; engines' pumps take what the ground has held for centuries.)
      pumped = HEAT_ENGINES.some(knows) || knows("electricity"),
      fromGround = Math.min(need - fromRiver, pumped ? held + lie.rechargeM3 : lie.rechargeM3),
      had = fromRiver + fromGround;
    short = need > 0 ? Math.max(0, 1 - had / need) : 0;
    const cap = lie.rechargeM3 * AQUIFER_YEARS;
    g.water =
      cap > 0
        ? Math.round(1000 * Math.min(1, Math.max(0, (held + lie.rechargeM3 - fromGround) / cap)))
        : g.water;
    // The salt it leaves on the fields watered.
    g.salt = Math.round(g.salt + (had * SALT_T_M3) / Math.max(1e-6, fieldsKm2 * WATERED));
  } else if (lie.rechargeM3 > 0) {
    // (Unpumped, its groundwater fills again toward what it held.)
    g.water = Math.min(1000, g.water + Math.round(1000 / AQUIFER_YEARS));
  }
  g.short = Math.round(1000 * short);
  g.salt = Math.max(
    0,
    Math.round(
      g.salt * (1 - Math.min(1, SALT_WASHED + (SALT_RAIN * Math.max(0, rain - thirst)) / 1000)),
    ),
  );
  // What fouls it: sour rain, and metals lost by its smelters, its river's, and those bound away into its silt.
  const coalDug = made?.[G.coal] ?? 0,
    smelted = (made?.[G.copper] ?? 0) + (made?.[G.tin] ?? 0) + (made?.[G.iron] ?? 0),
    ha = Math.max(1, c.areaKm2 * 100);
  g.acid = Math.max(
    0,
    Math.round(g.acid * (1 - ACID_TAKEN) + sour + (coalDug * MINE_ACID_KG) / ha),
  );
  const metal = g.metal / 10 + g.metalIn / 10 + (smelted * METAL_LOST_KG) / ha,
    carried = metal * METAL_CARRIED;
  g.metal = Math.round(10 * metal * (1 - METAL_CARRIED - METAL_BOUND));
  g.metalIn = 0;
  if (down >= 0 && carried > 0) {
    const cd = provinceCapacity(ctx, down, 0),
      b = below.get(down) ?? { silt: 0, metal: 0 };
    b.metal += (carried * ha) / Math.max(1, cd.areaKm2 * 100);
    below.set(down, b);
  }
  store.set(g);
  return g;
}

/** A land's soil's strength from its ground (0.3 … 1): its scarcest nutrient, by its topsoil, less what fouls it and what its fields went without. */
export function soilOf(g: Ground, watered: boolean): number {
  const least = Math.min(...g.nut) / 1000,
    top = Math.min(1, g.top / 1000),
    fouled = acidHarm(g.acid) + metalHarm(g.metal / 10),
    salt = watered ? WATERED * saltHarm(g.salt) : 0,
    dry = watered ? (WATERED * (g.short / 1000) * IRRIGATION_GAIN) / (1 + IRRIGATION_GAIN) : 0;
  return Math.min(
    1,
    Math.max(
      0.3,
      least * (SUBSOIL + (1 - SUBSOIL) * top) * (1 - Math.min(0.8, fouled + salt)) * (1 - dry),
    ),
  );
}

/** The ground's year begun (ecology.ts, before its lands step): the sour rain each land is let fall, and what its rivers will carry down. */
export type GroundYear = {
  readonly sour: ReadonlyMap<number, number>;
  readonly below: Map<number, { silt: number; metal: number }>;
};
export function groundBegin(ctx: PopulationContext): GroundYear | null {
  const store = groundOf(ctx.world);
  return store ? { sour: sourRain(ctx, store), below: new Map() } : null;
}

/** A land's ground through the year, once its wilds have stepped: its soil's strength set from it (ecology.ts). */
export function groundStep(
  ctx: PopulationContext,
  y: GroundYear,
  w: Wilds,
  farmed: number,
  t: SimTime,
): void {
  if (offworldSite(ctx.generated, w.cell)) return;
  const g = stepGround(ctx, w.cell, w, farmed, y.sour.get(w.cell) ?? 0, y.below);
  w.soil = soilOf(g, !!loreOf(ctx.world).get(w.cell, "irrigation"));
  turns(ctx, g, t);
}

/** The ground's year ended: what the rivers carry down laid on the lands below, for next year. */
export function groundEnd(ctx: PopulationContext, y: GroundYear): void {
  const store = groundOf(ctx.world)!;
  for (const [cell, b] of [...y.below].sort((a, z) => a[0] - z[0])) {
    const g = store.get(cell);
    if (!g) continue;
    g.silt = Math.round(1e6 * Math.min(0.01, b.silt));
    g.metalIn = Math.round(10 * b.metal);
  }
}

/** A land's ground's turns for the worse, told once (and again only once eased). */
function turns(ctx: PopulationContext, g: Ground, _t: SimTime): void {
  const { world } = ctx,
    place = ctx.provinces.get(g.cell)!.ref,
    cause = (ref: Ref | null): CauseRef[] => (ref ? [{ ref, role: "enabler", weight: 0.5 }] : []),
    m = world.store<MarketStore>("economy.markets").get(g.cell),
    fouled = acidHarm(g.acid) + metalHarm(g.metal / 10);
  if (fouled >= 0.15 && !g.fouled)
    g.fouled = world.events.emit({
      type: GROUND_EVENTS.fouled.type,
      place,
      causes: cause(m?.works ?? m?.mine ?? null),
      data: { acid: g.acid, metal: Math.round(g.metal / 10) },
    });
  else if (fouled < 0.05 && g.fouled) g.fouled = null;
  if (saltHarm(g.salt) >= 0.25 && !g.salted)
    g.salted = world.events.emit({
      type: GROUND_EVENTS.salted.type,
      place,
      causes: [],
      data: { salt: g.salt },
    });
  else if (saltHarm(g.salt) < 0.1 && g.salted) g.salted = null;
  if (g.top < 600 && !g.washed)
    g.washed = world.events.emit({
      type: GROUND_EVENTS.washed.type,
      place,
      causes: [],
      data: { top: Math.round(g.top / 10) },
    });
  else if (g.top > 800 && g.washed) g.washed = null;
  if (g.water < 500 && !g.drawnDown)
    g.drawnDown = world.events.emit({
      type: GROUND_EVENTS.drawnDown.type,
      place,
      causes: [],
      data: { water: Math.round(g.water / 10) },
    });
  else if (g.water > 800 && g.drawnDown) g.drawnDown = null;
}
