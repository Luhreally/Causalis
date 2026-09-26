import { test } from "node:test";
import assert from "node:assert/strict";
import { CLADES, bodyOf } from "../../src/rules/index.ts";
import { figureOf, houseLook, type FigureBody } from "../../src/view/index.ts";

const cond = { warmth: 18, rain: 800, gravity: 1, ocean: 0.7 };
const body = (id: string): FigureBody =>
  bodyOf(
    CLADES.find((c) => c.id === id)!,
    cond,
    [0.5, 0.5, 0.5],
  );

test("each body is drawn as itself: an upright ape, a mantle over many arms, a shelled body on six legs", () => {
  // Upright apes as the microscope has always drawn them: one standing body.
  const apes = figureOf(body("ape"));
  assert.equal(apes.parts.length, 1);
  assert.equal(apes.parts[0]!.shape, "capsule");
  assert.deepEqual(figureOf(null).parts, apes.parts);
  // A radial swimmer: a mantle and a ring of eight arms about it.
  const swimmer = figureOf(body("swimmer")),
    arms = swimmer.parts.filter((p) => p.tone === 1);
  assert.equal(arms.length, 8);
  const r = arms.map((a) => Math.hypot(a.x, a.z));
  assert.ok(Math.max(...r) - Math.min(...r) < 1e-9, "arms in a ring");
  // Burrowers on six legs; crawlers long and low with a tail; striders on two long legs.
  const legs = (id: string) =>
    figureOf(body(id)).parts.filter((p) => p.shape === "cylinder").length;
  assert.equal(legs("burrower"), 6);
  assert.equal(legs("strider"), 2);
  assert.ok(
    figureOf(body("crawler")).parts.some((p) => p.shape === "cone" && p.z < 0),
    "a tail",
  );
  // Every clade looks unlike every other.
  const looks = CLADES.map((c) => JSON.stringify(figureOf(body(c.id)).parts));
  assert.equal(new Set(looks).size, CLADES.length);
  // Giants are drawn bigger.
  assert.ok(figureOf(body("trunk")).scale > 2 * figureOf(body("ape")).scale);
});

test("houses look as their design says: shell towers tall, nests raised, reef houses open to the water", () => {
  const house = (walls: string, roof: string, form: string) =>
    houseLook({ walls, roof, form, pitch: 30, design: null });
  const common = house("wattle", "thatch", "long");
  assert.equal(common.height, 1);
  assert.equal(common.raised, 0);
  assert.ok(!common.open);
  assert.ok(house("reef-walls", "open", "shell-tower").height >= 3);
  assert.ok(house("reef-walls", "open", "shell-tower").open);
  assert.ok(house("wattle", "thatch", "nest").raised > 0);
  assert.ok(house("burrow", "mound", "warren").height < 1);
  assert.ok(house("wattle", "thatch", "great-hall").length > common.length);
});
