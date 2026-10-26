import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ELEMENTS,
  NOVEL_ELEMENTS,
  NOVEL_REACTIONS,
  NOVEL_SUBSTANCES,
  PRINCIPLES,
  RECIPES,
  REACTIONS,
  SUBSTANCES,
  elementShares,
  findElement,
  findReaction,
  findSubstance,
  imbalance,
  molarMass,
  reactionKg,
} from "../../src/rules/index.ts";

test("every novel reaction balances, atom for atom, and so by weight, as Earth's do", () => {
  for (const r of NOVEL_REACTIONS)
    assert.ok(imbalance(r) < 1e-9, `${r.id} is out by ${imbalance(r)}`);
  for (const r of NOVEL_REACTIONS) {
    const kg = reactionKg(r),
      sum = (side: [string, number][]) => side.reduce((s, [, k]) => s + k, 0);
    assert.ok(Math.abs(sum(kg.inputs) - sum(kg.outputs)) < 1e-9, r.id);
  }
});

test("every novel substance is of known elements, and its elements' shares make up the whole", () => {
  for (const s of NOVEL_SUBSTANCES) {
    for (const e of Object.keys(s.formula)) assert.ok(findElement(e), `${s.id}: ${e}`);
    const shares = elementShares(s);
    assert.ok(Math.abs(shares.reduce((a, [, v]) => a + v, 0) - 1) < 1e-9, s.id);
    assert.ok(molarMass(s.formula) > 0);
  }
});

test("every novel reaction's teacher, recipe, fuel and substances exist", () => {
  const principles = new Set(PRINCIPLES.map((p) => p.id)),
    recipes = new Set(RECIPES.map((r) => r.id));
  for (const r of NOVEL_REACTIONS) {
    if (r.principle) assert.ok(principles.has(r.principle), `${r.id}: ${r.principle}`);
    if (r.recipe) assert.ok(recipes.has(r.recipe), `${r.id}: ${r.recipe}`);
    assert.equal(r.fuel, "carbon", r.id);
    for (const [id] of [...r.inputs, ...r.outputs]) assert.ok(findSubstance(id), `${r.id}: ${id}`);
  }
});

test("every novel word is one plain sentence", () => {
  const words = [...NOVEL_SUBSTANCES.map((s) => s.words), ...NOVEL_REACTIONS.map((r) => r.words)];
  for (const w of words) {
    assert.ok(w.endsWith("."), w);
    assert.ok(!w.slice(0, -1).includes(". "), w);
  }
});

test("ids are unique across Earth's tables and the novel ones", () => {
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  assert.ok(unique([...SUBSTANCES, ...NOVEL_SUBSTANCES].map((s) => s.id)), "substance ids");
  assert.ok(unique([...REACTIONS, ...NOVEL_REACTIONS].map((r) => r.id)), "reaction ids");
  assert.ok(unique([...ELEMENTS, ...NOVEL_ELEMENTS].map((e) => e.symbol)), "element symbols");
});

test("Earth's tables keep their sizes, and the novel ones hold the rows the spec gives", () => {
  assert.equal(ELEMENTS.length, 19);
  assert.equal(SUBSTANCES.length, 65);
  assert.equal(REACTIONS.length, 30);
  assert.equal(NOVEL_ELEMENTS.length, 2);
  assert.equal(NOVEL_SUBSTANCES.length, 20);
  assert.equal(NOVEL_REACTIONS.length, 10);
});

test("the find functions resolve ids from Earth's tables and from the novel ones", () => {
  assert.equal(findSubstance("copper")?.id, "copper");
  assert.equal(findSubstance("cohenite-iron")?.id, "cohenite-iron");
  assert.equal(findSubstance("no-such-thing"), undefined);
  assert.equal(findReaction("smelt-malachite")?.id, "smelt-malachite");
  assert.equal(findReaction("carbide-bloomery")?.id, "carbide-bloomery");
  assert.equal(findReaction("no-such-reaction"), undefined);
  assert.equal(findElement("Fe")?.name, "iron");
  assert.equal(findElement("As")?.name, "arsenic");
  assert.equal(findElement("Ni")?.name, "nickel");
  assert.equal(findElement("Xx"), undefined);
});

test("the novel minerals' molar masses are the spec's, within a hundredth", () => {
  const want: [string, number][] = [
    ["arsenopyrite", 162.827],
    ["garnierite", 328.69],
    ["tennantite", 1479.02],
    ["chalcocite", 159.152],
    ["siderite", 115.853],
    ["white-arsenic", 197.841],
  ];
  for (const [id, m] of want) {
    const s = findSubstance(id);
    assert.ok(s, id);
    assert.ok(Math.abs(molarMass(s.formula) - m) < 0.01, `${id}: ${molarMass(s.formula)}`);
  }
});

test("the alloys' weight shares are the spec's, within .01 of a per cent", () => {
  const share = (id: string, e: string) => {
    const s = findSubstance(id);
    assert.ok(s, id);
    return (elementShares(s).find(([x]) => x === e)?.[1] ?? 0) * 100;
  };
  assert.ok(Math.abs(share("cupronickel", "Ni") - 25) < 0.01, `${share("cupronickel", "Ni")}`);
  assert.ok(
    Math.abs(share("arsenical-copper", "As") - 4) < 0.01,
    `${share("arsenical-copper", "As")}`,
  );
  assert.ok(Math.abs(share("cohenite-iron", "C") - 3) < 0.01, `${share("cohenite-iron", "C")}`);
});

test("the carbon-rich bloomery takes and gives the carbon and iron its cohenite iron has", () => {
  const r = findReaction("carbide-bloomery");
  const f = findSubstance("cohenite-iron")?.formula;
  assert.ok(r && f);
  const carbon = r.inputs.find(([id]) => id === "carbon")?.[1];
  const iron = r.outputs.find(([id]) => id === "cohenite-iron")?.[1];
  assert.ok(carbon !== undefined && iron !== undefined);
  assert.ok(Math.abs(carbon - (2 + (3 * f.C!) / f.Fe!)) < 1e-9, `${carbon}`);
  assert.ok(Math.abs(iron - 3 / f.Fe!) < 1e-9, `${iron}`);
});
