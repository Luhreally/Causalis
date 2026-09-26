// node tools/phase4-gate.ts [seeds] [years] [--lanes n] [--ci] — the Phase 4 gate
// (docs/architecture §I.4, milestone 45): across a hundred open-prior worlds run nine
// centuries (tools/diversity.ts), require
//   - distinct outcomes: many body plans in all three media, invention orders that
//     differ world to world, many house forms and arms, and worlds that end differently
//     (lifeless, foragers, realms, industry);
//   - a people neither two-sided nor of the land coming to power by another road than
//     fire and fuel (the tides, the vents);
//   - no people outbreeding the chronicle (none grows faster than three-fold a century);
//   - budgets: every world's slowest year and its save within Earth's bounds, scaled by
//     how many lands it has against Earth's;
//   - the Earth seed within its bands (the Phase 3 gate, run alongside).
// --ci runs the smaller check the CI machines can afford: thirty worlds for a century
// and a half, and the named sea people until it comes to power.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { spread, survey, surveyAll, type Survey } from "./diversity.ts";

const args = process.argv.slice(2),
  ci = args.includes("--ci"),
  lanesAt = args.indexOf("--lanes"),
  lanes = lanesAt >= 0 ? Number(args[lanesAt + 1]) : undefined,
  plain = args.filter((a, i) => !a.startsWith("--") && (lanesAt < 0 || i !== lanesAt + 1)),
  seeds = Number(plain[0] ?? (ci ? 30 : 100)),
  years = Number(plain[1] ?? (ci ? 150 : 900));
/** The world the gate knows a sea people comes to power in (radial swimmers, tide mills in year 835). */
const SEA_POWER = "alien 65";
/** Earth's lands, and its bounds (tools/phase3-gate.ts): the slowest year, the save. */
const EARTH_LANDS = 550,
  YEAR_MS = process.env.CI ? 1200 : 600,
  SAVE_BYTES = 16_000_000;
/** No people grows faster than this a century, over the whole run. */
const MOST_GROWTH = 3;

const problems: string[] = [],
  t0 = performance.now();
const surveys = await surveyAll(
  Array.from({ length: seeds }, (_, i) => `alien ${i}`),
  years,
  lanes,
);
const s = spread(surveys),
  peopled = surveys.filter((x) => x.clade),
  kinds = (r: Readonly<Record<string, number>>) =>
    Object.keys(r).filter((k) => k !== "none").length;

// 1. Distinct outcomes.
const need = (what: string, have: number, least: number) => {
  if (have < least) problems.push(`${what}: ${have}, fewer than ${least}`);
  else console.log(`  ${what.padEnd(34)} ${have}  (at least ${least})`);
};
need("body plans among the peoples", kinds(s.clades), ci ? 4 : 6);
need("media they live in", kinds(s.media), ci ? 2 : 3);
need("ways the worlds end", kinds(s.outcomes), ci ? 2 : 3);
const finders = peopled.filter((x) => x.order.length >= 8).length;
need(
  "distinct orders of the first eight finds",
  new Set(
    peopled
      .filter((x) => x.order.length >= 8)
      .map((x) =>
        x.order
          .slice(0, 8)
          .map(([w]) => w)
          .join(">"),
      ),
  ).size,
  Math.ceil(0.6 * finders),
);
need("house forms", kinds(s.forms), ci ? 3 : 6);
need("arms their hosts carry", kinds(s.arms), ci ? 3 : 5);

// 2. Another road to power.
const other = (x: Survey) =>
  x.industry?.fuelless && x.symmetry !== "bilateral" && x.medium !== "land";
let road = surveys.find(other);
if (!road && ci) road = survey(SEA_POWER, 900, true);
if (!road || !other(road))
  problems.push("no people neither two-sided nor of the land came to power without fuel");
else
  console.log(
    `  another road to power               ${road.seed}: ${road.clade} of the ${road.medium}, ${road.industry!.by} in year ${road.industry!.year}`,
  );

// 3. No one outbreeds the chronicle; 4. budgets, scaled by the world's lands.
for (const x of peopled) {
  const centuries = x.years / 100,
    growth = x.first > 0 && centuries > 0 ? (x.peak / x.first) ** (1 / centuries) : 1;
  if (growth > MOST_GROWTH)
    problems.push(`${x.seed}: its people grew ${growth.toFixed(1)}-fold a century`);
  const scale = Math.max(1, x.lands / EARTH_LANDS);
  if (x.slowest > YEAR_MS * scale)
    problems.push(
      `${x.seed}: its slowest year took ${x.slowest} ms (bound ${Math.round(YEAR_MS * scale)})`,
    );
  if (x.save > SAVE_BYTES * scale)
    problems.push(`${x.seed}: its save is ${(x.save / 1e6).toFixed(1)} MB`);
}
const fastest = Math.max(
  ...peopled.map((x) => (x.first > 0 ? (x.peak / x.first) ** (100 / Math.max(1, x.years)) : 1)),
);
console.log(
  `  the fastest growth a century        ${fastest.toFixed(2)}-fold  (at most ${MOST_GROWTH})`,
);
console.log(
  `  the slowest year of any world       ${Math.max(...surveys.map((x) => x.slowest))} ms; the largest save ${(Math.max(...surveys.map((x) => x.save)) / 1e6).toFixed(1)} MB`,
);
console.log(`  outcomes                            ${JSON.stringify(s.outcomes)}`);
console.log(
  `  ${seeds} worlds, ${years} years each, in ${((performance.now() - t0) / 1000).toFixed(0)} s`,
);

// 5. Earth within its bands (the Phase 3 gate; CI runs it as its own job).
if (!ci) {
  const earth = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./phase3-gate.ts", import.meta.url)), "900"],
    { encoding: "utf8" },
  );
  if (earth.status !== 0) problems.push(`the Phase 3 gate fails on Earth:\n${earth.stdout}`);
  else
    console.log(`  Earth                               ${earth.stdout.trim().split("\n").at(-1)}`);
}

if (problems.length) {
  console.log(`\nthe Phase 4 gate fails:\n${problems.map((p) => `  ✗ ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`\nthe Phase 4 gate passes${ci ? " (the CI check)" : ""}`);
