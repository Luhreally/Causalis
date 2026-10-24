import { test } from "node:test";
import assert from "node:assert/strict";
import type { GenesisPlan } from "../../src/bridge/index.ts";
import {
  MEADOW_STEP,
  followBeast,
  followedLife,
  meadowAge,
  meadowCounts,
  meadowLineages,
  meadowProspered,
  meadowProsperedWords,
  newMeadow,
  stepMeadow,
  touchMeadow,
  type MeadowState,
} from "../../src/view/index.ts";
import { lifeAct, livesMade } from "../../src/rules/index.ts";

// Phase 27 M155: an age's living world, played — its beasts grazing, browsing, hunting, bearing
// young and dying; its lineages coming and going with the ages; the god's hand on it, and what
// fared best under it. Pure: a made-up beginning of four ages.

const body = (size: number, moves = "walk") => ({
  symmetry: "bilateral" as const,
  segments: 1 as const,
  legs: 4 as const,
  fins: 0 as const,
  wings: 0 as const,
  covering: "fur",
  size,
  moves,
  eats: "grass",
  level: 2,
  neck: 0.4,
  tail: 0.3,
  features: [],
  warm: true,
});
let n = 0;
const lineage = (
  name: string,
  niche: string,
  size: number,
  arose: number,
  died: number | null,
) => ({
  ref: `spec:0:${n++}`,
  name,
  niche,
  arose,
  died,
  size,
  level: niche.includes("hunt") ? 3 : 2,
  body: body(size, niche === "swimmer" ? "swim" : "walk"),
  words: `a ${niche}`,
});
const age = (index: number, kind = "quiet") => ({
  index,
  from: 400 - index * 50,
  to: 350 - index * 50,
  kind,
  seaLevel: 0,
  warmth: 1,
  forests: true,
});
const PLAN = {
  seed: "meadow test",
  name: "meadow test",
  worldAge: 4500,
  rungs: [],
  drop: null,
  acts: { ages: [], dawn: null, lives: [] },
  ages: [age(0), age(1), age(2), age(3, "impact")],
  lineages: [
    lineage("grey ox", "grazer", 300, 1, null),
    lineage("dun deer", "browser", 90, 1, 1),
    lineage("red cat", "hunter", 150, 1, null),
    lineage("pale hare", "seed-eater", 3, 2, null),
    lineage("spotted hyena", "scavenger", 20, 2, null),
    lineage("green fern", "seed grass", 0, 1, null),
    lineage("blue carp", "swimmer", 10, 2, null),
  ].map((l) => (l.niche === "seed grass" ? { ...l, body: null } : l)),
  people: null,
} as unknown as GenesisPlan;

const run = (s: MeadowState, seconds: number, each?: (s: MeadowState) => void) => {
  for (let i = 0; i < seconds / MEADOW_STEP; i++) {
    stepMeadow(s);
    each?.(s);
  }
};

test("an age's living world holds the beasts of its living lineages, none before life came ashore", () => {
  assert.deepEqual(meadowLineages(PLAN, 0), []);
  assert.deepEqual(meadowLineages(PLAN, 1), [0, 1, 2], "no plant walks the land");
  assert.deepEqual(
    meadowLineages(PLAN, 2),
    [0, 2, 3, 4, 6],
    "the deer died out in age 2's beginning",
  );
  const bare = newMeadow(PLAN, 0);
  assert.equal(bare.beasts.length, 0);
  assert.ok(bare.grass.every((g) => g === 0) && bare.shrubs.length === 0, "the land bare");
  const m = newMeadow(PLAN, 1);
  assert.deepEqual(
    m.kinds.map((k) => [k.name, k.feed]),
    [
      ["grey ox", "graze"],
      ["dun deer", "browse"],
      ["red cat", "hunt"],
    ],
  );
  assert.ok(m.beasts.length >= 12 && m.shrubs.length > 0);
  assert.match(meadowCounts(m), /^grey ox \d+ · dun deer \d+ · red cat \d+$/);
  // The same land, the same lives.
  const a = newMeadow(PLAN, 1),
    b = newMeadow(PLAN, 1);
  run(a, 20);
  run(b, 20);
  assert.deepEqual(
    a.beasts.map((x) => [x.id, x.x, x.z, x.energy]),
    b.beasts.map((x) => [x.id, x.x, x.z, x.energy]),
  );
});

