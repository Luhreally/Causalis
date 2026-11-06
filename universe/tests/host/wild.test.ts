// The world acting on its own (N1): the rates it was told, and a world left to itself. What the ground, the weather and the sky do
// comes by no hand, the same each run, through a save; a fire goes only over what can burn; a world with nothing to burn has no fire.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAY,
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
} from "../../src/kernel/index.ts";
import { ALIEN, EARTH } from "../../src/host/planet.ts";
import { landPlan } from "../../src/host/land.ts";
import { why } from "../../src/causal/index.ts";
import { isProvinceWorld, worldKindOf } from "../../src/gen/index.ts";
import { populationContext, wildOf } from "../../src/sim/index.ts";
import {
  NATURE,
  STARS,
  answerChance,
  countOf,
  dryness,
  faultRate,
  flashesOf,
  litChance,
  magnitudeOf,
  natureImportance,
  reachesGround,
  stakesOf,
  yearsBetween,
} from "../../src/rules/index.ts";

test("each step of magnitude is ten times rarer, and no shock passes what its meeting can bring", () => {
  const q = NATURE.quake;
  assert.equal(magnitudeOf(0, 9.3), q.least);
  assert.equal(magnitudeOf(0.9, 9.3), q.least + 1);
  assert.equal(magnitudeOf(0.99, 9.3), q.least + 2);
  assert.equal(magnitudeOf(0.9999999, q.most.divergent), q.most.divergent);
  assert.equal(yearsBetween(0.05, q.least), 20);
  assert.equal(yearsBetween(0.05, q.least + 1), 200);
});

test("a land's shocks go by how its plates meet and how far off", () => {
  const q = NATURE.quake,
    at = q.plateSpeed;
  assert.equal(faultRate("convergent", 0, at), q.perYear.convergent);
  assert.ok(faultRate("convergent", 2, at) < faultRate("convergent", 0, at));
  assert.ok(faultRate("transform", 0, at) < faultRate("convergent", 0, at));
  assert.ok(faultRate("divergent", 0, at) < faultRate("transform", 0, at));
  // Far from any meeting, as seldom as within a plate; never none.
  assert.equal(faultRate("convergent", 40, at), q.perYear.within);
  assert.equal(faultRate("within", 0, at), q.perYear.within);
  // Faster plates, more shocks, within reason.
  assert.ok(faultRate("convergent", 0, at * 1.4) > faultRate("convergent", 0, at));
  assert.equal(faultRate("convergent", 0, at * 9), faultRate("convergent", 0, at * 1.6));
});

test("the greater the blow, the rarer, and the farther it is told", () => {
  // A window only for a world's great losses: never a small land's small one, nor a few against many.
  assert.equal(natureImportance(11, 1_000_000), 3);
  assert.equal(natureImportance(60, 1_000_000), 4);
  assert.equal(natureImportance(600, 1_000_000), 5);
  assert.equal(natureImportance(6_000, 1_000_000), 6);
  assert.equal(natureImportance(6_000, 1_000_000_000), 5);
  assert.equal(natureImportance(60_000, 1_000_000), 7);
  assert.equal(natureImportance(60_000, 10_000_000_000), 5);
  assert.equal(natureImportance(150_000, 60_000_000_000), 6);
  assert.equal(natureImportance(2_000_000, 60_000_000_000), 7);
  assert.ok(stakesOf(100) < stakesOf(10_000));
  assert.equal(stakesOf(0), 0);
  assert.equal(stakesOf(1e9), 1);
  for (let i = 1; i < STARS.length; i++) {
    assert.ok(STARS[i]!.perYear < STARS[i - 1]!.perYear, "a greater stone falls less often");
    assert.ok(STARS[i]!.metres > STARS[i - 1]!.metres);
  }
});

test("a stone bursts in the air it has to come through, and whole down through none", () => {
  assert.equal(reachesGround(20, 1), false);
  assert.equal(reachesGround(150, 1), true);
  assert.equal(reachesGround(20, 0), true);
});

test("nothing lights where there is nothing to burn, or no air to burn it, or rain enough", () => {
  assert.equal(litChance(4, 0, 1, 1), 0);
  assert.equal(litChance(4, 1, 1, 0), 0);
  assert.equal(litChance(4, 1, 0, 1), 0);
  assert.ok(litChance(25, 1, 1, 1) > litChance(4, 1, 1, 1));
  // A rainforest in a usual year stays wet; a dry woodland in a drought does not.
  assert.equal(dryness(3000, 1), 0);
  assert.equal(dryness(800, 0.6), 1);
  // Lightning: the wet tropics a score and more, a temperate land a few, the cold under one.
  assert.ok(flashesOf(27, 2500) > 15);
  const temperate = flashesOf(12, 800);
  assert.ok(temperate > 1 && temperate < 8, String(temperate));
  assert.ok(flashesOf(-15, 300) < 1);
});

test("a month's count and a ruler's chance stay in their bounds", () => {
  assert.equal(countOf(0.01, 0), 0);
  assert.ok(countOf(3, 0.999999) >= 6);
  assert.ok(countOf(50, 1) <= 16);
  assert.equal(answerChance(0, 0), NATURE.answer.least);
  assert.equal(answerChance(9, 9), 0.95);
});

// A world left to itself, for the rest.
const seed = "first light",
  YEARS = 30,
  world = EARTH.build(seedFromText(seed));
world.runTo(YEARS * YEAR);
const store = wildOf(world)!;

