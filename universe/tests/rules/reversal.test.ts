// A world's field turning over (rules/planet.ts turnRate, fieldTurn): how often by its core, how weak, and what
// then reaches the ground.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REVERSAL,
  fieldTurn,
  flareThrough,
  magnetosphereOf,
  turnBegun,
  turnRate,
  type MagnetosphereInputs,
} from "../../src/rules/index.ts";

const EARTH: MagnetosphereInputs = {
  mass: 1,
  radius: 1,
  dayHours: 24,
  ageGyr: 4.6,
  plates: 12,
  feH: 0,
  orbitAu: 1,
  starMass: 1,
  air: 1,
};

test("Earth's field turns over about once in 250,000 years, for some four thousand", () => {
  const r = turnRate(magnetosphereOf(EARTH), EARTH);
  assert.equal(r.turnYears, REVERSAL.turnYears);
  assert.ok(
    Math.abs(r.turnYears / r.chance - REVERSAL.everyYears) < 1,
    `${r.turnYears / r.chance}`,
  );
});

test("a world turning nearly too slowly for one pole turns over often; no dipole, no dynamo: never", () => {
  const slow = { ...EARTH, dayHours: 30 },
    rs = turnRate(magnetosphereOf(slow), slow),
    re = turnRate(magnetosphereOf(EARTH), EARTH);
  assert.ok(rs.chance > 5 * re.chance);
  const tangled = { ...EARTH, dayHours: 60 };
  assert.equal(turnRate(magnetosphereOf(tangled), tangled).chance, 0);
  const dead = { ...EARTH, mass: 0.1, radius: 0.5 };
  assert.equal(turnRate(magnetosphereOf(dead), dead).chance, 0);
  // A bigger core takes longer to turn; a core with little heat left turns seldom.
  const big = { ...EARTH, mass: 3, radius: 1.35 };
  assert.ok(turnRate(magnetosphereOf(big), big).turnYears > 6000);
  const old = { ...EARTH, ageGyr: 12 };
  assert.ok(turnRate(magnetosphereOf(old), old).chance < re.chance);
});

test("a turn is read from the year alone: the same each time, a tenth at its middle, whole at its ends", () => {
  const rate = { turnYears: 2000, chance: 0.3 };
  let spans = 0,
    weakYears = 0;
  const begun = new Set<number>();
  for (let y = 0; y < 400000; y += 100) {
    const t = fieldTurn(12345, y, rate);
    assert.deepEqual(t, fieldTurn(12345, y, rate));
    if (!t) continue;
    weakYears++;
    assert.ok(y >= t.from && y < t.to);
    assert.ok(t.weak >= REVERSAL.low - 1e-9 && t.weak <= 1);
    if (!begun.has(t.from)) {
      begun.add(t.from);
      spans++;
      const mid = fieldTurn(12345, t.from + 1000, rate)!;
      assert.ok(mid.weak < 0.11);
      assert.ok(fieldTurn(12345, t.from, rate)!.weak > 0.99);
      // A step of many years finds its beginning once.
      assert.equal(turnBegun(12345, t.from - 1, t.from + 500, rate)!.from, t.from);
      assert.equal(turnBegun(12345, t.from, t.from + 500, rate), null);
    }
  }
  assert.ok(spans > 40 && spans < 80, `${spans} of 200 spans at 3 in 10`);
  assert.ok(weakYears > 0);
  assert.equal(fieldTurn(12345, 500, { turnYears: 2000, chance: 0 }), null);
  // Another world's turns fall elsewhere.
  let differ = 0;
  for (let y = 0; y < 400000; y += 2000)
    if (!!fieldTurn(12345, y, rate) !== !!fieldTurn(999, y, rate)) differ++;
  assert.ok(differ > 20);
});

test("while it turns the field shelters less, and a flare reaches the ground", () => {
  const whole = magnetosphereOf(EARTH),
    weak = magnetosphereOf({ ...EARTH, weak: REVERSAL.low });
  assert.ok(Math.abs(weak.moment - REVERSAL.low * whole.moment) < 1e-9);
  assert.ok(weak.standoff < whole.standoff);
  assert.ok(weak.shelter < whole.shelter - 0.03);
  assert.ok(weak.dose > whole.dose);
  assert.ok(flareThrough(3, weak.shelter) > flareThrough(3, whole.shelter) * 1.02);
});
