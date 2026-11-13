import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { ALIEN } from "../../src/host/planet.ts";
import { folksNear, politiesOf, populationContext } from "../../src/sim/index.ts";
import { pageOf } from "../../src/host/inspect/index.ts";

// A page's art (asked 2026-11-13), read on a carbon world under a white star: its world's kind and star on every page, and a land's,
// a town's and a realm's banner each of what it is.
const world = ALIEN.build(seedFromText("alien 20"));
world.runTo(160 * YEAR);
const realm = politiesOf(world)
  .living()
  .sort((a, b) => b.members.length - a.members.length || (a.ref < b.ref ? -1 : 1))[0]!;

test("a land's banner runs its ground through it, its stretches each a biome", () => {
  const p = pageOf(world, `cell:0:${realm.seat}`);
  assert.equal(p.art?.world.kind, "carbon");
  assert.ok((p.art?.world.star ?? 0) > 6000);
  const b = p.art?.banner;
  assert.equal(b?.kind, "land");
  if (b?.kind !== "land") return;
  assert.equal(b.heights.length, 17);
  assert.equal(b.biomes.length, 17);
  for (const h of b.heights) assert.ok(Number.isFinite(h));
  for (const x of b.biomes) assert.ok(x >= 0 && x < 17);
  assert.ok(b.woods >= 0 && b.woods <= 1);
});

test("a town's banner is its homes by level and its buildings; a realm's its lands", () => {
  const town = populationContext(world).settlements.seenIn(realm.seat)[0]!,
    t = pageOf(world, town.ref).art?.banner,
    r = pageOf(world, realm.ref).art?.banner;
  assert.equal(t?.kind, "town");
  if (t?.kind === "town") assert.ok(t.levels.reduce((s, v) => s + v, 0) > 0);
  assert.equal(r?.kind, "realm");
  if (r?.kind === "realm") {
    assert.equal(r.lands.length % 2, 0);
    assert.ok(r.lands.length >= 2);
    for (const v of r.lands) assert.ok(v >= -1 && v <= 1001, `${v}`);
  }
});

test("a page asked only for its name carries no art", () => {
  assert.equal(pageOf(world, realm.ref, undefined, true).art, undefined);
});

test("what a land knows is drawn as the thing it makes there, each a shape the pictures draw", async () => {
  const { hasShape } = await import("../../src/ui/specimen.ts");
  const { loreLook } = await import("../../src/host/inspect/ware-looks.ts");
  const lore = pageOf(world, `cell:0:${realm.seat}`).tabs.find((t) => t.id === "lore");
  const items = lore?.blocks.flatMap((b) => (b.type === "list" ? b.items : [])) ?? [];
  assert.ok(
    items.some((i) => i.thumb),
    "no lore row drawn",
  );
  // (Every knowing that names a thing names one the pictures have a shape for.)
  for (const id of [
    "cultivation",
    "metalworking",
    "plough",
    "carpentry",
    "loom",
    "tanning",
    "pottery-wheel",
    "steam-engine",
    "railways",
    "radio",
    "computing",
    "engines",
    "wings",
  ]) {
    const p = loreLook(world, realm.seat, id);
    assert.ok(p, id);
    if (p?.kind === "thing") assert.ok(hasShape(p.form), `${id}: ${p.form}`);
  }
  assert.equal(loreLook(world, realm.seat, "writing"), null);
});

test("how a land builds is drawn of the house its towns raise, and its works of their design", async () => {
  const { homeLook, worksLook } = await import("../../src/host/inspect/art.ts");
  const { landHouse } = await import("../../src/host/village.ts");
  const { houseSolids, worksSolids } = await import("../../src/ui/buildings.ts");
  const h = homeLook(world, realm.seat);
  assert.equal(h?.kind, "house");
  if (h?.kind !== "house") return;
  // (The same plan the town in 3D is built of.)
  assert.deepEqual(h.house, landHouse(world, realm.seat));
  assert.ok(h.storeys >= 1);
  assert.ok(houseSolids(h).length >= 3);
  const court = houseSolids({
    ...h,
    house: { ...h.house, form: "court", walls: "brick", roof: "tile" },
  });
  assert.ok(
    court.length >
      houseSolids({ ...h, house: { ...h.house, form: "long", walls: "brick", roof: "tile" } })
        .length,
  );
  const w = worksLook(world, realm.seat);
  if (w?.kind === "works") {
    const mill = worksSolids({ ...w, hall: "mill-house", drive: "wheel-and-sail" }, 0),
      bare = worksSolids({ ...w, hall: "mill-house", drive: "hands" }, 0);
    assert.ok(mill.length > bare.length);
  }
});

test("what lives in a land is drawn beside its name", () => {
  const life = pageOf(world, `cell:0:${realm.seat}`).tabs.find((t) => t.id === "life");
  const items =
    life?.blocks.flatMap((b) =>
      b.type === "list" && b.title === "What lives here" ? b.items : [],
    ) ?? [];
  for (const i of items)
    assert.ok(
      i.thumb && (i.thumb.kind === "creature" || i.thumb.kind === "plant"),
      JSON.stringify(i.line),
    );
});

test("a far people's banner stands them on land of their warmth and rain, under their own star", () => {
  const folks = folksNear(world);
  assert.ok(folks.length > 0);
  for (const f of folks) {
    const p = pageOf(world, f.ref),
      b = p.art?.banner;
    assert.equal(b?.kind, "people", f.ref);
    if (b?.kind !== "people") continue;
    const folk = p.portrait?.kind === "person" ? p.portrait.body?.folk : null;
    assert.ok(folk);
    assert.equal(b.star, folk.star);
    // (Never a sea's or sea ice's colour under their feet: their ground is land, by its warmth and rain.)
    assert.ok(b.biome >= 4 && b.biome <= 15, `${f.ref}: biome ${b.biome}`);
    assert.equal(b.look, folk.lifeLook);
  }
});
