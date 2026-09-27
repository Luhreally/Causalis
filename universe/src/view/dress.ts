// What people wear (moved out of the village's renderer for the pages' portraits, Phase 10
// M93b): each group's colours by its land's era, their bare skin and their eyes — one
// palette for the figures in a village and the figure on a person's page.
import type { VillagePlan } from "../bridge/index.ts";

type Rgb = readonly [number, number, number];

export const GROUP_COLORS: readonly Rgb[] = [
  [0.85, 0.35, 0.2],
  [0.2, 0.45, 0.95],
  [0.95, 0.78, 0.15],
  [0.95, 0.55, 0.75],
];
/** Bare skin, arms and faces (the upright apes'). */
export const SKIN: Rgb = [0.88, 0.66, 0.5];

/**
 * What a figure wears, by its land's era, for each group (workers of the land, makers
 * and carriers, leaders, the young): body and legs. Gatherers in hides; farmers in
 * undyed wool and linen, the leaders' a little brighter; the smiths' people in dyed
 * cloth; the engines' in dark coats with a colour at the chest; the modern world in the
 * bright colours of its day.
 */
export function clothes(era: VillagePlan["era"], group: number): { body: Rgb; legs: Rgb } {
  const bright = GROUP_COLORS[group]!,
    dim = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k],
    mix = (a: Rgb, b: Rgb, k: number): Rgb => [
      a[0] + (b[0] - a[0]) * k,
      a[1] + (b[1] - a[1]) * k,
      a[2] + (b[2] - a[2]) * k,
    ];
  switch (era) {
    case "forage":
      return { body: mix([0.55, 0.38, 0.22], bright, 0.12), legs: [0.45, 0.3, 0.18] };
    case "metal":
      return { body: bright, legs: dim(bright, 0.55) };
    case "industry":
      return { body: mix([0.2, 0.22, 0.3], bright, 0.35), legs: [0.16, 0.16, 0.2] };
    case "modern":
      return { body: mix(bright, [1, 1, 1], 0.1), legs: [0.22, 0.32, 0.62] };
    default:
      return { body: mix([0.86, 0.8, 0.66], bright, 0.3), legs: [0.52, 0.44, 0.34] };
  }
}
/** Eyes. */
export const EYES: Rgb = [0.07, 0.06, 0.06];
