// Wounds worn (Phase 55 M226): where a stump, a bandage and what is worn for a wound go — geometry
// alone, no GPU needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BANDAGE_WIDE, WOUND_COLORS, type WoundProp } from "../../src/view/index.ts";
import { WOUND_MOST, bandageOn, propAt, stumpAlong } from "../../src/render/wounds.ts";

const near = (a: number, b: number, what = "") =>
  assert.ok(Math.abs(a - b) < 1e-9, `${what} ${a} ≈ ${b}`);

test("a stump is what is kept of a limb, kept at its hinge", () => {
  assert.equal(stumpAlong(0.24, 1), 0);
  near(stumpAlong(0.24, 0.5), 0.06);
  near(stumpAlong(0.24, 0), 0.12);
  // (Its top stays where the whole limb's top was.)
  for (const keep of [0.25, 0.35, 0.8])
    near(stumpAlong(0.24, keep) + (keep * 0.24) / 2, 0.12, `keep ${keep}`);
});

test("a bandage is bound about what is left of its part, a little wider, turned with it", () => {
  const b = { part: 2, along: 0.25, long: 0.3 },
    m = bandageOn([1, 2, 3, 0.1, 0.4, 0.1, 0.5, 0], [0.1, 0.4, 0.12], 1, b);
  near(m[0]!, 1);
  near(m[1]!, 2 + 0.25 * 0.4);
  near(m[2]!, 3);
  near(m[3]!, 0.1 * BANDAGE_WIDE);
  near(m[4]!, 0.4 * 0.3);
  near(m[5]!, 0.12 * BANDAGE_WIDE);
  assert.equal(m[6], 0.5);
  assert.equal(m[7], 0);
  // Tipped forward a quarter turn, up the part runs along the way it faces; a stump's is shorter.
  const t = bandageOn([0, 0, 0, 1, 1, 1, 0, Math.PI / 2], [0.1, 0.4, 0.1], 0.5, {
    part: 2,
    along: 0.5,
    long: 0.5,
  });
  near(t[1]!, 0);
  near(t[2]!, 0.5 * 0.2);
  near(t[4]!, 0.2 * 0.5);
});

test("what is worn goes with them, turned as they face", () => {
  const q: WoundProp = {
    kind: "crutch",
    x: 0.1,
    y: 0.5,
    z: 0.02,
    sx: 0.02,
    sy: 1,
    sz: 0.02,
    yaw: 0,
    pitch: 0.1,
  };
  const a = propAt(10, 20, 0, 2, 0.05, q, 0.1);
  near(a[0]!, 1 + 0.2);
  near(a[1]!, (0.5 + 0.05) * 2);
  near(a[2]!, 2 + 0.04);
  near(a[4]!, 2);
  const b = propAt(10, 20, Math.PI / 2, 2, 0, q, 0.1);
  near(b[0]!, 1 + 0.04);
  near(b[2]!, 2 - 0.2);
  near(b[6]!, Math.PI / 2);
  near(b[7]!, 0.1);
});

test("every kind worn has a colour and a cap", () => {
  for (const k of Object.keys(WOUND_MOST)) assert.ok(k in WOUND_COLORS, k);
  assert.ok(Object.values(WOUND_MOST).every((n) => n > 0 && n <= 160));
});
