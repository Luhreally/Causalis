// Each land's energy account (Round A: energy as one budget; the rule is rules/energy.ts). Once a year, as the economy closes
// a land's crafts: what its people want of heat (hearths, smelters) and of work (works, carriers, homes), and what they draw to
// meet it, carrier by carrier, from what the world already holds there — its bodies and beasts, its woods, its herds' dung and
// fields' straw, its rivers' fall, wind and tides, its ground's and vents' heat, its star's light, the coal and oil in its
// market, the gas drawn with its oil, its world's own fuel lying about, the atom. What is burned is taken from its market and
// its woods; its works' share of the work they wanted is what drives its crafts next year, and machines are wanted as far as
// engines drove it. A land keeps only last year's account and a faded measure of its smoke: one row a land, never a log.
import { Hasher, type SimTime, type StateStore, type World } from "../../kernel/index.ts";
import {
  meansNumbers,
  meansOfWorld,
  originGround,
  surfaceOre,
  worldChemistry,
} from "../../gen/index.ts";
import {
  CARRIERS,
  EDGE_HEAT,
  FISSION_METALS,
  FUEL_MAKEUP,
  FUEL_UNIT_KWY,
  G,
  GROUND_DRAWN,
  GROUND_WM2,
  HEAT_ENGINES,
  HERD_GIVES,
  MJ_A_KWY,
  OCC,
  SOURCES,
  SOURCE_BY,
  SPOT_HEAT,
  TIDE_KW_KM,
  WANTS,
  WIND_GROUND,
  WIND_MS,
  WIND_SPACING,
  WOODS_HOLD_YEARS,
  WOOD_TAKEN,
  WIND_TURBINES,
  WORK_KW,
  bestHeat,
  carbonKg,
  coldOf,
  energyAccount,
  engineDriven,
  fitOf,
  fuelUnitKg,
  groundHeatC,
  groundLight,
  growthTkm2,
  joinedHeat,
  mirrorHeat,
  oxidantsOf,
  primaryPower,
  riverKw,
  stuffOf,
  sulphurKg,
  windWm2,
  workPower,
  type Carrier,
  type EnergyAccount,
  type EnergyInputs,
  type LandFacts,
  type Source,
} from "../../rules/index.ts";
import { homePlanet } from "../planet/store.ts";
import type { Province } from "../population/model.ts";
import { provinceCapacity, type PopulationContext } from "../population/systems.ts";
import { loreOf } from "../lore/lore.ts";
import { ecologyOf } from "../ecology/ecology.ts";
import { woodsRead } from "../ecology/woods.ts";
import { groundOf } from "../ecology/ground.ts";
import { furnaceHeat } from "./heat.ts";
import type { Market } from "./market.ts";

