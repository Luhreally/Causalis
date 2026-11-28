// Live a Line past its cells (S2, S3): the bodies a line founds and the young it goes on in are its world's own
// development of a genome, and every one passes its world's physics (the weight its frame bears under its pull, the
// oxygen its breathing feeds), on twenty worlds; the same choices give the same line, age after age; and the line's
// turn from one age to the next costs little.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedFromText } from "../../src/kernel/index.ts";
import { EARTHLIKE, OPEN } from "../../src/rules/index.ts";
import {
  generateHomeWorld,
  protoLifeWorld,
  treeOfLife,
  type HomeWorld,
} from "../../src/gen/index.ts";
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
const worlds: [string, HomeWorld][] = SEEDS.map((n, i) => [
  n,
  generateHomeWorld(seedFromText(n), i % 2 ? OPEN : EARTHLIKE),
]);
const lifeWorld = (g: HomeWorld) =>
  protoLifeWorld(g as unknown as Parameters<typeof protoLifeWorld>[0]);

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
    assert.equal(
      new Set(founders.map((f) => f.way)).size,
      founders.length,
      `${n}: each founder a way of its own`,
    );
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

test("the cell held can live: steered simply toward the nearest food it divides within 90 s, left alone it lasts a minute", async () => {
  const { dawnSeaOf, dropOfWorld } = await import("../../src/host/inspect/small.ts"),
    { newDrop, stepDrop, worth } = await import("../../src/view/drop.ts"),
    { foodOf, heldCell, holdDrop, stepHeld } = await import("../../src/view/drop-held.ts"),
    { firstTraits, swimSpeed } = await import("../../src/view/line.ts");
  for (const [n, g] of worlds.slice(0, 10)) {
    const block = dropOfWorld(g, dawnSeaOf(g), { dawn: true });
    if (!block) continue;
    for (const steer of [true, false]) {
      const s = newDrop(
        block,
        block.kinds.map((k) => k.way === "eater" || k.way === "rock"),
      );
      // (The drop as the mode may find it: lived a while first, its rivals as many as it holds.)
      for (let i = 0; i < 900; i++) stepDrop(s);
      const kind = block.kinds.find((k) => k.way === "eater") ?? block.kinds[0]!,
        t = firstTraits(kind, kind.pace ?? 1),
        h = holdDrop(s, t, swimSpeed(t, { liquid: "water" })),
        w = worth(t.size);
      let at = -1,
        lasted = 120;
      for (let i = 0; i < 30 * 120; i++) {
        const c = heldCell(s, h);
        if (!c || h.ended) {
          lasted = i / 30;
          break;
        }
        if (steer) {
          const f = foodOf(s, c),
            l = f ? Math.hypot(f.dx, f.dy) || 1 : 1;
          h.mx = f ? f.dx / l : 1;
          h.my = f ? f.dy / l : 0;
        }
        stepHeld(s, h);
        if ((heldCell(s, h)?.energy ?? 0) >= 2 * w) {
          at = i / 30;
          break;
        }
      }
      if (steer)
        assert.ok(at > 0 && at <= 90, `${n}: steered to food, divided at ${at} s (ate ${h.ate})`);
      else {
        assert.equal(at, -1, `${n}: left alone it does not divide`);
        // (Starved only by neglect: a minute and more of it.)
        assert.ok(
          lasted >= 60,
          `${n}: left alone it lasts a minute (${lasted} s, ${h.ended || "alive"})`,
        );
      }
    }
  }
});
