// Energy as one budget (Round A, asked 2026-11-15: "is every political, physics, economy etc thing covered down to first
// principles"). What a land draws in a year, carrier by carrier, and what its people can turn of it into work, each read from a
// figure its world already holds: its people's own strength and its beasts', by their weight; its woods' growth, by its warmth,
// rain and starlight; its herds' dung and its fields' straw; the fall of its rivers, its wind and its tides; the heat of its
// ground and its vents; its star's light; what its crust buried; the atom's fire and a held flame. The heat in a fuel is its
// reaction's: the heats of formation of what goes in and comes out, against whatever its air holds to burn it with (oxygen, or
// the hydrogen of a reducing air), so wood, coal and oil burn on Earth, sulphur on a sulfur-volcano world, the acetylene of a
// methane world's haze joins with its air's hydrogen, and on a world whose air holds neither nothing burns at all. A heat engine
// turns no more of a heat into work than Carnot allows between the heat it holds and the cold it sheds to, no hotter than its
// stuffs bear, and a people's craft takes it only part of that way; a cold world sheds its heat the more easily. The ages of
// steam, oil and the dynamo are readings of where a land's account stands (rules/ages.ts), not flags.
//
// Physical facts are authored (a heat of formation, a body's need, a forest's growth, the pull and weight of falling water);
// estimates are marked "est" and listed in ENERGY_ESTIMATES. Pure tables and functions: sim/economy/energy.ts feeds them the
// world's numbers and keeps each land's account.
import { dmath } from "../kernel/index.ts";
import { findSubstance, molarMass } from "./matter.ts";
import { PRINCIPLES } from "./principles.ts";

// —— Units ————————————————————————————————————————————————————————————————————————————————————————

/** Gigajoules in a kilowatt held for a year. */
export const GJ_A_KWY = 31.5576;
/** Megajoules in a kilowatt held for a year. */
export const MJ_A_KWY = 31557.6;
/** The heat a unit of buried fuel holds (kW for a year): what the economy's coal and oil are counted in (rules/goods.ts). */
export const FUEL_UNIT_KWY = 4;

// —— The heat in a fuel, from its reaction ————————————————————————————————————————————————————————

/**
 * Standard heats of formation, kJ a mole at 25 °C (NIST, CRC): what a reaction's heat is reckoned from. Gases as gases, water
 * vapour as what a flame gives off (the lower heat, as engines use it). Those marked are estimates: wood's fibre as a
 * glucose unit of cellulose (from its heat of burning, about 17.5 MJ/kg); humus by weight (peat's heat, about 20 MJ/kg dry);
 * tholin as a polymer like hydrogen cyanide's.
 */
export const FORMATION_KJ: Readonly<Record<string, number>> = {
  carbon: 0,
  graphite: 0,
  diamond: 1.9,
  oxygen: 0,
  hydrogen: 0,
  nitrogen: 0,
  sulphur: 0,
  co2: -393.5,
  "carbon-monoxide": -110.5,
  steam: -241.8,
  water: -285.8,
  so2: -296.8,
  "hydrogen-sulphide": -20.6,
  ammonia: -45.9,
  methane: -74.6,
  ethane: -84.0,
  acetylene: 227.4,
  crude: -350.9,
  bitumen: -10,
  cellulose: -960,
  starch: -960,
  sugar: -1273.3,
  humus: -469,
  tholin: 100,
  pyrite: -178.2,
  hematite: -824.2,
};

/** What a fuel is burned with: its air's free oxygen, or the hydrogen of a reducing air (a methane world's). */
export type Oxidant = "oxygen" | "hydrogen";

/**
 * The heat a mole of a substance gives with an oxidant, kJ (0: it gives none, or its heat is not known). With oxygen its carbon
 * goes to carbon dioxide, its hydrogen to water vapour, its sulphur to sulphur dioxide, its nitrogen free and its iron to rust;
 * with hydrogen its carbon to methane, its oxygen to water vapour, its nitrogen to ammonia and its sulphur to hydrogen sulphide.
 * The oxygen or hydrogen it holds itself is spent first. Only those of carbon, hydrogen, oxygen, nitrogen, sulphur and iron.
 */
export function heatOfBurning(subst: string, oxidant: Oxidant): number {
  const s = findSubstance(subst),
    own = FORMATION_KJ[subst];
  if (!s || own === undefined) return 0;
  const f = s.formula;
  for (const e of Object.keys(f)) if (!"C H O N S Fe".split(" ").includes(e)) return 0;
  const C = f.C ?? 0,
    H = f.H ?? 0,
    O = f.O ?? 0,
    N = f.N ?? 0,
    S = f.S ?? 0,
    Fe = f.Fe ?? 0;
  let products: number;
  if (oxidant === "oxygen")
    products =
      C * FORMATION_KJ.co2! +
      (H / 2) * FORMATION_KJ.steam! +
      S * FORMATION_KJ.so2! +
      (Fe / 2) * FORMATION_KJ.hematite!;
  else {
    // (With hydrogen: oxygen to water first, then the carbon to methane, nitrogen to ammonia, sulphur to hydrogen sulphide.)
    if (Fe) return 0;
    products =
      O * FORMATION_KJ.steam! +
      C * FORMATION_KJ.methane! +
      N * FORMATION_KJ.ammonia! +
      S * FORMATION_KJ["hydrogen-sulphide"]!;
  }
  return Math.max(0, own - products);
}

