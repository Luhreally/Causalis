import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY, YEAR, seedFromText } from "../../src/kernel/index.ts";
import { EARTH } from "../../src/host/planet.ts";
import { populationContext } from "../../src/sim/index.ts";
import { weatherAt } from "../../src/view/index.ts";
import type { ActsMap, LandSky } from "../../src/bridge/index.ts";

// Phase 30 M162: a land's sky — its climate, this year's rain, the god's acts on it now — for the
// near views to play its weather. The first light's world, a few years on.
const world = EARTH.build(seedFromText("first light"));
world.runTo(3 * YEAR + DAY / 2);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T,
  ctx = populationContext(world),
  lands = [...ctx.provinces.all()].sort((a, b) => b.total() - a.total() || a.cell - b.cell),
  cell = lands[0]!.cell;

test("a land's sky: its climate as the world made it, and this year's rain", () => {
  const sky = ask<LandSky>("land.sky", { cell });
  assert.equal(sky.cell, cell);
  assert.ok(sky.wet > 0 && sky.wet < 6000, `${sky.wet} mm`);
  assert.ok(sky.warmth > -40 && sky.warmth < 40, `${sky.warmth}°`);
  assert.ok(sky.swing >= 0 && sky.swing < 40, `±${sky.swing}°`);
  assert.equal(sky.year, lands[0]!.rain / 1000);
  assert.equal(sky.sent, 0);
  assert.deepEqual(sky.acts, []);
  assert.deepEqual(ask<LandSky>("land.sky", { cell }), sky, "the same asked again");
  // (Lands differ: not every land the same sky.)
  const others = lands.slice(1, 12).map((p) => ask<LandSky>("land.sky", { cell: p.cell }));
  assert.ok(new Set(others.map((s) => Math.round(s.wet))).size > 3);
});

test("the god's rain sent on a land falls on it at once; withheld, its sky is bare", () => {
  world.submit("act.rain", { cell, sign: 1, years: 2 });
  world.runTo(world.now + 3600);
  const sky = ask<LandSky>("land.sky", { cell });
  assert.equal(sky.sent, 1);
  assert.ok(
    sky.acts.some((a) => a.kind === "rain" && a.cell === cell),
    "its mark on the land",
  );
  let wet = 0;
  for (let h = 0; h < 48; h += 4) if (weatherAt(sky, world.now + h * 3600, 3600).rain > 0) wet++;
  assert.ok(wet >= 8, `rain in ${wet} of 12 spells`);
  // Every act's mark knows the land it fell on (a land's own), none another's.
  for (const m of ask<ActsMap>("acts.map").acts) if (m.kind === "rain") assert.equal(m.cell, cell);
  for (const p of lands.slice(1, 6))
    assert.equal(
      ask<LandSky>("land.sky", { cell: p.cell }).sent,
      0,
      "the land beside it is left be",
    );
  world.submit("act.rain", { cell, sign: -1, years: 2 });
  world.runTo(world.now + 3600);
  const dry = ask<LandSky>("land.sky", { cell });
  assert.equal(dry.sent, -1, "the last act stands");
  for (let h = 0; h < 48; h += 4)
    assert.equal(weatherAt(dry, world.now + h * 3600, 3600).rain, 0, "none falls");
});
