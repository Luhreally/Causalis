// Nothing laid on the ground lies on anything else, nor on water (asked 2026-11-20: "did you fix like the farms overlapping and
// like just genreal overlapping mesh colliding ... it needs avoid logic issues like this from first principles"). A small
// world's every land as its map lays it (view/land.ts landLaid, as render/land.ts lays it), and some of its towns by water as
// their own view lays them (host/village.ts), each pair of what lies on the ground read exactly: rectangles and lines, not the
// cells the ground claims are kept in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EARTH } from "../../src/host/planet.ts";
import { landPlan } from "../../src/host/land.ts";
import { townSite, villagePlan } from "../../src/host/village.ts";
import { townPlan } from "../../src/host/town.ts";
import { landWater } from "../../src/host/sites.ts";
import { YEAR } from "../../src/kernel/index.ts";
import { populationContext, regionOf, townsOf } from "../../src/sim/index.ts";
import {
  LOT,
  LOT_D,
  LOT_W,
  grownBlocks,
  rectPoints,
  rectsOverlap,
  wallAt,
  wetGround,
  type Rect,
} from "../../src/bridge/index.ts";
import {
  LAND_ACROSS,
  campSpot,
  facetWater,
  facetWet,
  landEdge,
  landLaid,
  landMoment,
  landReach,
  landRoadOut,
  linePieces,
  roadClear,
  roadLook,
  TownParts,
  townAsh,
  townCivics,
  townGround,
  townHomes,
  townMiddle,
  townScene,
  townWalls,
  type LandDrawn,
  type LandGround,
} from "../../src/view/index.ts";
import { universeWorld } from "../host/worlds.ts";

const world = universeWorld(EARTH, "sorrel 260 ~size small ~sky small", 160),
  ctx = populationContext(world),
  towns = townsOf(world);

/** A land's ground as its map is sent (host/planet.ts). */
function groundOf(cell: number): LandGround {
  const r = regionOf(ctx, cell);
  return {
    size: r.size,
    tileKm: r.tileKm,
    heights: Float32Array.from(r.elevation, (e) => (Math.max(e, -60) / 1000) * 9),
    water: Uint8Array.from(r.water),
    fertility: Uint8Array.from(r.fertility, (f) => Math.round(f * 255)),
  };
}

const lake = (g: LandGround, x: number, z: number) => {
  const w = facetWater(g, x, z);
  return w === 1 || w === 3;
};

