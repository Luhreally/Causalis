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
import {
  HistoryStore,
  POPULATION_EVENTS,
  landSites,
  makePopulationWorld,
  populationContext,
  provinceCapacity,
  support,
} from "../../src/sim/index.ts";
import { spine, why } from "../../src/causal/index.ts";
import { peopledWorld } from "../worlds.ts";

const build = (seed: Seed) => makePopulationWorld(seed);

// One long run shared by the tests that only read it.
const long = peopledWorld("first light", 300);
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
  // Grown, and never past what the lands can feed with the ways they know.
  const feeds = provinces.reduce(
    (s, p) =>
      s + support(provinceCapacity(longCtx, p.cell), p.knowsCultivation, p.herding !== null),
    0,
  );
  assert.ok(total > 1000 && total < feeds, `people ${total} of ${Math.round(feeds)}`);
  assert.ok(provinces.length >= 3, `provinces ${provinces.length}`);
  // Every move ever made: those let go from living memory and those still held.
  assert.ok(longCtx.history.flowOffset + longCtx.history.flows().length > 3, "migrations");
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

test("people who live in a land build in it: no land of settled hundreds is without a village, however poor its ground", () => {
  // (Villages stood only on ground of some soil, so a desert's or a cold shore's people had none for good: first light at year
  // 1,500, 93 of 602 peopled lands, some of four million. And a land with nowhere to build spent a first village's turn each
  // year.) A land with no site at all is one of no ground of its people's medium.
  let peopled = 0,
    bare = 0;
  for (const p of longCtx.provinces.all()) {
    if (!p.knowsCultivation || p.total() < 100) continue;
    peopled++;
    if (longCtx.settlements.inProvince(p.cell).length) continue;
    assert.equal(landSites(longCtx, p.cell).length, 0, `land ${p.cell} has ground and no village`);
    bare++;
  }
  assert.ok(peopled > 10, `${peopled} lands of settled people`);
  // (Lands of this world with no soil that passes the line on any block: a desert of millions by year 1,000, a cold shore.)
  for (const cell of [165, 1516, 3631, 365])
    assert.ok(landSites(longCtx, cell).length > 0, `land ${cell} has somewhere to build`);
  assert.ok(bare <= peopled * 0.01, `${bare} of ${peopled} with no ground at all`);
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
  // While it is within living memory.
  const early = peopledWorld("first light", 40);
  const flow = populationContext(early).history.flows()[0]!,
    node = why(early, flow.event as Ref);
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

test("a land's years are kept yearly for a century, by the decade to a thousand, then by the century", () => {
  const h = new HistoryStore();
  for (let y = 0; y <= 1300; y++) {
    h.addYear(5, { year: y, population: y, byOccupation: [], fed: 1000, settlements: 0 });
    h.seal(y, 20);
  }
  const kept = h.yearsOf(5).map((s) => s.year);
  assert.ok(kept.includes(1250) && kept.includes(1201), "the last century, every year");
  assert.ok(kept.includes(1190) && !kept.includes(1195), "within a thousand years, the decades");
  assert.ok(
    kept.includes(300) && kept.includes(200) && !kept.includes(210),
    "beyond, the centuries",
  );
  // (Thinned once a decade: up to nine more of the latest years.)
  assert.ok(kept.length <= 100 + 9 + 90 + 3, `${kept.length} years kept`);
});
