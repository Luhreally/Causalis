import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng, seedFromText } from "../../src/kernel/index.ts";
import {
  clusterStars,
  foreignPlanets,
  imfMass,
  makeGalaxy,
  sectorId,
  sectorStars,
} from "../../src/gen/index.ts";

const rng = new Rng(seedFromText("first light")),
  galaxy = makeGalaxy(rng),
  cluster = clusterStars(rng, galaxy);

test("the cluster: about two thousand stars within fifty light-years, most of them red dwarfs", () => {
  assert.ok(cluster.length > 1500 && cluster.length < 2700, `${cluster.length} stars`);
  const dwarfs = cluster.filter((s) => s.spectral === "MV").length;
  assert.ok(dwarfs > 0.6 * cluster.length, `${dwarfs} red dwarfs`);
  // Home is not among them; the nearest lies a few light-years off.
  assert.ok(cluster.every((s) => s.ref !== "star:0:0" && s.distance > 0));
  assert.ok(cluster[0]!.distance < 8);
  assert.ok(cluster.every((s, i) => i === 0 || s.distance >= cluster[i - 1]!.distance));
});

test("stars are drawn where they are, the same each time; sectors are named from home", () => {
  assert.equal(sectorId(0, 0, 0), 0);
  assert.notEqual(sectorId(1, 0, 0), sectorId(-1, 0, 0));
  assert.deepEqual(
    sectorStars(rng, galaxy, 2, -1, 0),
    sectorStars(new Rng(seedFromText("first light")), galaxy, 2, -1, 0),
  );
  assert.deepEqual(
    clusterStars(
      new Rng(seedFromText("first light")),
      makeGalaxy(new Rng(seedFromText("first light"))),
    ).length,
    cluster.length,
  );
  // Another seed, another sky.
  const other = clusterStars(
    new Rng(seedFromText("alien 3")),
    makeGalaxy(new Rng(seedFromText("alien 3"))),
  );
  assert.notDeepEqual(
    other.slice(0, 5).map((s) => s.distance),
    cluster.slice(0, 5).map((s) => s.distance),
  );
});

test("masses by the initial mass function: from a twelfth of the Sun's to many times it, rising with the draw", () => {
  let last = 0;
  for (let u = 0; u < 1; u += 0.05) {
    const m = imfMass(u);
    assert.ok(m >= 0.08 && m <= 20 && m >= last, `${u} → ${m}`);
    last = m;
  }
  assert.ok(imfMass(0.5) < 0.5, "the median star is a small one");
});

test("each star keeps its own worlds; a dead star keeps none", () => {
  const living = cluster.filter((s) => !s.remnant).slice(0, 20),
    worlds = living.map((s) => foreignPlanets(rng, s));
  assert.ok(worlds.some((w) => w.length > 0));
  assert.deepEqual(foreignPlanets(rng, living[0]!), worlds[0]);
  assert.notDeepEqual(worlds[0], worlds[1]);
  for (const w of worlds)
    for (let i = 1; i < w.length; i++) assert.ok(w[i]!.a > w[i - 1]!.a, "outward");
  const dead = cluster.find((s) => s.remnant);
  if (dead) assert.deepEqual(foreignPlanets(rng, dead), []);
});
