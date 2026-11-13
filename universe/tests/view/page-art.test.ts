import { test } from "node:test";
import assert from "node:assert/strict";
import { glyphOf, paletteOf } from "../../src/ui/page-art.ts";

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
