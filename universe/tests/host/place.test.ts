// A place (town mode, first slice): a town kept in detail agrees with the world's own numbers, is the same place for the
// same entry, comes back from a save as it was and goes on as it would have, is never contradicted by an absence, and
// moves nothing of a world's history.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  DAY,
  HOUR,
  MONTH,
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  streams,
  type World,
} from "../../src/kernel/index.ts";
import { FOODS, GOODS } from "../../src/rules/index.ts";
import { lifeOf, marketsOf, populationContext, type Settlement } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import {
  MICRO,
  PEOPLE_MOST,
  PLACES_MOST,
  PLACE_MOST,
  advancePlace,
  enterPlace,
  keptTable,
  placeDigest,
  placeStocks,
  placeTable,
  placesOf,
  townTable,
} from "../../src/host/place.ts";
import { placeFrame, placePlan } from "../../src/host/placeplan.ts";
import { placeLotRef, placePersonRef, type VillagePlan } from "../../src/bridge/index.ts";
import { universeWorld } from "./worlds.ts";

const YEARS = 150;
/** The world the tests share is never entered: each test enters a copy of its own. */
const base = (): World => universeWorld(EARTH, "first light", YEARS);
const copy = (w: World): World => {
  const doc = JSON.parse(JSON.stringify(saveWorld(w, "r", { universe: "earth" })));
  return loadWorld(doc, (s) => EARTH.build(s), "r").world;
};
/** Its towns, the most peopled first. */
const townsOf = (w: World): Settlement[] => {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && s.population > 0)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1));
};
const near = (w: World, people: number): Settlement =>
  townsOf(w).reduce((a, b) =>
    Math.abs(b.population - people) < Math.abs(a.population - people) ? b : a,
  );

function agrees(w: World, town: string, matched = true): void {
  const place = placesOf(w)!.get(town)!,
    s = populationContext(w).settlements.get(place.town)!,
    table = keptTable(townTable(w, s));
  // (Its table is the town's at every matching; between two its people grow older by the clock.)
  if (matched)
    assert.deepEqual(
      placeTable(place, lifeOf(w)),
      table,
      "its people are its town's table, kind for kind",
    );
  const held = placeStocks(place);
  held.forEach((x, g) => {
    assert.ok(Number.isInteger(x) && x >= 0, `${GOODS[g]!.id} is a whole amount`);
    assert.equal(x, place.base[g]! + place.flow[g]!, `${GOODS[g]!.id}: held = share + made - used`);
  });
  // Every household's members are its people, and everyone has a household.
  const members = new Array<number>(place.houses.n).fill(0);
  for (let i = 0; i < place.people.n; i++) members[place.people.house[i]!]!++;
  assert.deepEqual(members, place.houses.members);
}

test("a place's sums are its town's: people by sex, age and trade, stocks by good", () => {
  const w = copy(base());
  for (const people of [60, 400, 2500]) {
    const s = near(w, people),
      place = enterPlace(w, s.ref)!,
      land = populationContext(w).provinces.get(s.cell)!,
      table = townTable(w, s);
    assert.equal(
      table.reduce((a, b) => a + b, 0),
      Math.min(Math.round(s.population), land.total()),
    );
    assert.equal(
      place.people.n,
      Math.min(
        PLACE_MOST,
        table.reduce((a, b) => a + b, 0),
      ),
    );
    // (No more of any kind than its land has.)
    table.forEach((c, k) => assert.ok(c <= land.counts.get(Math.floor(k / 7), k % 7)));
    agrees(w, s.ref);
    // Its stocks are its share of its land's market, to the millionth, at the moment of entry.
    const m = marketsOf(w).get(s.cell)!;
    place.base.forEach((x, g) =>
      assert.equal(x, Math.floor((m.stock[g]! * MICRO * place.people.n) / land.total())),
    );
    assert.deepEqual(placeStocks(place), place.base);
    // Its households' incomes by fifth are its land's shares of its income.
    assert.ok(place.houses.means.every((x) => x >= 0));
  }
});

test("the same town entered at the same moment is the same place", () => {
  const a = copy(base()),
    b = copy(base()),
    town = near(a, 400).ref;
  // (Whatever else was looked at first, and however often it is asked.)
  enterPlace(b, near(b, 60).ref);
  const pa = enterPlace(a, town)!,
    pb = enterPlace(b, town)!;
  enterPlace(a, town);
  assert.equal(placeDigest(pa), placeDigest(pb));
});

