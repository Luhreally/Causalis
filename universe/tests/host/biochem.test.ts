// Phase 57: a world's life told. What it is made of, row by row with why; a lineage's, a line's and a
// body's bones and blood; what its goods, stores, things and bodies are made of where its life is not
// Earth's; the making chain's fibre, dye, rope and bread; a people of the stars' life and ours.
// Earth's own is told as Earth's, with nothing added where Earth's pages are pinned.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText, type Ref, type World } from "../../src/kernel/index.ts";
import {
  EARTH_LIFE,
  FEMALE,
  OCC,
  bodyMakeUp,
  findSubstance,
  principle,
} from "../../src/rules/index.ts";
import { homePlanet, loreOf, populationContext } from "../../src/sim/index.ts";
import {
  seatRef,
  type Block,
  type Line,
  type PageModel,
  type Span,
} from "../../src/bridge/index.ts";
import { ALIEN, EARTH } from "../../src/host/planet.ts";
import { pageOf } from "../../src/host/inspect/index.ts";
import { villagePlan } from "../../src/host/village.ts";
import { goodHere } from "../../src/host/inspect/matter.ts";
import { landStoresBlocks } from "../../src/host/inspect/stores.ts";
import { personThings } from "../../src/host/inspect/things.ts";
import { landCloth } from "../../src/host/chain.ts";
import {
  bodyMatter,
  clothLife,
  folkLife,
  lifeHere,
  lifeLook,
  lifeParts,
  lifeRows,
  lifeSubstances,
  lifeUseBlock,
  millBlock,
  plantCloth,
  ropeLines,
  starLifeBlock,
  stuffWhy,
} from "../../src/host/biochem.ts";

const words = (l: Line | string): string =>
  typeof l === "string" ? l : l.map((s: Span) => (typeof s === "string" ? s : s.text)).join("");

/** A page's facts, every tab's, by label. */
function fact(p: PageModel, label: string): string | undefined {
  for (const t of p.tabs)
    for (const b of t.blocks)
      if (b.type === "facts") {
        const r = b.rows.find((x) => x.label === label);
        if (r) return words(r.value);
      }
  return undefined;
}

/** A tab's block by its title. */
function block(p: PageModel, tab: string, title: string): Block | undefined {
  return p.tabs.find((t) => t.id === tab)?.blocks.find((b) => "title" in b && b.title === title);
}

/** The most peopled land of a world. */
function mostPeopled(w: World): number {
  return [...populationContext(w).provinces.all()].sort(
    (a, b) => b.total() - a.total() || a.cell - b.cell,
  )[0]!.cell;
}

/** A beast of a world's living lineages (its first with a body and a skeleton, not a shell). */
function beastOf(w: World): { ref: string } {
  const g = homePlanet(w).generated;
  return g.life.species.find(
    (s) => s.body && s.body.covering !== "shell" && s.niche !== "seed grass",
  )!;
}

const earth = EARTH.build(seedFromText("first light"));
const sulfur = ALIEN.build(seedFromText("alien 84"));
sulfur.runTo(30 * YEAR);
// (What every read below must leave as it was: Earth's and alien 84's histories.)
const earthBefore = JSON.stringify(earth.domainHashes()),
  sulfurBefore = JSON.stringify(sulfur.domainHashes());
const ammonia = ALIEN.build(seedFromText("alien 218"));
ammonia.runTo(30 * YEAR);

