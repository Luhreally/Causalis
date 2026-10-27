// Phase 54 M223: matter's pictures on its pages — each substance's specimen, the guide's thumbnails, the
// elements' rows that open their pages, the element names in a substance's composition, the "This world"
// tab's stones, ores and metals, and a deposit's picture (its first mineral). Reading them changes nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hashString, seedFromText } from "../../src/kernel/index.ts";
import { isProvinceWorld, worldChemistry } from "../../src/gen/index.ts";
import { homePlanet } from "../../src/sim/index.ts";
import { ELEMENTS, SUBSTANCES } from "../../src/rules/index.ts";
import { ALIEN, EARTH } from "../../src/host/planet.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { substancesOn } from "../../src/host/inspect/matter.ts";
import { withLifeSubstances } from "../../src/host/biochem.ts";
import type { Block, Item, PageModel, Tab } from "../../src/bridge/index.ts";

const earth = EARTH.build(seedFromText("first light"));
const alien = ALIEN.build(seedFromText("alien 16"));

const tabOf = (p: PageModel, id: string): Tab => {
  const t = p.tabs.find((x) => x.id === id);
  if (!t) throw new Error(`a ${id} tab`);
  return t;
};

/** The items of a tab's lists (of the list with this title, if one is named). */
const itemsOf = (p: PageModel, tab: string, title?: string): Item[] =>
  tabOf(p, tab).blocks.flatMap((b) =>
    b.type === "list" && (title === undefined || b.title === title) ? [...b.items] : [],
  );

test("every substance on the guide carries its matter picture, keyed by its id", () => {
  const items = itemsOf(pageOf(earth, "world:matter"), "substances");
  assert.equal(items.length, SUBSTANCES.length, "every substance listed");
  for (const i of items) {
    const id = i.ref!.slice("subst:".length);
    assert.ok(i.thumb?.kind === "matter" && i.thumb.key === hashString(id), `${i.ref} pictured`);
  }
});

test("the guide's elements: each row a picture of its element, and opening that element's page", () => {
  const table = tabOf(pageOf(earth, "world:matter"), "elements").blocks.find(
    (b): b is Extract<Block, { type: "table" }> => b.type === "table",
  );
  assert.ok(table, "the elements table");
  assert.equal(table.rows.length, ELEMENTS.length);
  for (const r of table.rows) {
    const symbol = r.ref!.slice("elem:".length);
    assert.equal(r.thumb?.kind, "element", `${r.ref} pictured`);
    assert.ok(r.thumb?.kind === "element" && r.thumb.symbol === symbol);
    assert.equal(pageOf(earth, r.ref!).kind, "element", `${r.ref} opens`);
  }
});

test("a substance's page: its matter picture, and its elements named as links to their own pages", () => {
  const p = pageOf(earth, "subst:malachite");
  assert.equal(p.portrait?.kind, "matter");
  assert.ok(
    p.portrait?.kind === "matter" &&
      p.portrait.habit === "botryoidal" &&
      p.portrait.form === "crystal",
    "malachite grows as botryoidal crystals",
  );
  const comp = tabOf(p, "overview").blocks.find(
    (b): b is Extract<Block, { type: "composition" }> =>
      b.type === "composition" && b.title === "Its elements",
  );
  assert.ok(comp, "its elements");
  assert.ok(comp.parts.length >= 3);
  for (const part of comp.parts) {
    const name = part.name[0];
    assert.ok(name && typeof name === "object" && name.ref.startsWith("elem:"), `${name} links`);
    assert.equal(pageOf(earth, name.ref).kind, "element", `${name.ref} opens`);
  }
});

test("alien 16's 'This world': its stones, ores, metals and words carry pictures; its rocks name no substance and carry none", () => {
  const p = pageOf(alien, "world:matter#world");
  for (const title of ["Its stones", "Its ores", "Its metals", "In their own words"]) {
    const items = itemsOf(p, "world", title);
    assert.ok(items.length > 0, title);
    for (const i of items) {
      if (i.ref?.startsWith("subst:"))
        assert.equal(i.thumb?.kind, "matter", `${title}: ${i.ref} pictured`);
      else assert.equal(i.thumb, undefined, `${title}: no substance, no picture`);
    }
  }
  const rocks = itemsOf(p, "world", "Its rocks");
  assert.ok(rocks.length > 0, "its rocks");
  for (const i of rocks) assert.equal(i.thumb, undefined, "a rock is no substance");
  // The alien's own substances are the ones pictured on its guide, too.
  const own = itemsOf(pageOf(alien, "world:matter"), "substances");
  assert.equal(
    own.length,
    withLifeSubstances(alien, substancesOn(worldChemistry(homePlanet(alien).generated))).length,
  );
  for (const i of own) assert.equal(i.thumb?.kind, "matter", `${i.ref} pictured`);
});

test("a deposit's picture is its first mineral, as a specimen; a copper deposit's is malachite", () => {
  const g = homePlanet(earth).generated,
    fine = isProvinceWorld(g) ? g.fine : g,
    copper = fine.deposits.find((d) => d.kind === "copper");
  assert.ok(copper, "a copper deposit on Earth");
  const p = pageOf(earth, copper.ref);
  assert.equal(p.kind, "deposit");
  assert.ok(
    p.portrait?.kind === "matter" && p.portrait.key === hashString("malachite"),
    "malachite, the first of its ores",
  );
});
