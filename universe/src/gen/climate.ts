// Climate (docs/architecture §24). Temperature comes from the planet's energy
// balance, spread over latitude by its tilt, cooled with height and made harsher
// far from the sea. Winds follow circulation bands whose number depends on how
// fast the planet turns (three per hemisphere for a 24-hour day). Moisture rises
// from warm seas, is carried downwind, and falls where air rises over mountains
// or converges; the result is annual rain. Biomes follow from warmth and rain.
import { dmath, type SphereGrid } from "../kernel/index.ts";
import type { Planet } from "./bodies.ts";

export const BIOME = {
  deepOcean: 0,
  ocean: 1,
  shelf: 2,
  seaIce: 3,
  ice: 4,
  tundra: 5,
  borealForest: 6,
  coldDesert: 7,
  steppe: 8,
  temperateForest: 9,
  temperateRainforest: 10,
  hotDesert: 11,
  savanna: 12,
  tropicalDryForest: 13,
  tropicalRainforest: 14,
  alpine: 15,
} as const;
export type Biome = (typeof BIOME)[keyof typeof BIOME];
export const BIOME_NAMES: readonly string[] = [
  "deep ocean",
  "ocean",
  "shallow sea",
  "sea ice",
  "ice",
  "tundra",
  "boreal forest",
  "cold desert",
  "steppe",
  "temperate forest",
  "temperate rainforest",
  "hot desert",
  "savanna",
  "tropical dry forest",
  "tropical rainforest",
  "alpine",
];

export type Climate = {
  /** Annual mean temperature, °C. */
  readonly temperature: Float32Array;
  /** Half the yearly swing, °C. */
  readonly seasonality: Float32Array;
  /** Annual precipitation, mm. */
  readonly precipitation: Float32Array;
  /** Steps from the sea (0 at sea). */
  readonly inland: Uint8Array;
  /** Circulation bands per hemisphere. */
  readonly bands: number;
  readonly biome: Uint8Array;
};

const ITERATIONS = 30;

