// Explanations for the population's own things: a village is there because of the
// decision that founded it (whose factors reach the farming that filled it and the
// ground that drew it). Its events and decisions are said in words, naming the land
// by what it is and where.
import {
  YEAR,
  defineKind,
  makeRef,
  parseRef,
  yearOfMoment,
  type CauseRef,
  type Ref,
  type World,
} from "../kernel/index.ts";
import {
  POPULATION_EVENTS,
  SETTLEMENT,
  populationContext,
  type SettlementStore,
} from "../sim/index.ts";
import { cellRef } from "../gen/index.ts";
import { landWords } from "./generated.ts";
import { count } from "./words.ts";
import { edges, registerDecisionWords, registerEventWords, registerExplainer } from "./why.ts";

/** The people of a province, as one: why they are as many as they are, and as they are. */
export const FOLK = defineKind("folk", "the people of a province", "structural");
export function folkRef(cell: number): Ref {
  return makeRef(FOLK, 0, cell);
}

registerExplainer(FOLK.code, (world, ref) => {
  if (!world.storeNames().includes("population.provinces")) return null;
  const cell = parseRef(ref).b,
    ctx = populationContext(world),
    p = ctx.provinces.get(cell);
  if (!p) return null;
  const now = yearOfMoment(world.now),
    decade = (fn: (y: number) => number) => {
      let n = 0;
      for (let y = now - 10; y < now; y++) if (y >= 0) n += fn(y);
      return n;
    },
    born = decade((y) => ctx.history.birthsIn(cell, y)),
    died = decade((y) => ctx.history.deathsIn(cell, y)),
    flows = ctx.history.flows().filter((f) => f.year >= now - 10),
    came = flows.filter((f) => f.to === cell).reduce((s, f) => s + f.count, 0),
    left = flows.filter((f) => f.from === cell).reduce((s, f) => s + f.count, 0);
  const parts = [
    `${count(p.total())} people live in ${landWords(world, p.ref)}, peopled since year ${p.settledYear}`,
    `in the last ten years ${count(born)} were born and ${count(died)} died`,
  ];
  if (came || left) parts.push(`${count(came)} came and ${count(left)} left`);
  const causes: CauseRef[] = [];
  if (p.arrival) causes.push({ ref: p.arrival, role: "trigger", weight: 0.4 });
  if (p.cultivation) causes.push({ ref: p.cultivation, role: "enabler", weight: 0.3 });
  const famine = p.lastFamine ? world.events.get(p.lastFamine) : undefined;
  if (famine && world.now - famine.t < 10 * YEAR)
    causes.push({ ref: famine.id, role: "constraint", weight: 0.2 });
  causes.push({ ref: p.ref, role: "constraint", weight: 0.1 });
  return { ref, claim: parts.join("; "), basis: "recorded", t: null, causes: edges(world, causes) };
});

registerExplainer(SETTLEMENT.code, (world: World, ref) => {
  if (!world.storeNames().includes("population.settlements")) return null;
  const s = world.store<SettlementStore>("population.settlements").get(ref);
  if (!s) return null;
  return {
    ref,
    claim: s.market
      ? `${s.name}, the market town of its land, ${count(s.population)} people, founded in year ${s.founded}`
      : `${s.name}, a village of ${count(s.population)}, founded in year ${s.founded}`,
    basis: "recorded",
    t: null,
    causes: edges(world, [
      { ref: s.event, role: "trigger", weight: s.market ? 0.6 : 1 },
      ...(s.market ? [{ ref: s.market, role: "enabler" as const, weight: 0.4 }] : []),
    ]),
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
registerEventWords(E.spread.type, (world, e) => {
  const lands = num(e.data, "provinces"),
    folk = num(e.data, "people");
  return `In the ages before the chronicle, the people spread from ${landWords(world, e.place)} across ${lands === null ? "the land" : `${count(lands)} lands`}${folk === null ? "" : `, ${count(folk)} of them in wandering bands`}`;
});
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
