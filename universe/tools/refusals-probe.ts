// node tools/refusals-probe.ts <year> <seed>: why debts were refused (sim/finance): by what the refusal's data says, and what the
// realms that owe could spare against what was due, in the last year read.
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { EARTHLIKE, FOODS, OPEN } from "../src/rules/index.ts";
import * as sim from "../src/sim/index.ts";
const [yearArg, s = "alien 55"] = process.argv.slice(2),
  earth = s.startsWith("earth:"),
  world = sim.makePopulationWorld(seedFromText(earth ? s.slice(6) : s), {
    prior: earth ? EARTHLIKE : OPEN,
    start: "spread",
  }),
  ctx = sim.populationContext(world);
world.runTo(Number(yearArg) * YEAR);
const why: Record<string, number> = {};
let sales: Record<string, number> = {};
for (let i = 0; i < world.events.count; i++) {
  const e = world.events.at(i);
  if (e.type === "finance.refused") {
    const d = e.data as { beaten?: boolean; missed?: number; owed?: number; home?: number };
    const k = d.beaten ? "beaten" : `missed ${d.missed}`;
    why[k] = (why[k] ?? 0) + 1;
  }
  if (e.type === "finance.sold") {
    const k = (e.data as { why: string }).why;
    sales[k] = (sales[k] ?? 0) + 1;
  }
}
console.log(
  `== ${s} at ${yearArg}: refused by ${JSON.stringify(why)}; sales told ${JSON.stringify(sales)}`,
);
const store = sim.financeOf(world)!,
  markets = sim.marketsOf(world);
let n = 0;
for (const m of store.all()) {
  const abroad = m.held.reduce((x, [, k]) => x + k, 0);
  if (abroad <= 0 || n++ >= 12) continue;
  const p = sim.politiesOf(world).get(m.realm)!;
  let spare = 0,
    food = 0,
    eats = 0;
  for (const c of p.members) {
    const mk = markets.get(c),
      prov = ctx.provinces.get(c);
    if (!mk || !prov) continue;
    food += mk.food(FOODS);
    eats += sim.mouths(prov, ctx.life);
    spare += Math.max(0, Math.floor(mk.food(FOODS) - 3 * sim.mouths(prov, ctx.life)));
  }
  const y = sim.yieldNow(ctx, p)!;
  console.log(
    `  ${sim.realmName(p)}: owes abroad ${abroad} home ${m.home} at ${m.coupon / 100}%, due ${Math.floor((abroad * m.coupon) / 10000)}, spare ${spare}, months of food ${(food / Math.max(1, eats)).toFixed(1)}, takings ${y.takings}, burden ${y.burden.toFixed(2)}, missed ${m.missed}, paid ${m.paid}`,
  );
}
