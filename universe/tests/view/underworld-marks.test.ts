// The underworld lens's marks over the globe's colours (view/globe.ts): the realms in a cartel among realms edged and hatched in
// gold; under the gangs view, a land where the underworld kills hatched red, its bands the wider the more it kills, and a land its
// realm's own enforcers work edged blue. Drawn on a small sphere of land, its two halves two lands.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sphereGrid } from "../../src/kernel/index.ts";
import type { FrameMessage } from "../../src/bridge/index.ts";
import { GANG_MARKS, cartelOverCells, gangsOverCells } from "../../src/view/index.ts";

const grid = sphereGrid(16),
  n = grid.count,
  // (Two lands: the northern half 0, the southern 1; all of it land.)
  province = Int32Array.from({ length: n }, (_, c) => (grid.positions[c * 3 + 1]! >= 0 ? 0 : 1)),
  frame = {
    arrays: { province, elevation: new Float32Array(n).fill(100) },
    meta: {},
  } as unknown as FrameMessage,
  grey = () => new Uint8Array(n * 4).fill(128);

/** How many of a land's spots are drawn toward a colour, of all its spots. */
function marked(colors: Uint8Array, land: number, rgb: readonly number[]): number {
  let k = 0,
    all = 0;
  for (let c = 0; c < n; c++) {
    if (province[c] !== land) continue;
    all++;
    const near = [0, 1, 2].every(
      (j) => Math.abs(colors[c * 4 + j]! - (128 * 0.5 + rgb[j]! * 255 * 0.5)) < 3,
    );
    const edge = [0, 1, 2].every(
      (j) => Math.abs(colors[c * 4 + j]! - (128 * 0.15 + rgb[j]! * 255 * 0.85)) < 3,
    );
    if (near || edge) k++;
  }
  return k / all;
}

test("the gangs view hatches where the underworld kills, the wider the more, and edges where the realm's enforcers work", () => {
  const few = grey(),
    many = grey();
  gangsOverCells(few, frame, grid, new Map([[0, 2]]), new Set());
  gangsOverCells(many, frame, grid, new Map([[0, 40]]), new Set());
  const a = marked(few, 0, GANG_MARKS.killing),
    b = marked(many, 0, GANG_MARKS.killing);
  assert.ok(a > 0.05 && b > a + 0.15, `${a} ${b}`);
  assert.equal(marked(many, 1, GANG_MARKS.killing), 0, "the land that does not kill is not marked");
  // (Below one a year in a hundred thousand: no mark.)
  const none = grey();
  gangsOverCells(none, frame, grid, new Map([[0, 0.5]]), new Set());
  assert.deepEqual(none, grey());
  // (A crew of enforcers: its land's edge blue, not its middle.)
  const badge = grey();
  gangsOverCells(badge, frame, grid, new Map(), new Set([1]));
  const edged = marked(badge, 1, GANG_MARKS.badge);
  assert.ok(edged > 0 && edged < 0.5, `${edged}`);
  assert.equal(marked(badge, 0, GANG_MARKS.badge), 0);
});

test("the cartels view's lands are edged and hatched in gold", () => {
  const c = grey();
  cartelOverCells(c, frame, grid, new Set([0]));
  assert.ok(marked(c, 0, [1, 0.8, 0.22]) > 0.2);
  assert.equal(marked(c, 1, [1, 0.8, 0.22]), 0);
});
