// The living world in words (docs/architecture §18, §13): the wild thinned by hunting,
// a great beast hunted out of a land, a forest cleared for fields, soils worn by
// farming — and the web of eating's turns (M84): the game multiplying where its hunters
// were driven off, the small game eating the grain, the fish grown few, the scavengers
// gone with the kills — and why: the people who pressed the land, their fields, the land
// itself.
import { yearOfMoment, type Ref } from "../kernel/index.ts";
import { ECOLOGY_EVENTS, LODE_EVENTS, WOODS_EVENTS } from "../sim/index.ts";
import { groveWhyWords, type GroveWhy } from "../rules/index.ts";
import { landWords } from "./generated.ts";
import { registerEventWords } from "./why.ts";

const num = (data: unknown, key: string) => {
  const v = (data as Readonly<Record<string, unknown>> | null)?.[key];
  return typeof v === "number" ? v : null;
};
const year = (t: number) => `year ${yearOfMoment(t)}`;

registerEventWords(WOODS_EVENTS.turn.type, (world, e) => {
  const d = e.data as { from?: number; to?: number; why?: GroveWhy; woods?: string } | null,
    woods = d?.woods ?? "woods",
    from = d?.from ?? 0,
    to = d?.to ?? 0;
  const ofLand = (n: number) =>
    n >= 100 ? "all of it" : n <= 0 ? "none of it" : `${n} parts in a hundred of it`;
  // ("from 22 parts in a hundred of it to 7": said once.)
  const towards = to > 0 && to < 100 && from > 0 && from < 100 ? `${to}` : ofLand(to);
  return `The ${woods} of ${landWords(world, e.place)} ${to > from ? "came" : "went back"}, from ${ofLand(from)} to ${towards}: ${groveWhyWords(d?.why ?? "age", `the ${woods}`)}, ${year(e.t)}`;
});
registerEventWords(LODE_EVENTS.out.type, (world, e) => {
  const d = e.data as {
      metal?: string;
      how?: string;
      from?: number | null;
      town?: string | null;
      lie?: string;
      kind?: string;
    } | null,
    metal = d?.metal ?? "ore",
    at = landWords(world, e.place),
    then =
      d?.how === "neighbour" && d.from !== null && d.from !== undefined
        ? `they haul it now from ${landWords(world, `cell:0:${d.from}` as Ref)}`
        : d?.how === "far" && d.from !== null && d.from !== undefined
          ? `they go now as far as ${landWords(world, `cell:0:${d.from}` as Ref)} for it, at a long haul`
          : d?.how === "road" && d.from !== null && d.from !== undefined
            ? `it comes now down the road from ${landWords(world, `cell:0:${d.from}` as Ref)}`
            : d?.how === "store"
              ? "they have what is in store, and no more"
              : "there is none to be had";
  // (Oil is not dug.)
  const stopped =
    d?.kind === "oil"
      ? `the wells of ${d?.town} stood dry`
      : `the diggers of ${d?.town} laid down their picks`;
  return `The ${metal} of ${at} gave out in ${year(e.t)}${d?.town ? `, and ${stopped}` : ""}: ${then}`;
});
registerEventWords(LODE_EVENTS.deeper.type, (world, e) => {
  const d = e.data as { metal?: string; reopened?: boolean; tier?: number; kind?: string } | null,
    metal = d?.metal ?? "ore",
    at = landWords(world, e.place),
    oil = d?.kind === "oil";
  if ((d?.tier ?? 1) >= 3)
    return oil
      ? `The last of the ${metal} of ${at} was drawn up by machines, for what little it still gives, ${year(e.t)}`
      : `The old heaps of the ${metal} of ${at} were sorted over by machines, for what little they still give, ${year(e.t)}`;
  if (d?.reopened)
    return `Better means reached below the old workings of the ${metal} of ${at}, and it was ${oil ? "drawn" : "dug"} again, leaner, ${year(e.t)}`;
  return oil
    ? `The ${metal} of ${at} was drawn down as deep as its people had gone, and they bored deeper for what was left, ${year(e.t)}`
    : `The ${metal} of ${at} was dug out as deep as its people had gone, and they sank deeper for ${d?.kind === "coal" ? "a thinner seam" : "leaner ore"}, ${year(e.t)}`;
});
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
