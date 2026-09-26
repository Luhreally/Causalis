import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { makePopulationWorld, populationContext } from "../src/sim/index.ts";
const w = makePopulationWorld(seedFromText("first light"), { start: "spread" });
w.runTo(300 * YEAR);
const g = globalThis as any;
console.log(
  "chooseSite",
  Math.round(g.__site),
  "ms over",
  g.__sites,
  "calls; market",
  Math.round(g.__town),
  "ms; shares",
  Math.round(g.__share),
  "ms; villages",
  populationContext(w).settlements.all().length,
);
