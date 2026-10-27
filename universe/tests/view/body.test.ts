import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APE_FRAME,
  ableWords,
  bodyAt,
  bodyLine,
  deathWords,
  type BattleRoll,
  type DeathBlow,
  type RollEntry,
  type Wound,
} from "../../src/bridge/index.ts";
import { warManOf, warSlot, type TownWarScene } from "../../src/view/index.ts";

// Phase 55 wave 5: a body at a moment (bridge/body.ts) — each member of its people's plan as its
// wounds and the blow that killed it leave it — and who a soldier of the war drawn about a town is
// (view/body.ts). Pure: the same (person, moment) gives the same body, as possession will need.

const DAY = 86400;
const wound = (over: Partial<Wound> = {}): Wound => ({
  event: "evt:7",
  from: "battle",
  year: 100,
  where: "the battle at Pounholt",
  blow: "edge",
  arm: "a bronze axe",
  member: "arm-l",
  words: "~ left arm",
  outcome: "healed",
  how: null,
  lasting: null,
  at: 1000,
  home: 1000 + 10 * DAY,
  up: 1000 + 20 * DAY,
  mended: 1000 + 40 * DAY,
  tended: "healer",
  by: "by Sairis's healer, Mira Vell",
  borne: false,
  ...over,
});
const death: DeathBlow = {
  event: "evt:9",
  from: "battle",
  year: 120,
  where: "the battle at Lithiv",
  blow: "edge",
  arm: "an iron sword",
  member: "head",
  words: "~ head",
  at: 5000,
};
const stateOf = (b: ReturnType<typeof bodyAt>, m: string) =>
  b.members.find((x) => x.member === m)?.state;

test("a body unwounded is whole, every member of its plan", () => {
  const b = bodyAt(APE_FRAME, [], 0);
  assert.deepEqual(
    b.members.map((m) => m.member),
    APE_FRAME.members,
  );
  assert.ok(b.members.every((m) => m.state === "whole"));
  assert.deepEqual(b.able, []);
  assert.equal(bodyLine(b, [], 0, 1), "Whole");
  assert.equal(ableWords(b, 1), null);
});

test("a wound's days: struck away, abed, healing, then as it came out", () => {
  const w = wound({ outcome: "lame", lasting: "stiff" }),
    at = (t: number) => stateOf(bodyAt(APE_FRAME, [w], t), "arm-l");
  assert.equal(at(w.at - 1), "whole");
  assert.equal(at(w.at), "struck");
  assert.equal(at(w.home), "abed");
  assert.equal(at(w.up), "healing");
  assert.equal(at(w.mended), "lame");
  assert.ok(bodyAt(APE_FRAME, [w], w.home).abed);
  assert.deepEqual(bodyAt(APE_FRAME, [w], w.at).able, ["is still with the levy, wounded"]);
  assert.deepEqual(bodyAt(APE_FRAME, [w], w.home).able, ["is abed"]);
  assert.deepEqual(bodyAt(APE_FRAME, [w], w.up).able, ["is up, a wound still bound"]);
  assert.deepEqual(bodyAt(APE_FRAME, [w], w.mended).able, ["keeps an arm stiff"]);
});

test("an arm lost takes its hand from the moment it is dealt", () => {
  const w = wound({ outcome: "lost", how: "cut off", lasting: "stump" }),
    b = bodyAt(APE_FRAME, [w], w.at);
  assert.equal(stateOf(b, "arm-l"), "lost");
  assert.equal(stateOf(b, "hand-l"), "lost");
  assert.equal(stateOf(b, "arm-r"), "whole");
  assert.equal(bodyLine(b, [w], w.at, 1), "Lost his left arm at the battle at Pounholt in 100");
  // (Not yet home: what it leaves him able to do is told once he is up.)
  assert.equal(ableWords(b, 1), "He is still with the levy, wounded.");
  assert.equal(ableWords(bodyAt(APE_FRAME, [w], w.home), 1), "He is abed.");
  assert.equal(ableWords(bodyAt(APE_FRAME, [w], w.mended), 1), "He works one-handed.");
});

test("a leg lost: a crutch; both eyes lost: blind; the gravest told first, two at most", () => {
  const ws = [
      wound({ member: "leg-r", words: "~ right leg", outcome: "lost", lasting: "crutch", at: 10 }),
      wound({ member: "eye-l", words: "an eye", outcome: "lost", lasting: "patch", at: 20 }),
      wound({ member: "eye-r", words: "an eye", outcome: "lost", lasting: "patch", at: 30 }),
      wound({ member: "trunk", words: "~ chest", outcome: "scarred", at: 40 }),
    ],
    t = 1e9,
    b = bodyAt(APE_FRAME, ws, t);
  assert.deepEqual(b.able, ["walks on a crutch", "is blind"]);
  assert.equal(stateOf(b, "trunk"), "scarred");
  const line = bodyLine(b, ws, t, 0);
  assert.ok(line.startsWith("Lost an eye"), line);
  assert.ok(line.endsWith("; and more"), line);
});

