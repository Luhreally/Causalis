// The ground under a colony (Phase 64, asked for 2026-11-03: "i wanna see the star wars and landing
// in planets and colonization and all that stuff"): the world a land of another body stands on, made
// whole as the sky shows it (gen/worlds.ts), the cell of it its halls stand at (rules/habitat.ts),
// and the land about them, drawn on that world's grid as a land of the home world is drawn on its
// own. A pure function of the universe's seed and of where history set the land: it is looked at and
// never lived (the halls' people are farmed under roofs: population/model.ts), so nothing here enters
// history, and the same land is always the same ground.
import { Rng, dmath, type World } from "../../kernel/index.ts";
import {
  BIOME,
  COVER,
  WORLD_FREQUENCY,
  WATER,
  foreignBody,
  foreignPlanets,
  offworldSite,
  otherWorld,
  refineRegion,
  regionRef,
  type HomeWorld,
  type OtherWorld,
  type ProvinceWorld,
  type Region,
  type SystemBody,
} from "../../gen/index.ts";
import { hallCells } from "../../rules/index.ts";
import { homePlanet } from "../planet/store.ts";
import { starSitesOf } from "./stars.ts";
import { clusterOf } from "./voyages.ts";

/** Each land's tiles a side, and how wide each is on the ground: as a land of the home world. */
const SIZE = 128,
  TILE_KM = 2.4;

export type SiteGround = {
  /** The body it stands on (another star's world told as a body of its system). */
  readonly body: SystemBody;
  /** Whose light it stands in: the star's ref, how bright and how hot, how wide; how far off (AU). */
  readonly star: {
    readonly ref: string;
    readonly luminosity: number;
    readonly temperature: number;
    readonly radius: number;
  };
  readonly au: number;
  /** The body it circles, if it is a moon (null: it circles the star). */
  readonly parent: SystemBody | null;
  /** Its moons. */
  readonly moons: readonly SystemBody[];
  /**
   * The world whole, on its grid, and the cell of it the halls stand at: made when first asked for (a
   * list of a world's colonies, read every few seconds, never asks), and kept for a few at a time.
   */
  readonly world: OtherWorld;
  readonly hall: number;
};

const GROUNDS = new Map<string, SiteGround>(),
  WORLDS = new Map<string, OtherWorld>();

/** A world whole, kept for the few looked at last. */
function wholeWorld(key: string, make: () => OtherWorld): OtherWorld {
  let w = WORLDS.get(key);
  if (w) WORLDS.delete(key);
  else {
    w = make();
    if (WORLDS.size >= 12) WORLDS.delete(WORLDS.keys().next().value!);
  }
  WORLDS.set(key, w);
  return w;
}

/** The ground: its numbers now, its world and where its halls stand when they are asked for. */
function groundOf(
  key: string,
  parts: Pick<SiteGround, "body" | "star" | "au" | "parent" | "moons">,
  make: () => OtherWorld,
  slot: number,
): SiteGround {
  let hall = -1;
  return {
    ...parts,
    get world() {
      return wholeWorld(key, make);
    },
    get hall() {
      if (hall < 0) hall = hallCells(WORLD_FREQUENCY, wholeWorld(key, make).cover)[slot]!;
      return hall;
    },
  };
}

/** A star as a world's sky reads it, its breadth from its light and heat (in the Sun's: L = R²T⁴). */
function light(s: {
  readonly ref: string;
  readonly luminosity: number;
  readonly temperature: number;
}): SiteGround["star"] {
  const hot = 5772 / s.temperature;
  return {
    ref: s.ref,
    luminosity: s.luminosity,
    temperature: s.temperature,
    radius: dmath.sqrt(s.luminosity) * hot * hot,
  };
}

/**
 * The ground of a land of another body (null: a land of the home world, a site no one holds, or a
 * ship still sailing: it stands on nothing yet).
 */
