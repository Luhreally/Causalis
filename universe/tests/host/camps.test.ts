import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { WATER } from "../../src/gen/index.ts";
import { OCC } from "../../src/rules/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { populationContext, provinceOfTile, regionOf } from "../../src/sim/index.ts";
import { campWords } from "../../src/view/index.ts";
import type { LandCamp, LandPlan, PageModel } from "../../src/bridge/index.ts";

// Phase 28 M159: a land's bands camped on it — its people who forage or herd, in no village,
// ranging about its good sites and camped this season near one. The Earth seed in its first year.

const world = EARTH.build(seedFromText("first light"));
world.runTo(YEAR / 8);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T,
  ctx = populationContext(world),
  most = [...ctx.provinces.all()].sort((a, b) => b.total() - a.total() || a.cell - b.cell)[0]!,
  cell = most.cell;

test("a land's foragers are camped about it in bands, on its dry ground, their ranges apart", () => {
  const plan = ask<LandPlan>("towns.land", { cell }),
    r = regionOf(ctx, cell),
    size = r.size;
  assert.equal(plan.towns.length, 0, "no village yet");
  assert.ok(plan.camps.length >= 3, `${plan.camps.length} camps`);
  for (const c of plan.camps) {
    assert.equal(r.water[c.tile], WATER.land, `camp ${c.id} on dry ground`);
    assert.equal(provinceOfTile(ctx, r, c.tile), cell, `camp ${c.id} in its land`);
    const di = (c.tile % size) - (c.home % size),
      dj = Math.floor(c.tile / size) - Math.floor(c.home / size);
    assert.ok(Math.abs(di) <= 3 && Math.abs(dj) <= 3, `camp ${c.id} within its range`);
    assert.ok(c.people > 0 && c.bands >= 1 && !c.herds);
  }
  for (const a of plan.camps)
    for (const b of plan.camps)
      if (a.id < b.id) {
        const di = (a.home % size) - (b.home % size),
          dj = Math.floor(a.home / size) - Math.floor(b.home / size);
        assert.ok(di * di + dj * dj >= 36, `ranges ${a.id} and ${b.id} apart`);
      }
  // As many as forage, with their children.
  const people = plan.camps.reduce((n, c) => n + c.people, 0),
    foragers = most.occupation(OCC.forager);
  assert.ok(people >= foragers && people <= most.total() + plan.camps.length, `${people} in camps`);
  assert.deepEqual(ask<LandPlan>("towns.land", { cell }), plan, "the same asked again");
});

test("as the seasons turn the bands move camp about their ranges", () => {
  const before = ask<LandPlan>("towns.land", { cell }).camps,
    at = world.now;
  world.runTo(at + YEAR / 4);
  const after = ask<LandPlan>("towns.land", { cell }).camps;
  assert.deepEqual(
    after.map((c) => c.home),
    before.map((c) => c.home),
    "the same ranges",
  );
  assert.ok(
    after.some((c, i) => c.tile !== before[i]!.tile),
    "some camp moved with the season",
  );
});

test("a camp's name on the land: its bands, whether they herd, how many they are", () => {
  const camp = (bands: number, herds: boolean, people: number): LandCamp => ({
    id: 0,
    tile: 0,
    home: 0,
    people,
    bands,
    herds,
  });
  assert.equal(campWords(camp(1, false, 28)), "⛺ a band · 28");
  assert.equal(campWords(camp(3, false, 94)), "⛺ 3 bands · 94");
  assert.equal(campWords(camp(1, true, 40)), "🐑 a band of herders · 40");
});

test("a camp's page: who they are, how they live, how far they range, and the land's other camps", () => {
  const plan = ask<LandPlan>("towns.land", { cell }),
    camp = plan.camps[0]!,
    page = ask<PageModel>("page", { ref: `camp:${cell}:${camp.id}` }),
    words = JSON.stringify(page);
  assert.equal(page.kind, "camp");
  assert.match(page.title, /^(A band|\d+ bands) of (foragers|herders)$/);
  assert.deepEqual(page.place, { scale: "region", cell, tile: camp.tile });
  assert.ok(
    page.stats.some((s) => s.label === "People"),
    "its people counted",
  );
  assert.match(words, /km across/, "its range");
  assert.match(words, /farm/, "whether its land farms");
  const others = page.tabs[0]!.blocks.find((b) => b.type === "list");
  assert.ok(others && others.type === "list" && others.items.length === plan.camps.length - 1);
  // A camp no longer there: told so, not thrown.
  const gone = ask<PageModel>("page", { ref: `camp:${cell}:99` });
  assert.equal(gone.kind, "camp");
  assert.equal(gone.place, null);
});
