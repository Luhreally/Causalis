// What grows about a town is drawn in pieces (render/townflora.ts floraPieces), each its own batch bound to where its things
// stand, so that those out of sight are not drawn: every thing in one piece, none over PIECE, and each piece a patch of
// the ground far smaller than the whole.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PIECE, floraPieces } from "../../src/render/townflora.ts";
import type { NearThing } from "../../src/view/index.ts";

test("town pieces: every thing in one piece, none over PIECE, each a small patch of the ground", () => {
  const list: NearThing[] = [];
  // Nearest the square thickest, as a town's laying is (view/townflora.ts).
  for (let k = 0; k < 2240; k++) {
    const a = k * 2.399963,
      d = 30 * Math.sqrt(k);
    list.push({
      x: d * Math.cos(a),
      y: 0,
      z: d * Math.sin(a),
      w: 6,
      h: 9,
      yaw: 0,
      r: 0,
      g: 0,
      b: 0,
    });
  }
  const cut = floraPieces(list);
  assert.equal(
    cut.reduce((n, p) => n + p.length, 0),
    list.length,
  );
  assert.equal(new Set(cut.flat()).size, list.length);
  assert.ok(cut.every((p) => p.length > 0 && p.length <= PIECE));
  const span = (p: NearThing[]) =>
    (Math.max(...p.map((t) => t.x)) - Math.min(...p.map((t) => t.x))) *
    (Math.max(...p.map((t) => t.z)) - Math.min(...p.map((t) => t.z)));
  const whole = span(list);
  for (const p of cut)
    assert.ok(span(p) < whole / 3, `a piece spans ${span(p) / whole} of the whole`);
  assert.deepEqual(floraPieces([]), []);
  assert.equal(floraPieces(list.slice(0, 10)).length, 1);
});
