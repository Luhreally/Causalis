// node tools/roles-probe.ts "alien 7": the roles a world's physics offers and fills (rules/grammar.ts), not run.
import { seedFromText } from "../src/kernel/index.ts";
import { generateHomeWorld, homeLifeRoles } from "../src/gen/index.ts";
import { OPEN } from "../src/rules/index.ts";

for (const seed of process.argv.slice(2)) {
  const g = generateHomeWorld(seedFromText(seed), OPEN, 64),
    r = homeLifeRoles(g);
  if (!r) {
    console.log(`${seed}: no roles read`);
    continue;
  }
  const w = r.world;
  console.log(`== ${seed}: fixed ${r.read.fixed.toPrecision(3)}, links ${r.read.links}, fills ${r.read.fills} of ${r.read.roles.length}; light ${w.lightPower.toFixed(3)} W/kg, rock ${w.rockPower.toFixed(3)}, eat ${w.eatTrade} ${w.eatPower15.toFixed(2)}, g ${w.gravity.toFixed(2)}, ${w.pressure.toFixed(2)} bar, ${w.celsius.toFixed(0)} °C, sea ${w.sea.toFixed(2)}`);
  for (const p of r.read.places) console.log(`  ${p.place}: ${p.shut ? `shut (${p.shut})` : `share ${p.share.toFixed(3)} energy ${p.energy.toFixed(3)} fixed ${p.fixed.toExponential(2)} links ${p.links}`}`);
  r.read.roles.forEach((x, i) => console.log(`  ${i < r.read.fills ? "*" : " "} ${x.words} (L${x.level}, ${x.niche}) ${x.energy.toExponential(2)}`));
}
