import { test } from "node:test";
import assert from "node:assert/strict";
import { World, loadWorld, rulesetId, saveWorld, seedFromText } from "../../src/kernel/index.ts";
import { EARTHLIKE, OPEN } from "../../src/rules/index.ts";
import { generateHomeWorld, treeOfLife } from "../../src/gen/index.ts";
import { SagaStore, installSaga } from "../../src/host/saga.ts";
import { ask, lineFactsOf } from "../../src/host/line.ts";
import { dawnSeaOf, dropOfWorld } from "../../src/host/inspect/small.ts";
import { cellGates, daughtersOf, firstTraits, type LineFacts } from "../../src/view/line.ts";

// Live a Line: the sagas of lines lived are kept beside a world (in its save), never in its hash; and what a cell of a
// world can take up is that world's own.

const build = (seed = seedFromText("saga")) => {
  const w = new World(seed);
  installSaga(w);
  return w;
};

test("a saga is kept beside the world: in its save, never in its hash nor its ruleset", () => {
  const a = build(),
    b = build(),
    bare = new World(seedFromText("saga"));
  assert.ok((a.store("readings.saga") as SagaStore).dormant());
  const keep = (w: World, a: unknown) => ask("saga.keep", w, a);
  const id = keep(a, { id: 0, data: { v: 1, gens: [{ pick: 1, my: 3000 }] } }) as number;
  assert.equal(id, 1);
  assert.equal(keep(a, { id, data: { v: 1, gens: [] } }), 1, "kept again under its own id");
  assert.equal(keep(a, { id: 0, data: { v: 1 } }), 2);
  assert.deepEqual(a.domainHashes(), b.domainHashes());
  assert.deepEqual(a.domainHashes(), bare.domainHashes());
  assert.equal(rulesetId(a, "x"), rulesetId(bare, "x"));
  // Through a save and back: the sagas as they were.
  const doc = saveWorld(a, rulesetId(a, "x")),
    back = loadWorld(doc, (s) => build(s), rulesetId(a, "x")).world;
  const list = ask("saga.list", back, {}) as { id: number; data: unknown }[];
  assert.deepEqual(
    list.map((x) => x.id),
    [2, 1],
  );
  // A world that keeps none loads a save made before sagas were.
  const before = saveWorld(bare, rulesetId(bare, "x"));
  assert.doesNotThrow(() => loadWorld(before, (s) => build(s), rulesetId(bare, "x")));
});

test("the sagas kept are bounded: the least lately played let go", () => {
  const w = build(),
    keep = (x: World, a: unknown) => ask("saga.keep", x, a);
  for (let i = 0; i < 12; i++) keep(w, { id: 0, data: { v: 1, pad: "x".repeat(2000) } });
  const s = w.store("readings.saga") as SagaStore;
  assert.ok(s.sagas.length <= 6);
  assert.ok(JSON.stringify(s.sagas).length <= 48_000);
  assert.equal(s.sagas.at(-1)!.id, 12, "the newest kept");
});

test("what a cell can take up holds to each world's own chemistry and dawn, on six worlds", () => {
  const worlds = [
    ["first light", EARTHLIKE],
    ["kestrel", EARTHLIKE],
    ["ember", EARTHLIKE],
    ["first light", OPEN],
    ["tide 41", OPEN],
    ["glass 7", OPEN],
  ] as const;
  let lived = 0;
  for (const [name, prior] of worlds) {
    const g = generateHomeWorld(seedFromText(name), prior),
      f = lineFactsOf(g, null) as LineFacts,
      tree = treeOfLife(g),
      rungs = tree.rungs.map((r) => ({ id: r.id, name: r.name, at: r.at, words: r.words })),
      drop = dropOfWorld(g, dawnSeaOf(g), { dawn: true });
    assert.ok(f.liquid && f.pigment && f.membrane, `${name}: its chemistry read`);
    if (!drop) continue;
    lived++;
    const light = drop.light,
      ids = new Set(rungs.map((r) => r.id));
    for (const my of [rungs[0]!.at, 1500, 0]) {
      const gates = cellGates(f, rungs, my, light);
      // Nothing opens before its world's own date, nor where its world never came to it.
      for (const [id, gate] of [
        ["light", gates.light],
        ["nucleus", gates.nucleus],
        ["together", gates.together],
      ] as const) {
        const r = rungs.find((x) => x.id === id);
        if (!ids.has(id)) assert.ok(!gate.open, `${name}: ${id} never came, never opens`);
        else if (gate.open)
          assert.ok(my <= r!.at, `${name}: ${id} open at ${my}, came at ${r!.at}`);
      }
      if (f.pigment === "polyimine")
        assert.ok(!gates.light.open, `${name}: methane life never lives by light`);
      // A daughter takes up only what is open.
      const k = drop.kinds.find((x) => x.way === "eater") ?? drop.kinds[0]!,
        ds = daughtersOf(firstTraits(k), f.digest, 1, 0, gates, f);
      for (const d of ds)
        if (d.took) assert.ok(gates[d.took].open, `${name}: took ${d.took} unopened`);
    }
  }
  assert.ok(lived >= 4, `${lived} of the six worlds held life`);
});

test("a line asked for is read with the steps of the dawn its forebears went through", () => {
  const g = generateHomeWorld(seedFromText("first light"), EARTHLIKE),
    tree = treeOfLife(g),
    beast = tree.nodes.find((n) => n.kind === "crown" && n.genome),
    f = lineFactsOf(g, beast!.ref) as LineFacts;
  assert.equal(f.line?.ref, beast!.ref);
  assert.ok(
    f.line!.nucleus && f.line!.together,
    "a beast's forebears grew a nucleus and stayed together",
  );
});
