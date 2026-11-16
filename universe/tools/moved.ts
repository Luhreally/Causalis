// What moved: node tools/moved.ts <year> <seed>: each century, the realms' holding numbers by people, pacts standing, trade moved, lands knowing steam.
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { EARTHLIKE, OPEN } from "../src/rules/index.ts";
import * as sim from "../src/sim/index.ts";
const [yearArg, s = "earth:first light"] = process.argv.slice(2),
  earth = s.startsWith("earth:"),
  world = sim.makePopulationWorld(seedFromText(earth ? s.slice(6) : s), {
    prior: earth ? EARTHLIKE : OPEN,
    start: "spread",
  }),
  ctx = sim.populationContext(world);
console.log(`== ${s}`);
for (let y = 50; y <= Number(yearArg); y += 50) {
  world.runTo(y * YEAR);
  const realms = sim.politiesOf(world).living(),
    sums = [0, 0, 0, 0];
  let people = 0;
  for (const p of realms) {
    const n = p.members.reduce((k, c) => k + (ctx.provinces.get(c)?.total() ?? 0), 0),
      h = sim.orderOf(world)?.of(p.ref)?.held;
    if (!h) continue;
    people += n;
    h.forEach((v, i) => (sums[i]! += v * n));
  }
  const rel = sim.diplomacyOf(world).all(),
    pacts = rel.filter((r) => r.pact).length,
    rivals = rel.filter((r) => r.opinion < -0.4).length,
    flows = sim.marketsOf(world).flows.reduce((n, f) => n + f.count, 0),
    lore = sim.loreOf(world),
    lands = ctx.provinces.all(),
    know = (id: string) => lands.filter((p) => lore.get(p.cell, id)).length,
    wars = sim
      .warsOf(world)
      .hot()
      .filter((w) => w.ended === null).length;
  console.log(
    `  ${y}: held ${sums.map((x) => Math.round(x / Math.max(1, people))).join("/")} (force/voice/word/trust), ${rel.length} meet, ${pacts} pacts, ${rivals} rivals, ${wars} wars, trade ${flows}, know writing ${know("writing")} printing ${know("printing")} banking ${know("banking")} steam ${know("steam-engine")} of ${lands.length}`,
  );
}
