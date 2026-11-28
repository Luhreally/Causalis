// Live a Line's budget (asked 2026-11-27): the drop with a cell held steps thirty times a second on the page, so a step
// at its most cells (240) must cost no more than 1.5 ms; and a beast held in its age's living world steps twenty times a
// second, within the same. Measured on a world's own first seas (first light's dawn drop), filled to its most.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { OPEN } from "../../src/rules/index.ts";
import { generateHomeWorld } from "../../src/gen/index.ts";
import { dawnSeaOf, dropOfWorld } from "../../src/host/inspect/small.ts";
import { newDrop, stepDrop } from "../../src/view/drop.ts";
import { MOST } from "../../src/view/line.ts";
import { holdDrop, stepHeld } from "../../src/view/drop-held.ts";
import { firstTraits, swimSpeed } from "../../src/view/line.ts";
import { bredOn, foundersOf } from "../../src/host/line.ts";
import { holdMeadow, newMeadow, stepMeadow } from "../../src/view/meadow.ts";

const g = generateHomeWorld(seedFromText("first light"), OPEN);

test("a step of the drop with a cell held, at its most cells, costs no more than 1.5 ms", () => {
  const block = dropOfWorld(g, dawnSeaOf(g), { dawn: true })!,
    s = newDrop(block);
  // (Filled to its most: stepped until it is as full as it grows.)
  for (let i = 0; i < 6000 && s.cells.length < MOST; i++) stepDrop(s);
  const eater = block.kinds.find((k) => k.way === "eater") ?? block.kinds[0]!,
    t = firstTraits(eater, eater.pace ?? 1),
    h = holdDrop(s, t, swimSpeed(t, { liquid: "water" }));
  assert.ok(s.cells.length >= MOST - 10, `cells ${s.cells.length}`);
  for (let i = 0; i < 60; i++) stepHeld(s, h);
  const n = 600,
    t0 = performance.now();
  for (let i = 0; i < n; i++) {
    h.mx = Math.sin(i / 40);
    h.my = Math.cos(i / 55);
    stepHeld(s, h);
  }
  const ms = (performance.now() - t0) / n;
  console.log(`drop step with a cell held, ${s.cells.length} cells: ${ms.toFixed(3)} ms`);
  assert.ok(ms <= 1.5, `${ms.toFixed(3)} ms`);
});

test("a step of a beast's living world with the line's beast held costs no more than 1.5 ms", () => {
  const f = foundersOf(g, "first light", 1, 30)[0]!,
    bred = bredOn(g, f.genome, f.way, 600, 575, "first light", 1, 1000),
    lineage = {
      ref: "line:held",
      name: "your line",
      niche: "swimmer",
      arose: 0,
      died: null,
      size: bred.genome.mass,
      level: 2,
      body: bred.line!.body,
      words: null,
    },
    m = newMeadow(
      { seed: "first light", ages: [], lineages: [lineage] } as never,
      0,
      "first light line",
      false,
    ),
    b = m.beasts[0]!,
    h = holdMeadow(m, b.id)!;
  for (let i = 0; i < 40; i++) stepMeadow(m);
  const n = 600,
    t0 = performance.now();
  for (let i = 0; i < n; i++) {
    h.mx = Math.sin(i / 40);
    h.mz = Math.cos(i / 55);
    stepMeadow(m);
  }
  const ms = (performance.now() - t0) / n;
  console.log(
    `living world step with the beast held, ${m.beasts.length} beasts: ${ms.toFixed(3)} ms`,
  );
  assert.ok(ms <= 1.5, `${ms.toFixed(3)} ms`);
});
