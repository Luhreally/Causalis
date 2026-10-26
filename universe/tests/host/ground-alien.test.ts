// Phase 54 (C3): a world's own ground and deposit pages. Alien 16 is reduced, thin of air and
// arsenic-hardened: its bedrock is black shale and grey sandstone, no soil holds hematite, its air
// keeps about .151 of oxygen, and its tin is arsenopyrite, roasted for the arsenic. Alien 106 is
// nickel-hardened (its crust poor in silica): its tin is garnierite. Earth's own pages are digested
// in chain-pre54.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText, type World } from "../../src/kernel/index.ts";
import { BIOME, isProvinceWorld, nativeIronLands, worldChemistry } from "../../src/gen/index.ts";
import { homePlanet } from "../../src/sim/index.ts";
import { ALIEN } from "../../src/host/planet.ts";
import { SOILS, worldRocks, worldSoil } from "../../src/rules/index.ts";
import type { Item, PageModel, Span, Stat } from "../../src/bridge/index.ts";
import {
  airBlock,
  groundBlocks,
  groundMap,
  groundReading,
  soilOf,
  spotGround,
} from "../../src/host/inspect/ground.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { depositPage } from "../../src/host/pages.ts";

const sixteen = ALIEN.build(seedFromText("alien 16")),
  oneOhSix = ALIEN.build(seedFromText("alien 106"));

/** A line in words: a name counts as its text. */
const words = (line: readonly Span[]): string =>
  line.map((s) => (typeof s === "string" ? s : s.text)).join("");

/** The refs a line's names open. */
const refsOf = (line: readonly Span[]): string[] =>
  line.flatMap((s) => (typeof s === "string" ? [] : [s.ref]));

/** A world's deposits, as its generated ground holds them. */
function depositsOf(world: World) {
  const g = homePlanet(world).generated;
  return (isProvinceWorld(g) ? g.fine : g).deposits;
}

/** A land's bedrock, each rock by its name. */
function bedrockNames(world: World, cell: number): string[] {
  const bed = groundBlocks(world, cell).find(
    (b) => b.type === "composition" && b.title === "Its bedrock",
  );
  return bed?.type === "composition" ? bed.parts.map((p) => words(p.name)) : [];
}

/** A land's "What lies in it" items. */
function itemsOf(world: World, cell: number): readonly Item[] {
  const list = groundBlocks(world, cell).find(
    (b) => b.type === "list" && b.title === "What lies in it",
  );
  if (list?.type !== "list") throw new Error(`land ${cell} lists nothing in it`);
  return list.items;
}

/** A page's headline number, by its label. */
function headline(page: PageModel, label: string): Stat {
  const stat = page.stats.find((s) => s.label === label);
  if (!stat) throw new Error(`no ${label} on ${page.ref}`);
  return stat;
}

/** A page's fact row, by its label. */
function fact(page: PageModel, label: string): Stat {
  for (const tab of page.tabs)
    for (const block of tab.blocks)
      if (block.type === "facts") {
        const row = block.rows.find((r) => r.label === label);
        if (row) return row;
      }
  throw new Error(`no ${label} row on ${page.ref}`);
}

test("alien 16's bedrock is named from its own rocks, not Earth's shale and sandstone", () => {
  const own = new Set(worldRocks(worldChemistry(homePlanet(sixteen).generated)).map((r) => r.name)),
    named = new Set<string>();
  for (const { cell } of groundMap(sixteen))
    for (const name of bedrockNames(sixteen, cell)) named.add(name);
  assert.ok(named.size > 0, "its lands have bedrock");
  for (const name of named) assert.ok(own.has(name), `${name} is not one of its rocks`);
  assert.ok(!named.has("shale") && !named.has("sandstone"), "no Earth shale or sandstone");
  assert.ok(named.has("black shale") && named.has("grey sandstone"), "its own shale and sandstone");
});

test("alien 16 has no hematite in any soil", () => {
  const chem = worldChemistry(homePlanet(sixteen).generated);
  for (const key of Object.keys(SOILS)) {
    const soil = worldSoil(chem, key);
    assert.ok(!soil.parts.some(([s]) => s === "hematite"), `${key} (${soil.name}) holds hematite`);
  }
  assert.equal(worldSoil(chem, "temperateForest").name, "a grey forest earth");
  for (const { cell } of groundMap(sixteen))
    assert.ok(!soilOf(sixteen, cell).parts.some(([s]) => s === "hematite"), `land ${cell}`);
});

