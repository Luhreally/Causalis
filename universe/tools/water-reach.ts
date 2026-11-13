// node tools/water-reach.ts "alien 16" ["alien 29 ~bodies kept" …] [--years 120]: a people's reach, by what its body allows —
// the provinces its medium may live in (sim livable), those it holds at the opening and after some years, and its towns.
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { EARTHLIKE, OPEN } from "../src/rules/index.ts";
import {
  homePlanet,
  livableFor,
  makePopulationWorld,
  populationContext,
} from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  at = argv.indexOf("--years"),
  years = at >= 0 ? Number(argv[at + 1]) : 120,
  seeds = argv.filter((a, i) => !a.startsWith("--") && !(at >= 0 && i === at + 1));
for (const seed of seeds) {
  const world = makePopulationWorld(seedFromText(seed), {
      prior: seed === "first light" ? EARTHLIKE : OPEN,
      start: "spread",
    }),
    ctx = populationContext(world),
    g = homePlanet(world).generated,
    body = g.fine.life.people?.body,
    n = g.provinceOf ? new Set(Array.from(g.provinceOf)).size : 0;
  let can = 0;
  for (let p = 0; p < ctx.generated.grid.count; p++) if (livableFor(ctx, p)) can++;
  const held = () => ctx.provinces.all().filter((p) => p.total() > 0).length,
    people = () => ctx.provinces.all().reduce((s, p) => s + p.total(), 0),
    h0 = held(),
    p0 = people();
  const t0 = Date.now();
  world.runTo(years * YEAR);
  const ms = Date.now() - t0;
  console.log(
    `${seed}: ${body?.name} (${body?.medium}, ${body?.size} kg); provinces ${ctx.generated.grid.count} (${n}), its medium may live in ${can}; held at the opening ${h0} (${p0} people), by year ${years} ${held()} (${people()} people), ${ctx.settlements.all().length} towns; ${years} years run in ${ms} ms`,
  );
}
