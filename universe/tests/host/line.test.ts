// Live a Line past its cells (S2, S3): the bodies a line founds and the young it goes on in are its world's own
// development of a genome, and every one passes its world's physics (the weight its frame bears under its pull, the
// oxygen its breathing feeds), on twenty worlds; the same choices give the same line, age after age; and the line's
// turn from one age to the next costs little.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { EARTHLIKE, OPEN } from "../../src/rules/index.ts";
import { generateHomeWorld, protoLifeWorld, treeOfLife, type HomeWorld } from "../../src/gen/index.ts";
import { bredOn, checkBody, foundersOf, youngOf } from "../../src/host/line.ts";
import { newMeadow } from "../../src/view/meadow.ts";

const SEEDS = [
  "first light",
  "kestrel",
  "ember",
  "tide 41",
  "glass 7",
  "moss 3",
  "rime",
  "kestrel 557",
  "ammon",
  "quill",
  "gale",
  "harrow 2",
  "brine",
  "dune 9",
  "fen",
  "slate 4",
  "cinder",
  "lumen",
  "vesper 12",
  "otter",
];
const worlds: [string, HomeWorld][] = SEEDS.map((n, i) => [n, generateHomeWorld(seedFromText(n), i % 2 ? OPEN : EARTHLIKE)]);
const lifeWorld = (g: HomeWorld) => protoLifeWorld(g as unknown as Parameters<typeof protoLifeWorld>[0]);

test("every body a line may found, and every young it may go on in, passes its world's physics, on twenty worlds", () => {
  let worlds20 = 0,
    bodies = 0;
  for (const [n, g] of worlds) {
    if (!g.life.species.length) continue;
    worlds20++;
    const lw = lifeWorld(g),
      at = treeOfLife(g).rungs.find((r) => r.id === "bodies")?.at ?? 600,
      founders = foundersOf(g, n, 1, 30);
    assert.ok(founders.length >= 2, `${n}: two or more bodies to found (${founders.length})`);
    assert.equal(new Set(founders.map((f) => f.way)).size, founders.length, `${n}: each founder a way of its own`);
    let line = founders[0]!,
      my = at;
    for (const f of founders) {
      assert.deepEqual(checkBody(f.genome, f.way, lw).breaks, [], `${n}: founder ${f.name}`);
      assert.ok(f.reasons.length >= 2, `${n}: a founder told why`);
      bodies++;
    }
    for (let gen = 0; gen < 4; gen++) {
      const young = youngOf(g, line.genome, line.way, my, n, 1, 1000 + gen);
      assert.ok(young.length >= 1, `${n}: young to choose among`);
      for (const y of young) {
        assert.deepEqual(checkBody(y.genome, y.way, lw).breaks, [], `${n}: young ${y.name}`);
        bodies++;
      }
      const bred = bredOn(g, young[0]!.genome, young[0]!.way, my, my - 25, n, 1, 1000 + gen);
      assert.ok(bred.line, `${n}: bred on, its line told`);
      assert.deepEqual(checkBody(bred.genome, bred.way, lw).breaks, [], `${n}: bred on`);
      line = bred.line!;
      my -= 25;
    }
  }
  assert.ok(worlds20 >= 18, `living worlds (${worlds20})`);
  assert.ok(bodies > 200, `bodies checked (${bodies})`);
});

test("the same choices give the same line after five ages, and other choices another", () => {
  const [n, g] = worlds[0]!,
    run = (picks: readonly number[]) => {
      let line = foundersOf(g, n, 3, 30)[picks[0]!]!,
        my = 600;
      const seen: string[] = [];
      for (let gen = 0; gen < 5; gen++) {
        const young = youngOf(g, line.genome, line.way, my, n, 3, 1000 + gen),
          y = young[Math.min(young.length - 1, picks[gen + 1] ?? 0)]!,
          bred = bredOn(g, y.genome, y.way, my, my - 25, n, 3, 1000 + gen);
        line = bred.line!;
        my -= 25;
        seen.push(`${line.way}:${line.genome.mass}:${JSON.stringify(line.genome)}`);
      }
      return seen;
    };
  const a = run([0, 1, 0, 2, 1, 0]),
    b = run([0, 1, 0, 2, 1, 0]),
    c = run([1, 0, 2, 1, 0, 2]);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test("the picker's bodies are read in under 4 ms; a line's turn to the next age in under 30 ms", () => {
  const [n, g] = worlds[2]!;
  foundersOf(g, n, 1, 0);
  let worstPick = 0,
    worstTurn = 0;
  for (let k = 0; k < 10; k++) {
    const t0 = performance.now(),
      f = foundersOf(g, n, 1, k);
    worstPick = Math.max(worstPick, performance.now() - t0);
    const t1 = performance.now(),
      young = youngOf(g, f[0]!.genome, f[0]!.way, 500, n, 1, 1000 + k),
      bred = bredOn(g, young[0]!.genome, young[0]!.way, 500, 475, n, 1, 1000 + k),
      plan = {
        seed: n,
        ages: [],
        lineages: [
          {
            ref: "line:held",
            name: "your line",
            niche: "swimmer",
            arose: 0,
            died: null,
            size: bred.genome.mass,
            level: 2,
            body: bred.line!.body,
            words: null,
          },
        ],
      };
    newMeadow(plan as never, 0, `${n} line ${k}`, false);
    worstTurn = Math.max(worstTurn, performance.now() - t1);
  }
  assert.ok(worstPick < 4, `picker ${worstPick.toFixed(2)} ms`);
  assert.ok(worstTurn < 30, `turn ${worstTurn.toFixed(2)} ms`);
});
