// Explanations for the economy (docs/architecture §13, §20): why a good is cheap or
// dear in a province — what was made and used there last year, what came in and
// went out and down which roads, and what lies behind it: the dry year or the
// famine that emptied the stores, the fields that fill them, the ore and the craft
// that make tools and metal. And the economy's events and decisions, in words.
import { parseRef, yearOfMoment, type CauseRef, type Ref, type World } from "../kernel/index.ts";
import { cellRef } from "../gen/index.ts";
import { FOODS, G, GOODS } from "../rules/index.ts";
import {
  ECONOMY_EVENTS,
  MARKET_GOOD,
  POPULATION_EVENTS,
  marketsOf,
  populationContext,
} from "../sim/index.ts";
import { landWords } from "./generated.ts";
import { edges, registerDecisionWords, registerEventWords, registerExplainer } from "./why.ts";

/** "cheap", "dear": a price against a good's usual worth. */
export function priceWords(ratio: number): string {
  if (ratio < 0.5) return "very cheap";
  if (ratio < 0.8) return "cheap";
  if (ratio <= 1.25) return "at its usual worth";
  if (ratio <= 2) return "dear";
  return "very dear";
}

/** 12,345 */
function count(n: number): string {
  const digits = String(Math.abs(Math.round(n)));
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i && (digits.length - i) % 3 === 0) out += ",";
    out += digits[i];
  }
  return n < 0 ? `-${out}` : out;
}

registerExplainer(MARKET_GOOD.code, (world, ref) => {
  if (!world.storeNames().includes("economy.markets")) return null;
  const { a: cell, b: good } = parseRef(ref),
    m = marketsOf(world).get(cell),
    p = populationContext(world).provinces.get(cell),
    g = GOODS[good];
  if (!m || !p || !g) return null;
  const last = m.years.at(-1),
    line = (l: number) => last?.ledger[l]![good] ?? 0,
    ratio = m.price[good]! / g.value,
    land = landWords(world, cellRef(0, cell));
  const parts = [
    `${g.name[0]!.toUpperCase()}${g.name.slice(1)} in ${land} is ${priceWords(ratio)} (${ratio.toFixed(2)} of its usual worth)`,
  ];
  if (last) {
    parts.push(`in year ${last.year} ${count(line(0))} was made and ${count(line(1))} used`);
    if (line(2)) parts.push(`${count(line(2))} came in`);
    if (line(3)) parts.push(`${count(line(3))} went out`);
    if (g.food && p.total()) {
      const months = FOODS.reduce((s, f) => s + m.stock[f]!, 0) / p.total();
      parts.push(`food for ${months.toFixed(0)} months is kept`);
    } else parts.push(`${count(m.stock[good]!)} is kept`);
  }
  const causes: CauseRef[] = [];
  const recent = (r: Ref | null, years: number) => {
    const e = r ? world.events.get(r) : undefined;
    return e && world.now - e.t <= years * 365 * 86400 ? e.id : null;
  };
  if (g.food) {
    const want = recent(p.lastFamine, 2) ?? recent(p.lastDrought, 2);
    if (want) causes.push({ ref: want, role: "pressure", weight: 0.5 });
    if (good === G.grain && p.cultivation)
      causes.push({ ref: p.cultivation, role: "enabler", weight: 0.3 });
  }
  if ((good === G.copper || good === G.tools) && m.metalworking)
    causes.push({ ref: m.metalworking, role: "enabler", weight: 0.4 });
  // The roads its trade in this good went down last year.
  const roads = new Set<Ref>();
  for (const f of marketsOf(world).flows)
    if (f.good === good && (f.from === cell || f.to === cell)) {
      const road = marketsOf(world).route(f.from, f.to);
      if (road) roads.add(road);
    }
  for (const r of [...roads].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)))
    causes.push({ ref: r, role: "enabler", weight: 0.3 / roads.size });
  causes.push({ ref: cellRef(0, cell), role: "constraint", weight: 0.2 });
  return { ref, claim: parts.join("; "), basis: "recorded", t: null, causes: edges(world, causes) };
});

type Data = Readonly<Record<string, unknown>> | null;
const text = (data: unknown, key: string) => {
  const v = (data as Data)?.[key];
  return typeof v === "string" ? v : null;
};
const num = (data: unknown, key: string) => {
  const v = (data as Data)?.[key];
  return typeof v === "number" ? v : null;
};
const goodName = (id: string | null) => GOODS.find((g) => g.id === id)?.name ?? "goods";
const year = (t: number) => `year ${yearOfMoment(t)}`;

registerEventWords(ECONOMY_EVENTS.route.type, (world, e) => {
  const to = e.subjects[1] ?? null;
  return `The first ${goodName(text(e.data, "good"))} went from ${landWords(world, e.place)} to ${landWords(world, to)}, ${year(e.t)}`;
});
registerEventWords(ECONOMY_EVENTS.relief.type, (world, e) => {
  const food = num(e.data, "food");
  return `Food came to ${landWords(world, e.place)} while famine was on${food === null ? "" : `, ${count(food)} months' worth`}, ${year(e.t)}`;
});
registerEventWords(
  ECONOMY_EVENTS.metalworking.type,
  (world, e) => `Crafters of ${landWords(world, e.place)} learned to smelt copper, ${year(e.t)}`,
);
registerEventWords(ECONOMY_EVENTS.metalworkingSpread.type, (world, e) => {
  const from = e.subjects[1] ?? null;
  return `Metalworking came to ${landWords(world, e.place)}${from ? ` from ${landWords(world, from)}` : ""}, ${year(e.t)}`;
});
registerEventWords(POPULATION_EVENTS.market.type, (world, e) => {
  const name = text(e.data, "name");
  return `${name ?? "A village"} became the market town of ${landWords(world, e.place)}, ${year(e.t)}`;
});

registerDecisionWords("trade.open", (world, d) => {
  const good = text(d.outcome, "good"),
    to = text(d.outcome, "to") as Ref | null;
  return `Carriers of ${landWords(world, d.subject)} took ${goodName(good)} to ${to ? landWords(world, to) : "a neighbour"}`;
});
registerDecisionWords(
  "knowledge.metalworking",
  (world, d) => `Crafters of ${landWords(world, d.subject)} worked out how to smelt copper`,
);
registerDecisionWords(
  "settlement.market",
  (world, d) => `The people of ${landWords(world, d.subject)} came to trade at one village`,
);
