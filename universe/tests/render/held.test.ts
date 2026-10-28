// A creature walked in (Phase 61), always seen: the meadow's beasts that would hide it from the eye,
// or that the eye would look out from inside, not drawn — geometry alone, no GPU needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sightOf, type Sighted } from "../../src/render/meadow.ts";
import { buildBody, defaultBody } from "../../src/view/index.ts";

// (A great grazer and a finch as the meadow draws them, grown; units.)
const grazer = buildBody(defaultBody("grazer", 2000, false), 2),
  finch = buildBody(
    {
      ...defaultBody("seed-eater", 0.1, false),
      legs: 2,
      wings: 2,
      covering: "feathers",
      moves: "fly",
    },
    2,
  );
const at = (x: number, z: number, heading = 0, body = grazer, grow = 1): Sighted => ({
  x,
  z,
  heading,
  up: 0,
  body,
  grow,
});
const hides = (eye: { x: number; y: number; z: number }, held: Sighted, b: Sighted) =>
  sightOf(eye, held)(b.x, b.z, b.heading, b.up, b.body, b.grow);

test("a beast across the eye's line to the one walked in hides it; one aside, or beyond it, does not", () => {
  const held = at(0, 0, 0, finch),
    eye = { x: 0, y: 0.25, z: -0.4 };
  // Broadside across the line, its legs and its belly over it.
  assert.equal(hides(eye, held, at(0, -0.2, Math.PI / 2)), true);
  assert.equal(hides(eye, held, at(0.3, -0.2, Math.PI / 2)), true);
  // Well aside of the line; beyond the one walked in.
  assert.equal(hides(eye, held, at(1.5, -0.2, Math.PI / 2)), false);
  assert.equal(hides(eye, held, at(0, 1.5, Math.PI / 2)), false);
  // Another finch beside it, clear of the line.
  assert.equal(hides(eye, held, at(0.2, 0, 0, finch)), false);
  // A finch on the line hides it as well.
  assert.equal(hides(eye, held, at(0, -0.2, 0, finch)), true);
});

test("the eye in a beast, or all but, and a young one by its size", () => {
  const held = at(0, 0, 0, finch);
  assert.equal(hides({ x: 0, y: 0.6, z: -3 }, held, at(0, -3)), true);
  assert.equal(hides({ x: 0.45, y: 0.6, z: -3 }, held, at(0, -3)), true);
  assert.equal(hides({ x: 3, y: 0.6, z: -3 }, held, at(0, -3)), false);
  // A calf of a third its size beside the line, where the grown one would stand over it.
  const eye = { x: 0, y: 0.25, z: -0.4 };
  assert.equal(hides(eye, held, at(0.45, -0.2, 0, grazer, 1)), true);
  assert.equal(hides(eye, held, at(0.45, -0.2, 0, grazer, 0.3)), false);
});
