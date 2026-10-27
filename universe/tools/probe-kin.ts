// node tools/probe-kin.ts [seeds] [year] [towns] — anyone's family and body (Phase 55 wave 5), in no
// page: over the largest towns' line holders, their families as the keyed rules give them (wed,
// children and those living, brothers and sisters, the line's parent known, their ages), what the
// card and the page with its Family and Body tabs cost (p50, p99, the worst), the men the rolls of
// the year before's battles name (line holders or met, or the levy's by their roll alone), each
// fallen man's death blow and each maimed man's member lost — and that asking moved nothing.
import { YEAR, seedFromText } from "../src/kernel/index.ts";
import { populationContext } from "../src/sim/index.ts";
import { EARTH } from "../src/host/planet.ts";
import { LINE, townRoster } from "../src/host/roster.ts";
import { battleRoll } from "../src/host/roll.ts";
import { battlesOfYear } from "../src/host/burials.ts";
import { bodyOf, familyOf, kinCard } from "../src/host/kin.ts";
import { pageOf } from "../src/host/inspect/index.ts";

const seeds = (process.argv[2] ?? "first light").split(","),
  year = Number(process.argv[3] ?? 365),
  most = Number(process.argv[4] ?? 3);
const timed = <T>(f: () => T) => {
  const a = performance.now(),
    v = f();
  return { v, ms: performance.now() - a };
};
const at = (xs: number[], q: number) =>
  xs.length
    ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))]!
    : 0;
for (const seed of seeds) {
  const world = EARTH.build(seedFromText(seed)),
    began = performance.now();
  world.runTo(year * YEAR);
  console.log(
    `${seed} at year ${year} (${((performance.now() - began) / 1000).toFixed(1)} s to make)`,
  );
  const before = JSON.stringify(world.domainHashes()),
    towns = populationContext(world)
      .settlements.all()
      .filter((s) => s.population > 0)
      .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
      .slice(0, most),
    took = { family: [] as number[], card: [] as number[], page: [] as number[] };
  let holders = 0,
    wed = 0,
    children = 0,
    living = 0,
    siblings = 0,
    known = 0,
    worst = { what: "", ms: 0 };
  const ages: number[] = [],
    note = (what: keyof typeof took, ref: string, ms: number) => {
      took[what].push(ms);
      if (ms > worst.ms) worst = { what: `${what} ${ref}`, ms };
    };
  for (const s of towns) {
    const roster = townRoster(world, s.ref),
      lines = Math.ceil(s.population / LINE);
    console.log(`  ${s.name} (${s.ref}): ${s.population} people, ${lines} lines`);
    for (let k = 0; k < lines; k++) {
      const h = roster.holder(k);
      if (!h) continue;
      const f = timed(() => familyOf(world, h.ref));
      if (!f.v) continue;
      note("family", h.ref, f.ms);
      holders++;
      if (f.v.spouse) wed++;
      children += f.v.children.length;
      living += f.v.children.filter((c) => c.died === null).length;
      siblings += f.v.siblings.length;
      if (f.v.parents.some((p) => p.ref)) known++;
      ages.push(year - h.born);
      note("card", h.ref, timed(() => kinCard(world, h.ref)).ms);
      if (k < 40) note("page", h.ref, timed(() => pageOf(world, h.ref)).ms);
    }
  }
  console.log(
    `  ${holders} line holders: wed ${((100 * wed) / Math.max(1, holders)).toFixed(0)}%, children ${(children / Math.max(1, holders)).toFixed(2)} each (${(living / Math.max(1, holders)).toFixed(2)} living), brothers and sisters ${(siblings / Math.max(1, holders)).toFixed(2)}, the line's parent known ${((100 * known) / Math.max(1, holders)).toFixed(0)}%; ages p10/p50/p90 ${at(ages, 0.1)}/${at(ages, 0.5)}/${at(ages, 0.9)}`,
  );
  // The men of the year before's battles: whom the rolls name, and their bodies.
  let held = 0,
    levy = 0,
    killed = 0,
    lost = 0;
  const members: Record<string, number> = {};
  for (const { b } of battlesOfYear(world, year - 1).slice(0, 6)) {
    const roll = battleRoll(world, b.event);
    if (!roll) continue;
    for (const side of [roll.attacker, roll.defender]) {
      for (const e of [...side.fell, ...side.hurt, ...side.stood])
        if (e.ref.startsWith("lv:")) levy++;
        else held++;
      for (const e of side.fell) {
        const d = bodyOf(world, e.ref)?.death;
        if (!d) continue;
        killed++;
        members[d.member] = (members[d.member] ?? 0) + 1;
      }
      for (const e of side.hurt.filter((x) => x.maimed))
        if (bodyOf(world, e.ref)?.wounds.some((w) => w.event === b.event && w.outcome === "lost"))
          lost++;
      for (const e of [...side.fell, ...side.hurt].slice(0, 20)) {
        note("card", e.ref, timed(() => kinCard(world, e.ref)).ms);
        note("page", e.ref, timed(() => pageOf(world, e.ref)).ms);
      }
    }
  }
  console.log(
    `  the rolls of year ${year - 1}: ${held} line holders or met, ${levy} of the levy by their roll alone; ${killed} death blows (${Object.entries(
      members,
    )
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .map(([m, n]) => `${m} ${n}`)
      .join(", ")}), ${lost} maimed men's members lost`,
  );
  for (const what of ["family", "card", "page"] as const)
    console.log(
      `  ${what}: p50 ${at(took[what], 0.5).toFixed(2)} ms, p99 ${at(took[what], 0.99).toFixed(2)} (${took[what].length} asked)`,
    );
  console.log(`  the worst: ${worst.what} ${worst.ms.toFixed(1)} ms`);
  console.log(`  domain hashes unchanged: ${JSON.stringify(world.domainHashes()) === before}`);
}