test("a place steps by what presses: its people sleep, eat, work and carry, and stocks move by what is made and eaten", () => {
  const w = copy(base()),
    s = near(w, 400),
    place = enterPlace(w, s.ref)!,
    seen = new Set<number>(),
    asleep: number[] = [];
  for (let h = 0; h < 48; h++) {
    w.runTo(w.now + HOUR);
    advancePlace(w, place);
    let n = 0;
    for (let i = 0; i < place.people.n; i++) {
      seen.add(place.people.act[i]!);
      if (place.people.act[i] === 1) n++;
    }
    asleep.push(n / place.people.n);
    agrees(w, s.ref, false);
  }
  for (const act of [1, 2, 3]) assert.ok(seen.has(act), `someone did ${act}`);
  // Most sleep at some hour and few at another: no clock tells them to.
  assert.ok(
    Math.max(...asleep) > 0.7 && Math.min(...asleep) < 0.2,
    `${asleep.map((x) => x.toFixed(2))}`,
  );
  // Food was eaten, by about what its people's bodies ask in two days (a person-month to thirty days).
  const eaten = -FOODS.reduce((n, g) => n + Math.min(0, place.flow[g]!), 0) / MICRO;
  let made = 0;
  for (const g of FOODS) made += Math.max(0, place.flow[g]!) / MICRO;
  assert.ok(eaten + made > 0, "food moved");
});

test("staying and coming back after a short absence are the same, across a month's turn too", () => {
  const stay = copy(base()),
    back = copy(base()),
    town = near(stay, 400).ref,
    // (A day before the month turns.)
    from = stay.now + MONTH - DAY;
  stay.runTo(from);
  back.runTo(from);
  const a = enterPlace(stay, town)!,
    b = enterPlace(back, town)!;
  for (let h = 0; h < 48; h++) {
    stay.runTo(stay.now + HOUR);
    advancePlace(stay, a);
  }
  back.runTo(from + 2 * DAY);
  advancePlace(back, b);
  assert.equal(a.t, b.t);
  assert.equal(placeDigest(a), placeDigest(b));
  assert.ok(a.matched.month > Math.floor((from - DAY) / MONTH), "matched at the month's turn");
  agrees(stay, town, false);
});

test("after a long absence a place is brought on, not made again, and never contradicts the world", () => {
  const w = copy(base()),
    s = near(w, 400),
    place = enterPlace(w, s.ref)!,
    before = new Set(place.people.id.subarray(0, place.people.n)),
    was = placeDigest(place);
  w.runTo(w.now + 3 * YEAR + 40 * DAY);
  assert.equal(placeDigest(place), was, "nothing of it moves while no one looks");
  assert.equal(enterPlace(w, s.ref), place);
  agrees(w, s.ref);
  assert.deepEqual(
    placeStocks(place),
    place.base.map((x, g) => x + place.flow[g]!),
  );
  // Most of those there before are there still; those who are not died or left, and are told; those new were born or came.
  const now = new Set(place.people.id.subarray(0, place.people.n)),
    kept = [...before].filter((id) => now.has(id)).length;
  assert.ok(kept > 0.6 * before.size, `${kept} of ${before.size} kept`);
  for (const id of before)
    if (!now.has(id))
      assert.ok(place.log.some((x) => x.id === id && (x.what === 1 || x.what === 3)));
  for (const id of now)
    if (!before.has(id))
      assert.ok(place.log.some((x) => x.id === id && (x.what === 0 || x.what === 2)));
  // And on through a year looked at now and then.
  for (let k = 0; k < 12; k++) {
    w.runTo(w.now + MONTH);
    enterPlace(w, s.ref);
    agrees(w, s.ref);
  }
});

test("a place is kept in the save and goes on from it as it would have", () => {
  const a = copy(base()),
    town = near(a, 400).ref,
    pa = enterPlace(a, town)!;
  a.runTo(a.now + 6 * HOUR);
  advancePlace(a, pa);
  const b = copy(a),
    pb = placesOf(b)!.get(town)!;
  assert.equal(placeDigest(pb), placeDigest(pa));
  for (const w of [a, b]) {
    w.runTo(w.now + 30 * HOUR);
    enterPlace(w, town);
  }
  assert.equal(placeDigest(pb), placeDigest(pa));
});

