import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { ALIEN, EARTH } from "../../src/host/planet.ts";
import { populationContext } from "../../src/sim/index.ts";
import type { Block, PageModel } from "../../src/bridge/index.ts";
import type { HouseholdView } from "../../src/ui/people.ts";

// Phase 36 M182: the thread back to the beginning — from a life, a town or a land, a scale at a
// time, to the galaxy turning; each step opening its own page.

const world = EARTH.build(seedFromText("first light"));
world.runTo(60 * YEAR);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const page = (ref: string) => ask<PageModel>("page", { ref });
type Thread = Extract<Block, { type: "thread" }>;
const threadOf = (p: PageModel) =>
  p.tabs.find((t) => t.id === "origins")?.blocks.find((b): b is Thread => b.type === "thread");
const ctx = populationContext(world),
  town = [...ctx.settlements.all()].sort((a, b) => b.population - a.population)[0]!;

test("a life's thread: born to whom and where, their town, their land, their people, their line, the world", () => {
  const hh = ask<HouseholdView>("observe.meet", { cell: town.cell, village: town.ref }),
    one = hh.members.find((m) => m.role === "child") ?? hh.members[0]!,
    thread = threadOf(page(one.ref));
  assert.ok(thread, "an Origins tab with its thread");
  const scales = thread.steps.map((s) => s.scale);
  assert.deepEqual(scales.slice(0, 5), ["A life", "A town", "A land", "A people", "Their kind"]);
  assert.deepEqual(scales.slice(-2), ["The world", "The galaxy"]);
  assert.ok(scales.filter((s) => s === "Their line").length >= 2, scales.join(" > "));
  assert.ok(scales.filter((s) => s === "Life's dawn").length >= 4, scales.join(" > "));
  assert.equal(thread.steps[0]!.ref, one.ref);
  assert.equal(thread.steps[1]!.ref, town.ref);
  assert.equal(thread.steps[2]!.ref, `cell:0:${town.cell}`);
  // (Each further back than the last: the dawn's last step the first replicators.)
  const dawn = thread.steps.filter((s) => s.scale === "Life's dawn");
  assert.match(JSON.stringify(dawn.at(-1)!.line), /first replicators/);
  assert.match(thread.steps.at(-2)!.when, /billion years ago/);
  // Every step and every name on it opens a page.
  for (const s of thread.steps) {
    if (s.ref) assert.ok(page(s.ref).title, s.ref);
    for (const span of s.line)
      if (typeof span !== "string") assert.ok(page(span.ref).title, span.ref);
  }
});

test("a town's thread begins at the town, a land's at the land", () => {
  const t = threadOf(page(town.ref))!;
  assert.equal(t.steps[0]!.scale, "A town");
  assert.match(JSON.stringify(t.steps[0]!.line), new RegExp(`founded in year ${town.founded}`));
  const l = threadOf(page(`cell:0:${town.cell}`))!;
  assert.equal(l.steps[0]!.scale, "A land");
  assert.equal(l.steps[1]!.scale, "A people");
});

test("on a world the hand made, its thread ends in the hand's making", () => {
  const made = ALIEN.build(seedFromText("violet hollow ~star red"));
  made.runTo(YEAR / 8);
  const g = populationContext(made).generated,
    cradle = g.life.people!.cell,
    land = [...populationContext(made).provinces.all()].find((p) => p.cell === cradle) ?? null,
    cell = land?.cell ?? [...populationContext(made).provinces.all()][0]!.cell,
    t = (ALIEN.queries["page"]!(made, { ref: `cell:0:${cell}` }) as PageModel).tabs
      .find((x) => x.id === "origins")!
      .blocks.find((b): b is Thread => b.type === "thread")!,
    world = t.steps.find((s) => s.scale === "The world")!;
  assert.match(JSON.stringify(world.line), /made so by your hand: a dim red star/);
  // (Its lands named where they lie, within a sentence in lower case: "rose to thought in the tundra at …".)
  const rose = t.steps.find((s) => s.scale === "A people")!.line[1]!;
  assert.match(typeof rose === "string" ? rose : rose.text, /^the tundra at /);
  assert.match(JSON.stringify(world.line), /an M\d?V? ?star|an M\w* star/);
});
