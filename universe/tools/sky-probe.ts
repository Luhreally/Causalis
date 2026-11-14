// node tools/sky-probe.ts <seed> <sky: standard|small|large> [from=1000] [to=1400] — C0 of the stars' size (docs/architecture/
// asks-2026-11-12-plan.md, Part C): one world to a process (worlds run side by side in one process share a heap and read as twice
// the memory), its sky as chosen. The stars counted and the most peoples; how long the run to the star age takes, then each
// century in it (years a minute of work), the heap at its most, the save's size; the star map's plan as the host makes it (its
// time and its size crossing to the page); and the shape of the star age (peoples, contacts, worlds reached and held), to hold a
// small sky to a true one. Pure reading; it changes nothing. A seed "earth:<text>" is Earth's universe, any other the alien.
import { gzipSync } from "node:zlib";
import { Rng, YEAR, rulesetId, saveWorld, seedFromText, seedWithAct } from "../src/kernel/index.ts";
import { makingAct, skyOf } from "../src/rules/index.ts";
import { ALIEN, EARTH, clusterOf, clusterStar } from "../src/host/planet.ts";
import {
  civilizationsEver,
  contactsOf,
  filledOf,
  nationsOf,
  starSitesOf,
} from "../src/sim/index.ts";
import { stageOf } from "../src/host/inspect/stage.ts";

const [given = "earth:first light", sky = "standard"] = process.argv.slice(2),
  from = Number(process.argv[4] ?? 1000),
  to = Number(process.argv[5] ?? 1400),
  earth = given.startsWith("earth:"),
  name = earth ? given.slice(6) : given,
  text = sky === "standard" ? name : seedWithAct(name, makingAct("sky", sky)),
  u = earth ? EARTH : ALIEN;

const t0 = performance.now(),
  world = u.build(seedFromText(text));
let heap = 0;
const peak = () => (heap = Math.max(heap, process.memoryUsage().heapUsed));
for (let y = 100; y <= from; y += 100) {
  world.runTo(y * YEAR);
  peak();
}
const before = performance.now() - t0,
  centuries: number[] = [];
for (let y = from + 100; y <= to; y += 100) {
  const c0 = performance.now();
  world.runTo(y * YEAR);
  centuries.push(Math.round(performance.now() - c0));
  peak();
}
const p0 = performance.now(),
  rng = new Rng(world.seed),
  plan = clusterOf(world).map((s) => clusterStar(s, rng)),
  planMs = performance.now() - p0,
  save = gzipSync(
    JSON.stringify(saveWorld(world, rulesetId(world, u.version), { universe: u.name })),
  ),
  run = centuries.reduce((a, b) => a + b, 0),
  count = <T>(s: { all(): T[] } | null) => (s ? s.all().length : 0);
console.log(
  JSON.stringify({
    seed: given,
    sky,
    text,
    radius: skyOf(text)?.radius ?? 50,
    stars: plan.length,
    peoples: civilizationsEver(world).length,
    from,
    to,
    beforeS: Math.round(before / 1000),
    centuries,
    yearsAMinute: Math.round(((to - from) / run) * 60000),
    heapMB: Math.round(heap / 1048576),
    saveKB: Math.round(save.length / 1024),
    planMs: Math.round(planMs),
    planKB: Math.round(JSON.stringify(plan).length / 1024),
    contacts: count(world.hasStore("space.contact") ? contactsOf(world) : null),
    starSites: count(starSitesOf(world)),
    filled: count(filledOf(world)),
    held: count(nationsOf(world)),
    ages: Object.fromEntries(
      stageOf(world)
        .stages.filter((x) => x.year !== null && x.year >= 600)
        .map((x) => [x.name, x.year]),
    ),
  }),
);
process.exit(0);
