// The planet in motion (Round D): what a world's ice, seas, currents, field and star do over the years of a chronicle, as
// physics has them, each world's own numbers saying how. Pure functions; the sim (sim/planet/motion.ts) keeps the state.
//
// - Ice: a land bears an ice sheet below the line the biomes were named by (gen/climate.ts classify: −10 degrees); a
//   sheet grows by the snow that falls on it and wastes by the warmth of its summers (positive degree-days), and stands
//   no thicker than a perfectly plastic sheet of its width can (Nye): H = √(2τx / ρg), so a world of low pull bears
//   thicker ice. What a sheet holds is the sea's: as it melts the seas rise by its volume over the seas' area.
// - The seas swell as they warm (each liquid by its own expansion), over the centuries the deep takes to warm.
// - Ice is bright: the less of it, the more of its star's light a world keeps (the ice-albedo feedback).
// - The overturning of the seas is driven by cold, salt water sinking; fresh water from melting ice and a warmer
//   surface weaken it, and the coasts its currents warmed lose some of that warmth.
// - A field is made by a convecting, conducting core (a dynamo): the larger the world, the longer its core stays
//   molten; turning fast enough, it makes a strong dipole. Its field holds the star's wind off at a distance set by
//   the balance of their pressures; inside it the ground is sheltered from the star's particles.
// - A star brightens as it burns its hydrogen (the Sun by about a tenth a billion years), swells to a giant at the end,
//   and ends as a white dwarf, or past eight Suns in a supernova that strips the air of worlds near it.
import { dmath } from "../kernel/index.ts";

// —— Ice and the sea ————————————————————————————————————————————————————————————————————————————————

export const ICE = {
  /** Densities of ice and of its liquid (kg/m³). */
  rhoIce: 917,
  rhoLiquid: 1000,
  /** An ice sheet's basal yield stress (Pa): a perfectly plastic sheet's (Nye 1951; 50 kPa matches the great sheets). */
  yield: 5e4,
  /** Melt by a summer's warmth: metres of water a day for each degree above freezing (a degree-day factor). */
  ddf: 0.006,
  /** The mean warmth (degrees of its liquid) below which a land bears a sheet: the line its biomes were named by. */
  line: -10,
  /** Thinner than this (m), a sheet no longer covers its land. */
  thin: 30,
  /** Earth's standard gravity (m/s²). */
  g: 9.81,
} as const;

/** The mean of max(0, T + A sin θ) over a year: the warmth above freezing a day (degrees), a sinusoidal year. */
export function warmAbove(mean: number, swing: number): number {
  if (swing <= 1e-9) return Math.max(0, mean);
  const x = mean / swing;
  if (x >= 1) return mean;
  if (x <= -1) return 0;
  return (swing / Math.PI) * (Math.sqrt(1 - x * x) + x * dmath.acos(-x));
}

/** The share of a sinusoidal year below freezing (when what falls is snow). */
export function belowFreezing(mean: number, swing: number): number {
  if (swing <= 1e-9) return mean < 0 ? 1 : 0;
  const x = mean / swing;
  return x >= 1 ? 0 : x <= -1 ? 1 : dmath.acos(x) / Math.PI;
}

/**
 * A land's ice a year (metres of ice; + grows, − wastes): the snow its rain makes in the months below freezing, less
 * what its summers melt (degree-days × the melt factor). `k`: kelvin a degree of its climate (its liquid's band).
 */
export function iceBalance(mean: number, swing: number, rainMm: number, k = 1): number {
  const snow = (rainMm / 1000) * belowFreezing(mean, swing),
    melt = ICE.ddf * 365.25 * warmAbove(mean, swing) * k;
  return ((snow - melt) * ICE.rhoLiquid) / ICE.rhoIce;
}

/** The thickest a sheet stands this far (km) inside its edge on a world of this pull (Earth gravities): Nye's √(2τx/ρg). */
export function sheetHeight(insideKm: number, gravity: number): number {
  const x = Math.max(0, insideKm) * 1000;
  return Math.sqrt((2 * ICE.yield * x) / (ICE.rhoIce * ICE.g * Math.max(0.05, gravity)));
}

