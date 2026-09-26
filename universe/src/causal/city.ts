// Cities in words (docs/architecture §13): a town grown great became a city; a
// road paved through it drew its trade along it.
import { yearOfMoment } from "../kernel/index.ts";
import { CITY_EVENTS } from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { count } from "./words.ts";
import { registerEventWords } from "./why.ts";

const name = (d: unknown) => {
  const v = (d as Readonly<Record<string, unknown>> | null)?.name;
  return typeof v === "string" ? v : "A town";
};

registerEventWords(CITY_EVENTS.founded.type, (world, e) => {
  const people = (e.data as { people?: number } | null)?.people;
  return `${name(e.data)} in ${landWords(world, e.place)} grew into a city${people ? ` of ${count(people)}` : ""}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(
  CITY_EVENTS.reshaped.type,
  (_, e) =>
    `A paved road was laid through ${name(e.data)}, and its markets and workshops moved along it, year ${yearOfMoment(e.t)}`,
);
