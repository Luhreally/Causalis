import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Hasher,
  World,
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type Ref,
} from "../../src/kernel/index.ts";
import { HOLDS, LEVEL, civic, wallYears } from "../../src/rules/index.ts";
import {
  CHANGE,
  RUIN_YEARS,
  SETTLED,
  TownBuilder,
  TownStore,
  civicLots,
  civicMask,
  homesOf,
  housingOf,
  levelsOf,
  lotLevel,
  loreOf,
  makePopulationWorld,
  populationContext,
  townsOf,
  type Change,
  type Civic,
  type Fabric,
  type PopulationContext,
  type Settlement,
} from "../../src/sim/index.ts";

// Phase 23 M148: a town's fabric, built lot by lot from its square outward. A bare world holding
// only the fabric for the builder's own steps; juniper's peopled world for what the towns come to.

/** A bare world holding only the towns' fabric, and one town's empty fabric in it. */
function bare(): { ctx: PopulationContext; f: Fabric; store: TownStore } {
  const world = new World(seedFromText("fabric")),
    store = world.register(new TownStore()),
    ctx = { world } as unknown as PopulationContext;
  const f = store.add({
    town: "town:test" as Ref,
    family: "grid",
    phase: 0,
    next: 0,
    homes: HOLDS.map(() => 0),
    open: [],
    aim: -1,
    raise: 0,
    passed: -1,
    changes: [],
    civics: [],
    walls: null,
    lean: 0,
    forsaken: null,
  });
  return { ctx, f, store };
}

/** A year of a town's growth by the builder alone. */
function year(
  ctx: PopulationContext,
  f: Fabric,
  y: number,
  people: number,
  top: number,
  edge = top,
): void {
  const b = new TownBuilder(ctx, y);
  b.settle(f);
  if (people > housingOf(f)) b.grow(f, people, top, edge, -1);
  else b.shrink(f, people);
}

/** Its runs and its counts tell the same town: each home on a lot of its own, none under a building, its open lots empty. */
function consistent(f: Fabric, what = ""): void {
  const levels = levelsOf(f, 0, f.next),
    counts = HOLDS.map(() => 0),
    civic = civicLots(f);
  for (let p = 0; p < f.next; p++) {
    const l = levels[p]!;
    if (l < 0) continue;
    counts[l]!++;
    assert.ok(!civic.has(p), `${what}: a home on lot ${p}, under a building`);
  }
  assert.deepEqual(counts, f.homes, `${what}: the runs and the counts agree`);
  const runs = [...f.changes].sort((a, b) => a[1] - b[1]);
  for (let i = 1; i < runs.length; i++)
    assert.ok(
      runs[i]![1] >= runs[i - 1]![2],
      `${what}: runs ${runs[i - 1]} and ${runs[i]} share a lot`,
    );
  for (const [a, b] of f.open)
    for (let p = a; p < b; p++) {
      assert.equal(levels[p], -1, `${what}: open lot ${p} is empty`);
      assert.ok(!civic.has(p) && p < f.next, `${what}: open lot ${p} is the town's and free`);
    }
}

test("a town grows lot by lot from its square: its homes never move, and new ones come at its edge", () => {
  const { ctx, f } = bare();
  let people = 40,
    before: Int8Array = new Int8Array(0);
  for (let y = 0; y < 120; y++) {
    people = Math.round(people * 1.04);
    const edge = f.next;
    year(ctx, f, y, people, LEVEL.house);
    consistent(f, `year ${y}`);
    const now = levelsOf(f, 0, f.next);
    for (let p = 0; p < before.length; p++)
      if (before[p]! >= 0)
        assert.equal(now[p], before[p], `year ${y}: the home on lot ${p} stands`);
    for (let p = edge; p < f.next; p++)
      assert.equal(now[p], LEVEL.house, `year ${y}: lot ${p} new at the edge`);
    before = now;
  }
  assert.ok(housingOf(f) >= people, `${housingOf(f)} housed of ${people}`);
  // (Built a year at a time, at one level in one design: the years-old runs are one.)
  assert.ok(f.changes.length <= SETTLED + 1, `${f.changes.length} runs`);
  assert.ok(f.changes.every((c) => c[0] === CHANGE.built));
});