test("Earth's life is Earth's own: told as Earth's, without why, and nothing of it added to Earth's things", () => {
  const g = homePlanet(earth).generated;
  assert.equal(lifeHere(earth), EARTH_LIFE);
  assert.equal(lifeLook(g), undefined);
  assert.deepEqual(folkLife(g), {});
  assert.deepEqual(lifeSubstances(earth), []);
  const page = pageOf(earth, beastOf(earth).ref);
  assert.equal(fact(page, "Its bones"), "Calcium phosphate (bone mineral)");
  assert.equal(fact(page, "Its blood"), "Red, its breath carried on iron (haem)");
  const cell = mostPeopled(earth);
  assert.deepEqual(clothLife(earth, cell, { colour: [0.7, 0.68, 0.56], plant: true }), {
    colour: [0.7, 0.68, 0.56],
    lines: [],
  });
  assert.deepEqual(ropeLines(earth, "nettle"), []);
  const parts = bodyMakeUp(false, "skin", true);
  assert.deepEqual(lifeParts(EARTH_LIFE, parts, "body"), parts);
  assert.deepEqual(goodHere(earth, cell, "grain").parts, goodHere(earth, cell, "grain").parts);
  // (A garment woven of a land's plants is plant fibre, not a fleece's keratin.)
  assert.deepEqual(plantCloth(earth).parts, [
    ["cellulose", 0.93],
    ["water", 0.07],
  ]);
  // Nothing told of its life on its stuffs' pages; its towns drawn as they were.
  assert.equal(lifeUseBlock(earth, "apatite"), null);
  const town = (EARTH.queries["towns.map"]!(earth, {}) as { ref: string }[])[0];
  if (town) {
    const p = pageOf(earth, town.ref).portrait;
    assert.ok(p && !("lifeLook" in p), "Earth's town portrait as it was");
  }
});

test("bones of lime beside shells of lime, or shells of lime beside bones of bone mineral, each told why", () => {
  const rows = new Map(
    lifeRows({ ...EARTH_LIFE, earth: false }).map((r) => [r.label, words(r.value)]),
  );
  assert.match(
    rows.get("Its bones")!,
    /^Calcium phosphate \(bone mineral\), of the lime and phosphate/,
  );
  assert.equal(
    rows.get("Its shells"),
    "Calcium carbonate (limestone), of lime, as Earth's shells are beside its bones",
  );
});

