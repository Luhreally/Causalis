// node tools/phase6-gate.ts [years] — the Phase 6 gate (docs/architecture §I.6, milestone
// 65): run the Earth seed some two thousand years past its first launch (tools/sky-survey.ts,
// in its own process) and require, within that time,
//   - a colony among the stars: a ship sailed, and came down at another star;
//   - a secession the lag of light drove: a colony out there no longer answering to home;
//   - contact: another people of the cluster heard;
//   - a war between the stars whose why reaches back to something made at the universe's
//     making — a world, a star, another people's world;
//   - budgets: the save within bounds for its lands, and time running at centuries a
//     minute on the phone floor (a quarter of this machine's pace, as `npm run slice` finds).
// Divine acts at the scale of a world and of a star are held by tests (great-acts).
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { SkySurvey } from "./sky-survey.ts";

const years = Number(process.argv[2] ?? 3100);
const EARTH_LANDS = 550,
  SAVE_BYTES = 16_000_000,
  /** The phone floor runs at a quarter of this machine's pace; a century a minute there, at least. */
  PHONE = 4,
  LEAST_PACE = 100;

const t0 = performance.now(),
  r = await new Promise<SkySurvey>((done, fail) => {
    const child = fork(
      fileURLToPath(new URL("./sky-survey.ts", import.meta.url)),
      ["earth", String(years)],
      { stdio: ["ignore", "pipe", "inherit", "ipc"] },
    );
    let text = "";
    child.stdout!.on("data", (d) => (text += d));
    child.on("exit", (code) =>
      code === 0
        ? done(JSON.parse(text) as SkySurvey)
        : fail(new Error(`the run failed (${code})`)),
    );
  });

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
const scale = Math.max(1, r.lands / EARTH_LANDS),
  phonePace = r.pace / PHONE;
console.log(
  `  ${r.lands} lands; save ${(r.save / 1e6).toFixed(1)} MB (bound ${((SAVE_BYTES * scale) / 1e6).toFixed(1)}); ${r.pace} years a minute here, some ${Math.round(phonePace)} on the phone floor  [${((performance.now() - t0) / 1000).toFixed(0)} s]`,
);
if (r.save > SAVE_BYTES * scale) problems.push(`the save is ${(r.save / 1e6).toFixed(1)} MB`);
if (phonePace < LEAST_PACE)
  problems.push(
    `time runs at ${Math.round(phonePace)} years a minute on the phone floor, under ${LEAST_PACE}`,
  );

if (problems.length) {
  console.log(`\nthe Phase 6 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`);
  process.exit(1);
}
console.log("\nthe Phase 6 gate passes");
