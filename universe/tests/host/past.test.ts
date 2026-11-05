// Phase 66: what the host reads of the ages past ours, on a young world where none of it has come: nothing
// is said of it, it costs nothing, and it is the same however it is read. A town of many millions is read
// in what a town of a million and a half is.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText, YEAR } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { isMachineFolk, landPast, mirrorsOfSky, pastLands, pastTown } from "../../src/host/past.ts";
import { LINE, MOST_LINES, linesOf } from "../../src/host/roster.ts";
import { colonyRemade } from "../../src/host/colony.ts";
import { rimWorks } from "../../src/host/town.ts";
import type { Fabric } from "../../src/sim/town/fabric.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { populationContext, lateOf } from "../../src/sim/index.ts";

test("a town's lines are kept by its people up to a bound", () => {
  assert.equal(linesOf(0), 0);
  assert.equal(linesOf(1), 1);
  assert.equal(linesOf(LINE), 1);
  assert.equal(linesOf(LINE + 1), 2);
  assert.equal(linesOf(MOST_LINES * LINE), MOST_LINES);
  assert.equal(linesOf(6e7), MOST_LINES);
});

test("a great town's works, far past what is drawn of it, are drawn along its rim", () => {
  const civic = (kind: string, at: number, lots = 8, fell: number | null = null) => ({
    kind,
    at,
    lots,
    start: 1400,
    end: 1406,
    fell,
  });
  const f = {
    next: 200_000,
    civics: [
      civic("market", 0),
      civic("offices", 7_900, 16),
      civic("fusion", 50_000),
      civic("fusion", 90_000),
      civic("vats", 120_000, 6),
      // (Fallen, and of another kind: not brought in.)
      civic("fusion", 130_000, 8, 1500),
      civic("factory", 140_000),
    ],
  } as unknown as Fabric;
  const rim = rimWorks(f, 8000);
  assert.deepEqual(
    rim.map((c) => [c.kind, c.truly]),
    [
      ["fusion", 50_000],
      ["fusion", 90_000],
      ["vats", 120_000],
    ],
  );
  const taken: [number, number][] = [
    [0, 8],
    [7_900, 7_916],
  ];
  for (const c of rim) {
    assert.ok(c.at >= 0 && c.at + c.lots <= 8000, `${c.kind} within what is drawn`);
    assert.ok(c.at > 8000 * 0.5, `${c.kind} toward the rim`);
    assert.ok(
      taken.every(([a, b]) => a >= c.at + c.lots || c.at >= b),
      `${c.kind} clear of what stands there`,
    );
    taken.push([c.at, c.at + c.lots]);
  }
  // (A town all of which is drawn keeps its works where they stand.)
  assert.deepEqual(rimWorks({ ...f, next: 7000 } as Fabric, 200_000), []);
});

test("who is of made limbs is theirs alone, and about the share told", () => {
  const past = { machines: 0.25 };
  let made = 0;
  for (let i = 0; i < 4000; i++) {
    const ref = `folk:town:0:7:${i}:1`;
    assert.equal(isMachineFolk(past, ref), isMachineFolk(past, ref));
    if (isMachineFolk(past, ref)) made++;
  }
  assert.ok(made > 800 && made < 1200, `${made} of 4000 at a quarter`);
  assert.equal(isMachineFolk(null, "x"), false);
  assert.equal(isMachineFolk({ machines: 0 }, "x"), false);
});

test("on a young world nothing past ours is read, the store stays out of its hashes, and the book tells it", () => {
  const world = EARTH.build(seedFromText("first light"));
  world.runTo(40 * YEAR);
  const before = world.domainHashes();
  assert.deepEqual(pastLands(world), []);
  assert.deepEqual(mirrorsOfSky(world), {});
  // (With none of it, the town it opens in is simply the most peopled.)
  const towns = populationContext(world).settlements.all(),
    most = Math.max(...towns.map((t) => t.population));
  assert.equal(pastTown(world)?.people, most);
  const ctx = populationContext(world),
    cell = ctx.provinces.all().find((p) => p.total() > 0)!.cell;
  assert.equal(landPast(world, cell), null);
  assert.equal(colonyRemade(world, cell), 0);
  assert.deepEqual(world.domainHashes(), before, "reading it changed nothing");
  const late = lateOf(world)!;
  assert.ok(late.dormant());
  assert.ok(!Object.keys(before).includes(late.name), "a store with nothing in it is in no hash");
  // (Everything new has a page.)
  const book = pageOf(world, "concept:past");
  assert.match(book.title, /Ages past ours/);
  for (const id of ["fusion-power", "beam-arms", "world-city"]) {
    const p = pageOf(world, `prin:${id}`);
    assert.notEqual(p.title, "Nothing is known of it");
  }
});