test("a land's map: no field on the water, a lot, a road, a wall or another field; no road over a lot or a lake; no camp on any", () => {
  const cells = [
    ...new Set(
      ctx.settlements
        .all()
        .filter((s) => s.population > 0)
        .map((s) => s.cell),
    ),
  ].sort((a, b) => a - b);
  const n: Record<string, number> = {
    lands: 0,
    lots: 0,
    fields: 0,
    pieces: 0,
    "field-field": 0,
    "field-water": 0,
    "field-lot": 0,
    "field-road": 0,
    "field-wall": 0,
    "road-lot": 0,
    "road-water": 0,
    "lot-lot": 0,
    "lot-water": 0,
    "camp-any": 0,
  };
  for (const cell of cells.slice(0, 40)) {
    const plan = landPlan(world, cell, 6000);
    if (plan.colony || !plan.towns.length) continue;
    n.lands!++;
    const g = groundOf(cell),
      year = Math.floor(plan.t / YEAR),
      drawn = new Map<string, LandDrawn & { scene: ReturnType<typeof townScene> }>();
    for (const town of plan.towns) {
      if (!town.plan || town.plan.lots === 0) continue;
      const m = townMiddle(g, town),
        scene = townScene(town.plan, landMoment(town.plan, plan.t));
      drawn.set(town.ref, {
        x: m.x,
        z: m.z,
        reach: landReach(scene),
        edge: landEdge(scene),
        ...(town.plan.site ? { site: town.plan.site } : {}),
        blocks: scene.lots.blocks,
        count: Math.ceil(town.plan.lots / 8),
        ...(scene.walls?.lengths.length ? { wall: scene.walls.line } : {}),
        scene,
      });
    }
    const lines = new Map<string, { x: number; z: number }[]>(),
      roads = plan.roads.flatMap((r) => {
        const out =
          roadLook(r, year) === "none"
            ? null
            : landRoadOut(g, r, (ref) => drawn.get(ref), lines, !!plan.undersea);
        return out ? [out] : [];
      }),
      laid = landLaid(
        g,
        plan,
        (ref) => drawn.get(ref),
        (t) => townMiddle(g, t),
        roads,
      ),
      clear = roadClear(laid.claims),
      pieces: Rect[] = roads.flatMap((line) =>
        linePieces(g, line, 0, 0.3)
          .filter(clear)
          .map((q) => ({ x: q[0]!, z: q[2]!, w: q[3]!, d: 0.07, yaw: q[4]! - Math.PI / 2 })),
      ),
      lots: { r: Rect; town: string }[] = [],
      walls: Rect[] = [];
    for (const [ref, d] of drawn) {
      const sc = d.scene;
      for (let p = 0; p < sc.plan.lots; p++) {
        if (sc.states.what[p] === LOT.open) continue;
        const r = {
          x: d.x + sc.lots.x[p]! * LAND_ACROSS,
          z: d.z + sc.lots.z[p]! * LAND_ACROSS,
          w: LOT_W * LAND_ACROSS,
          d: LOT_D * LAND_ACROSS,
          yaw: sc.lots.yaw[p]!,
        };
        // (A lot on the map's water is not drawn: render/land.ts.)
        if (!plan.undersea && facetWet(g, r.x, r.z)) continue;
        lots.push({ r, town: ref });
        if (!plan.undersea && rectPoints(r).some((q) => facetWet(g, q.x, q.z))) n["lot-water"]!++;
      }
      if (d.wall)
        for (let k = 0; k < 144; k++) {
          const a0 = (k / 144) * 2 * Math.PI,
            a1 = ((k + 1) / 144) * 2 * Math.PI,
            r0 = wallAt(d.wall, a0) * LAND_ACROSS,
            r1 = wallAt(d.wall, a1) * LAND_ACROSS,
            p = { x: d.x + r0 * Math.cos(a0), z: d.z + r0 * Math.sin(a0) },
            q = { x: d.x + r1 * Math.cos(a1), z: d.z + r1 * Math.sin(a1) };
          walls.push({
            x: (p.x + q.x) / 2,
            z: (p.z + q.z) / 2,
            w: Math.hypot(q.x - p.x, q.z - p.z),
            d: 0.02,
            yaw: -Math.atan2(q.z - p.z, q.x - p.x),
          });
        }
    }
    n.lots! += lots.length;
    n.pieces! += pieces.length;
    const fields = laid.fields;
    n.fields! += fields.length;
    const near = (a: Rect, b: Rect) => Math.hypot(a.x - b.x, a.z - b.z) < 1.5;
    fields.forEach((f, i) => {
      for (let j = i + 1; j < fields.length; j++)
        if (near(f, fields[j]!) && rectsOverlap(f, fields[j]!, 1e-4)) n["field-field"]!++;
      if (!plan.undersea && rectPoints(f).some((q) => facetWet(g, q.x, q.z))) n["field-water"]!++;
      if (lots.some((o) => near(f, o.r) && rectsOverlap(f, o.r, 1e-4))) n["field-lot"]!++;
      if (pieces.some((p) => near(f, p) && rectsOverlap(f, p, 1e-4))) n["field-road"]!++;
      if (walls.some((w) => near(f, w) && rectsOverlap(f, w, 1e-4))) n["field-wall"]!++;
    });
    for (const p of pieces) {
      if (lots.some((o) => near(p, o.r) && rectsOverlap(p, o.r, 1e-4))) n["road-lot"]!++;
      if (!plan.undersea && lake(g, p.x, p.z)) n["road-water"]!++;
    }
    for (let i = 0; i < lots.length; i++)
      for (let j = i + 1; j < lots.length; j++) {
        const a = lots[i]!,
          b = lots[j]!;
        if (a.town !== b.town && near(a.r, b.r) && rectsOverlap(a.r, b.r, 1e-4)) n["lot-lot"]!++;
      }
    for (const c of plan.camps ?? []) {
      const at = campSpot(g, c, (x, z, r) => laid.claims.freeDisc(x, z, r)),
        r = { x: at.x, z: at.z, w: 0.6, d: 0.6, yaw: 0 };
      if (
        lots.some((o) => rectsOverlap(r, o.r)) ||
        fields.some((f) => rectsOverlap(r, f)) ||
        pieces.some((p) => rectsOverlap(r, p))
      )
        n["camp-any"]!++;
    }
  }
  assert.ok(n.lands! >= 10 && n.fields! > 1000 && n.lots! > 10_000, JSON.stringify(n));
  for (const k of [
    "field-field",
    "field-water",
    "field-lot",
    "field-road",
    "field-wall",
    "road-water",
    "lot-lot",
    "camp-any",
  ])
    assert.equal(n[k], 0, `${k}: ${JSON.stringify(n)}`);
  // (A lot's edge where a share of the water's points in between its block's corners, and a road's piece on a bridge beside
  // a lot on the bank: a few in a hundred thousand.)
  assert.ok(n["lot-water"]! <= n.lots! / 20_000, JSON.stringify(n));
  assert.ok(n["road-lot"]! <= n.pieces! / 2_000, JSON.stringify(n));
});

