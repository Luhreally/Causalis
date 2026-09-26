import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { cradleTongue, tongueLikeness } from "../../src/gen/index.ts";
import {
  POPULATION_EVENTS,
  WAY,
  cultureOf,
  makePopulationWorld,
  populationContext,
} from "../../src/sim/index.ts";
import { waysRef, why } from "../../src/causal/index.ts";

const seed = seedFromText("first light"),
  HOME = 30210;

/** Steps over peopled land from a cell to every other. */
function steps(world: ReturnType<typeof makePopulationWorld>, from: number): Map<number, number> {
  const ctx = populationContext(world),
    g = ctx.generated,
    d = new Map([[from, 0]]),
    queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i]!;
    for (let k = g.grid.offsets[c]!; k < g.grid.offsets[c + 1]!; k++) {
      const n = g.grid.neighbours[k]!;
      if (!d.has(n) && ctx.provinces.get(n)) {
        d.set(n, d.get(c)! + 1);
        queue.push(n);
      }
    }
  }
  return d;
}

test("the further the bands went before the chronicle, the further their speech drifted", () => {
  const world = makePopulationWorld(seed, { start: "spread" }),
    ctx = populationContext(world),
    cradle = cradleTongue(ctx.culture),
    d = steps(world, HOME),
    byRing = new Map<number, number[]>();
  for (const w of cultureOf(world).all()) {
    const ring = d.get(w.cell)!;
    byRing.set(ring, [...(byRing.get(ring) ?? []), tongueLikeness(w.tongue, cradle)]);
  }
  const mean = (r: number) => byRing.get(r)!.reduce((a, b) => a + b, 0) / byRing.get(r)!.length;
  assert.equal(mean(0), 1, "the cradle speaks as the first people did");
  assert.ok(mean(1) > mean(4), `near ${mean(1).toFixed(2)}, far ${mean(4).toFixed(2)}`);
});

test("after centuries, neighbours still speak alike and far lands apart", () => {
  const world = makePopulationWorld(seed, { start: "spread" });
  world.runTo(200 * YEAR);
  const culture = cultureOf(world),
    all = culture.all(),
    near: number[] = [],
    far: number[] = [];
  for (const a of all) {
    const d = steps(world, a.cell);
    for (const b of all)
      if (b.cell > a.cell) {
        const like = tongueLikeness(a.tongue, b.tongue),
          apart = d.get(b.cell) ?? 99;
        if (apart === 1) near.push(like);
        else if (apart >= 5) far.push(like);
      }
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  assert.ok(near.length > 20 && far.length > 20);
  assert.ok(
    mean(near) > mean(far) + 0.03,
    `neighbours ${mean(near).toFixed(3)}, far ${mean(far).toFixed(3)}`,
  );
});

test("famine teaches thrift, and the people's ways say which famine", () => {
  const world = makePopulationWorld(seed);
  world.runTo(120 * YEAR);
  const before = cultureOf(world).get(HOME)!.traits[WAY.thrift]!;
  world.submit("act.rain", { cell: HOME, sign: -1, years: 5 });
  world.runTo(127 * YEAR);
  const w = cultureOf(world).get(HOME)!;
  assert.ok(
    w.traits[WAY.thrift]! > before + 0.05,
    `thrift ${before.toFixed(2)} → ${w.traits[WAY.thrift]!.toFixed(2)}`,
  );
  const node = why(world, waysRef(HOME)),
    cited = node.causes.map((c) => world.events.get(c.cause.ref)?.type);
  assert.ok(cited.includes(POPULATION_EVENTS.famine.type), `cites ${cited.join(", ")}`);
  assert.match(node.claim, /save against hard times/);
});

test("the god's acts deepen devotion where they fall", () => {
  const world = makePopulationWorld(seed);
  world.runTo(60 * YEAR);
  const before = cultureOf(world).get(HOME)!.traits[WAY.piety]!;
  world.submit("act.plague", { cell: HOME, sign: -1, years: 1 });
  world.runTo(62 * YEAR);
  assert.ok(cultureOf(world).get(HOME)!.traits[WAY.piety]! > before + 0.06);
});

test("a land newly peopled takes the ways of those who came", () => {
  const world = makePopulationWorld(seed);
  world.runTo(240 * YEAR);
  const ctx = populationContext(world),
    culture = cultureOf(world);
  const settled = ctx.provinces.all().filter((p) => p.settledYear > 0);
  assert.ok(settled.length > 0);
  for (const p of settled) {
    const w = culture.get(p.cell)!,
      flow = ctx.history.flows().find((f) => f.to === p.cell && f.event === p.arrival)!;
    assert.equal(w.from, p.arrival, "their ways came with the move that peopled the land");
    assert.ok(
      tongueLikeness(w.tongue, culture.get(flow.from)!.tongue) > 0.8,
      "and their speech with them",
    );
  }
});
