// The whole galaxy, asked for (Phase 8 M80): its shape (the disk, its arms, where home
// lies), the real stars about any spot of it (drawn from the galaxy's own sectors, as the
// cluster's are), any star's page by its ref wherever it lies, and any of its worlds made
// whole (M81). Scenery that can be looked at closely: nothing here enters history.
import { Rng, type World } from "../kernel/index.ts";
import {
  SECTOR_LY,
  WORLD_FREQUENCY,
  foreignPlanets,
  makeGalaxy,
  otherWorld,
  sectorStars,
  type GalaxyStar,
  type SystemBody,
} from "../gen/index.ts";
import { civilizationsNear, contactsOf, homePlanet } from "../sim/index.ts";
import { CLADES } from "../rules/index.ts";
import type { ClusterStar, GalaxyPlan, StarPage, WorldGlobe } from "../bridge/index.ts";

/** The galaxy's shape: enough to draw it. */
export function galaxyPlan(world: World): GalaxyPlan {
  const g = makeGalaxy(new Rng(world.seed));
  return {
    radius: g.radius,
    scale: g.scale,
    arms: g.arms,
    pitch: g.pitch,
    homeRadius: g.homeRadius,
    homeAngle: g.homeAngle,
  };
}

/** A sector's cube back from its id (the zig-zag coding undone). */
function cubeOf(id: number): [number, number, number] {
  const unzig = (n: number) => (n % 2 === 0 ? n / 2 : -(n + 1) / 2);
  return [unzig(id % 1024), unzig(Math.floor(id / 1024) % 1024), unzig(Math.floor(id / 1048576))];
}

/**
 * A star anywhere in the galaxy, by its ref: a near one's ("star:sector:k", the sector's id
 * readable within some five thousand light-years of home), or one found far out
 * ("gstar:i:j:k:n", its sector's cube and its place in it).
 */
export function starByRef(world: World, ref: string): GalaxyStar {
  const parts = ref.split(":"),
    rng = new Rng(world.seed),
    far = parts[0] === "gstar",
    [i, j, l] = far
      ? ([Number(parts[1]), Number(parts[2]), Number(parts[3])] as const)
      : cubeOf(Number(parts[1])),
    k = Number(far ? parts[4] : parts[2]),
    star = sectorStars(rng, makeGalaxy(rng), i, j, l).find((s) => s.k === k);
  if (!star) throw new Error(`no star ${ref}`);
  return far ? { ...star, ref: ref as GalaxyStar["ref"] } : star;
}

/** A star as the pages show it: where, what, and how many worlds it keeps. */
export function starFacts(s: GalaxyStar, rng: Rng): ClusterStar {
  const worlds = foreignPlanets(rng, s);
  return {
    ref: s.ref,
    x: s.x,
    y: s.y,
    z: s.z,
    distance: s.distance,
    spectral: s.spectral,
    mass: s.mass,
    luminosity: s.luminosity,
    temperature: s.temperature,
    ageGyr: s.ageGyr,
    remnant: s.remnant,
    planets: worlds.length,
    seas: worlds.filter((w) => w.water === "seas").length,
  };
}

/**
 * The stars about a spot of the galaxy (light-years from home, in the disk's plane): those
 * of the sectors round it, the brightest first — the few a tap there finds.
 */
export function starsNear(world: World, x: number, y: number, most = 12): ClusterStar[] {
  const rng = new Rng(world.seed),
    g = makeGalaxy(rng),
    ci = Math.round(x / SECTOR_LY),
    cj = Math.round(y / SECTOR_LY),
    found: GalaxyStar[] = [];
  // (Each found star named by its sector's cube, so it can be found again however far out.)
  for (let i = ci - 1; i <= ci + 1; i++)
    for (let j = cj - 1; j <= cj + 1; j++)
      for (let k = -1; k <= 1; k++)
        for (const s of sectorStars(rng, g, i, j, k))
          found.push({ ...s, ref: `gstar:${i}:${j}:${k}:${s.k}` as GalaxyStar["ref"] });
  return found
    .sort((a, b) => b.luminosity - a.luminosity || a.sector - b.sector || a.k - b.k)
    .slice(0, most)
    .map((s) => starFacts(s, rng));
}

/** Any star's page: the star and its worlds. */
export function starPage(world: World, ref: string): StarPage {
  const s = starByRef(world, ref),
    rng = new Rng(world.seed);
  return {
    ...starFacts(s, rng),
    worlds: foreignPlanets(rng, s).map((p) => ({
      kind: p.kind,
      a: p.a,
      mass: p.mass,
      gravity: p.gravity,
      temperature: p.temperature,
      pressure: p.pressure,
      air: p.air,
      water: p.water,
    })),
  };
}

const MADE = new Map<string, WorldGlobe>();

/** The people of another star's world, if one of the cluster's civilizations arose there. */
function peopleOf(world: World, star: string, index: number): WorldGlobe["people"] {
  const civ = civilizationsNear(world).find((c) => c.star === star && c.planet === index);
  if (!civ) return null;
  return {
    name: CLADES.find((c) => c.id === civ.clade)?.body.name ?? civ.clade,
    medium: civ.medium,
    electronics: civ.electronics,
    orbit: civ.orbit,
    stars: civ.stars,
    heard: contactsOf(world).of(civ.ref)?.year ?? null,
  };
}

/** One of another star's worlds (its place outward), made whole. */
export function foreignGlobe(world: World, ref: string, index: number): WorldGlobe {
  const g = homePlanet(world).generated,
    key = `${g.digest} ${ref} ${index}`,
    known = MADE.get(key);
  if (known) return known;
  const s = starByRef(world, ref),
    p = foreignPlanets(new Rng(world.seed), s)[index];
  if (!p) throw new Error(`no world ${index} of ${ref}`);
  const body: SystemBody = {
      ref: `${ref}/${index}` as SystemBody["ref"],
      index,
      designation: String.fromCharCode(98 + index),
      kind: p.kind,
      orbit: {
        around: s.ref,
        a: p.a,
        e: 0,
        periapsis: 0,
        phase: 0,
        periodDays: 365.25 * Math.sqrt((p.a * p.a * p.a) / s.mass),
      },
      mass: p.mass,
      radius: p.radius,
      gravity: p.gravity,
      escape: p.escape,
      temperature: p.temperature,
      pressure: p.pressure,
      air: p.air,
      water: p.water,
      radiation: p.radiation,
      because: [],
    },
    w = otherWorld(body, s, p.a, g.digest),
    made: WorldGlobe = {
      ref: body.ref,
      kind: body.kind,
      frequency: WORLD_FREQUENCY,
      elevation: w.elevation,
      temperature: w.temperature,
      precipitation: w.precipitation,
      cover: w.cover,
      craters: w.craters,
      bands: w.bands,
      storm: w.storm,
      tint: w.tint,
      air: body.air,
      water: body.water,
      // Life where seas lie about a living star old enough for it; a people where one arose.
      living: body.water === "seas" && !s.remnant && s.ageGyr >= 1,
      people: peopleOf(world, s.ref, index),
    };
  if (MADE.size >= 6) MADE.delete(MADE.keys().next().value!);
  MADE.set(key, made);
  return made;
}
