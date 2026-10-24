import { test } from "node:test";
import assert from "node:assert/strict";
import type { GenesisPlan } from "../../src/bridge/index.ts";
import { sphereGrid } from "../../src/kernel/index.ts";
import {
  DAWN,
  DeepClock,
  GALAXY_AGE,
  GENESIS,
  ageAt,
  ageColors,
  ageWords,
  arise,
  deepSpeedLabel,
  deepWhen,
  dropOf,
  formingColors,
  genesisSpans,
  newDrop,
  paradeOf,
  prospered,
  remakeWords,
  roundDrop,
  rungsPassed,
  stepDrop,
  touchDrop,
  waysWorth,
  type DropBlock,
} from "../../src/view/index.ts";

const grid = sphereGrid(8),
  n = grid.count,
  // Half the world sea, half land; its land's own colour a green.
  elevation = Float32Array.from({ length: n }, (_, c) =>
    grid.positions[c * 3]! > 0 ? 500 : -3000,
  ),
  land = Uint8Array.from({ length: n * 4 }, (_, i) => [60, 160, 70, 255][i % 4]!);
const rgb = (a: Uint8Array, c: number) => [a[c * 4]!, a[c * 4 + 1]!, a[c * 4 + 2]!] as const;

test("the world forms: molten, then dark crust, then its seas rise over the low ground, then its land greens", () => {
  const sea = [...Array(n).keys()].find((c) => elevation[c]! < 0)!,
    hill = [...Array(n).keys()].find((c) => elevation[c]! > 0)!;
  const molten = formingColors(elevation, land, 0, 1);
  // Glowing: red well over blue.
  assert.ok(rgb(molten, hill)[0] > rgb(molten, hill)[2] + 60);
  const seas = formingColors(elevation, land, 0.72, 1);
  assert.ok(rgb(seas, sea)[2] > rgb(seas, sea)[0] + 40, "the low ground under the sea");
  const done = formingColors(elevation, land, 1, 1);
  assert.deepEqual(rgb(done, hill), [60, 160, 70], "its land as it is");
  assert.deepEqual(rgb(done, sea), [60, 160, 70]);
});

test("each deep age marks the world: an icehouse's ice down from the poles, an impact's flash", () => {
  const polar = [...Array(n).keys()].find((c) => Math.abs(grid.lat[c]!) > 1.3)!,
    equator = [...Array(n).keys()].find((c) => Math.abs(grid.lat[c]!) < 0.1)!,
    ice = ageColors(land, grid.lat, elevation, "icehouse", 0.5, 1);
  assert.ok(rgb(ice, polar)[2] > 200 && rgb(ice, polar)[0] > 200, "ice at the pole");
  assert.deepEqual(rgb(ice, equator), rgb(land, equator), "none at the equator");
  const flash = ageColors(land, grid.lat, elevation, "impact", 0.05, 3);
  assert.ok(rgb(flash, equator)[0] > rgb(land, equator)[0]);
  assert.equal(
    ageWords({
      index: 0,
      from: 520,
      to: 480,
      kind: "icehouse",
      seaLevel: 0,
      warmth: 0,
      forests: false,
    }).startsWith("520 million years ago"),
    true,
  );
});

test("under the microscope: cells dividing, cells with a nucleus, colonies, and the first bodies", () => {
  assert.deepEqual([...DAWN], ["first cells", "nucleus", "colonies", "bodies"]);
  const early = dropOf("first cells", 0.5).skins.length,
    later = dropOf("first cells", 12).skins.length;
  assert.ok(later > early * 4 && later <= 64, `${early} cells, then ${later}`);
  const big = dropOf("nucleus", 3);
  assert.ok(big.nuclei.length >= 10 && big.skins.every((c) => c.sx > 0));
  const balls = dropOf("colonies", 3);
  assert.ok(balls.skins.length >= 5 * 20, "balls of cells");
  const bodies = dropOf("bodies", 3);
  assert.ok(bodies.skins.length > 60 && bodies.bits.length > 10);
});

