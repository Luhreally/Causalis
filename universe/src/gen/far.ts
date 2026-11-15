// Whether a people read from afar can come, on its world as made, to the age it was read at (a world of another star
// entered, rules/far.ts). The far sight reads a followed people's years (gen/civilizations.ts) and neither its limbs nor
// its world's ground; a world made whole has both. So before anyone enters, and again on the world entered, the same
// pure reading: the crafts the tree opens to their bodies on that world's matter, in the tree's order, until every road
// to their age is met or the tree opens nothing more; and, for an age that is flown, whether anything there can build
// what flies. Where a road is shut it says which age, and why: limbs that cannot work it, matter that does not hold
// what it asks, or no fuel in the ground for works that burn.
//
// Pure functions of the generated world and what was read: no history, no draws. The later reading of followed peoples
// (their ceiling, as unfollowed peoples already have one) is meant to be read off the same.
import {
  AGE_LADDER,
  FAR_STAGE_AGE,
  PRINCIPLES,
  affordancesOf,
  affordsPrinciple,
  kindBurns,
  liftingEngine,
  matterShuts,
  needsMet,
  reachIn,
  type FarMade,
  type FarStage,
  type Principle,
} from "../rules/index.ts";
import { worldKindOf } from "./bodies.ts";
import { functionsOf, meansNumbers, meansOfWorld } from "./chemistry.ts";
import { surfaceOre, type HomeWorld } from "./homeworld.ts";

/** A road shut: the age it leads to (its id and name), and what shuts it. */
export type FarShut = {
  readonly age: string;
  readonly name: string;
  readonly why: "limbs" | "matter" | "fuel";
};

/** The roads of every age up to the one a people was read at: each a list of crafts, any one of which brings it. */
export function farRoads(
  stage: FarStage,
): { readonly age: string; readonly road: readonly string[] }[] {
  const top = AGE_LADDER.findIndex((a) => a.id === FAR_STAGE_AGE[stage]);
  return AGE_LADDER.slice(1, Math.max(1, top + 1)).flatMap((a) =>
    a.asks.flatMap((x) => (x.road ? [{ age: a.id, road: x.road }] : [])),
  );
}

/** Why the tree does not open a craft to a people on a world, of what the world alone decides (null: it does not shut it). */
function shuts(
  g: HomeWorld,
  p: Principle,
  known: (id: string) => boolean,
): "limbs" | "matter" | null {
  const body = g.life.people?.body,
    means = meansOfWorld(g),
    lifts = liftingEngine(meansNumbers(g));
  if (!body) return "limbs";
  if (!affordsPrinciple(p, body.medium, reachIn(means, known), means.wants)) return "limbs";
  if (p.body?.lifts && !(lifts !== null && known(lifts.id))) return "limbs";
  if (p.asks && matterShuts(p, functionsOf(g))) return "matter";
  return null;
}

/** The most crafts walked: the tree's whole length and to spare. */
const MOST = 400;

/**
 * The crafts a people read at a stage holds on its world: from nothing, the next the tree opens to them, again and
 * again, until every road to their age is met or the tree opens nothing more. The tree's order, "cultivation" among them.
 * (Whatever a universe's laws shut is not asked here: no road to an age lies through them.)
 */
export function farCrafts(g: HomeWorld, stage: FarStage): string[] {
  const roads = farRoads(stage).map((r) => r.road);
  if (!roads.length) return [];
  const known = new Set<string>(),
    has = (id: string) => known.has(id),
    met = () => roads.every((r) => r.some(has)),
    out: string[] = [];
  while (!met() && out.length < MOST) {
    const next = PRINCIPLES.find(
      (p) => !has(p.id) && needsMet(p, has) && shuts(g, p, has) === null && p.law === undefined,
    );
    if (!next) break;
    known.add(next.id);
    out.push(next.id);
  }
  return out;
}

/**
 * Whether a people can make machines, by what they hold and what their ground holds (rules/goods.ts). `lands`: the
 * lands they live on (coal is dug from under a land's own ground, and carried a road's length); left out, any land of
 * their world.
 */
export function machinesCan(
  g: HomeWorld,
  has: (id: string) => boolean,
  lands?: Iterable<number>,
): boolean {
  if (has("sea-works") || has("machine-minds")) return true;
  if (!has("factories")) return false;
  // (Works its own engines drive, where nothing burns or no limb tends a fire.)
  const body = g.life.people?.body;
  if (!kindBurns(worldKindOf(g)) || (body && !affordancesOf(body).fire)) return true;
  const e = g.tectonics.elevation;
  if (lands) {
    for (const c of lands) if (surfaceOre(g, c, "coal")) return true;
    return false;
  }
  for (let c = 0; c < g.grid.count; c++) if (e[c]! > 0 && surfaceOre(g, c, "coal")) return true;
  return false;
}

/** The stages read of a people that has flown: what machines alone build (sim/space/space.ts). */
export const FLOWN: readonly FarStage[] = ["orbit", "stars"];

/**
 * The first road to the age a people was read at that is shut to them on this world, and why (null: none is). `has`:
 * what they hold (their cradle's lore, on a world entered); left out, what the tree opens to them from nothing.
 * `lands`: the lands they live on, for the fuel under them; left out, any land of their world.
 */
export function farShut(
  g: HomeWorld,
  far: Pick<FarMade, "stage">,
  has?: (id: string) => boolean,
  lands?: Iterable<number>,
): FarShut | null {
  let held = has;
  if (!held) {
    const known = new Set(farCrafts(g, far.stage));
    held = (id) => known.has(id);
  }
  const holds = held,
    name = (age: string) => AGE_LADDER.find((a) => a.id === age)?.name ?? age,
    road = farRoads(far.stage).find((r) => !r.road.some(holds));
  if (road) {
    // (What shuts it: a craft of the road, or the nearest craft it needs, that the tree will not open to them.)
    const why = (id: string, seen: Set<string>): "limbs" | "matter" | null => {
      if (seen.has(id) || holds(id)) return null;
      seen.add(id);
      const p = PRINCIPLES.find((x) => x.id === id);
      if (!p) return null;
      for (const n of p.needs ?? []) {
        const deeper = why(n, seen);
        if (deeper) return deeper;
      }
      return shuts(g, p, holds);
    };
    const seen = new Set<string>();
    let found: "limbs" | "matter" | null = null;
    for (const id of road.road) found ??= why(id, seen);
    return { age: road.age, name: name(road.age), why: found ?? "limbs" };
  }
  if (FLOWN.includes(far.stage) && !machinesCan(g, holds, lands))
    return { age: "orbit", name: name("orbit"), why: "fuel" };
  return null;
}

/** What shuts a road, in a few words for a sentence ("…: no fuel in its ground"). */
export const FAR_SHUT_WORDS: Readonly<Record<FarShut["why"], string>> = {
  limbs: "their limbs cannot work what leads to it",
  matter: "its matter does not hold what that asks",
  fuel: "no fuel in its ground for the works that build what flies",
};
