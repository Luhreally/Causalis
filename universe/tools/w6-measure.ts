// node tools/w6-measure.ts reach <dir> <year> | fork <file> <years>: arms past the greatest fire measured on far saves (war-reach-plan.md W6).
//   reach: of every save at a year, what the nearest people commands, against what a sky and a world like theirs would take; who reaches what by their own numbers.
//   fork: a save run on so many years: crises, how many step back, what falls, a year's cost, the save's size. Nothing forced.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { rungOf, skyMj, unmakeMj } from "../src/rules/index.ts";
import {
  commandOf,
  farOf,
  fireOf,
  lateOf,
  politiesOf,
  populationContext,
  starWarsOf,
} from "../src/sim/index.ts";
import { meansNumbers } from "../src/gen/index.ts";

const [mode, a, b] = process.argv.slice(2);
const load = (file: string, universe: string): World => {
  const u = universe === "earth" ? EARTH : ALIEN,
    doc = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as Parameters<
      typeof loadWorld
    >[0];
  return loadWorld(doc, (s) => u.build(s), rulesetId(u.build(seedFromText(doc.seed)), u.version), {
    allowRulesetChange: true,
  }).world;
};

function reach(world: World): Record<string, unknown> {
  const ctx = populationContext(world),
    year = Math.floor(world.now / YEAR),
    n = meansNumbers(ctx.generated),
    w = { pull: n.pull, radius: n.radius, airBar: n.airBar },
    realms = politiesOf(world).living();
  let hull = 0,
    light = 0,
    fire = 0,
    sky = 0,
    world2 = 0,
    drive = 0;
  for (const p of realms) {
    const c = commandOf(ctx, p, year);
    hull = Math.max(hull, c.hullMj);
    light = Math.max(light, c.lightMj);
    fire += c.fireMj > 0 ? 1 : 0;
    drive += c.hullMj > 0 ? 1 : 0;
    if (rungOf({ ...c, works: true }, w) === "sky") sky++;
    if (rungOf({ ...c, works: true }, w) === "world") world2++;
  }
  return {
    seed: world.seed.text,
    year,
    realms: realms.length,
    holdFire: fire,
    haveDrive: drive,
    reachSky: sky,
    reachWorld: world2,
    bestHull: hull,
    bestLight: light,
    needSky: skyMj(w),
    needWorld: unmakeMj(w),
    mirrorsKm2: lateOf(world)?.mirrors?.km2 ?? 0,
    starWars: starWarsOf(world).all().length,
  };
}

if (mode === "reach") {
  const files = readdirSync(a!).filter((f) => f.endsWith(`--${b}.save`));
  for (const f of files) {
    const universe = f.split("--")[0]!,
      started = performance.now();
    try {
      console.log(
        JSON.stringify({
          ...reach(load(join(a!, f), universe)),
          ms: Math.round(performance.now() - started),
        }),
      );
    } catch (e) {
      console.log(JSON.stringify({ file: f, failed: (e as Error).message }));
    }
  }
} else {
  const universe = a!.split(/[\\/]/).at(-1)!.split("--")[0]!,
    world = load(a!, universe),
    u = universe === "earth" ? EARTH : ALIEN,
    from = Math.floor(world.now / YEAR),
    years = Number(b ?? 100);
  console.log(JSON.stringify({ start: reach(world) }));
  const before = JSON.stringify(
    saveWorld(world, rulesetId(world, u.version), { universe: u.name }),
  ).length;
  let spent = 0;
  for (let y = 1; y <= years; y++) {
    const t0 = performance.now();
    world.runTo((from + y) * YEAR);
    spent += performance.now() - t0;
    if (y % 25 === 0 || y === years) {
      const far = farOf(world),
        s = fireOf(world).state;
      console.log(
        JSON.stringify({
          year: from + y,
          msAYear: Math.round(spent / y),
          crises: far?.crises.length ?? 0,
          stepped: far?.crises.filter((c) => c.end === "stepped").length ?? 0,
          gone: far?.crises.filter((c) => c.end === "gone").length ?? 0,
          fell: far?.falls.map((f) => [f.rung, f.year, f.dead]) ?? [],
          works: far?.works.length ?? 0,
          worksDone: far?.works.filter((w) => w.done !== null).length ?? 0,
          w5crises: s.crises.length,
          w5falls: s.falls.length,
          dread: Math.round(s.dread * 100) / 100,
        }),
      );
    }
  }
  const after = JSON.stringify(
    saveWorld(world, rulesetId(world, u.version), { universe: u.name }),
  ).length;
  console.log(JSON.stringify({ end: reach(world), saveBefore: before, saveAfter: after }));
}
process.exit(0);
