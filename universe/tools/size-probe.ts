// node tools/size-probe.ts [years=600] [seeds...] — C0 of the sizes plan (docs/architecture/asks-2026-11-12-plan.md): one world at
// a time, at each grid size, run to a year: how long each century takes, the heap, the save's size, and what the world holds (lands
// peopled, people, realms, wars, towns). Pure reading; it changes nothing. A seed "earth:<text>" is Earth's prior, any other the open.
import { gzipSync } from "node:zlib";
import { YEAR, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { EARTHLIKE, OPEN } from "../src/rules/index.ts";
import { makePopulationWorld, politiesOf, populationContext, warsOf } from "../src/sim/index.ts";
import { stageOf } from "../src/host/inspect/stage.ts";

const years = Number(process.argv[2] ?? 600),
  seeds = process.argv.slice(3).length
    ? process.argv.slice(3)
    : ["earth:first light", "alien 41", "alien 20"],
  sizes = (process.env.SIZES ?? "32,48,64").split(",").map(Number),
  /** With LANDS set: the planet's grid at its usual 64, and these lands' grids instead. */
  lands = process.env.LANDS?.split(",").map(Number) ?? null;

for (const s of seeds) {
  const earth = s.startsWith("earth:"),
    text = earth ? s.slice(6) : s;
  for (const size of lands ?? sizes) {
    const frequency = lands ? 64 : size;
    globalThis.gc?.();
    const t0 = performance.now(),
      world = makePopulationWorld(seedFromText(text), {
        prior: earth ? EARTHLIKE : OPEN,
        start: "spread",
        frequency,
        ...(lands ? { lands: size } : {}),
      }),
      made = performance.now() - t0,
      centuries: number[] = [];
    let heap = 0;
    for (let y = 100; y <= years; y += 100) {
      const c0 = performance.now();
      world.runTo(y * YEAR);
      centuries.push(Math.round(performance.now() - c0));
      heap = Math.max(heap, process.memoryUsage().heapUsed);
    }
    const ctx = populationContext(world);
    let people = 0,
      peopled = 0;
    for (const p of ctx.provinces.all()) {
      const n = p.total();
      people += n;
      if (n) peopled++;
    }
    const realms = politiesOf(world)
        .all()
        .filter((p) => p.ended === null).length,
      wars = warsOf(world).all().length,
      towns = ctx.settlements.all().length,
      save = gzipSync(JSON.stringify(saveWorld(world, rulesetId(world, "size")))).length,
      run = centuries.reduce((a, b) => a + b, 0);
    console.log(
      JSON.stringify({
        seed: s,
        frequency,
        landsGrid: lands ? size : null,
        lands: ctx.provinces.all().length,
        made: Math.round(made),
        centuries,
        yearsAMinute: Math.round((years / run) * 60000),
        heapMB: Math.round(heap / 1048576),
        saveKB: Math.round(save / 1024),
        peopled,
        people,
        realms,
        wars,
        towns,
        ages: Object.fromEntries(
          stageOf(world)
            .stages.filter((x) => x.year !== null)
            .map((x) => [x.name, x.year]),
        ),
      }),
    );
  }
}
process.exit(0);
