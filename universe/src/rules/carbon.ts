// The carbon a world's air rests at, and where what is put in it goes (breadth round, 2026-11-23). Rain wears its rock, and the
// worn rock carries carbon down to its seas' floors as stone; its fire below breathes carbon back out. The air rests where the two
// balance (Walker, Hays and Kasting 1981): a world with little land, a cold or a dry one weathers slowly and rests with more carbon
// in its air; a warm, wet, broad-landed one with less. What its peoples burn is taken up by its seas within decades, but not all:
// a share stays until the rock takes it, over thousands of years (Archer 2009), and the seas that took it grow sour (their
// shell-builders build the worse). Its frozen ground holds the carbon of ten thousand summers' growth that never rotted; a
// warming that thaws it lets it rot, and that carbon goes into the air too. Only a liquid that dissolves rock as water does
// carries carbon down as stone: on a world of another liquid its air rests where it was made, and nothing weathers it away.
import { dmath } from "../kernel/index.ts";

/** The numbers (est.: an Earth as this world-model makes it is first light's, its land 0.29 of its face, 16.5 degrees, 930 mm). */
export const CARBON_CYCLE = {
  /** Carbon an Earth's air rests at (ppm), and the Earth whose rock weathers it there. */
  rest: 280,
  land: 0.29,
  warmth: 16.5,
  rain: 930,
  /** Degrees over which weathering grows by e (Berner); weathering's power of rain; its power of carbon, the warmth's own taken in. */
  efold: 13.7,
  rainPower: 0.65,
  carbonPower: 0.5,
  /** The least and most a world's air rests at against an Earth's. */
  restBounds: [0.5, 10] as const,
  /** The share of what is put in that stays once the seas have taken their part, and how it rises the more is put in. */
  tail: 0.22,
  tailRise: 0.1,
  /** Years an Earth's rock takes to wear the rest away (by e: the seas' floors' chalk dissolving, then the rock's weathering). */
  wearYears: 8000,
  /** How far its seas' acidity rises for each doubling of its air's carbon (pH; est. 0.3), and from what the shells suffer. */
  sourPerDoubling: 0.3,
  sourFrom: 0.1,
  sourSpan: 0.4,
  /** The share of a sea's food that is shell and reef, and the most of it a soured sea loses. */
  reef: 0.35,
  shellsLost: 0.5,
  /** Frozen ground: colder than this its ground stays frozen through the year, warmer than this it is unfrozen (degrees). */
  frozen: -2,
  frozenCold: -15,
  /** How much faster its high latitudes warm than the world (polar amplification). */
  polar: 2,
  /** The carbon a square kilometre of frozen ground holds within reach of a thaw (ppm of an Earth's air; est. 15 a million km²). */
  frozenPpmKm2: 1.5e-5,
  /** The share of thawed carbon that rots and goes into the air in a year. */
  rots: 0.005,
} as const;

export type CarbonWorld = {
  /** Its land's share of its face, its land's mean warmth (its liquid's degrees) and rain (mm). */
  readonly land: number;
  readonly warmth: number;
  readonly rain: number;
  /** What its fire below breathes out against Earth's (by its plates and its age). */
  readonly outgas: number;
  /** Whether its liquid weathers rock to stone (water). */
  readonly weathers: boolean;
};

/** How fast a world's rock weathers against an Earth's at the same carbon (its land, warmth and rain). */
export function weathering(w: CarbonWorld): number {
  const C = CARBON_CYCLE;
  return (
    (Math.max(0.005, w.land) / C.land) *
    dmath.exp((w.warmth - C.warmth) / C.efold) *
    dmath.pow(Math.max(10, w.rain) / C.rain, C.rainPower)
  );
}

/** The carbon a world's air rests at (ppm): where its weathering takes down what its fire breathes out. */
export function restingCarbon(w: CarbonWorld): number {
  const C = CARBON_CYCLE;
  if (!w.weathers) return C.rest;
  const k = dmath.pow(Math.max(1e-6, w.outgas) / weathering(w), 1 / C.carbonPower);
  return C.rest * Math.min(C.restBounds[1], Math.max(C.restBounds[0], k));
}

/** The share of what was put in its air that its rock wears away in a year (0 where its liquid does not weather rock). */
export function wornShare(w: CarbonWorld): number {
  return w.weathers ? Math.min(0.01, weathering(w) / CARBON_CYCLE.wearYears) : 0;
}

/** Of what is still put in, the share its seas leave in the air once they have taken their part (rises the more is put in). */
export function tailShare(added: number, rest: number): number {
  const C = CARBON_CYCLE;
  return C.tail + C.tailRise * Math.min(1, Math.max(0, added) / Math.max(1, rest));
}

/** How much more acid its seas are than at rest (pH), its air holding `carbon` against `rest`. */
export function seasSoured(carbon: number, rest: number): number {
  return Math.max(
    0,
    CARBON_CYCLE.sourPerDoubling * dmath.log2(Math.max(1, carbon) / Math.max(1, rest)),
  );
}

/** What a soured sea leaves of its food (1 at rest): its shell-builders and reefs build the worse. */
export function shellsLeft(soured: number): number {
  const C = CARBON_CYCLE,
    harm = Math.max(0, Math.min(1, (soured - C.sourFrom) / C.sourSpan));
  return 1 - C.reef * C.shellsLost * harm;
}
