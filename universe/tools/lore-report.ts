// node tools/lore-report.ts [seed] [years] — run the app's world and print how its
// lore unfolded: when each principle was first found, and by now how many lands know it.
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { PRINCIPLES } from "../src/rules/index.ts";
import { knows, loreOf, makePopulationWorld, populationContext } from "../src/sim/index.ts";

const [seedText = "first light", yearsArg = "500"] = process.argv.slice(2);
const world = makePopulationWorld(seedFromText(seedText), { start: "spread" }),
  ctx = populationContext(world);
const first = new Map<string, number>(),
  at: Record<number, Map<string, number>> = {};
for (let y = 1; y <= Number(yearsArg); y++) {
  world.runTo(y * YEAR);
  for (const p of ctx.provinces.all())
    for (const [id, k] of loreOf(world).of(p.cell))
      if (!first.has(id) || first.get(id)! > k.year) first.set(id, k.year);
  if (y % 250 === 0) {
    const m = new Map<string, number>();
    for (const pr of PRINCIPLES)
      m.set(pr.id, ctx.provinces.all().filter((p) => knows(ctx, p.cell, pr.id)).length);
    at[y] = m;
  }
}
const lands = ctx.provinces.all().length,
  marks = Object.keys(at).map(Number);
console.log(`${seedText}: ${lands} lands; known by year ${marks.join(" / ")}`);
for (const p of PRINCIPLES)
  console.log(
    `  ${p.id.padEnd(14)} first ${String(first.get(p.id) ?? "—").padStart(4)}   ${marks.map((y) => String(at[y]!.get(p.id)).padStart(3)).join(" / ")}`,
  );
