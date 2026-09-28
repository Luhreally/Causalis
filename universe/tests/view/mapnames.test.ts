import { test } from "node:test";
import assert from "node:assert/strict";
import { sphereGrid } from "../../src/kernel/index.ts";
import { globeColors, nameShape, namesThatFit, withinName } from "../../src/view/index.ts";
import type { FrameMessage } from "../../src/bridge/index.ts";

test("a realm's name runs along the way its lands stretch, as far as they do", () => {
  const grid = sphereGrid(16),
    p = grid.positions;
  // Lands along the equator, from 0° to 40° of longitude.
  const spots: number[] = [];
  for (let c = 0; c < grid.count; c++) {
    const lat = Math.asin(p[c * 3 + 1]!),
      lon = Math.atan2(p[c * 3]!, p[c * 3 + 2]!);
    if (Math.abs(lat) < 0.05 && lon > 0 && lon < 0.7) spots.push(c);
  }
  assert.ok(spots.length > 3);
  const s = nameShape(spots, grid)!;
  // The axis lies along the equator (little of it north or south) and spans the lands.
  assert.ok(Math.abs(s.ay) < 0.2, `the axis runs east–west (${s.ay.toFixed(2)})`);
  assert.ok(s.half > 0.25 && s.half < 0.5, `it reaches the lands' ends (${s.half.toFixed(2)})`);
  assert.equal(nameShape([], grid), null);
});

test("names are written the greatest realm's first; one that would cross another is smaller, or left out", () => {
  const big = { x: 100, y: 100, angle: 0, size: 30, chars: 8, rank: 20 },
    across = { x: 110, y: 100, angle: 90, size: 30, chars: 8, rank: 5 },
    apart = { x: 600, y: 400, angle: 0, size: 20, chars: 6, rank: 1 };
  const fits = namesThatFit([across, big, apart]);
  assert.equal(fits[1], 1, "the greater realm's name is written whole");
  assert.equal(fits[2], 1, "a name far from the others is written whole");
  assert.equal(fits[0], 0, "a name crossing it at any size is left out");
  // Beside it but a little over: written smaller.
  const beside = namesThatFit([big, { x: 100, y: 128, angle: 0, size: 24, chars: 8, rank: 2 }]);
  assert.equal(beside[0], 1);
  assert.ok(beside[1]! > 0 && beside[1]! < 1, `written smaller (${beside[1]})`);
  // A seat's star within a name's letters, or clear of them.
  assert.ok(withinName(big, 100, 100));
  assert.ok(!withinName(big, 100, 160));
});

test("a political map draws its borders: dark between realms, faint between a realm's own lands", () => {
  const grid = sphereGrid(8),
    n = grid.count,
    p = grid.positions,
    // Four lands: two realms, each of two lands (east and west, north and south).
    province = Int32Array.from(
      { length: n },
      (_, c) => (p[c * 3]! > 0 ? 2 : 0) + (p[c * 3 + 1]! > 0 ? 1 : 0),
    ),
    frame = {
      view: "globe",
      t: 0,
      key: "k",
      meta: { plates: [{ continental: true }] },
      arrays: {
        elevation: new Float32Array(n).fill(500),
        biome: new Uint8Array(n).fill(9),
        province,
        lake: new Uint8Array(n),
        river: new Uint8Array(n),
      },
    } as unknown as FrameMessage,
    west: readonly [number, number, number] = [0.8, 0.2, 0.2],
    east: readonly [number, number, number] = [0.2, 0.2, 0.8],
    colors = new Map([
      [0, west],
      [1, west],
      [2, east],
      [3, east],
    ]);
  const plain = globeColors(frame, "realms", undefined, colors),
    bordered = globeColors(frame, "realms", undefined, colors, grid);
  let realmEdge = 0,
    landEdge = 0,
    inside = 0;
  for (let c = 0; c < n; c++) {
    const nb = Array.from(grid.neighbours.slice(grid.offsets[c]!, grid.offsets[c + 1]!)),
      k = bordered[c * 4]! / Math.max(1, plain[c * 4]!);
    if (nb.some((m) => p[m * 3]! > 0 !== p[c * 3]! > 0)) realmEdge = Math.max(realmEdge, 1 - k);
    else if (nb.some((m) => province[m] !== province[c])) landEdge = Math.max(landEdge, 1 - k);
    else inside = Math.max(inside, 1 - k);
  }
  assert.ok(realmEdge > 0.4, `a realm's edge is dark (${realmEdge.toFixed(2)})`);
  assert.ok(
    landEdge > 0.05 && landEdge < 0.3,
    `a land's edge within a realm is faint (${landEdge.toFixed(2)})`,
  );
  assert.equal(inside, 0, "within a land, nothing is darkened");
});

test("a land taken by force is in shadow, touched with its loser's colour, over the land's own shading", () => {
  const grid = sphereGrid(16),
    n = grid.count,
    p = grid.positions,
    // Two lands: the north (taken from the blues) and the south; the east half high ground.
    province = Int32Array.from({ length: n }, (_, c) => (p[c * 3 + 1]! > 0 ? 0 : 1)),
    frame = {
      view: "globe",
      t: 0,
      key: "k",
      meta: { plates: [{ continental: true }] },
      arrays: {
        elevation: Float32Array.from({ length: n }, (_, c) => (p[c * 3]! > 0 ? 3000 : 200)),
        biome: new Uint8Array(n).fill(8),
        province,
        lake: new Uint8Array(n),
        river: new Uint8Array(n),
      },
    } as unknown as FrameMessage,
    red: readonly [number, number, number] = [0.8, 0.2, 0.2],
    blue: readonly [number, number, number] = [0.2, 0.2, 0.8],
    colors = new Map([
      [0, red],
      [1, red],
    ]),
    plain = globeColors(frame, "realms", undefined, colors),
    marked = globeColors(frame, "realms", undefined, colors, undefined, new Map([[0, blue]]));
  // A cell of each land at the same height: the taken one darker, and bluer for its size.
  const pick = (land: number) =>
      [...Array(n).keys()].find((c) => province[c] === land && p[c * 3]! < -0.3)!,
    north = pick(0),
    south = pick(1);
  assert.ok(marked[north * 4]! < plain[north * 4]! * 0.8, "the taken land in shadow");
  assert.ok(
    marked[north * 4 + 2]! / marked[north * 4]! > plain[north * 4 + 2]! / plain[north * 4]!,
    "touched with the colour it was taken from",
  );
  assert.equal(marked[south * 4], plain[south * 4], "the land not taken as it was");
  // The land's own shading under its colour: its heights lighter than its lows.
  const high = [...Array(n).keys()].find((c) => province[c] === 1 && p[c * 3]! > 0.5)!;
  assert.ok(plain[high * 4]! > plain[south * 4]!, "the heights lighter under the same colour");
});
