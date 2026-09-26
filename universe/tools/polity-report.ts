// node tools/polity-report.ts [seed] [years] [every] — run the app's world (bands
// across the land) and print its realms: how many, how large, how governed, who
// rules, how discontented their lands, and what befell them.
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import {
  governmentKey,
  makePopulationWorld,
  politiesOf,
  populationContext,
  realmName,
} from "../src/sim/index.ts";

const [seedText = "first light", yearsArg = "500", everyArg = "100"] = process.argv.slice(2);
const years = Number(yearsArg),
  every = Number(everyArg);
const world = makePopulationWorld(seedFromText(seedText), { start: "spread" }),
  ctx = populationContext(world),
  realms = politiesOf(world);
for (let y = every; y <= years; y += every) {
  world.runTo(y * YEAR);
  const living = realms.living(),
    lands = ctx.provinces.all().length,
    held = living.reduce((s, p) => s + p.members.length, 0);
  console.log(
    `\n— year ${y}: ${living.length} realms hold ${held} of ${lands} lands; ${realms.all().length - living.length} ended —`,
  );
  for (const p of [...living].sort((a, b) => b.members.length - a.members.length).slice(0, 8)) {
    const grief = p.members.map((c) => realms.discontent(c).level),
      worst = Math.max(0, ...grief);
    console.log(
      `  ${realmName(p).padEnd(34)} ${String(p.members.length).padStart(3)} lands · ${governmentKey(p)} · ${p.ruler.name}, since ${p.ruler.since} · worst grievance ${worst.toFixed(2)}`,
    );
  }
}
const counts = new Map<string, number>();
for (const e of world.events.all())
  if (e.type.startsWith("polity.")) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
console.log(`\nevents: ${[...counts].map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`governments seen: ${[...new Set(realms.all().map(governmentKey))].join("; ")}`);
