// What was lost, in words (K1): a land's crafts gone with its people, what was kept and in what, what was found again.
// What a people keeps things in is named by what they are: a hive's brood-memory, a reef's grown record, a moot's
// reciters, the songs of those with no letters. Nothing here is a real place's or anyone's; everything is read off the world.
import { yearOfMoment, type World } from "../kernel/index.ts";
import { LOST_EVENTS, type KeepForm, type LostWhy } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { principleName } from "./lore.ts";
import { raiseThe } from "./asks.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";

/** What a people's keeping is called, for a town. */
export function keptWords(
  world: World,
  form: KeepForm,
  civic: string | null,
  town: string,
): string {
  switch (form) {
    case "brood":
      return `the brood-memory of ${town}`;
    case "reef":
      return `the grown record of ${town}`;
    case "reciters":
      return `the reciters of ${town}`;
    case "songs":
      return `the songs of ${town}`;
    default:
      return `the records of ${raiseThe(world, civic ?? "shrine")} at ${town}`;
  }
}

/** Why a land fell, in a sentence's middle. */
export const FELL_WORDS: Readonly<Record<LostWhy, string>> = {
  emptied: "no one was left",
  plague: "the sickness that went through it",
  hunger: "the hunger",
  war: "the war that came to it",
  strike: "what fell on it from the air",
  quake: "the ground shaking",
  stone: "the stone that fell from the sky",
  fire: "the fire",
  flood: "the water that rose",
  left: "its people going away",
};

const data = (e: { readonly data: unknown }) =>
  e.data as {
    principle?: string;
    crafts?: string[];
    n?: number;
    then?: number;
    left?: number;
    why?: LostWhy;
    town?: string;
    form?: KeepForm;
    civic?: string | null;
    kept?: boolean;
    lostIn?: number;
    years?: number;
    archive?: number;
  } | null;

const cap = (s: string): string => `${s[0]!.toUpperCase()}${s.slice(1)}`;

registerEventWords(LOST_EVENTS.lost.type, (world, e) => {
  const d = data(e),
    first = principleName(d?.crafts?.[0] ?? null, world),
    more = (d?.n ?? 1) - 1,
    land = landWords(world, e.place);
  return `${cap(land)} lost ${first}${more > 0 ? ` and ${more} ${more === 1 ? "other craft" : "other crafts"}` : ""}, year ${yearOfMoment(e.t)}: ${FELL_WORDS[d?.why ?? "left"]}.`;
});

registerEventWords(LOST_EVENTS.kept.type, (world, e) => {
  const d = data(e);
  return `What ${landWords(world, e.place)} lost is kept in ${keptWords(world, d?.form ?? "songs", d?.civic ?? null, d?.town ?? "its town")}, year ${yearOfMoment(e.t)}.`;
});

registerEventWords(LOST_EVENTS.read.type, (world, e) => {
  const d = data(e);
  return `${cap(landWords(world, e.place))} found ${principleName(d?.principle ?? null, world)} again in ${keptWords(world, d?.form ?? "songs", d?.civic ?? null, d?.town ?? "a fallen town")}, year ${yearOfMoment(e.t)}.`;
});

registerEventWords(LOST_EVENTS.brought.type, (world, e) => {
  const d = data(e),
    first = principleName(d?.crafts?.[0] ?? null, world),
    more = (d?.n ?? 1) - 1;
  return `Those who came to ${landWords(world, e.place)} brought ${first}${more > 0 ? ` and ${more} ${more === 1 ? "other craft" : "other crafts"}` : ""} back with them, year ${yearOfMoment(e.t)}.`;
});

registerEventWords(LOST_EVENTS.lostWorld.type, (world, e) => {
  const d = data(e);
  return `${cap(principleName(d?.principle ?? null, world))} went from the world with ${landWords(world, e.place)}, year ${yearOfMoment(e.t)}: no one living knows how${d?.kept ? ", though it is kept where someone may find it" : ""}.`;
});

registerEventWords(LOST_EVENTS.foundAgain.type, (world, e) => {
  const d = data(e);
  return `${cap(landWords(world, e.place))} came to ${principleName(d?.principle ?? null, world)} again, year ${yearOfMoment(e.t)}: no one had known how for ${d?.years ?? "many"} years.`;
});

registerDecisionWords("lore.see", (world, d) => {
  const id = (d.outcome as { principle?: string } | null)?.principle ?? null;
  return `The people of ${landWords(world, d.subject)} came to ${principleName(id, world)} by living through it`;
});
