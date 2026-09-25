// How a region looks, as data: tile colours for a lens and heights for the
// terrain mesh. Pure, like every view builder.
import type { FrameMessage } from "../bridge/index.ts";
import type { Rgb } from "./sandbox.ts";

export const REGION_LENSES = ["land", "height", "soil"] as const;
export type RegionLens = (typeof REGION_LENSES)[number];
export const REGION_LENS_NAMES: Readonly<Record<RegionLens, string>> = {
  land: "Land",
  height: "Height",
  soil: "Soil",
};

const BIOME: readonly Rgb[] = [
  [0.07, 0.17, 0.35],
  [0.1, 0.25, 0.47],
  [0.2, 0.44, 0.62],
  [0.84, 0.9, 0.95],
  [0.94, 0.95, 0.97],
  [0.6, 0.62, 0.53],
  [0.22, 0.36, 0.27],
  [0.7, 0.66, 0.56],
  [0.7, 0.67, 0.42],
  [0.3, 0.49, 0.25],
  [0.16, 0.4, 0.26],
  [0.86, 0.76, 0.52],
  [0.72, 0.65, 0.35],
  [0.43, 0.52, 0.24],
  [0.14, 0.4, 0.17],
  [0.6, 0.58, 0.56],
];

/** Vertical exaggeration of the region's terrain (heights in km × this). */
export const REGION_RELIEF = 4;

export function regionHeights(frame: FrameMessage): Float32Array {
  const e = frame.arrays.elevation!,
    out = new Float32Array(e.length);
  for (let t = 0; t < e.length; t++) out[t] = (Math.max(e[t]!, -60) / 1000) * REGION_RELIEF;
  return out;
}

export function regionColors(frame: FrameMessage, lens: RegionLens): Uint8Array {
  const a = frame.arrays,
    e = a.elevation!,
    n = e.length,
    out = new Uint8Array(n * 4);
  let lo = Infinity,
    hi = -Infinity;
  for (let t = 0; t < n; t++)
    if (e[t]! > 0) {
      lo = Math.min(lo, e[t]!);
      hi = Math.max(hi, e[t]!);
    }
  for (let t = 0; t < n; t++) {
    const water = a.water![t]!;
    let c: Rgb;
    if (water === 1) c = [0.14, 0.33, 0.52];
    else if (water === 2) c = [0.22, 0.45, 0.72];
    else if (water === 3) c = [0.2, 0.42, 0.64];
    else if (lens === "land") c = BIOME[a.biome![t]!] ?? [1, 0, 1];
    else if (lens === "height") {
      const k = hi > lo ? (e[t]! - lo) / (hi - lo) : 0;
      c = [0.25 + 0.6 * k, 0.45 + 0.35 * k, 0.25 + 0.55 * k];
    } else {
      const f = a.fertility![t]! / 255;
      c = [0.55 - 0.35 * f, 0.45 + 0.25 * f, 0.28 - 0.1 * f];
    }
    out[t * 4] = Math.round(c[0] * 255);
    out[t * 4 + 1] = Math.round(c[1] * 255);
    out[t * 4 + 2] = Math.round(c[2] * 255);
    out[t * 4 + 3] = 255;
  }
  return out;
}
