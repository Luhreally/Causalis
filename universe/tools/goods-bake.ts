// node tools/goods-bake.ts <earth|alien> <seed> <years,comma> <outdir>: one world run on in this process, saved at each year asked
// (gzipped as the host saves it, named <universe>-<seed>-<year>.save), for reading its markets after (tools/goods-probe.ts). One world
// to a process: a second run in the same one starts from what the first left behind.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { YEAR, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";

const [universe = "earth", seed = "first light", list = "300", out = "."] = process.argv.slice(2),
  U = universe === "earth" ? EARTH : ALIEN,
  world = U.build(seedFromText(seed)),
  t0 = Date.now();
mkdirSync(out, { recursive: true });
for (const y of list.split(",").map(Number)) {
  world.runTo(y * YEAR);
  const file = join(out, `${universe}-${seed.replace(/\s+/g, "-")}-${y}.save`);
  writeFileSync(
    file,
    gzipSync(JSON.stringify(saveWorld(world, rulesetId(world, U.version), { universe: U.name }))),
  );
  console.log(`${seed} ${y}: ${Math.round((Date.now() - t0) / 1000)} s, ${file}`);
}
