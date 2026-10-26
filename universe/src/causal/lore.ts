// Lore in words (docs/architecture §22, §13): a people came upon a principle, or
// learned it from their neighbours; the finding cites who found it and what pressed
// or allowed them, the learning the neighbour who knew it and the road between.
import { type World, yearOfMoment } from "../kernel/index.ts";
import { worldChemistry } from "../gen/index.ts";
import { METAL_PRINCIPLES, PRINCIPLE_INDEX, PRINCIPLES, principleNameOn } from "../rules/index.ts";
import { LORE_EVENTS, homePlanet } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";

/**
 * A principle's name by id: "the potter's wheel". Given the world, a metal's principle is named as
 * the world's chemistry names that metal ("arsenical copper" for bronze on an arsenic world); Earth's
 * chemistry, and no world given, keep the names they have.
 */
export function principleName(id: string | null, world?: World): string {
  const i = id === null ? undefined : PRINCIPLE_INDEX.get(id);
  if (i === undefined) return "something new";
  if (!world || !METAL_PRINCIPLES.has(id!) || !world.storeNames().includes("planet.home"))
    return PRINCIPLES[i]!.name;
  return principleNameOn(worldChemistry(homePlanet(world).generated), id!);
}

const principleOf = (data: unknown) => {
  const v = (data as Readonly<Record<string, unknown>> | null)?.principle;
  return typeof v === "string" ? v : null;
};

registerEventWords(
  LORE_EVENTS.found.type,
  (world, e) =>
    `In ${landWords(world, e.place)} people came upon ${principleName(principleOf(e.data), world)}, year ${yearOfMoment(e.t)}`,
);
registerEventWords(LORE_EVENTS.learned.type, (world, e) => {
  const land = landWords(world, e.place);
  return `${land[0]!.toUpperCase()}${land.slice(1)} learned ${principleName(principleOf(e.data), world)} from its neighbours, year ${yearOfMoment(e.t)}`;
});
registerDecisionWords(
  "lore.find",
  (world, d) =>
    `The people of ${landWords(world, d.subject)} came upon ${principleName(principleOf(d.outcome), world)}`,
);