test("a town's heart is rebuilt higher as its land learns, ring by ring, its edge the lowest", () => {
  for (const [top, edge] of [
    [LEVEL.highRise, LEVEL.townhouse],
    [LEVEL.townhouse, LEVEL.house],
  ] as const)
    for (const n of [10, 400, 9000]) {
      let last: number = top;
      for (let p = 0; p < n; p++) {
        const l = lotLevel(p, n, top, edge);
        assert.ok(l <= last && l >= edge, `lot ${p} of ${n}: ${l} after ${last}`);
        last = l;
      }
      assert.equal(lotLevel(0, n, top, edge), top, "its first lot the highest");
      assert.equal(lotLevel(n - 1, n, top, edge), edge, "its last the lowest");
      assert.equal(lotLevel(n + 5, n, top, edge), edge, "beyond it, its edge's");
    }
  // Houses, until the land builds in stone: then the innermost quarter rebuilt as townhouses
  // as people come, and the rest left houses.
  const { ctx, f } = bare();
  let people = 1500;
  for (let y = 0; y < 8; y++) year(ctx, f, y, people, LEVEL.house);
  assert.equal(f.homes[LEVEL.townhouse], 0);
  const houses = homesOf(f);
  for (let y = 8; y < 60; y++) {
    people = Math.round(people * 1.03);
    year(ctx, f, y, people, LEVEL.townhouse, LEVEL.house);
    consistent(f, `year ${y}`);
  }
  const levels = levelsOf(f, 0, f.next),
    inner = levels.slice(0, Math.floor(f.next / 8)),
    outer = levels.slice(Math.floor(f.next * 0.6));
  assert.ok(f.homes[LEVEL.townhouse]! > houses / 8, `${f.homes[LEVEL.townhouse]} townhouses`);
  assert.ok(
    inner.filter((l) => l === LEVEL.townhouse).length >= inner.length * 0.8,
    "its heart townhouses",
  );
  assert.ok(
    outer.every((l) => l <= LEVEL.house),
    "its edge houses",
  );
  assert.ok(housingOf(f) >= people);
});

test("homes fall from the edge after lean years, and the fallen lots are built again first", () => {
  const { ctx, f } = bare();
  for (let y = 0; y < 10; y++) year(ctx, f, y, 1200, LEVEL.house);
  const built = homesOf(f),
    next = f.next;
  // Two lean years the town holds; in the third its edge begins to fall, a few a year.
  year(ctx, f, 10, 300, LEVEL.house);
  year(ctx, f, 11, 300, LEVEL.house);
  assert.equal(homesOf(f), built, "held through two lean years");
  year(ctx, f, 12, 300, LEVEL.house);
  assert.ok(homesOf(f) < built && homesOf(f) >= built * 0.9, `${homesOf(f)} of ${built} stand`);
  for (let y = 13; y < 60; y++) year(ctx, f, y, 300, LEVEL.house);
  consistent(f, "fallen");
  const levels = levelsOf(f, 0, f.next),
    standing = [...levels.keys()].filter((p) => levels[p]! >= 0),
    fell = f.changes.filter((c) => c[0] === CHANGE.fell);
  assert.ok(housingOf(f) <= 300 / 0.6, `${housingOf(f)} housing for 300`);
  assert.ok(fell.length >= 1);
  for (const c of fell) assert.ok(c[1] > standing.at(-1)!, "it fell from its edge inward");
  // Their ruins weather away: in sixty years the fallen runs are let go, the lots still open.
  const open = f.open.reduce((n, [a, b]) => n + b - a, 0);
  for (let y = 60; y < 60 + RUIN_YEARS; y++) year(ctx, f, y, 300, LEVEL.house);
  assert.ok(
    f.changes.filter((c) => c[0] === CHANGE.fell && c[4] < 60).length === 0,
    "weathered away",
  );
  assert.equal(
    f.open.reduce((n, [a, b]) => n + b - a, 0),
    open,
  );
  consistent(f, "weathered");
  // People come back: the fallen lots are built on before any new lot is taken.
  for (let y = 60 + RUIN_YEARS; y < 70 + RUIN_YEARS; y++) year(ctx, f, y, 1200, LEVEL.house);
  consistent(f, "built again");
  assert.equal(f.next, next, "no new lot taken while fallen ones were open");
  assert.equal(f.open.length, 0);
});