/** How far the seas rise (m) as ice of this volume (km³ of ice) melts into seas of this area (km²). */
export function seaFromIce(iceKm3: number, seaKm2: number): number {
  return seaKm2 > 0 ? ((iceKm3 * ICE.rhoIce) / ICE.rhoLiquid / seaKm2) * 1000 : 0;
}

/** Each liquid's expansion as it warms (a kelvin, a share of its volume): water's, oil's, acid's, ammonia water's, methane's. */
export const EXPANSION: Readonly<Record<string, number>> = {
  water: 2.1e-4,
  crude: 9e-4,
  "acid-water": 5e-4,
  "ammonia-water": 1.2e-3,
  methane: 3.4e-3,
};

/** The seas' deep, warmed through over this long (years): what the swelling of the seas follows. */
export const DEEP_WARMS = 1000;
/** The mean depth of a world's seas (m), as Earth's. */
export const SEA_DEPTH = 3700;

/** How far the seas swell in the end for a warming (kelvin) of a liquid (its matter id). */
export function swellOf(kelvin: number, liquid: string): number {
  return (EXPANSION[liquid] ?? EXPANSION.water!) * kelvin * SEA_DEPTH;
}

// —— Light kept: ice's brightness and the star's ————————————————————————————————————————————————

/** How much warmer a world grows a watt of light kept a square metre (K): three a doubling of carbon, as air.ts reads it. */
export const LAMBDA = 3 / 3.7;
/** The brightness of ice and of the ground it lay on (a share of light thrown back). */
export const ICE_ALBEDO = 0.6;
export const GROUND_ALBEDO = 0.2;
/** The light a square metre at Earth's distance from the Sun (W/m²). */
export const SOLAR_CONSTANT = 1361;

/** How much warmer a world grows (K) for ice gone from this share of its whole face (negative: ice come). */
export function albedoWarming(iceLostShare: number, insolation: number): number {
  return LAMBDA * (SOLAR_CONSTANT / 4) * insolation * iceLostShare * (ICE_ALBEDO - GROUND_ALBEDO);
}

/** How much warmer a world grows (K) for its star's light risen by this share. */
export function starWarming(lightRisen: number, insolation: number, albedo: number): number {
  return LAMBDA * (SOLAR_CONSTANT / 4) * insolation * (1 - albedo) * lightRisen;
}

// —— The overturning of the seas ————————————————————————————————————————————————————————————————————

export const OVERTURN = {
  /** Fresh water poured into the seas (sverdrups, 10⁶ m³/s) that halves the overturning. */
  halves: 0.25,
  /** The share it weakens for each degree warmer at the surface (and strengthens for each colder). */
  perDegree: 0.04,
  /** Its pace toward what the seas now drive (a share of the way a year: some fifty years). */
  pace: 0.02,
  least: 0.1,
  most: 1.3,
} as const;

/**
 * The overturning the seas drive (1: as the world was made), by the melt poured in (Sv) and the warming (K); `salt`: its seas'
 * salt against Earth's (a salter sea takes more fresh water to stop its sinking), `brine`: what its sea ice's forming adds
 * (rules/seaice.ts; 1 as made).
 */
export function overturnOf(meltSv: number, kelvin: number, salt = 1, brine = 1): number {
  const fresh = 1 / (1 + Math.max(0, meltSv) / (OVERTURN.halves * Math.max(0.05, salt)));
  return dmath.clamp(
    fresh * brine * (1 - OVERTURN.perDegree * kelvin),
    OVERTURN.least,
    OVERTURN.most,
  );
}

// —— A world's field ————————————————————————————————————————————————————————————————————————————————

export type MagnetosphereInputs = {
  /** Earth masses and radii; its day (hours); its age and its star's (billions of years, one); how many plates it has. */
  readonly mass: number;
  readonly radius: number;
  readonly dayHours: number;
  readonly ageGyr: number;
  readonly plates: number;
  /** Its metals against the Sun's ([Fe/H], dex): an iron core's share. */
  readonly feH: number;
  /** Its orbit (AU), its star's mass (Suns). */
  readonly orbitAu: number;
  readonly starMass: number;
  /** Whether its seas and air are its liquid's at all (an airless world's field shelters nothing that breathes). */
  readonly air: number;
};

