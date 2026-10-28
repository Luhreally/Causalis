import { test } from "node:test";
import assert from "node:assert/strict";
import { cradleTongue, fittedWord, rootsOf, speechOf, wordOf } from "../../src/gen/index.ts";
import { MEANINGS } from "../../src/rules/index.ts";

test("a family's roots are deterministic, inherited by daughters, and distinct from other families", () => {
  const parent = { seed: 42, line: [1] },
    daughter = { seed: 42, line: [1, 2] };
  const roots = rootsOf(parent),
    child = rootsOf(daughter),
    other = rootsOf({ seed: 42, line: [7] });
  assert.equal(roots.size, MEANINGS.length);
  assert.deepEqual(roots, rootsOf(parent));
  const inherited = MEANINGS.filter(
    (m) => JSON.stringify(roots.get(m)) === JSON.stringify(child.get(m)),
  ).length;
  assert.ok(inherited > MEANINGS.length / 2 && inherited < MEANINGS.length);
  assert.ok(
    MEANINGS.filter((m) => JSON.stringify(roots.get(m)) !== JSON.stringify(other.get(m))).length >
      MEANINGS.length * 0.9,
  );
  assert.equal(new Set([...roots.values()].map((r) => JSON.stringify(r))).size, roots.size);
});

test("material compounds keep their meanings and fit a borrowed word to another tongue", () => {
  const line = { seed: 42, line: [1] },
    tongue = cradleTongue(31),
    roots = rootsOf(line),
    speech = speechOf(line);
  const said = wordOf(tongue, roots, speech, ["black", "edge", "stone"]);
  assert.deepEqual(new Set(said.roots.map((r) => r.meaning)), new Set(["black", "edge", "stone"]));
  assert.ok(said.text.length >= 3 && /^[a-z'-]+$/.test(said.text));
  const borrowed = fittedWord(said, cradleTongue(913));
  assert.deepEqual(
    borrowed.roots.map((r) => r.meaning),
    said.roots.map((r) => r.meaning),
  );
  assert.ok(borrowed.text.length >= 3);
  assert.deepEqual(borrowed, fittedWord(said, cradleTongue(913)));
});