/** The heat a kilogram of a substance gives with an oxidant (MJ/kg; 0 none). */
export function heatMjKg(subst: string, oxidant: Oxidant): number {
  const s = findSubstance(subst);
  if (!s) return 0;
  return heatOfBurning(subst, oxidant) / molarMass(s.formula);
}

/** What boiling a kilogram of the water in a fuel off costs (MJ/kg). */
export const WATER_BOILED_MJ_KG = 2.44;

/** The heat a kilogram of a mix gives with an oxidant (MJ/kg): each part's, less what its water costs to boil off. */
export function mixMjKg(parts: readonly (readonly [string, number])[], oxidant: Oxidant): number {
  let mj = 0;
  for (const [s, share] of parts)
    mj += s === "water" ? -WATER_BOILED_MJ_KG * share : heatMjKg(s, oxidant) * share;
  return Math.max(0, mj);
}

/** What a world's air holds to burn with, best first: oxygen where it is free, hydrogen where a reducing air holds it. */
export function oxidantsOf(w: {
  readonly freeOxygen: boolean;
  readonly airHolds: readonly string[];
}): Oxidant[] {
  const out: Oxidant[] = [];
  if (w.freeOxygen) out.push("oxygen");
  if (w.airHolds.includes("hydrogen")) out.push("hydrogen");
  return out;
}

/** The most a kilogram of a mix gives with what a world's air holds (MJ/kg), and with what (null: nothing it holds burns it). */
export function bestHeat(
  parts: readonly (readonly [string, number])[],
  oxidants: readonly Oxidant[],
): { readonly mj: number; readonly by: Oxidant | null } {
  let best: { mj: number; by: Oxidant | null } = { mj: 0, by: null };
  for (const o of oxidants) {
    const mj = mixMjKg(parts, o);
    if (mj > best.mj) best = { mj, by: o };
  }
  return best;
}

/** Carbon in a kilogram of a mix (kg): what its burning sends to the air. */
export function carbonKg(parts: readonly (readonly [string, number])[]): number {
  let kg = 0;
  for (const [s, share] of parts) {
    const sub = findSubstance(s);
    if (!sub?.formula.C) continue;
    kg += (share * sub.formula.C * 12.011) / molarMass(sub.formula);
  }
  return kg;
}

/** Sulphur in a kilogram of a mix (kg): what its burning sends up as sour smoke. */
export function sulphurKg(parts: readonly (readonly [string, number])[]): number {
  let kg = 0;
  for (const [s, share] of parts) {
    const sub = findSubstance(s);
    if (!sub?.formula.S) continue;
    kg += (share * sub.formula.S * 32.06) / molarMass(sub.formula);
  }
  return kg;
}

/** What is left of a mix as ash: whatever in it neither burns nor boils off (kg a kilogram). */
export function ashKg(parts: readonly (readonly [string, number])[], oxidant: Oxidant): number {
  let kg = 0;
  for (const [s, share] of parts) if (s !== "water" && !heatMjKg(s, oxidant)) kg += share;
  return kg;
}

// —— What a fuel is made of ————————————————————————————————————————————————————————————————————————

/**
 * The fuels a land can burn, by what they are: a tree's wood (fibre and water), a herd's dried dung and a field's straw, and
 * the buried fuels the economy counts in units (their make-up rules/matter.ts GOOD_MATTER keeps, here as it is burned).
 * A methane world's haze settles as acetylene and tholin on its ground (rules/kind-ground.ts), the fuel its people join with
 * its air's hydrogen.
 */
export const FUEL_MAKEUP: Readonly<Record<string, readonly (readonly [string, number])[]>> = {
  // Air-dried wood: a fifth of it water (est).
  wood: [
    ["cellulose", 0.8],
    ["water", 0.2],
  ],
  // Dried dung and straw: fibre and the humus of what was eaten, a tenth ash, a tenth water (est).
  dung: [
    ["cellulose", 0.55],
    ["humus", 0.25],
    ["potash", 0.1],
    ["water", 0.1],
  ],
  coal: [
    ["carbon", 0.8],
    ["water", 0.06],
    ["kaolinite", 0.1],
    ["pyrite", 0.04],
  ],
  oil: [
    ["crude", 0.97],
    ["water", 0.02],
    ["pyrite", 0.01],
  ],
  // What comes up with the oil: mostly methane, with ethane (est).
  gas: [
    ["methane", 0.85],
    ["ethane", 0.15],
  ],
  // A methane world's haze, settled: acetylene and tholin (est).
  haze: [
    ["acetylene", 0.4],
    ["tholin", 0.6],
  ],
  // Native sulphur, where a sulfur-volcano world's vents lay it down.
  sulphur: [["sulphur", 1]],
};

/** The weight of a unit of a buried fuel (kg): the heat a unit holds over its make-up's heat a kilogram, in oxygen. */
export function fuelUnitKg(fuel: "coal" | "oil"): number {
  return (FUEL_UNIT_KWY * MJ_A_KWY) / mixMjKg(FUEL_MAKEUP[fuel]!, "oxygen");
}

