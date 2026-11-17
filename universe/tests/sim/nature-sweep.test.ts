// The sweep's Nature lane on a small world, briefly: crops, diets, the fires below and the floods keep their state as the year
// reads it, give exactly 1 where nothing has happened, and save and load the same.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  saveWorld,
  seedFromText,
  simTime,
  yearOfMoment,
} from "../../src/kernel/index.ts";
import {
  BIOTIC,
  STAND,
  STAR_LIFE,
  beastWorth,
  burstLeft,
  lineageBit,
} from "../../src/rules/index.ts";
import { lives } from "../../src/gen/index.ts";
import {
  CROP_STEP,
  clusterOf,
  cropFieldOf,
  cropsGive,
  cropsOf,
  dietDeaths,
  dietOfWorld,
  eruptionsAYear,
  exchangeOf,
  exchangeYear,
  firesOf,
  herdGives,
  pestsLeft,
  standAge,
  standsOf,
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
  // Pests and beasts carried: a row for every sowing land, its factors bounded, 1 where nothing came.
  assert.ok(exchangeOf(w) && exchangeOf(w)!.size === cropsOf(w)!.size);
  for (const x of exchangeOf(w)!.all()) {
    const left = pestsLeft(w, x.cell),
      herds = herdGives(w, x.cell);
    assert.ok(left >= 0.5 && left <= 1, `${left}`);
    assert.ok(herds > 0, `${herds}`);
    if (!x.struck) assert.equal(left, 1);
    if (x.beast === x.first) assert.equal(herds, 1);
  }
  // The woods' age: kept only where they were touched, never past their climax.
  assert.ok(standsOf(w));
  for (const p of ctx.provinces.all()) {
    const a = standAge(w, p.cell);
    assert.ok(a > 0 && a <= STAND.climax + 1e-9, `${a}`);
  }
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

test("a lineage never met, sown across a land's border, brings its weeds and pests; a better beast kept there is taken up", () => {
  const w = makePopulationWorld(seedFromText("nature sweep"), { frequency: 16, start: "spread" });
  w.runTo(30 * YEAR);
  const ctx = populationContext(w),
    g = ctx.generated,
    crops = cropsOf(w)!,
    x = exchangeOf(w)!,
    beside = (c: number) => {
      const out: number[] = [];
      for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++)
        out.push(g.grid.neighbours[k]!);
      return out;
    },
    pair = x
      .all()
      .flatMap((l) =>
        beside(l.cell).flatMap((n) => (x.get(n) ? [[l, x.get(n)!] as const] : [])),
      )[0];
  assert.ok(pair, "two sowing lands side by side");
  const [land, other] = pair,
    near = [land.cell, ...beside(land.cell)],
    foreign = g.life.species.find(
      (s) =>
        s.died === null &&
        !near.some((c) => lives(g.life, c, s.index)) &&
        !(land.met & lineageBit(s.index)),
    )!;
  crops.get(other.cell)!.crop = foreign.index;
  // (And a beast beside it worth more on its land than its own.)
  const field = cropFieldOf(ctx, land.cell),
    best = g.life.species
      .filter((s) => s.niche === "grazer" && s.died === null)
      .sort((a, b) => beastWorth(b, field) - beastWorth(a, field))[0];
  const p = ctx.provinces.get(land.cell)!;
  if (best && p.herding) {
    land.beast = land.first = -1;
    other.beast = best.index;
  }
  let year = 31;
  while ((land.cell + yearOfMoment(simTime(year * YEAR))) % CROP_STEP !== 0) year++;
  exchangeYear(ctx, simTime(year * YEAR));
  assert.ok(land.struck, "pests came");
  assert.ok(pestsLeft(w, land.cell) < 1 && pestsLeft(w, land.cell) >= 1 - BIOTIC.most);
  if (best && p.herding) {
    // (It keeps the best beast it meets, or its own where that is better still, and gives by it against its first.)
    assert.ok(land.beast >= 0);
    assert.ok(
      beastWorth(g.life.species[land.beast]!, field) >=
        beastWorth(best, field) / BIOTIC.better - 1e-9 ||
        land.beast === g.life.herdBeast[land.cell],
    );
    assert.ok(herdGives(w, land.cell) > 0);
  }
});
