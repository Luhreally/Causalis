import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCombat, type CombatSide } from "../../src/rules/index.ts";
import { newBattle, battleAt, combatAt, BATTLE_LENGTH } from "../../src/view/index.ts";
import type { BattleNear } from "../../src/bridge/index.ts";

const foot: CombatSide = {
  fielded: 600,
  power: 600,
  shock: 0.7,
  protection: 0.3,
  range: 0.1,
  fire: 0,
  care: 0.4,
  blow: "point",
};
function field(a: CombatSide, b: CombatSide) {
  const r = resolveCombat([a, b], 70, () => 0.5),
    side = (s: CombatSide, k: 0 | 1) => ({
      ref: `realm:${k}`,
      name: `Host ${k}`,
      color: [0.6, 0.2, 0.2] as const,
      arms: null,
      fielded: s.fielded,
      fallen: r.dead[k],
      host: { arm: "spear", guard: "shield", mount: "" },
      kit: "spears and shields",
    }),
    near: BattleNear = {
      event: "ev:combat",
      war: "war:combat",
      title: "A field",
      cell: 1,
      land: "The field",
      year: 100,
      attacker: side(a, 0),
      defender: side(b, 1),
      won: r.won,
      outcome: r.won ? "field" : "held",
      civil: null,
      hills: false,
      river: false,
      walls: 0,
      town: null,
      figure: null,
      combat: r.combat,
      plan: {
        seed: "combat",
        ages: [{ index: 0, from: 0, to: 0, kind: "quiet", seaLevel: 0, warmth: 0, forests: true }],
        lineages: [],
      },
    };
  return newBattle(near, 360);
}

test("a recorded morale break controls actual troop retreat and casualty timing", () => {
  const f = field({ ...foot, fielded: 1800, power: 1800 }, foot),
    r = f.near.combat!,
    when = r.rout!;
  assert.notEqual(when, 108);
  const before = battleAt(f, when - 0.01),
    after = battleAt(f, Math.min(149, when + 8));
  assert.ok(before.troopers.every((t) => t.act !== "flee"));
  assert.ok(after.troopers.some((t) => t.side === r.broken && t.act === "flee"));
  assert.ok(!after.troopers.some((t) => t.side !== r.broken && t.act === "flee"));
  for (const s of [20, 50, when, 149]) {
    const now = battleAt(f, s);
    assert.ok(now.troopers.every((t) => Number.isFinite(t.x + t.y + t.z + t.yaw + t.size)));
  }
  assert.deepEqual(
    battleAt(f, BATTLE_LENGTH).fallen,
    f.hosts.map((h) => h.falls),
  );
  assert.ok(combatAt(f.near, when)!.morale[r.broken as 0 | 1] < 0.34);
});

test("an inconclusive fight has no rout, pursuit, or invented victory celebration", () => {
  const f = field(foot, foot);
  assert.equal(f.near.combat!.broken, -1);
  for (const s of [108, 130, 149, 150]) {
    const now = battleAt(f, s);
    assert.ok(now.troopers.every((t) => t.act !== "flee" && t.act !== "cheer"));
    assert.ok(now.troopers.every((t) => Number.isFinite(t.x + t.y + t.z + t.yaw + t.size)));
  }
  assert.match(battleAt(f, 150).words, /Neither line breaks/);
});

test("field casualties follow the recorded exchange curve, independently of display detail", () => {
  const f = field({ ...foot, power: 1800 }, foot),
    frames = f.near.combat!.frames;
  for (const frame of frames) {
    const now = battleAt(f, frame.at);
    for (const k of [0, 1] as const)
      assert.ok(Math.abs(now.fallen[k] * f.per - frame.dead[k]) <= f.per * 2);
  }
});
