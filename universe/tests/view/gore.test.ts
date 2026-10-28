import { test } from "node:test";
import assert from "node:assert/strict";
import type { BattleNear, BattleSideNear } from "../../src/bridge/index.ts";
import {
  GORE_MOST,
  SEVER,
  battleAt,
  blowsAt,
  goreAt,
  gorePieces,
  heldFightNow,
  looseMotion,
  newBattle,
  newBlows,
  type GorePiece,
} from "../../src/view/index.ts";

const side = (ref: string): BattleSideNear => ({
  ref,
  name: ref,
  color: [0.7, 0.1, 0.1],
  arms: null,
  fielded: 360,
  fallen: 200,
  wounded: 100,
  maimed: 20,
  host: { arm: "axe", guard: "mail", mount: "" },
  kit: "axes",
});
const field = () =>
  newBattle(
    {
      event: "ev:gore-test",
      war: "war:1",
      title: "The field",
      cell: 1,
      land: "The field",
      year: 100,
      attacker: side("realm:a"),
      defender: side("realm:b"),
      won: true,
      outcome: "field",
      civil: null,
      hills: false,
      river: false,
      walls: 0,
      town: null,
      figure: null,
      plan: {
        seed: "gore test",
        ages: [{ index: 0, from: 0, to: 0, kind: "quiet", seaLevel: 0, warmth: 0, forests: true }],
        lineages: [],
      },
    } as BattleNear,
    360,
  );

test("full gore makes heavy blade impacts shed parts and fragments, with bounded aftermath", () => {
  const f = field(),
    blows = newBlows(f);
  assert.ok(blows.loose.length > 30, "more severed parts across a heavy blade battle");
  assert.ok(blows.loose.length <= 2 * SEVER.most);
  const loose = blows.loose[0]!,
    hit = blows.hits[loose.hit]!;
  const now = blowsAt(f, blows, battleAt(f, hit.at + 0.2), "full");
  assert.ok(now.limbs!.some((l) => l.id === hit.id && l.y > 0));
  assert.ok(now.gibs!.length > 0 && now.gibs!.length <= GORE_MOST);
  assert.ok(now.wounds!.some((w) => w.id === hit.id && w.mark === "stump" && w.spray > 0));
});

test("loose parts fly, bounce, slide and settle without sinking or changing when revisited", () => {
  const at = (age: number) => looseMotion(0, 0, 2, 1, age, 0.4, 0.7, 1.1, 2 * Math.PI);
  assert.ok(at(0.2).y > 0.6);
  assert.equal(at(0.4).y, 0);
  assert.ok(at(0.6).y > 0);
  for (let s = 0; s < 3; s += 0.03) assert.ok(at(s).y >= 0);
  assert.deepEqual(at(10), at(20));
  assert.equal(at(10).y, 0);
  assert.equal(at(10).pitch, Math.PI / 2);
  assert.equal(at(10).x, 2.36);
  assert.deepEqual(at(0.2), at(0.2));
});

test("fragments are deterministic, expire, and never exceed the shared field budget", () => {
  const first: GorePiece[] = [],
    again: GorePiece[] = [];
  gorePieces(4, 2, 3, 0.3, true, first);
  gorePieces(4, 2, 3, 0.3, true, again);
  assert.deepEqual(first, again);
  assert.ok(first.some((p) => p.bone) && first.some((p) => !p.bone));
  assert.ok(first.every((p) => p.y >= 0 && Number.isFinite(p.x)));
  for (let id = 0; id < 1000; id++) gorePieces(id, 0, 0, 2, true, first);
  assert.equal(first.length, GORE_MOST);
  const expired: GorePiece[] = [];
  gorePieces(4, 2, 3, 29, true, expired);
  assert.deepEqual(expired, []);
});

test("live fighting uses the recorded blow's age, and gore settings hide it without changing the fight", () => {
  const f = field(),
    base = battleAt(f, 20),
    t = base.troopers[0]!;
  const body = {
    id: t.id,
    x: 3,
    z: 4,
    yaw: 0,
    vx: 0,
    vz: 0,
    doing: "dead",
    hurt: 1,
    struck: 2,
    lost: 2,
    struckAt: 20,
  };
  const now = heldFightNow(f, base, [body], -1, -1, 20.2, ["edge", "edge"]);
  assert.ok(now.limbs!.some((l) => l.id === t.id && l.y > 0));
  assert.ok(now.gibs!.length > 0);
  assert.ok(now.wounds!.some((w) => w.id === t.id && Math.abs(w.age - 0.2) < 1e-8 && w.spray > 0));
  const before = JSON.stringify(now),
    less = goreAt(now, "less"),
    none = goreAt(now, "none");
  for (const hidden of [less, none]) {
    assert.deepEqual(hidden.limbs, []);
    assert.deepEqual(hidden.gibs, []);
    assert.ok(hidden.troopers.every((p) => p.lost === undefined));
    assert.deepEqual(hidden.fallen, now.fallen);
    assert.deepEqual(
      hidden.troopers.map((p) => [p.x, p.z, p.act]),
      now.troopers.map((p) => [p.x, p.z, p.act]),
    );
  }
  assert.deepEqual([none.blood, none.wounds, none.stuck, none.spray], [[], [], [], []]);
  assert.equal(JSON.stringify(now), before);
});
