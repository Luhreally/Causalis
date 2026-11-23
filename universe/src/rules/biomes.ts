// What a land grows, from its forces (breadth round, 2026-11-23): its growth from its warmth, its rain and its sky's light
// (Lieth's Miami model, 1975: a year's net growth as the lesser of what its warmth and its rain allow, of some 3 kg a square
// metre at the most), what its rock gives the roots, and how that growth stands: as woods where its rain is more than its
// warmth and light draw off (Thornthwaite's demand), as grass and herbs where it is less, as nothing much where neither
// suffices. What foragers, farmers and herds take of a land follows from that: game and gathered food from all its growth, the
// grass's the most; fields where a grass grows tall on deep soil its rain has not leached and the year is warm enough to ripen
// it; flocks on whatever is open. Nothing here is Earth's alone: a world's warmth is in its liquid's degrees, its light is its
// own star's at its own orbit, and life fits its pigment to its sky, so a dim sky gives less but not nothing.
//
// The numbers at the foot (FORM) were fitted to first light's own lands against the tables they replace, so an Earth's lands
// give what they gave on the whole, now varying with their own warmth, rain and seasons within each biome.
import { dmath } from "../kernel/index.ts";

/** A land's growth through the year: the share of the most a land grows its warmth, its rain and its sky allow (0 … 1). */
export type Cover = {
  /** Net growth, a share of the most a land gives (some 3 kg of dry matter a square metre a year). */
  readonly growth: number;
  /** Its rain against what its warmth and light would draw off (Thornthwaite's moisture index; 1: even). */
  readonly moist: number;
  /** The share of its growth that stands in wood (trees where its rain exceeds its demand and its summers are warm enough). */
  readonly woody: number;
  /** The share that is open: grass, herbs, shrub and lichen. */
  readonly open: number;
};

/** The Miami model's warmth term (Lieth 1975): growth by mean warmth (degrees of the world's liquid). */
export function warmGrowth(t: number): number {
  return 1 / (1 + dmath.exp(1.315 - 0.119 * t));
}
/** The Miami model's rain term: growth by a year's rain (mm). */
export function wetGrowth(p: number): number {
  return 1 - dmath.exp(-0.000664 * Math.max(0, p));
}

/**
 * What a sky's light gives growth against Earth's (1 under Earth's sun): a leaf's light saturates, and life fits its pigment to
 * its sky (rules/biochem.ts pigmentOf), so it saturates at a share of its own light. Under a hundredth of Earth's light a third
 * as much grows; under four times it, a tenth more.
 */
export function lightGrowth(light: number): number {
  const l = Math.max(1e-4, light),
    half = 0.3 * Math.sqrt(l);
  return (l / (l + half)) * 1.3;
}

/** What a land's demand for water is against Earth's at the same warmth: more under a brighter sky (by its root). */
export function demandOf(light: number): number {
  return Math.sqrt(Math.max(1e-4, light));
}

/** What its rock gives its roots against Earth's: phosphorus and potash in its crust (rules/crust.ts multipliers). */
export function rockGrowth(phosphorus: number, potash: number): number {
  return Math.sqrt(Math.sqrt(Math.max(0.05, phosphorus) * Math.max(0.05, potash)));
}

/**
 * The water a year's warmth draws off a land (mm; Thornthwaite, simplified to this world model's rain): 200 at its liquid's
 * freezing and 35 more a degree, by its sky's demand.
 */
export function demandMm(t: number, demand = 1): number {
  return (FORM.demand0 + FORM.demandPerDegree * Math.max(0, t)) * demand;
}

/** The share of a land's year above the warmth its growth starts at (its mean and half its swing; rules/seasons.ts shareAbove). */
export function growingShare(mean: number, swing: number): number {
  const x = mean - FORM.grows;
  if (swing <= 1e-9) return x > 0 ? 1 : 0;
  const r = x / swing;
  return r >= 1 ? 1 : r <= -1 ? 0 : 1 - dmath.acos(r) / Math.PI;
}

/**
 * A land's cover: its growth (the lesser of its warmth's and its rain's, over the share of its year it grows in, times its light
 * and rock), and how it stands. Trees need rain past their demand and a mean above about its liquid's freezing (the boreal
 * edge); grass needs a third of it; below that it is shrub, lichen and bare ground.
 */
export function coverOf(t: number, p: number, swing: number, light = 1, rock = 1): Cover {
  const demand = demandOf(light),
    moist = p / demandMm(t, demand),
    season = dmath.pow(growingShare(t, swing), FORM.season),
    growth = Math.min(warmGrowth(t), wetGrowth(p / demand)) * season * lightGrowth(light) * rock,
    woody =
      dmath.clamp((moist - FORM.woods) / FORM.woodsSpan, 0, 1) * dmath.clamp((t + 1) / 5, 0, 1),
    open = (1 - woody) * dmath.clamp((moist - FORM.grass) / FORM.grassSpan, 0, 1);
  return { growth, moist, woody, open };
}

/** What a square kilometre gives a year, in the old tables' units: foragers' food, farmland's share fit to sow, pasture. */
export type LandUse = {
  readonly forage: number;
  readonly arable: number;
  readonly pasture: number;
};

/**
 * What a land's cover gives its people: game and gathered food by its growth, the open lands' grazers by a gentler power of it
 * than the woods' fruit and nut (a grazer eats the grass, a forager only the mast); fields where its warmth ripens a grass and its
 * rain waters it, less where trees must first be cleared; pasture by what is open.
 */
export function landUseOf(c: Cover, t: number): LandUse {
  const g = Math.max(0, c.growth),
    forage =
      FORM.forage *
      (FORM.mast * c.woody * dmath.pow(g, FORM.mastPower) +
        FORM.game * c.open * dmath.pow(g, FORM.gamePower) +
        0.15 * g),
    ripens = dmath.clamp((t - 1) / 7, 0, 1),
    watered = dmath.clamp((c.moist - FORM.grass) / FORM.watered, 0, 1),
    arable =
      FORM.arable *
      dmath.pow(g, FORM.arablePower) *
      ripens *
      watered *
      (1 - FORM.clearing * c.woody),
    pasture =
      FORM.pasture * (c.open + FORM.browse * (1 - c.woody)) * dmath.pow(g, FORM.pasturePower);
  return { forage, arable: Math.min(0.6, arable), pasture };
}

/**
 * The fitted numbers (first light's 11,452 fine lands, 2026-11-23, against the tables they replace: tools in
 * scratchpad/planet133/fitter.mjs). The whole world's forage, arable and pasture within 1.2% of the tables; by biome, forage
 * within a fifth of its table but the cold desert's, arable but the steppe's (0.32 against 0.45) and the forests' (0.25 against
 * 0.35), pasture within a fifth but the temperate rainforest's (none against 0.1).
 */
export const FORM = {
  demand0: 200,
  demandPerDegree: 35,
  grows: 1.685,
  season: 1.508,
  woods: 1.014,
  woodsSpan: 0.423,
  grass: 0.283,
  grassSpan: 0.195,
  forage: 0.752,
  mast: 0.614,
  mastPower: 1.214,
  game: 0.942,
  gamePower: 0.753,
  arable: 0.458,
  arablePower: 0.07,
  watered: 0.272,
  clearing: 0.558,
  pasture: 0.54,
  browse: 0.155,
  pasturePower: 0.065,
} as const;
