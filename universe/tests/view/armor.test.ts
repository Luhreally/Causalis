import { test } from "node:test";
import assert from "node:assert/strict";
import { armorPanels, armorColor } from "../../src/view/armor.ts";
test("recorded body armor creates bounded positive-volume shells, without inventing armor for shield-only hosts", () => {
  for (const guard of ["leather", "mail", "scale", "plate"]) {
    const p = armorPanels(guard);
    assert.ok(p.length >= 3 && p.length <= 6);
    assert.ok(p.every((q) => q.w > 0 && q.h > 0 && q.d > 0));
  }
  assert.deepEqual(armorPanels("shield"), []);
  assert.deepEqual(armorPanels("none"), []);
  assert.notDeepEqual(armorPanels("leather"), armorPanels("plate"));
  assert.notDeepEqual(armorColor("plate", "bronze plate"), armorColor("plate", "iron plate"));
});