const lineage = (name: string, arose: number, died: number | null) => ({
  ref: `spec:0:${name.length}`,
  name,
  niche: "grazer",
  arose,
  died,
  size: 100,
  level: 2,
  body: {
    symmetry: "bilateral",
    segments: 1,
    legs: 4,
    fins: 0,
    wings: 0,
    covering: "fur",
    size: 100,
    moves: "walk",
    eats: "grass",
    level: 2,
    neck: 0.4,
    tail: 0.3,
    features: [],
    warm: true,
  },
  words: "a four-legged furred grazer of 100 kg that walks",
});

/** A beginning's plan as the host gives it, but for its ages and lineages. */
const BEGUN = {
  seed: "test",
  name: "test",
  worldAge: 4500,
  rungs: [
    { id: "replicators", name: "The first replicators", at: 4000, words: "chains" },
    { id: "cells", name: "The first cells", at: 3900, words: "cells" },
    { id: "light", name: "Life eats light", at: 3600, words: "light" },
    { id: "nucleus", name: "Cells with a nucleus", at: 2200, words: "nucleus" },
    { id: "together", name: "Cells together", at: 1100, words: "together" },
    { id: "bodies", name: "The first bodies", at: 640, words: "bodies" },
  ],
  drop: null,
  acts: {
    ages: [],
    dawn: null,
    lives: [],
    peopling: { seasLow: false, age: null, cradle: null },
  },
  peopling: null,
} as const;

test("the living world arises age by age: each lineage on the stage from its age, gone after the age it died in", () => {
  const plan: GenesisPlan = {
    ...BEGUN,
    ages: Array.from({ length: 10 }, (_, i) => ({
      index: i,
      from: 500 - i * 50,
      to: 450 - i * 50,
      kind: "quiet",
      seaLevel: 0,
      warmth: 0,
      forests: i > 0,
    })),
    lineages: [
      lineage("old one", 1, 4),
      lineage("young one", 6, null),
      lineage("mid one", 3, null),
    ],
    people: null,
  };
  const at = (age: number) => paradeOf(plan, (age + 0.5) / 10);
  assert.deepEqual(at(0).on, []);
  assert.deepEqual(
    at(2).on.map((o) => plan.lineages[o.lineage]!.name),
    ["old one"],
  );
  assert.deepEqual(
    at(3)
      .on.map((o) => plan.lineages[o.lineage]!.name)
      .sort(),
    ["mid one", "old one"],
  );
  // Gone after the age it died in; the newest nearest.
  const late = at(7).on.map((o) => plan.lineages[o.lineage]!.name);
  assert.deepEqual(late, ["young one", "mid one"]);
  // Coming in as it arises, fading as it dies.
  const arising = paradeOf(plan, 6.05 / 10).on.find(
    (o) => plan.lineages[o.lineage]!.name === "young one",
  )!;
  assert.ok(arising.there < 0.5);
  const dying = paradeOf(plan, 4.9 / 10).on.find(
    (o) => plan.lineages[o.lineage]!.name === "old one",
  )!;
  assert.ok(dying.there < 0.5);
});

// —— Played (Phase 24) ——————————————————————————————————————————————————————————————

/** Sixteen ages of twenty-five million years, the last running to now. */
const AGES_16 = Array.from({ length: 16 }, (_, i) => ({
  index: i,
  from: (16 - i) * 25,
  to: (15 - i) * 25,
  kind: "quiet",
  seaLevel: 0,
  warmth: 0,
  forests: i > 0,
}));

