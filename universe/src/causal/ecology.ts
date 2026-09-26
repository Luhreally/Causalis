// The living world in words (docs/architecture §18, §13): the wild thinned by hunting,
// a great beast hunted out of a land, a forest cleared for fields, soils worn by
// farming — and why: the people who pressed the land, their fields, the land itself.
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
registerEventWords(ECOLOGY_EVENTS.cleared.type, (world, e) => {
  const left = num(e.data, "forest");
  return `The forests of ${landWords(world, e.place)} were cleared for fields${left === null ? "" : `: ${left} parts in a hundred still stand`}, ${year(e.t)}`;
});
registerEventWords(ECOLOGY_EVENTS.worn.type, (world, e) => {
  const left = num(e.data, "soil");
  return `The soils of ${landWords(world, e.place)} wore thin under the plough${left === null ? "" : `: ${left} parts in a hundred of their strength`}, ${year(e.t)}`;
});
