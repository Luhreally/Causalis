import { test } from "node:test";
import assert from "node:assert/strict";
import { glyphOf, paletteOf } from "../../src/ui/page-art.ts";
import { houseSolids } from "../../src/ui/buildings.ts";
import { houseLook } from "../../src/view/index.ts";

// A page's art (asked 2026-11-13): its colours are its world's, read from its star's warmth and its kind; a tab's glyph by its words.

test("a world's light and sky follow its star's warmth, and its haze its kind", () => {
  const sun = paletteOf({ kind: "rocky", star: 5772 }),
    red = paletteOf({ kind: "rocky", star: 3300 }),
    hot = paletteOf({ kind: "rocky", star: 9000 }),
    methane = paletteOf({ kind: "methane", star: 5772 });
  // (A red dwarf's light redder than the Sun's, a white star's bluer.)
  assert.ok(red.light[2] / red.light[0] < sun.light[2] / sun.light[0]);
  assert.ok(hot.light[2] / hot.light[0] > sun.light[2] / sun.light[0]);
  // (The Sun's sky blue: blue scattered most.)
  assert.ok(sun.zenith[2] > sun.zenith[0]);
  // (A methane world's sky hazed toward amber.)
  assert.ok(methane.zenith[0] / methane.zenith[2] > sun.zenith[0] / sun.zenith[2]);
  // (Its seas its liquid's, not Earth's blue.)
  assert.notDeepEqual(methane.sea, sun.sea);
  for (const p of [sun, red, hot, methane])
    for (const c of [p.light, p.zenith, p.horizon, p.sea, p.leaf, p.ground])
      for (const v of c)
        assert.ok(Number.isFinite(v) && v >= 0 && v <= 1.0001, `${p.key}: ${c.join(",")}`);
});

test("a tab's glyph says what it is of", () => {
  assert.equal(glyphOf("people"), "people");
  assert.equal(glyphOf("History"), "years");
  assert.equal(glyphOf("economy"), "goods");
  assert.equal(glyphOf("wars"), "arms");
  assert.equal(glyphOf("sickness"), "heal");
  assert.equal(glyphOf("overview"), "eye");
  assert.equal(glyphOf("substances"), "matter");
  assert.equal(glyphOf("zzz"), null);
});

// A house drawn from its land's design always under its roof (the styles sheet, 2026-11-13, read "tent//round" and "pitch-walls//round":
// a design with no roof part). A tent's skin is its roof; a house whose land gives nothing to roof with is closed over in its walls' own
// stuff, not thatched; only a warren open to the water above has none.
test("every house picture has its roof but one open to the water", () => {
  const roofOf = (walls: string, roof: string, form: string) => {
    const house = { walls, roof, form, pitch: 35, design: null },
      look = houseLook(house),
      solids = houseSolids({ kind: "house", house, storeys: 1, key: 1 }),
      top = Math.max(...solids.map((s) => s.y + s.sy / 2)),
      // (What stands on its walls, or on the ground where a tent has none: its roof.)
      sides = solids.filter((s) => String(s.color) === String(look.wall) && s.shape === "box"),
      eaves = look.tent ? 0 : Math.max(...sides.map((s) => s.y + s.sy / 2)),
      over = solids.slice(1).filter((s) => s.y - s.sy / 2 >= eaves - 1e-9);
    return { look, over, top };
  };
  for (const [walls, form] of [
    ["tent", "round"],
    ["pitch-walls", "round"],
    ["stone", "long"],
    ["mudbrick", "court"],
  ] as const) {
    const { look, over, top } = roofOf(walls, "", form);
    assert.ok(over.length > 0, `${walls}//${form}: no roof over it`);
    assert.ok(top > 0.1, `${walls}//${form}: stands ${top.toFixed(2)} high`);
    if (walls !== "tent")
      assert.notDeepEqual(
        look.roof,
        houseLook({ walls, roof: "thatch", form, pitch: 35, design: null }).roof,
      );
  }
  const tent = roofOf("tent", "", "round");
  assert.equal(tent.over[0]!.shape, "pyramid", "a tent is its cone");
  assert.equal(roofOf("reef-walls", "open", "warren").over.length, 0, "an open warren has a roof");
});
