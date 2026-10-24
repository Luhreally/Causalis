import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { populationContext, townsOf } from "../../src/sim/index.ts";
import type { LandPlan, PageModel, Tip } from "../../src/bridge/index.ts";

// Phase 25 M150–M151: a land's towns as the land draws them, each from its fabric, and its
// roads; a town's lots, buildings and walls each a page. Juniper's peopled world at 150 years.

const world = EARTH.build(seedFromText("juniper"));
world.runTo(150 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T,
  ctx = populationContext(world),
  counts = new Map<number, number>();
for (const s of ctx.settlements.all()) counts.set(s.cell, (counts.get(s.cell) ?? 0) + 1);
const busiest = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];

test("a land's towns are drawn from their fabric, the greatest given the most lots, within the setting's", () => {
  const plan = ask<LandPlan>("towns.land", { cell: busiest, most: 3000 }),
    peopled = ctx.settlements.inProvince(busiest).filter((s) => s.population > 0);
  assert.ok(
    plan.towns.length >= peopled.length && peopled.length >= 5,
    `${plan.towns.length} towns`,
  );
  for (const s of peopled) {
    const t = plan.towns.find((x) => x.ref === s.ref);
    assert.ok(t?.plan, `${s.name} drawn from its fabric`);
    assert.equal(t.plan.whole, townsOf(world).get(s.ref)!.next);
    assert.ok(t.plan.lots <= t.plan.whole);
  }
  const drawn = plan.towns.map((t) => t.plan?.lots ?? 0),
    sum = drawn.reduce((a, b) => a + b, 0),
    great = [...plan.towns].sort((a, b) => b.population - a.population)[0]!;
  assert.ok(sum <= 3000 + 240 * plan.towns.length, `${sum} lots drawn`);
  assert.equal(great.plan!.lots, Math.max(...drawn), "the greatest town has the most drawn");
  assert.deepEqual(
    ask<LandPlan>("towns.land", { cell: busiest, most: 3000 }),
    plan,
    "the same asked again",
  );
});

test("a land's roads join every town to one founded before it, and lead out to the lands it trades with", () => {
  const plan = ask<LandPlan>("towns.land", { cell: busiest }),
    refs = new Set(plan.towns.map((t) => t.ref)),
    local = plan.roads.filter((r) => r.b !== null),
    out = plan.roads.filter((r) => r.b === null);
  // A tree over the towns: each town but the first reached, from one founded no later.
  const reached = new Set(local.map((r) => r.b!));
  const first = [...plan.towns].sort(
    (a, b) => a.founded - b.founded || (a.ref < b.ref ? -1 : 1),
  )[0]!;
  for (const t of plan.towns)
    if (t.ref !== first.ref && !plan.towns.some((o) => o.ref !== t.ref && o.tile === t.tile))
      assert.ok(reached.has(t.ref), `${t.name} reached by a road`);
  for (const r of local) {
    assert.ok(refs.has(r.a) && refs.has(r.b!));
    const a = plan.towns.find((t) => t.ref === r.a)!,
      b = plan.towns.find((t) => t.ref === r.b)!;
    assert.ok(a.founded <= b.founded, "from the older town");
    assert.equal(r.since, b.founded, "trodden from the newer town's founding");
  }
  for (const r of out) {
    assert.ok(refs.has(r.a));
    assert.ok(r.since <= Math.floor(world.now / YEAR));
  }
});

test("a town's lots, buildings and walls each have a page, up through the town", () => {
  const great = [...ctx.settlements.all()].sort((a, b) => b.population - a.population)[0]!,
    f = townsOf(world).get(great.ref)!,
    town = ask<PageModel>("page", { ref: great.ref }),
    built = town.tabs.find((t) => t.id === "buildings");
  assert.ok(built, "the town's page has its buildings");
  const list = built.blocks.find((b) => b.type === "list");
  assert.ok(list?.type === "list" && list.items.length >= f.civics.length);
  // A home's lot.
  const home = f.changes.find((c) => c[0] <= 1)!,
    lot = ask<PageModel>("page", { ref: `lot:${great.ref}:${home[1]}` });
  assert.equal(lot.kind, "lot");
  assert.match(
    lot.title,
    new RegExp(`^A (hut|house|townhouse|tenement|block|high-rise) of ${great.name}$`),
  );
  assert.ok(
    lot.crumbs?.some((s) => typeof s !== "string" && s.ref === great.ref),
    "up through its town",
  );
  assert.deepEqual(lot.place, { scale: "village", town: great.ref });
  // One of its other buildings.
  const c = f.civics[0]!,
    b = ask<PageModel>("page", { ref: `bldg:${great.ref}:${c.at}:${c.start}` });
  assert.equal(b.kind, "building");
  assert.ok(b.title.startsWith("The ") && b.title.endsWith(` of ${great.name}`), b.title);
  assert.ok(b.stats.some((s) => s.label === "Begun" && s.value.join("") === `year ${c.start}`));
  const tip = ask<Tip>("tip", { ref: `bldg:${great.ref}:${c.at}:${c.start}` });
  assert.equal(tip.title, b.title);
  // Walls, where a town has them; and what is not there, said so.
  const walled = ctx.settlements.all().find((s) => townsOf(world).get(s.ref)?.walls);
  if (walled) {
    const w = ask<PageModel>("page", { ref: `walls:${walled.ref}` });
    assert.equal(w.kind, "walls");
    assert.ok(w.stats.some((s) => s.label === "Now"));
  }
  assert.equal(ask<PageModel>("page", { ref: `bldg:${great.ref}:999999:0` }).kind, "unknown");
  assert.equal(ask<PageModel>("page", { ref: "lot:nothing" }).kind, "unknown");
  void (great.ref as Ref);
});
