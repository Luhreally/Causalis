// Life elsewhere, as the host reads it (Phase 18 M132): what lives on each world of another
// star, and on the home star's other worlds and moons — drawn from the generated worlds
// alone (gen/elsewhere.ts) and kept a while, since sketching a world's bodies takes a moment.
// Looked at, never lived: nothing here enters history.
import { Rng, type World } from "../kernel/index.ts";
import {
  foreignPlanets,
  lifeElsewhere,
  starAgeGyr,
  type Elsewhere,
  type GalaxyStar,
  type SystemBody,
} from "../gen/index.ts";
import { civilizationsNear, homePlanet } from "../sim/index.ts";

const KEPT = new Map<string, Elsewhere>();

function keep(key: string, make: () => Elsewhere): Elsewhere {
  const known = KEPT.get(key);
  if (known) return known;
  const made = make();
  if (KEPT.size >= 96) KEPT.delete(KEPT.keys().next().value!);
  KEPT.set(key, made);
  return made;
}

/** Whether a star ref ("star:sector:k") names the same star as one drawn (under either name). */
export function sameStar(ref: string, s: Pick<GalaxyStar, "sector" | "k">): boolean {
  const parts = ref.split(":");
  return parts[0] === "star" && Number(parts[1]) === s.sector && Number(parts[2]) === s.k;
}

/** The civilization that rose on a star's world, if one did (by the star itself, not its name). */
export function civilizationOn(world: World, s: GalaxyStar, index: number) {
  return civilizationsNear(world).find((c) => c.planet === index && sameStar(c.star, s));
}

/** What lives on another star's world (its place outward). */
export function lifeOfWorld(world: World, s: GalaxyStar, index: number): Elsewhere {
  const g = homePlanet(world).generated;
  return keep(`${g.digest} ${s.sector}:${s.k} ${index}`, () => {
    const rng = new Rng(world.seed),
      p = foreignPlanets(rng, s)[index];
    if (!p) throw new Error(`no world ${index} of ${s.ref}`);
    return lifeElsewhere(rng, s, p, !!civilizationOn(world, s, index));
  });
}

/** What lives on a body of the home star's own: its other worlds and their moons. */
export function lifeOfBody(world: World, body: SystemBody): Elsewhere | null {
  const g = homePlanet(world).generated;
  if (body.kind === "home") return null;
  return keep(`${g.digest} home ${body.ref}`, () => {
    // (A moon is as far from the star as its planet.)
    const parent =
        body.kind === "moon" ? g.system.bodies.find((b) => b.ref === body.orbit.around) : undefined,
      a = parent ? parent.orbit.a : body.orbit.a;
    return lifeElsewhere(
      new Rng(world.seed),
      {
        sector: 0,
        k: 0,
        ageGyr: starAgeGyr(g.star),
        remnant: false,
        spectral: g.star.spectral,
        luminosity: g.star.luminosity,
      },
      { ...body, a },
    );
  });
}
