// Phase 56: what a world's kind does in the sim. Where nothing burns, no fire is lit by any hand and
// its people climb their kind's own road — a carbon world's diamond grit, pitch-sealed vessels and
// native copper beaten cold; an ice world's vessels and blades of ice — never a kiln, a furnace or
// an engine that burns, and never another kind's road. A sulfur world burns, and smelts as Earth's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type World } from "../../src/kernel/index.ts";
import { ALIEN } from "../../src/host/planet.ts";
import { worldKindOf } from "../../src/gen/index.ts";
import { PRINCIPLES, kindAllows } from "../../src/rules/index.ts";
import { knows, landMaterials, loreOf, populationContext } from "../../src/sim/index.ts";

const byId = new Map(PRINCIPLES.map((p) => [p.id, p]));

/** A world of a seed, run to a year: its kind, its settled lands and what is known anywhere on it. */
function run(seed: string, years: number) {
  const world = ALIEN.build(seedFromText(seed));
  world.runTo(years * YEAR);
  const ctx = populationContext(world),
    lore = loreOf(world),
    lands = ctx.provinces
      .all()
      .filter((p) => p.total() > 0)
      .map((p) => p.cell),
    known = new Set(lands.flatMap((c) => lore.of(c).map(([id]) => id)));
  return { world, ctx, lands, known, kind: worldKindOf(ctx.generated) };
}

/** The first town on a world, for the hand's fire. */
const firstTown = (world: World) => populationContext(world).settlements.all()[0]!.ref;

test("a carbon world: no fire by any hand; diamond, pitch and copper beaten cold, and no furnace", () => {
  const { world, ctx, lands, known, kind } = run("alien 20", 150);
  assert.equal(kind, "carbon");
  assert.equal(ctx.affords.fire, false, "nothing burns in its air, whatever their hands");
  assert.throws(
    () => world.submit("act.fire", { village: firstTown(world) }),
    /nothing burns in its air/,
  );
  for (const id of ["diamond-grit", "pitch-ware", "cold-hammering"])
    assert.ok(known.has(id), `${id} is known by 150 years`);
  assert.ok(
    lands.some((c) => knows(ctx, c, "metalworking")),
    "copper beaten cold brings metal to its lands",
  );
  for (const id of known) {
    const p = byId.get(id)!;
    assert.ok(!p.body?.fire, `${id} wants fire`);
    assert.ok(kindAllows(p, "carbon"), `${id} is another kind's`);
  }
  for (const c of lands.slice(0, 20)) {
    const m = landMaterials(ctx, c);
    assert.ok(m.has("pitch grit") && !m.has("fired clay"), `${c}: ${[...m].join(", ")}`);
  }
});

test("an ice world: vessels and blades of ice, walls of ice, and nothing burned", () => {
  for (const [seed, kind, years] of [
    ["alien 1429", "methane", 400],
    ["alien 428", "ammonia", 300],
  ] as const) {
    const { world, ctx, lands, known, ...r } = run(seed, years);
    assert.equal(r.kind, kind);
    assert.equal(ctx.affords.fire, false);
    assert.throws(
      () => world.submit("act.fire", { village: firstTown(world) }),
      /nothing burns in its air/,
    );
    for (const id of ["ice-ware", "ice-working"])
      assert.ok(known.has(id), `${seed}: ${id} is known by ${years} years`);
    for (const id of known) {
      const p = byId.get(id)!;
      assert.ok(!p.body?.fire, `${seed}: ${id} wants fire`);
      assert.ok(kindAllows(p, kind), `${seed}: ${id} is another kind's`);
    }
    for (const c of lands.slice(0, 20)) {
      const m = landMaterials(ctx, c);
      assert.ok(m.has("ice") && !m.has("fired clay"), `${seed} ${c}: ${[...m].join(", ")}`);
    }
  }
});

test("a sulfur world burns: kilns and smelting, copper of blue vitriol, sulfur concrete, the hand's fire", () => {
  const { world, ctx, lands, known, kind } = run("alien 84", 70);
  assert.equal(kind, "sulfur");
  assert.equal(ctx.affords.fire, true);
  assert.ok(lands.some((c) => knows(ctx, c, "metalworking")));
  for (const id of ["pottery-wheel", "acid-leaching"]) assert.ok(known.has(id), id);
  for (const id of known) assert.ok(kindAllows(byId.get(id)!, "sulfur"), id);
  assert.ok(landMaterials(ctx, lands[0]!).has("sulfur concrete"));
  assert.ok(world.submit("act.fire", { village: firstTown(world) }));
});
