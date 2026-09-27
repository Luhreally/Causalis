// How a region looks, as data: tile colours for a lens and heights for the
// terrain mesh. Pure, like every view builder.
import type { FrameMessage } from "../bridge/index.ts";
import { biomeColor } from "./globe.ts";
import type { Rgb } from "./sandbox.ts";

export const REGION_LENSES = ["land", "height", "soil"] as const;
export type RegionLens = (typeof REGION_LENSES)[number];
export const REGION_LENS_NAMES: Readonly<Record<RegionLens, string>> = {
  land: "Land",
  height: "Height",
  soil: "Soil",
};

/**
 * Vertical exaggeration of the region's terrain (heights in km × this): enough that hills
 * and ranges stand up as facets under the light (the low-poly look), not a flat map.
 */
export const REGION_RELIEF = 9;

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
    if (water === 1) c = [0.05, 0.3, 0.66];
    else if (water === 2) c = [0.14, 0.5, 0.88];
    else if (water === 3) c = [0.1, 0.44, 0.8];
    else if (lens === "land") c = biomeColor(a.biome![t]!);
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

/** A tree of a region's woods: the tile it stands on, its offset within it, its kind. */
export type RegionTree = {
  readonly tile: number;
  /** Where in the tile, -0.5..0.5 across and along. */
  readonly dx: number;
  readonly dz: number;
  readonly kind: "conifer" | "broadleaf";
  readonly size: number;
};

/** How wooded each land is (gen's BIOME codes): the chance a tile bears a tree, and its kind. */
const WOODED: Readonly<Record<number, readonly [number, "conifer" | "broadleaf"]>> = {
  5: [0.04, "conifer"],
  6: [0.55, "conifer"],
  8: [0.04, "broadleaf"],
  9: [0.45, "broadleaf"],
  10: [0.6, "conifer"],
  12: [0.07, "broadleaf"],
  13: [0.35, "broadleaf"],
  14: [0.7, "broadleaf"],
  15: [0.12, "conifer"],
};

/**
 * The woods of a region (art track A3): on each land tile, by the chance its biome is
 * wooded, a tree somewhere in it — pines in the north and the hills, round crowns
 * elsewhere. At most `cap` of them. A pure function of the frame (the same region, the
 * same woods); the look alone, not the world.
 */
export function regionTrees(frame: FrameMessage, cap = 4000): RegionTree[] {
  const a = frame.arrays,
    biome = a.biome!,
    water = a.water!,
    key = (frame.meta as { ref?: string }).ref ?? "",
    out: RegionTree[] = [];
  let seed = 2166136261;
  for (let i = 0; i < key.length; i++) seed = Math.imul(seed ^ key.charCodeAt(i), 16777619);
  const unit = (t: number, n: number) => {
    let h =
      Math.imul((seed ^ Math.imul(t + 1, 0x9e3779b1)) >>> 0, 0x85ebca6b) ^
      Math.imul(n + 1, 0xc2b2ae35);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
    return (h >>> 0) / 4294967296;
  };
  // As many as the woods would hold, thinned alike everywhere to the cap (not the first
  // rows filled and the rest bare).
  let expected = 0;
  for (let t = 0; t < biome.length; t++) if (!water[t]) expected += WOODED[biome[t]!]?.[0] ?? 0;
  const thin = Math.min(1, cap / Math.max(1, expected));
  for (let t = 0; t < biome.length && out.length < cap; t++) {
    if (water[t]) continue;
    const wood = WOODED[biome[t]!];
    if (!wood || unit(t, 0) >= wood[0] * thin) continue;
    out.push({
      tile: t,
      dx: unit(t, 1) - 0.5,
      dz: unit(t, 2) - 0.5,
      kind: wood[1],
      size: 0.8 + 0.5 * unit(t, 3),
    });
  }
  return out;
}
