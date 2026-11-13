// node tools/water-tally.ts [from=0] [to=300] [--kept]: the open worlds' peoples of the water and the shore, made and not run —
// how many provinces their medium may live in (sim livable) and how many their bands hold at the chronicle's opening
// (sim spreadOf). --kept: each world kept as it was made before B3 ("~bodies kept").
import { seedFromText } from "../src/kernel/index.ts";
import { generateHomeWorld, provinceWorld } from "../src/gen/index.ts";
import { OPEN, keptLife } from "../src/rules/index.ts";
import { livable, spreadOf } from "../src/sim/index.ts";

const argv = process.argv.slice(2),
  kept = argv.includes("--kept"),
  [from = 0, to = 300] = argv.filter((a) => /^\d+$/.test(a)).map(Number);
const rows: { medium: string; can: number; held: number; seed: string }[] = [];
for (let i = from; i < to; i++) {
  const text = kept ? keptLife(`alien ${i}`) : `alien ${i}`,
    fine = generateHomeWorld(seedFromText(text), OPEN, 64),
    medium = fine.life.people?.body.medium;
  if (!medium || medium === "land") continue;
  const g = provinceWorld(fine);
  let can = 0;
  for (let c = 0; c < g.grid.count; c++) if (livable(g, c, medium)) can++;
  rows.push({ medium, can, held: spreadOf(g, text).lands.length, seed: text });
}
for (const medium of ["water", "shore"]) {
  const of = rows.filter((r) => r.medium === medium);
  if (!of.length) continue;
  const sum = (k: "can" | "held") => of.reduce((s, r) => s + r[k], 0),
    few = of.filter((r) => r.held < 20).length,
    sorted = of.map((r) => r.held).sort((a, b) => a - b);
  console.log(
    `${medium} peoples (${kept ? "kept" : "read"}, alien ${from}..${to - 1}): ${of.length}; provinces their medium may live in ${(sum("can") / of.length).toFixed(0)} a world, held at the opening ${(sum("held") / of.length).toFixed(0)} (median ${sorted[sorted.length >> 1]}); ${few} hold under 20; held of what they may ${((100 * sum("held")) / Math.max(1, sum("can"))).toFixed(0)}%`,
  );
  if (argv.includes("--few"))
    for (const r of of.filter((r) => r.held < 20))
      console.log(`  ${r.seed}: holds ${r.held} of ${r.can}`);
}