/** A land's last year of energy, as kept: kW and kW·yr, whole; a share in thousandths. */
export type EnergyLand = {
  readonly cell: number;
  /** Its people when it was reckoned. */
  people: number;
  /** What it drew of each carrier (kW), by CARRIERS; the work each source gave (kW), by SOURCES. */
  drawn: number[];
  by: number[];
  workWanted: number;
  workHad: number;
  worksWanted: number;
  heatWanted: number;
  heatHad: number;
  /** Its engines' share of Carnot's bound on what burns (thousandths). */
  share: number;
  /** Buried fuel burned (kW·yr): coal, oil, gas, its world's own; wood felled past what its woods give; fuel it went without. */
  coal: number;
  oil: number;
  gas: number;
  own: number;
  felled: number;
  /** The buried fuel its hearths and engines wanted, had they had it all (kW·yr). */
  fuelWanted: number;
  /** Carbon and sulphur its burning of buried fuel sent up (tonnes). */
  carbon: number;
  sulphur: number;
  /** Its works' smoke: fuel burned outside its hearths, weighted by how it smokes, faded by half each year (kW·yr). */
  fume: number;
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

export class EnergyStore implements StateStore {
  readonly name = "economy.energy";
  /** Saved packed by column (kernel/pack.ts): one row of whole numbers a land. */
  readonly packed = true;
  private readonly map = new Map<number, EnergyLand>();
  /** Every row set, folded in as it is set: a checkpoint hashes this, not every land's account (O(1) a checkpoint). */
  private readonly digest: [number, number] = [0x811c9dc5, 0];
  private sets = 0;

  get(cell: number): EnergyLand | undefined {
    return this.map.get(cell);
  }
  set(e: EnergyLand): void {
    this.map.set(e.cell, e);
    fold(this.digest, rowOf(e));
    this.sets++;
  }
  /** It holds nothing yet: hashed as if it were not there. */
  dormant(): boolean {
    return this.map.size === 0;
  }
  drop(cell: number): void {
    this.map.delete(cell);
  }
  all(): EnergyLand[] {
    return [...this.map.values()].sort((a, b) => a.cell - b.cell);
  }
  hashInto(h: Hasher): void {
    h.int(this.map.size).int(this.sets).int(this.digest[0]).int(this.digest[1]);
  }
  save(): unknown {
    return { lands: this.all(), digest: [...this.digest], sets: this.sets };
  }
  load(state: unknown): void {
    this.map.clear();
    const s = state as { lands?: EnergyLand[]; digest?: [number, number]; sets?: number } | null;
    for (const e of s?.lands ?? [])
      this.map.set(e.cell, { ...e, drawn: [...e.drawn], by: [...e.by] });
    // (The fold goes on from where it stood.)
    this.digest[0] = s?.digest?.[0] ?? 0x811c9dc5;
    this.digest[1] = s?.digest?.[1] ?? 0;
    this.sets = s?.sets ?? 0;
  }
}

/** A land's row as the digest folds it (in one array kept for it: the fold reads it at once). */
const ROW: number[] = [];
function rowOf(e: EnergyLand): number[] {
  let i = 0;
  ROW[i++] = e.cell;
  ROW[i++] = e.people;
  for (const x of e.drawn) ROW[i++] = x;
  for (const x of e.by) ROW[i++] = x;
  ROW[i++] = e.workWanted;
  ROW[i++] = e.workHad;
  ROW[i++] = e.worksWanted;
  ROW[i++] = e.heatWanted;
  ROW[i++] = e.heatHad;
  ROW[i++] = e.share;
  ROW[i++] = e.coal;
  ROW[i++] = e.oil;
  ROW[i++] = e.gas;
  ROW[i++] = e.own;
  ROW[i++] = e.felled;
  ROW[i++] = e.fuelWanted;
  ROW[i++] = e.carbon;
  ROW[i++] = e.sulphur;
  ROW[i++] = e.fume;
  ROW.length = i;
  return ROW;
}

/** A world's energy store (null on a world that keeps none). */
export function energyBooks(world: World): EnergyStore | null {
  return world.hasStore("economy.energy") ? world.store<EnergyStore>("economy.energy") : null;
}

// —— What a land is, read once from its ground ——————————————————————————————————————————————————————

/** A land's ground as its account reads it: a pure function of the world, kept by its surface, never saved. */
type Site = {
  readonly areaKm2: number;
  /** What flows (kW): its rivers' fall, the wind where turbines could stand, its tides along its coast. */
  readonly riverKw: number;
  readonly windKw: number;
  readonly tideKw: number;
  /** The ground's heat it can draw (kW) and how hot (°C); its vents' (kW). */
  readonly groundKw: number;
  readonly groundC: number;
  readonly ventKw: number;
  /** Its star's light at its ground (W/m²). */
  readonly lightWm2: number;
  /** What a square kilometre of its green grows a year (t dry), and its wood's heat a kilogram (MJ). */
  readonly growth: number;
  readonly woodMj: number;
};
const SITES = new Map<string, Map<number, Site>>();

/** A land's vents' heat, where a people of the sea floor works them (kW, est: a field of black smokers). */
export const VENT_KW = 5e4;
/** What a land's crafters gather of their world's own fuel lying about, each, a year (kW·yr, est: as a collier digs coal). */
export const OWN_KWY = 60;
/** The gas drawn with each unit of oil (kW·yr, est: a quarter of the oil's heat). */
export const GAS_A_UNIT = 1;
/** A sea floor's vents' heat (°C: Koschinsky 2008), as rules/means.ts groundHeat reads it. */
export const VENT_C = 464;

/** The sites last asked for, and the surface and medium they were of (most asks, a year's, are of one world's). */
let lastSites: { surface: string; medium: string; sites: Map<number, Site> } | null = null;

function siteOf(ctx: PopulationContext, cell: number): Site {
  const surface = homePlanet(ctx.world).surfaceKey;
  let sites =
    lastSites && lastSites.surface === surface && lastSites.medium === ctx.medium
      ? lastSites.sites
      : undefined;
  if (!sites) {
    const key = `${surface}:${ctx.medium}`;
    sites = SITES.get(key);
    if (!sites) {
      if (SITES.size >= 8) SITES.delete(SITES.keys().next().value!);
      SITES.set(key, (sites = new Map()));
    }
    lastSites = { surface, medium: ctx.medium, sites };
  }
  const kept = sites.get(cell);
  if (kept) return kept;
  const g = ctx.generated,
    n = meansNumbers(g),
    t = g.tectonics,
    areaKm2 = provinceCapacity(ctx, cell, 0).areaKm2,
    water = ctx.medium === "water",
    // Its river's fall across it: down to the land it drains to, or to the sea.
    down = g.water.flowTo[cell] ?? -1,
    fall = t.elevation[cell]! - (down >= 0 ? Math.max(0, t.elevation[down]!) : 0);
  // Its coast: the share of its borders on the sea, of a border as long as four of its sides (a sea land's all of it).
  let sea = 0;
  const from = g.grid.offsets[cell]!,
    to = g.grid.offsets[cell + 1]!;
  for (let k = from; k < to; k++) if (t.elevation[g.grid.neighbours[k]!]! <= 0) sea++;
  const side = Math.sqrt(Math.max(0, areaKm2)),
    coastKm = water ? 4 * side : to > from ? (4 * side * sea) / (to - from) : 0,
    near = t.boundary[cell] !== 0 || t.toBoundary[cell]! <= 2,
    spot = t.hotspots.includes(cell),
    o = originOf(ctx),
    risingWm2 = GROUND_WM2 * o.heat * (spot ? SPOT_HEAT : near ? EDGE_HEAT : 1),
    // An air's weight a cubic metre: its pressure over R T, at its own weight a mole.
    airKg = (n.airBar * 1e5 * airMolar(n.airHolds)) / 1000 / (8.314 * Math.max(1, n.kelvin)),
    beam = n.rockHolds.includes("tholin") ? 0.01 : 0.75,
    site: Site = {
      areaKm2,
      riverKw: water
        ? 0
        : riverKw(g.water.discharge[cell] ?? 0, fall, g.planet.radius, n.pull, n.seaKgM3),
      windKw: water
        ? 0
        : windWm2(airKg, WIND_MS) * areaKm2 * 1e6 * WIND_GROUND * WIND_SPACING * 1e-3,
      tideKw: coastKm * TIDE_KW_KM * o.tides,
      groundKw: areaKm2 * 1e6 * risingWm2 * GROUND_DRAWN * 1e-3,
      groundC: groundHeatC(n.kelvin - 273.15, risingWm2, !n.rock),
      ventKw: water && surfaceOre(g, cell, "vent") ? VENT_KW : 0,
      lightWm2: water ? 0 : groundLight(n.sunWm2, beam, g.grid.lat[cell]!),
      growth: g.life.species.length
        ? growthTkm2(
            g.climate.temperature[cell]!,
            water ? 2000 : g.climate.precipitation[cell]!,
            (n.sunWm2 / 1361) * o.ground,
          )
        : 0,
      woodMj: bestHeat(FUEL_MAKEUP.wood!, oxidantsOf(n)).mj,
    };
  sites.set(cell, site);
  return site;
}

type Origin = { readonly tides: number; readonly heat: number; readonly ground: number };
const ORIGINS = new Map<string, Origin>();
/** A world's tides (Earth's 1), its ground's heat (Earth's 1) and the share of its light its haze lets down: read once a world. */
function originOf(ctx: PopulationContext): Origin {
  const key = ctx.generated.digest,
    kept = ORIGINS.get(key);
  if (kept) return kept;
  if (ORIGINS.size >= 8) ORIGINS.delete(ORIGINS.keys().next().value!);
  const o = originGround(ctx.generated),
    out = { tides: o.tides, heat: o.heat, ground: o.light > 0 ? o.ground / o.light : 1 };
  ORIGINS.set(key, out);
  return out;
}

/** An air's weight a mole (g/mol, est): Earth's 29; a methane world's nitrogen and methane some 28. */
function airMolar(airHolds: readonly string[]): number {
  return airHolds.includes("methane") ? 28 : 29;
}

// —— What a land knows, as its account asks it ——————————————————————————————————————————————————————

let DRIVEN: readonly { id: string; haul: number; carrying: number }[] | null = null;

/** The share of what eases a land's carrying that engines drive (0: none, 1: all). */
export function engineCarried(ctx: PopulationContext, cell: number): number {
  const lore = loreOf(ctx.world);
  let driven = 0;
  for (const d of (DRIVEN ??= engineDriven()))
    if (lore.get(cell, d.id)) driven += d.haul + d.carrying;
  if (!driven) return 0;
  const all = lore.effect(cell, "haul") + lore.effect(cell, "carrying");
  return all > 0 ? Math.min(1, driven / all) : 0;
}

/** What its work last year covered of what its works, carriers and homes wanted (0 … 1; 1 where they wanted none). */
export function workCover(world: World, cell: number): number {
  const e = energyBooks(world)?.get(cell);
  if (!e || e.workWanted <= 0) return 1;
  return Math.min(1, e.workHad / e.workWanted);
}

// —— The year ———————————————————————————————————————————————————————————————————————————————————————

/** What a unit of meat weighs (kg, est): a month's food of it. */
const MEAT_UNIT_KG = 30;

/** A tame beast's weight (kg) on a land: its own herd beast's, else its world's biggest tame grazer's. */
function beastKgOf(ctx: PopulationContext, cell: number): number {
  const g = ctx.generated,
    own = g.life.herdBeast[cell] ?? -1;
  if (own >= 0) return g.life.species[own]?.size ?? 0;
  return meansNumbers(g).beast?.kg ?? 0;
}

/**
 * Its world's own fuel lying about for the gathering (null: none): a methane world's haze, settled as acetylene and tholin,
 * for a people who join it with their air's hydrogen; a sulfur-volcano world's native sulphur by its vents, for a people
 * whose engines burn.
 */
function ownFuel(
  ctx: PopulationContext,
  cell: number,
  airHolds: readonly string[],
  k: Knowing,
): "haze" | "sulphur" | null {
  if (airHolds.includes("hydrogen") && k.coldChemistry) return "haze";
  const t = ctx.generated.tectonics;
  if (
    airHolds.includes("so2") &&
    k.steamEngine &&
    (t.boundary[cell] !== 0 || t.toBoundary[cell]! <= 2)
  )
    return "sulphur";
  return null;
}

/** What a land's account reads of what it knows: the sources it can tap and the craft of its engines. */
type Knowing = {
  readonly taps: ReadonlySet<Source>;
  readonly engine: boolean;
  readonly draught: boolean;
  readonly blast: boolean;
  readonly windTurbines: boolean;
  readonly coalKnown: boolean;
  readonly oilKnown: boolean;
  readonly coldChemistry: boolean;
  readonly steamEngine: boolean;
  readonly carried: number;
  readonly fitMm: number;
  readonly strengthMpa: number;
};
/** Each land's Knowing, by what it knows as kept, with that map's size then: lore only grows, so it holds while the size does. */
const KNOWING = new WeakMap<object, { size: number; k: Knowing }>();

function knowingOf(ctx: PopulationContext, cell: number): Knowing {
  const lore = loreOf(ctx.world),
    known = lore.knownOf(cell),
    kept = known && KNOWING.get(known);
  if (kept && kept.size === known.size) return kept.k;
  const g = ctx.generated,
    n = meansNumbers(g),
    knows = (id: string) => !!lore.get(cell, id),
    taps = new Set<Source>();
  for (const s of SOURCES)
    if (
      s !== "none" &&
      SOURCE_BY[s].some(knows) &&
      (s !== "fission" || n.metalShare >= FISSION_METALS)
    )
      taps.add(s);
  const engine = HEAT_ENGINES.some(knows),
    facts = { knows } as unknown as LandFacts,
    k: Knowing = {
      taps,
      engine,
      draught: knows("draught"),
      blast: knows("steel"),
      windTurbines: WIND_TURBINES.some(knows),
      coalKnown: knows("coal-mining"),
      oilKnown: knows("oil-drilling"),
      coldChemistry: knows("cold-chemistry"),
      steamEngine: knows("steam-engine"),
      carried: engineCarried(ctx, cell),
      fitMm: engine ? fitOf(facts).mm : 1,
      strengthMpa: engine ? stuffOf(facts, worldChemistry(g)).strength : 50,
    };
  if (known) KNOWING.set(known, { size: known.size, k });
  return k;
}

/** What a land's account reads of it this year: `smelted` is the metal its smelters made. */
export function energyInputs(
  ctx: PopulationContext,
  p: Province,
  m: Market,
  smelted: number,
): EnergyInputs {
  const g = ctx.generated,
    n = meansNumbers(g),
    site = siteOf(ctx, p.cell),
    lore = loreOf(ctx.world),
    k = knowingOf(ctx, p.cell),
    fire = meansOfWorld(g).burns,
    people = p.total(),
    standing = woodsRead(ctx, p.cell).now * site.areaKm2,
    own = k.engine ? ownFuel(ctx, p.cell, n.airHolds, k) : null;
  return {
    people,
    workers: people - p.occupation(OCC.dependent),
    farmers: p.occupation(OCC.farmer),
    crafters: p.occupation(OCC.crafter),
    traders: p.occupation(OCC.trader),
    appetite: ctx.life.appetite,
    fed: Math.min(1, Math.max(0, p.fed / 1000)),
    herdKg: (m.line("made", G.meat) * MEAT_UNIT_KG) / HERD_GIVES,
    beastKg: beastKgOf(ctx, p.cell),
    draught: k.draught,
    grain: m.line("made", G.grain),
    cold: coldOf(g.climate.temperature[p.cell]!),
    fire,
    smelted,
    blast: k.blast,
    industry: Math.min(1.5, lore.effect(p.cell, "industry")),
    carried: k.carried,
    homes: k.taps.has("dam"),
    fixKw: groundOf(ctx.world)?.get(p.cell)?.fixKw ?? 0,
    taps: k.taps,
    engine: k.engine,
    woodKw: (standing * site.growth * 1000 * WOOD_TAKEN * site.woodMj) / MJ_A_KWY,
    riverKw: site.riverKw,
    windKw: site.windKw,
    windTurbines: k.windTurbines,
    tideKw: site.tideKw,
    groundKw: site.groundKw,
    groundC: site.groundC,
    ventKw: site.ventKw,
    ventC: VENT_C,
    lightWm2: site.lightWm2,
    mirrorC: mirrorHeat(n, 2000),
    coalKwy: m.stock[G.coal]! * FUEL_UNIT_KWY,
    oilKwy: m.stock[G.oil]! * FUEL_UNIT_KWY,
    gasKwy: k.oilKnown ? m.line("made", G.oil) * GAS_A_UNIT : 0,
    ownKwy: own ? p.occupation(OCC.crafter) * OWN_KWY : 0,
    fireC: fire ? furnaceHeat(ctx, p.cell) : joinedHeat(n),
    coldK: n.kelvin,
    fitMm: k.fitMm,
    strengthMpa: k.strengthMpa,
    coalKnown: k.coalKnown,
    oilKnown: k.oilKnown,
  };
}

/** How each fuel smokes at a works, against coal's (est: soot and sour smoke; a hearth's own is in a people's life table). */
export const SMOKES = { coal: 1, oil: 0.4, gas: 0.02, own: 0.5, wood: 0.3 } as const;

/** What a unit of each buried fuel sends to the air: carbon and sulphur (tonnes). */
function unitTonnes(fuel: "coal" | "oil" | "gas"): { carbon: number; sulphur: number } {
  const parts = FUEL_MAKEUP[fuel]!,
    kg =
      fuel === "gas"
        ? (FUEL_UNIT_KWY * MJ_A_KWY) / bestHeat(parts, ["oxygen"]).mj
        : fuelUnitKg(fuel);
  return { carbon: (kg * carbonKg(parts)) / 1000, sulphur: (kg * sulphurKg(parts)) / 1000 };
}
let PER_UNIT: Record<"coal" | "oil" | "gas", { carbon: number; sulphur: number }> | null = null;
/** Carbon and sulphur a unit of coal, oil or gas sends to the air (tonnes). */
export function fuelTonnes(fuel: "coal" | "oil" | "gas"): { carbon: number; sulphur: number } {
  PER_UNIT ??= { coal: unitTonnes("coal"), oil: unitTonnes("oil"), gas: unitTonnes("gas") };
  return PER_UNIT[fuel];
}

/**
 * A land's year of energy (economy/systems.ts makeAndUse, once its crafts are done): its account reckoned, what it burned
 * taken from its market, its woods felled past what they give, what its works had set to drive its crafts next year, and the
 * buried fuel it wanted added to what its market wants.
 */
/** The old engines' share of the heat (WORK_KW of work from WANTS.fuelPerCrafter units of fuel a year): what work that burns nothing is counted as, where a land has no engines that burn. */
const OLD_ENGINE_SHARE = WORK_KW / (WANTS.fuelPerCrafter * FUEL_UNIT_KWY);

/**
 * The power a land's works drew, as the demographic transition reads it (powerOf: units of fuel burned a year, FUEL_UNIT_KWY
 * of heat each). A BRIDGE, for round C to replace: it rebuilds the transition on child survival, the cost of raising young and
 * energyPerHead().work. Until then it is counted as primary energy is by the substitution method: the heat of the fuel, wood
 * and atom its engines burned and of the ground and the star they drew on, and the work of its turbines and wheels (dams,
 * currents) as the fuel its own engines would have burned for it (at their share of the heat; the old engines' where it has
 * none that burn). Its works' share of all of it (the rest is its carriers' and its homes'); its old mills are powerOf's own.
 *
 * What it does to first light (its people at 800 / 900 / 1000): 538M / 399M / 256M, against 514M / 553M / 551M on
 * universe/finance, whose works ran on coal they mostly could not get (their power cover 0.27-0.36). Turbines on its rivers
 * and tides cover its works (0.75-0.91), half its people come to the full transition (keeps 0.60, against 0.80), and it
 * falls below replacement there: round C's transition replaces this before the release.
 */
export function transitionPower(a: EnergyAccount): number {
  const worksShare = a.workWanted > 0 ? a.worksWanted / a.workWanted : 0,
    share = a.share > 0 ? a.share : OLD_ENGINE_SHARE,
    heat = a.engineFuel + a.engineWood + a.drawn.atom + a.drawn.ground + a.drawn.sun,
    flows = (a.by.dam + a.by.current) / share;
  return Math.round(((heat + flows) * worksShare) / FUEL_UNIT_KWY);
}

export function energyYear(
  ctx: PopulationContext,
  p: Province,
  m: Market,
  _t: SimTime,
  want: number[],
  smelted: number,
): EnergyAccount {
  const store = energyBooks(ctx.world)!,
    inputs = energyInputs(ctx, p, m, smelted),
    a = energyAccount(inputs);
  // What it burned of its market's buried fuel, in the units the market keeps.
  const coal = m.take("used", G.coal, Math.round(a.coal / FUEL_UNIT_KWY)),
    oil = m.take("used", G.oil, Math.round(a.oil / FUEL_UNIT_KWY));
  // (What it wants: all the buried fuel its hearths and engines would have burned, as coal, the fuel a market first digs.)
  want[G.coal] = want[G.coal]! + Math.round(a.fuelWanted / FUEL_UNIT_KWY);
  if (a.felled > 0) fellWoods(ctx, p.cell, a.felled);
  // What drives its crafts next year: its works' share of the work they wanted; and the power the demographic transition reads.
  m.powerCover = a.worksWanted > 0 ? Math.round((1000 * a.worksHad) / a.worksWanted) : 0;
  m.burned = transitionPower(a);
  // What it sent to the air: the carbon and sulphur of the buried fuel burned; its works' smoke, faded by half a year.
  const was = store.get(p.cell),
    gasUnits = a.gas / FUEL_UNIT_KWY,
    carbon =
      coal * fuelTonnes("coal").carbon +
      oil * fuelTonnes("oil").carbon +
      gasUnits * fuelTonnes("gas").carbon,
    sulphur = coal * fuelTonnes("coal").sulphur + oil * fuelTonnes("oil").sulphur,
    smoke =
      SMOKES.coal * coal * FUEL_UNIT_KWY +
      SMOKES.oil * oil * FUEL_UNIT_KWY +
      SMOKES.gas * a.gas +
      SMOKES.own * a.own +
      SMOKES.wood * a.engineWood;
  store.set({
    cell: p.cell,
    people: inputs.people,
    drawn: CARRIERS.map((c) => Math.round(a.drawn[c])),
    by: SOURCES.map((s) => Math.round(a.by[s])),
    workWanted: Math.round(a.workWanted),
    workHad: Math.round(a.workHad),
    worksWanted: Math.round(a.worksWanted),
    heatWanted: Math.round(a.heatWanted),
    heatHad: Math.round(a.heatHad),
    share: Math.round(a.share * 1000),
    coal: coal * FUEL_UNIT_KWY,
    oil: oil * FUEL_UNIT_KWY,
    gas: Math.round(a.gas),
    own: Math.round(a.own),
    felled: Math.round(a.felled),
    fuelWanted: Math.round(a.fuelWanted),
    carbon: Math.round(carbon),
    sulphur: Math.round(sulphur),
    fume: Math.round(0.5 * (was?.fume ?? 0) + 0.5 * smoke),
  });
  return a;
}

/** Wood felled past what a land's woods give (kW·yr): the share of what stands it was, taken from them. */
function fellWoods(ctx: PopulationContext, cell: number, kwy: number): void {
  const w = ecologyOf(ctx.world).get(cell);
  if (!w || w.forest <= 0) return;
  const site = siteOf(ctx, cell),
    standingKm2 = woodsRead(ctx, cell).now * site.areaKm2,
    // (What its woods hold, MJ: what they grow in WOODS_HOLD_YEARS, a tonne a thousand kilograms.)
    held = standingKm2 * site.growth * WOODS_HOLD_YEARS * 1000 * site.woodMj;
  if (held <= 0) return;
  w.forest = Math.max(0, w.forest * (1 - Math.min(1, (kwy * MJ_A_KWY) / held)));
}

// —— Readings ———————————————————————————————————————————————————————————————————————————————————————

/** What a land's account says, a head (pure: nothing here moves the world). */
export type EnergyReading = {
  /** All it drew a head (kW): food, fodder, heat and flow. */
  readonly primary: number;
  /** What its work draws on a head (kW): its bodies' food, its beasts' fodder, what flows, its engines' heat. */
  readonly power: number;
  /** The work it turned a head (kW). */
  readonly work: number;
  /** Each carrier's draw a head (kW), and the work each source gave a head (kW). */
  readonly carriers: Readonly<Record<Carrier, number>>;
  readonly sources: Readonly<Record<Source, number>>;
  /** What drove most of its work past bodies and beasts, and its engines' share of Carnot's bound on what burns. */
  readonly drives: Source;
  readonly share: number;
  /** Its works', carriers' and homes' work had of what they wanted, and its hearths' and smelters' heat (0 … 1). */
  readonly workCover: number;
  readonly heatCover: number;
  /** Buried fuel burned a head (kW), and wood felled past what its woods give a head (kW). */
  readonly buried: number;
  readonly felled: number;
  /** Carbon and sulphur sent up a head (kg a year). */
  readonly carbonKg: number;
  readonly sulphurKg: number;
};

/** A land's account as it was kept, back as the rule's account. */
export function keptAccount(e: EnergyLand): EnergyAccount {
  const by = Object.fromEntries(SOURCES.map((s, i) => [s, e.by[i] ?? 0])) as Record<Source, number>;
  let drives: Source = "none",
    most = 0;
  for (const s of SOURCES)
    if (s !== "none" && by[s] > most) {
      most = by[s];
      drives = s;
    }
  return {
    drawn: Object.fromEntries(CARRIERS.map((c, i) => [c, e.drawn[i] ?? 0])) as Record<
      Carrier,
      number
    >,
    workWanted: e.workWanted,
    workHad: e.workHad,
    worksWanted: e.worksWanted,
    worksHad: e.workWanted > 0 ? (e.worksWanted * e.workHad) / e.workWanted : 0,
    heatWanted: e.heatWanted,
    heatHad: e.heatHad,
    work: SOURCES.reduce((s, x) => s + by[x], 0),
    by,
    share: e.share / 1000,
    drives,
    coal: e.coal,
    oil: e.oil,
    gas: e.gas,
    own: e.own,
    engineFuel: 0,
    engineWood: 0,
    felled: e.felled,
    fuelWanted: e.fuelWanted,
  };
}

/**
 * A land's energy a head, as its last account stands (null: none kept yet). The reading the round that owns demography may
 * read for its transition (this round leaves the transition as it was), and what the ages and pages read. Pure.
 */
export function energyPerHead(world: World, cell: number): EnergyReading | null {
  const e = energyBooks(world)?.get(cell);
  if (!e || e.people <= 0) return null;
  const a = keptAccount(e),
    people = e.people;
  return {
    primary: primaryPower(a, people),
    power: workPower(a, people),
    work: a.work / people,
    carriers: Object.fromEntries(CARRIERS.map((c, i) => [c, (e.drawn[i] ?? 0) / people])) as Record<
      Carrier,
      number
    >,
    sources: Object.fromEntries(SOURCES.map((s, i) => [s, (e.by[i] ?? 0) / people])) as Record<
      Source,
      number
    >,
    drives: a.drives,
    share: a.share,
    workCover: e.workWanted > 0 ? Math.min(1, e.workHad / e.workWanted) : 1,
    heatCover: e.heatWanted > 0 ? Math.min(1, e.heatHad / e.heatWanted) : 1,
    buried: (e.coal + e.oil + e.gas + e.own) / people,
    felled: e.felled / people,
    carbonKg: (1000 * e.carbon) / people,
    sulphurKg: (1000 * e.sulphur) / people,
  };
}

/** The engines' work a worker who works with machines draws (kW, est). */
export const MACHINE_KW = 0.1;

/**
 * The share of the machines a land's workers would wear out that they want this year (0 … 1): as far as engines, turbines
 * and the free heats drove its works last year, past what its old mills turn.
 */
export function machinesWanted(world: World, cell: number, users: number): number {
  const e = energyBooks(world)?.get(cell);
  if (!e || users <= 0) return 0;
  const millsAt = SOURCES.indexOf("mills");
  let engines = 0;
  for (let i = 1; i < e.by.length; i++) if (i !== millsAt) engines += e.by[i]!;
  return engines > 0 ? Math.min(1, engines / (users * MACHINE_KW)) : 0;
}

/** The smoke a land's works send up a head (kW·yr of coal's smoke, faded): what the air's smoke reads. */
export function fumeOf(world: World, cell: number): number {
  const e = energyBooks(world)?.get(cell);
  return e && e.people > 0 ? e.fume / e.people : 0;
}
