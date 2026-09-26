// How a planet looks, as data (docs/architecture §28, §31 lenses): the globe
// frame's fields coloured by a lens. Pure — a lens switch needs no round trip to
// the host, and the same frame always gives the same colours.
import type { FrameMessage } from "../bridge/index.ts";
import type { Rgb } from "./sandbox.ts";

export const LENSES = [
  "terrain",
  "people",
  "food",
  "tongues",
  "height",
  "temperature",
  "rain",
  "plates",
  "resources",
] as const;
export type Lens = (typeof LENSES)[number];

export const LENS_NAMES: Readonly<Record<Lens, string>> = {
  terrain: "Land",
  people: "People",
  food: "Food",
  tongues: "Tongues",
  height: "Height",
  temperature: "Warmth",
  rain: "Rain",
  plates: "Plates",
  resources: "Ores",
};

// Biome colours, in the order of gen's BIOME codes.
const BIOME_COLORS: readonly Rgb[] = [
  [0.07, 0.17, 0.35],
  [0.1, 0.25, 0.47],
  [0.2, 0.44, 0.62],
  [0.84, 0.9, 0.95],
  [0.94, 0.95, 0.97],
  [0.6, 0.62, 0.53],
  [0.22, 0.36, 0.27],
  [0.7, 0.66, 0.56],
  [0.7, 0.67, 0.42],
  [0.28, 0.47, 0.24],
  [0.16, 0.4, 0.26],
  [0.86, 0.76, 0.52],
  [0.72, 0.65, 0.35],
  [0.43, 0.52, 0.24],
  [0.12, 0.38, 0.15],
  [0.6, 0.58, 0.56],
];

export const DEPOSIT_COLORS: readonly Rgb[] = [
  [0.85, 0.45, 0.2],
  [0.98, 0.82, 0.2],
  [0.75, 0.75, 0.8],
  [0.7, 0.25, 0.2],
  [0.15, 0.15, 0.15],
  [0.5, 0.2, 0.6],
  [0.95, 0.95, 0.95],
];

type Stop = readonly [number, Rgb];

function ramp(stops: readonly Stop[], v: number): Rgb {
  if (v <= stops[0]![0]) return stops[0]![1];
  for (let i = 1; i < stops.length; i++) {
    const [x1, c1] = stops[i]!,
      [x0, c0] = stops[i - 1]!;
    if (v <= x1) {
      const t = (v - x0) / (x1 - x0);
      return [
        c0[0] + (c1[0] - c0[0]) * t,
        c0[1] + (c1[1] - c0[1]) * t,
        c0[2] + (c1[2] - c0[2]) * t,
      ];
    }
  }
  return stops[stops.length - 1]![1];
}

const DEPTH: readonly Stop[] = [
  [-9000, [0.03, 0.08, 0.2]],
  [-4000, [0.07, 0.17, 0.36]],
  [-1000, [0.12, 0.3, 0.52]],
  [0, [0.25, 0.5, 0.68]],
];
const HEIGHT: readonly Stop[] = [
  [0, [0.3, 0.55, 0.3]],
  [500, [0.55, 0.65, 0.35]],
  [1500, [0.72, 0.62, 0.38]],
  [3000, [0.55, 0.45, 0.38]],
  [5000, [0.92, 0.92, 0.94]],
];
const WARMTH: readonly Stop[] = [
  [-40, [0.2, 0.25, 0.7]],
  [-10, [0.55, 0.75, 0.95]],
  [0, [0.93, 0.95, 0.97]],
  [15, [0.98, 0.85, 0.45]],
  [30, [0.85, 0.25, 0.15]],
];
const RAIN: readonly Stop[] = [
  [0, [0.66, 0.5, 0.3]],
  [300, [0.86, 0.76, 0.46]],
  [800, [0.45, 0.66, 0.3]],
  [1600, [0.15, 0.5, 0.35]],
  [3000, [0.12, 0.3, 0.7]],
];

function hue(h: number, s: number, v: number): Rgb {
  const i = Math.floor(h * 6),
    f = h * 6 - i,
    p = v * (1 - s),
    q = v * (1 - f * s),
    t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      return [v, t, p];
    case 1:
      return [q, v, p];
    case 2:
      return [p, v, t];
    case 3:
      return [p, q, v];
    case 4:
      return [t, p, v];
    default:
      return [v, p, q];
  }
}

const PEOPLE: readonly Stop[] = [
  [0, [0.95, 0.8, 0.45]],
  [0.5, [0.95, 0.55, 0.25]],
  [2, [0.85, 0.25, 0.2]],
  [8, [0.55, 0.1, 0.25]],
];