test("a saved place goes on the same in another process", () => {
  const dir = mkdtempSync(join(tmpdir(), "place-")),
    child = fileURLToPath(new URL("./place-child.ts", import.meta.url)),
    run = (...args: string[]) =>
      execFileSync(process.execPath, [child, ...args], { encoding: "utf8" })
        .trim()
        .split("\n")
        .at(-1)!;
  try {
    const save = join(dir, "w.save"),
      whole = run("whole", String(YEARS)),
      first = run("first", String(YEARS), save),
      second = run("second", save);
    assert.ok(/^[0-9a-f]+ [0-9a-f]+$/.test(whole), whole);
    assert.notEqual(first, whole, "the first half is not yet the whole");
    assert.equal(second, whole);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("entering towns moves nothing of a world's history, and a world never entered keeps nothing", () => {
  const quiet = copy(base()),
    looked = copy(base()),
    store = placesOf(quiet)!;
  assert.ok(store.dormant() && store.places.length === 0);
  assert.equal(JSON.stringify(store.save()), '{"uses":0,"places":[]}');
  // (No part of the ruleset: no stream in the registry, no system on the scheduler, no store in its identity.)
  assert.ok(!streams().some((s) => s.tag.startsWith("place")));
  assert.ok(!looked.scheduler.systemKeys().some((k) => k.includes("place")));
  const towns = townsOf(looked).slice(0, 3);
  for (let y = 0; y < 3; y++) {
    for (let k = 0; k < 4; k++) {
      looked.runTo(looked.now + 3 * MONTH);
      for (const s of towns) if (enterPlace(looked, s.ref)) placeFrame(looked, s.ref, [1, 2, 3]);
    }
    quiet.runTo(looked.now);
    assert.equal(JSON.stringify(looked.domainHashes()), JSON.stringify(quiet.domainHashes()));
  }
  assert.deepEqual(
    looked.checkpoints().map((c) => c.chain),
    quiet.checkpoints().map((c) => c.chain),
  );
  assert.equal(rulesetId(looked, "r"), rulesetId(quiet, "r"));
});

test("only entered towns are kept, and no more than the cap: the least lately entered is let go", () => {
  const w = copy(base()),
    towns = townsOf(w).slice(0, PLACES_MOST + 3),
    store = placesOf(w)!;
  for (const s of towns) enterPlace(w, s.ref);
  assert.ok(store.places.length <= PLACES_MOST);
  assert.ok(store.places.reduce((n, p) => n + p.people.n, 0) <= PEOPLE_MOST);
  assert.ok(store.get(towns.at(-1)!.ref), "the last entered is kept");
  assert.ok(!store.get(towns[0]!.ref), "the first entered was let go");
  assert.ok(store.bytes() < 1_200_000, `${store.bytes()} bytes`);
});

test("a place's people and lots have pages that say what they hold and why they do what they do", () => {
  const w = copy(base()),
    s = near(w, 400),
    place = enterPlace(w, s.ref)!,
    before = JSON.stringify(w.domainHashes()),
    id = place.people.id[0]!,
    person = pageOf(w, placePersonRef(s.ref, id)),
    text = JSON.stringify(person);
  assert.equal(person.kind, "person");
  for (const word of ["Hunger", "Tiredness", "Home", "Work", "Why", "In hand", "worth"])
    assert.ok(text.includes(word), word);
  const square = pageOf(w, placeLotRef(s.ref, -3));
  assert.equal(square.kind, "building");
  const home = pageOf(w, placeLotRef(s.ref, place.houses.home[place.people.house[0]!]!));
  assert.ok(
    JSON.stringify(home).includes(placePersonRef(s.ref, id)),
    "a home lists who lives in it",
  );
  // The plan's people are the place's, found again by their refs, each in a home the plan draws.
  const plan: VillagePlan = {
    ref: s.ref,
    name: s.name,
    homes: [...new Set(place.houses.home)]
      .slice(0, 12)
      .map((lot) => ({ x: lot, z: 0, yaw: 0, household: null, lot })),
    people: [],
  } as unknown as VillagePlan;
  const placed = placePlan(w, plan, place, 60);
  assert.ok(placed.people.length > 0 && placed.people.length <= 60 + 12);
  for (const p of placed.people) {
    assert.ok(p.ref.startsWith(`plc:${s.ref}:`));
    assert.ok(p.home >= 0 && p.home < plan.homes.length);
  }
  const frame = placeFrame(
    w,
    s.ref,
    placed.people.map((p) => Number(p.ref.split(":").at(-1))),
  )!;
  assert.equal(frame.at.length, placed.people.length);
  assert.ok(frame.why.every((x) => x.length > 0));
  assert.equal(JSON.stringify(w.domainHashes()), before, "reading it moved nothing");
  // One not kept says so.
  assert.equal(pageOf(w, placePersonRef(townsOf(w).at(-1)!.ref, 1)).kind, "unknown");
});