test("the blow that killed, from its moment; nothing more it can do", () => {
  const w = wound(),
    before = bodyAt(APE_FRAME, [w], death.at - 1, death),
    after = bodyAt(APE_FRAME, [w], death.at, death);
  assert.equal(before.death, null);
  assert.equal(stateOf(before, "head"), "whole");
  assert.equal(stateOf(after, "head"), "killed");
  assert.deepEqual(after.able, []);
  assert.equal(
    bodyLine(after, [w], death.at, 1),
    "Killed by a blow to his head at the battle at Lithiv in 120, from an iron sword",
  );
  assert.equal(
    deathWords({ ...death, from: "fire", blow: "fire", where: "Sairis" }, 0),
    "killed in Sairis in 120, burned about her head",
  );
});

test("a battle's blows now, over what the wounds left; the same body for the same moment", () => {
  const ws = [wound({ member: "leg-l", words: "~ left leg", outcome: "healed" })],
    t = 1e9,
    b = bodyAt(APE_FRAME, ws, t, null, [{ member: "arm-r", lost: true, fell: false }]);
  assert.equal(stateOf(b, "arm-r"), "lost");
  assert.equal(stateOf(b, "hand-r"), "lost");
  assert.equal(stateOf(b, "leg-l"), "healed");
  assert.equal(
    bodyLine(b, ws, t, 1),
    "Lost his right arm this day; struck in his left leg, healed",
  );
  // (A hand gone with an arm history took is not told as taken this day.)
  const old = [wound({ outcome: "lost", lasting: "stump" })];
  assert.equal(
    bodyLine(bodyAt(APE_FRAME, old, t), old, t, 1),
    "Lost his left arm at the battle at Pounholt in 100",
  );
  assert.deepEqual(
    bodyAt(APE_FRAME, ws, t, null, [{ member: "arm-r", lost: true, fell: false }]),
    b,
  );
  const fell = bodyAt(APE_FRAME, ws, t, null, [{ member: "trunk", lost: false, fell: true }]);
  assert.equal(stateOf(fell, "trunk"), "struck");
  assert.deepEqual(fell.able, []);
});

// —— Who a soldier of the war about a town is ——————————————————————————————————————————————————

test("a war's slot: each side's host, then its fallen", () => {
  assert.deepEqual(warSlot(0, 5), { side: 0, i: 0, fallen: false });
  assert.deepEqual(warSlot(7, 5), { side: 0, i: 2, fallen: true });
  assert.deepEqual(warSlot(12, 5), { side: 1, i: 2, fallen: false });
  assert.deepEqual(warSlot(19, 5), { side: 1, i: 4, fallen: true });
  assert.equal(warSlot(20, 5), null);
  assert.equal(warSlot(-1, 5), null);
  assert.equal(warSlot(1.5, 5), null);
});

test("a figure drawn stands for the same man of the roll, its fallen the roll's fallen", () => {
  const each = 3,
    soldier = (side: 0 | 1, doing: string, size = 1) => ({
      x: 0,
      z: 0,
      yaw: 0,
      side,
      doing,
      size,
    }),
    // (The attackers: two of three standing, one fallen; the defenders: three standing, two fallen.)
    soldiers = [
      soldier(0, "hold"),
      soldier(0, "hold", 0),
      soldier(0, "hold"),
      soldier(0, "fallen", 0),
      soldier(0, "fallen"),
      soldier(0, "fallen", 0),
      soldier(1, "flee"),
      soldier(1, "flee"),
      soldier(1, "flee"),
      soldier(1, "fallen"),
      soldier(1, "fallen"),
      soldier(1, "fallen", 0),
    ],
    scene = { soldiers } as unknown as TownWarScene,
    man = (name: string, maimed = false): RollEntry => ({
      ref: `lv:${name}`,
      name,
      place: 0,
      age: 30,
      kept: false,
      ...(maimed ? { maimed: true as const } : {}),
    }),
    roll = {
      attacker: { fell: [man("A1")], hurt: [man("A3", true)], stood: [man("A2")] },
      defender: { fell: [man("D1"), man("D2")], hurt: [man("D4")], stood: [man("D3")] },
    } as unknown as BattleRoll;
  const who = (slot: number) => warManOf(scene, each, slot, roll);
  assert.deepEqual(who(0), { entry: roll.attacker.stood[0], fate: "stood" });
  assert.equal(who(1), null);
  assert.deepEqual(who(2), { entry: roll.attacker.hurt[0], fate: "maimed" });
  assert.deepEqual(who(4), { entry: roll.attacker.fell[0], fate: "fell" });
  assert.equal(who(3), null);
  assert.deepEqual(who(6), { entry: roll.defender.stood[0], fate: "stood" });
  assert.deepEqual(who(7), { entry: roll.defender.hurt[0], fate: "wounded" });
  // (More drawn than the roll names: none.)
  assert.equal(who(8), null);
  assert.deepEqual(who(10), { entry: roll.defender.fell[1], fate: "fell" });
  assert.equal(
    warManOf(scene, each, 9, { ...roll, defender: { ...roll.defender, fell: [] } }),
    null,
  );
});
