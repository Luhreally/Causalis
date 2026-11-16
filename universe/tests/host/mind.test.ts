// Round "peoples", read: a land's page says what makes its ways and who reads there, its Over time tab draws its readers, its
// faith's page says what it holds, the letters lens reads a land, and the book of concepts has their pages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EARTH } from "../../src/host/planet.ts";
import { PEOPLES_CONCEPTS } from "../../src/host/inspect/peoples-concepts.ts";
import { lensReading } from "../../src/host/lenses.ts";
import { beliefOf, populationContext, readersOf } from "../../src/sim/index.ts";
import type { Block, PageModel } from "../../src/bridge/index.ts";
import { universeWorld } from "./worlds.ts";

const world = universeWorld(EARTH, "first light", 125);
const ask = <T>(type: string, args: unknown = {}) => EARTH.queries[type]!(world, args) as T;
const page = (ref: string) => ask<PageModel>("page", { ref }),
  blocks = (p: PageModel, tab: string): readonly Block[] =>
    p.tabs.find((t) => t.id === tab)?.blocks ?? [],
  titled = (bs: readonly Block[], title: string) =>
    bs.find((b) => "title" in b && b.title === title);

test("a land that reads says who reads and why, draws its readers through the years, and the lens reads it", () => {
  const ctx = populationContext(world),
    lands = ctx.provinces
      .all()
      .filter((p) => p.total() > 0)
      .sort((a, b) => readersOf(world, b.cell) - readersOf(world, a.cell) || a.cell - b.cell),
    land = lands[0]!;
  assert.ok(readersOf(world, land.cell) > 0, "someone reads by year 125");
  const p = page(`cell:0:${land.cell}`),
    people = blocks(
      p,
      p.tabs.find((t) => t.blocks.some((b) => "title" in b && b.title === "Reading and writing"))
        ?.id ?? "",
    );
  const letters = titled(people, "Reading and writing");
  assert.ok(letters && letters.type === "facts", "a Reading and writing block");
  if (letters?.type === "facts") {
    const who = letters.rows.find((r) => r.label === "Who read");
    assert.ok(who && /\d/.test(who.value.join("")), "who read, in numbers");
    assert.equal(who?.concept, "letters", "linked to its concept");
  }
  const why = titled(people, "What makes them so");
  assert.ok(why && why.type === "text" && why.lines.length > 0, "what makes their ways");
  if (why?.type === "text")
    for (const l of why.lines) assert.match(l.join(""), /^They [^:]+: .+\.$/);
  const time = blocks(p, "time").find((b) => b.type === "series" && b.title === "Who read");
  assert.ok(
    time && time.type === "series" && time.points.length >= 2,
    "who read, through the years",
  );
  const r = lensReading(world, land.cell, "letters");
  assert.match(r?.line ?? "", /^Letters: \d/);
});

test("a faith's page says what it holds", () => {
  const f = beliefOf(world).all()[0]!;
  const p = page(f.ref),
    holds = titled(blocks(p, "overview"), "What it holds");
  assert.ok(holds && holds.type === "facts", "a What it holds block");
  if (holds?.type === "facts") assert.ok(holds.rows.some((r) => r.label === "The power"));
});

test("the book has the pages of ways, letters and inquiry", () => {
  for (const [id, c] of Object.entries(PEOPLES_CONCEPTS)) {
    const p = page(`concept:${id}`);
    assert.equal(p.title, c.title, id);
    const related = p.tabs[0]!.blocks.find((b) => b.type === "list" && b.title === "Bound up with");
    assert.ok(related && related.type === "list" && related.items.length >= 2, `${id} bound up`);
    for (const i of related.items)
      assert.notEqual(page(i.ref!).title, "The book of concepts", `${id}: ${i.ref} has a page`);
  }
});
