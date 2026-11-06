// node tools/catalogue-run.ts <dir> <jobs> [<universe:seed>...] — the worlds of the seed catalogue run in
// full, side by side, each in a process of its own (Phase 65); with none named, the worlds the catalogue
// holds now. Each world is run to its last year (3000 unless --years says) and read every ten years,
// never touching what it reads: its lands' people and
// work, what their works drive, the machines they hold, its realms, towns and flights. The readings
// (and what every land came to know, and when) go to <dir>/<universe>--<seed>.ndjson; tools/catalogue.ts
// compiles them into the catalogue the title reads. A world already run is left as it is, so a run
// stopped takes up where it was.
import { spawn } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { YEAR, rulesetId, saveWorld, seedFromText } from "../src/kernel/index.ts";
import { ALIEN, EARTH } from "../src/host/planet.ts";
import { rawLore, rawReading } from "../src/host/reading.ts";
import { worldFirstsNow } from "../src/host/inspect/index.ts";

const argv = process.argv.slice(2),
  flag = (name: string, otherwise: string) => {
    const at = argv.indexOf(name);
    if (at < 0) return otherwise;
    const [v] = argv.splice(at, 2).slice(1);
    return v!;
  },
  lastYear = Number(flag("--years", "3000")),
  saves = flag("--saves", "").split(",").filter(Boolean).map(Number),
  child = flag("--child", "");

const slug = (name: string) => name.replace(/[^a-z0-9]+/gi, "_");

if (child) {
  const [dir] = argv,
    [universe, ...rest] = child.split(":"),
    // (Trimmed: a seed read from a Windows shell can bring a carriage return, and that is another world.)
    seed = rest.join(":").trim(),
    u = universe === "alien" ? ALIEN : EARTH,
    file = join(dir!, `${universe}--${slug(seed)}.ndjson`),
    t0 = performance.now(),
    world = u.build(seedFromText(seed)),
    ruleset = rulesetId(world, u.version);
  rmSync(file, { force: true });
  appendFileSync(file, `${JSON.stringify({ universe, seed, ruleset, version: u.version })}\n`);
  for (let y = 0; y <= lastYear; y += 10) {
    if (y) world.runTo(y * YEAR);
    appendFileSync(file, `${JSON.stringify(rawReading(world))}\n`);
    if (y === 20)
      appendFileSync(file, `${JSON.stringify({ hashAt: y, hashes: world.domainHashes() })}\n`);
    if (saves.includes(y)) {
      const bytes = gzipSync(JSON.stringify(saveWorld(world, ruleset, { universe: u.name })));
      writeFileSync(join(dir!, `${universe}--${slug(seed)}--${y}.save`), bytes);
    }
    if (y % 500 === 0)
      console.log(
        `${seed}: year ${y}, ${Math.round((performance.now() - t0) / 1000)} s, heap ${Math.round(process.memoryUsage().heapUsed / 1e6)} MB`,
      );
  }
  appendFileSync(
    file,
    `${JSON.stringify({
      end: lastYear,
      s: Math.round((performance.now() - t0) / 1000),
      lore: rawLore(world),
      firsts: worldFirstsNow(world).map((f) => [f.what, f.year]),
    })}\n`,
  );
  renameSync(file, `${file.slice(0, -7)}.done.ndjson`);
  process.exit(0);
}

const [dir, jobsArg, ...named] = argv,
  jobs = Number(jobsArg),
  worlds = named.length
    ? named
    : (
        JSON.parse(readFileSync(new URL("../public/catalogue.json", import.meta.url), "utf8")) as {
          seeds: readonly { universe: string; seed: string }[];
        }
      ).seeds.map((s) => `${s.universe}:${s.seed}`);
mkdirSync(dir!, { recursive: true });
const tool = fileURLToPath(import.meta.url),
  waiting = worlds.filter((w) => {
    const [universe, ...rest] = w.split(":");
    return !existsSync(join(dir!, `${universe}--${slug(rest.join(":"))}.done.ndjson`));
  });
let running = 0;
const next = () => {
  while (running < jobs && waiting.length) {
    const w = waiting.shift()!;
    running++;
    const started = Date.now(),
      p = spawn(
        process.execPath,
        [
          "--max-old-space-size=4600",
          tool,
          dir!,
          "--child",
          w,
          "--years",
          String(lastYear),
          ...(saves.length ? ["--saves", saves.join(",")] : []),
        ],
        { stdio: "inherit" },
      );
    p.on("exit", (code) => {
      running--;
      console.log(
        `== ${w}: exit ${code} after ${Math.round((Date.now() - started) / 1000)} s (${waiting.length} waiting, ${running} running)`,
      );
      next();
    });
  }
};
next();
