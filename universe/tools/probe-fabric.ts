// Towns' fabric across a world's history (Phase 23): housed, runs, buildings, walls, its store's size and the town step's cost; the largest town told run by run. node tools/probe-fabric.ts [seed] [years,...]
import { gzipSync } from "node:zlib";
import { YEAR, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { EARTH } from "../src/host/planet.ts";
import { HOME_LEVELS } from "../src/rules/index.ts";
import { homesOf, housingOf, populationContext, townsOf } from "../src/sim/index.ts";

const seed = process.argv[2] ?? "juniper",
  years = (process.argv[3] ?? "50,100,200,300").split(",").map(Number);
const world = EARTH.build(seedFromText(seed)),
  started = Date.now();
// (The town step timed: its system's run wrapped.)
let townMs = 0;
const sys = (
  world.scheduler as unknown as { systems: { key: string; run: (t: number) => void }[] }
).systems.find((s) => s.key === "191.town.year")!;
const run = sys.run;
sys.run = (t) => {
  const t0 = performance.now();
  run(t);
  townMs += performance.now() - t0;
};
for (const y of years) {
  world.runTo(y * YEAR);
  const ctx = populationContext(world),
    store = townsOf(world),
    fabrics = store.all(),
    towns = ctx.settlements.all();
  let people = 0,
    housed = 0,
    changes = 0,
    maxChanges = 0,
    homes = 0,
    open = 0,
    walls = 0,
    forsaken = 0;
  const levels = HOME_LEVELS.map(() => 0),
    civics = new Map<string, number>(),
    ruins = { fell: 0, razed: 0 };
  for (const f of fabrics) {
    const t = ctx.settlements.get(f.town)!;
    people += t.population;
    housed += Math.min(t.population, housingOf(f));
    changes += f.changes.length;
    maxChanges = Math.max(maxChanges, f.changes.length);
    homes += homesOf(f);
    f.homes.forEach((n, l) => (levels[l]! += n));
    for (const r of f.open) open += r[1] - r[0];
    if (f.walls) walls++;
    if (f.forsaken) forsaken++;
    for (const c of f.civics)
      if (c.fell === null) civics.set(c.kind, (civics.get(c.kind) ?? 0) + 1);
    for (const c of f.changes) {
      if (c[0] === 2) ruins.fell += c[2] - c[1];
      if (c[0] === 3) ruins.razed += c[2] - c[1];
    }
  }
  const doc = saveWorld(world, "probe"),
    json = JSON.stringify(doc.stores["town.fabric"]!.data),
    size = json.length,
    packed = gzipSync(json).length,
    whole = gzipSync(JSON.stringify(doc)).length;
  console.log(
    `  fabric gzipped ${(packed / 1e6).toFixed(2)} MB of a save of ${(whole / 1e6).toFixed(1)} MB`,
  );
  console.log(
    `${seed} year ${y}: ${fabrics.length}/${towns.length} towns built; housed ${((100 * housed) / Math.max(1, people)).toFixed(1)}% of ${people}; ${homes} homes (${levels.map((n, l) => `${HOME_LEVELS[l]} ${n}`).join(", ")}); ${(changes / Math.max(1, fabrics.length)).toFixed(1)} runs a town (most ${maxChanges}); open lots ${open}; ruins: ${ruins.fell} fell, ${ruins.razed} razed; ${walls} walled, ${forsaken} forsaken; store ${(size / 1e6).toFixed(2)} MB; town step ${(townMs / 1000).toFixed(1)} s [${((Date.now() - started) / 1000).toFixed(0)} s]`,
  );
  console.log(`  buildings: ${[...civics.entries()].map(([k, n]) => `${k} ${n}`).join(", ")}`);
}
// The largest town, told run by run.
const ctx = populationContext(world),
  big = [...ctx.settlements.all()].sort((a, b) => b.population - a.population)[0]!,
  f = townsOf(world).get(big.ref)!;
console.log(
  `\n${big.name} (${big.population} people, ${f.family}): next ${f.next}, homes ${f.homes.join("/")}, housing ${housingOf(f)}, aim ${f.aim} at ${f.raise}, passed ${f.passed}`,
);
for (const c of [...f.changes.slice(0, 6), ...f.changes.slice(-24)])
  console.log(
    `  ${["built", "raised", "fell", "razed", "cleared"][c[0]]} lots ${c[1]}-${c[2]} years ${c[3]}-${c[4]} level ${c[5]} design ${c[6]}`,
  );
for (const c of f.civics)
  console.log(
    `  ${c.kind} at ${c.at}(${c.lots}) ${c.start}-${c.end}${c.fell !== null ? ` fell ${c.fell}` : ""}`,
  );
