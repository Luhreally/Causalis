import { test } from "node:test";
import assert from "node:assert/strict";
import { sphereGrid } from "../../src/kernel/index.ts";
import type { ActMark, FrameMessage } from "../../src/bridge/index.ts";
import {
  ACT_PARTS,
  actBits,
  globeColors,
  lensLegend,
  litColors,
  placeActs,
  type Lens,
} from "../../src/view/index.ts";

const grid = sphereGrid(8);
const elevation = Float32Array.from({ length: grid.count }, (_, c) =>
  grid.positions[c * 3 + 1]! > 0 ? 500 : -1500,
);
const unit = (x: number, y: number, z: number): [number, number, number] => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
};
const mark = (kind: ActMark["kind"], left = 1, to: ActMark["to"] = null): ActMark => ({
  kind,
  at: unit(0.3, 0.8, 0.2),
  to,
  color: kind === "conversion" ? [0.2, 0.8, 0.4] : null,
  left,
  event: `ev:0:${kind}`,
});

test("every act plays where it falls, on the globe's face, and fades as its time runs out", () => {
  const kinds: ActMark["kind"][] = [
    "rain",
    "drought",
    "bounty",
    "blight",
    "plague",
    "healing",
    "inspiration",
    "fire",
    "spring",
    "shrine",
    "rising",
    "conversion",
    "quake",
    "meteor",
    "crater",
    "flood",
    "bless",
    "curse",
  ];
  for (const kind of kinds) {
    const placed = placeActs([mark(kind)], grid, elevation),
      bits = actBits(placed, 3.2);
    assert.ok(bits.length >= 3, `${kind} shows (${bits.length})`);
    for (const b of bits) {
      assert.ok(ACT_PARTS.includes(b.part), b.part);
      // Near its land, above the ground.
      const r = Math.hypot(b.at.x, b.at.y, b.at.z);
      // (A meteor falls from high above.)
      assert.ok(r >= 1 && r < (kind === "meteor" ? 1.6 : 1.3), `${kind} ${b.part} at ${r}`);
    }
    // A faded act's marks are smaller.
    const faded = actBits(placeActs([mark(kind, 0.05)], grid, elevation), 3.2),
      size = (list: typeof bits) => list.reduce((s, b) => s + b.size[0] + b.size[1], 0);
    assert.ok(size(faded) < size(bits), `${kind} fades`);
  }
  // The same moment, the same marks: a screen clock, not a draw.
  const placed = placeActs([mark("rain")], grid, elevation);
  assert.deepEqual(actBits(placed, 7.5), actBits(placed, 7.5));
  assert.notDeepEqual(actBits(placed, 7.5), actBits(placed, 7.9), "the rain falls");
  // A conversion's halo is its faith's colour.
  assert.ok(
    actBits(placeActs([mark("conversion")], grid, elevation), 1).every(
      (b) => b.part === "halo" && b.color?.[1] === 0.8,
    ),
  );
});

test("an act between two realms is a thread from one seat to the other, arched over the globe", () => {
  const to = unit(-0.4, 0.7, 0.5);
  for (const kind of ["war", "peace", "friendship", "discord", "settle", "union"] as const) {
    const placed = placeActs([mark(kind, 1, to)], grid, elevation),
      bits = actBits(placed, 2);
    assert.ok(bits.length >= 20, `${kind}: a thread of beads (${bits.length})`);
    const first = bits[0]!,
      last = bits.at(-1)!,
      near = (p: { x: number; y: number; z: number }, q: readonly number[]) =>
        Math.hypot(
          p.x / Math.hypot(p.x, p.y, p.z) - q[0]!,
          p.y / Math.hypot(p.x, p.y, p.z) - q[1]!,
          p.z / Math.hypot(p.x, p.y, p.z) - q[2]!,
        ) < 0.08;
    assert.ok(
      near(first.at, unit(0.3, 0.8, 0.2)) && near(last.at, to),
      `${kind} runs seat to seat`,
    );
    const high = Math.max(...bits.map((b) => Math.hypot(b.at.x, b.at.y, b.at.z)));
    assert.ok(high > 1.03, `${kind} arches (${high})`);
  }
  // Without the other seat, no thread.
  assert.equal(actBits(placeActs([mark("war")], grid, elevation), 2).length, 0);
  // Marks read larger seen from afar.
  const placed = placeActs([mark("plague")], grid, elevation),
    far = actBits(placed, 1, 3.3),
    close = actBits(placed, 1, 1.4);
  assert.ok(far[0]!.size[0] > close[0]!.size[0]);
});

test("the palette lights the lands it reaches, each light its colour; the rest untouched", () => {
  const n = grid.count,
    province = Int32Array.from({ length: n }, (_, c) => (elevation[c]! > 0 ? c % 5 : -1)),
    frame = {
      view: "globe",
      meta: { plates: [], frequency: 8 },
      arrays: { elevation, province, biome: new Uint8Array(n) },
    } as unknown as FrameMessage,
    base = new Uint8Array(n * 4).fill(100),
    lit = litColors(base, frame, new Map([[2, "foe" as const]]));
  assert.equal(litColors(base, frame, new Map()), base, "nothing lit: the same colours");
  for (let c = 0; c < n; c++) {
    const same = [0, 1, 2, 3].every((j) => lit[c * 4 + j] === base[c * 4 + j]);
    if (province[c] === 2) assert.ok(!same && lit[c * 4]! > lit[c * 4 + 1]!, "lit red as a foe");
    else assert.ok(same, "the rest untouched");
  }
});

test("the deeper lenses colour each land by its reading, and say what their colours mean", () => {
  const n = grid.count,
    province = Int32Array.from({ length: n }, (_, c) => (elevation[c]! > 0 ? c % 3 : -1)),
    frame = {
      view: "globe",
      meta: { plates: [], frequency: 8 },
      arrays: { elevation, province, biome: new Uint8Array(n).fill(9) },
    } as unknown as FrameMessage;
  const tint = (lens: Lens, values: Map<number, number>) => {
    const out = globeColors(frame, lens, values),
      of = (p: number) => {
        const c = [...province].indexOf(p);
        return [out[c * 4]!, out[c * 4 + 1]!, out[c * 4 + 2]!];
      };
    return [of(0), of(1), of(2)] as const;
  };
  // Content green to rising red; shrinking red to growing green.
  const [calm, , angry] = tint(
    "unrest",
    new Map([
      [0, 0],
      [1, 0.5],
      [2, 1],
    ]),
  );
  assert.ok(calm[1]! > calm[0]! && angry[0]! > angry[1]!, "unrest: green to red");
  const [shrink, , grow] = tint(
    "growth",
    new Map([
      [0, -0.2],
      [1, 0.02],
      [2, 0.2],
    ]),
  );
  assert.ok(shrink[0]! > shrink[1]! && grow[1]! > grow[0]!, "growth: red to green");
  // A land of no realm has no strength to show: grey like the unpeopled.
  const [none, weak, strong] = tint(
    "strength",
    new Map([
      [0, 0],
      [1, 300],
      [2, 300000],
    ]),
  );
  assert.ok(Math.abs(none[0]! - none[1]!) < 20, "no realm: grey");
  assert.notDeepEqual(weak, strong);
  for (const lens of ["unrest", "strength", "wealth", "knowledge", "growth"] as const) {
    const legend = lensLegend(lens);
    assert.equal(legend.kind, "ramp", lens);
  }
});
