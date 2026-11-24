// node tools/gaps-tally.ts <earth|alien>=<file.save> [years=30] [--off] — the breadth round's rows on a real world,
// run on from a save: what each rule did (its events told, and the readings behind them) and what the years cost.
//
//   pollinators   lands whose gardens' or wild's fruit sets short for want of carriers, how short, and those told;
//   the field     whether it turns over in these years, and its shelter then;
//   debris        what the launches so far left aloft, launches lost to it, a cascade;
//   ships' clocks ships sailing, and the years their people did not age;
//   canals        every road weighed, why each was not dug, and those dug.
//
// With --off the rows' constants are set so that none acts (no carried share, no canal worth digging, no turn, no
// debris felt), in this process alone: the same save run both ways is the A/B of what they cost and what they move.
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  yearOfMoment,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import {
  CANAL,
  CARRIED,
  DEBRIS,
  REVERSAL,
  clockSlips,
  crossingClocks,
} from "../src/rules/index.ts";
import {
  canalsOf,
  canalsWeighed,
  debrisNow,
  homeFieldAt,
  homePlanet,
  homeTurn,
  liftsOf,
  populationContext,
  starSitesOf,
  wildsOf,
} from "../src/sim/index.ts";
import { carriedFields, carriedWild, carriersAt } from "../src/sim/ecology/ecology.ts";

const args = process.argv.slice(2),
  off = args.includes("--off"),
  [target = "", yearsArg = "30"] = args.filter((a) => !a.startsWith("--")),
  [uni, file] = target.split("="),
  U = uni === "earth" ? EARTH : ALIEN,
  years = Number(yearsArg);
// (node tools/gaps-tally.ts --save <earth|alien>=<file.save> "<seed>" <year>: a world run to a year and saved, to run on from.)
if (args.includes("--save")) {
  const [, seed = "first light", to = "600"] = args.filter((x) => !x.startsWith("--")),
    made = U.build(seedFromText(seed)),
    t0 = performance.now();
  made.runTo(Number(to) * YEAR);
  writeFileSync(file!, gzipSync(JSON.stringify(saveWorld(made, rulesetId(made, U.version)))));
  console.log(
    `${uni} ${seed} run to ${to} and saved in ${((performance.now() - t0) / 1000).toFixed(0)} s`,
  );
  process.exit(0);
}
if (!file) throw new Error("usage: gaps-tally.ts <earth|alien>=<file.save> [years] [--off]");
if (off) {
  const set = (o: object, k: string, v: number) => ((o as Record<string, number>)[k] = v);
  set(CARRIED, "garden", 0);
  set(CARRIED, "wild", 0);
  set(CANAL, "horizon", 0);
  set(REVERSAL, "everyYears", Infinity);
  set(DEBRIS, "felt", Infinity);
}
const doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")),
  { world } = loadWorld(
    doc,
    (s) => U.build(s),
    rulesetId(U.build(seedFromText(doc.seed)), U.version),
    { allowRulesetChange: true },
  ),
  ctx = populationContext(world),
  g = homePlanet(world).generated,
  from = yearOfMoment(world.now),
  events0 = world.events.count,
  ms: number[] = [];
let slips = 0,
  shipYears = 0;
for (let y = 1; y <= years; y++) {
  const t0 = performance.now();
  world.runTo(world.now + YEAR);
  ms.push(performance.now() - t0);
  const year = yearOfMoment(world.now);
  for (const [, s] of starSitesOf(world)?.all() ?? []) {
    if (s.arrived || s.lane || year <= s.departed || year > s.arrives) continue;
    shipYears++;
    if (clockSlips(year - s.departed, crossingClocks(s.distance, s.arrives - s.departed).v))
      slips++;
  }
}
ms.sort((a, b) => a - b);
const now = yearOfMoment(world.now),
  told: Record<string, number> = {};