test("a fire takes a town's heart, a sack its edge, and the burnt lots are built again", () => {
  const { ctx, f } = bare();
  for (let y = 0; y < 10; y++) year(ctx, f, y, 900, LEVEL.house);
  const before = homesOf(f),
    burnt = new TownBuilder(ctx, 10).raze(f, 0.1, false);
  assert.equal(burnt, Math.ceil(before * 0.1));
  const levels = levelsOf(f, 0, f.next);
  for (let p = 0; p < burnt; p++) assert.equal(levels[p], -1, `lot ${p} burnt`);
  const sacked = new TownBuilder(ctx, 10).raze(f, 0.05, true),
    after = levelsOf(f, 0, f.next);
  for (let p = f.next - sacked; p < f.next; p++) assert.equal(after[p], -1, `lot ${p} sacked`);
  consistent(f, "razed");
  assert.equal(homesOf(f), before - burnt - sacked);
  for (let y = 11; y < 16; y++) year(ctx, f, y, 900, LEVEL.house);
  consistent(f, "rebuilt");
  assert.equal(homesOf(f), before, "rebuilt on the same lots");
  assert.equal(f.open.length, 0);
});

test("a building stands on lots of its own: about the square it clears the homes there, at the edge it takes new lots", () => {
  const { ctx, f } = bare();
  for (let y = 0; y < 6; y++) year(ctx, f, y, 600, LEVEL.house);
  const b = new TownBuilder(ctx, 6),
    homes = homesOf(f),
    next = f.next;
  const core = b.siteFor(f, 4, "core");
  assert.equal(core, 0, "about the square");
  b.clearFor(f, core, 4);
  f.civics.push({ kind: "temple", at: core, lots: 4, start: 6, end: 11, fell: null });
  assert.equal(homesOf(f), homes - 4, "four homes cleared for it");
  const edge = b.siteFor(f, 8, "edge");
  assert.ok(edge >= next && edge % 8 === 0, `at the edge, on a block of its own (${edge})`);
  b.clearFor(f, edge, 8);
  f.civics.push({ kind: "factory", at: edge, lots: 8, start: 6, end: 9, fell: null });
  assert.equal(f.next, edge + 8);
  const shrine = b.siteFor(f, 1, "core");
  assert.equal(shrine, 4, "the next building beside the first");
  consistent(f, "built");
  // The homes cleared are raised again on open lots and at the edge, never under a building.
  for (let y = 7; y < 12; y++) year(ctx, f, y, 640, LEVEL.house);
  consistent(f, "after");
  assert.ok(housingOf(f) >= 640);
});

test("a building among a town's homes does not part their runs once settled, and falling, its lots are cut out again", () => {
  const { ctx, f } = bare();
  for (let y = 0; y < 4; y++) year(ctx, f, y, 200 + y * 60, LEVEL.house);
  const b = new TownBuilder(ctx, 4),
    edge = b.siteFor(f, 2, "edge");
  b.clearFor(f, edge, 2);
  f.civics.push({ kind: "workshop", at: edge, lots: 2, start: 4, end: 5, fell: null });
  for (let y = 4; y < 20; y++) year(ctx, f, y, 200 + y * 60, LEVEL.house);
  consistent(f, "grown past it");
  const over = f.changes.filter((c) => c[0] === CHANGE.built && c[1] < edge && c[2] > edge + 2);
  assert.equal(over.length, 1, "one run of homes passes over its lots");
  assert.deepEqual([...levelsOf(f, edge, edge + 2)], [-1, -1], "its lots no homes");
  // Fallen out of use, its town emptied: its lots open again, never homes of the run they were in.
  const town = { population: 5, cell: 0, ref: "town:test", name: "Test" } as unknown as Settlement;
  new TownBuilder(ctx, 30).civics(
    f,
    town,
    () => false,
    false,
    () => false,
    () => false,
  );
  assert.equal(f.civics[0]!.fell, 30, "it fell");
  assert.deepEqual([...levelsOf(f, edge, edge + 2)], [-1, -1], "its lots empty");
  assert.ok(
    f.open.some(([a, z]) => a <= edge && z >= edge + 2),
    "its lots open",
  );
  consistent(f, "fallen");
  // The homes built next stand on them first.
  year(ctx, f, 31, housingOf(f) + 2 * HOLDS[LEVEL.house]!, LEVEL.house);
  assert.deepEqual([...levelsOf(f, edge, edge + 2)], [LEVEL.house, LEVEL.house], "homes on them");
  consistent(f, "built again");
});

