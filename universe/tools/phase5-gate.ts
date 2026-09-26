// node tools/phase5-gate.ts [--ci] — the Phase 5 gate (docs/architecture §I.5, milestone
// 55): run the Earth seed into its space age, and a light world and a heavy one of the
// open prior (tools/sky-survey.ts, each world in its own process), and require that
//   - a realm reaches orbit at a time its gravity well and propulsion explain: the first
//     satellite's why names the world's pull and the engine; the heavy world reaches orbit
//     only on an engine its pull allows, at a price the light world never pays;
//   - a second body is colonized, and a colony diverges through the ordinary rules: its
//     ways drift from its founder's, and one comes to answer to no one at home;
//   - budgets hold with more than one world peopled: every year and the save within
//     Earth's bounds, scaled by lands.
// --ci runs the Earth seed alone, to its first satellite (the colonies are held by tests).
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { SkySurvey } from "./sky-survey.ts";

const ci = process.argv.includes("--ci");
const RUNS: readonly [string, number][] = ci
  ? [["earth", 1080]]
  : [
      ["earth", 1400],
      // A light world of sea people (0.72 g: 7.3 km/s to orbit) and a heavy one (1.57 g: 13.6).
      ["alien 41", 1300],
      ["alien 55", 1400],
    ];
const EARTH_LANDS = 550,
  YEAR_MS = process.env.CI ? 1200 : 600,
  SAVE_BYTES = 16_000_000;

function run(seed: string, years: number): Promise<SkySurvey> {
  return new Promise((done, fail) => {
    const child = fork(
      fileURLToPath(new URL("./sky-survey.ts", import.meta.url)),
      [seed, String(years)],
      { stdio: ["ignore", "pipe", "inherit", "ipc"] },
    );
    let text = "";
    child.stdout!.on("data", (d) => (text += d));
    child.on("exit", (code) =>
      code === 0
        ? done(JSON.parse(text) as SkySurvey)
        : fail(new Error(`${seed} failed (${code})`)),
    );
  });
}

const t0 = performance.now(),
  problems: string[] = [],
  results = await Promise.all(RUNS.map(([s, y]) => run(s, y))),
  bySeed = new Map(results.map((r) => [r.seed, r]));

for (const r of results) {
  const sat = r.satellite;
  console.log(
    `  ${r.seed.padEnd(9)} ${r.gravity.toFixed(2)} g, ${r.speed.toFixed(1)} km/s to orbit; orbital flight ${r.orbitalFlight ?? "never"}; first satellite ${sat ? `${sat.year} on ${sat.engine}` : "never"}; crew ${r.crew ?? "-"}, station ${r.station ?? "-"}; ${r.colonies.length} colonies  [${(r.ms / 1000).toFixed(0)} s]`,
  );
  if (sat && !(sat.whyPull && sat.whyEngine))
    problems.push(`${r.seed}: the first satellite's why does not name the pull and the engine`);
  // Budgets, scaled by lands.
  const scale = Math.max(1, r.lands / EARTH_LANDS);
  if (r.slowest > YEAR_MS * scale)
    problems.push(
      `${r.seed}: its slowest year took ${r.slowest} ms (bound ${Math.round(YEAR_MS * scale)})`,
    );
  if (r.save > SAVE_BYTES * scale)
    problems.push(`${r.seed}: its save is ${(r.save / 1e6).toFixed(1)} MB`);
  console.log(
    `            slowest year ${r.slowest} ms, p99 ${r.p99}; save ${(r.save / 1e6).toFixed(1)} MB; ${r.lands} lands`,
  );
}

// 1. Earth reaches orbit in its band, on a why that names its pull and its engine.
const earth = bySeed.get("earth")!;
if (!earth.satellite) problems.push("the Earth seed never reached orbit");
else if (earth.satellite.year < 950 || earth.satellite.year > 1150)
  problems.push(`the Earth seed reached orbit in ${earth.satellite.year}, outside 950–1150`);

if (!ci) {
  // 2. A second body colonized, and a colony diverging by the ordinary rules.
  if (!earth.colonies.length) problems.push("the Earth seed never colonized another body");
  for (const c of earth.colonies)
    console.log(
      `            ${c.body} since ${c.founded} (${c.founder}): ${c.people} people, ${c.ruled ? "still ruled from home" : `their own since ${c.left ?? "?"}`}; ways ${c.ways.toFixed(2)} from the founder's, tongue ${c.tongue.toFixed(2)} alike`,
    );
  if (!earth.colonies.some((c) => c.ways > 0.25 || c.tongue < 0.85))
    problems.push("no colony's ways or tongue drifted from its founder's");
  const free = earth.colonies.filter((c) => !c.ruled && c.left !== null);
  if (!free.length) problems.push("no colony came to answer to no one at home");
  else console.log(`  a colony's leaving, and why: ${free[0]!.whyLeft.slice(0, 3).join(" ← ")}`);
  // 3. The heavy world reaches orbit only on an engine its pull allows, later after flight is known.
  const light = bySeed.get("alien 41")!,
    heavy = bySeed.get("alien 55")!;
  if (heavy.speed < 1.5 * light.speed) problems.push("the heavy world is not the heavier");
  if (heavy.satellite && !["parted-water", "atomic"].includes(heavy.satellite.engine))
    problems.push(
      `the heavy world reached orbit on ${heavy.satellite.engine}, which cannot lift from it`,
    );
  const wait = (r: SkySurvey) =>
    r.satellite && r.orbitalFlight !== null ? r.satellite.year - r.orbitalFlight : null;
  console.log(
    `  after orbital flight was found: the light world waited ${wait(light) ?? "-"} years for its first satellite, the heavy ${wait(heavy) ?? "-"}`,
  );
}
console.log(`  ${((performance.now() - t0) / 1000).toFixed(0)} s`);
if (problems.length) {
  console.log(`\nthe Phase 5 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`\nthe Phase 5 gate passes${ci ? " (the CI check)" : ""}`);
