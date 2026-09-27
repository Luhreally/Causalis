// The living world in words (docs/architecture §18, §13): the wild thinned by hunting,
// a great beast hunted out of a land, a forest cleared for fields, soils worn by
// farming — and the web of eating's turns (M84): the game multiplying where its hunters
// were driven off, the small game eating the grain, the fish grown few, the scavengers
// gone with the kills — and why: the people who pressed the land, their fields, the land
// itself.
import { yearOfMoment } from "../kernel/index.ts";
import { ECOLOGY_EVENTS } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { registerEventWords } from "./why.ts";

const num = (data: unknown, key: string) => {
  const v = (data as Readonly<Record<string, unknown>> | null)?.[key];
  return typeof v === "number" ? v : null;
};
const year = (t: number) => `year ${yearOfMoment(t)}`;

registerEventWords(ECOLOGY_EVENTS.thinned.type, (world, e) => {
  const left = num(e.data, "wild");
  return `The game of ${landWords(world, e.place)} grew scarce under the hunt${left === null ? "" : `: ${left} parts in a hundred of what it was`}, ${year(e.t)}`;
});
registerEventWords(ECOLOGY_EVENTS.huntedOut.type, (world, e) => {
  const beast = (e.data as { beast?: unknown } | null)?.beast;
  return `The last ${typeof beast === "string" ? beast : "great beasts"} of ${landWords(world, e.place)} were hunted out, ${year(e.t)}`;
});
registerEventWords(ECOLOGY_EVENTS.huntersGone.type, (world, e) => {
  const beast = (e.data as { beast?: unknown } | null)?.beast;
  return typeof beast === "string"
    ? `The ${beast} was driven out of ${landWords(world, e.place)}, ${year(e.t)}`
    : `The hunters were driven out of ${landWords(world, e.place)}, ${year(e.t)}`;
});
registerEventWords(ECOLOGY_EVENTS.flocksTaken.type, (world, e) => {
  const beast = (e.data as { beast?: unknown } | null)?.beast,
    share = num(e.data, "share");
  return `The ${typeof beast === "string" ? beast : "hunters"} of ${landWords(world, e.place)} took ${share === null ? "many" : `${share} in a hundred`} of its flocks a year, ${year(e.t)}`;
});
registerEventWords(ECOLOGY_EVENTS.cleared.type, (world, e) => {
  const left = num(e.data, "forest");
  return `The forests of ${landWords(world, e.place)} were cleared for fields${left === null ? "" : `: ${left} parts in a hundred still stand`}, ${year(e.t)}`;
});
registerEventWords(ECOLOGY_EVENTS.multiplied.type, (world, e) => {
  const beast = (e.data as { beast?: unknown } | null)?.beast,
    wild = num(e.data, "wild");
  return `With the ${typeof beast === "string" ? beast : "hunters"} thinned and driven off, the game of ${landWords(world, e.place)} multiplied${wild === null ? "" : ` to ${wild} parts in a hundred of what it was`}, ${year(e.t)}`;
});
registerEventWords(ECOLOGY_EVENTS.grainEaten.type, (world, e) => {
  const beast = (e.data as { beast?: unknown } | null)?.beast,
    share = num(e.data, "share");
  return `The ${typeof beast === "string" ? beast : "small game"} of ${landWords(world, e.place)} ate ${share === null ? "much" : `${share} in a hundred`} of its grain, its small hunters driven off, ${year(e.t)}`;
});
registerEventWords(ECOLOGY_EVENTS.fishFew.type, (world, e) => {
  const left = num(e.data, "fish");
  return `The fish of ${landWords(world, e.place)} grew few, fished hard${left === null ? "" : `: ${left} parts in a hundred of what they were`}, ${year(e.t)}`;
});
registerEventWords(ECOLOGY_EVENTS.scavengersLeft.type, (world, e) => {
  const beast = (e.data as { beast?: unknown } | null)?.beast;
  return `The ${typeof beast === "string" ? beast : "scavengers"} left ${landWords(world, e.place)}, the kills it lived on gone, ${year(e.t)}`;
});
registerEventWords(ECOLOGY_EVENTS.worn.type, (world, e) => {
  const left = num(e.data, "soil");
  return `The soils of ${landWords(world, e.place)} wore thin under the plough${left === null ? "" : `: ${left} parts in a hundred of their strength`}, ${year(e.t)}`;
});
