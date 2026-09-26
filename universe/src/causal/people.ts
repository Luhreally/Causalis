// Explanations for the people met (docs/architecture §13): a person is where they
// are because of the moves they made and the village they live in; a farmer
// because farming came; one of the first people because the first people began
// there. A memory is of an event, and that event's own why goes on from there —
// to the famine, the drought, the land, the planet.
import { YEAR, kindCodeOf, type CauseRef, type Ref, type World } from "../kernel/index.ts";
import { OCC, OCCUPATIONS } from "../rules/index.ts";
import { populationContext } from "../sim/index.ts";
import { HOUSEHOLD, MEMORY, PERSON, observer, settleAll } from "./observer.ts";
import { edges, registerEventKeeper, registerExplainer } from "./why.ts";

const OCCUPATION_WORDS = ["child", "forager", "farmer", "herder", "crafter", "trader", "leader"];
/** A life's events, in words for a list of them. */
export const LIFE_WORDS: Readonly<Record<string, string>> = {
  famine: "Lived through a famine",
  drought: "Lived through a dry year",
  cultivation: "Saw the first fields sown",
  "farming-came": "Saw farming come to the land",
  founded: "Saw the village founded",
  moved: "Set out for new land",
  "took-up-farming": "Took up farming",
  "food-came": "Saw food come from neighbours in a famine",
  "metal-came": "Saw copper tools come to the land",
  "market-town": "Saw the market town grow up",
  "road-opened": "Saw the first traders come down a new road",
  "took-up-craft": "Took up a craft",
  "took-up-trade": "Took up trading",
  "took-up-herding": "Took up herding",
  "kept-old-ways": "Kept to gathering, though their people farmed",
  "chosen-to-lead": "Was chosen to lead their village",
  "took-up-leading": "Came of age among those who lead",
  plague: "Lived through the plague",
  "died-plague": "Fell sick in the plague",
  healing: "Saw the sick healed",
  blight: "Saw the harvest blighted",
  "good-years": "Saw years of plenty",
  rains: "Saw the rains come in abundance",
  inspired: "Saw their people learn something new, as if by inspiration",
  shrine: "Saw a shrine rise in their land, by the god's own hand",
  fire: "Saw the city burn",
  spring: "Saw a spring well up from dry ground",
};
/** What a memory is of, in words. */
export const MEMORY_WORDS: Readonly<Record<string, string>> = {
  famine: "the famine",
  drought: "the dry year",
  cultivation: "the first fields being sown",
  "farming-came": "farming coming to the land",
  founded: "the founding of the village",
  moved: "setting out for new land",
  "took-up-farming": "taking up farming",
  "food-came": "the food that came in the famine",
  "metal-came": "the first copper tools",
  "market-town": "the market town growing up",
  "road-opened": "the first traders coming down the road",
  "took-up-craft": "learning their craft",
  "took-up-trade": "their first journey with goods",
  "took-up-herding": "their first flock",
  "kept-old-ways": "keeping to the old ways of gathering",
  "chosen-to-lead": "being chosen to lead",
  "took-up-leading": "their first council among the leaders",
  plague: "the plague",
  "died-plague": "the sickness",
  healing: "the sick being healed",
  blight: "the blighted harvest",
  "good-years": "the years of plenty",
  rains: "the great rains",
  inspired: "the inspiration that came to their people",
  shrine: "the shrine rising",
  fire: "the great fire",
  spring: "the spring welling up",
};

function hasPeople(world: World): boolean {
  return (
    world.storeNames().includes("observer.ledger") &&
    world.storeNames().includes("population.provinces")
  );
}

registerExplainer(PERSON.code, (world, ref) => {
  if (!hasPeople(world)) return null;
  const person = observer(world).person(ref);
  if (!person) return null;
  // Whoever is asked about is followed to now first.
  settleAll(world);
  const ctx = populationContext(world),
    now = Math.floor(world.now / YEAR),
    village = person.village ? ctx.settlements.get(person.village) : undefined,
    job = OCCUPATION_WORDS[person.occupation] ?? OCCUPATIONS[person.occupation],
    age = (person.alive ? now : (person.diedYear ?? now)) - person.birthYear;
  const causes: CauseRef[] = [];
  const last = person.moves[person.moves.length - 1];
  if (last) causes.push({ ref: last.event, role: "trigger", weight: 0.5 });
  if (village) causes.push({ ref: village.event, role: "enabler", weight: 0.3 });
  const province = ctx.provinces.get(person.cell);
  if (person.occupation === OCC.farmer && province?.cultivation)
    causes.push({ ref: province.cultivation, role: "enabler", weight: 0.2 });
  if (!last && person.bornBeforeChronicle && province?.arrival)
    causes.push({ ref: province.arrival, role: "enabler", weight: 0.5 });
  const where = village ? `of ${village.name}` : "of the open country";
  return {
    ref,
    claim: person.alive
      ? `${person.name} ${person.surname}, ${age}, a ${job} ${where}`
      : `${person.name} ${person.surname}, a ${job} ${where}, who died in year ${person.diedYear} aged ${age}`,
    basis: "recorded",
    t: null,
    causes: edges(world, causes),
  };
});

registerExplainer(MEMORY.code, (world, ref) => {
  if (!hasPeople(world)) return null;
  const [, a, b] = ref.split(":");
  const person = observer(world).persons.get(Number(a)),
    memory = person?.memories?.[Number(b)];
  if (!person || !memory) return null;
  return {
    ref,
    claim: `${person.name} remembers ${MEMORY_WORDS[memory.kind] ?? memory.kind} in year ${memory.year}, at ${memory.age}`,
    basis: "recorded",
    t: null,
    causes: edges(world, [{ ref: memory.event, role: "trigger", weight: 1 }]),
  };
});

registerExplainer(HOUSEHOLD.code, (world, ref) => {
  if (!hasPeople(world)) return null;
  const hh = observer(world).household(ref);
  if (!hh) return null;
  const village = hh.village ? populationContext(world).settlements.get(hh.village) : undefined;
  return {
    ref,
    claim: `The ${hh.surname} household: ${hh.members.length} people${village ? ` in ${village.name}` : ""}`,
    basis: "recorded",
    t: null,
    causes: edges(world, village ? [{ ref: village.event, role: "enabler", weight: 1 }] : []),
  };
});

// What the people met remember outlives what history keeps.
registerEventKeeper((world, ref) =>
  world.storeNames().includes("observer.ledger")
    ? (observer(world).remembered.get(ref) ?? null)
    : null,
);

/** Whether a ref names something the observer has met. */
export function isObserved(ref: Ref): boolean {
  return [PERSON.code, MEMORY.code, HOUSEHOLD.code].includes(kindCodeOf(ref));
}
