// The tests' world cache (tests/worlds.ts): a world loaded from it is the world lived.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { YEAR, rulesetId, saveWorld, seedFromText, type World } from "../src/kernel/index.ts";
import { makePopulationWorld } from "../src/sim/index.ts";

// A cache of this file's own, so that every way (lived, loaded, lived on) is gone each run.
const dir = mkdtempSync(join(tmpdir(), "causalis-worlds-"));
process.env.CAUSALIS_WORLD_CACHE = dir;
process.env.CAUSALIS_WORLD_CACHE_GB = "6";
const { peopledWorld, tally, rulesHash } = await import("./worlds.ts");
process.on("exit", () => rmSync(dir, { recursive: true, force: true }));

const SEED = "first light",
  YEARS = 30;
const saves = () => readdirSync(dir).filter((f) => f.endsWith(".world"));

/** Not the hashes alone: every store as a save keeps it, the scheduler, the minter, the checkpoints. */
function same(world: World, lived: World): void {
  assert.equal(world.now, lived.now);
  assert.deepEqual(world.domainHashes(), lived.domainHashes());
  const a = saveWorld(world, rulesetId(world, "tests")),
    b = saveWorld(lived, rulesetId(lived, "tests"));
  assert.deepEqual(a.stores, b.stores);
  assert.deepEqual(a.scheduler, b.scheduler);
  assert.deepEqual(a.minter, b.minter);
  assert.deepEqual(a.checkpoints, b.checkpoints);
}

const lived = makePopulationWorld(seedFromText(SEED), { start: "spread" });
lived.runTo(YEARS * YEAR);

test("a world loaded from the cache is the world lived, and goes on as it would have", () => {
  const first = peopledWorld(SEED, YEARS, { start: "spread" });
  assert.deepEqual({ ...tally }, { loaded: 0, lived: 1, livedOn: 0 });
  assert.equal(saves().length, 1);
  const second = peopledWorld(SEED, YEARS, { start: "spread" });
  assert.deepEqual({ ...tally }, { loaded: 1, lived: 1, livedOn: 0 });
  assert.notEqual(first, second);
  same(first, lived);
  same(second, lived);
});

test("a world lived on from an earlier save is the world lived straight through", () => {
  lived.runTo((YEARS + 12) * YEAR);
  const on = peopledWorld(SEED, YEARS + 12, { start: "spread" });
  assert.deepEqual({ ...tally }, { loaded: 1, lived: 1, livedOn: 1 });
  same(on, lived);
  // Loaded whole the next time; and a year before the first save is lived from the first day.
  same(peopledWorld(SEED, YEARS + 12, { start: "spread" }), lived);
  assert.deepEqual({ ...tally }, { loaded: 2, lived: 1, livedOn: 1 });
  peopledWorld(SEED, YEARS - 20, { start: "spread" });
  assert.deepEqual({ ...tally }, { loaded: 2, lived: 2, livedOn: 1 });
});

test("other options, another moment or another seed are other worlds", () => {
  const before = saves().length,
    was = { ...tally };
  peopledWorld(SEED, 2);
  peopledWorld("juniper", 2);
  const at = peopledWorld(SEED, 2, {}, 2 * YEAR + 1);
  assert.equal(at.now, 2 * YEAR + 1);
  assert.deepEqual({ ...tally }, { ...was, lived: was.lived + 2, livedOn: was.livedOn + 1 });
  assert.equal(saves().length, before + 3);
  // (Each seed and each set of options has its own saves: no world is lived on from another's.)
  assert.equal(new Set(saves().map((f) => f.split("-").at(-2))).size, 3);
});

test("a save that will not load is thrown away and the world lived afresh", () => {
  const juniper = saves().find((f) => f.startsWith("peopled-juniper-"))!;
  writeFileSync(join(dir, juniper), "not a world");
  const was = tally.lived;
  const world = peopledWorld("juniper", 2);
  assert.equal(tally.lived, was + 1);
  const fresh = makePopulationWorld(seedFromText("juniper"));
  fresh.runTo(2 * YEAR);
  same(world, fresh);
  const loaded = tally.loaded;
  peopledWorld("juniper", 2);
  assert.equal(tally.loaded, loaded + 1);
});

test("a claim left by a process that died is not waited on", () => {
  // As a process leaves it that was killed while living juniper to its third year: a claim
  // signed with a number no process has.
  peopledWorld("juniper", 3);
  const save = saves().find(
    (f) => f.startsWith("peopled-juniper-") && f.endsWith(`-${3 * YEAR}.world`),
  )!;
  rmSync(join(dir, save));
  mkdirSync(join(dir, `${save}.living`));
  writeFileSync(join(dir, `${save}.living`, "pid"), "2147483646");
  const began = Date.now(),
    was = { ...tally };
  const world = peopledWorld("juniper", 3);
  assert.equal(world.now, 3 * YEAR);
  assert.equal(tally.livedOn, was.livedOn + 1, "lived on from its second year");
  assert.ok(Date.now() - began < 60_000);
  assert.deepEqual(
    readdirSync(dir).filter((f) => f.endsWith(".living")),
    [],
  );
});

test("the key is a hash of the code a world is made from", () => {
  assert.match(rulesHash(), /^[0-9a-f]{64}$/);
  assert.equal(rulesHash(), rulesHash());
  assert.notEqual(rulesHash(["kernel"]), rulesHash());
});
