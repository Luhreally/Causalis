// A great city's far part is the same city drawn more lightly (asked 2026-11-21: "why is what is circled look diffrent from
// each other?"): which of its homes are drawn whole is chosen by how near they stand to the eye, not by the order its lots
// were taken; and its lots past those drawn stand on its own blocks grown on, each lot as its runs say, its streets and yards
// under them, no scattered roof among them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EARTH } from "../../src/host/planet.ts";
import { townSite } from "../../src/host/village.ts";
import { townPlan } from "../../src/host/town.ts";
import { populationContext, townsOf } from "../../src/sim/index.ts";
import { MONTH } from "../../src/kernel/index.ts";
import {
  BLOCK_D,
  BLOCK_LOTS,
  BLOCK_W,
  LOT,
  beganAt,
  outlineAt,
  progress,
  townLots,
  wetGround,
} from "../../src/bridge/index.ts";
import {
  DETAIL_HYSTERESIS,
  TownParts,
  farOf,
  homeAt,
  townDetail,
  townGround,
  townHomesSeen,
  townScene,
  type TownScene,
} from "../../src/view/index.ts";
import { universeWorld } from "../host/worlds.ts";

const world = universeWorld(EARTH, "sorrel 260 ~size small ~sky small", 160),
  ctx = populationContext(world),
  towns = townsOf(world),
  // (Its greatest towns drawn with few lots, so that most of each lies past those drawn.)
  great = ctx.settlements
    .all()
    .filter((s) => s.population > 0 && towns.get(s.ref))
    .sort((a, b) => b.population - a.population)
    .slice(0, 5)
    .map((s) => {
      const site = townSite(world, s.ref)!;
      return { s, plan: townPlan(world, s.ref, site.axis, 120, site.water)! };
    })
    .filter(({ plan }) => plan.whole > plan.lots);

/** Where a lot stands, its own or past those drawn. */
function where(scene: TownScene, p: number): { x: number; z: number } {
  const far = farOf(scene);
  return p < scene.plan.lots
    ? { x: scene.lots.x[p]!, z: scene.lots.z[p]! }
    : { x: far!.x[p - far!.from]!, z: far!.z[p - far!.from]! };
}

test("no home past a city's lots drawn stands whole farther from the eye than one drawn lightly, by more than the eye may move unchosen; its own all whole", () => {
  assert.ok(great.length >= 3, `${great.length} towns`);
  let checked = 0;
  for (const { s, plan } of great) {
    const scene = townScene(plan, world.now);
    townGround(scene, new TownParts());
    for (const [fx, fz] of [
      [0, 0],
      [180, -60],
      [-250, 300],
    ] as const) {
      const detail = townDetail(scene, { x: fx, z: fz });
      // (The eye moved a little short of where they are chosen again, each way.)
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + 0.3,
          ex = fx + Math.cos(a) * (DETAIL_HYSTERESIS / 2) * 0.99,
          ez = fz + Math.sin(a) * (DETAIL_HYSTERESIS / 2) * 0.99;
        let whole = 0,
          light = Infinity,
          wholes = 0,
          lights = 0;
        // (Its own lots drawn stand whole as ever: those past them are chosen by the eye.)
        detail.drawn.forEach((how, p) => {
          if (!how || p < plan.lots) return;
          const at = where(scene, p),
            d = Math.hypot(at.x - ex, at.z - ez);
          if (how === 1) {
            whole = Math.max(whole, d);
            wholes++;
          } else {
            light = Math.min(light, d);
            lights++;
          }
        });
        if (!wholes || !lights) continue;
        assert.ok(
          whole <= light + DETAIL_HYSTERESIS,
          `${s.name}: whole out to ${whole.toFixed(0)} m, a light one at ${light.toFixed(0)} m`,
        );
        checked++;
      }
    }
  }
  assert.ok(checked >= 8, `${checked} looks checked`);
});

