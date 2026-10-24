import { test } from "node:test";
import assert from "node:assert/strict";
import { seedActs, seedFromText, seedName, seedWithAct } from "../../src/kernel/index.ts";
import { generateHomeWorld } from "../../src/gen/index.ts";
import { EARTHLIKE, OPEN, ageAct, agesMade, dawnAct, dawnMade } from "../../src/rules/index.ts";

// Phase 24: the acts the god's hand lays on a world's dawn ride in its seed's text, and the
// world is made again from them — changed where they reach, as it was where they do not.

test("a seed's acts follow its name, one to a subject, in one order however they were laid", () => {
  const a = seedWithAct(seedWithAct("first light", ageAct(11, "cool")), ageAct(2, "fire")),
    b = seedWithAct(seedWithAct("first light", ageAct(2, "fire")), ageAct(11, "cool"));
  assert.equal(a, "first light ~age 3 fire ~age 12 cool");
  assert.equal(a, b);
  assert.equal(seedName(a), "first light");
  assert.deepEqual(seedActs(a), ["age 3 fire", "age 12 cool"]);
  // The same subject again: the last act laid stands.
  assert.equal(seedWithAct(a, ageAct(2, "calm")), "first light ~age 3 calm ~age 12 cool");
  const c = seedWithAct(a, dawnAct("hunters"));
  assert.equal(c, "first light ~age 3 fire ~age 12 cool ~dawn hunters");
  assert.equal(dawnMade(c), "hunters");
  assert.deepEqual(
    [...agesMade(c, 16)],
    [
      [2, "great volcanism"],
      [11, "icehouse"],
    ],
  );
  // Its draws are its name's: the world is the same world, remade only where the acts reach.
  assert.deepEqual(
    { lo: seedFromText(c).lo, hi: seedFromText(c).hi },
    { lo: seedFromText("first light").lo, hi: seedFromText("first light").hi },
  );
  assert.equal(seedFromText(c).text, c);
  // A text with no acts is its own name, as every seed always was.
  assert.deepEqual(seedActs("juniper"), []);
  assert.equal(seedName("juniper"), "juniper");
});

test("an age made cold is an icehouse, the ages before it and their lineages as they were; its ground the same", () => {
  const plain = generateHomeWorld(seedFromText("first light"), EARTHLIKE),
    cool = generateHomeWorld(seedFromText(`first light ~${ageAct(6, "cool")}`), EARTHLIKE);
  assert.equal(cool.ground, plain.ground, "the same land");
  assert.notEqual(cool.digest, plain.digest, "a world remade");
  assert.equal(cool.deep.ages[6]!.kind, "icehouse");
  assert.ok(cool.deep.ages[6]!.warmth <= -4.5);
  assert.deepEqual(cool.deep.ages.slice(0, 6), plain.deep.ages.slice(0, 6));
  const before = plain.life.species.filter((s) => s.arose < 6);
  assert.ok(before.length > 10);
  for (const s of before) {
    const same = cool.life.species[s.index]!;
    assert.equal(same.name, s.name);
    assert.equal(same.arose, s.arose);
  }
});

test("a stone struck from the sky in an age is a great death: more lineages end in it", () => {
  for (const [name, prior] of [
    ["first light", EARTHLIKE],
    ["alien 3", OPEN],
  ] as const) {
    const plain = generateHomeWorld(seedFromText(name), prior),
      struck = generateHomeWorld(seedFromText(`${name} ~${ageAct(8, "strike")}`), prior);
    assert.equal(struck.deep.ages[8]!.kind, "impact");
    const died = (g: typeof plain) => g.life.species.filter((s) => s.died === 8).length;
    assert.ok(died(struck) > died(plain), `${name}: ${died(plain)} → ${died(struck)} ended`);
  }
});

test("what prospered in the first seas bends the web of eating after it", () => {
  const hunters = (g: ReturnType<typeof generateHomeWorld>) =>
      g.life.species.filter((s) => s.niche === "hunter" || s.niche === "small hunter").length,
    great = (g: ReturnType<typeof generateHomeWorld>) =>
      g.life.species.filter((s) => s.niche === "great beast" || s.niche === "scavenger").length;
  let plainHunters = 0,
    bentHunters = 0,
    plainGreat = 0,
    bentGreat = 0;
  for (const name of ["first light", "juniper"]) {
    const plain = generateHomeWorld(seedFromText(name), EARTHLIKE);
    plainHunters += hunters(plain);
    plainGreat += great(plain);
    bentHunters += hunters(generateHomeWorld(seedFromText(`${name} ~dawn hunters`), EARTHLIKE));
    bentGreat += great(generateHomeWorld(seedFromText(`${name} ~dawn together`), EARTHLIKE));
  }
  assert.ok(bentHunters > plainHunters * 1.3, `hunters ${plainHunters} → ${bentHunters}`);
  assert.ok(bentGreat > plainGreat * 1.3, `great bodies ${plainGreat} → ${bentGreat}`);
});
