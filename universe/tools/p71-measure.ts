// node tools/p71-measure.ts <file.save> <to-year> [--save out.save]: a far save forked on, and what became of its lands away and its runs. A headless measure of the slice (galaxy-plan.md, Phase 71).
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { YEAR, loadWorld, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { GOODS } from "../src/rules/index.ts";
import { filledOf, marketsOf, populationContext, starSitesOf, tradeOf } from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  file = argv[0]!,
  to = Number(argv[1]),
  out = argv.includes("--save") ? argv[argv.indexOf("--save") + 1] : undefined;
const u = file.includes("earth--") ? EARTH : ALIEN;
const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
  typeof loadWorld
>[0];
const probe = u.build(seedFromText(doc.seed));
const world = loadWorld(doc, (s) => u.build(s), rulesetId(probe, u.version), {
  allowRulesetChange: true,
}).world;
const started = performance.now(),
  from = Math.floor(world.now / YEAR);
let worst = 0;
for (let y = from + 1; y <= to; y++) {
  const a = performance.now();
  world.runTo(y * YEAR);
  worst = Math.max(worst, performance.now() - a);
}
const ms = performance.now() - started,
  ctx = populationContext(world),
  markets = marketsOf(world),
  sites = starSitesOf(world)!.all(),
  store = tradeOf(world);
let people = 0,
  covered = { p: 0, m: 0, t: 0 };
for (const [cell] of sites) {
  people += ctx.provinces.get(cell)?.total() ?? 0;
  const m = markets.get(cell);
  if (m) {
    covered.p += m.potteryCover;
    covered.m += m.machineCover;
    covered.t += m.toolCover;
  }
}
console.log(
  JSON.stringify({
    seed: doc.seed,
    from,
    to,
    meanYearMs: Math.round(ms / Math.max(1, to - from)),
    worstMs: Math.round(worst),
    sites: sites.length,
    siteLandPeople: people,
    filled: filledOf(world)?.all().length,
    meanCover: {
      pottery: Math.round(covered.p / Math.max(1, sites.length)),
      machines: Math.round(covered.m / Math.max(1, sites.length)),
    },
    runs: store?.all().length,
    open: store?.open().length,
    count: store?.count,
    first: store?.first,
    firstBetween: store?.firstBetween,
    firstRaid: store?.firstRaid,
  }),
);
const show = [...(store?.all() ?? [])].sort((a, b) => b.house.worth - a.house.worth).slice(0, 12);
for (const r of show)
  console.log(
    `${r.ref} ${r.civ ? "FAR " : ""}${r.from}->${r.to} ${r.name} ${r.house.name} y${r.year} ly${r.ly.toFixed(1)} hops${r.hops} yrs${r.years.toFixed(1)} ${r.drive} ships ${r.ships} raided ${r.raided} worth ${Math.round(r.house.worth)} closed ${r.closedWhy ?? "-"} ${r.closedYear ?? ""} goods ${r.landed
      .map((n, g) => (n ? `${GOODS[g]!.id}=${n}` : ""))
      .filter(Boolean)
      .join(
        ",",
      )} | before p${r.before.pottery} m${r.before.machines} people ${r.before.people} now p${markets.get(r.to)?.potteryCover} m${markets.get(r.to)?.machineCover} people ${ctx.provinces.get(r.to)?.total()}`,
  );
const why = new Map<string, number>();
for (const r of store?.all() ?? [])
  why.set(r.closedWhy ?? "open", (why.get(r.closedWhy ?? "open") ?? 0) + 1);
console.log("ends", JSON.stringify([...why.entries()]));
if (out) {
  const bytes = gzipSync(
    JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
  );
  writeFileSync(out, bytes);
  console.log("saved", out, bytes.length);
}
process.exit();
