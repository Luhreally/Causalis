// A universe's world at a year, kept between test processes and runs (see tests/worlds.ts):
//
//   const world = universeWorld(EARTH, "first light", 240);
//
// is EARTH.build(seedFromText("first light")) run to 240 * YEAR, lived now and saved, or loaded
// from the save an earlier process made under this very code: the key takes every file of the
// folders a host's world is made from (the engine, the rules, and the host's own readings).
import { YEAR, seedFromText, type World } from "../../src/kernel/index.ts";
import type { Universe } from "../../src/host/index.ts";
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
