// node tools/finance-cost.ts <year> [seed]: what the year's reckoning of money and fears costs (sim/finance), read at each century:
// one more reckoning run by hand on a world thrown away after (it moves the world it is run on; the numbers are of its cost alone),
// beside what that whole year took.
import { YEAR, seedFromText, type SimTime } from "../src/kernel/index.ts";
import { EARTHLIKE, OPEN } from "../src/rules/index.ts";
import * as sim from "../src/sim/index.ts";
const [yearArg, s = "earth:first light"] = process.argv.slice(2),
  earth = s.startsWith("earth:"),
  world = sim.makePopulationWorld(seedFromText(earth ? s.slice(6) : s), {
    prior: earth ? EARTHLIKE : OPEN,
    start: "spread",
  });
console.log(`== ${s}`);
for (let y = 100; y <= Number(yearArg); y += 100) {
  world.runTo((y - 1) * YEAR);
  const t0 = performance.now();
  world.runTo(y * YEAR);
  const year = performance.now() - t0,
    ctx = sim.populationContext(world),
    t1 = performance.now();
  sim.financeYear(ctx, (y * YEAR) as SimTime);
  const cost = performance.now() - t1;
  console.log(
    `  year ${y}: ${sim.politiesOf(world).living().length} realms, ${sim.diplomacyOf(world).all().length} meet; the year ${year.toFixed(0)} ms, the reckoning ${cost.toFixed(1)} ms (${((100 * cost) / year).toFixed(1)}%)`,
  );
}