// —— Bodies ———————————————————————————————————————————————————————————————————————————————————————

/** What a body of an upright ape's weight eats, as power (kW): some 2,060 kcal a day, a unit of food a month (rules/goods.ts). */
export const FOOD_KW = 0.1;
/** The weight of the body FOOD_KW is a body's eating of (kg). */
export const APE_KG = 60;
/** The share of what a worker eats that comes out as work over a year (est: some 75 W for eight hours, from 145 W eaten). */
export const MUSCLE_WORK = 0.2;
/**
 * What a beast eats against a body of its weight at rest (est): its fodder is mostly fibre, half digested, and it walks and
 * pulls. A 500 kg ox eats some 1 kW (Kleiber's law, the power of weight to three quarters).
 */
export const BEAST_FEED = 2;
/** The share of what a working beast eats that comes out as work over a year (est: an ox pulls 0.4 kW six hours a day, 200 days). */
export const BEAST_WORK = 0.1;
/** Of a herd, the share that can be put to pull; of farmers, how many beasts pull for each (est). */
export const DRAUGHT_SHARE = 0.3;
export const BEASTS_A_FARMER = 0.3;
/** A herd gives this share of its live weight a year as meat and milk (est), so its weight is read from what it gives. */
export const HERD_GIVES = 0.25;

/** What a body eats as power (kW), against an ape's: its weight to three quarters (Kleiber). */
export function bodyKw(kg: number): number {
  return FOOD_KW * dmath.pow(Math.max(0.01, kg) / APE_KG, 0.75);
}

// —— Woods, dung and straw ————————————————————————————————————————————————————————————————————————

/**
 * What a square kilometre of a land's green grows in a year, tonnes of dry matter (the Miami model, Lieth 1975): the less of
 * what its rain and its warmth allow, by a starlight against Earth's, and the more slowly where its life's chemistry runs slow.
 */
export function growthTkm2(celsius: number, rainMm: number, light: number, pace = 1): number {
  const byRain = 3000 * (1 - dmath.exp(-0.000664 * Math.max(0, rainMm))),
    byWarmth = 3000 / (1 + dmath.exp(1.315 - 0.119 * celsius));
  return Math.min(byRain, byWarmth) * Math.min(1.5, Math.max(0, light)) * Math.min(1, pace);
}

/** The share of what woods grow that can be taken as fuel each year without thinning them: deadfall, coppice, lopping (est). */
export const WOOD_TAKEN = 0.25;
/** What a square kilometre of standing woods holds, tonnes dry, against what it grows in a year (est: 250 t/ha, some 20 years' growth). */
export const WOODS_HOLD_YEARS = 20;
/** The most of a land's standing woods its people fell in a year past what they give (est: some two in a hundred). */
export const FELLED_MOST = 0.02;
/** Dry dung a kilogram of herd lets fall in a year (kg, est: 4 kg a day from a 500 kg cow), and how much of it is gathered (est). */
export const DUNG_A_KG = 2.9;
export const DUNG_GATHERED = 0.3;
/** Straw a unit of grain leaves (kg, est: about its own weight) and how much of it is burned rather than fed or ploughed in (est). */
export const STRAW_A_UNIT = 18;
export const STRAW_BURNED = 0.3;

/** What a land's woods give as fuel a year without thinning (kW): the woods standing (km²) by what each grows. */
export function woodsKw(standingKm2: number, growthT: number): number {
  return (standingKm2 * growthT * WOOD_TAKEN * mixMjKg(FUEL_MAKEUP.wood!, "oxygen")) / GJ_A_KWY;
}

/** What one kW·yr of wood felled past what the woods give takes of them: the share of the woods standing it is. */
export function felledShare(kwy: number, standingKm2: number, growthT: number): number {
  const held =
    standingKm2 * growthT * WOODS_HOLD_YEARS * 1000 * mixMjKg(FUEL_MAKEUP.wood!, "oxygen"); // MJ held
  return held > 0 ? Math.min(1, (kwy * MJ_A_KWY) / held) : 1;
}

// —— Flows: rivers, wind, tides ——————————————————————————————————————————————————————————————————

/** The share of the rain on a land that runs off to its rivers (est: Earth's some 35%; the rest is breathed and evaporates). */
export const RUNOFF = 0.35;
/** The fall of a land's river counted, m: at least a metre, at most what a river falls across a land (est). */
export const LEAST_FALL = 1,
  MOST_FALL = 300;

/**
 * The power of a land's river as it falls across it (kW): ρ g Q h, its water's weight a cubic metre, the pull, what runs off
 * past its foot (m³/s) and the fall. `discharge` is the hydrology's, rain in mm times area on the unit sphere (gen/hydrology.ts).
 */
export function riverKw(
  discharge: number,
  fallM: number,
  radius: number,
  pull: number,
  liquidKgM3 = 1000,
): number {
  const r = 6.371e6 * radius,
    q = (((discharge * r * r) / 1e6) * RUNOFF) / 3.15576e7,
    h = Math.min(MOST_FALL, Math.max(LEAST_FALL, fallM));
  return (liquidKgM3 * 9.81 * pull * q * h) / 1000;
}

