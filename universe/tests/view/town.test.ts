import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME_LIFE, HOME_MONTHS, LEVEL } from "../../src/rules/index.ts";
import type { TownPlan } from "../../src/bridge/index.ts";
import { TownParts, homeWear, townGround, townHomes, townScene } from "../../src/view/index.ts";

// Phase 23: a town's homes wear and are rebuilt in their place as the eye watches — never long
// without a scaffold, its oldest streets coming in time to its land's newest look; and a great
// city's lots past those drawn are its sprawl.

const YEAR_S = 365 * 86_400;

/** Forty houses raised in year 10; a design of the year 80 the land comes to later. */
function plan(over: Partial<TownPlan> = {}): TownPlan {
  return {
    family: "grid",
    seed: 7,
    axis: 0,
    lots: 40,
    whole: 40,
    runs: [[0, 0, 40, 10, 10, LEVEL.house, -1]],
    civics: [],
    walls: null,
    months: HOME_MONTHS,
    designs: [
      { since: -1, walls: "timber", roof: "thatch", form: "square", pitch: 40 },
      { since: 80, walls: "stone", roof: "tile", form: "square", pitch: 30 },
    ],
    paved: false,
    water: null,
    year: 10,
    ...over,
  };
}

test("a town's homes wear and are rebuilt in their place, each in its level's life, in the land's newest look", () => {
  const p = plan(),
    life = HOME_LIFE[LEVEL.house]! * YEAR_S,
    seen = new Map<number, number[]>();
  // Watched month by month for three lives of a house.
  for (let t = 12 * YEAR_S; t < 12 * YEAR_S + 3.5 * life; t += YEAR_S / 12) {
    const scene = townScene(p, t);
    for (let lot = 0; lot < p.lots; lot++) {
      const w = homeWear(scene, lot, t);
      if (w.at === null) continue;
      const at = seen.get(lot) ?? [];
      if (at.at(-1) !== w.at) at.push(w.at);
      seen.set(lot, at);
      // Rebuilt after the design of the year 80: in it.
      assert.equal(w.look, w.at >= 80 * YEAR_S ? 1 : 0, `lot ${lot} at ${w.at / YEAR_S}`);
    }
  }
  for (let lot = 0; lot < p.lots; lot++) {
    const at = seen.get(lot) ?? [];
    assert.ok(at.length >= 2, `lot ${lot} rebuilt ${at.length} times in three lives`);
    for (let i = 1; i < at.length; i++) {
      const gap = (at[i]! - at[i - 1]!) / life;
      assert.ok(gap >= 0.8 - 1e-9 && gap <= 1.2 + 1e-9, `lot ${lot}: rebuilt ${gap} lives apart`);
    }
  }
  // Their rebuildings fall through the years, not all at once.
  const first = [...seen.values()].map((a) => Math.floor(a[0]! / YEAR_S));
  assert.ok(new Set(first).size >= 8, `first rebuilt over ${new Set(first).size} years`);
});

test("the homes to be rebuilt within the year are drawn as they change; the rest once", () => {
  const p = plan(),
    t = 75 * YEAR_S,
    scene = townScene(p, t);
  for (let lot = 0; lot < p.lots; lot++) {
    const w = homeWear(scene, lot, t),
      takes = HOME_MONTHS[LEVEL.house]! * 30 * 86_400,
      changing = (w.at !== null && t < w.at + takes) || w.next < t + YEAR_S;
    assert.equal(scene.active.includes(lot), changing, `lot ${lot}`);
  }
  // (Drawn, the changing and the standing alike.)
  const parts = new TownParts();
  townHomes(scene, scene.active, t, parts);
  townHomes(scene, scene.settled, t, parts);
  assert.ok(parts.count > 0);
});

test("a great city's lots past those drawn are its sprawl, roofs out to as far as all its lots would reach", () => {
  const near = new TownParts(),
    far = new TownParts();
  townGround(townScene(plan(), 20 * YEAR_S), near);
  townGround(townScene(plan({ whole: 4000 }), 20 * YEAR_S), far);
  assert.ok(far.count > near.count + 500, `${far.count} parts against ${near.count}`);
});
