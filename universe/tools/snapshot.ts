// node tools/snapshot.ts [seed] [year] [out.json] [--cradle] — run the peopled world (the arms
// report's: the Earthlike prior, the spread start unless --cradle) to a year and save it, so that
// experiments can fork from there instead of living the same centuries again: the reports take
// --from <out.json> and run on under whatever rules this tree holds (a save from other rules
// loads as a history changing rules does — the stores it lacks begin anew). Both sides of an A/B
// fork from the same file, so they differ only by their rules from that year on.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { YEAR, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { EARTHLIKE } from "../src/rules/index.ts";
import * as sim from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  cradle = argv.includes("--cradle"),
  [seedText = "first light", yearArg = "250", out = `snapshots/${seedText}-${yearArg}.json`] =
    argv.filter((a) => !a.startsWith("--")),
  year = Number(yearArg);
if (!Number.isInteger(year) || year < 1) {
  console.error("usage: node tools/snapshot.ts [seed] [year] [out.json] [--cradle]");
  process.exit(1);
}
const t0 = performance.now(),
  world = sim.makePopulationWorld(seedFromText(seedText), {
    prior: EARTHLIKE,
    start: cradle ? "cradle" : "spread",
  });
world.runTo(year * YEAR);
const ran = performance.now() - t0,
  doc = saveWorld(world, rulesetId(world, "snapshot"), {
    seed: seedText,
    year,
    start: cradle ? "cradle" : "spread",
  });
mkdirSync(dirname(out), { recursive: true });
const text = JSON.stringify(doc);
writeFileSync(out, text);
console.log(
  `"${seedText}" to year ${year} in ${(ran / 1000).toFixed(1)} s; saved ${(text.length / 1e6).toFixed(1)} MB to ${out}`,
);