/** A wind's power through a square metre (W/m²): half its air's weight a cubic metre times its speed cubed. */
export function windWm2(airKgM3: number, speed: number): number {
  return 0.5 * airKgM3 * speed * speed * speed;
}
/** The prevailing wind near the ground (m/s, est: Earth's lands average some 6 to 7). */
export const WIND_MS = 6.5;

/** Tides' power along a kilometre of coast at Earth's tides (kW, est: some 1 TW of the shallow seas' 3.7 over 350,000 km). */
export const TIDE_KW_KM = 3000;

// —— Heat: ground, vents, sun ——————————————————————————————————————————————————————————————————————

/** The heat coming up through a square metre of Earth's ground (W/m²); near a plate's edge, and over a hot spot, more (est). */
export const GROUND_WM2 = 0.065,
  EDGE_HEAT = 3,
  SPOT_HEAT = 10;
/** How many times what rises a mine of the ground's heat can draw, from what the rock has stored (est: a field holds centuries'). */
export const GROUND_DRAWN = 20;
/** A vent's heat below an ice crust (°C: Enceladus's, Hsu 2015), and the hottest a well in rock is drilled to (est). */
export const GROUND_ICE_C = 90,
  GROUND_MOST_C = 350;
/** How rock carries heat (W/m/K) and how deep a well for the ground's heat is drilled (m, est). */
export const ROCK_CONDUCTS = 2.5,
  WELL_M = 3000;

/**
 * How hot a mine of the ground's heat runs (°C): on rock, the warmth at a well's foot (Fourier: the heat rising over how
 * well the rock carries it, times the depth); under an ice crust, its vents'.
 */
export function groundHeatC(ambientC: number, risingWm2: number, iceCrust: boolean): number {
  if (iceCrust) return GROUND_ICE_C;
  return Math.min(GROUND_MOST_C, ambientC + (risingWm2 / ROCK_CONDUCTS) * WELL_M);
}

/** Starlight at a land's ground, a day and a year through (W/m²): at the top of its air, through it, by its latitude. */
export function groundLight(sunTop: number, beam: number, latRad: number): number {
  return sunTop * beam * 0.25 * Math.max(0.1, dmath.cos(latRad));
}

// —— Engines ——————————————————————————————————————————————————————————————————————————————————————

/** What Carnot allows of a heat at `hotC` shed to a cold of `coldK`: 1 − T_cold/T_hot. */
export function carnot(hotC: number, coldK: number): number {
  return Math.max(0, 1 - coldK / Math.max(1, hotC + 273.15));
}

/**
 * The hottest a heat engine's working parts bear (°C, est), by the strength of the strongest stuff its people make: wrought
 * iron's boilers some 280 °C, steel's 440, the arc's alloys 520, woven carbon's near 600 (creep and pressure, not melting).
 */
export function heldHeat(strengthMpa: number): number {
  return 600 * (1 - dmath.exp(-Math.max(0, strengthMpa) / 600));
}

/**
 * The share of Carnot's bound a people's engines reach, by the finest fit they can make (est): a fit of a tenth of a
 * millimetre leaks steam past every piston (Watt's engines, a twentieth of the bound), a fiftieth closes it (a fifth), and
 * the fits of a gyroscope reach three parts in five, as a modern turbine does.
 */
export function craftShare(fitMm: number): number {
  return 0.65 * (1 - dmath.exp(-0.008 / Math.max(1e-9, fitMm)));
}

/** What a heat engine turns into work of a heat at `sourceC` (0 … 1): its craft's share of Carnot's bound at what it bears. */
export function engineShare(
  sourceC: number,
  coldK: number,
  fitMm: number,
  strengthMpa: number,
): number {
  return craftShare(fitMm) * carnot(Math.min(sourceC, heldHeat(strengthMpa)), coldK);
}

/** The share of a river's fall, a wind's or a tide's power a mill's wheel turns to work (est: an overshot wheel's). */
export const WHEEL_SHARE = 0.3;
/** A turbine's, driving a dynamo (est). */
export const TURBINE_SHARE = 0.8;
/** What a land's mills turn, for each crafter who keeps them (kW of work, est: England's 6,000 mills of 1086 some 3 kW each). */
export const MILL_KW = 0.2;
/** With dynamos to carry it: the share of its rivers' fall a land can dam, and of its ground the wind can be gathered on (est). */
export const DAMMED = 0.3;
export const WIND_GROUND = 0.02;
/** What a square metre of ground the wind is gathered on gives, against what blows through a square metre of its sweep (est). */
export const WIND_SPACING = 0.01;

// —— What a land wants ——————————————————————————————————————————————————————————————————————————————

/** The work a crafter's works drive at full industry (kW, est: some 1.4 kW of shaft for each hand, as Britain had in 1907). */
export const WORK_KW = 1.4;
/** The work a trader's carriers draw, where engines carry for them (kW, est). */
export const CARRY_KW = 1;
/** The work a household draws for each person once a current reaches it: light, heat moved, motors (kW, est). */
export const HOME_KW = 0.15;
/** Heat a person wants a year for cooking at an open hearth (kW, est: some 600 kg of wood), and for warmth at the coldest. */
export const COOK_KW = 0.25,
  WARM_KW = 1.5;
