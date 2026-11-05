// How far past our ages a land has come, as its town is seen (Phase 66): the share of its folk who are
// made limbs and a mind of crystal, the craft that fly its sky, whether its ground is built over from edge
// to edge. Read from what it holds and knows. Looked at, never lived.
import { hashString, type Ref, type World } from "../kernel/index.ts";
import { offworldSite } from "../gen/index.ts";
import { COVER_PEOPLE_KM2, G, LEVEL, mirrorKw, worldDiscKm2 } from "../rules/index.ts";
import {
  lateOf,
  loreOf,
  marketsOf,
  populationContext,
  provinceCapacity,
  townsOf,
} from "../sim/index.ts";

/** The most of a town's folk who are made limbs: the rest would not be without them. */
const MOST_MACHINES = 0.45;
/** The share there are of them where a land knows how and has none to spare, and for each machine a head. */
const FIRST_MACHINES = 0.06,
  MACHINES_A_HEAD = 0.4;
/** The most craft drawn over a town. */
const MOST_FLIERS = 48;

export type LandPast = {
  readonly machines: number;
  readonly fliers: number;
  readonly covered: boolean;
  /** Whether it knows the towers: a town there has spires, and has spread as they let it. */
  readonly spires: boolean;
};

/** How far past our ages a land has come (null: it has not). */
export function landPast(world: World, cell: number): LandPast | null {
  const lore = loreOf(world),
    minds = !!lore.get(cell, "machine-minds"),
    flame = !!lore.get(cell, "fusion-power"),
    spires = !!lore.get(cell, "world-city");
  if (!minds && !flame && !spires) return null;
  const ctx = populationContext(world),
    people = ctx.provinces.get(cell)?.total() ?? 0,
    machines = marketsOf(world).get(cell)?.stock[G.machines] ?? 0,
    head = people > 0 ? machines / people : 0;
  return {
    machines: minds ? Math.min(MOST_MACHINES, FIRST_MACHINES + MACHINES_A_HEAD * head) : 0,
    fliers: Math.min(
      MOST_FLIERS,
      (flame ? 6 : 0) + (minds ? 6 : 0) + Math.round(Math.sqrt(people) / 400),
    ),
    // (Halls on another body stand on a small ground of their own: its world is not built over by them.)
    covered:
      !offworldSite(ctx.generated, cell) &&
      people >= COVER_PEOPLE_KM2 * provinceCapacity(ctx, cell).areaKm2,
    spires,
  };
}

/** Whether one of a town's many is of made limbs: their own, whichever way they are read. */
export function isMachineFolk(past: Pick<LandPast, "machines"> | null, ref: Ref | string): boolean {
  if (!past || past.machines <= 0) return false;
  return (hashString(`made ${ref}`) >>> 0) / 4294967296 < past.machines;
}

/** Its star's mirrors as its sky tells them (nothing, where it has none). */
export function mirrorsOfSky(world: World): {
  readonly mirrors?: { readonly km2: number; readonly kw: number; readonly times: number };
} {
  const m = lateOf(world)?.mirrors;
  if (!m) return {};
  const g = populationContext(world).generated,
    au = g.system.bodies[0]!.orbit.a,
    kw = mirrorKw(m.km2, g.star.luminosity, au);
  return {
    mirrors: {
      km2: m.km2,
      kw,
      times: kw / mirrorKw(worldDiscKm2(g.planet.radius), g.star.luminosity, au),
    },
  };
}

/** The lands of a world built over from edge to edge now (none, until a land knows the towers). */
export function pastLands(world: World): readonly number[] {
  const lore = loreOf(world),
    ctx = populationContext(world),
    all = ctx.provinces.all();
  if (!all.some((p) => lore.get(p.cell, "world-city"))) return [];
  return all
    .filter(
      (p) =>
        !offworldSite(ctx.generated, p.cell) &&
        p.total() >= COVER_PEOPLE_KM2 * provinceCapacity(ctx, p.cell).areaKm2,
    )
    .map((p) => p.cell);
}

/**
 * The town a world past our ages is best seen from: the most peopled of those that have raised spires, else
 * the most peopled of all. (They need not be one: a town without its land's market never comes to be a
 * city, and may hold two hundred million in houses.)
 */
export function pastTown(world: World): { ref: string; name: string; people: number } | null {
  const ctx = populationContext(world),
    towns = townsOf(world);
  type Town = ReturnType<typeof ctx.settlements.all>[number];
  const more = (a: Town, b: Town | null) =>
    !b || a.population > b.population || (a.population === b.population && a.ref < b.ref);
  let top: Town | null = null,
    spired: Town | null = null;
  for (const s of ctx.settlements.all()) {
    if (s.population <= 0 || offworldSite(ctx.generated, s.cell)) continue;
    if (more(s, top)) top = s;
    if ((towns.get(s.ref)?.homes[LEVEL.spire] ?? 0) > 0 && more(s, spired)) spired = s;
  }
  const t = spired ?? top;
  return t ? { ref: t.ref, name: t.name, people: t.population } : null;
}
