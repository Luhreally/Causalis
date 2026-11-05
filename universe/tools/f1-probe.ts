// node tools/f1-probe.ts [seed="wren 455"] [lastYear=1000]: the F1 probe (arms by what they do). An alien
// world is built in memory and run on by a century at a time. Each step prints its lands and realms, the
// battles fought in that century and its people; the year each rung of arms was first known on any land
// (set edges, bound plates, black powder, firearms, rifling, repeating fire, self-loading, automatic fire,
// and any beam rung); the kind's own rows (the principles its kind names for itself, and its roads to metal
// and to engines); and its first host's parts, with what each is made to on this world (`here`).
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { ALIEN } from "../src/host/planet.ts";
import { hostDesign } from "../src/host/arms.ts";
import { kindOf } from "../src/host/kinds.ts";
import { KINDS, METAL_ROOTS, OWN_ENGINES, PRINCIPLES } from "../src/rules/index.ts";
import { loreOf, politiesOf, populationContext, warsOf } from "../src/sim/index.ts";

const seed = process.argv[2] ?? "wren 455",
  last = Number(process.argv[3] ?? 1000),
  started = performance.now(),
  world = ALIEN.build(seedFromText(seed)),
  kind = kindOf(world),
  facts = KINDS[kind],
  rungs = [
    "set-edges",
    "bound-plates",
    "gunpowder",
    "firearms",
    "rifling",
    "repeating-fire",
    "self-loading",
    "automatic-fire",
    ...PRINCIPLES.map((p) => p.id).filter((id) => id.includes("beam")),
  ],
  own = [...new Set([...METAL_ROOTS, ...OWN_ENGINES])];

console.log(
  `${seed}: ${facts.icon} ${facts.name} (${kind}); ${facts.burns ? "fire burns in its air" : "nothing burns in its air"}`,
);
let prev = 0;
for (let y = 100; y <= last; y += 100) {
  world.runTo(y * YEAR);
  const ctx = populationContext(world),
    lore = loreOf(world),
    lands = ctx.provinces.all().filter((p) => p.total() > 0),
    people = lands.reduce((n, p) => n + p.total(), 0),
    realms = politiesOf(world).living(),
    battles = warsOf(world)
      .all()
      .flatMap((w) => w.battles)
      .filter((b) => b.year > prev && b.year <= y).length,
    firstOf = (id: string): number | null => {
      let first: number | null = null;
      for (const p of lands) {
        const k = lore.get(p.cell, id);
        if (k && (first === null || k.year < first)) first = k.year;
      }
      return first;
    },
    shown = (ids: readonly string[]) => ids.map((id) => `${id} ${firstOf(id) ?? "-"}`).join(", ");
  prev = y;
  const first = realms[0],
    parts = first ? (hostDesign(world, first.ref)?.parts ?? []) : [];
  console.log(
    `year ${y}: ${lands.length} lands, ${realms.length} realms, ${battles} battles in the last hundred years, ${people} people (${((performance.now() - started) / 1000).toFixed(0)} s)`,
  );
  console.log(`  rungs: ${shown(rungs)}`);
  if (own.length) console.log(`  its own rows: ${shown(own)}`);
  console.log(
    `  its first host${first ? ` (${first.ref})` : ""}: ${
      parts.length
        ? parts
            .map(
              (p) =>
                `${p.role} ${p.id} of ${p.material}${p.here ? ` here ${JSON.stringify(p.here)}` : ""}`,
            )
            .join("; ")
        : "none yet"
    }`,
  );
}
console.log(`done in ${((performance.now() - started) / 1000).toFixed(0)} s`);
