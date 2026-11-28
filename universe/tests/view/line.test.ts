import { test } from "node:test";
import assert from "node:assert/strict";
import { FIELD_H, FIELD_W, MOTE, newDrop, stepDrop, worth, type DropState } from "../../src/view/drop.ts";
import { CRUMB, aboutHeld, divideHeld, heldCell, holdDrop, stepHeld } from "../../src/view/drop-held.ts";
import {
  cellDone,
  cellGates,
  cellOffers,
  cellSpan,
  clockOn,
  daughtersOf,
  firstTraits,
  lineAt,
  reynoldsOf,
  swimSpeed,
  whatNow,
  type LineRung,
  type Traits,
} from "../../src/view/line.ts";
import type { Block, DropKind } from "../../src/bridge/index.ts";

// Live a Line, S1: one cell of the first seas held by hand. What it can do is its world's; the same choices give the same
// line; a drop no hand is in lives exactly as it did.

type Drop = Extract<Block, { type: "drop" }>;
const KINDS: DropKind[] = [
  { ref: "a", name: "small cells", line: "", way: "eater", color: [1, 0.8, 0.4], size: 2, share: 0.6 },
  { ref: "b", name: "light-eaters", line: "", way: "light", color: [0.4, 0.9, 0.4], size: 5, share: 0.3 },
  { ref: "c", name: "hunting cells", line: "", way: "hunter", color: [0.8, 0.6, 1], size: 24, share: 0.05 },
  { ref: "d", name: "cells together", line: "", way: "colony", color: [0.4, 0.8, 0.6], size: 34, share: 0.05 },
];
const block = (over: Partial<Drop> = {}): Drop => ({
  type: "drop",
  habitat: "sea",
  seed: 7,
  light: 0.9,
  warmth: 20,
  food: 0.7,
  kinds: KINDS,
  ...over,
});
const RUNGS: LineRung[] = [
  { id: "cells", name: "The first cells", at: 3800, words: "" },
  { id: "light", name: "Light", at: 3400, words: "" },
  { id: "nucleus", name: "The nucleus", at: 2000, words: "" },
  { id: "together", name: "Cells together", at: 1200, words: "" },
  { id: "bodies", name: "The first bodies", at: 600, words: "" },
];
const WATER = { liquid: "water", pigment: "chlorophyll", liquidName: "water" };
const first = firstTraits(KINDS[0]!);

test("a cell's daughters are keyed draws: the same world, saga, generation and choice give the same daughters", () => {
  const gates = cellGates(WATER, RUNGS, 3700, 0.9),
    a = daughtersOf(first, "w1", 3, 0, gates, WATER),
    b = daughtersOf(first, "w1", 3, 0, gates, WATER),
    c = daughtersOf(first, "w1", 4, 0, gates, WATER),
    e = daughtersOf(first, "w2", 3, 0, gates, WATER);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c, "another saga draws other daughters");
  assert.notDeepEqual(a, e, "another world draws other daughters");
  assert.equal(a.length, 2, "two daughters while no new way is open");
  assert.ok(a[0]!.traits.size !== a[1]!.traits.size);
  for (const d of a) assert.ok(d.reasons.length > 0 && d.reasons.every((r) => r.length > 10));
  // The same choices give the same line, generation after generation.
  const gens = [
    { pick: 1, my: 3700 },
    { pick: 0, my: 3300 },
    { pick: 2, my: 1900 },
    { pick: 0, my: 1500 },
  ];
  const at = (my: number) => cellGates(WATER, RUNGS, my, 0.9),
    one = lineAt(first, "w1", 3, gens, at, WATER),
    two = lineAt(first, "w1", 3, gens, at, WATER);
  assert.deepEqual(one, two);
  assert.equal(one.length, 5);
  // By hand, generation by generation: the same as the line replayed.
  let t: Traits = first;
  gens.forEach((g, i) => {
    const ds = daughtersOf(t, "w1", 3, i, at(g.my), WATER);
    t = ds[Math.min(ds.length - 1, g.pick)]!.traits;
    assert.deepEqual(t, one[i + 1]);
  });
});