test("a town's runs stay few: years-old runs join, and those built over are let go", () => {
  const { ctx, f } = bare();
  let people = 100;
  for (let y = 0; y < 300; y++) {
    people = Math.round(people * (y % 50 < 40 ? 1.03 : 0.9));
    const masonry = y >= 150;
    year(ctx, f, y, people, masonry ? LEVEL.townhouse : LEVEL.house, LEVEL.house);
    if (y % 37 === 0) new TownBuilder(ctx, y).raze(f, 0.03, y % 2 === 0);
    consistent(f, `year ${y}`);
  }
  assert.ok(f.changes.length <= 60, `${f.changes.length} runs over three hundred years`);
});

/** Homes let fall lot by lot over a town's last 512 lots, as the builder let them before it went run by run. */
function shrinkByLot(b: TownBuilder, f: Fabric, people: number): void {
  const housing = housingOf(f);
  if (housing === 0 || housing <= people / 0.6) {
    f.lean = 0;
    return;
  }
  if (++f.lean < 3) return;
  let excess = housing - Math.ceil(people / 0.8),
    count = Math.max(1, Math.ceil(homesOf(f) * 0.05)),
    top = -1;
  const from = Math.max(0, f.next - 512),
    levels = levelsOf(f, from, f.next),
    under = civicMask(f, from, f.next),
    fall = (lo: number) => {
      if (top < 0) return;
      b.change(f, CHANGE.fell, lo, top + 1, 0, 0);
      b.release(f, lo, top + 1);
      top = -1;
    };
  for (let p = f.next - 1; p >= from && excess > 0 && count > 0; p--) {
    const was = levels[p - from]!;
    if (was < 0 || under[p - from]) {
      fall(p + 1);
      continue;
    }
    if (top < 0) top = p;
    f.homes[was]!--;
    excess -= HOLDS[was]!;
    count--;
    if (excess <= 0 || count <= 0) fall(p);
  }
  fall(from);
}

/** A share of a town's homes razed lot by lot, its heart first or its edge, as the builder razed them before. */
function razeByLot(b: TownBuilder, f: Fabric, share: number, edge: boolean): number {
  const levels = levelsOf(f, 0, f.next),
    under = civicMask(f, 0, f.next),
    standing: number[] = [];
  for (let p = 0; p < f.next; p++) if (levels[p]! >= 0 && !under[p]) standing.push(p);
  const n = Math.min(standing.length, Math.ceil(standing.length * share)),
    down = edge ? standing.slice(-n) : standing.slice(0, n);
  let run = -1,
    at = -1;
  const done = () => {
    if (run < 0) return;
    b.change(f, CHANGE.razed, run, at + 1, 0, 0);
    b.release(f, run, at + 1);
    run = -1;
  };
  for (const p of down) {
    if (run >= 0 && p !== at + 1) done();
    if (run < 0) run = p;
    at = p;
    f.homes[levels[p]!]!--;
  }
  done();
  return down.length;
}

