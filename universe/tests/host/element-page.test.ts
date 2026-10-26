// Phase 54 M223: an element's page (`elem:<symbol>`): what it is as it stands pure, its picture, and what
// on the world holds it — every substance whose formula has it, the largest share of its weight first,
// forty at most. Reading it changes nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { SUBSTANCES } from "../../src/rules/index.ts";
import { ALIEN, EARTH } from "../../src/host/planet.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { elementPage } from "../../src/host/inspect/element.ts";
import type { Block, Item, Line, PageModel, Span } from "../../src/bridge/index.ts";

const words = (l: Line | string): string =>
  typeof l === "string" ? l : l.map((s: Span) => (typeof s === "string" ? s : s.text)).join("");

const earth = EARTH.build(seedFromText("first light"));
const alien = ALIEN.build(seedFromText("alien 16"));

/** A page's one sentence of what the element is (its overview's text). */
function sentence(p: PageModel): string {
  const t = p.tabs.find((x) => x.id === "overview")!.blocks.find((b) => b.type === "text");
  assert.ok(t && t.type === "text", "a text block");
  return words(t.lines[0]!);
}

/** A page's stat, in words. */
function stat(p: PageModel, label: string): string {
  const s = p.stats.find((x) => x.label === label);
  assert.ok(s, `a stat "${label}"`);
  return words(s.value);
}

/** The 'What holds it' list of a page, if there is one (an empty list is not shown). */
function holding(p: PageModel): { items: readonly Item[]; more: number } | null {
  const b = p.tabs
    .find((x) => x.id === "overview")!
    .blocks.find(
      (x): x is Extract<Block, { type: "list" }> =>
        x.type === "list" && x.title === "What holds it",
    );
  return b ? { items: b.items, more: b.more ?? 0 } : null;
}

test("copper's page: an element with its picture, its weight, its state and sort, and what holds it on Earth", () => {
  const p = pageOf(earth, "elem:Cu");
  assert.equal(p.kind, "element");
  assert.equal(p.icon, "⚛️");
  assert.equal(p.title, "Copper (Cu)");
  assert.equal(words(p.subtitle), "An element: its atoms all of one kind");
  assert.equal(p.portrait?.kind, "element");
  assert.equal(stat(p, "A mole weighs"), "63.546 g");
  assert.equal(stat(p, "At 15 °C"), "a solid");
  assert.equal(stat(p, "It is"), "a metal");
  assert.equal(sentence(p), "A metal, that carries heat and the current well.");
  assert.equal(p.followable, false);
  assert.equal(p.place, null);
  const held = holding(p);
  assert.ok(held, "a What holds it list");
  const refs = held.items.map((i) => i.ref);
  assert.ok(refs.includes("subst:malachite"), "malachite holds it");
  assert.ok(refs.includes("subst:chalcopyrite"), "chalcopyrite holds it");
  assert.equal(refs[0], "subst:copper", "the largest share of its weight first");
  for (const i of held.items) assert.equal(i.thumb?.kind, "matter", `${i.ref} has its picture`);
});

test("sodium is kept under oil, and argon is a noble gas that glows in lightning", () => {
  assert.equal(sentence(pageOf(earth, "elem:Na")), "A metal, kept under oil: it burns in the air.");
  const ar = pageOf(earth, "elem:Ar");
  assert.equal(sentence(ar), "A gas that glows when lightning passes through it.");
  assert.equal(stat(ar, "At 15 °C"), "a gas");
  assert.equal(stat(ar, "It is"), "a noble gas, that joins with nothing");
});

test("oxygen: what holds it is listed forty at most, and the rest counted", () => {
  const holders = SUBSTANCES.filter((s) => s.formula.O !== undefined).length;
  assert.ok(holders > 40, `${holders} substances on Earth hold oxygen`);
  const held = holding(pageOf(earth, "elem:O"));
  assert.ok(held);
  assert.equal(held.items.length, 40);
  assert.equal(held.more, holders - 40);
});

test("alien 16's arsenic: a metalloid, and what on that world holds it lists arsenopyrite or white arsenic", () => {
  const p = pageOf(alien, "elem:As");
  assert.equal(p.kind, "element");
  assert.equal(stat(p, "It is"), "a metalloid");
  const held = holding(p);
  assert.ok(held, "a What holds it list");
  const refs = held.items.map((i) => i.ref);
  assert.ok(
    refs.includes("subst:arsenopyrite") || refs.includes("subst:white-arsenic"),
    refs.join(", "),
  );
});

test("an element nothing on Earth holds: its nature is still said, and no list is shown", () => {
  const p = pageOf(earth, "elem:Ni");
  assert.equal(p.kind, "element");
  assert.equal(p.title, "Nickel (Ni)");
  assert.equal(sentence(p), "A metal, that carries heat and the current well.");
  assert.equal(holding(p), null);
});

test("an unknown symbol is no element: its page throws, and the world shows it as unknown", () => {
  assert.throws(() => elementPage(earth, "elem:Xx"), /no element elem:Xx/);
  assert.equal(pageOf(earth, "elem:Xx").kind, "unknown");
});

test("search finds an element by its name, as it finds a substance", () => {
  const found = EARTH.queries.search!(earth, { text: "copper" }) as {
    ref: string;
    title: string;
  }[];
  assert.ok(
    found.some((f) => f.ref === "elem:Cu" && f.title === "Copper (Cu)"),
    JSON.stringify(found.slice(0, 5)),
  );
});
