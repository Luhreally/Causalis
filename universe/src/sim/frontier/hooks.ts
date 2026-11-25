// What the Frontier lays on the lands, read where the population's year reads its sky, its fields and its rain
// (population/systems.ts). Each exactly 1 where nothing of it has happened, so a world without it runs as it did.
//   frontierSky: on the home world's people, a storm past what they know (weather.ts) and a burst from the galaxy
//     (galactic.ts); on halls of another body or star, their star's mean storms at their world and a burst by their own
//     distance from it; aboard a ship still crossing, the dark's toll at its speed (rules/crossing.ts).
//   frontierFields, frontierRain: the great stones' dust (impacts.ts) and a burst's light on leaves (galactic.ts).
import { type Ref, type World } from "../../kernel/index.ts";
import { offworldSite } from "../../gen/index.ts";
import {
  STAR_DRIVES,
  cruise,
  darkToll,
  flareRate,
  hallsUnder,
  meanStorms,
} from "../../rules/index.ts";
import { homePlanet } from "../planet/store.ts";
import type { PopulationContext } from "../population/systems.ts";
import { clusterOf, starSitesOf } from "../space/stars.ts";
import { worldsOf } from "../space/voyages.ts";
import { weatherHarm } from "./weather.ts";
import { burstAt, burstHarmNow } from "./galactic.ts";
import { shieldUnder, type ShieldNow } from "./shield.ts";
import { dustFields, dustRain } from "./impacts.ts";

type Halls = {
  readonly factor: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

/** Halls under a star: its mean storms at their world, buried or not, and where the star lies (kept: pure of the seed). */
const HALLS = new Map<string, Halls>();
function hallsOf(world: World, key: string, make: () => Halls): Halls {
  const k = `${world.seed.text}|${key}`;
  let h = HALLS.get(k);
  if (!h) {
    if (HALLS.size > 512) HALLS.clear();
    HALLS.set(k, (h = make()));
  }
  return h;
}

/** Halls on a body of the home system. */
export function homeHalls(world: World, body: number): Halls {
  return hallsOf(world, `b${body}`, () => {
    const g = homePlanet(world).generated,
      b = g.system.bodies[body];
    if (!b) return { factor: 1, x: 0, y: 0, z: 0 };
    const parent =
        b.orbit.around === g.star.ref ? b : g.system.bodies.find((x) => x.ref === b.orbit.around),
      au = parent?.orbit.a ?? b.orbit.a,
      mean = meanStorms(flareRate(g.star.mass, g.star.ageGyr), au);
    return { factor: hallsUnder(mean, b.radiation > 3), x: 0, y: 0, z: 0 };
  });
}

/** Halls on a world of another star. */
export function starHalls(world: World, star: Ref, planet: number): Halls {
  return hallsOf(world, `${star}/${planet}`, () => {
    const s = clusterOf(world).find((x) => x.ref === star);
    if (!s) return { factor: 1, x: 0, y: 0, z: 0 };
    const p = worldsOf(world, s)[planet],
      mean = p ? meanStorms(flareRate(s.mass, s.ageGyr), p.a) : 0;
    return { factor: hallsUnder(mean, !!p && p.radiation > 3), x: s.x, y: s.y, z: s.z };
  });
}

/** What the dark lays on those aboard a ship on a drive (1: none, or no such drive). */
export function shipToll(drive: string): number {
  const d = STAR_DRIVES.find((x) => x.id === drive);
  return d ? darkToll(cruise(d)) : 1;
}

/** What the Frontier lays on a land's people's deaths this month (1: nothing). */
export function frontierSky(ctx: PopulationContext, cell: number): number {
  const world = ctx.world,
    site = offworldSite(ctx.generated, cell);
  if (!site) return weatherHarm(world) * burstHarmNow(world);
  if (site.body >= 0) return homeHalls(world, site.body).factor * burstAt(world, 0, 0, 0);
  const ship = starSitesOf(world)?.get(cell);
  if (!ship) return 1;
  if (!ship.arrived) return shipToll(ship.drive);
  const h = starHalls(world, ship.star, ship.planet);
  return h.factor * burstAt(world, h.x, h.y, h.z);
}

/** The home world's shield against its star's hard light this year: whole, or stripped by a burst's light or a flare. */
export function shieldNow(world: World): ShieldNow {
  return shieldUnder(world, burstHarmNow(world), weatherHarm(world));
}

/** What the Frontier leaves of a land's fields (1: all; and all of a land of another body, farmed under roofs). */
export function frontierFields(world: World, cell: number): number {
  if (offworldSite(homePlanet(world).generated, cell)) return 1;
  // (What a burst or a great flare strips of its shield lets more of its star's hard light onto its fields: frontier/shield.ts.)
  return dustFields(world) * shieldNow(world).fields;
}

/** What the Frontier leaves of a land's rain (1: all). */
export function frontierRain(world: World): number {
  return dustRain(world);
}
