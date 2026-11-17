// What each land knows of making stuffs (sim/lore/materials.ts): its store is dormant till a land has a row and keeps its
// row whole across a save; a way is open by its tools, heat and what the world holds; what it has made moves its host's
// kit (a tempered edge keener, iron brittle in the cold) and the rust a kit wears by; a switch of crystal waits on purity.
// Built at year 0, never run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Hasher, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { MATERIAL_WAYS, WAY_INDEX } from "../../src/rules/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import {
  MaterialsStore,
  crystalNeed,
  kitGain,
  kitWear,
  materialsOf,
  populationContext,
  waysAt,
  type Making,
} from "../../src/sim/index.ts";

const world = EARTH.build(seedFromText("first light")),
  ctx = populationContext(world),
  peopled = ctx.provinces.all().find((p) => p.total() > 0)!;

const row = (cell: number, ways: readonly string[], purity = 0): Making => ({
  cell,
  made: ways.reduce((m, w) => m | (1 << WAY_INDEX.get(w)!), 0),
  purity,
  year: 1,
  event: null,
  years: MATERIAL_WAYS.map((w) => (ways.includes(w.id) ? 1 : 0)),
});

test("a peopled world keeps its lands' making, dormant until a land has a row", () => {
  const store = materialsOf(world);
  assert.ok(store, "registered");
  assert.equal(store.dormant(), true);
  assert.ok(peopled, "a peopled land");
});

test("a land's row comes back whole from a save, and its digest goes on from where it stood", () => {
  const a = new MaterialsStore();
  a.set(row(3, ["quench-hardening", "tempering"], 412));
  a.set(row(7, ["lime-mortar"]));
  const b = new MaterialsStore();
  b.load(JSON.parse(JSON.stringify(a.save())));
  assert.deepEqual(b.all(), a.all());
  const h = (s: MaterialsStore) => {
    const x = new Hasher();
    s.hashInto(x);
    return x.hex();
  };
  assert.equal(h(a), h(b));
  assert.equal(b.made(3, "tempering"), true);
  assert.equal(b.made(7, "tempering"), false);
  assert.equal(b.purity(3), 4.12);
  a.set(row(7, ["lime-mortar", "hydraulic-cement"]));
  assert.notEqual(h(a), h(b));
});

test("a land's open ways are those its tools and heat reach; the rest say what shuts them", () => {
  const { open, shut } = waysAt(ctx, peopled.cell);
  // (At the first year a land knows neither iron nor electronics.)
  assert.ok(!open.some(([w]) => w.id === "quench-hardening"));
  const crystal = shut.find(([w]) => w.id === "pure-crystal");
  assert.ok(crystal && /electronics/.test(crystal[1]), crystal?.[1]);
  for (const [, why] of shut) assert.ok(why.length > 0);
});

test("what a seat has made moves its host's kit: tempered iron keener than plain, nothing on bronze", () => {
  const store = materialsOf(world)!,
    cell = peopled.cell;
  assert.equal(kitGain(ctx, cell, "iron", "iron"), 1, "nothing made: as the tables have it");
  store.set(row(cell, ["quench-hardening", "tempering"]));
  assert.ok(kitGain(ctx, cell, "iron", "iron") > 1);
  assert.equal(kitGain(ctx, cell, "bronze", "bronze"), 1);
  // (A stuff of its world's own, not the tables' metal, is not moved by a treatment.)
  assert.equal(kitGain(ctx, cell, "iron", "bog iron"), 1);
});

test("rust is a share of a kit's wear: bronze wears slower than iron under Earth's air", () => {
  assert.equal(Math.round(kitWear(ctx, "iron") * 1000) / 1000, 1);
  assert.ok(kitWear(ctx, "bronze") < kitWear(ctx, "iron"));
  assert.ok(kitWear(ctx, "steel") <= 1);
});

test("a switch of crystal waits on its land's purity", () => {
  const store = materialsOf(world)!,
    cell = peopled.cell,
    need = crystalNeed(ctx);
  assert.ok(need, "Earth's crystal switches a current");
  assert.ok(need.nines > 9 && need.nines < 11, `${need.nines}`);
  // (A land that could not yet make its crystal pure is not held back by it: its world's reading decides.)
  store.set(row(cell, [], 400));
  assert.equal(store.allows(ctx, cell, "solid-state"), true);
  // (One that has come to melting it clean waits on its practice.)
  store.set(row(cell, ["pure-crystal"], 400));
  assert.equal(store.allows(ctx, cell, "solid-state"), false);
  assert.equal(store.allows(ctx, cell, "computing"), true);
  store.set(row(cell, ["pure-crystal"], Math.ceil(need.nines * 100)));
  assert.equal(store.allows(ctx, cell, "solid-state"), true);
  // (A pinned row's event keeps its place in history.)
  store.set({ ...row(cell, []), event: "evt:1" as Ref });
  assert.ok(store.pinned().includes("evt:1" as Ref));
});

test("a land with metalworking gets its row in its turn, and its pages read it", async () => {
  const { materialsYear } = await import("../../src/sim/lore/materials.ts");
  const { landMakingBlocks, materialTab, atomBlocks } =
    await import("../../src/host/inspect/making.ts");
  const { YEAR, simTime, yearOfMoment } = await import("../../src/kernel/index.ts");
  const { MarketStore: _m } = await import("../../src/sim/economy/market.ts");
  const fresh = EARTH.build(seedFromText("first light")),
    c = populationContext(fresh),
    land = c.provinces.all().find((p) => p.total() > 0)!,
    markets = fresh.store<InstanceType<typeof _m>>("economy.markets");
  markets.of(land.cell).metalworking = "evt:0" as Ref;
  // (Its turn: the first year whose number, with its cell's, is a fifth's.)
  let k = 1;
  while ((land.cell + yearOfMoment(fresh.now + k * YEAR)) % 5 !== 0) k++;
  materialsYear(c, simTime(fresh.now + k * YEAR));
  const made = materialsOf(fresh)!.get(land.cell);
  assert.ok(made, "a row in its turn");
  assert.ok(made.purity > 0, "its smelters refine a little");
  assert.ok(landMakingBlocks(fresh, land.cell).length > 0);
  assert.ok(materialTab(fresh, "steel").length >= 2);
  assert.equal(materialTab(fresh, "water").length, 0);
  assert.ok(materialTab(fresh, "silicon").length >= 1);
  assert.ok(atomBlocks(fresh, "Fe").length === 2);
});
