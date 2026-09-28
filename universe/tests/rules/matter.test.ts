import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ELEMENTS,
  GOODS,
  GOOD_MATTER,
  MATERIALS,
  MATERIAL_MATTER,
  ORE_GRADE,
  PRINCIPLES,
  ROCKS,
  SOILS,
  REACTIONS,
  RECIPES,
  SUBSTANCE,
  SUBSTANCES,
  elementShares,
  imbalance,
  molarMass,
  reactionKg,
} from "../../src/rules/index.ts";

test("every reaction balances, atom for atom, as Classic's audit of its reactions asked", () => {
  for (const r of REACTIONS) assert.ok(imbalance(r) < 1e-9, `${r.id} is out by ${imbalance(r)}`);
  // And so by weight: what goes in weighs what comes out.
  for (const r of REACTIONS) {
    const kg = reactionKg(r),
      sum = (side: [string, number][]) => side.reduce((s, [, k]) => s + k, 0);
    assert.ok(Math.abs(sum(kg.inputs) - sum(kg.outputs)) < 1e-9, r.id);
  }
});

test("every substance is of known elements, and its elements' shares make up the whole of it", () => {
  const symbols = new Set(ELEMENTS.map((e) => e.symbol));
  assert.equal(new Set(SUBSTANCES.map((s) => s.id)).size, SUBSTANCES.length, "ids unique");
  for (const s of SUBSTANCES) {
    for (const e of Object.keys(s.formula)) assert.ok(symbols.has(e), `${s.id}: ${e}`);
    const shares = elementShares(s);
    assert.ok(Math.abs(shares.reduce((a, [, v]) => a + v, 0) - 1) < 1e-9, s.id);
    assert.ok(molarMass(s.formula) > 0);
  }
  // Malachite, copper's green ore: 57% copper by weight.
  const malachite = elementShares(SUBSTANCES[SUBSTANCE.malachite!]!);
  assert.ok(Math.abs(malachite.find(([e]) => e === "Cu")![1] - 0.5748) < 0.001);
});

test("every good is made of something, whole, of substances there are; every reaction's teacher and recipe exist", () => {
  for (const g of GOODS) {
    const m = GOOD_MATTER[g.id];
    assert.ok(m && m.unitKg > 0 && m.ways.length > 0, `${g.id} has its matter`);
    for (const w of m.ways) {
      const whole = w.parts.reduce((a, [, v]) => a + v, 0);
      assert.ok(Math.abs(whole - 1) < 1e-9, `${g.id}/${w.id} sums to ${whole}`);
      for (const [s] of w.parts) assert.ok(SUBSTANCE[s] !== undefined, `${g.id}/${w.id}: ${s}`);
    }
  }
  const principles = new Set(PRINCIPLES.map((p) => p.id)),
    recipes = new Set(RECIPES.map((r) => r.id));
  for (const r of REACTIONS) {
    if (r.principle) assert.ok(principles.has(r.principle), `${r.id}: ${r.principle}`);
    if (r.recipe) assert.ok(recipes.has(r.recipe), `${r.id}: ${r.recipe}`);
    if (r.fuel) assert.ok(SUBSTANCE[r.fuel] !== undefined, `${r.id}: ${r.fuel}`);
  }
  // Glass and brewing, once changing nothing, are now the reactions they teach.
  assert.ok(REACTIONS.some((r) => r.principle === "glass"));
  assert.ok(REACTIONS.some((r) => r.principle === "brewing"));
});

test("every rock and every soil is made of substances there are, whole; every ore holds one", () => {
  const whole = (parts: readonly (readonly [string, number])[], what: string) => {
    assert.ok(Math.abs(parts.reduce((a, [, v]) => a + v, 0) - 1) < 1e-9, `${what} sums to one`);
    for (const [id] of parts) assert.ok(SUBSTANCE[id] !== undefined, `${what}: ${id}`);
  };
  for (const r of ROCKS) whole(r.parts, r.id);
  for (const [id, soil] of Object.entries(SOILS)) whole(soil.parts, id);
  for (const [kind, g] of Object.entries(ORE_GRADE)) {
    assert.ok(SUBSTANCE[g.of] !== undefined, kind);
    assert.ok(g.share > 0 && g.share <= 1);
  }
  assert.equal(ROCKS.length, 8);
});

test("every material a design is made of is made of substances, whole (stone: the land's own rock)", () => {
  for (const m of MATERIALS) {
    if (m === "stone" || m === "body") continue;
    const parts = MATERIAL_MATTER[m];
    assert.ok(parts, `${m} has its matter`);
    assert.ok(Math.abs(parts.reduce((a, [, v]) => a + v, 0) - 1) < 1e-9, m);
    for (const [id] of parts) assert.ok(SUBSTANCE[id] !== undefined, `${m}: ${id}`);
  }
});
