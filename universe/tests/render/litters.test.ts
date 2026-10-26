// Litters (Phase 55 M229): held at their bearers' hands, their poles at their hands, set down low
// — geometry alone, no GPU needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { figureOf, type LitterNow } from "../../src/view/index.ts";
import { LITTER, litterApart, litterHeld, litterPieces } from "../../src/render/litters.ts";

const near = (a: number, b: number, what = "") =>
  assert.ok(Math.abs(a - b) < 1e-9, `${what} ${a} ≈ ${b}`);
const M = 0.1;

test("held at an upright ape's hands, its poles at their sides", () => {
  const f = figureOf(null, 2);
  const held = litterHeld(f),
    apart = litterApart(f);
  assert.ok(held > 1.5 && held < 2.5, `held ${held}`);
  near(apart, (2 * 0.105 * f.scale) / M, "apart");
  // (Of every kind of figure, a height and a breadth.)
  for (const d of [0, 1, 2, 3]) {
    const g = figureOf(null, d);
    assert.ok(litterHeld(g) > 0 && litterApart(g) > 0, `detail ${d}`);
  }
});

test("its pieces: the canvas where it is, the poles either side, the head to the front", () => {
  const l: LitterNow = { x: 10, z: -4, face: Math.PI / 2, borne: true, bearers: [1, 2], index: 3 };
  const ps = litterPieces(l, 2, 2.1);
  assert.deepEqual(
    ps.map((p) => p.part),
    ["canvas", "pole", "pole", "blanket", "hood"],
  );
  const canvas = ps[0]!.m,
    poles = ps.filter((p) => p.part === "pole").map((p) => p.m),
    hood = ps[4]!.m;
  near(canvas[0]!, 10 * M);
  near(canvas[1]!, 2 * M);
  near(canvas[2]!, -4 * M);
  near(canvas[5]!, LITTER.canvas[2] * M);
  // Facing +x: the poles either side along z, the head toward +x.
  near(Math.abs(poles[0]![2]! - poles[1]![2]!), 2.1 * M);
  near(poles[0]![0]!, poles[1]![0]!);
  assert.ok(hood[0]! > canvas[0]!);
  for (const m of ps.map((p) => p.m)) near(m[6]!, Math.PI / 2);
  // Set down, it rests low.
  const set = litterPieces({ ...l, borne: false }, 2, 2.1);
  near(set[0]!.m[1]!, LITTER.rest * M);
});
