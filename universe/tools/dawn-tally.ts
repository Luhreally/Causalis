// node tools/dawn-tally.ts [from=0] [to=300] [--stars N]: how life began on the open ("alien") worlds, as B2 reads it
// (docs/architecture/asks-2026-11-12-plan.md Part B, primitives 1 and 2), made at the full grid and not run. What it
// tells, over the home worlds and the home stars' other living worlds (and, with --stars, the worlds of the first N
// stars of each world's cluster):
//   - where life began (the cradle), what its first life ran on, its light-eaters' and its eaters' trades;
//   - the small lives each world's drop shows (today's and its first seas'), counted as sets;
//   - when its air changed, and how often the reckoning was held at its first cells together;
//   - and that the reading agrees with what each world already is: oxygen only where its air holds it (and always
//     there, where life made it), light-eaters only where its life eats light, the tree's step dated as the page says.
// It reads only: no world is run and nothing is kept. Exits 1 where a reading disagrees with its world.
import { Rng, seedFromText } from "../src/kernel/index.ts";
import {
  clusterStars,
  elsewhereOrigin,
  foreignPlanets,
  generateHomeWorld,
  lifeElsewhere,
  makeGalaxy,
  starAgeGyr,
  treeOfLife,
  worldKindOf,
  worldLife,
  type WorldOrigin,
} from "../src/gen/index.ts";
import { KINDS, OPEN } from "../src/rules/index.ts";
import { originOfHome } from "../src/host/origin.ts";

const argv = process.argv.slice(2),
  nums = argv.filter((a) => /^\d+$/.test(a)).map(Number),
  from = nums[0] ?? 0,
  to = nums[1] ?? 300,
  stars = argv.includes("--stars") ? Number(argv[argv.indexOf("--stars") + 1]) : 0;

const tally = (into: Map<string, number>, key: string) => into.set(key, (into.get(key) ?? 0) + 1);
const sorted = (t: Map<string, number>) =>
  [...t]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
const top = (t: Map<string, number>) => {
  const all = [...t.values()].reduce((a, b) => a + b, 0);
  return all ? Math.round((100 * Math.max(...t.values())) / all) : 0;
};

type Tallies = {
  cradle: Map<string, number>;
  first: Map<string, number>;
  light: Map<string, number>;
  eaters: Map<string, number>;
  small: Map<string, number>;
  dawn: Map<string, number>;
  kinds: Map<string, number>;
  air: Map<string, number>;
};
const fresh = (): Tallies => ({
  cradle: new Map(),
  first: new Map(),
  light: new Map(),
  eaters: new Map(),
  small: new Map(),
  dawn: new Map(),
  kinds: new Map(),
  air: new Map(),
});
const home = fresh(),
  away = fresh(),
  problems: string[] = [];
let worlds = 0,
  living = 0,
  held = 0,
  dated = 0,
  awayWorlds = 0,
  awayLiving = 0;

function read(t: Tallies, o: WorldOrigin, alive: boolean) {
  if (!alive) return;
  tally(t.cradle, o.cradle?.name ?? "(none)");
  tally(t.first, o.first?.name ?? "(none)");
  tally(t.light, o.light?.name ?? "(no light-eaters)");
  tally(t.eaters, o.eaters?.name ?? "(none)");
  tally(t.small, o.small.map((s) => s.name).join(" + ") || "(none)");
  tally(t.dawn, o.dawnSmall.map((s) => s.name).join(" + ") || "(none)");
  for (const s of o.small) tally(t.kinds, s.name);
  tally(
    t.air,
    o.air.oxygen
      ? o.air.at === null
        ? "oxygen, undated"
        : `oxygen ${Math.floor(o.air.at / 1000)}–${Math.floor(o.air.at / 1000) + 1} Gyr ago`
      : "no free oxygen",
  );
}