/** Where it is warmer than this (°C), no one heats a home; it is coldest at this many degrees under it (est). */
export const WARM_AT = 14,
  COLD_SPAN = 24;
/** Heat a unit of metal takes to smelt, kW·yr (est: 200 MJ/kg of a bloomery's charcoal, 40 by a blast furnace's coke; 5 kg a unit). */
export const SMELT_KWY = (200 * 5) / MJ_A_KWY,
  BLAST_KWY = (40 * 5) / MJ_A_KWY;

/** How cold a land is for its people: 0 where no one heats a home, 1 at the coldest. */
export function coldOf(celsius: number): number {
  return Math.min(1, Math.max(0, (WARM_AT - celsius) / COLD_SPAN));
}

// —— The carriers ——————————————————————————————————————————————————————————————————————————————————

/** What a land draws on, each its own line of the account. */
export const CARRIERS = [
  "muscle",
  "beasts",
  "wood",
  "dung",
  "flow",
  "wind",
  "tide",
  "ground",
  "sun",
  "buried",
  "atom",
] as const;
export type Carrier = (typeof CARRIERS)[number];

/** A carrier's sign and words. */
export const CARRIER_WORDS: Readonly<
  Record<Carrier, { readonly icon: string; readonly name: string }>
> = {
  muscle: { icon: "💪", name: "its people's own strength" },
  beasts: { icon: "🐂", name: "beasts that pull" },
  wood: { icon: "🪵", name: "wood" },
  dung: { icon: "🌾", name: "dung and straw" },
  flow: { icon: "🌊", name: "its rivers' fall" },
  wind: { icon: "🌬️", name: "the wind" },
  tide: { icon: "🌙", name: "the tides" },
  ground: { icon: "♨️", name: "the ground's heat" },
  sun: { icon: "☀️", name: "its star's light" },
  buried: { icon: "⛏️", name: "fuel its crust buried" },
  atom: { icon: "⚛️", name: "the atom" },
};

/** Where a land's work comes from (the leading one names what drives its works). */
export const SOURCES = [
  "none",
  "mills",
  "current",
  "dam",
  "burned",
  "ground",
  "vent",
  "sun",
  "joined",
  "fission",
  "fusion",
] as const;
export type Source = (typeof SOURCES)[number];

/**
 * What lets a land draw on each source: the principles that teach the way (a gate: how much it draws is its world's). A heat
 * engine of any kind runs on any heat its land can tap; tapping each heat is its own craft.
 */
export const SOURCE_BY: Readonly<Record<Exclude<Source, "none">, readonly string[]>> = {
  // Wheels of wind and water, as many as a land's crafters keep.
  mills: ["mills"],
  // Mills that drive works, turned by what flows past them however much (the tides' and currents').
  current: ["current-mills"],
  // Turbines that turn dynamos, on dammed rivers, the wind and the tides.
  dam: ["electricity", "sea-electricity", "graphite-dynamos", "ground-dynamos", "polymer-wire"],
  burned: ["steam-engine", "engines"],
  ground: ["heat-engines", "ground-dynamos"],
  vent: ["vent-heat"],
  sun: ["sun-engines"],
  joined: ["cold-chemistry"],
  fission: ["greatest-fire"],
  fusion: ["fusion-power"],
};
/**
 * The principles that let turbines take the wind for dynamos: blades light and strong enough to stand in a gale, shaped as a
 * wing is (the first wind farms waited on the aeroplane's wing and on glass-fibre and carbon), or a current made even by
 * solid-state switches. The tides and the rivers ask only for a dam and a dynamo.
 */
export const WIND_TURBINES: readonly string[] = [
  "powered-wings",
  "solid-state",
  "polymer-wire",
  "drawn-carbon",
];
/** The principles that make a heat engine: any one lets a land's works run on any heat it can tap. */
export const HEAT_ENGINES: readonly string[] = [
  "steam-engine",
  "engines",
  "heat-engines",
  "vent-heat",
  "sun-engines",
  "cold-chemistry",
];

/** What each source is, in words. */
export const SOURCE_WORDS: Readonly<Record<Source, string>> = {
  none: "their own strength and their beasts'",
  mills: "mills of wind and water",
  current: "mills the tides and currents turn",
  dam: "turbines on its rivers, the wind and the tides, and dynamos",
  burned: "engines burning fuel",
  ground: "engines of the ground's heat",
  vent: "the heat of the sea floor's vents",
  sun: "engines the sun's heat drives",
  joined: "acetylene joined with hydrogen",
  fission: "the atom's fire",
  fusion: "a fusion flame held in a bottle",
};

/** What a held flame or the atom's fire runs at (°C, est): water-cooled cores some 320 °C; a flame's blanket as hot as its walls bear. */
export const FISSION_C = 320,
  FUSION_C = 1000;
/** The atom's heat a land's crafters have built cores for, each (kW, est: about a third of what its works then burn). */
export const FISSION_KW = 3;
/** The least of its star's metals (against the Sun's) at which a world's ground holds the atom's fuel within reach (est). */
export const FISSION_METALS = 0.5;
/** Mirrors a crafter keeps turned to the sun for a land's engines (m², est). */
export const SUN_M2 = 400;