test("homes fall and burn run by run as they did lot by lot: the same lots, runs and digest", () => {
  const towns = [bare(), bare()],
    digest = (s: TownStore) => {
      const h = new Hasher();
      s.hashInto(h);
      return h.hex();
    },
    emptied = { population: 5, cell: 0, ref: "town:test", name: "Test" } as unknown as Settlement;
  let people = 400,
    fell = 0,
    idle = 0;
  for (let y = 0; y < 400; y++) {
    // Booms and long lean spells; now and then a building among its homes or at its edge, one
    // fallen out of use, a fire at its heart or a sack at its edge.
    people = Math.max(30, Math.round(people * (y % 100 < 40 ? 1.08 : y % 100 < 90 ? 0.95 : 1)));
    const razed: number[] = [];
    for (const [i, { ctx, f }] of towns.entries()) {
      const b = new TownBuilder(ctx, y);
      b.settle(f);
      if (people > housingOf(f)) {
        f.lean = 0;
        b.grow(f, people, LEVEL.townhouse, LEVEL.house, -1);
      } else if (i === 1) shrinkByLot(b, f, people);
      else b.shrink(f, people);
      if (y % 17 === 3) {
        const at = b.siteFor(f, 2, y % 2 === 0 ? "core" : "edge");
        b.clearFor(f, at, 2);
        f.civics.push({ kind: "workshop", at, lots: 2, start: y, end: y + 1, fell: null });
      }
      if (y % 41 === 20)
        b.civics(
          f,
          emptied,
          () => false,
          false,
          () => false,
          () => false,
        );
      if (y % 13 === 6) {
        const share = 0.01 + (y % 7) / 50,
          edge = y % 2 === 1;
        razed.push(i === 1 ? razeByLot(b, f, share, edge) : b.raze(f, share, edge));
      }
    }
    const [{ f, store }, { f: byLot, store: byLotStore }] = towns as [
      (typeof towns)[0],
      (typeof towns)[0],
    ];
    assert.deepEqual(f, byLot, `year ${y}: the same town`);
    assert.equal(digest(store), digest(byLotStore), `year ${y}: the same digest`);
    assert.equal(razed[0], razed[1], `year ${y}: as many razed`);
    consistent(f, `year ${y}`);
    if (f.changes.some((c) => c[0] === CHANGE.fell && c[4] === y)) fell++;
    else if (f.lean >= 3) idle++;
  }
  // (Lean years that let homes fall, and those with none left to fall in its last lots.)
  assert.ok(
    fell > 10 && idle > 10,
    `${fell} years let homes fall, ${idle} none (of ${towns[0]!.f.next} lots)`,
  );
});

test("homes fall and burn run by run as they did lot by lot, whatever stands on a town's lots", () => {
  let s = 7;
  const roll = (n: number) => {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      return (s >>> 8) % n;
    },
    digest = (store: TownStore) => {
      const h = new Hasher();
      store.hashInto(h);
      return h.hex();
    };
  for (let k = 0; k < 400; k++) {
    // Runs of every kind and length with open lots among them, and buildings standing or fallen
    // over any of it (a lone lot of homes at its top, a building over its last lots).
    const next = 1 + roll(roll(3) === 0 ? 40 : 1500),
      changes: Change[] = [],
      civics: Civic[] = [];
    for (let p = 0; p < next;) {
      const n = Math.min(next - p, 1 + roll(roll(4) === 0 ? 300 : 6));
      if (roll(4) > 0) changes.push([roll(5), p, p + n, 0, 0, roll(HOLDS.length), -1]);
      p += n;
    }
    // (Now and then two runs of homes on a lot, which a town never has: the later stands.)
    if (roll(8) === 0) {
      const at = roll(next);
      changes.push([roll(2), at, at + 1 + roll(20), 0, 0, roll(HOLDS.length), -1]);
    }
    for (let c = roll(10); c > 0; c--)
      civics.push({
        kind: "workshop",
        at: roll(next),
        lots: 1 + roll(roll(5) === 0 ? 40 : 4),
        start: 0,
        end: 0,
        fell: roll(3) === 0 ? 0 : null,
      });
    const towns = [bare(), bare()],
      people = roll(1 + 3 * next),
      share = roll(4) === 0 ? 1 / (1 + roll(next)) : roll(40) / 100,
      edge = roll(2) === 0,
      what = `town ${k} (${next} lots, ${people} people, ${share} razed at its ${edge ? "edge" : "heart"})`;
    for (const { f } of towns) {
      Object.assign(f, {
        next,
        changes: structuredClone(changes),
        civics: structuredClone(civics),
      });
      f.homes = HOLDS.map(() => 0);
      for (const l of levelsOf(f, 0, next)) if (l >= 0) f.homes[l]!++;
      f.lean = 2;
    }
    const [{ ctx, f, store }, { ctx: byLotCtx, f: byLot, store: byLotStore }] = towns as [
      ReturnType<typeof bare>,
      ReturnType<typeof bare>,
    ];
    new TownBuilder(ctx, 1).shrink(f, people);
    shrinkByLot(new TownBuilder(byLotCtx, 1), byLot, people);
    assert.deepEqual(f, byLot, `${what}: the same fall`);
    assert.equal(
      new TownBuilder(ctx, 2).raze(f, share, edge),
      razeByLot(new TownBuilder(byLotCtx, 2), byLot, share, edge),
      `${what}: as many razed`,
    );
    assert.deepEqual(f, byLot, `${what}: the same lots razed`);
    assert.equal(digest(store), digest(byLotStore), `${what}: the same digest`);
  }
});