test("its beasts graze, browse, hunt and flee, bear young and die", () => {
  const m = newMeadow(PLAN, 1),
    seen = new Set<string>();
  run(m, 90, (s) => {
    for (const b of s.beasts) seen.add(`${s.kinds[b.kind]!.feed}:${b.doing}`);
  });
  for (const doing of ["graze:grazing", "browse:browsing", "hunt:chasing", "graze:fleeing"])
    assert.ok(seen.has(doing), `${doing} (seen ${[...seen].join(", ")})`);
  assert.ok(m.born > 0, "young borne");
  assert.ok(m.taken > 0, "some taken by the hunters");
  assert.ok(m.died >= m.taken);
  assert.ok(
    m.grass.some((g) => g < 0.5),
    "the grass eaten down where they grazed",
  );
});

test("as the ages pass, the lineages that died out fall and the newly arisen walk in", () => {
  let m = newMeadow(PLAN, 1);
  run(m, 5);
  m = meadowAge(m, PLAN, 2);
  const deer = m.kinds.findIndex((k) => k.name === "dun deer");
  assert.ok(m.kinds[deer]!.gone, "the deer gone");
  const hares = m.kinds.findIndex((k) => k.name === "pale hare");
  assert.ok(hares >= 0 && m.beasts.some((b) => b.kind === hares && b.doing === "coming"));
  run(m, 20);
  assert.equal(
    m.beasts.filter((b) => m.kinds[b.kind]!.name === "dun deer").length,
    0,
    "no deer left",
  );
  assert.ok(m.beasts.some((b) => m.kinds[b.kind]!.name === "pale hare" && b.doing !== "coming"));
  // An age of a great impact: many fall at once; a gone lineage with none left let go.
  const before = m.beasts.length;
  m = meadowAge(m, PLAN, 3);
  run(m, 1);
  assert.ok(m.beasts.length < before * 0.8, `${before} → ${m.beasts.length}`);
  assert.ok(!m.kinds.some((k) => k.name === "dun deer"), "the deer's kind let go");
  assert.ok(
    m.beasts.every((b) => m.kinds[b.kind]),
    "every beast of a kind still kept",
  );
});

test("the god's hand: what fares best against the land left alone, and the act it lays", () => {
  const touched = newMeadow(PLAN, 2),
    alone = newMeadow(PLAN, 2);
  run(touched, 10);
  run(alone, 10);
  assert.equal(meadowProspered(touched, alone), null, "untouched, nothing fared better");
  assert.match(meadowProsperedWords(touched, alone).words, /as they would have been/);
  touchMeadow(touched, "green");
  assert.ok(touched.lush > 0);
  run(touched, 60);
  run(alone, 60);
  const { way, words } = meadowProsperedWords(touched, alone);
  assert.equal(way, "grazers", words);
  assert.match(words, /grazers and seed-eaters of age 3 fared best — \d+ of them/);
  // Laid on the seed, and read back from it.
  const seed = `meadow test ~${lifeAct(2, way!)}`;
  assert.deepEqual([...livesMade(seed, 4)], [[2, "grazers"]]);
  assert.deepEqual(
    [...livesMade("x ~life 9 grazers ~life 2 kings", 4)],
    [],
    "only the ages it has, and its ways",
  );
});

test("a beast followed: its life told, and how it ended", () => {
  const m = newMeadow(PLAN, 2);
  const cat = m.beasts.find((b) => m.kinds[b.kind]!.name === "red cat")!;
  followBeast(m, cat.id);
  assert.ok(cat.marked && m.beasts.filter((b) => b.marked).length === 1);
  assert.match(followedLife(m), /^The red cat you follow is \w+/);
  // Gone: how.
  m.beasts = m.beasts.filter((b) => b.id !== cat.id);
  m.fate = { how: "taken", by: "red cat", at: m.t };
  assert.match(followedLife(m), /^The one you followed was taken by a red cat/);
  followBeast(m, null);
  assert.equal(followedLife(m), "");
});
