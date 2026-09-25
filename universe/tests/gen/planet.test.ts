import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText, sphereGrid, type Ref } from "../../src/kernel/index.ts";
import { EARTHLIKE, OPEN } from "../../src/rules/index.ts";
import { BIOME, DEPOSIT_KINDS, generateHomeWorld, type HomeWorld } from "../../src/gen/index.ts";
import { makePlanetWorld } from "../../src/sim/index.ts";
import { spine, why } from "../../src/causal/index.ts";

test("the sphere grid has 10f²+2 cells, twelve pentagons, symmetric neighbours and the whole area", () => {
  for (const f of [1, 3, 16]) {
    const g = sphereGrid(f);
    assert.equal(g.count, 10 * f * f + 2);
    assert.equal(g.triangles.length / 3, 20 * f * f);
    let pentagons = 0,
      area = 0;
    for (let c = 0; c < g.count; c++) {
      const degree = g.offsets[c + 1]! - g.offsets[c]!;
      if (degree === 5) pentagons++;
      else assert.equal(degree, 6);
      area += g.areas[c]!;
      for (let k = g.offsets[c]!; k < g.offsets[c + 1]!; k++) {
        const m = g.neighbours[k]!,
          back = Array.from(g.neighbours.subarray(g.offsets[m]!, g.offsets[m + 1]!));
        assert.ok(back.includes(c), `${c}–${m} is mutual`);
      }
    }
    assert.equal(pentagons, 12);
    assert.ok(Math.abs(area - 4 * Math.PI) < 1e-9);
  }
});

const worlds = new Map<string, HomeWorld>();
function earth(seed: string): HomeWorld {
  let w = worlds.get(seed);
  if (!w) worlds.set(seed, (w = generateHomeWorld(seedFromText(seed), EARTHLIKE)));
  return w;
}

test("a world is a pure function of its seed", () => {
  assert.equal(
    generateHomeWorld(seedFromText("first light"), EARTHLIKE).digest,
    earth("first light").digest,
  );
  assert.notEqual(earth("kestrel").digest, earth("first light").digest);
});

function landShares(w: HomeWorld): { land: number; biome: number[] } {
  const biome = new Array<number>(16).fill(0);
  let land = 0;
  for (let c = 0; c < w.grid.count; c++)
    if (w.tectonics.elevation[c]! > 0) {
      land += w.grid.areas[c]!;
      biome[w.climate.biome[c]!] = biome[w.climate.biome[c]!]! + w.grid.areas[c]!;
    }
  return { land, biome: biome.map((a) => a / land) };
}

for (const seed of ["first light", "kestrel", "sea glass"]) {
  test(`the Earth prior gives an Earth-like world (${seed})`, () => {
    const w = earth(seed),
      { land, biome } = landShares(w),
      e = w.tectonics.elevation;
    const t = w.climate.temperature;
    let mean = 0,
      high = -Infinity,
      deep = Infinity,
      equator = 0,
      eqN = 0,
      pole = 0,
      poleN = 0;
    for (let c = 0; c < w.grid.count; c++) {
      mean += t[c]! * w.grid.areas[c]!;
      high = Math.max(high, e[c]!);
      deep = Math.min(deep, e[c]!);
      const lat = Math.abs(w.grid.lat[c]!);
      if (lat < 0.2) {
        equator += t[c]!;
        eqN++;
      } else if (lat > 1.35) {
        pole += t[c]!;
        poleN++;
      }
    }
    mean /= 4 * Math.PI;
    const landFraction = land / (4 * Math.PI);
    assert.ok(landFraction > 0.24 && landFraction < 0.36, `land ${landFraction}`);
    assert.ok(mean > 9 && mean < 19, `mean temperature ${mean}`);
    assert.ok(equator / eqN > 20 && pole / poleN < -5, "warm equator, cold poles");
    assert.ok(high > 3000 && high < 11000, `highest ${high}`);
    assert.ok(deep < -5000 && deep > -12000, `deepest ${deep}`);
    const deserts = biome[BIOME.hotDesert]! + biome[BIOME.coldDesert]!,
      forests =
        biome[BIOME.tropicalRainforest]! +
        biome[BIOME.tropicalDryForest]! +
        biome[BIOME.temperateForest]! +
        biome[BIOME.temperateRainforest]! +
        biome[BIOME.borealForest]!;
    assert.ok(deserts > 0.05 && deserts < 0.35, `deserts ${deserts}`);
    assert.ok(forests > 0.25 && forests < 0.75, `forests ${forests}`);
    assert.ok(biome[BIOME.ice]! + biome[BIOME.tundra]! > 0.02, "some cold land");
    for (const kind of DEPOSIT_KINDS)
      assert.ok(
        w.deposits.some((d) => d.kind === kind),
        `a ${kind} deposit`,
      );
    assert.ok(w.water.river.reduce((s, v) => s + v, 0) > 200, "rivers");
  });
}

test("the open prior makes worlds that differ, and none of them breaks", () => {
  const oceans: number[] = [],
    temps: number[] = [];
  for (let i = 0; i < 8; i++) {
    const w = generateHomeWorld(seedFromText(`alien ${i}`), OPEN, 16);
    oceans.push(w.planet.oceanFraction);
    temps.push(w.planet.meanTemperature);
    for (let c = 0; c < w.grid.count; c++) {
      assert.ok(Number.isFinite(w.tectonics.elevation[c]!));
      assert.ok(Number.isFinite(w.climate.temperature[c]!));
      assert.ok(Number.isFinite(w.climate.precipitation[c]!) && w.climate.precipitation[c]! >= 0);
    }
  }
  assert.ok(Math.max(...oceans) - Math.min(...oceans) > 0.3, `oceans ${oceans}`);
  assert.ok(Math.max(...temps) - Math.min(...temps) > 20, `temperatures ${temps}`);
});

test("why walks from an ore body through the plates and the planet to the star", () => {
  const world = makePlanetWorld(seedFromText("first light")),
    w = earth("first light"),
    copper = w.deposits.find((d) => d.kind === "copper" && d.plates.length === 2)!;
  const node = why(world, copper.ref as Ref);
  assert.equal(node.basis, "generated");
  assert.match(node.claim, /copper, laid down by arc magmatism/);
  const trigger = node.causes.find((c) => c.cause.role === "trigger")!.next();
  assert.match(trigger.claim, /oceanic plate/);
  const path = spine(world, copper.ref as Ref);
  assert.deepEqual(
    path.map((e) => e.ref.split(":")[0]),
    ["depo", "plate", "plnt", "star"],
  );
  assert.ok(path.every((e) => e.basis === "generated"));
});