export function makeClimate(grid: SphereGrid, planet: Planet, elevation: Float32Array): Climate {
  const n = grid.count,
    P = grid.positions,
    lat = grid.lat,
    ocean = (c: number) => elevation[c]! <= 0;
  const bands = Math.max(1, Math.min(5, Math.round(3 * Math.sqrt(24 / planet.dayHours))));

  // Steps inland from the sea.
  const inland = new Uint8Array(n).fill(255),
    queue: number[] = [];
  for (let c = 0; c < n; c++)
    if (ocean(c)) {
      inland[c] = 0;
      queue.push(c);
    }
  for (let h = 0; h < queue.length; h++) {
    const c = queue[h]!;
    for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++) {
      const m = grid.neighbours[k]!;
      if (inland[m] === 255) {
        inland[m] = Math.min(254, inland[c]! + 1);
        queue.push(m);
      }
    }
  }

  // Temperature: the global mean spread over latitude as Δ·(1/(2γ+1) − |sin φ|^2γ),
  // which keeps the mean; γ = 1.4 keeps the tropics warm and the mid-latitudes
  // steep, as on Earth (≈ 26 °C at the equator, 19 °C at 30°, 13 °C at 40°).
  const spread = 60 * (1 - (0.9 * planet.tilt) / 90),
    gamma = 1.4,
    meanShape = 1 / (2 * gamma + 1),
    swing = 0.35 + planet.tilt / 40;
  const temperature = new Float32Array(n),
    seasonality = new Float32Array(n);
  for (let c = 0; c < n; c++) {
    const s = dmath.sin(lat[c]!),
      shape = dmath.pow(s * s, gamma),
      far = Math.min(1, inland[c]! / 12);
    let t = planet.meanTemperature + spread * (meanShape - shape);
    if (!ocean(c)) t -= 6.5 * (elevation[c]! / 1000) + 3 * far * Math.abs(s);
    temperature[c] = t;
    seasonality[c] = swing * Math.abs(s) * (6 + 18 * far);
  }

  // Prevailing winds in each cell's tangent frame.
  const wind = new Float64Array(n * 3);
  for (let c = 0; c < n; c++) {
    const x = P[c * 3]!,
      y = P[c * 3 + 1]!,
      z = P[c * 3 + 2]!;
    // East = y-axis × p, north = p × east.
    let ex = z,
      ez = -x;
    const el = Math.sqrt(ex * ex + ez * ez) || 1;
    ex /= el;
    ez /= el;
    const nx = y * ez,
      ny = z * ex - x * ez,
      nz = -y * ex;
    const phi = lat[c]!,
      band = Math.min(bands - 1, Math.floor((Math.abs(phi) / (Math.PI / 2)) * bands)),
      toward = phi >= 0 ? -1 : 1,
      trade = band % 2 === 0;
    const east = trade ? -1 : 1,
      north = (trade ? 0.45 : -0.45) * toward;
    wind[c * 3] = east * ex + north * nx;
    wind[c * 3 + 1] = north * ny;
    wind[c * 3 + 2] = east * ez + north * nz;
  }

  // Where each cell's air goes: its neighbours, weighted by how far downwind they lie.
  const share = new Float64Array(grid.neighbours.length);
  for (let c = 0; c < n; c++) {
    let total = 0;
    for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++) {
      const m = grid.neighbours[k]!,
        dx = P[m * 3]! - P[c * 3]!,
        dy = P[m * 3 + 1]! - P[c * 3 + 1]!,
        dz = P[m * 3 + 2]! - P[c * 3 + 2]!,
        along = Math.max(0, dx * wind[c * 3]! + dy * wind[c * 3 + 1]! + dz * wind[c * 3 + 2]!);
      share[k] = along;
      total += along;
    }
    for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++)
      share[k] = total > 0 ? share[k]! / total : 0;
  }

  // Moisture: evaporated from warm water, carried downwind, rained out where the
  // bands converge or the ground rises.
  const evaporation = new Float64Array(n),
    propensity = new Float64Array(n);
  for (let c = 0; c < n; c++) {
    const warm = dmath.clamp((temperature[c]! + 8) / 38, 0, 1);
    // Plants return rain to the air: land recycles over half of what warm sea gives.
    evaporation[c] = ocean(c) ? warm : 0.55 * warm;
    const x = (Math.abs(lat[c]!) / (Math.PI / 2)) * bands,
      converge = (1 + dmath.cos(Math.PI * x)) / 2;
    propensity[c] = 0.015 + 0.6 * converge * converge * converge;
  }
  let moisture = Float64Array.from(evaporation);
  const rain = new Float64Array(n);
  for (let it = 0; it < ITERATIONS; it++) {
    const next = Float64Array.from(evaporation);
    for (let c = 0; c < n; c++) {
      const m0 = moisture[c]!;
      let fall = propensity[c]!,
        lift = 0;
      for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++)
        lift +=
          share[k]! * Math.max(0, elevation[grid.neighbours[k]!]! - Math.max(0, elevation[c]!));
      fall = Math.min(0.9, fall + lift / 2500);
      rain[c] = rain[c]! + m0 * fall;
      const carried = m0 * (1 - fall);
      for (let k = grid.offsets[c]!; k < grid.offsets[c + 1]!; k++) {
        const m = grid.neighbours[k]!;
        next[m] = next[m]! + carried * share[k]!;
      }
    }
    moisture = next;
  }
  // Scale so an Earth-like world averages about a metre of rain a year.
  let mean = 0;
  for (let c = 0; c < n; c++) mean += rain[c]! * grid.areas[c]!;
  mean /= 4 * Math.PI;
  const precipitation = new Float32Array(n);
  for (let c = 0; c < n; c++) precipitation[c] = mean > 0 ? (rain[c]! / mean) * 1000 : 0;

  const biome = new Uint8Array(n);
  for (let c = 0; c < n; c++)
    biome[c] = classify(elevation[c]!, temperature[c]!, precipitation[c]!);
  return { temperature, seasonality, precipitation, inland, bands, biome };
}

/** Whittaker-style biomes from height, warmth and rain. */
export function classify(elevation: number, t: number, p: number): Biome {
  if (elevation <= 0) {
    if (t < -2) return BIOME.seaIce;
    if (elevation > -200) return BIOME.shelf;
    return elevation < -4000 ? BIOME.deepOcean : BIOME.ocean;
  }
  if (t < -10) return BIOME.ice;
  if (elevation > 3200 && t < 2) return BIOME.alpine;
  if (t < 0) return BIOME.tundra;
  if (t < 6) return p > 400 ? BIOME.borealForest : p > 200 ? BIOME.tundra : BIOME.coldDesert;
  if (t < 20) {
    if (p < 250) return t < 12 ? BIOME.coldDesert : BIOME.hotDesert;
    if (p < 550) return BIOME.steppe;
    return p < 1800 ? BIOME.temperateForest : BIOME.temperateRainforest;
  }
  // The tropical thresholds are set to this model's rain, which runs about a third
  // lower than Earth's over equatorial land (a sharper moisture model is Phase 3's).
  if (p < 400) return BIOME.hotDesert;
  if (p < 1000) return BIOME.savanna;
  return p < 1420 ? BIOME.tropicalDryForest : BIOME.tropicalRainforest;
}
