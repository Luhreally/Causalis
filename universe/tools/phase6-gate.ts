// node tools/phase6-gate.ts [years] [--ci] — the Phase 6 gate (docs/architecture §I.6, milestone
// 65): run the Earth seed some two thousand years past its first launch (tools/sky-survey.ts,
// in its own process) and require, within that time,
//   - a colony among the stars: a ship sailed, and came down at another star;
//   - a secession the lag of light drove: a colony out there no longer answering to home;
//   - contact: another people of the cluster heard;
//   - a war between the stars whose why reaches back to something made at the universe's
//     making — a world, a star, another people's world;
//   - budgets: the save within bounds for its lands, and time running at centuries a
//     minute on the phone floor (an iPhone 15 Plus: some two thirds of this machine's pace).
// Two open worlds of some 600 lands, the busiest of that size known (Phase 63), run as far and are
// held to the same budgets, and to no year past the bound for a late one (a year's cost goes with a
// world's lands: the few far larger have a bound for their save as large, and no such clock).
// Divine acts at the scale of a world and of a star are held by tests (great-acts).
//
// --ci holds what is the same on every machine (a runner's clock proves nothing): all of the above
// but time, for the Earth seed and one open world, side by side. Without it, its clocks mean what
// they say on a quiet machine, on its fast cores (a process left to the slow ones takes some 1.7
// times as long: here, cmd //c "start /affinity FFFF /b /wait node tools/phase6-gate.ts").
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { SkySurvey } from "./sky-survey.ts";

const ci = process.argv.includes("--ci"),
  years = Number(process.argv.slice(2).find((a) => !a.startsWith("--")) ?? 3100),
  OTHERS = ci ? ["alien 41"] : ["alien 41", "alien 55"];
const EARTH_LANDS = 550,
  SAVE_BYTES = 18_000_000,
  /** The phone floor (an iPhone 15 Plus) runs at two thirds of this machine's pace; a century a minute there, at least. */
  PHONE = 1.5,
  LEAST_PACE = 100,
  /** No year of an open world takes longer than this on this machine. */
  SLOWEST_MS = 500;

function survey(seed: string): Promise<SkySurvey> {
  return new Promise<SkySurvey>((done, fail) => {
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
        : fail(new Error(`${seed}: the run failed (${code})`)),
    );
  });
}

// (On a runner side by side, for its time; here one at a time, each judged alone on the machine.)
const surveyed: SkySurvey[] = [];
if (ci) surveyed.push(...(await Promise.all(["earth", ...OTHERS].map(survey))));
else for (const seed of ["earth", ...OTHERS]) surveyed.push(await survey(seed));
const r = surveyed[0]!;

const problems: string[] = [],
  launch = r.satellite?.year ?? null,
  within = (y: number | null) => y !== null && launch !== null && y - launch <= 2100;
console.log(
  `  first satellite ${launch ?? "never"}; ships to the stars: ${r.voyages.sailed} sailed (first ${r.voyages.firstSailed ?? "-"}), ${r.voyages.arrived} came down (first ${r.voyages.firstArrived ?? "-"})`,
);
if (!launch) problems.push("the Earth seed never reached orbit");
if (!within(r.voyages.firstArrived))
  problems.push("no ship came down at another star within two thousand years of the first launch");
for (const c of r.starColonies)
  console.log(
    `    ${c.distance.toFixed(1)} light-years: ${c.people} people${c.arrived ? "" : " aboard"}, ${c.ruled ? "ruled from home" : c.left !== null ? `their own since ${c.left}` : "their own"}`,
  );
const broke = r.starColonies.find((c) => c.left !== null);
if (!broke) problems.push("no colony among the stars broke away");
else
  console.log(`  a colony broke away in ${broke.left}: ${broke.whyLeft.slice(0, 3).join(" ← ")}`);
console.log(`  other peoples heard: ${r.contact.count} (first ${r.contact.first ?? "-"})`);
if (!r.contact.count) problems.push("no other people was heard");
const war = r.starWars.first;
console.log(
  `  wars between the stars: ${r.starWars.count}${war ? `; the first in ${war.year}, ${war.won === null ? "its fleet still sailing" : war.won ? "won" : "lost"}` : ""}`,
);
if (!war || !within(war.year))
  problems.push("no war between the stars within two thousand years of the first launch");
else if (!war.reachesWorld)
  problems.push("the first war's why does not reach a world, a star or another people");
else console.log(`  its why reaches: ${war.walk.slice(-4).join(" ← ")}`);
// The budgets, of each world.
for (const w of surveyed) {
  const scale = Math.max(1, w.lands / EARTH_LANDS),
    bound = SAVE_BYTES * scale,
    phonePace = w.pace / PHONE,
    minutesTo = (year: number) =>
      (w.yearMs.slice(0, year / 500).reduce((a, b) => a + b * 500, 0) * PHONE) / 60_000,
    largest = w.stores.map(([name, n]) => `${name} ${(n / 1e6).toFixed(2)}`).join(", ");
  console.log(
    `  ${w.seed}: ${w.lands} lands; save ${(w.save / 1e6).toFixed(1)} MB (bound ${(bound / 1e6).toFixed(1)}); ${w.pace} years a minute here (${Math.round(phonePace)} on the phone floor); slowest year ${w.slowest} ms, p99 ${w.p99}; run in ${Math.round(w.ms / 1000)} s\n    a year's ms by the 500: ${w.yearMs.join(" ")}; on the phone floor, year 1,500 in ${minutesTo(1500).toFixed(1)} minutes and year 3,000 in ${minutesTo(3000).toFixed(1)}\n    ${largest}`,
  );
  if (w.save > bound) problems.push(`${w.seed}: the save is ${(w.save / 1e6).toFixed(1)} MB`);
  if (ci) continue;
  if (phonePace < LEAST_PACE)
    problems.push(
      `${w.seed}: time runs at ${Math.round(phonePace)} years a minute on the phone floor, under ${LEAST_PACE}`,
    );
  if (w !== r && w.slowest > SLOWEST_MS)
    problems.push(`${w.seed}: its slowest year took ${w.slowest} ms (bound ${SLOWEST_MS})`);
}

if (problems.length) {
  console.log(`\nthe Phase 6 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`\nthe Phase 6 gate passes${ci ? " (the CI check: no clocks)" : ""}`);
