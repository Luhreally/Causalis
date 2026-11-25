// The ways a town entered is run (town mode; asked 2026-11-25): watched, it is given no order and its world runs exactly
// as one never entered; what is worth the eye is read off its log, the seldomer the more; and the way chosen is kept
// with its place, in the save, and found again in another process.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { DAY, HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { managedOf, populationContext, type Settlement } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import { enterPlace, placeDigest, placesOf } from "../../src/host/place.ts";
import { placeMode, placeModeQueries, placeWatched } from "../../src/host/placewatch.ts";
import { PLACE_AT } from "../../src/bridge/index.ts";
import { universeWorld } from "./worlds.ts";
import { ranFor, watchOf } from "./place-modes-run.ts";

const YEARS = 150;
const base = (): World => universeWorld(EARTH, "first light", YEARS);
const copy = (w: World): World => {
  const doc = JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: "earth" })));
  return loadWorld(doc, (s) => EARTH.build(s), "r").world;
};
const near = (w: World, people: number): Settlement => {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && s.population > 0)
    .sort(
      (a, b) =>
        Math.abs(a.population - people) - Math.abs(b.population - people) ||
        (a.ref < b.ref ? -1 : 1),
    )[0]!;
};
const ask = placeModeQueries();
const setMode = (w: World, ref: string, mode: string) => ask["place.mode"]!(w, { ref, mode });

test("a town watched is given no order, and its world runs exactly as a twin's never entered", () => {
  const watched = copy(base()),
    twin = copy(base()),
    ref = near(watched, 400).ref;
  assert.equal(setMode(watched, ref, "watch"), "watch");
  const seen = ranFor(watched, ref, 40 * DAY, 3 * HOUR);
  twin.runTo(watched.now);
  assert.equal(seen.orders.length, 0, "no order is given a town watched");
  assert.ok(!managedOf(watched)?.get(ref), "and it is kept among no managed towns");
  assert.equal(JSON.stringify(watched.domainHashes()), JSON.stringify(twin.domainHashes()));
  assert.deepEqual(
    watched.checkpoints().map((c) => c.chain),
    twin.checkpoints().map((c) => c.chain),
  );
  assert.equal(placesOf(twin)!.places.length, 0, "the twin was never entered");
  // What it told over those days: things of its log, each said, placed, and worth the eye by how seldom its kind comes.
  assert.ok(seen.sights.length > 0, "forty days of a town tell something worth the eye");
  const place = placesOf(watched)!.get(ref)!;
  for (const x of seen.sights) {
    assert.ok(x.words.length > 3 && !/undefined|NaN/.test(x.words + x.where), x.words);
    assert.ok(x.rare >= 0 && x.rare <= 1, `${x.words}: ${x.rare}`);
    assert.ok(
      x.lot === PLACE_AT.square ||
        x.lot === PLACE_AT.fields ||
        x.lot === PLACE_AT.walls ||
        x.lot >= 0,
      `${x.words} at ${x.lot}`,
    );
    assert.ok(x.t <= place.t);
  }
  // (No line of what orders did: a town watched has none.)
  assert.ok(!seen.sights.some((x) => /order/.test(x.words)));
});

