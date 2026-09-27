// Worlds in depth, asked for (Phase 8 M81): a body of the home star's system made whole on
// demand and kept for a while (a few at a time: making one takes a moment). Looked at,
// never lived: nothing here enters history, and the same body is always the same world.
import type { World } from "../kernel/index.ts";
import { WORLD_FREQUENCY, otherWorld } from "../gen/index.ts";
import { homePlanet } from "../sim/index.ts";
import type { WorldGlobe } from "../bridge/index.ts";

const MADE = new Map<string, WorldGlobe>();
/** Worlds kept made at once. */
const KEPT = 6;

export function worldGlobe(world: World, ref: string): WorldGlobe {
  const g = homePlanet(world).generated,
    key = `${g.digest} ${ref}`,
    known = MADE.get(key);
  if (known) return known;
  const bodies = g.system.bodies,
    body = bodies.find((b) => b.ref === ref);
  if (!body) throw new Error(`no world ${ref}`);
  // (A moon is as far from the star as its planet.)
  const parent = body.kind === "moon" ? bodies.find((b) => b.ref === body.orbit.around) : undefined,
    au = parent ? parent.orbit.a : body.orbit.a,
    w = otherWorld(body, g.star, au, g.digest),
    made: WorldGlobe = {
      ref,
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
      // (Of the home star's worlds, only home lives.)
      living: false,
      people: null,
    };
  if (MADE.size >= KEPT) MADE.delete(MADE.keys().next().value!);
  MADE.set(key, made);
  return made;
}