test("a town settled only as something of it comes due is the town settled every year", () => {
  const towns = [bare(), bare()],
    digest = (store: TownStore) => {
      const h = new Hasher();
      store.hashInto(h);
      return h.hex();
    },
    emptied = { population: 5, cell: 0, ref: "town:test", name: "Test" } as unknown as Settlement;
  let people = 400,
    passed = 0;
  for (let y = 0; y < 400; y++) {
    // Booms and long lean spells, buildings raised and fallen out of use, fires and sacks, and
    // years on end when nothing is built at all.
    people = Math.max(30, Math.round(people * (y % 100 < 30 ? 1.08 : y % 100 < 60 ? 0.95 : 1)));
    for (const [i, { ctx, f, store }] of towns.entries()) {
      // (The second goes over every run and building every year, as settling always did.)
      if (i === 1) store.settled.clear();
      const b = new TownBuilder(ctx, y);
      b.settle(f);
      if (i === 0 && store.settled.get(f)!.year < y) passed++;
      if (people > housingOf(f)) {
        f.lean = 0;
        b.grow(f, people, LEVEL.townhouse, LEVEL.house, -1);
      } else b.shrink(f, people);
      if (y % 23 === 3) {
        const at = b.siteFor(f, 2, y % 2 === 0 ? "core" : "edge");
        b.clearFor(f, at, 2);
        f.civics.push({ kind: "workshop", at, lots: 2, start: y, end: y + 1, fell: null });
      }
      if (y % 31 === 20)
        b.civics(
          f,
          emptied,
          () => false,
          false,
          () => false,
          () => false,
        );
      if (y % 37 === 6) b.raze(f, 0.01 + (y % 7) / 50, y % 2 === 1);
    }
    const [{ f, store }, { f: everyYear, store: everyYearStore }] = towns as [
      ReturnType<typeof bare>,
      ReturnType<typeof bare>,
    ];
    assert.deepEqual(f, everyYear, `year ${y}: the same town`);
    assert.equal(digest(store), digest(everyYearStore), `year ${y}: the same digest`);
  }
  assert.ok(passed > 100, `${passed} years with nothing come due`);
});

test("a town otherwise still settles on time a building fallen out of use and a run razed whole", () => {
  const towns = [bare(), bare()],
    emptied = { population: 5, cell: 0, ref: "town:test", name: "Test" } as unknown as Settlement,
    none = () => false;
  // Ten years of building and a workshop at its edge (on lots no run holds); then years of
  // nothing, but for the workshop let fall (cutting no run) and every home razed at once (as
  // many runs after as before).
  for (const { ctx, f } of towns) {
    for (let y = 0; y < 10; y++) year(ctx, f, y, 300 + y * 40, LEVEL.house);
    const b = new TownBuilder(ctx, 10),
      at = b.siteFor(f, 2, "edge");
    b.clearFor(f, at, 2);
    f.civics.push({ kind: "workshop", at, lots: 2, start: 10, end: 11, fell: null });
  }
  for (let y = 11; y < 160; y++) {
    for (const [i, { ctx, f, store }] of towns.entries()) {
      // (The second goes over every run and building every year, as settling always did.)
      if (i === 1) store.settled.clear();
      const b = new TownBuilder(ctx, y);
      b.settle(f);
      if (y === 20) b.civics(f, emptied, none, false, none, none);
      if (y === 90) {
        assert.equal(f.changes.length, 1, "its homes one run");
        b.change(f, CHANGE.razed, f.changes[0]![1], f.changes[0]![2], 0, 0);
      }
    }
    assert.deepEqual(towns[0]!.f, towns[1]!.f, `year ${y}: the same town`);
    if (y === 20 + RUIN_YEARS + 1) assert.equal(towns[0]!.f.civics.length, 0, "the workshop gone");
  }
  assert.equal(towns[0]!.f.changes.length, 0, "the razed run weathered away");
});