test("by itself, a world shakes and burns, by no hand", () => {
  assert.ok(store.tally.quakes > 0, "no shock in thirty years");
  assert.ok(store.tally.fires > 0, "no fire in thirty years");
  let told = 0;
  for (let i = 0; i < world.events.count; i++) {
    const e = world.events.at(i),
      d = (e.data ?? {}) as { natural?: boolean };
    if (!d.natural) continue;
    told++;
    assert.ok(
      !e.causes.some((c) => c.ref.startsWith("cmd:")),
      `${e.id} has a hand among its causes`,
    );
    const claim = why(world, e.id).claim;
    assert.ok(!/By your hand|Your act/.test(claim), claim);
    assert.ok(!/undefined|NaN|\[object|\bnull\b/.test(claim), claim);
    assert.ok(!/\bthe (\S+) of the \1\b/.test(claim), claim);
    assert.ok(!/\b0 homes\b/.test(claim), claim);
  }
  assert.ok(told > 0);
});

test("a fire goes only over ground that can burn, each patch from one it took, and leaves a scar that goes", () => {
  const g = populationContext(world).generated;
  assert.ok(isProvinceWorld(g));
  assert.ok(store.scars.length > 0);
  assert.ok(store.scars.length <= NATURE.fire.mostScars);
  for (const f of store.scars) {
    assert.equal(f.patches.length, f.days.length);
    assert.ok(f.patches.length >= 1 && f.patches.length <= NATURE.fire.most);
    assert.ok(f.from < f.until && f.until <= f.gone, f.event);
    assert.equal(f.days[0], 0);
    assert.ok(f.until >= f.from + Math.max(...f.days) * DAY, f.event);
    const took = new Set<number>();
    f.patches.forEach((c, i) => {
      assert.ok(g.fine.tectonics.elevation[c]! > 0, `${f.event} burned on the sea`);
      assert.ok(!g.fine.water.lake[c], `${f.event} burned on a lake`);
      if (i > 0) {
        let joined = false;
        for (let k = g.fine.grid.offsets[c]!; k < g.fine.grid.offsets[c + 1]!; k++)
          if (took.has(g.fine.grid.neighbours[k]!)) joined = true;
        assert.ok(joined, `${f.event}'s patch ${i} leapt`);
      }
      took.add(c);
    });
    assert.ok(f.lands.includes(f.cell), `${f.event} did not cross the land it lit in`);
    assert.ok(world.events.get(f.event), `${f.event} left the log while its scar stands`);
  }
  // A scar is gone when what burned has grown back.
  const y = Math.floor(world.now / YEAR);
  assert.ok(
    store.scars.every((f) => f.gone > world.now - YEAR),
    String(y),
  );
});

test("a world of sulfur burns blue, and says so", () => {
  const w = ALIEN.build(seedFromText("tide 653")),
    g = populationContext(w).generated;
  assert.ok(isProvinceWorld(g));
  assert.equal(worldKindOf(g), "sulfur");
  let y = 0;
  while (y < 60 && !wildOf(w)!.scars.length) w.runTo(++y * YEAR);
  const f = wildOf(w)!.scars[0];
  assert.ok(f, "no fire in sixty years on a world that burns");
  assert.equal((w.events.get(f.event)?.data as { flame?: string }).flame, "sulfur");
  assert.ok(/burning blue/.test(why(w, f.event).claim), why(w, f.event).claim);
  const burn = landPlan(w, f.cell, 40).burns?.find((b) => b.event === f.event);
  assert.ok(burn);
  assert.ok(burn.flame[2]! > burn.flame[0]!, "its flame is not blue");
});

test("a world of one lid has no shock for plates to bring", () => {
  // (Its plates told as too few, on a seed of its own: no generated world yet comes so, only a small body would.)
  const w = EARTH.build(seedFromText("one lid only")),
    g = populationContext(w).generated;
  assert.ok(isProvinceWorld(g));
  (g.planet as { plateCount: number }).plateCount = NATURE.quake.leastPlates - 1;
  w.runTo(8 * YEAR);
  assert.equal(wildOf(w)!.tally.quakes, 0);
  assert.equal(wildOf(w)!.tally.rises, 0);
});

test("the same seed, the same fires; and through a save it goes on the same", () => {
  const again = EARTH.build(seedFromText(seed));
  again.runTo(YEARS * YEAR);
  assert.deepEqual(wildOf(again)!.tally, store.tally);
  assert.deepEqual(
    wildOf(again)!.scars.map((f) => f.event),
    store.scars.map((f) => f.event),
  );
  assert.equal(JSON.stringify(again.domainHashes()), JSON.stringify(world.domainHashes()));

  // A save holds it, and running on from it comes to the same world as never having saved.
  const doc = JSON.parse(
      JSON.stringify(saveWorld(world, rulesetId(world, EARTH.version), { universe: EARTH.name })),
    ),
    { world: loaded } = loadWorld(doc, (s) => EARTH.build(s), rulesetId(world, EARTH.version));
  assert.deepEqual(wildOf(loaded)!.tally, store.tally);
  assert.equal(wildOf(loaded)!.scars.length, store.scars.length);
  const to = (YEARS + 3) * YEAR;
  loaded.runTo(to);
  again.runTo(to);
  assert.equal(JSON.stringify(loaded.domainHashes()), JSON.stringify(again.domainHashes()));
  assert.ok(wildOf(again)!.tally.fires >= store.tally.fires);
});
