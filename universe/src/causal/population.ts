// Explanations for the population's own things: a village is there because of the
// decision that founded it (whose factors reach the farming that filled it and the
// ground that drew it). Its events and decisions are said in words, naming the land
// by what it is and where.
import { yearOfMoment, type World } from "../kernel/index.ts";
import { POPULATION_EVENTS, SETTLEMENT, type SettlementStore } from "../sim/index.ts";
import { cellRef } from "../gen/index.ts";
import { landWords } from "./generated.ts";
import { edges, registerDecisionWords, registerEventWords, registerExplainer } from "./why.ts";

registerExplainer(SETTLEMENT.code, (world: World, ref) => {
  if (!world.storeNames().includes("population.settlements")) return null;
  const s = world.store<SettlementStore>("population.settlements").get(ref);
  if (!s) return null;
  return {
    ref,
    claim: `${s.name}, a village of ${s.population}, founded in year ${s.founded}`,
    basis: "recorded",
    t: null,
    causes: edges(world, [{ ref: s.event, role: "trigger", weight: 1 }]),
  };
});

type Data = Readonly<Record<string, unknown>> | null;
const num = (data: unknown, key: string): number | null => {
  const v = (data as Data)?.[key];
  return typeof v === "number" ? v : null;
};
const people = (n: number | null, fallback: string) =>
  n === null ? fallback : `${n} ${n === 1 ? "person" : "people"}`;

const E = POPULATION_EVENTS;
registerEventWords(
  E.origin.type,
  (world, e) =>
    `The first people, ${people(num(e.data, "people"), "a band")}, began in ${landWords(world, e.place)}`,
);
registerEventWords(E.drought.type, (world, e) => {
  const rain = num(e.data, "rain");
  return `A dry year in ${landWords(world, e.place)}, year ${yearOfMoment(e.t)}${rain === null ? "" : `: ${Math.round(rain / 10)}% of the usual rain`}`;
});
registerEventWords(E.famine.type, (world, e) => {
  const fed = num(e.data, "fed");
  return `Famine in ${landWords(world, e.place)}, year ${yearOfMoment(e.t)}${fed === null ? "" : `: food for ${Math.round(fed / 10)}% of ${people(num(e.data, "people"), "them")}`}`;
});
registerEventWords(E.migration.type, (world, e) => {
  const to = e.subjects[1] ?? null;
  return `${people(num(e.data, "count"), "People")} set out from ${landWords(world, e.place)}${to ? ` for ${landWords(world, to)}` : " for new land"}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(E.peopled.type, (world, e) =>
  `${landWords(world, e.place)} was first lived in, year ${yearOfMoment(e.t)}${num(e.data, "people") === null ? "" : `, by ${people(num(e.data, "people"), "")}`}`.replace(
    /^the/,
    "The",
  ),
);
registerEventWords(
  E.cultivation.type,
  (world, e) =>
    `The first fields were sown in ${landWords(world, e.place)}, year ${yearOfMoment(e.t)}`,
);
registerEventWords(E.cultivationSpread.type, (world, e) => {
  const from = e.subjects[1] ?? null;
  return `Farming came to ${landWords(world, e.place)}${from ? ` from ${landWords(world, from)}` : ""}, year ${yearOfMoment(e.t)}`;
});
registerEventWords(E.founded.type, (world, e) => {
  const name = (e.data as Data)?.name;
  return `${typeof name === "string" ? name : "A village"} was founded in ${landWords(world, e.place)}, year ${yearOfMoment(e.t)}`;
});

registerDecisionWords("people.origin", (world, d) => {
  const cell = num(d.outcome, "cell");
  return `The first people chose ${cell === null ? "their land" : landWords(world, cellRef(0, cell))} to live in`;
});
registerDecisionWords(
  "population.migrate",
  (world, d) => `Some of the people of ${landWords(world, d.subject)} chose to move on`,
);
registerDecisionWords(
  "knowledge.cultivation",
  (world, d) => `The people of ${landWords(world, d.subject)} began to sow`,
);
registerDecisionWords(
  "settlement.found",
  (world, d) => `The people of ${landWords(world, d.subject)} chose a site for a village`,
);
