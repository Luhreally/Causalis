// A world's chemistry read from what made it (Phase 54 M221): its star's warmth and age, where in
// its star's habitable zone it orbits, and three draws of its own ground — never the seed's stream,
// nor anything generated after the ground, so it stays put when later layers of generation change.
// An Earth-like world keeps the Sun's own (SOLAR). And two things that follow on the ground: where
// native iron lies, and the stone a land's people knap from rock of the world's own chemistry.
// (Imports homeworld for its type only: homeworld's showings read this file.)
import { finish, hashString, mix } from "../kernel/index.ts";
import {
  PRIORS,
  SOLAR,
  chemistryOf,
  keenestIn,
  stonesFor,
  type Chemistry,
  type ChemistryInputs,
  type Stone,
} from "../rules/index.ts";
import { starAgeGyr } from "./bodies.ts";
import { SOUGHT, groundOf, groundStone, landBedrock } from "./bedrock.ts";
import type { HomeWorld } from "./homeworld.ts";
import { isProvinceWorld } from "./provinces.ts";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** What a world's chemistry is drawn from: its star, where its orbit lies in the star's habitable zone, three draws of its ground. */
export function chemistryInputs(g: HomeWorld): ChemistryInputs {
  const key = hashString(`chemistry ${g.ground}`),
    u = (k: number) => (finish(mix(key, k), 11) / 4294967296) * 2 - 1;
  return {
    temperature: g.star.temperature,
    ageGyr: starAgeGyr(g.star),
    zone: clamp01((g.planet.orbitAu - g.star.zoneInner) / (g.star.zoneOuter - g.star.zoneInner)),
    u: [u(1), u(2), u(3)],
    // (Its kind, and a fourth draw of its ground for a carbon disk's C/O: Phase 56.)
    ...(g.planet.kind ? { kind: g.planet.kind, disk: u(4) } : {}),
  };
}

const KEPT = new Map<string, Chemistry>();

/** A world's chemistry: the Sun's own on an Earth-like world, else drawn from its star and orbit (kept by its ground). */
export function worldChemistry(g: HomeWorld): Chemistry {
  if ((PRIORS[g.prior]?.chemistry ?? "drawn") === "solar") return SOLAR;
  const kept = KEPT.get(g.ground);
  if (kept) return kept;
  const chem = chemistryOf(chemistryInputs(g));
  KEPT.set(g.ground, chem);
  if (KEPT.size > 16) KEPT.delete(KEPT.keys().next().value!);
  return chem;
}

const NONE: ReadonlySet<number> = new Set();
const NATIVE = new Map<string, ReadonlySet<number>>();

/**
 * The lands where native iron lies: where lava of the land's own basalt flowed through its buried
 * coal or oil and the carbon stripped the iron from it (as on Disko Island) — kept only on a world
 * where nothing rusts it away again.
 */
export function nativeIronLands(g: HomeWorld): ReadonlySet<number> {
  if (worldChemistry(g).redox !== "reduced") return NONE;
  const kept = NATIVE.get(g.digest);
  if (kept) return kept;
  const fine = isProvinceWorld(g) ? g.fine : g,
    landOf = (s: number) => (isProvinceWorld(g) ? g.provinceOf[s]! : s),
    rockAt = groundOf(g).rockAt,
    basalt = new Set<number>(),
    lands = new Set<number>();
  for (let s = 0; s < fine.grid.count; s++)
    if (fine.tectonics.elevation[s]! > 0 && rockAt(s) === "basalt") {
      const land = landOf(s);
      if (land >= 0) basalt.add(land);
    }
  for (const land of [...basalt].sort((a, b) => a - b))
    if (g.tectonics.elevation[land]! > 0 && (g.deep.coal[land]! > 0 || g.deep.oil[land]! > 0))
      lands.add(land);
  NATIVE.set(g.digest, lands);
  if (NATIVE.size > 8) NATIVE.delete(NATIVE.keys().next().value!);
  return lands;
}

/**
 * A land's stone under its world's chemistry: groundStone's own choice on an Earth-like world, else
 * the keenest of the stones its rocks give on this world (or the rock underfoot, where one is given).
 */
export function worldGroundStone(
  g: HomeWorld,
  cell: number,
  under?: string,
): { readonly rock: string; readonly stone: Stone } {
  const chem = worldChemistry(g);
  if (chem.solar) return groundStone(g, cell, under);
  const stones = stonesFor(chem),
    rocks = [
      ...(under ? [under] : []),
      ...landBedrock(g, cell).flatMap(([rock, k]) => (k >= SOUGHT ? [rock] : [])),
    ],
    rock = rocks.length ? keenestIn(stones, rocks) : "limestone";
  return { rock, stone: stones[rock] ?? stones.limestone! };
}
