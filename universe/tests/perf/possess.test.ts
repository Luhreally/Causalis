// Phase 60's budget: the small world about a possessed body steps twenty times a second in the
// worker, so a step of its most bodies in a busy town's blocks must take far less than a frame —
// 2 ms at the most for 200 bodies (asked of Phase 60), several times what the reference machine
// takes, so a regression is caught, not noise. And a great town's hand is laid in a moment: its
// couples are paired by birth year, not man against woman (a city of 160,000 took four minutes).
import { test } from "node:test";
import assert from "node:assert/strict";
import { finish, mix } from "../../src/kernel/index.ts";
import {
  HAND_ACT,
  POSSESS_HZ,
  POSSESS_MOST,
  localBody,
  localWorld,
  stepLocal,
  type LocalScene,
} from "../../src/rules/index.ts";
import { FEMALE, MALE } from "../../src/rules/index.ts";
import { pairUp, type Agent } from "../../src/sim/index.ts";

const draw = (a: number, s: number, p: number, n = 0) =>
  (finish(mix(mix(mix(mix(5, a >>> 0), s >>> 0), p >>> 0), n >>> 0), 8) >>> 0) / 2 ** 32;

test("a step of the small world with its most bodies, among a town's blocks, takes under 2 ms", () => {
  // A town's blocks every 40 m (36 by 28 m each), walls between; 200 bodies about the square, each
  // walking a way through the streets, a crowd about the possessed.
  const solids: number[] = [];
  for (let i = -7; i <= 7; i++)
    for (let j = -7; j <= 7; j++)
      if (i || j)
        solids.push(i * 40, j * 40, 0, 1, 0, 18, 14, i * 40 + 20, j * 40, 1.2, 0, 1, 6, 0);
  const scene: LocalScene = {
      x: 0,
      z: 0,
      solids: solids.slice(0, POSSESS_MOST.solids * 7),
      places: [{ kind: "forge", x: 4, z: 4, yaw: 0 }],
      trade: "smith",
      form: "sickle",
      care: 0.3,
    },
    bodies = [localBody(0, { x: 0, z: 0, yaw: 0, task: -1, pace: 1.25 }, 0, 1, [], true)];
  for (let k = 1; k < POSSESS_MOST.bodies; k++) {
    const a = (k * 2.399) % (2 * Math.PI),
      r = 3 + (k % 40),
      x = r * Math.cos(a),
      z = r * Math.sin(a),
      ways: number[] = [];
    for (let w = 0; w < 12; w++)
      ways.push(w * 100, x + w * 5 * Math.cos(k), z + w * 5 * Math.sin(k), 0, -1);
    bodies.push(localBody(k, { x, z, yaw: 0, task: -1, pace: 1.25 }, k % 5 ? 0 : 1, 1, ways));
  }
  const l = localWorld(0, bodies),
    bid = { mx: 20, mz: 9, run: false, act: 0 };
  // (Warmed, then timed over ten seconds of the small world: a blow struck now and then.)
  for (let s = 0; s < 40; s++) stepLocal(scene, l, bid, draw);
  const t0 = performance.now(),
    n = 10 * POSSESS_HZ;
  for (let s = 0; s < n; s++)
    stepLocal(scene, l, s % 50 === 0 ? { ...bid, act: HAND_ACT.strike } : bid, draw);
  const each = (performance.now() - t0) / n;
  assert.ok(l.bodies.length > 150, `${l.bodies.length} bodies still about him`);
  assert.ok(each < 2, `a step took ${each.toFixed(3)} ms`);
});

test("a city's hand pairs its tens of thousands in a moment", () => {
  const people: Agent[] = [];
  let s = 11;
  const u = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  for (let id = 0; id < 160000; id++)
    people.push({
      id,
      sex: u() < 0.5 ? FEMALE : MALE,
      birthYear: 600 - Math.floor(u() * 80),
      occupation: 0,
    });
  const t0 = performance.now();
  pairUp(people, 600, 16);
  const ms = performance.now() - t0;
  assert.ok(ms < 1500, `160,000 paired in ${ms.toFixed(0)} ms`);
});