export function siteGround(world: World, cell: number): SiteGround | null {
  const g = homePlanet(world).generated as ProvinceWorld,
    site = offworldSite(g, cell);
  if (!site) return null;
  const ship = site.body < 0 ? starSitesOf(world)?.get(cell) : undefined;
  if (site.body < 0 && !ship?.arrived) return null;
  const key = `${g.digest} ${cell} ${ship ? `${ship.star} ${ship.planet}` : ""}`,
    known = GROUNDS.get(key);
  if (known) return known;
  let made: SiteGround;
  if (ship) {
    const star = clusterOf(world).find((s) => s.ref === ship.star);
    if (!star) return null;
    const p = foreignPlanets(new Rng(world.seed), star)[ship.planet];
    if (!p) return null;
    const body = foreignBody(star, p, ship.planet);
    made = groundOf(
      key,
      { body, star: light(star), au: p.a, parent: null, moons: [] },
      () => otherWorld(body, star, p.a, g.digest),
      0,
    );
  } else {
    const bodies = g.system.bodies,
      body = bodies[site.body]!,
      parent =
        body.kind === "moon" ? (bodies.find((b) => b.ref === body.orbit.around) ?? null) : null,
      au = parent ? parent.orbit.a : body.orbit.a;
    made = groundOf(
      key,
      {
        body,
        star: light(g.star),
        au,
        parent,
        moons: bodies.filter((b) => b.kind === "moon" && b.orbit.around === body.ref),
      },
      () => otherWorld(body, g.star, au, g.digest),
      site.site % 3,
    );
  }
  GROUNDS.set(key, made);
  return made;
}

/** A world as a land is drawn on it: its ground's heights about the halls, nothing of a home world's. */
function asHome(ground: SiteGround, digest: string): HomeWorld {
  const w = ground.world,
    n = w.grid.count,
    site = w.elevation[ground.hall]!,
    // (A world with no seas has no sea level: its heights are told from its halls', closer together
    // than they stand, a land's relief being what the eye can take, and none of it under water.)
    elevation =
      ground.body.water === "seas"
        ? w.elevation
        : Float32Array.from(w.elevation, (e) => Math.max(40, (e - site) * 0.6 + 700));
  return {
    grid: w.grid,
    ground: `${digest} ${ground.body.ref}`,
    planet: { radius: ground.body.radius },
    tectonics: { elevation },
    climate: { temperature: w.temperature, precipitation: w.precipitation },
    water: {
      flowTo: new Int32Array(n).fill(-1),
      river: new Uint8Array(n),
      discharge: new Float32Array(n),
    },
    deposits: [],
  } as unknown as HomeWorld;
}

const REGIONS = new Map<string, Region>();

/** The land about a colony's halls, as a land of the home world's is drawn (null: it stands on nothing). */
export function siteRegion(world: World, cell: number): Region | null {
  const ground = siteGround(world, cell);
  if (!ground) return null;
  const g = homePlanet(world).generated,
    key = `${g.digest} ${cell} ${ground.body.ref}`,
    known = REGIONS.get(key);
  if (known) return known;
  const made = refineRegion(asHome(ground, g.digest), ground.hall, SIZE, TILE_KM),
    w = ground.world,
    biome = made.biome;
  // (Its ground bare but for its ice: what covers it, as the world seen whole is covered, and
  // nothing on it that the home world's climate would plant.)
  for (let t = 0; t < biome.length; t++)
    if (made.water[t] === WATER.land)
      biome[t] =
        w.cover[made.parent[t]!] === COVER.ice
          ? BIOME.ice
          : made.temperature[t]! > 30
            ? BIOME.hotDesert
            : BIOME.coldDesert;
  // (A world with no seas: the noise on its ground never takes it under a sea it does not have.)
  if (ground.body.water !== "seas")
    for (let t = 0; t < biome.length; t++) {
      made.elevation[t] = Math.max(30, made.elevation[t]!);
      made.water[t] = WATER.land;
      if (biome[t]! < BIOME.ice) biome[t] = BIOME.coldDesert;
    }
  const region: Region = { ...made, ref: regionRef(0, cell), center: cell };
  if (REGIONS.size >= 12) REGIONS.delete(REGIONS.keys().next().value!);
  REGIONS.set(key, region);
  return region;
}
