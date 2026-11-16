// What drives a world's works where nothing is burned: the fall of its rivers, its wind, the heat of its ground near
// where its plates meet or a plume rises, and the fissile part of its uranium. Each read off the world as made, in
// watts a land, from its own facts: its rain and relief, its pull, its air's density and the contrast of warmth that
// drives its winds, its plate boundaries and hotspots, its star's age and its crust's heavy elements. Pure functions of
// the generated world, kept by world.
//
// Fuel stays the easy road: a seam under the ground is dug and burned by any works. These are the other roads to a
// works driven by current, slower to raise where they only just cover what the works ask (far.ts machinesRoad).
import { dmath } from "../kernel/index.ts";
import { crustMultiplier } from "../rules/index.ts";
import { starAgeGyr } from "./bodies.ts";
import { worldChemistry } from "./chemistry.ts";
import type { HomeWorld } from "./homeworld.ts";
import { BOUNDARY } from "./plates.ts";
import { isProvinceWorld } from "./provinces.ts";

/** The roads a works may be driven by, fuel first. */
export type CarrierRoad = "fuel" | "water" | "wind" | "heat" | "atom";

/** What a people's works ask of current, in watts a person: Earth's electricity a head when its first satellite flew
 * (1957: some 2,000 TWh in the year among 2.9 billion, about 80 W). */
export const WORKS_WATTS = 80;

/** Of the rain that falls on land, the share that runs off it to the sea (Earth's: about two fifths). */
const RUNOFF = 0.4;
/** Of a river's fall, what a turbine makes current of. */
const TURBINE = 0.8;
/** What a wind farm makes a square metre of ground at Earth's winds (about 6 m/s at a tower's height): some 2 W, on
 * half of a land at most. */
const WIND_W_M2 = 1;
/** The contrast of warmth between Earth's tropics and its polar caps that drives its winds (°C). */
const EARTH_CONTRAST = 40;
/** Where plates meet or a plume rises, the current its hot ground gives a square metre (Earth's high-heat fields). */
const HEAT_W_M2 = 0.02;
/** Earth's crust's uranium, ppm, and the fissile share of it now (U-235 of all its uranium). */
const EARTH_URANIUM = 2.7,
  EARTH_FISSILE = 0.0072;
/** Earth's age (Gyr) and the half-lives of U-235 and U-238 (Gyr). */
const EARTH_AGE = 4.54,
  HALF_235 = 0.704,
  HALF_238 = 4.468;
/** Below this fissile share, enriching fuel for a reactor asks more of a works than the reactor gives back. */
const FISSILE_LEAST = 0.003;
/** What Earth's known uranium gives as current, burned in reactors over a century (W): some six million tonnes at
 * about 40 GWh a tonne. */
const EARTH_FISSION_W = 2.7e11;
const SECONDS_A_YEAR = 3.156e7;

/** Each land's current from its rivers, its wind and its ground's heat, and its share of its world's fissile (W). */
export type Carriers = {
  readonly water: Float64Array;
  readonly wind: Float64Array;
  readonly heat: Float64Array;
  readonly atom: Float64Array;
};

/** Kept by the world's ground as made, its lands and the air read of it (a world entered is its ground and its far
 * reading), a few at a time. */
const KEPT = new Map<string, Carriers>();

/** The fissile share of a world's uranium, by its star's age: U-235 decays six times faster than U-238. */
export function fissileShare(ageGyr: number): number {
  const ratio = (s: number) => s / (1 - s),
    l235 = dmath.LN2 / HALF_235,
    l238 = dmath.LN2 / HALF_238,
    r = ratio(EARTH_FISSILE) * dmath.exp((EARTH_AGE - ageGyr) * (l235 - l238));
  return r / (1 + r);
}

