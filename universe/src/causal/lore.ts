// Lore in words (docs/architecture §22, §13): a people came upon a principle, or
// learned it from their neighbours; the finding cites who found it and what pressed
// or allowed them, the learning the neighbour who knew it and the road between.
import { type Ref, type World, yearOfMoment } from "../kernel/index.ts";
import { cellRef, meansOfWorld, worldChemistry } from "../gen/index.ts";
import {
  METAL_PRINCIPLES,
  PRINCIPLE_INDEX,
  PRINCIPLES,
  meansName,
  principleNameOn,
  wayById,
} from "../rules/index.ts";
import { LORE_EVENTS, MATERIALS_EVENTS, homePlanet } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { registerDecisionWords, registerEventWords } from "./why.ts";

/** Earth's principles named their own way where nothing burns (Phase 56, F3). */
const KIND_NAMED: ReadonlySet<string> = new Set(["metalworking", "steamships"]);

/**
 * A principle's name by id: "the potter's wheel". Given the world, a metal's principle is named as
 * the world's chemistry names that metal ("arsenical copper" for bronze on an arsenic world); Earth's
 * chemistry, and no world given, keep the names they have; and a kind names some its own way
 * (Phase 56: "engine-driven ships" where nothing burns).
 */
export function principleName(id: string | null, world?: World): string {
  const i = id === null ? undefined : PRINCIPLE_INDEX.get(id);
  if (i === undefined) return "something new";
  // (How its world does it, F1: "long blades of ice flakes set in a spine".)
  const own =
    world && world.hasStore("planet.home")
      ? meansName(id!, meansOfWorld(homePlanet(world).generated))
      : null;
  if (own) return own;
  const named = METAL_PRINCIPLES.has(id!) || KIND_NAMED.has(id!);
  if (!world || !named || !world.hasStore("planet.home")) return PRINCIPLES[i]!.name;
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

// A stuff a land comes to make (sim/lore/materials.ts): made first by its own crafters, or taken up from a neighbour that
// makes it. Named as the rules name it ("crucible steel", "porcelain"); its record forgotten, "a new stuff".
const stuffOf = (data: unknown) => {
  const v = (data as Readonly<Record<string, unknown>> | null)?.way;
  return (typeof v === "string" && wayById(v)?.name) || "a new stuff";
};
registerEventWords(
  MATERIALS_EVENTS.found.type,
  (world, e) =>
    `In ${landWords(world, e.place)} crafters came upon the making of ${stuffOf(e.data)}, year ${yearOfMoment(e.t)}`,
);
registerEventWords(MATERIALS_EVENTS.learned.type, (world, e) => {
  const land = landWords(world, e.place),
    from = (e.data as { from?: unknown } | null)?.from;
  return `${land[0]!.toUpperCase()}${land.slice(1)} took up the making of ${stuffOf(e.data)} from ${typeof from === "number" ? landWords(world, cellRef(0, from) as Ref) : "its neighbours"}, year ${yearOfMoment(e.t)}`;
});
registerDecisionWords(
  "lore.find",
  (world, d) =>
    `The people of ${landWords(world, d.subject)} came upon ${principleName(principleOf(d.outcome), world)}`,
);
