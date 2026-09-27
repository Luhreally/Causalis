import { test } from "node:test";
import assert from "node:assert/strict";
import {
  HAIRS,
  carryWords,
  figureOf,
  hairOf,
  homeDetail,
  houseLook,
  lamplight,
  metalOf,
} from "../../src/view/index.ts";

test("upright figures are built more finely at each setting: hands and shoes, then hair and eyes, then a belt", () => {
  const counts = [0, 1, 2, 3].map((d) => figureOf(null, d).parts.length);
  assert.deepEqual(counts, [6, 10, 14, 15]);
  const fine = figureOf(null, 3).parts;
  // The hands swing with the arms, about the same shoulder.
  const arms = fine.filter((p) => p.tone === 2 && p.swing && p.sy > 0.1),
    hands = fine.filter((p) => p.tone === 2 && p.swing && p.sy < 0.05);
  assert.equal(arms.length, 2);
  assert.equal(hands.length, 2);
  for (const h of hands) {
    const arm = arms.find((a) => a.x === h.x)!;
    assert.equal(h.swing, arm.swing);
    assert.ok(Math.abs(h.y + h.pivot! - (arm.y + arm.pivot!)) < 1e-9, "the same shoulder");
  }
  // Hair above the head and eyes on its face.
  const head = fine.find((p) => p.tone === 2 && !p.swing)!;
  assert.ok(fine.some((p) => p.tone === 3 && p.y + p.sy / 2 > head.y + head.sy / 2));
  assert.ok(fine.filter((p) => p.tone === 4).every((p) => p.z > head.z + head.sz / 2 - 0.01));
  // (Other peoples keep their own shapes.)
  const body = {
    clade: "swimmer",
    medium: "water",
    symmetry: "radial",
    manipulators: "tentacles",
    limbs: 8,
    skin: "slick",
    size: 40,
  } as const;
  assert.deepEqual(figureOf(body, 3).parts, figureOf(body, 0).parts);
});

test("each person keeps their own hair, grey in old age", () => {
  const seen = new Set<number>();
  for (let i = 0; i < 200; i++) {
    const h = hairOf(`prsn:0:${i}`, 30);
    assert.ok(h >= 0 && h < HAIRS.length - 1);
    assert.equal(hairOf(`prsn:0:${i}`, 30), h, "the same person, the same hair");
    seen.add(h);
  }
  assert.equal(seen.size, HAIRS.length - 1, "all the hairs among two hundred");
  assert.equal(hairOf("prsn:0:1", 70), HAIRS.length - 1, "grey at seventy");
  // Old age comes as late in a longer-lived people's span.
  assert.notEqual(hairOf("prsn:0:1", 70, 140), HAIRS.length - 1);
});

test("homes are built more finely at each setting: windows and a chimney, then a porch, then a watched home's fence", () => {
  const look = houseLook({
      walls: "wattle",
      roof: "thatch",
      form: "long",
      pitch: 45,
      design: null,
    }),
    at = (detail: number, watched = true, era: "farm" | "forage" = "farm") =>
      homeDetail(look, 0.4, 0.7, era, detail, watched).map((p) => p.role);
  assert.deepEqual(at(0), []);
  assert.ok(at(1).includes("window") && at(1).includes("chimney") && !at(1).includes("porch"));
  assert.ok(at(2).includes("porch") && at(2).filter((r) => r === "post").length === 2);
  assert.ok(at(3).includes("fence") && !at(3, false).includes("fence"), "a fence for the watched");
  assert.ok(!at(1, true, "forage").includes("chimney"), "no chimney before the farming ages");
  const tent = houseLook({ walls: "tent", roof: "hide", form: "round", pitch: 60, design: null });
  assert.deepEqual(homeDetail(tent, 0.1, 0.8, "farm", 3, true), [], "a tent is a tent");
  // The chimney stands out of the roof.
  const chimney = homeDetail(look, 0.4, 0.7, "farm", 1, false).find((p) => p.role === "chimney")!;
  assert.ok(chimney.y + chimney.sy / 2 > 0.7);
});

test("windows are lit from dusk to dawn, dark by day", () => {
  assert.equal(lamplight(12), 0);
  assert.equal(lamplight(23), 1);
  assert.equal(lamplight(3), 1);
  assert.ok(lamplight(19) > 0 && lamplight(19) < 1, "lamps coming on at dusk");
  assert.ok(lamplight(6) > 0 && lamplight(6) < 1, "and going out at dawn");
});

test("what a tool is made of is told by the land's age: flint, bronze of copper and tin, iron, steel", () => {
  assert.match(carryWords("tool", "farm"), /stone.*flint/);
  assert.match(carryWords("tool", "metal"), /bronze.*copper and tin/);
  assert.match(carryWords("tool", "industry"), /iron/);
  assert.match(carryWords("tool", "modern"), /steel.*carbon/);
  assert.equal(metalOf("forage").name, "stone");
  assert.match(carryWords("ore", "industry", "coal"), /coal/);
  assert.match(carryWords("ore", "metal", "ore"), /copper/);
});