for (let i = events0; i < world.events.count; i++) {
  const e = world.events.at(i);
  if (
    [
      "ecology.carriers-few",
      "frontier.field-turn",
      "economy.canal",
      "space.launch-lost",
      "space.debris-cascade",
    ].includes(e.type)
  )
    told[e.type] = (told[e.type] ?? 0) + 1;
}
console.log(
  `${uni} ${doc.seed}${off ? " (rows off)" : ""}: years ${from}–${now}; a year ${(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(0)} ms mean, ${ms[ms.length >> 1]!.toFixed(0)} median; ${world.events.count - events0} events; hashes ${JSON.stringify(world.domainHashes()).length} chars, ${hashOf(JSON.stringify(world.domainHashes()))}`,
);
console.log(`  told: ${JSON.stringify(told)}`);
// Pollinators.
let lands = 0,
  need = 0,
  gardensShort = 0,
  wildShort = 0,
  leastGarden = 1,
  leastWild = 1,
  sumWild = 0,
  fewest = 1;
for (const p of ctx.provinces.all()) {
  if (!p.total()) continue;
  lands++;
  const w = wildsOf(ctx, p.cell),
    c = carriersAt(ctx, p.cell, w);
  if (!c.need) continue;
  need++;
  fewest = Math.min(fewest, c.numbers);
  const f = carriedFields(ctx, p.cell),
    wi = carriedWild(ctx, p.cell, w);
  if (f < 1) gardensShort++;
  if (wi < 1) wildShort++;
  leastGarden = Math.min(leastGarden, f);
  leastWild = Math.min(leastWild, wi);
  sumWild += wi;
}
console.log(
  `  pollinators: ${lands} peopled lands, ${need} with a carrier lineage; gardens short on ${gardensShort} (least ${leastGarden.toFixed(3)}), wild food short on ${wildShort} (least ${leastWild.toFixed(3)}, mean ${(sumWild / Math.max(1, need)).toFixed(4)}); fewest carriers ${fewest.toFixed(2)}`,
);
// The field.
const turn = homeTurn(g, now);
console.log(
  `  field: ${turn ? `turning over ${turn.from}–${turn.to}, at ${Math.round(turn.weak * 100)}% of its strength` : "steady"}; shelter ${homeFieldAt(g, now).shelter.toFixed(3)}`,
);
// Debris.
const lifts = liftsOf(world),
  d = debrisNow(ctx, now);
console.log(
  `  debris: ${lifts.length} launches, ${Math.round(lifts.reduce((a, l) => a + l.tonnes, 0))} tonnes lifted; ${d.left.toFixed(0)} tonnes dead aloft, ${(d.load * 100).toFixed(0)}% of the critical ${d.critical.toFixed(0)}; cascade ${d.cascade}; a launch costs ×${d.costs.toFixed(3)}, loss ${(d.loss * 100).toFixed(1)}%`,
);
console.log(
  `  ships: ${shipYears} ship-years sailed in these years, ${slips} years unlived aboard`,
);
// Canals.
const weighed = canalsWeighed(ctx),
  why: Record<string, number> = {};
for (const r of weighed)
  why[r.weighed.why ?? "would dig"] = (why[r.weighed.why ?? "would dig"] ?? 0) + 1;
const best = [...weighed].sort(
  (a, b) => b.weighed.saved / b.weighed.cost - a.weighed.saved / a.weighed.cost,
)[0];
console.log(
  `  canals: ${canalsOf(world)?.size ?? 0} dug; ${weighed.length} roads weighed now: ${JSON.stringify(why)}${best ? `; the nearest to paying saves ${(best.weighed.saved / best.weighed.cost).toFixed(2)} of its cost (${Math.round(best.km)} km, ${Math.round(best.climb)} m, ${Math.round(best.haul)} grain a year carried)` : ""}`,
);
for (const c of canalsOf(world)?.all() ?? [])
  console.log(`    canal ${c.a}–${c.b}, year ${c.year}`);

function hashOf(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16);
}
