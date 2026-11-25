// Sea ice and the seas' salt (the planet's last gaps, 2026-11-24). Pure functions.
//
// - Salt: a sea is as salt as the land that drains into it is wide against the sea that holds what it washes down (Earth's
//   thirty-five parts in a thousand, from three tenths land into seven tenths sea). Salt water freezes colder than fresh: 0.054
//   of a degree for each part in a thousand, so Earth's seas freeze near two below.
// - Sea ice: a sea colder than that bears ice, and ice is bright where open water is the darkest thing on a world. A sea that
//   loses its ice keeps more of its star's light and warms the more; one that gains it cools. It lies where the star stands
//   low and clouds hide much of it, so it turns less light than the same face of ice on land would.
// - The overturning: ice forming leaves its salt behind in the water under it, and that cold brine is what sinks. A sea that
//   has lost its ice sinks less; a salter sea is harder to freshen with meltwater than a fresher one.
import { dmath } from "../kernel/index.ts";
import { GROUND_ALBEDO, ICE_ALBEDO, albedoWarming } from "./planet.ts";

export const SEA_ICE = {
  /** Earth's seas' salt (parts in a thousand), from its land's share of its face over its seas'. */
  earthSalt: 35,
  earthLand: 0.29,
  least: 3,
  most: 150,
  /** Degrees a sea's freezing falls for each part in a thousand of salt. */
  perSalt: 0.054,
  /** Open water's brightness. */
  seaAlbedo: 0.06,
  /**
   * Of the light the same face of land ice would turn, what sea ice turns: the low sun of where it lies, its clouds, and the part
   * of the year it is there at all (est: Hudson 2011 has all the Arctic's gone as 0.7 W/m²; first light's seas bear ice over an
   * eighth of its face by their mean warmth, and at a quarter each degree of warming brought a third of a degree more).
   */
  keeps: 0.12,
  /** The share of the overturning that is the brine of ice forming: gone with all its sea ice (est). */
  brine: 0.2,
} as const;

/** A world's seas' salt (parts in a thousand), by the land's and the seas' shares of its face. */
export function seaSalt(land: number, sea: number): number {
  const earth = SEA_ICE.earthLand / (1 - SEA_ICE.earthLand);
  return dmath.clamp(
    (SEA_ICE.earthSalt * (Math.max(0, land) / Math.max(1e-6, sea))) / earth,
    SEA_ICE.least,
    SEA_ICE.most,
  );
}

/** Where a sea of that salt freezes (degrees: fresh water at 0). */
export function seaFreezes(salt: number): number {
  return -SEA_ICE.perSalt * Math.max(0, salt);
}

/** How much warmer a world grows (K) for sea ice gone from this share of its whole face (negative: come). */
export function seaIceWarming(lostShare: number, insolation: number): number {
  return albedoWarming(
    (lostShare * SEA_ICE.keeps * (ICE_ALBEDO - SEA_ICE.seaAlbedo)) / (ICE_ALBEDO - GROUND_ALBEDO),
    insolation,
  );
}

/** What its sea ice does to a world's overturning (1: as made), by the share of the ice it was made with still there (more: stronger). */
export function brineOf(iceLeft: number): number {
  return 1 - SEA_ICE.brine * (1 - dmath.clamp(iceLeft, 0, 2));
}