test("the ways a line takes up open no earlier than its world's own dates, and only where its world allows them", () => {
  const early = cellGates(WATER, RUNGS, 3700, 0.9);
  assert.ok(!early.light.open && early.light.allowed);
  assert.ok(!early.nucleus.open);
  assert.match(early.nucleus.why, /2\.00 billion years ago/);
  const later = cellGates(WATER, RUNGS, 1900, 0.9);
  assert.ok(later.light.open && later.nucleus.open && !later.together.open);
  // A methane world's life has no pigment light can drive in its seas: never light, whatever the date.
  const methane = cellGates({ pigment: "polyimine", liquidName: "liquid methane" }, RUNGS, 100, 0.9);
  assert.ok(!methane.light.allowed && !methane.light.open);
  assert.match(methane.light.why, /too little light/);
  // A world whose dawn never came to a step never opens it.
  const short = cellGates(WATER, RUNGS.filter((r) => r.id !== "nucleus"), 100, 0.9);
  assert.ok(!short.nucleus.allowed && !short.nucleus.open);
  // A third daughter takes up what is open: the nucleus before light, light before staying together.
  const ds = daughtersOf(first, "w1", 1, 0, later, WATER);
  assert.equal(ds.length, 3);
  assert.equal(ds[2]!.took, "nucleus");
  assert.ok(ds[2]!.traits.size > first.size * 2.5, "a cell with a nucleus is several times as wide");
  // Taking in, and basking, are greyed with their reasons until the line can.
  const offers = cellOffers({ t: first, gates: early, energy: 0, prey: null, basking: false, light: 0.9 });
  assert.deepEqual(
    offers.map((o) => [o.act, o.can]),
    [
      ["divide", false],
      ["dart", false],
      ["engulf", false],
      ["bask", false],
    ],
  );
  assert.match(offers[2]!.words, /nucleus/);
  assert.match(offers[3]!.words, /light/);
});

test("a cell swims as its world's liquid lets it: faster in a thinner one, and at a Reynolds number far under one", () => {
  const water = swimSpeed(first, { liquid: "water" }),
    methane = swimSpeed(first, { liquid: "methane" }),
    oil = swimSpeed(first, { liquid: "crude" });
  assert.ok(methane > water * 2 && oil < water * 0.5, `${water} ${methane} ${oil}`);
  const re = reynoldsOf(first, { liquid: "water" });
  assert.ok(re > 1e-6 && re < 1e-3, `Re ${re}`);
});

test("the deep clock goes on by what the line gathers, and stops short of the first bodies until its cells stay together", () => {
  const w = worth(first.size),
    span = cellSpan(RUNGS);
  // A division's gathering (twice its worth) is a thirtieth of the stage.
  const one = clockOn(span.from, 2 * w, w, RUNGS, first);
  assert.ok(Math.abs(span.from - one - (span.from - span.to) / 30) < 1e-6);
  const near = clockOn(span.to + 5, 100 * w, w, RUNGS, first);
  assert.ok(near > span.to, "held short of the bodies");
  assert.ok(!cellDone(near, RUNGS, first));
  const together = { ...first, nucleus: true, together: true };
  const reached = clockOn(span.to + 5, 100 * w, w, RUNGS, together);
  assert.equal(reached, span.to);
  assert.ok(cellDone(reached, RUNGS, together));
});

const run = (s: DropState, steps: number, f: (s: DropState) => void) => {
  for (let i = 0; i < steps; i++) f(s);
};

