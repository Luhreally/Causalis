// Ages past ours, from their physics (Phase 66, as rules/launch.ts is to the rocket): what mirrors about
// a star gather, and how much rock they take; what a world's air takes to remake, and what cannot be
// remade; how many a square kilometre of built ground holds, and what food grown in vats feeds. Each a
// figure a world's own star, bodies and lands give. Pure tables and functions.
import { dmath } from "../kernel/index.ts";

/** A body's ground as a remaking reads it. */
export type RemakeGround = {
  readonly kind: string;
  readonly gravity: number;
  readonly pressure: number;
  readonly temperature: number;
};

/** The lightest pull that keeps a thick air for longer than a people lasts (the Moon's loses it in some ten thousand years). */
export const LEAST_HOLD_G = 0.13;
/** Past this heat, no air brought from outside cools it without first shading it from its star (°C). */
export const HOTTEST_REMADE = 120;
/** Past this pressure, its air would have to be taken away, not brought (bar). */
export const THICKEST_REMADE = 30;
/** Years a world's air and water take to remake, from comets and giants' moons brought in. */
export const REMAKE_YEARS = 400;

/** Why a body's ground cannot be remade (null: it can be). */
export function cannotRemake(g: RemakeGround): string | null {
  if (g.kind === "giant" || g.kind === "ice giant") return "a giant has no ground to remake";
  if (g.gravity < LEAST_HOLD_G)
    return `its pull of ${Math.round(g.gravity * 100) / 100} g would lose any air it was given`;
  if (g.temperature > HOTTEST_REMADE) return `at ${Math.round(g.temperature)} °C it is too hot`;
  if (g.pressure > THICKEST_REMADE)
    return `its air of ${Math.round(g.pressure)} bar would first have to be taken away`;
  return null;
}

/** What a remaking is seen to have done at a share: its air's pressure (bar), its warmth (°C). */
export function remadeGround(
  g: Pick<RemakeGround, "pressure" | "temperature">,
  share: number,
): { readonly pressure: number; readonly temperature: number } {
  return {
    pressure: g.pressure + (1 - g.pressure) * share,
    temperature: g.temperature + (15 - g.temperature) * share,
  };
}

/**
 * A world as it stands at a share of its remaking: its air thickening (a breath, then what can be breathed), its
 * ice melting on the way. Read by the pages and the film of a landing; it decides nothing.
 */
export function remadeWorld(
  w: {
    readonly air: string;
    readonly water: string;
    readonly pressure: number;
    readonly temperature: number;
    readonly icy: boolean;
  },
  share: number,
): {
  readonly air: string;
  readonly water: string;
  readonly pressure: number;
  readonly temperature: number;
  readonly icy: boolean;
} {
  const bare = w.air === "none" || w.air === "trace";
  return {
    ...remadeGround(w, share),
    air: share >= 1 ? "breathable" : share >= 0.4 && bare ? "thin" : w.air,
    water: share >= 0.7 && w.water === "ice" ? "liquid" : w.water,
    icy: share < 0.7 && w.icy,
  };
}

/** How far a remaking had come by a year, from the year it was begun to the last it went on. */
export function remakingAt(
  r: { readonly from: number; readonly to: number; readonly share: number },
  year: number,
): number {
  return r.share * Math.max(0, Math.min(1, (year - r.from) / Math.max(1, r.to - r.from)));
}

/** Kilograms of rock a square metre of mirror takes. */
export const MIRROR_KG_M2 = 1;
/** The mirrors of a first works (km²). */
export const FIRST_MIRRORS_KM2 = 100;
/** Years mirrors take to double: each works builds the next, from the rock of the system's small bodies. */
export const MIRROR_DOUBLING = 22;
/** A home world's mass, kg. */
const EARTH_KG = 5.97e24;
/** The sun's light, kW (a world's star is told in the sun's). */
const SUN_KW = 3.83e23;
/** One astronomical unit, km. */
const AU_KM = 1.496e8;

/** How many km² of mirrors a system's rock can make, and its star's sphere at that distance can hold. */
export function mostMirrorsKm2(rockEarths: number, au: number): number {
  const fromRock = (rockEarths * EARTH_KG) / (MIRROR_KG_M2 * 1e6),
    km = au * AU_KM,
    sphere = 4 * Math.PI * (km * km);
  return Math.min(fromRock, sphere);
}

/** The light a sheet of mirrors gathers (kW), `au` from a star of `luminosity` suns. */
export function mirrorKw(km2: number, luminosity: number, au: number): number {
  const km = au * AU_KM,
    sphereKm2 = 4 * Math.PI * (km * km);
  return (luminosity * SUN_KW * km2) / sphereKm2;
}

/** The disc a world turns to its star (km²): mirrors as broad as this gather what falls on the whole world. */
export function worldDiscKm2(radiusEarths: number): number {
  const km = 6371 * radiusEarths;
  return Math.PI * km * km;
}

/** A year's growth of mirrors tended. */
export function mirrorsNextYear(km2: number, most: number): number {
  return Math.min(most, km2 * dmath.pow(2, 1 / MIRROR_DOUBLING));
}

/** People a km² of vats feeds, tended by machines: a tower's floors of them for every floor lived on. */
export const VAT_PEOPLE_KM2 = 900;
/** People a km² from whom a land counts as built on from edge to edge (Asimov's Trantor stood at 530). */
export const COVER_PEOPLE_KM2 = 420;
/** Share of a world's lands built on from edge to edge, from which it is covered. */
export const COVERED_SHARE = 0.5;