// —— The year's account ——————————————————————————————————————————————————————————————————————————

/** What a land is and holds, for its year's account: every figure the world already keeps. */
export type EnergyInputs = {
  readonly people: number;
  /** Those who work with their hands and their beasts (all but the young and old). */
  readonly workers: number;
  readonly farmers: number;
  readonly crafters: number;
  readonly traders: number;
  /** What its people eat, against an upright ape (1: a unit a month), and the share of it they had. */
  readonly appetite: number;
  readonly fed: number;
  /** Its herds' live weight (kg), a beast's weight (kg), and whether its beasts are put to pull. */
  readonly herdKg: number;
  readonly beastKg: number;
  readonly draught: boolean;
  /** The grain it reaped (units), for its straw. */
  readonly grain: number;
  /** How cold it is for its people (coldOf), and whether they keep a fire at all. */
  readonly cold: number;
  readonly fire: boolean;
  /** Metal its smelters made (units), and whether its furnaces burn coke (a blast furnace). */
  readonly smelted: number;
  readonly blast: boolean;
  /** How much of its crafts its works do (lore's industry), and the share of its carrying engines do. */
  readonly industry: number;
  readonly carried: number;
  /** Whether a current reaches its homes. */
  readonly homes: boolean;
  /** The work its works must drive to fix its air's nitrogen for its fields (kW; rules/ground.ts FIX_KWY). */
  readonly fixKw?: number;
  /** The sources it knows how to tap (SOURCE_BY), and whether it knows a heat engine. */
  readonly taps: ReadonlySet<Source>;
  readonly engine: boolean;
  /** Its woods: what they give a year without thinning (kW of heat). */
  readonly woodKw: number;
  /** What flows: its rivers' fall (kW), its wind's (kW gathered where turbines could stand), its tides' (kW along its coast). */
  readonly riverKw: number;
  readonly windKw: number;
  readonly tideKw: number;
  /** Whether its turbines can take the wind (WIND_TURBINES): blades light and strong enough, their current made even. */
  readonly windTurbines?: boolean;
  /** The ground's heat a land can draw (kW) and how hot (°C); its vents' heat (kW, 0: none) and theirs (°C). */
  readonly groundKw: number;
  readonly groundC: number;
  readonly ventKw: number;
  readonly ventC: number;
  /** Its star's light at its ground (W/m²), and how hot a mirror's spot gets (°C). */
  readonly lightWm2: number;
  readonly mirrorC: number;
  /** Buried fuel at hand this year (kW·yr): coal and oil in its market, gas drawn with its oil; its world's own lying about. */
  readonly coalKwy: number;
  readonly oilKwy: number;
  readonly gasKwy: number;
  readonly ownKwy: number;
  /** How hot a fire it holds (°C), the cold its engines shed to (K), its finest fit (mm), its strongest stuff (MPa). */
  readonly fireC: number;
  readonly coldK: number;
  readonly fitMm: number;
  readonly strengthMpa: number;
  /** Whether its hearths may burn coal, and oil and gas (it knows how they are got). */
  readonly coalKnown: boolean;
  readonly oilKnown: boolean;
};

/** A land's year: what it drew of each carrier (kW, as food, fodder, heat or flow), what it wanted and had, and what it burned. */
export type EnergyAccount = {
  readonly drawn: Readonly<Record<Carrier, number>>;
  /** Work its works, carriers and homes wanted, and what they had (kW). */
  readonly workWanted: number;
  readonly workHad: number;
  /** Of that, its works' own: wanted and had (kW). */
  readonly worksWanted: number;
  readonly worksHad: number;
  /** Heat its hearths and smelters wanted, and what they had (kW). */
  readonly heatWanted: number;
  readonly heatHad: number;
  /** All the work it turned (kW): its bodies', its beasts', its mills' and its engines'. */
  readonly work: number;
  /** The work each source gave (kW). */
  readonly by: Readonly<Record<Source, number>>;
  /** Its engines' share of Carnot's bound on what burns, and what drove most of its work past bodies and beasts. */
  readonly share: number;
  readonly drives: Source;
  /** Buried fuel it burned (kW·yr): coal, oil, gas, its world's own; of it, what its engines burned. */
  readonly coal: number;
  readonly oil: number;
  readonly gas: number;
  readonly own: number;
  readonly engineFuel: number;
  /** Wood its engines burned (kW·yr), and wood felled past what its woods give (kW·yr). */
  readonly engineWood: number;
  readonly felled: number;
  /** The buried fuel it wanted (kW·yr): what its hearths and engines would have burned of it had they had all they wanted, past what else they had. */
  readonly fuelWanted: number;
};

const zeros = <K extends string>(keys: readonly K[]): Record<K, number> =>
  Object.fromEntries(keys.map((c) => [c, 0])) as Record<K, number>;

/**
 * A land's year of energy: what it wants of heat and work, and what it draws to meet them, the nearest first. Its bodies and
 * beasts work as they eat. Its hearths and smelters take what its woods give, then dung and straw, then buried fuel (where its
 * people know how it is got), then fell its woods. Its works, carriers and homes take what flows (mills, or turbines where
 * dynamos carry it), then the free heat of its ground, vents and star, then a held flame and the atom, then what burns —
 * buried fuel, its world's own, what its woods have left — each heat turned to work at what its engines reach of Carnot's
 * bound. Pure: nothing here draws a number.
 */
