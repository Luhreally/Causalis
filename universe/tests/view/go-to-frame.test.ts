// The eye set on one gone to (view/streetfight.ts goToFrame, view/town.ts townBuildingAt): one abed is looked at from outside
// their house, on a side nothing stands before, low enough to see its front; one in the open from the way most open about
// them. First light three hundred years on, spread: towns with a fabric and courts with stones.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Ref } from "../../src/kernel/index.ts";
import { populationContext } from "../../src/sim/index.ts";
import { villagePlan } from "../../src/host/village.ts";
import {
  goToFrame,
  momentOf,
  townBuildingAt,
  townScene,
  villageSolids,
} from "../../src/view/index.ts";
import { clearOf } from "../../src/view/ground.ts";
import { peopledWorld } from "../worlds.ts";

const world = peopledWorld("first light", 300, { start: "spread" }),
  towns = populationContext(world)
    .settlements.all()
    .filter((t) => t.population > 0),
  day = Math.floor(world.now / 86_400) + 1;

test("one abed is framed from outside their house; one in the open, from where nothing stands before them", () => {
  let abed = 0,
    open = 0,
    fabric = 0;
  for (const t of towns.slice(0, 40)) {
    const plan = villagePlan(world, t.ref as Ref, undefined, 60),
      solids = villageSolids(plan),
      night = day * 86_400 + 2 * 3600,
      noon = day * 86_400 + 11 * 3600,
      scene = plan.town ? townScene(plan.town, night) : null;
    if (scene) fabric++;
    for (let i = 0; i < Math.min(plan.people.length, 12); i++) {
      const m = momentOf(plan, i, night);
      if (m.hidden) {
        const within = scene ? townBuildingAt(scene, m.x, m.z, night) : null,
          f = goToFrame(plan, solids, m, within),
          r = (f.yaw * Math.PI) / 180;
        if (!within && !solids.homes.some((h) => clearOf(h, m) < 5)) continue;
        abed++;
        assert.ok(
          f.pitch > -35 && f.distance >= 6,
          `${t.ref} ${i}: low and far enough: ${JSON.stringify(f)}`,
        );
        // (The eye stands off away from the house: further from its middle than the one looked at.)
        const s = within ?? [...solids.homes].sort((a, b) => clearOf(a, m) - clearOf(b, m))[0]!,
          eye = { x: m.x + Math.sin(r) * 30, z: m.z + Math.cos(r) * 30 };
        assert.ok(
          Math.hypot(eye.x - s.x, eye.z - s.z) > Math.hypot(m.x - s.x, m.z - s.z),
          `${t.ref} ${i}: the eye is on their side of the house`,
        );
      }
      const d = momentOf(plan, i, noon);
      if (d.hidden) continue;
      const within = scene ? townBuildingAt(scene, d.x, d.z, noon) : null,
        f = goToFrame(plan, solids, d, within),
        r = (f.yaw * Math.PI) / 180;
      if (within || solids.homes.some((h) => clearOf(h, d) < 0.3)) continue;
      open++;
      assert.equal(f.pitch, -38);
      // (Nothing the town's people go round within six metres of them the way the eye stands off, where any way is so.)
      const clear = (yaw: number) => {
        const a = (yaw * Math.PI) / 180;
        return [2, 4, 6].every((k) =>
          solids.homes.every(
            (h) => clearOf(h, { x: d.x + Math.sin(a) * k, z: d.z + Math.cos(a) * k }) >= 0.5,
          ),
        );
      };
      if (Array.from({ length: 16 }, (_, k) => k * 22.5).some(clear))
        assert.ok(
          clear(f.yaw),
          `${t.ref} ${i}: something stands between (${f.yaw}°, ${r.toFixed(2)})`,
        );
    }
  }
  assert.ok(
    abed >= 20 && open >= 20 && fabric >= 3,
    `${abed} abed, ${open} in the open, ${fabric} towns with a fabric`,
  );
});
