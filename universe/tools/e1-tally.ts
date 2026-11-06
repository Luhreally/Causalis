// node tools/e1-tally.ts <file.save | seed text> <earth|alien> <to-year> [step]: gate 99's tally, a whole world run on: its woods' cover by
// century, how far they moved, how many lands turned for each reason, mines given out by century, towns that felt it, where people turned,
// its age and people by year, and what a year costs. A save from before these rules loads with all of it empty.
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { YEAR, loadWorld, rulesetId, seedFromText, type World } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { homePlanet, lodesOf, populationContext, woodsOf, woodsRead } from "../src/sim/index.ts";

const [what, universe, toArg, stepArg] = process.argv.slice(2),
  U = universe === "earth" ? EARTH : ALIEN,
  to = Number(toArg ?? 1000),
  step = Number(stepArg ?? 100);
let world: World;
const fromSave = existsSync(what!);
if (fromSave) {
  const doc = JSON.parse(gunzipSync(readFileSync(what!)).toString("utf8"));
  world = loadWorld(doc, (s) => U.build(s), rulesetId(U.build(seedFromText(doc.seed)), U.version), {
    allowRulesetChange: true,
  }).world;
} else world = U.build(seedFromText(what!));
const ctx = populationContext(world),
  g = homePlanet(world).generated,
  from = Math.floor(world.now / YEAR),
  landsWith = () => {
    let sum = 0,
      first = 0,
      had = 0,
      moved = 0,
      gained = 0,
      lost = 0,
      came = 0,
      gone = 0,
      n = 0,
      most = 0;
    for (let c = 0; c < g.offworld.base; c++) {
      const up = g.tectonics.elevation[c]! > 0;
      if (ctx.medium === "water" ? up : !up) continue;
      n++;
      const w = woodsRead(ctx, c);
      sum += w.now;
      first += w.first;
      if (w.first > 0.02) had++;
      const d = w.now - w.first;
      most = Math.max(most, Math.abs(d));
      if (Math.abs(d) >= 0.15) moved++;
      if (d >= 0.15) gained++;
      if (d <= -0.15) lost++;
      if (w.first <= 0.02 && w.now > 0.1) came++;
      if (w.first > 0.2 && w.now < 0.03) gone++;
    }
    return { n, sum, first, had, moved, gained, lost, came, gone, most };
  };
console.log(
  `${what} ${universe}: from ${from} to ${to}; kind ${(U.queries["world.stage"]!(world, {}) as { id?: string })?.id}; lands ${g.offworld.base}; medium ${ctx.medium}`,
);
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "-");
let lastOut = 0,
  lastDeeper = 0,
  lastLeft = 0;
const costs: number[] = [];
const stage = () => (U.queries["world.stage"]!(world, {}) as { id?: string })?.id ?? "?";
for (let y = from; y <= to;) {
  const next = Math.min(to, y + step);
  if (y > from || y === from) {
    const l = landsWith(),
      lodes = lodesOf(world),
      woods = woodsOf(world),
      t = lodes?.tally;
    let people = 0;
    for (const p of ctx.provinces.all()) people += p.total();
    const out = (t?.out ?? 0) - lastOut,
      deeper = (t?.deeper ?? 0) - lastDeeper,
      left = (t?.left ?? 0) - lastLeft;
    lastOut = t?.out ?? 0;
    lastDeeper = t?.deeper ?? 0;
    lastLeft = t?.left ?? 0;
    console.log(
      `${String(y).padStart(5)} ${stage().padEnd(12)} people ${Math.round(people / 1000)}k | woods ${pct(l.sum, l.n)} (first ${pct(l.first, l.n)}) moved ${l.moved} of ${l.n}: +${l.gained} -${l.lost}, came ${l.came} gone ${l.gone}, most ${Math.round(l.most * 100)} | why ${JSON.stringify(woods?.tally ?? {})} | lodes out ${out} deeper ${deeper} left ${left} done ${lodes?.done().length ?? 0} ${t ? `n${t.neighbour} f${t.far} r${t.road} s${t.store} x${t.none} towns ${t.towns} whole ${t.whole} reopened ${t.reopened}` : ""}`,
    );
  }
  if (next === y) break;
  const a = performance.now();
  for (let yy = y + 1; yy <= next; yy++) {
    const b = performance.now();
    world.runTo(yy * YEAR);
    costs.push(performance.now() - b);
  }
  void a;
  y = next;
}
const sorted = [...costs].sort((a, b) => a - b);
console.log(
  `a year: median ${Math.round(sorted[Math.floor(sorted.length / 2)] ?? 0)} ms, 95th ${Math.round(sorted[Math.floor(sorted.length * 0.95)] ?? 0)} ms; events ${world.events.count}`,
);
process.exit(0);
