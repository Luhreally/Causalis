// node tools/economy-report.ts [seed] [years] [every] — run a peopled world and
// print its markets: food in store, what each good is worth against its usual
// value, what tools, clothing and pots people had, what crafters made, the year's
// trade, and the economy's events.
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { FOODS, G, GOODS, OCC } from "../src/rules/index.ts";
import { makePopulationWorld, marketsOf, populationContext } from "../src/sim/index.ts";

const [seedText = "first light", yearsArg = "300", everyArg = "50"] = process.argv.slice(2);
const years = Number(yearsArg),
  every = Number(everyArg);
const world = makePopulationWorld(seedFromText(seedText));
const ctx = populationContext(world),
  markets = marketsOf(world);
const pad = (s: string | number, n: number) => String(s).padStart(n);
for (let y = every; y <= years; y += every) {
  world.runTo(y * YEAR);
  console.log(`\n— year ${y} —`);
  for (const p of ctx.provinces.all()) {
    const m = markets.get(p.cell);
    if (!m) continue;
    const pop = p.total(),
      last = m.years.at(-1),
      made = (g: number) => last?.ledger[0]![g] ?? 0,
      months = pop ? (m.food(FOODS) / pop).toFixed(1) : "-";
    const town = ctx.settlements.inProvince(p.cell).find((v) => v.market);
    console.log(
      `${pad(p.cell, 6)} ${pad(pop, 5)} people, ${pad(months, 4)} months of food, crafters ${pad(p.occupation(OCC.crafter), 4)}, traders ${pad(p.occupation(OCC.trader), 3)}` +
        ` · tools ${pad(m.toolCover / 10, 3)}% clothing ${pad(m.clothingCover / 10, 3)}% pots ${pad(m.potteryCover / 10, 3)}%` +
        `${m.metalworking ? " · metal" : ""}${town ? ` · market ${town.name} (${town.population})` : ""}`,
    );
    console.log(
      `       prices ${GOODS.map((g, i) => `${g.id} ${(m.price[i]! / g.value).toFixed(2)}`).join(" ")}`,
    );
    console.log(
      `       made   ${[G.grain, G.meat, G.wild, G.wool, G.hides, G.copper, G.tools, G.clothing, G.pottery].map((g) => `${GOODS[g]!.id} ${made(g)}`).join(" ")}`,
    );
  }
  const flows = markets.flows,
    volume = flows.reduce((s, f) => s + f.count, 0);
  console.log(
    `trade: ${flows.length} flows, ${volume} units; ${flows
      .slice(0, 8)
      .map((f) => `${f.from}→${f.to} ${f.count} ${GOODS[f.good]!.id}`)
      .join(", ")}`,
  );
}
const counts = new Map<string, number>();
for (const e of world.events.all())
  if (/^(trade|knowledge\.metal|settlement\.market)/.test(e.type))
    counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
console.log(`\nevents: ${[...counts].map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`);
