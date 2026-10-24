import { test } from "node:test";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { seedFromText } from "../../src/kernel/index.ts";
import {
  OLDEST_STAR_GYR,
  descendantsOf,
  develop,
  distance,
  encode,
  endOf,
  generateHomeWorld,
  lineOf,
  livesOn,
  starAgeGyr,
  treeOfLife,
} from "../../src/gen/index.ts";
import { EARTHLIKE, OPEN } from "../../src/rules/index.ts";

// Earth's like; an alien world under a young star (its dawn crowded); one under a star far
// older than the galaxy (its age told as the galaxy's); and another alien.
const earth = generateHomeWorld(seedFromText("first light"), EARTHLIKE),
  worlds = [
    earth,
    ...["alien 3", "alien 19", "alien 41"].map((s) => generateHomeWorld(seedFromText(s), OPEN)),
  ];

test("every lineage of a world has its line in the tree, in exactly the body it lives in", () => {
  for (const g of worlds) {
    const tree = treeOfLife(g);
    for (const s of g.life.species) {
      const id = tree.ofSpecies[s.index]!;
      assert.ok(id >= 0, `${s.name} has a line`);
      const n = tree.nodes[id]!;
      assert.equal(n.species, s.index);
      assert.equal(n.ref, s.ref, `${s.name}'s line is its own page`);
      if (!s.body) continue;
      assert.ok(isDeepStrictEqual(n.body, s.body), `${s.name}: the tree's body is its own`);
      // Its instructions grow its body; and the body read back gives the same instructions.
      assert.ok(n.genome, `${s.name} has instructions`);
      assert.ok(isDeepStrictEqual(develop(n.genome, s.body.level), s.body), s.name);
      assert.ok(isDeepStrictEqual(develop(encode(s.body, n.genome), s.body.level), s.body));
    }
  }
});

test("every line comes of an older one, back to the first replicators; none ends before it began", () => {
  for (const g of worlds) {
    const tree = treeOfLife(g),
      roots = tree.nodes.filter((n) => n.parent < 0);
    assert.equal(roots.length, 1, "one beginning");
    assert.match(roots[0]!.name, /replicators/);
    assert.ok(tree.worldAge > roots[0]!.from, "life began after the world did");
    for (const n of tree.nodes) {
      assert.equal(n.id, tree.nodes.indexOf(n));
      if (n.parent >= 0) {
        const m = tree.nodes[n.parent]!;
        assert.ok(m.from > n.from, `${n.name} (${n.from}) is younger than ${m.name} (${m.from})`);
        assert.ok(tree.children[m.id]!.includes(n.id));
      }
      if (n.to !== null) assert.ok(n.to < n.from && n.to >= 0, `${n.name} ends after it began`);
      assert.ok(endOf(tree, n.id) <= n.from);
      // (Its line runs back to the first.)
      assert.equal(lineOf(tree, n.id)[0], roots[0]);
    }
    // The dawn's steps come one after another.
    for (let i = 1; i < tree.rungs.length; i++)
      assert.ok(tree.rungs[i]!.at < tree.rungs[i - 1]!.at, tree.rungs[i]!.name);
  }
});

test("a world is as old as its star, but no star is older than the galaxy", () => {
  for (const g of worlds) {
    const tree = treeOfLife(g);
    assert.ok(starAgeGyr(g.star) <= OLDEST_STAR_GYR);
    assert.ok(tree.worldAge <= OLDEST_STAR_GYR * 1000);
    if (g.star.ageGyr >= 1.5 && g.star.ageGyr <= OLDEST_STAR_GYR)
      assert.equal(tree.worldAge, Math.round(g.star.ageGyr * 1000));
  }
  assert.ok(
    worlds.some((g) => g.star.ageGyr > OLDEST_STAR_GYR),
    "a star older than the galaxy is among them",
  );
});

test("the forebears that died out died, and the living lines live to now", () => {
  for (const g of worlds) {
    const tree = treeOfLife(g);
    for (const n of tree.nodes) {
      if (n.kind === "ghost")
        assert.ok(
          n.to !== null || (livesOn(tree, n.id) && tree.children[n.id]!.length > 0),
          `${n.name} died out, or lives on only in its daughters`,
        );
      if (n.species !== null) {
        const s = g.life.species[n.species]!;
        assert.equal(n.to === null, s.died === null, `${s.name} lives as long as it does`);
      }
    }
    // Every living lineage's forebears live on in it.
    for (const s of g.life.species.filter((x) => x.died === null))
      for (const f of lineOf(tree, tree.ofSpecies[s.index]!)) assert.ok(livesOn(tree, f.id));
  }
});

test("the people came of the first cells, through bodies that changed for a reason", () => {
  for (const g of worlds) {
    const tree = treeOfLife(g),
      people = tree.nodes.find((n) => n.kind === "people");
    if (!g.life.species.some((s) => s.niche === "upright ape")) continue;
    assert.ok(people, "the people have a line");
    const line = lineOf(tree, people.id).map((n) => n.name);
    assert.ok(line.includes("the first cells"), line.join(" → "));
    assert.ok(line.length >= 6, line.join(" → "));
  }
  // Earth's people came of four-legged beasts with fur.
  const tree = treeOfLife(earth),
    people = tree.nodes.find((n) => n.kind === "people")!,
    line = lineOf(tree, people.id);
  assert.ok(
    line.some((n) => n.body && n.body.legs === 4 && n.body.covering === "fur"),
    line.map((n) => n.name).join(" → "),
  );
  // Each step whose body changed says what changed, and why.
  for (const g of worlds) {
    const t = treeOfLife(g);
    for (const n of t.nodes) {
      const m = n.parent >= 0 ? t.nodes[n.parent]! : null;
      if (!n.genome || !m?.genome || n.kind === "people") continue;
      if (distance(m.genome, n.genome) > 0)
        assert.ok(n.innovations.length > 0, `${n.name} says what changed from ${m.name}`);
      for (const i of n.innovations) assert.ok(i.what.length > 2 && i.why.length > 2, n.name);
    }
  }
});

test("a tree is drawn from its world alone, the same each time, and changes nothing of it", () => {
  const before = JSON.stringify(earth.life),
    first = JSON.stringify(treeOfLife(earth));
  // (Others' trees push it out of the cache: it is grown again.)
  for (const s of ["moss", "kestrel", "alien 7", "alien 55"])
    treeOfLife(generateHomeWorld(seedFromText(s), OPEN));
  assert.equal(JSON.stringify(treeOfLife(earth)), first);
  assert.equal(JSON.stringify(earth.life), before);
  // Lines of descent hold together: a line's heirs are its daughters and theirs.
  const tree = treeOfLife(earth);
  for (const n of tree.nodes.slice(0, 20))
    for (const h of descendantsOf(tree, n.id))
      assert.ok(lineOf(tree, h).some((x) => x.id === n.id));
});