test("alien 106 keeps the hematite of its soils, for its iron rusts", () => {
  const chem = worldChemistry(homePlanet(oneOhSix).generated);
  assert.ok(worldSoil(chem, "temperateForest").parts.some(([s]) => s === "hematite"));
});

test("alien 16's air keeps about .151 of oxygen", () => {
  const air = airBlock(sixteen);
  if (air.type !== "composition") throw new Error("the air is a composition");
  const oxygen = air.parts.find((p) => refsOf(p.name).includes("subst:oxygen"));
  assert.ok(oxygen, "the air holds oxygen");
  assert.ok(Math.abs(oxygen.share - 0.151) < 0.002, `oxygen share ${oxygen.share}`);
});

test("alien 16's spots and readings name its own rocks and soils", () => {
  const own = new Set(worldRocks(worldChemistry(homePlanet(sixteen).generated)).map((r) => r.name));
  for (let spot = 0; spot < 300; spot++) {
    const ground = spotGround(sixteen, spot, BIOME.temperateForest);
    assert.ok(own.has(ground.rock), `spot ${spot}: ${ground.rock}`);
    assert.equal(ground.soil, "a grey forest earth");
  }
  for (const { cell } of groundMap(sixteen).slice(0, 300)) {
    const reading = groundReading(sixteen, cell);
    assert.ok(reading, `land ${cell} is read`);
    for (const part of reading.line.slice("Ground: ".length).split(", "))
      assert.ok(own.has(part.replace(/ \d+%$/, "")), `land ${cell}: ${part}`);
  }
});

test("alien 16's tin is arsenopyrite, roasted for the arsenic that hardens its copper", () => {
  const tin = depositsOf(sixteen).find((d) => d.kind === "tin");
  assert.ok(tin, "alien 16 has a tin deposit");
  const page = pageOf(sixteen, tin.ref);
  assert.match(page.title, /^Arsenic/);
  assert.ok(JSON.stringify(page).includes('"subst:arsenopyrite"'));
  assert.ok(refsOf(fact(page, "Its ore").value).includes("subst:arsenopyrite"));
  assert.ok(refsOf(fact(page, "Worked by").value).includes("rxn:roast-arsenopyrite"));
  assert.match(words(headline(page, "Holding").value), / of arsenic$/);
  // Its land lists it in the same words.
  const item = itemsOf(sixteen, depositPage(sixteen, tin.ref).land).find((i) => i.ref === tin.ref);
  assert.ok(item, "its land lists the tin");
  assert.match(words(item.line), /^arsenic: /);
  assert.ok(refsOf(item.line).includes("subst:arsenopyrite"));
});

test("alien 106's tin is garnierite, the nickel ore of its laterite", () => {
  const tin = depositsOf(oneOhSix).find((d) => d.kind === "tin");
  assert.ok(tin, "alien 106 has a tin deposit");
  const page = pageOf(oneOhSix, tin.ref);
  assert.match(page.title, /^Nickel/);
  assert.ok(refsOf(fact(page, "Its ore").value).includes("subst:garnierite"));
  assert.ok(refsOf(fact(page, "Worked by").value).includes("rxn:smelt-garnierite"));
  assert.equal(words(headline(page, "Laid down by").value), "serpentine slivers of an old suture");
  const item = itemsOf(oneOhSix, depositPage(oneOhSix, tin.ref).land).find(
    (i) => i.ref === tin.ref,
  );
  assert.ok(item, "its land lists the tin");
  assert.match(words(item.line), /^nickel: /);
  assert.ok(refsOf(item.line).includes("subst:garnierite"));
});

test("alien 16's basalt keeps native iron where its coal and oil lay", () => {
  const lands = [...nativeIronLands(homePlanet(sixteen).generated)];
  assert.ok(lands.length > 0, "alien 16 has native iron");
  for (const land of lands) {
    const native = itemsOf(sixteen, land).find((i) => words(i.line).startsWith("Native iron: "));
    assert.ok(native, `land ${land} lists its native iron`);
    assert.equal(
      words(native.line),
      "Native iron: lumps of telluric iron in its basalt, where the lava flowed through buried coal",
    );
    assert.ok(refsOf(native.line).includes("subst:telluric-iron"));
  }
});
