// node tools/far-ceiling-tally.ts [earth:seed|seed]...: the followed peoples of a home world's stars, as first read and
// as their own worlds let them come (sim/space/far-read.ts): each one's years, its ceiling and what shuts the next
// step, how long the reading took, and whether the way in would stop any of them short at a stage the galaxy reads
// them at (it must not), at the home world's size and at the smaller ones.
import { Rng, seedFromText } from "../src/kernel/index.ts";
import { civBody, foreignPlanets } from "../src/gen/index.ts";
import { EARTH, ALIEN } from "../src/host/planet.ts";
import {
  civilizationsEver,
  civilizationsNear,
  clusterOf,
  farReadWorld,
  farShutOn,
  folkGroundDraws,
  folkOf,
} from "../src/sim/index.ts";
import type { FarStage } from "../src/rules/index.ts";

const STAGES: FarStage[] = ["villages", "towns", "cities", "works", "signals", "orbit", "stars"];
const y = (n: number) => (Number.isFinite(n) ? String(n) : "never");
for (const s of process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["earth:first light", "alien 41"]) {
  const earth = s.startsWith("earth:"),
    world = (earth ? EARTH : ALIEN).build(seedFromText(earth ? s.slice(6) : s)),
    raw = civilizationsEver(world),
    t0 = performance.now(),
    read = civilizationsNear(world),
    ms = performance.now() - t0;
  console.log(`== ${s}: ${raw.length} followed peoples, read in ${Math.round(ms)} ms`);
  let short = 0;
  for (const c of raw) {
    const r = read.find((x) => x.ref === c.ref)!,
      star = clusterOf(world).find((x) => c.star.endsWith(`:${x.sector}:${x.k}`))!,
      f = folkOf(world, star, c.planet)!,
      p = foreignPlanets(new Rng(world.seed), star)[c.planet]!,
      who = {
        name: f.name,
        ref: f.ref,
        followed: true,
        body: civBody(c) ?? f.body,
        chem: folkGroundDraws(world, star, c.planet),
      },
      top = STAGES.indexOf(f.ceiling as FarStage),
      stops: string[] = [];
    // (The way in, at each stage the galaxy can read them at and each size: it must stop none of them short.)
    for (const size of ["standard", "medium", "small"])
      for (const stage of STAGES.slice(0, top + 1)) {
        const w = farReadWorld(
          world,
          star,
          p,
          who,
          { year: 0, stage, people: 1e6, universe: "", look: null },
          size,
        );
        if (size !== "standard" && w.asked === "standard") continue;
        const shut = farShutOn(w.seed, w.made);
        if (shut) stops.push(`${size} ${stage}: ${shut.name}, ${shut.why}`);
      }
    if (stops.some((x) => x.startsWith("standard"))) short++;
    console.log(
      `  ${f.name} (${f.body.name}, ${f.body.medium}): signals ${y(c.electronics)}→${y(r.electronics)}, orbit ${y(c.orbit)}→${y(r.orbit)}, stars ${y(c.stars)}→${y(r.stars)}; ceiling ${f.ceiling}${f.shut ? `; ${f.shut}` : ""}${stops.length ? `; THE WAY IN STOPS SHORT: ${stops.join(" | ")}` : ""}`,
    );
  }
  console.log(`  stopped short at the home world's size: ${short}`);
}