test("a city's lots past those drawn stand on its own blocks grown on, as its runs say, with no scattered roof among them", () => {
  let farLots = 0,
    homes = 0;
  for (const { s, plan } of great) {
    const scene = townScene(plan, world.now);
    townGround(scene, new TownParts());
    const far = farOf(scene);
    if (!far) continue;
    farLots += far.count;
    // Its blocks grown on: the same lots as the town laid as far as they go, its own first (none of those drawn moved).
    const all = townLots(
      plan.family,
      plan.seed,
      plan.axis,
      far.from + far.count,
      plan.water,
      plan.site ?? null,
    );
    for (let p = 0; p < plan.lots; p++)
      assert.ok(
        Math.abs(all.x[p]! - scene.lots.x[p]!) < 1e-3 &&
          Math.abs(all.z[p]! - scene.lots.z[p]!) < 1e-3,
        `${s.name}: its lot ${p} moved`,
      );
    for (let k = 0; k < far.count; k++) {
      const p: number = far.from + k,
        b = Math.floor(p / BLOCK_LOTS);
      assert.equal(far.x[k], all.x[p]);
      assert.equal(far.z[k], all.z[p]);
      // (Within its block: a lot's middle lies inside the block it is of.)
      const bx = all.blocks.x[b]!,
        bz = all.blocks.z[b]!,
        yaw = all.blocks.yaw[b]!,
        dx = far.x[k]! - bx,
        dz = far.z[k]! - bz,
        u = dx * Math.cos(yaw) - dz * Math.sin(yaw),
        v = dx * Math.sin(yaw) + dz * Math.cos(yaw);
      assert.ok(
        Math.abs(u) <= BLOCK_W / 2 + 1e-3 && Math.abs(v) <= BLOCK_D / 2 + 1e-3,
        `${s.name}: lot ${p} off its block (${u.toFixed(1)}, ${v.toFixed(1)})`,
      );
      assert.ok(!wetGround(plan.site, far.x[k]!, far.z[k]!), `${s.name}: lot ${p} on the water`);
      if (far.level[k]! >= 0) homes++;
    }
    // What stands on each is what its runs past the drawn say: a home where they built one, at their level, once done by
    // the moment its plan came (one raised higher a level lower till then; one not yet built, none).
    let undone = 0;
    for (const run of plan.beyond ?? []) {
      const [kind, lo, hi, , , lv] = run as number[];
      if (kind !== 0 && kind !== 1) continue;
      for (let p = lo!; p < Math.min(hi!, far.from + far.count); p++) {
        const k: number = p - far.from,
          b = Math.floor(p / BLOCK_LOTS) - far.first,
          done = progress(beganAt(run, p), (plan.months[lv!] ?? 3) * MONTH, world.now) >= 1;
        if (!done) undone++;
        if (far.laid[b] && p >= (plan.ash ?? 0))
          assert.equal(
            far.level[k],
            done ? lv : kind === 1 ? Math.max(0, lv! - 1) : -1,
            `${s.name}: lot ${p}`,
          );
      }
    }
    assert.ok(undone < far.count, `${s.name}: ${undone} of its lots not yet done`);
    // No roof of its haze among them: each past its lots' farthest toward its bearing.
    const roofs = scene.sprawlRoofs ?? new Float32Array();
    for (let i = 0; i < roofs.length; i += 8) {
      const x = roofs[i]!,
        z = roofs[i + 1]!,
        a = Math.atan2(z, x);
      assert.ok(
        Math.hypot(x, z) >= outlineAt(far.outline, a),
        `${s.name}: a roof of its haze at ${x.toFixed(0)}, ${z.toFixed(0)} among its lots`,
      );
    }
    // And drawn: its homes past the drawn stand in its parts (a far one whole when the eye is on it).
    const k0 = far.level.findIndex((l) => l >= 0);
    if (k0 < 0) continue;
    const eye = { x: far.x[k0]!, z: far.z[k0]! },
      detail = townDetail(scene, eye),
      parts = new TownParts();
    assert.equal(
      detail.drawn[far.from + k0],
      1,
      `${s.name}: the home under the eye is drawn whole`,
    );
    townHomesSeen(scene, detail, world.now, parts);
    let near = 0;
    for (const g of parts.groups.values())
      for (let i = 0; i < g.data.length; i += 7)
        if (Math.hypot(g.data[i]! - eye.x, g.data[i + 2]! - eye.z) < 3) near++;
    assert.ok(near >= 2, `${s.name}: ${near} parts at the home under the eye`);
    assert.ok(scene.states.what.includes(LOT.home));
  }
  assert.ok(
    farLots > 2000 && homes > 500,
    `${farLots} lots past those drawn, ${homes} homes on them`,
  );
});

test("a home seen from afar is the same building, only less of it: every part of it as it stands whole, in the same place and colour", () => {
  let looked = 0;
  for (const { plan } of great) {
    const scene = townScene(plan, world.now);
    for (const [i, look] of scene.looks.entries())
      for (let level = 0; level <= 6; level++) {
        const whole = new TownParts(),
          parts = (o: TownParts) => {
            const out = new Set<string>();
            for (const [key, g] of o.groups)
              for (let j = 0; j < g.data.length; j += 7)
                out.add([key, ...g.data.slice(j, j + 7).map((v) => v.toFixed(3))].join("|"));
            return out;
          };
        homeAt(whole, look, level, 30 + i, -40, 0.7, 2);
        const all = parts(whole);
        for (const fine of [1, 0]) {
          const lighter = new TownParts();
          homeAt(lighter, look, level, 30 + i, -40, 0.7, fine);
          const some = parts(lighter);
          assert.ok(some.size > 0, `level ${level}: nothing as seen from afar`);
          for (const p of some)
            assert.ok(all.has(p), `level ${level} fine ${fine}: ${p} not of it whole`);
          looked++;
        }
      }
  }
  assert.ok(looked >= 20, `${looked} looked at`);
});
