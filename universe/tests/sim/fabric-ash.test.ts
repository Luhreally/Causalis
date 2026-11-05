// War past the line, W2: homes burned from the air. Their lots lie in ash, neither homes nor open, for a few years, and
// then rise again while their people want them. Nothing kept but the runs themselves, so a save read back tells the same.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { PopulationContext } from "../../src/sim/index.ts";
import {
  ASH_YEARS,
  CHANGE,
  TownBuilder,
  TownStore,
  housingOf,
  readStanding,
  type Fabric,
} from "../../src/sim/town/fabric.ts";

/** A town of `lots` homes at the first level, a store and a builder for the year. */
function town(
  lots: number,
  year = 100,
): { f: Fabric; store: TownStore; at: (y: number) => TownBuilder } {
  const store = new TownStore(),
    f = {
      town: "town:0:7",
      family: "grid",
      phase: 0,
      next: lots,
      homes: [0, lots, 0, 0, 0, 0, 0],
      open: [],
      aim: 0,
      raise: 0,
      passed: -1,
      changes: [[CHANGE.built, 0, lots, 10, 10, 1, 0]],
      civics: [],
      walls: null,
      lean: 0,
      forsaken: null,
    } as unknown as Fabric;
  const at = (y: number) => new TownBuilder({} as PopulationContext, y, store);
  void year;
  return { f, store, at };
}

/** What a save read back would tell of it. */
function readAgain(f: Fabric): { homes: number[]; open: [number, number][] } {
  const g = { ...f, homes: f.homes.map(() => 0), open: [] as [number, number][] };
  readStanding(g);
  return { homes: g.homes, open: g.open };
}

const ashes = (f: Fabric) =>
  f.changes.filter((c) => c[0] === CHANGE.burned).reduce((n, c) => n + c[2] - c[1], 0);

test("a raid burns as many homes as it says, in sticks, none of them open while they lie in ash", () => {
  const { f, store, at } = town(4000),
    burned = at(100).burn(f, 0.1, 500);
  assert.equal(burned, 400);
  assert.equal(f.homes[1], 3600);
  assert.equal(ashes(f), 400);
  assert.deepEqual(f.open, []);
  assert.ok(store.ashen.has(f));
  // In sticks of lots, not one stretch.
  assert.ok(f.changes.filter((c) => c[0] === CHANGE.burned).length > 1);
});

test("a save read back tells the same homes and the same open lots, burned or not", () => {
  const { f, at } = town(4000);
  at(100).burn(f, 0.1, 500);
  at(100).burn(f, 0.05, 500);
  const read = readAgain(f);
  assert.deepEqual(read.homes, f.homes);
  assert.deepEqual(read.open, f.open);
  // A fire's or a sack's razed lots, beside them, are open as ever.
  at(100).raze(f, 0.05, true);
  const after = readAgain(f);
  assert.deepEqual(after.homes, f.homes);
  assert.deepEqual(after.open, f.open);
  assert.ok(f.open.length > 0);
});

test("loads that miss by less land nearer the heart", () => {
  const near = town(20000),
    far = town(20000);
  near.at(100).burn(near.f, 0.02, 22);
  far.at(100).burn(far.f, 0.02, 2244);
  const mean = (f: Fabric) => {
    const runs = f.changes.filter((c) => c[0] === CHANGE.burned);
    return runs.reduce((n, c) => n + (c[1] + c[2]) / 2, 0) / runs.length;
  };
  assert.ok(mean(near.f) < mean(far.f), `${mean(near.f)} is not nearer than ${mean(far.f)}`);
});

test("the same raid on the same town burns the same lots: no draw", () => {
  const a = town(4000),
    b = town(4000);
  a.at(100).burn(a.f, 0.1, 500);
  b.at(100).burn(b.f, 0.1, 500);
  assert.deepEqual(a.f.changes, b.f.changes);
});

test("while its people want them its lots rise again when their years are up, and not before", () => {
  const { f, store, at } = town(4000);
  at(100).burn(f, 0.1, 500);
  // (Three thousand people to a home's worth of room is more than it has, so all are wanted.)
  const people = housingOf(f) * 2;
  at(100 + ASH_YEARS - 1).rise(f, people, 1, 1, 3);
  assert.equal(ashes(f), 400, "they rose early");
  at(100 + ASH_YEARS).rise(f, people, 1, 1, 3);
  assert.equal(ashes(f), 0);
  assert.equal(f.homes[1], 4000);
  assert.deepEqual(f.open, []);
  assert.ok(!store.ashen.has(f));
  const read = readAgain(f);
  assert.deepEqual(read.homes, f.homes);
  assert.deepEqual(read.open, f.open);
});

test("where its people are gone its burned lots go back to open ground", () => {
  const { f, store, at } = town(4000);
  at(100).burn(f, 0.1, 500);
  at(100 + ASH_YEARS).rise(f, 0, 1, 1, 3);
  assert.equal(ashes(f), 0);
  assert.equal(f.homes[1], 3600);
  assert.equal(
    f.open.reduce((n, r) => n + r[1] - r[0], 0),
    400,
  );
  assert.ok(!store.ashen.has(f));
  const read = readAgain(f);
  assert.deepEqual(read.homes, f.homes);
  assert.deepEqual(read.open, f.open);
});

test("a building gone up on burned lots keeps them when the rest rise", () => {
  const { f, at } = town(4000);
  at(100).burn(f, 0.1, 500);
  const run = f.changes.find((c) => c[0] === CHANGE.burned)!,
    site = run[1];
  f.civics.push({
    kind: "market",
    at: site,
    lots: 1,
    start: 101,
    end: 105,
    fell: null,
  } as Fabric["civics"][number]);
  at(100 + ASH_YEARS).rise(f, housingOf(f) * 2, 1, 1, 3);
  assert.equal(f.homes[1], 3999);
  const read = readAgain(f);
  assert.deepEqual(read.homes, f.homes);
  assert.deepEqual(read.open, f.open);
});

test("a raid on a town with no homes burns nothing", () => {
  const { f, store, at } = town(0);
  assert.equal(at(100).burn(f, 0.5, 500), 0);
  assert.ok(!store.ashen.has(f));
});
