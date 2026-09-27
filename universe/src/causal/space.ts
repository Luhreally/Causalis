// Flight in words (docs/architecture §13, §25; Phase 5 M49): a realm's first satellite,
// first crew and first station, each told with the speed its world asked and the engine
// that gave it.
import { yearOfMoment } from "../kernel/index.ts";
import { PROPULSION, STAR_DRIVES } from "../rules/index.ts";
import {
  CONTACT_EVENTS,
  GREAT_ACT_EVENTS,
  SPACE_EVENTS,
  STARWAR_EVENTS,
  VOYAGE_EVENTS,
} from "../sim/index.ts";
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

registerEventWords(SPACE_EVENTS.colony.type, (_world, e) => {
  const d = (e.data ?? {}) as { realm?: string; body?: string; settlers?: number };
  return `The realm of ${d.realm ?? "a people"} set ${d.settlers ?? "its first"} settlers down in sealed halls on ${d.body ?? "another world"}, year ${yearOfMoment(e.t)}`;
});

registerEventWords(VOYAGE_EVENTS.sailed.type, (_world, e) => {
  const d = (e.data ?? {}) as { realm?: string; distance?: number; years?: number; drive?: string };
  const drive = STAR_DRIVES.find((x) => x.id === d.drive)?.words ?? "a starship";
  return `The realm of ${d.realm ?? "a people"} sent a ship to a star ${d.distance ?? "?"} light-years away, on ${drive}: ${d.years ?? "many"} years on the way, its people living and dying aboard, year ${yearOfMoment(e.t)}`;
});
registerEventWords(VOYAGE_EVENTS.arrived.type, (_world, e) => {
  const d = (e.data ?? {}) as { distance?: number; people?: number };
  return `A ship came to its star ${d.distance?.toFixed(1) ?? "?"} light-years from home, and its ${d.people ?? ""} people went down into halls on a world there, year ${yearOfMoment(e.t)}`;
});

registerEventWords(CONTACT_EVENTS.heard.type, (_world, e) => {
  const d = (e.data ?? {}) as { realm?: string; distance?: number; clade?: string; sent?: number };
  return `The realm of ${d.realm ?? "a people"} heard the signals of another people — ${d.clade ?? "strangers"}, of a world ${d.distance ?? "?"} light-years away — sent in our year ${d.sent ?? "?"}, heard only now, year ${yearOfMoment(e.t)}`;
});

registerEventWords(STARWAR_EVENTS.declared.type, (_world, e) => {
  const d = (e.data ?? {}) as { realm?: string; distance?: number; years?: number };
  return `The realm of ${d.realm ?? "a people"} went to war across ${d.distance ?? "?"} light-years, its fleet to be ${d.years ?? "many"} years on the way, year ${yearOfMoment(e.t)}`;
});
registerEventWords(STARWAR_EVENTS.battle.type, (_world, e) => {
  const d = (e.data ?? {}) as { won?: boolean };
  return `A fleet came at last to its war among the stars, and ${d.won ? "won" : "was lost"}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(STARWAR_EVENTS.peace.type, (_world, e) => {
  const d = (e.data ?? {}) as { won?: boolean };
  return `The war among the stars ended, ${d.won ? "the fleet's realm the victor" : "its fleet lost"}, year ${yearOfMoment(e.t)}`;
});

registerEventWords(GREAT_ACT_EVENTS.warm.type, (_world, e) => {
  const d = (e.data ?? {}) as { sign?: number; years?: number };
  return `By your hand the whole world grew ${d.sign === -1 ? "colder" : "warmer"} for ${d.years ?? "some"} years, year ${yearOfMoment(e.t)}`;
});
registerEventWords(GREAT_ACT_EVENTS.flare.type, (_world, e) => {
  const d = (e.data ?? {}) as { sign?: number; years?: number };
  return `By your hand a star ${d.sign === -1 ? "flared, its light deadlier to all under it" : "grew calm, its light kinder"} for ${d.years ?? "some"} years, year ${yearOfMoment(e.t)}`;
});
