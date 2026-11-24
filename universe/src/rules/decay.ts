// How long a home stands once no one keeps it: what it is built of, against the weather of its land. A home is kept dry by
// its roof and stood up by its walls; left, the roof goes first and lets the rain in, and the walls go as their stuff gives
// way to water and frost. Timber and thatch rot within decades, mud brick melts back to earth in the rain without its
// yearly plaster, fired brick and stone stand longest; a wet land, and a cold one whose frost splits what the rain soaks,
// bring every one of them down sooner. (A home "falls" when no one could live in it again: a roofless shell is fallen.)
// Its roof is carried on timber, whatever it is covered with (tiles, thatch, turf, packed earth on beams), but for a roof of
// stone (a vault, a corbelled dome): untended, the rafters rot, and the roof comes in within decades, the walls standing or not.
import { dmath } from "../kernel/index.ts";
import { MATERIAL, type Material } from "./designs.ts";

/** Years an untended home of a stuff of lasting 0.35 (timber) stands in a dry, mild land, at the mean. */
const BASE_YEARS = 50;
/** How sharply lasting lengthens a stuff's years: (lasting / (1 - lasting)) to this. */
const LASTING_POWER = 0.6;
/** How much a metre of rain a year shortens a stuff's years, by stuff (earthen walls the most, stone the least). */
const WET: Partial<Record<Material, number>> = {
  mud: 2.5,
  earth: 2,
  sod: 1.2,
  reed: 1,
  hide: 1,
  kelp: 1,
  wood: 0.8,
  "fired clay": 0.3,
  stone: 0.15,
  coral: 0.3,
  shell: 0.3,
  ice: 0.5,
};
/** How much frost shortens it, by how porous the stuff is to the water that freezes in it. */
const POROUS: Partial<Record<Material, number>> = {
  mud: 1,
  earth: 1,
  sod: 0.5,
  "fired clay": 0.8,
  stone: 0.4,
  coral: 0.6,
  shell: 0.5,
  wood: 0.2,
  reed: 0.2,
};
/** What frost takes at the most (a land always frozen in its cold season). */
const FROST = 0.6;
/** What a roof is carried on, but for a roof of stone. */
const RAFTERS: Material = "wood";
/** How the years of homes alike spread about their mean: a Weibull of this shape (wear: few fall early, most about the mean). */
export const DECAY_SHAPE = 3;
/** Γ(1 + 1/shape): a Weibull's mean in its scale. */
const SHAPE_MEAN = 0.8929795;

/** The mean years an untended stuff stands in a land of this rain (mm a year) and warmth (°C, the year's mean). */
export function stuffYears(m: Material, rainMm: number, warmthC: number): number {
  const lasting = Math.min(0.97, Math.max(0.05, MATERIAL[m]?.lasting ?? 0.35)),
    dry = BASE_YEARS * dmath.pow(lasting / (1 - lasting) / (0.35 / 0.65), LASTING_POWER),
    wet = 1 + ((WET[m] ?? 0.3) * Math.max(0, rainMm)) / 1000,
    // (Frost from a mean of 5 °C down, whole at -10 °C.)
    frost = Math.min(1, Math.max(0, (5 - warmthC) / 15)),
    cold = 1 + FROST * frost * (POROUS[m] ?? 0.3);
  return dry / wet / cold;
}

/** The mean years an untended roof of a stuff stands: its covering's, or its rafters' where they go first. */
export function roofYears(roof: Material, rainMm: number, warmthC: number): number {
  const covering = stuffYears(roof, rainMm, warmthC);
  return roof === "stone" ? covering : Math.min(covering, stuffYears(RAFTERS, rainMm, warmthC));
}

/**
 * The mean years an untended home of these walls and roof stands in such a land: either falling brings it down, so the
 * two ways it goes add (as two wears, their rates summed).
 */
export function homeYears(
  walls: Material,
  roof: Material,
  rainMm: number,
  warmthC: number,
): number {
  return 1 / (1 / stuffYears(walls, rainMm, warmthC) + 1 / roofYears(roof, rainMm, warmthC));
}

/** The years one home of a mean of `mean` stands, from a uniform draw u in [0, 1). */
export function yearsDrawn(mean: number, u: number): number {
  return (mean / SHAPE_MEAN) * dmath.pow(-dmath.log1p(-u), 1 / DECAY_SHAPE);
}
