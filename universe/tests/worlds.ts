// A world at a year, for tests that only need one to stand on: kept on disk between test
// processes and runs, so the same centuries are not lived again in every file.
//
//   const world = peopledWorld("first light", 240, { start: "spread" });
//
// is makePopulationWorld(seedFromText("first light"), { start: "spread" }) run to 240 * YEAR,
// either lived now (and saved) or loaded from the save an earlier process made; a world not
// saved at that year is lived on from the latest earlier year it is saved at. A save is kept
// under the seed, the options, the moment and a hash of every file under src/kernel, src/rules,
// src/gen and src/sim (all a peopled world is made from: tools/lint-rules.ts), so any change to
// the rules or the engine leaves the old saves unread. Loading goes through the game's own
// loadWorld, which refuses a world whose domain hashes are not the saved ones; a save that will
// not load is thrown away and the world lived afresh. tests/worlds.test.ts holds the loaded
// world to the lived one.
//
// Not for tests whose point is the run itself (determinism, the oracle, save equivalence, what
// happens along the way): those live their years.
//
// The saves are in universe/.world-cache (ignored by git), at most CAUSALIS_WORLD_CACHE_GB
// (default 6) gigabytes, the longest unread going first. CAUSALIS_WORLD_CACHE=0 turns the cache
// off (every world is lived); any other value is the folder to keep it in.
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { deserialize, serialize } from "node:v8";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type SaveDocument,
  type World,
} from "../src/kernel/index.ts";
import { makePopulationWorld, type PopulationWorldOptions } from "../src/sim/index.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const setting = process.env.CAUSALIS_WORLD_CACHE;
const OFF = setting === "0" || setting === "off";
const DIR = setting && !OFF ? setting : join(root, ".world-cache");
const MOST = Number(process.env.CAUSALIS_WORLD_CACHE_GB ?? 6) * 1024 ** 3;
/** How long a process waits on another that is living the world it wants, before living it too. */
const WAIT_MOST = 20 * 60_000;
/** The folders of src a peopled world is made from. */
export const PEOPLED_FROM = ["kernel", "rules", "gen", "sim"];

const trees = new Map<string, string>();
/** A hash of all the code a world is made from: its files' paths and contents. */
export function rulesHash(folders: readonly string[] = PEOPLED_FROM): string {
  const known = trees.get(folders.join());
  if (known) return known;
  const h = createHash("sha256");
  const walk = (dir: string, name: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      const path = join(dir, entry.name),
        at = `${name}/${entry.name}`;
      if (entry.isDirectory()) walk(path, at);
      else if (entry.name.endsWith(".ts")) {
        // (Line endings apart: a checkout that turns them is the same code.)
        h.update(at).update("\0");
        h.update(readFileSync(path, "utf8").replaceAll("\r\n", "\n")).update("\0");
      }
    }
  };
  for (const folder of folders) walk(join(root, "src", folder), folder);
  const tree = h.digest("hex");
  trees.set(folders.join(), tree);
  return tree;
}

function evict(): void {
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith(".world"))
    .map((f) => {
      try {
        const s = statSync(join(DIR, f));
        return { f, size: s.size, read: s.mtimeMs };
      } catch {
        return undefined;
      }
    })
    .filter((x) => x !== undefined)
    .sort((a, b) => b.read - a.read);
  let sum = 0;
  for (const file of files) {
    sum += file.size;
    // (Another process may be taking the same one away: either way it goes.)
    if (sum > MOST) rmSync(join(DIR, file.f), { force: true });
  }
  // What a process that died mid-write left behind.
  for (const f of readdirSync(DIR))
    if (f.endsWith(".tmp")) {
      try {
        if (Date.now() - statSync(join(DIR, f)).mtimeMs > 3_600_000)
          rmSync(join(DIR, f), { force: true });
      } catch {
        // Gone already.
      }
    }
}

/**
 * The peopled world of a seed, run to the turn of a year (or, with `t`, to that moment):
 * loaded from the cache when a save made under these very rules is there, lived and saved
 * when not. Each call gives a world of its own.
 */
export function peopledWorld(
  seedText: string,
  years: number,
  options: PopulationWorldOptions = {},
  t: number = years * YEAR,
): World {
  return keptWorld(
    ["peopled", seedText, options],
    PEOPLED_FROM,
    () => makePopulationWorld(seedFromText(seedText), options),
    t,
  );
}

/** How many worlds this process loaded whole, lived from their first day, and lived on from an earlier save. */
export const tally = { loaded: 0, lived: 0, livedOn: 0 };

