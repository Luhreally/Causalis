// One laying of a town's fields (town mode, sixth slice): where a place reckons its people's walks out to their fields
// (host/village.ts townFieldsMeant) is where its plan draws them (villagePlan's fields and pasture), a field its ground
// moved among them; and a town asked for walls keeps its fields off their line.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { World } from "../../src/kernel/index.ts";
import { populationContext, townsOf } from "../../src/sim/index.ts";
import { EARTH } from "../../src/host/index.ts";
import { fieldWayOf, townFieldsMeant, villagePlan } from "../../src/host/village.ts";
import { townOffers } from "../../src/host/inspect/asks.ts";
import {
  WALL_THICK,
  fieldCount,
  fieldEdge,
  fieldsMeant,
  townLots,
  wallAt,
  wallLine,
  wallsOut,
  type VillagePlan,
} from "../../src/bridge/index.ts";
import { hashString } from "../../src/kernel/index.ts";
import { universeWorld } from "./worlds.ts";

const lotsOf = (town: NonNullable<VillagePlan["town"]>) =>
  townLots(
    town.family,
    town.seed,
    town.axis,
    town.lots,
    town.water,
    town.site ?? null,
    town.lotSize ?? 1,
  );
const towns = (w: World, from: number, to: number) => {
  const ctx = populationContext(w);
  return ctx.settlements
    .all()
    .filter((s) => ctx.settlements.held(s.ref) && s.population >= from && s.population <= to)
    .sort((a, b) => a.population - b.population || (a.ref < b.ref ? -1 : 1));
};

test("a place's walks go out to the fields its plan draws, those its ground moved among them", () => {
  const w = universeWorld(EARTH, "first light", 150);
  let read = 0,
    moved = 0;
  for (const s of towns(w, 150, 3000)) {
    if (read >= 12 && moved > 0) break;
    if (read >= 40) break;
    const plan = villagePlan(w, s.ref),
      town = plan.town;
    if (!town || !plan.fields.length) continue;
    read++;
    const lots = lotsOf(town),
      out = townFieldsMeant(w, s.ref, lots, town.lots, town.whole, town);
    assert.ok(out, s.ref);
    assert.deepEqual(
      out.fields,
      plan.fields.map((f) => ({ x: f.x, z: f.z })),
      `${s.name}: the fields walked to are the fields drawn`,
    );
    assert.ok(
      Math.abs(out.pasture.x - plan.pasture.x) < 1e-9 &&
        Math.abs(out.pasture.z - plan.pasture.z) < 1e-9,
      `${s.name}: the pasture walked to is the pasture drawn`,
    );
    // (Where they were meant to lie before its ground was read: the same fan, as its plan reads it.)
    const count = Math.max(4, Math.min(160, Math.ceil(s.population / 5))),
      { edgeAt } = fieldEdge({
        lots,
        drawn: town.lots,
        whole: town.whole,
        city: false,
        cityRim: 0,
        count,
        spires: false,
      }),
      meant = fieldsMeant(
        hashString(`village ${s.ref}`),
        fieldWayOf(w, s.cell, s.tile),
        fieldCount(count),
        edgeAt,
      );
    if (
      plan.fields.length !== meant.length ||
      plan.fields.some((f) => !meant.some((m) => Math.hypot(m.x - f.x, m.z - f.z) < 1))
    )
      moved++;
  }
  assert.ok(read >= 12, `towns read: ${read}`);
  assert.ok(moved > 0, "a town of these has a field its ground moved, or left unsown");
});

test("a town asked for walls keeps its fields and its pasture off their line", () => {
  const w = universeWorld(EARTH, "first light", 300);
  let seen = 0;
  for (const s of towns(w, 200, 1200)) {
    if (seen >= 3) break;
    if (!townOffers(w, s.ref)?.raises.some((r) => r.what === "walls")) continue;
    const before = villagePlan(w, s.ref);
    const c = w.submit("town.ask", { village: s.ref, kind: "raise", what: "walls" });
    w.runTo(c.t);
    if (!townsOf(w).get(s.ref)?.walls) continue;
    seen++;
    const plan = villagePlan(w, s.ref),
      town = plan.town!,
      lots = lotsOf(town);
    assert.ok(town.walls, `${s.name} has its walls' line`);
    const about = wallLine(
        Math.min(town.walls!.reach, town.lots),
        lots,
        town.water,
        town.site ?? null,
      ),
      far = wallsOut(town, lots),
      ring = (x: number, z: number) => wallAt(about, Math.atan2(z, x)) * far;
    for (const f of plan.fields) {
      // (Its corners: none within its walls or on them.)
      const c0 = Math.cos(f.yaw),
        s0 = Math.sin(f.yaw);
      for (const [u, v] of [
        [0, 0],
        [0.5, 0.5],
        [0.5, -0.5],
        [-0.5, 0.5],
        [-0.5, -0.5],
      ] as const) {
        const x = f.x + u * f.w * c0 + v * f.d * s0,
          z = f.z - u * f.w * s0 + v * f.d * c0;
        assert.ok(
          Math.hypot(x, z) > ring(x, z) + WALL_THICK / 2,
          `${s.name}: a field at ${Math.round(f.x)}, ${Math.round(f.z)} lies clear of its walls (${Math.round(Math.hypot(x, z))} m out, the wall at ${Math.round(ring(x, z))})`,
        );
      }
    }
    const p = plan.pasture;
    assert.ok(
      Math.hypot(p.x, p.z) - p.r > ring(p.x, p.z) - 1,
      `${s.name}: its pasture lies clear of its walls`,
    );
    assert.ok(
      plan.fields.length >= before.fields.length * 0.7,
      "and most of its fields are still sown",
    );
  }
  assert.ok(seen >= 1, "a town of this world took up the raising of walls");
});
