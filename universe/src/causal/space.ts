// Flight in words (docs/architecture §13, §25; Phase 5 M49): a realm's first satellite,
// first crew and first station, each told with the speed its world asked and the engine
// that gave it.
import { yearOfMoment } from "../kernel/index.ts";
import { PROPULSION } from "../rules/index.ts";
import { SPACE_EVENTS } from "../sim/index.ts";
import { registerEventWords } from "./why.ts";

type Flight = { realm?: string; speed?: number; engine?: string; stages?: number };

const engineWords = (id: string | undefined) =>
  PROPULSION.find((p) => p.id === id)?.words ?? "rockets";

for (const [kind, what] of [
  ["satellite", "sent its first satellite into orbit"],
  ["crew", "sent its first crew into orbit and brought them home"],
  ["station", "built its first station in orbit"],
] as const)
  registerEventWords(SPACE_EVENTS[kind].type, (_world, e) => {
    const d = (e.data ?? {}) as Flight;
    return `The realm of ${d.realm ?? "a people"} ${what}${d.speed ? `, gaining the ${d.speed} km/s their world asks` : ""} on ${engineWords(d.engine)}${d.stages ? ` in ${d.stages} stage${d.stages > 1 ? "s" : ""}` : ""}, year ${yearOfMoment(e.t)}`;
  });
