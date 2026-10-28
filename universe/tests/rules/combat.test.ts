import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveCombat,
  combatMights,
  fightWorld,
  fightBody,
  fightSide,
  stepFight,
  POSSESS_HZ,
  type CombatSide,
  type FightScene,
} from "../../src/rules/index.ts";

const foot: CombatSide = {
  fielded: 1000,
  power: 1000,
  shock: 0.7,
  protection: 0.3,
  range: 0.1,
  fire: 0,
  care: 0.4,
  blow: "point",
};
const draw = () => 0.5;

test("combat exchanges decide the winner; an overwhelming healthy force does not lose on one unlucky draw", () => {
  for (let seed = 0; seed < 40; seed++) {
    const r = resolveCombat(
      [{ ...foot, fielded: 4000, power: 4000 }, foot],
      70,
      (round, side) => ((seed * 19 + round * 13 + side * 7) % 101) / 100,
    );
    assert.equal(r.won, true);
    assert.equal(r.combat.broken, 1);
    assert.ok(r.combat.frames.length <= 38);
    assert.ok(r.combat.frames.at(-1)!.morale[0] > 0.34);
    assert.ok(r.dead[0] < r.dead[1]);
  }
});

test("equal, intact lines can end inconclusively without inventing an attacker rout", () => {
  const r = resolveCombat([foot, foot], 70, draw);
  assert.equal(r.combat.broken, -1);
  assert.equal(r.combat.rout, null);
  assert.equal(r.combat.reason, "stalemate");
  assert.deepEqual(r.dead, [r.dead[1], r.dead[0]]);
});

test("ground and equipment affect exchanges and cohesion; losses remain bounded and replay exactly", () => {
  const weak = { ...foot, power: 600, protection: 0.05 },
    strong = { ...foot, power: 1800, protection: 0.7 };
  const r = resolveCombat([weak, strong], 70, draw),
    copy = resolveCombat([weak, strong], 70, draw);
  assert.deepEqual(copy, r);
  assert.equal(r.combat.broken, 0);
  assert.ok(r.dead[0] > r.dead[1]);
  let last = [0, 0],
    time = 0;
  for (const f of r.combat.frames) {
    assert.ok(f.at >= time && Number.isFinite(f.pressure));
    for (const k of [0, 1] as const) {
      assert.ok(f.dead[k] >= last[k]! && f.dead[k] <= 1000);
      assert.ok(f.morale[k] >= 0 && f.morale[k] <= 1);
    }
    last = [...f.dead];
    time = f.at;
  }
  assert.deepEqual(last, r.dead);
  assert.notEqual(r.combat.rout, 108);
});

test("no troops cannot win or manufacture casualties", () => {
  const r = resolveCombat([{ ...foot, fielded: 0, power: 0 }, foot], 70, draw);
  assert.equal(r.won, false);
  assert.equal(r.dead[0], 0);
});

test("near-balanced pressure survives JSON saves exactly, including rounded zero", () => {
  const r = resolveCombat([foot, foot], 70, (_round, side) => 0.499 + side * 0.001);
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
});

test("possession strength does not depend on who history called the winner", () => {
  assert.deepEqual(combatMights([1000, 1000], [100, 100]), [1, 1]);
  assert.ok(combatMights([2000, 1000], [100, 100])[0] > 1);
  // A larger army supplies more bodies, without also giving every soldier an invented victory buff.
  assert.deepEqual(combatMights([4000, 1000], [400, 100]), [1, 1]);
});

test("an unbroken possessed attacker keeps fighting past second 130", () => {
  const side = fightSide({ blow: "point", protection: 0.3, shock: 0.7 }, "none", false, 1, 10, 0),
    scene: FightScene = {
      cohesion: true,
      sides: [side, side],
      from: 129,
      length: 150,
      meet: 0,
      flanks: false,
    },
    f = fightWorld([
      fightBody(1, 0, { x: -60, z: 0, yaw: 0 }, 1, false),
      fightBody(2, 1, { x: 60, z: 0, yaw: 0 }, 1, false),
    ]);
  for (let n = 0; n < POSSESS_HZ * 4; n++)
    stepFight(scene, f, { mx: 0, mz: 0, run: false, act: 0 }, () => 0.9, false);
  assert.equal(f.broke, -1);
  assert.notEqual(f.bodies[0]!.doing, "flee");
});
