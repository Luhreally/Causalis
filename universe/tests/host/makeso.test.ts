// Live a Line's "Make it so" (S4): the line lived becomes acts on the world's dawn. Without them the world and its tree are
// as they were (the acts parse to nothing); with them the tree has the line, a living daughter of the line it was founded
// from, its body as the hand left it within its new world's physics.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText, seedWithAct } from "../../src/kernel/index.ts";
import { EARTHLIKE } from "../../src/rules/index.ts";
import { generateHomeWorld, linesMade, treeOfLife, wayAt, wayIndex } from "../../src/gen/index.ts";
import { checkBody, foundersOf, lineAct, makeSo } from "../../src/host/line.ts";
import { protoLifeWorld } from "../../src/gen/index.ts";

test("a line act is read back as laid, and no other act reads as one", () => {
  const text = seedWithAct(seedWithAct("first light", lineAct(14, 8, 3)), "dawn hunters");
  assert.deepEqual(linesMade(text, 12), [{ node: 14, age: 8, way: 3, genome: null }]);
  const g = {
      axis: "bilateral",
      mass: 0.004,
      legs: 0,
      warm: true,
      grows: ["horns", "claws"],
      place: "sunlit sea",
    },
    coded = linesMade(seedWithAct("first light", lineAct(14, 8, 3, g as never)), 12);
  assert.deepEqual(coded[0]!.genome, g, "a body's instructions read back as laid");
  assert.equal(
    linesMade(seedWithAct("first light", "line 1 2 3 !!"), 12)[0]!.genome,
    null,
    "a code that reads not, none",
  );
  assert.deepEqual(linesMade("first light", 12), []);
  assert.deepEqual(
    linesMade(seedWithAct("first light", "line 1 99 2"), 12),
    [],
    "an age past the last",
  );
  assert.equal(wayAt(wayIndex("burrower")), "burrower");
});

test("Make it so: the line lived is in the remade world's tree, living, and the lines before it are as they were", () => {
  const before = generateHomeWorld(seedFromText("first light"), EARTHLIKE),
    tree0 = treeOfLife(before),
    founder = foundersOf(before, before.digest, 1, 0)[0]!;
  assert.ok(founder.node !== undefined, "a founder names its line in the tree");
  // (A line founded, then lived on into a later age as a burrower of the sea's floor.)
  const made = makeSo(seedFromText("first light").text, {
    cell: "hunter",
    bodies: [{ my: 600, way: "burrower" }],
    node: founder.node!,
    genome: founder.genome,
  });
  // (A seed a person may still read: the body's code is short.)
  assert.ok(made.seed.length < 140, `${made.seed.length} characters: ${made.seed}`);
  assert.ok(
    made.acts.some((a) => a.startsWith("dawn hunters")),
    made.acts.join(" | "),
  );
  assert.ok(
    made.acts.some((a) => a.startsWith("line ")),
    made.acts.join(" | "),
  );
  const t0 = performance.now(),
    after = generateHomeWorld(seedFromText(made.seed), EARTHLIKE),
    tree1 = treeOfLife(after),
    ms = performance.now() - t0;
  // (The world made again, its tree with it, well within the six seconds a remake to year 0 is given.)
  assert.ok(ms < 6000, `made in ${ms.toFixed(0)} ms`);
  const mine = tree1.nodes.filter((n) => n.name.startsWith("Your line"));
  assert.equal(mine.length, 1);
  const n = mine[0]!;
  assert.equal(n.parent, founder.node);
  assert.equal(n.way, "burrower");
  assert.equal(n.died, null);
  assert.ok(n.genome && n.body, "a body of its world's own development");
  // (The body as the hand left it, eating as its way does, and within the remade world's physics.)
  assert.deepEqual({ ...n.genome!, diet: null }, { ...founder.genome, diet: null });
  assert.deepEqual(
    checkBody(n.genome!, "burrower", protoLifeWorld(after as never)).breaks,
    [],
    "its body breaks none of the new world's physics",
  );
  // (The dawn's lines are laid in one order on every world: the line it was founded from is that line made again.)
  assert.equal(tree1.nodes[founder.node!]!.way, tree0.nodes[founder.node!]!.way);
  assert.equal(tree1.nodes[founder.node!]!.kind, tree0.nodes[founder.node!]!.kind);
  assert.ok(tree1.children[founder.node!]!.includes(n.id));

  // (Only the line act: a world of its own, as every act makes, so no reading kept by a world's digest takes one for the
  // other; its line is there, a daughter of the same line, the body as the hand left it.)
  const lineOnly = generateHomeWorld(
      seedFromText(
        seedWithAct(
          "first light",
          made.acts.find((a) => a.startsWith("line "))!,
        ),
      ),
      EARTHLIKE,
    ),
    tree2 = treeOfLife(lineOnly),
    mine2 = tree2.nodes.find((x) => x.name.startsWith("Your line"));
  assert.notEqual(lineOnly.digest, before.digest);
  assert.equal(mine2?.parent, founder.node);
  assert.equal(tree2.nodes[founder.node!]!.way, tree0.nodes[founder.node!]!.way);
  assert.deepEqual({ ...mine2!.genome!, diet: null }, { ...founder.genome, diet: null });
  // (And no act, the world as it was.)
  assert.equal(generateHomeWorld(seedFromText("first light"), EARTHLIKE).digest, before.digest);
});