test("alien 84: bones of silica and green blood, on the lineage's page, the tree's dawn and the Body tab", () => {
  const page = pageOf(sulfur, beastOf(sulfur).ref);
  assert.match(fact(page, "Its bones")!, /^Silica \(opal\), of glass/);
  assert.match(
    fact(page, "Its blood")!,
    /^Green, its breath carried on vanadium \(vanabin\): in acid/,
  );
  // The tree of life's dawn: what its life is made of.
  const tree = pageOf(sulfur, "world:tree"),
    life = block(tree, "dawn", "What its life is made of");
  assert.ok(life && life.type === "facts", "its life told at the dawn");
  const rows = new Map(life.rows.map((r) => [r.label, words(r.value)]));
  assert.match(rows.get("Its liquid")!, /^water: /);
  assert.match(rows.get("Its cells' skins")!, /caldarchaeol/);
  assert.match(rows.get("Its colour")!, /^Black, with bacteriochlorophyll/);
  // One met's Body tab: their bones and their blood.
  const towns = ALIEN.queries["towns.map"]!(sulfur, {}) as { ref: string }[];
  let told = 0;
  for (const t of towns) {
    const met = villagePlan(sulfur, t.ref as Ref).people.find(
      (p) => !p.folk && p.ref.startsWith("prsn:"),
    );
    if (!met) continue;
    const body = pageOf(sulfur, met.ref).tabs.find((x) => x.id === "body");
    assert.ok(body, "a Body tab");
    const facts = body.blocks.find((b) => b.type === "facts");
    assert.ok(facts && facts.type === "facts");
    const bones = facts.rows.find((r) => r.label === "Bones"),
      blood = facts.rows.find((r) => r.label === "Blood");
    assert.match(words(bones!.value), /^Silica \(opal\)/);
    assert.match(words(blood!.value), /^Green/);
    told++;
    break;
  }
  assert.equal(told, 1, "one met's Body tab looked at");
  assert.deepEqual(
    bodyMatter(sulfur).map((s) => s.label),
    ["Bones", "Blood"],
  );
  // A people in a shell: their shell, of the same silica.
  const shelled = bodyMatter(sulfur, "shell");
  assert.deepEqual(
    shelled.map((s) => s.label),
    ["Shell", "Blood"],
  );
  assert.match(words(shelled[0]!.value), /^Silica \(opal\), of glass/);
  // Opal's page and vanabin's: what they are in its life, and why.
  const opal = lifeUseBlock(sulfur, "opal"),
    vanabin = lifeUseBlock(sulfur, "vanabin");
  assert.ok(opal?.type === "text" && vanabin?.type === "text");
  assert.match(words(opal.lines[0]!), /^Its bones, of glass, as Earth's diatoms/);
  assert.match(words(vanabin.lines[0]!), /^What its blood carries its breath on: in acid/);
  // Its towns drawn in its life's colours: their turf roofs near black.
  const portrait = pageOf(sulfur, towns[0]!.ref).portrait;
  assert.ok(portrait?.kind === "town");
  assert.equal(portrait.lifeLook, "bacteriochlorophyll");
});

test("alien 16: a shelled people's Body tab tells their shell, of lime, and their blood — never bones", () => {
  const shelled = ALIEN.build(seedFromText("alien 16"));
  shelled.runTo(30 * YEAR);
  const before = JSON.stringify(shelled.domainHashes()),
    towns = ALIEN.queries["towns.map"]!(shelled, {}) as { ref: string }[];
  let told = 0;
  for (const t of towns) {
    const plan = villagePlan(shelled, t.ref as Ref),
      met = plan.people.find((p) => !p.folk && p.ref.startsWith("prsn:"));
    if (!met) continue;
    assert.equal(plan.body?.skin, "shell", "alien 16's people are shelled");
    const body = pageOf(shelled, met.ref).tabs.find((x) => x.id === "body");
    assert.ok(body, "a Body tab");
    const facts = body.blocks.find((b) => b.type === "facts");
    assert.ok(facts && facts.type === "facts");
    const rows = new Map(facts.rows.map((r) => [r.label, words(r.value)]));
    assert.ok(!rows.has("Bones"), "no bones told of a shelled body");
    assert.match(
      rows.get("Shell")!,
      /^Calcium carbonate \(limestone\), of lime, as Earth's shells are: its seas give lime/,
    );
    assert.match(rows.get("Blood")!, /^Red, its breath carried on iron \(haem\)/);
    told++;
    break;
  }
  assert.equal(told, 1, "one met's Body tab looked at");
  assert.equal(JSON.stringify(shelled.domainHashes()), before);
});

test("alien 218: its goods, stores, things and bodies of its own mirrored ammonia-water life", () => {
  const l = lifeHere(ammonia),
    cell = mostPeopled(ammonia);
  assert.equal(l.family, "ammonia");
  assert.equal(l.hand, "right");
  const grain = goodHere(ammonia, cell, "grain").parts.map(([s]) => s);
  assert.ok(
    grain.includes("mirror-glucosamine-starch") && grain.includes("ammonia-water"),
    `${grain}`,
  );
  assert.ok(!grain.includes("starch") && !grain.includes("water"), "none of Earth's own");
  for (const s of grain) assert.ok(findSubstance(s), `${s} is a substance`);
  // Its body: lime bones, its flesh of the mirror's protein, dissolved in ammonia water.
  const body = lifeParts(l, bodyMakeUp(true, "skin", true), "body").map(([s]) => s);
  for (const s of ["ammonia-water", "mirror-protein", "calcite"]) assert.ok(body.includes(s), s);
  // A land's stores of it, named and coloured.
  const stores = landStoresBlocks(ammonia, cell).find(
    (b) => b.type === "composition" && b.title === "What its stores are made of",
  );
  assert.ok(stores && stores.type === "composition");
  assert.ok(stores.parts.some((p) => /mirror glucosamine starch/.test(words(p.name))));
  // A farmer's things: a haft of its own fibre; a garment of the land's plants their fibre.
  const things = personThings(ammonia, {
    ref: "prsn:test" as Ref,
    occupation: OCC.farmer,
    sex: FEMALE,
    birthYear: 0,
    cell,
    alive: true,
    village: null,
  });
  const hoe = things.find((t) => t.slot === "hoe")!,
    tunic = things.find((t) => t.slot === "tunic")!;
  assert.ok(
    hoe.way.parts.some(([s]) => s === "mirror-chitosan"),
    "its haft its own fibre",
  );
  if (landCloth(ammonia, cell).plant)
    assert.deepEqual(
      tunic.way.parts.map(([s]) => s),
      ["mirror-chitosan", "ammonia-water"],
    );
  else
    assert.ok(
      tunic.way.parts.some(([s]) => s === "mirror-keratin"),
      "its flocks' own hair",
    );
});

test("the chain: cloth of its own fibre and why, dyed where its land knows dyeing; rope; bread or cakes at the mill", () => {
  const cell = mostPeopled(ammonia),
    cloth = { colour: [0.7, 0.68, 0.56] as const, plant: true as const },
    undyed = clothLife(ammonia, cell, cloth);
  assert.equal(undyed.lines.length, 1);
  assert.match(
    words(undyed.lines[0]!),
    /^Its fibre is mirror chitosan: chains of sugars that carry nitrogen.*turned the other way/,
  );
  // Its land comes to know dyeing: its cloth dyed its plants' colour, golden with carotene.
  loreOf(ammonia).learn(
    cell,
    "dyeing",
    { year: 30, event: "evt:test" as Ref },
    principle("dyeing"),
  );
  const dyed = clothLife(ammonia, cell, cloth);
  assert.equal(dyed.lines.length, 2);
  assert.match(words(dyed.lines[1]!), /^Dyed golden with carotene pressed from its own plants/);
  assert.notDeepEqual(dyed.colour, undyed.colour);
  assert.ok(dyed.colour[0] > dyed.colour[2], "golden");
  assert.match(
    words(ropeLines(ammonia, "nettle")[0]!),
    /^Their rope and cord are twisted of nettle, whose fibre is mirror chitosan/,
  );
  // The mill: its seed stored as its life stores it, ground to flour; pressed, where nothing burns.
  const mill = millBlock(ammonia, cell);
  assert.ok(mill.type === "list");
  assert.equal(mill.title, "Ground here this year: flour, for cakes");
  assert.match(
    words(mill.items[0]!.line),
    /stored as mirror glucosamine starch: a starch of sugars that carry nitrogen/,
  );
  assert.equal(
    words(mill.items[2]!.line),
    "Pressed into cakes: nothing burns in its air to bake them",
  );
  const bread = millBlock(earth, mostPeopled(earth));
  assert.ok(bread.type === "list");
  assert.equal(bread.title, "Ground here this year: flour, for bread");
  assert.match(words(bread.items[0]!.line), /stored as starch$/);
  assert.equal(stuffWhy("starch"), null);
  assert.match(stuffWhy("squalene")!, /^an oil/);
});

test("a people of the stars: their life of water and ours of ammonia water — no food, no sickness between them", () => {
  const civ = { ref: "civ:test", star: "star:none" },
    b = starLifeBlock(ammonia, civ);
  assert.ok(b.type === "facts");
  const rows = new Map(b.rows.map((r) => [r.label, words(r.value)]));
  assert.match(rows.get("Their life")!, /^Of water, of (left|right)-handed amino acids/);
  assert.match(
    rows.get("Food")!,
    /^Nothing of either feeds the other: their life is of water, ours of ammonia water/,
  );
  assert.match(rows.get("Sickness")!, /^No sickness of theirs can live in a body of ammonia water/);
});

test("every read leaves the worlds' histories as they were", () => {
  assert.equal(JSON.stringify(earth.domainHashes()), earthBefore);
  assert.equal(JSON.stringify(sulfur.domainHashes()), sulfurBefore);
});
