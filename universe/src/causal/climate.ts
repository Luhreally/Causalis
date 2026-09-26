// The air and the climate in words (docs/architecture §18, §13; Phase 3 M33): the world
// grown warmer, and why — the lands that burned and cleared most; a land's rain moved by
// the warming; a land's air fouled with smoke, and the works whose engines fouled it.
import { yearOfMoment } from "../kernel/index.ts";
import { AIR_EVENTS } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { registerEventWords } from "./why.ts";

const num = (data: unknown, key: string) => {
  const v = (data as Readonly<Record<string, unknown>> | null)?.[key];
  return typeof v === "number" ? v : null;
};
const year = (t: number) => `year ${yearOfMoment(t)}`;

registerEventWords(AIR_EVENTS.warmer.type, (_world, e) => {
  const warming = num(e.data, "warming"),
    carbon = num(e.data, "carbon");
  return `The world had grown ${warming ?? "half a degree"}${warming === null ? "" : " °C"} warmer than before the engines${carbon === null ? "" : `, its air holding ${carbon} parts in a million of carbon`}, ${year(e.t)}`;
});
registerEventWords(AIR_EVENTS.drier.type, (world, e) => {
  const rain = num(e.data, "rain");
  return `${cap(landWords(world, e.place))} grew drier as the world warmed${rain === null ? "" : `: its rain ${rain} in a hundred of what it was`}, ${year(e.t)}`;
});
registerEventWords(AIR_EVENTS.wetter.type, (world, e) => {
  const rain = num(e.data, "rain");
  return `${cap(landWords(world, e.place))} grew wetter as the world warmed${rain === null ? "" : `: its rain ${rain} in a hundred of what it was`}, ${year(e.t)}`;
});
registerEventWords(
  AIR_EVENTS.smoke.type,
  (world, e) => `The air of ${landWords(world, e.place)} grew foul with smoke, ${year(e.t)}`,
);

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
