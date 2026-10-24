import { test } from "node:test";
import assert from "node:assert/strict";
import type { GenesisPlan } from "../../src/bridge/index.ts";
import {
  ALL_REACHED,
  familiesReached,
  familyColor,
  familyWords,
  peoplingColors,
  peoplingCounts,
  peoplingDoneWords,
  peoplingFront,
  peoplingLandWords,
  peoplingReached,
  peoplingRemakeWords,
  peoplingThrough,
  type Peopling,
} from "../../src/view/index.ts";

// Phase 28: the peopling watched — the bands' front going out land by land, each land the
// colour of its family of tongues, what was come to counted and told, and the hand's acts told.
// Pure: a made-up peopling of five lands, two families.

const PEOPLING: Peopling = {
  cradle: 10,
  middle: 100,
  lands: [
    [10, 0, 10],
    [11, 1, 10],
    [20, 1, 10],
    [12, 2, 11],
    [13, 4, 12],
  ],
  sizes: [100, 80, 60, 50, 40],
  family: [0, 0, 0, 1, 1],
  families: [
    { name: "Kurnic", root: 10, middle: 100, lands: 3, tongues: 2, people: 240 },
    { name: "Bregrish", root: 12, middle: 120, lands: 2, tongues: 1, people: 90 },
  ],
  tongues: [0, 1, 2],
  livable: 8,
};

test("the bands' front goes out with the clock, every land come to before the chronicle opens", () => {
  assert.equal(peoplingFront(PEOPLING, 0), 0);
  assert.equal(peoplingFront(PEOPLING, ALL_REACHED), 5, "past the farthest step");
  assert.equal(peoplingFront(PEOPLING, 1), 5);
  assert.ok(Math.abs(peoplingFront(PEOPLING, peoplingThrough(PEOPLING, 2)) - 2) < 1e-9);
  assert.deepEqual(peoplingReached(PEOPLING, 1), {
    lands: 3,
    people: 240,
    tongues: 2,
    families: 1,
  });
  assert.deepEqual(peoplingReached(PEOPLING, Infinity), {
    lands: 5,
    people: 330,
    tongues: 3,
    families: 2,
  });
  assert.equal(
    peoplingCounts(PEOPLING, 1),
    "3 of 8 lands they could live in reached · 240 people in their bands · 2 tongues of 1 family",
  );
});

test("each land come to takes its family's colour over its ground; lands to come wait dimmed; the sea is as it was", () => {
  // Fine cells: two of the cradle, one each of lands 11, 12 and 13, one of the sea (province 30),
  // one of a land no band came to (province 40).
  const province = Int32Array.from([10, 10, 11, 12, 13, 30, 40]),
    // (The last a land over the sea no band came to.)
    ground = Float32Array.from([5, 5, 5, 5, 5, -50, 5]),
    base = new Uint8Array(province.length * 4).fill(100);
  const at = (c: Uint8Array, i: number) => [c[i * 4], c[i * 4 + 1], c[i * 4 + 2]];
  const colors = peoplingColors(base, province, PEOPLING, 1.5, ground);
  const [r, g, b] = familyColor(0);
  assert.deepEqual(at(colors, 0), [
    Math.floor(100 * 0.28 + r * 0.72),
    Math.floor(100 * 0.28 + g * 0.72),
    Math.floor(100 * 0.28 + b * 0.72),
  ]);
  // (Land 11, come to at step 1 with the front at 1.5: fresher, so brighter.)
  assert.ok(at(colors, 2)[0]! > at(colors, 0)[0]!, "the newest land bright");
  assert.deepEqual(at(colors, 3), [72, 72, 72], "a land to come, greyed");
  assert.deepEqual(at(colors, 5), [100, 100, 100], "the sea as it was");
  assert.deepEqual(at(colors, 6), [55, 55, 55], "land no band came to, greyer still");
  assert.notDeepEqual(familyColor(0), familyColor(1));
});

test("what was come to is told: the families as their first lands are reached, the end, a land tapped", () => {
  assert.deepEqual(familiesReached(PEOPLING, -1, 0), [0]);
  assert.deepEqual(familiesReached(PEOPLING, 0, 1.9), []);
  assert.deepEqual(familiesReached(PEOPLING, 1.9, 2), [1]);
  assert.match(
    familyWords(PEOPLING, 0, "100 thousand years ago"),
    /^100 thousand years ago: in the cradle the first people spoke the first Kurnic/,
  );
  assert.match(
    familyWords(PEOPLING, 1, "60 thousand years ago"),
    /speech grew apart — the first of the Bregrish tongues, one tongue of 2 lands/,
  );
  assert.match(
    peoplingDoneWords(PEOPLING),
    /every land they could walk to — 5 of them, 330 people in all, speaking 3 tongues of 2 families; 3 lands over the sea left for boats to find\.$/,
  );
  const when = (s: number) => `${s} steps on`;
  assert.match(peoplingLandWords(PEOPLING, 10, 0, when), /^The cradle/);
  assert.match(
    peoplingLandWords(PEOPLING, 13, 1, when),
    /^The bands have not come here yet: they will, 4 steps on\./,
  );
  assert.match(
    peoplingLandWords(PEOPLING, 12, 3, when),
    /^Here: Bregrish tongues, their bands come 2 steps on, 2 steps from the cradle; 50 people/,
  );
  assert.match(peoplingLandWords(PEOPLING, 99, 3, when), /^No band came to this land/);
});

test("the hand's acts on the peopling told against the peopling before them", () => {
  const plan = (
    p: Peopling,
    acts: GenesisPlan["acts"]["peopling"],
    cradle = "the savanna at 2°N, 30°E",
  ) =>
    ({
      acts: { ages: [], dawn: null, lives: [], peopling: acts },
      people: { name: "upright apes", cradle },
      peopling: p,
    }) as unknown as GenesisPlan;
  const none = { seasLow: false, age: null, cradle: null } as const,
    wider: Peopling = {
      ...PEOPLING,
      lands: [...PEOPLING.lands, [14, 6, 13]],
      sizes: [...PEOPLING.sizes, 30],
      family: [...PEOPLING.family, 1],
    };
  assert.match(
    peoplingRemakeWords(plan(PEOPLING, none), plan(wider, { ...none, seasLow: true })),
    /^With the seas low the bands walked over to 1 land they would not have reached — 6 in all, 360 people/,
  );
  assert.match(
    peoplingRemakeWords(plan(wider, { ...none, seasLow: true }), plan(PEOPLING, none)),
    /^The seas as they were: the bands came to 5 lands \(6 with the seas low\)/,
  );
  const more: Peopling = { ...PEOPLING, sizes: PEOPLING.sizes.map((s) => s * 2) };
  assert.match(
    peoplingRemakeWords(plan(PEOPLING, none), plan(more, { ...none, age: "kind" })),
    /^In a kind age the bands numbered 660 people by the chronicle's opening, where they would have been 330/,
  );
  assert.match(
    peoplingRemakeWords(
      plan(PEOPLING, none),
      plan({ ...PEOPLING, cradle: 20 }, { ...none, cradle: 1234 }, "the steppe at 40°N, 60°E"),
    ),
    /^The upright apes rose instead in the steppe at 40°N, 60°E: their bands came to 5 lands \(5 before\)/,
  );
});
