// Tests for the town's invasion script (Phase 67, Act 2): the landing pads, trimmed ways, the film's clock,
// the guard and the raiders, the bolts, the fires, the caption and the camera. The site is hand-made, so
// these run without a village.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { StarFightPlan } from "../../src/bridge/index.ts";
import {
  invasionAt,
  invasionEye,
  invasionScript,
  invasionWords,
  padsFrom,
  raidersAt,
  trimPath,
  type InvasionSite,
} from "../../src/view/invasion.ts";

const site: InvasionSite = {
  pads: [
    { x: 0, z: 0 },
    { x: 60, z: 0 },
  ],
  routes: [
    [
      { x: 0, z: 0 },
      { x: 0, z: 140 },
    ],
    [
      { x: 60, z: 0 },
      { x: 60, z: 140 },
    ],
  ],
  rally: { x: -100, z: 0 },
  homes: Array.from({ length: 20 }, (_, i) => ({ x: 30, z: 20 + i * 6 })),
};

// Only the fields the script and the caption read; the rest of a fight's record is not needed here.
const fixture = (arm: string) =>
  ({
    id: "ev:0:364215",
    year: 1757,
    nowYear: 2000,
    attacker: { beamArm: "beam-rifle" },
    landing: {
      townName: "Shisten",
      dead: 3939222,
      razed: 0.1,
      raiders: { name: "the Kregraanok", kind: "trunked giants" },
      defenders: { host: { arm, guard: "plate", mount: "foot" } },
    },
  }) as unknown as StarFightPlan;

const plan = fixture("beam-rifle");
const s = invasionScript(plan, site, 18, 24);

test("the landing pads are at least 46 m apart, the first at the middle", () => {
  const pads = padsFrom(() => true, 200, { x: 1, z: 0 });
  assert.equal(pads.length, 4);
  assert.deepEqual(pads[0], { x: 0, z: 0 });
  for (let i = 0; i < pads.length; i++)
    for (let j = i + 1; j < pads.length; j++)
      assert.ok(Math.hypot(pads[i]!.x - pads[j]!.x, pads[i]!.z - pads[j]!.z) >= 46);
});

test("with no clear ground the pads stand out along the way, past the reach", () => {
  const pads = padsFrom(() => false, 200, { x: 1, z: 0 });
  assert.ok(pads.length >= 1);
  assert.ok(Math.abs(Math.hypot(pads[0]!.x, pads[0]!.z) - 224) <= 0.01);
});

test("trimPath cuts a path to the length given, ending on the cut", () => {
  const t = trimPath(
    [
      { x: 0, z: 0 },
      { x: 100, z: 0 },
      { x: 100, z: 100 },
    ],
    140,
  );
  const last = t[t.length - 1]!;
  assert.ok(Math.abs(last.x - 100) < 1e-9 && Math.abs(last.z - 40) < 1e-9);
});

test("raidersAt gives 24, 24, 36, 48 for the four detail levels", () => {
  assert.deepEqual([0, 1, 2, 3].map(raidersAt), [24, 24, 36, 48]);
});

test("the town's soldiers take 4 × each slots, and the raiders' side is never drawn", () => {
  for (const t of [0, 10, 20, 30, 40, 46]) {
    const { scene } = invasionAt(s, t);
    assert.equal(scene.soldiers.length, 72);
    for (let i = 0; i < 36; i++) assert.equal(scene.soldiers[i]!.size, 0);
  }
});

test("the landers come down in the first six seconds and lift off after the fight", () => {
  assert.ok(invasionAt(s, 0).landers.every((l) => l.high > 100));
  assert.ok(invasionAt(s, 6.01).landers.every((l) => l.high === 0));
  assert.ok(invasionAt(s, 46).landers.every((l) => l.high > 80));
});

test("the raiders stay in the ships until they come out, and then fight", () => {
  assert.ok(invasionAt(s, 5).raiders.every((r) => r.size === 0));
  const at20 = invasionAt(s, 20).raiders;
  assert.ok(at20.filter((r) => r.size === 1).length >= 0.6 * at20.length);
  assert.ok(at20.some((r) => r.doing === "fight"));
});

test("by 33.9 s most of the guard has fallen and few raiders have", () => {
  const now = invasionAt(s, 33.9);
  const guardFallen = now.scene.soldiers.slice(36, 54).filter((g) => g.doing === "fallen").length;
  assert.ok(guardFallen >= 10, `guard fallen ${guardFallen}`);
  const raidersFallen = now.raiders.filter((r) => r.doing === "fallen").length;
  assert.ok(raidersFallen <= 7, `raiders fallen ${raidersFallen}`);
});

test("at lift-off every raider that has not fallen is gone", () => {
  for (const r of invasionAt(s, 46).raiders) if (r.doing !== "fallen") assert.equal(r.size, 0);
});

test("the same time always draws the same film, whatever was asked before", () => {
  const first = JSON.stringify(invasionAt(s, 20));
  invasionAt(s, 40);
  assert.equal(JSON.stringify(invasionAt(s, 20)), first);
});

test("bolts stay within their caps, and only a guard with guns fires", () => {
  let guardShots = 0;
  for (let t = 14; t <= 34; t += 0.25) {
    const bolts = invasionAt(s, t).bolts;
    assert.ok(bolts.length <= 24);
    guardShots += bolts.filter((b) => b.side === 1).length;
  }
  assert.ok(guardShots > 0);
  const spear = invasionScript(fixture("spear"), site, 18, 24);
  for (let t = 14; t <= 34; t += 0.25)
    assert.ok(invasionAt(spear, t).bolts.every((b) => b.side === 0));
});

test("the homes burn: none before they catch, four to sixteen after", () => {
  assert.equal(invasionAt(s, 10).scene.fires.length, 0);
  const n = invasionAt(s, 40).scene.fires.length;
  assert.ok(n >= 4 && n <= 16);
});

test("a town's own homes burn from their roofs, as they catch, when the land was razed", () => {
  const homes = Array.from({ length: 20 }, (_, i) => ({
    lot: i,
    x: 30,
    z: 20 + i * 6,
    yaw: 0,
    size: 2,
    high: 30,
    wide: 9,
  }));
  const burning = invasionScript(plan, site, 12, 24, homes);
  assert.equal(burning.fires.length, 0, "not also on the ground");
  assert.equal(invasionAt(burning, 10).blaze.fires.length, 0);
  const late = invasionAt(burning, 40).blaze;
  assert.ok(late.fires.length >= 4 && late.fires.length <= 16, `${late.fires.length} alight`);
  assert.equal(late.smoke.length, late.fires.length);
  assert.ok(late.fires.every((f) => f.high === 30 && f.k > 0.9));
  // (None if the record has none razed.)
  const none = { ...plan, landing: { ...plan.landing!, razed: 0 } };
  assert.equal(invasionAt(invasionScript(none, site, 12, 24, homes), 40).blaze.fires.length, 0);
});

test("the caption names the raiders, the town and the dead, and then the end", () => {
  assert.ok(invasionWords(plan, 1).includes("come down on Shisten"));
  assert.ok(invasionWords(plan, 30).includes("3,939,222"));
  const end = invasionWords(plan, 45);
  assert.ok(end.includes("realm stands") && end.includes("2000"));
});

test("the camera never goes below six metres, and stays clear of what it looks at", () => {
  for (let t = 0; t <= 46; t++) {
    const { e, at } = invasionEye(s, t);
    assert.ok(e.y >= 6, `t=${t} e.y=${e.y}`);
    assert.ok(Math.hypot(e.x - at.x, e.y - at.y, e.z - at.z) >= 20, `t=${t}`);
  }
});
