// Other civilizations of the cluster (docs/architecture §27, Phase 6 M61): peoples on
// other stars' worlds, generated at the universe's making from their own worlds — a
// world with seas about a living star old enough, a lineage risen to thought on it (by a
// keyed draw, likelier about warm steady stars than flaring red dwarfs) — and followed in
// aggregate, never as a second planet: when their chronicle began against ours, how fast
// they go, and so when they came to electronics (their signals leave at light's speed),
// to orbit (later on a heavier world, as the rocket equation says) and to the stars.
import { defineKind, defineStream, makeRef, type Ref, type Rng } from "../kernel/index.ts";
import { CLADES, toOrbit } from "../rules/index.ts";
import type { GalaxyStar } from "./galaxy.ts";
import type { ForeignPlanet } from "./system.ts";

export const CIVILIZATION = defineKind("civ", "civilization of another star", "structural");

const CIVS = defineStream("gen.civilizations");

/**
 * The home world's own pace, as the Earth seed's calibrated chronicle keeps it: the years
 * a people at that pace comes to electronics, to orbit and to the stars.
 */
export const HOME_PACE = { electronics: 860, orbit: 1045, stars: 1400 } as const;
/** At most this many other civilizations are followed (the nearest). */
export const MOST_CIVILIZATIONS = 12;

export type Civilization = {
  readonly ref: Ref;
  readonly star: Ref;
  readonly planet: number;
  readonly distance: number;
  /** The lineage that rose to thought there, and the medium it lives in. */
  readonly clade: string;
  readonly medium: string;
  /** Their world's pull and the speed to orbit it asks. */
  readonly gravity: number;
  readonly speed: number;
  /** Their chronicle's first year in ours (negative: older than ours), and their pace (1: home's). */
  readonly offset: number;
  readonly pace: number;
  /** The years, in our chronicle, they came (or will come) to electronics, to orbit and to the stars. */
  readonly electronics: number;
  readonly orbit: number;
  readonly stars: number;
};

/**
 * The cluster's other civilizations: its worlds with seas about living stars two billion
 * years old or more, each bearing a people by a keyed draw; the nearest few followed.
 */
export function civilizationsOf(
  rng: Rng,
  stars: readonly GalaxyStar[],
  worldsOf: (s: GalaxyStar) => readonly ForeignPlanet[],
): Civilization[] {
  const out: Civilization[] = [];
  for (const star of stars) {
    if (star.remnant || star.ageGyr < 2 || out.length >= MOST_CIVILIZATIONS) continue;
    const key = star.sector * 64 + star.k;
    for (const planet of worldsOf(star)) {
      if (planet.kind !== "rocky" || planet.water !== "seas") continue;
      const u = (n: number) => rng.real(CIVS, key, planet.index, 0, n),
        // Red dwarfs flare, and their worlds turn one face to them: life rises there less.
        chance = star.spectral === "MV" ? 0.02 : 0.08;
      if (!(u(0) < chance)) continue;
      const clade = CLADES[Math.floor(u(1) * CLADES.length)]!,
        offset = Math.round(-2500 + 4500 * u(2)),
        pace = 0.7 + 0.7 * u(3),
        speed = toOrbit({
          gravity: planet.gravity,
          radius: planet.radius,
          pressure: planet.pressure,
        }).total,
        // A heavier well is climbed later: a lifetime more for every few km/s past home's.
        climb = Math.max(0, (speed - 9.5) * 60),
        electronics = Math.round(offset + HOME_PACE.electronics * pace);
      out.push({
        ref: makeRef(CIVILIZATION, star.sector, star.k * 16 + planet.index),
        star: star.ref,
        planet: planet.index,
        distance: star.distance,
        clade: clade.id,
        medium: clade.body.medium,
        gravity: planet.gravity,
        speed,
        offset,
        pace,
        electronics,
        orbit: Math.round(offset + HOME_PACE.orbit * pace + climb),
        stars: Math.round(offset + HOME_PACE.stars * pace + climb),
      });
      break;
    }
  }
  return out;
}
