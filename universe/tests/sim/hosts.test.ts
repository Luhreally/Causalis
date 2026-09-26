import { test } from "node:test";
import assert from "node:assert/strict";
import { YEAR, seedFromText } from "../../src/kernel/index.ts";
import { generateHomeWorld } from "../../src/gen/index.ts";
import {
  CLADES,
  HOST_ROLES,
  OPEN,
  affordancesOf,
  bodyOf,
  compose,
  designWords,
  hostPower,
  type Doctrine,
  type Material,
} from "../../src/rules/index.ts";
import { ALIEN } from "../../src/host/planet.ts";
import { designsOf, politiesOf } from "../../src/sim/index.ts";

const cond = { warmth: 18, rain: 800, gravity: 1, ocean: 0.7 };
const body = (id: string) =>
  bodyOf(
    CLADES.find((c) => c.id === id)!,
    cond,
    [0.5, 0.5, 0.5],
  );
const doctrine: Doctrine = {
  shock: 1,
  reach: 0.3,
  range: 0.4,
  protection: 0.5,
  mobility: 0.3,
  cost: 0.5,
};
const host = (id: string, at: Material[], knows: string[] = []) =>
  compose(
    HOST_ROLES,
    (p) => knows.includes(p),
    (m) => at.includes(m),
    doctrine,
    body(id),
  );

test("a people fights with what its body is and what it can make: claws, mandibles, tusks, shells, arms that grasp", () => {
  const land: Material[] = ["wood", "reed", "hide", "stone", "body"],
    sea: Material[] = ["shell", "stone", "coral", "body"],
    arm = (id: string, at = land, knows: string[] = []) =>
      host(id, at, knows).find((p) => p.role === "arm")!.id;
  assert.equal(arm("crawler"), "claws");
  assert.equal(arm("burrower"), "mandibles");
  assert.equal(arm("trunk"), "tusks");
  assert.equal(arm("swimmer", sea), "grapple");
  // Shelled and scaled bodies are their own armour; the sea's host swims.
  assert.equal(host("burrower", land).find((p) => p.role === "guard")!.id, "own-shell");
  assert.equal(host("crawler", land).find((p) => p.role === "guard")!.id, "own-scales");
  assert.equal(host("swimmer", sea).find((p) => p.role === "mount")!.id, "swimming");
  // With the craft, the sea's host adds darts and plates of shell.
  const armed = designWords(host("swimmer", sea, ["shell-craft"]));
  assert.match(armed, /plates of shell/);
  // Swords want hands or arms deft enough: mandibles cannot wield them, hands can.
  const metal: Material[] = [...land, "bronze"];
  assert.notEqual(arm("burrower", metal, ["metalworking", "bronze"]), "sword");
  assert.equal(arm("ape", metal, ["metalworking", "bronze"]), "sword");
  // Giants ride nothing.
  assert.ok(
    !host("trunk", land, ["riding", "draught", "dairying", "cultivation"]).some(
      (p) => p.id === "horse",
    ),
  );
  // A host is as strong as its bodies: a giant's weighs many apes'.
  assert.ok(affordancesOf(body("trunk")).strength > 5 && affordancesOf(body("ape")).strength === 1);
  assert.ok(hostPower(host("crawler", land)) > hostPower(host("ape", land)));
});

test("a clawed people's realms arm their hosts with their own bodies", () => {
  let seed = "";
  for (let i = 0; i < 40 && !seed; i++) {
    const p = generateHomeWorld(seedFromText(`alien ${i}`), OPEN).life.people;
    if (p?.body.manipulators === "claws" && p.body.medium === "land") seed = `alien ${i}`;
  }
  const world = ALIEN.build(seedFromText(seed));
  world.runTo(80 * YEAR);
  const realm = politiesOf(world).living()[0]!,
    design = designsOf(world).of(realm.ref)!;
  assert.match(designWords(design.parts), /claws/);
});
