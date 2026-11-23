import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME_MONTHS, LEVEL } from "../../src/rules/index.ts";
import { BLOCK_D, BLOCK_W, NET_BLOCKS, type TownPlan } from "../../src/bridge/index.ts";
import { townNets, townScene } from "../../src/view/index.ts";

// 2026-11-22, the audit's "infrastructure as networks": a town's water, drains and power laid along the streets about its
// blocks, from what its plan says its land has; never on a block's own ground, never two on one spot, a line of wire grown from
// one pole to the nearest before it it can reach down the streets (2026-11-23: never over a block); none for a people of the
// water.

const YEAR_S = 365 * 86_400;

function plan(over: Partial<TownPlan> = {}): TownPlan {
  return {
    family: "grid",
    seed: 7,
    axis: 0,
    lots: 400,
    whole: 400,
    runs: [[0, 0, 400, 10, 10, LEVEL.house, -1]],
    civics: [],
    walls: null,
    months: HOME_MONTHS,
    designs: [{ since: -1, walls: "timber", roof: "thatch", form: "square", pitch: 40 }],
    paved: true,
    water: null,
    year: 10,
    ...over,
  };
}

const at = (p: TownPlan) => townNets(townScene(p, 12 * YEAR_S));

test("a town with no networks lays none; a people of the water none", () => {
  assert.equal(at(plan()).boxes.length + at(plan()).rounds.length, 0);
  const swim = at(plan({ ways: "swim", nets: { mains: true, drains: true, power: "lines" } }));
  assert.equal(swim.boxes.length + swim.rounds.length, 0);
});

test("mains, drains and wires are laid by block, each on the street and none on another", () => {
  const p = plan({ nets: { mains: true, drains: true, power: "lines" } }),
    scene = townScene(p, 12 * YEAR_S),
    n = townNets(scene),
    blocks = Math.ceil(p.lots / 8);
  assert.equal(n.counts.blocks, blocks);
  assert.ok(n.counts.covers >= blocks * 0.9, `${n.counts.covers} covers on ${blocks} blocks`);
  assert.ok(n.counts.grates >= blocks * 1.8, `${n.counts.grates} grates`);
  assert.ok(n.counts.poles >= blocks * 0.9, `${n.counts.poles} poles`);
  // (A line, never a web: a wire to each pole but the first, where the nearest is near enough.)
  assert.ok(n.counts.wires <= n.counts.poles - 1 && n.counts.wires >= n.counts.poles * 0.8);
  // None on any block's own ground (its yards and homes): each stands off every block's edge.
  const b = scene.lots.blocks,
    things = [...n.boxes, ...n.rounds].filter((x) => x.sz < 5);
  for (const t of things)
    for (let k = 0; k < blocks; k++) {
      const c = Math.cos(b.yaw[k]!),
        s = Math.sin(b.yaw[k]!),
        dx = t.x - b.x[k]!,
        dz = t.z - b.z[k]!,
        u = dx * c - dz * s,
        v = dx * s + dz * c;
      assert.ok(
        Math.abs(u) > BLOCK_W / 2 || Math.abs(v) > BLOCK_D / 2,
        `a part at ${t.x.toFixed(1)}, ${t.z.toFixed(1)} on block ${k}`,
      );
    }
  // No two on one spot.
  for (let i = 0; i < things.length; i++)
    for (let j = i + 1; j < things.length; j++) {
      const a = things[i]!,
        c = things[j]!;
      if (Math.abs(a.y - c.y) > 2) continue;
      assert.ok(
        Math.hypot(a.x - c.x, a.z - c.z) > 0.9,
        `two parts at ${a.x.toFixed(1)}, ${a.z.toFixed(1)}`,
      );
    }
  // No wire over a block's own ground (its yards and homes): each strung down the streets, turning at a corner where it must.
  for (const w of n.boxes.filter((x) => x.sz >= 5))
    for (let f = 0; f <= 1; f += 0.5 / w.sz) {
      const px = w.x + (f - 0.5) * w.sz * Math.sin(w.yaw),
        pz = w.z + (f - 0.5) * w.sz * Math.cos(w.yaw);
      for (let k = 0; k < blocks; k++) {
        const c = Math.cos(b.yaw[k]!),
          s = Math.sin(b.yaw[k]!),
          dx = px - b.x[k]!,
          dz = pz - b.z[k]!;
        assert.ok(
          Math.abs(dx * c - dz * s) >= BLOCK_W / 2 - 0.01 ||
            Math.abs(dx * s + dz * c) >= BLOCK_D / 2 - 0.01,
          `a wire over block ${k} at ${px.toFixed(1)}, ${pz.toFixed(1)}`,
        );
      }
    }
  // Every rank under the most the fade draws whole near the eye.
  for (const t of [...n.boxes, ...n.rounds]) assert.ok(t.rank >= 0 && t.rank < 0.8);
});

test("buried wires lay a box by each block and no pole; a great city is laid about where the eye looks, at most NET_BLOCKS", () => {
  const buried = at(plan({ nets: { mains: false, drains: false, power: "buried" } }));
  assert.equal(buried.counts.poles, 0);
  assert.ok(buried.counts.boxes > 40);
  const big = plan({
      lots: 8000,
      whole: 8000,
      runs: [[0, 0, 8000, 10, 10, LEVEL.house, -1]],
      nets: { mains: true, drains: true, power: "lines" },
    }),
    scene = townScene(big, 12 * YEAR_S),
    here = townNets(scene),
    there = townNets(scene, { x: 600, z: 0 });
  assert.equal(here.counts.blocks, NET_BLOCKS);
  const mean = (n: typeof here) => n.rounds.reduce((s, r) => s + r.x, 0) / n.rounds.length;
  assert.ok(mean(there) > mean(here) + 200, "laid about the eye");
  // The same town laid twice is the same.
  assert.deepEqual(townNets(scene), here);
});