test("the towns' fabric is saved and loaded whole, digest and all", () => {
  const { ctx, f, store } = bare();
  for (let y = 0; y < 40; y++)
    year(ctx, f, y, 200 + y * 30, y > 20 ? LEVEL.townhouse : LEVEL.house, LEVEL.house);
  f.civics.push({ kind: "shrine", at: 0, lots: 1, start: 2, end: 3, fell: 30 });
  f.walls = { start: 20, end: 20 + wallYears(f.next), reach: f.next };
  const saved = JSON.parse(JSON.stringify(store.save())) as unknown,
    again = new TownStore();
  again.load(saved);
  assert.deepEqual(again.all(), store.all());
  const hash = (s: TownStore) => {
    const h = new Hasher();
    s.hashInto(h);
    return h.hex();
  };
  assert.equal(hash(again), hash(store));
  assert.deepEqual(again.save(), store.save());
});

// Juniper's peopled world a hundred and twenty years on (and a copy loaded at its hundredth).
const seed = seedFromText("juniper"),
  build = () => makePopulationWorld(seed, { start: "spread" }),
  world = build();
world.runTo(100 * YEAR);
const RULESET = rulesetId(world, "test"),
  copy = loadWorld(saveWorld(world, RULESET), build, RULESET).world;
world.runTo(120 * YEAR);
copy.runTo(120 * YEAR);

test("a saved world loaded goes on to build its towns the same", () => {
  assert.deepEqual(townsOf(copy).save(), townsOf(world).save());
});

test("a peopled world's towns are housed, lot by lot, and build what their lands know", () => {
  const ctx = populationContext(world),
    lore = loreOf(world),
    store = townsOf(world);
  let people = 0,
    housed = 0,
    checked = 0;
  const built = { small: [] as number[], large: [] as number[] };
  for (const s of ctx.settlements.all()) {
    const f = store.get(s.ref);
    if (s.population > 0) assert.ok(f, `${s.name} has its fabric`);
    if (!f) continue;
    consistent(f, s.name);
    people += s.population;
    housed += Math.min(s.population, housingOf(f));
    const standing = f.civics.filter((c) => c.fell === null);
    // No two buildings on one lot.
    const lots = new Set<number>();
    for (const c of standing)
      for (let k = 0; k < c.lots; k++) {
        assert.ok(!lots.has(c.at + k), `${s.name}: two buildings on lot ${c.at + k}`);
        lots.add(c.at + k);
      }
    // Each begun once its land knew what it asks.
    for (const c of f.civics)
      for (const need of civic(c.kind).needs) {
        const years = need
          .split("|")
          .map((id) => lore.get(s.cell, id)?.year)
          .filter((y) => y !== undefined);
        if (!years.length) continue;
        assert.ok(
          Math.min(...years) <= c.start,
          `${s.name}: ${c.kind} begun in ${c.start}, ${need} known after`,
        );
        checked++;
      }
    if (s.population < 300) built.small.push(standing.length);
    if (s.population >= 1000) built.large.push(standing.length);
  }
  assert.ok(housed >= people * 0.95, `${housed} housed of ${people}`);
  assert.ok(checked >= 100, `${checked} buildings' learning checked`);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  assert.ok(built.large.length >= 5 && built.small.length >= 5);
  assert.ok(mean(built.large) > mean(built.small), "a larger town has more buildings");
});
