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
import {
  agesMade,
  dawnMade,
  kindLives,
  livesMade,
  madePrior,
  peoplingMade,
  showingScale,
  worldKind,
  type Prior,
} from "../rules/index.ts";
import { kindPlanet, makePlanet, makeStar, starAgeGyr, type Planet, type Star } from "./bodies.ts";
import { makeSystem, type StarSystem } from "./system.ts";
import { makeClimate, type Climate } from "./climate.ts";
import { makeDeposits, type Deposit } from "./deposits.ts";
import { ageRef } from "./kinds.ts";
import { makeHydrology, type Hydrology } from "./hydrology.ts";
import { AGES, makeDeepTime, type AgeKind, type DeepTime } from "./deeptime.ts";
import { barrenBiosphere, makeBiosphere, type Biosphere } from "./biosphere.ts";
import { BOUNDARY, makeTectonics, type Tectonics } from "./plates.ts";
import { nativeIronLands, worldChemistry } from "./chemistry.ts";

export type HomeWorld = {
  readonly prior: string;
  readonly star: Star;
  readonly planet: Planet;
  /** The star's other planets and the moons (not in the digest: the home world's history is untouched by them). */
  readonly system: StarSystem;
  readonly grid: SphereGrid;
  readonly tectonics: Tectonics;
  readonly climate: Climate;
  readonly water: Hydrology;
  readonly deposits: readonly Deposit[];
  /** The planet's deep past: its ages, and the carbon they buried. */
  readonly deep: DeepTime;
  /** Life's lineages over those ages, the living world they left, and where the people arose. */
  readonly life: Biosphere;
  readonly digest: string;
  /**
   * The digest of the ground alone — the star, the planet, its plates and relief. What
   * is keyed on it (surface ores, the terrain of regions) stays put when later layers
   * of generation (deep time, the biosphere) are added or change.
   */
  readonly ground: string;
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
  // (Its star, its pull, its orbit, its seas and its air as the hand made them, the rest as the
  // seed falls: Phase 35.)
  const made = madePrior(prior, seed.text),
    rng = new Rng(seed),
    grid = sphereGrid(frequency),
    star = makeStar(rng, made),
    // (Its kind, on a world of a drawn chemistry: by its own keyed draws, never the seed's stream,
    // and its planet read through its liquid: Phase 56.)
    kind =
      (prior.chemistry ?? "drawn") === "solar"
        ? "rocky"
        : worldKind({ text: seed.text, mass: star.mass, ageGyr: starAgeGyr(star) }),
    twin = makePlanet(rng, made, star),
    planet = kind === "rocky" ? twin : kindPlanet(twin, kind, star),
    // The rest of the star's system, on its own stream (the home world is untouched by it).
    system = makeSystem(rng, made, star, planet),
    tectonics = makeTectonics(grid, rng, planet),
    climate = makeClimate(grid, planet, tectonics.elevation),
    water = makeHydrology(grid, tectonics.elevation, climate.precipitation),
    // (Its deep ages, and the way that prospered in its first seas, as the acts laid on its dawn
    // made them: Phase 24.)
    deep = makeDeepTime(
      grid,
      rng,
      planet,
      tectonics,
      agesMade(seed.text, AGES) as ReadonlyMap<number, AgeKind>,
    ),
    // (Life takes hold in a kind's liquid only as often as its chemistry lets it: Phase 56.)
    life = kindLives(seed.text, kind)
      ? makeBiosphere(grid, rng, climate, water, tectonics.elevation, deep, {
          prior: prior.name,
          gravity: planet.gravity,
          ocean: planet.oceanFraction,
          dawn: dawnMade(seed.text),
          lives: livesMade(seed.text, AGES),
          cradle: peoplingMade(seed.text).cradle,
        })
      : barrenBiosphere(grid.count),
    deposits = makeDeposits(grid, rng, tectonics, climate, water, tectonics.elevation, deep);
  const h = new Hasher().string(prior.name).int(frequency).value(star).value(planet);
  for (const p of tectonics.plates) h.value(p);
  hashArray(h, tectonics.plate);
  hashArray(h, tectonics.elevation);
  const ground = h.hex();
  hashArray(h, climate.temperature);
  hashArray(h, climate.precipitation);
  hashArray(h, climate.biome);
  hashArray(h, water.discharge);
  for (const a of deep.ages) h.value(a);
  hashArray(h, deep.coal);
  hashArray(h, deep.oil);
  for (const s of life.species) h.value(s);
  if (life.people) h.value(life.people.body);
  // (Where the hand bade them rise: kept apart from a world whose people rose where they would.)
  if (life.people && peoplingMade(seed.text).cradle !== null) h.int(life.people.cell);
  hashArray(h, life.present);
  for (const d of deposits) h.value(d);
  return {
    prior: prior.name,
    star,
    planet,
    system,
    grid,
    tectonics,
    climate,
    water,
    deposits,
    deep,
    life,
    digest: h.hex(),
    ground,
  };
}

/**
 * How often a showing comes to light on a world whose crust holds more or less of its metal than
 * Earth's (Phase 54): Earth's odds scaled by the crust's share against Earth's (exactly Earth's
 * own on a world of the Sun's chemistry), never quite a certainty.
 */
const odds = (p: number, k: number) => Math.min(0.95, p * k);

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
  const u = finish(mix(hashString(`surface copper ${w.ground}`), cell), 11) / 4294967296;
  return u < odds(belt ? 0.3 : 0.15, showingScale(worldChemistry(w), "Cu"));
}