const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * A world built by `build` and run to `t`, loaded or lived. `what` names the world among all
 * that are kept (its builder, seed and options; the first two words begin the save's name), and
 * `folders` are the folders of src its builder and its rules are written in.
 *
 * A world not kept is lived on from the latest earlier save of the same world there is (a world
 * saved, loaded and run on is the world run straight through: the game's own promise, held here
 * by tests/worlds.test.ts), and from its first day when there is none.
 */
export function keptWorld(
  what: readonly [kind: string, seedText: string, ...rest: unknown[]],
  folders: readonly string[],
  build: () => World,
  t: number,
): World {
  if (OFF) {
    tally.lived++;
    const world = build();
    world.runTo(t);
    return world;
  }
  // Every save of this world, at whatever moment, begins alike.
  const family = createHash("sha256")
    .update(JSON.stringify([2, what, rulesHash(folders), process.version]))
    .digest("hex")
    .slice(0, 24);
  const stem = `${`${what[0]} ${what[1]}`.replace(/[^a-z0-9]+/gi, "-")}-${family}-`,
    pathAt = (at: number) => join(DIR, `${stem}${at}.world`),
    path = pathAt(t),
    living = `${path}.living`;
  const load = (at: number): World | undefined => {
    const from = pathAt(at);
    if (!existsSync(from)) return undefined;
    try {
      const doc = deserialize(gunzipSync(readFileSync(from))) as SaveDocument;
      const fresh = build();
      const { world } = loadWorld(doc, () => fresh, rulesetId(fresh, "tests"));
      if (world.now !== at) throw new Error(`the save is at ${world.now}, not ${at}`);
      try {
        const now = new Date();
        utimesSync(from, now, now);
      } catch {
        // Read-only, or gone to another process's eviction: the world is loaded all the same.
      }
      return world;
    } catch {
      // A save that will not load (cut short, or of a world these rules no longer make) goes.
      rmSync(from, { force: true });
      return undefined;
    }
  };
  const whole = () => {
    const world = load(t);
    if (world) tally.loaded++;
    return world;
  };
  /** The moments before `t` this world is saved at (or, with `suffix`, being lived to), latest first. */
  const earlier = (suffix: string): number[] => {
    let names: string[];
    try {
      names = readdirSync(DIR);
    } catch {
      return [];
    }
    return names
      .filter((f) => f.startsWith(stem) && f.endsWith(suffix))
      .map((f) => Number(f.slice(stem.length, -suffix.length)))
      .filter((at) => Number.isFinite(at) && at < t)
      .sort((x, y) => y - x);
  };
  /**
   * How long ago a process began living the world to `at`; undefined when none is. (One that was
   * killed before it could say it had stopped is found out by its number, and its claim removed.)
   */
  const livingFor = (at: number): number | undefined => {
    const claim = `${pathAt(at)}.living`;
    let age: number;
    try {
      age = Date.now() - statSync(claim).mtimeMs;
    } catch {
      return undefined;
    }
    let holder: number | undefined;
    try {
      holder = Number(readFileSync(join(claim, "pid"), "utf8"));
    } catch {
      // Claimed this instant and not yet signed (or signed by no one: then it ages out).
      return age;
    }
    try {
      process.kill(holder, 0);
      return age;
    } catch (error) {
      // (No such process. One that is there and not ours to signal still lives.)
      if ((error as { code?: string }).code !== "ESRCH") return age;
      rmSync(claim, { recursive: true, force: true });
      return undefined;
    }
  };
  const kept = whole();
  if (kept) return kept;
  // One process lives a world; the others that want it meanwhile wait for its save, so that a
  // suite run wide on an empty cache lives each world once, not once a file.
  let mine = false;
  try {
    mkdirSync(DIR, { recursive: true });
    for (;;) {
      try {
        mkdirSync(living);
        mine = true;
        writeFileSync(join(living, "pid"), String(process.pid));
        break;
      } catch {
        // Another has it. (If it died without giving it back, or is taking too long: live it here.)
        const age = livingFor(t);
        if (age === undefined) continue;
        if (age > WAIT_MOST) break;
        pause(250);
        const theirs = whole();
        if (theirs) return theirs;
      }
    }
  } catch {
    // No folder to keep worlds in: lived, and not kept.
  }
  const giveBack = () => {
    if (mine) rmSync(living, { recursive: true, force: true });
    mine = false;
  };
  process.once("exit", giveBack);
  try {
    // (Saved while this process waited for the chance to live it?)
    const late = mine ? whole() : undefined;
    if (late) return late;
    // The latest earlier moment of this world, saved or being lived now by another process (which
    // is waited for: only ever for an earlier moment, so no two wait on each other).
    let world: World | undefined;
    for (let tries = 0; tries < 8 && !world; tries++) {
      const saved = earlier(".world")[0] ?? -1,
        coming = earlier(".world.living").find(
          (at) => at > saved && (livingFor(at) ?? Infinity) < WAIT_MOST,
        );
      if (coming !== undefined) {
        while (!existsSync(pathAt(coming)) && (livingFor(coming) ?? Infinity) < WAIT_MOST)
          pause(250);
        if (existsSync(pathAt(coming))) world = load(coming);
        continue;
      }
      if (saved < 0) break;
      world = load(saved);
    }
    if (world) tally.livedOn++;
    else {
      tally.lived++;
      world = build();
    }
    world.runTo(t);
    try {
      const bytes = gzipSync(serialize(saveWorld(world, rulesetId(world, "tests"))), { level: 1 });
      // (Written beside and renamed into place: another process reads a whole save or none.)
      const tmp = `${path}.${process.pid}.tmp`;
      writeFileSync(tmp, bytes);
      try {
        renameSync(tmp, path);
      } catch {
        // Another process wrote the same world first and has it open: its copy stands.
        rmSync(tmp, { force: true });
      }
      evict();
    } catch {
      // A full disk or a world too large to keep: the test has its world, lived.
    }
    return world;
  } finally {
    giveBack();
    process.removeListener("exit", giveBack);
  }
}
