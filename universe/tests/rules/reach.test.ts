// W2 (war-reach-plan.md): what a wing's numbers come to, on real anchors. Pure.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CARRIED_ENGINES,
  MISS_EYE,
  MISS_STEADIED,
  PRINCIPLES,
  askWkg,
  canBurn,
  deadlyGround,
  energyAt,
  flyerOn,
  hitShare,
  liftingEngine,
  loadShare,
  lotsPerDrop,
  matterShuts,
  meansWorldOf,
  missOf,
  principle,
  reachKm,
  rowReadings,
  sightTerm,
  strikeOf,
  SOLAR,
  type MeansWorld,
} from "../../src/rules/index.ts";

const [STEAM, OIL] = CARRIED_ENGINES as readonly [
  (typeof CARRIED_ENGINES)[number],
  (typeof CARRIED_ENGINES)[number],
];
const world = (gravity: number, kind: "rocky" | "methane" = "rocky", celsius = 15): MeansWorld =>
  meansWorldOf({ chem: SOLAR, kind, celsius, gravity, medium: "land", bodyFire: true, insolation: 1 });

test("the ground made deadly grows as energy to the 2/3 power, and a drop of ordinary charge flattens a lot", () => {
  assert.ok(Math.abs(lotsPerDrop(4.2) - 1) < 1e-9);
  const small = deadlyGround(1000),
    big = deadlyGround(8000);
  assert.ok(Math.abs(big / small - 4) < 1e-9);
  assert.equal(deadlyGround(0), 0);
  assert.equal(energyAt(100, 4.2), 210);
  // (Fifteen thousand tonnes' worth, 6.3e7 MJ: about the ground of Hiroshima's heaviest blast, half a square kilometre.)
  const fifteen = deadlyGround(6.3e7) / 1e6;
  assert.ok(fifteen > 0.4 && fifteen < 0.8, `${fifteen} km²`);
});

test("Titan's numbers make flying trivially easy, Mars's very hard, Earth's what its first bombers asked", () => {
  const titan = { airBar: 1.45, kelvin: 94, pull: 0.138 },
    mars = { airBar: 0.006, kelvin: 210, pull: 0.38 },
    earth = { airBar: 1, kelvin: 288.15, pull: 1 };
  assert.ok(Math.abs(askWkg(earth) - 80) < 1e-9);
  assert.ok(askWkg(titan) < 2.5, `${askWkg(titan)}: a person's arms give more`);
  assert.ok(askWkg(mars) > 100);
  // (Even if it burned, an engine breathing Mars's air gives under what flying asks there.)
  assert.ok(loadShare(OIL, mars) < 0);
  assert.ok(loadShare(OIL, titan) > 0.3);
});

test("what lifts: Earth flies on oil and not steam; a light world on steam; a heavy one never", () => {
  assert.equal(liftingEngine(world(1))?.id, "engines");
  assert.equal(liftingEngine(world(0.75))?.id, "steam-engine");
  assert.equal(liftingEngine(world(2.2)), null);
  // (Where nothing burns, whatever its numbers: F1's list.)
  const cold = world(0.4, "methane", -180);
  assert.equal(canBurn(cold), false);
  assert.equal(liftingEngine(cold), null);
  assert.ok(askWkg(cold) < 20);
});

test("a machine's look follows the numbers: thick air and light pull huge and slow, heavy pull short", () => {
  const earth = flyerOn(OIL, world(1)),
    light = flyerOn(OIL, world(0.6)),
    heavy = flyerOn(OIL, world(1.5)),
    thick = flyerOn(OIL, { airBar: 5, kelvin: 288.15, pull: 1 });
  assert.ok(light.spanM > 1.5 * earth.spanM && light.kg > 3 * earth.kg);
  assert.ok(heavy.spanM < earth.spanM);
  assert.ok(thick.spanM > earth.spanM && thick.speed < earth.speed / 2);
  assert.ok(earth.spanM > 12 && earth.spanM < 25, `${earth.spanM} m`);
  assert.ok(earth.speed > 30 && earth.speed < 70);
});

test("reach is fuel by what it gives by lift over drag, over pull: Earth's first some hundreds of kilometres", () => {
  const r = reachKm(OIL, { pull: 1 });
  assert.ok(r > 400 && r < 800, `${r} km`);
  assert.ok(reachKm(OIL, { pull: 0.5 }) > 1.9 * r);
  assert.ok(reachKm(STEAM, { pull: 1 }) < r / 3);
});

test("what steers: by the eye most of a load misses a small town, steadied little does", () => {
  assert.equal(missOf(false), MISS_EYE);
  assert.equal(missOf(true), MISS_STEADIED);
  assert.ok(hitShare(100, MISS_EYE) < 0.1);
  assert.ok(hitShare(100, MISS_STEADIED) > 0.99);
  const by = (miss: number) =>
    strikeOf({ flyers: 20, loadKg: 950, mjPerKg: 4.2, miss, lots: 400, people: 2000 });
  assert.ok(by(MISS_STEADIED).flattened > 2 * by(MISS_EYE).flattened);
});

test("a strike never takes more than its share, and none where nothing is dropped", () => {
  const huge = strikeOf({ flyers: 2000, loadKg: 5000, mjPerKg: 4.2, miss: 30, lots: 100, people: 1000 });
  assert.equal(huge.share, 0.5);
  assert.equal(huge.dead, 50);
  const none = strikeOf({ flyers: 0, loadKg: 950, mjPerKg: 4.2, miss: 300, lots: 100, people: 1000 });
  assert.equal(none.share, 0);
  assert.equal(none.dead, 0);
});

test("sight is exactly 1 with no flyers, and worth at most its share", () => {
  assert.equal(sightTerm(0, 0), 1);
  assert.equal(sightTerm(0, 500), 1);
  assert.ok(Math.abs(sightTerm(500, 0) - 1.12) < 1e-12);
  assert.ok(Math.abs(sightTerm(500, 500) - 1.06) < 1e-12);
});

test("the rows come last, in need order, and ask their world's matter", () => {
  const ids = PRINCIPLES.map((p) => p.id);
  assert.deepEqual(ids.slice(-2), ["powered-wings", "dropped-loads"]);
  assert.deepEqual(principle("powered-wings").asks, ["fly-under-power"]);
  assert.ok(principle("dropped-loads").needs.includes("powered-wings"));
  assert.deepEqual(principle("powered-wings").effects, {});
});

test("the page says what it does and what shuts it, in words true both ways", () => {
  const read = (n: MeansWorld) =>
      rowReadings({ chem: SOLAR, means: n }).find((r) => r.id === "fly-under-power")!,
    earth = read(world(1)),
    cold = read(world(0.4, "methane", -180)),
    heavy = read(world(2.5));
  assert.equal(earth.met, true);
  assert.match(earth.why, /Flying asks 80 W/);
  assert.match(earth.why, /engine that burns oil/);
  assert.equal(cold.met, false);
  assert.match(cold.why, /nothing burns in its air/);
  assert.doesNotMatch(cold.why, /flies|lifts/);
  assert.equal(heavy.met, false);
  assert.match(heavy.why, /nothing is left to carry anyone/);
  assert.equal(matterShuts({ asks: ["fly-under-power"] }, [cold]), cold);
  assert.equal(matterShuts({ asks: ["fly-under-power"] }, [earth]), null);
});
