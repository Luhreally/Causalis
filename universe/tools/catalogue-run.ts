// node tools/catalogue-run.ts <dir> <jobs> [<universe:seed>...] — the worlds of the seed catalogue run in
// full, side by side, each in a process of its own (Phase 65); with none named, the worlds the catalogue
// holds now. Each world is run to its last year (3000 unless --years says) and read every ten years,
// never touching what it reads: its lands' people and
// work, what their works drive, the machines they hold, its realms, towns and flights. The readings
// (and what every land came to know, and when) go to <dir>/<universe>--<seed>.ndjson; tools/catalogue.ts
// compiles them into the catalogue the title reads. A world already run is left as it is, so a run
// stopped takes up where it was.
// --chunk <seconds>: a world run in parts (each a job of its own, as a shared machine's lane wants them short): once a
// part has run so long, the world is saved where its last reading stands (<universe>--<seed>.part.save, and its year in
// .part.json) and the child stops; run again, it loads that save and reads on from there into the same file. Only a
// part made under these rules is taken up (its ruleset, and the save's, must be this game's), else the world is run
// again from its start. The readings stay in <...>.ndjson until the last year is read, and then the file is moved to
// <...>.done.ndjson, so a run stopped anywhere leaves nothing the catalogue reads half done. (--stop <year>: a part
// ends there, whatever its time, to hold a world run in parts to the same world run whole.)
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
import { gunzipSync, gzipSync } from "node:zlib";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type World,
} from "../src/kernel/index.ts";
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
  chunk = Number(flag("--chunk", "0")),
  stopAt = Number(flag("--stop", "-1")),
  child = flag("--child", "");

const slug = (name: string) => name.replace(/[^a-z0-9]+/gi, "_");

if (child) {
  const [dir] = argv,
    [universe, ...rest] = child.split(":"),
    // (Trimmed: a seed read from a Windows shell can bring a carriage return, and that is another world.)
    seed = rest.join(":").trim(),
    u = universe === "alien" ? ALIEN : EARTH,
    base = join(dir!, `${universe}--${slug(seed)}`),
    file = `${base}.ndjson`,
    partSave = `${base}.part.save`,
    partMeta = `${base}.part.json`,
    t0 = performance.now(),
    fresh = u.build(seedFromText(seed)),
    ruleset = rulesetId(fresh, u.version);
  let world: World = fresh,
    from = 0,
    before = 0;
  // (A part run before, under these rules: its save loaded, and its file kept to the save's year.)
  if (existsSync(file) && existsSync(partSave) && existsSync(partMeta))
    try {
      const meta = JSON.parse(readFileSync(partMeta, "utf8")) as {
          year: number;
          s: number;
          ruleset: string;
        },
        lines = readFileSync(file, "utf8").split("\n").filter(Boolean),
        head = JSON.parse(lines[0]!) as { ruleset: string };
      if (meta.ruleset !== ruleset || head.ruleset !== ruleset)
        throw new Error("made under other rules");
      const doc = JSON.parse(gunzipSync(readFileSync(partSave)).toString("utf8"));
      // (loadWorld refuses a save of another ruleset.)
      world = loadWorld(doc, (s) => u.build(s), ruleset).world;
      if (world.now !== meta.year * YEAR) throw new Error("its save is not of its last year");
      const kept = lines.filter((l, i) => {
        if (i === 0) return true;
        const r = JSON.parse(l) as { y?: number; hashAt?: number; end?: number };
        return r.end === undefined && (r.hashAt ?? r.y ?? Infinity) <= meta.year;
      });
      writeFileSync(file, `${kept.join("\n")}\n`);
      from = meta.year + 10;
      before = meta.s;
      console.log(`${seed}: taken up at year ${meta.year} (${before} s before)`);
    } catch (e) {
      console.log(`${seed}: run again from its start (${(e as Error).message})`);
      world = fresh;
      from = 0;
    }
  if (from === 0) {
    rmSync(file, { force: true });
    appendFileSync(file, `${JSON.stringify({ universe, seed, ruleset, version: u.version })}\n`);
  }
  for (let y = from; y <= lastYear; y += 10) {
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
    const spent = (performance.now() - t0) / 1000;
    if (y < lastYear && ((chunk > 0 && spent >= chunk) || y === stopAt)) {
      // (The save first, then its year: a part stopped between them is run again from its start, never from a save of
      // another year than its file's.)
      const bytes = gzipSync(JSON.stringify(saveWorld(world, ruleset, { universe: u.name })));
      writeFileSync(`${partSave}.tmp`, bytes);
      renameSync(`${partSave}.tmp`, partSave);
      writeFileSync(partMeta, JSON.stringify({ year: y, s: Math.round(before + spent), ruleset }));
      console.log(`${seed}: a part ends at year ${y} after ${Math.round(spent)} s`);
      process.exit(3);
    }
  }
  appendFileSync(
    file,
    `${JSON.stringify({
      end: lastYear,
      s: Math.round(before + (performance.now() - t0) / 1000),
      lore: rawLore(world),
      firsts: worldFirstsNow(world).map((f) => [f.what, f.year]),
    })}\n`,
  );
  renameSync(file, `${base}.done.ndjson`);
  rmSync(partSave, { force: true });
  rmSync(partMeta, { force: true });
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
          ...(chunk > 0 ? ["--chunk", String(chunk)] : []),
          ...(stopAt >= 0 ? ["--stop", String(stopAt)] : []),
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
