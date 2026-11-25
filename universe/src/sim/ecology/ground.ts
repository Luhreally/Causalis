// Each land's ground as stocks (Round A; the rule is rules/ground.ts). Once a year, as the ecology's year draws on its land: what
// its harvests took of each nutrient and what rest, beans, dung and made fertiliser gave back; its topsoil washed off by its rain
// and laid down from the lands above; the water its fields drew from its river and its groundwater, and the salt it left; the sour
// rain its own and its neighbours' burning let fall, and the metals its smelters lost and its river brought down. From them, its
// soil's strength (ecology.ts `soil`, what its fields yield by): its scarcest nutrient, by its topsoil, less what salt, sour rain
// and metals take, and less what its watered fields went without. One row of whole numbers a land; nothing grows with history.
import {
  YEAR,
  Hasher,
  defineEventType,
  type CauseRef,
  type Ref,
  type SimTime,
  type StateStore,
  type World,
} from "../../kernel/index.ts";
import { isProvinceWorld, meansNumbers, offworldSite } from "../../gen/index.ts";
import {
  ACID_TAKEN,
  TAKEN,
  AQUIFER_YEARS,
  DRAWN_OFF,
  FALLS_HOME,
  FIXING_NEEDS,
  engineDriven,
  nutrientYield,
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
import { farmedOf } from "./farmed.ts";
import { provinceCapacity, type PopulationContext } from "../population/systems.ts";
import { homePlanet } from "../planet/store.ts";
import { loreOf } from "../lore/lore.ts";
import type { MarketStore } from "../economy/market.ts";
import { dugSolid, type EnergyStore } from "../economy/energy.ts";
import type { Wilds } from "./ecology.ts";
import { smokeCut } from "../trade/kept.ts";

export const GROUND_EVENTS = {
  fouled: defineEventType("ecology.ground-fouled", 3),
  salted: defineEventType("ecology.ground-salted", 3),
  washed: defineEventType("ecology.topsoil-washed", 3),
  drawnDown: defineEventType("ecology.water-drawn-down", 3),
};

/** A land's ground, as kept: shares in thousandths of the virgin ground's, loads whole. */
export type Ground = {
  readonly cell: number;
  /** Each nutrient by NUTRIENTS, and its topsoil: millionths of the virgin ground's (slow changes, kept whole). */
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

/** Fold whole numbers into a running digest (two 32-bit words): what a checkpoint hashes in place of every row. */
function fold(d: [number, number], xs: readonly number[]): void {
  let a = d[0],
    b = d[1];
  for (const x of xs) {
    const lo = x | 0,
      hi = Math.floor(x / 4294967296) | 0;
    a = Math.imul(a ^ lo, 0x01000193) ^ hi;
    b = Math.imul(b + lo + 0x9e3779b9, 0x85ebca6b) ^ (b >>> 13);
  }
  d[0] = a;
  d[1] = b;
}

export class GroundStore implements StateStore {
  readonly name = "ecology.ground";
  /** Saved packed by column (kernel/pack.ts). */
  readonly packed = true;
  private readonly map = new Map<number, Ground>();
  /** Every row set, folded in as it is set: a checkpoint hashes this, not every land's ground (O(1) a checkpoint). */
  private readonly digest: [number, number] = [0x811c9dc5, 0];
  private sets = 0;

  get(cell: number): Ground | undefined {
    return this.map.get(cell);
  }
  set(g: Ground): void {
    this.map.set(g.cell, g);
    fold(this.digest, [
      g.cell,
      ...g.nut,
      g.top,
      g.acid,
      g.metal,
      g.salt,
      g.water,
      g.short,
      g.fixed,
      g.fixKw,
      g.silt,
      g.metalIn,
      g.fouled ? 1 : 0,
      g.salted ? 1 : 0,
      g.washed ? 1 : 0,
      g.drawnDown ? 1 : 0,
    ]);
    this.sets++;
  }
  /** It holds nothing yet: hashed as if it were not there. */
  dormant(): boolean {
    return this.map.size === 0;
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
    h.int(this.map.size).int(this.sets).int(this.digest[0]).int(this.digest[1]);
  }
  save(): unknown {
    return { lands: this.all(), digest: [...this.digest], sets: this.sets };
  }
  load(state: unknown): void {
    this.map.clear();
    const s = state as { lands?: Ground[]; digest?: [number, number]; sets?: number } | null;
    for (const g of s?.lands ?? []) this.map.set(g.cell, { ...g, nut: [...g.nut] });
    // (The fold goes on from where it stood.)
    this.digest[0] = s?.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s?.digest?.[1] ?? 0;
    this.sets = s?.sets ?? 0;
  }
}

/** A world's ground store (null on a world that keeps none). */
export function groundOf(world: World): GroundStore | null {
  return world.peek<GroundStore>("ecology.ground") ?? null;
}

/** The principles by which engines haul bulk (railways, steamships): rock for the fields goes where they run. */
const ROCK_HAULED: readonly string[] = engineDriven().map((e) => e.id);

/** A whole share of the virgin ground, as kept. */
export const SHARE = 1_000_000;

/** A land's ground as it was first farmed (its nutrients as worn as its soil already was, on a world from before them). */
function firstGround(cell: number, soil: number): Ground {
  const s = Math.round(SHARE * Math.min(1, Math.max(0, soil)));
  return {
    cell,
    nut: NUTRIENTS.map(() => s),
    top: SHARE,
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

function lieOf(ctx: PopulationContext, cell: number, areaKm2: number, keep = true): Lie {
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
  // (Its own slopes, where it is a province of a finer world: the mean of its fine lands' steepest steps, the relief its fields lie on.)
  if (isProvinceWorld(g)) {
    const f = g.fine,
      fe = f.tectonics.elevation,
      fp = f.grid.positions;
    let sum = 0,
      n = 0;
    for (let k = g.childOffsets[cell]!; k < g.childOffsets[cell + 1]!; k++) {
      const a = g.children[k]!;
      if (fe[a]! <= 0) continue;
      let most = 0;
      for (let j = f.grid.offsets[a]!; j < f.grid.offsets[a + 1]!; j++) {
        const b = f.grid.neighbours[j]!,
          dx = fp[3 * a]! - fp[3 * b]!,
          dy = fp[3 * a + 1]! - fp[3 * b + 1]!,
          dz = fp[3 * a + 2]! - fp[3 * b + 2]!,
          run = Math.sqrt(dx * dx + dy * dy + dz * dz) * radiusM;
        if (run > 0) most = Math.max(most, Math.abs(fe[a]! - Math.max(0, fe[b]!)) / run);
      }
      sum += most;
      n++;
    }
    if (n) slope = sum / n;
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
  if (keep) lies.set(cell, lie);
  return lie;
}

/** A land's slopes (rise over run), as its ground reads them (planet/floods.ts: where a river overruns its plain). */
export function landSlope(ctx: PopulationContext, cell: number): number {
  // (Read, never kept: what the ground keeps of a land is the ground's own to make, by its own area.)
  return lieOf(ctx, cell, 1, false).slope;
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
  const nut = Object.fromEntries(
    NUTRIENTS.map((n, i) => [n, (g.nut[i] ?? SHARE) / SHARE]),
  ) as Record<Nutrient, number>;
  return {
    nut,
    least: limiting(nut),
    top: g.top / SHARE,
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

/**
 * A land's ground through the year (ecology.ts ecologyYear, once its wilds have stepped), and its soil's strength from it.
 * `farmed`: the share of its farmland its fields use; `sour` the sour rain let fall on it a year (kg S/ha); `years` how many
 * years it steps at once. What its river carries down is laid on the land below, for that land's own next step.
 */
function stepGround(
  ctx: PopulationContext,
  cell: number,
  w: Wilds,
  farmed: number,
  sour: number,
  years: number,
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
    // (Dung enough to spread where its herders are a tenth of its farmers or more.)
    manure = farmers > 0 ? Math.min(1, (10 * p.occupation(OCC.herder)) / farmers) : 0,
    rotation = knows("rotation"),
    // (Rock dug for its phosphorus and potassium, spread where engines haul it.)
    rock = ROCK_HAULED.some(knows) ? 1 : 0;
  // Nitrogen fixed from the air where a current and strong vessels allow it: what its fields lack of their virgin store, as far
  // as its works drove the fixing last year.
  const fixing = FIXING_NEEDS.every((ids) => ids.some(knows)),
    nIndex = NUTRIENTS.indexOf("N"),
    lackN = Math.max(0, 1 - (g.nut[nIndex] ?? SHARE) / SHARE),
    energy = ctx.world.hasStore("economy.energy")
      ? ctx.world.store<EnergyStore>("economy.energy").get(cell)
      : undefined,
    cover = energy && energy.workWanted > 0 ? Math.min(1, energy.workHad / energy.workWanted) : 1,
    fert = fixing && fieldsKm2 > 0 ? Math.min(lackN + TAKEN.N * farmed, 0.05) * cover : 0;
  g.fixed = Math.round(fert * N_T_KM2 * fieldsKm2);
  g.fixKw = Math.round(
    fixing && fieldsKm2 > 0
      ? Math.min(lackN + TAKEN.N * farmed, 0.05) * N_T_KM2 * fieldsKm2 * FIX_KWY
      : 0,
  );
  const coalDug = dugSolid(ctx.world, cell, made?.[G.coal] ?? 0),
    smelted = (made?.[G.copper] ?? 0) + (made?.[G.tin] ?? 0) + (made?.[G.iron] ?? 0),
    ha = Math.max(1, c.areaKm2 * 100),
    down = gen.water.flowTo[cell] ?? -1,
    downKm2 = down >= 0 ? provinceCapacity(ctx, down, 0).areaKm2 : 0,
    downFlat = down >= 0 && downKm2 > 0 && lieOf(ctx, down, downKm2).slope <= FLAT;
  let laid = 0,
    sent = 0;
  // (Its years since it was last stepped, each as a year would be, its people's ways and its fields held as they stand now.)
  const watered = knows("irrigation");
  for (let year = 0; year < years; year++) {
    // The nutrients: what the harvest took (as large as it was), what came back.
    const crop = soilOf(g, watered);
    NUTRIENTS.forEach((nu, i) => {
      let s = (g.nut[i] ?? SHARE) / SHARE;
      s = nutrientYear(s, nu, {
        farmed,
        supply: supply[nu],
        rotation,
        manure: knows("manuring") ? manure : 0,
        fertiliser: nu === "N" ? fert : 0,
        rock,
        crop,
      });
      g.nut[i] = Math.round(SHARE * s);
    });
    // The topsoil: washed off by the rain, formed from the rock below, laid down from the lands above.
    const top = g.top / SHARE,
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
        g.nut[i] = Math.min(1.3 * SHARE, Math.round(g.nut[i]! + 0.5 * SHARE * silt));
    g.top = Math.round(SHARE * next);
    g.silt = 0;
    if (downFlat && lost > 0) laid += (lost * LAID_DOWN * c.areaKm2) / downKm2;
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
    g.acid = Math.max(
      0,
      Math.round(g.acid * (1 - ACID_TAKEN) + sour + (coalDug * MINE_ACID_KG) / ha),
    );
    const metal = g.metal / 10 + g.metalIn / 10 + (smelted * METAL_LOST_KG) / ha,
      carried = metal * METAL_CARRIED;
    g.metal = Math.round(10 * metal * (1 - METAL_CARRIED - METAL_BOUND));
    g.metalIn = 0;
    if (down >= 0) sent += (carried * ha) / Math.max(1, downKm2 * 100);
  }
  // What its river carried down these years, laid on the land below for its own next step.
  const gd = down >= 0 ? store.get(down) : undefined;
  if (gd && (laid > 0 || sent > 0)) {
    gd.silt = Math.round(gd.silt + 1e6 * Math.min(0.05, laid));
    gd.metalIn = Math.round(gd.metalIn + 10 * sent);
    store.set(gd);
  }
  store.set(g);
  return g;
}

/** A land's soil's strength from its ground (0.3 … 1): its scarcest nutrient, by its topsoil, less what fouls it and what its fields went without. */
export function soilOf(g: Ground, watered: boolean): number {
  const least = nutrientYield(Math.min(...g.nut) / SHARE),
    top = Math.min(1, g.top / SHARE),
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

/** How many years a land's ground goes between its steps; each land steps in its own year of them (cell + year). */
export const GROUND_EVERY = 5;

/** The sour rain let fall on a land a year (kg of sulphur a hectare): its own burning's and its neighbours' (their energy accounts). */
function sourOn(ctx: PopulationContext, cell: number, areaKm2: number): number {
  const energy = ctx.world.peek<EnergyStore>("economy.energy") ?? null;
  if (!energy) return 0;
  const lie = lieOf(ctx, cell, areaKm2);
  // (Less what each land's works cut of their smoke at their realm's price on it: sim/trade, p87.)
  const w = ctx.world;
  let t =
    (energy.get(cell)?.sulphur ?? 0) * (1 - smokeCut(w, cell)) * (lie.near.length ? FALLS_HOME : 1);
  for (const b of lie.near) {
    const sb = (energy.get(b)?.sulphur ?? 0) * (1 - smokeCut(w, b));
    if (sb > 0) {
      const nb = lieOf(ctx, b, provinceCapacity(ctx, b, 0).areaKm2).near.length;
      t += (sb * (1 - FALLS_HOME)) / Math.max(1, nb);
    }
  }
  return areaKm2 > 0 ? (1000 * t) / (areaKm2 * 100) : 0;
}

/**
 * The ground's year (118.ground.year): the lands whose turn it is (one in GROUND_EVERY, by cell and year) step their ground
 * GROUND_EVERY years at once, and their soil's strength is set from it; the rest wait.
 */
export function groundYear(ctx: PopulationContext, t: SimTime): void {
  if (!groundOf(ctx.world)) return;
  const year = Math.floor((t - 1) / YEAR),
    eco = ctx.world.store<StateStore & { get(cell: number): Wilds | undefined }>("ecology.lands");
  for (const p of ctx.provinces.all()) {
    if ((p.cell + year) % GROUND_EVERY !== 0 || !p.total()) continue;
    if (offworldSite(ctx.generated, p.cell)) continue;
    const w = eco.get(p.cell);
    if (!w) continue;
    const c = provinceCapacity(ctx, p.cell),
      g = stepGround(
        ctx,
        p.cell,
        w,
        farmedOf(ctx, p),
        sourOn(ctx, p.cell, c.areaKm2),
        GROUND_EVERY,
      );
    w.soil = soilOf(g, !!loreOf(ctx.world).get(p.cell, "irrigation"));
    turns(ctx, g, t);
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
  if (saltHarm(g.salt) >= 0.35 && !g.salted)
    g.salted = world.events.emit({
      type: GROUND_EVENTS.salted.type,
      place,
      causes: [],
      data: { salt: g.salt },
    });
  else if (saltHarm(g.salt) < 0.1 && g.salted) g.salted = null;
  if (g.top < 0.6 * SHARE && !g.washed)
    g.washed = world.events.emit({
      type: GROUND_EVENTS.washed.type,
      place,
      causes: [],
      data: { top: Math.round((100 * g.top) / SHARE) },
    });
  else if (g.top > 0.8 * SHARE && g.washed) g.washed = null;
  if (g.water < 500 && !g.drawnDown)
    g.drawnDown = world.events.emit({
      type: GROUND_EVENTS.drawnDown.type,
      place,
      causes: [],
      data: { water: Math.round(g.water / 10) },
    });
  else if (g.water > 800 && g.drawnDown) g.drawnDown = null;
  // (What was told folded in with the rest.)
  groundOf(world)!.set(g);
}