export type Magnetosphere = {
  /** Whether its core still turns over (a dynamo). */
  readonly dynamo: boolean;
  /** Whether it turns fast enough for one strong dipole (a local Rossby number under about a tenth). */
  readonly dipole: boolean;
  /** Its field's moment against Earth's. */
  readonly moment: number;
  /** How long its core stays molten (billions of years), and how far through that it is. */
  readonly coreGyr: number;
  /** Its star's wind against the Sun's at Earth: its pressure at the world's orbit. */
  readonly wind: number;
  /** Where its field holds the wind off, in its own radii (about ten for Earth). */
  readonly standoff: number;
  /** How much of the star's particles its field keeps from its air and ground, 0 … 1. */
  readonly shelter: number;
  /** What reaches its ground of the sky's particles, against Earth's. */
  readonly dose: number;
  /** Air its star's wind strips a billion years (a share of its air), with this field. */
  readonly stripped: number;
};

/** Earth's core: molten some fifteen billion years for its size (Mars's froze within one, a tenth as massive). */
export const CORE = { earthGyr: 15, power: 1.5, rossbyEarth: 0.09, rossbyDipole: 0.12 } as const;

/** A world's field from its size, spin, age and iron, and what it keeps from its star's wind. */
export function magnetosphereOf(i: MagnetosphereInputs): Magnetosphere {
  // (A core cools by its face and holds heat by its bulk: the bigger the world, the longer it stays molten; plates
  // carry the mantle's heat off and keep the core convecting.)
  const iron = dmath.clamp(dmath.pow(10, 0.5 * i.feH), 0.5, 2),
    coreGyr =
      CORE.earthGyr * dmath.pow(Math.max(0.01, i.mass), CORE.power) * (i.plates > 0 ? 1 : 0.4),
    through = i.ageGyr / Math.max(1e-6, coreGyr),
    dynamo = through < 1,
    rossby = CORE.rossbyEarth * (i.dayHours / 24),
    dipole = dynamo && rossby < CORE.rossbyDipole,
    // (Christensen's flux scaling: the moment with the core's size and the heat still left to drive it; a world
    // turning too slowly makes a weak, tangled field of many poles.)
    moment = dynamo
      ? iron *
        dmath.pow(Math.max(0.01, i.mass), 1.2) *
        dmath.pow(Math.max(0.02, 1 - through) / (1 - 4.6 / CORE.earthGyr), 1 / 3) *
        (dipole ? 1 : 0.08)
      : 0,
    // The star's wind: its mass's (a heavier star blows harder), falling with the square of the distance.
    wind = dmath.pow(Math.max(0.08, i.starMass), 0.5) / Math.max(1e-3, i.orbitAu * i.orbitAu),
    // (Where the field's pressure balances the wind's: Earth's about ten of its radii; a world's field at its face
    // goes as its moment over its radius cubed.)
    standoff = Math.max(
      1,
      10 *
        dmath.pow(moment / dmath.pow(Math.max(0.1, i.radius), 3), 1 / 3) *
        dmath.pow(wind, -1 / 6),
    ),
    shelter = 1 - dmath.exp(-(standoff - 1) / 2),
    earthShelter = 1 - dmath.exp(-4.5),
    // (What its air does not stop of what its field lets through; the dose is against Earth's, sheltered as it is.)
    open = (1 - shelter) / (1 - earthShelter),
    dose = i.air > 0 ? 1 + 0.25 * (open - 1) * Math.min(1, wind) : open,
    stripped = Math.min(1, 0.002 * wind * (1 - shelter) * (1 / Math.max(0.1, i.mass)));
  return {
    dynamo,
    dipole,
    moment,
    coreGyr,
    wind,
    standoff,
    shelter,
    dose: Math.max(1, dose),
    stripped,
  };
}

/** The share more of a people who die a year for each dose of the sky's particles past Earth's (cancers, a slow toll). */
export const DOSE_DEATHS = 0.004;

/**
 * What a star's flare does to a land of the home world, its field and air sheltering it: the flare's own factor where
 * the field keeps nothing off, none where it keeps all (Earth's keeps almost all).
 */
export function flareThrough(factor: number, shelter: number): number {
  return 1 + (factor - 1) * Math.max(0, 1 - shelter) * 0.5;
}

// —— A star's life ——————————————————————————————————————————————————————————————————————————————————