test("a town's own view: its fields, pasture and water on its land's own ground, none on another; no block across the water", () => {
  const byWater = ctx.settlements
    .all()
    .filter((s) => s.population > 0 && (towns.get(s.ref)?.next ?? 0) >= 8)
    .filter((s) => {
      const r = regionOf(ctx, s.cell);
      return !!landWater(r, s.tile % r.size, Math.floor(s.tile / r.size), false).wet;
    })
    .sort((a, b) => b.population - a.population)
    .slice(0, 12);
  assert.ok(byWater.length >= 6);
  let fields = 0,
    own = 0;
  for (const s of byWater) {
    const r = regionOf(ctx, s.cell),
      ground = landWater(r, s.tile % r.size, Math.floor(s.tile / r.size), false),
      wet = (x: number, z: number) => wetGround(ground, x, z),
      plan = villagePlan(world, s.ref, 2);
    fields += plan.fields.length;
    plan.fields.forEach((f, i) => {
      assert.ok(!rectPoints(f).some((q) => wet(q.x, q.z)), `${s.name}: a field on the water`);
      for (let j = i + 1; j < plan.fields.length; j++)
        assert.ok(!rectsOverlap(f, plan.fields[j]!), `${s.name}: a field on a field`);
    });
    const p = plan.pasture;
    assert.ok(
      !wet(p.x, p.z) &&
        plan.fields.every(
          (f) => !rectsOverlap(f, { x: p.x, z: p.z, w: p.r * 1.8, d: p.r * 1.8, yaw: 0 }),
        ),
      `${s.name}: its pasture on the water or a field`,
    );
    // (Its own water is its land's: a round wholly on what its map draws as water.)
    if (plan.water) {
      own++;
      const w = plan.water,
        rr = (w.r ?? 0) * 0.98;
      for (let k = 0; k < 16; k++)
        assert.ok(
          wet(w.x + rr * Math.cos((k * Math.PI) / 8), w.z + rr * Math.sin((k * Math.PI) / 8)),
          `${s.name}: its water off its land's`,
        );
    }
    // No block of it across the water from its square: its way out from the square crosses no more than a lane bridges.
    const town = plan.town;
    if (town?.site) {
      const b = grownBlocks(town.seed, town.site, Math.ceil(town.lots / 8), town.water, town.axis);
      for (let k = 0; k < b.x.length; k++) {
        const d = Math.hypot(b.x[k]!, b.z[k]!);
        if (d > 3000) continue;
        let water = 0;
        for (let t = 0; t < d; t += 12) if (wet((b.x[k]! * t) / d, (b.z[k]! * t) / d)) water += 12;
        assert.ok(water <= 48, `${s.name}: block ${k} across ${water} m of water`);
        for (const blk of blocksFields(plan.fields, {
          x: b.x[k]!,
          z: b.z[k]!,
          w: 36,
          d: 28,
          yaw: b.yaw[k]!,
        }))
          assert.fail(`${s.name}: a field on block ${k} (${JSON.stringify(blk)})`);
      }
    }
  }
  assert.ok(fields > 300 && own >= 4, `${fields} fields, ${own} with their own water`);
});

