import { test } from "node:test";
import assert from "node:assert/strict";
import { FIELD_H, FIELD_W, newDrop, stepDrop, type DropState } from "../../src/ui/drop.ts";
import type { Block, DropKind } from "../../src/bridge/index.ts";

type Drop = Extract<Block, { type: "drop" }>;

const KINDS: DropKind[] = [
  {
    ref: "a",
    name: "small cells",
    line: "the first cells",
    way: "eater",
    color: [1, 0.8, 0.4],
    size: 2,
    share: 0.58,
  },
  {
    ref: "b",
    name: "light-eaters",
    line: "the light-eaters",
    way: "light",
    color: [0.4, 0.9, 0.4],
    size: 5,
    share: 0.32,
  },
  {
    ref: "c",
    name: "hunting cells",
    line: "cells with a nucleus",
    way: "hunter",
    color: [0.8, 0.6, 1],
    size: 24,
    share: 0.05,
  },
  {
    ref: "d",
    name: "cells together",
    line: "cells together",
    way: "colony",
    color: [0.4, 0.8, 0.6],
    size: 34,
    share: 0.05,
  },
];
const drop = (habitat: Drop["habitat"], over: Partial<Drop> = {}): Drop => ({
  type: "drop",
  habitat,
  seed: 11,
  light: 0.9,
  warmth: 20,
  food: 0.7,
  kinds: KINDS,
  ...over,
});
/** Seconds of a drop's own time run on. */
const run = (s: DropState, seconds: number) => {
  while (s.t < seconds) stepDrop(s);
};
const counts = (s: DropState) => KINDS.map((_, i) => s.cells.filter((c) => c.kind === i).length);

test("a drop of the sea keeps its kinds together: the hunters live on what they take, the light-eaters on the light", () => {
  const s = newDrop(drop("sea"));
  run(s, 300);
  const n = counts(s);
  assert.ok(
    n.every((x) => x > 0),
    `every kind lives after five minutes: ${n.join("/")}`,
  );
  assert.ok(s.born > 300 && s.eaten > 50, `they divide (${s.born}) and are taken in (${s.eaten})`);
  assert.ok(s.cells.length <= 240, "never more than the drop holds");
  for (const c of s.cells) {
    assert.ok(c.x >= 0 && c.x < FIELD_W && c.y >= 0 && c.y <= FIELD_H, "every cell is in the drop");
    assert.ok(c.size > 0 && c.speed > 0 && Number.isFinite(c.energy));
  }
});

test("the same drop shows the same lives; another seed, others", () => {
  const a = newDrop(drop("fresh")),
    b = newDrop(drop("fresh")),
    c = newDrop(drop("fresh", { seed: 12 }));
  run(a, 60);
  run(b, 60);
  run(c, 60);
  const sig = (s: DropState) => s.cells.map((x) => `${x.kind}:${x.size.toFixed(3)}`).join(",");
  assert.equal(sig(a), sig(b));
  assert.notEqual(sig(a), sig(c));
});

test("what the hunters take is selected against: the light-eaters' mean size changes as they are watched", () => {
  const s = newDrop(drop("sea"));
  run(s, 600);
  const first = s.history[0]!.size[1]!,
    last = s.history.at(-1)!.size[1]!;
  assert.ok(
    Math.abs(last - first) / first > 0.1,
    `light-eaters ${first.toFixed(2)} → ${last.toFixed(2)} µm`,
  );
  // Daughters are a little unlike their mothers: the light-eaters' sizes spread.
  const sizes = s.cells.filter((c) => c.kind === 1).map((c) => c.size);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) > 0.3, "sizes vary");
});

test("a dark drop of soil starves its light-eaters; in the cold, lives go slowly", () => {
  const soil = newDrop(drop("soil", { light: 0.15 }));
  run(soil, 240);
  assert.ok(counts(soil)[1]! <= 3, `few light-eaters in the dark: ${counts(soil)[1]}`);
  assert.ok(counts(soil)[0]! > 10, "small cells live on what the soil holds");
  const cold = newDrop(drop("ice", { warmth: -12 })),
    warm = newDrop(drop("sea"));
  for (let i = 0; i < 900; i++) {
    stepDrop(cold);
    stepDrop(warm);
  }
  assert.ok(cold.t < warm.t / 2, "the ice's time runs slower");
});
