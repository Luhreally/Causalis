// Names over the scene come and go faded where they stand, never within a frame (the owner's rule, 2026-11-21), and one
// hidden by another comes back only once clear of it (no flicker where two meet).
import { test } from "node:test";
import assert from "node:assert/strict";

/** Just enough of a page for the label layer: elements with a style, a class list, children. */
class Node0 {
  className = "";
  textContent = "";
  hidden = false;
  readonly style: Record<string, string> = { opacity: "", transform: "" };
  readonly children: Node0[] = [];
  parent: Node0 | null = null;
  readonly classList = { add: () => {}, toggle: () => {} };
  append(...c: Node0[]) {
    for (const x of c) {
      x.parent = this;
      this.children.push(x);
    }
  }
  prepend(c: Node0) {
    this.append(c);
  }
  remove() {
    const p = this.parent;
    if (p) p.children.splice(p.children.indexOf(this), 1);
    this.parent = null;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 };
  }
  getClientRects() {
    return [];
  }
  get lastElementChild(): Node0 | null {
    return this.children.at(-1) ?? null;
  }
}
(globalThis as { document?: unknown }).document = { createElement: () => new Node0() };
let clock = 0;
(globalThis as { performance: { now: () => number } }).performance.now = () => clock;

const { LabelLayer } = await import("../../src/ui/labels.ts");

const opacity = (s: Node0) => (s.hidden ? 0 : s.style.opacity === "" ? 1 : Number(s.style.opacity));

test("a name comes and goes over a fifth of a second, where it stands", () => {
  const root = new Node0(),
    layer = new LabelLayer(root as unknown as HTMLElement),
    pool = root.children[0]!;
  const step = (labels: Parameters<typeof layer.update>[0]) => {
    clock += 1000 / 60;
    layer.update(labels);
  };
  const one = [{ key: "a", text: "Formere", at: { x: 400, y: 300 } }];
  step(one);
  const span = pool.children[0]!;
  const seen: number[] = [];
  for (let i = 0; i < 16; i++) {
    step(one);
    seen.push(opacity(span));
  }
  assert.equal(seen.at(-1), 1);
  // (It goes where its thing is, frame by frame.)
  step([{ key: "a", text: "Formere", at: { x: 412, y: 296 } }]);
  assert.ok(span.style.transform!.includes("translate(412px, 296px)"));
  step(one);
  for (let i = 1; i < seen.length; i++)
    assert.ok(seen[i]! - seen[i - 1]! <= 0.1, `jumped ${seen[i - 1]} -> ${seen[i]}`);
  // Gone from the list: faded out where it stood, then let go.
  const going: number[] = [];
  for (let i = 0; i < 16; i++) {
    step([]);
    going.push(span.parent ? opacity(span) : 0);
  }
  for (let i = 1; i < going.length; i++) assert.ok(going[i - 1]! - going[i]! <= 0.1);
  assert.equal(span.parent, null);
  assert.ok(span.style.transform!.includes("translate(400px, 300px)"));
});

test("one hidden by another (the lesser) fades, and comes back only once clear of it by a few pixels", () => {
  const root = new Node0(),
    layer = new LabelLayer(root as unknown as HTMLElement),
    pool = root.children[0]!;
  const at = (x: number) => [
    { key: "big", text: "Sebrou", at: { x: 400, y: 300 }, priority: 2 },
    { key: "small", text: "Haimath", at: { x, y: 300 }, priority: 1 },
  ];
  for (let i = 0; i < 30; i++) {
    clock += 1000 / 60;
    layer.update(at(520));
  }
  const small = pool.children[1]!;
  assert.equal(opacity(small), 1);
  // (Their halves: 6 letters = 29 px, 7 = 32.5 px; side by side, they touch at 400 + 29 + 32.5 = 461.5.)
  // Moved to just overlapping by a pixel: kept (within GIVE).
  for (let i = 0; i < 30; i++) {
    clock += 1000 / 60;
    layer.update(at(460.5));
  }
  assert.equal(opacity(small), 1);
  // Over it: faded out.
  for (let i = 0; i < 30; i++) {
    clock += 1000 / 60;
    layer.update(at(440));
  }
  assert.equal(opacity(small), 0);
  // Just clear of it: still hidden (it must come GIVE clear).
  for (let i = 0; i < 30; i++) {
    clock += 1000 / 60;
    layer.update(at(462.5));
  }
  assert.equal(opacity(small), 0);
  for (let i = 0; i < 30; i++) {
    clock += 1000 / 60;
    layer.update(at(470));
  }
  assert.equal(opacity(small), 1);
});

test("cleared: every name gone at once (the scale they stood over is gone)", () => {
  const root = new Node0(),
    layer = new LabelLayer(root as unknown as HTMLElement),
    pool = root.children[0]!;
  clock += 16;
  layer.update([{ key: "a", text: "A", at: { x: 10, y: 10 } }]);
  assert.equal(pool.children.length, 1);
  layer.clear();
  assert.equal(pool.children.length, 0);
});
