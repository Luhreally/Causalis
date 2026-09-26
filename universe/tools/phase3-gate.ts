// node tools/phase3-gate.ts [years] — the Phase 3 gate (docs/architecture §I.3,
// milestone 35): on the Earth seed ("first light" under the Earthlike prior, the world
// the app opens), run nine centuries and require that
//   - sowing, the first realm, writing, iron, coal, steam, the factory and electricity
//     first come within their bands, and the planet's people, realms, wars and tongues
//     stand within theirs (tools/calibration-bands.ts);
//   - coal is dug and oil drawn only where deep time buried swamp forest and plankton,
//     and the why of each first mine and well reaches the field or the age that laid it;
//   - the north star holds on the industrial planet: sixteen grown citizens' memories
//     each walk across four or more domains to the star, every hop that mattered on
//     the record;
//   - every year of the whole planet stays within budget, and the save within bounds.
import { gzipSync } from "node:zlib";
import { YEAR, rulesetId, saveWorld, seedFromText, type Ref } from "../src/kernel/index.ts";
import { SEAM, surfaceOre } from "../src/gen/index.ts";
import { EARTH } from "../src/host/planet.ts";
import { ECONOMY_EVENTS, homePlanet } from "../src/sim/index.ts";
import { northStar, why } from "../src/causal/index.ts";
import { century, watchTurns, type Century } from "./calibration.ts";
import { BANDS, TURNS } from "./calibration-bands.ts";

const years = Number(process.argv[2] ?? 900);
/** The slowest year allowed at full speed (the phone proxy, `npm run slice`, holds the phone's). CI runners are about half as fast. */
const YEAR_MS = process.env.CI ? 1200 : 600;
/** The save of nine centuries, compressed. */
const SAVE_BYTES = 16_000_000;

const problems: string[] = [],
  world = EARTH.build(seedFromText("first light")),
  turns = watchTurns(),
  centuries: Century[] = [],
  times: number[] = [],
  t0 = performance.now();
let last = t0;
for (let y = 1; y <= years; y++) {
  world.runTo(y * YEAR);
  const now = performance.now();
  times.push(now - last);
  last = now;
  turns.step(world, y);
  if (y % 100 === 0) {
    const c = century(world, y);
    centuries.push(c);
    console.log(
      `year ${y}: ${(c.people / 1e6).toFixed(1)}M people, ${c.realms} realms, ${c.wars} wars, ${c.famines} famines, ${c.carbon.toFixed(0)} ppm  [${((now - t0) / 1000).toFixed(0)} s]`,
    );
  }
}

// 1. The turning points and the planet's numbers, each within its band.
for (const turn of TURNS) {
  const at = turns.seen.get(turn.id),
    [lo, hi] = turn.band;
  if (at === undefined ? years >= lo : at < lo || at > hi)
    problems.push(
      `${turn.name} ${at === undefined ? "never came" : `came in year ${at}`}, outside ${lo}–${hi}`,
    );
  else console.log(`  ${turn.name.padEnd(20)} year ${at ?? "-"}  (${lo}–${hi})`);
}
for (const band of BANDS) {
  const c = centuries.find((x) => x.year === band.year);
  if (!c) continue;
  const v = band.measure(c);
  if (v < band.band[0] || v > band.band[1])
    problems.push(
      `${band.name} ${band.words(v)} at year ${band.year}, outside ${band.words(band.band[0])}–${band.words(band.band[1])}`,
    );
  else console.log(`  ${band.name.padEnd(20)} ${band.words(v)} at year ${band.year}`);
}

// 2. Fuel only where deep time buried it, and every first mine and well says so.
const g = homePlanet(world).generated;
let mines = 0;
for (const e of world.events.all()) {
  const kind =
    e.type === ECONOMY_EVENTS.mine.type
      ? "coal"
      : e.type === ECONOMY_EVENTS.well.type
        ? "oil"
        : null;
  if (!kind) continue;
  mines++;
  const cell = Number(e.place!.split(":")[2]);
  if (
    !surfaceOre(g, cell, kind) ||
    (kind === "coal" ? g.deep.coal[cell]! : g.deep.oil[cell]!) < SEAM[kind]
  )
    problems.push(`${kind} worked in land ${cell}, where deep time buried too little`);
  const laid = e.causes.find((c) => c.ref.startsWith("age:") || c.ref.startsWith("depo:"));
  if (!laid) problems.push(`${e.id}: the first ${kind} of land ${cell} cites no field or age`);
  else if (why(world, laid.ref as Ref).basis !== "generated")
    problems.push(`${laid.ref} is not a generated fact`);
}
if (!mines) problems.push("no coal was ever dug");
console.log(`  ${mines} first mines and wells, each on its seam`);

// 3. The north star on the industrial planet.
const star = northStar(world, years, 16);
problems.push(...star.problems);
const domains = star.citizens.map((c) => c.walk?.domains ?? 0).sort((a, b) => a - b);
console.log(
  `  north star: ${star.citizens.length} citizens, domains ${domains.join(" ")}; crossed ${[...star.crossed].sort().join(", ")}`,
);
for (const d of ["observer", "people", "knowledge", "planet"])
  if (!star.crossed.has(d)) problems.push(`no citizen's walk crosses ${d}`);

// 4. Every year within budget; the save within bounds.
const sorted = [...times].sort((a, b) => a - b),
  slowest = sorted.at(-1)!,
  p99 = sorted[Math.floor(sorted.length * 0.99)]!;
if (slowest > YEAR_MS)
  problems.push(`the slowest year took ${slowest.toFixed(0)} ms (bound ${YEAR_MS})`);
const saved = gzipSync(JSON.stringify(saveWorld(world, rulesetId(world, "gate")))).length;
if (saved > SAVE_BYTES) problems.push(`the save is ${(saved / 1e6).toFixed(1)} MB`);
console.log(
  `  a year takes ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(0)} ms on average, ${p99.toFixed(0)} at the 99th percentile, ${slowest.toFixed(0)} at worst; the save is ${(saved / 1e6).toFixed(1)} MB`,
);

if (problems.length) {
  console.log(`\nthe Phase 3 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`\nthe Phase 3 gate passes over ${years} years`);
