// The smith's words and the host's shields on a world of its own chemistry (Phase 54 M221): Earth's
// words as they were; elsewhere the metal goes by its own name, the smith melts what its own alloy
// is made of, and the copper alloys of other chemistries face their shields as bronze.
import { test } from "node:test";
import assert from "node:assert/strict";
import { forging, takingToForge } from "../../src/view/village.ts";
import { shieldOf } from "../../src/render/battle.ts";

test("Earth's smiths say what they always said", () => {
  assert.equal(forging("bronze", "axe"), "Pouring a bronze axe in its mould");
  assert.equal(forging("bronze", "axe", "bronze"), "Pouring a bronze axe in its mould");
  assert.equal(forging("copper", "sickle"), "Casting a copper sickle, hammering its edge hard");
  assert.equal(forging("iron", "axe"), "Forging an axe of iron from the bloom");
  assert.equal(forging("iron", "axe", "iron"), "Forging an axe of iron from the bloom");
  assert.equal(forging("steel", "knife"), "Forging a steel knife, quenching it");
  assert.equal(forging("stone", "axe"), "Forging tools from the ore");
  assert.equal(takingToForge("bronze"), "Taking copper and tin to melt");
  assert.equal(takingToForge("iron"), "Taking iron to the forge");
});

test("elsewhere the metal goes by its own name, and the smith melts what it is made of", () => {
  assert.equal(
    forging("bronze", "axe", "arsenical copper"),
    "Pouring an arsenical copper axe in its mould",
  );
  assert.equal(
    forging("bronze", "sickle", "cupronickel"),
    "Pouring a cupronickel sickle in its mould",
  );
  assert.equal(
    forging("iron", "axe", "cohenite iron"),
    "Forging an axe of cohenite iron from the bloom",
  );
  assert.equal(
    forging("iron", "axe", "telluric iron"),
    "Hammering an axe from a lump of native iron",
  );
  assert.equal(takingToForge("bronze", "copper and nickel"), "Taking copper and nickel to melt");
  assert.equal(
    takingToForge("bronze", "copper and white arsenic"),
    "Taking copper and white arsenic to melt",
  );
});

test("other chemistries' copper alloys face their shields as bronze, their irons as iron", () => {
  const face: [number, number, number] = [0.2, 0.3, 0.4];
  assert.deepEqual(
    shieldOf("cupronickel swords and spears", face),
    shieldOf("bronze swords", face),
  );
  assert.deepEqual(shieldOf("arsenical copper axes", face), shieldOf("bronze axes", face));
  assert.deepEqual(shieldOf("telluric iron swords", face), shieldOf("iron swords", face));
  assert.deepEqual(shieldOf("cohenite iron pikes", face), shieldOf("iron pikes", face));
  assert.notDeepEqual(shieldOf("bronze swords", face), shieldOf("iron swords", face));
});
