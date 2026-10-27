// Phase 54 (C4): matter's pages on a world of its own chemistry. Earth's guide keeps its three tabs
// and counts, with no "This world" tab, and its lists are the Sun's own arrays. Alien 16's pages list
// its own substances, reactions and elements, and its "This world" tab says what it is made of.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { ALIEN, EARTH } from "../../src/host/planet.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { elementsOn, substancesOn } from "../../src/host/inspect/matter.ts";
import { withLifeElements, withLifeSubstances } from "../../src/host/biochem.ts";
import { worldChemistry } from "../../src/gen/index.ts";
import { homePlanet } from "../../src/sim/index.ts";
import {
  ELEMENTS,
  REACTIONS,
  SOLAR,
  SUBSTANCES,
  reactionsOn,
  type Chemistry,
} from "../../src/rules/index.ts";
import type { Block, Item, Line, PageModel, Span, Tab } from "../../src/bridge/index.ts";

const words = (l: Line | string): string =>
  typeof l === "string" ? l : l.map((s: Span) => (typeof s === "string" ? s : s.text)).join("");

const tabOf = (p: PageModel, id: string): Tab => {
  const t = p.tabs.find((x) => x.id === id);
  assert.ok(t, `a ${id} tab`);
  return t;
};

const titled = <K extends Block["type"]>(
  p: PageModel,
  tabId: string,
  title: string,
  type: K,
): Extract<Block, { type: K }> => {
  const b = tabOf(p, tabId).blocks.find(
    (x) => x.type === type && "title" in x && x.title === title,
  );
  assert.ok(b, `a ${type} titled "${title}" on the ${tabId} tab`);
  return b as Extract<Block, { type: K }>;
};

const listed = (p: PageModel, tabId: string, title: string): readonly Item[] =>
  titled(p, tabId, title, "list").items;

const factRow = (p: PageModel, title: string, label: string): string => {
  const row = titled(p, "world", title, "facts").rows.find((r) => r.label === label);
  assert.ok(row, `${label} in ${title}`);
  return words(row.value);
};

/** Every ref a list of blocks names: in its items, its table cells and its lines. */
function refsOf(blocks: readonly Block[]): string[] {
  const out: string[] = [];
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") {
      const o = x as { ref?: unknown };
      if (typeof o.ref === "string") out.push(o.ref);
      for (const v of Object.values(x)) walk(v);
    }
  };
  walk(blocks);
  return out;
}

const earth = EARTH.build(seedFromText("first light"));
const alien = ALIEN.build(seedFromText("alien 16"));

test("Earth's guide: its three tabs and counts as before, no 'This world' tab, the Sun's own lists", () => {
  const p = pageOf(earth, "world:matter");
  assert.deepEqual(
    p.tabs.map((t) => t.id),
    ["substances", "reactions", "elements"],
  );
  assert.deepEqual(
    p.stats.map((s) => words(s.value)),
    ["65", "30", "19"],
  );
  assert.equal(worldChemistry(homePlanet(earth).generated), SOLAR);
  assert.equal(substancesOn(SOLAR), SUBSTANCES);
  assert.equal(reactionsOn(SOLAR), REACTIONS);
  assert.equal(elementsOn(SOLAR), ELEMENTS);
});

test("alien 16 has a chemistry of its own, and its guide lists its own lists, with 'This world' last", () => {
  const chem = worldChemistry(homePlanet(alien).generated);
  assert.equal(chem.solar, false);
  const p = pageOf(alien, "world:matter#world");
  assert.equal(p.tab, "world");
  assert.deepEqual(
    p.tabs.map((t) => t.id),
    ["substances", "reactions", "elements", "world"],
  );
  assert.equal(p.tabs[3]!.name, "This world");
  assert.equal(words(p.stats[1]!.value), String(reactionsOn(chem).length));
  // (Its life's own substances and elements beside its tables: Phase 57.)
  const subs = withLifeSubstances(alien, substancesOn(chem));
  assert.ok(subs.length > substancesOn(chem).length, "its life's own beside them");
  assert.equal(words(p.stats[0]!.value), String(subs.length));
  assert.equal(
    words(p.stats[2]!.value),
    String(withLifeElements(alien, elementsOn(chem), subs).length),
  );
  assert.ok(reactionsOn(chem).length > REACTIONS.length, "its own reactions beyond Earth's");
});

test("alien 16's facts: its star, its metals, its oxygen, its ground and its hardener, in words", () => {
  const p = pageOf(alien, "world:matter#world");
  assert.equal(
    factRow(p, "What this world is made of", "Its star"),
    "4,530 K, 12.6 billion years old",
  );
  assert.equal(
    factRow(p, "What this world is made of", "Metals"),
    "−0.51 against the Sun: poor in metals",
  );
  assert.match(
    factRow(p, "What this world is made of", "Oxygen"),
    /^15\.1% of the air: thin in oxygen$/,
  );
  assert.equal(factRow(p, "What this world is made of", "Its hardener"), "arsenic");
  assert.match(factRow(p, "What this world is made of", "Its ground"), /^nothing rusts/);
});

