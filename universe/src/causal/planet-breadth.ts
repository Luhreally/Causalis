// The planet's breadth in words (2026-11-23): a great storm ashore and the warm sea it came off; a land's slopes failed after a
// wet year, with the woods left to hold them; the seas soured by the carbon they took up; the frozen ground thawing and its
// carbon rotting into the air.
import { yearOfMoment } from "../kernel/index.ts";
import { AIR_EVENTS, RIVER_EVENTS, SHIELD_EVENTS, STORM_EVENTS } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { registerEventWords } from "./why.ts";
import { count } from "./words.ts";

const num = (data: unknown, key: string) => {
  const v = (data as Readonly<Record<string, unknown>> | null)?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};
const year = (t: number) => `year ${yearOfMoment(t)}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dead = (n: number | null) => (n ? `, ${count(n)} dead` : "");

registerEventWords(STORM_EVENTS.storm.type, (world, e) => {
  const sea = num(e.data, "sea"),
    fields = num(e.data, "fields");
  return `A great storm came ashore on ${landWords(world, e.place)} off a sea${sea === null ? "" : ` at ${sea} degrees`}, ${year(e.t)}${fields === null ? "" : `: ${fields} in a hundred of its harvest drowned`}${dead(num(e.data, "dead"))}`;
});
registerEventWords(STORM_EVENTS.slide.type, (world, e) => {
  const rain = num(e.data, "rain"),
    woods = num(e.data, "woods");
  return `${cap(landWords(world, e.place))}'s slopes gave way, ${year(e.t)}${rain === null ? "" : `, its rain ${Math.round(rain / 10)}% of the usual`}${woods === null ? "" : ` and ${woods} in a hundred of its woods left to hold them`}${dead(num(e.data, "dead"))}`;
});
registerEventWords(AIR_EVENTS.soured.type, (_world, e) => {
  const ph = num(e.data, "ph"),
    shells = num(e.data, "shells");
  return `The seas had grown ${ph === null ? "more" : `${ph} of a pH more`} acid with the carbon they took up, ${year(e.t)}${shells === null ? "" : `: their shells and reefs giving ${shells} in a hundred of what they gave`}`;
});
registerEventWords(AIR_EVENTS.thawing.type, (_world, e) => {
  const rotted = num(e.data, "rotted"),
    warming = num(e.data, "warming");
  return `The frozen ground was thawing${warming === null ? "" : ` under a world ${warming} °C warmer`}, ${year(e.t)}${rotted === null ? "" : `: ${rotted} parts in a million of its old carbon rotted into the air`}`;
});
registerEventWords(RIVER_EVENTS.moved.type, (world, e) => {
  const drop = num(e.data, "drop");
  return `The river of ${landWords(world, e.place)} broke out of its bed in a great flood and kept the lower way across its plain${drop === null || drop <= 0 ? "" : `, ${count(drop)} m below its old bed`}, ${year(e.t)}`;
});
registerEventWords(SHIELD_EVENTS.thinned.type, (_world, e) => {
  const left = num(e.data, "left"),
    hard = num(e.data, "hard"),
    fields = num(e.data, "fields");
  return `The world's shield against its star's hard light was stripped${left === null ? "" : ` to ${left} in a hundred of its ozone`}${hard === null ? "" : `: ${hard} times the hard light at its ground`}${fields === null ? "" : `, its open fields giving ${fields} in a hundred of what they gave`}, ${year(e.t)}`;
});
registerEventWords(AIR_EVENTS.dimmed.type, (_world, e) => {
  const masked = num(e.data, "masked"),
    cleared = (e.data as { cleared?: boolean } | null)?.cleared ?? false;
  return cleared
    ? `The haze of what the world burned thinned${masked === null ? "" : ` to hide ${masked} °C`}, and the warming it had hidden began to show, ${year(e.t)}`
    : `The haze of what the world burned dimmed its sky${masked === null ? "" : `, hiding ${masked} °C of the warming its carbon was storing up`}, ${year(e.t)}`;
});
