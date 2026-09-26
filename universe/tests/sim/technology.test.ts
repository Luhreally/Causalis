import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type World } from "../../src/kernel/index.ts";
import { cellRef, surfaceOre } from "../../src/gen/index.ts";
import { G, PRINCIPLES, affordsPrinciple, designWords, principle } from "../../src/rules/index.ts";
import { ALIEN, EARTH } from "../../src/host/planet.ts";
import {
  ECONOMY_EVENTS,
  LORE_EVENTS,
  designsOf,
  homePlanet,
  loreOf,
  marketsOf,
  populationContext,
} from "../../src/sim/index.ts";

/** Teach a land principles outright (a fixture: the tree takes centuries to reach them). */
function teach(world: World, cell: number, ids: string[]): void {
  const lore = loreOf(world);
  for (const id of ids) {
    if (lore.get(cell, id)) continue;
    const event = world.events.emit({
      type: LORE_EVENTS.found.type,
      place: cellRef(0, cell),
      data: { principle: id },
    });
    lore.learn(cell, id, { year: Math.floor(world.now / YEAR), event }, principle(id));
  }
}

test("what a people can come to know is what its body allows", () => {
  const sea = PRINCIPLES.filter((p) => affordsPrinciple(p, "water", false)).map((p) => p.id),
    land = PRINCIPLES.filter((p) => affordsPrinciple(p, "land", true)).map((p) => p.id);
  // No kilns, smelting or burned fuel without fire; no wheels, sails or bows in the water.
  for (const id of [
    "pottery-wheel",
    "bronze",
    "iron",
    "steam-engine",
    "wheel",
    "sailing",
    "archery",
  ])
    assert.ok(!sea.includes(id), id);
  // The sea's own road, closed to the land.
  for (const id of ["vent-working", "electrochemistry", "current-mills", "sea-works"]) {
    assert.ok(sea.includes(id), id);
    assert.ok(!land.includes(id), id);
  }
  // Writing, reckoning and law are for any people.
  for (const id of ["writing", "mathematics", "law-codes"])
    assert.ok(sea.includes(id) && land.includes(id));
});

test("a people of the water comes to metal by the vents, and its invention takes its own order", () => {
  const world = ALIEN.build(seedFromText("alien 55")),
    ctx = populationContext(world),
    lore = loreOf(world);
  assert.equal(ctx.medium, "water");
  world.runTo(120 * YEAR);
  const known = new Set<string>();
  for (const p of ctx.provinces.all()) for (const [id] of lore.of(p.cell)) known.add(id);
  assert.ok(known.has("vent-working") && known.has("shell-craft"), [...known].join(", "));
  for (const id of known) assert.ok(affordsPrinciple(principle(id), "water", false), id);
  // Vent metal is their metalworking: the market of a land that works it says so.
  const worker = ctx.provinces.all().find((p) => lore.get(p.cell, "vent-working"))!;
  assert.ok(marketsOf(world).get(worker.cell)!.metalworking);
  // On Earth the apes never take the sea's road.
  const earth = EARTH.build(seedFromText("first light"));
  earth.runTo(60 * YEAR);
  const earthLore = loreOf(earth);
  for (const p of populationContext(earth).provinces.all())
    assert.ok(!earthLore.get(p.cell, "vent-working"));
});

test("a people of the water reaches industry without fire: works turned by the tides make machines", () => {
  const world = ALIEN.build(seedFromText("alien 55")),
    ctx = populationContext(world),
    g = homePlanet(world).generated;
  world.runTo(100 * YEAR);
  const land = [...ctx.provinces.all()]
    .filter((p) => surfaceOre(g, p.cell, "vent") && ctx.settlements.inProvince(p.cell).length)
    .sort((a, b) => b.total() - a.total() || a.cell - b.cell)[0]!;
  teach(world, land.cell, [
    "calendar",
    "writing",
    "mathematics",
    "vent-working",
    "currency",
    "banking",
    "electrochemistry",
    "refined-metals",
    "current-mills",
    "sea-works",
  ]);
  marketsOf(world).of(land.cell).metalworking ??= loreOf(world).get(
    land.cell,
    "vent-working",
  )!.event;
  world.runTo(125 * YEAR);
  const m = marketsOf(world).get(land.cell)!,
    last = m.years.at(-1)!.ledger;
  assert.ok(last[0]![G.machines]! > 0, "machines made");
  assert.equal(last[1]![G.coal]! + last[1]![G.oil]!, 0, "no fuel burned");
  assert.ok(m.powerCover > 0, "their engines turn");
  assert.ok(m.works, "the first machines are history");
  const works = world.events.get(m.works)!;
  assert.equal(works.type, ECONOMY_EVENTS.works.type);
  assert.ok(
    works.causes.some((c) => world.events.get(c.ref as never)?.type === LORE_EVENTS.found.type),
  );
  const design = designsOf(world).worksOf(land.ref);
  assert.ok(
    design && /tides/.test(designWords(design.parts)),
    design ? designWords(design.parts) : "no works",
  );
});