const t0 = Date.now();
for (let i = from; i < to; i++) {
  const seed = `alien ${i}`,
    g = generateHomeWorld(seedFromText(seed), OPEN),
    kind = worldKindOf(g),
    alive = g.life.species.length > 0,
    o = originOfHome(g),
    burns = KINDS[kind].burns;
  worlds++;
  if (alive) living++;
  read(home, o, alive);
  // Agreement with what the world already is.
  if (o.air.oxygen !== burns)
    problems.push(
      `${seed}: the reading says ${o.air.oxygen ? "oxygen" : "none"}, its air ${burns ? "has" : "has none"}`,
    );
  if (alive && o.small.some((s) => s.trade === "breathe-o2") && !burns)
    problems.push(`${seed}: a small life breathes oxygen where its air has none`);
  const life = worldLife(g),
    eats = alive && life.pigment !== "polyimine";
  if (alive && !!o.light !== eats)
    problems.push(
      `${seed}: light-eaters ${o.light ? "read" : "not read"}, its life ${eats ? "eats" : "does not eat"} light`,
    );
  if (alive && life.breath === "hydrogen" && o.eaters?.id === "breathe-o2")
    problems.push(`${seed}: its eaters breathe oxygen, its life breathes hydrogen`);
  if (alive && !o.cradle) problems.push(`${seed}: alive, and no cradle read`);
  if (!alive && o.small.length) problems.push(`${seed}: lifeless, and small lives read`);
  if (alive && o.air.oxygen) {
    const tree = treeOfLife(g),
      air = tree.rungs.find((r) => r.id === "air")!.at;
    if (o.air.at !== air) problems.push(`${seed}: the page says ${o.air.at}, the tree ${air}`);
    if (o.air.at !== null) dated++;
    if (o.air.held) held++;
  }
  // The home star's other worlds, as gen/elsewhere.ts reads them.
  const star = {
    sector: 0,
    k: 0,
    ageGyr: starAgeGyr(g.star),
    remnant: false,
    spectral: g.star.spectral,
    luminosity: g.star.luminosity,
    temperature: g.star.temperature,
    mass: g.star.mass,
  };
  const rng = new Rng(seedFromText(seed)),
    check = (key: string, w: Parameters<typeof lifeElsewhere>[2], s: typeof star) => {
      const life = lifeElsewhere(rng, s, w),
        oe = elsewhereOrigin(key, s, w, life),
        lives = life.level === "cells" || life.level === "bodies" || life.level === "people";
      awayWorlds++;
      if (lives) awayLiving++;
      read(away, oe, lives);
      const lit = life.small.includes("light");
      if (oe.air.oxygen !== lit)
        problems.push(
          `${key}: the reading says ${oe.air.oxygen ? "oxygen" : "none"}, its life ${lit ? "eats light" : "eats none"}`,
        );
      if (lives && !oe.small.length) problems.push(`${key}: alive, and no small lives read`);
    };
  for (const b of g.system.bodies) {
    if (b.kind === "home") continue;
    const parent =
      b.kind === "moon" ? g.system.bodies.find((x) => x.ref === b.orbit.around) : undefined;
    check(`${seed} ${b.ref}`, { ...b, a: parent ? parent.orbit.a : b.orbit.a }, star);
  }
  if (stars) {
    const near = clusterStars(rng, makeGalaxy(rng)).slice(0, stars);
    for (const s of near) {
      if (s.distance === 0) continue;
      foreignPlanets(rng, s).forEach((p) => check(`${seed} ${s.ref}/${p.index}`, p, s));
    }
  }
  if ((i - from) % 50 === 49)
    console.log(`  … ${i + 1 - from} worlds, ${Math.round((Date.now() - t0) / 1000)} s`);
}

const say = (title: string, t: Tallies) => {
  console.log(`\n${title}`);
  console.log(
    `  where life began (${t.cradle.size} places, the commonest ${top(t.cradle)}%): ${sorted(t.cradle)}`,
  );
  console.log(
    `  what its first life ran on (${t.first.size}, ${top(t.first)}%): ${sorted(t.first)}`,
  );
  console.log(`  its light-eaters (${t.light.size}): ${sorted(t.light)}`);
  console.log(`  its eaters (${t.eaters.size}): ${sorted(t.eaters)}`);
  console.log(`  its air: ${sorted(t.air)}`);
  console.log(`  kinds of small life (${t.kinds.size}): ${sorted(t.kinds)}`);
  console.log(
    `  drops, as sets of kinds (${t.small.size} different, the commonest ${top(t.small)}%): ${sorted(t.small)}`,
  );
  console.log(
    `  first seas' drops (${t.dawn.size} different, the commonest ${top(t.dawn)}%): ${sorted(t.dawn)}`,
  );
};
console.log(
  `dawn tally: alien ${from} to ${to - 1}, ${worlds} worlds, ${living} with life (${Math.round((Date.now() - t0) / 1000)} s)`,
);
say("Home worlds", home);
console.log(`  air dated on ${dated} worlds, held at its first cells together on ${held}`);
say(`Their stars' other worlds (${awayWorlds}, ${awayLiving} with cells or more)`, away);
console.log(
  `\nagreement: ${problems.length ? `${problems.length} readings disagree with their world` : "every reading agrees with its world"}`,
);
for (const p of problems.slice(0, 40)) console.log(`  x ${p}`);
process.exit(problems.length ? 1 : 0);
