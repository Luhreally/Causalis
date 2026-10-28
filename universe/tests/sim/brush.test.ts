import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Hasher,
  YEAR,
  loadWorld,
  saveWorld,
  rulesetId,
  seedFromText,
  verifyByReplay,
} from "../../src/kernel/index.ts";
import { brushCells, type BrushArgs } from "../../src/rules/index.ts";
import {
  brushPreview,
  homePlanet,
  makePopulationWorld,
  populationContext,
  politiesOf,
} from "../../src/sim/index.ts";
import { regionOf } from "../../src/sim/population/systems.ts";

const seed = seedFromText("first light"),
  build = () => makePopulationWorld(seed, { frequency: 12, start: "spread" });
const apply = (w: ReturnType<typeof build>, args: BrushArgs) =>
  w.runTo(w.submit("act.brush", args).t);
const stroke = (cell: number, kind: BrushArgs["kind"] = "raise"): BrushArgs => ({
  kind,
  cells: [cell],
  radius: 0,
  strength: 1,
});

test("an untouched planet keeps its old hash and empty deviations, including after loading an old save", () => {
  const w = build(),
    h = homePlanet(w),
    expected = new Hasher().string(h.prior.name).string(h.generated.digest),
    got = new Hasher();
  h.hashInto(got);
  assert.equal(got.hex(), expected.hex());
  assert.deepEqual(h.save(), { prior: h.prior.name, digest: h.generated.digest, deviations: [] });
  assert.equal(h.surfaceKey, h.generated.digest);
  h.load({ prior: h.prior.name, digest: h.generated.digest });
  assert.equal(h.surfaceKey, h.generated.digest);
});

test("brush reach is sorted, independent of sample order, and refuses an oversized union", () => {
  const g = homePlanet(build()).generated.fine.grid;
  assert.deepEqual(brushCells(g, [7, 1, 7], 2), brushCells(g, [1, 7], 2));
  assert.ok(brushCells(g, [7], 1).length >= 6);
  assert.throws(
    () =>
      brushCells(
        g,
        Array.from({ length: 64 }, (_, i) => i * 20),
        3,
      ),
    /Stroke too large/,
  );
});

test("terrain and ore survive saves and replay; loading an older world restores exact arrays and caches", () => {
  const w = build(),
    h = homePlanet(w),
    g = h.generated,
    ctx = populationContext(w),
    province = ctx.provinces.all()[0]!.cell,
    cell = g.centre[province]!,
    elevation = g.fine.tectonics.elevation[cell]!,
    oldKey = h.surfaceKey,
    original = h.save(),
    fineDigest = g.fine.digest,
    ruleset = rulesetId(w, "brush-test"),
    old = saveWorld(w, ruleset),
    beforeRegion = regionOf(ctx, province),
    coarse = structuredClone({
      e: g.tectonics.elevation,
      t: g.climate.temperature,
      rain: g.climate.precipitation,
      biome: g.climate.biome,
      centre: g.centre,
    });
  apply(w, stroke(cell));
  assert.equal(g.fine.tectonics.elevation[cell], Math.fround(elevation + 250));
  assert.notEqual(h.surfaceKey, oldKey);
  assert.notEqual(regionOf(ctx, province), beforeRegion);
  assert.equal(g.fine.digest, fineDigest, "generation and random keys are unchanged");
  const first = g.fine.grid.count - 1,
    second = 0,
    base = g.fine.deposits.length;
  apply(w, { ...stroke(first, "ore"), ore: "iron" });
  const ref = g.fine.deposits[base]!.ref;
  apply(w, { ...stroke(second, "ore"), ore: "copper" });
  apply(w, { ...stroke(first, "ore"), ore: "gold" });
  assert.equal(g.fine.deposits[base]!.ref, ref);
  assert.equal(
    g.fine.deposits[base]!.cell,
    first,
    "painting an earlier cell cannot renumber an existing mine",
  );
  assert.equal(g.fine.deposits[base]!.kind, "gold");
  assert.equal(g.fine.deposits.length, base + 2);
  const saved = saveWorld(w, ruleset),
    loaded = loadWorld(saved, build, ruleset).world;
  assert.deepEqual(loaded.domainHashes(), w.domainHashes());
  assert.deepEqual(
    homePlanet(loaded).generated.fine.tectonics.elevation,
    g.fine.tectonics.elevation,
  );
  assert.deepEqual(homePlanet(loaded).generated.deposits, g.deposits);
  assert.deepEqual(verifyByReplay(saved, build), { ok: true, problem: null });
  h.load(original);
  assert.deepEqual(
    {
      e: g.tectonics.elevation,
      t: g.climate.temperature,
      rain: g.climate.precipitation,
      biome: g.climate.biome,
      centre: g.centre,
    },
    coarse,
  );
  assert.equal(h.surfaceKey, oldKey);
  assert.equal(regionOf(ctx, province), beforeRegion);
  assert.deepEqual(loadWorld(old, build, ruleset).world.domainHashes(), build().domainHashes());
});

