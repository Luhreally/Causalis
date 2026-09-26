import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import {
  POPULATION_EVENTS,
  SPREAD,
  homePlanet,
  makePopulationWorld,
  populationContext,
} from "../../src/sim/index.ts";
import { folkRef, spine, why } from "../../src/causal/index.ts";

for (const name of ["first light", "kestrel", "amber"]) {
  test(`${name}: the chronicle opens on bands spread across the land, each land's people answering to the cradle`, () => {
    const world = makePopulationWorld(seedFromText(name), { start: "spread" }),
      ctx = populationContext(world),
      all = ctx.provinces.all(),
      g = ctx.generated;
    assert.ok(all.length >= 10, `${all.length} lands peopled`);
    // Every peopled land is reached from the cradle over land in at most SPREAD.rings steps.
    const home = world.events.all().find((e) => e.type === POPULATION_EVENTS.origin.type)!.place!,
      origin = Number(home.split(":")[2]),
      reach = new Map([[origin, 0]]),
      queue = [origin];
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i]!;
      for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
        const n = g.grid.neighbours[k]!;
        if (!reach.has(n) && ctx.provinces.get(n)) {
          reach.set(n, reach.get(c)! + 1);
          queue.push(n);
        }
      }
    }
    for (const p of all) {
      assert.ok((reach.get(p.cell) ?? 99) <= SPREAD.rings, `${p.cell} is joined to the cradle`);
      assert.ok(p.total() >= SPREAD.least && p.occupation(1) > 0, "a foraging band lives there");
    }
    // Why a far land is peopled: the spread, the first people, their choice, the land, the star.
    // The farthest land the bands reached.
    const farthest = Math.max(...all.map((p) => reach.get(p.cell) ?? 0)),
      far = all.find((p) => reach.get(p.cell) === farthest)!,
      node = why(world, folkRef(far.cell));
    const path = spine(world, folkRef(far.cell)).map((n) => n.claim);
    assert.match(
      path[1]!,
      /^In the ages before the chronicle, the people spread from the .* across [\d,]+ lands/,
    );
    assert.equal(spine(world, folkRef(far.cell)).at(-1)!.ref.split(":")[0], "star");
    assert.equal(node.basis, "recorded");
  });
}

test("farming is found and spreads across the peopled land; villages follow", () => {
  const world = makePopulationWorld(seedFromText("first light"), { start: "spread" }),
    ctx = populationContext(world);
  world.runTo(100 * YEAR);
  const all = ctx.provinces.all(),
    farming = all.filter((p) => p.knowsCultivation),
    g = homePlanet(world).generated;
  assert.ok(farming.length >= 0.6 * all.length, `${farming.length} of ${all.length} farm`);
  // Sowing spreads over the land that joins its finders: after decades, hardly a land that
  // borders farmers has not learned it (lands across the sea must find it again).
  const bordering = all.filter(
    (p) =>
      !p.knowsCultivation &&
      p.total() >= 10 &&
      [...g.grid.neighbours.subarray(g.grid.offsets[p.cell]!, g.grid.offsets[p.cell + 1]!)].some(
        (n) => ctx.provinces.get(n)?.knowsCultivation,
      ),
  );
  assert.ok(
    bordering.length <= 0.05 * all.length,
    `${bordering.length} lands beside farmers do not farm`,
  );
  const found = world.events.all().filter((e) => e.type === POPULATION_EVENTS.cultivation.type),
    learned = world.events.all().filter((e) => e.type === POPULATION_EVENTS.cultivationSpread.type);
  assert.ok(
    found.length >= 1 && learned.length >= found.length,
    "found once or a few times, learned widely",
  );
  assert.ok(ctx.settlements.all().length >= all.length, "villages across the land");
});

test("a land's year costs about the same however many lands there are", () => {
  const cost = (start: "cradle" | "spread") => {
    const world = makePopulationWorld(seedFromText("first light"), { start });
    world.runTo(150 * YEAR);
    const t0 = performance.now();
    world.runTo(200 * YEAR);
    return (performance.now() - t0) / 50 / populationContext(world).provinces.all().length;
  };
  const one = cost("cradle"),
    many = cost("spread");
  assert.ok(
    many < Math.max(one * 4, 0.5),
    `${many.toFixed(3)} ms a land-year spread, ${one.toFixed(3)} cradled`,
  );
});
