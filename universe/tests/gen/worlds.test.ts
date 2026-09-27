import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { COVER, otherWorld } from "../../src/gen/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { civilizationsNear, homePlanet } from "../../src/sim/index.ts";
import { worldColors } from "../../src/view/index.ts";
import type { WorldGlobe } from "../../src/bridge/index.ts";

const world = EARTH.build(seedFromText("first light"));
world.runTo(2 * YEAR);
const g = homePlanet(world).generated,
  bodies = g.system.bodies,
  globe = (ref: string) => EARTH.queries["world.globe"]!(world, { ref }) as WorldGlobe;

test("any world of the star's system is made whole: the same world every time, and looking changes nothing", () => {
  const before = JSON.stringify(world.domainHashes());
  for (const b of bodies.filter((x) => x.kind !== "home")) {
    const parent = bodies.find((x) => x.ref === b.orbit.around),
      au = b.kind === "moon" ? parent!.orbit.a : b.orbit.a,
      one = otherWorld(b, g.star, au, g.digest),
      two = otherWorld(b, g.star, au, g.digest);
    assert.deepEqual(one.elevation, two.elevation, `${b.designation}: the same relief`);
    assert.deepEqual(one.cover, two.cover);
    assert.equal(one.elevation.length, one.grid.count);
    assert.ok(
      one.temperature.every((t) => t >= -270),
      "no colder than space",
    );
    // A giant has no ground: an even sphere of banded cloud.
    if (b.kind === "giant" || b.kind === "ice giant") {
      assert.ok(one.elevation.every((e) => e === 0) && one.bands >= 4);
      continue;
    }
    // Craters only where no thick air wore them away; seas only where water lies liquid, ice where it lies frozen.
    assert.equal(one.craters > 0, b.air === "none" || b.air === "trace" || b.air === "thin");
    const has = (k: number) => one.cover.some((c) => c === k);
    assert.equal(has(COVER.sea), b.water === "seas", `${b.designation}: seas`);
    if (b.water === "ice") assert.ok(has(COVER.ice), `${b.designation}: ice`);
    if (b.water === "none") assert.ok(!has(COVER.ice) && !has(COVER.sea));
  }
  // Another universe's same body is another world.
  const b = bodies.find((x) => x.kind === "rocky")!,
    here = otherWorld(b, g.star, b.orbit.a, g.digest),
    there = otherWorld(b, g.star, b.orbit.a, `${g.digest} elsewhere`);
  assert.notDeepEqual(here.elevation, there.elevation);
  // Asked of the host: kept, and history untouched.
  assert.equal(globe(b.ref), globe(b.ref));
  assert.equal(JSON.stringify(world.domainHashes()), before);
});

test("a world is painted by what covers it: seas blue, ice white, a giant in bands", () => {
  for (const b of bodies.filter((x) => x.kind !== "home")) {
    const w = globe(b.ref),
      rgba = worldColors(w),
      n = w.elevation.length;
    assert.equal(rgba.length, n * 4);
    for (let c = 0; c < n; c += 97) {
      assert.equal(rgba[4 * c + 3], 255);
      if (w.cover[c] === COVER.sea) assert.ok(rgba[4 * c + 2]! > rgba[4 * c]!, "seas blue");
      if (w.cover[c] === COVER.ice)
        assert.ok(rgba[4 * c]! > 190 && rgba[4 * c + 2]! > 200, "ice white");
    }
    if (b.kind === "giant" || b.kind === "ice giant") {
      const colours = new Set<string>();
      for (let c = 0; c < n; c += 13)
        colours.add(`${rgba[4 * c]},${rgba[4 * c + 1]},${rgba[4 * c + 2]}`);
      assert.ok(colours.size >= 3, `${b.designation}: bands of ${colours.size} colours`);
    }
  }
});

test("another people's world is alive, and its people and their lights are shown as the chronicle stands", () => {
  const civs = civilizationsNear(world);
  assert.ok(civs.length >= 1, "the cluster holds other peoples");
  const c = civs.find((x) => x.electronics < 0) ?? civs[0]!,
    w = EARTH.queries["world.globe"]!(world, { star: c.star, index: c.planet }) as WorldGlobe;
  assert.ok(w.living, "life greens a world with seas about an old star");
  assert.equal(w.people?.electronics, c.electronics);
  const lit = (year: number) => {
    const rgba = worldColors(w, year);
    let n = 0;
    for (let i = 0; i < w.cover.length; i++)
      if (rgba[4 * i]! > 250 && rgba[4 * i + 1]! > 240 && rgba[4 * i + 2]! > 200) n++;
    return n;
  };
  assert.ok(lit(c.electronics + 1) > 0, "their lights once they have electronics");
  assert.equal(lit(c.electronics - 1), 0, "and none before");
});