export function energyAccount(i: EnergyInputs): EnergyAccount {
  const drawn = zeros(CARRIERS),
    by = zeros(SOURCES);
  // Bodies: they burn what they eat, and the workers' work is a share of it.
  const ate = FOOD_KW * i.appetite * i.fed;
  drawn.muscle = i.people * ate;
  by.none = i.workers * ate * MUSCLE_WORK;
  // Beasts put to pull: as many as the herd can spare and the fields want.
  const herd = i.beastKg > 0 ? i.herdKg / i.beastKg : 0,
    pulling = i.draught ? Math.min(herd * DRAUGHT_SHARE, i.farmers * BEASTS_A_FARMER) : 0;
  drawn.beasts = pulling * BEAST_FEED * bodyKw(i.beastKg);
  by.none += drawn.beasts * BEAST_WORK;

  // Heat wanted: hearths for cooking and warmth, smelters for metal.
  const heatWanted = i.fire
    ? i.people * (COOK_KW + WARM_KW * i.cold) + i.smelted * (i.blast ? BLAST_KWY : SMELT_KWY)
    : 0;
  let wood = i.fire ? i.woodKw : 0,
    dung = i.fire
      ? ((i.herdKg * DUNG_A_KG * DUNG_GATHERED + i.grain * STRAW_A_UNIT * STRAW_BURNED) *
          mixMjKg(FUEL_MAKEUP.dung!, "oxygen")) /
        MJ_A_KWY
      : 0,
    coalLeft = i.coalKwy,
    oilLeft = i.oilKwy,
    gasLeft = i.gasKwy,
    ownLeft = i.ownKwy,
    coal = 0,
    oil = 0,
    gas = 0,
    own = 0,
    felled = 0,
    fuelWanted = 0;
  let heat = heatWanted;
  const take = (left: number) => Math.max(0, Math.min(left, heat));
  {
    let x = take(wood);
    wood -= x;
    drawn.wood += x;
    heat -= x;
    x = take(dung);
    dung -= x;
    drawn.dung += x;
    heat -= x;
    if (i.coalKnown || i.oilKnown) fuelWanted += heat;
    if (i.coalKnown) {
      x = take(coalLeft);
      coalLeft -= x;
      coal += x;
      heat -= x;
    }
    if (i.oilKnown) {
      x = take(gasLeft);
      gasLeft -= x;
      gas += x;
      heat -= x;
      x = take(oilLeft);
      oilLeft -= x;
      oil += x;
      heat -= x;
    }
    x = take(ownLeft);
    ownLeft -= x;
    own += x;
    heat -= x;
    // (What nothing else gives, the woods do, felled, as far as its people can fell in a year: what is left, they go without.)
    if (heat > 0 && i.fire && i.woodKw > 0) {
      felled = Math.min(heat, (i.woodKw / WOOD_TAKEN) * WOODS_HOLD_YEARS * FELLED_MOST);
      drawn.wood += felled;
      heat -= felled;
    }
  }
  const heatHad = heatWanted - heat;

  // Work wanted: its works' (its old mills' and its engines'), its carriers' and its homes'.
  const mills = i.taps.has("mills") ? i.crafters * MILL_KW : 0,
    worksWanted = i.crafters * Math.max(0, i.industry) * WORK_KW + mills,
    workWanted =
      worksWanted +
      i.traders * CARRY_KW * Math.max(0, Math.min(1, i.carried)) +
      (i.homes ? i.people * HOME_KW : 0) +
      (i.fixKw ?? 0);
  let want = workWanted,
    share = 0,
    engineFuel = 0,
    engineWood = 0;
  const gave = (s: Source, work: number) => {
    by[s] += work;
    want -= work;
  };
  // What flows: turbines on a share of it where dynamos carry their work (the wind's only where blades can take it); else wheels.
  const flows = i.riverKw + i.windKw + i.tideKw,
    flowWork = (cap: number, wheel: number, s: Source, wind = true) => {
      const on = flows - (wind ? 0 : i.windKw);
      if (want <= 0 || on <= 0 || cap <= 0) return;
      const can = Math.min(want, cap),
        k = can / (on * wheel);
      drawn.flow += i.riverKw * k;
      if (wind) drawn.wind += i.windKw * k;
      drawn.tide += i.tideKw * k;
      gave(s, can);
    };
  if (i.taps.has("dam")) {
    const wind = !!i.windTurbines,
      on = flows - (wind ? 0 : i.windKw);
    flowWork(on * DAMMED * TURBINE_SHARE, TURBINE_SHARE, "dam", wind);
  }
  if (i.taps.has("current")) flowWork(flows * WHEEL_SHARE, WHEEL_SHARE, "current");
  else if (i.taps.has("mills") && !i.taps.has("dam"))
    flowWork(Math.min(mills, flows * WHEEL_SHARE), WHEEL_SHARE, "mills");
  if (i.engine && want > 0) {
    // The free heats: the ground's, the vents', the star's; then a held flame, as much as wanted, and the atom.
    const free = (s: Source, kw: number, hotC: number, carrier: Carrier) => {
      if (want <= 0 || kw <= 0 || !i.taps.has(s)) return;
      const e = engineShare(hotC, i.coldK, i.fitMm, i.strengthMpa);
      if (e <= 0) return;
      const work = Math.min(want, kw * e);
      drawn[carrier] += work / e;
      gave(s, work);
    };
    free("ground", i.groundKw, i.groundC, "ground");
    free("vent", i.ventKw, i.ventC, "ground");
    free("sun", i.crafters * SUN_M2 * i.lightWm2 * 1e-3, i.mirrorC, "sun");
    free("fusion", Infinity, FUSION_C, "atom");
    free("fission", i.crafters * FISSION_KW, FISSION_C, "atom");
    // What burns: buried fuel first, then its world's own, then what its woods have left.
    const e = engineShare(i.fireC, i.coldK, i.fitMm, i.strengthMpa),
      burns = i.taps.has("burned") || i.taps.has("joined"),
      as: Source = i.taps.has("burned") ? "burned" : "joined";
    if (e > 0 && burns) {
      share = e;
      if (want > 0 && i.taps.has("burned")) fuelWanted += want / e;
      const burn = (left: number): number => {
        if (want <= 0 || left <= 0) return 0;
        const used = Math.min(left, want / e);
        gave(as, used * e);
        return used;
      };
      if (i.taps.has("burned")) {
        let x = burn(coalLeft);
        coal += x;
        engineFuel += x;
        x = burn(gasLeft);
        gas += x;
        engineFuel += x;
        x = burn(oilLeft);
        oil += x;
        engineFuel += x;
      }
      let x = burn(ownLeft);
      own += x;
      engineFuel += x;
      x = burn(wood);
      engineWood += x;
      drawn.wood += x;
    }
  }
  drawn.buried = coal + oil + gas + own;
  const workHad = workWanted - Math.max(0, want),
    worksHad = workWanted > 0 ? (worksWanted * workHad) / workWanted : 0;
  let drives: Source = "none",
    most = 0;
  for (const s of SOURCES)
    if (s !== "none" && by[s] > most) {
      most = by[s];
      drives = s;
    }
  return {
    drawn,
    workWanted,
    workHad,
    worksWanted,
    worksHad,
    heatWanted,
    heatHad,
    work: SOURCES.reduce((s, x) => s + by[x], 0),
    by,
    share,
    drives,
    coal,
    oil,
    gas,
    own,
    engineFuel,
    engineWood,
    felled,
    fuelWanted,
  };
}