test("a drop no hand is in lives as before; the cell held goes only as far as it is pushed, and eats what it swims into", () => {
  // (A drop with a cell held runs its other lives by the same step: put aside, a drop is the drop.)
  const a = newDrop(block()),
    b = newDrop(block());
  run(a, 300, stepDrop);
  run(b, 300, stepDrop);
  assert.deepEqual(
    a.cells.map((c) => [c.id, c.x, c.y, c.energy]),
    b.cells.map((c) => [c.id, c.x, c.y, c.energy]),
  );
  const s = newDrop(block({ food: 0 }), [true, false, false, false]),
    h = holdDrop(s, first, swimSpeed(first, WATER), { x: 90, y: 60 }),
    c = heldCell(s, h)!;
  s.motes.length = 0;
  stepHeld(s, h);
  const still = { x: c.x, y: c.y };
  stepHeld(s, h);
  assert.deepEqual({ x: c.x, y: c.y }, still, "no push: it stays (it has no way on at its size)");
  h.mx = 1;
  h.my = 0;
  run(s, 30, (x) => stepHeld(x, h));
  assert.ok(c.x > still.x + 5 && Math.abs(c.y - still.y) < 1e-9, "pushed across, it goes across");
  h.mx = 0;
  const stopped = c.x;
  stepHeld(s, h);
  assert.equal(c.x, stopped, "let go, it stops at once");
  // Food in its way is taken in (each speck of a drop about a held cell a crumb: view/drop-held.ts CRUMB).
  const e0 = c.energy;
  s.motes.push({ x: c.x + 2, y: c.y, vx: 0, vy: 0 }, { x: c.x + 4, y: c.y, vx: 0, vy: 0 });
  h.mx = 1;
  run(s, 20, (x) => stepHeld(x, h));
  assert.equal(h.ate, 2);
  assert.ok(c.energy > e0 + 2 * MOTE * CRUMB * 0.8, `${e0} → ${c.energy}`);
  assert.ok(h.gained >= 2 * MOTE * CRUMB - 1e-9);
});

test("a hunting cell takes the cell held where it reaches it; divided, the hand goes on in the daughter chosen", () => {
  const s = newDrop(block(), [true, false, true, false]),
    h = holdDrop(s, first, swimSpeed(first, WATER), { x: 90, y: 60 }),
    c = heldCell(s, h)!;
  const hunter = s.cells.find((x) => x.way === "hunter")!;
  hunter.x = c.x;
  hunter.y = c.y;
  hunter.full = 0;
  stepHeld(s, h);
  assert.equal(h.ended, "taken");
  assert.ok(!heldCell(s, h));

  const t = newDrop(block(), [true, false, false, false]),
    g = holdDrop(t, first, swimSpeed(first, WATER), { x: 40, y: 40 }),
    m = heldCell(t, g)!;
  m.energy = 2.1 * worth(first.size);
  g.act = "divide";
  stepHeld(t, g);
  assert.ok(g.dividing);
  const gates = cellGates(WATER, RUNGS, 3700, 0.9),
    ds = daughtersOf(first, "w", 1, 0, gates, WATER),
    before = t.cells.length,
    e = m.energy;
  const next = divideHeld(t, g, ds.map((d) => d.traits), 1, (x) => swimSpeed(x, WATER))!;
  const n = heldCell(t, next)!;
  assert.equal(n.size, ds[1]!.traits.size);
  assert.equal(n.generation, m.generation + 1);
  assert.equal(t.cells.length, before + ds.length - 1, "one cell became its daughters");
  assert.ok(Math.abs(n.energy - e / ds.length) < 1e-9, "what it gathered shared among them");
  // The eye's drop wraps about the one held: it stands in the middle across.
  const seen = aboutHeld(t, next).cells.find((x) => x.id === next.id)!;
  assert.equal(seen.x, FIELD_W / 2);
  assert.ok(seen.y >= 0 && seen.y <= FIELD_H);
});

test("What now? reads the stage and says the next thing to do", () => {
  const gates = cellGates(WATER, RUNGS, 3700, 0.9),
    base = {
      moved: true,
      ate: 0,
      energy: 0,
      t: first,
      choosing: false,
      food: { d: 12, dx: -10, dy: 2 },
      threat: null,
      gates,
      my: 3700,
      rungs: RUNGS,
      basking: false,
      light: 0.9,
    };
  assert.match(whatNow({ ...base, moved: false, food: null }), /Drag/);
  assert.match(whatNow(base), /to your left/);
  assert.match(whatNow({ ...base, threat: 20 }), /Dart/);
  assert.match(whatNow({ ...base, energy: 2 * worth(first.size) }), /Divide/);
  assert.match(whatNow({ ...base, choosing: true }), /daughter/);
  assert.match(whatNow({ ...base, gates: cellGates(WATER, RUNGS, 1900, 0.9) }), /nucleus/);
});
