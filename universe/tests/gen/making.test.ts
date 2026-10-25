import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText, seedWithAct } from "../../src/kernel/index.ts";
import { generateHomeWorld } from "../../src/gen/index.ts";
import {
  EARTHLIKE,
  MAKINGS,
  OPEN,
  madePrior,
  makingAct,
  makingsOf,
} from "../../src/rules/index.ts";

// Phase 35 M179: the world's making under the god's hand — its star, its pull, its orbit, its
// seas and its air, each an act in its seed's text; drawn within the choice, the rest as it falls.

const world = (text: string) => generateHomeWorld(seedFromText(text), OPEN, 16);

test("a making rides in the seed's text, one to a subject; acts of no known making are let be", () => {
  const text = seedWithAct(
    seedWithAct(seedWithAct("violet hollow", makingAct("pull", "heavy")), makingAct("star", "red")),
    "age 3 cool",
  );
  assert.equal(text, "violet hollow ~age 3 cool ~pull heavy ~star red");
  assert.deepEqual(makingsOf(text), { pull: "heavy", star: "red" });
  assert.deepEqual(makingsOf(`${text} ~star purple ~seas`), { pull: "heavy", star: "red" });
  // The same subject again: the last choice stands.
  assert.deepEqual(makingsOf(seedWithAct(text, makingAct("star", "white"))).star, "white");
  // A prior narrowed by them; a world like ours is not remade.
  const made = madePrior(OPEN, text);
  assert.deepEqual(made.star.mass, MAKINGS.star.red);
  assert.deepEqual(made.planet.mass, MAKINGS.pull.heavy);
  assert.deepEqual(made.planet.zone, OPEN.planet.zone);
  assert.equal(made.name, OPEN.name);
  assert.equal(madePrior(OPEN, "violet hollow"), OPEN);
  assert.equal(madePrior(EARTHLIKE, text), EARTHLIKE);
});

test("each making makes the world so: its star, its pull, its orbit's warmth, its seas, its air", () => {
  const plain = world("violet hollow");
  const red = world("violet hollow ~star red"),
    white = world("violet hollow ~star white");
  assert.ok(red.star.temperature < 3900 && white.star.temperature > 6500);
  assert.equal(red.star.spectral[0], "M");
  const heavy = world("violet hollow ~pull heavy"),
    light = world("violet hollow ~pull light");
  assert.ok(heavy.planet.gravity > 1.4 && light.planet.gravity < 0.8);
  const near = world("violet hollow ~orbit near"),
    far = world("violet hollow ~orbit far");
  assert.ok(near.planet.meanTemperature > plain.planet.meanTemperature);
  assert.ok(far.planet.meanTemperature < plain.planet.meanTemperature);
  const thick = world("violet hollow ~air thick"),
    thin = world("violet hollow ~air thin");
  assert.ok(thick.planet.meanTemperature > thin.planet.meanTemperature + 25);
  assert.ok(world("violet hollow ~seas wide").planet.oceanFraction >= 0.82);
  assert.ok(world("violet hollow ~seas little").planet.oceanFraction <= 0.3);
  // The rest as the seed falls: the same draws, so the same world but as the hand made it.
  assert.equal(heavy.planet.oceanFraction, plain.planet.oceanFraction);
  assert.equal(heavy.planet.tilt, plain.planet.tilt);
  assert.equal(red.planet.gravity, plain.planet.gravity);
  // Made, a world of its own; unmade, the world as ever.
  assert.notEqual(heavy.digest, plain.digest);
  assert.equal(world("violet hollow").digest, plain.digest);
  // A world like ours is not remade by them.
  assert.equal(
    generateHomeWorld(seedFromText("first light ~star red ~pull heavy"), EARTHLIKE, 16).digest,
    generateHomeWorld(seedFromText("first light"), EARTHLIKE, 16).digest,
  );
});

test("what rises on a world follows its making: life where it is warmed, peoples fit to its pull", () => {
  let warm = 0,
    cold = 0;
  const light: string[] = [],
    heavy: string[] = [];
  for (let i = 0; i < 30; i++) {
    if (world(`survey ${i} ~air thick`).life.people) warm++;
    if (world(`survey ${i} ~air thin`).life.people) cold++;
    const l = world(`survey ${i} ~pull light`).life.people,
      h = world(`survey ${i} ~pull heavy`).life.people;
    if (l) light.push(l.body.clade);
    if (h) heavy.push(h.body.clade);
  }
  assert.ok(warm > cold + 10, `peopled under thick air ${warm}, thin ${cold}`);
  // (Long-legged striders on a light world; on a heavy one, few.)
  const striders = (a: string[]) => a.filter((c) => c === "strider").length;
  assert.ok(striders(light) > striders(heavy), `${striders(light)} vs ${striders(heavy)}`);
});