/** A star's life in shares of its main-sequence life (its hydrogen burned at the core: rules of the stars' models). */
export const STAR_LIFE = {
  /** The share of its life past which its core's hydrogen is gone and it swells. */
  subgiant: 0.9,
  giant: 0.97,
  /** How it brightens through its main life: L(f) = L₀ / (1 − a f) (the Sun ~ 0.7 of now at first, 2.2 at the end). */
  brighten: 0.55,
  /** How bright it is at the giant's tip (times its last main-sequence light). */
  tip: 1000,
  /** Past this many Suns a star ends in a supernova. */
  supernova: 8,
  /** Within this many light-years a supernova strips half of a world's ozone (Gehrels et al. 2003: about eight parsecs). */
  harmLy: 26,
  /** The years a supernova's burst presses on worlds near it. */
  burstYears: 20,
} as const;

export type StarStage = "main" | "subgiant" | "giant" | "ended";

/** How bright a star is at a share of its life, against its zero-age light (main sequence, then the giant's climb). */
export function lightAt(f: number): number {
  const a = STAR_LIFE.brighten;
  if (f < STAR_LIFE.subgiant) return 1 / (1 - a * Math.max(0, f));
  const end = 1 / (1 - a * STAR_LIFE.subgiant),
    up = (Math.min(1, f) - STAR_LIFE.subgiant) / (1 - STAR_LIFE.subgiant);
  return end * dmath.exp(dmath.log(STAR_LIFE.tip) * up * up);
}

export type StarLife = {
  readonly lifetimeGyr: number;
  /** How far through its life it is now. */
  readonly through: number;
  readonly stage: StarStage;
  /** Its light now against when the chronicle began; how fast it brightens (a share a thousand years). */
  readonly risen: number;
  readonly perKyr: number;
  /** Years until it swells (null: past that), and until it ends (null: it has ended). */
  readonly swellsIn: number | null;
  readonly endsIn: number | null;
  /** How it ends. */
  readonly end: "white dwarf" | "supernova";
  /** Whether its life is longer than the universe has yet lasted (a small red star's). */
  readonly outlasts: boolean;
};

/** The age of the universe (billions of years). */
export const UNIVERSE_GYR = 13.8;

/** A star's life from its mass and its age when the chronicle began, `years` into it. */
export function starLifeOf(
  mass: number,
  ageGyr: number,
  lifetimeGyr: number,
  years: number,
): StarLife {
  const life = Math.max(1e-6, lifetimeGyr),
    f0 = ageGyr / life,
    f = (ageGyr + years / 1e9) / life,
    stage: StarStage =
      f >= 1
        ? "ended"
        : f >= STAR_LIFE.giant
          ? "giant"
          : f >= STAR_LIFE.subgiant
            ? "subgiant"
            : "main",
    dt = 1000 / 1e9 / life,
    perKyr = stage === "ended" ? 0 : lightAt(f + dt) / lightAt(f) - 1;
  return {
    lifetimeGyr: life,
    through: f,
    stage,
    risen: stage === "ended" ? 0 : lightAt(f) / lightAt(f0) - 1,
    perKyr,
    swellsIn: f < STAR_LIFE.subgiant ? (STAR_LIFE.subgiant - f) * life * 1e9 : null,
    endsIn: f < 1 ? (1 - f) * life * 1e9 : null,
    end: mass >= STAR_LIFE.supernova ? "supernova" : "white dwarf",
    outlasts: life > UNIVERSE_GYR,
  };
}

/** What a supernova this far off (light-years) does to the deaths of a world under its burst, its field and air sheltering some. */
export function burstHarm(distanceLy: number, shelter: number): number {
  if (distanceLy <= 0) return 4;
  const r = STAR_LIFE.harmLy / distanceLy;
  return 1 + 0.3 * r * r * (1 - 0.3 * shelter);
}

// —— A star's death reaching the peoples of other stars (the sweep, Nature lane) ————————————————————————————

/** What is left of a star's light when it has ended as a white dwarf (a share of its light before: some thousandth). */
export const DWARF_LIGHT = 0.001;
/** The share more of a far people dead a year for each step of a burst's harm past one (est: a crude death rate). */
export const BURST_TOLL = 0.02;

/** What a burst of this harm (rules burstHarm) takes of a people over so many years under it (a share of them left). */
export function burstLeft(harm: number, years: number): number {
  return dmath.exp(-Math.max(0, harm - 1) * BURST_TOLL * Math.max(0, years));
}
