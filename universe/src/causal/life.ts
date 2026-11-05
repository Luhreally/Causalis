// A life lived by the god's hand in words (Lives L3): the chronicle's lines and their pages'.
import { yearOfMoment } from "../kernel/index.ts";
import { LIFE_WANTS, type WantId } from "../rules/index.ts";
import { LIFE_EVENTS } from "../sim/index.ts";
import { registerCommandWords, registerEventWords } from "./why.ts";

const first = (name: unknown): string =>
  typeof name === "string" && name ? name.replace(/ of .*$/, "") : "one of their people";

type D = {
  name?: string;
  town?: string;
  heirOf?: string | null;
  toName?: string;
  want?: WantId;
  good?: string;
  cost?: number;
  won?: boolean;
  took?: number;
  years?: number;
  died?: boolean;
} | null;

registerEventWords(LIFE_EVENTS.begun.type, (_, e) => {
  const d = e.data as D;
  return `By your hand: you took up the life of ${first(d?.name)} of ${d?.town ?? "their town"}${d?.heirOf ? `, going on from ${first(d.heirOf)}` : ""}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(LIFE_EVENTS.ended.type, (_, e) => {
  const d = e.data as D;
  return `You let go of the life of ${first(d?.name)}${d?.died ? ", who died" : ""}, after ${d?.years ?? 0} years, year ${yearOfMoment(e.t)}`;
});
registerEventWords(LIFE_EVENTS.wed.type, (_, e) => {
  const d = e.data as D;
  return `By your hand: ${first(d?.name)} married ${first(d?.toName)}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(LIFE_EVENTS.child.type, (_, e) => {
  const d = e.data as D;
  return `A child was born to ${first(d?.name)}, in whom the god lived, year ${yearOfMoment(e.t)}`;
});
registerEventWords(LIFE_EVENTS.lost.type, (_, e) => {
  const d = e.data as D;
  return `${first(d?.name)}, in whom the god lived, lost one of their own, year ${yearOfMoment(e.t)}`;
});
registerEventWords(LIFE_EVENTS.want.type, (_, e) => {
  const d = e.data as D;
  return `By your hand: ${first(d?.name)} won what they wanted: ${d?.want ? LIFE_WANTS[d.want].label.toLowerCase() : "their heart's want"}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(LIFE_EVENTS.bought.type, (_, e) => {
  const d = e.data as D;
  return `By your hand: ${first(d?.name)} bought ${d?.good === "tool" ? "a better tool" : "good clothes"} for ${d?.cost} coin, out of the town's stores, year ${yearOfMoment(e.t)}`;
});
registerEventWords(LIFE_EVENTS.faced.type, (_, e) => {
  const d = e.data as D;
  return `By your hand: ${first(d?.name)} had it out with a rival before the town, and ${d?.won ? "carried it" : "came off worse"}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(LIFE_EVENTS.rival.type, (_, e) => {
  const d = e.data as D;
  return `A rival moved against ${first(d?.name)}, in whom the god lived${d?.took ? `: ${d.took} coin lost` : ""}, year ${yearOfMoment(e.t)}`;
});

for (const [type, words] of [
  ["life.begin", "you took up one of their lives"],
  ["life.do", "you chose how a life you live spends its hours"],
  ["life.buy", "you bought a thing in the life you live"],
  ["life.habit", "you chose how the days of a life you live go on"],
  ["life.want", "you chose what a life you live wants"],
  ["life.answer", "you answered for a life you live"],
  ["life.heir", "you went on as one of a dead one's family"],
  ["life.end", "you let go of a life"],
] as const)
  registerCommandWords(type, (_, c) => `Your act: ${words}, year ${yearOfMoment(c.t)}`);
