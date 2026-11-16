// What drives a world's works where nothing is burned (gen/carriers.ts), and the road a people's machines take
// (gen/far.ts machinesRoad): fuel first, then their rivers' fall, wind, hot ground or the atom, read off the world.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { EARTHLIKE, OPEN, fissileShare } from "../../src/rules/index.ts";
import {
  WORKS_WATTS,
  bestCarrier,
  carriersOf,
  generateHomeWorld,
  machinesRoad,
  provinceWorld,
  surfaceOre,
} from "../../src/gen/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { folksNear } from "../../src/sim/index.ts";

const earth = provinceWorld(generateHomeWorld(seedFromText("first light"), EARTHLIKE)),
  alien = provinceWorld(generateHomeWorld(seedFromText("alien 41"), OPEN));

test("the fissile share of uranium is Earth's at Earth's age, more on a younger world, less on an older", () => {
  assert.ok(Math.abs(fissileShare(4.54) - 0.0072) < 1e-6, `${fissileShare(4.54)}`);
  assert.ok(fissileShare(2) > 0.03, `${fissileShare(2)}`);
  assert.ok(fissileShare(9) < 0.001, `${fissileShare(9)}`);
});

test("a world's lands carry current by their rivers' fall, wind and hot ground, read off the world as made", () => {
  for (const g of [earth, alien]) {
    const c = carriersOf(g);
    assert.equal(carriersOf(g), c, "kept by world");
    let water = 0,
      wind = 0,
      heat = 0;
    for (let land = 0; land < c.water.length; land++) {
      water += c.water[land]!;
      wind += c.wind[land]!;
      heat += c.heat[land]!;
      for (const v of [c.water[land]!, c.wind[land]!, c.heat[land]!, c.atom[land]!])
        assert.ok(Number.isFinite(v) && v >= 0, `land ${land}: ${v}`);
    }
    // (Earth's rivers could give some terawatts, its wind tens; ground heat some hundred gigawatts. Within a few
    // powers of ten of those, on a world like it.)
    assert.ok(water > 1e11 && water < 1e14, `rivers ${water.toExponential(2)} W`);
    assert.ok(wind > 0, `wind ${wind.toExponential(2)} W`);
    assert.ok(heat > 0, `ground heat ${heat.toExponential(2)} W`);
  }
});

test("a people's machines take fuel where a seam is, another road where none is and they know electricity", () => {
  const g = earth,
    coal: number[] = [],
    bare: number[] = [];
  for (let c = 0; c < g.grid.count; c++)
    if (g.tectonics.elevation[c]! > 0) (surfaceOre(g, c, "coal") ? coal : bare).push(c);
  assert.ok(coal.length && bare.length);
  const crafts =
    (...ids: string[]) =>
    (id: string) =>
      ids.includes(id);
  assert.equal(machinesRoad(g, crafts("factories"), coal)?.road, "fuel");
  // (Without a seam, works want current: not before electricity, and only where the lands carry enough of it.)
  assert.equal(machinesRoad(g, crafts("factories"), bare), null);
  const best = bestCarrier(g, bare, false)!,
    open = machinesRoad(g, crafts("factories", "electricity"), bare, best.watts / WORKS_WATTS / 2);
  assert.ok(open && open.road === best.road, JSON.stringify(open));
  assert.ok(Math.abs(open.slow - 1.5) < 1e-9, `${open.slow}: twice as much current as asked`);
  assert.equal(
    machinesRoad(g, crafts("factories", "electricity"), bare, (2 * best.watts) / WORKS_WATTS),
    null,
    "more people than the current drives",
  );
});

test("first light's followed peoples all come to the stars, those without fuel by another road, and say which", () => {
  const folks = folksNear(EARTH.build(seedFromText("first light"))).filter((f) => f.followed);
  assert.ok(folks.length >= 6);
  for (const f of folks) assert.equal(f.ceiling, "stars", `${f.name}: ${f.shut}`);
  const driven = folks.filter((f) => f.drives);
  assert.ok(driven.length >= 1, "none driven by another road than fuel");
  for (const f of driven) assert.match(f.drives!, /^Their works are driven by .*, not by fuel/);
});