test("the genesis plays on a deep clock: its stages oldest first, each at its own speeds; paused, it stands", () => {
  const spans = genesisSpans({ ...BEGUN, ages: AGES_16 });
  assert.deepEqual(
    spans.map((s) => s.stage),
    [...GENESIS],
  );
  assert.equal(spans[0]!.from, GALAXY_AGE);
  assert.equal(spans.at(-1)!.to, 0);
  for (let i = 0; i < spans.length; i++) {
    assert.ok(spans[i]!.from > spans[i]!.to, `${spans[i]!.stage} runs forward`);
    if (i) assert.equal(spans[i]!.from, spans[i - 1]!.to);
    assert.ok(spans[i]!.speeds.includes(spans[i]!.start));
  }
  // The dawn's stages by its own steps: the first cells to the nucleus, cells together to bodies.
  const at = (stage: string) => spans.find((s) => s.stage === stage)!;
  assert.deepEqual([at("first cells").from, at("first cells").to], [4000, 2200]);
  assert.deepEqual([at("colonies").from, at("colonies").to], [1100, 640]);
  assert.deepEqual([at("ages").from, at("ages").to], [400, 2]);
  // Billions of years a second as the galaxy turns; an age every few seconds as life arises.
  assert.ok(at("galaxy").start >= 1000 && at("ages").start <= 25 && at("people").start < 1);
  // The bands' peopling of the land the last hundred thousand years, thousands of years a second.
  assert.deepEqual([at("people").to, at("peopling").from, at("peopling").to], [0.1, 0.1, 0]);
  assert.ok(at("peopling").speeds.every((s) => s >= 0.001 && s <= 0.005));

  const clock = new DeepClock(spans);
  assert.equal(clock.at, 0);
  clock.run(2);
  assert.equal(clock.my, GALAXY_AGE - 2 * at("galaxy").start);
  clock.choose(0);
  clock.run(5);
  assert.equal(clock.my, GALAXY_AGE - 2 * at("galaxy").start, "paused, it stands");
  assert.equal(clock.lit, 0);
  assert.ok(clock.pick(1));
  assert.equal(clock.speed, at("galaxy").speeds[0]);
  // Each stage its own speed, kept when it is come back to.
  clock.jump(3);
  assert.equal(clock.span.stage, "first cells");
  assert.equal(clock.speed, at("first cells").start);
  clock.pick(3);
  clock.jump(4);
  assert.equal(clock.speed, at("nucleus").start);
  clock.jump(3);
  assert.equal(clock.speed, at("first cells").speeds[2]);
  // Held while the world is remade, whatever speed is chosen; let go, it runs on.
  clock.hold("remake");
  clock.pick(2);
  assert.ok(clock.stopped);
  clock.release("remake");
  assert.ok(!clock.stopped);
  clock.jump(GENESIS.length);
  assert.ok(clock.done);
  assert.equal(clock.span.stage, "peopling");

  assert.equal(deepWhen(4120), "4.12 billion years ago");
  assert.equal(deepWhen(312.4), "312 million years ago");
  assert.equal(deepWhen(1.44), "1.4 million years ago");
  assert.equal(deepWhen(0.64), "640 thousand years ago");
  assert.equal(deepWhen(0), "the first year");
  assert.deepEqual([1000, 100, 0.2].map(deepSpeedLabel), ["1 Gyr/s", "100 Myr/s", "200 kyr/s"]);
  assert.deepEqual(
    rungsPassed(BEGUN, 4000.5, 3500).map((r) => r.id),
    ["replicators", "cells", "light"],
  );
  assert.deepEqual(ageAt({ ages: AGES_16 }, 410), { age: -1, within: 0 });
  assert.equal(ageAt({ ages: AGES_16 }, 390).age, 0);
  assert.ok(Math.abs(ageAt({ ages: AGES_16 }, 390).within - 0.4) < 1e-9);
  assert.equal(ageAt({ ages: AGES_16 }, 0).age, 15);
});

test("what an act laid on the dawn did is told: the age made otherwise and who ended in it, what prospered and what ran after it", () => {
  const before: GenesisPlan = {
      ...BEGUN,
      ages: AGES_16,
      lineages: [lineage("grey ox", 1, 2), lineage("dun ox", 1, null), lineage("red ox", 4, null)],
      people: null,
    },
    after: GenesisPlan = {
      ...before,
      ages: AGES_16.map((a) => (a.index === 2 ? { ...a, kind: "impact" } : a)),
      lineages: [lineage("grey ox", 1, 2), lineage("dun ox", 1, 2), lineage("pale ox", 4, null)],
    };
  const struck = remakeWords(before, after, "age 3 strike");
  assert.match(struck, /^Age 3 struck from the sky: .*an age ended by a great impact/);
  assert.match(struck, /2 lineages ended in it, where 1 would have\./);
  assert.match(struck, /arose pale ox, that would not have/);
  const hunters = {
    ...after,
    lineages: [...after.lineages, { ...lineage("long wolf", 5, null), niche: "hunter" }],
  };
  assert.match(
    remakeWords(after, hunters, "dawn hunters"),
    /the hunting cells prospered under your hand, .* to hunters \(0 lineages of them, now 1\)/,
  );
  const risen = (name: string) => ({
    name,
    words: "",
    because: "",
    cradle: "",
    arose: 15,
    figure: {
      clade: "ape",
      medium: "land" as const,
      symmetry: "bilateral" as const,
      manipulators: "hands",
      limbs: 4,
      skin: "fur",
      size: 60,
    },
  });
  assert.match(
    remakeWords(
      { ...before, people: risen("upright apes") },
      { ...after, people: risen("tall owls") },
      "age 3 strike",
    ),
    /It was the tall owls that rose to thought, not the upright apes\./,
  );
});

