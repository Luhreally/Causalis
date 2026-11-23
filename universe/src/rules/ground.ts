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
export const EARTH_CRUST_PPM: Readonly<Record<Exclude<Nutrient, "N">, number>> = {
  P: 1050,
  K: 20900,
};

/**
 * What a year of full farming at its virgin ground's harvest takes of each, as a share of what the virgin ground held (est): a
 * harvest's grain and straw carry off nitrogen (some 2% of grain's weight) and the ploughed ground loses more of it to the rain;
 * phosphorus (0.35%) and potassium (0.5%) are held tighter, and the rock below gives them back under the fields. A smaller harvest
 * carries off the less (nutrientYear's `crop`). Calibrated against Broadbalk at Rothamsted, wheat on the same ground every year
 * since 1843: unmanured, its yield fell to some two-fifths of the dunged plot's within three or four decades and has held there
 * since, on what the rain and the soil's free-living life give back. Here a field fully farmed without rest or manure gives 0.71
 * of its first yield at 30 years, 0.53 at 50 and 0.44 from 80 on; with beans in a rotation 0.97 at 30 and 0.88 at 200; with
 * rotation and dung, its first yield. (Until 2026-11-23 it took 0.012 of the nitrogen, its harvest's size apart, and gave back
 * half its healing under fields: such a field gave 0.86 at 50 years and was still falling at 200, and no land's soil wore thin
 * in a world's history.)
 */
export const TAKEN: Readonly<Record<Nutrient, number>> = { N: 0.03, P: 0.003, K: 0.004 };
/**
 * The share of the way back to its virgin store a ground goes in a year (est): its nitrogen fully while it lies unfarmed (the
 * wild's own litter and what its life fixes) and half as fast under fields (what the rain brings down and what lives free in the
 * soil fixes: UNDER_FIELDS), its phosphorus and potassium under fields too (the rock below weathering).
 */
export const HEALING = 0.02;
/** How much of its nitrogen's healing a ground loses under fields (est: TAKEN's calibration; what the rain brings and the soil's free-living fixers keep the rest). */
export const UNDER_FIELDS = 0.2;
/**
 * How a field's yield answers its scarcest nutrient (Mitscherlich's law of diminishing returns, 1909): each step short of its
 * virgin store costs more than the one before it, so a ground worn by a fifth gives some 6% less, worn by half a fifth less.
 */
export const MITSCHERLICH = 3;
/** A field's yield (a share of its virgin ground's) at its scarcest nutrient's store `s` (a share of its virgin store). */
export function nutrientYield(s: number): number {
  const k = MITSCHERLICH;
  return (1 - dmath.exp(-k * Math.max(0, s))) / (1 - dmath.exp(-k));
}
/**
 * What rock dug for phosphorus and potassium gives back to a field a year, at most (a share of its virgin store, est): ground
 * rock, bones and potash, as much as its fields lack and its harvest took. Rock is heavy and worth little: it is carried to the
 * fields only where engines haul (ROCK_NEEDS).
 */
export const ROCK_GIVES = 0.01;
/** What beans and clover in a rotation give back of the nitrogen a harvest takes (est), and what a rotation's fallow spares. */
export const BEANS_GIVE = 0.7,
  FALLOW_SPARES = 0.2;
/** What the dung of a land's herds, spread where its people know manuring, gives back of what its harvests take (est): most of the phosphorus and potassium its beasts ate, less of the nitrogen, which the air takes. */
export const MANURE_GIVES: Readonly<Record<Nutrient, number>> = { N: 0.4, P: 0.8, K: 0.8 };
/** What a field's ground can be made to hold past its virgin store, by manure, fertiliser or a river's silt (est). */
export const RICHEST = 1.3;

/**
 * How fast each comes back to an unfarmed ground on a world, against Earth's (0.2 … 2): phosphorus and potassium by what its crust
 * holds of them (the root of its parts in a million over Earth's), nitrogen by what its air holds: fixed from its air's nitrogen
 * by its life, and plentiful where ammonia is in the air besides.
 */
export function supplyOf(
  ppm: (element: string) => number,
  airHolds: readonly string[],
): Record<Nutrient, number> {
  const crust = (e: "P" | "K") =>
    Math.min(2, Math.max(0.2, Math.sqrt(Math.max(0, ppm(e)) / EARTH_CRUST_PPM[e])));
  return {
    // (Every world's air is mostly nitrogen, its kind's own gases besides: host/inspect/ground.ts airBlock.)
    N: airHolds.includes("ammonia") ? 2 : 1,
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

/** A nutrient's year: what a harvest at `farmed` takes (as large as `crop`), what rest, beans, dung and fertiliser give back, what healing does. */
export function nutrientYear(
  s: number,
  n: Nutrient,
  i: {
    readonly farmed: number;
    readonly supply: number;
    readonly rotation: boolean;
    readonly manure: number;
    readonly fertiliser: number;
    /** Phosphorus and potassium rock spread, as far as it goes (0 … 1). */
    readonly rock?: number;
    /** The harvest, as a share of its virgin ground's (its soil's strength: sim/ecology/ground.ts soilOf): what it carries off is as large. */
    readonly crop?: number;
  },
): number {
  const taken = TAKEN[n] * i.farmed * (i.crop ?? 1) * (i.rotation ? 1 - FALLOW_SPARES : 1),
    beans = n === "N" && i.rotation ? BEANS_GIVE * taken : 0,
    dung = MANURE_GIVES[n] * Math.min(1, i.manure) * taken,
    made =
      n === "N"
        ? i.fertiliser
        : (i.rock ?? 0) * Math.min(ROCK_GIVES, Math.max(0, 1 - s) + TAKEN[n] * i.farmed),
    healing =
      HEALING * i.supply * Math.max(0, 1 - s) * (n === "N" ? 1 - UNDER_FIELDS * i.farmed : 1);
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
/** The share of a watered field's salt its drainage washes out a year (est: the water let through past what the crops breathe), and the more by every metre of rain past it. */
export const SALT_WASHED = 0.3,
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
/** Sour drainage from a unit of coal dug that reaches its land's fields (kg of sulphur, est: its pyrite weathered at the heap, most of it
 * carried off in the streams by the pits, not over the fields). */
export const MINE_ACID_KG = 2;

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
  [
    "electricity",
    "sea-electricity",
    "graphite-dynamos",
    "ground-dynamos",
    "polymer-wire",
    "fusion-power",
  ],
  ["steel", "carbide-blades", "drawn-carbon", "ice-working"],
];

/** The ground's estimates (for the pages that cite them). */
export const GROUND_ESTIMATES: readonly string[] = [
  "TAKEN",
  "HEALING",
  "UNDER_FIELDS",
  "ROCK_GIVES",
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