test("lethal strokes require confirmation and write deaths and their cause; empty ground accepts lightning", () => {
  const w = build(),
    ctx = populationContext(w),
    h = homePlanet(w),
    p = ctx.provinces.all()[0]!,
    cell = h.generated.centre[p.cell]!,
    args = { ...stroke(cell, "lightning"), strength: 4 },
    before = p.total(),
    hashes = w.domainHashes();
  assert.ok(brushPreview(ctx, args).atRisk > 0);
  assert.throws(() => w.submit("act.brush", args), /Confirm its consequences/);
  assert.deepEqual(w.domainHashes(), hashes);
  apply(w, { ...args, confirmed: true });
  const s = h.brushStrokes()[0]!;
  assert.ok(s.dead > 0);
  assert.equal(before - p.total(), s.dead);
  assert.equal(w.events.get(s.event)?.type, "act.brush");
  assert.ok(w.events.get(s.event)?.causes[0]?.ref.startsWith("cmd:"));
  const empty = [...h.generated.provinceOf].findIndex(
    (p) => (ctx.provinces.get(p)?.total() ?? 0) === 0,
  );
  assert.ok(empty >= 0);
  apply(w, stroke(empty, "lightning"));
  assert.equal(h.brushStrokes().length, 2);
  assert.equal(h.brushStrokes()[1]!.dead, 0);
});

test("water, drainage and viable native life affect the same saved ground", () => {
  const w = build(),
    ctx = populationContext(w),
    h = homePlanet(w),
    p = ctx.provinces.all()[0]!,
    cell = h.generated.centre[p.cell]!;
  apply(w, { ...stroke(cell, "water"), confirmed: true });
  assert.equal(h.generated.fine.water.lake[cell], 1);
  apply(w, stroke(cell, "drain"));
  assert.equal(h.generated.fine.water.lake[cell], 0);
  const suited = Array.from({ length: h.generated.fine.grid.count }, (_, c) => c).find((c) => {
    try {
      return brushPreview(ctx, stroke(c, "life")).seeded > 0;
    } catch {
      return false;
    }
  });
  assert.notEqual(suited, undefined);
  apply(w, stroke(suited!, "life"));
  assert.ok(h.generated.fine.life.diversity[suited!]! > 0);
  assert.throws(() => w.submit("act.brush", { ...stroke(cell), radius: 50 }), /out of range/);
  assert.throws(
    () => w.submit("act.brush", { ...stroke(cell, "ore"), ore: "unobtainium" }),
    /chemistry/,
  );
});

test("claiming transfers a member land exactly once and protects capitals from an accidental stroke", () => {
  const w = build();
  w.runTo(125 * YEAR);
  const realms = politiesOf(w),
    old = realms.living().find((p) => p.members.length > 1)!,
    into = realms.living().find((p) => p !== old)!,
    land = old.members.find((c) => c !== old.seat)!,
    cell = homePlanet(w).generated.centre[land]!;
  apply(w, { ...stroke(cell, "claim"), realm: into.ref });
  assert.equal(realms.of(land), into);
  assert.ok(!old.members.includes(land));
  apply(w, { ...stroke(cell, "claim"), realm: into.ref });
  assert.equal(into.members.filter((p) => p === land).length, 1);
  assert.throws(
    () =>
      w.submit("act.brush", {
        ...stroke(homePlanet(w).generated.centre[old.seat]!, "claim"),
        realm: into.ref,
      }),
    /capital cannot be claimed/,
  );
});
