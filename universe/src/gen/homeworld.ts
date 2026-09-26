// The home world: star, planet, plates, relief, climate, rivers and deposits, all
// a pure function of the seed, the prior and the grid's frequency (docs/
// architecture §24, the A0 tier). Nothing here is saved: it is regenerated from
// the seed, and its digest — part of every checkpoint — proves that every engine
// regenerated the same world.
import {
  Hasher,
  Rng,
  finish,
  hashString,
  mix,
  sphereGrid,
  type Seed,
  type SphereGrid,
} from "../kernel/index.ts";
import type { Prior } from "../rules/index.ts";
import { makePlanet, makeStar, type Planet, type Star } from "./bodies.ts";
import { makeClimate, type Climate } from "./climate.ts";
import { makeDeposits, type Deposit } from "./deposits.ts";
import { makeHydrology, type Hydrology } from "./hydrology.ts";
import { BOUNDARY, makeTectonics, type Tectonics } from "./plates.ts";

export type HomeWorld = {
  readonly prior: string;
  readonly star: Star;
  readonly planet: Planet;
  readonly grid: SphereGrid;
  readonly tectonics: Tectonics;
  readonly climate: Climate;
  readonly water: Hydrology;
  readonly deposits: readonly Deposit[];
  readonly digest: string;
};

/** The planet grid's usual frequency: 40,962 cells (about 110 km apart on an Earth-sized world). */
export const PLANET_FREQUENCY = 64;

function hashArray(h: Hasher, a: ArrayLike<number>): void {
  h.int(a.length);
  for (let i = 0; i < a.length; i++) h.float(a[i]!);
}

export function generateHomeWorld(
  seed: Seed,
  prior: Prior,
  frequency = PLANET_FREQUENCY,
): HomeWorld {
  const rng = new Rng(seed),
    grid = sphereGrid(frequency),
    star = makeStar(rng, prior),
    planet = makePlanet(rng, prior, star),
    tectonics = makeTectonics(grid, rng, planet),
    climate = makeClimate(grid, planet, tectonics.elevation),
    water = makeHydrology(grid, tectonics.elevation, climate.precipitation),
    deposits = makeDeposits(grid, rng, tectonics, climate, water, tectonics.elevation);
  const h = new Hasher().string(prior.name).int(frequency).value(star).value(planet);
  for (const p of tectonics.plates) h.value(p);
  hashArray(h, tectonics.plate);
  hashArray(h, tectonics.elevation);
  hashArray(h, climate.temperature);
  hashArray(h, climate.precipitation);
  hashArray(h, climate.biome);
  hashArray(h, water.discharge);
  for (const d of deposits) h.value(d);
  return {
    prior: prior.name,
    star,
    planet,
    grid,
    tectonics,
    climate,
    water,
    deposits,
    digest: h.hex(),
  };
}

/**
 * Copper ores at the surface — green malachite and native copper where old
 * mountain belts and high ground are worn open. Too small to count among the
 * world's deposits, but enough for a first people's smiths. A pure function of
 * the generated world, so it needs no storing.
 */
export function surfaceCopper(w: HomeWorld, cell: number): boolean {
  const t = w.tectonics,
    e = t.elevation[cell]!;
  if (e <= 0) return false;
  const belt = t.boundary[cell] === BOUNDARY.convergent && t.toBoundary[cell]! <= 6,
    high = e > 900;
  if (!belt && !high) return false;
  const u = finish(mix(hashString(`surface copper ${w.digest}`), cell), 11) / 4294967296;
  return u < (belt ? 0.3 : 0.15);
}

/**
 * Ores at or near the surface, by kind: small showings a first people can work,
 * too small to count among the world's deposits. Copper is surfaceCopper's rule;
 * tin shows where granites of old collisions are worn open; iron as bog iron in
 * wet lowlands and in hills; salt in dry basins and along coasts. Pure functions
 * of the generated world.
 */
export function surfaceOre(w: HomeWorld, cell: number, kind: string): boolean {
  if (kind === "copper") return surfaceCopper(w, cell);
  const t = w.tectonics,
    e = t.elevation[cell]!;
  if (e <= 0) return false;
  const u = finish(mix(hashString(`surface ${kind} ${w.digest}`), cell), 11) / 4294967296,
    rain = w.climate.precipitation[cell]!,
    coast = (() => {
      for (let k = w.grid.offsets[cell]!; k < w.grid.offsets[cell + 1]!; k++)
        if (t.elevation[w.grid.neighbours[k]!]! <= 0) return true;
      return false;
    })();
  switch (kind) {
    case "tin":
      return t.boundary[cell] === BOUNDARY.convergent && t.toBoundary[cell]! <= 5 && u < 0.18;
    case "iron":
      return (rain > 700 && e < 400 && u < 0.4) || (e > 700 && u < 0.3);
    case "salt":
      return (rain < 350 && u < 0.35) || (coast && u < 0.25);
    default:
      return false;
  }
}
