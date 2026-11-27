// A universe's world at a year, kept between test processes and runs (see tests/worlds.ts):
//
//   const world = universeWorld(EARTH, "first light", 240);
//
// is EARTH.build(seedFromText("first light")) run to 240 * YEAR, lived now and saved, or loaded
// from the save an earlier process made under this very code: the key takes every file of the
// folders a host's world is made from (the engine, the rules, and the host's own readings).
import { YEAR, loadWorld, saveWorld, seedFromText, type World } from "../../src/kernel/index.ts";
import { populationContext, townsOf, type Settlement } from "../../src/sim/index.ts";
import { enterPlace, type Place } from "../../src/host/place.ts";
import { ALIEN, EARTH, type Universe } from "../../src/host/index.ts";
import { PEOPLED_FROM, keptWorld } from "../worlds.ts";

/** The folders of src a host's world is made from (tools/lint-rules.ts: all the host may import). */
export const HOSTED_FROM = [...PEOPLED_FROM, "causal", "bridge", "host"];

/** The world a universe builds for a seed, run to the turn of a year (or, with `t`, that moment). */
export function universeWorld(
  universe: Universe,
  seedText: string,
  years: number,
  t: number = years * YEAR,
): World {
  return keptWorld(
    [`${universe.name}`, seedText, universe.version],
    HOSTED_FROM,
    () => universe.build(seedFromText(seedText)),
    t,
  );
}

/**
 * The world the place tests are read on: EARTH's "first light" unless PLACE_WORLD names another, as `earth:<seed>` or
 * `alien:<seed>` (`PLACE_WORLD="alien:first light" node --test tests/host/place-orders.test.ts`). Each test asks of it
 * what it needs (a town with a battle's wounded, a crafter whose making takes stuff, ...) and does not lean on how one
 * world happens to be: read on a second world, a test that leans on its first fails or says what that world lacks.
 */
export const PLACE_WORLD = process.env.PLACE_WORLD ?? "earth:first light";
/** The universe of PLACE_WORLD (what its saves are read back with). */
export const PLACE_UNIVERSE: Universe = PLACE_WORLD.startsWith("alien:") ? ALIEN : EARTH;
export function placeWorld(years: number, t?: number): World {
  const at = PLACE_WORLD.indexOf(":"),
    kind = at < 0 ? "earth" : PLACE_WORLD.slice(0, at),
    seed = at < 0 ? PLACE_WORLD : PLACE_WORLD.slice(at + 1);
  return universeWorld(kind === "alien" ? ALIEN : EARTH, seed, years, t);
}
/** Whether the place tests are read on a world other than their own (where what it lacks is said, not failed). */
export const PLACE_ELSEWHERE = PLACE_WORLD !== "earth:first light";

/**
 * The town of a world a place test needs, by what it needs of it, not by how big one world's towns happen to be: of the
 * held towns with fabric, of `least` people and more, nearest `near` people first, the first whose place, entered, has
 * it; or null. `need` reads the place as it is entered and runs nothing (all are entered on one copy of the world): what
 * a test needs later, it reads on its own copy.
 */
export function townWhere(
  w: World,
  need: (place: Place, world: World, s: Settlement) => boolean,
  {
    near = 600,
    least = 100,
    most = Infinity,
  }: { near?: number; least?: number; most?: number } = {},
): Settlement | null {
  const ctx = populationContext(w),
    towns = ctx.settlements
      .all()
      .filter((s) => ctx.settlements.held(s.ref) && townsOf(w).get(s.ref) && s.population >= least)
      .sort(
        (a, b) =>
          Math.abs(a.population - near) - Math.abs(b.population - near) || (a.ref < b.ref ? -1 : 1),
      ),
    copy = loadWorld(
      JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name }))),
      (x) => PLACE_UNIVERSE.build(x),
      "r",
    ).world;
  for (const s of towns.slice(0, most)) {
    const place = enterPlace(copy, s.ref);
    if (place && need(place, copy, s)) return s;
  }
  return null;
}

/** A test's town where the world it is read on has none such: said, and the test passed over, on a world not its own. */
export function noTown(t: { skip: (why: string) => void }, what: string): null {
  if (!PLACE_ELSEWHERE) throw new Error(`no town of ${PLACE_WORLD} ${what}`);
  t.skip(`no town of ${PLACE_WORLD} ${what}`);
  return null;
}
