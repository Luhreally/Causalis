// node tools/n1-tally.ts <tree/universe> <universe>=<file.save|seed name> <to-year> [--from-zero]: what the world did on its own over a fork of a save
// (or a young world from its first year): how many of each per century, who died against who was living, how many towns ended, whether its
// people or its age moved. Run on two trees (this one, and the one before the rule) to read one rule against none: same save, same years.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
const argv = process.argv.slice(2),
  [tree, target, toArg] = argv,
  load = (p: string) => import(pathToFileURL(`${tree}/${p}`).href);
const k = await load("src/kernel/index.ts"),
  { ALIEN, EARTH } = await load("src/host/planet.ts"),
  sim = await load("src/sim/index.ts");
const [uni, what] = target!.split("="),
  U = uni === "earth" ? EARTH : ALIEN;
let world: any;
if (what!.endsWith(".save")) {
  const doc = JSON.parse(gunzipSync(readFileSync(what!)).toString());
  world = k.loadWorld(doc, U.build, k.rulesetId(U.build(k.seedFromText(doc.seed)), U.version), {
    allowRulesetChange: true,
  }).world;
} else world = U.build(k.seedFromText(what!));
const from = Math.floor(world.now / k.YEAR),
  to = Number(toArg),
  ctx = () => sim.populationContext(world),
  people = () => {
    let n = 0;
    for (const p of ctx().provinces.all()) n += p.total();
    return n;
  },
  townsLiving = () =>
    ctx()
      .settlements.all()
      .filter((t: { population: number }) => t.population > 0).length,
  wild = () => (sim.wildOf ? sim.wildOf(world) : null),
  peopleAt: number[] = [],
  each: number[] = [],
  start = people(),
  townsStart = townsLiving(),
  deathsAll = { n: 0 },
  worst = { quake: 0, fire: 0, star: 0, line: "" };
let seen = world.events.count;
const counts = new Map<string, number>(),
  dead = new Map<string, number>(),
  windows = { n: 0 },
  scarsMost = { n: 0 },
  answers = { good: 0, bad: 0 },
  lands = new Map<string, number>();
const t0 = performance.now();
for (let y = from + 1; y <= to; y++) {
  const a = performance.now();
  world.runTo(y * k.YEAR);
  each.push(performance.now() - a);
  if ((y - from) % 20 === 0) peopleAt.push(Math.round(people() / 1000));
  const w = wild();
  if (w) scarsMost.n = Math.max(scarsMost.n, w.scars.length);
  for (let i = seen; i < world.events.count; i++) {
    const e = world.events.at(i),
      d = e.data ?? {};
    if (!d.natural && e.type !== "wild.answer") continue;
    counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    if (e.type === "wild.answer") {
      if (d.answered) answers.good++;
      else answers.bad++;
      continue;
    }
    if (e.type === "act.quake" && !d.beside)
      counts.set(`M${Math.floor(d.mag)}`, (counts.get(`M${Math.floor(d.mag)}`) ?? 0) + 1);
    if (e.type === "wild.star") counts.set(`star ${d.cls}`, (counts.get(`star ${d.cls}`) ?? 0) + 1);
    if (typeof d.dead === "number" && e.type !== "act.fire")
      dead.set(e.type, (dead.get(e.type) ?? 0) + d.dead);
    if (e.importance >= 6) windows.n++;
    if (e.place && typeof d.dead === "number" && d.dead > 0)
      lands.set(e.place, (lands.get(e.place) ?? 0) + d.dead);
    if (typeof d.dead === "number") {
      if (e.type === "act.quake" && d.dead > worst.quake) worst.quake = d.dead;
      if (e.type === "wild.fire" && d.dead > worst.fire) worst.fire = d.dead;
      if (e.type === "act.meteor" && d.dead > worst.star) worst.star = d.dead;
    }
  }
  seen = world.events.count;
}
const ms = performance.now() - t0,
  years = to - from,
  perCentury = Object.fromEntries(
    [...counts].sort().map(([key, n]) => [key, Math.round((1000 * n) / years) / 10]),
  ),
  w = wild(),
  sorted = [...each].sort((a, b) => a - b),
  planets = world.events
    .all()
    .filter((e: { type: string }) => e.type === "space.launch" || e.type === "space.ship").length;
const realms = sim.politiesOf(world).living();
let ageAt = "";
try {
  ageAt = String(sim.lateOf?.(world)?.age ?? "");
} catch {}
console.log(
  JSON.stringify({
    tree: tree!.split(/[\\/]/).at(-2),
    target: target!.split(/[\\/]/).at(-1),
    from,
    to,
    people: [start, people()],
    peopleKEach20: peopleAt.slice(0, 12),
    towns: [townsStart, townsLiving()],
    realms: realms.length,
    ships: planets,
    hasStage: ageAt,
    perCentury,
    deadByType: Object.fromEntries(dead),
    deadShareOfLiving:
      Math.round((1e5 * [...dead.values()].reduce((a, b) => a + b, 0)) / Math.max(1, start)) / 1000,
    worst,
    worstLandDead: Math.max(0, ...lands.values()),
    windows: windows.n,
    answers,
    scarsMost: scarsMost.n,
    tally: w ? w.tally : null,
    index: w?.index
      ? {
          faults: w.index.faults.length,
          shocksAYear: Math.round(w.index.shocks * 10) / 10,
          cones: w.index.cones.length,
          air: w.index.air,
          airBar: w.index.airBar,
          sky: w.index.sky,
        }
      : null,
    msPerYear: Math.round(ms / years),
    p50: Math.round(sorted[Math.floor(sorted.length / 2)]!),
    p95: Math.round(sorted[Math.floor(sorted.length * 0.95)]!),
    saveMB:
      Math.round(
        JSON.stringify(k.saveWorld(world, k.rulesetId(world, U.version), { universe: U.name }))
          .length / 1e5,
      ) / 10,
  }),
);
