// The ways a town entered is run (town mode; asked 2026-11-25): watched, it is given no order and its world runs exactly
// as one never entered; what is worth the eye is read off its log, the seldomer the more; and the way chosen is kept
// with its place, in the save, and found again in another process. Stewarded, its head gives the orders a player would,
// each said with why, yields any the player overrules, and decides the same in every copy and process.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { DAY, HOUR, loadWorld, saveWorld, type World } from "../../src/kernel/index.ts";
import { managedOf, populationContext, type Settlement } from "../../src/sim/index.ts";
import {
  HAP,
  enterPlace,
  hapTold,
  placeDigest,
  placePrio,
  placesOf,
} from "../../src/host/place.ts";
import { placeMode, placeModeQueries, placeWatched } from "../../src/host/placewatch.ts";
import { stewardHead } from "../../src/host/steward.ts";
import { PLACE_AT } from "../../src/bridge/index.ts";
import { PLACE_UNIVERSE, placeWorld } from "./worlds.ts";
import { ranFor, watchOf } from "./place-modes-run.ts";

const YEARS = 150;
const base = (): World => placeWorld(YEARS);
const copy = (w: World): World => {
  const doc = JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: PLACE_UNIVERSE.name })));
  return loadWorld(doc, (s) => PLACE_UNIVERSE.build(s), "r").world;
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
  // (A watched town of four hundred tells little: forty days of it told a single hurt and its mending before the tiers,
  // and none with them, the day's draws falling otherwise. So long again, twice at the most, till it tells something.)
  for (let k = 0; k < 2 && seen.sights.length === 0; k++) {
    const more = ranFor(watched, ref, 40 * DAY, 3 * HOUR);
    seen.sights.push(...more.sights);
    seen.orders.push(...more.orders);
  }
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
  assert.ok(seen.sights.length > 0, "forty days of a town, or twice or thrice that, tell something worth the eye");
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

// —— Stewarded: run by its own head ———————————————————————————————————————————————————————————————————————————————

test("a town stewarded is run by its own head through the orders a player gives, each said in its log with why", () => {
  const w = copy(base()),
    twin = copy(base()),
    ref = near(w, 400).ref;
  const start = w.now;
  assert.equal(setMode(w, ref, "steward"), "steward");
  const place = placesOf(w)!.get(ref)!,
    head = stewardHead(w, place)!;
  assert.ok(head && head.name.length > 2, "it has a head");
  assert.ok(
    place.log.some((x) => x.what === HAP.steward && x.id === head.id),
    "who took it in hand",
  );
  const seen = ranFor(w, ref, 30 * DAY, 3 * HOUR, true);
  // (Every order the head gave is a player's command, ruled and taken: the town's orders say what it set.)
  const orders = managedOf(w)?.get(ref);
  for (const o of seen.orders) {
    assert.ok(/^place\.(prio|site|respond|shelter)$/.test(o.type), o.type);
    assert.ok(o.why.length > 3 && o.key.includes(o.type === "place.shelter" ? "shelter" : ":"));
  }
  if (seen.orders.length) assert.ok(orders, "a town given orders is managed");
  // (Each decision is a line of its log, by the head, with its reason in words.)
  const lines = place.log.filter((x) => x.what === HAP.steward);
  for (const x of lines) {
    const words = hapTold(place, x);
    assert.ok(/as (the town's|its) head/.test(words) && !/undefined|NaN/.test(words), words);
  }
  // (Numbered once each, in the order decided.)
  const ns = seen.orders.map((o) => o.n);
  assert.deepEqual(
    ns,
    [...ns].sort((a, b) => a - b),
  );
  assert.equal(new Set(ns).size, ns.length);
  // The same orders given an unwatched twin at the same moments: the same world.
  for (const g of seen.given) {
    twin.runTo(g.at);
    twin.runTo(twin.submit(g.type, g.args).t);
  }
  twin.runTo(w.now);
  assert.equal(JSON.stringify(w.domainHashes()), JSON.stringify(twin.domainHashes()));
  assert.ok(w.now > start);
});

test("an order of the player's overrules the head's, and the head leaves that matter alone after", () => {
  const w = copy(base()),
    ctx = populationContext(w);
  // (The twelve largest towns under fifteen hundred, the first whose head sets an idle hand to other work within twenty days:
  // the more crafters, the sooner some run out of what they work.)
  const ref = ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && s.population > 300 && s.population < 1500)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
    .slice(0, 12)
    .map((s) => s.ref);
  let town = "",
    prio: { person: number; kinds: number[] } | null = null;
  for (const r of ref) {
    setMode(w, r, "steward");
    for (let d = 0; d < 20 && !prio; d++) {
      const o = ranFor(w, r, DAY, 3 * HOUR, true).orders.find((x) => x.type === "place.prio");
      if (o) prio = o.args as { person: number; kinds: number[] };
    }
    if (prio) {
      town = r;
      break;
    }
    setMode(w, r, "hand");
  }
  assert.ok(prio, "a head set one of its town's idle hands to other work");
  const place = placesOf(w)!.get(town)!,
    mine = prio!.kinds.map((x, k) => (k === 0 ? 3 : x === 3 ? 1 : 0));
  w.runTo(w.submit("place.prio", { town, person: prio!.person, kinds: mine }).t);
  ranFor(w, town, 2 * DAY, 3 * HOUR, true);
  const s = place.steward!;
  assert.ok(s.let.includes(`prio:${prio!.person}`), "the head leaves it to the player");
  assert.ok(
    place.log.some((x) => x.what === HAP.steward && /to you from now on/.test(hapTold(place, x))),
    "and says so",
  );
  assert.deepEqual(placePrio(w, place, prio!.person), mine, "the player's order stands");
  // (And gives no order of it again.)
  const later = ranFor(w, town, 10 * DAY, 3 * HOUR, true);
  assert.ok(!later.orders.some((o) => o.key === `prio:${prio!.person}`));
  assert.deepEqual(placePrio(w, place, prio!.person), mine);
  // Chosen anew, everything is the head's again; taken from them, they forget it.
  setMode(w, town, "hand");
  assert.equal(place.steward, undefined);
  setMode(w, town, "steward");
  assert.deepEqual(place.steward!.let, []);
});

test("what a head decides is the same for the same town, saved and gone on with in another process", () => {
  const a = copy(base()),
    b = copy(base()),
    ref = near(a, 400).ref;
  setMode(a, ref, "steward");
  setMode(b, ref, "steward");
  const ra = ranFor(a, ref, 20 * DAY, 6 * HOUR, true),
    rb = ranFor(b, ref, 20 * DAY, 6 * HOUR, true);
  assert.deepEqual(ra.given, rb.given);
  assert.equal(placeDigest(placesOf(a)!.get(ref)!), placeDigest(placesOf(b)!.get(ref)!));
  const dir = mkdtempSync(join(tmpdir(), "place-steward-")),
    child = fileURLToPath(new URL("./place-modes-child.ts", import.meta.url)),
    run = (...args: string[]) =>
      execFileSync(process.execPath, [child, ...args], { encoding: "utf8" })
        .trim()
        .split("\n")
        .at(-1)!;
  try {
    const save = join(dir, "w.save"),
      whole = run("whole", String(YEARS), "steward"),
      first = run("first", String(YEARS), "steward", save),
      second = run("second", save);
    assert.match(whole, /^steward [0-9a-f]+ [0-9a-f]+ \d+$/);
    assert.notEqual(first, whole);
    assert.equal(second, whole);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
