// The sweep's Nature lane on a small world, briefly: crops, diets, the fires below and the floods keep their state as the year
// reads it, give exactly 1 where nothing has happened, and save and load the same.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, loadWorld, saveWorld, seedFromText } from "../../src/kernel/index.ts";
import { STAR_LIFE, burstLeft } from "../../src/rules/index.ts";
import {
  clusterOf,
  cropsGive,
  cropsOf,
  dietDeaths,
  dietOfWorld,
  eruptionsAYear,
  firesOf,
  floodplains,
  floodYield,
  floodsOf,
  makePopulationWorld,
  motionOf,
  populationContext,
  starDeathAt,
  veilYield,
} from "../../src/sim/index.ts";

test("crops, diets, eruptions and floods: their stores, their factors, and a save that loads the same", () => {
  const make = (s: ReturnType<typeof seedFromText>) =>
      makePopulationWorld(s, { frequency: 16, start: "spread" }),
    w = make(seedFromText("nature sweep"));
  w.runTo(30 * YEAR);
  const ctx = populationContext(w);
  assert.ok(cropsOf(w) && dietOfWorld(w) && firesOf(w) && floodsOf(w));
  assert.ok(eruptionsAYear(ctx) >= 0);
  assert.ok(floodplains(ctx).length >= 0);
  // Every land that sows keeps a crop; what it gives is bounded, and 1 where it sows its own, tamed.
  let sowing = 0;
  for (const p of ctx.provinces.all()) {
    if (!p.knowsCultivation || p.cell >= ctx.generated.grid.count) continue;
    const l = cropsOf(w)!.get(p.cell);
    if (!l) continue;
    sowing++;
    const k = cropsGive(w, p.cell);
    assert.ok(k > 0 && k <= 1.5, `${k}`);
    if (l.tame === 1000 && l.from === p.cell && l.fit === 1000 && l.seed === l.own)
      assert.equal(k, 1);
  }
  assert.ok(sowing === cropsOf(w)!.size, "a crop is kept only where a land sows");
  // A land's diet read from its books: its want's deaths at least 1.
  for (const p of ctx.provinces.all()) {
    const d = dietDeaths(w, p.cell);
    assert.ok(d.young >= 1 && d.grown >= 1 && d.young >= d.grown);
    assert.ok(veilYield(ctx, p.cell) > 0 && veilYield(ctx, p.cell) <= 1);
    assert.ok(floodYield(w, p.cell) > 0 && floodYield(w, p.cell) <= 1);
  }
  const again = loadWorld(
    JSON.parse(JSON.stringify(saveWorld(w, "n"))) as ReturnType<typeof saveWorld>,
    make,
    "n",
  ).world;
  assert.deepEqual(again.domainHashes(), w.domainHashes());
  again.runTo(40 * YEAR);
  w.runTo(40 * YEAR);
  assert.deepEqual(again.domainHashes(), w.domainHashes());
});

test("a star's end reaches the peoples of the stars near it: its own goes dark, a supernova's burst harms by its distance", () => {
  const w = makePopulationWorld(seedFromText("nature sweep stars"), { frequency: 16 });
  w.runTo(2 * YEAR);
  const stars = clusterOf(w),
    a = stars[1]!,
    near = stars
      .filter((s) => s.ref !== a.ref)
      .map((s) => ({ s, d: Math.hypot(s.x - a.x, s.y - a.y, s.z - a.z) }))
      .sort((x, y) => x.d - y.d)[0]!,
    store = motionOf(w)!;
  assert.equal(starDeathAt(w, a.ref, 0, 30).own, null);
  store.ends.push({ star: a.ref, year: 10, how: "supernova", distance: a.distance, event: a.ref });
  assert.equal(starDeathAt(w, a.ref, 0, 30).own?.how, "supernova");
  const by = starDeathAt(w, near.s.ref, 0, 30);
  assert.ok(by.harm >= 1);
  if (near.d < STAR_LIFE.harmLy) assert.ok(by.harm > 1.2 && by.years === STAR_LIFE.burstYears);
  assert.ok(burstLeft(by.harm, by.years) <= 1);
  // (Before it burst, nothing reached them.)
  assert.equal(starDeathAt(w, near.s.ref, 0, 9).harm, 1);
});