/** Buried carbon enough for a seam of coal, or a field of oil, worth working (the deep past's units). */
export const SEAM = { coal: 12, oil: 12 } as const;

/**
 * Ores at or near the surface, by kind: small showings a first people can work,
 * too small to count among the world's deposits. Copper is surfaceCopper's rule;
 * tin shows where granites of old collisions are worn open; iron as bog iron in
 * wet lowlands and in hills; salt in dry basins and along coasts; coal and oil
 * wherever the deep past buried enough of its swamp forests and plankton. Pure
 * functions of the generated world. (On a world of its own chemistry, Phase 54: the
 * "tin" is what hardens its copper — arsenic ore round the same granites, or nickel
 * where serpentine of the old ocean floor was thrust up along a suture — and each
 * shows as often as its crust holds of it against Earth's.)
 */
export function surfaceOre(w: HomeWorld, cell: number, kind: string): boolean {
  if (kind === "copper") return surfaceCopper(w, cell);
  if (kind === "iron") return ironShowing(w, cell) !== null;
  if (kind === "coal") return w.tectonics.elevation[cell]! > 0 && w.deep.coal[cell]! >= SEAM.coal;
  // Hot springs of the sea floor, where plates meet or part or a plume rises: their
  // chimneys are crusted with the metals the water brings up.
  if (kind === "vent") {
    const t = w.tectonics;
    if (t.elevation[cell]! > 0) return false;
    const near = t.boundary[cell] !== BOUNDARY.none || t.toBoundary[cell]! <= 2;
    return near || t.hotspots.includes(cell);
  }
  if (kind === "oil") return w.deep.oil[cell]! >= SEAM.oil;
  const t = w.tectonics,
    e = t.elevation[cell]!;
  if (e <= 0) return false;
  const u = finish(mix(hashString(`surface ${kind} ${w.ground}`), cell), 11) / 4294967296,
    rain = w.climate.precipitation[cell]!,
    coast = (() => {
      for (let k = w.grid.offsets[cell]!; k < w.grid.offsets[cell + 1]!; k++)
        if (t.elevation[w.grid.neighbours[k]!]! <= 0) return true;
      return false;
    })();
  switch (kind) {
    case "tin": {
      const chem = worldChemistry(w);
      if (chem.hardener === "nickel") return nickelShows(w, cell);
      // (Arsenic is a vein metal of the same granites as tin, and the crust holds more of it.)
      const p = chem.hardener === "arsenic" ? 0.18 * (4.8 / 2.1) : 0.18,
        k = showingScale(chem, chem.hardener === "arsenic" ? "As" : "Sn");
      return t.boundary[cell] === BOUNDARY.convergent && t.toBoundary[cell]! <= 5 && u < odds(p, k);
    }
    case "salt":
      return (rain < 350 && u < 0.35) || (coast && u < 0.25);
    default:
      return false;
  }
}

/**
 * Where nickel shows on a world whose crust is poor in silica (Phase 54): green garnierite weathered
 * out of the serpentine of an old ocean floor, thrust up where it met a land (an ophiolite belt) —
 * twice as often in the wet tropics, whose deep weathering makes laterite of it.
 */
function nickelShows(w: HomeWorld, cell: number): boolean {
  const t = w.tectonics,
    across = t.across[cell]!;
  if (t.elevation[cell]! <= 0 || t.boundary[cell] !== BOUNDARY.convergent) return false;
  if (t.toBoundary[cell]! > 3 || across < 0 || t.plates[across]!.continental) return false;
  const u = finish(mix(hashString(`surface nickel ${w.ground}`), cell), 11) / 4294967296,
    wet = w.climate.precipitation[cell]! > 1000 && w.climate.temperature[cell]! > 18;
  return u < odds(wet ? 0.24 : 0.12, showingScale(worldChemistry(w), "Ni"));
}

/**
 * How a land's iron shows at the surface (Phase 50 M212): bog ore in its wet lowlands, ironstone in
 * its hills — surfaceOre's own rule and draw, told apart; null where it shows none. On a world where
 * nothing rusts (Phase 54), native iron where its lava flowed through buried coal.
 */
export function ironShowing(w: HomeWorld, cell: number): "bog" | "hill" | "telluric" | null {
  const t = w.tectonics,
    e = t.elevation[cell]!;
  if (e <= 0) return null;
  const chem = worldChemistry(w);
  if (chem.redox === "reduced" && nativeIronLands(w).has(cell)) return "telluric";
  const u = finish(mix(hashString(`surface iron ${w.ground}`), cell), 11) / 4294967296,
    rain = w.climate.precipitation[cell]!,
    k = showingScale(chem, "Fe");
  if (rain > 700 && e < 400 && u < odds(0.4, k)) return "bog";
  if (e > 700 && u < odds(0.3, k)) return "hill";
  return null;
}

/**
 * What laid down a land's coal or oil, to cite: the world's named field there if there is
 * one, else the age that buried it (null where there is none to work).
 */
export function seamRef(w: HomeWorld, cell: number, kind: "coal" | "oil"): string | null {
  const field = w.deposits.find((d) => d.cell === cell && d.kind === kind);
  if (field) return field.ref;
  if (!surfaceOre(w, cell, kind)) return null;
  const age = kind === "coal" ? w.deep.coalAge[cell]! : w.deep.oilAge[cell]!;
  return age === 255 ? null : ageRef(0, age);
}