/** What a world's lands each carry (on a world of provinces, each province its fine cells'). Pure; kept by world. */
export function carriersOf(g: HomeWorld): Carriers {
  const bar =
      g.far?.planet.pressure ?? (isProvinceWorld(g) ? g.fine.far?.planet.pressure : undefined) ?? 1,
    key = `${g.digest} ${g.grid.count} ${bar}`,
    kept = KEPT.get(key);
  if (kept) return kept;
  const coarse = g.grid.count,
    water = new Float64Array(coarse),
    wind = new Float64Array(coarse),
    heat = new Float64Array(coarse),
    atom = new Float64Array(coarse),
    fine = isProvinceWorld(g) ? g.fine : g,
    landOf = (c: number) => (isProvinceWorld(g) ? g.provinceOf[c]! : c),
    f = fine.grid,
    e = fine.tectonics.elevation,
    radius = 6.371e6 * fine.planet.radius,
    gravity = 9.81 * fine.planet.gravity,
    t = fine.tectonics,
    hot = new Set(t.hotspots);
  // (The winds: driven by how much warmer its tropics are than its poles; their power as the cube of their speed, and
  // as its air's density, from its pressure and warmth.)
  let warm = 0,
    nWarm = 0,
    cold = 0,
    nCold = 0;
  for (let c = 0; c < f.count; c++) {
    const lat = dmath.abs(f.lat[c]!);
    if (lat < 0.35) {
      warm += fine.climate.temperature[c]!;
      nWarm++;
    } else if (lat > 1.05) {
      cold += fine.climate.temperature[c]!;
      nCold++;
    }
  }
  const contrast = nWarm && nCold ? Math.max(0, warm / nWarm - cold / nCold) : 0,
    density = (bar * 288) / Math.max(30, fine.planet.meanTemperature + 273),
    windEach = WIND_W_M2 * density * dmath.pow(contrast / EARTH_CONTRAST, 3);
  // (The atom: its crust's uranium by its heavy elements, the fissile share of it by its star's age; shared out over
  // its lands by their ground.)
  const share = fissileShare(starAgeGyr(fine.star)),
    uranium = EARTH_URANIUM * crustMultiplier(worldChemistry(fine), "Pb"),
    fission =
      share >= FISSILE_LEAST
        ? (EARTH_FISSION_W * (uranium / EARTH_URANIUM) * share) / EARTH_FISSILE
        : 0;
  let ground = 0;
  for (let c = 0; c < f.count; c++) if (e[c]! > 0) ground += f.areas[c]!;
  for (let c = 0; c < f.count; c++) {
    if (e[c]! <= 0) continue;
    const land = landOf(c),
      area = f.areas[c]! * radius * radius;
    // Its rivers' fall to the next cell down (to the sea at its shore), with what runs off of all that drains here.
    const down = fine.water.flowTo[c]!,
      head = down >= 0 ? e[c]! - Math.max(0, e[down]!) : 0;
    if (head > 0) {
      const flow = (RUNOFF * fine.water.discharge[c]! * 1e-6 * radius * radius) / SECONDS_A_YEAR;
      water[land]! += TURBINE * 1000 * gravity * head * flow;
    }
    wind[land]! += windEach * area;
    const near =
      t.toBoundary[c]! <= 1 &&
      (t.boundary[c] === BOUNDARY.convergent || t.boundary[c] === BOUNDARY.divergent);
    if (near || hot.has(c)) heat[land]! += HEAT_W_M2 * area;
    if (ground > 0) atom[land]! += (fission * f.areas[c]!) / ground;
  }
  const made = { water, wind, heat, atom };
  if (KEPT.size >= 64) KEPT.clear();
  KEPT.set(key, made);
  return made;
}

/**
 * The best road other than fuel that drives the works of lands, and the current it gives them (W): the most of what
 * their rivers, wind and ground carry, and the atom where they know the electron (its physics is theirs by then).
 */
export function bestCarrier(
  g: HomeWorld,
  lands: Iterable<number>,
  atom: boolean,
): { readonly road: Exclude<CarrierRoad, "fuel">; readonly watts: number } | null {
  const c = carriersOf(g),
    sum = { water: 0, wind: 0, heat: 0, atom: 0 };
  for (const land of lands) {
    if (land < 0 || land >= c.water.length) continue;
    sum.water += c.water[land]!;
    sum.wind += c.wind[land]!;
    sum.heat += c.heat[land]!;
    if (atom) sum.atom += c.atom[land]!;
  }
  // (Named by the road that carries most; the current is all of them together, as one grid carries them.)
  let road: Exclude<CarrierRoad, "fuel"> | null = null;
  for (const r of ["water", "wind", "heat", "atom"] as const)
    if (sum[r] > 0 && (road === null || sum[r] > sum[road])) road = r;
  return road === null ? null : { road, watts: sum.water + sum.wind + sum.heat + sum.atom };
}

/** What one land carries by every road but fuel (the atom's where it is known), in watts. */
export function landCarries(g: HomeWorld, land: number, atom: boolean): number {
  const c = carriersOf(g);
  if (land < 0 || land >= c.water.length) return 0;
  return c.water[land]! + c.wind[land]! + c.heat[land]! + (atom ? c.atom[land]! : 0);
}