const DAWN_KINDS: DropBlock["kinds"] = [
  {
    ref: "a",
    name: "small cells",
    line: "the first cells",
    way: "eater",
    color: [1, 0.8, 0.4],
    size: 2,
    share: 0.58,
  },
  {
    ref: "b",
    name: "light-eaters",
    line: "the light-eaters",
    way: "light",
    color: [0.4, 0.9, 0.4],
    size: 5,
    share: 0.32,
  },
  {
    ref: "c",
    name: "hunting cells",
    line: "cells with a nucleus",
    way: "hunter",
    color: [0.8, 0.6, 1],
    size: 24,
    share: 0.05,
  },
  {
    ref: "d",
    name: "cells together",
    line: "cells together",
    way: "colony",
    color: [0.4, 0.8, 0.6],
    size: 34,
    share: 0.05,
  },
];
const SEA: DropBlock = {
  type: "drop",
  habitat: "sea",
  seed: 7,
  light: 0.9,
  warmth: 24,
  food: 0.7,
  kinds: DAWN_KINDS,
};
const runFor = (s: Parameters<typeof stepDrop>[0], seconds: number) => {
  const end = s.t + seconds;
  while (s.t < end) stepDrop(s);
};

test("the first seas' drop is alive: only the first cells at first, the rest arising as the dawn comes to them", () => {
  const s = newDrop(SEA, [true, false, false, false]);
  assert.ok(s.cells.length > 50 && s.cells.every((c) => c.way === "eater"));
  runFor(s, 20);
  assert.ok(s.born > 0, "they divide");
  assert.ok(
    s.cells.every((c) => c.way === "eater"),
    "no kind comes that has not arisen",
  );
  arise(s, 1);
  arise(s, 2);
  assert.ok(s.cells.some((c) => c.way === "light") && s.cells.some((c) => c.way === "hunter"));
  runFor(s, 10);
  // In the round: every part within the water's slab, each kind in its own list.
  const r = roundDrop(s, s.cells[0]!.id);
  assert.equal(r.kinds.length, 4);
  assert.ok(r.kinds[0]!.length >= s.cells.filter((c) => c.way === "eater").length);
  for (const list of [...r.kinds, r.nuclei, r.motes])
    for (const p of list) assert.ok(Math.abs(p.x) < 7 && Math.abs(p.y) < 5 && Math.abs(p.z) < 2);
  assert.ok(r.nuclei.length >= s.cells.filter((c) => c.way === "hunter").length);
  assert.ok(r.marks.length >= 1, "the cell followed is ringed");
  // The hand: fed, it has more to eat.
  const motes = s.motes.length;
  touchDrop(s, "feed", SEA);
  assert.equal(s.motes.length, motes + 80);
});

test("what prospered in the drop under the hand is judged against the drop left alone", () => {
  const touched = newDrop(SEA, [true, true, true, true]),
    alone = newDrop(SEA, [true, true, true, true]);
  // (Shaded and shaded again: the light-eaters starve.)
  for (let k = 0; k < 6; k++) {
    touchDrop(touched, "shade", SEA);
    runFor(touched, 6);
    runFor(alone, 6);
  }
  const w = waysWorth(alone);
  assert.ok([...w.values()].reduce((a, b) => a + b, 0) > 0.99);
  assert.notEqual(prospered(touched, w), "light");
  assert.equal(prospered(alone, w), prospered(alone, waysWorth(alone)));
});
