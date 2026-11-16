// What drives a world's works where nothing is burned: the fall of its rivers, its wind, the heat of its ground near
// where its plates meet or a plume rises, and the fissile part of its uranium. Each read off the world as made, in
// watts a land, from its own facts: its rain and relief, its pull, its air's density and the contrast of warmth that
// drives its winds, its plate boundaries and hotspots, its star's age and its crust's heavy elements. Pure functions of
// the generated world, kept by world.
//
// One physics with each land's energy account (rules/energy.ts, sim/economy/energy.ts): a river's power is riverKw, the
// wind's windWm2 at the speed its world's contrast of warmth drives, the ground's heat what rises through it (more at a
// plate's edge or over a plume) drawn as a mine draws it, each turned to current as the account's dams and turbines
// turn it; and the atom only where the account would let a land split it. Here it is read at the best its people
// could build (the far reading has no works to ask): what a land could carry, not what it draws.
//
// Fuel stays the easy road: a seam under the ground is dug and burned by any works. These are the other roads to a
// works driven by current, slower to raise where they only just cover what the works ask (far.ts machinesRoad).
import { dmath } from "../kernel/index.ts";
import {
  DAMMED,
  EDGE_HEAT,
  FISSILE_LEAST,
  FISSION_METALS,
  GROUND_DRAWN,
  GROUND_WM2,
  SPOT_HEAT,
  TURBINE_SHARE,
  WIND_GROUND,
  WIND_SPACING,
  airKgM3,
  carnot,
  craftShare,
  crustMultiplier,
  fissileShare,
  groundHeatC,
  riverKw,
  windSpeedOf,
  windWm2,
} from "../rules/index.ts";
import { starAgeGyr } from "./bodies.ts";
import { meansNumbers, worldChemistry } from "./chemistry.ts";
import { keptKey, type HomeWorld } from "./homeworld.ts";
import { originGround } from "./origin.ts";
import { BOUNDARY } from "./plates.ts";
import { isProvinceWorld } from "./provinces.ts";

/** The roads a works may be driven by, fuel first. */
export type CarrierRoad = "fuel" | "water" | "wind" | "heat" | "atom";

/** What a people's works ask of current, in watts a person: Earth's electricity a head when its first satellite flew
 * (1957: some 2,000 TWh in the year among 2.9 billion, about 80 W). */
export const WORKS_WATTS = 80;

/** The finest fit a people at the electron's works makes (mm, est: a turbine's): the share of Carnot it reaches. */
const BEST_FIT_MM = 0.002;
/** What Earth's known uranium gives as current, burned in reactors over a century (W): some six million tonnes at
 * about 40 GWh a tonne; Earth's crust's uranium (ppm) and the fissile share of it now. */
const EARTH_FISSION_W = 2.7e11,
  EARTH_URANIUM = 2.7,
  EARTH_FISSILE = 0.0072;

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
const CONTRAST = new Map<string, number>();

/**
 * How much warmer a world's tropics are than its poles (°C, on its finest grid): what drives its winds (Earth's some 40).
 * Pure; kept by world.
 */
export function windContrast(g: HomeWorld): number {
  const fine = isProvinceWorld(g) ? g.fine : g,
    key = `${keptKey(fine)} ${fine.grid.count}`,
    kept = CONTRAST.get(key);
  if (kept !== undefined) return kept;
  const f = fine.grid;
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
  const contrast = nWarm && nCold ? Math.max(0, warm / nWarm - cold / nCold) : 0;
  if (CONTRAST.size >= 64) CONTRAST.clear();
  CONTRAST.set(key, contrast);
  return contrast;
}

/** What a world's lands each carry (on a world of provinces, each province its fine cells'). Pure; kept by world. */
export function carriersOf(g: HomeWorld): Carriers {
  const bar =
      g.far?.planet.pressure ?? (isProvinceWorld(g) ? g.fine.far?.planet.pressure : undefined) ?? 1,
    key = `${keptKey(g)} ${g.grid.count} ${bar}`,
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
    t = fine.tectonics,
    hot = new Set(t.hotspots),
    n = meansNumbers(fine),
    o = originGround(fine),
    kelvin = Math.max(30, fine.planet.meanTemperature + 273.15);
  // (The winds: driven by how much warmer its tropics are than its poles, through its air's weight a cubic metre;
  // turbines stand on a share of its ground, as the account's dams take a share of what flows.)
  const windEach =
    windWm2(airKgM3(bar, n.airHolds, kelvin), windSpeedOf(windContrast(fine))) *
    WIND_GROUND *
    WIND_SPACING *
    DAMMED *
    TURBINE_SHARE;
  // (The ground's heat as a mine of it draws it, turned by a turbine's share of what Carnot allows at its well's warmth.)
  const groundEach = (rising: number) =>
    rising *
    GROUND_DRAWN *
    craftShare(BEST_FIT_MM) *
    carnot(groundHeatC(kelvin - 273.15, rising, false), kelvin);
  // (The atom: its crust's uranium by its heavy elements, the fissile share of it by its star's age; shared out over
  // its lands by their ground; none where its star's metals are too few for the account to let a land split it.)
  const share = fissileShare(starAgeGyr(fine.star)),
    uranium = EARTH_URANIUM * crustMultiplier(worldChemistry(fine), "Pb"),
    fission =
      share >= FISSILE_LEAST && n.metalShare >= FISSION_METALS
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
    if (head > 0)
      water[land]! +=
        riverKw(fine.water.discharge[c]!, head, fine.planet.radius, n.pull, n.seaKgM3) *
        1000 *
        DAMMED *
        TURBINE_SHARE;
    wind[land]! += windEach * area;
    const near = t.boundary[c] !== BOUNDARY.none || t.toBoundary[c]! <= 2,
      rising = GROUND_WM2 * o.heat * (hot.has(c) ? SPOT_HEAT : near ? EDGE_HEAT : 1);
    heat[land]! += groundEach(rising) * area;
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