test("nothing is told twice, the seldomer kind is worth more, and those asked after are told in a line", () => {
  const w = copy(base()),
    ref = near(w, 400).ref;
  setMode(w, ref, "watch");
  const place = placesOf(w)!.get(ref)!,
    seen = ranFor(w, ref, 30 * DAY, 6 * HOUR).sights.filter((x) => x.until === undefined),
    keys = seen.map((x) => `${x.t}|${x.words}`);
  assert.equal(new Set(keys).size, keys.length, "each happening is told once");
  // (Asked again from now: nothing of the log is new.)
  assert.equal(watchOf(w, ref, place.t).sights.filter((x) => x.until === undefined).length, 0);
  // (And asked from no moment, as on entering: nothing of the log, only what goes on now.)
  assert.ok(watchOf(w, ref).sights.every((x) => x.until !== undefined));
  // Of its log's kinds, the one with fewer lines is the rarer.
  const kinds = new Map<number, number>();
  for (const x of place.log) kinds.set(x.what, (kinds.get(x.what) ?? 0) + 1);
  const all = watchOf(w, ref, place.t - 30 * DAY).sights;
  for (const a of all)
    for (const b of all) {
      const ka = place.log.find((x) => x.t === a.t && a.id === x.id)?.what,
        kb = place.log.find((x) => x.t === b.t && b.id === x.id)?.what;
      if (ka === undefined || kb === undefined || ka === kb) continue;
      if (kinds.get(ka)! < kinds.get(kb)!) assert.ok(a.rare > b.rare, `${a.words} / ${b.words}`);
    }
  // Those asked after: by name, with their trade, what they are at and where.
  const ids = [...place.people.id.subarray(0, 5)],
    rows = placeWatched(w, place, [...ids, 4_000_000_000]);
  assert.equal(rows.length, 5, "one gone, or never of it, is left out");
  for (const r of rows) {
    assert.ok(r.name.length > 2 && r.ref.length > 4 && / · /.test(r.words), r.words);
    assert.ok(!/undefined|NaN/.test(r.words), r.words);
  }
});

test("a fire fought is told while it burns, with where and until when", () => {
  const w = copy(base()),
    ref = near(w, 400).ref;
  setMode(w, ref, "watch");
  enterPlace(w, ref);
  try {
    w.runTo(w.submit("act.fire", { village: ref }).t);
  } catch {
    // (Nothing of it stands to burn, or nothing burns in its air: no fire, and nothing to tell of one.)
    return;
  }
  const place = placesOf(w)!.get(ref)!;
  let fire = null;
  for (let h = 0; h < 48 && !fire; h++) {
    w.runTo(w.now + HOUR);
    fire = watchOf(w, ref, place.t).sights.find((x) => /^Fire at /.test(x.words)) ?? null;
  }
  if (!place.fire.length) return;
  assert.ok(fire, "a fire being fought is a sight");
  assert.ok(fire.until !== undefined && fire.until > place.t - HOUR);
  assert.equal(fire.rare, 1);
  assert.match(fire.words, /fights? it$/);
});

test("the way a town is run is kept with its place and in the save, out of its world's hash", () => {
  const a = copy(base()),
    quiet = copy(base()),
    ref = near(a, 400).ref;
  enterPlace(a, ref);
  assert.equal(placeMode(placesOf(a)!.get(ref)!), "hand");
  const by = placeDigest(placesOf(a)!.get(ref)!);
  setMode(a, ref, "watch");
  assert.notEqual(placeDigest(placesOf(a)!.get(ref)!), by, "its place tells the two apart");
  assert.equal(setMode(a, ref, "no such way"), "watch", "a way it does not know changes nothing");
  assert.equal(JSON.stringify(a.domainHashes()), JSON.stringify(quiet.domainHashes()));
  const b = copy(a);
  assert.equal(placeMode(placesOf(b)!.get(ref)!), "watch");
  assert.equal(placeDigest(placesOf(b)!.get(ref)!), placeDigest(placesOf(a)!.get(ref)!));
  setMode(b, ref, "hand");
  assert.equal(placeDigest(placesOf(b)!.get(ref)!), by);
  // (By hand is the way of a place that says nothing: a save from before the choice reads as it did.)
  assert.ok(!JSON.stringify(placesOf(b)!.save()).includes('"mode"'));
});

test("a town watched, saved, goes on the same in another process", () => {
  const dir = mkdtempSync(join(tmpdir(), "place-modes-")),
    child = fileURLToPath(new URL("./place-modes-child.ts", import.meta.url)),
    run = (...args: string[]) =>
      execFileSync(process.execPath, [child, ...args], { encoding: "utf8" })
        .trim()
        .split("\n")
        .at(-1)!;
  try {
    const save = join(dir, "w.save"),
      whole = run("whole", String(YEARS), "watch"),
      first = run("first", String(YEARS), "watch", save),
      second = run("second", save);
    assert.match(whole, /^watch [0-9a-f]+ [0-9a-f]+ \d+$/);
    assert.notEqual(first, whole, "the first day is not yet the whole");
    assert.equal(second, whole);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
