// Town mode, people at scale (U5): the People sheet asked for a name, ordered by a column either way, a page of sixty at
// a time, grouped by household, street, trade or skill with a head's count each, and narrowed by a ready reading (idle,
// sick or hurt, unhappy, no home, under arms); the priorities grid paged and searched the same. All of it read as it is
// asked, off what the sheet already knows: the same however often it is asked, and nothing of the place moved by it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { HOUR, type World } from "../../src/kernel/index.ts";
import { populationContext, townsOf, type Settlement } from "../../src/sim/index.ts";
import { enterPlace } from "../../src/host/place.ts";
import {
  GRID_ROWS,
  peopleSheet,
  placeFrame,
  plainName,
  workSheet,
} from "../../src/host/placeplan.ts";
import { PEOPLE_ONLY, type PlacePeopleSheet } from "../../src/bridge/index.ts";
import { placeWorld } from "./worlds.ts";

const near = (w: World, people: number): Settlement => {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && townsOf(w).get(s.ref) && s.population > 0)
    .sort((a, b) => b.population - a.population || (a.ref < b.ref ? -1 : 1))
    .reduce((a, b) => (Math.abs(b.population - people) < Math.abs(a.population - people) ? b : a));
};

test("the People sheet at scale: a name sought, a column's order either way, pages, groups, ready narrowings", () => {
  const w = placeWorld(150),
    s = near(w, 900),
    place = enterPlace(w, s.ref)!;
  w.runTo(w.now + HOUR);
  placeFrame(w, s.ref, []);
  const n = place.people.n,
    sheet = (ask: Parameters<typeof peopleSheet>[5]): PlacePeopleSheet =>
      peopleSheet(w, place, null, 60, [], ask),
    first = sheet({});
  assert.ok(n > 60, `a town of more than a page (${n})`);
  assert.equal(first.all, n);
  assert.equal(first.from, 0);
  assert.equal(first.rows.length, 60);
  assert.deepEqual(first.ask, {
    q: "",
    sort: "eye",
    up: false,
    page: 0,
    group: null,
    only: null,
  });
  // A name sought: only those whose name holds it, of any case.
  const one = first.rows[3]!,
    q = one.name.split(" ")[0]!.slice(0, 4).toUpperCase(),
    found = sheet({ q });
  assert.ok(found.all >= 1 && found.all < n, `"${q}" narrows ${n} to ${found.all}`);
  assert.ok(found.rows.every((r) => plainName(r.name).includes(plainName(q))));
  assert.ok(
    sheet({ q: one.name }).rows.some((r) => r.id === one.id),
    "the one named is found",
  );
  assert.equal(sheet({ q: "zzzzqqq" }).all, 0, "no one by a name no one has");
  // By a column, either way: by name A to Z and back; by age the oldest first.
  const az = sheet({ sort: "name" }).rows.map((r) => plainName(r.name)),
    za = sheet({ sort: "name", up: false }).rows.map((r) => plainName(r.name));
  assert.deepEqual(
    az,
    [...az].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  assert.ok(za[0]! >= za.at(-1)!, "Z to A");
  assert.notDeepEqual(az, za);
  const ages = sheet({ sort: "age" }).rows.map((r) => r.age);
  assert.ok(
    ages.every((a, k) => k === 0 || a <= ages[k - 1]!),
    "the oldest first",
  );
  const moods = sheet({ sort: "mood" }).rows.map((r) => r.mood);
  assert.ok(
    moods.every((m, k) => k === 0 || m >= moods[k - 1]!),
    "the lowest mood first",
  );
  // Pages of sixty: the next one where the first ends, none twice; one past the last is the last.
  const second = sheet({ page: 1 });
  assert.equal(second.from, 60);
  assert.equal(second.rows.length, Math.min(60, n - 60));
  const seen = new Set(first.rows.map((r) => r.id));
  assert.ok(
    second.rows.every((r) => !seen.has(r.id)),
    "no one on two pages",
  );
  const last = sheet({ page: 9999 });
  assert.equal(last.ask.page, Math.ceil(n / 60) - 1);
  assert.ok(last.rows.length > 0);
  // Groups: each a run of rows under its key, its count that of all who are in it.
  for (const group of ["house", "street", "trade", "skill"] as const) {
    const g = sheet({ group });
    assert.ok(g.groups.length > 0, `${group}: groups`);
    assert.ok(g.rows.every((r) => r.group !== null));
    const keys = g.rows.map((r) => r.group!);
    assert.deepEqual(
      [...new Set(keys)],
      g.groups.map((x) => x.key),
      `${group}: each group's rows together, in its order`,
    );
    let all = 0;
    for (let page = 0; page * 60 < n; page++)
      for (const r of sheet({ group, page }).rows) if (r.group === g.groups[0]!.key) all++;
    assert.equal(all, g.groups[0]!.n, `${group}: "${g.groups[0]!.name}" counts all in it`);
    assert.ok(g.groups.every((x) => x.name.length > 3 && x.n > 0));
  }
  // The ready narrowings: each holds as many as its chip counts, and only those it says.
  PEOPLE_ONLY.forEach((only, k) => {
    const o = sheet({ only });
    assert.equal(o.all, first.only[k], `${only}: as many as its count`);
    for (const r of o.rows)
      if (only === "ill") assert.ok(r.health !== 0 || r.undraftable !== null);
      else if (only === "unhappy") assert.ok(r.mood < -15);
      else if (only === "arms") assert.ok(r.drafted || r.bound === "under arms");
  });
  // What an order to many reads of each: a child is too young, and the draft's words say so.
  for (const r of first.rows) if (r.young) assert.equal(r.undraftable, "a child");
  // Asked what it will be: what is not of its kinds is let be; the same however often it is asked.
  assert.deepEqual(sheet({ sort: "nonsense" as never, group: "x" as never }).ask, first.ask);
  assert.deepEqual(
    sheet({ q, sort: "name", group: "house" }),
    sheet({ q, sort: "name", group: "house" }),
  );
});

test("the priorities grid paged and searched by name", () => {
  const w = placeWorld(150),
    s = near(w, 900),
    place = enterPlace(w, s.ref)!;
  w.runTo(w.now + HOUR);
  const grid = workSheet(w, place).grid;
  assert.equal(grid.from, 0);
  assert.equal(grid.most, GRID_ROWS);
  assert.ok(grid.rows.length <= GRID_ROWS);
  if (grid.all > GRID_ROWS) {
    const next = workSheet(w, place, null, { page: 1 }).grid;
    assert.equal(next.from, GRID_ROWS);
    assert.ok(
      next.rows.every((r) => !grid.rows.some((x) => x.id === r.id)),
      "no one on both",
    );
  }
  const one = grid.rows[0]!,
    q = one.name.split(" ")[0]!.toLowerCase(),
    found = workSheet(w, place, null, { q }).grid;
  assert.equal(found.q, q);
  assert.ok(found.rows.some((r) => r.id === one.id));
  assert.ok(found.rows.every((r) => plainName(r.name).includes(plainName(q))));
  assert.ok(found.all <= grid.all);
});