test("alien 16's eleven blocks: the air, its life, the crust against Earth's, rocks, stones, ores, metals, furnaces and the thin air's want, words", () => {
  const p = pageOf(alien, "world:matter#world"),
    titles = tabOf(p, "world").blocks.map((b) => ("title" in b ? b.title : ""));
  assert.deepEqual(titles, [
    "What this world is made of",
    "The air (by volume)",
    "What its life is made of",
    "Its crust, against Earth's",
    "Its rocks",
    "Its stones",
    "Its ores",
    "Its metals",
    "Its furnaces",
    "",
    "In their own words",
  ]);
  const crust = titled(p, "world", "Its crust, against Earth's", "table");
  assert.deepEqual(crust.columns, ["Element", "Here (ppm)", "Earth (ppm)"]);
  assert.equal(crust.rows.length, 24);
});

test("alien 16's ores: native copper, mispickel and the native iron; its stones: lydite", () => {
  const p = pageOf(alien, "world:matter#world"),
    ores = listed(p, "world", "Its ores").map((i) => words(i.line));
  assert.ok(
    ores.some((r) => /^Native copper/.test(r)),
    "native copper",
  );
  assert.ok(
    ores.some((r) => /^Mispickel/.test(r)),
    "mispickel",
  );
  assert.ok(
    ores.some((r) => /^Native iron \(iron\)/.test(r)),
    "native iron, where native iron lies",
  );
  assert.ok(
    ores.every((r) => / at [\d,]+ °C$/.test(r)),
    "each ore with the heat that smelts it",
  );
  const stones = listed(p, "world", "Its stones").map((i) => words(i.line));
  assert.ok(
    stones.some((r) => /^Lydite/.test(r)),
    "lydite",
  );
  assert.equal(
    new Set(stones.map((r) => r.split(" — ")[0])).size,
    stones.length,
    "distinct by name",
  );
});

test("alien 16's furnaces: the kiln reaches 1,090 °C on its thin air, and comes with smelting copper", () => {
  const p = pageOf(alien, "world:matter#world"),
    furnaces = titled(p, "world", "Its furnaces", "table"),
    kiln = furnaces.rows.find((r) => words(r.cells[0]!) === "A kiln-furnace");
  assert.ok(kiln, "a kiln row");
  assert.equal(words(kiln.cells[1]!), "1,090 °C");
  assert.equal(words(kiln.cells[2]!), "smelting copper");
  // What makes up the thin air's want: a blast driven by mills, linked.
  const tab = tabOf(p, "world"),
    at = tab.blocks.findIndex((b) => b.type === "table" && b.title === "Its furnaces"),
    after = tab.blocks[at + 1];
  assert.equal(after?.type, "text");
  if (after?.type === "text") {
    assert.equal(
      words(after.lines[0]!),
      "Its thin air burns every fire 110 °C cooler than the Sun's own; a blast driven by mills of wind and water makes it up.",
    );
    assert.ok(refsOf([after]).includes("prin:mills"), "mills linked");
  }
});

test("alien 16's words: the people call the hardener, the surface copper, the bog iron and the stone", () => {
  const p = pageOf(alien, "world:matter#world"),
    said = listed(p, "world", "In their own words");
  assert.equal(said.length, 4);
  assert.ok(said.every((i) => /^[A-Z][^—]* — they call it [a-z]+$/.test(words(i.line))));
  assert.equal(said[0]!.ref, "subst:arsenic");
});

test("every link on alien 16's 'This world' tab opens a page", () => {
  const p = pageOf(alien, "world:matter#world"),
    refs = [...new Set(refsOf(tabOf(p, "world").blocks))];
  assert.ok(refs.length > 20, `${refs.length} links on the tab`);
  for (const r of refs) assert.notEqual(pageOf(alien, r).kind, "unknown", `${r} opens`);
});

test("arsenopyrite opens and becomes roast-arsenopyrite, which is heated to 700 °C", () => {
  const sub = pageOf(alien, "subst:arsenopyrite");
  assert.equal(sub.kind, "substance");
  assert.ok(
    listed(sub, "reactions", "What it becomes").some((i) => i.ref === "rxn:roast-arsenopyrite"),
  );
  const rx = pageOf(alien, "rxn:roast-arsenopyrite"),
    heat = rx.stats.find((s) => s.label === "Heat");
  assert.ok(heat, "a Heat stat");
  assert.equal(words(heat.value), "700 °C");
});

test("a nickel world's own lists: its garnierite, its nickel, the arsenic it falls back to", () => {
  // (Built by hand: the lists are pure reads of the chemistry, whatever world it is.)
  const nickel: Chemistry = {
    feH: -0.1,
    cO: 0.5,
    mgSi: 1.5,
    o2: 0.15,
    carbon: "oxide",
    metals: "solar",
    silica: "low",
    air: "thin",
    redox: "reduced",
    hardener: "nickel",
    solar: false,
  };
  const subs = substancesOn(nickel).map((s) => s.id),
    rxns = reactionsOn(nickel).map((r) => r.id),
    els = elementsOn(nickel).map((e) => e.symbol);
  for (const id of ["nickel", "garnierite", "tennantite", "white-arsenic", "cupronickel"])
    assert.ok(subs.includes(id), `${id} is one of its substances`);
  for (const id of ["smelt-garnierite", "roast-tennantite", "alloy-arsenical", "alloy-cupronickel"])
    assert.ok(rxns.includes(id), `${id} is one of its reactions`);
  assert.ok(els.includes("Ni") && els.includes("As"), "its novel elements");
  assert.equal(substancesOn({ ...nickel }), substancesOn(nickel), "made once per chemistry");
});
