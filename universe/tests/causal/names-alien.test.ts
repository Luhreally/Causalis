// Phase 54 M222: a metal's principle is named as its world names the metal. Alien 16 is hardened with
// arsenic, so its bronze is arsenical copper; Earth's bronze is bronze; with no world given the
// principle keeps its own name. Alien 182 is carbon-rich, so its iron is cohenite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { ALIEN, EARTH } from "../../src/host/planet.ts";
import { principleName } from "../../src/causal/index.ts";

const alien16 = ALIEN.build(seedFromText("alien 16"));
alien16.runTo(YEAR);
const earth = EARTH.build(seedFromText("first light"));
earth.runTo(YEAR);

test("on alien 16, bronze is arsenical copper", () => {
  assert.equal(principleName("bronze", alien16), "arsenical copper");
});

test("on Earth, bronze is bronze", () => {
  assert.equal(principleName("bronze", earth), "bronze");
});

test("with no world given, bronze is bronze", () => {
  assert.equal(principleName("bronze"), "bronze");
});

test("on alien 182, a carbon-rich world, iron is cohenite iron", () => {
  const carbon = ALIEN.build(seedFromText("alien 182"));
  carbon.runTo(YEAR);
  assert.equal(principleName("iron", carbon), "cohenite iron");
});
