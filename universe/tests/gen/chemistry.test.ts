// A world's chemistry in generation (Phase 54 M221): an Earth-like world keeps the Sun's own, on its
// fine grid and its provinces alike, with no native iron and the stones it always knapped; an open
// world draws its own from its star and orbit — thin air and arsenic round a small old star, nickel
// on a world poor in silica, carbide on one rich in carbon — and native iron lies where basalt met
// buried coal on a world where nothing rusts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { EARTHLIKE, OPEN, SOLAR } from "../../src/rules/index.ts";
import {
  generateHomeWorld,
  groundStone,
  nativeIronLands,
  provinceWorld,
  worldChemistry,
  worldGroundStone,
} from "../../src/gen/index.ts";

const earth = ["first light", "kestrel", "amber", "juniper"].map((s) => {
  const fine = generateHomeWorld(seedFromText(s), EARTHLIKE);
  return { s, fine, lands: provinceWorld(fine) };
});
const alien = (n: number) => provinceWorld(generateHomeWorld(seedFromText(`alien ${n}`), OPEN));

test("an Earth-like world keeps the Sun's own chemistry, its stones and no native iron", () => {
  for (const { s, fine, lands } of earth) {
    assert.equal(worldChemistry(fine), SOLAR, s);
    assert.equal(worldChemistry(lands), SOLAR, s);
    assert.equal(nativeIronLands(fine).size, 0, s);
    assert.equal(nativeIronLands(lands).size, 0, s);
    for (let cell = 0; cell < lands.grid.count; cell++)
      assert.deepEqual(worldGroundStone(lands, cell), groundStone(lands, cell), `${s} ${cell}`);
  }
});

test("open worlds draw their own: thin air and arsenic, nickel, carbide", () => {
  const w16 = alien(16),
    c16 = worldChemistry(w16);
  assert.equal(c16.air, "thin");
  assert.equal(c16.metals, "poor");
  assert.equal(c16.silica, "solar");
  assert.equal(c16.carbon, "oxide");
  assert.equal(c16.redox, "reduced");
  assert.equal(c16.hardener, "arsenic");
  assert.ok(Math.abs(c16.o2 - 0.1508) < 0.0005, `oxygen ${c16.o2}`);
  assert.equal(c16.solar, false);
  assert.equal(nativeIronLands(w16).size, 6);
  assert.equal(nativeIronLands(alien(12)).size, 3);
  assert.equal(nativeIronLands(alien(60)).size, 5);
  const w106 = alien(106),
    c106 = worldChemistry(w106);
  assert.equal(c106.silica, "low");
  assert.equal(c106.hardener, "nickel");
  assert.equal(c106.redox, "oxidised");
  assert.equal(nativeIronLands(w106).size, 0);
  const c182 = worldChemistry(alien(182));
  assert.equal(c182.carbon, "carbon-rich");
  assert.equal(c182.air, "rich");
  assert.equal(c182.metals, "rich");
  assert.equal(c182.hardener, "tin");
});

test("a world's chemistry and its native iron are kept: asked again, the same", () => {
  const w = alien(16);
  assert.equal(worldChemistry(w), worldChemistry(w));
  assert.equal(
    worldChemistry(w),
    worldChemistry(w.fine),
    "the fine grid and its provinces share one",
  );
  assert.equal(nativeIronLands(w), nativeIronLands(w));
  for (const land of nativeIronLands(w)) {
    assert.ok(w.tectonics.elevation[land]! > 0, `land ${land} is above the sea`);
    assert.ok(w.deep.coal[land]! > 0 || w.deep.oil[land]! > 0, `land ${land} holds buried carbon`);
  }
});
