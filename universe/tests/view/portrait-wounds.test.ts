import { test } from "node:test";
import assert from "node:assert/strict";
import { NO_LOOK, type Portrait, type WoundLook } from "../../src/bridge/index.ts";
import { STUMP_KEEP, WOUND_COLORS, figureOf, partExtent } from "../../src/view/index.ts";
import { personSolids } from "../../src/ui/portrait.ts";

// Phase 55 M226 (T43): a person's picture with their wounds — a member gone or a stump, a limb
// held, linen bound, a patch, a sling, a crutch — and no tool in a hand that cannot hold it.

type Person = Extract<Portrait, { kind: "person" }>;
const base: Person = {
  kind: "person",
  ref: "folk:town:0:43:5:2",
  age: 34,
  span: 70,
  occupation: 1,
  child: false,
  era: "metal",
  body: null,
};
const look = (over: Partial<WoundLook>): WoundLook => ({ ...NO_LOOK, ...over });
const coloured = (s: { color: readonly number[] }, c: readonly number[]) =>
  s.color.length === c.length && s.color.every((x, i) => x === c[i]);
const f = figureOf(null, 3),
  armL = f.parts.findIndex((q) => q.role === "arm" && q.x > 0);

test("unhurt, as ever: no look, or one that shows nothing, draws the same", () => {
  for (const occupation of [0, 1, 2, 3, 4, 5, 6])
    for (const child of [false, true]) {
      const p = { ...base, occupation, child },
        plain = personSolids(p);
      assert.deepEqual(personSolids({ ...p, look: NO_LOOK }), plain);
      // (Every part drawn whole; only the arm with the tool held forward.)
      assert.ok(plain.length >= f.parts.length);
      for (const [k, q] of f.parts.entries())
        assert.equal(plain[k]!.pitch, q.role === "arm" && q.x > 0 && !child ? -0.5 : 0);
      assert.ok(!plain.some((s) => Object.values(WOUND_COLORS).some((c) => coloured(s, c))));
    }
});

test("an arm lost: its hand gone, a stump kept at the shoulder, no tool", () => {
  const whole = personSolids(base),
    lost = personSolids({ ...base, look: look({ lost: ["arm-l", "hand-l"] }) }),
    q = f.parts[armL]!,
    e = partExtent(q),
    stump = lost.find((s) => s.x === q.x && Math.abs(s.sy - e[1] * STUMP_KEEP) < 1e-9);
  assert.ok(lost.length < whole.length);
  assert.ok(stump, "a stump");
  assert.ok(Math.abs(stump!.y + stump!.sy / 2 - (q.y + e[1] / 2)) < 1e-9, "kept at its top");
});

test("what a wound is worn with, each in its colour", () => {
  const has = (l: Partial<WoundLook>, c: readonly number[]) =>
    personSolids({ ...base, look: look(l) }).some((s) => coloured(s, c));
  assert.ok(has({ crutch: "r", lost: ["leg-r"] }, WOUND_COLORS.crutch));
  assert.ok(has({ sling: "l", bound: ["arm-l"] }, WOUND_COLORS.sling));
  assert.ok(has({ sling: "l", bound: ["arm-l"] }, WOUND_COLORS.bandage));
  assert.ok(has({ patch: "r", lost: ["eye-r"] }, WOUND_COLORS.patch));
  assert.ok(has({ scars: ["head"] }, WOUND_COLORS.scar));
  // (A crutch under the tool's arm takes the tool from it; under the other, not.)
  const under = personSolids({ ...base, look: look({ crutch: "l", lost: ["leg-l"] }) }),
    other = personSolids({ ...base, look: look({ crutch: "r", lost: ["leg-r"] }) });
  assert.ok(under.length < other.length, `${under.length} < ${other.length}`);
});
