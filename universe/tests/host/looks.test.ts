// Phase 54 M223: what matter, elements and made things look like, as the host's pictures. Every
// substance and element of Earth's and of the novel chemistries has its row; first principles give
// the rest; a made thing's form is read from its name, and how it was made from its stuff.
import { test } from "node:test";
import assert from "node:assert/strict";
import { hashString } from "../../src/kernel/index.ts";
import {
  ELEMENTS,
  KIND_SUBSTANCES,
  LIFE_ELEMENTS,
  LIFE_SUBSTANCES,
  NOVEL_ELEMENTS,
  NOVEL_SUBSTANCES,
  SUBSTANCES,
  type Substance,
} from "../../src/rules/index.ts";
import {
  ELEMENT_NATURE,
  LOOKS,
  elementPortrait,
  lookOf,
  madeHowOf,
  matterPortrait,
  thingForm,
  thingPortrait,
} from "../../src/host/looks.ts";
import type { Portrait } from "../../src/bridge/index.ts";

/** A substance of invented make, to look at by its phase, kind and formula alone. */
function made(over: Partial<Substance>): Substance {
  return {
    id: "made-up",
    name: "made up",
    written: "X",
    formula: {},
    kind: "made",
    phase: "solid",
    density: 1000,
    melts: null,
    hardness: null,
    colour: [0.5, 0.5, 0.5],
    words: "",
    ...over,
  };
}

test("every substance of Earth's, of the novel chemistries, of the kinds and of a world's life has its row in LOOKS, and no other", () => {
  for (const s of [...SUBSTANCES, ...NOVEL_SUBSTANCES, ...KIND_SUBSTANCES, ...LIFE_SUBSTANCES])
    assert.ok(LOOKS[s.id], `${s.id} has a look`);
  assert.equal(
    Object.keys(LOOKS).length,
    SUBSTANCES.length + NOVEL_SUBSTANCES.length + KIND_SUBSTANCES.length + LIFE_SUBSTANCES.length,
  );
});

test("every element of Earth's and of the novel chemistries has its nature in ELEMENT_NATURE", () => {
  for (const e of [...ELEMENTS, ...NOVEL_ELEMENTS, ...LIFE_ELEMENTS])
    assert.ok(ELEMENT_NATURE[e.symbol], `${e.symbol} has a nature`);
  assert.equal(
    Object.keys(ELEMENT_NATURE).length,
    ELEMENTS.length + NOVEL_ELEMENTS.length + LIFE_ELEMENTS.length,
  );
});

test("matterPortrait for quartz: hexagonal, vitreous, clear as .85, keyed by its id", () => {
  const quartz = SUBSTANCES.find((s) => s.id === "quartz")!;
  assert.deepEqual(matterPortrait(quartz), {
    kind: "matter",
    form: "crystal",
    habit: "hexagonal",
    color: quartz.colour,
    lustre: "vitreous",
    clarity: 0.85,
    hardness: 7,
    key: hashString("quartz"),
  });
});

test("lookOf for a made-up gas, metal and silicate, from their phase, kind and formula", () => {
  assert.deepEqual(lookOf(made({ kind: "gas", phase: "gas", formula: { N: 2 } })), {
    form: "gas",
    habit: null,
    lustre: "dull",
    clarity: 0.9,
  });
  assert.deepEqual(lookOf(made({ kind: "metal", formula: { Pb: 1 } })), {
    form: "ingot",
    habit: null,
    lustre: "metallic",
    clarity: 0,
  });
  assert.deepEqual(lookOf(made({ kind: "mineral", hardness: 5, formula: { Si: 1, O: 2 } })), {
    form: "crystal",
    habit: "hexagonal",
    lustre: "vitreous",
    clarity: 0.7,
  });
});

test("lookOf: water is clear as .95, a liquid clear when pale, an ore's sulphide of a metal shines", () => {
  assert.equal(
    lookOf(made({ kind: "water", phase: "liquid", colour: [0.4, 0.6, 0.9] })).clarity,
    0.95,
  );
  assert.equal(lookOf(made({ phase: "liquid", colour: [0.9, 0.9, 0.8] })).clarity, 0.9);
  assert.equal(lookOf(made({ phase: "liquid", colour: [0.2, 0.2, 0.2] })).clarity, 0.5);
  assert.equal(lookOf(made({ kind: "ore", formula: { Fe: 1, S: 2 } })).lustre, "metallic");
  assert.equal(lookOf(made({ kind: "ore", formula: { Mn: 1, O: 2 } })).lustre, "submetallic");
  assert.deepEqual(lookOf(made({ kind: "mineral", hardness: 7, formula: { Al: 2, O: 3 } })), {
    form: "crystal",
    habit: "prismatic",
    lustre: "vitreous",
    clarity: 0.3,
  });
  assert.deepEqual(lookOf(made({ kind: "mineral", hardness: 2, formula: { Ca: 1, C: 1, O: 3 } })), {
    form: "lump",
    habit: "massive",
    lustre: "vitreous",
    clarity: 0.1,
  });
});

