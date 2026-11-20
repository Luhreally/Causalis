// A town's form on a world that has lived (asked 2026-11-19): first light at year 120. What its towns keep is read into
// their sites, drawn, and said on their pages; and what reads the fabric still finds every lot where it stands.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EARTH } from "../../src/host/planet.ts";
import { townPlan } from "../../src/host/town.ts";
import { townSite } from "../../src/host/village.ts";
import { buildingsTab } from "../../src/host/inspect/fabric.ts";
import { populationContext, townsOf } from "../../src/sim/index.ts";
import { BLOCK_LOTS, townReach } from "../../src/bridge/index.ts";
import {
  TownParts,
  townCivics,
  townGround,
  townHomes,
  townScene,
  townWalls,
} from "../../src/view/index.ts";
import { universeWorld } from "../host/worlds.ts";
import type { Ref } from "../../src/kernel/index.ts";

const world = universeWorld(EARTH, "first light", 120),
  ctx = populationContext(world),
  towns = townsOf(world),
  all = ctx.settlements
    .all()
    .filter((s) => towns.get(s.ref) && s.population > 0)
    .sort((a, b) => b.population - a.population);

/** A town's plan as its view asks it, and the same with nothing of its form read (as it was drawn before). */
function plans(ref: Ref) {
  const at = townSite(world, ref)!,
    plan = townPlan(world, ref, at.axis, 16_000, at.water)!,
    site = plan.site ? { ...plan.site } : undefined;
  if (site) {
    delete (site as { laid?: unknown }).laid;
    delete (site as { surveys?: unknown }).surveys;
    delete (site as { place?: unknown }).place;
  }
  const bare = { ...plan, ...(site ? { site } : {}) };
  delete (bare as { form?: unknown }).form;
  return { plan, bare };
}

function drawn(plan: NonNullable<ReturnType<typeof townPlan>>) {
  const scene = townScene(plan, world.now),
    parts = new TownParts();
  townGround(scene, parts);
  townHomes(scene, scene.settled, world.now, parts);
  townHomes(scene, scene.active, world.now, parts);
  townCivics(scene, world.now, parts);
  townWalls(scene, world.now, parts);
  let batches = 0;
  for (const g of parts.groups.values()) if (g.data.length) batches++;
  return { scene, parts: parts.count, batches, groups: parts.groups };
}

test("a lived world's towns read what they kept: a market place where they held a market, their ground by their realm's reach", () => {
  let places = 0,
    kept = 0;
  for (const s of all.slice(0, 60)) {
    const f = towns.get(s.ref)!,
      { plan } = plans(s.ref);
    assert.ok(plan.site?.surveys, `${s.name}: its ground's taking up is read`);
    assert.equal(plan.site.surveys[0]!.from, 0);
    if (f.place >= 0) {
      kept++;
      assert.deepEqual(plan.site.place, {
        at: Math.ceil((f.place >> 2) / BLOCK_LOTS),
        size: f.place & 3,
      });
      const scene = townScene(plan, world.now);
      if (scene.lots.blocks.place) {
        places++;
        // (Within its town: no further out than its furthest lot.)
        const p = scene.lots.blocks.place;
        assert.ok(Math.hypot(p.x, p.z) < townReach(scene.lots, plan.lots) + 60, s.name);
      }
    }
  }
  assert.ok(kept >= 20, `${kept} of the sixty greatest have held a market`);
  assert.ok(places >= kept * 0.9, `${places} market places kept open of ${kept}`);
});

test("every form its view draws is said on its page, and costs a few parts and batches", () => {
  let more = 0,
    was = 0,
    said = 0;
  for (const s of all.slice(0, 12)) {
    const { plan, bare } = plans(s.ref),
      a = drawn(plan),
      b = drawn(bare);
    if (process.env.DBG) {
      const ka = [...a.groups]
          .filter(([, g]) => g.data.length)
          .map(([k, g]) => `${k}:${g.data.length / 7}`),
        kb = new Set([...b.groups].filter(([, g]) => g.data.length).map(([k]) => k));
      console.log(
        s.name,
        plan.lots,
        a.parts,
        b.parts,
        a.batches,
        b.batches,
        JSON.stringify(plan.form),
        " NEW",
        ka.filter((k) => !kb.has(k.split(":")[0]!)).join("  "),
      );
    }
    more += a.parts;
    was += b.parts;
    assert.ok(
      // (Eight in the hundred, or a hundred and fifty: a town of a few hundred lots with a market place, a ring street and a
      // keep draws that many more, and a phone draws two hundred thousand.)
      a.parts <= Math.max(b.parts * 1.08, b.parts + 200),
      `${s.name}: ${a.parts} parts against ${b.parts} (${plan.lots} lots)`,
    );
    assert.ok(
      a.batches <= Math.max(b.batches * 1.15, b.batches + 16),
      `${s.name}: ${a.batches} batches against ${b.batches}`,
    );
    const tab = buildingsTab(world, s.ref),
      whys = JSON.stringify(
        tab?.blocks.find((x) => x.type === "list" && x.title === "Why it is built so") ?? null,
      );
    assert.doesNotMatch(whys, /undefined|NaN/);
    if (a.scene.lots.blocks.place) {
      assert.match(whys, /Its market place is the ground/, s.name);
      said++;
    }
    assert.match(whys, /When it was founded/, s.name);
  }
  assert.ok(more <= was * 1.08, `${more} parts against ${was} over the twelve greatest`);
  assert.ok(said > 0);
});
