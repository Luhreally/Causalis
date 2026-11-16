// The ground a people farms, as stocks (Round A, asked 2026-11-15: "is every political, physics, economy etc thing covered down to
// first principles"): what feeds its fields, read off its world's own crust and air; what its harvests take and what fallow,
// manure, beans and made fertiliser give back; its topsoil, washed off cleared slopes by its rain and laid down on the flats
// below; the water its fields are given from its rivers and from under its ground, and the salt that water leaves where the rain
// is too little to wash it out; and what its fires, smelters and mines foul it with — sour rain from the sulphur they burn, and
// the metals their slag gives up to the water that carries them downstream — and how each is undone in time.
//
// Every stock is a share of what the land held before anyone farmed it (nutrients, topsoil, groundwater) or a load per hectare
// (sulphur, metals) or per square kilometre (salt). Physical facts are authored; estimates are marked "est". Pure tables and
// functions: sim/ecology/ground.ts feeds them the world's numbers and keeps each land's stocks.

import { dmath } from "../kernel/index.ts";

/** The elements a field's growth is drawn from the ground: on a world of life like Earth's, nitrogen, phosphorus and potassium. */
export const NUTRIENTS = ["N", "P", "K"] as const;
export type Nutrient = (typeof NUTRIENTS)[number];

/** The parts in a million of each in Earth's crust: what another world's crust is read against. */
export const EARTH_CRUST_PPM: Readonly<Record<Exclude<Nutrient, "N">, number>> = { P: 1050, K: 20900 };

/**
 * What a year of full farming takes of each, as a share of what the virgin ground held (est): a harvest's grain and straw carry
 * off nitrogen (some 2% of grain's weight) and the ploughed ground loses more of it to the rain; phosphorus (0.35%) and potassium
 * (0.5%) are held tighter. Without rest or manure a field worn by a century is worn to a third.
 */
export const TAKEN: Readonly<Record<Nutrient, number>> = { N: 0.012, P: 0.006, K: 0.008 };
/** The share of the way back to its virgin store an unfarmed ground goes in a year (est: weathering, the wild's own litter). */
export const HEALING = 0.02;
/** What beans and clover in a rotation give back of the nitrogen a harvest takes (est), and what a rotation's fallow spares. */
export const BEANS_GIVE = 0.7,
  FALLOW_SPARES = 0.2;
/** What the dung of its herds gives back of what its harvests take, where its herders are a third of its farmers or more (est). */
export const MANURE_GIVES = 0.4;
/** What a field's ground can be made to hold past its virgin store, by manure, fertiliser or a river's silt (est). */
export const RICHEST = 1.3;

/**
 * How fast each comes back to an unfarmed ground on a world, against Earth's (0.2 … 2): phosphorus and potassium by what its crust
 * holds of them (the root of its parts in a million over Earth's), nitrogen by what its air holds: fixed from nitrogen by its
 * life, plentiful where ammonia is in the air, scarce where neither is.
 */
export function supplyOf(
  ppm: (element: string) => number,
  airHolds: readonly string[],
): Record<Nutrient, number> {
  const crust = (e: "P" | "K") =>
    Math.min(2, Math.max(0.2, Math.sqrt(Math.max(0, ppm(e)) / EARTH_CRUST_PPM[e])));
  return {
    N: airHolds.includes("ammonia") ? 2 : airHolds.includes("nitrogen") ? 1 : 0.2,
    P: crust("P"),
    K: crust("K"),
  };
}

/** The nutrient its fields are short of first: the one that stands lowest (Liebig's law of the minimum). */
export function limiting(stock: Readonly<Record<Nutrient, number>>): Nutrient {
  let least: Nutrient = "N";
  for (const n of NUTRIENTS) if (stock[n] < stock[least]) least = n;
  return least;
}

/** A nutrient's year: what a harvest at `farmed` takes, what rest, beans, dung and fertiliser give back, what healing does. */
export function nutrientYear(
  s: number,
  n: Nutrient,
  i: {
    readonly farmed: number;
    readonly supply: number;
    readonly rotation: boolean;
    readonly manure: number;
    readonly fertiliser: number;
  },
): number {
  const taken = TAKEN[n] * i.farmed * (i.rotation ? 1 - FALLOW_SPARES : 1),
    beans = n === "N" && i.rotation ? BEANS_GIVE * taken : 0,
    dung = MANURE_GIVES * Math.min(1, i.manure) * taken,
    made = n === "N" ? i.fertiliser : 0,
    healing = HEALING * i.supply * Math.max(0, 1 - s) * (1 - i.farmed);
  return Math.min(RICHEST, Math.max(0, s - taken + beans + dung + made + healing));
}

// —— Topsoil ———————————————————————————————————————————————————————————————————————————————————————

/**
 * The share of a land's topsoil a year's rain washes off, ploughed bare on a gentle slope under a metre of rain (est: some 2,000
 * tonnes a square kilometre of a 400,000-tonne topsoil; the Universal Soil Loss Equation's terms read as shares): by its rain's
 * force (the rain to the power of one and a half), its slope, and what covers it — woods next to nothing, grass a tenth, crops all
 * — and terraces halve it.
 */
export const WASHED = 0.005;
/** Topsoil that forms a year from the rock below, as a share of what was lost (est: some 40 tonnes a square kilometre). */
export const FORMED = 0.0005;
/** A slope (rise over run) at which WASHED holds; steeper, more, as far as three times. */
export const GENTLE = 0.02;
/** What a land without topsoil still gives against one with all of it (est: its subsoil). */
export const SUBSOIL = 0.4;
/** Of what is washed off a land, the share laid down on the flat land its river runs to (est). */
export const LAID_DOWN = 0.3;
/** A land flat enough for a river to lay down its silt on (rise over run). */
export const FLAT = 0.008;