function blocksFields(fields: readonly Rect[], block: Rect): Rect[] {
  return fields.filter((f) => rectsOverlap(f, block, 1e-4));
}

test("a town's own view: no building runs into another, its sprawl's roofs with them; no part in two colours in one place", () => {
  // (Its greatest towns drawn with few lots, so the rest stand as sprawl: render/town.ts's order.)
  const great = ctx.settlements
    .all()
    .filter((s) => s.population > 0 && towns.get(s.ref))
    .sort((a, b) => b.population - a.population)
    .slice(0, 6);
  let roofs = 0,
    bodies = 0;
  for (const s of great) {
    const site = townSite(world, s.ref)!,
      plan = townPlan(world, s.ref, site.axis, 120, site.water)!,
      t = world.now,
      scene = townScene(plan, t),
      parts = new TownParts();
    townGround(scene, parts);
    townHomes(scene, scene.settled, t, parts);
    townHomes(scene, scene.active, t, parts);
    townCivics(scene, t, parts, false);
    townWalls(scene, t, parts);
    townAsh(scene, t, parts);
    roofs += (scene.sprawlRoofs?.length ?? 0) / 8;
    type Part = Rect & { y: number; h: number; c: string };
    const list: Part[] = [];
    for (const [key, g] of parts.groups) {
      if (g.lamp) continue;
      for (let i = 0; i < g.data.length; i += 7)
        list.push({
          c: key,
          x: g.data[i]!,
          y: g.data[i + 1]!,
          z: g.data[i + 2]!,
          w: g.data[i + 3]!,
          h: g.data[i + 4]!,
          d: g.data[i + 5]!,
          yaw: g.data[i + 6]!,
        });
    }
    // Two parts of one shape in one place at one size, in two colours, flicker.
    const where = new Map<string, string>();
    for (const p of list) {
      const k = [p.c.split("|")[0], p.x, p.y, p.z, p.w, p.h, p.d, p.yaw]
          .map((v) => (typeof v === "number" ? v.toFixed(2) : v))
          .join("|"),
        was = where.get(k);
      assert.ok(was === undefined || was === p.c, `${s.name}: ${k} in ${was} and ${p.c}`);
      where.set(k, p.c);
    }
    // A building's body: a standing box 3 m high and more. None runs into another by more than a metre and a half (a base
    // and what rises from its middle are one building's).
    const body = list.filter(
      (p) => p.c.startsWith("box|") && p.h >= 3 && p.w >= 3 && p.d >= 3 && p.y - p.h / 2 < 1.5,
    );
    bodies += body.length;
    const shrunk = (p: Part): Rect => ({ x: p.x, z: p.z, w: p.w - 1.5, d: p.d - 1.5, yaw: p.yaw }),
      cell = new Map<string, number[]>();
    body.forEach((p, i) => {
      const k = `${Math.floor(p.x / 40)},${Math.floor(p.z / 40)}`;
      cell.set(k, [...(cell.get(k) ?? []), i]);
    });
    body.forEach((a, i) => {
      for (let u = -1; u <= 1; u++)
        for (let v = -1; v <= 1; v++)
          for (const j of cell.get(`${Math.floor(a.x / 40) + u},${Math.floor(a.z / 40) + v}`) ??
            []) {
            const b = body[j]!;
            if (
              j <= i ||
              (Math.abs(a.x - b.x) < 0.01 &&
                Math.abs(a.z - b.z) < 0.01 &&
                Math.abs(a.yaw - b.yaw) < 0.01)
            )
              continue;
            assert.ok(
              !rectsOverlap(shrunk(a), shrunk(b)),
              `${s.name}: ${JSON.stringify([a, b].map((p) => [p.c, +p.x.toFixed(1), +p.z.toFixed(1), +p.w.toFixed(1), +p.d.toFixed(1)]))}`,
            );
          }
    });
  }
  assert.ok(roofs > 100 && bodies > 1000, `${roofs} sprawl roofs, ${bodies} buildings`);
});