/** A land's power a head that its work draws on (kW): its bodies' food, its beasts' fodder, what flows, its engines' heat. */
export function workPower(a: EnergyAccount, people: number): number {
  const all = CARRIERS.reduce((s, c) => s + a.drawn[c], 0);
  // (Its hearths' and smelters' heat is not its work's.)
  return Math.max(0, all - a.heatHad) / Math.max(1, people);
}

/** All a land drew a head (kW): food, fodder, heat and flow. */
export function primaryPower(a: EnergyAccount, people: number): number {
  return CARRIERS.reduce((s, c) => s + a.drawn[c], 0) / Math.max(1, people);
}

/**
 * The principles that carry goods by engine (railways, steamships, the oil engine): those that ease a haul or carrying and
 * are themselves an engine, or need one whichever way they are reached. What they ease is the share of a land's carrying
 * its engines must drive.
 */
export function engineDriven(): { id: string; haul: number; carrying: number }[] {
  const power = new Set(PRINCIPLES.filter((p) => (p.effects.power ?? 0) > 0).map((p) => p.id));
  return PRINCIPLES.filter(
    (p) =>
      ((p.effects.haul ?? 0) > 0 || (p.effects.carrying ?? 0) > 0) &&
      (power.has(p.id) || p.needs.some((n) => n.split("|").every((x) => power.has(x)))),
  ).map((p) => ({ id: p.id, haul: p.effects.haul ?? 0, carrying: p.effects.carrying ?? 0 }));
}
/** What in the account is an estimate (for the pages that cite it). */
export const ENERGY_ESTIMATES: readonly string[] = [
  "MUSCLE_WORK",
  "BEAST_FEED",
  "BEAST_WORK",
  "DRAUGHT_SHARE",
  "BEASTS_A_FARMER",
  "HERD_GIVES",
  "WOOD_TAKEN",
  "WOODS_HOLD_YEARS",
  "DUNG_A_KG",
  "DUNG_GATHERED",
  "STRAW_A_UNIT",
  "STRAW_BURNED",
  "RUNOFF",
  "WIND_MS",
  "TIDE_KW_KM",
  "GROUND_WM2",
  "GROUND_DRAWN",
  "heldHeat",
  "craftShare",
  "WHEEL_SHARE",
  "TURBINE_SHARE",
  "MILL_KW",
  "DAMMED",
  "WIND_GROUND",
  "WORK_KW",
  "CARRY_KW",
  "HOME_KW",
  "COOK_KW",
  "WARM_KW",
  "SMELT_KWY",
  "SUN_M2",
  "FISSION_C",
  "FUSION_C",
  "FISSION_KW",
  "WELL_M",
];