test("elementPortrait: copper a metal, solid, its colour, not kept; sodium kept under oil; no such element has none", () => {
  assert.deepEqual(elementPortrait("Cu"), {
    kind: "element",
    symbol: "Cu",
    state: "solid",
    sort: "metal",
    color: [0.85, 0.5, 0.3],
    kept: false,
    key: hashString("Cu"),
  });
  const sodium = elementPortrait("Na");
  assert.ok(sodium && sodium.kind === "element" && sodium.kept);
  assert.equal(elementPortrait("Xx"), null);
});

test("thingForm: the form word a thing's name holds, as whole words, else 'thing'", () => {
  assert.equal(thingForm("a bronze sickle"), "sickle");
  assert.equal(thingForm("a storage jar"), "storage jar");
  assert.equal(thingForm("a woollen tunic"), "tunic");
  assert.equal(thingForm("a flint axe"), "axe");
  assert.equal(thingForm("hoe"), "hoe");
  assert.equal(thingForm("spoon"), "thing");
  assert.equal(thingForm("a bowl"), "bowl", "not 'bow' inside it");
  assert.equal(thingForm("a flint spearhead"), "spearhead", "not 'spear' inside it");
});

test("madeHowOf: how a thing was made, from its stuff, its good and its material", () => {
  assert.equal(madeHowOf("flint", "tools"), "knapped");
  assert.equal(madeHowOf("bronze", "tools"), "cast");
  assert.equal(madeHowOf("iron", "tools"), "forged");
  assert.equal(madeHowOf("woven wool", "clothing"), "woven");
  assert.equal(madeHowOf("leather", "clothing"), "sewn");
  assert.equal(madeHowOf("fired clay", "pottery"), "thrown");
  assert.equal(madeHowOf("steel", "arms", "machined"), "machined");
  // (Stones from the crusts' tables are knapped too; wood is carved; a body's own is grown.)
  assert.equal(madeHowOf("tholeiite", "tools"), "knapped");
  assert.equal(madeHowOf("jasper", "arms"), "knapped");
  assert.equal(madeHowOf("ash", "arms", "wood"), "carved");
  assert.equal(madeHowOf("bone", "arms"), "carved");
  assert.equal(madeHowOf("claw", "arms", "body"), "grown");
  assert.equal(madeHowOf("horn", "arms", "body"), "grown");
  assert.equal(madeHowOf("horn and sinew", "arms", "hide"), "carved");
  assert.equal(madeHowOf("shell", "arms", "shell"), "carved");
  assert.equal(madeHowOf("bog iron", "tools"), "forged");
  assert.equal(madeHowOf("arsenical copper", "tools"), "cast");
});

test("thingPortrait: lustre by how it was made, quality and wear kept to their ranges, no haft by default", () => {
  const base = { form: "axe", color: [0.8, 0.5, 0.2] as const, quality: 150, worn: -1, key: 7 },
    lustre = (p: Portrait) => (p.kind === "thing" ? p.lustre : null);
  assert.equal(lustre(thingPortrait({ ...base, made: "cast" })), "metallic");
  assert.equal(lustre(thingPortrait({ ...base, made: "knapped" })), "waxy");
  assert.equal(lustre(thingPortrait({ ...base, made: "thrown" })), "dull");
  assert.equal(lustre(thingPortrait({ ...base, made: "grown" })), "waxy");
  const p = thingPortrait({ ...base, made: "carved" });
  assert.deepEqual(p, {
    kind: "thing",
    form: "axe",
    made: "carved",
    color: [0.8, 0.5, 0.2],
    lustre: "dull",
    haft: null,
    quality: 100,
    worn: 0,
    key: 7,
  });
  assert.equal(lustre(thingPortrait({ ...base, made: "forged", lustre: "dull" })), "dull");
});
