// Volcanoes in play (the sweep, Nature lane): a world's standing volcanoes erupt at the rates its own plates give, each by a
// size drawn from the power law eruptions keep (Newhall and Self's explosivity index, VEI: each step ten times the ash, and
// some four and a half times rarer). Where one plate goes under another its melt rises in a chain of cones about seventy
// kilometres apart (an arc), fed as fast as the plates converge; a hot place under a plate feeds one, continental ones the
// greatest of all, ocean islands mostly lava; a rift on land feeds small ones. An eruption kills about its cone, buries that
// year's fields in ash, and, great enough to throw its sulphur above the weather, veils the whole world: the veil throws back
// sunlight for a year or two and the world's summers are short and cold (Pinatubo 1991 some half a degree; Tambora 1815 "the
// year without a summer"). Its ash, weathered, is rich ground. Pure tables and functions; sim/planet/fires.ts keeps the state.
//
// Estimates are marked "est".
import { dmath } from "../kernel/index.ts";
import { shareAbove, GROWS_ABOVE } from "./seasons.ts";

export type VentKind = "arc" | "hotspot" | "island" | "rift";

export const VOLCANO = {
  /** Eruptions of VEI 3 or more a standing volcano has a year, on Earth (est: some 0.45 a year of ~1,350 Holocene volcanoes). */
  perVent: 3.3e-4,
  /** The cones of an arc stand about this far apart (km, est). */
  spacing: 70,
  /** The least VEI history counts, and how much rarer each step up is (log10: P(≥v) = 10^(−slope (v − 3))). */
  least: 3,
  slope: 0.65,
  /** The greatest each kind of vent gives (est: arcs to Tambora's 7, continental hot places to Toba's 8, ocean islands and rifts small). */
  most: { arc: 7, hotspot: 8, island: 4, rift: 5 } as Readonly<Record<VentKind, number>>,
  /** How much more often a hot place's vent erupts than an arc's one (est: few, but each fed steadily). */
  hotspotRate: 2,
  /** Of a land's people, the share an eruption of VEI 3 kills about its cone, and how much more each step up (est). */
  dead: 0.002,
  deadStep: 3,
  /** The most of a land's people one eruption kills, and of a neighbour's share (est). */
  deadMost: 0.5,
  beside: 0.25,
  /** From this VEI, its ash falls on the lands beside it too (est), and its sulphur rises above the weather (est). */
  wideFrom: 6,
  veilFrom: 4,
  /** What its ash takes of its own land's harvest that year at VEI 3, and how much more each step (est). */
  ash: 0.15,
  ashMost: 0.9,
  /** Sulphur dioxide thrown above the weather (Mt) at VEI 6 (Pinatubo some 17), and how it grows a step (log10, est). */
  sulphur6: 17,
  sulphurStep: 0.55,
  /** Earth's crust's sulphur (ppm): another world's eruptions carry as the root of its own against this. */
  crustS: 350,
  /** The cooling (K) of a veil of Pinatubo's 17 Mt, and how it grows with the sulphur (its power, est). */
  cool17: 0.45,
  coolPower: 0.5,
  /** How fast a veil falls out of the sky (e-folding years, est: its droplets settle in a year or two). */
  veilYears: 1.3,
  /** The share of its land's topsoil its weathered ash adds at VEI 3, and the most (est). */
  rich: 0.004,
  richMost: 0.05,
} as const;

/** How many come in a year from a Poisson rate, from one uniform draw. */
export function poissonCount(mean: number, u: number): number {
  if (!(mean > 0)) return 0;
  let k = 0,
    p = dmath.exp(-mean),
    sum = p;
  while (u > sum && k < 50) {
    k++;
    p *= mean / k;
    sum += p;
  }
  return k;
}

/** How many standing volcanoes a land's vents are: an arc's cones by its width, a hot place's or rift's one. */
export function ventsOf(kind: VentKind, areaKm2: number): number {
  return kind === "arc"
    ? Math.max(1, Math.round(Math.sqrt(Math.max(0, areaKm2)) / VOLCANO.spacing))
    : 1;
}

/** A land's eruptions of VEI 3 and more a year: its vents, fed as fast as its plates converge (`speed` against Earth's). */
export function eruptRate(kind: VentKind, vents: number, speed: number): number {
  const fed =
    kind === "arc" ? dmath.clamp(speed, 0.2, 3) : kind === "rift" ? 0.5 : VOLCANO.hotspotRate;
  return VOLCANO.perVent * vents * fed;
}

/** An eruption's size (VEI) from a uniform draw, no greater than its vent gives. */
export function veiOf(u: number, kind: VentKind): number {
  const v = VOLCANO.least + Math.floor(-dmath.log10(Math.max(1e-12, u)) / VOLCANO.slope);
  return Math.min(VOLCANO.most[kind], v);
}

/** The ash an eruption throws (km³ of tephra): ten times as much a step (VEI 5 about a cubic kilometre). */
export function tephraKm3(vei: number): number {
  return dmath.pow(10, vei - 5);
}

/** The share of a land's people an eruption kills (`beside`: a land next to it, for the greatest). */
export function eruptDead(vei: number, beside = false): number {
  if (beside && vei < VOLCANO.wideFrom) return 0;
  const s = Math.min(
    VOLCANO.deadMost,
    VOLCANO.dead * dmath.pow(VOLCANO.deadStep, vei - VOLCANO.least),
  );
  return beside ? s * VOLCANO.beside : s;
}

/** What its ash takes of a land's harvest that year (`beside`: a land next to it). */
export function ashLoss(vei: number, beside = false): number {
  if (beside && vei < VOLCANO.wideFrom) return 0;
  const s = Math.min(VOLCANO.ashMost, VOLCANO.ash * dmath.pow(2, vei - VOLCANO.least));
  return beside ? s / 2 : s;
}

/** The sulphur dioxide (Mt) it throws above the weather, its world's crust holding `crustS` ppm of sulphur. */
export function sulphurMt(vei: number, crustS: number): number {
  if (vei < VOLCANO.veilFrom) return 0;
  const k = dmath.clamp(Math.sqrt(Math.max(0, crustS) / VOLCANO.crustS), 0, 3);
  return VOLCANO.sulphur6 * dmath.pow(10, VOLCANO.sulphurStep * (vei - 6)) * k;
}

/** The world's cooling at its height (K) under a veil of so much sulphur dioxide (Mt). */
export function veilCooling(mt: number): number {
  return mt > 0 ? VOLCANO.cool17 * dmath.pow(mt / VOLCANO.sulphur6, VOLCANO.coolPower) : 0;
}

/** What is left of a veil `years` after (a share of its height). */
export function veilLeft(years: number): number {
  return years < 0 ? 0 : dmath.exp(-years / VOLCANO.veilYears);
}

/**
 * What a cooling (degrees of its climate) leaves of a land's harvest: its growing season as it is shortened, a land of
 * this mean warmth and swing. Exactly 1 at no cooling; a cold land loses most, a warm one little.
 */
export function cooledYield(mean: number, swing: number, cooling: number): number {
  if (!(cooling > 0)) return 1;
  const was = shareAbove(mean, swing, GROWS_ABOVE);
  if (was <= 0.02) return 1;
  return dmath.clamp(shareAbove(mean - cooling, swing, GROWS_ABOVE) / was, 0.2, 1);
}

/** The share of its land's topsoil its weathered ash adds. */
export function ashRich(vei: number): number {
  return Math.min(VOLCANO.richMost, VOLCANO.rich * dmath.pow(2, vei - VOLCANO.least));
}
