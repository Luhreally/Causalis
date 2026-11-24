// Storms, monsoons and landslides (breadth round, 2026-11-23). Pure rules; sim/planet/storms.ts keeps the state.
//
// A great revolving storm is a heat engine on a warm sea: it needs the sea's surface past about 26.5 degrees of water (Gray
// 1968; here of the world's own liquid, its climate's degrees), and a spinning world's turning to set it whirling, which is
// nothing at the equator and grows away from it (the Coriolis term, 2Ω sin φ): none within five degrees of it, and the
// slower a world turns the fewer. It comes ashore on the coasts beside the seas that breed it, drowns their fields with its surge
// and its rain, and kills.
//
// A monsoon is a sea breeze a season long: land heats and cools faster than the sea, so where a broad land lies beside a warm sea
// in the low latitudes, its summer draws the sea's wet air in and its winter drives it out. A land so watered gets its year's rain
// in one season, and the season fails some years: its rain swings the more from year to year.
//
// A slope fails when its soil is soaked past what its grain and roots hold: the steeper the slope and the wetter the year the
// likelier, the less so where woods still bind it. Estimates are marked "est".
import { dmath } from "../kernel/index.ts";

export const CYCLONE = {
  /** The sea's warmth (degrees of its liquid) past which a great storm can draw its strength (Gray 1968: 26.5 for water). */
  warmSea: 26.5,
  /** A storm of the most strength needs the sea this much warmer still (est). */
  warmSpan: 3,
  /** Latitudes (degrees) a storm can spin up in: none within five of the equator, few past thirty. */
  latFrom: 5,
  latTo: 32,
  /** A coastal land beside a sea at full strength is struck this often a year (est: a 100-km coast of the Gulf of Mexico some
   * once in 12 years). */
  yearly: 0.08,
  /** Of its people, the share it kills at its usual greatness (est: most flee or shelter; a land here is a whole coast and its
   * hinterland, and the sea comes in on its low shore only), and the most. Measured on first light from 1500 to 1800 (lands of
   * some forty million): at 0.0003 its great storms' dead had a median of 40,000 and the worst 385,000; now some 13,000 and the
   * worst near 230,000, as Bengal's (1737, 1876, 1970: 300,000 to 500,000 of a far more crowded shore) and most far fewer. */
  dead: 0.0001,
  deadMost: 0.003,
  /** Of its harvest, the share it drowns and flattens at its usual greatness (est), and the most; of its stores, the share wetted. */
  fields: 0.2,
  fieldsMost: 0.7,
  stores: 0.08,
  /** How far past its usual a storm may run: 1 + this × an exponential draw (est). */
  spread: 0.7,
} as const;

/** How strongly a world's turning sets a storm whirling at a latitude (1: Earth's at 20 degrees). */
export function cycloneSpin(latDeg: number, dayHours: number): number {
  const at = Math.abs(latDeg);
  if (at < CYCLONE.latFrom || at > CYCLONE.latTo + 8) return 0;
  const fade = at > CYCLONE.latTo ? 1 - (at - CYCLONE.latTo) / 8 : 1;
  return (
    (dmath.sin((at * Math.PI) / 180) / dmath.sin((20 * Math.PI) / 180)) *
    (24 / Math.max(1, dayHours)) *
    fade
  );
}

/** A coastal land's chance a year of a great storm ashore: its warmest neighbouring sea's warmth and its world's spin there. */
export function cycloneChance(seaWarmth: number, spin: number): number {
  const heat = dmath.clamp((seaWarmth - CYCLONE.warmSea) / CYCLONE.warmSpan, 0, 1);
  return dmath.clamp(CYCLONE.yearly * heat * Math.min(1.5, spin), 0, 0.5);
}

/** A storm's greatness (1: its usual) from a uniform draw. */
export function cycloneSize(u: number): number {
  return 1 + CYCLONE.spread * -dmath.log(Math.max(1e-9, u));
}

/** What a storm of a greatness does ashore: the harvest drowned, the people killed, the stores wetted. */
export function cycloneHarm(size: number): { fields: number; dead: number; stores: number } {
  return {
    fields: Math.min(CYCLONE.fieldsMost, CYCLONE.fields * size),
    dead: Math.min(CYCLONE.deadMost, CYCLONE.dead * size * size),
    stores: Math.min(0.5, CYCLONE.stores * size),
  };
}

export const MONSOON = {
  /** Half a land's yearly swing of warmth (degrees) under which it draws no monsoon, and over which it draws a full one. */
  swingFrom: 2,
  swingSpan: 5,
  /** The latitudes it reaches (degrees): it fades to none by here. */
  latTo: 35,
  /** Steps inland it reaches: it fades to none by here. */
  inland: 20,
  /** How much more a full monsoon's rain swings from year to year (a share of a land's usual swing, est: India's 1 in 5 or 6 years
   * deficient against a temperate land's 1 in 10). */
  swings: 0.4,
} as const;

/** A land's monsoon (0 … 1): its seasons' swing, its latitude, how near it lies to the sea. */
export function monsoonOf(swing: number, latDeg: number, inland: number): number {
  return (
    dmath.clamp((swing - MONSOON.swingFrom) / MONSOON.swingSpan, 0, 1) *
    dmath.clamp(1 - Math.abs(latDeg) / MONSOON.latTo, 0, 1) *
    dmath.clamp(1 - inland / MONSOON.inland, 0, 1)
  );
}

export const SLIDE = {
  /** Slopes (rise over run) gentler than this do not fail (est: a land's mean steepest step; a tenth of first light's lands are steeper). */
  steep: 0.006,
  /** A slope twice that steep, its rain usual and its woods gone, fails this often a year (est). */
  yearly: 0.02,
  /** How much faster the chance rises than the year's rain (its power: soaked ground). */
  rainPower: 3,
  /** The share of the chance its woods' roots take away, wholly wooded. */
  woods: 0.6,
  /** Of its people, the share a slide kills at its usual greatness, the most (est: a slide falls on a valley, not a land: some three
   * in a hundred thousand; the worst a rain has brought down, Vargas in 1999, killed ten to thirty thousand); of its harvest, the
   * share it buries. At 0.0001 first light's slides from 1500 had a median of 8,300 dead and the worst 114,000. */
  dead: 0.00003,
  deadMost: 0.0005,
  fields: 0.04,
  fieldsMost: 0.25,
} as const;

/** A land's chance a year of its slopes failing: its steepness, its year's rain against its usual, its woods left (0 … 1). */
export function slideChance(slope: number, rain: number, forest: number): number {
  const steep = dmath.clamp((slope - SLIDE.steep) / SLIDE.steep, 0, 2);
  if (!(steep > 0)) return 0;
  return dmath.clamp(
    SLIDE.yearly *
      steep *
      dmath.pow(Math.max(0.05, rain), SLIDE.rainPower) *
      (1 - SLIDE.woods * dmath.clamp(forest, 0, 1)),
    0,
    0.3,
  );
}

/** What a slide of a greatness does (its greatness 1 + an exponential draw's half). */
export function slideHarm(size: number): { fields: number; dead: number } {
  return {
    fields: Math.min(SLIDE.fieldsMost, SLIDE.fields * size),
    dead: Math.min(SLIDE.deadMost, SLIDE.dead * size * size),
  };
}
