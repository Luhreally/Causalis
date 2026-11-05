// node tools/f2-probe.ts [seed="wren 455"] [lastYear=1000]: the F2 and F3 probe (heat, not fire). An alien world is
// built in memory and run on by a century at a time. Each step prints its lands and realms, the battles fought in
// that century and its people; the year each rung of arms was first known on any land; the year each means of heat
// and each step it opens was first known (joined-hearth, sun-furnace, ground-furnace, forged-star-iron,
// pottery-wheel, glass, factories, electricity, steel, wings, tall-frames); the year its first works were set
// (m.works); its means of heat, as the world's numbers give them; its metal roots and engines; and its first
// host's parts, with what each is made to on this world (`here`).
import { YEAR, seedFromText, yearOfMoment, type Ref } from "../src/kernel/index.ts";
import { ALIEN } from "../src/host/planet.ts";
import { hostDesign } from "../src/host/arms.ts";
import { kindOf } from "../src/host/kinds.ts";
import { meansOfWorld } from "../src/gen/index.ts";
import { KINDS, METAL_ROOTS, OWN_ENGINES, PRINCIPLES } from "../src/rules/index.ts";
import {
  homePlanet,
  loreOf,
  marketsOf,
  politiesOf,
  populationContext,
  warsOf,
} from "../src/sim/index.ts";

const seed = process.argv[2] ?? "wren 455",
  last = Number(process.argv[3] ?? 1000),
  started = performance.now(),
  world = ALIEN.build(seedFromText(seed)),
  kind = kindOf(world),
  facts = KINDS[kind],
  means = meansOfWorld(homePlanet(world).generated),
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
  heat = [
    "joined-hearth",
    "sun-furnace",
    "ground-furnace",
    "forged-star-iron",
    "pottery-wheel",
    "glass",
    "factories",
    "electricity",
    "steel",
    "wings",
    "tall-frames",
  ],
  own = [...new Set([...METAL_ROOTS, ...OWN_ENGINES])];

console.log(
  `${seed}: ${facts.icon} ${facts.name} (${kind}); ${facts.burns ? "fire burns in its air" : "nothing burns in its air"}`,
);
console.log(
  `  its means of heat: ${means.heats.map((h) => `${h.name} ${h.heat} °C${h.est ? " (est)" : ""}`).join("; ")}`,
);
let prev = 0;
for (let y = 100; y <= last; y += 100) {
  world.runTo(y * YEAR);
  const ctx = populationContext(world),
    lore = loreOf(world),
    markets = marketsOf(world),
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
    shown = (ids: readonly string[]) => ids.map((id) => `${id} ${firstOf(id) ?? "-"}`).join(", "),
    // (m.works: the event that first set a land's works, told in its year.)
    worksYear = (): number | null => {
      let first: number | null = null;
      for (const p of lands) {
        const works = markets.get(p.cell)?.works,
          e = works ? world.events.get(works as Ref) : undefined;
        if (e && (first === null || yearOfMoment(e.t) < first)) first = yearOfMoment(e.t);
      }
      return first;
    };
  prev = y;
  const first = realms[0],
    parts = first ? (hostDesign(world, first.ref)?.parts ?? []) : [];
  console.log(
    `year ${y}: ${lands.length} lands, ${realms.length} realms, ${battles} battles in the last hundred years, ${people} people (${((performance.now() - started) / 1000).toFixed(0)} s)`,
  );
  console.log(`  rungs: ${shown(rungs)}`);
  for (const id of heat) console.log(`  ${id}: ${firstOf(id) ?? "-"}`);
  console.log(`  m.works first set: ${worksYear() ?? "-"}`);
  console.log(`  its metal roots and engines: ${shown(own)}`);
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
