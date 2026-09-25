import { test } from "node:test";
import assert from "node:assert/strict";
import {
  YEAR,
  loadWorld,
  rulesetId,
  saveWorld,
  seedFromText,
  type Ref,
  type Seed,
} from "../../src/kernel/index.ts";
import { OCC } from "../../src/rules/index.ts";
import { POPULATION_EVENTS, makePopulationWorld, populationContext } from "../../src/sim/index.ts";
import { spine, why } from "../../src/causal/index.ts";

const build = (seed: Seed) => makePopulationWorld(seed);

// One long run shared by the tests that only read it.
const long = makePopulationWorld(seedFromText("first light"));
long.runTo(300 * YEAR);
const longCtx = populationContext(long);

test("people are conserved: each year's change is its births less its deaths", () => {
  const w = makePopulationWorld(seedFromText("conserve")),
    ctx = populationContext(w);
  let previous = ctx.provinces.total();
  for (let y = 1; y <= 80; y++) {
    w.runTo(y * YEAR);
    let births = 0,
      deaths = 0;
    for (const p of ctx.provinces.all()) {
      births += ctx.history.birthsIn(p.cell, y - 1);
      deaths += ctx.history.deathsIn(p.cell, y - 1);
      for (let r = 0; r < 20; r++)
        for (let o = 0; o < 7; o++) {
          const n = p.counts.get(r, o);
          assert.ok(Number.isInteger(n) && n >= 0);
        }
    }
    const now = ctx.provinces.total();
    assert.equal(now - previous, births - deaths, `year ${y}`);
    previous = now;
  }
});

test("births are girls and boys in about equal numbers", () => {
  let girls = 0,
    all = 0;
  for (const p of longCtx.provinces.all()) {
    girls += p.counts.get(0, OCC.dependent) + p.counts.get(1, OCC.dependent);
    all +=
      p.counts.get(0, OCC.dependent) +
      p.counts.get(1, OCC.dependent) +
      p.counts.get(10, OCC.dependent) +
      p.counts.get(11, OCC.dependent);
  }
  assert.ok(all > 500, `children ${all}`);
  assert.ok(girls / all > 0.44 && girls / all < 0.54, `girls ${girls / all}`);
});

test("a people grows, spreads, learns to farm and founds villages", () => {
  const total = longCtx.provinces.total(),
    provinces = longCtx.provinces.all();
  assert.ok(total > 1000 && total < 100_000, `people ${total}`);
  assert.ok(provinces.length >= 3, `provinces ${provinces.length}`);
  assert.ok(longCtx.history.flows().length > 3, "migrations");
  const types = new Set(long.events.all().map((e) => e.type));
  assert.ok(types.has(POPULATION_EVENTS.cultivation.type), "cultivation discovered");
  assert.ok(longCtx.settlements.all().length > 5, "villages");
  // Flows conserve: whoever left one province arrived in another.
  for (const f of longCtx.history.flows())
    assert.equal(
      f.byOccupation.reduce((a, b) => a + b, 0),
      f.count,
    );
});

test("a village explains itself back to the first people", () => {
  const village = longCtx.settlements.all()[0]!;
  const founding = why(long, village.event);
  assert.equal(founding.basis, "recorded");
  assert.match(founding.claim, new RegExp(`^${village.name} was founded in the `));
  const decision = founding.causes[0]!.next();
  assert.match(decision.claim, /chose a site for a village, in year \d+ \(.*good ground and water/);
  const farming = decision.causes.find((c) => c.cause.ref.startsWith("ev:"))!.next();
  assert.match(farming.claim, /^(The first fields were sown|Farming came to) /);
  const path = spine(long, village.event);
  assert.ok(path.length >= 4, `path ${path.map((e) => e.ref).join(" ← ")}`);
});

test("a migration explains itself through its decision", () => {
  const flow = longCtx.history.flows()[0]!,
    node = why(long, flow.event as Ref);
  const decision = node.causes[0]!.next();
  assert.match(decision.claim, /chose to move on, in year \d+ \(/);
  assert.match(node.claim, /set out from the .* for the /);
  assert.ok(
    decision.causes.some((c) => c.cause.role === "enabler"),
    "better land beckoned",
  );
});

test("the same seed makes the same history, and a save continues it exactly", () => {
  const a = makePopulationWorld(seedFromText("again")),
    b = makePopulationWorld(seedFromText("again"));
  a.runTo(60 * YEAR);
  b.runTo(60 * YEAR);
  assert.deepEqual(
    a.checkpoints().map((c) => c.chain),
    b.checkpoints().map((c) => c.chain),
  );
  const ruleset = rulesetId(a, "test"),
    doc = JSON.parse(JSON.stringify(saveWorld(a, ruleset)));
  const { world: c } = loadWorld(doc, build, ruleset);
  a.runTo(90 * YEAR);
  c.runTo(90 * YEAR);
  assert.deepEqual(
    c.checkpoints().map((x) => x.chain),
    a.checkpoints().map((x) => x.chain),
  );
});
