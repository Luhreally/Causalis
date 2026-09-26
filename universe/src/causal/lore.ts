// Lore in words (docs/architecture §22, §13): a people came upon a principle, or
// learned it from their neighbours; the finding cites who found it and what pressed
// or allowed them, the learning the neighbour who knew it and the road between.
import { yearOfMoment } from "../kernel/index.ts";
import { PRINCIPLE_INDEX, PRINCIPLES } from "../rules/index.ts";
import { LORE_EVENTS } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";

/** A principle's name by id: "the potter's wheel". */
export function principleName(id: string | null): string {
  const i = id === null ? undefined : PRINCIPLE_INDEX.get(id);
  return i === undefined ? "something new" : PRINCIPLES[i]!.name;
}

const principleOf = (data: unknown) => {
  const v = (data as Readonly<Record<string, unknown>> | null)?.principle;
  return typeof v === "string" ? v : null;
};

registerEventWords(
  LORE_EVENTS.found.type,
  (world, e) =>
    `In ${landWords(world, e.place)} people came upon ${principleName(principleOf(e.data))}, year ${yearOfMoment(e.t)}`,
);
registerEventWords(LORE_EVENTS.learned.type, (world, e) => {
  const land = landWords(world, e.place);
  return `${land[0]!.toUpperCase()}${land.slice(1)} learned ${principleName(principleOf(e.data))} from its neighbours, year ${yearOfMoment(e.t)}`;
});
registerDecisionWords(
  "lore.find",
  (world, d) =>
    `The people of ${landWords(world, d.subject)} came upon ${principleName(principleOf(d.outcome))}`,
);