// What food costs against its usual worth: cheap is green, dear is red.
const FOOD: readonly Stop[] = [
  [0.4, [0.3, 0.72, 0.4]],
  [1, [0.95, 0.85, 0.4]],
  [1.6, [0.92, 0.45, 0.22]],
  [2.5, [0.75, 0.12, 0.18]],
];

/** A biome's colour on the land lens. */
export function biomeColor(biome: number): Rgb {
  return BIOME_COLORS[biome] ?? [0.5, 0.6, 0.35];
}

/**
 * Per-cell RGBA (0–255) for a globe frame under a lens. `values` feeds the lenses
 * that show the people: for "people", people per 100 km²; for "food", what food
 * costs against its usual worth.
 */
export function globeColors(
  frame: FrameMessage,
  lens: Lens,
  values?: ReadonlyMap<number, number>,
  colors?: ReadonlyMap<number, Rgb>,
): Uint8Array {
  const a = frame.arrays,
    elevation = a.elevation!,
    n = elevation.length,
    out = new Uint8Array(n * 4),
    meta = frame.meta as { plates: { continental: boolean }[] };
  for (let c = 0; c < n; c++) {
    const e = elevation[c]!,
      sea = e <= 0,
      biome = a.biome![c]!;
    let col: Rgb;
    switch (lens) {
      case "terrain":
        col = BIOME_COLORS[biome] ?? [1, 0, 1];
        if (!sea) {
          const lift = Math.min(1, e / 4000) * 0.25;
          col = [
            col[0] + (1 - col[0]) * lift,
            col[1] + (1 - col[1]) * lift,
            col[2] + (1 - col[2]) * lift,
          ];
          if (a.lake![c]) col = [0.2, 0.42, 0.62];
          else if (a.river![c])
            col = [col[0] * 0.55 + 0.1, col[1] * 0.55 + 0.2, col[2] * 0.55 + 0.33];
        } else if (biome !== 3) col = ramp(DEPTH, e);
        break;
      case "height":
        col = sea ? ramp(DEPTH, e) : ramp(HEIGHT, e);
        break;
      case "temperature":
        col = ramp(WARMTH, a.temperature![c]!);
        if (sea) col = [col[0] * 0.8, col[1] * 0.8, col[2] * 0.85];
        break;
      case "rain":
        col = sea ? [0.18, 0.22, 0.3] : ramp(RAIN, a.precipitation![c]!);
        break;
      case "plates": {
        const p = a.plate![c]!,
          continental = meta.plates[p]?.continental ?? false;
        col = hue((p * 0.61803398875) % 1, continental ? 0.45 : 0.7, sea ? 0.55 : 0.9);
        break;
      }
      case "tongues": {
        const tongue = colors?.get(c);
        if (tongue) col = tongue;
        else {
          const base = sea ? ramp(DEPTH, e) : BIOME_COLORS[biome]!,
            grey = (base[0] + base[1] + base[2]) / 3;
          col = sea
            ? [base[0] * 0.7, base[1] * 0.7, base[2] * 0.75]
            : [grey * 0.65, grey * 0.65, grey * 0.6];
        }
        break;
      }
      case "people":
      case "food": {
        const v = values?.get(c);
        if (v !== undefined && v > 0) col = ramp(lens === "people" ? PEOPLE : FOOD, v);
        else {
          const base = sea ? ramp(DEPTH, e) : BIOME_COLORS[biome]!,
            grey = (base[0] + base[1] + base[2]) / 3;
          col = sea
            ? [base[0] * 0.7, base[1] * 0.7, base[2] * 0.75]
            : [grey * 0.65, grey * 0.65, grey * 0.6];
        }
        break;
      }
      case "resources": {
        const k = a.deposit![c]!;
        if (k !== 255) col = DEPOSIT_COLORS[k] ?? [1, 0, 1];
        else {
          const base = sea ? ramp(DEPTH, e) : BIOME_COLORS[biome]!,
            grey = (base[0] + base[1] + base[2]) / 3;
          col = [grey * 0.6, grey * 0.6, grey * 0.65];
        }
        break;
      }
    }
    out[c * 4] = Math.round(Math.max(0, Math.min(1, col[0])) * 255);
    out[c * 4 + 1] = Math.round(Math.max(0, Math.min(1, col[1])) * 255);
    out[c * 4 + 2] = Math.round(Math.max(0, Math.min(1, col[2])) * 255);
    out[c * 4 + 3] = 255;
  }
  return out;
}

/**
 * How far a cell stands out from the sphere, for relief on the globe (radius 1):
 * the true height over a planet's radius, exaggerated so mountains can be seen
 * (at 25×, an 8 km peak stands 3% proud).
 */
export function globeRadius(
  elevation: number,
  exaggeration = 25,
  planetRadiusM = 6_371_000,
): number {
  return elevation <= 0 ? 1 : 1 + (exaggeration * elevation) / planetRadiusM;
}
