// Arms as they are made (Phase 52 M217): a host's power is its bare host's and as much of its full
// kit's as it bears; each part's quality is its seat's stuff worked by its seat's craft, within its
// bounds; the kit wears out and is drawn again from its lands' markets; a battle records each
// side's arms, and where they decided it, cites the winner's design. Reads change nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Hasher,
  YEAR,
  loadWorld,
  saveWorld,
  seedFromText,
  type SaveDocument,
  type Seed,
} from "../../src/kernel/index.ts";
import { hostPower, type Part } from "../../src/rules/index.ts";
import {
  ArmsStore,
  QUALITY_BOUNDS,
  forgedMetal,
  toolMetal,
  WAR_EVENTS,
  armsOf,
  designsOf,
  hostFor,
  kitKg,
  makePopulationWorld,
  partQuality,
  partStuff,
  politiesOf,
  populationContext,
  warsOf,
} from "../../src/sim/index.ts";

const world = makePopulationWorld(seedFromText("first light"), { start: "spread" });
world.runTo(400 * YEAR);
const ctx = populationContext(world),
  living = politiesOf(world)
    .all()
    .filter((p) => p.ended === null),
  metal = (parts: readonly Part[]) => kitKg(parts).size > 0;

test("a host's power is its bare host's and as much of its full kit's as it bears", () => {
  let armedWithMetal = 0;
  for (const p of living) {
    const a = armsOf(ctx, p);
    assert.ok(a.armed >= 0 && a.armed <= 1, `${p.ref} armed ${a.armed}`);
    assert.ok(a.full >= a.bare, `${p.ref} full ${a.full} below bare ${a.bare}`);
    assert.ok(Math.abs(a.power - (a.bare + a.armed * (a.full - a.bare))) < 1e-9);
    // (Its parts are its design's, or as its seat can arm it.)
    const d = designsOf(world).of(p.ref);
    assert.deepEqual(a.parts, d?.parts ?? hostFor(ctx, p).parts);
    assert.equal(a.design, d?.ref ?? null);
    if (metal(a.parts)) armedWithMetal++;
    // (A host with no metal has nothing to wear out: fully armed.)
    else assert.equal(a.armed, 1, `${p.ref}, no metal, armed ${a.armed}`);
  }
  assert.ok(armedWithMetal > 0, "some host is armed with metal by year 400");
});

test("each part's quality is its seat's stuff by its seat's craft, within its bounds", () => {
  let seen = 0;
  for (const p of living) {
    for (const part of armsOf(ctx, p).parts) {
      const q = partQuality(ctx, p.seat, part),
        stuff = partStuff(ctx, p.seat, part);
      assert.ok(q >= QUALITY_BOUNDS[0] && q <= QUALITY_BOUNDS[1], `${part.id} ${q}`);
      if (!stuff) assert.equal(q, 1, `${part.id} of no worked stuff counts as usual`);
      else seen++;
      // (Bog iron only where the seat's iron is its own bog ore.)
      if (stuff?.stuff === "bog iron") assert.equal(part.material, "iron");
    }
  }
  assert.ok(seen > 0);
});

test("a host's kit is stone-armed bare of its metal: its full kit is never worth less", () => {
  for (const p of living) {
    const a = armsOf(ctx, p);
    // (Its full kit as its seat makes it can fall below the usual — a poor metal — but never below
    // the host bare of it.)
    assert.ok(hostPower(a.parts) > 0);
    assert.ok(a.full >= a.bare);
  }
});

test("battles record each side's arms; where arms decided it, the winner's design is cited", () => {
  let recorded = 0,
    tipped = 0;
  for (const w of warsOf(world).all())
    for (const b of w.battles) {
      if (!b.power) continue;
      recorded++;
      for (const at of [0, 1] as const) {
        assert.ok(b.power[at] > 0, `power ${b.power[at]}`);
        assert.ok(b.armed![at] >= 0 && b.armed![at] <= 1, `armed ${b.armed![at]}`);
        const d = b.designs?.[at];
        if (d) assert.ok(designsOf(world).get(d), `the design ${d} kept`);
      }
      const e = world.events.get(b.event)!;
      assert.equal(e.type, WAR_EVENTS.battle.type);
      const data = e.data as { tip?: boolean };
      assert.equal(!!data.tip, !!b.tip);
      if (!b.tip) continue;
      tipped++;
      const winner = b.designs?.[b.won ? 0 : 1],
        cited = winner ? designsOf(world).get(winner)?.event : undefined;
      if (cited)
        assert.ok(
          e.causes.some((c) => c.ref === cited && c.role === "enabler"),
          "the winner's design cited",
        );
    }
  assert.ok(recorded > 0, "battles fought with arms counted");
  // (Arms decide some battles, not most: most are won by numbers, ground and luck.)
  assert.ok(tipped < recorded / 2, `${tipped} of ${recorded} tipped`);
});

test("the arms kept are saved and loaded alike; reading them changes nothing", () => {
  const kept = world.store<ArmsStore>("war.arms"),
    copy = new ArmsStore();
  copy.load(JSON.parse(JSON.stringify(kept.save())));
  const h = (s: ArmsStore) => {
    const x = new Hasher();
    s.hashInto(x);
    return x.hex();
  };
  assert.equal(h(copy), h(kept));
  const before = JSON.stringify(world.domainHashes());
  for (const p of living) {
    armsOf(ctx, p);
    for (const part of armsOf(ctx, p).parts) partQuality(ctx, p.seat, part);
  }
  assert.equal(JSON.stringify(world.domainHashes()), before);
});

test("a save from before arms were counted loads, and its hosts are armed anew", () => {
  const build = (seed: Seed) => makePopulationWorld(seed, { start: "spread" }),
    doc = JSON.parse(JSON.stringify(saveWorld(world, "with arms"))) as SaveDocument,
    stores = doc.stores as Record<string, { data: unknown; hash: string }>,
    rehash = (name: string) => (stores[name]!.hash = new Hasher().value(stores[name]!.data).hex());
  // (As saved before Phase 52: no arms kept, no record of what tools were made of, battles
  // without their arms.)
  delete stores["war.arms"];
  for (const m of (stores["economy.markets"]!.data as { markets: Record<string, unknown>[] })
    .markets) {
    delete m.toolMetals;
    delete m.forgedMetals;
  }
  rehash("economy.markets");
  for (const w of (stores["war.wars"]!.data as { wars: { battles: Record<string, unknown>[] }[] })
    .wars)
    for (const b of w.battles) {
      delete b.power;
      delete b.armed;
      delete b.designs;
      delete b.tip;
    }
  rehash("war.wars");
  const old = loadWorld(doc, build, "before arms", { allowRulesetChange: true }).world,
    octx = populationContext(old);
  // Read before it lives on: tools of stone where nothing was told, every host as armed as it was.
  for (const p of politiesOf(old).living()) {
    assert.equal(armsOf(octx, p).armed, 1);
    assert.equal(toolMetal(octx, p.seat), "stone");
    assert.equal(forgedMetal(octx, p.seat), "stone");
  }
  old.runTo(old.now + 2 * YEAR);
  // Two years on: its hosts re-armed from their markets, its tools told again.
  const kept = old.store<ArmsStore>("war.arms");
  assert.ok(kept.realms().length > 0, "hosts armed anew");
  for (const p of politiesOf(old).living()) {
    const a = armsOf(populationContext(old), p);
    assert.ok(a.armed >= 0 && a.armed <= 1);
  }
  assert.ok(
    politiesOf(old)
      .living()
      .some((p) => toolMetal(populationContext(old), p.seat) !== "stone"),
    "some land's tools of metal again",
  );
});
