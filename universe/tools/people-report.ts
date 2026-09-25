// node tools/people-report.ts [seed] [years] [every] — run a peopled world and print
// how it went: population by occupation, provinces, villages, what was eaten, the
// notable events, and how long each simulated year took.
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { OCCUPATIONS } from "../src/rules/index.ts";
import { makePopulationWorld, populationContext } from "../src/sim/index.ts";

const [seedText = "first light", yearsArg = "200", everyArg = "20"] = process.argv.slice(2);
const years = Number(yearsArg),
  every = Number(everyArg);
const t0 = performance.now();
const world = makePopulationWorld(seedFromText(seedText));
const built = performance.now() - t0;
const ctx = populationContext(world);
console.log(
  `“${seedText}”: built in ${built.toFixed(0)} ms; home province ${ctx.provinces.all()[0]!.cell}`,
);
let last = performance.now();
for (let y = every; y <= years; y += every) {
  world.runTo(y * YEAR);
  const now = performance.now(),
    ms = (now - last) / every;
  last = now;
  const all = ctx.provinces.all(),
    occ = OCCUPATIONS.map((_, o) => all.reduce((s, p) => s + p.occupation(o), 0)),
    total = occ.reduce((a, b) => a + b, 0),
    knowing = all.filter((p) => p.knowsCultivation).length,
    fed = all.reduce((s, p) => s + p.fed, 0) / Math.max(1, all.length),
    villages = ctx.settlements.all().length;
  console.log(
    `year ${String(y).padStart(4)}: ${String(total).padStart(6)} people in ${all.length} provinces (${knowing} farming), ${villages} villages, fed ${(fed / 10).toFixed(0)}% · ` +
      OCCUPATIONS.map((n, o) => `${n} ${occ[o]}`).join(", ") +
      ` · ${ms.toFixed(1)} ms/yr`,
  );
}
const counts = new Map<string, number>();
for (const e of world.events.all()) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
console.log("events kept:", [...counts].map(([k, v]) => `${k} ${v}`).join(", "));
console.log("chronicle:");
for (const e of world.events
  .all()
  .filter((e) => e.importance >= 5)
  .slice(0, 20))
  console.log(
    `  year ${Math.floor(e.t / YEAR)}: ${e.type} ${e.place ?? ""} ${JSON.stringify(e.data)}`,
  );
console.log(
  "villages:",
  ctx.settlements
    .all()
    .slice(0, 12)
    .map((s) => `${s.name} (${s.population}, y${s.founded})`)
    .join(", "),
);
console.log(
  "flows:",
  ctx.history.flows().length,
  "births year 50:",
  ctx.history.birthsIn(ctx.provinces.all()[0]!.cell, 50),
);