/** The share of a land's topsoil washed off in a year. */
export function washedOff(i: {
  readonly rainMm: number;
  readonly slope: number;
  readonly farmed: number;
  readonly forest: number;
  readonly terraced: boolean;
}): number {
  const rain = Math.min(3, dmath.pow(Math.max(0, i.rainMm) / 1000, 1.5)),
    slope = Math.min(3, Math.max(0, i.slope) / GENTLE),
    grass = Math.max(0, 1 - i.farmed - i.forest),
    bare = i.farmed * (i.terraced ? 0.5 : 1) + 0.1 * grass + 0.002 * i.forest;
  return WASHED * rain * slope * bare;
}

// —— Water and salt ————————————————————————————————————————————————————————————————————————————————

/** What a field's crops would breathe off a year, mm (est, after Thornthwaite: none at freezing, some 1,500 at 25 °C). */
export function thirstMm(celsius: number): number {
  return Math.max(0, 60 * celsius);
}
/** The share of a land's farmed ground its people water, where they know how (est). */
export const WATERED = 0.3;
/** The share of a river's water a land may draw off for its fields (est), and of its rain that sinks to its groundwater. */
export const DRAWN_OFF = 0.3,
  SINKS = 0.1;
/** How many years of what sinks in a land's ground holds at first (est: an aquifer of a few centuries' recharge). */
export const AQUIFER_YEARS = 200;
/** What a cubic metre of river or well water leaves behind as it is breathed off (tonnes of salt, est: 500 mg a litre). */
export const SALT_T_M3 = 0.0005;
/** The salt a square kilometre of field holds at which its crops give half (tonnes, est: some 6 dS/m in its topsoil). */
export const SALT_HALF = 4000;
/** The share of a field's salt washed out a year, and the more by every metre of rain past what its crops breathe (est). */
export const SALT_WASHED = 0.02,
  SALT_RAIN = 0.5;
/** The yield a field gains from being watered (rules/principles.ts irrigation's `farmYield`). */
export const IRRIGATION_GAIN = 0.2;

// —— What fouls the ground ————————————————————————————————————————————————————————————————————————

/** Of the sulphur a land burns, the share that falls on it again as sour rain (est); the rest falls on its neighbours. */
export const FALLS_HOME = 0.6;
/** The share of the sour rain a ground holds that its rock takes up in a year (est: limestone and clays buffer it). */
export const ACID_TAKEN = 0.2;
/** Sour rain held (kg of sulphur a hectare) at which its fields and woods give a fifth less (est: Europe's dying forests, 1980). */
export const ACID_FIFTH = 100;
/** Metal a unit of metal smelted gives up to its land's ground and water (kg, est: slag, dust and tailings). */
export const METAL_LOST_KG = 0.05;
/** Of the metals a ground holds, the share its rivers carry to the land below in a year, and the share bound into its silt (est). */
export const METAL_CARRIED = 0.05,
  METAL_BOUND = 0.01;
/** Metals held (kg a hectare) at which its fields give a fifth less, and the most it takes of the health of its people (est). */
export const METAL_FIFTH = 300,
  METAL_POISON = 0.5;
/** Sour drainage from a unit of coal dug (kg of sulphur, est: its pyrite, weathered at the heap). */
export const MINE_ACID_KG = 20;

/** What sour rain held takes of a land's yield (0 … 0.4). */
export function acidHarm(kgHa: number): number {
  return Math.min(0.4, (0.2 * Math.max(0, kgHa)) / ACID_FIFTH);
}
/** What metals held take of a land's yield (0 … 0.4). */
export function metalHarm(kgHa: number): number {
  return Math.min(0.4, (0.2 * Math.max(0, kgHa)) / METAL_FIFTH);
}
/** What salt takes of a field's yield (0 … 0.8): half at SALT_HALF. */
export function saltHarm(tKm2: number): number {
  return Math.min(0.8, Math.max(0, tKm2) / (Math.max(0, tKm2) + SALT_HALF));
}

// —— Made fertiliser ———————————————————————————————————————————————————————————————————————————————

/** The nitrogen the virgin ground of a square kilometre of field holds for its crops (tonnes, est). */
export const N_T_KM2 = 300;
/** What fixing a tonne of nitrogen from the air takes (kW·yr: some 35 GJ, Haber and Bosch's, the arc's twice it). */
export const FIX_KWY = 35 / 31.5576;
/** The principles that let a land fix its air's nitrogen: a current to drive it and vessels strong enough to hold it. */
export const FIXING_NEEDS: readonly (readonly string[])[] = [
  ["electricity", "sea-electricity", "graphite-dynamos", "ground-dynamos", "polymer-wire", "fusion-power"],
  ["steel", "carbide-blades", "drawn-carbon", "ice-working"],
];

/** The ground's estimates (for the pages that cite them). */
export const GROUND_ESTIMATES: readonly string[] = [
  "TAKEN",
  "HEALING",
  "BEANS_GIVE",
  "MANURE_GIVES",
  "WASHED",
  "FORMED",
  "LAID_DOWN",
  "thirstMm",
  "WATERED",
  "DRAWN_OFF",
  "SINKS",
  "AQUIFER_YEARS",
  "SALT_T_M3",
  "SALT_HALF",
  "FALLS_HOME",
  "ACID_TAKEN",
  "ACID_FIFTH",
  "METAL_LOST_KG",
  "METAL_CARRIED",
  "METAL_FIFTH",
  "MINE_ACID_KG",
  "N_T_KM2",
];
