// Phase 61's budget: a soldier's fight and a beast's small world step twenty times a second in the
// worker, so a step of their most bodies must take far less than a frame — 2 ms at the most (asked of
// the possession plan for 200 bodies; the fight holds 240), several times what the reference machine
// takes, so a regression is caught, not noise. And the fight fought out without the hand — at the
// taking (the day left alone, the hand's measure) and at the letting go — within a breath, and at a
// taking's worst (the day leant FIGHT_LEANS times) within a second.
import { test } from "node:test";
import assert from "node:assert/strict";
import { finish, mix } from "../../src/kernel/index.ts";
import {
  FIGHT_LEANS,
  FIGHT_MOST,
  FIGHT_OUT_MOST,
  HAND_ACT,
  POSSESS_HZ,
  WILD_MOST,
  copyFight,
  fightBody,
  fightLeaning,
  fightOut,
  fightWorld,
  stepFight,
  stepWild,
  unpackWild,
  wildFrame,
  wildWorld,
  type CreatureBody,
  type FightScene,
  type FightSide,
  type WildScene,
} from "../../src/rules/index.ts";

const draw = (a: number, s: number, p: number, n = 0) =>
  (finish(mix(mix(mix(mix(7, a >>> 0), s >>> 0), p >>> 0), n >>> 0), 8) >>> 0) / 2 ** 32;

const side = (might: number): FightSide => ({
  blow: "edge",
  cuts: true,
  looses: "arrows",
  reload: 4,
  guard: 0.3,
  shock: 0.6,
  might,
  mounted: false,
  figures: 360,
  before: 20,
});
const scene: FightScene = {
  sides: [side(1.2), side(0.83)],
  from: 20,
  length: 150,
  meet: 0,
  flanks: true,
};
/** He in the defenders' front rank; its most bodies about him, two hosts in ranks of thirty. */
function field() {
  const bodies = [fightBody(0, 1, { x: 0.5, z: 0, yaw: -Math.PI / 2 }, 1, true)];
  for (let k = 1; k < FIGHT_MOST; k++) {
    const s: 0 | 1 = k % 2 ? 0 : 1,
      j = Math.floor(k / 2),
      rank = Math.floor(j / 30),
      file = (j % 30) - 15;
    bodies.push(
      fightBody(
        k,
        s,
        { x: s === 1 ? 0.5 + rank * 1.6 : -0.6 - rank * 1.6, z: file * 1.2, yaw: 0 },
        0.85 + (0.3 * ((k * 37) % 100)) / 100,
        true,
      ),
    );
  }
  return fightWorld(bodies);
}

test("a step of a soldier's fight with its most bodies, the lines at grips, takes under 2 ms", () => {
  const f = field(),
    fighting = { mx: -10, mz: 0, run: false, act: HAND_ACT.strike };
  for (let s = 0; s < 40; s++) stepFight(scene, f, fighting, draw);
  const t0 = performance.now(),
    n = 10 * POSSESS_HZ;
  for (let s = 0; s < n && !f.ended; s++) stepFight(scene, f, fighting, draw);
  const each = (performance.now() - t0) / n;
  assert.equal(f.bodies.length, FIGHT_MOST);
  assert.ok(f.deeds.length > 0, "blows struck");
  assert.ok(each < 2, `a step took ${each.toFixed(3)} ms`);
});

test("the fight fought out without the hand, from its taking to its end, within half a second", () => {
  const f = field(),
    t0 = performance.now(),
    steps = fightOut(scene, copyFight(f), draw, FIGHT_OUT_MOST),
    ms = performance.now() - t0;
  assert.ok(steps > 0 && steps <= FIGHT_OUT_MOST);
  assert.ok(ms < 500, `${steps} steps fought out in ${ms.toFixed(0)} ms`);
});

test("a taking at its worst, the fight left alone fought out with the day leant FIGHT_LEANS times, within a second", () => {
  const f = field(),
    once = copyFight(f);
  fightOut(scene, once, draw, FIGHT_OUT_MOST);
  // (History's victor the side that breaks, the scene laid the same each time: every leaning fought out.)
  let laid = 0;
  const t0 = performance.now();
  fightLeaning(() => (laid++, scene), f, once.broke === 1 ? 1 : 0, draw);
  const ms = performance.now() - t0;
  assert.equal(laid, once.broke >= 0 ? FIGHT_LEANS : 1);
  assert.ok(ms < 1000, `${laid} fought out in ${ms.toFixed(0)} ms`);
});

test("a step of a beast's small world with its most bodies takes under 2 ms", () => {
  const body = (size: number, eats: CreatureBody["eats"]) =>
      ({
        symmetry: "bilateral",
        segments: 1,
        legs: 4,
        fins: 0,
        wings: 0,
        covering: "fur",
        size,
        moves: "walk",
        eats,
        level: 2,
        neck: 0.4,
        tail: 0.3,
        features: [],
        warm: true,
      }) as unknown as CreatureBody,
    ws: WildScene = {
      kinds: [
        { frame: wildFrame(body(300, "grass"), "grazer"), niche: "grazer" },
        { frame: wildFrame(body(150, "flesh"), "hunter"), niche: "hunter" },
      ],
      herds: [0, 1, 2, 3].map((h) => ({ x: h * 30, z: 0, flock: h === 0 })),
      water: { x: 0, z: 60, r: 10 },
      pasture: { x: 0, z: 0, r: 40 },
      x: 0,
      z: 0,
    },
    packed: number[] = [];
  for (let k = 0; k < WILD_MOST; k++)
    packed.push(k, k === 0 ? 1 : 0, k === 0 ? -1 : k % 4, (k % 4) * 30 + (k % 7), (k % 11) - 5, 0);
  const w = wildWorld(unpackWild(packed)),
    t0 = performance.now(),
    n = 10 * POSSESS_HZ;
  for (let s = 0; s < n; s++) stepWild(ws, w, { mx: 12, mz: 5, run: s % 40 < 20, act: 0 }, draw);
  const each = (performance.now() - t0) / n;
  assert.ok(each < 2, `a step took ${each.toFixed(3)} ms`);
});
